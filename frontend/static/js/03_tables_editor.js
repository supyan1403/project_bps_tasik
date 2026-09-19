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

                            if (idx === 0) return ` 📍 Basis Awal Terbit (Tahun ${window.cachedTrendChartData.labels[0]})`;

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

        else if (doc.status.startsWith('error')) statusBadge = `<span style="background:var(--danger-light, #fee2e2);color:var(--danger-dark, #b91c1c);padding:4px 10px;border-radius:20px;font-size:0.75rem;font-weight:700;" title="${escHtml(doc.status)}">⚠️ Gagal</span>`;

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



    // ===================== NAV BAR: Breadcrumb + Action Buttons =====================
    const navBar = document.createElement("div");
    navBar.className = "doc-breadcrumb";
    navBar.style.marginBottom = "1rem";
    navBar.style.fontSize = "0.95rem";
    navBar.style.padding = "0.75rem 1.25rem";
    navBar.style.borderRadius = "8px";
    navBar.style.background = "var(--bg-page, #f8fafc)";
    navBar.style.border = "1px solid var(--border, #e2e8f0)";
    navBar.style.display = "flex";
    navBar.style.justifyContent = "space-between";
    navBar.style.alignItems = "center";
    navBar.style.gap = "12px";
    navBar.style.flexWrap = "wrap";
    
    // KIRI: Breadcrumb links
    const bcLeft = document.createElement("div");
    bcLeft.style.display = "flex";
    bcLeft.style.alignItems = "center";
    bcLeft.style.gap = "8px";
    bcLeft.style.flexWrap = "wrap";
    
    let bcHTML = `<span class="doc-bc-link d-inline-flex align-items-center" style="cursor:pointer; color:var(--info, #2563eb); font-weight:600; padding:4px 8px; border-radius:6px;" onclick="viewState.selectedDocId=null; viewState.selectedBabNum=null; populateDocumentList();"><i class="bi bi-folder2 me-2 fs-6"></i> Semua Dokumen</span>`;
    
    const doc = docs.find(d => d.id === viewState.selectedDocId);
    if (viewState.selectedDocId && doc) {
        const pubLabel = doc.year ? `Publikasi ${doc.year}` : doc.filename;
        bcHTML += `<span style="color:#94a3b8;">/</span><span class="doc-bc-link" style="cursor:pointer; color:var(--info, #2563eb); font-weight:600; padding:4px 8px; border-radius:6px;" onclick="viewState.selectedBabNum=null; populateDocumentList();">${pubLabel}</span>`;
        if (viewState.selectedBabNum !== null) {
            const chapterTitle = getChapterTitle(viewState.selectedBabNum);
            const chapterSuffix = chapterTitle ? ` - ${chapterTitle}` : "";
            bcHTML += `<span style="color:#94a3b8;">/</span><span class="doc-bc-active" style="font-weight:600; padding:4px 8px; color:var(--text-primary, #0f172a);">Bab ${viewState.selectedBabNum}${chapterSuffix}</span>`;
        }
    }
    bcLeft.innerHTML = bcHTML;
    navBar.appendChild(bcLeft);
    
    // KANAN: Action buttons
    const bcRight = document.createElement("div");
    bcRight.style.display = "flex";
    bcRight.style.alignItems = "center";
    bcRight.style.gap = "8px";
    bcRight.style.flexWrap = "wrap";
    
    if (viewState.selectedDocId && doc && viewState.selectedBabNum === null) {
        bcRight.innerHTML = `
            <button onclick="openCreateBabModal(${doc.id})" class="btn btn-sm btn-primary fw-semibold px-3 py-1.5 rounded-3 d-inline-flex align-items-center gap-1.5 shadow-sm">
                <i class="bi bi-folder-plus"></i> Tambah Bab
            </button>
            <button onclick="openCreateTableModal(${doc.id})" class="btn btn-sm fw-semibold px-3 py-1.5 rounded-3 d-inline-flex align-items-center gap-1.5 shadow-sm" style="background:#059669; border-color:#059669; color:white;">
                <i class="bi bi-plus-circle-fill"></i> Tambah Tabel
            </button>
            <button onclick="deleteAllTablesForDoc(${doc.id}, '${doc.filename.replace(/'/g, "\'")}')" class="btn btn-sm btn-outline-danger fw-semibold px-3 py-1.5 rounded-3 d-inline-flex align-items-center gap-1.5">
                <i class="bi bi-trash"></i> Hapus Semua
            </button>
        `;
    } else if (viewState.selectedDocId && doc && viewState.selectedBabNum !== null) {
        bcRight.innerHTML = `
            <button onclick="openCreateTableModal(${doc.id}, ${viewState.selectedBabNum})" class="btn btn-sm fw-semibold px-3 py-1.5 rounded-3 d-inline-flex align-items-center gap-1.5 shadow-sm" style="background:#059669; border-color:#059669; color:white;">
                <i class="bi bi-plus-circle-fill"></i> Tambah Tabel
            </button>
            <button onclick="deleteAllTablesForBab(${doc.id}, ${viewState.selectedBabNum})" class="btn btn-sm btn-outline-danger fw-semibold px-3 py-1.5 rounded-3 d-inline-flex align-items-center gap-1.5">
                <i class="bi bi-trash"></i> Hapus Tabel Bab
            </button>
        `;
    } else {
        bcRight.innerHTML = `
            <button onclick="openCreateTableModal()" class="btn btn-sm fw-semibold px-3 py-1.5 rounded-3 d-inline-flex align-items-center gap-1.5 shadow-sm" style="background:#059669; border-color:#059669; color:white;">
                <i class="bi bi-plus-circle-fill"></i> Tambah Tabel Baru
            </button>
            <button onclick="openCreateDocModal()" class="btn btn-sm btn-outline-primary fw-semibold px-3 py-1.5 rounded-3 d-inline-flex align-items-center gap-1.5">
                <i class="bi bi-journal-plus"></i> Publikasi Baru
            </button>
        `;
    }
    navBar.appendChild(bcRight);
    container.appendChild(navBar);

    

    if (!viewState.selectedDocId) {

        // LEVEL 1: Tampilkan Grid Dokumen
        const grid = document.createElement("div");
        grid.className = "doc-folder-grid";
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

                card.onclick = (e) => {
                    if (e.target.closest('.doc-action-btn') || e.target.closest('button')) return;
                    viewState.selectedDocId = d.id;
                    viewState.selectedBabNum = null;
                    renderDocLevelSkeleton(d.year ? `Publikasi ${d.year}` : d.filename);
                    populateDocumentList();
                };

                let loadingBadge = '';
                if (d.status.startsWith('extracting')) {
                    loadingBadge = `
                        <div style="position:absolute; top:15px; right:15px; display:flex; align-items:center; gap:6px; background:#fffbeb; color:#b45309; padding:4px 10px; border-radius:20px; font-size:0.8rem; font-weight:700; border:1px solid #fcd34d; box-shadow:0 2px 4px rgba(0,0,0,0.05); z-index:5;">
                            <div style="width:12px; height:12px; border:2px solid #fcd34d; border-top-color:#b45309; border-radius:50%; animation:spin 1s linear infinite;"></div>
                            <style>@keyframes spin { 100% { transform: rotate(360deg); } }</style>
                            Mengekstrak...
                        </div>`;
                }

                const actionButtons = `
                    <div class="doc-card-actions" style="position:absolute; top:12px; right:12px; display:flex; gap:6px; z-index:5;" onclick="event.stopPropagation()">
                        <button class="doc-action-btn btn-edit" title="Edit Publikasi" onclick="openEditDocModal(${d.id}, ${d.year || "null"}, ${d.data_year !== null && d.data_year !== undefined ? d.data_year : "null"}, '${_escJs(d.filename || '')}')">
                            <i class="bi bi-pencil" style="font-size:0.8rem;"></i>
                        </button>
                        <button class="doc-action-btn btn-delete" title="Hapus Publikasi" onclick="deleteDocument(${d.id})">
                            <i class="bi bi-trash" style="font-size:0.8rem;"></i>
                        </button>
                    </div>
                `;

                const pubTitle = d.year ? `Publikasi ${d.year}` : d.filename;
                const tableBadge = d.table_count !== undefined 
                    ? `<span class="doc-card-badge" style="color:var(--info, #2563eb); font-weight:600; font-size:0.78rem; background:#eff6ff; border:1px solid #bfdbfe; padding:3px 8px; border-radius:20px; white-space:nowrap;">${d.table_count} Tabel</span>` 
                    : '';

                const dataYearVal = (d.data_year !== null && d.data_year !== undefined) ? d.data_year : (d.year ? d.year - 1 : '-');

                card.innerHTML = `
                    ${loadingBadge ? loadingBadge : actionButtons}
                    <div class="doc-card-content-wrap" style="text-align:center; width:100%;">
                        <div class="doc-icon-wrapper"><i class="bi bi-folder2-open text-primary" style="font-size:2rem;"></i></div>
                        <h3 class="doc-card-title" style="margin:0 0 0.6rem 0; font-size:1.25rem; font-weight:700; word-break:break-word; line-height:1.4; color:var(--text-primary, #0f172a);">${pubTitle}</h3>
                    </div>
                    <div class="doc-card-badges-container" style="display:flex; justify-content:center; align-items:center; gap:5px; flex-wrap:nowrap; margin-top:12px; width:100%;">
                        <span class="doc-card-badge" style="font-size:0.78rem; padding:3px 8px; border-radius:20px; font-weight:600; background:#e0f2fe; color:#0369a1; white-space:nowrap;">Publikasi ${d.year || '-'}</span>
                        <span class="doc-card-badge" style="font-size:0.78rem; padding:3px 8px; border-radius:20px; font-weight:600; background:#f1f5f9; color:#334155; white-space:nowrap;">Data ${dataYearVal}</span>
                        ${tableBadge}
                    </div>
                `;

                grid.appendChild(card);
            }
        }

        if (grid.children.length === 0) {
            grid.innerHTML = `<p style="color:var(--text-secondary, #64748b); font-style:italic;">Belum ada dokumen yang siap dilihat.</p>`;
        }

        container.appendChild(grid);

    } 

    else {

        const d = docs.find(doc => doc.id === viewState.selectedDocId);

        if (!d) {

            viewState.selectedDocId = null;

            return populateDocumentList();

        }

        

        let tables = preloadedTables;
        if (!tables) {
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
            tables = await tRes.json();
            loadingDiv.remove();
        }

        

        if (d.status.startsWith('extracting')) {

            const loadingBanner = document.createElement("div");

            loadingBanner.style.background = "var(--warning-light, #fffbeb)";

            loadingBanner.style.border = "1px solid #fcd34d";

            loadingBanner.style.color = "var(--warning-dark, #b45309)";

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

        

        // Group tables by Bab
        const grouped = {};

        // 1. Masukkan bab dari docChapters (TOC dokumen)
        if (docChapters) {
            Object.keys(docChapters).forEach(rawNum => {
                const bNum = parseInt(rawNum, 10);
                if (!isNaN(bNum)) {
                    let chapterTitle = getChapterTitle(bNum) || "";
                    chapterTitle = chapterTitle.replace(/^Bab\s+\d+\s*[\-\–\—\.\:]\s*/i, '').trim();
                    if (!chapterTitle || chapterTitle.toLowerCase() === `bab ${bNum}`) {
                        chapterTitle = getBpsStandardTitle(bNum) || `Bab ${bNum}`;
                    }
                    const chapterSuffix = chapterTitle ? ` - ${chapterTitle}` : "";
                    grouped[bNum] = { 
                        name: `Bab ${bNum}${chapterSuffix}`, 
                        cleanTitle: chapterTitle, 
                        num: bNum, 
                        tables: [] 
                    };
                }
            });
        }

        // 2. Petakan tabel ke masing-masing bab
        tables.forEach(t => {
            const match = t.table_name.match(/Tabel[\s_]*(\d+)/i);
            let babName = "Lainnya";
            let cleanTitle = "Lainnya";
            let babNum = 999;
            if (match && match[1]) {
                babNum = parseInt(match[1], 10);
                let chapterTitle = getChapterTitle(babNum) || "";
                chapterTitle = chapterTitle.replace(/^Bab\s+\d+\s*[\-\–\—\.\:]\s*/i, '').trim();
                if (!chapterTitle || chapterTitle.toLowerCase() === `bab ${babNum}`) {
                    chapterTitle = getBpsStandardTitle(babNum) || `Bab ${babNum}`;
                }
                const chapterSuffix = chapterTitle ? ` - ${chapterTitle}` : "";
                babName = `Bab ${babNum}${chapterSuffix}`;
                cleanTitle = chapterTitle;
            }
            if (!grouped[babNum]) grouped[babNum] = { name: babName, cleanTitle: cleanTitle, num: babNum, tables: [] };
            grouped[babNum].tables.push(t);
        });

        if (Object.keys(grouped).length === 0) {
            let msg = d.status.startsWith('extracting') ? "Mohon tunggu sebentar, tabel pertama sedang diekstrak..." : "Belum ada bab atau tabel di publikasi ini. Klik tombol '+ Tambah Bab' atau '+ Tambah Tabel' di atas untuk memulai.";
            const emptyDiv = document.createElement("div");
            emptyDiv.style.textAlign = "center";
            emptyDiv.style.padding = "3rem";
            emptyDiv.className = "doc-empty-state";
            emptyDiv.style.borderRadius = "12px";
            emptyDiv.innerHTML = `<p style="font-style:italic; font-size:1.1rem; margin:0;">${msg}</p>`;
            container.appendChild(emptyDiv);
            return;
        }

        

        if (viewState.selectedBabNum === null) {

            // LEVEL 2: Tampilkan Grid Bab
            const grid = document.createElement("div");
            grid.className = "doc-chapter-grid";
            grid.style.display = "grid";
            grid.style.gridTemplateColumns = "repeat(auto-fill, minmax(280px, 1fr))";
            grid.style.gap = "1.5rem";

            const sortedBabs = Object.values(grouped).sort((a, b) => a.num - b.num);

            sortedBabs.forEach(bab => {
                const card = document.createElement("div");
                card.className = "doc-chapter-card";
                card.style.borderRadius = "16px";
                card.style.padding = "1.5rem 1.25rem";
                card.style.cursor = "pointer";
                card.style.display = "flex";
                card.style.flexDirection = "column";
                card.style.justifyContent = "space-between";
                card.style.alignItems = "center";
                card.style.minHeight = "215px";

                card.onclick = (e) => {
                    if (e.target.closest('button') || e.target.closest('.btn')) return;
                    viewState.selectedBabNum = bab.num;
                    populateDocumentList();
                };

                const safeTitle = _escJs(bab.cleanTitle || bab.name);

                let cardHTML = `
                    <div class="doc-chapter-content-wrap" style="text-align:center; width:100%; display:flex; flex-direction:column; align-items:center;">
                        <div class="doc-bab-badge mb-1" style="font-size: 0.84rem; font-weight: 600; color: var(--primary, #2563eb);">
                            Bab ${bab.num}
                        </div>
                        <h4 class="doc-card-title mb-2" style="font-size: 1.08rem; font-weight: 700; color: var(--text-primary, #0f172a); line-height: 1.35; height: 2.85rem; display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; margin: 0; text-align: center;" title="${escHtml(bab.cleanTitle || bab.name)}">
                            ${escHtml(bab.cleanTitle || bab.name)}
                        </h4>
                        <div>
                            <span class="badge bg-light text-secondary border fw-medium px-2.5 py-1 rounded-pill" style="font-size: 0.74rem;">
                                ${bab.tables.length} Tabel
                            </span>
                        </div>
                    </div>
                `;

                const actionBtns = `
                    <div class="doc-chapter-actions-wrap d-flex justify-content-center align-items-center gap-2 mt-auto w-100" onclick="event.stopPropagation()">
                        <button class="btn btn-sm btn-outline-primary rounded-pill px-3 py-1" style="font-size:0.8rem; font-weight:600;" onclick="editBabTitle(${d.id}, ${bab.num}, '${safeTitle}')">
                            <i class="bi bi-pencil me-1"></i> Edit Bab
                        </button>
                        <button class="btn btn-sm btn-outline-danger rounded-pill px-3 py-1" style="font-size:0.8rem; font-weight:600;" onclick="deleteBab(${d.id}, ${bab.num}, '${safeTitle}')">
                            <i class="bi bi-trash me-1"></i> Hapus
                        </button>
                    </div>
                `;

                card.innerHTML = cardHTML + actionBtns;
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

            if (bab.tables.length === 0) {
                const emptyBabDiv = document.createElement("div");
                emptyBabDiv.className = "text-center p-5 rounded-3 border bg-card";
                emptyBabDiv.innerHTML = `
                    <div class="text-muted mb-3" style="font-size: 0.95rem;">Belum ada tabel di <strong>${escHtml(bab.name)}</strong>.</div>
                    <button onclick="openCreateTableModal(${d.id}, ${bab.num})" class="btn btn-sm fw-semibold px-3.5 py-2 rounded-3 d-inline-flex align-items-center gap-2 shadow-sm text-white" style="background:#059669; border-color:#059669;">
                        <i class="bi bi-plus-circle-fill"></i> Tambah Tabel ke Bab Ini
                    </button>
                `;
                container.appendChild(emptyBabDiv);
                return;
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
                    <div class="doc-table-title-container">
                        <div class="doc-card-title d-flex align-items-center flex-wrap" style="line-height: 1.5; white-space: normal;">
                            ${renderCleanTableTitleHtml(t.table_name)}
                        </div>
                    </div>

                    <div class="doc-table-actions">

                        <!-- Quick Snippet & Tren -->

                        <button onclick="openTableSnippet(${t.id})" class="btn btn-sm btn-light border" style="font-weight:600; font-size:0.75rem; padding:4px 9px; border-radius:6px; color:var(--info, #0284c7); background:#f0f9ff; border-color:#bae6fd !important; display:inline-flex; align-items:center; gap:4px;" title="Lihat pratinjau ringkas 5 baris">

                            <i class="bi bi-eye me-1"></i> Snippet

                        </button>

                        <button onclick="openTimeSeriesForTable(${t.id}, '${t.table_name.replace(/'/g, "\\'")}')" class="btn btn-sm btn-light border" style="font-weight:600; font-size:0.75rem; padding:4px 9px; border-radius:6px; color:var(--warning, #d97706); background:var(--warning-light, #fffbeb); border-color:#fde68a !important; display:inline-flex; align-items:center; gap:4px;" title="Buka analisis grafik deret waktu">

                            <i class="bi bi-graph-up-arrow"></i> Tren

                        </button>



                        <!-- Tombol Aksi Data Terpisah -->

                        <button onclick="previewCsv(${t.id}, '${t.table_name.replace(/'/g, "\\'")}')" class="btn btn-sm btn-light border" style="font-weight:600; font-size:0.75rem; padding:4px 10px; border-radius:6px; color:var(--text-secondary, #475569); background:#f8fafc; border-color:#cbd5e1 !important; display:inline-flex; align-items:center; gap:4px;" title="Lihat Data Tabel">

                            <i class="bi bi-table me-1"></i> Lihat Data

                        </button>

                        <button onclick="previewCsvEditor(${t.id}, '${t.table_name.replace(/'/g, "\\'")}')" class="btn btn-sm btn-primary" style="font-weight:600; font-size:0.75rem; padding:4px 10px; border-radius:6px; display:inline-flex; align-items:center; gap:4px; box-shadow: 0 1px 2px rgba(79, 70, 229, 0.2);" title="Edit Data Tabel (Tersimpan ke Database)">

                            <i class="bi bi-pencil-square me-1"></i> Edit Data

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

        confirmButtonColor: cssVar('--danger') || cssVar('--danger') || '#ef4444',

        cancelButtonColor: cssVar('--swal-cancel') || cssVar('--text-muted') || '#cbd5e1',

        confirmButtonText: 'Ya, Hapus',

        cancelButtonText: 'Batal',

        showLoaderOnConfirm: true,

        preConfirm: async () => {

            try {

                const res = await fetch(`${API_BASE}/tables/${tableId}`, { method: "DELETE" });

                if (!res.ok) throw new Error("Gagal menghapus");

                await populateDocumentList();
                notifyDataChange('document');

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
            notifyDataChange('table');

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



window.__tableDataCache = window.__tableDataCache || {};

async function _loadDbIntoEditor(tableId, tableName) {
    const thead = document.getElementById("data-grid-head");
    const tbody = document.getElementById("data-grid-body");

    let payload = window.__tableDataCache[tableId];

    if (!payload) {
        showLoadingModal("Membuka Data Tabel...", "Memuat data baris dan struktur kolom...");
        thead.innerHTML = "<tr><th colspan='20' style='color:var(--text-secondary, #64748b); text-align:center; padding:1.25rem;'><span class='spinner-border spinner-border-sm text-primary me-2' role='status'></span>Memuat data dari database...</th></tr>";
        tbody.innerHTML = "";

        try {
            const res = await fetch(`${API_BASE}/tables/${tableId}/data`);
            payload = await res.json();
            window.__tableDataCache[tableId] = payload;
        } catch(err) {
            thead.innerHTML = `<tr><th style="color:red">Error: ${err.message}</th></tr>`;
            hideLoadingModal();
            return;
        } finally {
            hideLoadingModal();
        }
    }

    try {
        const rows = payload.rows || [];

        const headers = (payload.headers && payload.headers.length > 0)

            ? payload.headers

            : (rows.length > 0 ? Object.keys(rows[0].data) : []);

        const units = payload.units || [];

        const years = payload.years || [];



        thead.innerHTML = ""; tbody.innerHTML = "";



        if (rows.length === 0) {

            thead.innerHTML = "<tr><th>—</th></tr>";

            tbody.innerHTML = `<tr><td style='color:var(--text-secondary, #64748b); padding:2rem; text-align:center;'>Belum ada data di database. Gunakan tombol <b>Load CSV</b> terlebih dahulu dari halaman Daftar Tabel.</td></tr>`;

            return;

        }



        const colTypes = (data && data.column_types) || headers.map((h, idx) => idx === 0 ? 'text' : 'number');

        const formattedHeaders = headers.map((h, idx) => {

            let displayHeader = h.replace(/\.\d+$/, ''); // Strip pandas duplicate suffix (.1)

            const unit = units[idx] != null ? String(units[idx]).trim() : "";
            const year = years[idx] != null ? String(years[idx]).trim() : "";

            const skipUnit = !unit || unit === "-" || unit.toLowerCase() === "satuan";
            const skipYear = !year || year === "-" || year.toLowerCase() === "tahun";

            if (!skipUnit || !skipYear) {
                let suffix = "";
                if (!skipUnit) suffix += unit;
                if (!skipYear) suffix += suffix ? `, ${year}` : year;
                if (suffix) displayHeader += ` (${suffix})`;
            }

            const colType = colTypes[idx] || (idx === 0 ? 'text' : 'number');
            const typeBadge = colType === 'number'
                ? `<span class="col-type-tag type-num" title="Tipe Kolom: Angka / Nilai Statistik BPS">123</span>`
                : `<span class="col-type-tag type-txt" title="Tipe Kolom: Teks / Label Wilayah">Abc</span>`;

            return `<th data-key="${h.replace(/"/g, '&quot;')}"><div class="th-header-cell"><span class="th-text">${displayHeader}</span>${typeBadge}</div></th>`;

        }).join("");

        thead.innerHTML = `<tr><th>Aksi</th>${formattedHeaders}</tr>`;

        rows.forEach(row => {

            const tr = document.createElement("tr");

            tr.id = `row-${row.id}`;

            if(row.is_anomaly) tr.classList.add("row-anomaly");

            const safeBtn = row.is_anomaly 

                ? `<button onclick="markRowSafe(${row.id}, ${tableId}, '${tableName.replace(/'/g, "\\'")}')" class="btn-row-safe" style="background:var(--success, #10b981); border:1px solid var(--success, #10b981); color:white; padding:3px 6px; border-radius:4px; font-size:0.75rem; cursor:pointer; margin-left:4px; font-weight:600;">Aman</button>`

                : '';

            let html = `<td><div class="row-action-cell"><button onclick="deleteRow(${row.id})" class="btn-row-del">Hapus</button>${safeBtn}</div></td>`;

            headers.forEach((h, idx) => {

                let val = row.data[h] != null ? row.data[h] : "";

                if (idx === 0) val = normalizeEntityName(val);

                const colType = colTypes[idx] || (idx === 0 ? 'text' : 'number');

                html += `<td class="editable-cell" contenteditable="plaintext-only" data-type="${colType}" data-col="${h.replace(/"/g, '&quot;')}" onblur="handleCellBlur(${row.id}, '${h.replace(/'/g, "\\'")}', this)" onkeydown="if(event.key === 'Enter') { event.preventDefault(); this.blur(); }">${val}</td>`;

            });

            tr.innerHTML = html;
            tbody.appendChild(tr);
        });
    } catch(err) {
        thead.innerHTML = `<tr><th style="color:red">Error: ${err.message}</th></tr>`;
    } finally {
        hideLoadingModal();
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



async function handleCellBlur(rowId, column, cellElem) {
    const colType = cellElem.getAttribute('data-type') || 'text';
    let val = cellElem.innerText.trim();

    if (colType === 'number' && val !== '') {
        const isBpsSymbol = /^(\-|--|\.\.\.|n\.a|na|0)$/i.test(val);
        const cleanNum = val.replace(/\./g, '').replace(/,/g, '.').replace(/\s/g, '');
        const isNumeric = !isNaN(Number(cleanNum)) && cleanNum !== '';

        if (!isBpsSymbol && !isNumeric) {
            cellElem.classList.add('cell-invalid-type');
            if (typeof showToast === 'function') {
                showToast('warning', 'Perhatian Format Data', `Kolom "${column}" bertipe Angka. Masukkan nilai angka atau simbol data BPS (- / ...).`);
            }
            setTimeout(() => cellElem.classList.remove('cell-invalid-type'), 3500);
        } else {
            cellElem.classList.remove('cell-invalid-type');
        }
    }

    await updateCell(rowId, column, val);
}

async function updateCell(rowId, column, newValue) {
    const tr = document.getElementById(`row-${rowId}`);
    if (!tr) return;

    const thElements = Array.from(document.getElementById("data-grid-head").querySelector("tr").children).slice(1);
    const headers = thElements.map(th => th.getAttribute('data-key') || th.innerText.trim());
    const cells = Array.from(tr.children).slice(1);

    const newData = {};
    headers.forEach((h, idx) => { 
        if (cells[idx]) {
            newData[h] = cells[idx].innerText.trim(); 
        }
    });

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

        confirmButtonColor: cssVar('--danger') || cssVar('--danger') || '#ef4444',

        cancelButtonColor: cssVar('--swal-cancel') || cssVar('--text-muted') || '#cbd5e1',

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
            notifyDataChange('table_data');

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

        confirmButtonColor: cssVar('--success') || cssVar('--success-emerald') || '#10b981',

        cancelButtonColor: cssVar('--swal-cancel') || cssVar('--text-muted') || '#cbd5e1',

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
                    notifyDataChange('table_data');

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

async function previewCsv(tableId, tableName, highlightCol) {

    navigateToEditor(tableId, tableName, 'csv-view');

    buildEditorToolbar(tableId, tableName, 'csv-view');

    await _loadCsvIntoEditor(tableId, tableName, false, highlightCol);

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

async function _loadCsvIntoEditor(tableId, tableName, isEditable = false, highlightCol) {

    const pe = document.getElementById('page-editor');
    if (pe) {
        pe.classList.remove('mode-view', 'mode-edit');
        pe.classList.add(isEditable ? 'mode-edit' : 'mode-view');
    }

    // Reset col-delete-bar

    const colBar = document.getElementById("col-delete-bar");

    const colBarBtns = document.getElementById("col-delete-bar-buttons");

    if (colBar) { colBar.classList.remove('visible'); if(colBarBtns) colBarBtns.innerHTML = ""; }



    const thead = document.getElementById("data-grid-head");

    const tbody = document.getElementById("data-grid-body");

    thead.innerHTML = "<tr><th colspan='20' style='color:var(--text-secondary, #64748b); padding:1.25rem; text-align:center; font-weight:500;'><span class='spinner-border spinner-border-sm text-primary me-2' role='status'></span>Memuat Data Tabel...</th></tr>";

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

                        <th class="editable-header-wrapper" style="min-width: 170px; padding: 0.75rem 0.5rem; text-align: left; border-bottom: 2px solid var(--swal-cancel, #cbd5e1); background: var(--bg-page, #f8fafc);">

                            <div style="margin-bottom: 6px;">

                                <label style="font-size: 0.68rem; font-weight: 700; color: #64748b; display: block; margin-bottom: 2px;">NAMA KOLOM</label>

                                <input type="text" class="header-name-input" value="${h}" onchange="onHeaderNameChange(${idx}, this.value)" style="width: 100%; padding: 4px 6px; font-size: 0.8rem; font-weight: 600; border-radius: 4px; border: 1px solid var(--swal-cancel, #cbd5e1); outline:none; font-family: 'Inter', sans-serif;">

                            </div>

                            <div style="display: flex; gap: 4px; margin-bottom: 8px;">

                                <div style="flex: 1;">

                                    <label style="font-size: 0.65rem; font-weight: 700; color: #64748b; display: block; margin-bottom: 2px;">SATUAN</label>

                                    <input type="text" class="header-unit-input" value="${unit}" onchange="updateCsvUnitLocal(${idx}, this.value)" placeholder="e.g. Jiwa" style="width: 100%; padding: 3px 6px; font-size: 0.75rem; border-radius: 4px; border: 1px solid var(--swal-cancel, #cbd5e1); outline:none; font-family: 'Inter', sans-serif; background: white;">

                                </div>

                                <div style="width: 65px;">

                                    <label style="font-size: 0.65rem; font-weight: 700; color: #64748b; display: block; margin-bottom: 2px;">TAHUN</label>

                                    <input type="text" class="header-year-input" value="${year}" onchange="updateCsvYearLocal(${idx}, this.value)" placeholder="e.g. 2025" style="width: 100%; padding: 3px 6px; font-size: 0.75rem; border-radius: 4px; border: 1px solid var(--swal-cancel, #cbd5e1); outline:none; font-family: 'Inter', sans-serif; background: white;">

                                </div>

                            </div>

                            <div style="display: flex; gap: 4px; justify-content: center; padding-top: 6px; border-top: 1px dashed var(--border, #e2e8f0);">

                                <button onclick="insertCsvColBelowLocal(${idx})" class="btn-row-insert" style="padding: 3px 8px; font-size: 0.72rem; border-radius: 4px; border: 1px solid var(--swal-cancel, #cbd5e1); background: #f1f5f9; color: #475569; cursor: pointer; transition: all 0.15s;" onmouseenter="this.style.background=cssVar('--border') || '#e2e8f0'; this.style.color=cssVar('--text-primary') || '#1e293b'" onmouseleave="this.style.background=cssVar('--bg-hover') || '#f1f5f9'; this.style.color=cssVar('--text-tertiary') || '#475569'">Sisip</button>

                                <button onclick="deleteCsvColumnLocal(${idx})" class="btn-row-del" style="padding: 3px 8px; font-size: 0.72rem; border-radius: 4px; border: 1px solid #fca5a5; background: var(--danger-light, #fee2e2); color: var(--danger-dark, #b91c1c); cursor: pointer; transition: all 0.15s;" onmouseenter="this.style.background=cssVar('--danger-light-bg') || '#fecaca'; this.style.color=cssVar('--danger-hover') || '#991b1b'" onmouseleave="this.style.background=cssVar('--danger-light') || '#fee2e2'; this.style.color=cssVar('--danger-text') || '#b91c1c'">Hapus</button>

                            </div>

                            ${isAnom ? `

                            <div style="position: absolute; top: 2px; right: 2px; display: flex; gap: 4px; align-items: center; z-index: 10;">

                                <div style="padding: 2px 4px; background: #fef2f2; border: 1px solid #fecaca; border-radius: 4px;" title="Terdeteksi Anomali">

                                    <span style="color:var(--danger, #dc2626); font-size:0.65rem; font-weight:700;">⚠️</span>

                                </div>

                                <button onclick="dismissColumnAnomalyLocal(${tableId}, ${idx}, '${h.replace(/'/g, "\\'")}')" style="background:var(--success, #22c55e); border:1px solid var(--success-hover, #16a34a); color:white; padding:2px 5px; font-size:0.65rem; border-radius:4px; cursor:pointer; font-weight:600; line-height: 1;" title="Tandai Aman">Aman</button>

                            </div>` : ''}

                        </th>`;

                    }).join("")}

                </tr>`;

            } else {

                // View mode: header digabung menjadi "Nama Kolom (Satuan, Tahun)" jika ada metadatanya

                thead.innerHTML = `<tr>${data.headers.map((h, idx) => {

                    const unit = data.units && data.units[idx] != null ? String(data.units[idx]).trim() : "";
                    const year = data.years && data.years[idx] != null ? String(data.years[idx]).trim() : "";

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

                    

                    return `<th data-col-name="${escHtml(h.toLowerCase())}">${isAnom ? '⚠️ ' : ''}${displayHeader}</th>`;

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

                        html += `<td class="editable-cell" contenteditable="plaintext-only" data-type="${cellIdx === 0 ? 'text' : 'number'}" onkeydown="if(event.key === 'Enter') { event.preventDefault(); this.blur(); }">${val}</td>`;

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

            tbody.innerHTML = `<tr><td colspan="${colSpan}" style="text-align:center;color:var(--text-secondary, #64748b);padding:2rem;">Tidak ada baris data.</td></tr>`;

        }

        // === Column highlight: apply when navigated from search results ===
        if (highlightCol && !isEditable) {
            setTimeout(() => {
                const target = highlightCol.toLowerCase().trim();
                if (!target) return;
                const ths = document.querySelectorAll('#data-grid-head th[data-col-name]');
                for (const th of ths) {
                    if (th.getAttribute('data-col-name').includes(target) || target.includes(th.getAttribute('data-col-name'))) {
                        th.classList.add('col-highlight');
                        th.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
                        const colIdx = Array.from(th.parentNode.children).indexOf(th);
                        document.querySelectorAll('#data-grid-body tr').forEach(tr => {
                            const td = tr.children[colIdx];
                            if (td) td.classList.add('col-cell-highlight');
                        });
                        break;
                    }
                }
            }, 150);
        }

    } catch (err) {

        thead.innerHTML = `<tr><th style="color:red">Error: ${err.message}</th></tr>`;

    }

}



/** Rename a CSV column header by clicking on it */

async function renameCsvColumn(tableId, colIndex, tableName) {

    const th = document.querySelector(`#data-grid-head tr th.editable-header:nth-child(${colIndex + 2})`);

    const currentName = th ? th.innerText.replace('✏️¯¸', '').trim() : `Kolom ${colIndex + 1}`;



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

        confirmButtonColor: cssVar('--danger') || cssVar('--danger') || '#ef4444',

        cancelButtonColor: cssVar('--swal-cancel') || cssVar('--text-muted') || '#cbd5e1',

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

            <p style="margin-bottom:12px; color:var(--text-secondary, #475569); font-size:0.95rem;">

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

        html += `<td class="editable-cell" contenteditable="plaintext-only" data-type="${i === 0 ? 'text' : 'number'}" onkeydown="if(event.key === 'Enter') { event.preventDefault(); this.blur(); }"></td>`;

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

    newTh.style.cssText = "min-width: 170px; padding: 0.75rem 0.5rem; text-align: left; border-bottom: 2px solid var(--swal-cancel, #cbd5e1); background: var(--bg-page, #f8fafc);";

    

    const isDim = false;

    const unitVal = "";

    const yearVal = "";



    newTh.innerHTML = `

        <div style="margin-bottom: 6px;">

            <label style="font-size: 0.68rem; font-weight: 700; color: #64748b; display: block; margin-bottom: 2px;">NAMA KOLOM</label>

            <input type="text" class="header-name-input" value="${colName.trim()}" onchange="onHeaderNameChange(0, this.value)" style="width: 100%; padding: 4px 6px; font-size: 0.8rem; font-weight: 600; border-radius: 4px; border: 1px solid var(--swal-cancel, #cbd5e1); outline:none; font-family: 'Inter', sans-serif;">

        </div>

        <div style="display: flex; gap: 4px; margin-bottom: 8px;">

            <div style="flex: 1;">

                <label style="font-size: 0.65rem; font-weight: 700; color: #64748b; display: block; margin-bottom: 2px;">SATUAN</label>

                <input type="text" class="header-unit-input" value="${unitVal}" onchange="updateCsvUnitLocal(0, this.value)" placeholder="e.g. Jiwa" style="width: 100%; padding: 3px 6px; font-size: 0.75rem; border-radius: 4px; border: 1px solid var(--swal-cancel, #cbd5e1); outline:none; font-family: 'Inter', sans-serif; background: white;">

            </div>

            <div style="width: 65px;">

                <label style="font-size: 0.65rem; font-weight: 700; color: #64748b; display: block; margin-bottom: 2px;">TAHUN</label>

                <input type="text" class="header-year-input" value="${yearVal}" onchange="updateCsvYearLocal(0, this.value)" placeholder="e.g. 2025" style="width: 100%; padding: 3px 6px; font-size: 0.75rem; border-radius: 4px; border: 1px solid var(--swal-cancel, #cbd5e1); outline:none; font-family: 'Inter', sans-serif; background: white;">

            </div>

        </div>

        <div style="display: flex; gap: 4px; justify-content: center; padding-top: 6px; border-top: 1px dashed var(--border, #e2e8f0);">

            <button class="btn-row-insert" style="padding: 3px 8px; font-size: 0.72rem; border-radius: 4px; border: 1px solid var(--swal-cancel, #cbd5e1); background: #f1f5f9; color: #475569; cursor: pointer; transition: all 0.15s;" onmouseenter="this.style.background=cssVar('--border') || '#e2e8f0'; this.style.color=cssVar('--text-primary') || '#1e293b'" onmouseleave="this.style.background=cssVar('--bg-hover') || '#f1f5f9'; this.style.color=cssVar('--text-tertiary') || '#475569'">Sisip</button>

            <button class="btn-row-del" style="padding: 3px 8px; font-size: 0.72rem; border-radius: 4px; border: 1px solid #fca5a5; background: var(--danger-light, #fee2e2); color: var(--danger-dark, #b91c1c); cursor: pointer; transition: all 0.15s;" onmouseenter="this.style.background=cssVar('--danger-light-bg') || '#fecaca'; this.style.color=cssVar('--danger-hover') || '#991b1b'" onmouseleave="this.style.background=cssVar('--danger-light') || '#fee2e2'; this.style.color=cssVar('--danger-text') || '#b91c1c'">Hapus</button>

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

        newTd.contentEditable = "plaintext-only";
        newTd.setAttribute("data-type", "number");

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
            notifyDataChange('table_data');

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

            <th class="editable-header-wrapper" style="min-width: 170px; padding: 0.75rem 0.5rem; text-align: left; border-bottom: 2px solid var(--swal-cancel, #cbd5e1); background: var(--bg-page, #f8fafc);">

                <div style="margin-bottom: 6px;">

                    <label style="font-size: 0.68rem; font-weight: 700; color: #64748b; display: block; margin-bottom: 2px;">NAMA KOLOM</label>

                    <input type="text" class="header-name-input" value="${h}" onchange="onHeaderNameChange(${idx}, this.value)" style="width: 100%; padding: 4px 6px; font-size: 0.8rem; font-weight: 600; border-radius: 4px; border: 1px solid var(--swal-cancel, #cbd5e1); outline:none; font-family: 'Inter', sans-serif;">

                </div>

                <div style="display: flex; gap: 4px; margin-bottom: 8px;">

                    <div style="flex: 1;">

                        <label style="font-size: 0.65rem; font-weight: 700; color: #64748b; display: block; margin-bottom: 2px;">SATUAN</label>

                        <input type="text" class="header-unit-input" value="${unit}" onchange="updateCsvUnitLocal(${idx}, this.value)" placeholder="e.g. Jiwa" style="width: 100%; padding: 3px 6px; font-size: 0.75rem; border-radius: 4px; border: 1px solid var(--swal-cancel, #cbd5e1); outline:none; font-family: 'Inter', sans-serif; background: white;">

                    </div>

                    <div style="width: 65px;">

                        <label style="font-size: 0.65rem; font-weight: 700; color: #64748b; display: block; margin-bottom: 2px;">TAHUN</label>

                        <input type="text" class="header-year-input" value="${year}" onchange="updateCsvYearLocal(${idx}, this.value)" placeholder="e.g. 2025" style="width: 100%; padding: 3px 6px; font-size: 0.75rem; border-radius: 4px; border: 1px solid var(--swal-cancel, #cbd5e1); outline:none; font-family: 'Inter', sans-serif; background: white;">

                    </div>

                </div>

                <div style="display: flex; gap: 4px; justify-content: center; padding-top: 6px; border-top: 1px dashed var(--border, #e2e8f0);">

                    <button onclick="insertCsvColBelowLocal(${idx})" class="btn-row-insert" style="padding: 3px 8px; font-size: 0.72rem; border-radius: 4px; border: 1px solid var(--swal-cancel, #cbd5e1); background: #f1f5f9; color: #475569; cursor: pointer; transition: all 0.15s;" onmouseenter="this.style.background=cssVar('--border') || '#e2e8f0'; this.style.color=cssVar('--text-primary') || '#1e293b'" onmouseleave="this.style.background=cssVar('--bg-hover') || '#f1f5f9'; this.style.color=cssVar('--text-tertiary') || '#475569'">Sisip</button>

                    <button onclick="deleteCsvColumnLocal(${idx})" class="btn-row-del" style="padding: 3px 8px; font-size: 0.72rem; border-radius: 4px; border: 1px solid #fca5a5; background: var(--danger-light, #fee2e2); color: var(--danger-dark, #b91c1c); cursor: pointer; transition: all 0.15s;" onmouseenter="this.style.background=cssVar('--danger-light-bg') || '#fecaca'; this.style.color=cssVar('--danger-hover') || '#991b1b'" onmouseleave="this.style.background=cssVar('--danger-light') || '#fee2e2'; this.style.color=cssVar('--danger-text') || '#b91c1c'">Hapus</button>

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



        row.forEach((cell, cellIdx) => {

            html += `<td class="editable-cell" contenteditable="plaintext-only" data-type="${cellIdx === 0 ? 'text' : 'number'}" onkeydown="if(event.key === 'Enter') { event.preventDefault(); this.blur(); }">${cell != null ? cell : ""}</td>`;

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

        confirmButtonColor: cssVar('--danger') || cssVar('--danger') || '#ef4444',

        cancelButtonColor: cssVar('--swal-cancel') || cssVar('--text-muted') || '#cbd5e1',

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



let tsActiveUnitVKMap = {};

function getActiveUnitForVK(vk) {
    return tsActiveUnitVKMap[vk] || null;
}

function getUnitConfigForVK(vk) {
    if (!currentTimeSeriesData || !vk) return null;
    const vkUnit = (currentTimeSeriesData.vkUnits && currentTimeSeriesData.vkUnits[vk]) || '';
    const fk = detectUnitFamily(vkUnit, vk, '');
    const family = fk ? UNIVERSAL_UNIT_FAMILIES[fk] : null;
    if (!family) return null;
    const activeKey = getActiveUnitForVK(vk);
    return (activeKey && family.units[activeKey]) ? family.units[activeKey] : null;
}



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
        displayName: 'Jumlah Kuantitas / Unit',
        units: {
            'unit': { label: 'Unit', btnLabel: 'Unit', factor: 1, isInteger: true, maxDecimals: 0 },
            'ribu_unit': { label: 'Ribu Unit', btnLabel: 'Ribu Unit', factor: 0.001, isInteger: false, maxDecimals: 2 },
            'juta_unit': { label: 'Juta Unit', btnLabel: 'Juta Unit', factor: 0.000001, isInteger: false, maxDecimals: 3 }
        },
        triggers: ['ekor', 'pohon', 'unit', 'buah', 'batang', 'kendaraan', 'populasi ternak']
    }

};



function detectUnitFamily(unitStr, indicatorName, tableName) {

    const combined = `${unitStr || ''} ${indicatorName || ''}`.toLowerCase();

    

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
    if (!container || !btnGroup) return;

    const chartUnitWrapper = document.getElementById('ts-chart-unit-wrapper');
    const chartBtnGroup = document.getElementById('ts-chart-unit-btn-group');
    const noConversionInfo = document.getElementById('ts-chart-unit-no-conversion');

    if (!currentTimeSeriesData || !checkedVKs || checkedVKs.length === 0) {
        container.style.setProperty('display', 'none', 'important');
        if (chartUnitWrapper) chartUnitWrapper.style.setProperty('display', 'none', 'important');
        if (noConversionInfo) noConversionInfo.style.setProperty('display', 'none', 'important');
        return;
    }

    const convertibleVKs = [];
    for (const vk of checkedVKs) {
        const unit = (currentTimeSeriesData.vkUnits && currentTimeSeriesData.vkUnits[vk]) || '';
        const fk = detectUnitFamily(unit, vk, '');
        if (fk && UNIVERSAL_UNIT_FAMILIES[fk]) {
            if (!tsActiveUnitVKMap[vk] || !UNIVERSAL_UNIT_FAMILIES[fk].units[tsActiveUnitVKMap[vk]]) {
                tsActiveUnitVKMap[vk] = UNIVERSAL_UNIT_FAMILIES[fk].baseUnit;
            }
            convertibleVKs.push({ vk, familyKey: fk });
        }
    }

    if (convertibleVKs.length === 0) {
        container.style.setProperty('display', 'none', 'important');
        if (chartUnitWrapper) chartUnitWrapper.style.setProperty('display', 'none', 'important');
        if (noConversionInfo) noConversionInfo.style.setProperty('display', 'flex', 'important');
        return;
    }

    if (noConversionInfo) noConversionInfo.style.setProperty('display', 'none', 'important');

    let html = '';
    convertibleVKs.forEach(function(cvk, idx) {
        const vk = cvk.vk;
        const family = UNIVERSAL_UNIT_FAMILIES[cvk.familyKey];
        const activeUnitKey = tsActiveUnitVKMap[vk] || family.baseUnit;
        const vkUnit = (currentTimeSeriesData.vkUnits && currentTimeSeriesData.vkUnits[vk]) || '';
        const groupName = 'ts-unit-radio-' + idx;

        const combinedInfo = `${vkUnit} ${vk}`.toLowerCase();
        const isEkor = /\b(ekor|ternak|populasi ternak|unggas|sapi|kambing|domba|ayam|itik|kerbau|kuda|babi)\b/i.test(combinedInfo);
        const isPohon = /\b(pohon|batang)\b/i.test(combinedInfo);

        let chipsHtml = '';
        for (const [unitKey, unitCfg] of Object.entries(family.units)) {
            const isActive = (unitKey === activeUnitKey);
            let displayLabel = unitCfg.btnLabel || unitCfg.label;

            if (cvk.familyKey === 'count') {
                if (isEkor) {
                    if (unitKey === 'unit') displayLabel = 'Ekor';
                    else if (unitKey === 'ribu_unit') displayLabel = 'Ribu Ekor';
                    else if (unitKey === 'juta_unit') displayLabel = 'Juta Ekor';
                } else if (isPohon) {
                    if (unitKey === 'unit') displayLabel = 'Pohon / Batang';
                    else if (unitKey === 'ribu_unit') displayLabel = 'Ribu Batang';
                    else if (unitKey === 'juta_unit') displayLabel = 'Juta Batang';
                } else {
                    if (unitKey === 'unit') {
                        displayLabel = (vkUnit && vkUnit.trim() && !['unit/ekor', 'satuan', 'unit'].includes(vkUnit.trim().toLowerCase()) && vkUnit.trim().length <= 12)
                            ? vkUnit.trim() : 'Unit';
                    } else if (unitKey === 'ribu_unit') {
                        displayLabel = 'Ribu Unit';
                    } else if (unitKey === 'juta_unit') {
                        displayLabel = 'Juta Unit';
                    }
                }
            }

            chipsHtml += `<label class="ts-variant-chip${isActive ? ' active' : ''}" onclick="switchTimeSeriesUnit('${vk}','${unitKey}')">
                <input type="radio" name="${groupName}" value="${unitKey}" ${isActive ? 'checked' : ''}>
                <span>${typeof escHtml === 'function' ? escHtml(displayLabel) : displayLabel}</span>
            </label>`;
        }

        if (idx > 0) {
            html += '</div><div class="ts-unit-vk-row">';
        } else {
            html += '<div class="ts-unit-vk-row">';
        }

        if (convertibleVKs.length > 1) {
            html += `<span class="ts-unit-vk-label" title="${typeof escHtml === 'function' ? escHtml(vk) : vk}">${typeof escHtml === 'function' ? escHtml(vk) : vk}</span>`;
        }

        html += `<div class="ts-unit-vk-chips">${chipsHtml}</div></div>`;
    });

    btnGroup.innerHTML = html;
    if (chartBtnGroup) chartBtnGroup.innerHTML = html;

    container.style.removeProperty('display');
    container.style.display = 'flex';
    if (chartUnitWrapper) {
        chartUnitWrapper.style.removeProperty('display');
        chartUnitWrapper.style.display = 'flex';
    }
}

function switchTimeSeriesUnit(vk, targetUnitKey) {
    tsActiveUnitVKMap[vk] = targetUnitKey;

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

        return `Spasi pemisah ribuan janggal (${s})`;

    }

    const p = prevRawVal ? String(prevRawVal || '').trim() : '';

    const pValid = !!p && !['-', '...', '–', '—', ''].includes(p);



    // 3. Inkonsistensi format antar tahun (sinyal utama)

    //    Koma-3 valid sebagai desimal (mis. produksi perikanan '5,385' ton) maupun

    //    ribuan sesuai PDF; hanya anomali bila tidak konsisten dengan tahun lalu.

    if (pValid) {

        if (P3.test(p) && C3.test(s)) {

            return `Inkonsistensi format: tahun sebelumnya memakai titik ribuan (${p}), tahun ini koma (${s})`;

        }

        if (C3.test(p) && P3.test(s)) {

            return `Inkonsistensi format: tahun sebelumnya memakai koma (${p}), tahun ini titik ribuan (${s})`;

        }

        if (CD.test(p) && PD.test(s)) {

            return `Inkonsistensi format: tahun sebelumnya memakai koma desimal (${p}), tahun ini titik (${s})`;

        }

    }

    // 4. Titik 1-2 Digit Desimal (Format US e.g. '34.50' atau '12.5')

    if (PD.test(s)) {

        return `Format salah: menggunakan titik desimal (${s}) alih-alih koma desimal`;

    }

    return null;

}



// Deteksi anomali format data deret waktu di sisi klien

function detectClientTimeSeriesAnomalies(tablesData) {

    if (!tablesData || tablesData.length === 0) return [];

    const entitySeries = {};

    tablesData.forEach(t => {

        const yr = t.year;

        if (!yr) return;

        (t.data || []).forEach(row => {

            const ent = (row.entitas || '').trim();

            if (!ent) return;

            if (!entitySeries[ent]) entitySeries[ent] = {};

            Object.entries(row.nilai || {}).forEach(([vk, valStr]) => {

                if (!entitySeries[ent][vk]) entitySeries[ent][vk] = {};

                entitySeries[ent][vk][yr] = String(valStr || '').trim();

            });

        });

    });



    const anomalies = [];

    Object.keys(entitySeries).forEach(ent => {

        Object.keys(entitySeries[ent]).forEach(vk => {

            const yrMap = entitySeries[ent][vk];

            const sortedYears = Object.keys(yrMap).map(Number).sort((a, b) => a - b);

            if (sortedYears.length < 2) return;



            for (let i = 1; i < sortedYears.length; i++) {

                const prevYr = sortedYears[i - 1];

                const currYr = sortedYears[i];

                if (currYr - prevYr > 3) continue;



                const prevRaw = yrMap[prevYr];

                const currRaw = yrMap[currYr];



                const err = checkClientCellFormatAnomaly(currRaw, prevRaw);

                if (err) {

                    anomalies.push({

                        entitas: ent,

                        indicator: vk,

                        year: currYr,

                        prev_year: prevYr,

                        val: currRaw,

                        prev_val: prevRaw,

                        type: 'format',

                        message: `${err}.`

                    });

                }



                // Deteksi lonjakan/perubahan skala drastis antar tahun berurutan

                // (mis. 2.385.149,27 -> 643,37). Bukan error ekstraksi; biasanya

                // sumber data BPS mengubah satuan/unit atau merevisi angka antar edisi.

                const pnum = parseIndoNumberToFloat(prevRaw);

                const cnum = parseIndoNumberToFloat(currRaw);

                if (pnum !== null && cnum !== null && pnum !== 0 && cnum !== 0) {

                    const ratio = cnum / pnum;

                    if (Math.abs(ratio) > 100 || Math.abs(ratio) < 0.01) {

                        const scaleDesc = ratio > 1 ? `naik ${Math.round(ratio)}x` : `turun ke 1/${Math.round(1 / ratio)}-nya`;

                        anomalies.push({

                            entitas: ent,

                            indicator: vk,

                            year: currYr,

                            prev_year: prevYr,

                            val: currRaw,

                            prev_val: prevRaw,

                            type: 'scale',

                            message: `${scaleDesc} drastis antara ${prevYr} (${prevRaw}) dan ${currYr} (${currRaw}) - kemungkinan unit/satuan berubah atau data sumber direvisi.`

                        });

                    }

                }

            }

        });

    });

    return anomalies;

}



// Normalisasi nama entitas: perbaiki kesalahan ekstraksi OCR yang umum

function normalizeEntityName(name) {

    if (!name) return "";

    let n = name.trim();

    // Bersihkan encoding artifacts: ?, ??, ??? → hapus

    n = n.replace(/\?{1,}/g, '');

    // Samakan en-dash, em-dash, minus ke hyphen biasa

    n = n.replace(/[\u2012-\u2015\u2212]/g, '-');

    // Hilangkan karakter berulang berlebihan (Karangnungggal -> Karangnunggal)

    n = n.replace(/([^I\d\s])\1{2,}/g, '$1$1');

    // Sisipkan spasi jika prefix menempel pada nama: "KabupatenBogor" → "Kabupaten Bogor"

    n = n.replace(/^(Kabupaten|Kota|Kab\.?|Kota)\s*([A-Z])/i, function(m, prefix, first) {

        return prefix + ' ' + first;

    });

    // Koreksi case: CIkalong -> Cikalong

    n = n.replace(/\b([A-Z])([A-Z])([a-z])/g, (m, a, b, c) => a + b.toLowerCase() + c);

    // Normalisasi nama ringkasan -> Kabupaten Tasikmalaya

    const c = n.toLowerCase();

    const summaryMap = {

        'total': 1, 'jumlah': 1, 'subtotal': 1, 'grand total': 1, 'grandtotal': 1,

        'keseluruhan': 1, 'seluruh': 1, 'rata-rata': 1, 'rata rata': 1, 'average': 1,

        'tasikmalaya': 1, 'kab. tasikmalaya': 1, 'kab tasikmalaya': 1,

        'kab upaten': 1, 'kabupaten': 1

    };

    if (summaryMap[c]) return 'Kabupaten Tasikmalaya';

    // Kecamatan: buang spasi, cek apakah cocok dengan nama kecamatan resmi

    var noSpace = c.replace(/[\s\.]/g, '');

    var kecamatanSet = {

        'kadipaten':1, 'pagerageung':1, 'ciawi':1, 'sukaresik':1, 'cisayong':1,

        'sukahening':1, 'rajapolah':1, 'jamanis':1, 'cikatomas':1, 'pancatengah':1,

        'karangnunggal':1, 'cipatujah':1, 'cikalong':1, 'culamega':1,

        'bantarkalong':1, 'bojongasih':1, 'parungponteng':1, 'karangjaya':1,

        'cineam':1, 'manonjaya':1, 'gunungtanjung':1, 'salopa':1, 'jatiwaras':1,

        'sukaraja':1, 'tanjungjaya':1, 'sukarame':1, 'singaparna':1,

        'mangunreja':1, 'leuwisari':1, 'padakembang':1, 'sariwangi':1,

        'cigalontang':1, 'taraju':1, 'bojonggambir':1, 'sodonghilir':1,

        'puspahiang':1, 'salawu':1, 'cibalong':1, 'sukaratu':1

    };

    if (kecamatanSet[noSpace]) return noSpace.charAt(0).toUpperCase() + noSpace.slice(1);

    // Kabupaten/Kota tanpa prefix → tambahkan prefix

    var kabKotaMap = {

        'bandung': 'Kabupaten Bandung', 'bandung barat': 'Kabupaten Bandung Barat',

        'banjar': 'Kota Banjar', 'bekasi': 'Kabupaten Bekasi', 'bogor': 'Kabupaten Bogor',

        'ciamis': 'Kabupaten Ciamis', 'cianjur': 'Kabupaten Cianjur', 'cimahi': 'Kota Cimahi',

        'cirebon': 'Kabupaten Cirebon', 'depok': 'Kota Depok', 'garut': 'Kabupaten Garut',

        'indramayu': 'Kabupaten Indramayu', 'karawang': 'Kabupaten Karawang',

        'kuningan': 'Kabupaten Kuningan', 'majalengka': 'Kabupaten Majalengka',

        'pangandaran': 'Kabupaten Pangandaran', 'purwakarta': 'Kabupaten Purwakarta',

        'subang': 'Kabupaten Subang', 'sukabumi': 'Kabupaten Sukabumi',

        'sumedang': 'Kabupaten Sumedang', 'tasikmalaya': 'Kabupaten Tasikmalaya',

    };

    if (kabKotaMap[c]) return kabKotaMap[c];

    return n;

}



// Cek apakah dua nama entitas dianggap sama setelah normalisasi

function isSameEntity(name1, name2) {

    const n1 = normalizeEntityName(name1).toLowerCase();

    const n2 = normalizeEntityName(name2).toLowerCase();

    return n1 === n2;

}



// Fungsi untuk mencari canonical name dari entity map

function getCanonicalName(entityMap, rawName) {

    const existing = Object.keys(entityMap);

    for (const ent of existing) {

        if (isSameEntity(ent, rawName)) return ent;

    }

    return normalizeEntityName(rawName);

}



function escHtml(s) { return String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }







let tsIndicatorsList = [];

let tsCheckedIndicators = new Set(); // Simpan indikator yang sudah dicentang

let tsBabCollapsed = {}; // State ciutkan per bab: { "13": true, ... }



async function initTimeSeriesWizard() {

    const kolomDiv = document.getElementById('ts-wizard-kolom-checkboxes');

    if (!kolomDiv) return;

    

    // Stale-While-Revalidate: render immediately from localStorage cache if available
    const cachedIndicators = localStorage.getItem('sipedas_indicators_cache');
    let hasRenderedFromCache = false;
    if (cachedIndicators) {
        try {
            const parsed = JSON.parse(cachedIndicators);
            if (Array.isArray(parsed) && parsed.length > 0) {
                tsIndicatorsList = parsed;
                renderTSIndicatorsCheckboxes(tsIndicatorsList);
                hasRenderedFromCache = true;
            }
        } catch (e) {
            console.warn("Gagal parse cache indikator:", e);
        }
    }

    if (!hasRenderedFromCache) {
        kolomDiv.innerHTML = '<div style="padding:4px;color:#94a3b8;font-size:0.85rem;"><i>Memuat master kolom...</i></div>';
    }

    try {
        const res = await fetch(`${API_BASE}/timeseries/indicator-years`);
        const data = await res.json();
        const freshList = data.indicators || [];
        freshList.sort((a, b) => {
            const oa = Array.isArray(a.order) ? a.order : [9999, 9999];
            const ob = Array.isArray(b.order) ? b.order : [9999, 9999];
            return (oa[0] - ob[0]) || (oa[1] - ob[1]) || (a.name || '').localeCompare(b.name || '');
        });

        // Always update localStorage cache
        try {
            localStorage.setItem('sipedas_indicators_cache', JSON.stringify(freshList));
        } catch (e) {}

        // If list changed or wasn't rendered yet, update DOM
        if (!hasRenderedFromCache || JSON.stringify(freshList) !== cachedIndicators) {
            tsIndicatorsList = freshList;
            renderTSIndicatorsCheckboxes(tsIndicatorsList);
        }
    } catch (err) {
        console.error("Gagal inisialisasi wizard:", err);
        if (!hasRenderedFromCache) {
            kolomDiv.innerHTML = '<span class="text-danger" style="font-size:0.75rem;">Gagal memuat master kolom</span>';
        }
    }



    if (lastTimeSeriesSearchParams) {

        const resultsContent = document.getElementById('ts-results-content');

        if (resultsContent && resultsContent.style.display !== 'none') {

            searchTimeSeries(null);

        }

    }

}



function _createIndicatorCheckbox(ind, isPinned) {

    const label = document.createElement('label');

    label.className = isPinned ? 'ts-indicator-label ts-indicator-pinned ts-indicator-pill' : 'ts-indicator-label ts-indicator-pill';

    label.style.cssText = 'display:flex; align-items:center; gap:6px; cursor:pointer; padding:3px 6px; margin:0; border-radius:4px; font-size:0.82rem; line-height:1.3;';

    

    const cb = document.createElement('input');

    cb.type = 'checkbox';

    cb.value = ind.name;

    cb.className = 'ts-kolom-checkbox';

    cb.style.cssText = 'width:15px; height:15px; flex-shrink:0; margin:0; cursor:pointer;';

    cb.checked = tsCheckedIndicators.has(ind.name);

    cb.onchange = function() {

        if (this.checked) {

            tsCheckedIndicators.add(this.value);

        } else {

            tsCheckedIndicators.delete(this.value);

        }

        // Re-render untuk update pinned section

        const searchInput = document.getElementById('ts-wizard-search');

        const q = searchInput ? searchInput.value : '';

        filterTSIndicators(q);

        onKolomCheckboxChanged();

    };

    

    const span = document.createElement('span');

    span.textContent = ind.name;

    span.style.cssText = 'flex:1; word-break:break-word;';

    

    label.appendChild(cb);

    label.appendChild(span);

    return label;

}



function renderTSIndicatorsCheckboxes(filteredList) {

    const kolomDiv = document.getElementById('ts-wizard-kolom-checkboxes');

    if (!kolomDiv) return;

    

    kolomDiv.innerHTML = '';

    

    const sortByOrder = (a, b) => {

        const oa = Array.isArray(a.order) ? a.order : [9999, 9999];

        const ob = Array.isArray(b.order) ? b.order : [9999, 9999];

        return (oa[0] - ob[0]) || (oa[1] - ob[1]) || (a.name || '').localeCompare(b.name || '');

    };

    

    // 1. Selalu ambil checkedItems dari master list lengkap tsIndicatorsList agar tetap berada di atas saat pencarian!

    const checkedItems = (tsIndicatorsList || []).filter(ind => tsCheckedIndicators.has(ind.name)).sort(sortByOrder);

    

    // 2. Unselected items disaring dari filteredList (atau tsIndicatorsList jika tidak ada query)

    const currentList = (filteredList !== undefined) ? filteredList : tsIndicatorsList;

    const unselectedItems = (currentList || []).filter(ind => !tsCheckedIndicators.has(ind.name)).sort(sortByOrder);

    

    if (checkedItems.length === 0 && unselectedItems.length === 0) {

        kolomDiv.innerHTML = '<span class="text-muted" style="font-size:0.75rem; padding:4px;">Tidak ada indikator cocok</span>';

        return;

    }

    

    // 1. Bagian "Terpilih" (global, di atas)

    if (checkedItems.length > 0) {

        const hdr = document.createElement('div');

        hdr.className = 'ts-terpilih-header';

        hdr.textContent = `Terpilih (${checkedItems.length})`;

        kolomDiv.appendChild(hdr);

        checkedItems.forEach(ind => kolomDiv.appendChild(_createIndicatorCheckbox(ind, true)));

    }

    

    // 2. Grup per bab untuk yang belum dicentang

    if (unselectedItems.length > 0) {

        const groups = {};

        unselectedItems.forEach(ind => {

            const bab = (ind.bab_num != null) ? ind.bab_num : 'lainnya';

            if (!groups[bab]) groups[bab] = [];

            groups[bab].push(ind);

        });

        const babKeys = Object.keys(groups).sort((a, b) => {

            if (a === 'lainnya') return 1;

            if (b === 'lainnya') return -1;

            return Number(a) - Number(b);

        });

        // Saat mencari, paksa semua grup terbuka agar hasil kelihatan

        const searchEl = document.getElementById('ts-wizard-search');

        const isSearching = searchEl && searchEl.value.trim() !== '';

        babKeys.forEach(bab => {

            const collapsed = (!isSearching && tsBabCollapsed[bab] === true);

            const hdr = document.createElement('div');

            hdr.className = 'ts-bab-group-header';

            hdr.style.cursor = 'pointer';

            const titleSpan = document.createElement('span');

            const firstInd = groups[bab][0];

            const babLabel = (bab === 'lainnya')

                ? 'Lainnya'

                : ((firstInd && firstInd.bab_name) ? firstInd.bab_name : String(bab));

            titleSpan.textContent = babLabel;

            const chev = document.createElement('i');

            chev.className = collapsed ? 'bi bi-chevron-down' : 'bi bi-chevron-up';

            hdr.appendChild(titleSpan);

            hdr.appendChild(chev);

            kolomDiv.appendChild(hdr);



            const body = document.createElement('div');

            body.className = 'ts-bab-group-body' + (collapsed ? ' ts-bab-group-body-collapsed' : '');

            groups[bab].forEach(ind => body.appendChild(_createIndicatorCheckbox(ind, false)));

            kolomDiv.appendChild(body);



            hdr.onclick = () => {

                const nowCollapsed = body.classList.toggle('ts-bab-group-body-collapsed');

                tsBabCollapsed[bab] = nowCollapsed;

                chev.className = nowCollapsed ? 'bi bi-chevron-down' : 'bi bi-chevron-up';

            };

        });

    }

}



function filterTSIndicators(query) {

    const q = (query || '').toLowerCase().trim();

    if (!q) {

        renderTSIndicatorsCheckboxes(tsIndicatorsList);

        return;

    }

    const filtered = tsIndicatorsList.filter(ind => ind.name.toLowerCase().includes(q));

    renderTSIndicatorsCheckboxes(filtered);

}



function filterTSYears(query) {

    const q = (query || '').trim().toLowerCase();

    const labels = document.querySelectorAll('#ts-wizard-tahun-checkboxes label');

    labels.forEach(label => {

        const span = label.querySelector('span');

        const yearText = span ? span.textContent.trim().toLowerCase() : '';

        label.style.display = (q === '' || yearText.includes(q)) ? '' : 'none';

    });

}



function onKolomCheckboxChanged() {

    const tahunDiv = document.getElementById('ts-wizard-tahun-checkboxes');

    const submitBtn = document.getElementById('btn-ts-wizard-tampilkan');

    const selectAllBtn = document.getElementById('btn-ts-toggle-all-years');

    

    tahunDiv.innerHTML = '';

    submitBtn.disabled = true;

    if (selectAllBtn) selectAllBtn.style.display = 'none';

    

    if (tsCheckedIndicators.size === 0) {

        tahunDiv.innerHTML = '<span class="text-muted" style="font-size:0.75rem;">Pilih indikator terlebih dahulu</span>';

        return;

    }

    

    const allYears = new Set();

    tsCheckedIndicators.forEach(indName => {

        const matched = tsIndicatorsList.find(ind => ind.name === indName);

        if (matched && matched.years) {

            matched.years.forEach(yr => allYears.add(yr));

        }

    });

    

    const sortedYears = Array.from(allYears).sort((a, b) => a - b);

    if (sortedYears.length === 0) {

        tahunDiv.innerHTML = '<span class="text-danger" style="font-size:0.75rem;">Tahun data tidak tersedia</span>';

        return;

    }



    if (selectAllBtn) {

        selectAllBtn.style.display = 'inline-block';

        selectAllBtn.textContent = 'Pilih Semua';

        selectAllBtn.classList.remove('btn-primary');

        selectAllBtn.classList.add('btn-outline-primary');

    }

    

    sortedYears.forEach(yr => {

        const label = document.createElement('label');

        label.className = 'ts-year-chip';

        

        const cb = document.createElement('input');

        cb.type = 'checkbox';

        cb.value = yr;

        cb.className = 'ts-year-checkbox';

        cb.style.cssText = 'width:15px; height:15px; cursor:pointer; accent-color:#4f46e5; margin:0;';

        cb.onchange = onTahunCheckboxChanged;

        

        const span = document.createElement('span');

        span.textContent = yr;

        

        label.appendChild(cb);

        label.appendChild(span);

        tahunDiv.appendChild(label);

    });

}



function onTahunCheckboxChanged() {

    const all = document.querySelectorAll('.ts-year-checkbox');

    const checked = document.querySelectorAll('.ts-year-checkbox:checked');

    const submitBtn = document.getElementById('btn-ts-wizard-tampilkan');

    if (submitBtn) submitBtn.disabled = (checked.length === 0);

    

    all.forEach(cb => {

        const parent = cb.closest('.ts-year-chip');

        if (parent) {

            if (cb.checked) parent.classList.add('active');

            else parent.classList.remove('active');

        }

    });



    const selectAllBtn = document.getElementById('btn-ts-toggle-all-years');

    if (selectAllBtn && all.length > 0) {

        if (checked.length === all.length) {

            selectAllBtn.textContent = 'Batal Pilih';

            selectAllBtn.classList.remove('btn-outline-primary');

            selectAllBtn.classList.add('btn-primary');

        } else {

            selectAllBtn.textContent = 'Pilih Semua';

            selectAllBtn.classList.add('btn-outline-primary');

            selectAllBtn.classList.remove('btn-primary');

        }

    }

}



function toggleSelectAllYearsBtn() {

    const all = document.querySelectorAll('.ts-year-checkbox');

    const checked = document.querySelectorAll('.ts-year-checkbox:checked');

    const shouldCheck = checked.length < all.length;

    all.forEach(cb => { cb.checked = shouldCheck; });

    onTahunCheckboxChanged();

}



function toggleYearPicker() {

    const body = document.getElementById('ts-wizard-tahun-checkboxes');

    const chev = document.getElementById('year-picker-chevron');

    if (!body) return;

    const collapsed = body.classList.toggle('ts-year-picker-collapsed');

    if (chev) chev.className = collapsed ? 'bi bi-chevron-down' : 'bi bi-chevron-up';

}



function resetWizard() {

    tsCheckedIndicators.clear();

    const searchInput = document.getElementById('ts-wizard-search');

    if (searchInput) searchInput.value = '';

    const yearSearch = document.getElementById('ts-year-search');

    if (yearSearch) yearSearch.value = '';

    renderTSIndicatorsCheckboxes(tsIndicatorsList);

    onKolomCheckboxChanged();



    // Sembunyikan dan bersihkan hasil + grafik

    const resultsLoading = document.getElementById('ts-results-loading');

    if (resultsLoading) resultsLoading.style.display = 'none';

    const resultsContent = document.getElementById('ts-results-content');

    if (resultsContent) resultsContent.style.display = 'none';

    const summaryContainer = document.getElementById('ts-quick-summary-container');

    if (summaryContainer) summaryContainer.style.display = 'none';

    const dataControlCard = document.getElementById('ts-data-control-card');
    if (dataControlCard) dataControlCard.style.display = 'none';

    const chartControlCard = document.getElementById('ts-chart-control-card');
    if (chartControlCard) chartControlCard.style.display = 'none';

    toggleTimeSeriesInsights(false);

    

    ['ts-chart-container', 'ts-chart-container-2', 'ts-chart-container-3'].forEach(id => {

        const el = document.getElementById(id);

        if (el) el.style.display = 'none';

    });



    // Destroy active charts

    [timeSeriesChartInstance, timeSeriesChart2Instance, timeSeriesChart3Instance, timeSeriesChartYAxisInstance].forEach(inst => {

        if (inst) {

            try { inst.destroy(); } catch(e) {}

        }

    });

    timeSeriesChartInstance = null;

    timeSeriesChart2Instance = null;

    timeSeriesChart3Instance = null;

    timeSeriesChartYAxisInstance = null;

    currentTimeSeriesData = null;

    currentMatchedTables = null;

}



async function showTimeSeriesFromWizard() {

    const checkedKols = document.querySelectorAll('.ts-kolom-checkbox:checked');

    const selectedIndicators = Array.from(checkedKols).map(cb => cb.value);

    const checkedCbs = document.querySelectorAll('.ts-year-checkbox:checked');

    const selectedYears = Array.from(checkedCbs).map(cb => Number(cb.value));

    

    if (selectedIndicators.length === 0 || selectedYears.length === 0) return;

    

    document.getElementById('ts-results-loading').style.display = 'block';

    document.getElementById('ts-results-content').style.display = 'none';

    tsForceRecreateChart = true;

    

    try {

        const res = await fetch(`${API_BASE}/timeseries/data-by-indicators?indicators=${encodeURIComponent(selectedIndicators.join(','))}&years=${encodeURIComponent(selectedYears.join(','))}`);

        const data = await res.json();

        

        document.getElementById('ts-results-loading').style.display = 'none';

        

        if (!data.data || data.data.length === 0) {

            showToast('info', 'Info', 'Tidak ada data untuk pilihan ini.');

            return;

        }

        

        currentMatchedTables = data.data;

        renderTimeSeriesTable(data.data, selectedIndicators.join(', '));

        

    } catch (err) {

        document.getElementById('ts-results-loading').style.display = 'none';

        showToast('error', 'Error', 'Gagal memuat data: ' + err.message);

    }
