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

            confirmButtonColor: cssVar('--swal-confirm-primary') || cssVar('--indigo-600') || '#4f46e5',

            confirmButtonText: 'Mengerti'

        });

        return false;

    }

    return true;

}



// ===================== NAVIGATION =====================

function navigate(pageId, element) {

    // Tutup mobile sidebar jika terbuka
    const mobileSidebar = document.querySelector('.sidebar.mobile-open');
    if (mobileSidebar) toggleMobileSidebar();

    // Validasi Akses Role Sistem (Pegawai BPS vs Admin)

    if (!checkRoleAccess(pageId)) return;



    // Jika sedang dalam mode edit dan mencoba keluar dari editor, minta konfirmasi

    if (editorState && editorState.mode === 'csv-edit' && pageId !== 'editor') {

        Swal.fire({

            title: 'Batalkan Pengeditan?',

            text: "Semua perubahan data yang belum disimpan akan hilang.",

            icon: 'warning',

            showCancelButton: true,

            confirmButtonColor: cssVar('--danger') || cssVar('--danger') || '#ef4444',

            cancelButtonColor: cssVar('--swal-cancel') || cssVar('--text-muted') || '#cbd5e1',

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
    document.querySelectorAll('.popover-item').forEach(el => el.classList.remove('active'));

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

    // Pisahkan nomor tabel murni (misal: '1.1.2' dari 'Tabel 1.1.2' atau '1.1.2 - Judul')
    const numMatch = cleanName.match(/^(?:Tabel[\s_]*|)(\d+(?:\.\d+)*)\s*(?:[\-–—:]\s*|\.\s*|\s+)(.+)$/i);
    if (numMatch && numMatch[1] && numMatch[2]) {
        displayNum = numMatch[1].trim();
        displayNameOnly = numMatch[2].trim();
    } else {
        const fallbackMatch = cleanName.match(/^(?:Tabel[\s_]*|)(\d+(?:\.\d+)*)\s*$/i);
        if (fallbackMatch && fallbackMatch[1]) {
            displayNum = fallbackMatch[1].trim();
            displayNameOnly = '';
        }
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
        const icon = container.querySelector('.edit-pencil-icon');
        if (container.classList.contains('table-number-wrapper')) {
            container.style.border = isReadOnly ? '1px solid var(--border, #cbd5e1)' : '1px dashed #cbd5e1';
            container.style.background = isReadOnly ? 'var(--bg-page, #f8fafc)' : (cssVar('--bg-page') || '#fafafa');
            return;
        }

        if (isReadOnly) {
            container.style.border = 'none';
            container.style.background = 'transparent';
            container.setAttribute('onmouseenter', '');
            container.setAttribute('onmouseleave', '');
            if (icon) icon.style.display = 'none';
        } else {
            container.style.border = '1px dashed #cbd5e1';
            container.style.background = cssVar('--bg-page') || '#fafafa';
            container.setAttribute('onmouseenter', "this.style.borderColor=cssVar('--indigo-600') || '#4F46E5'; this.style.background=cssVar('--text-white') || '#ffffff';");
            container.setAttribute('onmouseleave', "this.style.borderColor=cssVar('--text-muted') || '#cbd5e1'; this.style.background=cssVar('--bg-page') || '#fafafa';");
            if (icon) icon.style.display = 'inline';
        }
    });

}



async function saveTableIdentityInline() {
    const tableId = editorState.tableId;
    if (!tableId) return;

    const rawNum = document.getElementById('editor-table-number')?.value?.replace(/^Tabel[\s_]*/i, '').trim() || '';
    const titleVal = document.getElementById('editor-title')?.value?.trim() || '';

    if (!titleVal) {
        return; // Jangan simpan jika judul kosong
    }

    const fullNewName = rawNum ? `Tabel ${rawNum} - ${titleVal}` : titleVal;
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

            confirmButtonColor: cssVar('--danger') || cssVar('--danger') || '#ef4444',

            cancelButtonColor: cssVar('--swal-cancel') || cssVar('--text-muted') || '#cbd5e1',

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
            <div class="editor-toolbar-inner">
                <!-- Baris 1 / Sesi Navigasi & Mode -->
                <div class="toolbar-section toolbar-section-nav">
                    <!-- Tombol Kembali -->
                    <button onclick="backToTableList()" class="btn btn-sm btn-toolbar btn-toolbar-back" title="Kembali ke Daftar Tabel">
                        <i class="bi bi-arrow-left"></i> Kembali
                    </button>
                    
                    <!-- Tombol Navigasi Prev / Next -->
                    <div id="nav-buttons" class="btn-group toolbar-nav-group" role="group">
                        <button id="btn-prev" onclick="navigateTable('prev')" class="btn btn-sm btn-toolbar btn-toolbar-prev" title="Tabel Sebelumnya">
                            <i class="bi bi-chevron-left"></i> Prev
                        </button>
                        <button id="btn-next" onclick="navigateTable('next')" class="btn btn-sm btn-toolbar btn-toolbar-next" title="Tabel Selanjutnya">
                            Next <i class="bi bi-chevron-right"></i>
                        </button>
                    </div>

                    <!-- Beralih ke Edit Data -->
                    <button onclick="switchToCsvEdit(${tableId}, '${tn}')" class="btn btn-sm btn-primary btn-toolbar btn-toolbar-edit" title="Beralih ke mode pengeditan data">
                        <i class="bi bi-pencil-square"></i> Edit Data
                    </button>
                </div>

                <div class="vr mx-1 my-auto toolbar-vr" style="height:20px; opacity:0.25;"></div>

                <!-- Baris 2 / Sesi Ekspor & Analisis -->
                <div class="toolbar-section toolbar-section-actions">
                    <div class="btn-group toolbar-export-group" role="group">
                        <button onclick="downloadExcel(${tableId})" class="btn btn-sm btn-toolbar btn-toolbar-excel" title="Unduh format Microsoft Excel (.xlsx)">
                            <i class="bi bi-file-earmark-excel-fill"></i> Excel (.xlsx)
                        </button>
                        <button onclick="downloadCsv(${tableId})" class="btn btn-sm btn-toolbar btn-toolbar-csv" title="Unduh format CSV">
                            <i class="bi bi-filetype-csv"></i> CSV
                        </button>
                    </div>

                    <!-- Analisis Deret Waktu -->
                    <button onclick="openTimeSeriesForTable(${tableId}, '${tn}')" class="btn btn-sm btn-toolbar btn-toolbar-ts" title="Buka analisis grafik deret waktu">
                        <i class="bi bi-graph-up-arrow"></i> Deret Waktu
                    </button>
                </div>

                <!-- Status Badge -->
                <div class="toolbar-section toolbar-section-status ms-auto">
                    <span class="badge bg-light text-secondary border toolbar-status-badge">
                        <i class="bi bi-eye me-1"></i> Mode Lihat (Baca Saja)
                    </span>
                </div>
            </div>
        `;
        fetchTableNeighbors(tableId);

    } else if (mode === 'csv-edit') {
        toolbar.innerHTML = `
            <div class="editor-toolbar-inner">
                <!-- Baris 1 / Batal & Ekspor -->
                <div class="toolbar-section toolbar-section-nav">
                    <!-- Action Back / Cancel -->
                    <button onclick="backToTableList()" class="btn btn-sm btn-toolbar btn-toolbar-cancel" title="Kembali ke daftar tanpa menyimpan">
                        <i class="bi bi-x-circle-fill"></i> Batal / Kembali
                    </button>

                    <div class="btn-group toolbar-export-group" role="group">
                        <button onclick="downloadExcel(${tableId})" class="btn btn-sm btn-toolbar btn-toolbar-excel" title="Unduh Excel">
                            <i class="bi bi-file-earmark-excel-fill"></i> Excel
                        </button>
                        <button onclick="downloadCsv(${tableId})" class="btn btn-sm btn-toolbar btn-toolbar-csv" title="Unduh CSV">
                            <i class="bi bi-filetype-csv"></i> CSV
                        </button>
                    </div>
                </div>

                <div class="vr mx-1 my-auto toolbar-vr" style="height:20px; opacity:0.25;"></div>

                <!-- Baris 2 / Transform & Master Group -->
                <div class="toolbar-section toolbar-section-tools">
                    <button onclick="transposeCsvLocal()" class="btn btn-sm btn-toolbar btn-toolbar-transpose" title="Tukar baris dan kolom tabel">
                        <i class="bi bi-arrow-left-right"></i> Transpose
                    </button>
                    <button onclick="renameHeadersToMaster(${tableId}, '${tn}')" class="btn btn-sm btn-toolbar btn-toolbar-rename" title="Ganti header sesuai master kolom">
                        <i class="bi bi-pencil-square"></i> Nama Master
                    </button>
                    <button onclick="matchColumnsToMaster(${tableId}, '${tn}')" class="btn btn-sm btn-toolbar btn-toolbar-match" title="Cocokkan header secara otomatis ke master kolom">
                        <i class="bi bi-stars"></i> Cocokkan Master
                    </button>
                    <button onclick="addColFromMaster(${tableId}, '${tn}')" class="btn btn-sm btn-toolbar btn-toolbar-addcol" title="Daftarkan kolom tabel ini ke master">
                        <i class="bi bi-clipboard-plus"></i> Daftarkan Master
                    </button>
                </div>

                <!-- Baris 3 / Save Changes Button -->
                <div class="toolbar-section toolbar-section-save ms-auto">
                    <button onclick="saveCsvChangesToServer(${tableId})" class="btn btn-sm btn-success btn-toolbar btn-toolbar-save" title="Simpan perubahan ke database">
                        <i class="bi bi-check2-circle"></i> Simpan Perubahan
                    </button>
                </div>
            </div>
        `;

    } else {
        toolbar.innerHTML = `
            <div class="editor-toolbar-inner">
                <div class="toolbar-section toolbar-section-nav">
                    <button onclick="backToTableList()" class="btn btn-sm btn-toolbar btn-toolbar-back" title="Kembali">
                        <i class="bi bi-arrow-left"></i> Kembali
                    </button>
                    <div id="nav-buttons" class="btn-group toolbar-nav-group" role="group">
                        <button id="btn-prev" onclick="navigateTable('prev')" class="btn btn-sm btn-toolbar btn-toolbar-prev" title="Tabel Sebelumnya">
                            <i class="bi bi-chevron-left"></i> Prev
                        </button>
                        <button id="btn-next" onclick="navigateTable('next')" class="btn btn-sm btn-toolbar btn-toolbar-next" title="Tabel Selanjutnya">
                            Next <i class="bi bi-chevron-right"></i>
                        </button>
                    </div>
                    <button onclick="markAllSafeInTable(${tableId}, '${tn}')" class="btn btn-sm btn-success btn-toolbar" title="Tandai semua aman">
                        <i class="bi bi-shield-check"></i> Tandai Semua Aman
                    </button>
                </div>
                <div class="toolbar-section toolbar-section-status ms-auto">
                    <span class="toolbar-note" style="font-size:0.8rem; color:#94a3b8;">Baris <span style='color:#ef4444;font-weight:700;'>merah</span> = data anomali. Auto-save aktif.</span>
                </div>
            </div>
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

    const pe = document.getElementById('page-editor');
    if (pe) {
        pe.classList.remove('mode-view');
        pe.classList.add('mode-edit');
    }

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
        const icon = container.querySelector('.edit-pencil-icon');
        container.style.border = '1px dashed #cbd5e1';
        container.style.background = cssVar('--bg-page') || '#fafafa';
        container.setAttribute('onmouseenter', "this.style.borderColor=cssVar('--indigo-600') || '#4F46E5'; this.style.background=cssVar('--text-white') || '#ffffff';");
        container.setAttribute('onmouseleave', "this.style.borderColor=cssVar('--text-muted') || '#cbd5e1'; this.style.background=cssVar('--bg-page') || '#fafafa';");
        if (icon) icon.style.display = 'inline';
    });



    _loadCsvIntoEditor(tableId, tableName, true);

}



let dashboardChartInstance = null;



// Page 1: Dashboard Stats

async function backupDatabase(evt) {
    const btn = document.getElementById('btn-dashboard-backup') || (evt && evt.currentTarget ? evt.currentTarget : null);
    const origHtml = btn ? btn.innerHTML : '';
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span> Memproses...';
    }
    try {
        const res = await fetch(`${API_BASE}/admin/backup`, { method: "POST" });
        if (res.ok) {
            const data = await res.json();
            showToast('success', 'Backup Berhasil', `File: ${data.file}`);
            const a = document.createElement('a');
            a.href = `${API_BASE}/admin/backups/${encodeURIComponent(data.file)}`;
            a.download = data.file;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);

            if (typeof loadDashboardBackupInfo === 'function') await loadDashboardBackupInfo();
            if (typeof loadAdminBackups === 'function') await loadAdminBackups();
            if (typeof loadDashboardStats === 'function') await loadDashboardStats();
        } else {
            const err = await res.json().catch(() => ({}));
            showToast('error', 'Backup Gagal', err.detail || 'Terjadi kesalahan');
        }
    } catch (e) {
        showToast('error', 'Backup Gagal', String(e));
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = origHtml || '<i class="bi bi-shield-check"></i> Backup Sekarang';
        }
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

    zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.style.borderColor = cssVar('--swal-confirm-primary') || cssVar('--indigo-600') || '#4f46e5'; zone.style.background = cssVar('--primary-faint') || '#eef2ff'; });

    zone.addEventListener('dragleave', () => { zone.style.borderColor = cssVar('--swal-cancel') || cssVar('--text-muted') || '#cbd5e1'; zone.style.background = 'var(--bg-page, #f8fafc)'; });

    zone.addEventListener('drop', (e) => { 

        e.preventDefault(); 

        zone.style.borderColor = cssVar('--swal-cancel') || cssVar('--text-muted') || '#cbd5e1'; 

        zone.style.background = 'var(--bg-page, #f8fafc)'; 

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
        const latest = files[0];
        infoEl.innerHTML = `
            <div class="d-flex flex-wrap gap-3 align-items-center mt-1">
                <span class="text-dark fw-medium">${escHtml(latest.file)}</span>
                <span class="text-muted">Ukuran: <strong>${formatFileSize(latest.size)}</strong></span>
                <span class="text-muted">Tanggal: <strong>${latest.modified}</strong></span>
            </div>
        `;
    } catch (e) {
        infoEl.innerHTML = `<span class="text-danger">Gagal memuat info backup: ${e.message}</span>`;
    }
}

// Helper untuk mengontrol indikator loading grafik dashboard
function hideDashboardChartLoading() {
    const overlayIds = ['loading-dashboard-bar-chart', 'loading-dashboard-ref-chart', 'loading-dashboard-trend-chart'];
    overlayIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.classList.add('hidden');
            setTimeout(() => {
                if (el.classList.contains('hidden')) {
                    el.style.display = 'none';
                }
            }, 320);
        }
    });
}

function showDashboardChartLoading() {
    const overlayIds = ['loading-dashboard-bar-chart', 'loading-dashboard-ref-chart', 'loading-dashboard-trend-chart'];
    overlayIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.style.display = 'flex';
            void el.offsetHeight;
            el.classList.remove('hidden');
        }
    });
}

async function loadDashboardStats(isManual = false) {

    const refreshBtn = document.getElementById('btn-refresh-dashboard');
    const refreshIcon = document.getElementById('icon-refresh-dashboard') || (refreshBtn ? refreshBtn.querySelector('.bi-arrow-clockwise') : null);
    const refreshText = document.getElementById('text-refresh-dashboard') || (refreshBtn ? refreshBtn.querySelector('span') : null);

    if (isManual && refreshBtn) {
        refreshBtn.disabled = true;
        if (refreshIcon) refreshIcon.classList.add('spin-fast');
        if (refreshText) refreshText.textContent = 'Memperbarui...';
    }

    const adminView = document.getElementById('dashboard-admin-view');

    const welcomeRoleText = document.getElementById('welcome-role-text');

    

    // Fetch chart data secara paralel di awal agar instan
    const chartUrl = isManual ? `${API_BASE}/stats/chart?_t=${Date.now()}` : `${API_BASE}/stats/chart`;
    const chartDataPromise = fetch(chartUrl).then(r => r.ok ? r.json() : null).catch(() => null);

    

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

            ? 'Admin SIPEDAS (Kontrol Penuh)' 

            : 'Operator SIPEDAS';

    }



    // Helper render feed publikasi terbaru
    function renderRecentDocsList(docs) {
        const recentListEl = document.getElementById('recent-docs-list');
        if (!recentListEl || !docs) return;
        if (docs.length === 0) {
            recentListEl.innerHTML = `<div class="text-center py-4 text-muted small">Belum ada publikasi terbit di sistem.</div>`;
            return;
        }
        const sortedDocs = [...docs].sort((a, b) => (b.year || 0) - (a.year || 0) || b.id - a.id);
        recentListEl.innerHTML = sortedDocs.map(d => {
            const isExcel = (d.filename || '').toLowerCase().endsWith('.xlsx') || d.status === 'ready_excel';
            const pubTitle = d.year ? `Publikasi ${d.year}` : (d.filename || '').replace(/\.(pdf|xlsx)$/i, '');
            const iconHtml = isExcel 
                ? `<div class="rounded-3 bg-success bg-opacity-10 text-success flex-shrink-0 d-flex align-items-center justify-content-center" style="width: 42px; height: 42px; font-size: 1.2rem;">
                       <i class="bi bi-file-earmark-spreadsheet-fill"></i>
                   </div>`
                : `<div class="rounded-3 bg-danger bg-opacity-10 text-danger flex-shrink-0 d-flex align-items-center justify-content-center" style="width: 42px; height: 42px; font-size: 1.2rem;">
                       <i class="bi bi-file-earmark-pdf"></i>
                   </div>`;
            return `
                <div class="recent-doc-item d-flex align-items-center justify-content-between rounded-3 border shadow-2xs" style="padding: 0.95rem 1.25rem;">
                    <div class="d-flex align-items-center min-w-0" style="gap: 16px;">
                        ${iconHtml}
                        <div class="min-w-0 pe-2">
                            <div class="fw-bold recent-doc-title text-truncate" style="font-size: 0.92rem; letter-spacing: -0.01em;" title="${d.filename}">
                                ${pubTitle}
                            </div>
                            <div class="d-flex align-items-center gap-2 recent-doc-subtext mt-1" style="font-size: 0.76rem;">
                                <span class="d-inline-flex align-items-center"><i class="bi bi-calendar-event me-2 text-secondary"></i>Data ${d.year ? d.year - 1 : '-'}</span>
                                <span class="opacity-40">•</span>
                                <span class="badge bg-primary-subtle text-primary border border-primary-subtle" style="font-size: 0.72rem; padding: 2.5px 8.5px; border-radius: 6px; font-weight: 600;">
                                    ${d.table_count || 0} Tabel
                                </span>
                            </div>
                        </div>
                    </div>
                    <button onclick="viewState.selectedDocId=${d.id}; viewState.selectedBabNum=null; navigateDataTabelTab('publikasi');" class="btn btn-sm btn-outline-primary py-1.5 px-3 rounded-2 flex-shrink-0" style="font-size: 0.78rem; font-weight: 600;">
                        Buka <i class="bi bi-arrow-right-short"></i>
                    </button>
                </div>
            `;
        }).join('');
    }

    // Render feed publikasi seketika (0 ms) dari memory/localStorage jika ada
    if (window.__cachedDocsList && window.__cachedDocsList.length > 0) {
        renderRecentDocsList(window.__cachedDocsList);
    } else {
        try {
            const cachedDocs = localStorage.getItem('sipedas_docs_cache');
            if (cachedDocs) {
                const parsed = JSON.parse(cachedDocs);
                window.__cachedDocsList = parsed;
                renderRecentDocsList(parsed);
            }
        } catch(e) {}
    }

    // Stale-While-Revalidate: render kartu analitik langsung dari localStorage cache jika ada
    try {
        const cachedStats = localStorage.getItem('sipedas_dashboard_stats_cache');
        if (cachedStats) {
            const stats = JSON.parse(cachedStats);
            const ptsEl = document.getElementById('stat-total-pts');
            const tablesEl = document.getElementById('stat-total-tables');
            const rowsEl = document.getElementById('stat-total-rows');
            const docsEl = document.getElementById('stat-total-docs');
            if (ptsEl && stats.total_data_points !== undefined) ptsEl.textContent = stats.total_data_points.toLocaleString('id-ID');
            if (tablesEl && stats.total_tables !== undefined) tablesEl.textContent = stats.total_tables.toLocaleString('id-ID');
            if (rowsEl && stats.total_rows !== undefined) rowsEl.textContent = stats.total_rows.toLocaleString('id-ID');
            if (docsEl && stats.total_docs !== undefined) docsEl.textContent = stats.total_docs.toLocaleString('id-ID');
        }
    } catch (e) {}

    // Fetch dokumen di latar belakang dan perbarui feed
    fetch(`${API_BASE}/documents`).then(r => r.ok ? r.json() : null).then(docs => {
        if (docs && docs.length > 0) {
            window.__cachedDocsList = docs;
            try { localStorage.setItem('sipedas_docs_cache', JSON.stringify(docs)); } catch (e) {}
            renderRecentDocsList(docs);
        }
    }).catch(() => {});

    try {
        const statsUrl = isManual ? `${API_BASE}/stats?force=1&_t=${Date.now()}` : `${API_BASE}/stats`;
        const res = await fetch(statsUrl);
        if(res.ok) {
            const stats = await res.json();
            try { localStorage.setItem('sipedas_dashboard_stats_cache', JSON.stringify(stats)); } catch (e) {}
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

            const anomaliesPanel = document.getElementById('admin-anomalies-panel');

            

            if (anomaliesRes.ok) {

                const anomalies = await anomaliesRes.json();

                const tbody = document.getElementById('admin-anomalies-tbody');

                if (tbody) {

                    if (anomalies.length === 0) {

                        if (cleanBanner) cleanBanner.style.display = 'flex';

                        if (anomaliesPanel) anomaliesPanel.style.display = 'none';

                        tbody.innerHTML = '';

                    } else {

                        if (cleanBanner) cleanBanner.style.display = 'none';

                        if (anomaliesPanel) anomaliesPanel.style.display = 'block';

                        tbody.innerHTML = anomalies.map(a => `

                            <tr style="border-bottom: 1px solid #f1f5f9;">

                                <td style="padding: 10px; font-weight: 500; color: #334155; max-width: 400px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${a.table_name}">

                                    <span style="cursor: pointer; color: #4f46e5; text-decoration: underline;" onclick="viewDataEditor(${a.table_id}, '${a.table_name.replace(/'/g, "\\'")}')">

                                        ${a.table_name}

                                    </span>

                                </td>

                                <td style="padding: 10px; text-align: center; color: #64748b;">${a.year}</td>

                                <td style="padding: 10px; text-align: center; color: #ef4444; font-weight: 600;">${a.anomaly_count} baris</td>

                                <td style="padding: 10px; text-align: center;">

                                    <button class="btn btn-small btn-primary" style="background:#6366f1; padding:4px 10px; font-size:0.8rem; cursor:pointer;" onclick="viewDataEditor(${a.table_id}, '${a.table_name.replace(/'/g, "\\'")}')">

                                        Perbaiki

                                    </button>

                                </td>

                            </tr>

                        `).join('');

                    }

                }

            }

            

            // Load recent activity logs

            const actRes = await fetch(`${API_BASE}/admin/activity-logs?limit=10`);

            if (actRes.ok) {

                const actData = await actRes.json();

                const recentTbody = document.getElementById('admin-recent-tbody');

                if (recentTbody) {

                    const logs = actData.logs || [];

                    if (logs.length === 0) {

                        recentTbody.innerHTML = `<tr><td colspan="4" class="text-center py-4 text-muted small">Belum ada aktivitas tercatat.</td></tr>`;

                    } else {

                        const actionLabels = {

                            upload: '<i class="bi bi-cloud-arrow-up-fill text-primary"></i> Upload',

                            extract: '<i class="bi bi-file-earmark-code-fill text-info"></i> Ekstraksi',

                            edit_row: '<i class="bi bi-pencil-square text-warning"></i> Edit Data',

                            delete_row: '<i class="bi bi-trash3-fill text-danger"></i> Hapus Baris',

                            save_table: '<i class="bi bi-save-fill text-success"></i> Simpan Tabel',

                            reload_all: '<i class="bi bi-arrow-repeat text-primary"></i> Reload Semua',

                            reload_chapter: '<i class="bi bi-arrow-repeat text-info"></i> Reload Bab',

                            backup: '<i class="bi bi-shield-check-fill text-success"></i> Backup',

                            restore: '<i class="bi bi-clock-history text-warning"></i> Restore',

                            safe_anomaly: '<i class="bi bi-check-circle-fill text-success"></i> Tandai Aman',

                            safe_all_anomaly: '<i class="bi bi-check-circle-fill text-success"></i> Semua Aman',

                            delete_document: '<i class="bi bi-x-octagon-fill text-danger"></i> Hapus Publikasi',

                            fix_header: '<i class="bi bi-tools text-warning"></i> Fix Header'

                        };

                        recentTbody.innerHTML = logs.map(l => {

                            const label = actionLabels[l.action] || ('<i class="bi bi-activity"></i> ' + l.action);

                            const time = l.timestamp ? l.timestamp.replace(/(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}):\d+/, '$1 $2') : '-';

                            const detail = l.detail ? Object.entries(l.detail).map(([k,v]) => `${k}: ${v}`).join(', ') : '';

                            return `<tr>

                                <td class="ps-4 py-3" style="font-size:0.82rem; white-space:nowrap; color:var(--text-secondary, #64748b);">${time}</td>

                                <td class="py-3" style="font-size:0.82rem;">${label}</td>

                                <td class="py-3" style="font-size:0.82rem; color:#334155; max-width:250px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${escHtml(l.target)}">${escHtml(l.target || '-')}</td>

                                <td class="pe-4 py-3" style="font-size:0.78rem; color:#94a3b8; max-width:300px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${escHtml(detail)}">${escHtml(detail || '-')}</td>

                            </tr>`;

                        }).join('');

                    }

                }

            }

        }

        // Render Multi-Visualisasi Chart.js untuk semua role

        if (typeof loadDashboardBackupInfo === 'function') loadDashboardBackupInfo();

        try {

            const statsData = await chartDataPromise;

            if (statsData) {
                const isTabRevisit = !!(window.dashboardBarChartInstance && window.dashboardTrendChartInstance && window.dashboardRefYearChartInstance);

                // 1. Bar Chart: Sebaran Tabel per Tahun
                const barCanvas = document.getElementById('dashboardBarChart');
                if (barCanvas && statsData.bar_chart) {
                    window.cachedBarChartData = JSON.parse(JSON.stringify(statsData.bar_chart));
                    const _sel = document.getElementById('barChartYearFilter');
                    const defaultRange = (_sel && _sel.value) ? _sel.value : (window.cachedBarChartData.labels.length > 10 ? '10' : 'all');
                    if (_sel && !_sel.value) _sel.value = defaultRange;
                    filterBarChart(defaultRange, !isTabRevisit);
                }

                // 3. Line/Area Chart: Tren Akumulasi Volume Data
                if (statsData.line_chart) {
                    window.cachedTrendChartData = statsData.line_chart;
                    renderTrendChartMode(window.currentTrendChartMode || 'points', !isTabRevisit);
                }

                // 4. Bar Chart: Simpan cache data tahun referensi & inisialisasi render
                if (statsData.ref_year_chart) {
                    window.cachedRefChartData = statsData.ref_year_chart;
                    const _sel = document.getElementById('refChartYearFilter');
                    if (_sel && !window.currentRefYearFilter && window.cachedRefChartData.labels.length > 10) {
                        _sel.value = '10';
                        window.currentRefYearFilter = '10';
                    }
                    renderRefChartMode(window.currentRefChartMode || 'points', !isTabRevisit);
                }

                // Sembunyikan indikator loading grafik setelah render selesai
                hideDashboardChartLoading();
            } else {
                hideDashboardChartLoading();
            }

            // 5. Feed publikasi terbaru sudah dirender seketika di awal via renderRecentDocsList
            if (window.__cachedDocsList) {
                renderRecentDocsList(window.__cachedDocsList);
            }

        } catch (chartErr) {

            console.error("Gagal memuat visualisasi chart dashboard:", chartErr);
            hideDashboardChartLoading();

        }

    } catch (err) {

        console.error("Gagal memuat statistik dashboard:", err);

    } finally {
        if (isManual) {
            // Beri efek animasi segar pada kartu metrik statistik
            const statCards = document.querySelectorAll('#dashboard-admin-view .stat-card-glass');
            statCards.forEach(card => {
                card.classList.remove('stat-card-refreshed');
                void card.offsetWidth;
                card.classList.add('stat-card-refreshed');
                setTimeout(() => card.classList.remove('stat-card-refreshed'), 600);
            });

            if (refreshBtn) {
                refreshBtn.disabled = false;
                if (refreshIcon) refreshIcon.classList.remove('spin-fast');
                if (refreshText) refreshText.textContent = 'Perbarui';
            }

            if (typeof showToast === 'function') {
                showToast('success', 'Statistik Diperbarui', 'Data metrik database berhasil disinkronkan langsung.');
            }
        }
    }

}



async function markAllDbAnomaliesSafe() {

    Swal.fire({

        title: 'Tandai Semua Aman?',

        text: "Seluruh baris berstatus anomali di SELURUH DATABASE akan ditandai aman sekaligus.",

        icon: 'warning',

        showCancelButton: true,

        confirmButtonColor: cssVar('--success') || cssVar('--success-emerald') || '#10b981',

        cancelButtonColor: cssVar('--swal-cancel') || cssVar('--text-muted') || '#cbd5e1',

        confirmButtonText: 'Ya, Tandai Semua Aman',

        cancelButtonText: 'Batal'

    }).then(async (result) => {

        if (result.isConfirmed) {

            try {

                const res = await fetch(`${API_BASE}/admin/safe-all`, { method: "PUT" });

                if (res.ok) {

                    showToast('success', 'Berhasil!', 'Seluruh database telah bersih dari anomali.');

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



function openDocFromDashboard(id) {

    if (!checkRoleAccess('tabel')) return;

    viewState.selectedDocId = id;

    viewState.selectedBabNum = null;

    navigateDataTabelTab('publikasi');

}



// Fungsi Switch Tampilan Grafik Tren Pertumbuhan Akumulasi Volume (Titik Data vs Baris Record)

function switchTrendChartView(mode) {
    window.currentTrendChartMode = mode;
    renderTrendChartMode(mode, true);
}

function renderTrendChartMode(mode, animate = true) {
    if (!window.cachedTrendChartData) return;
    const canvas = document.getElementById('dashboardTrendChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    

    const btnPts = document.getElementById('btn-trend-view-points');

    const btnRows = document.getElementById('btn-trend-view-rows');

    const titleEl = document.getElementById('trend-chart-title');

    const subTitleEl = document.getElementById('trend-chart-subtitle');

    

    const isPoints = mode === 'points';

    

    if (btnPts && btnRows) {

        btnPts.classList.toggle('active', isPoints);

        btnRows.classList.toggle('active', !isPoints);

    }

    

    if (titleEl && subTitleEl) {

        if (isPoints) {

            titleEl.textContent = 'Tren Pertumbuhan Akumulasi Titik Data';

            subTitleEl.textContent = 'Akumulasi titik nilai sel data statistik berdasarkan tahun publikasi';

        } else {

            titleEl.textContent = 'Tren Pertumbuhan Akumulasi Baris Record';

            subTitleEl.textContent = 'Akumulasi baris record data statistik berdasarkan tahun publikasi';

        }

    }

    

    const dataset = isPoints ? window.cachedTrendChartData.datasets[0] : window.cachedTrendChartData.datasets[1];
    
    if (window.dashboardTrendChartInstance && !animate) {
        window.dashboardTrendChartInstance.data.labels = window.cachedTrendChartData.labels;
        window.dashboardTrendChartInstance.data.datasets = [{
            ...dataset,
            fill: false,
            pointRadius: 4,
            pointHoverRadius: 8,
            pointHitRadius: 35,
            pointHoverBorderWidth: 2,
            borderWidth: 0
        }];
        window.dashboardTrendChartInstance.update('none');
        return;
    }

    const isDark = document.documentElement.getAttribute('data-bs-theme') === 'dark';

    const tickColor = isDark ? cssVar('--text-light') || '#94a3b8' : cssVar('--text-secondary') || '#64748b';

    const gridColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)';

    

    // Batalkan loop animasi sebelumnya jika masih berjalan

    if (window._trendAnimRafId) {

        cancelAnimationFrame(window._trendAnimRafId);

        window._trendAnimRafId = null;

    }



    const animStartTime = performance.now();

    const segDuration = 380; // ms per segmen penarikan garis

    const totalSegs = Math.max(dataset.data.length - 1, 1);

    const totalAnimTime = segDuration * totalSegs;



    const sequentialPenPlugin = {

        id: 'trendSequentialPenPlugin',

        afterDatasetsDraw(chart) {

            const { ctx, scales: { x, y } } = chart;

            if (!x || !y || !dataset.data || dataset.data.length === 0) return;



            const isDarkTheme = document.documentElement.getAttribute('data-bs-theme') === 'dark';
            const now = performance.now();
            const elapsed = now - animStartTime;
            const progress = animate ? Math.min(Math.max(elapsed / totalAnimTime, 0), 1) : 1;

            const activeProgress = progress * totalSegs; // rentang 0.0 sampai totalSegs

            const currentSegIndex = Math.min(Math.floor(activeProgress), totalSegs - 1);

            const segSubProgress = activeProgress - currentSegIndex;



            // Easing kuadratik halus untuk goresan pena

            const ease = (t) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

            const easedSegProgress = ease(Math.min(Math.max(segSubProgress, 0), 1));



            // Koordinat pixel target seluruh titik data

            const pts = dataset.data.map((val, i) => ({

                x: x.getPixelForTick(i),

                y: y.getPixelForValue(val),

                val: val

            }));



            if (pts.length === 0) return;



            const yZero = y.getPixelForValue(0);

            const strokeColor = isPoints ? (isDarkTheme ? cssVar('--primary-light') || '#38bdf8' : cssVar('--primary') || '#2563eb') : (isDarkTheme ? cssVar('--info') || '#0ea5e9' : cssVar('--primary') || '#1d4ed8');

            const fillColor = isPoints ? (isDarkTheme ? 'rgba(56, 189, 248, 0.22)' : 'rgba(37, 99, 235, 0.12)') : (isDarkTheme ? 'rgba(14, 165, 233, 0.22)' : 'rgba(29, 78, 216, 0.12)');



            // Koordinat ujung garis yang sedang meluncur

            const startPt = pts[currentSegIndex];

            const nextPt = pts[currentSegIndex + 1] || startPt;

            const currentTipX = startPt.x + (nextPt.x - startPt.x) * easedSegProgress;

            const currentTipY = startPt.y + (nextPt.y - startPt.y) * easedSegProgress;



            // 1. Gambar Area Fill Dinamis di Bawah Garis (Satu lapis murni mengikuti ujung pena)

            ctx.save();

            ctx.beginPath();

            ctx.moveTo(pts[0].x, yZero);

            ctx.lineTo(pts[0].x, pts[0].y);



            // Sambungkan segmen garis yang sudah selesai

            for (let j = 0; j < currentSegIndex; j++) {

                ctx.lineTo(pts[j + 1].x, pts[j + 1].y);

            }

            // Tarik tepat ke posisi ujung pena saat ini

            ctx.lineTo(currentTipX, currentTipY);

            ctx.lineTo(currentTipX, yZero);

            ctx.closePath();

            ctx.fillStyle = fillColor;

            ctx.fill();

            ctx.restore();



            // 2. Gambar Garis Kurva (Tarik Garis Bertahap)

            ctx.save();

            ctx.beginPath();

            ctx.moveTo(pts[0].x, pts[0].y);

            for (let j = 0; j < currentSegIndex; j++) {

                ctx.lineTo(pts[j + 1].x, pts[j + 1].y);

            }

            ctx.lineTo(currentTipX, currentTipY);

            ctx.strokeStyle = strokeColor;

            ctx.lineWidth = 3;

            ctx.lineCap = 'round';

            ctx.lineJoin = 'round';

            ctx.shadowColor = strokeColor;

            ctx.shadowBlur = 6;

            ctx.stroke();

            ctx.restore();



            // 3. Gambar Titik Node (Hanya muncul jika garis sudah sampai ke titik tersebut)

            const visiblePointCount = (progress >= 1) ? pts.length : (currentSegIndex + 1);



            for (let i = 0; i < visiblePointCount; i++) {

                const pt = pts[i];

                ctx.save();

                // Halo lingkaran luar

                ctx.beginPath();

                ctx.arc(pt.x, pt.y, 6.5, 0, Math.PI * 2);

                ctx.fillStyle = isDarkTheme ? cssVar('--text-primary') || '#1e293b' : cssVar('--text-white') || '#ffffff';

                ctx.fill();

                ctx.lineWidth = 2.5;

                ctx.strokeStyle = strokeColor;

                ctx.stroke();



                // Titik inti dalam

                ctx.beginPath();

                ctx.arc(pt.x, pt.y, 3.5, 0, Math.PI * 2);

                ctx.fillStyle = strokeColor;

                ctx.fill();

                ctx.restore();

            }



            // Gambar Pen-Tip Dot bersinar di ujung garis yang sedang meluncur

            if (progress < 1) {

                ctx.save();

                ctx.beginPath();

                ctx.arc(currentTipX, currentTipY, 5, 0, Math.PI * 2);

                ctx.fillStyle = cssVar('--text-white') || '#ffffff';

                ctx.shadowColor = strokeColor;

                ctx.shadowBlur = 10;

                ctx.fill();

                ctx.lineWidth = 2;

                ctx.strokeStyle = strokeColor;

                ctx.stroke();

                ctx.restore();

            }



            // 4. Gambar Badge Indikator Pertumbuhan (Hanya untuk titik yang sudah tercapai)

            const _drawnBadgeRects = [];

            for (let i = 0; i < visiblePointCount; i++) {

                const pt = pts[i];

                let badgeText = '';

                let isUp = true;



                if (i === 0) {

                    badgeText = `Awal: ${pt.val.toLocaleString('id-ID')}`;

                } else {

                    const prevVal = pts[i - 1].val;

                    const delta = pt.val - prevVal;

                    if (delta > 0) {

                        badgeText = `▲ +${delta.toLocaleString('id-ID')}`;

                        isUp = true;

                    } else if (delta < 0) {

                        badgeText = `▼ -${Math.abs(delta).toLocaleString('id-ID')}`;

                        isUp = false;

                    } else {

                        badgeText = `0`;

                    }

                }



                ctx.save();

                ctx.font = '600 10.5px "Inter", sans-serif';

                ctx.textAlign = 'center';

                ctx.textBaseline = 'middle';



                const textWidth = ctx.measureText(badgeText).width;

                const pillWidth = textWidth + 12;

                const pillHeight = 19;



                const isFirst = (i === 0);

                const isLast = (i === pts.length - 1);



                let pillX = pt.x;

                let pillY = pt.y - 18;



                if (isFirst) {

                    pillX = pt.x + (pillWidth / 2) + 8;

                    pillY = pt.y - 14;

                } else if (isLast) {

                    pillX = pt.x - (pillWidth / 2) - 8;

                    pillY = pt.y - 14;

                } else {

                    pillX = Math.max(pillWidth / 2 + 10, Math.min(chart.width - pillWidth / 2 - 10, pt.x));

                    pillY = Math.max(pt.y - 18, 14);

                }



                // Collision detection: push down if overlapping previous badge

                let badgeRect = {

                    left: pillX - pillWidth / 2,

                    right: pillX + pillWidth / 2,

                    top: pillY - pillHeight / 2,

                    bottom: pillY + pillHeight / 2

                };

                for (const prev of _drawnBadgeRects) {

                    if (badgeRect.left < prev.right && badgeRect.right > prev.left &&

                        badgeRect.top < prev.bottom && badgeRect.bottom > prev.top) {

                        pillY = prev.bottom + pillHeight / 2 + 3;

                        badgeRect.top = pillY - pillHeight / 2;

                        badgeRect.bottom = pillY + pillHeight / 2;

                    }

                }

                _drawnBadgeRects.push(badgeRect);



                ctx.beginPath();

                if (typeof ctx.roundRect === 'function') {

                    ctx.roundRect(pillX - pillWidth / 2, pillY - pillHeight / 2, pillWidth, pillHeight, 9);

                } else {

                    ctx.rect(pillX - pillWidth / 2, pillY - pillHeight / 2, pillWidth, pillHeight);

                }



                if (i === 0) {

                    ctx.fillStyle = isDarkTheme ? 'rgba(30, 41, 59, 0.92)' : 'rgba(241, 245, 249, 0.95)';

                    ctx.strokeStyle = isDarkTheme ? cssVar('--text-tertiary') || '#475569' : cssVar('--text-muted') || '#cbd5e1';

                } else if (isUp) {

                    ctx.fillStyle = isDarkTheme ? 'rgba(6, 78, 59, 0.9)' : 'rgba(209, 250, 229, 0.95)';

                    ctx.strokeStyle = isDarkTheme ? cssVar('--success-emerald') || '#10b981' : cssVar('--success') || '#059669';

                } else {

                    ctx.fillStyle = isDarkTheme ? 'rgba(127, 29, 29, 0.9)' : 'rgba(254, 226, 226, 0.95)';

                    ctx.strokeStyle = isDarkTheme ? cssVar('--danger') || '#ef4444' : cssVar('--danger') || '#dc2626';

                }

                ctx.lineWidth = 1;

                ctx.fill();

                ctx.stroke();



                if (i === 0) {

                    ctx.fillStyle = isDarkTheme ? cssVar('--text-muted') || '#cbd5e1' : cssVar('--text-tertiary') || '#475569';

                } else if (isUp) {

                    ctx.fillStyle = isDarkTheme ? cssVar('--success-light') || '#34d399' : cssVar('--success-dark') || '#047857';

                } else {

                    ctx.fillStyle = isDarkTheme ? cssVar('--danger') || '#f87171' : cssVar('--danger-text') || '#b91c1c';

                }

                ctx.fillText(badgeText, pillX, pillY);

                ctx.restore();

            }



            // Loop frame animasi jika belum selesai dan animate diaktifkan
            if (progress < 1 && animate) {

                window._trendAnimRafId = requestAnimationFrame(() => {

                    chart.render();

                });

            }

        }

    };



    if (window.dashboardTrendChartInstance) window.dashboardTrendChartInstance.destroy();

    window.dashboardTrendChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: window.cachedTrendChartData.labels,
            datasets: [{
                ...dataset,
                fill: false, // Hilangkan lapisan background statis bawaan Chart.js
                pointRadius: 4,
                pointHoverRadius: 8,
                pointHitRadius: 35, // Sensitivitas hover tinggi di sepanjang sumbu X
                pointHoverBorderWidth: 2,
                borderWidth: 0 // Garis digambar oleh sequentialPenPlugin
            }]
        },
        plugins: [sequentialPenPlugin],
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false, // Animasi dikendalikan oleh pen-drawing RAF loop
            interaction: {
                mode: 'index',
                intersect: false,
                axis: 'x'
            },
            hover: {
                mode: 'index',
                intersect: false
            },
            layout: {
                padding: {
                    top: 25,

                    left: 15,

                    right: 25,

                    bottom: 0

                }

            },

            plugins: {

                legend: { display: false },

                tooltip: {

                    padding: 10,

                    callbacks: {

                        label: (ctx) => ` Total Akumulasi: ${ctx.raw.toLocaleString('id-ID')} ${isPoints ? 'Titik Nilai Data' : 'Baris Record'}`,

                        afterLabel: (ctx) => {

                            const idx = ctx.dataIndex;

                            if (idx === 0) return ` 📍Ÿ“ Basis Awal Terbit (Tahun ${window.cachedTrendChartData.labels[0]})`;

                            const prev = dataset.data[idx - 1];

                            const diff = ctx.raw - prev;

                            const pct = prev > 0 ? ((diff / prev) * 100).toFixed(1) : '0';

                            if (diff > 0) return ` 📈 Penambahan Data: ▲ +${diff.toLocaleString('id-ID')} (+${pct}%)`;

                            if (diff < 0) return ` 📉 Pengurangan Data: ▼ -${Math.abs(diff).toLocaleString('id-ID')} (${pct}%)`;

                            return ` → Penambahan Data: 0 (Tetap)`;

                        }

                    }

                }

            },

            scales: {

                y: { 

                    beginAtZero: true, 

                    grid: { color: gridColor }, 

                    ticks: { color: tickColor, font: { family: "'Inter', sans-serif", size: 10 } } 

                },

                x: { 

                    grid: { display: false }, 

                    ticks: { color: tickColor, font: { family: "'Inter', sans-serif", size: 10 } } 

                }

            }

        }

    });

}



// Fungsi Year Filter untuk Bar Chart Sebaran Tabel
function filterBarChart(range, animate = true) {
    if (!window.cachedBarChartData) return;
    const src = window.cachedBarChartData;
    const n = range === 'all' ? src.labels.length : parseInt(range);
    const labels = src.labels.slice(-n);
    const datasets = src.datasets.map(d => ({ ...d, data: d.data.slice(-n) }));

    if (window.dashboardBarChartInstance && !animate) {
        window.dashboardBarChartInstance.data.labels = labels;
        window.dashboardBarChartInstance.data.datasets = datasets;
        window.dashboardBarChartInstance.update('none');
        return;
    }

    if (window.dashboardBarChartInstance) window.dashboardBarChartInstance.destroy();
    const ctx = document.getElementById('dashboardBarChart').getContext('2d');
    const isDark = document.documentElement.getAttribute('data-bs-theme') === 'dark';

    window.dashboardBarChartInstance = new Chart(ctx, {
        type: 'bar',
        data: { labels, datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            maxBarThickness: 55,
            barPercentage: 0.75,
            categoryPercentage: 0.8,
            animations: animate ? {
                y: {
                    type: 'number',
                    easing: 'easeOutQuart',
                    duration: 750,
                    from: (ctx) => {
                        if (typeof ctx.dataIndex === 'number' && ctx.chart && ctx.chart.scales && ctx.chart.scales.y) {
                            return ctx.chart.scales.y.getPixelForValue(0);
                        }
                    },
                    delay: (ctx) => (typeof ctx.dataIndex === 'number') ? ctx.dataIndex * 150 : 0
                }
            } : false,
            plugins: {
                legend: { display: false },
                tooltip: { callbacks: { label: (ctx) => ` ${ctx.raw} Tabel Data Terintegrasi` } }
            },
            scales: {
                y: { beginAtZero: true, grid: { color: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)' }, ticks: { color: isDark ? cssVar('--text-light') || '#94a3b8' : cssVar('--text-secondary') || '#64748b', font: { family: "'Inter', sans-serif", size: 10 } } },
                x: { grid: { display: false }, ticks: { color: isDark ? cssVar('--text-light') || '#94a3b8' : cssVar('--text-secondary') || '#64748b', font: { family: "'Inter', sans-serif", size: 10 } } }
            }
        }
    });
}

// Fungsi Year Filter untuk Bar Chart Ref Year
function filterRefChart(range) {
    window.currentRefYearFilter = range;
    renderRefChartMode(window.currentRefChartMode || 'points', true);
}

// Fungsi Switch Tampilan Grafik Titik Nilai Data vs Baris Record Data
function switchRefChartView(mode) {
    window.currentRefChartMode = mode;
    renderRefChartMode(mode, true);
}

function renderRefChartMode(mode, animate = true) {
    if (!window.cachedRefChartData) return;
    const canvas = document.getElementById('dashboardRefYearChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    const btnPts = document.getElementById('btn-chart-view-points');
    const btnRows = document.getElementById('btn-chart-view-rows');
    const titleEl = document.getElementById('ref-chart-title');
    const subTitleEl = document.getElementById('ref-chart-subtitle');
    
    const isPoints = mode === 'points';
    
    if (btnPts && btnRows) {
        btnPts.classList.toggle('active', isPoints);
        btnRows.classList.toggle('active', !isPoints);
    }
    
    if (titleEl && subTitleEl) {
        if (isPoints) {
            titleEl.textContent = 'Sebaran Banyak Titik Nilai Data per Tahun';
            subTitleEl.textContent = 'Distribusi titik nilai sel data statistik berdasarkan tahun kejadian riil';
        } else {
            titleEl.textContent = 'Sebaran Baris Record Data per Tahun';
            subTitleEl.textContent = 'Distribusi baris entitas observasi per tahun kejadian riil';
        }
    }
    
    const dataset = isPoints ? window.cachedRefChartData.datasets[0] : window.cachedRefChartData.datasets[1];
    const isDark = document.documentElement.getAttribute('data-bs-theme') === 'dark';
    const tickColor = isDark ? cssVar('--text-light') || '#94a3b8' : cssVar('--text-secondary') || '#64748b';
    const gridColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)';

    // Apply year filter
    const _refRange = window.currentRefYearFilter || 'all';
    const _refN = _refRange === 'all' ? window.cachedRefChartData.labels.length : parseInt(_refRange);
    const _refLabels = window.cachedRefChartData.labels.slice(-_refN);
    const _refData = dataset.data.slice(-_refN);
    const _isTeal = isPoints;
    const _filteredDataset = { 
        ...dataset, 
        data: _refData,
        backgroundColor: _isTeal ? 'rgba(13, 148, 136, 0.82)' : (dataset.backgroundColor || 'rgba(16, 185, 129, 0.82)'),
        borderColor: _isTeal ? 'rgba(13, 148, 136, 1)' : (dataset.borderColor || 'rgba(16, 185, 129, 1)')
    };

    if (window.dashboardRefYearChartInstance && !animate) {
        window.dashboardRefYearChartInstance.data.labels = _refLabels;
        window.dashboardRefYearChartInstance.data.datasets = [_filteredDataset];
        window.dashboardRefYearChartInstance.update('none');
        return;
    }

    if (window.dashboardRefYearChartInstance) window.dashboardRefYearChartInstance.destroy();

    window.dashboardRefYearChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: _refLabels,
            datasets: [_filteredDataset]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animations: animate ? {
                y: {
                    type: 'number',
                    easing: 'easeOutQuart',
                    duration: 750,
                    from: (ctx) => {
                        if (typeof ctx.dataIndex === 'number' && ctx.chart && ctx.chart.scales && ctx.chart.scales.y) {
                            return ctx.chart.scales.y.getPixelForValue(0);
                        }
                    },
                    delay: (ctx) => (typeof ctx.dataIndex === 'number') ? ctx.dataIndex * 120 : 0
                }
            } : false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (ctx) => ` ${dataset.label}: ${ctx.raw.toLocaleString('id-ID')} ${isPoints ? 'Titik Nilai Data' : 'Baris Record'}`
                    }
                }
            },
            scales: {
                y: { 
                    beginAtZero: true, 
                    grid: { color: gridColor }, 
                    ticks: { color: tickColor, font: { family: "'Inter', sans-serif", size: 10 } } 
                },
                x: { 
                    grid: { display: false }, 
                    ticks: { color: tickColor, font: { family: "'Inter', sans-serif", size: 10 } } 
                }
            }
        }
    });
}



// Page 2: Publikasi List (Khusus Dokumen PDF)

async function loadDocuments() {

    const res = await fetch(`${API_BASE}/documents`);

    const docs = await res.json();

    const listEl = document.getElementById("docs-list");



    // Simpan input user saat ini (agar tidak hilang saat auto-refresh)

    const savedInputs = {};

    document.querySelectorAll("input[id^='start-']").forEach(inp => savedInputs[inp.id] = inp.value);

    document.querySelectorAll("input[id^='end-']").forEach(inp => savedInputs[inp.id] = inp.value);

    document.querySelectorAll("select[id^='select-bab-']").forEach(sel => savedInputs[sel.id] = sel.value);

    

    listEl.innerHTML = "";

    

    // Filter HANYA dokumen PDF asli (file .pdf). Dokumen hasil template Excel (.xlsx) dikelola di menu Import Excel.

    const pdfDocs = docs.filter(doc => (doc.filename || "").toLowerCase().endsWith(".pdf"));

    

    if (pdfDocs.length === 0) {

        listEl.innerHTML = `

            <div class="text-center py-4 text-muted">

                <i class="bi bi-file-earmark-pdf" style="font-size:2.2rem; opacity:0.4;"></i>

                <div class="mt-2 fw-semibold">Belum ada file buku PDF yang diunggah</div>

                <small class="text-muted">Unggah file PDF publikasi BPS melalui form di atas untuk mulai ekstraksi bab dan tabel.</small>

            </div>

        `;

        return;

    }

    

    pdfDocs.forEach(doc => {

        let statusBadge = '';

        if (doc.status === 'ready') statusBadge = '<span style="background:var(--badge-green-bg, #dcfce7);color:var(--badge-green-text, #15803d);padding:4px 10px;border-radius:20px;font-size:0.75rem;font-weight:700;">✓ Siap</span>';

        else if (doc.status.startsWith('extracting')) statusBadge = '<span style="background:var(--warning-light, #fef3c7);color:var(--warning-dark, #b45309);padding:4px 10px;border-radius:20px;font-size:0.75rem;font-weight:700;">⏳ Ekstraksi...</span>';

        else if (doc.status.startsWith('error')) statusBadge = `<span style="background:var(--danger-light, #fee2e2);color:var(--danger-dark, #b91c1c);padding:4px 10px;border-radius:20px;font-size:0.75rem;font-weight:700;" title="${escHtml(doc.status)}">⚠️ Gagal</span>`;

        else statusBadge = `<span style="background:var(--bg-hover, #f1f5f9);color:var(--text-secondary, #475569);padding:4px 10px;border-radius:20px;font-size:0.75rem;font-weight:700;">${doc.status.toUpperCase()}</span>`;



        let actionsHtml = "";

        if (doc.status === "ready" || doc.status.startsWith("error") || doc.status === "pending") {

            actionsHtml = `

                <div class="mt-2">

                    <select id="select-bab-${doc.id}" class="form-select form-select-sm">

                        <option value="">Memuat daftar bab...</option>

                    </select>

                </div>

                <div class="d-flex gap-2 mt-2 flex-wrap">

                    <button onclick="detectToc(${doc.id})" class="btn btn-success btn-sm">Deteksi Bab Otomatis</button>

                    <button onclick="openTocEditor(${doc.id}, '${doc.filename}')" class="btn btn-outline-primary btn-sm">Edit Bab Manual</button>

                </div>

                <div class="d-flex gap-2 mt-2 align-items-center flex-wrap">

                    <input type="number" id="start-${doc.id}" placeholder="Hal Awal" class="form-control form-control-sm" style="width:90px;">

                    <input type="number" id="end-${doc.id}" placeholder="Hal Akhir" class="form-control form-control-sm" style="width:90px;">

                    <button onclick="extractPages(${doc.id})" class="btn btn-primary btn-sm">Ekstrak</button>

                    <button onclick="deleteDocument(${doc.id})" class="btn btn-outline-danger btn-sm ms-auto">Hapus</button>

                </div>

            `;

        }

        

        listEl.innerHTML += `

            <div class="glass-panel p-3 mb-2">

                <div class="d-flex justify-content-between gap-2 align-items-start flex-wrap">

                    <div class="fw-semibold" style="word-break:break-all;">${doc.filename}</div>

                    <div class="d-flex gap-1.5 align-items-center flex-wrap">

                        <span class="badge bg-primary-subtle text-primary border" style="font-size:0.75rem; font-weight:600;">Publikasi ${doc.year}</span>

                        <span class="badge bg-light text-dark border" style="font-size:0.75rem; font-weight:600;">Data ${doc.year ? doc.year - 1 : '-'}</span>

                        ${statusBadge}

                    </div>

                </div>

                ${actionsHtml}

            </div>

        `;

    });

    

    // Kembalikan input user

    for (const [id, val] of Object.entries(savedInputs)) {

        const inp = document.getElementById(id);

        if (inp) inp.value = val;

    }



    // Panggil fungsi pembuat dropdown bab dinamis

    pdfDocs.forEach(doc => {

        if (doc.status === "ready" || doc.status.startsWith("error") || doc.status === "pending") {

            populateBabDropdown(doc.id);

        }

    });

}



