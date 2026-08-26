// ===== MASTER KOLOM =====
let masterColumnsData = null;

async function loadMasterColumnsPage() {
    await renderMasterColumns();
}

async function renderMasterColumns() {
    try {
        const res = await fetch(`${API_BASE}/master/columns`);
        if (!res.ok) throw new Error('Gagal memuat master columns');
        masterColumnsData = await res.json();
    } catch (e) {
        document.getElementById('master-columns-body').innerHTML = `<tr><td colspan="4" class="text-danger text-center">Error: ${e.message}</td></tr>`;
        return;
    }
    
    const d = masterColumnsData;
    const tbody = document.getElementById('master-columns-body');
    const empty = document.getElementById('master-columns-empty');
    const count = document.getElementById('master-columns-count');
    
    if (!d.columns || d.columns.length === 0) {
        tbody.innerHTML = '';
        if (empty) empty.style.display = 'block';
        if (count) count.textContent = '0 entri';
        return;
    }
    if (empty) empty.style.display = 'none';
    if (count) count.textContent = `${d.columns.length} entri dari dokumen ${d.version || ''}`;
    
    const filter = (document.getElementById('master-column-search')?.value || '').toLowerCase();
    const showEmptyOnly = document.getElementById('filter-empty-columns')?.value === 'empty';
    
    let filtered = filter ? d.columns.filter(c => c.standard.toLowerCase().includes(filter)) : d.columns;
    if (showEmptyOnly) {
        filtered = filtered.filter(c => c.count === 0);
    }
    
    // Update empty count
    const emptyCount = d.columns.filter(c => c.count === 0).length;
    const emptyCountEl = document.getElementById('master-columns-empty-count');
    if (emptyCountEl) {
        if (emptyCount > 0) {
            emptyCountEl.textContent = `(${emptyCount} kolom kosong)`;
            emptyCountEl.style.display = 'inline';
        } else {
            emptyCountEl.style.display = 'none';
        }
    }
    
    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-muted text-center">Tidak ada hasil untuk "${filter || 'kolom kosong'}"</td></tr>`;
        return;
    }
    
    let html = '';
    filtered.forEach(col => {
        const countHtml = col.count > 0 
            ? `<span style="cursor:pointer; color:#4f46e5; text-decoration:underline; font-weight:600;" onclick="showTablesUsingColumn('${col.standard.replace(/'/g, "\\'")}')">${col.count}</span>` 
            : `<span style="color:#ef4444; font-weight:600;">0</span>`;
        const unitDisplay = col.unit ? `<span style="color:#059669; font-weight:500;">${col.unit}</span>` : '<span style="color:#cbd5e1;">-</span>';
        const rowStyle = col.count === 0 ? 'style="background:#fef2f2;"' : '';
        html += `<tr ${rowStyle}>
            <td class="small text-muted">${col.id}</td>
            <td class="fw-semibold small" id="mc-name-${col.id}">${col.standard}</td>
            <td class="small text-center" id="mc-unit-${col.id}">${unitDisplay}</td>
            <td class="small text-center">${countHtml}</td>
            <td>
                <button onclick="editMasterColumn(${col.id})" class="btn btn-sm btn-outline-secondary py-0 px-2" style="font-size:0.7rem;">Edit</button>
                <button onclick="deleteMasterColumn(${col.id})" class="btn btn-sm btn-outline-danger py-0 px-2" style="font-size:0.7rem;">Hapus</button>
            </td>
        </tr>`;
    });
    tbody.innerHTML = html;
}

function switchDataTabelTab(tab) {
    const pubTab = document.getElementById('tab-tabel-publikasi');
    const kolTab = document.getElementById('tab-tabel-kolom');
    const barTab = document.getElementById('tab-tabel-baris');
    if (pubTab) pubTab.style.display = tab === 'publikasi' ? '' : 'none';
    if (kolTab) kolTab.style.display = tab === 'kolom' ? '' : 'none';
    if (barTab) barTab.style.display = tab === 'baris' ? '' : 'none';
    if (tab === 'kolom') {
        const inp = document.getElementById('global-column-search');
        if (inp) inp.focus();
    }
    if (tab === 'baris') {
        const inp = document.getElementById('global-row-search');
        if (inp) inp.focus();
    }
}

function toggleTabelSubmenu() {
    const sub = document.getElementById('tabel-submenu');
    const icon = document.getElementById('tabel-submenu-icon');
    if (!sub) return;
    const open = sub.style.display !== 'none';
    sub.style.display = open ? 'none' : 'block';
    if (icon) icon.classList.toggle('open', !open);
}

function navigateDataTabelTab(tab, element) {
    if (!checkRoleAccess('tabel')) return;
    document.querySelectorAll('.page-section').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-link').forEach(el => el.classList.remove('active'));

    const page = document.getElementById('page-tabel');
    if (page) page.classList.add('active');

    const parent = document.getElementById('nav-tabel');
    if (parent) parent.classList.add('active');

    const el = element || document.getElementById(`nav-tabel-${tab}`);
    if (el) el.classList.add('active');

    const mc = document.querySelector('.main-content');
    if (mc) mc.scrollTop = 0;

    switchDataTabelTab(tab);
    if (typeof populateDocumentList === 'function') populateDocumentList();
}

function switchAdminTab(tab) {
    const tabs = { backup: 'tab-admin-backup', db: 'tab-admin-db', master: 'tab-admin-master', header: 'tab-admin-header', data: 'tab-admin-data' };
    Object.keys(tabs).forEach(key => {
        const el = document.getElementById(tabs[key]);
        if (el) el.style.display = key === tab ? '' : 'none';
    });
    if (tab === 'backup') {
        if (typeof loadAdminBackups === 'function') loadAdminBackups();
        const cEl = document.getElementById('admin-backup-collapse');
        if (cEl) cEl.classList.add('show');
        const bIcon = document.getElementById('admin-backup-icon');
        if (bIcon) bIcon.textContent = '▼';
    }
    if (tab === 'db' && typeof loadAdminTables === 'function') loadAdminTables();
    if (tab === 'master' && typeof renderMasterColumns === 'function') renderMasterColumns();
    if (tab === 'header' && typeof loadHeaderAnomaliesPage === 'function') loadHeaderAnomaliesPage();
    if (tab === 'data') {
        switchDataAnomaliSubTab('ts');
    }
}

function switchDataAnomaliSubTab(type) {
    const btnTs = document.getElementById('btn-subtab-ts-anom');
    const btnCell = document.getElementById('btn-subtab-cell-anom');
    const pnlTs = document.getElementById('subtab-admin-ts-anom');
    const pnlCell = document.getElementById('subtab-admin-cell-anom');

    if (type === 'ts') {
        if (btnTs) btnTs.className = 'btn btn-sm btn-primary fw-medium px-3 py-2';
        if (btnCell) btnCell.className = 'btn btn-sm btn-outline-secondary fw-medium px-3 py-2';
        if (pnlTs) pnlTs.style.display = 'block';
        if (pnlCell) pnlCell.style.display = 'none';
        if (typeof loadTimeSeriesAnomalies === 'function') loadTimeSeriesAnomalies();
    } else {
        if (btnTs) btnTs.className = 'btn btn-sm btn-outline-secondary fw-medium px-3 py-2';
        if (btnCell) btnCell.className = 'btn btn-sm btn-primary fw-medium px-3 py-2';
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
        let theadHtml = '<tr><th style="width: 58px; min-width: 58px; text-align:center; background:#f8fafc; vertical-align:middle; padding: 12px 6px; font-weight:700; color:#64748b; border-bottom: 2px solid #e2e8f0; border-right: 1px solid #e2e8f0;">No</th>';
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

        if (titleEl) titleEl.textContent = formatCleanTableName(data.table_name) || ('Tabel #' + tableId);
        if (yearEl) yearEl.textContent = data.document_year ? ('Tahun ' + data.document_year) : (data.document_name || 'Dokumen');
        if (babEl) babEl.textContent = data.bab_num ? ('Bab ' + data.bab_num) : 'Tabel Publikasi';
        if (sizeEl) sizeEl.textContent = data.total_rows + ' Baris × ' + data.total_cols + ' Kolom';

        let headHtml = '<tr><th class="text-muted text-center" style="width:40px;">#</th>';
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
                    case 4: navigateDataTabelTab('publikasi', document.getElementById('nav-tabel-publikasi')); break;
                    case 5: navigate('timeseries', document.getElementById('nav-timeseries')); break;
                    case 6: navigateAdminTab('backup', document.getElementById('nav-admin-backup')); break;
                }
            }
        }
    });
}

function openSettingsModal(tabName = 'shortcuts') {
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

