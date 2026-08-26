// ===== IMPORT EXCEL PAGE =====
let importSrcTables = [];

function syncImportColYear() {
    const pubYearInp = document.getElementById('import-pub-year');
    const colYearInp = document.getElementById('import-col-year');
    if (!pubYearInp || !colYearInp) return;
    const py = parseInt(pubYearInp.value, 10);
    if (!isNaN(py) && py > 1900) {
        colYearInp.value = py - 1;
    }
}

async function loadImportExcelPage() {
    const srcSelect = document.getElementById('import-src-doc');
    if (!srcSelect) return;
    try {
        const res = await fetch(`${API_BASE}/documents`);
        const docs = await res.json();
        srcSelect.innerHTML = '<option value="">-- Pilih publikasi --</option>';
        docs.filter(d => d.status === 'ready')
            .sort((a, b) => (b.year || 0) - (a.year || 0))
            .forEach(d => {
                const opt = document.createElement('option');
                opt.value = d.id;
                opt.dataset.year = d.year || '';
                const dataYear = d.year ? d.year - 1 : '-';
                opt.textContent = `Publikasi ${d.year} (Data ${dataYear}) - ${d.filename}`;
                srcSelect.appendChild(opt);
            });
        document.getElementById('import-src-bab').innerHTML = '<option value="">-- Pilih Bab --</option>';
        document.getElementById('import-src-table').innerHTML = '<option value="">-- Pilih Tabel --</option>';
        document.getElementById('import-template-hint').textContent = '';
        
        // Muat daftar publikasi hasil import template
        loadImportedExcelPublications();
    } catch (err) {
        showToast('error', 'Gagal', `Gagal memuat publikasi: ${err.message}`);
    }
}

async function loadImportedExcelPublications() {
    const listEl = document.getElementById('excel-imported-pub-list');
    if (!listEl) return;
    try {
        const res = await fetch(`${API_BASE}/documents`);
        const docs = await res.json();
        const excelDocs = docs.filter(doc => (doc.filename || '').toLowerCase().endsWith('.xlsx') || doc.status === 'ready_excel');
        
        if (excelDocs.length === 0) {
            listEl.innerHTML = `
                <div class="text-center py-3 text-muted" style="font-size:0.82rem;">
                    <i class="bi bi-info-circle me-1"></i> Belum ada publikasi yang diimpor dari template Excel.
                </div>
            `;
            return;
        }

        // Ambil jumlah tabel per dokumen secara paralel
        const docCounts = await Promise.all(excelDocs.map(async (doc) => {
            try {
                const tblRes = await fetch(`${API_BASE}/documents/${doc.id}/tables`);
                if (tblRes.ok) {
                    const tbls = await tblRes.json();
                    return { id: doc.id, count: Array.isArray(tbls) ? tbls.length : 0 };
                }
            } catch (_) {}
            return { id: doc.id, count: 0 };
        }));
        const tableCountMap = {};
        docCounts.forEach(dc => {
            tableCountMap[dc.id] = dc.count;
        });

        listEl.innerHTML = excelDocs.map(doc => {
            const count = tableCountMap[doc.id] || 0;
            return `
                <div class="excel-pub-card p-3 rounded-3 d-flex justify-content-between align-items-center flex-wrap gap-3">
                    <div class="d-flex flex-column gap-1.5" style="min-width:280px;">
                        <div class="d-flex align-items-center gap-2 flex-wrap">
                            <div class="pub-card-icon-box d-flex align-items-center justify-content-center rounded-2" style="width:32px; height:32px; font-size:1.1rem;">
                                <i class="bi bi-file-earmark-spreadsheet-fill"></i>
                            </div>
                            <span class="fw-bold pub-card-title" style="font-size:0.95rem;">Publikasi Kabupaten Tasikmalaya Dalam Angka ${doc.year}</span>
                            <span class="badge pub-card-badge px-2 py-1" style="font-size:0.72rem; font-weight:600;">Sumber: Template Excel</span>
                        </div>
                        <div class="pub-card-subtext small d-flex gap-3 align-items-center flex-wrap" style="font-size:0.8rem; margin-left: 40px;">
                            <span class="d-inline-flex align-items-center gap-1"><i class="bi bi-calendar3"></i> Tahun Publikasi: <strong class="pub-card-strong">${doc.year}</strong> (Data ${doc.year ? doc.year - 1 : '-'})</span>
                            <span class="opacity-50">•</span>
                            <span class="d-inline-flex align-items-center gap-1"><i class="bi bi-table text-primary"></i> <strong class="text-primary">${count} Tabel</strong> Aktif</span>
                        </div>
                    </div>
                    <div class="d-flex align-items-center gap-2 flex-wrap ms-auto">
                        <button class="btn btn-edit-bab btn-sm px-3 py-1.5 d-inline-flex align-items-center gap-1.5 rounded-2" onclick="openTocEditor(${doc.id}, 'Publikasi ${doc.year}')" style="font-size:0.82rem; font-weight:500;" title="Edit daftar nama bab untuk Publikasi ${doc.year}">
                            <i class="bi bi-pencil-square text-primary"></i> Edit Bab Manual
                        </button>
                        <button class="btn btn-primary btn-sm px-3 py-1.5 d-inline-flex align-items-center gap-1.5 rounded-2 shadow-sm" onclick="viewState.selectedDocId=${doc.id}; viewState.selectedBabNum=null; navigateDataTabelTab('publikasi');" style="font-size:0.82rem; font-weight:500;" title="Lihat semua tabel di Publikasi ${doc.year}">
                            <i class="bi bi-folder2-open"></i> Buka Data Tabel
                        </button>
                        <button class="btn btn-outline-danger btn-sm px-2.5 py-1.5 d-inline-flex align-items-center rounded-2" onclick="deleteDocument(${doc.id})" style="font-size:0.82rem;" title="Hapus publikasi ini">
                            <i class="bi bi-trash"></i>
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    } catch (err) {
        listEl.innerHTML = `<div class="text-danger small p-2">Gagal memuat status publikasi Excel: ${err.message}</div>`;
    }
}

async function importLoadTables() {
    const docSelect = document.getElementById('import-src-doc');
    const docId = docSelect ? docSelect.value : null;
    const babSelect = document.getElementById('import-src-bab');
    const tableSelect = document.getElementById('import-src-table');
    const hint = document.getElementById('import-template-hint');
    const pubYearInp = document.getElementById('import-pub-year');
    const colYearInp = document.getElementById('import-col-year');

    tableSelect.innerHTML = '<option value="">-- Pilih Tabel --</option>';
    babSelect.innerHTML = '<option value="">-- Pilih Bab --</option>';
    hint.textContent = '';

    if (!docId) return;

    // Auto-fill Tahun Publikasi & Tahun Data (T-1)
    const selectedOpt = docSelect.options[docSelect.selectedIndex];
    if (selectedOpt && selectedOpt.dataset.year) {
        const py = parseInt(selectedOpt.dataset.year, 10);
        if (pubYearInp) pubYearInp.value = py;
        if (colYearInp) colYearInp.value = py - 1;
    }

    try {
        const res = await fetch(`${API_BASE}/documents/${docId}/tables`);
        importSrcTables = await res.json();

        // Group by bab (dari nomor tabel, konsisten dgn halaman Data Tabel)
        const grouped = {};
        importSrcTables.forEach(t => {
            const match = (t.table_name || '').match(/Tabel[\s_]*(\d+)/i);
            const babNum = match && match[1] ? parseInt(match[1], 10) : 999;
            const babName = match ? `Bab ${babNum}` : 'Lainnya';
            if (!grouped[babNum]) grouped[babNum] = { name: babName, num: babNum, tables: [] };
            grouped[babNum].tables.push(t);
        });

        Object.values(grouped)
            .sort((a, b) => a.num - b.num)
            .forEach(g => {
                const opt = document.createElement('option');
                opt.value = g.num;
                opt.textContent = `${g.name} (${g.tables.length})`;
                babSelect.appendChild(opt);
            });
    } catch (err) {
        showToast('error', 'Gagal', `Gagal memuat tabel: ${err.message}`);
    }
}

function importOnBabChange() {
    const babNum = document.getElementById('import-src-bab').value;
    const tableSelect = document.getElementById('import-src-table');
    tableSelect.innerHTML = '<option value="">-- Pilih Tabel --</option>';
    if (!babNum) return;

    const tables = importSrcTables.filter(t => {
        const m = (t.table_name || '').match(/Tabel[\s_]*(\d+)/i);
        const bn = m && m[1] ? parseInt(m[1], 10) : 999;
        return bn === parseInt(babNum, 10);
    });

    tables.sort((a, b) => (a.table_name || '').localeCompare(b.table_name || ''))
        .forEach(t => {
            const opt = document.createElement('option');
            opt.value = t.id;
            opt.textContent = t.table_name;
            tableSelect.appendChild(opt);
        });
}

function importOnTableChange() {
    const tableId = document.getElementById('import-src-table').value;
    const hint = document.getElementById('import-template-hint');
    if (!tableId) { hint.textContent = ''; return; }
    const t = importSrcTables.find(x => x.id === parseInt(tableId, 10));
    if (t) {
        hint.textContent = `Template: ${t.table_name} (${(t.headers || []).length} kolom). Kolom 1 (rincian) terisi otomatis; header, satuan, dan tahun juga terisi. Isi data angka di kolom lain.`;
    }
}

async function importDownloadTemplate() {
    const tableId = document.getElementById('import-src-table').value;
    if (!tableId) {
        showToast('warning', 'Perhatian', 'Pilih Tabel terlebih dahulu.');
        return;
    }
    const pubYear = document.getElementById('import-pub-year') ? document.getElementById('import-pub-year').value : '';
    const colYear = document.getElementById('import-col-year') ? document.getElementById('import-col-year').value : '';
    const params = [`table_id=${tableId}`];
    if (pubYear) params.push(`pub_year=${pubYear}`);
    if (colYear) params.push(`col_year=${colYear}`);
    const query = `?${params.join('&')}`;

    try {
        const res = await fetch(`${API_BASE}/import/template${query}`);
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            showToast('error', 'Gagal', err.detail || 'Gagal mengunduh template.');
            return;
        }
        const blob = await res.blob();
        const t = importSrcTables.find(x => x.id === parseInt(tableId, 10));
        const filename = `${(t && t.table_name ? t.table_name : 'template').replace(/[\\/:*?"<>|]/g, '_')}.xlsx`;
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(a.href);
        showToast('success', 'Berhasil!', 'Template berhasil diunduh.', 2500);
    } catch (err) {
        showToast('error', 'Gagal', `Gagal mengunduh template: ${err.message}`);
    }
}

async function importDownloadBabZip() {
    const docId = document.getElementById('import-src-doc').value;
    const babNum = document.getElementById('import-src-bab').value;
    if (!docId) {
        showToast('warning', 'Perhatian', 'Pilih Sumber Header (Publikasi) terlebih dahulu.');
        return;
    }
    if (!babNum) {
        showToast('warning', 'Perhatian', 'Pilih Bab terlebih dahulu.');
        return;
    }
    const pubYear = document.getElementById('import-pub-year') ? document.getElementById('import-pub-year').value : '';
    const colYear = document.getElementById('import-col-year') ? document.getElementById('import-col-year').value : '';
    const params = [`doc_id=${docId}`, `bab_num=${babNum}`];
    if (pubYear) params.push(`pub_year=${pubYear}`);
    if (colYear) params.push(`col_year=${colYear}`);
    const query = `?${params.join('&')}`;

    try {
        const res = await fetch(`${API_BASE}/import/template/zip${query}`);
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            showToast('error', 'Gagal', err.detail || 'Gagal mengunduh ZIP.');
            return;
        }
        const blob = await res.blob();
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `templates_Bab${babNum}.zip`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(a.href);
        showToast('success', 'Berhasil!', 'Semua template bab berhasil diunduh (ZIP).', 2500);
    } catch (err) {
        showToast('error', 'Gagal', `Gagal mengunduh ZIP: ${err.message}`);
    }
}

async function importUploadExcel() {
    const year = document.getElementById('import-year').value;
    const fileInput = document.getElementById('import-file');
    const resultDiv = document.getElementById('import-result');
    const excelBar = document.getElementById('excel-upload-bar');
    const excelProgress = document.getElementById('excel-upload-progress');
    const excelStatus = document.getElementById('excel-upload-status');

    let files = [];
    if (typeof __excelDragFiles !== 'undefined' && __excelDragFiles && __excelDragFiles.length) {
        files = __excelDragFiles;
    } else if (fileInput && fileInput.files && fileInput.files.length) {
        files = Array.from(fileInput.files);
    }

    if (!files || files.length === 0) {
        showToast('warning', 'Perhatian', 'Pilih minimal satu file .xlsx terlebih dahulu.');
        return;
    }

    const fd = new FormData();
    if (year) fd.append('year', year);
    files.forEach(f => {
        fd.append('files', f);
    });

    resultDiv.textContent = `Mengimpor ${files.length} file...`;
    if (excelProgress) excelProgress.style.display = 'block';
    if (excelBar) { excelBar.style.width = '0%'; excelBar.classList.add('progress-bar-animated'); excelBar.classList.remove('bg-success','bg-danger'); }
    if (excelStatus) excelStatus.textContent = `Mengunggah ${files.length} file...`;

    Swal.fire({ 
        title: `Mengimpor ${files.length} File Excel...`, 
        text: 'Membaca seluruh tabel dan sheet, mohon tunggu sebentar...', 
        allowOutsideClick: false, 
        didOpen: () => Swal.showLoading() 
    });

    try {
        const res = await uploadWithProgress(`${API_BASE}/import/excel`, fd, excelBar, excelStatus);
        Swal.close();
        const data = await res.json();
        if (!res.ok) {
            resultDiv.textContent = '';
            showToast('error', 'Gagal', data.detail || 'Gagal mengimpor file.');
            if (excelStatus) excelStatus.textContent = 'Gagal';
            if (excelBar) { excelBar.classList.remove('progress-bar-animated'); excelBar.classList.add('bg-danger'); }
            return;
        }
        resultDiv.innerHTML = (data.message || 'Berhasil diimpor.') + ` &nbsp;<a href="javascript:void(0)" onclick="viewState.selectedDocId=${data.document_id}; viewState.selectedBabNum=null; navigateDataTabelTab('publikasi');" style="color:#2563eb; font-weight:600; text-decoration:underline;">Buka publikasi →</a>`;
        showToast('success', 'Berhasil!', data.message || 'Tabel berhasil diimpor.', 4000);
        
        __excelDragFiles = [];
        if (fileInput) fileInput.value = '';
        document.getElementById('import-year').value = '';
        const txt = document.getElementById('excel-drop-text');
        if (txt) {
            txt.innerHTML = `
                <i class="bi bi-file-earmark-spreadsheet text-success dropzone-icon"></i><br>
                <span class="fw-semibold text-dark">Seret & lepas 1 atau banyak file .xlsx di sini</span>, atau <span class="text-success text-decoration-underline">pilih file</span>
                <div class="text-muted" style="font-size:0.72rem; margin-top:2px;">Dapat memilih banyak file sekaligus (Multi-File Import)</div>
            `;
        }
        if (excelProgress) excelProgress.style.display = 'none';
        loadImportedExcelPublications();
        if (typeof populateDocumentList === 'function') populateDocumentList();
    } catch (err) {
        Swal.close();
        resultDiv.textContent = '';
        showToast('error', 'Gagal', `Gagal mengimpor: ${err.message}`);
        if (excelStatus) excelStatus.textContent = 'Error';
    }
}

async function detectToc(docId) {
    Swal.fire({
        title: 'Mendeteksi Bab Otomatis',
        text: 'Membaca daftar isi dokumen PDF (TOC)...',
        allowOutsideClick: false,
        didOpen: () => {
            Swal.showLoading();
        }
    });
    
    try {
        const res = await fetch(`${API_BASE}/documents/${docId}/detect_toc`, {
            method: "POST"
        });
        
        Swal.close();
        if (res.ok) {
            const data = await res.json();
            showToast('success', 'Berhasil!', data.message || 'Deteksi bab otomatis selesai.', 2000);
            await populateBabDropdown(docId);
        } else {
            const err = await res.json();
            showToast('error', 'Gagal', err.detail || 'Gagal mendeteksi bab secara otomatis.');
        }
    } catch (e) {
        Swal.close();
        showToast('error', 'Error', e.message);
    }
}

async function populateBabDropdown(docId) {
    const select = document.getElementById(`select-bab-${docId}`);
    if (!select) return;
    try {
        const res = await fetch(`${API_BASE}/documents/${docId}/toc`);
        if (res.ok) {
            const toc = await res.json();
            if (toc && toc.length > 0) {
                select.innerHTML = '<option value="">-- Pilih Bab (Otomatis) --</option>';
                toc.forEach((item, index) => {
                    select.innerHTML += `<option value="${index}" data-start="${item.start_page}" data-end="${item.end_page}">${item.title} (Hal ${item.start_page}-${item.end_page})</option>`;
                });
                
                select.onchange = () => {
                    const selectedOpt = select.options[select.selectedIndex];
                    const startVal = selectedOpt.getAttribute('data-start');
                    const endVal = selectedOpt.getAttribute('data-end');
                    if (startVal && endVal) {
                        document.getElementById(`start-${docId}`).value = startVal;
                        document.getElementById(`end-${docId}`).value = endVal;
                    } else {
                        document.getElementById(`start-${docId}`).value = '';
                        document.getElementById(`end-${docId}`).value = '';
                    }
                };
            } else {
                select.innerHTML = '<option value="">Daftar Bab belum terdeteksi</option>';
            }
        }
    } catch (err) {
        console.error("Gagal memuat daftar bab:", err);
        select.innerHTML = '<option value="">Gagal memuat bab</option>';
    }
}

async function openTocEditor(docId, filename) {
    try {
        const res = await fetch(`${API_BASE}/documents/${docId}/toc`);
        if (!res.ok) throw new Error("Gagal mengambil TOC");
        let toc = await res.json() || [];

        // Deteksi apakah dokumen adalah Excel (tidak memerlukan input nomor halaman)
        const isPdf = typeof filename === 'string' && filename.toLowerCase().endsWith('.pdf');


// ==========================================
// FITUR TAMBAH TABEL & PUBLIKASI BARU (DATA TABEL)
// ==========================================

let _createDocCallback = false;

function openCreateDocModal(fromCreateTable = false) {
    if (!checkRoleAccess('publikasi')) return;

    _createDocCallback = fromCreateTable;

    const form = document.getElementById('form-create-doc');
    if (form) form.reset();

    const yearInput = document.getElementById('create-doc-year');
    const filenameInput = document.getElementById('create-doc-filename');
    
    const nextYr = new Date().getFullYear() + 1;
    const initialYr = nextYr > 2026 ? nextYr : 2027;
    if (yearInput) yearInput.value = initialYr;

    if (filenameInput) filenameInput.value = `Kabupaten Tasikmalaya Dalam Angka ${initialYr}`;

    onDocYearChange();
    setDocCreationMode('empty');

    if (fromCreateTable) {
        const tableModalEl = document.getElementById('modal-create-table');
        if (tableModalEl) {
            const tm = bootstrap.Modal.getInstance(tableModalEl);
            if (tm) tm.hide();
        }
    }

    const modalEl = document.getElementById('modal-create-doc');
    if (modalEl) {
        const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
        modal.show();
    }
}

function onDocYearChange() {
    const yr = document.getElementById('create-doc-year')?.value || '2027';
    document.querySelectorAll('.badge-doc-yr').forEach(el => {
        el.textContent = yr;
    });
}

function quickSetDocTitle(prefix) {
    const yr = document.getElementById('create-doc-year')?.value || '2027';
    const filenameInput = document.getElementById('create-doc-filename');
    if (filenameInput) {
        filenameInput.value = `${prefix} ${yr}`;
        filenameInput.focus();
    }
}

function setDocCreationMode(mode) {
    const emptyBox = document.getElementById('doc-mode-box-empty');
    const pdfBox = document.getElementById('doc-mode-box-pdf');
    const pdfRadio = document.getElementById('doc-mode-pdf');
    const emptyRadio = document.getElementById('doc-mode-empty');
    const pdfContainer = document.getElementById('create-doc-pdf-container');

    if (mode === 'pdf') {
        if (pdfRadio) pdfRadio.checked = true;
        if (pdfBox) {
            pdfBox.classList.add('border-primary');
            pdfBox.style.backgroundColor = 'rgba(37, 99, 235, 0.08)';
        }
        if (emptyBox) {
            emptyBox.classList.remove('border-primary');
            emptyBox.style.backgroundColor = '';
        }
        if (pdfContainer) pdfContainer.style.display = 'block';
    } else {
        if (emptyRadio) emptyRadio.checked = true;
        if (emptyBox) {
            emptyBox.classList.add('border-primary');
            emptyBox.style.backgroundColor = 'rgba(37, 99, 235, 0.08)';
        }
        if (pdfBox) {
            pdfBox.classList.remove('border-primary');
            pdfBox.style.backgroundColor = '';
        }
        if (pdfContainer) pdfContainer.style.display = 'none';
    }
}

async function submitCreateDoc() {
    const yearInput = document.getElementById('create-doc-year');
    const filenameInput = document.getElementById('create-doc-filename');
    const pdfRadio = document.getElementById('doc-mode-pdf');
    const fileInput = document.getElementById('create-doc-file');

    const year = yearInput ? parseInt(yearInput.value) : null;
    const filename = filenameInput ? filenameInput.value.trim() : '';
    const isPdfMode = pdfRadio ? pdfRadio.checked : false;

    if (!year || isNaN(year)) {
        showToast('warning', 'Peringatan', 'Silakan masukkan tahun publikasi!');
        if (yearInput) yearInput.focus();
        return;
    }

    if (!filename) {
        showToast('warning', 'Peringatan', 'Nama / judul publikasi wajib diisi!');
        if (filenameInput) filenameInput.focus();
        return;
    }

    if (isPdfMode && (!fileInput || !fileInput.files || fileInput.files.length === 0)) {
        showToast('warning', 'Peringatan', 'Silakan pilih berkas PDF publikasi yang ingin diunggah!');
        return;
    }

    Swal.fire({
        title: 'Mendaftarkan Publikasi...',
        text: 'Membuat buku publikasi dan menyiapkan ruang basis data.',
        allowOutsideClick: false,
        didOpen: () => { Swal.showLoading(); }
    });

    try {
        let createdDoc = null;

        if (isPdfMode) {
            const formData = new FormData();
            formData.append('year', year);
            formData.append('file', fileInput.files[0]);

            const res = await fetch(`${API_BASE}/documents`, {
                method: 'POST',
                body: formData
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.detail || 'Gagal mengunggah dan membuat publikasi.');
            }
            createdDoc = await res.json();
        } else {
            const payload = {
                filename: filename,
                year: year
            };

            const res = await fetch(`${API_BASE}/documents/create`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.detail || 'Gagal membuat publikasi baru.');
            }
            createdDoc = await res.json();
        }

        // Tutup modal create doc
        const modalEl = document.getElementById('modal-create-doc');
        if (modalEl) {
            const m = bootstrap.Modal.getInstance(modalEl);
            if (m) m.hide();
        }

        Swal.close();

        // Refresh publikasi di semua tempat
        if (typeof loadDocuments === 'function') loadDocuments();
        if (typeof populateDocumentList === 'function') populateDocumentList();

        const fromCreateTable = _createDocCallback;
        _createDocCallback = false;

        if (fromCreateTable) {
            // Kembali ke modal create table dan langsung pilih publikasi yang baru dibuat
            Swal.fire({
                title: '🎉 Publikasi Berhasil Dibuat!',
                text: `Publikasi '${filename}' (${year}) siap digunakan. Membuka formulir tambah tabel...`,
                icon: 'success',
                timer: 1600,
                showConfirmButton: false
            });
            setTimeout(() => {
                openCreateTableModal(createdDoc.id);
            }, 600);
        } else {
            Swal.fire({
                title: '🎉 Publikasi Berhasil Ditambahkan!',
                html: `<div class="text-start small text-muted">
                    <p class="mb-1"><b>Nama:</b> ${escHtml(createdDoc.filename)}</p>
                    <p class="mb-2"><b>Tahun:</b> ${createdDoc.year}</p>
                    <p class="text-dark mb-0">Publikasi telah terdaftar. Anda dapat langsung menambahkan tabel baru ke publikasi ini.</p>
                </div>`,
                icon: 'success',
                showCancelButton: true,
                confirmButtonColor: '#2563eb',
                cancelButtonColor: '#64748b',
                confirmButtonText: '➕ Tambah Tabel ke Publikasi Ini',
                cancelButtonText: 'Tutup'
            }).then((res) => {
                if (res.isConfirmed) {
                    openCreateTableModal(createdDoc.id);
                }
            });
        }

    } catch (e) {
        Swal.close();
        showToast('error', 'Gagal', e.message || 'Terjadi kesalahan saat membuat publikasi');
    }
}

function onToggleKecamatanSwitch() {
    const autoKecCb = document.getElementById('create-table-auto-kecamatan');
    const colEntityInput = document.getElementById('create-table-col-entity');
    const descEl = document.getElementById('create-table-auto-desc');
    if (!autoKecCb) return;

    if (autoKecCb.checked) {
        if (colEntityInput) colEntityInput.value = "Kecamatan";
        if (descEl) descEl.textContent = "Membuat 39 baris rincian standar wilayah Kabupaten Tasikmalaya (Cipatujah s/d Sukaresik & Total Kabupaten) secara otomatis.";
    } else {
        if (descEl) descEl.textContent = "Tabel akan dibuat dengan baris kosong bersih. Anda bebas mengubah nama Kolom Entitas di atas sesuai kebutuhan (misal: Bulan, Komoditas, Desa, dll).";
    }
}

async function openCreateTableModal(defaultDocId = null, defaultBabNum = null) {
    if (!checkRoleAccess('tabel')) return;

    // Reset form
    const form = document.getElementById('form-create-table');
    if (form) form.reset();

    const docSelect = document.getElementById('create-table-doc-id');
    const babSelect = document.getElementById('create-table-bab-num');
    const numInput = document.getElementById('create-table-number');
    const titleInput = document.getElementById('create-table-title');
    const colEntityInput = document.getElementById('create-table-col-entity');
    const colNameInput = document.getElementById('create-table-col-name');
    const colUnitInput = document.getElementById('create-table-col-unit');
    const colYearInput = document.getElementById('create-table-col-year');
    const autoKecCb = document.getElementById('create-table-auto-kecamatan');

    if (colEntityInput) colEntityInput.value = "Kecamatan";
    if (colNameInput) colNameInput.value = "Hasil Produksi";
    if (colUnitInput) colUnitInput.value = "Ton";
    if (autoKecCb) autoKecCb.checked = true;

    onToggleKecamatanSwitch();

    // Load available documents into dropdown
    if (docSelect) {
        docSelect.innerHTML = '<option value="">Memuat publikasi...</option>';
        try {
            const res = await fetch(`${API_BASE}/documents`);
            if (res.ok) {
                const docs = await res.json();
                let opts = '<option value="">-- Pilih Dokumen Publikasi --</option>';
                docs.forEach(d => {
                    let cleanName = (d.filename || '').replace(/\.(pdf|xlsx|csv)$/i, '').replace(/[-_]/g, ' ');
                    cleanName = cleanName.replace(/\b\w/g, l => l.toUpperCase());
                    const pubTitle = d.year ? `Publikasi ${d.year} — ${cleanName}` : cleanName;
                    const isSelected = (defaultDocId && d.id === defaultDocId) || (!defaultDocId && d.year === 2026);
                    opts += `<option value="${d.id}" data-year="${d.year || ''}" ${isSelected ? 'selected' : ''}>${escHtml(pubTitle)}</option>`;
                });
                docSelect.innerHTML = opts;
            }
        } catch (e) {
            console.error("Gagal memuat dokumen:", e);
            docSelect.innerHTML = '<option value="">Gagal memuat publikasi</option>';
        }
    }

    if (defaultBabNum && babSelect) {
        babSelect.value = String(defaultBabNum);
    }

    updateCreateTableBabOptions();
    updateCreateTableNumberPrefix();

    const modalEl = document.getElementById('modal-create-table');
    if (modalEl) {
        const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
        modal.show();
    }
}

function updateCreateTableBabOptions() {
    const docSelect = document.getElementById('create-table-doc-id');
    const colYearInput = document.getElementById('create-table-col-year');
    if (!docSelect) return;

    const opt = docSelect.options[docSelect.selectedIndex];
    if (opt && opt.dataset.year && colYearInput && !colYearInput.value) {
        colYearInput.value = opt.dataset.year;
    }
}

function updateCreateTableNumberPrefix() {
    const babSelect = document.getElementById('create-table-bab-num');
    const numInput = document.getElementById('create-table-number');
    if (!babSelect || !numInput) return;

    const bab = babSelect.value || '1';
    if (!numInput.value || numInput.value.startsWith('Tabel ')) {
        numInput.value = `Tabel ${bab}.1.1`;
    }
}

async function submitCreateTable() {
    const docSelect = document.getElementById('create-table-doc-id');
    const babSelect = document.getElementById('create-table-bab-num');
    const numInput = document.getElementById('create-table-number');
    const titleInput = document.getElementById('create-table-title');
    const colEntityInput = document.getElementById('create-table-col-entity');
    const colNameInput = document.getElementById('create-table-col-name');
    const colUnitInput = document.getElementById('create-table-col-unit');
    const colYearInput = document.getElementById('create-table-col-year');
    const autoKecCb = document.getElementById('create-table-auto-kecamatan');

    const docId = docSelect ? parseInt(docSelect.value) : null;
    const tableNumber = numInput ? numInput.value.trim() : '';
    const tableTitle = titleInput ? titleInput.value.trim() : '';
    const colEntity = colEntityInput ? colEntityInput.value.trim() : 'Kecamatan';
    const colName = colNameInput ? colNameInput.value.trim() : 'Nilai';
    const colUnit = colUnitInput ? colUnitInput.value.trim() : '';
    const colYear = colYearInput ? colYearInput.value.trim() : '';
    const autoFill = autoKecCb ? autoKecCb.checked : false;

    if (!docId) {
        showToast('warning', 'Peringatan', 'Silakan pilih publikasi induk!');
        if (docSelect) docSelect.focus();
        return;
    }
    if (!tableNumber || !tableTitle) {
        showToast('warning', 'Peringatan', 'Nomor dan judul tabel wajib diisi!');
        return;
    }

    const fullTableName = `${tableNumber} - ${tableTitle}`.trim();
    const headers = [colEntity || 'Kecamatan', colName || 'Nilai'];
    const units = ['satuan', colUnit || ''];
    const years = ['tahun', colYear || ''];

    Swal.fire({
        title: 'Menyimpan Tabel...',
        text: 'Membuat struktur tabel dan mendaftarkan ke basis data.',
        allowOutsideClick: false,
        didOpen: () => { Swal.showLoading(); }
    });

    try {
        const payload = {
            document_id: docId,
            table_name: fullTableName,
            headers: headers,
            units: units,
            years: years,
            auto_fill_kecamatan: autoFill
        };

        const res = await fetch(`${API_BASE}/tables`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.detail || 'Gagal membuat tabel baru');
        }

        const data = await res.json();
        const newTableId = data.table_id;

        // Hide modal
        const modalEl = document.getElementById('modal-create-table');
        if (modalEl) {
            const modal = bootstrap.Modal.getInstance(modalEl);
            if (modal) modal.hide();
        }

        Swal.close();

        Swal.fire({
            title: '🎉 Tabel Berhasil Dibuat!',
            html: `<div class="text-start small text-muted">
                <p class="mb-1"><b>Nama Tabel:</b> ${escHtml(fullTableName)}</p>
                <p class="mb-2"><b>Jumlah Baris:</b> ${data.row_count || 0} baris</p>
                <p class="text-dark mb-0">Apakah Anda ingin langsung membuka tabel ini di <b>Editor Spreadsheet</b> untuk mengisi data angka?</p>
            </div>`,
            icon: 'success',
            showCancelButton: true,
            confirmButtonColor: '#2563eb',
            cancelButtonColor: '#64748b',
            confirmButtonText: '📝 Buka di Editor Spreadsheet',
            cancelButtonText: 'Tetap di Data Tabel'
        }).then((result) => {
            // Refresh daftar publikasi / tabel
            if (typeof populateDocumentList === 'function') populateDocumentList();
            if (result.isConfirmed) {
                navigateToEditor(newTableId, fullTableName, 'db');
            }
        });

    } catch (e) {
        Swal.close();
        showToast('error', 'Gagal', e.message || 'Terjadi kesalahan saat membuat tabel');
    }
}

