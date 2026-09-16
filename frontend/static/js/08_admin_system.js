// ===================== SISTEM: MODE PEMELIHARAAN =====================

let _maintenanceFlatpickr = null;

function _initMaintenanceFlatpickr() {
    if (_maintenanceFlatpickr) return;
    const el = document.getElementById('maintenance-end-input');
    if (!el || typeof flatpickr === 'undefined') return;
    _maintenanceFlatpickr = flatpickr(el, {
        enableTime: true,
        dateFormat: 'd/m/Y H:i',
        minuteIncrement: 5,
        locale: 'id',
        minDate: new Date(Date.now() + 3 * 60 * 1000),
        defaultDate: new Date(Date.now() + 2 * 60 * 60 * 1000),
        altInput: true,
        altFormat: 'j F Y, H:i',
        time_24hr: true,
        monthSelectorType: 'static'
    });
}



let currentMaintenanceMode = '0';

let currentMaintenanceEnd = '';



async function loadMaintenanceStatus() {

    try {

        const res = await fetch(`${API_BASE}/auth/maintenance`, { credentials: 'same-origin' });

        if (!res.ok) throw new Error('Gagal memuat status');

        const data = await res.json();

        currentMaintenanceMode = data.mode || '0';

        currentMaintenanceEnd = data.end_time || '';

        renderMaintenanceStatus();

        if (!window._maintenancePolling) {

            window._maintenancePolling = setInterval(loadMaintenanceStatus, 30000);

        }

    } catch (e) {

        document.getElementById('maintenance-status-badge').className = 'badge bg-danger';

        document.getElementById('maintenance-status-badge').textContent = 'Gagal memuat';

    }

}



function renderMaintenanceStatus() {

    const badge = document.getElementById('maintenance-status-badge');

    const toggle = document.getElementById('maintenance-toggle');

    const dtGroup = document.getElementById('maintenance-datetime-group');

    const endInfo = document.getElementById('maintenance-end-info');

    const endDisplay = document.getElementById('maintenance-end-display');

    const isActive = currentMaintenanceMode === '1';



    if (badge) {

        badge.className = isActive ? 'badge bg-success' : 'badge bg-secondary';

        badge.textContent = isActive ? 'Aktif' : 'Nonaktif';

    }

    if (toggle) toggle.checked = isActive;

    if (dtGroup) dtGroup.style.display = isActive ? 'block' : 'none';

    if (endInfo) endInfo.style.display = isActive && currentMaintenanceEnd ? 'block' : 'none';

    if (endDisplay && currentMaintenanceEnd) {

        try {

            const d = new Date(currentMaintenanceEnd);

            endDisplay.textContent = d.toLocaleString('id-ID', { dateStyle: 'full', timeStyle: 'short' });

        } catch (e) {

            endDisplay.textContent = currentMaintenanceEnd;

        }

    }

    // Set flatpickr date if maintenance is active and has end time
    if (_maintenanceFlatpickr && isActive && currentMaintenanceEnd) {
        try {
            _maintenanceFlatpickr.setDate(new Date(currentMaintenanceEnd), true);
        } catch(e) {}
    }

    if (toggle) {

        toggle.onchange = function () {

            dtGroup.style.display = this.checked ? 'block' : 'none';

        };

    }

}



async function saveMaintenanceMode() {

    const toggle = document.getElementById('maintenance-toggle');

    const endInput = document.getElementById('maintenance-end-input');

    const mode = toggle.checked ? '1' : '0';

    let endTime = '';

    if (mode === '1') {

        if (_maintenanceFlatpickr) {
            const selectedDates = _maintenanceFlatpickr.selectedDates;
            endTime = selectedDates && selectedDates.length ? selectedDates[0].toISOString() : '';
        } else {
            endTime = endInput ? endInput.value : '';
            if (endTime) endTime = new Date(endTime).toISOString();
        }

        if (!endTime) {
            Swal.fire({ title: 'Peringatan', text: 'Waktu selesai harus diisi saat mengaktifkan maintenance mode.', icon: 'warning', confirmButtonColor: '#2563eb' });
            return;
        }

        const targetMs = new Date(endTime).getTime();
        if (targetMs - Date.now() < 2 * 60 * 1000) {
            Swal.fire({
                title: 'Waktu Terlalu Singkat',
                text: 'Waktu selesai pemeliharaan minimal 3–5 menit ke depan dari waktu sekarang agar tidak langsung kedaluwarsa saat berpindah halaman.',
                icon: 'warning',
                confirmButtonColor: '#2563eb'
            });
            return;
        }

    }

    try {

        const res = await fetch(`${API_BASE}/auth/maintenance`, {

            method: 'POST',

            credentials: 'same-origin',

            headers: { 'Content-Type': 'application/json' },

            body: JSON.stringify({ mode, end_time: endTime })

        });

        const data = await res.json();

        if (!res.ok) throw new Error(data.detail || 'Gagal menyimpan');

        currentMaintenanceMode = mode;

        currentMaintenanceEnd = endTime;

        renderMaintenanceStatus();

        // Cross-tab: notify other tabs to reload (maintenance status changed)
        try { localStorage.setItem('sipedas_maintenance_event', JSON.stringify({ mode, ts: Date.now() })); } catch(e) {}

        Swal.fire({ title: 'Tersimpan!', text: data.message || 'Maintenance mode berhasil diupdate.', icon: 'success', confirmButtonColor: '#2563eb', timer: 2000 });

    } catch (e) {

        Swal.fire({ title: 'Gagal', text: e.message, icon: 'error', confirmButtonColor: '#2563eb' });

    }

}



// ===================== SISTEM: LOG AKTIVITAS =====================



let sistemLogsPage = 1;

const sistemLogsLimit = 20;



async function loadActivityLogs(page) {

    sistemLogsPage = page || 1;

    const tbody = document.getElementById('sistem-logs-tbody');

    const info = document.getElementById('sistem-logs-info');

    const prevBtn = document.getElementById('sistem-logs-prev');

    const nextBtn = document.getElementById('sistem-logs-next');

    if (!tbody) return;



    try {

        const res = await fetch(`${API_BASE}/admin/activity-logs?page=${sistemLogsPage}&limit=${sistemLogsLimit}`, { credentials: 'same-origin' });

        if (!res.ok) throw new Error('Gagal memuat log');

        const data = await res.json();

        const logs = data.logs || [];

        const total = data.total || 0;

        const pages = data.pages || 1;



        const actionLabels = {

            backup: '<i class="bi bi-shield-check-fill text-success"></i> Backup',

            restore: '<i class="bi bi-clock-history text-warning"></i> Restore',

            delete_table: '<i class="bi bi-trash-fill text-danger"></i> Hapus Tabel',

            fix_names: '<i class="bi bi-pencil-fill text-primary"></i> Fix Nama',

            change_admin_password: '<i class="bi bi-key-fill text-info"></i> Ganti Password',

            toggle_maintenance: '<i class="bi bi-tools text-warning"></i> Maintenance'

        };

        const actionColors = {

            backup: '#16a34a',

            restore: '#d97706',

            delete_table: '#dc2626',

            fix_names: '#2563eb',

            change_admin_password: '#0284c7',

            toggle_maintenance: '#d97706'

        };



        if (logs.length === 0) {

            tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted py-4">Belum ada log aktivitas.</td></tr>';

        } else {

            tbody.innerHTML = logs.map(l => {

                const label = actionLabels[l.action] || ('<i class="bi bi-activity"></i> ' + l.action);

                const ts = new Date(l.timestamp).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });

                const detail = l.detail ? JSON.stringify(l.detail) : '-';

                return `<tr>

                    <td class="small">${ts}</td>

                    <td>${label}</td>

                    <td class="small">${escHtml(l.target || '-')}</td>

                    <td class="small text-muted" style="max-width:300px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${escHtml(detail)}">${escHtml(detail)}</td>

                </tr>`;

            }).join('');

        }



        if (info) info.textContent = `Halaman ${sistemLogsPage} dari ${pages} (${total} log)`;

        if (prevBtn) prevBtn.disabled = sistemLogsPage <= 1;

        if (nextBtn) nextBtn.disabled = sistemLogsPage >= pages;

    } catch (e) {

        tbody.innerHTML = `<tr><td colspan="4" class="text-center text-danger py-3">${e.message}</td></tr>`;

    }

}



// ===================== SISTEM: BERSIHKAN CACHE =====================



function clearBrowserCache() {

    try {

        localStorage.clear();

        sessionStorage.clear();

        document.getElementById('cache-clear-result').style.display = 'block';

        document.getElementById('cache-clear-result').innerHTML = '<div class="alert alert-success py-2 mb-0"><i class="bi bi-check-circle-fill me-1"></i>Cache browser berhasil dibersihkan!</div>';

        setTimeout(() => { document.getElementById('cache-clear-result').style.display = 'none'; }, 3000);

    } catch (e) {

        document.getElementById('cache-clear-result').style.display = 'block';

        document.getElementById('cache-clear-result').innerHTML = '<div class="alert alert-danger py-2 mb-0"><i class="bi bi-x-circle-fill me-1"></i>Gagal membersihkan cache.</div>';

    }

}



function hardReload() {

    localStorage.clear();

    sessionStorage.clear();

    window.location.reload(true);

}



function switchDataAnomaliSubTab(type) {

    const btnTs = document.getElementById('btn-subtab-ts-anom');

    const btnCell = document.getElementById('btn-subtab-cell-anom');

    const pnlTs = document.getElementById('subtab-admin-ts-anom');

    const pnlCell = document.getElementById('subtab-admin-cell-anom');



    if (type === 'ts') {

        if (btnTs) btnTs.className = 'admin-subtab active';

        if (btnCell) btnCell.className = 'admin-subtab';

        if (pnlTs) pnlTs.style.display = 'block';

        if (pnlCell) pnlCell.style.display = 'none';

        if (typeof loadTimeSeriesAnomalies === 'function') loadTimeSeriesAnomalies();

    } else {

        if (btnTs) btnTs.className = 'admin-subtab';

        if (btnCell) btnCell.className = 'admin-subtab active';

        if (pnlTs) pnlTs.style.display = 'none';

        if (pnlCell) pnlCell.style.display = 'block';

        if (typeof loadAdminDataAnomalies === 'function') loadAdminDataAnomalies();

    }

}



let currentModalAnomaly = null;

let currentModalTableData = null;



async function loadTimeSeriesAnomalies(forceRefresh = false) {

    const tbody = document.getElementById('admin-ts-anomalies-tbody');

    const emptyDiv = document.getElementById('tsanom-empty');

    if (!tbody) return;

    

    const tableWrapper = tbody.closest('.table-responsive');

    if (tableWrapper) tableWrapper.style.display = 'block';

    tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-4"><div class="spinner-border spinner-border-sm me-2"></div>Memindai anomali deret waktu di database...</td></tr>';

    if (emptyDiv) emptyDiv.style.display = 'none';

    

    try {

        const url = forceRefresh ? `${API_BASE}/admin/timeseries-anomalies?refresh=true&_t=${Date.now()}` : `${API_BASE}/admin/timeseries-anomalies?_t=${Date.now()}`;

        const res = await fetch(url);

        if (!res.ok) throw new Error('Gagal memuat anomali deret waktu');

        const data = await res.json();

        const anomalies = data.anomalies || [];

        window.currentTsAnomalies = anomalies;

        

        if (anomalies.length === 0) {

            tbody.innerHTML = '';

            if (tableWrapper) tableWrapper.style.display = 'none';

            if (emptyDiv) emptyDiv.style.display = 'block';

            return;

        } else {

            if (tableWrapper) tableWrapper.style.display = 'block';

            if (emptyDiv) emptyDiv.style.display = 'none';

        }

        

        let html = '';

        anomalies.forEach((a, idx) => {

            const badgeType = '<span class="badge bg-warning bg-opacity-10 text-warning-emphasis border border-warning border-opacity-50 px-2 py-1">⚠️ Anomali Format</span>';

            const docBadge = `<span class="badge bg-secondary bg-opacity-10 text-secondary">${a.doc_year || '-'}</span>`;

            const cleanName = formatCleanTableName(a.table_name);

            const cleanInd = String(a.base_metric || a.indicator || '-').replace(/\.\d+$/, '').trim();

            

            html += `<tr>

                <td class="fw-semibold text-dark small" style="padding: 10px 14px; word-break: break-word;" title="${escHtml(a.table_name)}">${escHtml(cleanName)}</td>

                <td class="text-center" style="padding: 10px 6px;">${docBadge}</td>

                <td class="small" style="padding: 10px 12px; word-break: break-word;">

                    <div class="fw-semibold text-dark">${escHtml(a.entitas)}</div>

                    <div class="text-muted small">${escHtml(cleanInd)}</div>

                </td>

                <td class="text-center small" style="padding: 10px 6px;">${a.prev_year} ➔ <b class="text-primary">${a.year}</b></td>

                <td class="text-center" style="padding: 10px 6px;">${badgeType}</td>

                <td class="small text-muted" style="padding: 10px 12px; word-break: break-word;">

                    <div class="text-dark" style="line-height: 1.4;">${escHtml(a.message)}</div>

                </td>

                <td class="text-center" style="padding: 12px 14px;">

                    <button onclick="openAnomalyTableModal(${idx});" class="btn-table-action">

                        <i class="bi bi-eye"></i> Buka

                    </button>

                </td>

            </tr>`;

        });

        tbody.innerHTML = html;

    } catch(e) {

        tbody.innerHTML = `<tr><td colspan="7" class="text-center text-danger py-3">Error: ${escHtml(e.message)}</td></tr>`;

    }

}



async function openAnomalyTableModal(idx) {

    const a = (window.currentTsAnomalies && window.currentTsAnomalies[idx]) ? window.currentTsAnomalies[idx] : null;

    if (!a) return;

    openAnomalyTableModalWithData(a);

}



async function openAnomalyTableModalWithData(a) {

    currentModalAnomaly = a;

    const modalEl = document.getElementById('anomalyTableModal');

    if (!modalEl) return;

    

    // Set Header

    const cleanName = formatCleanTableName(a.table_name);

    document.getElementById('anom-modal-title').textContent = cleanName;

    document.getElementById('anom-modal-title').title = a.table_name || '';

    document.getElementById('anom-modal-doc-year').textContent = a.doc_year ? `Publikasi ${a.doc_year}` : '';

    

    const badgeTypeEl = document.getElementById('anom-modal-badge-type');

    if (badgeTypeEl) {

        badgeTypeEl.className = 'badge bg-warning bg-opacity-10 text-warning-emphasis border border-warning border-opacity-50 px-2.5 py-1 fw-semibold';

        badgeTypeEl.innerHTML = '⚠️ Anomali Format Angka';

        document.getElementById('anom-modal-icon').innerHTML = '⚠️';

    }

    

    // Set Banner Info

    const cleanIndicator = String(a.base_metric || a.indicator || '-').replace(/\.\d+$/, '').trim();

    document.getElementById('anom-modal-banner-msg').textContent = a.message || 'Data terindikasi anomali deret waktu.';

    document.getElementById('anom-modal-meta-info').innerHTML = `

        Entitas / Baris: <strong class="text-dark">${escHtml(a.entitas || '-')}</strong> &nbsp;|&nbsp; 

        Kolom / Indikator: <strong class="text-dark">${escHtml(cleanIndicator)}</strong> &nbsp;|&nbsp; 

        Perubahan: <span class="badge bg-white text-dark border">${a.prev_year || '-'} (${a.prev_val || '-'})</span> ➔ <span class="badge bg-primary">${a.year || '-'} (${a.current_val || '-'})</span>

    `;

    

    // Hide save button initially

    const saveBtn = document.getElementById('anom-modal-btn-save');

    if (saveBtn) saveBtn.style.display = 'none';



    // Show loading state

    const thead = document.getElementById('anom-modal-thead');

    const tbody = document.getElementById('anom-modal-tbody');

    thead.innerHTML = '<tr><th class="text-center py-3">Memuat struktur kolom...</th></tr>';

    tbody.innerHTML = '<tr><td class="text-center py-4 text-muted"><div class="spinner-border spinner-border-sm me-2"></div>Mengambil data tabel...</td></tr>';

    

    const bsModal = bootstrap.Modal.getOrCreateInstance(modalEl);

    bsModal.show();

    

    try {

        const res = await fetch(`${API_BASE}/tables/${a.table_id}/csv_preview`);

        if (!res.ok) throw new Error('Gagal mengambil data tabel');

        const data = await res.json();

        currentModalTableData = data;

        

        const headers = data.headers || [];

        const units = data.units || [];

        const years = data.years || [];

        const rows = data.rows || [];

        const rowIds = data.row_ids || [];

        

        document.getElementById('anom-modal-row-count').textContent = `Total: ${rows.length} baris, ${headers.length} kolom`;

        

        // Render thead with Name, Satuan, Tahun

        let theadHtml = '<tr><th style="width: 58px; min-width: 58px; text-align:center; background:#f8fafc; vertical-align:middle; padding: 12px 6px; font-weight:700; color:var(--text-secondary, #64748b); border-bottom: 2px solid #e2e8f0; border-right: 1px solid #e2e8f0;">No</th>';

        headers.forEach((h, colIdx) => {

            const minWidth = colIdx === 0 ? '190px' : '145px';

            const u = units[colIdx] ? `<span class="badge bg-white text-secondary border px-2 py-0.5" style="font-size:0.72rem; font-weight:600; border-color:#cbd5e1 !important;">${escHtml(units[colIdx])}</span>` : '';

            const y = years[colIdx] ? `<span class="badge bg-primary bg-opacity-10 text-primary border border-primary border-opacity-25 px-2 py-0.5" style="font-size:0.72rem; font-weight:700;">${escHtml(years[colIdx])}</span>` : '';

            theadHtml += `<th style="min-width: ${minWidth}; background:#f8fafc; font-size:0.83rem; font-weight:700; color:#1e293b; vertical-align:top; padding: 12px 14px; border-bottom: 2px solid #e2e8f0; border-right: 1px solid #e2e8f0;">

                <div style="line-height: 1.35;">${escHtml(h)}</div>

                <div class="d-flex align-items-center gap-1.5 mt-2 flex-wrap">${u} ${y}</div>

            </th>`;

        });

        theadHtml += '</tr>';

        thead.innerHTML = theadHtml;

        

        // Update dynamic legend labels

        const prevLegend = document.getElementById('anom-legend-prev-label');

        if (prevLegend) prevLegend.textContent = `= Nilai Awal (${a.prev_year || 'Tahun Asal'}: ${a.prev_val || '-'})`;

        const currLegend = document.getElementById('anom-legend-curr-label');

        if (currLegend) currLegend.textContent = `= Nilai Anomali (${a.year || 'Tahun Anomali'}: ${a.current_val || '-'})`;



        // Match target column indices accurately (both Prev/Baseline year & Current/Anomaly year):

        let currColIdx = -1;

        let prevColIdx = -1;

        const origHeaders = data.orig_headers || [];

        const rawIndicator = (a.indicator || '').trim().toLowerCase();

        const rawPrevIndicator = (a.prev_indicator || '').trim().toLowerCase();

        const cleanIndicator = (a.base_metric || a.indicator || '').replace(/\.\d+$/, '').trim().toLowerCase();

        

        // 1. Match Current / Anomaly Column (Nilai B)

        if (rawIndicator && origHeaders.length > 0) {

            currColIdx = origHeaders.findIndex(oh => String(oh).trim().toLowerCase() === rawIndicator);

        }

        if (currColIdx === -1 && cleanIndicator) {

            currColIdx = headers.findIndex((h, idx) => {

                const hClean = String(h).trim().toLowerCase();

                const nameMatch = hClean === cleanIndicator || hClean.includes(cleanIndicator) || cleanIndicator.includes(hClean);

                const yrMatch = a.year ? String(years[idx] || '').includes(String(a.year)) : true;

                return nameMatch && yrMatch;

            });

        }

        if (currColIdx === -1 && cleanIndicator) {

            currColIdx = headers.findIndex(h => {

                const hClean = String(h).trim().toLowerCase();

                return hClean === cleanIndicator || hClean.includes(cleanIndicator) || cleanIndicator.includes(hClean);

            });

        }



        // 2. Match Previous / Baseline Column (Nilai A)

        if (rawPrevIndicator && origHeaders.length > 0) {

            prevColIdx = origHeaders.findIndex(oh => String(oh).trim().toLowerCase() === rawPrevIndicator);

        }

        if (prevColIdx === -1 && cleanIndicator && a.prev_year) {

            prevColIdx = headers.findIndex((h, idx) => {

                const hClean = String(h).trim().toLowerCase();

                const nameMatch = hClean === cleanIndicator || hClean.includes(cleanIndicator) || cleanIndicator.includes(hClean);

                const yrMatch = String(years[idx] || '').includes(String(a.prev_year));

                return nameMatch && yrMatch;

            });

        }

        

        // Render tbody

        let tbodyHtml = '';

        let targetFound = false;

        

        rows.forEach((row, rIdx) => {

            const entityVal = String(row[0] || '').trim();

            const isTargetRow = (a.row_id && rowIds[rIdx] === a.row_id) || 

                               (a.entitas && (entityVal.toLowerCase() === a.entitas.trim().toLowerCase() || entityVal.toLowerCase().includes(a.entitas.trim().toLowerCase())));

            

            if (isTargetRow) targetFound = true;

            

            const rowClass = isTargetRow ? 'row-anomaly-focus' : '';

            tbodyHtml += `<tr class="${rowClass}" data-row-idx="${rIdx}">`;

            tbodyHtml += `<td class="text-center text-muted fw-semibold" style="font-size:0.78rem; vertical-align:middle; padding:8px 6px; background:#fcfdfe; border-right: 1px solid #f1f5f9;">${rIdx + 1}</td>`;

            

            row.forEach((cellVal, colIdx) => {

                const isCurrAnomCell = isTargetRow && (colIdx === currColIdx);

                const isPrevAnomCell = isTargetRow && (colIdx === prevColIdx);

                

                let cellClass = '';

                let cellId = '';

                let cellTitle = '';

                

                if (isCurrAnomCell) {

                    cellClass = 'cell-anomaly-highlight';

                    cellId = 'id="active-anomaly-cell"';

                    cellTitle = `Nilai Anomali (${a.year || ''}): ${a.current_val || cellVal}`;

                } else if (isPrevAnomCell) {

                    cellClass = 'cell-anomaly-prev';

                    cellId = 'id="prev-anomaly-cell"';

                    cellTitle = `Nilai Awal (${a.prev_year || ''}): ${a.prev_val || cellVal}`;

                }

                

                const isEntityCol = (colIdx === 0);

                tbodyHtml += `

                    <td class="${cellClass}" ${cellId} title="${cellTitle}" style="vertical-align:middle; padding: 6px 10px; min-width: ${isEntityCol ? '190px' : '145px'};">

                        <input type="text" class="anom-cell-input ${isEntityCol ? 'fw-semibold text-dark' : ''}" 

                               style="text-align:${isEntityCol ? 'left' : 'right'}; font-weight:${(isCurrAnomCell || isPrevAnomCell) ? '700' : (isEntityCol ? '600' : 'normal')};" 

                               value="${escHtml(cellVal)}" 

                               oninput="onAnomalyModalCellInput(${rIdx}, ${colIdx}, this.value)">

                    </td>

                `;

            });

            tbodyHtml += '</tr>';

        });

        

        tbody.innerHTML = tbodyHtml;

        

        // Smooth scroll to the highlighted anomaly cell (focus between prev and curr cell)

        setTimeout(() => {

            const anomCell = document.getElementById('active-anomaly-cell') || document.getElementById('prev-anomaly-cell');

            if (anomCell) {

                anomCell.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });

            }

        }, 350);

        

    } catch(err) {

        tbody.innerHTML = `<tr><td colspan="10" class="text-center text-danger py-4">Error: ${escHtml(err.message)}</td></tr>`;

    }

}



function onAnomalyModalCellInput(rIdx, colIdx, newVal) {

    if (currentModalTableData && currentModalTableData.rows && currentModalTableData.rows[rIdx]) {

        currentModalTableData.rows[rIdx][colIdx] = newVal;

        const saveBtn = document.getElementById('anom-modal-btn-save');

        if (saveBtn) saveBtn.style.display = 'inline-flex';

    }

}



async function markCurrentModalAnomalySafe() {

    if (!currentModalAnomaly) return;

    const a = currentModalAnomaly;

    

    try {

        const res = await fetch(`${API_BASE}/admin/timeseries-anomalies/mark-safe`, {

            method: 'POST',

            headers: { 'Content-Type': 'application/json' },

            body: JSON.stringify({

                key: a.key,

                table_id: a.table_id,

                row_id: a.row_id,

                indicator: a.indicator,

                year: a.year,

                entitas: a.entitas

            })

        });

        

        if (!res.ok) throw new Error('Gagal menandai aman');

        

        showToast('success', 'Berhasil Ditandai Aman', `Data '${a.entitas || 'Tabel'}' telah ditandai aman.`);

        

        // Hide modal

        const modalEl = document.getElementById('anomalyTableModal');

        if (modalEl) {

            const bsModal = bootstrap.Modal.getInstance(modalEl);

            if (bsModal) bsModal.hide();

        }

        

        // Refresh anomalies table

        loadTimeSeriesAnomalies(true);

        if (typeof loadDashboardStats === 'function') loadDashboardStats();
        notifyDataChange('anomaly');

    } catch(err) {

        showToast('error', 'Gagal', err.message);

    }

}



async function saveAnomalyModalEdits() {

    if (!currentModalAnomaly || !currentModalTableData) return;

    const a = currentModalAnomaly;

    const tableId = a.table_id;

    const rows = currentModalTableData.rows || [];

    

    try {

        const savePromises = rows.map((r, rIdx) => {

            return fetch(`${API_BASE}/tables/${tableId}/csv/row/${rIdx}`, {

                method: 'PUT',

                headers: { 'Content-Type': 'application/json' },

                body: JSON.stringify({ data: r })

            });

        });

        

        await Promise.all(savePromises);

        

        await markCurrentModalAnomalySafe();

        showToast('success', 'Tersimpan', 'Perubahan tabel berhasil disimpan ke database.');

    } catch(err) {

        showToast('error', 'Gagal Menyimpan', err.message);

    }

}



function toggleAdminSubmenu() {

    const sub = document.getElementById('admin-submenu');

    const icon = document.getElementById('admin-submenu-icon');

    if (!sub) return;

    const open = sub.style.display !== 'none';

    sub.style.display = open ? 'none' : 'block';

    if (icon) icon.classList.toggle('open', !open);

}



function toggleSistemSubmenu() {

    const sub = document.getElementById('sistem-submenu');

    const icon = document.getElementById('sistem-submenu-icon');

    if (!sub) return;

    const open = sub.style.display !== 'none';

    sub.style.display = open ? 'none' : 'block';

    if (icon) icon.classList.toggle('open', !open);

}



function navigateAdminTab(tab, element) {
    const mobileSidebar = document.querySelector('.sidebar.mobile-open');
    if (mobileSidebar && typeof toggleMobileSidebar === 'function') toggleMobileSidebar();

    if (!checkRoleAccess('admin')) return;

    document.querySelectorAll('.page-section').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-link').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.popover-item').forEach(el => el.classList.remove('active'));

    const page = document.getElementById('page-admin');
    if (page) page.classList.add('active');

    const parent = document.getElementById('nav-admin');
    if (parent) parent.classList.add('active');

    // 1. Aktifkan item subnav di dalam sidebar
    const subnavEl = document.getElementById(`nav-admin-${tab}`);
    if (subnavEl) subnavEl.classList.add('active');

    // 2. Aktifkan item di popover flyout
    const popoverEl = document.getElementById(`popover-admin-${tab}`) || 
                      document.querySelector(`#flyout-admin-submenu [data-tab="${tab}"]`) || 
                      (element && element.classList.contains('popover-item') ? element : null);
    if (popoverEl) popoverEl.classList.add('active');

    // 3. Pastikan submenu accordion terbuka & icon berputar (agar langsung terlihat saat sidebar dibuka)
    const sub = document.getElementById('admin-submenu');
    const icon = document.getElementById('admin-submenu-icon');
    if (sub) sub.style.display = 'block';
    if (icon) icon.classList.add('open');

    // Tutup floating popover jika sedang melayang
    document.querySelectorAll('.sidebar-floating-popover').forEach(p => {
        p.classList.remove('popover-visible');
        p.style.display = '';
        p.style.position = '';
        p.style.top = '';
        p.style.left = '';
        if (p._originalParent && p.parentNode !== p._originalParent) {
            p._originalParent.appendChild(p);
        }
    });

    const mc = document.querySelector('.main-content');
    if (mc) mc.scrollTop = 0;

    switchAdminTab(tab);
}



let globalRowSearchTimer = null;

function searchGlobalRowsDebounced() {

    clearTimeout(globalRowSearchTimer);

    globalRowSearchTimer = setTimeout(searchGlobalRows, 300);

}



async function searchGlobalRows() {

    const input = document.getElementById('global-row-search');

    const resultsDiv = document.getElementById('global-row-results');

    const countSpan = document.getElementById('global-row-count');

    if (!resultsDiv || !countSpan) return;

    const q = (input ? input.value : '').trim();



    if (q.length < 2) {

        resultsDiv.style.display = 'none';

        resultsDiv.innerHTML = '';

        countSpan.textContent = '';

        return;

    }



    resultsDiv.style.display = 'block';

    resultsDiv.innerHTML = '<div class="text-center text-muted small py-3"><div class="spinner-border spinner-border-sm me-2" role="status"></div>Mencari baris...</div>';



    try {

        const res = await fetch(`${API_BASE}/search/rows?q=${encodeURIComponent(q)}`);

        if (!res.ok) throw new Error('Gagal mencari baris');

        const data = await res.json();

        const results = data.results || [];

        countSpan.textContent = data.total ? `${data.total} tabel cocok (tampil ${results.length})` : '';



        if (results.length === 0) {

            resultsDiv.innerHTML = `<div class="text-center text-muted py-3">Tidak ada baris yang cocok dengan "${escHtml(q)}".</div>`;

            return;

        }



        let html = '';

        results.forEach((t, idx) => {

            const docLabel = t.doc_year ? `<span class="badge bg-light text-secondary">Publikasi ${t.doc_year}</span> ` : '';

            let rowsHtml = '';

            t.matches.forEach(m => {

                const colBadges = m.columns.map(c => `<span class="badge bg-info bg-opacity-25 text-info" style="font-size:0.7rem;">${escHtml(c)}</span>`).join(' ');

                rowsHtml += `<div class="px-3 py-2 border-bottom" style="text-align:left;">

                    <div class="small fw-semibold">${escHtml(m.entity || '-')} <span class="text-muted fw-normal" style="font-size:0.75rem;">(${m.columns.length} kolom cocok)</span></div>

                    <div class="mt-1" style="display:flex; flex-wrap:wrap; gap:3px;">${colBadges}</div>

                </div>`;

            });

            const totalLabel = t.count === 1 ? '1 baris' : `${t.count} baris`;

            html += `<div class="border rounded-3 mb-2 overflow-hidden">

                <div class="d-flex align-items-center justify-content-between px-3 py-2 bg-light" style="cursor:pointer;"

                     onclick="const rg=document.getElementById('grr-${idx}'); rg.style.display = rg.style.display==='none'?'block':'none';">

                    <div class="small fw-semibold d-flex align-items-center flex-wrap" style="text-align:left;">
                        ${renderCleanTableTitleHtml(t.table_name)}
                        <span class="badge bg-secondary ms-2">${totalLabel}</span>
                    </div>

                    <div>${docLabel} <span class="text-muted small ms-1">➔</span></div>

                </div>

                <div id="grr-${idx}" style="display:none; max-height:280px; overflow-y:auto; border-top:1px solid #e2e8f0;">

                    ${rowsHtml}

                    <div class="p-2 text-center">

                        <button onclick="Swal.close(); openTable(${t.table_id});" class="btn btn-sm btn-outline-primary">Lihat Tabel</button>

                    </div>

                </div>

            </div>`;

        });

        html += '<div class="small text-muted mb-2">Klik tabel untuk melihat baris yang cocok. Klik <b>Lihat Tabel</b> untuk membukanya.</div>';

        resultsDiv.innerHTML = html;

    } catch(e) {

        resultsDiv.innerHTML = `<div class="text-center text-danger small py-2">Error: ${escHtml(e.message)}</div>`;

    }

}



let globalColSearchTimer = null;

function searchGlobalColumnsDebounced() {

    clearTimeout(globalColSearchTimer);

    globalColSearchTimer = setTimeout(searchGlobalColumns, 300);

}



async function searchGlobalColumns() {

    const input = document.getElementById('global-column-search');

    const resultsDiv = document.getElementById('global-column-results');

    const countSpan = document.getElementById('global-column-count');

    if (!resultsDiv || !countSpan) return;

    const q = (input ? input.value : '').trim();



    if (q.length < 2) {

        resultsDiv.style.display = 'none';

        resultsDiv.innerHTML = '';

        countSpan.textContent = '';

        const emptyEl = document.getElementById('global-column-empty');

        if (emptyEl) emptyEl.style.display = '';

        return;

    }



    const emptyEl2 = document.getElementById('global-column-empty');

    if (emptyEl2) emptyEl2.style.display = 'none';



    resultsDiv.style.display = 'block';

    resultsDiv.innerHTML = '<div class="text-center text-muted small py-3"><div class="spinner-border spinner-border-sm me-2" role="status"></div>Mencari kolom...</div>';



    try {

        const res = await fetch(`${API_BASE}/master/columns/search?q=${encodeURIComponent(q)}`);

        if (!res.ok) throw new Error('Gagal mencari kolom');

        const data = await res.json();

        const results = data.results || [];

        countSpan.textContent = data.total ? `${data.total} header cocok (tampil ${results.length})` : '';



        if (results.length === 0) {

            resultsDiv.innerHTML = `<div class="text-center text-muted py-3">Tidak ada kolom yang cocok dengan "${escHtml(q)}".</div>`;

            return;

        }



        let html = '';

        results.forEach((g, idx) => {

            const unitHtml = g.unit ? ` <span class="badge bg-info bg-opacity-25 text-info">${escHtml(g.unit)}</span>` : '';

            const scoreLabel = g.score >= 100 ? '<span class="badge bg-success">Frasa</span>' : '<span class="badge bg-secondary">Kata</span>';

            let rowsHtml = '';

            g.matches.forEach(m => {

                const yearLabel = m.table_year ? ` · data ${m.table_year}` : '';

                const docLabel = m.doc_year ? `<span class="badge bg-light text-secondary">Publikasi ${m.doc_year}</span> ` : '';

                rowsHtml += `<div class="d-flex justify-content-between align-items-center px-3 py-2 border-bottom" style="text-align:left;">

                    <div class="small" style="flex:1; min-width:0; padding-right:8px;">
                        <div class="d-flex align-items-center flex-wrap" style="white-space:normal; word-break:break-word;">${renderCleanTableTitleHtml(m.table_name)}</div>
                        <div class="text-muted" style="font-size:0.75rem;">${docLabel}${yearLabel}</div>
                    </div>

                    <button onclick="Swal.close(); openTable(${m.table_id});" class="btn btn-sm btn-outline-primary py-1 px-2" style="font-size:0.75rem; flex-shrink:0;">Lihat</button>

                </div>`;

            });

            const totalLabel = g.matches.length === 1 ? '1 tabel' : `${g.matches.length} tabel`;

            html += `<div class="border rounded-3 mb-2 overflow-hidden">

                <div class="d-flex align-items-center justify-content-between px-3 py-2 bg-light" style="cursor:pointer;"

                     onclick="const rg=document.getElementById('gcr-${idx}'); rg.style.display = rg.style.display==='none'?'block':'none';">

                    <div class="small fw-semibold" style="text-align:left;">${escHtml(g.header)}${unitHtml}

                        <span class="badge bg-secondary ms-1">${totalLabel}</span></div>

                    <div>${scoreLabel} <span class="text-muted small ms-1">➔</span></div>

                </div>

                <div id="gcr-${idx}" style="display:none; max-height:280px; overflow-y:auto; border-top:1px solid #e2e8f0;">${rowsHtml}</div>

            </div>`;

        });

        html += '<div class="small text-muted mb-2">Klik header untuk melihat daftar tabel. Klik <b>Lihat</b> untuk membuka tabelnya.</div>';

        resultsDiv.innerHTML = html;

    } catch(e) {

        resultsDiv.innerHTML = `<div class="text-center text-danger small py-2">Error: ${escHtml(e.message)}</div>`;

    }

}



async function showTablesUsingColumn(columnName) {

    Swal.fire({

        title: 'Memuat...',

        html: '<div class="spinner-border text-primary" role="status"><span class="visually-hidden">Loading...</span></div>',

        showConfirmButton: false,

        allowOutsideClick: false

    });

    try {

        const res = await fetch(`${API_BASE}/master/columns/usage?column_name=${encodeURIComponent(columnName)}`);

        if (!res.ok) throw new Error('Gagal memuat penggunaan kolom');

        const data = await res.json();

        const tables = data.tables || [];

        if (tables.length === 0) {

            showToast('info', 'Info', 'Tidak ada tabel yang menggunakan kolom ini.');

            return;

        }

        let html = '<div class="small text-muted mb-2 text-start">Daftar tabel yang menggunakan kolom ini:</div>';

        html += '<div style="max-height:300px; overflow-y:auto; border:1px solid #e2e8f0; border-radius:8px; padding:4px;">';

        tables.forEach(t => {

            const label = `${t.document_year ? t.document_year + ' - ' : ''}${t.table_name}`;

            html += `<div style="display:flex; justify-content:space-between; align-items:center; padding:8px; border-bottom:1px solid #f1f5f9; text-align:left;">

                <span class="small fw-semibold" style="flex:1; white-space:normal; word-break:break-word; padding-right:8px;">${escHtml(label)}</span>

                <button onclick="Swal.close(); openTable(${t.id});" class="btn btn-sm btn-outline-primary py-1 px-2" style="font-size:0.75rem; flex-shrink:0;">Lihat</button>

            </div>`;

        });

        html += '</div>';

        Swal.fire({

            title: `📊 Penggunaan: "${columnName}"`,

            html: html,

            showConfirmButton: false,

            showCancelButton: true,

            cancelButtonText: 'Tutup',

            width: 600

        });

    } catch(e) {

        showToast('error', 'Error', e.message);

    }

}



async function editMasterColumn(id) {

    const nameEl = document.getElementById(`mc-name-${id}`);

    const unitEl = document.getElementById(`mc-unit-${id}`);

    if (!nameEl) return;

    const currentName = nameEl.textContent;

    const currentUnit = unitEl ? (unitEl.textContent === '-' ? '' : unitEl.textContent) : '';

    const { value: formValues } = await Swal.fire({

        title: 'Edit Master Kolom',

        html: `

            <div style="text-align:left;">

                <label style="font-size:0.85rem; font-weight:600; color:var(--text-secondary, #475569); display:block; margin-bottom:4px;">Nama Header:</label>

                <input id="swal-mc-name" class="swal2-input" value="${currentName}" style="width:100%; font-size:0.9rem;">

                <label style="font-size:0.85rem; font-weight:600; color:var(--text-secondary, #475569); display:block; margin:12px 0 4px;">Satuan:</label>

                <input id="swal-mc-unit" class="swal2-input" value="${currentUnit}" placeholder="Contoh: ha, ton, jiwa, %, rupiah" style="width:100%; font-size:0.9rem;">

            </div>

        `,

        showCancelButton: true,

        confirmButtonText: 'Simpan',

        cancelButtonText: 'Batal',

        focusConfirm: false,

        preConfirm: () => {

            const name = document.getElementById('swal-mc-name').value.trim();

            const unit = document.getElementById('swal-mc-unit').value.trim();

            if (!name) { Swal.showValidationMessage('Nama header wajib diisi'); return false; }

            return { name, unit };

        }

    });

    if (!formValues) return;

    if (formValues.name === currentName && formValues.unit === currentUnit) return;

    try {

        const res = await fetch(`${API_BASE}/master/columns/${id}`, {

            method: 'PUT',

            headers: { 'Content-Type': 'application/json' },

            body: JSON.stringify({ standard: formValues.name, unit: formValues.unit })

        });

        if (!res.ok) {

            const err = await res.json();

            throw new Error(err.detail || 'Gagal update');

        }

        await renderMasterColumns();
        notifyDataChange('master');

        showToast('success', 'Berhasil', `Header diubah menjadi "${formValues.name}"`, 1500);

    } catch (e) {

        showToast('error', 'Gagal', e.message);

    }

}



async function deleteAllMasterColumns() {

    const result = await Swal.fire({

        title: 'Hapus Semua Master Kolom?',

        text: 'Semua header standar akan dihapus. Sistem akan seperti belum memiliki Master Kolom.',

        icon: 'warning',

        showCancelButton: true,

        confirmButtonColor: cssVar('--danger') || cssVar('--danger') || '#ef4444',

        confirmButtonText: 'Ya, Hapus Semua',

        cancelButtonText: 'Batal'

    });

    if (!result.isConfirmed) return;

    try {

        const res = await fetch(`${API_BASE}/master/columns`, { method: 'DELETE' });

        if (!res.ok) {

            const err = await res.json();

            throw new Error(err.detail || 'Gagal hapus semua');

        }

        await renderMasterColumns();
        notifyDataChange('master');

        showToast('success', 'Berhasil', 'Semua Master Kolom telah dihapus.', 2000);

    } catch (e) {

        showToast('error', 'Gagal', e.message);

    }

}



async function deleteMasterColumn(id) {

    const result = await Swal.fire({

        title: 'Hapus Header?',

        text: 'Header ini akan dihapus dari master columns.',

        icon: 'warning',

        showCancelButton: true,

        confirmButtonColor: cssVar('--danger') || cssVar('--danger') || '#ef4444',

        confirmButtonText: 'Ya, Hapus',

        cancelButtonText: 'Batal'

    });

    if (!result.isConfirmed) return;

    try {

        const res = await fetch(`${API_BASE}/master/columns/${id}`, { method: 'DELETE' });

        if (!res.ok) {

            const err = await res.json();

            throw new Error(err.detail || 'Gagal hapus');

        }

        await renderMasterColumns();
        notifyDataChange('master');

        showToast('success', 'Dihapus', '', 1500);

    } catch (e) {

        showToast('error', 'Gagal', e.message);

    }

}



async function showAddMasterColumn() {

    const { value: formValues } = await Swal.fire({

        title: 'Tambah Header Baru',

        html: `

            <div style="text-align:left;">

                <label style="font-size:0.85rem; font-weight:600; color:var(--text-secondary, #475569); display:block; margin-bottom:4px;">Nama Header:</label>

                <input id="swal-mc-new-name" class="swal2-input" placeholder="Masukkan nama header..." style="width:100%; font-size:0.9rem;">

                <label style="font-size:0.85rem; font-weight:600; color:var(--text-secondary, #475569); display:block; margin:12px 0 4px;">Satuan:</label>

                <input id="swal-mc-new-unit" class="swal2-input" placeholder="Contoh: ha, ton, jiwa, %, rupiah" style="width:100%; font-size:0.9rem;">

            </div>

        `,

        showCancelButton: true,

        confirmButtonText: 'Tambah',

        cancelButtonText: 'Batal',

        focusConfirm: false,

        preConfirm: () => {

            const name = document.getElementById('swal-mc-new-name').value.trim();

            const unit = document.getElementById('swal-mc-new-unit').value.trim();

            if (!name) { Swal.showValidationMessage('Nama header wajib diisi'); return false; }

            return { name, unit };

        }

    });

    if (!formValues) return;

    try {

        const res = await fetch(`${API_BASE}/master/columns/add`, {

            method: 'POST',

            headers: { 'Content-Type': 'application/json' },

            body: JSON.stringify({ standard: formValues.name, unit: formValues.unit })

        });

        if (!res.ok) {

            const err = await res.json();

            throw new Error(err.detail || 'Gagal tambah');

        }

        await renderMasterColumns();
        notifyDataChange('master');

        showToast('success', 'Ditambahkan', `Header "${formValues.name}" berhasil ditambahkan`, 1500);

    } catch (e) {

        showToast('error', 'Gagal', e.message);

    }

}



async function searchMasterColumn(tableId, colIndex, headerText) {

    try {

        const res = await fetch(`${API_BASE}/master/columns`);

        if (!res.ok) throw new Error('Gagal memuat master columns');

        const data = await res.json();

        const cols = data.columns || [];

        

        const q = headerText.toLowerCase();

        const matches = cols.filter(c => {

            const s = c.standard.toLowerCase();

            return s.includes(q) || q.includes(s) || s.split(' ').some(w => q.includes(w)) || q.split(' ').some(w => s.includes(w));

        });



        let html = `

            <div style="margin-bottom:10px;">

                <input type="text" id="master-search-anomali" placeholder="Cari Master Kolom..." style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:6px; font-size:0.9rem;" oninput="filterMasterAnomali(this.value)">

            </div>

            <div id="master-list-anomali" style="max-height:300px; overflow-y:auto; border:1px solid #e2e8f0; border-radius:8px; padding:4px;">

                ${matches.map(c => {

                    const isExact = c.standard.toLowerCase() === q;

                    return `<div class="master-row-anomali" style="display:flex; align-items:center; padding:8px; cursor:pointer; border-bottom:1px solid #f1f5f9; border-radius:4px; ${isExact ? 'background:#dbeafe;' : ''}" onclick="applySaranAndReload(${tableId}, ${colIndex}, '${c.standard.replace(/'/g, "\\'")}')">

                        <span class="master-name-anomali" style="flex:1; white-space:normal; word-break:break-word; text-align:left;">${c.standard}</span>

                    </div>`;

                }).join('')}

            </div>

        `;

        

        Swal.fire({

            title: `” Master Kolom untuk "${headerText}"`,

            html: html,

            showConfirmButton: false,

            showCancelButton: true,

            cancelButtonText: 'Tutup',

            width: 650,

            didOpen: () => {

                document.getElementById('master-search-anomali').focus();

            }

        });

    } catch (e) {

        showToast('error', 'Gagal', e.message);

    }

}



async function fixSaranTerpilihAnomali() {

    const checkboxes = document.querySelectorAll('.anomali-checkbox:checked');

    if (checkboxes.length === 0) {

        showToast('info', 'Info', 'Pilih minimal satu anomali untuk diperbaiki.');

        return;

    }

    

    // Konfirmasi

    const result = await Swal.fire({

        title: 'Fix Saran Terpilih?',

        text: `Anda akan menerapkan saran master kolom untuk ${checkboxes.length} header terpilih.`,

        icon: 'question',

        showCancelButton: true,

        confirmButtonText: 'Fix Terpilih'

    });

    

    if (!result.isConfirmed) return;



    for (const cb of checkboxes) {

        const tableId = cb.dataset.tableId;

        const colIndex = cb.dataset.colIndex;

        const headerText = cb.dataset.header;

        

        // Cari saran terbaik

        const masterColsRes = await fetch(`${API_BASE}/master/columns`);

        if (masterColsRes.ok) {

            const data = await masterColsRes.json();

            const saran = findBestMasterMatch(headerText, data.columns || []);

            if (saran) {

                await applyColumnSuggestion(tableId, colIndex, saran);

            }

        }

    }

    

    // Refresh page

    loadHeaderAnomaliesPage();

    showToast('success', 'Berhasil', 'Saran telah diterapkan.');

}



async function fixSemuaSaranAnomali() {

    const allCheckboxes = document.querySelectorAll('.anomali-checkbox');

    if (allCheckboxes.length === 0) return;

    

    const result = await Swal.fire({

        title: 'Fix Semua Saran?',

        text: `Anda akan menerapkan saran master kolom untuk SEMUA ${allCheckboxes.length} anomali header.`,

        icon: 'warning',

        showCancelButton: true,

        confirmButtonText: 'Ya, Fix Semua'

    });

    

    if (!result.isConfirmed) return;



    const masterColsRes = await fetch(`${API_BASE}/master/columns`);

    if (!masterColsRes.ok) {

        showToast('error', 'Error', 'Gagal memuat master columns');

        return;

    }

    const data = await masterColsRes.json();

    const masterCols = data.columns || [];



    for (const cb of allCheckboxes) {

        const tableId = cb.dataset.tableId;

        const colIndex = cb.dataset.colIndex;

        const headerText = cb.dataset.header;

        

        const saran = findBestMasterMatch(headerText, masterCols);

        if (saran) {

            await applyColumnSuggestion(tableId, colIndex, saran);

        }

    }

    

    // Refresh page

    loadHeaderAnomaliesPage();

    showToast('success', 'Berhasil', 'Semua saran telah diterapkan.');

}



function filterMasterAnomali(q) {

    const words = q.toLowerCase().trim().split(/\s+/).filter(w => w.length > 0);

    const rows = document.querySelectorAll('.master-row-anomali');

    rows.forEach(row => {

        const name = row.querySelector('.master-name-anomali').textContent.toLowerCase();

        const match = words.every(w => name.includes(w));

        row.style.display = match ? '' : 'none';

    });

}



async function regenerateMasterColumns() {

    const result = await Swal.fire({

        title: 'Regenerate dari 2025?',

        text: 'Akan membuat ulang daftar master columns dari header tabel publikasi 2025. Data yang sudah diedit akan ditimpa.',

        icon: 'question',

        showCancelButton: true,

        confirmButtonText: 'Ya, Generate Ulang',

        cancelButtonText: 'Batal'

    });

    if (!result.isConfirmed) return;

    Swal.fire({ title: 'Memproses...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    try {

        const res = await fetch(`${API_BASE}/master/regenerate-columns?document_id=85`, { method: 'POST' });

        if (!res.ok) {

            const err = await res.json();

            throw new Error(err.detail || 'Gagal regenerate');

        }

        Swal.close();

        await renderMasterColumns();
        notifyDataChange('master');

        showToast('success', 'Berhasil', 'Master columns diperbarui dari publikasi 2025.', 2000);

    } catch (e) {

        Swal.close();

        showToast('error', 'Gagal', e.message);

    }

}







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
    const dataYearInput = document.getElementById('create-doc-data-year');
    const filenameInput = document.getElementById('create-doc-filename');

    const nextYr = new Date().getFullYear() + 1;
    const initialYr = nextYr > 2026 ? nextYr : 2027;
    if (yearInput) yearInput.value = initialYr;
    if (dataYearInput) {
        dataYearInput.value = initialYr - 1;
        delete dataYearInput.dataset.userEdited;
    }

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
    const yrInput = document.getElementById('create-doc-year');
    const dataYrInput = document.getElementById('create-doc-data-year');
    const yr = yrInput?.value || '2027';
    const yrNum = parseInt(yr);

    if (dataYrInput && !dataYrInput.dataset.userEdited && !isNaN(yrNum)) {
        dataYrInput.value = yrNum - 1;
    }

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
            pdfBox.classList.add('active');
            pdfBox.classList.remove('border-primary');
            pdfBox.style.backgroundColor = '';
        }
        if (emptyBox) {
            emptyBox.classList.remove('active');
            emptyBox.classList.remove('border-primary');
            emptyBox.style.backgroundColor = '';
        }
        if (pdfContainer) pdfContainer.style.display = 'block';
    } else {
        if (emptyRadio) emptyRadio.checked = true;
        if (emptyBox) {
            emptyBox.classList.add('active');
            emptyBox.classList.remove('border-primary');
            emptyBox.style.backgroundColor = '';
        }
        if (pdfBox) {
            pdfBox.classList.remove('active');
            pdfBox.classList.remove('border-primary');
            pdfBox.style.backgroundColor = '';
        }
        if (pdfContainer) pdfContainer.style.display = 'none';
    }
}

async function submitCreateDoc() {
    const yearInput = document.getElementById('create-doc-year');
    const dataYearInput = document.getElementById('create-doc-data-year');
    const filenameInput = document.getElementById('create-doc-filename');
    const pdfRadio = document.getElementById('doc-mode-pdf');
    const fileInput = document.getElementById('create-doc-file');

    const year = yearInput ? parseInt(yearInput.value) : null;
    const dataYear = dataYearInput && dataYearInput.value ? parseInt(dataYearInput.value) : (year ? year - 1 : null);
    const filename = filenameInput ? filenameInput.value.trim() : '';
    const isPdfMode = pdfRadio ? pdfRadio.checked : false;

    if (!year || isNaN(year)) {
        showToast('warning', 'Peringatan', 'Silakan masukkan tahun publikasi!');
        if (yearInput) yearInput.focus();
        return;
    }

    if (!dataYear || isNaN(dataYear)) {
        showToast('warning', 'Peringatan', 'Silakan masukkan tahun data!');
        if (dataYearInput) dataYearInput.focus();
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
            if (dataYear) formData.append('data_year', dataYear);
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
                year: year,
                data_year: dataYear
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
        notifyDataChange('document');

        const fromCreateTable = _createDocCallback;
        _createDocCallback = false;

        if (fromCreateTable) {
            Swal.fire({
                title: 'Publikasi Berhasil Dibuat',
                text: `Publikasi '${filename}' (${year}) siap digunakan. Membuka formulir tambah tabel...`,
                icon: 'success',
                timer: 1800,
                showConfirmButton: false
            });
            setTimeout(() => {
                openCreateTableModal(createdDoc?.id);
            }, 400);
        } else {
            showToast('success', 'Berhasil', `Publikasi '${filename}' (${year}) berhasil dibuat!`);
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
                    opts += `<option value="${d.id}" data-year="${d.year || ''}" data-data-year="${d.data_year || ''}" ${isSelected ? 'selected' : ''}>${escHtml(pubTitle)}</option>`;
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

    await updateCreateTableBabOptions(defaultBabNum);
    updateCreateTableNumberPrefix();

    const modalEl = document.getElementById('modal-create-table');
    if (modalEl) {
        const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
        modal.show();
    }
}

function getBpsStandardTitle(num) {
    const bpsMap = {
        1: "Geografi dan Iklim",
        2: "Pemerintahan",
        3: "Penduduk dan Ketenagakerjaan",
        4: "Sosial dan Kesejahteraan Rakyat",
        5: "Pertanian, Kehutanan, Peternakan, dan Perikanan",
        6: "Industri, Pertambangan, Energi, dan Air",
        7: "Perdagangan, Hotel, dan Pariwisata",
        8: "Transportasi dan Komunikasi",
        9: "Keuangan Daerah dan Harga",
        10: "Pengeluaran dan Konsumsi Penduduk",
        11: "Pendapatan Regional (PDRB)",
        12: "PDRB Lapangan Usaha",
        13: "Perbandingan Regional / Antar Wilayah"
    };
    return bpsMap[num] || "";
}

async function updateCreateTableBabOptions(selectBabNum = null) {
    const docSelect = document.getElementById('create-table-doc-id');
    const babSelect = document.getElementById('create-table-bab-num');
    const colYearInput = document.getElementById('create-table-col-year');
    if (!docSelect) return;

    const opt = docSelect.options[docSelect.selectedIndex];
    if (opt && colYearInput) {
        const pubYr = opt.dataset.year ? parseInt(opt.dataset.year) : null;
        const dataYr = opt.dataset.dataYear ? opt.dataset.dataYear : (pubYr ? String(pubYr - 1) : '');
        if (dataYr) {
            colYearInput.value = dataYr;
        } else if (pubYr) {
            colYearInput.value = String(pubYr);
        }
    }

    const docId = docSelect.value ? parseInt(docSelect.value) : null;
    if (docId && babSelect) {
        const currentVal = selectBabNum || babSelect.value || "1";
        try {
            const res = await fetch(`${API_BASE}/documents/${docId}/toc`);
            if (res.ok) {
                const tocData = await res.json();
                if (tocData && Array.isArray(tocData) && tocData.length > 0) {
                    let bOpts = '';
                    tocData.forEach((item, idx) => {
                        let bNum = item.bab_num || item.num;
                        let rawTitle = item.title || "";
                        
                        const m = rawTitle.match(/Bab\s+(\d+|[IVXLCDM]+)(?:\s*[\-\–\—\.\:]\s*(.*))?/i);
                        if (m) {
                            if (!bNum) {
                                bNum = parseInt(m[1], 10);
                                if (isNaN(bNum)) bNum = idx + 1;
                            }
                            if (m[2] && m[2].trim()) {
                                rawTitle = m[2].trim();
                            }
                        }
                        if (!bNum) bNum = idx + 1;

                        let cleanTitle = rawTitle.replace(/^Bab\s+\d+\s*[\-\–\—\.\:]\s*/i, '').trim();
                        if (!cleanTitle || cleanTitle.toLowerCase() === `bab ${bNum}`) {
                            cleanTitle = (typeof window.__getChapterTitle === 'function' ? window.__getChapterTitle(bNum) : '') || getBpsStandardTitle(bNum) || `Bab ${bNum}`;
                        }

                        const sel = String(bNum) === String(currentVal) ? 'selected' : '';
                        bOpts += `<option value="${bNum}" ${sel}>Bab ${bNum}: ${escHtml(cleanTitle)}</option>`;
                    });
                    if (bOpts) babSelect.innerHTML = bOpts;
                }
            }
        } catch (e) {
            console.warn("Gagal memuat bab publikasi:", e);
        }
    }

    updateCreateTableNumberPrefix();
}

function updateCreateTableNumberPrefix() {
    const babSelect = document.getElementById('create-table-bab-num');
    const numInput = document.getElementById('create-table-number');
    if (!babSelect || !numInput) return;

    let bab = babSelect.value;
    if (!bab || bab === 'undefined') bab = '1';
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

            confirmButtonColor: cssVar('--info') || '#2563eb',

            cancelButtonColor: cssVar('--text-secondary') || '#64748b',

            confirmButtonText: '📁 Buka di Editor Spreadsheet',

            cancelButtonText: 'Tetap di Data Tabel'

        }).then((result) => {

            // Refresh daftar publikasi / tabel

            if (typeof populateDocumentList === 'function') populateDocumentList();
            notifyDataChange('document');

            if (result.isConfirmed) {

                navigateToEditor(newTableId, fullTableName, 'db');

            }

        });



    } catch (e) {

        Swal.close();

        showToast('error', 'Gagal', e.message || 'Terjadi kesalahan saat membuat tabel');

    }

}



