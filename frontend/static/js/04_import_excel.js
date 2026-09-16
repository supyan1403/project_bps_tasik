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
                            <div class="pub-card-icon-box d-flex align-items-center justify-content-center rounded-2" style="width:32px; height:32px; font-size:1.1rem; background: var(--primary-faint, #eff6ff); color: var(--primary, #1e40af);">
                                <i class="bi bi-journal-bookmark-fill"></i>
                            </div>
                            <span class="fw-bold pub-card-title text-dark" style="font-size:0.95rem;">Publikasi Kabupaten Tasikmalaya Dalam Angka ${doc.year}</span>
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

        resultDiv.innerHTML = (data.message || 'Berhasil diimpor.') + ` &nbsp;<a href="javascript:void(0)" onclick="viewState.selectedDocId=${data.document_id}; viewState.selectedBabNum=null; navigateDataTabelTab('publikasi');" style="color:var(--info, #2563eb); font-weight:600; text-decoration:underline;">Buka publikasi →</a>`;

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
        notifyDataChange('document');

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



        // Buat editor HTML

        let descText = isPdf 

            ? "Edit atau tambahkan bab dan halaman jangkauannya secara manual. Klik Simpan jika sudah selesai."

            : "Edit atau sesuaikan nama bab untuk publikasi ini. Klik Simpan jika sudah selesai.";



        let editorHtml = `

            <div style="max-height: 400px; overflow-y: auto; text-align: left; padding: 0.5rem;" id="toc-editor-rows">

                <p style="font-size: 0.85rem; color: #64748b; margin-bottom: 1rem;">

                    ${descText}

                </p>

        `;



        function renderRow(title, start, end, index) {

            if (!isPdf) {

                // Tampilan simpel tanpa input nomor halaman untuk Excel

                return `

                    <div class="toc-row" data-index="${index}" style="display: flex; gap: 8px; align-items: center; margin-bottom: 8px;">

                        <input type="text" class="toc-title" value="${title}" placeholder="Judul Bab (e.g. Bab 1 - Geografi dan Iklim)" style="flex: 1; padding: 7px 10px; border: 1px solid var(--swal-cancel, #cbd5e1); border-radius: 6px; font-size: 0.88rem;">

                        <button onclick="this.parentElement.remove()" style="background: var(--danger-light, #fee2e2); color: var(--danger, #ef4444); border: 1px solid #fecaca; border-radius: 6px; padding: 6px 10px; cursor: pointer; font-size: 0.85rem; font-weight: bold;" title="Hapus Bab">✕</button>

                    </div>

                `;

            }

            return `

                <div class="toc-row" data-index="${index}" style="display: flex; gap: 8px; align-items: center; margin-bottom: 8px;">

                    <input type="text" class="toc-title" value="${title}" placeholder="Judul Bab (e.g. Bab 1 - Geografi)" style="flex: 2; padding: 6px; border: 1px solid var(--swal-cancel, #cbd5e1); border-radius: 4px; font-size: 0.85rem;">

                    <input type="number" class="toc-start" value="${start}" placeholder="Mulai" style="width: 70px; padding: 6px; border: 1px solid var(--swal-cancel, #cbd5e1); border-radius: 4px; font-size: 0.85rem;">

                    <input type="number" class="toc-end" value="${end}" placeholder="Akhir" style="width: 70px; padding: 6px; border: 1px solid var(--swal-cancel, #cbd5e1); border-radius: 4px; font-size: 0.85rem;">

                    <button onclick="this.parentElement.remove()" style="background: var(--danger, #ef4444); color: white; border: none; border-radius: 4px; padding: 6px 10px; cursor: pointer; font-size: 0.85rem;">✕</button>

                </div>

            `;

        }



        toc.forEach((item, idx) => {

            editorHtml += renderRow(item.title, item.start_page, item.end_page, idx);

        });



        editorHtml += `</div>

            <div style="text-align: left; margin-top: 10px; padding-left: 0.5rem;">

                <button id="add-toc-row-btn" class="btn btn-small" style="background-color: var(--success, #10b981); color: white; padding: 6px 12px; border-radius: 4px; border: none; cursor: pointer; font-size: 0.85rem;">+ Tambah Bab</button>

            </div>

        `;



        Swal.fire({

            title: `Edit Bab - ${filename}`,

            html: editorHtml,

            width: '580px',

            showCancelButton: true,

            confirmButtonText: 'Simpan',

            cancelButtonText: 'Batal',

            confirmButtonColor: cssVar('--swal-confirm-primary') || cssVar('--indigo-600') || '#4f46e5',

            didOpen: () => {

                const addBtn = document.getElementById('add-toc-row-btn');

                const container = document.getElementById('toc-editor-rows');

                addBtn.addEventListener('click', () => {

                    const tempDiv = document.createElement('div');

                    tempDiv.innerHTML = renderRow('', '', '', Date.now());

                    container.appendChild(tempDiv.firstElementChild);

                });

            },

            preConfirm: () => {

                const rows = document.querySelectorAll('#toc-editor-rows .toc-row');

                const updatedToc = [];

                let idx = 1;

                for (const row of rows) {

                    const title = row.querySelector('.toc-title').value.trim();

                    if (!title) {

                        Swal.showValidationMessage("Judul Bab tidak boleh kosong!");

                        return false;

                    }



                    let start = idx;

                    let end = idx;

                    const startEl = row.querySelector('.toc-start');

                    const endEl = row.querySelector('.toc-end');



                    if (isPdf && startEl && endEl) {

                        start = parseInt(startEl.value);

                        end = parseInt(endEl.value);

                        if (isNaN(start) || isNaN(end)) {

                            Swal.showValidationMessage("Halaman awal dan akhir harus berupa angka!");

                            return false;

                        }

                    }



                    updatedToc.push({

                        title: title,

                        start_page: start,

                        end_page: end

                    });

                    idx++;

                }

                return updatedToc;

            }

        }).then(async (result) => {

            if (result.isConfirmed) {

                Swal.fire({

                    title: 'Menyimpan...',

                    allowOutsideClick: false,

                    didOpen: () => { Swal.showLoading(); }

                });



                const saveRes = await fetch(`${API_BASE}/documents/${docId}/toc`, {

                    method: "POST",

                    headers: { "Content-Type": "application/json" },

                    body: JSON.stringify(result.value)

                });



                Swal.close();

                if (saveRes.ok) {

                    showToast('success', 'Tersimpan!', 'Daftar bab berhasil diperbarui secara manual.');

                    populateBabDropdown(docId);

                    populateDocumentList();
                    notifyDataChange('document');

                } else {

                    const errData = await saveRes.json();

                    showToast('error', 'Gagal!', `Gagal menyimpan: ${errData.detail || 'Terjadi kesalahan'}`);

                }

            }

        });



    } catch (err) {

        Swal.close();

        showToast("error", "Error", `Gagal memuat editor bab: ${err.message}`);

    }

}





async function extractPages(docId) {

    const startInput = document.getElementById(`start-${docId}`).value;

    const endInput = document.getElementById(`end-${docId}`).value;

    

    if(!startInput || !endInput) {

        showToast("warning", "Peringatan", "Masukkan halaman awal dan halaman akhir!");

        return;

    }

    

    Swal.fire({

        title: 'Memulai Ekstraksi',

        text: 'Menyiapkan proses di latar belakang...',

        allowOutsideClick: false,

        didOpen: () => {

            Swal.showLoading();

        }

    });

    try {

        const res = await fetch(`${API_BASE}/documents/${docId}/extract`, {

            method: "POST",

            headers: { "Content-Type": "application/json" },

            body: JSON.stringify({

                start_page: parseInt(startInput),

                end_page: parseInt(endInput)

            })

        });

        

        Swal.close();

        if(res.ok) {

            showToast("info", "Informasi", "Mengekstrak halaman di background...", 2000);

            await loadDocuments();
            notifyDataChange('document');

        } else {

            showToast("error", "Gagal", "Gagal memulai ekstraksi");

        }

    } catch(err) {

        Swal.close();

        showToast("error", "Error", err.message);

    }

}



function deleteBab(docId, babNum, babName) {

    Swal.fire({

        title: 'Hapus Bab?',

        text: `Anda yakin ingin menghapus semua tabel di ${babName} secara permanen?`,

        icon: 'warning',

        showCancelButton: true,

        confirmButtonColor: cssVar('--danger') || cssVar('--danger') || '#ef4444',

        cancelButtonColor: cssVar('--swal-cancel') || cssVar('--text-muted') || '#cbd5e1',

        confirmButtonText: 'Ya, Hapus',

        cancelButtonText: 'Batal',

        showLoaderOnConfirm: true,

        preConfirm: async () => {

            try {

                const res = await fetch(`${API_BASE}/documents/${docId}/bab/${babNum}`, { method: "DELETE" });

                if (!res.ok) throw new Error("Gagal menghapus");

                await loadDocuments();

                await populateDocumentList();
                notifyDataChange('document');

                return await res.json();

            } catch (error) {

                Swal.showValidationMessage(`Request failed: ${error}`);

            }

        },

        allowOutsideClick: () => !Swal.isLoading()

    }).then((result) => {

        if (result.isConfirmed) {

            Swal.fire('Berhasil!', result.value.message || 'Bab berhasil dihapus.', 'success');

        }

    });

}



function deleteDocument(docId) {

    Swal.fire({

        title: 'Hapus Publikasi?',

        text: "PERMANEN! Semua tabel + folder hasil ekstraksinya (CSV) akan ikut terhapus dan TIDAK BISA dikembalikan. Disarankan backup DB dulu.",

        icon: 'warning',

        showCancelButton: true,

        confirmButtonColor: cssVar('--danger') || cssVar('--danger') || '#ef4444',

        cancelButtonColor: cssVar('--swal-cancel') || cssVar('--text-muted') || '#cbd5e1',

        confirmButtonText: 'Ya, Hapus',

        cancelButtonText: 'Batal',

        showLoaderOnConfirm: true,

        preConfirm: async () => {

            try {

                const res = await fetch(`${API_BASE}/documents/${docId}`, { method: "DELETE" });

                if (!res.ok) throw new Error("Gagal menghapus");

                await loadDocuments();

                await populateDocumentList();
                notifyDataChange('document');

            } catch (error) {

                Swal.showValidationMessage(`Request failed: ${error}`);

            }

        },

        allowOutsideClick: () => !Swal.isLoading()

    }).then((result) => {

        if (result.isConfirmed) {
            Swal.fire('Terhapus!', 'Publikasi berhasil dihapus.', 'success');
        }
    });
}

function _escJs(str) {
    if (!str) return '';
    return String(str).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

async function openEditDocModal(docId, currentYear, currentDataYear, currentFilename) {
    const defaultDataYear = currentDataYear !== null && currentDataYear !== undefined 
        ? currentDataYear 
        : (currentYear ? currentYear - 1 : '');

    const { value: formValues } = await Swal.fire({
        title: 'Edit Publikasi',
        html: `
            <div class="row g-2 mb-3 text-start">
                <div class="col-6">
                    <label class="form-label fw-semibold" style="font-size:0.85rem;">Tahun Publikasi</label>
                    <input id="swal-edit-doc-year" type="number" class="form-control" value="${currentYear || ''}" placeholder="Contoh: 2026">
                </div>
                <div class="col-6">
                    <label class="form-label fw-semibold" style="font-size:0.85rem;">Tahun Data</label>
                    <input id="swal-edit-doc-datayear" type="number" class="form-control" value="${defaultDataYear}" placeholder="Contoh: 2025">
                </div>
                <div class="col-12 mt-1">
                    <small class="text-muted" style="font-size:0.75rem; line-height:1.2; display:block;">
                        *Tahun data otomatis dihitung (Tahun Publikasi - 1), atau ubah manual jika ada pengecualian.
                    </small>
                </div>
            </div>
            <div class="text-start">
                <label class="form-label fw-semibold" style="font-size:0.85rem;">Nama File / Judul Dokumen</label>
                <input id="swal-edit-doc-name" type="text" class="form-control" value="${(currentFilename || '').replace(/"/g, '&quot;')}" placeholder="Contoh: Kabupaten Tasikmalaya Dalam Angka 2026.pdf">
            </div>
        `,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: 'Simpan',
        cancelButtonText: 'Batal',
        confirmButtonColor: cssVar('--primary') || '#2563eb',
        didOpen: () => {
            const pubYearInp = document.getElementById('swal-edit-doc-year');
            const dataYearInp = document.getElementById('swal-edit-doc-datayear');
            let userCustomizedDataYear = false;

            dataYearInp.addEventListener('input', () => {
                userCustomizedDataYear = true;
            });

            pubYearInp.addEventListener('input', () => {
                if (!userCustomizedDataYear) {
                    const py = parseInt(pubYearInp.value, 10);
                    if (!isNaN(py) && py > 1900) {
                        dataYearInp.value = py - 1;
                    }
                }
            });
        },
        preConfirm: () => {
            const yearVal = document.getElementById('swal-edit-doc-year').value;
            const dataYearVal = document.getElementById('swal-edit-doc-datayear').value;
            const nameVal = document.getElementById('swal-edit-doc-name').value;
            if (!nameVal.trim()) {
                Swal.showValidationMessage('Nama file / judul publikasi tidak boleh kosong');
                return false;
            }
            return {
                year: yearVal ? parseInt(yearVal, 10) : null,
                data_year: dataYearVal ? parseInt(dataYearVal, 10) : (yearVal ? parseInt(yearVal, 10) - 1 : null),
                filename: nameVal.trim()
            };
        }
    });

    if (formValues) {
        try {
            const res = await fetch(`${API_BASE}/documents/${docId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formValues)
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.detail || "Gagal memperbarui publikasi");

            showToast("success", "Berhasil", data.message || "Publikasi berhasil diperbarui");
            await loadDocuments();
            await populateDocumentList();
            notifyDataChange('document');
        } catch (err) {
            Swal.fire('Gagal', err.message, 'error');
        }
    }
}

async function editBabTitle(docId, babNum, currentTitle) {
    let cleanCurrentTitle = (currentTitle || '').replace(/^Bab\s+\d+\s*[\-\–\—\.\:]\s*/i, '').trim();
    if (!cleanCurrentTitle || cleanCurrentTitle.toLowerCase() === `bab ${babNum}`) {
        cleanCurrentTitle = getBpsStandardTitle(babNum) || '';
    }

    const { value: newTitle } = await Swal.fire({
        title: `Edit Judul Bab ${babNum}`,
        html: `
            <div class="text-start mb-2 px-1">
                <label class="form-label small fw-semibold text-dark mb-1">Nama / Topik Bab <span class="text-danger">*</span></label>
                <input id="swal-edit-bab-title" type="text" class="form-control" value="${escHtml(cleanCurrentTitle)}" placeholder="Contoh: Sosial dan Kependudukan">
                <div class="form-text text-muted mt-1" style="font-size:0.75rem;">Ubah nama topik data untuk Bab ${babNum}.</div>
            </div>
        `,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: 'Simpan',
        cancelButtonText: 'Batal',
        confirmButtonColor: cssVar('--primary') || '#2563eb',
        preConfirm: () => {
            const val = document.getElementById('swal-edit-bab-title')?.value;
            if (!val || !val.trim()) {
                Swal.showValidationMessage('Judul / nama bab tidak boleh kosong!');
                return false;
            }
            return val.trim();
        }
    });

    if (newTitle !== undefined && newTitle.trim() !== '') {
        try {
            const res = await fetch(`${API_BASE}/documents/${docId}/bab/${babNum}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ title: newTitle.trim() })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.detail || "Gagal memperbarui bab");

            showToast("success", "Berhasil", data.message || `Judul Bab ${babNum} berhasil diperbarui`);
            await populateDocumentList();
            notifyDataChange('document');
        } catch (err) {
            Swal.fire('Gagal', err.message, 'error');
        }
    }
}

async function openCreateBabModal(docId = null) {
    if (!checkRoleAccess('tabel')) return;

    const targetDocId = docId || viewState.selectedDocId;
    if (!targetDocId) {
        showToast('warning', 'Peringatan', 'Silakan pilih publikasi terlebih dahulu sebelum menambah bab!');
        return null;
    }

    const { value: formValues } = await Swal.fire({
        title: 'Tambah Bab Baru',
        html: `
            <div class="text-start mb-3">
                <label class="form-label small fw-semibold text-dark mb-1">Nomor Bab <span class="text-danger">*</span></label>
                <input id="swal-bab-num" type="number" min="1" max="99" class="form-control" placeholder="Contoh: 14">
                <div class="form-text text-muted" style="font-size:0.75rem;">Masukkan angka urutan bab (misal: 14).</div>
            </div>
            <div class="text-start mb-2">
                <label class="form-label small fw-semibold text-dark mb-1">Judul / Nama Bab <span class="text-danger">*</span></label>
                <input id="swal-bab-title" type="text" class="form-control" placeholder="Contoh: Indikator SDGs & Pembangunan Berkelanjutan">
                <div class="form-text text-muted" style="font-size:0.75rem;">Topik pembahasan data pada bab ini.</div>
            </div>
        `,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: 'Simpan Bab',
        cancelButtonText: 'Batal',
        confirmButtonColor: cssVar('--primary') || '#2563eb',
        preConfirm: () => {
            const num = document.getElementById('swal-bab-num')?.value;
            const title = document.getElementById('swal-bab-title')?.value;
            if (!num || isNaN(parseInt(num)) || parseInt(num) <= 0) {
                Swal.showValidationMessage('Nomor bab harus berupa angka bulat positif!');
                return false;
            }
            if (!title || !title.trim()) {
                Swal.showValidationMessage('Judul / nama bab tidak boleh kosong!');
                return false;
            }
            return {
                bab_num: parseInt(num),
                title: title.trim()
            };
        }
    });

    if (formValues) {
        try {
            Swal.fire({
                title: 'Menyimpan Bab...',
                allowOutsideClick: false,
                didOpen: () => { Swal.showLoading(); }
            });

            const res = await fetch(`${API_BASE}/documents/${targetDocId}/bab`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formValues)
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.detail || 'Gagal menambahkan bab');

            Swal.close();
            showToast('success', 'Berhasil', data.message || `Bab ${formValues.bab_num} berhasil ditambahkan.`);

            await populateDocumentList();
            notifyDataChange('document');
            return formValues.bab_num;
        } catch (err) {
            Swal.fire('Gagal', err.message, 'error');
            return null;
        }
    }
    return null;
}

async function openCreateBabModalFromTable() {
    const docSelect = document.getElementById('create-table-doc-id');
    const docId = docSelect ? parseInt(docSelect.value) : null;
    if (!docId) {
        showToast('warning', 'Peringatan', 'Silakan pilih publikasi induk terlebih dahulu!');
        if (docSelect) docSelect.focus();
        return;
    }

    const createdBabNum = await openCreateBabModal(docId);
    if (createdBabNum) {
        await updateCreateTableBabOptions(createdBabNum);
    }
}

function renderDocLevelSkeleton(title = "") {
    const container = document.getElementById("document-list-container");
    if (!container) return;
    container.innerHTML = `
        <div class="doc-breadcrumb d-flex align-items-center justify-content-between flex-wrap gap-2 mb-4 p-3 rounded-3" style="background:var(--bg-card); border:1px solid var(--border);">
            <div class="d-flex align-items-center gap-2" style="font-size:0.95rem; font-weight:600;">
                <span class="text-primary" style="cursor:pointer;" onclick="viewState.selectedDocId=null; viewState.selectedBabNum=null; populateDocumentList();">
                    <i class="bi bi-folder2 me-1"></i> Semua Dokumen
                </span>
                <span class="text-muted">/</span>
                <span class="text-secondary">${title || 'Memuat...'}</span>
            </div>
        </div>
        <div class="top-progress-bar"></div>
        <div class="skeleton-grid">
            ${Array(6).fill(0).map(() => `
                <div class="skeleton-card">
                    <div class="skeleton-box" style="width: 70px; height: 24px; border-radius: 20px;"></div>
                    <div class="skeleton-box" style="width: 80%; height: 20px; border-radius: 6px;"></div>
                    <div class="skeleton-box" style="width: 40%; height: 16px; border-radius: 6px;"></div>
                    <div class="skeleton-box" style="width: 60%; height: 30px; border-radius: 20px; margin-top: 6px;"></div>
                </div>
            `).join('')}
        </div>
    `;
}

// State untuk navigasi drill-down (Folder Explorer)
let viewState = {
    selectedDocId: null,
    selectedBabNum: null
};

// Page 3: Tabel Data (CRUD)
async function populateDocumentList() {
    let docs = window.__cachedDocsList;
    const container = document.getElementById("document-list-container");
    if (!container) return;

    if (!docs) {
        try {
            const cachedDocsStr = localStorage.getItem('sipedas_docs_cache');
            if (cachedDocsStr) {
                docs = JSON.parse(cachedDocsStr);
                window.__cachedDocsList = docs;
            }
        } catch (e) {}
    }

    const fetchWithTimeout = (url, timeoutMs = 8000) => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        return fetch(url, { signal: controller.signal })
            .then(r => { clearTimeout(timer); return r.ok ? r.json() : []; })
            .catch(err => {
                clearTimeout(timer);
                throw err;
            });
    };

    let docChapters = {};
    let preloadedTables = null;
    let results;

    try {
        const fetchPromises = [
            fetchWithTimeout(`${API_BASE}/documents`)
        ];
        if (viewState.selectedDocId) {
            fetchPromises.push(fetchWithTimeout(`${API_BASE}/documents/${viewState.selectedDocId}/toc`));
            fetchPromises.push(fetchWithTimeout(`${API_BASE}/documents/${viewState.selectedDocId}/tables`));
        }
        results = await Promise.all(fetchPromises);
    } catch (netErr) {
        console.warn("[populateDocumentList] Jaringan lambat/terputus:", netErr);
        container.innerHTML = `
            <div class="text-center py-5">
                <div class="mb-3 text-warning">
                    <i class="bi bi-wifi-off" style="font-size: 3rem;"></i>
                </div>
                <h5 class="fw-bold mb-2">Koneksi Lambat atau Terputus</h5>
                <p class="text-muted mb-4" style="max-width: 480px; margin: 0 auto; font-size: 0.9rem;">
                    Gagal memuat data karena batas waktu tunggu (8 detik) habis. Pastikan koneksi internet Anda aktif.
                </p>
                <div class="d-flex justify-content-center gap-2">
                    <button class="btn btn-primary rounded-pill px-4" onclick="populateDocumentList()">
                        <i class="bi bi-arrow-clockwise me-1"></i> Coba Lagi
                    </button>
                    <button class="btn btn-outline-secondary rounded-pill px-4" onclick="viewState.selectedDocId=null; viewState.selectedBabNum=null; populateDocumentList();">
                        <i class="bi bi-arrow-left me-1"></i> Kembali ke Dokumen
                    </button>
                </div>
            </div>
        `;
        return;
    }

    const freshDocs = results[0];
    if (freshDocs && freshDocs.length > 0) {
        docs = freshDocs;
        window.__cachedDocsList = docs;
        try { localStorage.setItem('sipedas_docs_cache', JSON.stringify(docs)); } catch (e) {}
    }

    if (viewState.selectedDocId) {
        const tocData = results[1] || [];
        preloadedTables = results[2] || [];
        tocData.forEach(item => {

                    // Cari pola "Bab" diikuti angka biasa atau romawi

                    const match = item.title.match(/Bab\s+(\d+|[IVXLCDM]+)(?:\s*[\-\–\—\.\:]\s*(.*))?/i);

                    if (match) {

                        const rawNum = match[1];

                        let num = parseInt(rawNum, 10);

                        if (isNaN(num)) {

                            num = romanToInt(rawNum) || rawNum;

                        }

                        let name = match[2] ? match[2].trim() : "";

                        

                        // Jika match[2] kosong tetapi ada tanda "-" di string asli, coba pecah manual

                        if (!name && item.title.includes("-")) {

                            const parts = item.title.split("-");

                            if (parts.length > 1) {

                                name = parts.slice(1).join("-").trim();

                            }

                        }

                        

                        docChapters[num] = name;
                    }
                });
            }



    const STANDARD_BPS_CHAPTERS = {

        1: "Geografi dan Iklim",

        2: "Pemerintahan",

        3: "Penduduk dan Ketenagakerjaan",

        4: "Sosial dan Kesejahteraan Rakyat",

        5: "Pertanian, Kehutanan, dan Perikanan",

        6: "Industri, Pertambangan, Energi, dan Air",

        7: "Pariwisata",

        8: "Transportasi dan Komunikasi",

        9: "Koperasi dan Usaha Mikro Kecil Menengah (UMKM)",

        10: "Pengeluaran dan Konsumsi Penduduk",

        11: "Perdagangan",

        12: "Pendapatan Regional",

        13: "Perbandingan Regional / Antar Wilayah"

    };



    const getChapterTitle = (num) => {
        if (docChapters && docChapters[num]) return docChapters[num];
        if (STANDARD_BPS_CHAPTERS[num]) return STANDARD_BPS_CHAPTERS[num];
        return "";
    };

    window.__documentsList = docs;
    window.__getChapterTitle = getChapterTitle;
    if (typeof updateSearchScopeIndicator === 'function') {
        updateSearchScopeIndicator();
    }



    container.innerHTML = "";

