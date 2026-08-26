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
                        <input type="text" class="toc-title" value="${title}" placeholder="Judul Bab (e.g. Bab 1 - Geografi dan Iklim)" style="flex: 1; padding: 7px 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 0.88rem;">
                        <button onclick="this.parentElement.remove()" style="background: #fee2e2; color: #ef4444; border: 1px solid #fecaca; border-radius: 6px; padding: 6px 10px; cursor: pointer; font-size: 0.85rem; font-weight: bold;" title="Hapus Bab">✕</button>
                    </div>
                `;
            }
            return `
                <div class="toc-row" data-index="${index}" style="display: flex; gap: 8px; align-items: center; margin-bottom: 8px;">
                    <input type="text" class="toc-title" value="${title}" placeholder="Judul Bab (e.g. Bab 1 - Geografi)" style="flex: 2; padding: 6px; border: 1px solid #cbd5e1; border-radius: 4px; font-size: 0.85rem;">
                    <input type="number" class="toc-start" value="${start}" placeholder="Mulai" style="width: 70px; padding: 6px; border: 1px solid #cbd5e1; border-radius: 4px; font-size: 0.85rem;">
                    <input type="number" class="toc-end" value="${end}" placeholder="Akhir" style="width: 70px; padding: 6px; border: 1px solid #cbd5e1; border-radius: 4px; font-size: 0.85rem;">
                    <button onclick="this.parentElement.remove()" style="background: #ef4444; color: white; border: none; border-radius: 4px; padding: 6px 10px; cursor: pointer; font-size: 0.85rem;">✕</button>
                </div>
            `;
        }

        toc.forEach((item, idx) => {
            editorHtml += renderRow(item.title, item.start_page, item.end_page, idx);
        });

        editorHtml += `</div>
            <div style="text-align: left; margin-top: 10px; padding-left: 0.5rem;">
                <button id="add-toc-row-btn" class="btn btn-small" style="background-color: #10b981; color: white; padding: 6px 12px; border-radius: 4px; border: none; cursor: pointer; font-size: 0.85rem;">+ Tambah Bab</button>
            </div>
        `;

        Swal.fire({
            title: `Edit Bab - ${filename}`,
            html: editorHtml,
            width: '580px',
            showCancelButton: true,
            confirmButtonText: 'Simpan',
            cancelButtonText: 'Batal',
            confirmButtonColor: '#4F46E5',
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
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#cbd5e1',
        confirmButtonText: 'Ya, Hapus',
        cancelButtonText: 'Batal',
        showLoaderOnConfirm: true,
        preConfirm: async () => {
            try {
                const res = await fetch(`${API_BASE}/documents/${docId}/bab/${babNum}`, { method: "DELETE" });
                if (!res.ok) throw new Error("Gagal menghapus");
                await loadDocuments();
                await populateDocumentList();
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
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#cbd5e1',
        confirmButtonText: 'Ya, Hapus',
        cancelButtonText: 'Batal',
        showLoaderOnConfirm: true,
        preConfirm: async () => {
            try {
                const res = await fetch(`${API_BASE}/documents/${docId}`, { method: "DELETE" });
                if (!res.ok) throw new Error("Gagal menghapus");
                await loadDocuments();
                await populateDocumentList();
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

// State untuk navigasi drill-down (Folder Explorer)
let viewState = {
    selectedDocId: null,
    selectedBabNum: null
};

// Page 3: Tabel Data (CRUD)
async function populateDocumentList() {
    const res = await fetch(`${API_BASE}/documents`);
    const docs = await res.json();
    const container = document.getElementById("document-list-container");
    container.innerHTML = "";
    
    let docChapters = {};
    if (viewState.selectedDocId) {
        try {
            const tocRes = await fetch(`${API_BASE}/documents/${viewState.selectedDocId}/toc`);
            if (tocRes.ok) {
                const tocData = await tocRes.json();
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
        } catch (err) {
            console.error("Gagal memuat TOC dinamis:", err);
        }
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

    // Breadcrumb (Jalur Navigasi)
    const breadcrumb = document.createElement("div");
    breadcrumb.className = "doc-breadcrumb";
    breadcrumb.style.marginBottom = "1.5rem";
    breadcrumb.style.fontSize = "0.95rem";
    breadcrumb.style.padding = "0.75rem 1.25rem";
    breadcrumb.style.borderRadius = "8px";
    breadcrumb.style.display = "flex";
    breadcrumb.style.justifyContent = "space-between";
    breadcrumb.style.alignItems = "center";
    breadcrumb.style.gap = "8px";
    
    const bcLeft = document.createElement("div");
    bcLeft.style.display = "flex";
    bcLeft.style.alignItems = "center";
    bcLeft.style.gap = "8px";
    bcLeft.style.flexWrap = "wrap";
    
    let bcHTML = `<span class="doc-bc-link" style="cursor:pointer; color:#2563eb; font-weight:600; padding:4px 8px; border-radius:6px;" onclick="viewState.selectedDocId=null; viewState.selectedBabNum=null; populateDocumentList();">🏠 Semua Dokumen</span>`;
    
    const doc = docs.find(d => d.id === viewState.selectedDocId);
    if (viewState.selectedDocId && doc) {
        const pubLabel = doc.year ? `Publikasi ${doc.year}` : doc.filename;
        bcHTML += `<span style="color:#94a3b8;">/</span><span class="doc-bc-link" style="cursor:pointer; color:#2563eb; font-weight:600; padding:4px 8px; border-radius:6px;" onclick="viewState.selectedBabNum=null; populateDocumentList();">📁 ${pubLabel}</span>`;
        if (viewState.selectedBabNum !== null) {
            const chapterTitle = getChapterTitle(viewState.selectedBabNum);
            const chapterSuffix = chapterTitle ? ` - ${chapterTitle}` : "";
            bcHTML += `<span style="color:#94a3b8;">/</span><span class="doc-bc-active" style="font-weight:600; padding:4px 8px;">📂 Bab ${viewState.selectedBabNum}${chapterSuffix}</span>`;
        }
    }
    bcLeft.innerHTML = bcHTML;
    breadcrumb.appendChild(bcLeft);

    container.appendChild(breadcrumb);
    
    // Panel Aksi di bawah Breadcrumb
    if (viewState.selectedDocId && doc) {
        const actionPanel = document.createElement("div");
        actionPanel.style.marginBottom = "1.5rem";
        actionPanel.style.display = "flex";
        actionPanel.style.gap = "0.75rem";
        actionPanel.style.flexWrap = "wrap";
        
        if (viewState.selectedBabNum === null) {
            actionPanel.innerHTML = `
                <button onclick="openCreateTableModal(${doc.id})" class="btn btn-sm btn-success fw-semibold px-3 py-1.5 rounded-3 d-inline-flex align-items-center gap-1.5 shadow-sm">
                    <i class="bi bi-plus-circle-fill"></i> Tambah Tabel Baru
                </button>
                <button onclick="deleteAllTablesForDoc(${doc.id}, '${doc.filename.replace(/'/g, "\\'")}')" class="btn btn-sm btn-outline-danger fw-semibold px-3 py-1.5 rounded-3">
                    <i class="bi bi-trash"></i> Hapus Semua Hasil
                </button>
            `;
        } else {
            actionPanel.innerHTML = `
                <button onclick="openCreateTableModal(${doc.id}, ${viewState.selectedBabNum})" class="btn btn-sm btn-success fw-semibold px-3 py-1.5 rounded-3 d-inline-flex align-items-center gap-1.5 shadow-sm">
                    <i class="bi bi-plus-circle-fill"></i> Tambah Tabel Baru di Bab Ini
                </button>
                <button onclick="deleteAllTablesForBab(${doc.id}, ${viewState.selectedBabNum})" class="btn btn-sm btn-outline-danger fw-semibold px-3 py-1.5 rounded-3">
                    <i class="bi bi-trash"></i> Hapus Semua Tabel Bab
                </button>
            `;
        }
        container.appendChild(actionPanel);
    }
    
    if (!viewState.selectedDocId) {
        // LEVEL 1: Tampilkan Grid Dokumen
        const grid = document.createElement("div");
        grid.style.display = "grid";
        grid.style.gridTemplateColumns = "repeat(auto-fill, minmax(320px, 1fr))";
        grid.style.gap = "1.5rem";
        
        for (const d of docs) {
            if(d.status === 'ready' || d.status.startsWith('extracting') || d.status.startsWith('done')) {
                const card = document.createElement("div");
                card.className = "doc-folder-card";
                card.style.borderRadius = "16px";
                card.style.padding = "2rem 1.5rem";
                card.style.cursor = "pointer";
                card.style.position = "relative";
                card.style.display = "flex";
                card.style.flexDirection = "column";
                card.style.justifyContent = "space-between";
                card.style.alignItems = "center";
                card.style.minHeight = "230px";
                card.onclick = () => { viewState.selectedDocId = d.id; populateDocumentList(); };
                
                let loadingBadge = '';
                if (d.status.startsWith('extracting')) {
                    loadingBadge = `
                        <div style="position:absolute; top:15px; right:15px; display:flex; align-items:center; gap:6px; background:#fffbeb; color:#b45309; padding:4px 10px; border-radius:20px; font-size:0.8rem; font-weight:700; border:1px solid #fcd34d; box-shadow:0 2px 4px rgba(0,0,0,0.05);">
                            <div style="width:12px; height:12px; border:2px solid #fcd34d; border-top-color:#b45309; border-radius:50%; animation:spin 1s linear infinite;"></div>
                            <style>@keyframes spin { 100% { transform: rotate(360deg); } }</style>
                            Mengekstrak...
                        </div>`;
                }
                
                const pubTitle = d.year ? `Publikasi ${d.year}` : d.filename;
                const tableBadge = d.table_count !== undefined 
                    ? `<span style="color:#2563eb; font-weight:600; font-size:0.78rem; background:#eff6ff; border:1px solid #bfdbfe; padding:3px 8px; border-radius:20px; white-space:nowrap;">${d.table_count} Tabel</span>` 
                    : '';

                card.innerHTML = `
                    ${loadingBadge}
                    <div style="text-align:center; width:100%;">
                        <div style="font-size:3.5rem; margin-bottom:1rem; text-shadow: 0 2px 4px rgba(0,0,0,0.1);">📁</div>
                        <h3 class="doc-card-title" style="margin:0 0 0.6rem 0; font-size:1.25rem; font-weight:700; word-break:break-word; line-height:1.4;">${pubTitle}</h3>
                    </div>
                    <div style="display:flex; justify-content:center; align-items:center; gap:5px; flex-wrap:nowrap; margin-top:12px; width:100%;">
                        <span class="doc-card-badge" style="font-size:0.78rem; padding:3px 8px; border-radius:20px; font-weight:600; background:#e0e7ff; color:#3730a3; white-space:nowrap;">Publikasi ${d.year || '-'}</span>
                        <span class="doc-card-badge" style="font-size:0.78rem; padding:3px 8px; border-radius:20px; font-weight:600; background:#f1f5f9; color:#334155; white-space:nowrap;">Data ${d.year ? d.year - 1 : '-'}</span>
                        ${tableBadge}
                    </div>
                `;
                grid.appendChild(card);
            }
        }
        if (grid.children.length === 0) {
            grid.innerHTML = `<p style="color:#64748b; font-style:italic;">Belum ada dokumen yang siap dilihat.</p>`;
        }
        container.appendChild(grid);
    } 
    else {
        const d = docs.find(doc => doc.id === viewState.selectedDocId);
        if (!d) {
            viewState.selectedDocId = null;
            return populateDocumentList();
        }
        
        const loadingDiv = document.createElement("div");
        loadingDiv.id = "tables-loading-spinner";
        loadingDiv.style.textAlign = "center";
        loadingDiv.style.padding = "4rem 2rem";
        loadingDiv.innerHTML = `
            <div class="spinner-border text-primary" role="status" style="width:2.5rem; height:2.5rem; border-width: 0.22em;">
                <span class="visually-hidden">Loading...</span>
            </div>
            <div class="text-muted small mt-3" style="font-weight:500; letter-spacing: 0.5px;">Memuat daftar tabel...</div>
        `;
        container.appendChild(loadingDiv);

        const tRes = await fetch(`${API_BASE}/documents/${d.id}/tables`);
        const tables = await tRes.json();
        
        loadingDiv.remove();
        
        if (d.status.startsWith('extracting')) {
            const loadingBanner = document.createElement("div");
            loadingBanner.style.background = "#fffbeb";
            loadingBanner.style.border = "1px solid #fcd34d";
            loadingBanner.style.color = "#b45309";
            loadingBanner.style.padding = "0.75rem 1rem";
            loadingBanner.style.borderRadius = "8px";
            loadingBanner.style.marginBottom = "1.5rem";
            loadingBanner.style.display = "flex";
            loadingBanner.style.alignItems = "center";
            loadingBanner.style.gap = "10px";
            loadingBanner.innerHTML = `
                <div style="width:16px; height:16px; border:2px solid #fcd34d; border-top-color:#b45309; border-radius:50%; animation:spin 1s linear infinite;"></div>
                <style>@keyframes spin { 100% { transform: rotate(360deg); } }</style>
                <span style="font-size:0.95rem; font-weight:500;">Sistem sedang mengekstrak halaman PDF di latar belakang. Anda tetap dapat membuka dan melihat tabel yang sudah ada!</span>
            `;
            container.appendChild(loadingBanner);
        }
        
        if (tables.length === 0) {
            let msg = d.status.startsWith('extracting') ? "Mohon tunggu sebentar, tabel pertama sedang diekstrak..." : "Belum ada tabel yang berhasil diekstrak.";
            const emptyDiv = document.createElement("div");
            emptyDiv.style.textAlign = "center";
            emptyDiv.style.padding = "3rem";
            emptyDiv.className = "doc-empty-state";
            emptyDiv.style.borderRadius = "12px";
            emptyDiv.innerHTML = `<p style="font-style:italic; font-size:1.1rem; margin:0;">${msg}</p>`;
            container.appendChild(emptyDiv);
            return;
        }
        
        // Group tables by Bab
        const grouped = {};
        tables.forEach(t => {
            const match = t.table_name.match(/Tabel[\s_]*(\d+)/i);
            let babName = "Lainnya";
            let babNum = 999;
            if (match && match[1]) {
                babNum = parseInt(match[1], 10);
                const chapterTitle = getChapterTitle(babNum);
                const chapterSuffix = chapterTitle ? ` - ${chapterTitle}` : "";
                babName = `Bab ${babNum}${chapterSuffix}`;
            }
            if (!grouped[babNum]) grouped[babNum] = { name: babName, num: babNum, tables: [] };
            grouped[babNum].tables.push(t);
        });
        
        if (viewState.selectedBabNum === null) {
            // LEVEL 2: Tampilkan Grid Bab
            const grid = document.createElement("div");
            grid.style.display = "grid";
            grid.style.gridTemplateColumns = "repeat(auto-fill, minmax(280px, 1fr))";
            grid.style.gap = "1.5rem";
            
            const sortedBabs = Object.values(grouped).sort((a, b) => a.num - b.num);
            sortedBabs.forEach(bab => {
                const card = document.createElement("div");
                card.className = "doc-chapter-card";
                card.style.borderRadius = "16px";
                card.style.padding = "1.75rem 1.5rem";
                card.style.cursor = "pointer";
                
                card.onclick = (e) => {
                    if(e.target.tagName.toLowerCase() === 'button') return;
                    viewState.selectedBabNum = bab.num;
                    populateDocumentList();
                };
                
                let cardHTML = `
                    <div style="font-size:3rem; margin-bottom:1rem; text-align:center; text-shadow: 0 2px 4px rgba(0,0,0,0.05);">📂</div>
                    <h4 class="doc-card-title" style="margin:0 0 0.75rem 0; font-size:1.15rem; font-weight:700; text-align:center; line-height:1.4;">${bab.name}</h4>
                    <p class="doc-card-subtitle" style="margin:0 0 1.25rem 0; text-align:center; font-size:0.9rem; font-weight:500;">${bab.tables.length} Tabel</p>
                `;
                
                const deleteBtn = `<div style="text-align:center;"><button style="background:transparent; border:1px solid #ef4444; color:#ef4444; padding:6px 16px; font-size:0.8rem; border-radius:20px; font-weight:600; cursor:pointer; transition:all 0.2s;" onclick="deleteBab(${d.id}, ${bab.num}, '${bab.name}')" onmouseenter="this.style.background='#ef4444'; this.style.color='white'" onmouseleave="this.style.background='transparent'; this.style.color='#ef4444'">Hapus Bab</button></div>`;
                
                card.innerHTML = cardHTML + deleteBtn;
                grid.appendChild(card);
            });
            container.appendChild(grid);
            
        } else {
            // LEVEL 3: Tampilkan Daftar Tabel
            const bab = grouped[viewState.selectedBabNum];
            if (!bab) {
                viewState.selectedBabNum = null;
                return populateDocumentList();
            }
            
            const tableListWrapper = document.createElement("div");
            tableListWrapper.className = "doc-table-list-wrapper";
            tableListWrapper.style.borderRadius = "12px";
            tableListWrapper.style.overflow = "hidden";
            
            const ul = document.createElement("ul");
            ul.style.listStyle = "none";
            ul.style.padding = "0";
            ul.style.margin = "0";
            
            bab.tables.sort((a, b) => {
                const numA = a.table_name.match(/(\d+\.\d+\.\d+)/);
                const numB = b.table_name.match(/(\d+\.\d+\.\d+)/);
                if (numA && numB) return numA[1].localeCompare(numB[1], undefined, {numeric: true});
                return a.table_name.localeCompare(b.table_name);
            });
            
            bab.tables.forEach((t, index) => {
                const li = document.createElement("li");
                li.className = "doc-table-list-item";
                li.style.display = "flex";
                li.style.justifyContent = "space-between";
                li.style.alignItems = "center";
                li.style.padding = "1.25rem 1.5rem";
                li.style.borderBottom = index !== bab.tables.length - 1 ? "1px solid #f1f5f9" : "none";
                li.style.transition = "background-color 0.2s ease";
                
                let displayName = formatCleanTableName(t.table_name);
                let displayNum = "";
                let displayNameOnly = displayName;
                const numMatch = displayName.match(/^(Tabel[\s_]*\d+(?:\.\d+)*\s*|^\d+(?:\.\d+)+\s*)/i);
                if (numMatch) {
                    displayNum = numMatch[1].trim();
                    displayNameOnly = displayName.substring(numMatch[0].length).trim();
                }

                const hasDb = t.has_db_data;
                const dbButtonHtml = hasDb
                    ? `<button onclick="viewDataEditor(${t.id}, '${t.table_name.replace(/'/g, "\\'")}')" class="btn btn-sm btn-success" style="font-weight:600; font-size:0.72rem; padding:4px 8px; border-radius:6px;">Lihat DB</button>`
                    : `<button class="btn btn-sm btn-outline-secondary" disabled style="font-weight:500; font-size:0.72rem; padding:4px 8px; border-radius:6px; opacity:0.5; cursor:not-allowed;" title="Data belum ada di database.">Lihat DB (Kosong)</button>`;

                li.innerHTML = `
                    <div style="display:flex; flex-direction:column; flex: 1; padding-right: 15px; overflow-wrap: break-word; word-wrap: break-word;">
                        <span class="doc-card-title" style="font-weight:500; font-size:0.95rem; display:flex; align-items:flex-start; gap:10px; line-height: 1.5; white-space: normal;">
                            <span style="font-size:1.2rem; margin-top:-2px;">📄</span>
                            <span style="flex:1;">
                                ${displayNum ? `<strong style="color:var(--primary); margin-right:8px; white-space:nowrap;">${displayNum}</strong>` : ""}
                                ${displayNameOnly}
                            </span>
                        </span>
                    </div>
                    <div style="display:flex; gap:0.45rem; flex-shrink: 0; flex-wrap: wrap; justify-content: flex-end; align-items:center;">
                        <!-- Quick Snippet & Tren -->
                        <button onclick="openTableSnippet(${t.id})" class="btn btn-sm btn-light border" style="font-weight:600; font-size:0.75rem; padding:4px 9px; border-radius:6px; color:#0284c7; background:#f0f9ff; border-color:#bae6fd !important; display:inline-flex; align-items:center; gap:4px;" title="Lihat pratinjau ringkas 5 baris">
                            <i class="bi bi-eye"></i> Snippet
                        </button>
                        <button onclick="openTimeSeriesForTable(${t.id}, '${t.table_name.replace(/'/g, "\\'")}')" class="btn btn-sm btn-light border" style="font-weight:600; font-size:0.75rem; padding:4px 9px; border-radius:6px; color:#d97706; background:#fffbeb; border-color:#fde68a !important; display:inline-flex; align-items:center; gap:4px;" title="Buka analisis grafik deret waktu">
                            <i class="bi bi-graph-up-arrow"></i> Tren
                        </button>

                        <!-- Tombol Aksi Data Terpisah -->
                        <button onclick="previewCsv(${t.id}, '${t.table_name.replace(/'/g, "\\'")}')" class="btn btn-sm btn-light border" style="font-weight:600; font-size:0.75rem; padding:4px 10px; border-radius:6px; color:#475569; background:#f8fafc; border-color:#cbd5e1 !important; display:inline-flex; align-items:center; gap:4px;" title="Lihat Data Tabel">
                            <i class="bi bi-table"></i> Lihat Data
                        </button>
                        <button onclick="previewCsvEditor(${t.id}, '${t.table_name.replace(/'/g, "\\'")}')" class="btn btn-sm btn-primary" style="font-weight:600; font-size:0.75rem; padding:4px 10px; border-radius:6px; display:inline-flex; align-items:center; gap:4px; box-shadow: 0 1px 2px rgba(79, 70, 229, 0.2);" title="Edit Data Tabel (Tersimpan ke Database)">
                            <i class="bi bi-pencil-square"></i> Edit Data
                        </button>
                        
                        <!-- Hapus -->
                        <button onclick="deleteTable(${t.id})" class="btn btn-sm btn-outline-danger" style="font-weight:600; font-size:0.75rem; padding:4px 8px; border-radius: 6px; display:inline-flex; align-items:center; gap:3px;" title="Hapus Tabel">
                            <i class="bi bi-trash3"></i>
                        </button>
                    </div>
                `;
                ul.appendChild(li);
            });
            
            tableListWrapper.appendChild(ul);
            container.appendChild(tableListWrapper);
        }
    }
}

function deleteTable(tableId) {
    Swal.fire({
        title: 'Hapus Tabel?',
        text: "Anda yakin ingin menghapus tabel ini secara permanen?",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#cbd5e1',
        confirmButtonText: 'Ya, Hapus',
        cancelButtonText: 'Batal',
        showLoaderOnConfirm: true,
        preConfirm: async () => {
            try {
                const res = await fetch(`${API_BASE}/tables/${tableId}`, { method: "DELETE" });
                if (!res.ok) throw new Error("Gagal menghapus");
                await populateDocumentList();
            } catch (error) {
                Swal.showValidationMessage(`Request failed: ${error}`);
            }
        },
        allowOutsideClick: () => !Swal.isLoading()
    }).then((result) => {
        if (result.isConfirmed) {
            Swal.fire('Terhapus!', 'Tabel berhasil dihapus.', 'success');
        }
    });
}

async function loadToDatabase(tableId) {
    if(!tableId) return;
    
    Swal.fire({
        title: 'Memuat Data',
        text: 'Membaca CSV dan mendeteksi anomali...',
        allowOutsideClick: false,
        didOpen: () => {
            Swal.showLoading();
        }
    });
    
    try {
        const res = await fetch(`${API_BASE}/tables/${tableId}/load`, { method: "POST" });
        if (res.ok) {
            Swal.close();
            viewDataEditor(tableId);
        } else {
            showToast("error", "Gagal", "Gagal memuat data");
        }
    } catch (e) {
        showToast("error", "Error", e.message);
    }
    
    loadDashboardStats();
}

async function viewDataEditor(tableId, tableName = "") {
    if(!tableId) { showToast("warning", "Peringatan", "Pilih tabel dulu!"); return; }
    navigateToEditor(tableId, tableName, 'db');
    buildEditorToolbar(tableId, tableName, 'db');
    await _loadDbIntoEditor(tableId, tableName);
}

async function _loadDbIntoEditor(tableId, tableName) {
    const thead = document.getElementById("data-grid-head");
    const tbody = document.getElementById("data-grid-body");
    thead.innerHTML = "<tr><th colspan='20' style='color:#64748b;'>Memuat data dari database...</th></tr>";
    tbody.innerHTML = "";

    try {
        const res = await fetch(`${API_BASE}/tables/${tableId}/data`);
        const payload = await res.json();
        const rows = payload.rows || [];
        const headers = (payload.headers && payload.headers.length > 0)
            ? payload.headers
            : (rows.length > 0 ? Object.keys(rows[0].data) : []);
        const units = payload.units || [];
        const years = payload.years || [];

        thead.innerHTML = ""; tbody.innerHTML = "";

        if (rows.length === 0) {
            thead.innerHTML = "<tr><th>—</th></tr>";
            tbody.innerHTML = `<tr><td style='color:#64748b; padding:2rem; text-align:center;'>Belum ada data di database. Gunakan tombol <b>Load CSV</b> terlebih dahulu dari halaman Daftar Tabel.</td></tr>`;
            return;
        }

        const formattedHeaders = headers.map((h, idx) => {
            let displayHeader = h.replace(/\.\d+$/, ''); // Strip pandas duplicate suffix (.1)
            
            const unit = units[idx] ? units[idx].trim() : "";
            const year = years[idx] ? years[idx].trim() : "";
            
            const skipUnit = !unit || unit === "-" || unit.toLowerCase() === "satuan";
            const skipYear = !year || year === "-" || year.toLowerCase() === "tahun";
            if (!skipUnit || !skipYear) {
                let suffix = "";
                if (!skipUnit) suffix += unit;
                if (!skipYear) suffix += suffix ? `, ${year}` : year;
                if (suffix) displayHeader += ` (${suffix})`;
            }
            return `<th>${displayHeader}</th>`;
        }).join("");

        thead.innerHTML = `<tr><th>Aksi</th>${formattedHeaders}</tr>`;

        rows.forEach(row => {
            const tr = document.createElement("tr");
            tr.id = `row-${row.id}`;
            if(row.is_anomaly) tr.classList.add("row-anomaly");

            const safeBtn = row.is_anomaly 
                ? `<button onclick="markRowSafe(${row.id}, ${tableId}, '${tableName.replace(/'/g, "\\'")}')" class="btn-row-safe" style="background:#10b981; border:1px solid #10b981; color:white; padding:3px 6px; border-radius:4px; font-size:0.75rem; cursor:pointer; margin-left:4px; font-weight:600;">Aman</button>`
                : '';
            let html = `<td><div class="row-action-cell"><button onclick="deleteRow(${row.id})" class="btn-row-del">Hapus</button>${safeBtn}</div></td>`;
            headers.forEach((h, idx) => {
                let val = row.data[h] != null ? row.data[h] : "";
                if (idx === 0) val = normalizeEntityName(val);
                html += `<td class="editable-cell" contenteditable="true" onblur="updateCell(${row.id}, '${h}', this.innerText)" onkeydown="if(event.key === 'Enter') { event.preventDefault(); this.blur(); }">${val}</td>`;
            });

            tr.innerHTML = html;
            tbody.appendChild(tr);
        });
    } catch(err) {
        thead.innerHTML = `<tr><th style="color:red">Error: ${err.message}</th></tr>`;
    }
}

async function addDbRow(tableId, tableName) {
    try {
        const res = await fetch(`${API_BASE}/tables/${tableId}/csv/row`, { method: "POST" });
        if (res.ok) {
            // Re-load CSV into DB
            await fetch(`${API_BASE}/tables/${tableId}/load`, { method: "POST" });
            await _loadDbIntoEditor(tableId, tableName);
        } else {
            showToast("error", "Gagal", "Gagal menambah baris");
        }
    } catch(e) {
        showToast("error", "Error", e.message);
    }
}

async function addDbColumn(tableId, tableName) {
    // Use the same column add flow as CSV mode, then reload DB view
    const origState = { ...editorState };
    await addCsvColumn(tableId, tableName);
    // addCsvColumn calls previewCsv at the end; we need to re-enter DB mode
    editorState = origState;
    editorState.mode = 'db';
}

async function updateCell(rowId, column, newValue) {
    const tr = document.getElementById(`row-${rowId}`);
    if (!tr) return;
    const headers = Array.from(document.getElementById("data-grid-head").querySelector("tr").children).slice(1).map(th => th.innerText);
    const cells = Array.from(tr.children).slice(1);
    
    const newData = {};
    headers.forEach((h, idx) => { newData[h] = cells[idx].innerText; });

    await fetch(`${API_BASE}/data/${rowId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: newData })
    });
    // Can optionally re-fetch to see if anomaly status changed, but for speed we just save.
}

function deleteRow(rowId) {
    Swal.fire({
        title: 'Hapus Baris?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#cbd5e1',
        confirmButtonText: 'Ya, Hapus',
        cancelButtonText: 'Batal',
        showLoaderOnConfirm: true,
        preConfirm: async () => {
            try {
                const res = await fetch(`${API_BASE}/data/${rowId}`, { method: "DELETE" });
                if (!res.ok) throw new Error("Gagal");
                document.getElementById(`row-${rowId}`).remove();
                await loadDashboardStats();
            } catch (error) {
                Swal.showValidationMessage(`Gagal menghapus: ${error}`);
            }
        },
        allowOutsideClick: () => !Swal.isLoading()
    });
}

async function markRowSafe(rowId, tableId, tableName) {
    try {
        const res = await fetch(`${API_BASE}/data/${rowId}/safe`, { method: "PUT" });
        if (res.ok) {
            const tr = document.getElementById(`row-${rowId}`);
            if (tr) {
                tr.classList.remove("row-anomaly");
                // Hapus tombol Aman dari kolom Aksi
                const safeBtn = tr.querySelector(".btn-row-safe");
                if (safeBtn) safeBtn.remove();
            }
            await loadDashboardStats();
            showToast('success', 'Tandai Aman', 'Baris ini sudah ditandai aman (bukan anomali) dan disimpan.', 2000);
        } else {
            showToast("error", "Gagal", "Gagal menandai baris aman");
        }
    } catch (e) {
        showToast("error", "Error", e.message);
    }
}

async function markAllSafeInTable(tableId, tableName) {
    Swal.fire({
        title: 'Tandai Semua Aman?',
        text: "Seluruh baris berstatus anomali pada tabel ini akan ditandai aman.",
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#10b981',
        cancelButtonColor: '#cbd5e1',
        confirmButtonText: 'Ya, Tandai Semua Aman',
        cancelButtonText: 'Batal'
    }).then(async (result) => {
        if (result.isConfirmed) {
            try {
                const res = await fetch(`${API_BASE}/tables/${tableId}/safe-all`, { method: "PUT" });
                if (res.ok) {
                    showToast('success', 'Berhasil!', 'Semua data tabel telah ditandai aman.');
                    _loadDbIntoEditor(tableId, tableName);
                    loadDashboardStats();
                } else {
                    showToast('error', 'Gagal', 'Gagal memproses permintaan.');
                }
            } catch(e) {
                showToast('error', 'Error', e.message);
            }
        }
    });
}


// --- AUTO REFRESH POLLING ---
let previousDocsForPolling = [];

async function pollStatus() {
    try {
        const res = await fetch(`${API_BASE}/documents`, { cache: "no-store" });
        if (!res.ok) return;
        const currentDocs = await res.json();
        
        let hasChanged = false;
        
        if (currentDocs.length !== previousDocsForPolling.length) {
            hasChanged = true;
        } else {
            for (const cur of currentDocs) {
                const prev = previousDocsForPolling.find(p => p.id === cur.id);
                if (!prev || prev.status !== cur.status) {
                    hasChanged = true;
                    break;
                }
            }
        }
        
        if (hasChanged) {
            previousDocsForPolling = currentDocs;
            
            const isPublikasiActive = document.getElementById('page-publikasi').classList.contains('active');
            const isTabelActive = document.getElementById('page-tabel').classList.contains('active');
            const isDashboardActive = document.getElementById('page-dashboard').classList.contains('active');
            
            if (isPublikasiActive) loadDocuments();
            if (isTabelActive) populateDocumentList();
            if (isDashboardActive) loadDashboardStats();
        }
    } catch(e) {
        // Silently ignore network errors during polling
    }
}

// Start polling every 5 seconds to auto-refresh UI when extraction finishes
setInterval(pollStatus, 5000);
// Initialize the cache on load
fetch(`${API_BASE}/documents`, { cache: "no-store" }).then(r=>r.json()).then(d=>previousDocsForPolling = d).catch(e=>{});


function downloadExcel(tableId) {
    window.location.href = `${API_BASE}/tables/${tableId}/excel`;
}

function downloadCsv(tableId) {
    window.location.href = `${API_BASE}/tables/${tableId}/csv`;
}

/** Mode Lihat CSV: read-only, tidak bisa edit */
async function previewCsv(tableId, tableName) {
    navigateToEditor(tableId, tableName, 'csv-view');
    buildEditorToolbar(tableId, tableName, 'csv-view');
    await _loadCsvIntoEditor(tableId, tableName, false);
}

/** Mode Edit CSV: full CRUD + rename kolom + rename tabel */
async function previewCsvEditor(tableId, tableName) {
    navigateToEditor(tableId, tableName, 'csv-edit');
    buildEditorToolbar(tableId, tableName, 'csv-edit');
    await _loadCsvIntoEditor(tableId, tableName, true);
}

/** Open a table in CSV view mode from anomaly panels / search results / usage modal */
function openTable(tableId) {
    fetch(API_BASE + '/tables/' + tableId)
        .then(function(r) { return r.json(); })
        .then(function(info) {
            previewCsv(tableId, info.table_name || 'Tabel #' + tableId);
        })
        .catch(function() {
            previewCsv(tableId, 'Tabel #' + tableId);
        });
}

/** Open a table in CSV edit mode from search results */
function openTableForEdit(tableId) {
    fetch(API_BASE + '/tables/' + tableId)
        .then(function(r) { return r.json(); })
        .then(function(info) {
            previewCsvEditor(tableId, info.table_name || 'Tabel #' + tableId);
        })
        .catch(function() {
            previewCsvEditor(tableId, 'Tabel #' + tableId);
        });
}

/**
 * Load CSV into the editor grid.
 * @param {boolean} isEditable - true = edit mode (CRUD), false = view mode (read-only)
 */
async function _loadCsvIntoEditor(tableId, tableName, isEditable = false) {
    // Reset col-delete-bar
    const colBar = document.getElementById("col-delete-bar");
    const colBarBtns = document.getElementById("col-delete-bar-buttons");
    if (colBar) { colBar.classList.remove('visible'); if(colBarBtns) colBarBtns.innerHTML = ""; }

    const thead = document.getElementById("data-grid-head");
    const tbody = document.getElementById("data-grid-body");
    thead.innerHTML = "<tr><th colspan='20' style='color:#64748b; padding:1.25rem; text-align:center; font-weight:500;'><span class='spinner-border spinner-border-sm text-primary me-2' role='status'></span>Memuat Data Tabel...</th></tr>";
    tbody.innerHTML = "";
    
    try {
        const res = await fetch(`${API_BASE}/tables/${tableId}/csv_preview`);
        if (!res.ok) throw new Error("Gagal mengambil preview CSV");

        const data = await res.json();
        await checkColumnAnomalies(tableId);

        if (data.headers && data.headers.length > 0) {
            if (isEditable) {
                // Edit mode: header menampilkan tiga baris input (Nama, Satuan, Tahun) secara terpisah & rapi
                thead.innerHTML = `<tr>
                    <th class="th-action-col" style="vertical-align: middle; text-align: center;">Aksi Baris</th>
                    ${data.headers.map((h, idx) => {
                        const unit = data.units && data.units[idx] ? data.units[idx] : "";
                        const year = data.years && data.years[idx] ? data.years[idx] : "";
                        var anomalyInfo = getAnomalyInfo(idx);
                        var isAnom = anomalyInfo !== undefined;
                        
                        return `
                        <th class="editable-header-wrapper" style="min-width: 170px; padding: 0.75rem 0.5rem; text-align: left; border-bottom: 2px solid #cbd5e1; background: #f8fafc;">
                            <div style="margin-bottom: 6px;">
                                <label style="font-size: 0.68rem; font-weight: 700; color: #64748b; display: block; margin-bottom: 2px;">NAMA KOLOM</label>
                                <input type="text" class="header-name-input" value="${h}" onchange="onHeaderNameChange(${idx}, this.value)" style="width: 100%; padding: 4px 6px; font-size: 0.8rem; font-weight: 600; border-radius: 4px; border: 1px solid #cbd5e1; outline:none; font-family: 'Inter', sans-serif;">
                            </div>
                            <div style="display: flex; gap: 4px; margin-bottom: 8px;">
                                <div style="flex: 1;">
                                    <label style="font-size: 0.65rem; font-weight: 700; color: #64748b; display: block; margin-bottom: 2px;">SATUAN</label>
                                    <input type="text" class="header-unit-input" value="${unit}" onchange="updateCsvUnitLocal(${idx}, this.value)" placeholder="e.g. Jiwa" style="width: 100%; padding: 3px 6px; font-size: 0.75rem; border-radius: 4px; border: 1px solid #cbd5e1; outline:none; font-family: 'Inter', sans-serif; background: white;">
                                </div>
                                <div style="width: 65px;">
                                    <label style="font-size: 0.65rem; font-weight: 700; color: #64748b; display: block; margin-bottom: 2px;">TAHUN</label>
                                    <input type="text" class="header-year-input" value="${year}" onchange="updateCsvYearLocal(${idx}, this.value)" placeholder="e.g. 2025" style="width: 100%; padding: 3px 6px; font-size: 0.75rem; border-radius: 4px; border: 1px solid #cbd5e1; outline:none; font-family: 'Inter', sans-serif; background: white;">
                                </div>
                            </div>
                            <div style="display: flex; gap: 4px; justify-content: center; padding-top: 6px; border-top: 1px dashed #e2e8f0;">
                                <button onclick="insertCsvColBelowLocal(${idx})" class="btn-row-insert" style="padding: 3px 8px; font-size: 0.72rem; border-radius: 4px; border: 1px solid #cbd5e1; background: #f1f5f9; color: #475569; cursor: pointer; transition: all 0.15s;" onmouseenter="this.style.background='#e2e8f0'; this.style.color='#1e293b'" onmouseleave="this.style.background='#f1f5f9'; this.style.color='#475569'">Sisip</button>
                                <button onclick="deleteCsvColumnLocal(${idx})" class="btn-row-del" style="padding: 3px 8px; font-size: 0.72rem; border-radius: 4px; border: 1px solid #fca5a5; background: #fee2e2; color: #b91c1c; cursor: pointer; transition: all 0.15s;" onmouseenter="this.style.background='#fecaca'; this.style.color='#991b1b'" onmouseleave="this.style.background='#fee2e2'; this.style.color='#b91c1c'">Hapus</button>
                            </div>
                            ${isAnom ? `
                            <div style="position: absolute; top: 2px; right: 2px; display: flex; gap: 4px; align-items: center; z-index: 10;">
                                <div style="padding: 2px 4px; background: #fef2f2; border: 1px solid #fecaca; border-radius: 4px;" title="Terdeteksi Anomali">
                                    <span style="color:#dc2626; font-size:0.65rem; font-weight:700;">⚠️</span>
                                </div>
                                <button onclick="dismissColumnAnomalyLocal(${tableId}, ${idx}, '${h.replace(/'/g, "\\'")}')" style="background:#22c55e; border:1px solid #16a34a; color:white; padding:2px 5px; font-size:0.65rem; border-radius:4px; cursor:pointer; font-weight:600; line-height: 1;" title="Tandai Aman">Aman</button>
                            </div>` : ''}
                        </th>`;
                    }).join("")}
                </tr>`;
            } else {
                // View mode: header digabung menjadi "Nama Kolom (Satuan, Tahun)" jika ada metadatanya
                thead.innerHTML = `<tr>${data.headers.map((h, idx) => {
                    const unit = data.units && data.units[idx] ? data.units[idx].trim() : "";
                    const year = data.years && data.years[idx] ? data.years[idx].trim() : "";
                    var anomalyInfo = getAnomalyInfo(idx);
                    var isAnom = anomalyInfo !== undefined;
                    
                    let displayHeader = h;
                    // Tampilkan satuan dan tahun untuk semua kolom yang memilikinya (bukan "-" atau "satuan"/"tahun")
                    const skipUnit = !unit || unit === "-" || unit.toLowerCase() === "satuan";
                    const skipYear = !year || year === "-" || year.toLowerCase() === "tahun";
                    if (!skipUnit || !skipYear) {
                        let suffix = "";
                        if (!skipUnit) suffix += unit;
                        if (!skipYear) suffix += suffix ? `, ${year}` : year;
                        if (suffix) displayHeader += ` (${suffix})`;
                    }
                    
                    return `<th>${isAnom ? '⚠️ ' : ''}${displayHeader}</th>`;
                }).join("")}</tr>`;
            }
        } else {
            thead.innerHTML = `<tr><th>Data Kosong / Belum ada kolom</th></tr>`;
        }
        
        // Kata kunci untuk mendeteksi baris ringkasan/agregat (kolom pertama)
        const SUMMARY_KEYWORDS = [
            'jumlah', 'total', 'kabupaten', 'tasikmalaya', 'kota', 'provinsi',
            'jawa barat', 'indonesia', 'rata-rata', 'rata rata', 'average',
            'subtotal', 'grand total', 'keseluruhan', 'seluruh'
        ];

        function isSummaryRow(row) {
            if (!row || row.length === 0) return false;
            const firstCell = String(row[0] || '').trim().toLowerCase();
            return SUMMARY_KEYWORDS.some(kw => firstCell.includes(kw));
        }

        if (data.rows && data.rows.length > 0) {
            // Render semua baris langsung ke tabel utama (tidak ada pemisahan summary)
            data.rows.forEach((row, rowIndex) => {
                const tr = document.createElement("tr");
                tr.id = isEditable ? `csv-row-${rowIndex}` : `csv-view-row-${rowIndex}`;

                let html = '';
                if (isEditable) {
                    html = `<td><div class="row-action-cell">
                        <button onclick="insertCsvRowBelowLocal(${rowIndex})" class="btn-row-insert" title="Sisipkan baris baru di bawah baris ini">Sisip</button>
                        <button onclick="deleteCsvRowLocal(${rowIndex})" class="btn-row-del">Hapus</button>
                    </div></td>`;

                    row.forEach((cell, cellIdx) => {
                        let val = cell != null ? cell : "";
                        if (cellIdx === 0) val = normalizeEntityName(val);
                        html += `<td class="editable-cell" contenteditable="true" onkeydown="if(event.key === 'Enter') { event.preventDefault(); this.blur(); }">${val}</td>`;
                    });
                } else {
                    // Read-only cells
                    row.forEach((cell, cellIdx) => {
                        let val = cell != null ? cell : "";
                        if (cellIdx === 0) val = normalizeEntityName(val);
                        html += `<td class="readonly-cell">${val}</td>`;
                    });
                }

                tr.innerHTML = html;
                tbody.appendChild(tr);
            });
        } else {
            const colSpan = data.headers ? (isEditable ? data.headers.length + 1 : data.headers.length) : 1;
            tbody.innerHTML = `<tr><td colspan="${colSpan}" style="text-align:center;color:#64748b;padding:2rem;">Tidak ada baris data.</td></tr>`;
        }
    } catch (err) {
        thead.innerHTML = `<tr><th style="color:red">Error: ${err.message}</th></tr>`;
    }
}

/** Rename a CSV column header by clicking on it */
async function renameCsvColumn(tableId, colIndex, tableName) {
    const th = document.querySelector(`#data-grid-head tr th.editable-header:nth-child(${colIndex + 2})`);
    const currentName = th ? th.innerText.replace('✏️', '').trim() : `Kolom ${colIndex + 1}`;

    const { value: newName } = await Swal.fire({
        title: 'Rename Kolom',
        input: 'text',
        inputLabel: 'Nama Kolom Baru',
        inputValue: currentName,
        inputPlaceholder: 'Masukkan nama kolom baru',
        showCancelButton: true,
        cancelButtonText: 'Batal',
        confirmButtonText: 'Simpan',
        inputValidator: (val) => { if (!val || !val.trim()) return 'Nama kolom tidak boleh kosong!'; }
    });
    if (!newName || newName.trim() === currentName) return;

    try {
        const res = await fetch(`${API_BASE}/tables/${tableId}/csv/rename_column`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ col_index: colIndex, new_name: newName.trim() })
        });
        if (res.ok) {
            await _loadCsvIntoEditor(tableId, tableName, true);
        } else {
            const err = await res.json();
            showToast('error', 'Gagal', err.detail || 'Gagal rename kolom');
        }
    } catch(e) {
        showToast('error', 'Error', e.message);
    }
}

/** Rename tabel (judul & nomor) */
async function renameTable(tableId) {
    const currentTitle = document.getElementById('editor-title')?.textContent?.trim() || '';
    const currentNum = document.getElementById('editor-table-number')?.textContent?.trim() || '';

    const { value: formValues } = await Swal.fire({
        title: 'Edit Identitas Tabel',
        html: `
            <div style="text-align: left; margin-bottom: 12px;">
                <label for="swal-table-number" style="font-weight: 600; font-size: 0.9rem; color: #475569; display: block; margin-bottom: 4px;">Nomor Tabel</label>
                <input id="swal-table-number" class="swal2-input" placeholder="Contoh: Tabel 1.1.1" value="${currentNum}" style="margin: 0; width: 100%; box-sizing: border-box;">
            </div>
            <div style="text-align: left;">
                <label for="swal-table-title" style="font-weight: 600; font-size: 0.9rem; color: #475569; display: block; margin-bottom: 4px;">Judul Tabel</label>
                <input id="swal-table-title" class="swal2-input" placeholder="Masukkan judul tabel" value="${currentTitle}" style="margin: 0; width: 100%; box-sizing: border-box;">
            </div>
        `,
        focusConfirm: false,
        showCancelButton: true,
        cancelButtonText: 'Batal',
        confirmButtonText: 'Simpan',
        preConfirm: () => {
            const num = document.getElementById('swal-table-number').value.trim();
            const title = document.getElementById('swal-table-title').value.trim();
            if (!title) {
                Swal.showValidationMessage('Judul tabel tidak boleh kosong!');
                return false;
            }
            return { num, title };
        }
    });

    if (!formValues) return;

    const { num: newNum, title: newTitle } = formValues;
    const fullNewName = newNum ? `${newNum} - ${newTitle}` : newTitle;

    try {
        const res = await fetch(`${API_BASE}/tables/${tableId}/rename`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ new_name: fullNewName })
        });
        if (res.ok) {
            // Update UI
            const numEl = document.getElementById('editor-table-number');
            if (numEl) {
                numEl.textContent = newNum;
                numEl.style.display = newNum ? 'inline' : 'none';
            }
            const titleEl = document.getElementById('editor-title');
            if (titleEl) titleEl.textContent = newTitle;
            editorState.tableName = fullNewName;
            showToast('success', 'Berhasil!', 'Identitas tabel berhasil diperbarui.', 1500);
        } else {
            const err = await res.json();
            showToast('error', 'Gagal', err.detail || 'Gagal merubah identitas tabel');
        }
    } catch(e) {
        showToast('error', 'Error', e.message);
    }
}

async function updateCsvRow(tableId, rowIndex) {
    const tr = document.getElementById(`csv-row-${rowIndex}`);
    if (!tr) return;
    
    const cells = Array.from(tr.children).slice(1);
    const newData = cells.map(td => td.innerText);

    try {
        await fetch(`${API_BASE}/tables/${tableId}/csv/row/${rowIndex}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ data: newData })
        });
    } catch(err) {
        console.error("Failed to update CSV row", err);
    }
}

function deleteCsvRow(tableId, rowIndex) {
    Swal.fire({
        title: 'Hapus Baris CSV?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#cbd5e1',
        confirmButtonText: 'Ya, Hapus',
        cancelButtonText: 'Batal',
        showLoaderOnConfirm: true,
        preConfirm: async () => {
            try {
                const res = await fetch(`${API_BASE}/tables/${tableId}/csv/row/${rowIndex}`, { method: "DELETE" });
                if (!res.ok) throw new Error("Gagal menghapus baris");
                
                document.getElementById(`csv-row-${rowIndex}`).remove();
                
                // Re-index the remaining rows
                const tbody = document.getElementById("data-grid-body");
                Array.from(tbody.children).forEach((tr, newIdx) => {
                    tr.id = `csv-row-${newIdx}`;
                    const delBtn = tr.querySelector(".btn-row-del");
                    const insBtn = tr.querySelector(".btn-row-insert");
                    if(delBtn) delBtn.setAttribute("onclick", `deleteCsvRow(${tableId}, ${newIdx})`);
                    if(insBtn) insBtn.setAttribute("onclick", `insertCsvRowBelow(${tableId}, ${newIdx})`);
                    const cells = Array.from(tr.children).slice(1);
                    cells.forEach(td => td.setAttribute("onblur", `updateCsvRow(${tableId}, ${newIdx})`));
                });
                
            } catch (error) {
                Swal.showValidationMessage(`Gagal menghapus: ${error}`);
            }
        },
        allowOutsideClick: () => !Swal.isLoading()
    });
}

async function addCsvRow(tableId, tableName) {
    try {
        const res = await fetch(`${API_BASE}/tables/${tableId}/csv/row`, { method: "POST" });
        if(res.ok) {
            await _loadCsvIntoEditor(tableId, tableName);
        } else {
            showToast("error", "Gagal", "Gagal menambah baris");
        }
    } catch(e) {
        showToast("error", "Error", e.message);
    }
}

async function insertCsvRowBelow(tableId, rowIndex) {
    try {
        // rowIndex is 0-based data row; API insert_row uses 0-based data row
        const res = await fetch(`${API_BASE}/tables/${tableId}/csv/insert_row/${rowIndex + 1}`, { method: "POST" });
        if (res.ok) {
            await _loadCsvIntoEditor(editorState.tableId, editorState.tableName);
        } else {
            showToast("error", "Gagal", "Gagal menyisipkan baris");
        }
    } catch(e) {
        showToast("error", "Error", e.message);
    }
}

async function addCsvColumn(tableId, tableName) {
    // Step 1: Ask column name
    const { value: colName } = await Swal.fire({
        title: 'Tambah Kolom Baru',
        input: 'text',
        inputLabel: 'Nama Kolom Baru',
        inputPlaceholder: 'Contoh: Status Kecamatan',
        showCancelButton: true,
        cancelButtonText: 'Batal',
        confirmButtonText: 'Lanjut →',
        inputValidator: (value) => {
            if (!value || !value.trim()) return 'Nama kolom tidak boleh kosong!'
        }
    });
    if (!colName) return;

    // Step 2: Ask insert position with current column list
    // Fetch current headers
    let currentHeaders = [];
    try {
        const hRes = await fetch(`${API_BASE}/tables/${tableId}/csv_preview`);
        if (hRes.ok) {
            const hData = await hRes.json();
            currentHeaders = hData.headers || [];
        }
    } catch(e) { /* ignore */ }

    // Build options HTML
    let optionsHtml = `
        <option value="start">Paling Awal (Kolom Pertama)</option>
        ${currentHeaders.map((h, i) => `<option value="after_${i}">Sesudah "${h}"</option>`).join('')}
        ${currentHeaders.map((h, i) => `<option value="before_${i}">Sebelum "${h}"</option>`).join('')}
        <option value="end" selected>Paling Akhir (Kolom Terakhir)</option>
    `;
    // Reorder: start, then after each col, then end
    optionsHtml = `
        <option value="start">Paling Awal</option>
        ${currentHeaders.map((h, i) => `<option value="after_${i}">Sesudah kolom: "${h}"</option>`).join('')}
        <option value="end" selected>Paling Akhir</option>
        ${currentHeaders.map((h, i) => `<option value="before_${i}">Sebelum kolom: "${h}"</option>`).join('')}
    `;

    const { value: posValue } = await Swal.fire({
        title: 'Pilih Posisi Kolom',
        html: `
            <p style="margin-bottom:12px; color:#475569; font-size:0.95rem;">
                Kolom <strong>"${colName}"</strong> akan disisipkan di mana?
            </p>
            <select id="swal-col-position" style="
                width:100%; padding:10px 14px; border-radius:8px;
                border:1.5px solid #cbd5e1; font-size:0.95rem;
                background:#f8fafc; color:#1e293b; cursor:pointer;
                outline:none; appearance:none; -webkit-appearance:none;
            ">
                ${optionsHtml}
            </select>
        `,
        showCancelButton: true,
        cancelButtonText: 'Batal',
        confirmButtonText: 'Sisipkan',
        preConfirm: () => {
            return document.getElementById('swal-col-position').value;
        }
    });
    if (!posValue) return;

    // Resolve position payload
    let positionPayload;
    if (posValue === 'start') {
        positionPayload = 'start';
    } else if (posValue === 'end') {
        positionPayload = 'end';
    } else if (posValue.startsWith('after_')) {
        const idx = parseInt(posValue.replace('after_', ''));
        const targetCol = currentHeaders[idx];
        positionPayload = { after_column: targetCol };
    } else if (posValue.startsWith('before_')) {
        const idx = parseInt(posValue.replace('before_', ''));
        const targetCol = currentHeaders[idx];
        positionPayload = { before_column: targetCol };
    } else {
        positionPayload = 'end';
    }

    try {
        const res = await fetch(`${API_BASE}/tables/${tableId}/csv/column`, { 
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ column_name: colName.trim(), position: positionPayload })
        });
        if (res.ok) {
            showToast('success', 'Berhasil!', `Kolom "${colName}" berhasil disisipkan.`, 1500);
            await _loadCsvIntoEditor(editorState.tableId, editorState.tableName);
        } else {
            const err = await res.json();
            showToast("error", "Gagal", err.detail || "Gagal menambah kolom");
        }
    } catch(e) {
        showToast("error", "Error", e.message);
    }
}

// --- CLIENT-SIDE ONLY CSV MODIFICATION FUNCTIONS (NO AUTO-SAVE) ---

function isDimensionColumn(header) {
    if (!header) return true;
    const headerLower = header.trim().toLowerCase();
    const dimensionKeywords = [
        "kecamatan", "kabupaten", "desa", "kelurahan", "nomor", "no", "no.", 
        "rincian", "uraian", "kategori", "bulan", "hari", "provinsi", "kota",
        "sex", "jenis kelamin", "dimensi", "nama"
    ];
    if (headerLower === "" || headerLower === "-") return true;
    return dimensionKeywords.some(keyword => headerLower.includes(keyword));
}

function onHeaderNameChange(idx, newName) {
    // No-op: perubahan nama kolom tidak mempengaruhi state satuan/tahun
    // Nilai satuan dan tahun dibaca langsung dari input saat simpan
}

function updateCsvUnitLocal(idx, val) {
    // No-op, values are read directly from inputs when saving
}

function updateCsvYearLocal(idx, val) {
    // No-op, values are read directly from inputs when saving
}

// Menyisipkan baris baru secara lokal ke DOM
function insertCsvRowBelowLocal(rowIndex) {
    const tbody = document.getElementById("data-grid-body");
    const numCols = document.getElementById("data-grid-head").querySelector("tr").children.length - 1;
    const tr = document.createElement("tr");
    
    let html = `<td><div class="row-action-cell">
        <button onclick="insertCsvRowBelowLocal(0)" class="btn-row-insert" title="Sisipkan baris baru di bawah baris ini">Sisip</button>
        <button onclick="deleteCsvRowLocal(0)" class="btn-row-del">Hapus</button>
    </div></td>`;

    for (let i = 0; i < numCols; i++) {
        html += `<td class="editable-cell" contenteditable="true" onkeydown="if(event.key === 'Enter') { event.preventDefault(); this.blur(); }"></td>`;
    }
    
    tr.innerHTML = html;
    
    // Sisipkan setelah baris target
    const targetTr = tbody.children[rowIndex];
    if (targetTr && targetTr.nextSibling) {
        tbody.insertBefore(tr, targetTr.nextSibling);
    } else {
        tbody.appendChild(tr);
    }
    
    reindexLocalRows();
}

// Menghapus baris secara lokal dari DOM
function deleteCsvRowLocal(rowIndex) {
    const tbody = document.getElementById("data-grid-body");
    if (tbody.children[rowIndex]) {
        tbody.children[rowIndex].remove();
        reindexLocalRows();
    }
}

// Menata ulang index baris lokal setelah ada penyisipan atau penghapusan
function reindexLocalRows() {
    const tbody = document.getElementById("data-grid-body");
    Array.from(tbody.children).forEach((tr, idx) => {
        tr.id = `csv-row-${idx}`;
        const insBtn = tr.querySelector(".btn-row-insert");
        const delBtn = tr.querySelector(".btn-row-del");
        if (insBtn) insBtn.setAttribute("onclick", `insertCsvRowBelowLocal(${idx})`);
        if (delBtn) delBtn.setAttribute("onclick", `deleteCsvRowLocal(${idx})`);
    });
}

// Mengganti nama kolom secara lokal
async function renameCsvColumnLocal(colIndex) {
    const th = document.querySelector(`#data-grid-head tr th:nth-child(${colIndex + 2})`);
    const titleContainer = th.querySelector(".editable-header-title");
    const currentName = titleContainer ? titleContainer.innerText.replace('(Edit)', '').trim() : `Kolom ${colIndex + 1}`;

    const { value: newName } = await Swal.fire({
        title: 'Rename Kolom',
        input: 'text',
        inputLabel: 'Nama Kolom Baru',
        inputValue: currentName,
        inputPlaceholder: 'Masukkan nama kolom baru',
        showCancelButton: true,
        cancelButtonText: 'Batal',
        confirmButtonText: 'Simpan',
        inputValidator: (val) => { if (!val || !val.trim()) return 'Nama kolom tidak boleh kosong!'; }
    });
    
    if (newName && newName.trim() !== currentName) {
        titleContainer.innerHTML = `${newName.trim()} <span style="font-size: 0.7rem; color: #6366f1; opacity: 0.8; font-weight: normal; margin-left: 2px;">(Edit)</span>`;
    }
}

// Menyisipkan kolom baru secara lokal ke DOM
async function insertCsvColBelowLocal(colIndex) {
    const { value: colName } = await Swal.fire({
        title: 'Tambah Kolom Baru',
        input: 'text',
        inputLabel: 'Nama Kolom Baru',
        inputPlaceholder: 'Masukkan nama kolom baru',
        showCancelButton: true,
        cancelButtonText: 'Batal',
        confirmButtonText: 'Sisipkan',
        inputValidator: (value) => {
            if (!value || !value.trim()) return 'Nama kolom tidak boleh kosong!'
        }
    });
    if (!colName) return;

    const theadTr = document.getElementById("data-grid-head").querySelector("tr");
    
    // Buat element th baru
    const newTh = document.createElement("th");
    newTh.className = "editable-header-wrapper";
    newTh.style.cssText = "min-width: 170px; padding: 0.75rem 0.5rem; text-align: left; border-bottom: 2px solid #cbd5e1; background: #f8fafc;";
    
    const isDim = false;
    const unitVal = "";
    const yearVal = "";

    newTh.innerHTML = `
        <div style="margin-bottom: 6px;">
            <label style="font-size: 0.68rem; font-weight: 700; color: #64748b; display: block; margin-bottom: 2px;">NAMA KOLOM</label>
            <input type="text" class="header-name-input" value="${colName.trim()}" onchange="onHeaderNameChange(0, this.value)" style="width: 100%; padding: 4px 6px; font-size: 0.8rem; font-weight: 600; border-radius: 4px; border: 1px solid #cbd5e1; outline:none; font-family: 'Inter', sans-serif;">
        </div>
        <div style="display: flex; gap: 4px; margin-bottom: 8px;">
            <div style="flex: 1;">
                <label style="font-size: 0.65rem; font-weight: 700; color: #64748b; display: block; margin-bottom: 2px;">SATUAN</label>
                <input type="text" class="header-unit-input" value="${unitVal}" onchange="updateCsvUnitLocal(0, this.value)" placeholder="e.g. Jiwa" style="width: 100%; padding: 3px 6px; font-size: 0.75rem; border-radius: 4px; border: 1px solid #cbd5e1; outline:none; font-family: 'Inter', sans-serif; background: white;">
            </div>
            <div style="width: 65px;">
                <label style="font-size: 0.65rem; font-weight: 700; color: #64748b; display: block; margin-bottom: 2px;">TAHUN</label>
                <input type="text" class="header-year-input" value="${yearVal}" onchange="updateCsvYearLocal(0, this.value)" placeholder="e.g. 2025" style="width: 100%; padding: 3px 6px; font-size: 0.75rem; border-radius: 4px; border: 1px solid #cbd5e1; outline:none; font-family: 'Inter', sans-serif; background: white;">
            </div>
        </div>
        <div style="display: flex; gap: 4px; justify-content: center; padding-top: 6px; border-top: 1px dashed #e2e8f0;">
            <button class="btn-row-insert" style="padding: 3px 8px; font-size: 0.72rem; border-radius: 4px; border: 1px solid #cbd5e1; background: #f1f5f9; color: #475569; cursor: pointer; transition: all 0.15s;" onmouseenter="this.style.background='#e2e8f0'; this.style.color='#1e293b'" onmouseleave="this.style.background='#f1f5f9'; this.style.color='#475569'">Sisip</button>
            <button class="btn-row-del" style="padding: 3px 8px; font-size: 0.72rem; border-radius: 4px; border: 1px solid #fca5a5; background: #fee2e2; color: #b91c1c; cursor: pointer; transition: all 0.15s;" onmouseenter="this.style.background='#fecaca'; this.style.color='#991b1b'" onmouseleave="this.style.background='#fee2e2'; this.style.color='#b91c1c'">Hapus</button>
        </div>
    `;

    // Sisipkan th di pos target + 2 (karena kolom pertama di index 1 adalah aksi baris)
    const targetTh = theadTr.children[colIndex + 1];
    if (targetTh && targetTh.nextSibling) {
        theadTr.insertBefore(newTh, targetTh.nextSibling);
    } else {
        theadTr.appendChild(newTh);
    }

    // Sisipkan sel kosong di setiap baris data
    const tbody = document.getElementById("data-grid-body");
    Array.from(tbody.children).forEach(tr => {
        const newTd = document.createElement("td");
        newTd.className = "editable-cell";
        newTd.contentEditable = "true";
        newTd.setAttribute("onkeydown", "if(event.key === 'Enter') { event.preventDefault(); this.blur(); }");
        
        const targetTd = tr.children[colIndex + 1];
        if (targetTd && targetTd.nextSibling) {
            tr.insertBefore(newTd, targetTd.nextSibling);
        } else {
            tr.appendChild(newTd);
        }
    });

    reindexLocalColumns();
}

// Menghapus kolom secara lokal dari DOM
function deleteCsvColumnLocal(colIndex) {
    const theadTr = document.getElementById("data-grid-head").querySelector("tr");
    if (theadTr.children[colIndex + 1]) {
        theadTr.children[colIndex + 1].remove();
    }

    const tbody = document.getElementById("data-grid-body");
    Array.from(tbody.children).forEach(tr => {
        if (tr.children[colIndex + 1]) {
            tr.children[colIndex + 1].remove();
        }
    });

    reindexLocalColumns();
}

// Menata ulang index th/kolom setelah ada penyisipan atau penghapusan kolom lokal
function reindexLocalColumns() {
    const theadTr = document.getElementById("data-grid-head").querySelector("tr");
    if (!theadTr) return;
    
    // headers start from index 1 (0 is action column)
    Array.from(theadTr.children).slice(1).forEach((th, idx) => {
        const nameInput = th.querySelector(".header-name-input");
        if (nameInput) {
            nameInput.setAttribute("onchange", `onHeaderNameChange(${idx}, this.value)`);
        }
        
        const unitInput = th.querySelector(".header-unit-input");
        if (unitInput) {
            unitInput.setAttribute("onchange", `updateCsvUnitLocal(${idx}, this.value)`);
        }
        
        const yearInput = th.querySelector(".header-year-input");
        if (yearInput) {
            yearInput.setAttribute("onchange", `updateCsvYearLocal(${idx}, this.value)`);
        }
        
        const insBtn = th.querySelector(".btn-row-insert");
        const delBtn = th.querySelector(".btn-row-del");
        if (insBtn) insBtn.setAttribute("onclick", `insertCsvColBelowLocal(${idx})`);
        if (delBtn) delBtn.setAttribute("onclick", `deleteCsvColumnLocal(${idx})`);
    });
}

// Menyimpan seluruh perubahan data dari DOM langsung ke API (Massal)
async function saveCsvChangesToServer(tableId) {
    if (editorState.mode !== 'csv-edit') {
        showToast("error", "Gagal", "Anda tidak sedang berada dalam mode edit.");
        return;
    }

    const theadTr = document.getElementById("data-grid-head")?.querySelector("tr");
    if (!theadTr) {
        showToast("error", "Gagal", "Elemen header tabel tidak ditemukan. Harap muat ulang.");
        return;
    }

    // 1. Ekstrak Headers
    const headers = Array.from(theadTr.children).slice(1).map(th => {
        const input = th.querySelector(".header-name-input");
        return input ? input.value.trim() : "";
    });

    const non_empty_headers = headers.filter(h => h !== "");
    if (headers.length === 0 || non_empty_headers.length === 0) {
        showToast("error", "Gagal", "Nama kolom (headers) tidak boleh kosong. Silakan muat ulang halaman atau periksa kembali input Anda.");
        return;
    }

    Swal.fire({
        title: 'Menyimpan Perubahan...',
        allowOutsideClick: false,
        didOpen: () => {
            Swal.showLoading();
        }
    });

    // 2. Ekstrak Units (Satuan)
    const units = Array.from(theadTr.children).slice(1).map(th => {
        const input = th.querySelector(".header-unit-input");
        let val = input ? input.value.trim() : "-";
        if (val.toLowerCase() === "persen" || val.toLowerCase() === "persentase" || val.toLowerCase() === "percent") {
            val = "%";
        }
        return val;
    });

    // 3. Ekstrak Years (Tahun)
    const years = Array.from(theadTr.children).slice(1).map(th => {
        const input = th.querySelector(".header-year-input");
        return input ? input.value.trim() : "-";
    });

    // 4. Ekstrak Baris Data
    const tbody = document.getElementById("data-grid-body");
    const rows = Array.from(tbody.children).map(tr => {
        return Array.from(tr.children).slice(1).map(td => td.innerText.trim());
    });

    try {
        const res = await fetch(`${API_BASE}/tables/${tableId}/csv/save`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ headers, units, years, rows })
        });
        
        Swal.close();

        if (res.ok) {
            showToast("success", "Berhasil", "Perubahan tabel berhasil disimpan secara permanen.", 2000);
            // Beralih kembali ke mode preview
            previewCsv(tableId, editorState.tableName);
        } else {
            const err = await res.json();
            showToast("error", "Gagal", err.detail || "Gagal menyimpan data tabel");
        }
    } catch (e) {
        Swal.close();
        showToast("error", "Error", e.message);
    }
}

// Menukar baris dan kolom tabel secara lokal di editor
function transposeCsvLocal() {
    // 1. Ekstrak data saat ini dari DOM
    const theadTr = document.getElementById("data-grid-head").querySelector("tr");
    if (!theadTr) return;

    const currentHeaders = Array.from(theadTr.children).slice(1).map(th => {
        const input = th.querySelector(".header-name-input");
        return input ? input.value.trim() : "";
    });

    const currentUnits = Array.from(theadTr.children).slice(1).map(th => {
        const input = th.querySelector(".header-unit-input");
        return input ? input.value.trim() : "-";
    });

    const currentYears = Array.from(theadTr.children).slice(1).map(th => {
        const input = th.querySelector(".header-year-input");
        return input ? input.value.trim() : "-";
    });

    const tbody = document.getElementById("data-grid-body");
    const currentRows = Array.from(tbody.children).map(tr => {
        return Array.from(tr.children).slice(1).map(td => td.innerText.trim());
    });

    if (currentHeaders.length === 0 || currentRows.length === 0) {
        showToast("warning", "Peringatan", "Tidak ada data untuk ditranspose.");
        return;
    }

    // 2. Lakukan transpose data
    const newHeaders = [];
    const newUnits = [];
    const newYears = [];
    const newRows = [];

    // Header kolom pertama yang baru
    newHeaders.push(currentHeaders[0] || "Kecamatan / Kategori");
    newUnits.push(currentUnits[0] || "-");
    newYears.push(currentYears[0] || "-");

    // Baris pertama kolom pertama dari row-row lama akan menjadi header baru
    currentRows.forEach(row => {
        const cellVal = row[0] || "";
        // Ekstrak Metadata Satuan/Tahun dari nama baris jika ada (misal: "Produksi Listrik (KWh, 2025)")
        let parsedName = cellVal;
        let parsedUnit = "-";
        let parsedYear = "-";

        const matchParentheses = cellVal.match(/\(([^)]+)\)$/);
        if (matchParentheses) {
            const content = matchParentheses[1].trim();
            parsedName = cellVal.replace(/\s*\([^)]+\)$/, "").trim();
            
            const parts = content.split(",").map(p => p.trim());
            if (parts.length === 2) {
                parsedUnit = parts[0];
                parsedYear = parts[1];
            } else if (parts.length === 1) {
                if (/^\d{4}$/.test(parts[0])) {
                    parsedYear = parts[0];
                } else {
                    parsedUnit = parts[0];
                }
            }
        }

        newHeaders.push(parsedName);
        newUnits.push(parsedUnit);
        newYears.push(parsedYear);
    });

    // Buat data baris baru
    // Setiap baris baru mewakili satu kolom data lama (mulai dari indeks 1)
    for (let colIdx = 1; colIdx < currentHeaders.length; colIdx++) {
        const newRow = [];
        // Sel pertama adalah nama header lama
        let oldHeaderName = currentHeaders[colIdx];
        let oldUnit = currentUnits[colIdx];
        let oldYear = currentYears[colIdx];
        let suffix = "";
        if (oldUnit && oldUnit !== "-" && oldUnit.toLowerCase() !== "satuan") suffix += oldUnit;
        if (oldYear && oldYear !== "-" && oldYear.toLowerCase() !== "tahun") suffix += suffix ? `, ${oldYear}` : oldYear;
        
        let label = oldHeaderName;
        if (suffix) {
            label += ` (${suffix})`;
        }
        newRow.push(label);

        // Sel berikutnya adalah data dari baris-baris lama pada kolom tersebut
        currentRows.forEach(row => {
            newRow.push(row[colIdx] || "");
        });

        newRows.push(newRow);
    }

    // 3. Re-render Grid DOM dengan data baru yang sudah ditranspose (dalam mode edit)
    const thead = document.getElementById("data-grid-head");
    thead.innerHTML = `<tr>
        <th class="th-action-col" style="vertical-align: middle; text-align: center;">Aksi Baris</th>
        ${newHeaders.map((h, idx) => {
            const unit = newUnits[idx] || "";
            const year = newYears[idx] || "";
            return `
            <th class="editable-header-wrapper" style="min-width: 170px; padding: 0.75rem 0.5rem; text-align: left; border-bottom: 2px solid #cbd5e1; background: #f8fafc;">
                <div style="margin-bottom: 6px;">
                    <label style="font-size: 0.68rem; font-weight: 700; color: #64748b; display: block; margin-bottom: 2px;">NAMA KOLOM</label>
                    <input type="text" class="header-name-input" value="${h}" onchange="onHeaderNameChange(${idx}, this.value)" style="width: 100%; padding: 4px 6px; font-size: 0.8rem; font-weight: 600; border-radius: 4px; border: 1px solid #cbd5e1; outline:none; font-family: 'Inter', sans-serif;">
                </div>
                <div style="display: flex; gap: 4px; margin-bottom: 8px;">
                    <div style="flex: 1;">
                        <label style="font-size: 0.65rem; font-weight: 700; color: #64748b; display: block; margin-bottom: 2px;">SATUAN</label>
                        <input type="text" class="header-unit-input" value="${unit}" onchange="updateCsvUnitLocal(${idx}, this.value)" placeholder="e.g. Jiwa" style="width: 100%; padding: 3px 6px; font-size: 0.75rem; border-radius: 4px; border: 1px solid #cbd5e1; outline:none; font-family: 'Inter', sans-serif; background: white;">
                    </div>
                    <div style="width: 65px;">
                        <label style="font-size: 0.65rem; font-weight: 700; color: #64748b; display: block; margin-bottom: 2px;">TAHUN</label>
                        <input type="text" class="header-year-input" value="${year}" onchange="updateCsvYearLocal(${idx}, this.value)" placeholder="e.g. 2025" style="width: 100%; padding: 3px 6px; font-size: 0.75rem; border-radius: 4px; border: 1px solid #cbd5e1; outline:none; font-family: 'Inter', sans-serif; background: white;">
                    </div>
                </div>
                <div style="display: flex; gap: 4px; justify-content: center; padding-top: 6px; border-top: 1px dashed #e2e8f0;">
                    <button onclick="insertCsvColBelowLocal(${idx})" class="btn-row-insert" style="padding: 3px 8px; font-size: 0.72rem; border-radius: 4px; border: 1px solid #cbd5e1; background: #f1f5f9; color: #475569; cursor: pointer; transition: all 0.15s;" onmouseenter="this.style.background='#e2e8f0'; this.style.color='#1e293b'" onmouseleave="this.style.background='#f1f5f9'; this.style.color='#475569'">Sisip</button>
                    <button onclick="deleteCsvColumnLocal(${idx})" class="btn-row-del" style="padding: 3px 8px; font-size: 0.72rem; border-radius: 4px; border: 1px solid #fca5a5; background: #fee2e2; color: #b91c1c; cursor: pointer; transition: all 0.15s;" onmouseenter="this.style.background='#fecaca'; this.style.color='#991b1b'" onmouseleave="this.style.background='#fee2e2'; this.style.color='#b91c1c'">Hapus</button>
                </div>
            </th>`;
        }).join("")}
    </tr>`;

    tbody.innerHTML = "";
    newRows.forEach((row, rowIndex) => {
        const tr = document.createElement("tr");
        tr.id = `csv-row-${rowIndex}`;

        let html = `<td><div class="row-action-cell">
            <button onclick="insertCsvRowBelowLocal(${rowIndex})" class="btn-row-insert" title="Sisipkan baris baru di bawah baris ini">Sisip</button>
            <button onclick="deleteCsvRowLocal(${rowIndex})" class="btn-row-del">Hapus</button>
        </div></td>`;

        row.forEach(cell => {
            html += `<td class="editable-cell" contenteditable="true" onkeydown="if(event.key === 'Enter') { event.preventDefault(); this.blur(); }">${cell != null ? cell : ""}</td>`;
        });

        tr.innerHTML = html;
        tbody.appendChild(tr);
    });

    showToast('success', 'Sukses', 'Tabel berhasil ditranspose secara lokal. Tekan "Simpan Perubahan" untuk menyimpan perubahan secara permanen.', 2000);
}

// Membatalkan pengeditan CSV (tanpa simpan, reload data asli)
function cancelCsvEditMode(tableId, tableName) {
    Swal.fire({
        title: 'Batalkan Pengeditan?',
        text: "Semua perubahan data yang belum disimpan akan hilang.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#cbd5e1',
        confirmButtonText: 'Ya, Batalkan',
        cancelButtonText: 'Kembali Edit'
    }).then((result) => {
        if (result.isConfirmed) {
            previewCsv(tableId, tableName);
        }
    });
}

// ==========================================
// TIME SERIES LOGIC
// ==========================================

let currentTimeSeriesData = null;
let tsTooltipEnabled = true;
let tsGrowthBadgeEnabled = true;
window.tsGrowthBadgeEnabled = true;
let tsShowSources = false;
let lastTimeSeriesSearchParams = null;
let currentMatchedTables = []; // Simpan daftar tabel yang cocok untuk dipilih user
let currentSelectedTableIdx = 0;

// Helper parsing angka Indonesia ke float
function parseIndoNumberToFloat(valStr) {
    if (!valStr) return null;
    let s = String(valStr).trim().replace(/\s/g, '');
    if (!s || s === '-' || s === '...') return null;
    s = s.replace(/[^\d,\.-]/g, '');
    if (!s) return null;
    
    if (s.includes('.') && s.includes(',')) {
        if (s.indexOf('.') < s.indexOf(',')) {
            s = s.replace(/\./g, '').replace(',', '.');
        } else {
            s = s.replace(/,/g, '').replace('.', '.');
        }
    } else if (s.includes(',')) {
        s = s.replace(',', '.');
    } else if (s.includes('.')) {
        if (s.split('.').length - 1 > 1) {
            const parts = s.split('.');
            if (parts[parts.length - 1].length <= 2 && parts.slice(0, -1).every(p => p.length <= 3)) {
                s = parts.slice(0, -1).join('') + '.' + parts[parts.length - 1];
            } else {
                s = s.replace(/\./g, '');
            }
        } else {
            const parts = s.split('.');
            if (parts.length === 2 && parts[1].length === 3 && parts[0] !== '0') {
                s = s.replace(/\./g, '');
            }
        }
    }
    const f = parseFloat(s);
    return isNaN(f) ? null : f;
}

let tsActiveUnitKey = null;

// ==========================================
// UNIVERSAL UNIT CONVERTER ENGINE (SIPEDAS)
// ==========================================

const UNIVERSAL_UNIT_FAMILIES = {
    // 1. Berat & Hasil Produksi (Base: ton)
    weight: {
        baseUnit: 'ton',
        displayName: 'Berat / Massa',
        units: {
            'ton': { label: 'Ton', btnLabel: 'Ton', factor: 1, isInteger: false, maxDecimals: 2 },
            'kuintal': { label: 'Kuintal', btnLabel: 'Kuintal (kw)', factor: 10, isInteger: false, maxDecimals: 2 },
            'kg': { label: 'Kg', btnLabel: 'Kilogram (kg)', factor: 1000, isInteger: true, maxDecimals: 0 },
            'gram': { label: 'Gram', btnLabel: 'Gram (g)', factor: 1000000, isInteger: true, maxDecimals: 0 }
        },
        triggers: ['ton', 'kg', 'kilogram', 'kuintal', 'kw', 'gram', 'daging', 'ternak', 'produksi', 'padi', 'palawija', 'ikan', 'sampah', 'kedelai', 'jagung', 'sayuran', 'buah', 'hasil perkebunan']
    },
    // 2. Kependudukan & Sosial (Base: jiwa / orang)
    population: {
        baseUnit: 'jiwa',
        displayName: 'Populasi / Jiwa',
        units: {
            'jiwa': { label: 'Jiwa', btnLabel: 'Jiwa / Orang', factor: 1, isInteger: true, maxDecimals: 0 },
            'juta_jiwa': { label: 'Juta Jiwa', btnLabel: 'Juta Jiwa', factor: 0.000001, isInteger: false, maxDecimals: 3 }
        },
        triggers: ['jiwa', 'orang', 'penduduk', 'miskin', 'murid', 'siswa', 'guru', 'dokter', 'pasien', 'pekerja', 'angkatan kerja', 'pengangguran', 'peserta', 'santri', 'balita', 'lansia']
    },
    // 3. Keuangan & Ekonomi (Base: rupiah)
    currency: {
        baseUnit: 'rupiah',
        displayName: 'Nilai Keuangan (Rupiah)',
        units: {
            'rupiah': { label: 'Rp', btnLabel: 'Rupiah (Rp)', factor: 1, isInteger: true, maxDecimals: 0 },
            'juta_rp': { label: 'Juta Rp', btnLabel: 'Juta Rupiah', factor: 0.000001, isInteger: false, maxDecimals: 2 },
            'miliar_rp': { label: 'Miliar Rp', btnLabel: 'Miliar Rupiah', factor: 0.000000001, isInteger: false, maxDecimals: 2 },
            'triliun_rp': { label: 'Triliun Rp', btnLabel: 'Triliun Rupiah', factor: 0.000000000001, isInteger: false, maxDecimals: 2 }
        },
        triggers: ['rupiah', 'rp', 'pendapatan', 'belanja', 'pdrb', 'anggaran', 'nilai produksi', 'upah', 'gaji', 'modal', 'omset', 'investasi', 'penerimaan']
    },
    // 4. Luas Wilayah & Lahan (Base: ha)
    area: {
        baseUnit: 'ha',
        displayName: 'Luas Lahan / Wilayah',
        units: {
            'ha': { label: 'Ha', btnLabel: 'Hektar (ha)', factor: 1, isInteger: false, maxDecimals: 2 },
            'km2': { label: 'km²', btnLabel: 'km²', factor: 0.01, isInteger: false, maxDecimals: 3 },
            'm2': { label: 'm²', btnLabel: 'm²', factor: 10000, isInteger: true, maxDecimals: 0 }
        },
        triggers: ['ha', 'hektar', 'm2', 'm²', 'km2', 'km²', 'luas', 'wilayah', 'lahan', 'panen', 'tanah', 'sawah', 'hutan']
    },
    // 5. Volume & Cairan (Base: liter)
    volume: {
        baseUnit: 'liter',
        displayName: 'Volume / Debit',
        units: {
            'liter': { label: 'Liter', btnLabel: 'Liter (l)', factor: 1, isInteger: true, maxDecimals: 0 },
            'm3': { label: 'm³', btnLabel: 'Meter Kubik (m³)', factor: 0.001, isInteger: false, maxDecimals: 2 },
            'juta_liter': { label: 'Juta Liter', btnLabel: 'Juta Liter', factor: 0.000001, isInteger: false, maxDecimals: 3 }
        },
        triggers: ['liter', 'm3', 'm³', 'debit', 'air bersih', 'air minum', 'bbm', 'solar', 'bensin', 'limbah cair', 'minyak']
    },
    // 6. Jarak & Panjang (Base: km)
    distance: {
        baseUnit: 'km',
        displayName: 'Panjang / Jarak',
        units: {
            'km': { label: 'Km', btnLabel: 'Kilometer (km)', factor: 1, isInteger: false, maxDecimals: 2 },
            'meter': { label: 'Meter', btnLabel: 'Meter (m)', factor: 1000, isInteger: true, maxDecimals: 0 }
        },
        triggers: ['km', 'meter', 'm', 'panjang jalan', 'jarak']
    },
    // 7. Cacah Unit / Ekor / Pohon (Base: unit)
    count: {
        baseUnit: 'unit',
        displayName: 'Jumlah Unit / Ekor',
        units: {
            'unit': { label: 'Unit', btnLabel: 'Unit / Ekor', factor: 1, isInteger: true, maxDecimals: 0 },
            'ribu_unit': { label: 'Ribu Unit', btnLabel: 'Ribu Unit', factor: 0.001, isInteger: false, maxDecimals: 2 },
            'juta_unit': { label: 'Juta Unit', btnLabel: 'Juta Unit', factor: 0.000001, isInteger: false, maxDecimals: 3 }
        },
        triggers: ['ekor', 'pohon', 'unit', 'buah', 'batang', 'kendaraan', 'populasi ternak']
    }
};

function detectUnitFamily(unitStr, indicatorName, tableName) {
    const combined = `${unitStr || ''} ${indicatorName || ''} ${tableName || ''}`.toLowerCase();
    
    // Satuan tetap (non-konversi)
    if (combined.includes('%') || combined.includes('persen') || combined.includes('ipm') || combined.includes('indeks') || combined.includes('rasio') || combined.includes('/km')) {
        return null;
    }
    
    for (const [familyKey, family] of Object.entries(UNIVERSAL_UNIT_FAMILIES)) {
        for (const trigger of family.triggers) {
            const regex = new RegExp(`\\b${trigger}\\b`, 'i');
            if (regex.test(combined)) {
                return familyKey;
            }
        }
    }
    return null;
}

function formatWithUnitScale(numVal, unitConfig) {
    if (numVal === null || numVal === undefined || isNaN(numVal)) return '-';
    if (!unitConfig) return numVal.toLocaleString('id-ID');
    
    const scaled = numVal * (unitConfig.factor != null ? unitConfig.factor : 1);
    if (unitConfig.isInteger && scaled === Math.round(scaled)) {
        return Math.round(scaled).toLocaleString('id-ID');
    }
    const dec = unitConfig.maxDecimals != null ? unitConfig.maxDecimals : 2;
    return scaled.toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: dec });
}

function renderUnitConverterBar(checkedVKs) {
    const container = document.getElementById('ts-unit-converter-container');
    const btnGroup = document.getElementById('ts-unit-btn-group');
    const badge = document.getElementById('ts-unit-current-badge');
    if (!container || !btnGroup) return;

    if (!currentTimeSeriesData || !checkedVKs || checkedVKs.length === 0) {
        container.style.setProperty('display', 'none', 'important');
        return;
    }

    const firstVk = checkedVKs[0];
    const vkUnit = (currentTimeSeriesData.vkUnits && currentTimeSeriesData.vkUnits[firstVk]) || '';
    const familyKey = detectUnitFamily(vkUnit, firstVk, typeof tsCurrentKeyword !== 'undefined' ? tsCurrentKeyword : '');

    if (!familyKey || !UNIVERSAL_UNIT_FAMILIES[familyKey]) {
        container.style.setProperty('display', 'none', 'important');
        tsActiveUnitKey = null;
        return;
    }

    const family = UNIVERSAL_UNIT_FAMILIES[familyKey];
    if (!tsActiveUnitKey || !family.units[tsActiveUnitKey]) {
        tsActiveUnitKey = family.baseUnit;
    }

    let buttonsHtml = '';
    for (const [unitKey, unitCfg] of Object.entries(family.units)) {
        const isActive = (unitKey === tsActiveUnitKey);
        buttonsHtml += `
            <button type="button" class="btn btn-sm ${isActive ? 'btn-primary' : 'btn-outline-primary'}" 
                onclick="switchTimeSeriesUnit('${unitKey}')" style="font-size:0.8rem; padding:3px 12px; font-weight:${isActive ? '600' : '500'};">
                ${unitCfg.btnLabel || unitCfg.label}
            </button>
        `;
    }
    btnGroup.innerHTML = buttonsHtml;
    if (badge) {
        const curLabel = family.units[tsActiveUnitKey]?.label || tsActiveUnitKey;
        badge.textContent = `Satuan Aktif: ${curLabel}`;
    }
    container.style.removeProperty('display');
    container.style.display = 'flex';
}

function switchTimeSeriesUnit(targetUnitKey) {
    tsActiveUnitKey = targetUnitKey;
    if (typeof tsRenderCallback === 'function') {
        tsRenderCallback();
    }
}

// Deteksi kesalahan format penulisan angka pada sel (koma vs titik, spasi, karakter rusak)
function checkClientCellFormatAnomaly(rawVal, prevRawVal = null) {
    const s = String(rawVal || '').trim();
    if (!s || ['-', '...', '–', '—', ''].includes(s)) return null;

    const C3 = /^[1-9]\d{0,2},\d{3}$/;  // comma-3: x,xxx (bukan 0,xxx yang jelas desimal)
    const P3 = /^\d{1,3}\.\d{3}$/;      // period-3: x.xxx
    const PD = /^\d+\.\d{1,2}$/;        // period-desimal: x.xx / x.x
    const CD = /^\d+,\d{1,2}$/;         // comma-desimal: x,xx / x,x

    // 1. Karakter Rusak / Tanda Tanya
    if (s.includes('?') || s.includes('..') || s.includes(',,')) {
        return `Karakter/simbol rusak pada angka (${s})`;
    }
    // 2. Spasi Pemisah Ribuan (OCR Glitch e.g. '3 125')
    if (/^\d{1,3}\s+\d{3}/.test(s)) {
