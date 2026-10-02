// ===================== SISTEM: MODE PEMELIHARAAN =====================

let _maintenanceFlatpickr = null;
let _maintenanceRepositionAttached = false;

function _updateMaintenanceMinDate(fp) {
    if (!fp) return;
    const minD = new Date(Date.now() + 3 * 60 * 1000); // minimal 3 menit ke depan
    fp.set('minDate', minD);
}

function _repositionMaintenanceFlatpickr(fp) {
    if (!fp || !fp.calendarContainer || !fp.element) return;
    const input = fp.element;
    const cal = fp.calendarContainer;
    const rect = input.getBoundingClientRect();
    const calHeight = Math.max(380, cal.offsetHeight || 380);
    const calWidth = Math.max(360, cal.offsetWidth || 360);
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth;

    cal.style.position = 'fixed';
    cal.style.zIndex = '99999';

    // Vertical positioning: cek ruang bawah vs ruang atas
    const spaceBelow = viewportHeight - rect.bottom;
    const spaceAbove = rect.top;

    // Jika ruang bawah < 395px (tidak cukup untuk seluruh kalender + time picker) dan ruang atas cukup:
    // Otomatis buka ke ATAS input agar jam & menit tidak terpotong taskbar/layar
    if (spaceBelow < calHeight + 15 && spaceAbove >= 240) {
        const targetTop = Math.max(10, rect.top - calHeight - 6);
        cal.style.top = targetTop + 'px';
        cal.classList.add('arrowBottom');
        cal.classList.remove('arrowTop');
    } else {
        // Tampilkan di bawah input
        cal.style.top = (rect.bottom + 6) + 'px';
        cal.classList.add('arrowTop');
        cal.classList.remove('arrowBottom');
    }

    // Horizontal positioning: sejajar dengan input, tapi pastikan dalam viewport
    if (viewportWidth < 576) {
        // Layar mobile: tengahkan
        cal.style.left = '50%';
        cal.style.transform = 'translateX(-50%)';
    } else {
        cal.style.transform = 'none';
        let left = rect.left;
        if (left + calWidth > viewportWidth - 16) {
            left = Math.max(16, viewportWidth - calWidth - 16);
        }
        cal.style.left = left + 'px';
    }
}

function updateMaintenanceDurationPreview(selectedDates) {
    const box = document.getElementById('maintenance-estimate-box');
    const textEl = document.getElementById('maintenance-estimate-text');
    if (!box || !textEl) return;

    const date = (selectedDates && selectedDates.length) ? selectedDates[0] :
                 (_maintenanceFlatpickr && _maintenanceFlatpickr.selectedDates && _maintenanceFlatpickr.selectedDates.length ? _maintenanceFlatpickr.selectedDates[0] : null);

    if (!date) {
        box.style.display = 'none';
        return;
    }

    const diffMs = date.getTime() - Date.now();
    if (diffMs <= 0) {
        box.style.display = 'flex';
        box.className = 'alert alert-danger border py-1.5 px-2.5 mb-2 rounded-2 d-flex align-items-center gap-2';
        textEl.textContent = 'Waktu selesai sudah lewat dari waktu sekarang. Silakan pilih waktu ke depan.';
        return;
    }

    const totalMinutes = Math.round(diffMs / (60 * 1000));
    let durStr = '';
    if (totalMinutes < 60) {
        durStr = `${totalMinutes} menit`;
    } else {
        const hours = Math.floor(totalMinutes / 60);
        const mins = totalMinutes % 60;
        durStr = mins > 0 ? `${hours} jam ${mins} menit` : `${hours} jam`;
    }

    const timeFormatted = date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    const isToday = (new Date()).toDateString() === date.toDateString();
    const dayLabel = isToday ? 'Hari ini' : date.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' });

    box.style.display = 'flex';
    box.className = 'alert alert-primary border py-1.5 px-2.5 mb-2 rounded-2 d-flex align-items-center gap-2';
    textEl.innerHTML = `Durasi pemeliharaan: <strong>~${durStr}</strong> (selesai <strong>${dayLabel} pukul ${timeFormatted} WIB</strong>)`;
}
window.updateMaintenanceDurationPreview = updateMaintenanceDurationPreview;

function setMaintenancePreset(preset) {
    if (!_maintenanceFlatpickr) {
        _initMaintenanceFlatpickr();
    }
    if (!_maintenanceFlatpickr) return;

    const toggle = document.getElementById('maintenance-toggle');
    const dtGroup = document.getElementById('maintenance-datetime-group');
    if (toggle && !toggle.checked) {
        toggle.checked = true;
        if (dtGroup) dtGroup.style.display = 'block';
    }

    let targetDate = new Date();
    if (preset === 'tomorrow_morning') {
        targetDate.setDate(targetDate.getDate() + 1);
        targetDate.setHours(8, 0, 0, 0);
    } else if (typeof preset === 'number') {
        targetDate = new Date(Date.now() + preset * 60 * 1000);
    }

    _updateMaintenanceMinDate(_maintenanceFlatpickr);
    _maintenanceFlatpickr.setDate(targetDate, true);
    updateMaintenanceDurationPreview([targetDate]);
}
window.setMaintenancePreset = setMaintenancePreset;

function _initMaintenanceFlatpickr() {
    if (_maintenanceFlatpickr) return;
    const el = document.getElementById('maintenance-end-input');
    if (!el) return;
    if (typeof flatpickr === 'undefined') {
        el.placeholder = 'Error: Date picker gagal dimuat. Muat ulang halaman.';
        el.disabled = true;
        return;
    }
    _maintenanceFlatpickr = flatpickr(el, {
        enableTime: true,
        dateFormat: 'd/m/Y H:i',
        minuteIncrement: 5,
        locale: 'id',
        minDate: new Date(Date.now() + 3 * 60 * 1000),
        defaultDate: new Date(Date.now() + 60 * 60 * 1000),
        time_24hr: true,
        monthSelectorType: 'static',
        disableMobile: true,
        onOpen: function(selectedDates, dateStr, instance) {
            _updateMaintenanceMinDate(instance);
            _repositionMaintenanceFlatpickr(instance);
        },
        onChange: function(selectedDates, dateStr, instance) {
            updateMaintenanceDurationPreview(selectedDates);
        },
        onValueUpdate: function(selectedDates, dateStr, instance) {
            updateMaintenanceDurationPreview(selectedDates);
        },
        position: function(fp, inputElement) {
            _repositionMaintenanceFlatpickr(fp);
        }
    });

    if (!_maintenanceRepositionAttached) {
        _maintenanceRepositionAttached = true;
        const mainContent = document.querySelector('.main-content');
        if (mainContent) {
            mainContent.addEventListener('scroll', function() {
                if (_maintenanceFlatpickr && _maintenanceFlatpickr.isOpen) {
                    _repositionMaintenanceFlatpickr(_maintenanceFlatpickr);
                }
            }, { passive: true });
        }
        window.addEventListener('resize', function() {
            if (_maintenanceFlatpickr && _maintenanceFlatpickr.isOpen) {
                _repositionMaintenanceFlatpickr(_maintenanceFlatpickr);
            }
        }, { passive: true });
    }
}

let currentMaintenanceMode = '0';
let currentMaintenanceEnd = '';
let _userTogglingMaintenance = false;

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
        const badge = document.getElementById('maintenance-status-badge');
        if (badge) {
            badge.className = 'badge bg-danger';
            badge.textContent = 'Gagal memuat';
        }
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
    if (dtGroup && !_userTogglingMaintenance) dtGroup.style.display = isActive ? 'block' : 'none';
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
            const endDateObj = new Date(currentMaintenanceEnd);
            _maintenanceFlatpickr.setDate(endDateObj, true);
            updateMaintenanceDurationPreview([endDateObj]);
        } catch(e) {}
    }

    if (toggle) {
        toggle.onchange = function () {
            _userTogglingMaintenance = true;
            dtGroup.style.display = this.checked ? 'block' : 'none';
            if (this.checked && _maintenanceFlatpickr) {
                _updateMaintenanceMinDate(_maintenanceFlatpickr);
                const curSel = _maintenanceFlatpickr.selectedDates;
                if (!curSel || !curSel.length || curSel[0].getTime() <= Date.now() + 2 * 60 * 1000) {
                    const defDate = new Date(Date.now() + 60 * 60 * 1000);
                    _maintenanceFlatpickr.setDate(defDate, true);
                    updateMaintenanceDurationPreview([defDate]);
                } else {
                    updateMaintenanceDurationPreview(curSel);
                }
                _maintenanceFlatpickr.redraw();
            } else if (!this.checked) {
                const box = document.getElementById('maintenance-estimate-box');
                if (box) box.style.display = 'none';
            }
            _userTogglingMaintenance = false;
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

            const badgeType = '<span class="badge bg-warning bg-opacity-10 text-warning-emphasis border border-warning border-opacity-50 px-2 py-1">⚠️ Anomali Format</span>';

            const docBadge = `<span class="badge bg-secondary bg-opacity-10 text-secondary">${a.doc_year || '-'}</span>`;

            const cleanName = formatCleanTableName(a.table_name);

            const cleanInd = String(a.base_metric || a.indicator || '-').replace(/\.\d+$/, '').trim();

            

            html += `<tr>
                <td class="fw-semibold text-dark text-truncate" style="max-width: 240px;" title="${escHtml(a.table_name)}">${escHtml(cleanName)}</td>
                <td class="text-center text-muted" style="font-size:0.76rem;">${docBadge}</td>
                <td style="max-width: 200px;">
                    <div class="fw-semibold text-dark text-truncate">${escHtml(a.entitas)}</div>
                    <div class="text-muted text-truncate" style="font-size:0.75rem;">${escHtml(cleanInd)}</div>
                </td>
                <td class="text-center text-nowrap" style="font-size:0.76rem;">${a.prev_year} ➔ <b class="text-primary">${a.year}</b></td>
                <td class="text-center text-nowrap">${badgeType}</td>
                <td class="text-muted" style="font-size:0.76rem; line-height: 1.35;">
                    <div class="text-dark">${escHtml(a.message)}</div>
                </td>
                <td class="text-center">
                    <button onclick="openAnomalyTableModal(${idx});" class="btn btn-sm btn-outline-primary" style="font-size:0.72rem; padding:2px 8px; border-radius:5px;">
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

        badgeTypeEl.innerHTML = '⚠️ Anomali Format Angka';

        document.getElementById('anom-modal-icon').innerHTML = '⚠️';

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

            title: `📊Ÿ“Š Penggunaan: "${columnName}"`,

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

            title: `🔍  Master Kolom untuk "${headerText}"`,

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







// ===== TIME SERIES ADVANCED FEATURES (CHART & MASTER COLUMNS) =====
let timeSeriesChartInstance = null;
let timeSeriesChart2Instance = null;
let timeSeriesChart3Instance = null;
let timeSeriesChartYAxisInstance = null;
let timeSeriesChartYAxis2Instance = null;
let timeSeriesChartYAxis3Instance = null;

let tsRenderCallback = null;

let tsForceRecreateChart = true;

let tsOriginalTablesData = null;

let tsCurrentSubType = 'Semua';

let tsSavedVKChecks = null;
let tsSavedSubType = 'Semua';

// Palet 60 warna unik, kontras tinggi, dan saling berselang-seling (Glasbey/Polychrome standard - tanpa warna ungu)
const TS_DISTINCT_60_COLORS = [
    '#2563eb', '#dc2626', '#16a34a', '#d97706', '#0284c7',
    '#0891b2', '#db2777', '#4b5563', '#84cc16', '#0284c7',
    '#ea580c', '#059669', '#0d9488', '#ca8a04', '#0284c7',
    '#e11d48', '#65a30d', '#2563eb', '#b45309', '#0d9488',
    '#0891b2', '#78716c', '#0369a1', '#be123c', '#15803d',
    '#f59e0b', '#15803d', '#0e7490', '#9f1239', '#3b82f6',
    '#4d7c0f', '#0284c7', '#78350f', '#14b8a6', '#f43f5e',
    '#0f766e', '#854d0e', '#047857', '#ec4899', '#1e293b',
    '#06b6d4', '#eab308', '#3b82f6', '#ef4444', '#10b981',
    '#f97316', '#008080', '#0369a1', '#374151', '#22c55e',
    '#1d4ed8', '#e05638', '#065f46', '#e59819', '#38bdf8',
    '#fb7185', '#166534', '#c2410c', '#047857', '#0f172a'
];

function getTSDistinctColor(entityName, entIdx, allEntities) {
    if (!entityName) return TS_DISTINCT_60_COLORS[0];
    const isSummary = (typeof getSummaryEntityDetector === 'function') ? getSummaryEntityDetector(allEntities) : (e => e.trim().toLowerCase() === 'kabupaten tasikmalaya');
    if (isSummary(entityName)) {
        return '#0f172a';
    }
    const idx = (allEntities && allEntities.length > 0) ? allEntities.indexOf(entityName) : entIdx;
    const safeIdx = Math.max(0, idx >= 0 ? idx : (entIdx || 0));
    return TS_DISTINCT_60_COLORS[safeIdx % TS_DISTINCT_60_COLORS.length];
}

let _legendPopoverHideTimer = null;

function _scheduleHideLegendEntityPopover() {
    _legendPopoverHideTimer = setTimeout(() => {
        _hideLegendEntityPopover();
    }, 180);
}

function _cancelHideLegendEntityPopover() {
    if (_legendPopoverHideTimer) {
        clearTimeout(_legendPopoverHideTimer);
        _legendPopoverHideTimer = null;
    }
}

function _showLegendEntityPopover(targetEl, entityName, years, dataPoints, color, unit) {
    _cancelHideLegendEntityPopover();
    let pop = document.getElementById('ts-legend-hover-popover');
    if (!pop) {
        pop = document.createElement('div');
        pop.id = 'ts-legend-hover-popover';
        pop.style.cssText = 'position:fixed; z-index:999999; background:#0f172a; color:#f8fafc; border:1px solid #334155; border-radius:10px; padding:10px 14px; box-shadow:0 12px 28px -4px rgba(0,0,0,0.6), 0 8px 10px -6px rgba(0,0,0,0.4); pointer-events:auto; font-family:"Inter", -apple-system, BlinkMacSystemFont, sans-serif; transition:opacity 0.12s ease, transform 0.12s ease; opacity:0; transform:translateY(4px); width:330px;';
        pop.addEventListener('mouseenter', _cancelHideLegendEntityPopover);
        pop.addEventListener('mouseleave', _scheduleHideLegendEntityPopover);
        document.body.appendChild(pop);
    }

    const unitStr = unit ? ` ${unit}` : '';
    let tableRows = '';
    let validValues = [];

    if (years && dataPoints) {
        years.forEach((yr, i) => {
            const val = dataPoints[i];
            const isValid = (val !== null && val !== undefined && !isNaN(val));
            if (isValid) validValues.push(val);

            let growthBadge = `<span style="color:#64748b; font-size:10px; font-weight:500;">—</span>`;
            if (i > 0 && isValid) {
                const prevVal = dataPoints[i - 1];
                if (prevVal !== null && prevVal !== undefined && !isNaN(prevVal)) {
                    const diff = val - prevVal;
                    if (diff > 0.0001) {
                        const pct = prevVal !== 0 ? `+${((diff / Math.abs(prevVal)) * 100).toFixed(2).replace('.', ',')}%` : `+${formatIndoNumber(diff)}`;
                        growthBadge = `<span style="background:rgba(34,197,94,0.16); color:#4ade80; border:1px solid rgba(34,197,94,0.3); padding:1px 5px; border-radius:4px; font-size:9.5px; font-weight:700; white-space:nowrap;">▲ ${pct}</span>`;
                    } else if (diff < -0.0001) {
                        const pct = prevVal !== 0 ? `${((diff / Math.abs(prevVal)) * 100).toFixed(2).replace('.', ',')}%` : `${formatIndoNumber(diff)}`;
                        growthBadge = `<span style="background:rgba(239,68,68,0.16); color:#f87171; border:1px solid rgba(239,68,68,0.3); padding:1px 5px; border-radius:4px; font-size:9.5px; font-weight:700; white-space:nowrap;">▼ ${pct}</span>`;
                    } else {
                        growthBadge = `<span style="background:rgba(148,163,184,0.12); color:#94a3b8; border:1px solid rgba(148,163,184,0.22); padding:1px 5px; border-radius:4px; font-size:9.5px; font-weight:600; white-space:nowrap;">— 0%</span>`;
                    }
                }
            } else if (i === 0 && isValid) {
                growthBadge = `<span style="color:#64748b; font-size:10px; font-weight:500;">(Awal)</span>`;
            }

            const displayVal = !isValid ? '-' : `${formatIndoNumber(val)}${unitStr}`;
            tableRows += `
                <div style="display:grid; grid-template-columns: 46px 1fr 68px; align-items:center; gap:6px; padding:4px 0; border-bottom:1px solid rgba(255,255,255,0.06); font-size:11.5px;">
                    <span style="color:#94a3b8; font-weight:600; font-variant-numeric:tabular-nums;">${yr}</span>
                    <span style="color:#ffffff; font-weight:700; text-align:right; font-variant-numeric:tabular-nums; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${displayVal}</span>
                    <div style="display:flex; justify-content:flex-end; align-items:center;">
                        ${growthBadge}
                    </div>
                </div>
            `;
        });
    }

    // Overall trend badge in header
    let trendBadge = '';
    if (validValues.length >= 2) {
        const first = validValues[0];
        const last = validValues[validValues.length - 1];
        const totalDiff = last - first;
        if (totalDiff > 0.0001) {
            trendBadge = `<span style="margin-left:auto; background:rgba(34,197,94,0.18); color:#4ade80; border:1px solid rgba(34,197,94,0.35); font-size:9.5px; font-weight:700; padding:1px 6px; border-radius:4px;">▲ Naik (+${formatIndoNumber(totalDiff)})</span>`;
        } else if (totalDiff < -0.0001) {
            trendBadge = `<span style="margin-left:auto; background:rgba(239,68,68,0.18); color:#f87171; border:1px solid rgba(239,68,68,0.35); font-size:9.5px; font-weight:700; padding:1px 6px; border-radius:4px;">▼ Turun (${formatIndoNumber(totalDiff)})</span>`;
        } else {
            trendBadge = `<span style="margin-left:auto; background:rgba(148,163,184,0.18); color:#cbd5e1; border:1px solid rgba(148,163,184,0.3); font-size:9.5px; font-weight:600; padding:1px 6px; border-radius:4px;">— Tetap (0)</span>`;
        }
    }

    pop.innerHTML = `
        <style>
            #ts-legend-hover-popover .ts-popover-scroll {
                max-height: 82px;
                overflow-y: auto;
                scrollbar-width: thin;
                scrollbar-color: rgba(255, 255, 255, 0.25) transparent;
                padding-right: 8px;
            }
            #ts-legend-hover-popover .ts-popover-scroll::-webkit-scrollbar {
                width: 4px;
            }
            #ts-legend-hover-popover .ts-popover-scroll::-webkit-scrollbar-track {
                background: transparent;
            }
            #ts-legend-hover-popover .ts-popover-scroll::-webkit-scrollbar-thumb {
                background: rgba(255, 255, 255, 0.25);
                border-radius: 6px;
            }
            #ts-legend-hover-popover .ts-popover-scroll::-webkit-scrollbar-thumb:hover {
                background: rgba(255, 255, 255, 0.45);
            }
        </style>
        <div style="display:flex; align-items:center; gap:8px; border-bottom:1px solid rgba(255,255,255,0.12); padding-bottom:6px; margin-bottom:6px;">
            <span style="width:10px; height:10px; border-radius:50%; background:${color || '#38bdf8'}; display:inline-block; flex-shrink:0;"></span>
            <span style="font-size:12.5px; font-weight:800; color:#ffffff; letter-spacing:0.2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${entityName}</span>
            ${trendBadge}
        </div>
        <!-- Table Column Headers -->
        <div style="display:grid; grid-template-columns: 46px 1fr 68px; gap:6px; padding:0 8px 3px 0; border-bottom:1px solid rgba(255,255,255,0.1); font-size:10px; font-weight:700; color:#64748b; letter-spacing:0.3px; text-transform:uppercase;">
            <span>Tahun</span>
            <span style="text-align:right;">Nilai</span>
            <span style="text-align:right;">Perubahan</span>
        </div>
        <!-- Scrollable Table Body (Tepat 3 baris terlihat, jika >3 tahun otomatis scroll) -->
        <div class="ts-popover-scroll">
            ${tableRows}
        </div>
    `;

    const rect = targetEl.getBoundingClientRect();
    pop.style.display = 'block';
    const popRect = pop.getBoundingClientRect();

    let left = rect.left + (rect.width / 2) - (popRect.width / 2);
    if (left < 10) left = 10;
    if (left + popRect.width > window.innerWidth - 10) {
        left = window.innerWidth - popRect.width - 10;
    }

    let top = rect.bottom + 8;
    if (top + popRect.height > window.innerHeight - 10) {
        top = rect.top - popRect.height - 8;
    }

    pop.style.left = `${Math.round(left)}px`;
    pop.style.top = `${Math.round(top)}px`;
    pop.style.opacity = '1';
    pop.style.transform = 'translateY(0)';
}

function _hideLegendEntityPopover() {
    const pop = document.getElementById('ts-legend-hover-popover');
    if (pop) {
        pop.style.opacity = '0';
        pop.style.transform = 'translateY(4px)';
        setTimeout(() => {
            if (pop && pop.style.opacity === '0') {
                pop.style.display = 'none';
            }
        }, 120);
    }
}

// Mobile / Touch Tap-to-Focus state
let tsFocusedEntity = null;

function _applyTimeSeriesEntityFocus(entityName) {
    tsFocusedEntity = entityName;

    // Update styling on all legend pills
    document.querySelectorAll('.custom-legend-item').forEach(legEl => {
        const ent = legEl.dataset.entity;
        if (!ent) return;
        if (ent === entityName) {
            legEl.classList.add('ts-legend-focused');
            legEl.classList.remove('ts-legend-dimmed');
        } else {
            legEl.classList.remove('ts-legend-focused');
            legEl.classList.add('ts-legend-dimmed');
        }
    });

    // Update charts: highlight focused dataset and dim others
    [window.timeSeriesChartInstance, window.timeSeriesChart2Instance, window.timeSeriesChart3Instance].forEach(inst => {
        if (inst && inst.data && inst.data.datasets) {
            inst.data.datasets.forEach(ds => {
                if (ds.entity === entityName) {
                    ds.borderWidth = 4.5;
                    ds.pointRadius = 6.5;
                    ds.order = -1;
                } else {
                    ds.borderWidth = 1.2;
                    ds.pointRadius = 2.5;
                    ds.order = 1;
                }
            });
            inst.update('none');
        }
    });
}

function _resetTimeSeriesEntityFocus() {
    if (!tsFocusedEntity) return;
    tsFocusedEntity = null;

    // Reset legend pills
    document.querySelectorAll('.custom-legend-item').forEach(legEl => {
        legEl.classList.remove('ts-legend-focused');
        legEl.classList.remove('ts-legend-dimmed');
    });

    // Reset charts: restore normal line thicknesses
    [window.timeSeriesChartInstance, window.timeSeriesChart2Instance, window.timeSeriesChart3Instance].forEach(inst => {
        if (inst && inst.data && inst.data.datasets) {
            inst.data.datasets.forEach(ds => {
                ds.borderWidth = 2.5;
                ds.pointRadius = 4.5;
                ds.order = 0;
            });
            inst.update('none');
        }
    });
}

// Global click/tap listener to reset focus when tapping outside
document.addEventListener('pointerdown', function(e) {
    if (!tsFocusedEntity) return;
    // Don't reset if tapping on a legend pill itself
    if (e.target.closest('.custom-legend-item') || e.target.closest('#ts-legend-hover-popover')) {
        return;
    }
    _resetTimeSeriesEntityFocus();
    _hideLegendEntityPopover();
});


function renderTimeSeriesChart(selectedVk, entities, allEntities, years, entityMap, chartIdx, animatingEntityName) {

    var containerMap = { 1: 'ts-chart-container', 2: 'ts-chart-container-2', 3: 'ts-chart-container-3' };

    var canvasMap = { 1: 'timeSeriesChart', 2: 'timeSeriesChart2', 3: 'timeSeriesChart3' };

    var legendMap = { 1: 'ts-custom-legend', 2: 'ts-custom-legend-2', 3: 'ts-custom-legend-3' };

    var scrollableMap = { 1: 'ts-chart-scrollable', 2: 'ts-chart-scrollable-2', 3: 'ts-chart-scrollable-3' };

    var wrapperMap = { 1: 'ts-chart-wrapper', 2: 'ts-chart-wrapper-2', 3: 'ts-chart-wrapper-3' };

    var titleMap = { 1: 'ts-chart-title-1', 2: 'ts-chart-title-2', 3: 'ts-chart-title-3' };

    var tooltipMap = { 1: 'ts-chart-tooltip', 2: 'ts-chart-tooltip-2', 3: 'ts-chart-tooltip-3' };

    const containerId = containerMap[chartIdx] || 'ts-chart-container';

    const canvasId = canvasMap[chartIdx] || 'timeSeriesChart';

    const legendId = legendMap[chartIdx] || 'ts-custom-legend';

    const scrollableId = scrollableMap[chartIdx] || 'ts-chart-scrollable';

    const wrapperId = wrapperMap[chartIdx] || 'ts-chart-wrapper';

    const titleId = titleMap[chartIdx] || 'ts-chart-title-1';



    const container = document.getElementById(containerId);

    const ctx = document.getElementById(canvasId);

    if (!container || !ctx) return;



    if (!years || years.length === 0 || !selectedVk) {

        container.style.display = 'none';

        return;

    }

    container.style.display = 'block';



    const isSingleYear = years.length === 1;

    const barAnimationConfig = {

        y: {

            type: 'number',

            easing: 'easeOutQuart',

            duration: 600,

            from: (ctx) => (ctx.type === 'data' ? 0 : undefined)

        }

    };

    const scrollable = document.getElementById(scrollableId);
    const wrapper = document.getElementById(wrapperId);
    if (wrapper) {
        wrapper.style.height = '320px';
        wrapper.style.minHeight = '320px';
        const activeLabelsCount = isSingleYear ? entities.length : years.length;
        const parentW = (scrollable && scrollable.clientWidth > 50) 
            ? scrollable.clientWidth 
            : (container && container.clientWidth > 50 ? container.clientWidth : 800);
        const parentWidth = parentW - 15;
        const calculatedWidth = activeLabelsCount * 80;
        if (calculatedWidth > parentWidth) {
            wrapper.style.width = calculatedWidth + 'px';
        } else {
            wrapper.style.width = '100%';
        }
    }



    // Resolve active unit config for this VK

    const vkUnit = (currentTimeSeriesData && currentTimeSeriesData.vkUnits && currentTimeSeriesData.vkUnits[selectedVk]) || '';

    const unitConfig = getUnitConfigForVK(selectedVk);



    const chartType = isSingleYear ? 'bar' : 'line';

    const isSummaryEntity = (typeof getSummaryEntityDetector === 'function')
        ? getSummaryEntityDetector(allEntities)
        : (ent => ['jumlah', 'total', 'subtotal', 'grand total', 'keseluruhan', 'seluruh'].some(kw => ent.trim().toLowerCase() === kw));



    const datasets = [];



    function parseVal(val) {

        if (val === null || val === undefined || val === '' || val === '-' || val === '...') return null;

        var s = String(val).trim();

        if (!s) return null;

        var noSpace = s.replace(/\s/g, '');

        if (s.indexOf(',') !== -1) {

            s = s.replace(/[\s.]/g, '').replace(',', '.');

        } else if (/^\d{1,3}(\.\d{3})+$/.test(noSpace)) {

            s = noSpace.replace(/\./g, '');

        } else if (noSpace.indexOf('.') !== -1) {

            s = noSpace;

        } else {

            s = noSpace;

        }

        var num = parseFloat(s);

        return isNaN(num) ? null : num;

    }



    // Single-VK dataset building: entity-based colors with scaling

    entities.forEach(function(ent, entIdx) {

        var dataPoints;

        if (isSingleYear) {

            dataPoints = entities.map(function(e, idx) {

                if (idx === entIdx) {

                    var yearData = entityMap[e][years[0]] || {};

                    var v = parseVal(yearData[selectedVk]);

                    return (v === null) ? null : (unitConfig ? v * (unitConfig.factor != null ? unitConfig.factor : 1) : v);

                }

                return null;

            });

        } else {

            dataPoints = years.map(function(y) {

                var yearData = entityMap[ent][y] || {};

                var v = parseVal(yearData[selectedVk]);

                var scaled = (v === null) ? null : (unitConfig ? v * (unitConfig.factor != null ? unitConfig.factor : 1) : v);

                return scaled === null ? 0 : scaled;

            });

        }

        const color = getTSDistinctColor(ent, entIdx, allEntities);

        if (isSingleYear) {

            datasets.push({

                label: ent,

                entity: ent,

                data: dataPoints,

                backgroundColor: color,

                borderColor: color,

                borderWidth: 1,

                barPercentage: 0.9,

                grouped: false,

                hidden: isSummaryEntity(ent) || tsHiddenEntities.has(ent)

            });

        } else {

            datasets.push({

                label: ent,

                entity: ent,

                data: dataPoints,

                borderColor: color,

                backgroundColor: color,

                borderWidth: 2.5,

                tension: 0.25,

                fill: false, // Tanpa fill

                pointRadius: 4.5,

                pointHoverRadius: 7,

                pointBackgroundColor: cssVar('--text-white') || '#ffffff',

                pointBorderColor: color,

                pointBorderWidth: 2,

                spanGaps: true,

                hidden: isSummaryEntity(ent) || tsHiddenEntities.has(ent)
            });
        }
    });



    function truncateLabel(s, max) {

        max = max || 40;

        return s.length > max ? s.substring(0, max) + '...' : s;

    }

    const chartLabels = isSingleYear ? entities.map(e => truncateLabel(e, 40)) : years;



    // Check if we can dynamically update the existing chart instead of recreating it

    var instanceMap = { 1: 'timeSeriesChartInstance', 2: 'timeSeriesChart2Instance', 3: 'timeSeriesChart3Instance' };

    var yAxisMap = { 1: 'timeSeriesChartYAxisInstance', 2: 'timeSeriesChartYAxis2Instance', 3: 'timeSeriesChartYAxis3Instance' };

    var instanceKey = instanceMap[chartIdx] || 'timeSeriesChartInstance';

    var yAxisKey = yAxisMap[chartIdx] || 'timeSeriesChartYAxisInstance';

    var chartInst = window[instanceKey];

    var yAxisInst = window[yAxisKey];



    // Destroy existing instance to trigger fresh point-to-point progressive animation on all reloads

    if (chartInst) {

        if (chartInst._tracerRafId) {

            cancelAnimationFrame(chartInst._tracerRafId);

            chartInst._tracerRafId = null;

        }

        try {

            chartInst.destroy();

        } catch(e) {}

        chartInst = null;

        window[instanceKey] = null;

    }



    if (!isSingleYear) {

        if (!Chart.registry.plugins.get('progressiveLineTracer')) {

            Chart.register({

                id: 'progressiveLineTracer',

                beforeDatasetDraw(chart, args) {

                    if (chart.config.type !== 'line') return;

                    if (!chart.canvas || !chart.canvas.id || !chart.canvas.id.toLowerCase().includes('timeseries')) return;

                    const p = chart._tracerProgress;

                    if (p == null || p >= 1) return;



                    // Lewati dataset yang tidak termasuk dalam target animasi selektif

                    if (chart._animatingDatasetIndices && !chart._animatingDatasetIndices.has(args.index)) {

                        return;

                    }



                    if (!chart || !chart.ctx || !chart.canvas || chart.ctx.canvas !== chart.canvas) return;

                    const { ctx, chartArea, scales: { x } } = chart;

                    if (!ctx || !chartArea || !x) return;

                    const totalLabels = (chart.data.labels || []).length;
                    if (totalLabels <= 1) return;

                    const firstTickX = x.getPixelForTick(0);
                    const lastTickX = x.getPixelForTick(totalLabels - 1);
                    if (isNaN(firstTickX) || isNaN(lastTickX)) return;

                    const currentX = firstTickX + (lastTickX - firstTickX) * Math.max(0, Math.min(1, p));

                    try {
                        ctx.save();
                        ctx.beginPath();
                        ctx.rect(chartArea.left - 25, chartArea.top - 25, Math.max(1, (currentX - chartArea.left + 30)), (chartArea.height + 50));
                        ctx.clip();
                    } catch(e) {}
                },
                afterDatasetDraw(chart, args) {
                    if (chart.config.type !== 'line') return;
                    if (!chart.canvas || !chart.canvas.id || !chart.canvas.id.toLowerCase().includes('timeseries')) return;

                    const p = chart._tracerProgress;
                    if (p == null || p >= 1) return;

                    if (chart._animatingDatasetIndices && !chart._animatingDatasetIndices.has(args.index)) {
                        return;
                    }

                    if (chart.ctx) {
                        try { chart.ctx.restore(); } catch(e) {}
                    }
                }
            });

        }



        if (!Chart.registry.plugins.get('timeSeriesGrowthBadgePlugin')) {

            Chart.register({

                id: 'timeSeriesGrowthBadgePlugin',

                afterDatasetsDraw(chart) {

                    if (!window.tsGrowthBadgeEnabled) return;

                    if (!chart || !chart.ctx || !chart.canvas || chart.ctx.canvas !== chart.canvas) return;

                    if (!chart.canvas.id || !chart.canvas.id.toLowerCase().includes('timeseries')) return;

                    const { ctx, scales: { x, y } } = chart;
                    if (!ctx || !x || !y) return;

                    try {

                    const isDark = document.documentElement.getAttribute('data-bs-theme') === 'dark';

                    

                    const visibleDatasets = chart.data.datasets.filter(ds => !ds.hidden && ds.data && ds.data.length > 0);

                    if (visibleDatasets.length === 0) return;

                    

                    const datasetsToBadge = visibleDatasets.length <= 4 

                        ? visibleDatasets 

                        : (chart._hoveredDatasetIndex != null && !chart.data.datasets[chart._hoveredDatasetIndex]?.hidden

                            ? [chart.data.datasets[chart._hoveredDatasetIndex]]

                            : []);



                    if (datasetsToBadge.length === 0) return;



                    const p = chart._tracerProgress;

                    const totalLabels = (chart.data.labels || []).length;

                    const firstTickX = x.getPixelForTick(0);

                    const lastTickX = x.getPixelForTick(Math.max(0, totalLabels - 1));

                    const currentX = (p == null || p >= 1) ? (lastTickX + 100) : (firstTickX + (lastTickX - firstTickX) * p);



                    datasetsToBadge.forEach(ds => {

                        const dsIdx = chart.data.datasets.indexOf(ds);

                        const isDatasetAnimating = chart._animatingDatasetIndices 

                            ? chart._animatingDatasetIndices.has(dsIdx) 

                            : (p != null && p < 1);



                        const pts = ds.data.map((val, i) => {

                            const targetX = x.getPixelForTick(i);

                            const isReached = isDatasetAnimating ? (targetX <= currentX + 6) : true;

                            return {

                                x: targetX,

                                y: y.getPixelForValue(val),

                                val: val,

                                isReached: isReached

                            };

                        }).filter(p => p.val != null && !isNaN(p.val) && p.x != null && p.y != null);



                        if (pts.length === 0) return;



                        const chartArea = chart.chartArea;

                        // Penyeragaman posisi vertikal: jika salah satu titik dekat tepi atas kanvas, semua badge garis ini diletakkan di bawah titik. Sebaliknya, semua diletakkan di atas titik.

                        const hasAnyNearTop = pts.some(pt => pt.y - (chartArea ? chartArea.top : 0) < 22);

                        const uniformPlacementBelow = hasAnyNearTop;



                        for (let i = 0; i < pts.length; i++) {

                            const pt = pts[i];

                            if (!pt.isReached) continue;

                            let badgeText = '';

                            let isUp = true;

                            let isZero = false;



                            if (i === 0) {

                                const formattedInit = formatWithUnitScale(pt.val, { factor: 1, isInteger: unitConfig?.isInteger, maxDecimals: unitConfig?.maxDecimals });

                                badgeText = `Awal: ${formattedInit}`;

                            } else {

                                const prevVal = pts[i - 1].val;

                                const delta = pt.val - prevVal;

                                const formattedDelta = formatWithUnitScale(Math.abs(delta), { factor: 1, isInteger: unitConfig?.isInteger, maxDecimals: unitConfig?.maxDecimals });

                                if (delta > 0) {

                                    badgeText = `▲ +${formattedDelta}`;

                                    isUp = true;

                                } else if (delta < 0) {

                                    badgeText = `▼ -${formattedDelta}`;

                                    isUp = false;

                                } else {

                                    badgeText = `0`;

                                    isZero = true;

                                }

                            }



                            ctx.save();

                            ctx.font = '600 10px "Outfit", "Inter", sans-serif';

                            ctx.textAlign = 'center';

                            ctx.textBaseline = 'middle';



                            const textWidth = ctx.measureText(badgeText).width;

                            const pillWidth = textWidth + 12;

                            const pillHeight = 18;



                            // Posisi sentral tepat di atas/bawah titik (rata seragam tanpa geser samping)

                            let pillX = pt.x;

                            let pillY = uniformPlacementBelow ? (pt.y + 15) : (pt.y - 15);



                            if (chartArea) {

                                const minX = chartArea.left + (pillWidth / 2) + 2;

                                const maxX = chartArea.right - (pillWidth / 2) - 2;

                                pillX = Math.max(minX, Math.min(maxX, pillX));



                                const minY = chartArea.top + (pillHeight / 2) + 2;

                                const maxY = chartArea.bottom - (pillHeight / 2) - 2;

                                pillY = Math.max(minY, Math.min(maxY, pillY));

                            } else {

                                pillX = Math.max(pillWidth / 2 + 4, Math.min(chart.width - pillWidth / 2 - 4, pillX));

                                pillY = Math.max(pillHeight / 2 + 4, pillY);

                            }



                            ctx.beginPath();

                            if (typeof ctx.roundRect === 'function') {

                                ctx.roundRect(pillX - pillWidth / 2, pillY - pillHeight / 2, pillWidth, pillHeight, 9);

                            } else {

                                ctx.rect(pillX - pillWidth / 2, pillY - pillHeight / 2, pillWidth, pillHeight);

                            }



                            if (i === 0) {

                                ctx.fillStyle = isDark ? 'rgba(30, 41, 59, 0.94)' : 'rgba(241, 245, 249, 0.96)';

                                ctx.strokeStyle = isDark ? cssVar('--text-tertiary') || '#475569' : cssVar('--text-muted') || '#cbd5e1';

                            } else if (isZero) {

                                ctx.fillStyle = isDark ? 'rgba(30, 41, 59, 0.92)' : 'rgba(241, 245, 249, 0.95)';

                                ctx.strokeStyle = isDark ? cssVar('--text-secondary') || '#64748b' : cssVar('--text-light') || '#94a3b8';

                            } else if (isUp) {

                                ctx.fillStyle = isDark ? 'rgba(6, 78, 59, 0.92)' : 'rgba(209, 250, 229, 0.96)';

                                ctx.strokeStyle = isDark ? cssVar('--success-emerald') || '#10b981' : cssVar('--success') || '#059669';

                            } else {

                                ctx.fillStyle = isDark ? 'rgba(127, 29, 29, 0.92)' : 'rgba(254, 226, 226, 0.96)';

                                ctx.strokeStyle = isDark ? cssVar('--danger') || '#ef4444' : cssVar('--danger') || '#dc2626';

                            }

                            ctx.lineWidth = 1.2;

                            ctx.fill();

                            ctx.stroke();



                            // Warna Teks

                            if (i === 0) {

                                ctx.fillStyle = isDark ? cssVar('--text-muted') || '#cbd5e1' : cssVar('--text-tertiary') || '#475569';

                            } else if (isZero) {

                                ctx.fillStyle = isDark ? cssVar('--text-light') || '#94a3b8' : cssVar('--text-secondary') || '#64748b';

                            } else if (isUp) {

                                ctx.fillStyle = isDark ? cssVar('--success-light') || '#34d399' : cssVar('--success-dark') || '#047857';

                            } else {

                                ctx.fillStyle = isDark ? cssVar('--danger') || '#f87171' : cssVar('--danger-text') || '#b91c1c';

                            }

                            ctx.fillText(badgeText, pillX, pillY);

                            ctx.restore();

                        }

                    });

                    } catch (e) {
                        // ignore draw errors during quick view-switch or resize
                    }

                }

            });

        }

    }



    // Render custom legend

    const legendDiv = document.getElementById(legendId);

    if (legendDiv) {

        let legendHtml = '';

        datasets.forEach((ds, idx) => {

            const labelText = ds.entity || ds.label;

            const truncated = truncateLabel(labelText, 45);

            const color = ds.borderColor || ds.backgroundColor;

            const isHidden = ds.hidden || false;

            legendHtml += `

                <div class="custom-legend-item ts-legend-pill ${isHidden ? 'ts-legend-disabled' : ''}" data-index="${idx}" data-entity="${escHtml(labelText)}" data-chart="${chartIdx || 1}" style="display:flex; align-items:center; gap:6px; cursor:pointer; opacity: ${isHidden ? 0.4 : 1}; user-select:none;">

                    <span class="custom-legend-dot" style="width:12px; height:12px; border-radius:50%; background:${color}; display:inline-block; border: 1px solid rgba(0,0,0,0.1);"></span>

                    <span class="custom-legend-text" style="font-size:11px; font-weight:500; text-decoration: ${isHidden ? 'line-through' : 'none'};">${truncated}</span>

                </div>

            `;

        });

        legendDiv.innerHTML = legendHtml;

    }



    chartInst = new Chart(ctx, {

        type: chartType,

        data: {

            labels: chartLabels,

            datasets: datasets

        },

        options: {

            responsive: true,

            maintainAspectRatio: false,

            layout: {

                padding: {

                    top: 24,

                    right: 28,

                    left: 8,

                    bottom: 40

                }

            },

            interaction: {

                mode: 'nearest',

                intersect: false

            },

            onHover: (event, elements, chart) => {

                if (chart._isMobileTouch) return;

                if (elements && elements.length > 0) {

                    const dsIdx = elements[0].datasetIndex;

                    if (chart._hoveredDatasetIndex !== dsIdx) {

                        chart._hoveredDatasetIndex = dsIdx;

                        chart.draw();

                    }

                } else if (chart._hoveredDatasetIndex != null) {

                    chart._hoveredDatasetIndex = null;

                    chart.draw();

                }

            },

            animation: isSingleYear ? {

                duration: 600,

                easing: 'easeOutQuart'

            } : false,

            animations: isSingleYear ? {

                y: {

                    type: 'number',

                    easing: 'easeOutQuart',

                    duration: 600,

                    from: (ctx) => (ctx.type === 'data' ? ctx.chart.scales.y.getPixelForValue(0) : undefined),

                    delay: (ctx) => (ctx.type === 'data' ? ctx.dataIndex * 40 : 0)

                }

            } : {},

            transitions: {

                active: {

                    animation: { duration: 250, easing: 'easeOutQuart' }

                }

            },



            plugins: {

                legend: {

                    display: false

                },

                tooltip: isSingleYear ? {

                    enabled: true,

                    filter: function() {

                        if (!(tsTooltipEnabled && window.tsTooltipEnabled !== false)) return false;
                        // Mobile: block built-in tooltip; only allow via long-press external
                        if (('ontouchstart' in window) || (navigator.maxTouchPoints > 0)) return false;
                        return true;

                    },

                    mode: 'nearest',

                    intersect: true,

                    backgroundColor: cssVar('--text-primary') || '#1e293b',

                    titleFont: { size: 12, weight: '600', family: 'Outfit, sans-serif' },

                    bodyFont: { size: 11, family: 'Outfit, sans-serif' },

                    padding: 8,

                    cornerRadius: 8,

                    boxPadding: 4,

                    usePointStyle: true,

                    callbacks: {

                        title: function(tooltipItems) {

                            if (tooltipItems.length > 0) {

                                var idx = tooltipItems[0].dataIndex;

                                return entities[idx] || tooltipItems[0].label;

                            }

                            return '';

                        },

                        label: function(context) {

                            var rawNum = context.raw;

                            var val = formatWithUnitScale(rawNum, { factor: 1, isInteger: unitConfig?.isInteger, maxDecimals: unitConfig?.maxDecimals });

                            var unitSuffix = unitConfig ? ' ' + unitConfig.label : (currentTimeSeriesData && currentTimeSeriesData.vkUnits && currentTimeSeriesData.vkUnits[selectedVk] ? ' ' + currentTimeSeriesData.vkUnits[selectedVk] : '');

                            return ' ' + val + unitSuffix;

                        }

                    }

                } : {

                    mode: 'index',

                    intersect: false,

                    enabled: false,

                    external: function(context) {

                        if (!container) return;

                        var tooltipElId = tooltipMap[chartIdx] || 'ts-chart-tooltip';

                        let el = document.getElementById(tooltipElId);

                        if (!el) {

                            el = document.createElement('div');

                            el.id = tooltipElId;

                            el.className = 'ts-chart-custom-tooltip';

                            el.style.cssText = 'position:absolute;background:#1e293b;color:#fff;padding:10px 14px;border-radius:8px;font-size:0.8rem;font-family:Outfit,sans-serif;max-height:260px;overflow-y:auto;z-index:30;box-shadow:0 8px 24px rgba(0,0,0,0.35);pointer-events:auto;transition:opacity 0.15s;opacity:0;display:none;scrollbar-width:thin;scrollbar-color:var(--text-secondary, #64748b) #1e293b;';

                            container.appendChild(el);



                            el.addEventListener('mouseenter', function() {

                                el._isHovered = true;

                                if (el._hideTimer) {

                                    clearTimeout(el._hideTimer);

                                    el._hideTimer = null;

                                }

                            });



                            el.addEventListener('mouseleave', function() {

                                el._isHovered = false;

                                el._hideTimer = setTimeout(function() {

                                    if (!el._isHovered) {

                                        el.style.opacity = '0';

                                        el.style.display = 'none';

                                    }

                                }, 200);

                    });

                }



                        const tooltip = context.tooltip;

                        if (!tsTooltipEnabled || !window.tsTooltipEnabled) {

                            if (el._hideTimer) clearTimeout(el._hideTimer);

                            el._isHovered = false;

                            el.style.opacity = '0';

                            el.style.display = 'none';

                            return;

                        }

                        // Mobile: block tooltip from Chart.js auto-trigger; only allow via long-press
                        var _isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
                        if (_isTouchDevice && !context.chart._touchTooltipActive) {
                            if (el._hideTimer) clearTimeout(el._hideTimer);
                            el._isHovered = false;
                            el.style.opacity = '0';
                            el.style.display = 'none';
                            return;
                        }

                        const items = (tooltip.dataPoints || []).filter(d => !context.chart.data.datasets[d.datasetIndex].hidden);

                        if (items.length === 0 || tooltip.opacity === 0) {

                            if (!el._isHovered) {

                                if (!el._hideTimer) {

                                    el._hideTimer = setTimeout(function() {

                                        if (!el._isHovered) {

                                            el.style.opacity = '0';

                                            el.style.display = 'none';

                                        }

                                    }, 200);

                                }

                            }

                            return;

                        }



                        // Data point is hovered: cancel pending hide

                        if (el._hideTimer) {

                            clearTimeout(el._hideTimer);

                            el._hideTimer = null;

                        }



                        // If user is already hovering inside the tooltip to scroll, keep existing view

                        if (el._isHovered) {

                            return;

                        }



                        el.style.display = 'block';

                        el.style.opacity = '1';

                        const chart = context.chart;

                        const title = tooltip.title && tooltip.title.length ? tooltip.title[0] : '';

                        let html = title ? `<div style="font-weight:600;margin-bottom:6px;border-bottom:1px solid #334155;padding-bottom:4px;color:#fff;">${title}</div>` : '';

                        items.forEach(item => {

                            const ds = chart.data.datasets[item.datasetIndex];

                            if (!ds) return;

                            const color = ds.borderColor || ds.backgroundColor;

                            var rawNum = item.raw;

                            const val = formatWithUnitScale(rawNum, { factor: 1, isInteger: unitConfig?.isInteger, maxDecimals: unitConfig?.maxDecimals });

                            const displayName = ds.entity || ds.label;

                            var unitSuffix = unitConfig ? ' ' + unitConfig.label : (currentTimeSeriesData && currentTimeSeriesData.vkUnits && currentTimeSeriesData.vkUnits[selectedVk] ? ' ' + currentTimeSeriesData.vkUnits[selectedVk] : '');

                            html += `<div style="display:flex;align-items:center;gap:6px;padding:2px 0;white-space:nowrap;">

                                <span style="width:10px;height:10px;border-radius:50%;background:${color};display:inline-block;flex-shrink:0;"></span>

                                <span style="color:#94a3b8;">${displayName}:</span>

                                <span style="font-weight:600;color:#fff;">${val}${unitSuffix}</span>

                            </div>`;

                        });

                        el.innerHTML = html;

                        const canvasRect = chart.canvas.getBoundingClientRect();

                        const containerRect = container.getBoundingClientRect();

                        const canvasOffsetX = canvasRect.left - containerRect.left + container.scrollLeft;

                        const canvasOffsetY = canvasRect.top - containerRect.top + container.scrollTop;

                        let left = canvasOffsetX + tooltip.caretX + 12;

                        let top = canvasOffsetY + tooltip.caretY - 10;

                        const elW = el.offsetWidth;

                        const elH = el.offsetHeight;

                        if (left + elW > container.offsetWidth - 5) left = canvasOffsetX + tooltip.caretX - elW - 12;

                        if (left < 5) left = 5;

                        if (top + elH > container.offsetHeight - 5) top = container.offsetHeight - elH - 5;

                        if (top < 5) top = 5;

                        el.style.left = left + 'px';

                        el.style.top = top + 'px';

                    }

                }

            },

            scales: {

                x: {

                    animation: false,

                    grid: { display: false },

                    ticks: {

                        color: document.documentElement.getAttribute('data-bs-theme') === 'dark' ? cssVar('--text-light') || '#94a3b8' : cssVar('--text-tertiary') || '#475569',

                        font: { family: 'Outfit, sans-serif', size: 11 },

                        maxRotation: 45,

                        minRotation: 0,

                        callback: function(value, index) {

                            var label = this.getLabelForValue(value);

                            return truncateLabel(label, 35);

                        }

                    }

                },

                y: {

                    animation: false,

                    type: 'linear',

                    beginAtZero: true,

                    grace: '8%',

                    display: true,

                    grid: { color: document.documentElement.getAttribute('data-bs-theme') === 'dark' ? 'rgba(255,255,255,0.08)' : cssVar('--border') || '#e8e8f0', drawTicks: true },

                    title: {

                        display: true,

                        text: unitConfig ? unitConfig.label : ((currentTimeSeriesData && currentTimeSeriesData.vkUnits && currentTimeSeriesData.vkUnits[selectedVk]) || ''),

                        font: { family: 'Outfit, sans-serif', size: 11, weight: '500' },

                        color: document.documentElement.getAttribute('data-bs-theme') === 'dark' ? cssVar('--text-light') || '#94a3b8' : cssVar('--text-secondary') || '#64748b'

                    },

                    ticks: {

                        display: true,

                        font: { family: 'Outfit, sans-serif', size: 10 },

                        color: document.documentElement.getAttribute('data-bs-theme') === 'dark' ? cssVar('--text-light') || '#94a3b8' : cssVar('--text-tertiary') || '#475569',

                        autoSkip: true,

                        maxTicksLimit: 8,

                        callback: function(v) {

                            if (v >= 1e6) return (v / 1e6).toFixed(1) + 'jt';

                            if (v >= 1e3) return (v / 1e3).toFixed(v >= 1e4 ? 0 : 1) + 'rb';

                            return v;

                        }

                    }

                }

            }

        },

        plugins: [{

            id: 'syncYAxisScaleAndHeight',

            afterLayout: function(chart) {

                const yAxis = chart.scales.y;

                const chartArea = chart.chartArea;

                if (yAxis && chartArea && yAxisInst) {

                    let needsUpdate = false;

                    

                    if (yAxisInst.options.scales.y.min !== yAxis.min ||

                        yAxisInst.options.scales.y.max !== yAxis.max) {

                        yAxisInst.options.scales.y.min = yAxis.min;

                        yAxisInst.options.scales.y.max = yAxis.max;

                        needsUpdate = true;

                    }

                    

                    const paddingTop = chartArea.top;

                    const paddingBottom = chart.height - chartArea.bottom;

                    if (!yAxisInst.options.layout?.padding ||

                        yAxisInst.options.layout.padding.top !== paddingTop ||

                        yAxisInst.options.layout.padding.bottom !== paddingBottom) {

                        yAxisInst.options.layout = {

                            padding: {

                                top: paddingTop,

                                bottom: paddingBottom

                            }

                        };

                        needsUpdate = true;

                    }

                    

                    if (needsUpdate) {

                        requestAnimationFrame(() => {

                            if (yAxisInst) {

                                yAxisInst.update('none');

                            }

                        });

                    }

                }

            }

        }]

    });

    window[instanceKey] = chartInst;



    // 2b. Hide tooltip when mouse leaves chart container

    var tooltipElId = tooltipMap[chartIdx] || 'ts-chart-tooltip';

    let _tsContainerLeaveTimer = null;

    container.addEventListener('mouseleave', function() {

        _tsContainerLeaveTimer = setTimeout(function() {

            const el = document.getElementById(tooltipElId);

            if (el && !el._isHovered) {

                el.style.opacity = '0';

                el.style.display = 'none';

            }

        }, 200);

    });

    container.addEventListener('mouseenter', function() {

        if (_tsContainerLeaveTimer) { clearTimeout(_tsContainerLeaveTimer); _tsContainerLeaveTimer = null; }

    });



    // 2c. Long-press tooltip for mobile touch devices

    if (('ontouchstart' in window) || (navigator.maxTouchPoints > 0)) {

        var _touchLongPressTimer = null;

        var _touchLongPressDuration = 350;

        var _touchStartPos = null;

        var _touchTooltipActive = false;

        var _touchAutoHideTimer = null;



        ctx.addEventListener('touchstart', function(e) {

            if (e.touches.length !== 1) return;

            var touch = e.touches[0];

            _touchStartPos = { x: touch.clientX, y: touch.clientY };

            _touchLongPressTimer = setTimeout(function() {

                _touchTooltipActive = true;

                chartInst._isMobileTouch = true;
                chartInst._touchTooltipActive = true;

                var rect = ctx.getBoundingClientRect();

                var fakeEvent = {

                    clientX: _touchStartPos.x,

                    clientY: _touchStartPos.y,

                    type: 'touchstart'

                };

                var elements = chartInst.getElementsAtEventForMode(fakeEvent, 'nearest', { intersect: false }, false);

                if (elements && elements.length > 0) {

                    chartInst.setActiveElements(elements);

                    chartInst.tooltip.setActiveElements(elements, { x: 0, y: 0 });

                    chartInst.update('none');

                    // Auto-hide tooltip after 2 seconds on mobile
                    if (_touchAutoHideTimer) clearTimeout(_touchAutoHideTimer);
                    _touchAutoHideTimer = setTimeout(function() {
                        _touchTooltipActive = false;
                        chartInst._touchTooltipActive = false;
                        chartInst._isMobileTouch = false;
                        chartInst.setActiveElements([]);
                        chartInst.tooltip.setActiveElements([], { x: 0, y: 0 });
                        chartInst.update('none');
                        var tipEl = document.getElementById(tooltipElId);
                        if (tipEl) {
                            tipEl.style.opacity = '0';
                            tipEl.style.display = 'none';
                        }
                    }, 2000);

                }

            }, _touchLongPressDuration);

        }, { passive: true });



        ctx.addEventListener('touchmove', function(e) {

            if (_touchLongPressTimer) {

                var touch = e.touches[0];

                if (_touchStartPos) {

                    var dx = Math.abs(touch.clientX - _touchStartPos.x);

                    var dy = Math.abs(touch.clientY - _touchStartPos.y);

                    if (dx > 10 || dy > 10) {

                        clearTimeout(_touchLongPressTimer);

                        _touchLongPressTimer = null;
                        if (_touchAutoHideTimer) { clearTimeout(_touchAutoHideTimer); _touchAutoHideTimer = null; }

                    }

                }

            }

        }, { passive: true });



        ctx.addEventListener('touchend', function(e) {

            if (_touchLongPressTimer) {

                clearTimeout(_touchLongPressTimer);

                _touchLongPressTimer = null;

            }

            if (_touchTooltipActive) {

                _touchTooltipActive = false;

                chartInst._isMobileTouch = false;
                chartInst._touchTooltipActive = false;
                if (_touchAutoHideTimer) { clearTimeout(_touchAutoHideTimer); _touchAutoHideTimer = null; }

                setTimeout(function() {

                    chartInst.setActiveElements([]);

                    chartInst.tooltip.setActiveElements([], { x: 0, y: 0 });

                    chartInst.update('none');

                }, 1500);

            }

        }, { passive: true });

    }



    // 3. Attach click events to custom legend items (in-place toggle without removing pill)

    if (legendDiv) {

        legendDiv.querySelectorAll('.custom-legend-item').forEach(item => {

            let _legendLastTapTime = 0;

            item.addEventListener('click', function(e) {
                const entityName = this.dataset.entity;
                if (!entityName) return;

                const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);

                if (isTouchDevice) {
                    const now = Date.now();
                    const isDoubleTap = (now - _legendLastTapTime < 350);
                    _legendLastTapTime = now;

                    if (isDoubleTap) {
                        // Double tap on touch: Hide / Show toggle
                        _toggleEntityHideState(entityName);
                        return;
                    }

                    // Single tap on touch: Tap-to-Focus (Highlight line & dim others)
                    if (tsFocusedEntity === entityName) {
                        // If already focused, unfocus and hide popover
                        _resetTimeSeriesEntityFocus();
                        _hideLegendEntityPopover();
                    } else {
                        // Focus this entity
                        _applyTimeSeriesEntityFocus(entityName);

                        // Also show the popover with stats on mobile
                        let matchedDs = null;
                        let activeLabels = null;
                        [window.timeSeriesChartInstance, window.timeSeriesChart2Instance, window.timeSeriesChart3Instance].forEach(inst => {
                            if (inst && inst.data && inst.data.datasets) {
                                if (!activeLabels && inst.data.labels) activeLabels = inst.data.labels;
                                inst.data.datasets.forEach(ds => {
                                    if (ds.entity === entityName) matchedDs = ds;
                                });
                            }
                        });
                        if (matchedDs) {
                            const unitStr = (currentTimeSeriesData && currentTimeSeriesData.vkUnits && currentTimeSeriesData.vkUnits[selectedVk]) || (typeof unitLabel !== 'undefined' ? unitLabel : '');
                            _showLegendEntityPopover(this, entityName, activeLabels || years, matchedDs.data, matchedDs.borderColor || matchedDs.backgroundColor, unitStr);
                        }
                    }
                    return;
                }

                // Desktop click: toggle hide/show
                _toggleEntityHideState(entityName);
            });

            function _toggleEntityHideState(entityName) {
                const willHide = !tsHiddenEntities.has(entityName);
                if (willHide) {
                    tsHiddenEntities.add(entityName);
                    if (tsFocusedEntity === entityName) {
                        _resetTimeSeriesEntityFocus();
                        _hideLegendEntityPopover();
                    }
                } else {
                    tsHiddenEntities.delete(entityName);
                }

                // Update all legend items for this entity across all active charts
                document.querySelectorAll(`.custom-legend-item[data-entity="${entityName}"]`).forEach(legEl => {
                    legEl.style.opacity = willHide ? '0.4' : '1';
                    if (willHide) {
                        legEl.classList.add('ts-legend-disabled');
                    } else {
                        legEl.classList.remove('ts-legend-disabled');
                    }
                    const textSpan = legEl.querySelector('.custom-legend-text');
                    if (textSpan) {
                        textSpan.style.textDecoration = willHide ? 'line-through' : 'none';
                    }
                });

                // Update dataset visibility in all active charts without re-rendering legend DOM
                [window.timeSeriesChartInstance, window.timeSeriesChart2Instance, window.timeSeriesChart3Instance].forEach(inst => {
                    if (inst && inst.data && inst.data.datasets) {
                        inst.data.datasets.forEach((ds, dsIdx) => {
                            if (ds.entity === entityName) {
                                inst.setDatasetVisibility(dsIdx, !willHide);
                            }
                        });
                        inst.update('none');
                    }
                });

                // Update table row display for this entity
                const gridBody = document.getElementById('ts-grid-body');
                if (gridBody) {
                    gridBody.querySelectorAll(`tr[data-entity="${entityName}"]`).forEach(tr => {
                        tr.style.display = willHide ? 'none' : '';
                    });
                }

                // Update dropdown counter & checkboxes in buildEntityChecklist
                if (currentTimeSeriesData && currentTimeSeriesData.entityMap) {
                    const allEnts = _sortEntitiesWithKabLast(Object.keys(currentTimeSeriesData.entityMap));
                    buildEntityChecklist(allEnts);
                }
            }

            item.addEventListener('mouseenter', function() {
                // If on touch device, ignore mouseenter to avoid fighting tap events
                if (('ontouchstart' in window) || (navigator.maxTouchPoints > 0)) return;

                _cancelHideLegendEntityPopover();
                const entityName = this.dataset.entity;
                if (!entityName || tsHiddenEntities.has(entityName)) return;

                let matchedDs = null;
                let activeLabels = null;
                [window.timeSeriesChartInstance, window.timeSeriesChart2Instance, window.timeSeriesChart3Instance].forEach(inst => {
                    if (inst && inst.data && inst.data.datasets) {
                        if (!activeLabels && inst.data.labels) activeLabels = inst.data.labels;
                        inst.data.datasets.forEach(ds => {
                            if (ds.entity === entityName) {
                                if (!matchedDs) matchedDs = ds;
                                ds.borderWidth = 4.5;
                                ds.pointRadius = 6.5;
                                ds.order = -1;
                            } else {
                                ds.borderWidth = 1.5;
                                ds.pointRadius = 3.5;
                                ds.order = 1;
                            }
                        });
                        inst.update('none');
                    }
                });

                if (matchedDs) {
                    const unitStr = (currentTimeSeriesData && currentTimeSeriesData.vkUnits && currentTimeSeriesData.vkUnits[selectedVk]) || (typeof unitLabel !== 'undefined' ? unitLabel : '');
                    _showLegendEntityPopover(this, entityName, activeLabels || years, matchedDs.data, matchedDs.borderColor || matchedDs.backgroundColor, unitStr);
                }
            });

            item.addEventListener('mouseleave', function() {
                if (('ontouchstart' in window) || (navigator.maxTouchPoints > 0)) return;

                _scheduleHideLegendEntityPopover();
                const entityName = this.dataset.entity;
                if (!entityName) return;

                [window.timeSeriesChartInstance, window.timeSeriesChart2Instance, window.timeSeriesChart3Instance].forEach(inst => {
                    if (inst && inst.data && inst.data.datasets) {
                        inst.data.datasets.forEach(ds => {
                            ds.borderWidth = 2.5;
                            ds.pointRadius = 4.5;
                            ds.order = 0;
                        });
                        inst.update('none');
                    }
                });
            });
        });
    }



    // 4. Render Fixed Y-Axis Chart on the left (only for chart 1)

    if (chartIdx !== 2) {

        const ctxY = document.getElementById('timeSeriesChartYAxis');

        if (ctxY) {

            if (yAxisInst) {

                yAxisInst.destroy();

            }

            const initialMin = (chartInst && chartInst.scales.y) ? chartInst.scales.y.min : 0;

            const initialMax = (chartInst && chartInst.scales.y) ? chartInst.scales.y.max : 100;



            yAxisInst = new Chart(ctxY, {

            type: chartType,

            data: {

                labels: [],

                datasets: []

            },

            options: {

                responsive: true,

                maintainAspectRatio: false,

                animation: false,

                plugins: {

                    legend: { display: false },

                    tooltip: { enabled: false }

                },

                scales: {

                    x: { display: false },

                    y: {

                        type: 'linear',

                        beginAtZero: true,

                        grace: '8%',

                        min: initialMin,

                        max: initialMax,

                        grid: {

                            drawOnChartArea: false,

                            drawTicks: true,

                            color: cssVar('--text-muted') || '#cbd5e1'

                        },

                        border: {

                            display: true,

                            color: cssVar('--text-muted') || '#cbd5e1'

                        },

                        ticks: {

                            font: { family: 'Outfit, sans-serif', size: 10 },

                            color: cssVar('--text-tertiary') || '#475569',

                            autoSkip: true, // Allow automatic skipping to prevent overlapping

                            callback: function(v) {

                                if (v >= 1e6) return (v / 1e6).toFixed(1) + 'jt';

                                if (v >= 1e3) return (v / 1e3).toFixed(0) + 'rb';

                                return v.toFixed(0);

                            }

                        }

                    }

                }

            }

        });



        // Manually sync scale limits and paddings for the Y-axis chart initially

        if (chartInst && chartInst.scales.y && chartInst.chartArea) {

            const yAxis = chartInst.scales.y;

            const chartArea = chartInst.chartArea;

            const paddingTop = chartArea.top;

            const paddingBottom = chartInst.height - chartArea.bottom;

            

            yAxisInst.options.scales.y.min = yAxis.min;

            yAxisInst.options.scales.y.max = yAxis.max;

            yAxisInst.options.layout = {

                padding: {

                    top: paddingTop,

                    bottom: paddingBottom

                }

            };

            yAxisInst.update('none');

        }

        window[yAxisKey] = yAxisInst;

        }

    }



    // Remove stale tooltip element if any

    var staleTooltipId = tooltipMap[chartIdx] || 'ts-chart-tooltip';

    const oldTip = document.getElementById(staleTooltipId);

    if (oldTip) oldTip.remove();



    if (isSingleYear) {

        chartInst._tracerProgress = 1;

        chartInst._animatingDatasetIndices = null;

        // Horizontal scroll for many entities

        if (entities.length > 5 && scrollable) {

            var w = Math.max(scrollable.clientWidth, entities.length * 60);

            ctx.parentElement.style.width = w + 'px';

            scrollable.style.overflowX = 'auto';

            scrollable.style.overflowY = 'hidden';

        }

    } else {

        chartInst._tracerProgress = 0;

        if (animatingEntityName) {

            const targetIdx = datasets.findIndex(ds => ds.entity === animatingEntityName || ds.label === animatingEntityName);

            if (targetIdx !== -1) {

                chartInst._animatingDatasetIndices = new Set([targetIdx]);

            } else {

                chartInst._animatingDatasetIndices = null;

            }

        } else {

            chartInst._animatingDatasetIndices = null;

        }

    }



    window[instanceKey] = chartInst;

    return chartInst;

}



function runTimeSeriesTracerAnimation(charts, duration = 850) {

    const validCharts = (Array.isArray(charts) ? charts : [charts]).filter(c => c && c.ctx && c.config && c.config.type === 'line');

    if (validCharts.length === 0) return;



    validCharts.forEach(c => {

        if (c._tracerRafId) {

            cancelAnimationFrame(c._tracerRafId);

            c._tracerRafId = null;

        }

        c._tracerProgress = 0;

        c.draw();

    });



    const startTime = performance.now();

    

    function easeOutCubic(t) {

        return 1 - Math.pow(1 - t, 3);

    }



    function step(now) {

        const elapsed = now - startTime;

        const raw = Math.min(elapsed / duration, 1);

        const progress = easeOutCubic(raw);



        validCharts.forEach(c => {

            if (!c || !c.ctx || !c.canvas || c.ctx.canvas !== c.canvas) return;

            c._tracerProgress = progress;

            try { c.draw(); } catch(e) {}

        });



        if (raw < 1) {

            const rafId = requestAnimationFrame(step);

            validCharts.forEach(c => { c._tracerRafId = rafId; });

        } else {

            validCharts.forEach(c => {

                if (!c || !c.ctx || !c.canvas) return;

                c._tracerProgress = 1;

                c._tracerRafId = null;

                c._animatingDatasetIndices = null;

                try { c.draw(); } catch(e) {}

            });

        }

    }



    const initialRaf = requestAnimationFrame(step);

    validCharts.forEach(c => { c._tracerRafId = initialRaf; });

}



function _syncEntityVisibility(entity, isHidden) {

    [timeSeriesChartInstance, timeSeriesChart2Instance, timeSeriesChart3Instance].forEach((inst, ci) => {

        if (!inst) return;

        inst.data.datasets.forEach((ds, di) => {

            if (ds.entity === entity) {

                inst.setDatasetVisibility(di, isHidden);

                inst.update('none');

                const ld = document.getElementById(['ts-custom-legend','ts-custom-legend-2','ts-custom-legend-3'][ci]);

                if (ld) {

                    const li = ld.querySelector(`.custom-legend-item[data-index="${di}"]`);

                    if (li) {

                        li.style.opacity = isHidden ? '0.4' : '1';

                        const t = li.querySelector('span:last-child');

                        if (t) t.style.textDecoration = isHidden ? 'line-through' : 'none';

                    }

                }

            }

        });

    });

}



let tsCurrentViewMode = 'chart';

function setTimeSeriesViewMode(mode) {
    tsCurrentViewMode = mode;
    const secChart = document.getElementById('ts-view-section-chart');
    const secTable = document.getElementById('ts-view-section-table');
    const btnChart = document.getElementById('btn-ts-view-chart');
    const btnTable = document.getElementById('btn-ts-view-table');
    const btnBoth = document.getElementById('btn-ts-view-both');

    if (btnChart) btnChart.classList.toggle('active', mode === 'chart');
    if (btnTable) btnTable.classList.toggle('active', mode === 'table');
    if (btnBoth) btnBoth.classList.toggle('active', mode === 'both');

    if (mode === 'chart') {
        if (secChart) secChart.style.display = 'block';
        if (secTable) secTable.style.display = 'none';
    } else if (mode === 'table') {
        if (secChart) secChart.style.display = 'none';
        if (secTable) secTable.style.display = 'block';
    } else { // 'both'
        if (secChart) secChart.style.display = 'block';
        if (secTable) secTable.style.display = 'block';
    }

    if (mode === 'chart' || mode === 'both') {
        // Enforce wrapper & canvas height immediately
        ['ts-chart-wrapper', 'ts-chart-wrapper-2', 'ts-chart-wrapper-3'].forEach(id => {
            const w = document.getElementById(id);
            if (w) {
                w.style.height = '320px';
                w.style.minHeight = '320px';
            }
        });
        ['timeSeriesChart', 'timeSeriesChart2', 'timeSeriesChart3'].forEach(id => {
            const c = document.getElementById(id);
            if (c) {
                c.style.height = '320px';
                c.style.minHeight = '320px';
            }
        });

        // Trigger resize and re-render if needed
        setTimeout(() => {
            if (window.timeSeriesChartInstance && typeof window.timeSeriesChartInstance.resize === 'function') {
                window.timeSeriesChartInstance.resize();
            }
            if (window.timeSeriesChart2Instance && typeof window.timeSeriesChart2Instance.resize === 'function') {
                window.timeSeriesChart2Instance.resize();
            }
            if (window.timeSeriesChart3Instance && typeof window.timeSeriesChart3Instance.resize === 'function') {
                window.timeSeriesChart3Instance.resize();
            }
            // If callback available, invoke it to ensure width and tracer are cleanly calculated with visible DOM dimensions
            if (typeof tsRenderCallback === 'function') {
                tsRenderCallback();
            }
        }, 50);
    }
}

function buildEntityChecklist(allEntities) {
    if (!allEntities || allEntities.length === 0) return;

    const visibleCount = allEntities.filter(e => !tsHiddenEntities.has(e)).length;
    const allChecked = visibleCount === allEntities.length;
    const toggleAllLabel = allChecked ? 'Semua' : `${visibleCount}/${allEntities.length}`;

    function generateChecklistHtml() {
        let html = `
        <div class="dropdown">
            <button class="btn btn-sm btn-outline-secondary dropdown-toggle ts-entity-btn" type="button" data-bs-toggle="dropdown" data-bs-auto-close="outside" aria-expanded="false" style="font-size:0.82rem; padding:5px 12px; border-radius:8px;">
                Pilih Entitas <span class="badge bg-secondary ms-1 entity-count-badge">${toggleAllLabel}</span>
            </button>
            <div class="dropdown-menu p-2 shadow" style="max-height:300px; width:260px;" onclick="event.stopPropagation();">
                <div class="px-1 pb-2 mb-1 border-bottom">
                    <input type="text" class="form-control form-control-sm entity-dropdown-search" placeholder="Cari entitas..." style="font-size:0.78rem;">
                </div>
                <div class="d-flex align-items-center gap-2 px-2 py-1 mb-1 border-bottom">
                    <button type="button" class="btn btn-link btn-xs p-0 text-decoration-none fw-bold text-primary btn-dual-select-all" style="font-size:0.78rem;">Pilih Semua</button>
                    <span class="text-muted" style="font-size:0.75rem;">|</span>
                    <button type="button" class="btn btn-link btn-xs p-0 text-decoration-none fw-semibold text-danger btn-dual-clear-all" style="font-size:0.78rem;">Hapus Semua</button>
                </div>
                <div class="ts-entity-checklist-scroll" style="max-height:190px; overflow-y:auto;">`;

        allEntities.forEach(ent => {
            const checked = !tsHiddenEntities.has(ent);
            html += `<label class="dropdown-item px-1 py-1 ts-entity-dropdown-item" data-name="${ent.toLowerCase()}" style="display:flex; align-items:center; gap:6px; font-size:0.8rem; cursor:pointer;" onclick="event.stopPropagation();">
                <input type="checkbox" class="ts-entity-cb" data-entity="${escHtml(ent)}" ${checked ? 'checked' : ''} style="width:16px;height:16px;">
                <span class="text-truncate">${escHtml(ent)}</span>
            </label>`;
        });

        html += `</div></div></div>`;
        return html;
    }

    const containers = [
        document.getElementById('ts-entity-checklist'),
        document.getElementById('ts-entity-checklist-chart')
    ].filter(Boolean);

    containers.forEach(cont => {
        cont.innerHTML = generateChecklistHtml();

        const searchInp = cont.querySelector('.entity-dropdown-search');
        if (searchInp) {
            searchInp.addEventListener('input', function(e) {
                e.stopPropagation();
                const kw = this.value.trim().toLowerCase();
                cont.querySelectorAll('.ts-entity-dropdown-item').forEach(item => {
                    const name = item.dataset.name || '';
                    item.style.display = (!kw || name.includes(kw)) ? 'flex' : 'none';
                });
            });
            searchInp.addEventListener('click', function(e) {
                e.stopPropagation();
            });
        }

        cont.querySelectorAll('.ts-entity-cb').forEach(cb => {
            cb.onchange = function(e) {
                if (e) e.stopPropagation();
                const isHidden = !this.checked;
                const ent = this.getAttribute('data-entity');
                if (isHidden) {
                    tsHiddenEntities.add(ent);
                } else {
                    tsHiddenEntities.delete(ent);
                }

                // Dual sync across all entity filter containers!
                containers.forEach(otherCont => {
                    otherCont.querySelectorAll('.ts-entity-cb').forEach(ocb => {
                        if (ocb.getAttribute('data-entity') === ent) {
                            ocb.checked = !isHidden;
                        }
                    });
                });

                if (tsRenderCallback) tsRenderCallback(!isHidden ? ent : null);
                _syncEntityVisibility(ent, isHidden);

                const newVisCount = allEntities.filter(x => !tsHiddenEntities.has(x)).length;
                const newLabel = (newVisCount === allEntities.length) ? 'Semua' : `${newVisCount}/${allEntities.length}`;
                document.querySelectorAll('.entity-count-badge').forEach(b => {
                    b.textContent = newLabel;
                });

                // Sinkronkan juga ke Wawasan Tren
                if (typeof syncInsightEntityChecklistUI === 'function') {
                    syncInsightEntityChecklistUI();
                }
            };
        });

        const btnSelectAll = cont.querySelector('.btn-dual-select-all');
        if (btnSelectAll) {
            btnSelectAll.onclick = function(e) {
                if (e) e.stopPropagation();
                tsHiddenEntities.clear();
                document.querySelectorAll('.ts-entity-cb').forEach(cb => cb.checked = true);
                if (tsRenderCallback) tsRenderCallback(null);
                allEntities.forEach(x => _syncEntityVisibility(x, false));
                document.querySelectorAll('.entity-count-badge').forEach(b => {
                    b.textContent = 'Semua';
                });
                if (typeof syncInsightEntityChecklistUI === 'function') {
                    syncInsightEntityChecklistUI();
                }
            };
        }

        const btnClearAll = cont.querySelector('.btn-dual-clear-all');
        if (btnClearAll) {
            btnClearAll.onclick = function(e) {
                if (e) e.stopPropagation();
                allEntities.forEach(x => tsHiddenEntities.add(x));
                document.querySelectorAll('.ts-entity-cb').forEach(cb => cb.checked = false);
                if (tsRenderCallback) tsRenderCallback(null);
                allEntities.forEach(x => _syncEntityVisibility(x, true));
                document.querySelectorAll('.entity-count-badge').forEach(b => {
                    b.textContent = `0/${allEntities.length}`;
                });
                if (typeof syncInsightEntityChecklistUI === 'function') {
                    syncInsightEntityChecklistUI();
                }
            };
        }
    });
}



function toggleDatasetVisibility(chart, idx, visible) {

    if (!chart) return;

    const entity = chart.data.datasets[idx]?.entity || chart.data.datasets[idx]?.label;

    if (entity) {

        if (!visible) tsHiddenEntities.add(entity);

        else tsHiddenEntities.delete(entity);

        if (typeof tsRenderCallback === 'function') {

            tsRenderCallback();

        } else {

            chart.setDatasetVisibility(idx, visible);

            chart.data.datasets[idx].hidden = !visible;

            chart.update();

        }

    }

}



function updateCheckAllState(chartInstance) {

    const checkAll = document.getElementById('ts-check-all');

    const btn = document.querySelector('#ts-entity-checklist .dropdown-toggle .badge');

    if (!chartInstance) return;

    const datasets = chartInstance.data.datasets;

    const visible = datasets.filter((ds, i) => !chartInstance.getDatasetMeta(i).hidden).length;

    if (checkAll) checkAll.checked = (visible === datasets.length);

    if (btn) btn.textContent = visible === datasets.length ? 'Semua' : `${visible}/${datasets.length}`;

}



async function addColFromMaster(tableId, tableName) {

    try {

        const theadTr = document.getElementById("data-grid-head")?.querySelector("tr");

        if (!theadTr) throw new Error('DOM editor tidak ditemukan');

        const headers = Array.from(theadTr.children).slice(1).map(th => {

            const input = th.querySelector(".header-name-input");

            return input ? input.value.trim() : "";

        });

        if (headers.length === 0) {

            showToast("warning", "Tidak Ada Kolom", "Tabel ini tidak memiliki kolom untuk didaftarkan.");

            return;

        }



        const checkboxId = (i) => `swal-col-cb-${i}`;

        const checkboxHtml = headers.map((h, i) =>

            `<label class="master-row" style="display:flex; align-items:center; justify-content:flex-start; text-align:left; gap:12px; padding:8px 10px; border-radius:6px; cursor:pointer; width:100%; box-sizing:border-box; ${

                i % 2 === 0 ? 'background:#f8fafc;' : ''

            }">

                <input type="checkbox" class="master-checkbox" id="${checkboxId(i)}" value="${escHtml(h)}" checked style="width:16px;height:16px;accent-color:#4f46e5;flex-shrink:0;">

                <span class="col-name" style="font-size:0.95rem; color:#1e293b; white-space:normal; word-break:break-word; text-align:left;">${escHtml(h)}</span>

            </label>`

        ).join('');



        const { value: selected } = await Swal.fire({

            title: 'Daftarkan Kolom ke Master',

            html: `

                <p style="margin-bottom:12px; color:var(--text-secondary, #475569); font-size:0.95rem; text-align:left;">

                    Centang kolom dari tabel <strong>"${escHtml(tableName)}"</strong> yang ingin didaftarkan sebagai Master Kolom:

                </p>

                <div style="margin-bottom:8px;">

                    <input type="text" id="master-registration-search" placeholder="Cari kolom..." style="width:100%; padding:8px 12px; border-radius:8px; border:1.5px solid #cbd5e1; font-size:0.85rem; outline:none; box-sizing:border-box;" oninput="filterMasterRegistration(this.value)">

                </div>

                <div id="master-registration-list" style="max-height:360px; overflow-y:auto; border:1px solid #e2e8f0; border-radius:8px; padding:4px;">

                    ${checkboxHtml}

                </div>

                <div style="margin-top:8px; text-align:left; padding-left:4px;">

                    <a href="#" onclick="event.preventDefault(); document.querySelectorAll('.master-checkbox').forEach(cb => cb.checked = true);" style="font-size:0.85rem; color:#4f46e5; font-weight:500;">Pilih Semua</a>

                    &nbsp;·&nbsp;

                    <a href="#" onclick="event.preventDefault(); document.querySelectorAll('.master-checkbox').forEach(cb => cb.checked = false);" style="font-size:0.85rem; color:#4f46e5; font-weight:500;">Hapus Semua</a>

                </div>

            `,

            didOpen: () => {

                document.getElementById('master-registration-search')?.focus();

            },

            showCancelButton: true,

            cancelButtonText: 'Batal',

            confirmButtonText: 'Daftarkan',

            preConfirm: () => {

                const checked = [];

                for (let i = 0; i < headers.length; i++) {

                    const cb = document.getElementById(checkboxId(i));

                    if (cb && cb.checked) checked.push(cb.value);

                }

                if (checked.length === 0) {

                    Swal.showValidationMessage('Pilih minimal satu kolom');

                    return false;

                }

                return checked;

            }

        });



        if (!selected || selected.length === 0) return;



        const addRes = await fetch(`${API_BASE}/master/columns/add-from-table`, {

            method: "POST",

            headers: { "Content-Type": "application/json" },

            body: JSON.stringify({ table_id: tableId, columns: selected })

        });

        if (!addRes.ok) {

            const err = await addRes.json();

            showToast("error", "Gagal", err.detail || "Gagal mendaftarkan kolom");

            return;

        }

        const result = await addRes.json();
        const addedList = Array.isArray(result.added) ? result.added : [];
        const existsList = Array.isArray(result.already_exists) ? result.already_exists : [];
        let detailText = `${addedList.length} kolom berhasil didaftarkan sebagai Master Kolom.`;
        if (existsList.length > 0) {
            detailText += `\n${existsList.length} kolom sudah ada sebelumnya: ${existsList.slice(0, 5).join(', ')}${existsList.length > 5 ? '...' : ''}`;
        }
        await showToast('success', 'Berhasil!', detailText, 2500);

    } catch(e) {

        showToast("error", "Error", e.message);

    }

}



async function matchColumnsToMaster(tableId, tableName) {

    try {

        const res = await fetch(`${API_BASE}/tables/${tableId}/master-suggestions`);

        if (!res.ok) throw new Error('Gagal memuat saran master');

        const data = await res.json();

        const suggestions = data.suggestions || [];

        if (suggestions.length === 0) {

            showToast('warning', 'Tidak Ada Kolom', 'Tabel ini tidak memiliki kolom.');

            return;

        }



        const candidates = suggestions.filter(s => !s.is_entity && s.suggested);

        if (candidates.length === 0) {

            showToast('info', 'Tidak Ada Saran', 'Tidak ada kolom yang cocok dengan master kolom.');

            return;

        }



        const checkboxId = (i) => `mc-cb-${i}`;

        const containerId = (i) => `mc-container-${i}`;



        const rowsHtml = suggestions.filter(s => !s.is_entity).map((s, i) => {

            const hasSuggestion = !!s.suggested;

            const suggested = hasSuggestion ? s.suggested : '';

            const confPct = hasSuggestion ? Math.round((s.confidence || 0) * 100) : 0;

            const color = confPct >= 90 ? cssVar('--success-emerald') || '#10b981' : confPct >= 65 ? cssVar('--warning') || '#f59e0b' : cssVar('--danger') || '#ef4444';

            return `<div style="display:flex; align-items:center; gap:8px; padding:8px 10px; border-radius:6px; ${i % 2 === 0 ? 'background:#f8fafc;' : ''}">

                <input type="checkbox" id="${checkboxId(i)}" value="${s.col_index}" ${hasSuggestion ? 'checked' : 'disabled'} style="width:16px;height:16px;accent-color:#06b6d4;flex-shrink:0;" onchange="document.getElementById('${containerId(i)}').style.display=this.checked?'':'none'">

                <span style="flex:1; font-size:0.95rem; color:#1e293b; white-space:normal; word-break:break-word; text-align:left; padding-right:8px;" title="${escHtml(s.header)}">${escHtml(s.header)}</span>

                <div id="${containerId(i)}" class="custom-select-container" style="display:${hasSuggestion?'':'none'}; position:relative; width:450px; flex-shrink:0;">

                    <input type="text" id="mc-sel-${s.col_index}" class="master-select-input" value="${escHtml(suggested)}" style="width:100%; padding:6px 10px; border-radius:6px; border:1.5px solid ${color}; font-size:0.85rem; background:#fff;" title="Bisa diedit manual. Kosongkan untuk melewati kolom.">

                </div>

                <span style="width:60px; text-align:center; font-size:0.8rem; font-weight:700; color:${color}; flex-shrink:0;">${hasSuggestion ? confPct + '%' : '<em style="color:#94a3b8;">-</em>'}</span>

            </div>`;

        }).join('');



        const content = `

            <div style="max-height:60vh; overflow-y:auto; text-align:left;">

                ${rowsHtml}

            </div>

            <p style="font-size:0.8rem; color:var(--text-secondary, #64748b); margin-top:10px; text-align:left;">

                <b>Persentase</b> = tingkat keyakinan pencocokan (hijau ≥90%, oranye ≥65%, merah &lt;65%).

                Edit nilai master yang tersedia untuk menyesuaikan. Kosongkan input untuk melewati kolom.

                Kolom rincian/entitas (No., Kecamatan, dst.) otomatis dilewati.

            </p>

        `;



        const confirmed = await Swal.fire({

            title: 'Cocokkan ke Master Kolom',

            html: content,

            width: 950,

            showCancelButton: true,

            cancelButtonText: 'Batal',

            confirmButtonText: 'Terapkan',

            confirmButtonColor: cssVar('--info') || '#06b6d4'

        });

        if (!confirmed.isConfirmed) return;



        const mapping = {};

        suggestions.filter(s => !s.is_entity).forEach(s => {

            const cb = document.getElementById(checkboxId(s.col_index));

            if (cb && cb.checked) {

                const input = document.getElementById(`mc-sel-${s.col_index}`);

                const val = input ? input.value.trim() : '';

                if (val) mapping[s.col_index] = val;

            }

        });



        if (Object.keys(mapping).length === 0) {

            showToast('warning', 'Tidak Ada Perubahan', 'Tidak ada kolom yang dipilih untuk disesuaikan.');

            return;

        }



        const applyRes = await fetch(`${API_BASE}/tables/${tableId}/apply-master-mapping`, {

            method: 'POST',

            headers: { 'Content-Type': 'application/json' },

            body: JSON.stringify({ mapping })

        });

        const applyData = await applyRes.json();

        if (!applyRes.ok) {

            showToast('error', 'Gagal', applyData.detail || 'Gagal menerapkan pemetaan');

            return;

        }

        showToast('success', 'Berhasil', applyData.message);

        refreshEditor();

    } catch (err) {

        console.error(err);

        showToast('error', 'Error', err.message || 'Terjadi kesalahan');

    }

}



async function renameHeadersToMaster(tableId, tableName) {

    try {

        const mRes = await fetch(`${API_BASE}/master/columns`);

        if (!mRes.ok) throw new Error('Gagal memuat master columns');

        const mData = await mRes.json();

        const masterCols = mData.columns || [];



        const theadTr = document.getElementById("data-grid-head")?.querySelector("tr");

        if (!theadTr) throw new Error('DOM editor tidak ditemukan');

        const headers = Array.from(theadTr.children).slice(1).map(th => {

            const input = th.querySelector(".header-name-input");

            return input ? input.value.trim() : "";

        });



        if (headers.length === 0) {

            showToast("warning", "Tidak Ada Kolom", "Tabel ini tidak memiliki kolom.");

            return;

        }

        if (masterCols.length === 0) {

            showToast("warning", "Master Kosong", "Belum ada master kolom. Daftarkan beberapa kolom ke master terlebih dahulu.");

            return;

        }



        const isMeta = (h) => h.toLowerCase() === 'satuan' || h.toLowerCase() === 'tahun' || h.toLowerCase().includes('satuan');

        const checkboxId = (i) => `ren-cb-${i}`;

        const selectId = (i) => `ren-sel-${i}`;

        const containerId = (i) => `ren-container-${i}`;



        // Find unique keywords across non-metadata headers

        const uniqueKeywords = [];

        headers.forEach(h => {

            if (!isMeta(h)) {

                const kw = extractHeaderKeyword(h);

                if (kw && !uniqueKeywords.some(k => k.toLowerCase() === kw.toLowerCase())) {

                    uniqueKeywords.push(kw);

                }

            }

        });



        const rowsHtml = headers.map((h, i) => {

            const meta = isMeta(h);

            const kw = extractHeaderKeyword(h);

            const sameKwCount = headers.filter(otherH => !isMeta(otherH) && extractHeaderKeyword(otherH).toLowerCase() === kw.toLowerCase()).length;



            return `<div style="display:flex; align-items:center; gap:12px; padding:10px 14px; border-radius:8px; margin-bottom:4px; ${i % 2 === 0 ? 'background:#f8fafc;' : 'background:#ffffff;'} border:1px solid #f1f5f9; ${meta ? 'opacity:0.55;' : ''}">

                <input type="checkbox" id="${checkboxId(i)}" class="ren-col-cb" value="${i}" data-header="${escHtml(h)}" ${meta ? 'disabled' : ''} style="width:18px;height:18px;accent-color:#2563eb;flex-shrink:0;cursor:pointer;" onchange="document.getElementById('${containerId(i)}').style.display=this.checked?'':'none'; updateRenameSelectedCount();">

                <span style="flex:1; min-width:240px; font-size:0.92rem; font-weight:600; color:#1e293b; white-space:normal; word-break:break-word; line-height:1.35; text-align:left; padding-right:8px;" title="${escHtml(h)}">${escHtml(h)}${meta ? ' <em style="color:#94a3b8;font-size:0.78rem;">(metadata)</em>' : ''}</span>

                

                <div id="${containerId(i)}" class="custom-select-container" style="display:none; position:relative; flex:1.4; min-width:460px;">

                    <div style="display:flex; align-items:center; gap:8px;">

                        <input type="text" id="${selectId(i)}" class="master-select-input" placeholder="🔍  Cari & Pilih Master Kolom..." style="flex:1; min-width:220px; padding:8px 12px; border-radius:6px; border:1.5px solid #cbd5e1; font-size:0.88rem; background:#fff; cursor:pointer;" readonly onclick="showCustomDropdown(${i})" title="Klik untuk memilih master kolom">

                        ${sameKwCount > 1 ? `

                        <button type="button" title="Salin nilai master ini ke semua kolom yang mengandung '${escHtml(kw)}'" style="background:#eff6ff; border:1px solid #bfdbfe; border-radius:6px; padding:7px 10px; cursor:pointer; font-size:0.78rem; color:#1d4ed8; font-weight:600; display:flex; align-items:center; gap:4px; white-space:nowrap; flex-shrink:0;" onclick="copyMasterToSimilar(${i}, '${kw.replace(/'/g, "\\'")}')" onmouseenter="this.style.background='#dbeafe'" onmouseleave="this.style.background='#eff6ff'">

                            <span>📋Ÿ“‹ Salin Sejenis</span>

                        </button>

                        ` : ''}

                        <button type="button" title="Salin nilai master baris ini ke semua kolom yang tercentang" style="background:#f1f5f9; border:1px solid #cbd5e1; border-radius:6px; padding:7px 10px; cursor:pointer; font-size:0.78rem; color:var(--text-secondary, #475569); font-weight:500; display:flex; align-items:center; gap:4px; white-space:nowrap; flex-shrink:0;" onclick="copyMasterToChecked(${i})" onmouseenter="this.style.background=cssVar('--border') || '#e2e8f0'" onmouseleave="this.style.background=cssVar('--bg-hover') || '#f1f5f9'">

                            <span>📑Ÿ“‘ Ke Tercentang</span>

                        </button>

                    </div>

                    <div id="custom-dropdown-${i}" class="custom-select-dropdown" style="display:none; position:absolute; z-index:9999; max-height:280px; overflow-y:auto; background:#fff; border:1.5px solid #2563eb; border-radius:6px; margin-top:4px; padding:6px; width:100%; box-shadow:0 14px 28px rgba(0,0,0,0.18);">

                        <input type="text" id="custom-dropdown-search-${i}" placeholder="Ketik kata kunci pencarian..." autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" style="width:100%; padding:7px 10px; border:1px solid #cbd5e1; border-radius:4px; font-size:0.82rem; margin-bottom:6px; outline:none;" oninput="filterCustomDropdownOptions(${i}, this.value)">

                        <div id="custom-dropdown-options-${i}">

                            ${masterCols.map(c => `<div class="custom-dropdown-option" style="padding:8px 12px; cursor:pointer; border-radius:4px; font-size:0.85rem; white-space:normal; word-break:break-word; text-align:left; border-bottom:1px solid #f8fafc; transition:background 0.15s;" onclick="selectCustomOption(${i}, '${c.standard.replace(/'/g, "\'")}')" onmouseenter="this.style.background='#eff6ff'" onmouseleave="this.style.background='transparent'">${c.standard}</div>`).join('')}

                        </div>

                    </div>

                </div>

            </div>`;

        }).join('');



        const quickChipsHtml = uniqueKeywords.length > 1 ? `

            <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin-bottom:10px; padding:8px 12px; background:#fff; border:1px dashed #cbd5e1; border-radius:8px;">

                <span style="font-size:0.8rem; font-weight:700; color:var(--text-secondary, #475569);">🎯ŸŽ¯ Pilih Cepat Kolom:</span>

                ${uniqueKeywords.map(kw => `

                    <button type="button" style="background:#eff6ff; color:#1d4ed8; border:1px solid #bfdbfe; border-radius:14px; padding:3px 12px; font-size:0.78rem; font-weight:600; cursor:pointer; transition:all 0.15s;" onclick="selectColumnsByKeyword('${kw.replace(/'/g, "\\'")}')" onmouseenter="this.style.background='#dbeafe'" onmouseleave="this.style.background='#eff6ff'">

                        ${escHtml(kw)}

                    </button>

                `).join('')}

                <button type="button" style="background:#f1f5f9; color:var(--text-secondary, #475569); border:1px solid #cbd5e1; border-radius:14px; padding:3px 10px; font-size:0.76rem; cursor:pointer;" onclick="selectColumnsByKeyword('all')">Semua</button>

                <button type="button" style="background:#fef2f2; color:#b91c1c; border:1px solid #fecaca; border-radius:14px; padding:3px 10px; font-size:0.76rem; cursor:pointer;" onclick="selectColumnsByKeyword('')">✕ Hapus Pilihan</button>

            </div>

        ` : '';



        const bulkBarHtml = `

            <div style="background: linear-gradient(135deg, #f8fafc, #f1f5f9); border: 1.5px solid #e2e8f0; border-radius: 10px; padding: 14px 16px; margin-bottom: 14px; text-align: left; box-shadow: 0 1px 3px rgba(0,0,0,0.03);">

                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; flex-wrap: wrap; gap: 8px;">

                    <div style="display: flex; align-items: center; gap: 8px;">

                        <input type="checkbox" id="ren-select-all-cb" style="width: 18px; height: 18px; accent-color: #2563eb; cursor: pointer;" onchange="toggleSelectAllRenameColumns(this)">

                        <label for="ren-select-all-cb" style="font-weight: 600; font-size: 0.92rem; color: #1e293b; cursor: pointer; margin: 0;">Pilih Semua Kolom Data</label>

                        <span id="ren-selected-count-badge" style="font-size: 0.78rem; font-weight: 600; padding: 3px 10px; border-radius: 20px; background: #f1f5f9; color: #64748b; transition: all 0.2s;">0 kolom dipilih</span>

                    </div>

                    <span style="font-size: 0.8rem; color: #64748b;">Pilih master di bawah untuk menerapkan ke banyak kolom sekaligus</span>

                </div>

                

                ${quickChipsHtml}

                

                <div style="display: flex; align-items: center; gap: 10px;">

                    <div class="custom-select-container" style="position: relative; flex: 1;">

                        <input type="text" id="bulk-ren-sel" class="master-select-input" placeholder="🔍  Cari & Pilih Master Kolom untuk diterapkan massal..." style="width: 100%; padding: 9px 14px; border-radius: 8px; border: 1.5px solid #cbd5e1; font-size: 0.9rem; background: #fff; cursor: pointer; box-shadow: 0 1px 2px rgba(0,0,0,0.04);" readonly onclick="showBulkCustomDropdown()">

                        <div id="custom-dropdown-bulk" class="custom-select-dropdown" style="display: none; position: absolute; z-index: 10000; max-height: 380px; overflow-y: auto; background: #fff; border: 1.5px solid #2563eb; border-radius: 8px; margin-top: 6px; padding: 8px; width: 100%; box-shadow: 0 16px 36px rgba(0,0,0,0.18), 0 6px 12px rgba(0,0,0,0.08);">

                            <input type="text" id="custom-dropdown-search-bulk" placeholder="Ketik kata kunci master..." autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" style="width: 100%; padding: 8px 12px; border: 1.5px solid #cbd5e1; border-radius: 6px; font-size: 0.85rem; margin-bottom: 8px; outline:none;" oninput="filterBulkCustomDropdownOptions(this.value)">

                            <div id="custom-dropdown-options-bulk">

                                ${masterCols.map(c => `<div class="custom-dropdown-option" style="padding: 8px 12px; cursor: pointer; border-radius: 6px; font-size: 0.85rem; white-space: normal; word-break: break-word; text-align: left; border-bottom: 1px solid #f8fafc; transition: background 0.15s;" onclick="selectBulkCustomOption('${c.standard.replace(/'/g, "\'")}')" onmouseenter="this.style.background='#eff6ff'" onmouseleave="this.style.background='transparent'">${c.standard}</div>`).join('')}

                            </div>

                        </div>

                    </div>

                    <button type="button" class="btn btn-sm" onclick="applyBulkMasterToChecked()" style="background: #2563eb; color: #fff; font-weight: 600; font-size: 0.88rem; padding: 9px 18px; border-radius: 8px; border: none; display: flex; align-items: center; gap: 6px; box-shadow: 0 2px 4px rgba(37,99,235,0.25); cursor: pointer; white-space: nowrap;">

                        <span>⚡ Terapkan ke Kolom Tercentang</span>

                    </button>

                </div>

                <label style="display: flex; align-items: center; gap: 6px; font-size: 0.78rem; color: #64748b; cursor: pointer; margin-top: 8px; user-select: none;">

                    <input type="checkbox" id="bulk-only-empty" style="accent-color: #2563eb; width: 14px; height: 14px; cursor: pointer;">

                    <span>Hanya terapkan ke kolom yang masih kosong (jangan timpa kolom yang sudah diisi)</span>

                </label>

            </div>

        `;



        const swalResult = await Swal.fire({

            title: 'Ganti Header ke Nama Master',

            html: `

                ${bulkBarHtml}

                <div style="max-height: 56vh; overflow-y: auto; border: 1.5px solid #e2e8f0; border-radius: 8px; padding: 6px; text-align: left;">

                    ${rowsHtml}

                </div>

            `,

            width: 'min(1250px, 96vw)',

            showCancelButton: true,

            cancelButtonText: 'Batal',

            confirmButtonText: 'Simpan',

            didOpen: () => {

                updateRenameSelectedCount();

                // Close open dropdowns when clicking outside dropdown containers inside swal

                const swalContainer = Swal.getHtmlContainer();

                if (swalContainer) {

                    swalContainer.addEventListener('click', (e) => {

                        if (!e.target.closest('.custom-select-container')) {

                            swalContainer.querySelectorAll('.custom-select-dropdown').forEach(d => d.style.display = 'none');

                        }

                    });

                }

            },

            preConfirm: () => {

                const selected = [];

                for (let i = 0; i < headers.length; i++) {

                    const cb = document.getElementById(checkboxId(i));

                    const sel = document.getElementById(selectId(i));

                    const master = sel ? sel.value.trim() : '';

                    

                    if (master) {

                        selected.push({ index: i, old_name: headers[i], new_name: master });

                    } else if (cb && cb.checked && !master) {

                        Swal.showValidationMessage(`Pilih Master Kolom untuk "${headers[i]}" atau hilangkan centang jika tidak ingin diubah.`);

                        return false;

                    }

                }

                if (selected.length === 0) {

                    Swal.showValidationMessage('Belum ada kolom yang dipilih atau diisi.');

                    return false;

                }

                return selected;

            }

        });



        if (!swalResult.isConfirmed || !swalResult.value || swalResult.value.length === 0) return;



        const mapping = {};

        for (const item of swalResult.value) {

            mapping[item.index] = item.new_name;

        }



        const applyRes = await fetch(`${API_BASE}/tables/${tableId}/apply-master-mapping`, {

            method: 'POST',

            headers: { 'Content-Type': 'application/json' },

            body: JSON.stringify({ mapping })

        });

        const applyData = await applyRes.json();

        if (!applyRes.ok) {

            showToast('error', 'Gagal', applyData.detail || 'Gagal menerapkan pemetaan');

            return;

        }

        showToast('success', 'Berhasil', applyData.message);

        refreshEditor();

    } catch(e) {

        showToast("error", "Error", e.message);

    }

}



// =====================================================================

// BATCH 2 FUNCTIONS: TIME SERIES SHORTCUT, SNIPPET PREVIEW, KEYBOARD SHORTCUTS

// =====================================================================



async function openTimeSeriesForTable(tableId, tableName) {

    const navEl = document.getElementById('nav-timeseries');

    navigate('timeseries', navEl);



    showToast('info', 'Membuka Deret Waktu', 'Mengambil indikator kolom tabel...', 2000);



    try {

        // 1. Pastikan tsIndicatorsList sudah dimuat di wizard

        if (!tsIndicatorsList || tsIndicatorsList.length === 0) {

            await initTimeSeriesWizard();

        }



        // 2. Ambil metadata dan headers kolom dari tabel ini

        let tableHeaders = [];

        if (tableId) {

            const res = await fetch(`${API_BASE}/tables/${tableId}/snippet`);

            if (res.ok) {

                const sData = await res.json();

                tableHeaders = sData.headers || [];

            }

        }



        // 3. Filter nama kolom untuk mengabaikan dimensi / entitas non-indikator

        const nonIndicatorWords = ['no', 'nomor', 'kecamatan', 'kabupaten', 'desa', 'kelurahan', 'nama', 'wilayah', 'daerah', 'bulan', 'tahun', 'satuan', 'rincian', 'uraian', 'item'];

        const metricCols = tableHeaders.filter(h => {

            const hClean = String(h || '').trim().toLowerCase();

            return hClean.length > 0 && !nonIndicatorWords.includes(hClean);

        });



        // 4. Cari kecocokan kolom tabel dengan Master Indikator di Deret Waktu

        let matchedIndicators = [];

        metricCols.forEach(colName => {

            const colClean = colName.toLowerCase().trim();

            // Cari exact match atau fuzzy match

            let found = tsIndicatorsList.find(ind => ind.name.toLowerCase().trim() === colClean);

            if (!found) {

                found = tsIndicatorsList.find(ind => {

                    const indClean = ind.name.toLowerCase().trim();

                    return indClean.includes(colClean) || colClean.includes(indClean);

                });

            }

            if (found && !matchedIndicators.some(m => m.name === found.name)) {

                matchedIndicators.push(found);

            }

        });



        // 5. Jika indikator ditemukan, centang otomatis dan tampilkan grafiknya

        if (matchedIndicators.length > 0) {

            tsCheckedIndicators.clear();

            // Centang maksimal 3 indikator pertama agar grafik terbaca rapi

            matchedIndicators.slice(0, 3).forEach(ind => tsCheckedIndicators.add(ind.name));



            const searchInput = document.getElementById('ts-wizard-search');

            if (searchInput) searchInput.value = '';



            renderTSIndicatorsCheckboxes(tsIndicatorsList);

            onKolomCheckboxChanged();



            // Centang semua tahun yang tersedia & tampilkan grafik

            setTimeout(async () => {

                const yearCheckboxes = document.querySelectorAll('.ts-year-checkbox');

                yearCheckboxes.forEach(cb => cb.checked = true);

                onTahunCheckboxChanged();



                // Otomatis tampilkan grafik deret waktu

                await showTimeSeriesFromWizard();



                showToast('success', 'Deret Waktu Siap', `Menampilkan indikator: ${matchedIndicators.map(m => m.name).slice(0, 2).join(', ')}`, 3000);

            }, 100);

        } else {

            // Fallback: cari kata kunci dari kolom pertama di wizard

            const firstKeyword = metricCols[0] || (tableName || '').replace(/^(Tabel[\s_]*\d+(?:\.\d+)*\s*|^\d+(?:\.\d+)+\s*)(?:-\s*|:\s*|)/i, '').replace(/\s*\([Hh]al.*?\)\s*$/i, '').trim();

            const searchInput = document.getElementById('ts-wizard-search');

            if (searchInput) {

                searchInput.value = firstKeyword;

                filterTSIndicators(firstKeyword);

            }

            showToast('info', 'Pencarian Indikator', `Menyaring indikator terkait: ${firstKeyword}`, 3000);

        }

    } catch(e) {

        console.error("Error opening time series for table:", e);

        showToast('error', 'Gagal', e.message);

    }

}



let currentSnippetData = null;



async function openTableSnippet(tableId) {

    try {

        const res = await fetch(API_BASE + '/tables/' + tableId + '/snippet');

        if (!res.ok) {

            const err = await res.json().catch(() => ({}));

            throw new Error(err.detail || 'Gagal mengambil pratinjau tabel');

        }

        const data = await res.json();

        currentSnippetData = data;



        const titleEl = document.getElementById('snippet-table-title');

        const yearEl = document.getElementById('snippet-badge-year');

        const babEl = document.getElementById('snippet-badge-bab');

        const sizeEl = document.getElementById('snippet-badge-size');

        const thead = document.getElementById('snippet-thead');

        const tbody = document.getElementById('snippet-tbody');



        if (titleEl) titleEl.innerHTML = renderCleanTableTitleHtml(data.table_name || ('Tabel #' + tableId));

        if (yearEl) yearEl.innerHTML = `<i class="bi bi-calendar3 me-1"></i> ${data.document_year ? 'Tahun ' + data.document_year : (data.document_name || 'Dokumen')}`;

        if (babEl) babEl.innerHTML = `<i class="bi bi-folder2 me-1"></i> ${data.bab_num ? 'Bab ' + data.bab_num : 'Tabel Publikasi'}`;

        if (sizeEl) sizeEl.innerHTML = `<i class="bi bi-grid-3x3 me-1"></i> ${data.total_rows} Baris × ${data.total_cols} Kolom`;



        let headHtml = '<tr><th class="text-muted text-center" style="width:40px;">No.</th>';

        (data.headers || []).forEach((h, i) => {

            const unit = data.units && data.units[i] ? ' <span class="text-success small fw-normal">(' + escHtml(data.units[i]) + ')</span>' : '';

            headHtml += '<th class="text-nowrap">' + escHtml(h) + unit + '</th>';

        });

        headHtml += '</tr>';

        if (thead) thead.innerHTML = headHtml;



        let bodyHtml = '';

        if (!data.rows || data.rows.length === 0) {

            bodyHtml = '<tr><td colspan="' + ((data.headers || []).length + 1) + '" class="text-center text-muted py-3">Tabel belum memiliki data baris.</td></tr>';

        } else {

            data.rows.forEach((row, rIdx) => {

                bodyHtml += '<tr><td class="text-muted text-center small">' + (rIdx + 1) + '</td>';

                row.forEach(cell => {

                    bodyHtml += '<td class="text-nowrap">' + escHtml(cell !== null && cell !== undefined ? String(cell) : '') + '</td>';

                });

                bodyHtml += '</tr>';

            });

        }

        if (tbody) tbody.innerHTML = bodyHtml;



        const modalEl = document.getElementById('tableSnippetModal');

        if (modalEl && window.bootstrap) {

            const bsModal = bootstrap.Modal.getOrCreateInstance(modalEl);

            bsModal.show();

        }

    } catch(e) {

        showToast('error', 'Pratinjau Gagal', e.message);

    }

}



function openTimeSeriesFromSnippet() {

    if (!currentSnippetData) return;

    const modalEl = document.getElementById('tableSnippetModal');

    if (modalEl && window.bootstrap) {

        bootstrap.Modal.getInstance(modalEl)?.hide();

    }

    openTimeSeriesForTable(currentSnippetData.table_id, currentSnippetData.table_name);

}



function openEditorFromSnippet() {

    if (!currentSnippetData) return;

    const modalEl = document.getElementById('tableSnippetModal');

    if (modalEl && window.bootstrap) {

        bootstrap.Modal.getInstance(modalEl)?.hide();

    }

    previewCsv(currentSnippetData.table_id, currentSnippetData.table_name);

}



function downloadExcelFromSnippet() {

    if (!currentSnippetData) return;

    downloadExcel(currentSnippetData.table_id);

}



function downloadCsvFromSnippet() {

    if (!currentSnippetData) return;

    downloadCsv(currentSnippetData.table_id);

}



function setupKeyboardShortcuts() {

    window.addEventListener('keydown', function(e) {

        if (e.key === 'Escape') {

            if (typeof Swal !== 'undefined' && Swal.isVisible()) {

                Swal.close();

                return;

            }

            const openModal = document.querySelector('.modal.show');

            if (openModal && window.bootstrap) {

                bootstrap.Modal.getInstance(openModal)?.hide();

                return;

            }

        }



        if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {

            const editorPage = document.getElementById('page-editor');

            if (editorPage && editorPage.classList.contains('active') && editorState && editorState.tableId) {

                e.preventDefault();

                if (editorState.mode === 'csv-edit') {

                    saveCsvChangesToServer(editorState.tableId);

                } else {

                    saveTableIdentityInline();

                    showToast('info', 'Tersimpan', 'Identitas judul tabel disimpan.');

                }

                return;

            }

        }



        if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {

            e.preventDefault();

            const currentRole = window.currentUserRole || "pegawai";

            if (currentRole === 'admin') {

                navigateDataTabelTab('kolom');

                const inp = document.getElementById('global-column-search') || document.getElementById('search-table-input');

                if (inp) {

                    inp.focus();

                    inp.select?.();

                }

            } else {

                navigate('timeseries', document.getElementById('nav-timeseries'));

                setTimeout(() => {

                    const inp = document.getElementById('ts-wizard-search');

                    if (inp) {

                        inp.focus();

                        inp.select?.();

                    }

                }, 150);

            }

            return;

        }



        const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';

        const isTyping = activeTag === 'input' || activeTag === 'textarea' || (document.activeElement && document.activeElement.isContentEditable);



        if (!isTyping && e.key === '?') {

            e.preventDefault();

            openShortcutsModal();

            return;

        }



        if (e.altKey && !e.ctrlKey && !e.shiftKey) {

            const keyNum = parseInt(e.key, 10);

            if (keyNum >= 1 && keyNum <= 6) {

                e.preventDefault();

                switch (keyNum) {

                    case 1: navigate('dashboard', document.getElementById('nav-dashboard')); break;

                    case 2: navigate('publikasi', document.getElementById('nav-publikasi')); break;

                    case 3: navigate('import', document.getElementById('nav-import')); break;

                    case 4: navigateDataTabelTab('publikasi'); break;

                    case 5: navigate('timeseries', document.getElementById('nav-timeseries')); break;

                    case 6: navigateAdminTab('backup', document.getElementById('nav-admin-backup')); break;

                }

            }

        }

    });

}



function openSettingsModal(tabName = 'shortcuts') {
    const mobileSidebar = document.querySelector('.sidebar.mobile-open');
    if (mobileSidebar && typeof toggleMobileSidebar === 'function') toggleMobileSidebar();

    const modalEl = document.getElementById('settingsModal');

    if (!modalEl) return;



    // Update role status in settings modal

    const isAdmin = currentUserRole === 'admin';

    const roleTitle = document.getElementById('settings-current-role-title');

    const roleDesc = document.getElementById('settings-current-role-desc');

    if (roleTitle && roleDesc) {

        roleTitle.textContent = isAdmin ? 'Admin SIPEDAS' : 'Operator SIPEDAS';

        roleDesc.textContent = isAdmin ? 'Akses Penuh Pengelolaan, Ekstraksi, & Database' : 'Mode Akses Standar Diseminasi & Analisis Data';

    }



    switchSettingsTab(tabName);

    if (window.bootstrap) {

        bootstrap.Modal.getOrCreateInstance(modalEl).show();

    }

}



function switchSettingsTab(tabName) {

    const tabs = ['shortcuts', 'role', 'technical', 'theme'];

    tabs.forEach(t => {

        const btn = document.getElementById(`tab-btn-${t}`);

        const pane = document.getElementById(`settings-pane-${t}`);

        if (btn) btn.classList.toggle('active', t === tabName);

        if (pane) pane.style.display = t === tabName ? 'block' : 'none';

    });

}



function openShortcutsModal() {

    openSettingsModal('shortcuts');

}



// ===================== THEME ENGINE (DARK / LIGHT MODE) =====================

let currentThemeMode = 'light';



function initThemeSystem() {

    const savedTheme = localStorage.getItem('sipedas_theme') || 'light';

    applyThemeMode(savedTheme);



    // Listen for OS system theme changes

    if (window.matchMedia) {

        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {

            if (currentThemeMode === 'system') {

                applyThemeMode('system');

            }

        });

    }

}



function applyThemeMode(mode) {

    currentThemeMode = mode;

    localStorage.setItem('sipedas_theme', mode);



    let effectiveTheme = mode;

    if (mode === 'system') {

        const isOsDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;

        effectiveTheme = isOsDark ? 'dark' : 'light';

    }



    document.documentElement.setAttribute('data-bs-theme', effectiveTheme);

    document.body.classList.toggle('dark-mode', effectiveTheme === 'dark');



    // Update Sidebar Switch UI

    const isDark = effectiveTheme === 'dark';

    const sidebarIcon = document.getElementById('sidebar-theme-icon');

    const sidebarLabel = document.getElementById('sidebar-theme-label');

    if (sidebarIcon) {

        sidebarIcon.className = isDark ? 'bi bi-sun-fill text-warning theme-mode-icon' : 'bi bi-moon-stars-fill text-warning theme-mode-icon';

    }

    if (sidebarLabel) {

        sidebarLabel.textContent = isDark ? 'Mode Terang' : 'Mode Gelap';

    }



    // Update Modal Option Cards

    ['light', 'dark', 'system'].forEach(m => {

        const card = document.getElementById(`theme-option-${m}`);

        if (card) card.classList.toggle('active', m === mode);

    });



    // Update active chart colors dynamically

    updateDashboardChartsTheme();

}



function updateDashboardChartsTheme() {

    const isDark = document.documentElement.getAttribute('data-bs-theme') === 'dark';

    const tickColor = isDark ? cssVar('--text-light') || '#94a3b8' : cssVar('--text-secondary') || '#64748b';

    const gridColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)';



    const chartInstances = [

        window.dashboardBarChartInstance,

        window.dashboardTrendChartInstance,

        window.dashboardRefYearChartInstance,

        window.tsChartInstance,

        window.timeSeriesChartInstance,

        window.timeSeriesChart2Instance,

        window.timeSeriesChart3Instance,

        window.timeSeriesChartYAxisInstance,

        window.timeSeriesChartYAxis2Instance,

        window.timeSeriesChartYAxis3Instance

    ];



    chartInstances.forEach(chart => {

        if (chart && chart.options && chart.options.scales) {

            if (chart.options.scales.x) {

                if (chart.options.scales.x.ticks) chart.options.scales.x.ticks.color = tickColor;

                if (chart.options.scales.x.grid && chart.options.scales.x.grid.display) chart.options.scales.x.grid.color = gridColor;

            }

            if (chart.options.scales.y) {

                if (chart.options.scales.y.ticks) chart.options.scales.y.ticks.color = tickColor;

                if (chart.options.scales.y.grid) chart.options.scales.y.grid.color = gridColor;

                if (chart.options.scales.y.title) chart.options.scales.y.title.color = tickColor;

            }

            chart.update('none');

        }

    });

}



function toggleTheme() {

    const isDark = document.documentElement.getAttribute('data-bs-theme') === 'dark';

    const nextTheme = isDark ? 'light' : 'dark';

    applyThemeMode(nextTheme);

}



function selectThemeMode(mode) {

    applyThemeMode(mode);

}



// Banner Real-time Clock and Calendar

function initBannerLiveClock() {

    const clockEl = document.getElementById('banner-live-clock');

    const dateEl = document.getElementById('banner-live-date');

    if (!clockEl || !dateEl) return;



    function update() {

        const now = new Date();

        const hrs = String(now.getHours()).padStart(2, '0');

        const mins = String(now.getMinutes()).padStart(2, '0');

        clockEl.textContent = `${hrs}:${mins}`;



        const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

        const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

        

        const dayName = days[now.getDay()];

        const dateNum = now.getDate();

        const monthName = months[now.getMonth()];

        const year = now.getFullYear();



        dateEl.textContent = `${dayName}, ${dateNum} ${monthName} ${year}`;

    }



    update();

    setInterval(update, 1000);

}



// Sidebar Collapsible / Toggle Logic (Cukup klik Logo SIPEDAS)

function toggleSidebar() {
    const isCollapsed = document.body.classList.toggle('sidebar-collapsed');
    document.documentElement.classList.toggle('sidebar-collapsed-early', isCollapsed);

    try {
        localStorage.setItem('sipedas_sidebar_collapsed', isCollapsed ? 'true' : 'false');
        document.cookie = `sipedas_sidebar_collapsed=${isCollapsed ? 'true' : 'false'}; path=/; max-age=31536000; SameSite=Lax`;
    } catch(e) {}

    // Jika sidebar baru saja dibuka (expanded):
    // Pastikan submenu yang sedang memiliki tab aktif otomatis terbuka
    if (!isCollapsed) {
        const activeAdminSub = document.querySelector('#admin-submenu .subnav-link.active');
        if (activeAdminSub) {
            const sub = document.getElementById('admin-submenu');
            const icon = document.getElementById('admin-submenu-icon');
            if (sub) sub.style.display = 'block';
            if (icon) icon.classList.add('open');
        }
        const activeSistemSub = document.querySelector('#sistem-submenu .subnav-link.active');
        if (activeSistemSub) {
            const sub = document.getElementById('sistem-submenu');
            const icon = document.getElementById('sistem-submenu-icon');
            if (sub) sub.style.display = 'block';
            if (icon) icon.classList.add('open');
        }
    }

    // Tutup semua popover + re-parent ke <li> asal
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
}

function toggleMobileSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.getElementById('mobile-sidebar-overlay');
    if (!sidebar || !overlay) return;

    const isOpen = sidebar.classList.contains('mobile-open');
    if (isOpen) {
        sidebar.classList.remove('mobile-open');
        overlay.classList.remove('active');
        setTimeout(() => { overlay.style.display = 'none'; }, 250);
        document.documentElement.classList.remove('mobile-sidebar-active');
        document.body.classList.remove('mobile-sidebar-active');
        document.body.style.overflow = '';
    } else {
        if (window.innerWidth < 992) {
            document.body.classList.remove('sidebar-collapsed');
            document.documentElement.classList.remove('sidebar-collapsed-early');
        }
        overlay.style.display = 'block';
        requestAnimationFrame(() => {
            sidebar.classList.add('mobile-open');
            overlay.classList.add('active');
        });
        document.documentElement.classList.add('mobile-sidebar-active');
        document.body.classList.add('mobile-sidebar-active');
        document.body.style.overflow = 'hidden';
    }
}



function initSidebarState() {
    try {
        if (window.innerWidth < 992) {
            document.body.classList.remove('sidebar-collapsed');
            document.documentElement.classList.remove('sidebar-collapsed-early');
            return;
        }

        const savedState = localStorage.getItem('sipedas_sidebar_collapsed');
        const hasCookie = document.cookie.indexOf('sipedas_sidebar_collapsed=true') !== -1;
        const isCollapsed = savedState === 'true' || (savedState === null && hasCookie);

        if (isCollapsed) {
            document.body.classList.add('sidebar-collapsed');
            document.documentElement.classList.add('sidebar-collapsed-early');
        } else if (savedState === 'false') {
            document.body.classList.remove('sidebar-collapsed');
            document.documentElement.classList.remove('sidebar-collapsed-early');
        }
    } catch(e) {}
}

// ===================== FLYOUT POPOVER LOGIC =====================
// Karena sidebar punya overflow:hidden, popover perlu di-append ke body
// lalu diposisikan secara absolut mengikuti koordinat icon yang di-hover.
function initFlyoutPopovers() {
    const sidebarEl = document.querySelector('.sidebar');
    if (!sidebarEl) return;

    document.querySelectorAll('.has-flyout-submenu').forEach(li => {
        const navLink = li.querySelector('.nav-link');
        const popover = li.querySelector('.sidebar-floating-popover');
        if (!navLink || !popover) return;

        // Simpan referensi parent <li> asal
        popover._originalParent = li;

        let hideTimeout = null;

        function showPopover() {
            // Hanya aktif di layar Desktop (>= 992px) saat sidebar dalam mode collapsed/icon-only
            if (window.innerWidth < 992 || !document.body.classList.contains('sidebar-collapsed')) return;



            // Sembunyikan SEMUA popover lain terlebih dahulu

            document.querySelectorAll('.sidebar-floating-popover').forEach(other => {

                if (other !== popover) {

                    other.classList.remove('popover-visible');

                    other.style.display = '';

                    other.style.position = '';

                    other.style.top = '';

                    other.style.left = '';

                    if (other._originalParent && other.parentNode !== other._originalParent) {

                        other._originalParent.appendChild(other);

                    }

                }

            });



            // Pindahkan popover ke body jika belum

            if (popover.parentNode !== document.body) {

                document.body.appendChild(popover);

            }



            // Hitung posisi berdasarkan bounding rect nav-link

            const rect = navLink.getBoundingClientRect();

            const sidebarRect = sidebarEl.getBoundingClientRect();



            popover.style.position = 'fixed';
            popover.style.display = 'block';

            // Hitung titik tengah vertikal icon dan popover agar center sempurna
            const iconCenterY = rect.top + (rect.height / 2);
            const popoverH = popover.offsetHeight || popover.getBoundingClientRect().height || 260;
            let targetTop = iconCenterY - (popoverH / 2);

            // Viewport clamping (minimal 10px dari atas dan bawah layar)
            if (targetTop < 10) targetTop = 10;
            if (targetTop + popoverH > window.innerHeight - 10) {
                targetTop = window.innerHeight - popoverH - 10;
            }

            popover.style.top = Math.round(targetTop) + 'px';
            popover.style.left = (sidebarRect.right + 8) + 'px';



            // Buat popover muncul di frame berikutnya supaya transisi CSS aktif

            requestAnimationFrame(() => {

                popover.classList.add('popover-visible');

            });



            if (hideTimeout) clearTimeout(hideTimeout);

        }



        function hidePopover() {

            hideTimeout = setTimeout(() => {

                popover.classList.remove('popover-visible');

                // Tunggu transisi selesai baru sembunyikan

                setTimeout(() => {

                    if (!popover.classList.contains('popover-visible')) {

                        popover.style.display = '';

                        popover.style.position = '';

                        popover.style.top = '';

                        popover.style.left = '';

                        // Re-parent pakai _originalParent

                        if (popover._originalParent && popover.parentNode !== popover._originalParent) {

                            popover._originalParent.appendChild(popover);

                        }

                    }

                }, 160);

            }, 80);

        }



        // Hover pada nav-link (icon)

        navLink.addEventListener('mouseenter', showPopover);

        navLink.addEventListener('mouseleave', hidePopover);



        // Hover masuk ke popover sendiri → batalkan hide

        popover.addEventListener('mouseenter', () => {

            if (hideTimeout) clearTimeout(hideTimeout);

        });

        popover.addEventListener('mouseleave', hidePopover);

    });

}



// Inisialisasi jam, sistem tema, status sidebar, dan flyout popover

if (document.readyState === 'loading') {

    document.addEventListener('DOMContentLoaded', () => {

        initBannerLiveClock();

        initThemeSystem();

        initSidebarState();

        initFlyoutPopovers();

    });

} else {

    initBannerLiveClock();

    initThemeSystem();

    initSidebarState();

    initFlyoutPopovers();

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

            title: '🎉ŸŽ‰ Tabel Berhasil Dibuat!',

            html: `<div class="text-start small text-muted">

                <p class="mb-1"><b>Nama Tabel:</b> ${escHtml(fullTableName)}</p>

                <p class="mb-2"><b>Jumlah Baris:</b> ${data.row_count || 0} baris</p>

                <p class="text-dark mb-0">Apakah Anda ingin langsung membuka tabel ini di <b>Editor Spreadsheet</b> untuk mengisi data angka?</p>

            </div>`,

            icon: 'success',

            showCancelButton: true,

            confirmButtonColor: cssVar('--info') || '#2563eb',

            cancelButtonColor: cssVar('--text-secondary') || '#64748b',

            confirmButtonText: '📁Ÿ“ Buka di Editor Spreadsheet',

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



