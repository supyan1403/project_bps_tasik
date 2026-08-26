// ===== MASTER DICTIONARY & COLUMN ANOMALY SYSTEM =====

let currentColumnAnomalies = [];

async function checkColumnAnomalies(tableId) {
    try {
        const res = await fetch(`${API_BASE}/tables/${tableId}/column-anomalies`);
        if (res.ok) {
            const data = await res.json();
            currentColumnAnomalies = data.anomalies || [];
            return currentColumnAnomalies;
        }
    } catch(e) {
        console.error("Failed to check column anomalies:", e);
    }
    currentColumnAnomalies = [];
    return [];
}

function getAnomalyInfo(colIndex) {
    return currentColumnAnomalies.find(a => a.col_index === colIndex);
}

async function dismissColumnAnomalyLocal(tableId, colIndex, header) {
    try {
        const key = `${tableId}:${colIndex}:${header}`;
        const res = await fetch(`${API_BASE}/dismiss-column-anomaly`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ key: key })
        });
        if (!res.ok) throw new Error("Gagal menandai kolom aman");
        
        await showToast('success', 'Berhasil', 'Kolom ditandai aman (bukan anomali).', 1500);
        
        if (typeof _loadCsvIntoEditor === 'function' && editorState) {
            await _loadCsvIntoEditor(editorState.tableId, editorState.tableName, editorState.mode === 'csv-edit');
        }
    } catch (e) {
        showToast("error", "Error", e.message);
    }
}

async function dismissAnomalyFromPage(tableId, colIndex, header) {
    try {
        const key = `${tableId}:${colIndex}:${header}`;
        const res = await fetch(`${API_BASE}/dismiss-column-anomaly`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ key: key })
        });
        if (!res.ok) throw new Error("Gagal menandai kolom aman");
        
        await showToast('success', 'Berhasil', 'Kolom ditandai aman.', 1500);
        
        loadHeaderAnomaliesPage();
    } catch (e) {
        showToast("error", "Error", e.message);
    }
}

function openMasterDictionary() {
    const modal = new bootstrap.Modal(document.getElementById('masterDictionaryModal'));
    refreshMasterDictList();
    modal.show();
}

async function refreshMasterDictList() {
    try {
        const res = await fetch(`${API_BASE}/master-dictionary`);
        const data = await res.json();
        const words = data.words || [];
        const listEl = document.getElementById('master-dict-list');
        if (words.length === 0) {
            listEl.innerHTML = '<p style="color: #94a3b8;">Belum ada kata dalam kamus master.</p>';
        } else {
            listEl.innerHTML = words.map(w => `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 4px 8px; border-bottom: 1px solid #f1f5f9;">
                    <span>${w}</span>
                    <button onclick="deleteMasterWord('${w}')" style="background: none; border: none; color: #ef4444; cursor: pointer; font-size: 0.8rem;">✕</button>
                </div>
            `).join('');
        }
    } catch(e) {
        document.getElementById('master-dict-list').innerHTML = '<p style="color: #ef4444;">Gagal memuat.</p>';
    }
}

async function addMasterWord() {
    const input = document.getElementById('master-dict-new-word');
    const word = input ? input.value.trim() : '';
    if (!word) return;
    await fetch(`${API_BASE}/master-dictionary/words`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ words: [word] })
    });
    if (input) input.value = '';
    await refreshMasterDictList();
}

async function deleteMasterWord(word) {
    await fetch(`${API_BASE}/master-dictionary/words/${encodeURIComponent(word)}`, { method: 'DELETE' });
    await refreshMasterDictList();
}

async function dismissColumnAnomaly(colIndex) {
    const info = getAnomalyInfo(colIndex);
    if (!info) return;
    await fetch(`${API_BASE}/dismiss-column-anomaly`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: info.key })
    });
    currentColumnAnomalies = currentColumnAnomalies.filter(a => a.col_index !== colIndex);
}

async function applyColumnSuggestion(tableId, colIndex, suggestionName) {
    if (!suggestionName) return;
    await fetch(`${API_BASE}/tables/${tableId}/apply-column-fix`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ col_index: colIndex, new_name: suggestionName })
    });
    
    // Refresh tampilan anomali jika berada di halaman anomali
    if (typeof loadHeaderAnomaliesPage === 'function') {
        loadHeaderAnomaliesPage();
    }
}

async function fixSaranColumn(tableId, colIndex, headerText) {
    try {
        const res = await fetch(`${API_BASE}/master/columns`);
        if (!res.ok) throw new Error('Gagal memuat master columns');
        const data = await res.json();
        const masterCols = data.columns || [];
        const saran = findBestMasterMatch(headerText, masterCols);
        
        if (!saran) {
            showToast('info', 'Tidak Ada Saran', `Tidak ada saran otomatis yang cocok untuk "${headerText}". Gunakan tombol "Cari" untuk mencari secara manual.`);
            return;
        }

        const confirm = await Swal.fire({
            title: 'Terapkan Saran?',
            text: `Apakah Anda ingin mengubah nama kolom "${headerText}" menjadi "${saran}"?`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Ya, Ubah',
            cancelButtonText: 'Batal'
        });

        if (confirm.isConfirmed) {
            await applyColumnSuggestion(tableId, colIndex, saran);
            if (typeof _loadCsvIntoEditor === 'function' && editorState) {
                await _loadCsvIntoEditor(editorState.tableId, editorState.tableName, editorState.mode === 'csv-edit');
            }
            loadHeaderAnomaliesPage();
            showToast('success', 'Berhasil!', 'Header diganti menjadi "' + saran + '".', 1500);
        }
    } catch (e) {
        showToast('error', 'Gagal', e.message);
    }
}

async function applySaranAndReload(tableId, colIndex, newName) {
    Swal.close();
    await applyColumnSuggestion(tableId, colIndex, newName);
    if (typeof _loadCsvIntoEditor === 'function' && editorState) {
        await _loadCsvIntoEditor(editorState.tableId, editorState.tableName, editorState.mode === 'csv-edit');
    }
}

function findBestMasterMatch(headerText, masterCols) {
    var q = headerText.toLowerCase().trim();
    var best = null, bestScore = 0;
    masterCols.forEach(function(c) {
        var s = c.standard.toLowerCase();
        var score = 0;
        if (s === q) score = 100;
        else if (s.indexOf(q) !== -1) score = 90;
        else if (q.indexOf(s) !== -1) score = 80;
        else {
            var sWords = s.split(' '), qWords = q.split(' ');
            var overlap = sWords.filter(function(w) { return qWords.indexOf(w) !== -1; }).length;
            if (overlap > 0) score = Math.round((overlap / Math.max(sWords.length, qWords.length)) * 70);
        }
        if (score > bestScore) { bestScore = score; best = c.standard; }
    });
    return bestScore >= 30 ? best : null;
}

async function loadHeaderAnomaliesPage() {
    var tbody = document.getElementById('headeranom-tbody');
    var empty = document.getElementById('headeranom-empty');
    var actionsDiv = document.getElementById('headeranom-actions');
    var selectAllCb = document.getElementById('select-all-anomali');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-4">Memuat anomali header...</td></tr>';
    if (empty) empty.style.display = 'none';
    if (actionsDiv) actionsDiv.style.display = 'none';
    if (selectAllCb) selectAllCb.checked = false;
    try {
        var [resAnom, resMaster] = await Promise.all([
            fetch(API_BASE + '/admin/all-column-anomalies'),
            fetch(API_BASE + '/master/columns')
        ]);
        if (!resAnom.ok) throw new Error('Gagal memuat anomali');
        var data = await resAnom.json();
        var anomalies = data.anomalies || [];
        var masterCols = resMaster.ok ? ((await resMaster.json()).columns || []) : [];
        if (anomalies.length === 0) {
            tbody.innerHTML = '';
            if (empty) empty.style.display = 'block';
            return;
        }
        
        if (actionsDiv) actionsDiv.style.display = 'flex';
        
        tbody.innerHTML = anomalies.map(function(a, index) {
            var tn = (a.table_name || '').replace(/'/g, "\\'");
            var h = (a.header || '').replace(/'/g, "\\'");
            var words = (a.unknown_words || []).join(', ');
            var saran = findBestMasterMatch(a.header || '', masterCols);
            var saranHtml = saran
                ? '<span style="background:#f0fdf4; padding:2px 6px; border-radius:4px; border:1px solid #86efac; font-size:0.75rem; color:#166534;">' + escHtml(saran) + '</span>'
                : '<span style="color:#94a3b8; font-size:0.75rem;">-</span>';
            var cleanTn = formatCleanTableName(a.table_name || '');
            return '<tr class="anomali-row" data-table-name="' + (a.table_name || '').toLowerCase() + '" data-header="' + h.toLowerCase() + '" style="border-bottom:1px solid #f1f5f9;">' +
                '<td style="padding:10px;"><input type="checkbox" class="anomali-checkbox" data-table-id="' + a.table_id + '" data-col-index="' + a.col_index + '" data-header="' + h + '"></td>' +
                '<td style="padding:10px; font-weight:500; color:#334155; max-width:250px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="' + escHtml(a.table_name || '') + '">' +
                    '<span style="cursor:pointer; color:#4f46e5; text-decoration:underline;" onclick="previewCsv(' + a.table_id + ', \'' + tn + '\')">' + escHtml(cleanTn) + '</span>' +
                '</td>' +
                '<td style="padding:10px; text-align:center; color:#64748b;">' + (a.document_year || '') + '</td>' +
                '<td style="padding:10px; color:#334155; font-weight:600;">' + escHtml(a.header || '') + '</td>' +
                '<td style="padding:10px; color:#b45309;"><span style="background:#fffbeb; padding:2px 6px; border-radius:4px; border:1px solid #fcd34d; font-size:0.75rem;">' + escHtml(words) + '</span></td>' +
                '<td style="padding:10px;">' + saranHtml + '</td>' +
                '<td style="padding:10px; text-align:center; white-space:nowrap;">' +
                    '<button onclick="fixSaranColumn(' + a.table_id + ', ' + a.col_index + ', \'' + h + '\')" class="btn btn-small" style="background:#dbeafe; border:1px solid #93c5fd; color:#1e40af; padding:3px 8px; font-size:0.72rem; cursor:pointer; margin-right:4px;">Fix</button>' +
                    '<button onclick="searchMasterColumn(' + a.table_id + ', ' + a.col_index + ', \'' + h + '\')" class="btn btn-small" style="background:#fef3c7; border:1px solid #fcd34d; color:#92400e; padding:3px 8px; font-size:0.72rem; cursor:pointer; margin-right:4px;">Cari</button>' +
                    '<button onclick="dismissAnomalyFromPage(' + a.table_id + ', ' + a.col_index + ', \'' + h + '\')" class="btn btn-small" style="background:#dcfce7; border:1px solid #86efac; color:#166534; padding:3px 8px; font-size:0.72rem; cursor:pointer;">Aman</button>' +
                '</td>' +
            '</tr>';
        }).join('');
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center text-danger py-4">Gagal memuat: ' + escHtml(e.message) + '</td></tr>';
    }
}

function toggleSelectAllAnomali(master) {
    const checkboxes = document.querySelectorAll('.anomali-checkbox');
    checkboxes.forEach(cb => {
        const row = cb.closest('tr');
        if (row && row.style.display !== 'none') {
            cb.checked = master.checked;
        }
    });
}

function filterAnomaliPage(q) {
    const words = q.toLowerCase().trim().split(/\s+/).filter(w => w.length > 0);
    const rows = document.querySelectorAll('.anomali-row');
    rows.forEach(row => {
        const text = (row.dataset.tableName + ' ' + row.dataset.header).toLowerCase();
        const match = words.every(w => text.includes(w));
        row.style.display = match ? '' : 'none';
    });
}

// ===== PENCARIAN TABEL =====
let searchDebounceTimeout = null;
function onSearchInput() {
    clearTimeout(searchDebounceTimeout);
    searchDebounceTimeout = setTimeout(() => {
        searchTables();
    }, 250);
}

async function searchTables() {
    const q = document.getElementById('search-table-input')?.value?.trim();
    const container = document.getElementById('search-table-results');
    if (!q) {
        container.innerHTML = '';
        return;
    }
    container.innerHTML = '<div class="small text-muted">Mencari...</div>';
    try {
        const res = await fetch(`${API_BASE}/tables/search?q=${encodeURIComponent(q)}&limit=20`);
        if (!res.ok) throw new Error('Gagal mencari');
        const data = await res.json();
        const results = data.tables || [];
        if (results.length === 0) {
            container.innerHTML = '<div class="small text-muted">Tidak ada tabel ditemukan.</div>';
            return;
        }
        let html = `<div class="fw-semibold small mb-1">Ditemukan ${data.total} tabel:</div>`;
        results.forEach(t => {
            const docInfo = t.document_name ? `${t.document_year ? t.document_year : ''} - ${t.document_name}` : '';
            html += `<div class="d-flex justify-content-between align-items-center p-2 border-bottom search-result-item" style="cursor:pointer;transition:background 0.15s;" onmouseenter="this.style.background='#f1f5f9'" onmouseleave="this.style.background='transparent'">
                <div class="small">
                    <div class="fw-semibold">${escHtml(formatCleanTableName(t.table_name))}</div>
                    <div class="text-muted" style="font-size:0.75rem;">${docInfo}${t.bab_num ? ` &middot; Bab ${t.bab_num}` : ''}</div>
                </div>
                <div class="d-flex gap-1">
                    <button onclick="openTableSnippet(${t.id}); document.getElementById('search-table-results').innerHTML=''; return false;" class="btn btn-sm btn-outline-info" style="font-size:0.7rem;">Snippet</button>
                    <button onclick="openTimeSeriesForTable(${t.id}, '${(t.table_name || '').replace(/'/g, "\\'")}'); document.getElementById('search-table-results').innerHTML=''; return false;" class="btn btn-sm btn-outline-warning" style="font-size:0.7rem;color:#b45309;border-color:#fcd34d;">Tren</button>
                    <button onclick="openTable(${t.id}); document.getElementById('search-table-results').innerHTML=''; return false;" class="btn btn-sm btn-outline-primary" style="font-size:0.7rem;">Lihat</button>
                    <button onclick="openTableForEdit(${t.id}); document.getElementById('search-table-results').innerHTML=''; return false;" class="btn btn-sm btn-outline-success" style="font-size:0.7rem;">Edit</button>
                </div>
            </div>`;
        });
        container.innerHTML = html;
    } catch (e) {
        container.innerHTML = `<div class="small text-danger">Error: ${e.message}</div>`;
    }
}

async function navigateBab(direction) {
    const babs = Object.keys(window.__babGroups || {}).map(Number).sort((a,b) => a-b);
    if (babs.length === 0) return;
    const current = viewState.selectedBabNum;
    let idx = current !== null ? babs.indexOf(current) : -1;
    if (direction === 'prev') {
        idx = idx > 0 ? idx - 1 : babs.length - 1;
    } else {
        idx = idx < babs.length - 1 ? idx + 1 : 0;
    }
    viewState.selectedBabNum = babs[idx];
    await populateDocumentList();
}


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

function navigateAdminTab(tab, element) {
    if (!checkRoleAccess('admin')) return;
    document.querySelectorAll('.page-section').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-link').forEach(el => el.classList.remove('active'));

    const page = document.getElementById('page-admin');
    if (page) page.classList.add('active');

    const parent = document.getElementById('nav-admin');
    if (parent) parent.classList.add('active');

    const el = element || document.getElementById(`nav-admin-${tab}`);
    if (el) el.classList.add('active');

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
                    <div class="small fw-semibold" style="text-align:left;">${escHtml(formatCleanTableName(t.table_name))}
                        <span class="badge bg-secondary ms-1">${totalLabel}</span></div>
                    <div>${docLabel} <span class="text-muted small ms-1">▾</span></div>
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
        return;
    }

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
                        <div class="fw-semibold" style="white-space:normal; word-break:break-word;">${escHtml(formatCleanTableName(m.table_name))}</div>
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
                    <div>${scoreLabel} <span class="text-muted small ms-1">▾</span></div>
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
                <label style="font-size:0.85rem; font-weight:600; color:#475569; display:block; margin-bottom:4px;">Nama Header:</label>
                <input id="swal-mc-name" class="swal2-input" value="${currentName}" style="width:100%; font-size:0.9rem;">
                <label style="font-size:0.85rem; font-weight:600; color:#475569; display:block; margin:12px 0 4px;">Satuan:</label>
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
        confirmButtonColor: '#ef4444',
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
        confirmButtonColor: '#ef4444',
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
                <label style="font-size:0.85rem; font-weight:600; color:#475569; display:block; margin-bottom:4px;">Nama Header:</label>
                <input id="swal-mc-new-name" class="swal2-input" placeholder="Masukkan nama header..." style="width:100%; font-size:0.9rem;">
                <label style="font-size:0.85rem; font-weight:600; color:#475569; display:block; margin:12px 0 4px;">Satuan:</label>
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
            title: `🔍 Master Kolom untuk "${headerText}"`,
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
        showToast('success', 'Berhasil', 'Master columns diperbarui dari publikasi 2025.', 2000);
    } catch (e) {
        Swal.close();
        showToast('error', 'Gagal', e.message);
    }
}



