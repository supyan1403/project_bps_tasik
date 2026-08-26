// ===================== EDITOR STATE =====================
let editorState = {
    tableId: null,
    tableName: '',
    mode: 'csv-view' // 'csv-view', 'csv-edit', or 'db'
};
let previousActivePageId = 'tabel';

// ===================== ROLE ACCESS CONTROL =====================
function checkRoleAccess(targetPage) {
    const adminPages = ['publikasi', 'import', 'tabel', 'editor', 'admin'];
    const currentRole = window.currentUserRole || "pegawai";
    if (adminPages.includes(targetPage) && currentRole !== 'admin') {
        const titles = {
            publikasi: 'Ekstraksi PDF',
            import: 'Import Excel',
            tabel: 'Data Tabel',
            editor: 'Editor Data Tabel',
            admin: 'Manajemen Database'
        };
        Swal.fire({
            title: 'Akses Dibatasi',
            html: `Halaman <b>${titles[targetPage] || targetPage}</b> hanya dapat diakses oleh akun <b>Admin SIPEDAS</b>.<br><small class="text-muted">Role Anda saat ini: <b>Operator SIPEDAS</b>. Silakan login sebagai Admin SIPEDAS di sidebar jika Anda adalah Administrator.</small>`,
            icon: 'warning',
            confirmButtonColor: '#4f46e5',
            confirmButtonText: 'Mengerti'
        });
        return false;
    }
    return true;
}

// ===================== NAVIGATION =====================
function navigate(pageId, element) {
    // Validasi Akses Role Sistem (Pegawai BPS vs Admin)
    if (!checkRoleAccess(pageId)) return;

    // Jika sedang dalam mode edit dan mencoba keluar dari editor, minta konfirmasi
    if (editorState && editorState.mode === 'csv-edit' && pageId !== 'editor') {
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
                editorState.mode = 'csv-view'; // Reset mode agar bisa berpindah
                navigate(pageId, element);
            }
        });
        return;
    }

    document.querySelectorAll('.page-section').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-link').forEach(el => el.classList.remove('active'));

    const page = document.getElementById(`page-${pageId}`);
    if (page) page.classList.add('active');
    if (element) element.classList.add('active');

    // Sembunyikan nav editor jika keluar dari editor
    if (pageId !== 'editor') {
        // Reset editor state
        editorState.mode = 'csv-view';
    }

    // Scroll ke atas
    const mc = document.querySelector('.main-content');
    if (mc) mc.scrollTop = 0;

    if (pageId === 'dashboard') loadDashboardStats();
    if (pageId === 'publikasi') loadDocuments();
    if (pageId === 'import') loadImportExcelPage();
    if (pageId === 'timeseries') initTimeSeriesWizard();
}

/** Navigate to the full-page editor. Mode: 'csv' or 'db' */
function navigateToEditor(tableId, tableName, mode = 'csv') {
    // Validasi Akses Role Sistem
    if (!checkRoleAccess('editor')) return;
    editorState = { tableId, tableName, mode };

    // Record the current active page before changing to editor
    const activeSection = document.querySelector('.page-section.active');
    if (activeSection && activeSection.id !== 'page-editor') {
        previousActivePageId = activeSection.id.replace('page-', '');
    }

    // Show editor page & set mode class
    document.querySelectorAll('.page-section').forEach(el => el.classList.remove('active'));
    const pe = document.getElementById('page-editor');
    if (pe) {
        pe.classList.add('active');
        pe.classList.remove('mode-view', 'mode-edit');
        pe.classList.add(mode === 'csv-edit' ? 'mode-edit' : 'mode-view');
    }

    // Scroll to top
    const mc = document.querySelector('.main-content');
    if (mc) mc.scrollTop = 0;

    // Set title + badge
    let cleanName = formatCleanTableName(tableName);
    let pageText = '';
    const pageMatch = tableName.match(/\s*(\([Hh]al.*?\))\s*$/i);
    if (pageMatch) { pageText = pageMatch[1]; }

    // Pisahkan nomor tabel (e.g. Tabel 1.1.1 atau 1.1.1) dari nama tabel
    let displayNum = '';
    let displayNameOnly = cleanName;
    const numMatch = cleanName.match(/^(Tabel[\s_]*\d+(?:\.\d+)*\s*|^\d+(?:\.\d+)+\s*)(?:-\s*|:\s*|)/i);
    if (numMatch) {
        displayNum = numMatch[1].trim();
        displayNameOnly = cleanName.substring(numMatch[0].length).trim();
    }

    const tableNumEl = document.getElementById('editor-table-number');
    if (tableNumEl) {
        tableNumEl.value = displayNum;
        tableNumEl.style.display = 'inline-block';
    }

    const titleEl = document.getElementById('editor-title');
    if (titleEl) {
            const pageTag = document.getElementById('editor-page-tag');
    if (pageTag) {
        pageTag.textContent = '';
        pageTag.style.display = 'none';
    }
        titleEl.value = displayNameOnly;
    }

    const badge = document.getElementById('editor-mode-badge');
    if (badge) {
        if (mode === 'csv-view') {
            badge.textContent = 'Lihat Data';
            badge.className = 'editor-mode-badge badge-csv-view';
        } else if (mode === 'csv-edit') {
            badge.textContent = 'Edit Data';
            badge.className = 'editor-mode-badge badge-csv';
        } else {
            badge.textContent = 'Mode Database';
            badge.className = 'editor-mode-badge badge-db';
        }
    }

    // Atur status editability judul & numbering berdasarkan mode
    const isReadOnly = (mode === 'csv-view');
    const containers = document.querySelectorAll('.editable-input-container');
    const tableNumInput = document.getElementById('editor-table-number');
    const titleInput = document.getElementById('editor-title');

    if (tableNumInput) tableNumInput.readOnly = isReadOnly;
    if (titleInput) titleInput.readOnly = isReadOnly;

    containers.forEach(container => {
        const icon = container.querySelector('span');
        if (isReadOnly) {
            container.style.border = 'none';
            container.style.background = 'transparent';
            container.setAttribute('onmouseenter', '');
            container.setAttribute('onmouseleave', '');
            if (icon) icon.style.display = 'none';
        } else {
            container.style.border = '1px dashed #cbd5e1';
            container.style.background = '#fafafa';
            container.setAttribute('onmouseenter', "this.style.borderColor='#4F46E5'; this.style.background='#ffffff';");
            container.setAttribute('onmouseleave', "this.style.borderColor='#cbd5e1'; this.style.background='#fafafa';");
            if (icon) icon.style.display = 'inline';
        }
    });
}

async function saveTableIdentityInline() {
    const tableId = editorState.tableId;
    if (!tableId) return;

    const numVal = document.getElementById('editor-table-number')?.value?.trim() || '';
    const titleVal = document.getElementById('editor-title')?.value?.trim() || '';

    if (!titleVal) {
        return; // Jangan simpan jika judul kosong
    }

    const fullNewName = numVal ? `${numVal} - ${titleVal}` : titleVal;
    if (fullNewName === editorState.tableName) return; // tidak ada perubahan

    try {
        const res = await fetch(`${API_BASE}/tables/${tableId}/rename`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ new_name: fullNewName })
        });
        if (res.ok) {
            editorState.tableName = fullNewName;
        } else {
            const errData = await res.json();
            showToast("error", "Gagal", `Gagal menyimpan nama tabel: ${errData.detail || 'Terjadi kesalahan'}`);
        }
    } catch(e) {
        console.error("Gagal menyimpan identitas tabel", e);
        showToast("error", "Error", "Terjadi kesalahan jaringan saat menyimpan nama tabel.");
    }
}

/** Go back to the table browser page or cancel edit mode */
function backToTableList() {
    if (editorState.mode === 'csv-edit') {
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
                // Kembalikan ke mode Lihat (Preview)
                previewCsv(editorState.tableId, editorState.tableName);
            }
        });
        return;
    }

    // Arahkan kembali ke halaman asal (riwayat sebelumnya)
    const targetPageId = previousActivePageId || 'tabel';
    const navEl = document.getElementById(`nav-${targetPageId}`);
    
    navigate(targetPageId, navEl);
}

/** Refresh current editor without re-navigating */
function refreshEditor() {
    if (editorState.mode === 'csv-view') {
        _loadCsvIntoEditor(editorState.tableId, editorState.tableName, false);
    } else if (editorState.mode === 'csv-edit') {
        _loadCsvIntoEditor(editorState.tableId, editorState.tableName, true);
    } else {
        _loadDbIntoEditor(editorState.tableId, editorState.tableName);
    }
}

/** Build the toolbar */
function buildEditorToolbar(tableId, tableName, mode) {
    const toolbar = document.getElementById('editor-toolbar');
    if (!toolbar) return;
    const tn = tableName.replace(/'/g, "\\'");
    if (mode === 'csv-view') {
        toolbar.innerHTML = `
            <div style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap; width:100%;">
                <!-- Tombol Kembali -->
                <button onclick="backToTableList()" class="btn btn-sm btn-light border d-inline-flex align-items-center gap-1" style="font-weight:600; font-size:0.8rem; padding:5px 12px; border-radius:6px; color:#334155; background:#f8fafc; border-color:#cbd5e1 !important;" title="Kembali ke Daftar Tabel">
                    <i class="bi bi-arrow-left"></i> Kembali
                </button>
                
                <!-- Tombol Navigasi Prev / Next -->
                <div id="nav-buttons" class="btn-group" role="group">
                    <button id="btn-prev" onclick="navigateTable('prev')" class="btn btn-sm btn-light border d-inline-flex align-items-center gap-1" style="font-weight:600; font-size:0.8rem; padding:5px 10px; color:#475569; background:#f8fafc; border-color:#cbd5e1 !important;" title="Tabel Sebelumnya">
                        <i class="bi bi-chevron-left"></i> Prev
                    </button>
                    <button id="btn-next" onclick="navigateTable('next')" class="btn btn-sm btn-light border d-inline-flex align-items-center gap-1" style="font-weight:600; font-size:0.8rem; padding:5px 10px; color:#475569; background:#f8fafc; border-color:#cbd5e1 !important; border-left:none;" title="Tabel Selanjutnya">
                        Next <i class="bi bi-chevron-right"></i>
                    </button>
                </div>
                
                <div class="vr mx-1 my-auto" style="height:20px; opacity:0.25;"></div>

                <!-- Export Buttons Group -->
                <div class="btn-group" role="group">
                    <button onclick="downloadExcel(${tableId})" class="btn btn-sm btn-light border d-inline-flex align-items-center gap-1" style="font-weight:600; font-size:0.8rem; padding:5px 11px; color:#15803d; background:#f0fdf4; border-color:#bbf7d0 !important;" title="Unduh format Microsoft Excel (.xlsx)">
                        <i class="bi bi-file-earmark-excel-fill"></i> Excel (.xlsx)
                    </button>
                    <button onclick="downloadCsv(${tableId})" class="btn btn-sm btn-light border d-inline-flex align-items-center gap-1" style="font-weight:600; font-size:0.8rem; padding:5px 11px; color:#475569; background:#f8fafc; border-color:#cbd5e1 !important; border-left:none;" title="Unduh format CSV">
                        <i class="bi bi-filetype-csv"></i> CSV
                    </button>
                </div>
                
                <div class="vr mx-1 my-auto" style="height:20px; opacity:0.25;"></div>

                <!-- Analisis Deret Waktu -->
                <button onclick="openTimeSeriesForTable(${tableId}, '${tn}')" class="btn btn-sm btn-light border d-inline-flex align-items-center gap-1" style="font-weight:600; font-size:0.8rem; padding:5px 11px; border-radius:6px; color:#b45309; background:#fffbeb; border-color:#fde68a !important;" title="Buka analisis grafik deret waktu">
                    <i class="bi bi-graph-up-arrow"></i> Deret Waktu
                </button>
                
                <!-- Beralih ke Edit Data -->
                <button onclick="switchToCsvEdit(${tableId}, '${tn}')" class="btn btn-sm btn-primary d-inline-flex align-items-center gap-1" style="font-weight:600; font-size:0.8rem; padding:5px 14px; border-radius:6px; box-shadow: 0 1px 3px rgba(79, 70, 229, 0.25);" title="Beralih ke mode pengeditan data">
                    <i class="bi bi-pencil-square"></i> Edit Data
                </button>

                <!-- Status Badge -->
                <span style="margin-left:auto; font-size:0.8rem; display:flex; align-items:center; gap:6px;">
                    <span class="badge bg-light text-secondary border" style="font-size:0.75rem; padding:5px 10px; font-weight:600; background:#f8fafc; border-color:#e2e8f0 !important;">
                        <i class="bi bi-eye me-1"></i> Mode Lihat (Baca Saja)
                    </span>
                </span>
            </div>
        `;
        fetchTableNeighbors(tableId);
    } else if (mode === 'csv-edit') {
        toolbar.innerHTML = `
            <div style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap; width:100%;">
                <!-- Action Back / Cancel -->
                <button onclick="backToTableList()" class="btn btn-sm btn-light border border-danger-subtle text-danger d-inline-flex align-items-center gap-1" style="font-weight:600; font-size:0.8rem; padding:5px 12px; border-radius:6px; background:#fef2f2;" title="Kembali ke daftar tanpa menyimpan">
                    <i class="bi bi-x-circle-fill"></i> Batal / Kembali
                </button>
                
                <div class="vr mx-1 my-auto" style="height:20px; opacity:0.25;"></div>

                <!-- Export Group -->
                <div class="btn-group" role="group">
                    <button onclick="downloadExcel(${tableId})" class="btn btn-sm btn-light border d-inline-flex align-items-center gap-1" style="font-weight:600; font-size:0.8rem; padding:5px 10px; color:#15803d; background:#f0fdf4; border-color:#bbf7d0 !important;" title="Unduh Excel">
                        <i class="bi bi-file-earmark-excel-fill"></i> Excel
                    </button>
                    <button onclick="downloadCsv(${tableId})" class="btn btn-sm btn-light border d-inline-flex align-items-center gap-1" style="font-weight:600; font-size:0.8rem; padding:5px 10px; color:#475569; background:#f8fafc; border-color:#cbd5e1 !important; border-left:none;" title="Unduh CSV">
                        <i class="bi bi-filetype-csv"></i> CSV
                    </button>
                </div>
                
                <div class="vr mx-1 my-auto" style="height:20px; opacity:0.25;"></div>

                <!-- Transform & Master Group -->
                <button onclick="transposeCsvLocal()" class="btn btn-sm btn-light border d-inline-flex align-items-center gap-1" style="font-weight:600; font-size:0.8rem; padding:5px 10px; border-radius:6px; color:#b45309; background:#fffbeb; border-color:#fde68a !important;" title="Tukar baris dan kolom tabel">
                    <i class="bi bi-arrow-left-right"></i> Transpose
                </button>
                <button onclick="renameHeadersToMaster(${tableId}, '${tn}')" class="btn btn-sm btn-light border d-inline-flex align-items-center gap-1" style="font-weight:600; font-size:0.8rem; padding:5px 10px; border-radius:6px; color:#4338ca; background:#eef2ff; border-color:#c7d2fe !important;" title="Ganti header sesuai master kolom">
                    <i class="bi bi-pencil-square"></i> Nama Master
                </button>
                <button onclick="matchColumnsToMaster(${tableId}, '${tn}')" class="btn btn-sm btn-light border d-inline-flex align-items-center gap-1" style="font-weight:600; font-size:0.8rem; padding:5px 10px; border-radius:6px; color:#0e7490; background:#ecfeff; border-color:#a5f3fc !important;" title="Cocokkan header secara otomatis ke master kolom">
                    <i class="bi bi-stars"></i> Cocokkan Master
                </button>
                <button onclick="addColFromMaster(${tableId}, '${tn}')" class="btn btn-sm btn-light border d-inline-flex align-items-center gap-1" style="font-weight:600; font-size:0.8rem; padding:5px 10px; border-radius:6px; color:#334155; background:#f1f5f9; border-color:#cbd5e1 !important;" title="Daftarkan kolom tabel ini ke master">
                    <i class="bi bi-clipboard-plus"></i> Daftarkan Master
                </button>
                
                <!-- Save Changes Button -->
                <button onclick="saveCsvChangesToServer(${tableId})" class="btn btn-sm btn-success d-inline-flex align-items-center gap-1 ms-auto" style="font-weight:700; font-size:0.82rem; padding:5px 16px; border-radius:6px; box-shadow: 0 1px 3px rgba(16, 185, 129, 0.3);">
                    <i class="bi bi-check2-circle"></i> Simpan Perubahan
                </button>
            </div>
        `;
    } else {
        toolbar.innerHTML = `
            <button onclick="backToTableList()" class="btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-1" style="font-weight:600; font-size:0.8rem; padding:5px 12px; border-radius:6px;">
                <i class="bi bi-arrow-left"></i> Kembali
            </button>
            <div id="nav-buttons" class="btn-group" role="group" style="margin-left: 8px;">
                <button id="btn-prev" onclick="navigateTable('prev')" class="btn btn-sm btn-outline-secondary" style="font-size:0.8rem; padding:5px 10px;">
                    <i class="bi bi-chevron-left"></i> Prev
                </button>
                <button id="btn-next" onclick="navigateTable('next')" class="btn btn-sm btn-outline-secondary" style="font-size:0.8rem; padding:5px 10px;">
                    Next <i class="bi bi-chevron-right"></i>
                </button>
            </div>
            <button onclick="markAllSafeInTable(${tableId}, '${tn}')" class="btn btn-sm btn-success d-inline-flex align-items-center gap-1" style="font-weight:600; font-size:0.8rem; padding:5px 12px; border-radius:6px;">
                <i class="bi bi-shield-check"></i> Tandai Semua Aman
            </button>
            <span style="margin-left:auto; font-size:0.8rem; color:#94a3b8;">Baris <span style='color:#ef4444;font-weight:700;'>merah</span> = data anomali. Auto-save aktif.</span>
        `;
        fetchTableNeighbors(tableId);
    }
}

let neighbors = { prev_id: null, next_id: null, prev_name: null, next_name: null };

async function fetchTableNeighbors(tableId) {
    try {
        const res = await fetch(`${API_BASE}/tables/${tableId}/neighbors`);
        if (res.ok) {
            neighbors = await res.json();
            const btnPrev = document.getElementById('btn-prev');
            const btnNext = document.getElementById('btn-next');
            
            if (btnPrev) {
                btnPrev.disabled = !neighbors.prev_id;
                btnPrev.title = neighbors.prev_name || '';
                btnPrev.style.opacity = neighbors.prev_id ? '1' : '0.5';
            }
            if (btnNext) {
                btnNext.disabled = !neighbors.next_id;
                btnNext.title = neighbors.next_name || '';
                btnNext.style.opacity = neighbors.next_id ? '1' : '0.5';
            }
        }
    } catch(e) { console.error("Gagal memuat tetangga tabel", e); }
}

function navigateTable(direction) {
    const targetId = (direction === 'prev') ? neighbors.prev_id : neighbors.next_id;
    const targetName = (direction === 'prev') ? neighbors.prev_name : neighbors.next_name;
    
    if (targetId) {
        if (editorState.mode === 'csv-view') {
            previewCsv(targetId, targetName);
        } else if (editorState.mode === 'db') {
            viewDataEditor(targetId, targetName);
        }
        // Note: CSV edit mode saat ini belum didukung navigasi karena perlu simpan perubahan.
    }
}

/** Switch from CSV view mode to CSV edit mode */
function switchToCsvEdit(tableId, tableName) {
    editorState.mode = 'csv-edit';
    const badge = document.getElementById('editor-mode-badge');
    if (badge) { badge.textContent = 'Edit Data'; badge.className = 'editor-mode-badge badge-csv'; }
    buildEditorToolbar(tableId, tableName, 'csv-edit');


    // Update editability status input inline ketika beralih ke mode edit
    const containers = document.querySelectorAll('.editable-input-container');
    const tableNumInput = document.getElementById('editor-table-number');
    const titleInput = document.getElementById('editor-title');

    if (tableNumInput) tableNumInput.readOnly = false;
    if (titleInput) titleInput.readOnly = false;

    containers.forEach(container => {
        const icon = container.querySelector('span');
        container.style.border = '1px dashed #cbd5e1';
        container.style.background = '#fafafa';
        container.setAttribute('onmouseenter', "this.style.borderColor='#4F46E5'; this.style.background='#ffffff';");
        container.setAttribute('onmouseleave', "this.style.borderColor='#cbd5e1'; this.style.background='#fafafa';");
        if (icon) icon.style.display = 'inline';
    });

    _loadCsvIntoEditor(tableId, tableName, true);
}

let dashboardChartInstance = null;

// Page 1: Dashboard Stats
async function backupDatabase() {
    try {
        const res = await fetch(`${API_BASE}/admin/backup`, { method: "POST" });
        if (res.ok) {
            const data = await res.json();
            showToast('success', 'Backup Berhasil', `File: ${data.file}`);
            const base = API_BASE.replace(/\/api\/?$/, '');
            const a = document.createElement('a');
            a.href = `${base}/backups/${encodeURIComponent(data.file)}`;
            a.download = data.file;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        } else {
            const err = await res.json().catch(() => ({}));
            showToast('error', 'Backup Gagal', err.detail || 'Terjadi kesalahan');
        }
    } catch (e) {
        showToast('error', 'Backup Gagal', String(e));
    }
}

function uploadWithProgress(url, formData, barEl, statusEl) {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', url, true);
        xhr.onload = () => {
            if (barEl) { barEl.style.width = '100%'; barEl.classList.remove('progress-bar-animated'); }
            if (statusEl) statusEl.textContent = 'Selesai';
            let payload;
            try { payload = JSON.parse(xhr.responseText); } catch { payload = {}; }
            resolve({ ok: xhr.status >= 200 && xhr.status < 300, status: xhr.status, json: async () => payload });
        };
        xhr.onerror = () => { if (statusEl) statusEl.textContent = 'Error koneksi'; reject(new Error('Network error')); };
        xhr.upload.onprogress = (e) => {
            if (e.lengthComputable && barEl) barEl.style.width = Math.round((e.loaded / e.total) * 100) + '%';
        };
        xhr.send(formData);
    });
}

function setupDropZone(zoneId, inputId, onActivate, allowMultiple = false) {
    const zone = document.getElementById(zoneId);
    const input = document.getElementById(inputId);
    if (!zone || !input) return;
    zone.addEventListener('click', (e) => { if (e.target !== input) input.click(); });
    zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.style.borderColor = '#4f46e5'; zone.style.background = '#eef2ff'; });
    zone.addEventListener('dragleave', () => { zone.style.borderColor = '#cbd5e1'; zone.style.background = '#f8fafc'; });
    zone.addEventListener('drop', (e) => { 
        e.preventDefault(); 
        zone.style.borderColor = '#cbd5e1'; 
        zone.style.background = '#f8fafc'; 
        if (e.dataTransfer.files.length) {
            if (allowMultiple) onActivate(e.dataTransfer.files);
            else onActivate(e.dataTransfer.files[0]);
        }
    });
    input.addEventListener('change', () => { 
        if (input.files.length) {
            if (allowMultiple) onActivate(input.files);
            else onActivate(input.files[0]);
        }
    });
}

async function loadDashboardBackupInfo() {
    const infoEl = document.getElementById('dashboard-backup-info');
    if (!infoEl) return;
    try {
        const res = await fetch(`${API_BASE}/admin/backups`);
        if (!res.ok) throw new Error('Gagal memuat info backup');
        const data = await res.json();
        const files = data.backups || [];
        if (files.length === 0) {
            infoEl.innerHTML = '<span class="text-muted">Belum ada backup.</span>';
            return;
        }
        const latest = files[files.length - 1];
        infoEl.innerHTML = `
            <div class="d-flex flex-wrap gap-3 align-items-center">
                <span class="text-dark fw-medium">📄 ${escHtml(latest.file)}</span>
                <span class="text-muted">Ukuran: <strong>${formatFileSize(latest.size)}</strong></span>
                <span class="text-muted">Tanggal: <strong>${latest.modified}</strong></span>
            </div>
        `;
    } catch (e) {
        infoEl.innerHTML = `<span class="text-danger">Gagal memuat info backup: ${e.message}</span>`;
    }
}

async function loadDashboardStats() {
    const adminView = document.getElementById('dashboard-admin-view');
    const welcomeRoleText = document.getElementById('welcome-role-text');
    
    // Fetch chart data secara paralel di awal agar instan
    const chartDataPromise = fetch(`${API_BASE}/stats/chart`).then(r => r.ok ? r.json() : null).catch(() => null);
    
    // Selalu tampilkan dashboard (hanya ada 1 view sekarang)
    if (adminView) adminView.style.display = 'block';
    
    // Sembunyikan admin-only sections untuk pegawai
    const isAdmin = currentUserRole === 'admin';
    const adminSections = document.querySelectorAll('#dashboard-admin-view .glass-panel, #dashboard-admin-view .alert');
    adminSections.forEach(el => {
        const isAdminOnly = el.id === 'admin-anomalies-panel' || 
                           el.id === 'admin-db-clean-banner' ||
                           el.querySelector('#admin-anomalies-tbody') ||
                           el.querySelector('#admin-recent-tbody') ||
                           el.querySelector('#dashboard-backup-info');
        if (isAdminOnly) {
            el.style.display = isAdmin ? '' : 'none';
        }
    });
    
    if (welcomeRoleText) {
        welcomeRoleText.textContent = isAdmin 
            ? 'Anda masuk sebagai Admin SIPEDAS (Kontrol Penuh).' 
            : 'Anda masuk sebagai Operator SIPEDAS.';
    }

    try {
        const res = await fetch(`${API_BASE}/stats`);
        if(res.ok) {
            const stats = await res.json();
            // Populate 4 kartu ANALITIK DATA ENGINE (ID: stat-*)
            const ptsEl = document.getElementById('stat-total-pts');
            const tablesEl = document.getElementById('stat-total-tables');
            const rowsEl = document.getElementById('stat-total-rows');
            const docsEl = document.getElementById('stat-total-docs');
            if (ptsEl) ptsEl.textContent = (stats.total_data_points || 0).toLocaleString('id-ID');
            if (tablesEl) tablesEl.textContent = (stats.total_tables || 0).toLocaleString('id-ID');
            if (rowsEl) rowsEl.textContent = (stats.total_rows || 0).toLocaleString('id-ID');
            if (docsEl) docsEl.textContent = (stats.total_docs || 0).toLocaleString('id-ID');
        }
        
        // Load anomalies list hanya untuk admin
        if (isAdmin) {
            const anomaliesRes = await fetch(`${API_BASE}/admin/anomalies`);
            const cleanBanner = document.getElementById('admin-db-clean-banner');
