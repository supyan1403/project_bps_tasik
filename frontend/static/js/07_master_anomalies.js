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

            return '<tr class="anomali-row" data-table-name="' + (a.table_name || '').toLowerCase() + '" data-header="' + h.toLowerCase() + '">' +
                '<td class="text-center"><input type="checkbox" class="anomali-checkbox" data-table-id="' + a.table_id + '" data-col-index="' + a.col_index + '" data-header="' + h + '"></td>' +
                '<td class="fw-medium text-dark text-truncate" style="max-width:250px;" title="' + escHtml(a.table_name || '') + '">' +
                    '<span style="cursor:pointer; color:#4f46e5; text-decoration:underline;" onclick="previewCsv(' + a.table_id + ', \'' + tn + '\')">' + escHtml(cleanTn) + '</span>' +
                '</td>' +
                '<td class="text-center text-muted" style="font-size:0.76rem;">' + (a.document_year || '') + '</td>' +
                '<td class="fw-semibold text-dark">' + escHtml(a.header || '') + '</td>' +
                '<td><span class="badge bg-warning bg-opacity-10 text-warning-emphasis border border-warning border-opacity-50" style="font-size:0.72rem;">' + escHtml(words) + '</span></td>' +
                '<td>' + saranHtml + '</td>' +
                '<td class="text-center text-nowrap">' +
                    '<button onclick="fixSaranColumn(' + a.table_id + ', ' + a.col_index + ', \'' + h + '\')" class="btn btn-sm" style="background:#dbeafe; border:1px solid #93c5fd; color:#1e40af; padding:2px 7px; font-size:0.72rem; border-radius:5px; margin-right:4px;">Fix</button>' +
                    '<button onclick="searchMasterColumn(' + a.table_id + ', ' + a.col_index + ', \'' + h + '\')" class="btn btn-sm" style="background:#fef3c7; border:1px solid #fcd34d; color:#92400e; padding:2px 7px; font-size:0.72rem; border-radius:5px; margin-right:4px;">Cari</button>' +
                    '<button onclick="dismissAnomalyFromPage(' + a.table_id + ', ' + a.col_index + ', \'' + h + '\')" class="btn btn-sm" style="background:#dcfce7; border:1px solid #86efac; color:#166534; padding:2px 7px; font-size:0.72rem; border-radius:5px;">Aman</button>' +
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



// ===== PENCARIAN TABEL DENGAN CAKUPAN KONTEKSTUAL =====
let searchDebounceTimeout = null;

function updateSearchScopeIndicator() {
    const scopeEl = document.getElementById('search-scope-text');
    const input = document.getElementById('search-table-input');
    if (!scopeEl || !input) return;

    if (viewState && viewState.selectedDocId) {
        const doc = (window.__documentsList || []).find(d => d.id === viewState.selectedDocId);
        const pubName = doc ? (doc.year ? `Publikasi ${doc.year}` : doc.filename) : `Dokumen #${viewState.selectedDocId}`;
        
        if (viewState.selectedBabNum !== null && viewState.selectedBabNum !== undefined) {
            const babTitle = (typeof window.__getChapterTitle === 'function') ? window.__getChapterTitle(viewState.selectedBabNum) : '';
            const babText = babTitle ? `Bab ${viewState.selectedBabNum}: ${babTitle}` : `Bab ${viewState.selectedBabNum}`;
            scopeEl.className = 'badge bg-primary-subtle text-primary border border-primary-subtle px-2.5 py-1 fw-semibold';
            scopeEl.textContent = `Cakupan: ${pubName} › ${babText}`;
            input.placeholder = `Cari tabel pada Bab ${viewState.selectedBabNum} (${pubName})...`;
        } else {
            scopeEl.className = 'badge bg-primary-subtle text-primary border border-primary-subtle px-2.5 py-1 fw-semibold';
            scopeEl.textContent = `Cakupan: ${pubName}`;
            input.placeholder = `Cari tabel pada ${pubName}...`;
        }
    } else {
        scopeEl.className = 'badge bg-light text-secondary border px-2 py-1 fw-normal';
        scopeEl.textContent = 'Cakupan: Semua Publikasi';
        input.placeholder = 'Cari nomor tabel (mis. 1.1.2) atau kata kunci judul...';
    }
}

function onSearchInput() {
    const input = document.getElementById('search-table-input');
    const clearBtn = document.getElementById('search-clear-btn');
    if (clearBtn) {
        clearBtn.style.display = (input && input.value.trim().length > 0) ? 'inline-block' : 'none';
    }

    clearTimeout(searchDebounceTimeout);
    searchDebounceTimeout = setTimeout(() => {
        onUnifiedSearch();
    }, 250);
}

function clearTableSearch() {
    const input = document.getElementById('search-table-input');
    const clearBtn = document.getElementById('search-clear-btn');
    const container = document.getElementById('search-table-results');
    const results = document.getElementById('unified-search-results');
    const docList = document.getElementById('document-list-container');
    if (input) {
        input.value = '';
        input.focus();
    }
    if (clearBtn) clearBtn.style.display = 'none';
    if (container) {
        container.innerHTML = '';
        container.style.display = 'none';
    }
    if (results) results.innerHTML = '';
    // Restore publication cards, hide search results
    if (docList) docList.style.display = '';
    if (results) results.style.display = 'none';
}

function onSearchTypeChange() {
    const type = document.getElementById('search-type-select')?.value || 'tabel';
    const input = document.getElementById('search-table-input');
    if (!input) return;
    const placeholders = {
        tabel: 'Cari nomor tabel (mis. 1.1.2) atau kata kunci judul...',
        kolom: 'Ketik nama kolom (mis. jumlah penduduk, luas daerah)...',
        baris: 'Ketik nilai/entitas (mis. nama kecamatan, angka)...'
    };
    input.placeholder = placeholders[type] || placeholders.tabel;
    input.focus();
    clearTableSearch();
}

async function onUnifiedSearch() {
    const type = document.getElementById('search-type-select')?.value || 'tabel';
    const resultsDiv = document.getElementById('unified-search-results');
    const docList = document.getElementById('document-list-container');

    // For kolom/baris, check if query is long enough
    if ((type === 'kolom' || type === 'baris')) {
        const q = document.getElementById('search-table-input')?.value?.trim();
        if (!q || q.length < 2) return;
    }

    // Show results area, hide publication cards
    if (resultsDiv) resultsDiv.style.display = '';
    if (docList) docList.style.display = 'none';

    if (type === 'tabel') {
        searchTables();
    } else if (type === 'kolom') {
        searchGlobalColumnsDirect();
    } else if (type === 'baris') {
        searchGlobalRowsDirect();
    }
}

async function searchGlobalColumnsDirect() {
    const q = document.getElementById('search-table-input')?.value?.trim();
    const resultsDiv = document.getElementById('unified-search-results');
    if (!resultsDiv) return;

    if (!q || q.length < 2) {
        resultsDiv.innerHTML = `<div class="text-center py-4" style="color:var(--text-secondary);">
            <i class="bi bi-search" style="font-size:2rem; opacity:0.35;"></i>
            <div class="fw-semibold mt-2" style="font-size:0.9rem;">Ketik minimal 2 karakter untuk mencari kolom</div>
            <div class="mt-2 px-3 py-2 rounded-3 d-inline-block" style="background:var(--bg-subtle,#f1f5f9); font-size:0.8rem;">
                <span class="me-1" style="opacity:0.5;">Contoh:</span>
                <code class="me-1">luas daerah</code>
                <code class="me-1">jumlah penduduk</code>
                <code>IPM</code>
            </div>
        </div>`;
        return;
    }

    resultsDiv.innerHTML = '<div class="text-center text-muted small py-3"><div class="spinner-border spinner-border-sm me-2" role="status"></div>Mencari kolom...</div>';

    try {
        const res = await fetch(`${API_BASE}/master/columns/search?q=${encodeURIComponent(q)}`);
        if (!res.ok) throw new Error('Gagal mencari kolom');
        const data = await res.json();
        const results = data.results || [];

        if (results.length === 0) {
            resultsDiv.innerHTML = `<div class="text-center text-muted py-3">Tidak ada kolom yang cocok dengan "${escHtml(q)}".</div>`;
            return;
        }

        let html = `<div class="small text-muted mb-3 fw-semibold">${data.total || results.length} header kolom ditemukan</div>`;
        results.forEach((g, idx) => {
            const unitHtml = g.unit ? ` <span class="badge bg-info bg-opacity-25 text-info">${escHtml(g.unit)}</span>` : '';
            const colName = g.header || g.column_name || 'Kolom';
            const collapseId = `col-group-${idx}`;
            let rowsHtml = '';
            g.matches.forEach(m => {
                const yearLabel = m.table_year ? ` · data ${m.table_year}` : '';
                const docLabel = m.doc_year ? `<span class="badge bg-light text-secondary">Publikasi ${m.doc_year}</span> ` : '';
                const tNum = m.table_number || '';
                rowsHtml += `<div class="d-flex justify-content-between align-items-center px-3 py-2 border-bottom" style="text-align:left;">
                    <div class="small" style="flex:1; min-width:0; padding-right:8px;">
                        <div class="d-flex align-items-center flex-wrap" style="white-space:normal; word-break:break-word;">${renderCleanTableTitleHtml(m.table_name)}</div>
                        <div class="text-muted mt-0.5" style="font-size:0.72rem;">${docLabel}${tNum ? 'Tabel ' + tNum : ''}${yearLabel}</div>
                    </div>
                    <button class="btn btn-outline-primary btn-sm flex-shrink-0 ms-2" style="font-size:0.72rem; padding:2px 8px;" onclick="event.stopPropagation(); previewCsv(${m.table_id}, '${(m.table_name||'').replace(/'/g,"\\'")}', '${colName.replace(/'/g,"\\'")}')">Buka</button>
                </div>`;
            });
            html += `<div class="bg-white rounded-3 border mb-2 overflow-hidden">
                <div class="px-4 py-3 fw-semibold d-flex align-items-center gap-2 cursor-pointer user-select-none" onclick="const p=document.getElementById('${collapseId}');const ic=document.getElementById('icon-${collapseId}');if(p){const open=p.style.display!=='none';p.style.display=open?'none':'';if(ic)ic.textContent=open?'▶':'▼';}" style="background:var(--bg-subtle,#f1f5f9); font-size:0.85rem;">
                    <span id="icon-${collapseId}" style="font-size:0.75rem; min-width:16px; color:var(--text-secondary,#64748b);">▶</span>
                    <span class="flex-grow-1" style="color:var(--text-primary,#1e293b); word-break:break-word;">${escHtml(colName)}</span>${unitHtml}
                    <span class="badge flex-shrink-0 fw-normal ms-auto" style="font-size:0.7rem; background:rgba(37,99,235,0.1); color:#2563eb;">${g.matches.length} tabel</span>
                </div>
                <div id="${collapseId}" style="display:none;">
                    ${rowsHtml}
                </div>
            </div>`;
        });
        resultsDiv.innerHTML = html;
    } catch (e) {
        resultsDiv.innerHTML = `<div class="text-center text-danger py-3 small">Gagal mencari kolom. Coba lagi.</div>`;
    }
}

async function searchGlobalRowsDirect() {
    const q = document.getElementById('search-table-input')?.value?.trim();
    const resultsDiv = document.getElementById('unified-search-results');
    if (!resultsDiv) return;

    if (!q || q.length < 2) {
        resultsDiv.innerHTML = `<div class="text-center py-4" style="color:var(--text-secondary);">
            <i class="bi bi-search" style="font-size:2rem; opacity:0.35;"></i>
            <div class="fw-semibold mt-2" style="font-size:0.9rem;">Ketik minimal 2 karakter untuk mencari baris</div>
            <div class="mt-2 px-3 py-2 rounded-3 d-inline-block" style="background:var(--bg-subtle,#f1f5f9); font-size:0.8rem;">
                <span class="me-1" style="opacity:0.5;">Contoh:</span>
                <code class="me-1">Tasikmalaya</code>
                <code class="me-1">Bantarkalong</code>
                <code>59.83</code>
            </div>
        </div>`;
        return;
    }

    resultsDiv.innerHTML = '<div class="text-center text-muted small py-3"><div class="spinner-border spinner-border-sm me-2" role="status"></div>Mencari baris...</div>';

    try {
        const res = await fetch(`${API_BASE}/search/rows?q=${encodeURIComponent(q)}`);
        if (!res.ok) throw new Error('Gagal mencari baris');
        const data = await res.json();
        const results = data.results || [];

        if (results.length === 0) {
            resultsDiv.innerHTML = `<div class="text-center text-muted py-3">Tidak ada baris yang cocok dengan "${escHtml(q)}".</div>`;
            return;
        }

        let html = `<div class="small text-muted mb-3 fw-semibold">${data.total || results.length} baris ditemukan</div>`;
        results.forEach((g, idx) => {
            const docLabel = g.doc_year ? `<span class="badge bg-light text-secondary">Publikasi ${g.doc_year}</span> ` : '';
            const collapseId = `row-group-${idx}`;
            let rowsHtml = '';
            g.matches.forEach(m => {
                const valLabel = m.value ? ` → <b>${escHtml(String(m.value))}</b>` : '';
                const colInfo = m.col_name || (m.columns && m.columns.length > 0 ? m.columns.join(', ') : '');
                rowsHtml += `<div class="d-flex justify-content-between align-items-center px-3 py-2 border-bottom" style="text-align:left;">
                    <div class="small" style="flex:1; min-width:0;">
                        <div style="white-space:normal; word-break:break-word;"><b>${escHtml(m.entity || '')}</b>${valLabel}</div>
                        <div class="text-muted mt-0.5" style="font-size:0.72rem;">${docLabel}${colInfo ? ' · ' + escHtml(colInfo) : ''}</div>
                    </div>
                    <button class="btn btn-outline-primary btn-sm flex-shrink-0 ms-2" style="font-size:0.72rem; padding:2px 8px;" onclick="event.stopPropagation(); previewCsv(${g.table_id}, '${(g.table_name||'').replace(/'/g,"\\'")}', '${(m.entity||'').replace(/'/g,"\\'")}')">Buka</button>
                </div>`;
            });
            const matchCount = g.match_count || g.matches.length;
            html += `<div class="bg-white rounded-3 border mb-2 overflow-hidden">
                <div class="px-4 py-3 fw-semibold d-flex align-items-center gap-2 cursor-pointer user-select-none" onclick="const p=document.getElementById('${collapseId}');const ic=document.getElementById('icon-${collapseId}');if(p){const open=p.style.display!=='none';p.style.display=open?'none':'';if(ic)ic.textContent=open?'▶':'▼';}" style="background:#f0fdf4; font-size:0.85rem;">
                    <span id="icon-${collapseId}" style="font-size:0.75rem; min-width:16px; color:#16a34a;">▶</span>
                    <span class="flex-grow-1" style="color:var(--text-primary,#1e293b); word-break:break-word;">${escHtml(g.table_name || 'Tabel')}</span>
                    <span class="badge flex-shrink-0 fw-normal ms-auto" style="font-size:0.7rem; background:rgba(22,163,74,0.12); color:#16a34a;">${matchCount} kecocokan</span>
                </div>
                <div id="${collapseId}" style="display:none;">
                    ${rowsHtml}
                </div>
            </div>`;
        });
        resultsDiv.innerHTML = html;
    } catch (e) {
        resultsDiv.innerHTML = `<div class="text-center text-danger py-3 small">Gagal mencari baris. Coba lagi.</div>`;
    }
}

async function searchTables() {
    const q = document.getElementById('search-table-input')?.value?.trim();
    const container = document.getElementById('search-table-results');
    const docList = document.getElementById('document-list-container');
    if (!container) return;

    if (!q) {
        container.innerHTML = '';
        container.style.display = 'none';
        if (docList) docList.style.display = '';
        return;
    }

    // Hide publication cards while searching
    if (docList) docList.style.display = 'none';
    container.style.display = 'block';
    container.innerHTML = '<div class="p-3 text-center small text-muted"><div class="spinner-border spinner-border-sm text-primary me-2" role="status"></div>Mencari tabel...</div>';

    try {
        let url = `${API_BASE}/tables/search?q=${encodeURIComponent(q)}&limit=25`;
        if (viewState && viewState.selectedDocId) {
            url += `&document_id=${encodeURIComponent(viewState.selectedDocId)}`;
        }
        if (viewState && viewState.selectedBabNum !== null && viewState.selectedBabNum !== undefined) {
            url += `&bab=${encodeURIComponent(viewState.selectedBabNum)}`;
        }

        const res = await fetch(url);
        if (!res.ok) throw new Error('Gagal mencari');
        const data = await res.json();
        const results = data.tables || [];

        if (results.length === 0) {
            container.innerHTML = `<div class="p-3 text-center text-muted small bg-light rounded-2 border">
                <i class="bi bi-info-circle me-1"></i> Tidak ada tabel ditemukan untuk kata kunci "<strong>${escHtml(q)}</strong>" pada cakupan aktif.
            </div>`;
            return;
        }

        let html = `<div class="d-flex align-items-center justify-content-between px-1 mb-2">
            <span class="fw-bold small text-dark">Ditemukan ${data.total} tabel:</span>
            <button class="btn btn-link btn-xs text-muted text-decoration-none p-0" onclick="clearTableSearch()">Tutup Hasil</button>
        </div>`;

        results.forEach(t => {
            const docInfo = t.document_name ? `${t.document_year ? t.document_year : ''} - ${t.document_name}` : '';
            html += `<div class="search-result-item-enhanced d-flex justify-content-between align-items-center gap-3">
                <div class="small flex-grow-1 min-w-0">
                    <div class="d-flex align-items-center flex-wrap mb-1">${renderCleanTableTitleHtml(t.table_name)}</div>
                    <div class="text-muted d-flex align-items-center gap-2 flex-wrap" style="font-size:0.75rem;">
                        <span>${escHtml(docInfo)}</span>
                        ${t.bab_num ? `<span class="badge bg-light text-secondary border px-1.5 py-0.5">Bab ${t.bab_num}</span>` : ''}
                    </div>
                </div>
                <div class="d-flex gap-1.5 flex-shrink-0 flex-wrap">
                    <button onclick="openTableSnippet(${t.id}); clearTableSearch(); return false;" class="btn btn-sm btn-outline-info px-2 py-1" style="font-size:0.72rem;">Snippet</button>
                    <button onclick="openTimeSeriesForTable(${t.id}, '${(t.table_name || '').replace(/'/g, "\\'")}'); clearTableSearch(); return false;" class="btn btn-sm btn-outline-warning px-2 py-1" style="font-size:0.72rem;color:#b45309;border-color:#fcd34d;">Tren</button>
                    <button onclick="openTable(${t.id}); clearTableSearch(); return false;" class="btn btn-sm btn-outline-primary px-2.5 py-1" style="font-size:0.72rem;">Lihat</button>
                    <button onclick="openTableForEdit(${t.id}); clearTableSearch(); return false;" class="btn btn-sm btn-primary px-2.5 py-1 shadow-xs" style="font-size:0.72rem;">Edit</button>
                </div>
            </div>`;
        });

        container.innerHTML = html;
    } catch (e) {
        container.innerHTML = `<div class="p-2 text-danger small bg-danger-subtle rounded border border-danger-subtle"><i class="bi bi-exclamation-triangle me-1"></i> Error: ${e.message}</div>`;
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
            <td class="text-center text-muted" style="font-size:0.76rem;">${col.id}</td>
            <td class="fw-semibold text-dark" id="mc-name-${col.id}">${col.standard}</td>
            <td class="text-center" style="font-size:0.76rem;" id="mc-unit-${col.id}">${unitDisplay}</td>
            <td class="text-center" style="font-size:0.76rem;">${countHtml}</td>
            <td class="text-center">
                <button onclick="editMasterColumn(${col.id})" class="btn btn-sm btn-outline-secondary py-0.5 px-2" style="font-size:0.72rem; border-radius:5px;">Edit</button>
                <button onclick="deleteMasterColumn(${col.id})" class="btn btn-sm btn-outline-danger py-0.5 px-2" style="font-size:0.72rem; border-radius:5px;">Hapus</button>
            </td>
        </tr>`;

    });

    tbody.innerHTML = html;

}



function switchDataTabelTab(tab) {
    // Legacy function — tabs merged into unified search. No-op.
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

    document.querySelectorAll('.sidebar .nav-link').forEach(el => el.classList.remove('active'));

    const page = document.getElementById('page-tabel');

    if (page) page.classList.add('active');

    const parent = document.getElementById('nav-tabel');

    if (parent) parent.classList.add('active');

    const mc = document.querySelector('.main-content');

    if (mc) mc.scrollTop = 0;

    // Set dropdown to the requested tab type
    const sel = document.getElementById('search-type-select');
    const input = document.getElementById('search-table-input');
    const resultsDiv = document.getElementById('unified-search-results');
    const docList = document.getElementById('document-list-container');

    // Reset to default state: show publication cards, hide search results
    if (resultsDiv) { resultsDiv.innerHTML = ''; resultsDiv.style.display = 'none'; }
    if (docList) docList.style.display = '';
    if (input) input.value = '';
    const clearBtn = document.getElementById('search-clear-btn');
    if (clearBtn) clearBtn.style.display = 'none';

    if (sel && (tab === 'kolom' || tab === 'baris' || tab === 'publikasi')) {
        const type = (tab === 'publikasi') ? 'tabel' : tab;
        sel.value = type;
        onSearchTypeChange();
        if (input && type !== 'tabel') input.focus();
    }

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



function navigateSistemTab(tab, element) {
    const mobileSidebar = document.querySelector('.sidebar.mobile-open');
    if (mobileSidebar && typeof toggleMobileSidebar === 'function') toggleMobileSidebar();

    if (!checkRoleAccess('admin')) return;

    document.querySelectorAll('.page-section').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-link').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.popover-item').forEach(el => el.classList.remove('active'));

    const page = document.getElementById('page-sistem');
    if (page) page.classList.add('active');

    const parent = document.getElementById('nav-sistem');
    if (parent) parent.classList.add('active');

    // 1. Aktifkan item subnav di dalam sidebar
    const subnavEl = document.getElementById(`nav-sistem-${tab}`);
    if (subnavEl) subnavEl.classList.add('active');

    // 2. Aktifkan item di popover flyout
    const popoverEl = document.getElementById(`popover-sistem-${tab}`) || 
                      document.querySelector(`#flyout-sistem-submenu [data-tab="${tab}"]`) || 
                      (element && element.classList.contains('popover-item') ? element : null);
    if (popoverEl) popoverEl.classList.add('active');

    // 3. Pastikan submenu accordion terbuka & icon berputar (agar langsung terlihat saat sidebar dibuka)
    const sub = document.getElementById('sistem-submenu');
    const icon = document.getElementById('sistem-submenu-icon');
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

    switchSistemTab(tab);
}



function switchSistemTab(tab) {

    const tabs = { maintenance: 'tab-sistem-maintenance', logs: 'tab-sistem-logs', cache: 'tab-sistem-cache' };

    Object.keys(tabs).forEach(key => {

        const el = document.getElementById(tabs[key]);

        if (el) el.style.display = key === tab ? '' : 'none';

    });

    if (tab === 'maintenance') {
        _initMaintenanceFlatpickr();
        if (typeof loadMaintenanceStatus === 'function') loadMaintenanceStatus();
    }

    if (tab === 'logs' && typeof loadActivityLogs === 'function') loadActivityLogs();

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



