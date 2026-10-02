// ===================== TIME SERIES INSIGHTS & GROWTH CALCULATIONS =====================

let tsInsightsExpanded = false;

let tsInsightYearStart = null;

let tsInsightYearEnd = null;

let tsInsightActiveVk = null;

const tsHiddenEntities = new Set();
let tsInsightSelectedEntities = new Set();
let tsInsightSelectedTrends = new Set(['up', 'down', 'stagnant', 'empty']);
let tsInsightSearchKeyword = '';



function toggleTimeSeriesInsights(forceState) {

    const drawer = document.getElementById('ts-insights-drawer');
    if (!drawer) return;
    const detailsEl = drawer.closest('details.ts-trend-collapsible');
    if (!detailsEl) return;

    if (typeof forceState === 'boolean') {
        detailsEl.open = forceState;
        tsInsightsExpanded = forceState;
    } else {
        detailsEl.open = !detailsEl.open;
        tsInsightsExpanded = detailsEl.open;
    }

    if (tsInsightsExpanded) {
        initInsightFilterOptions();
        computeAndRenderTimeSeriesInsights();
    }
}

document.addEventListener('DOMContentLoaded', function() {
    var trendDetails = document.querySelector('details.ts-trend-collapsible');
    if (trendDetails) {
        trendDetails.addEventListener('toggle', function() {
            if (trendDetails.open) {
                tsInsightsExpanded = true;
                initInsightFilterOptions();
                computeAndRenderTimeSeriesInsights();
            }
        });
    }
});

function quickJumpToInsights() {
    if (!tsInsightsExpanded) {
        toggleTimeSeriesInsights(true);
    }
    setTimeout(() => {
        const target = document.getElementById('ts-insights-drawer') || document.querySelector('.ts-trend-banner');
        if (target) {
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }, 150);
}



function initInsightFilterOptions() {

    if (!currentTimeSeriesData || !currentTimeSeriesData.years) return;



    const years = currentTimeSeriesData.years || [];

    const checked = (typeof getCheckedVKs === 'function' ? getCheckedVKs() : currentTimeSeriesData.valueKeys) || currentTimeSeriesData.valueKeys || [];

    const allEntities = _sortEntitiesWithKabLast(Object.keys(currentTimeSeriesData.entityMap || {}));



    // Populate Variant Select if multiple sub-types exist
    const uniqueSubTypes = [...new Set(
        (tsOriginalTablesData || []).map(t => t.entity_key || t.headers?.[0] || '').filter(Boolean)
    )];
    const varContainer = document.getElementById('ts-insight-variant-container');
    const selVar = document.getElementById('ts-insight-select-variant');
    if (selVar && uniqueSubTypes.length > 1) {
        selVar.innerHTML = `
            <option value="Semua" ${tsCurrentSubType === 'Semua' ? 'selected' : ''}>Semua Varian</option>
            ${uniqueSubTypes.map(st => `<option value="${escHtml(st)}" ${tsCurrentSubType === st ? 'selected' : ''}>${escHtml(st)}</option>`).join('')}
        `;
    }
    if (varContainer) {
        varContainer.style.display = (uniqueSubTypes.length > 1) ? 'flex' : 'none';
    }

    // Ensure valid defaults

    if (!years.includes(tsInsightYearStart)) tsInsightYearStart = years[0];

    if (!years.includes(tsInsightYearEnd)) tsInsightYearEnd = years[years.length - 1];

    if (!checked.includes(tsInsightActiveVk)) tsInsightActiveVk = checked[0] || (currentTimeSeriesData.valueKeys ? currentTimeSeriesData.valueKeys[0] : null);



    if (tsInsightSelectedEntities.size === 0) {

        allEntities.forEach(e => tsInsightSelectedEntities.add(e));

    }



    // Populate Year Start Select

    const selStart = document.getElementById('ts-insight-select-year-start');

    if (selStart) {

        selStart.innerHTML = years.map(y => `<option value="${y}" ${y === tsInsightYearStart ? 'selected' : ''}>Tahun ${y}</option>`).join('');

    }



    // Populate Year End Select

    const selEnd = document.getElementById('ts-insight-select-year-end');

    if (selEnd) {

        selEnd.innerHTML = years.map(y => `<option value="${y}" ${y === tsInsightYearEnd ? 'selected' : ''}>Tahun ${y}</option>`).join('');

    }



    // Populate Indicator Select

    const indContainer = document.getElementById('ts-insight-indicator-container');

    const selInd = document.getElementById('ts-insight-select-indicator');

    if (selInd) {

        selInd.innerHTML = checked.map(vk => `<option value="${escHtml(vk)}" ${vk === tsInsightActiveVk ? 'selected' : ''}>${escHtml(vk)}</option>`).join('');

    }

    if (indContainer) {

        indContainer.style.display = (checked.length > 1) ? 'flex' : 'none';

    }



    // Sinkronkan tsInsightSelectedEntities dari tsHiddenEntities
    tsInsightSelectedEntities = new Set(allEntities.filter(e => !tsHiddenEntities.has(e)));

    // Populate Searchable Entity Dropdown inside Insight Drawer
    const listEl = document.getElementById('ts-insight-entity-list');
    const btnSelectAll = document.getElementById('btn-ts-insight-select-all');
    const btnClearAll = document.getElementById('btn-ts-insight-clear-all');
    const btnText = document.getElementById('ts-insight-entity-btn-text');

    function updateInsightEntityBtnText() {
        if (!btnText) return;
        const total = allEntities.length;
        const sel = allEntities.filter(e => !tsHiddenEntities.has(e)).length;
        if (sel === total) {
            btnText.textContent = `Semua Rincian (${total})`;
        } else if (sel === 0) {
            btnText.textContent = `0 Rincian Terpilih`;
        } else {
            btnText.textContent = `${sel} Rincian Terpilih`;
        }
    }

    if (listEl) {
        let listHtml = '';
        allEntities.forEach(ent => {
            const isChecked = !tsHiddenEntities.has(ent);
            listHtml += `
                <label class="dropdown-item px-1 py-1 ts-insight-entity-item" data-name="${ent.toLowerCase()}" style="display:flex; align-items:center; gap:6px; font-size:0.8rem; cursor:pointer;" onclick="event.stopPropagation();">
                    <input type="checkbox" class="ts-insight-entity-cb" data-entity="${escHtml(ent)}" ${isChecked ? 'checked' : ''} style="width:16px;height:16px;">
                    <span class="text-truncate">${escHtml(ent)}</span>
                </label>
            `;
        });
        listEl.innerHTML = listHtml;

        listEl.querySelectorAll('.ts-insight-entity-cb').forEach(cb => {
            cb.onchange = function(e) {
                if (e) e.stopPropagation();
                const ent = this.getAttribute('data-entity');
                const isHidden = !this.checked;
                if (isHidden) {
                    tsHiddenEntities.add(ent);
                    tsInsightSelectedEntities.delete(ent);
                } else {
                    tsHiddenEntities.delete(ent);
                    tsInsightSelectedEntities.add(ent);
                }

                // 2-Way Sync: Update semua checkbox di grafik/tabel
                document.querySelectorAll(`.ts-entity-cb[data-entity="${CSS.escape(ent)}"]`).forEach(c => {
                    c.checked = !isHidden;
                });

                // Update counter badge di tombol filter atas
                const newVisCount = allEntities.filter(x => !tsHiddenEntities.has(x)).length;
                const newLabel = (newVisCount === allEntities.length) ? 'Semua' : `${newVisCount}/${allEntities.length}`;
                document.querySelectorAll('.entity-count-badge').forEach(b => {
                    b.textContent = newLabel;
                });

                // Update grafik, legenda, & tabel
                _syncEntityVisibility(ent, isHidden);
                if (tsRenderCallback) tsRenderCallback(!isHidden ? ent : null);

                // Update teks tombol & ranking wawasan tren
                updateInsightEntityBtnText();
                computeAndRenderTimeSeriesInsights();
            };
        });
    }

    if (btnSelectAll) {
        btnSelectAll.onclick = function(e) {
            if (e) e.stopPropagation();
            tsHiddenEntities.clear();
            tsInsightSelectedEntities = new Set(allEntities);

            // Update semua checkbox di wawasan tren
            if (listEl) {
                listEl.querySelectorAll('.ts-insight-entity-cb').forEach(cb => cb.checked = true);
            }
            // Update semua checkbox di atas (grafik & tabel)
            document.querySelectorAll('.ts-entity-cb').forEach(cb => cb.checked = true);
            document.querySelectorAll('.entity-count-badge').forEach(b => {
                b.textContent = 'Semua';
            });

            // Update grafik, legenda, & tabel
            allEntities.forEach(x => _syncEntityVisibility(x, false));
            if (tsRenderCallback) tsRenderCallback(null);

            updateInsightEntityBtnText();
            computeAndRenderTimeSeriesInsights();
        };
    }

    if (btnClearAll) {
        btnClearAll.onclick = function(e) {
            if (e) e.stopPropagation();
            allEntities.forEach(x => tsHiddenEntities.add(x));
            tsInsightSelectedEntities = new Set();

            // Update semua checkbox di wawasan tren
            if (listEl) {
                listEl.querySelectorAll('.ts-insight-entity-cb').forEach(cb => cb.checked = false);
            }
            // Update semua checkbox di atas (grafik & tabel)
            document.querySelectorAll('.ts-entity-cb').forEach(cb => cb.checked = false);
            document.querySelectorAll('.entity-count-badge').forEach(b => {
                b.textContent = `0/${allEntities.length}`;
            });

            // Update grafik, legenda, & tabel
            allEntities.forEach(x => _syncEntityVisibility(x, true));
            if (tsRenderCallback) tsRenderCallback(null);

            updateInsightEntityBtnText();
            computeAndRenderTimeSeriesInsights();
        };
    }

    const searchInp = document.getElementById('ts-insight-entity-search');
    if (searchInp) {
        searchInp.value = '';

        searchInp.addEventListener('input', function(e) {

            e.stopPropagation();

            const kw = this.value.trim().toLowerCase();

            if (listEl) {

                listEl.querySelectorAll('.ts-insight-entity-item').forEach(item => {

                    const name = item.dataset.name || '';

                    item.style.display = (!kw || name.includes(kw)) ? 'flex' : 'none';

                });

            }

        });

        searchInp.addEventListener('click', function(e) {

            e.stopPropagation();

        });

    }



    // Populate Trend Multi-Select Dropdown
    const trendMenu = document.getElementById('ts-insight-trend-menu');
    const trendCheckAll = document.getElementById('ts-insight-trend-check-all');
    const trendBtnText = document.getElementById('ts-insight-trend-btn-text');

    function updateInsightTrendBtnText() {
        if (!trendBtnText) return;
        const sel = tsInsightSelectedTrends.size;
        if (sel === 4) {
            trendBtnText.textContent = 'Semua Tren';
        } else if (sel === 0) {
            trendBtnText.textContent = '0 Tren Terpilih';
        } else if (sel === 2 && tsInsightSelectedTrends.has('up') && tsInsightSelectedTrends.has('down')) {
            trendBtnText.textContent = 'Naik & Turun (2)';
        } else if (sel === 1) {
            if (tsInsightSelectedTrends.has('up')) trendBtnText.textContent = '▲ Kenaikan Saja';
            else if (tsInsightSelectedTrends.has('down')) trendBtnText.textContent = '▼ Penurunan Saja';
            else if (tsInsightSelectedTrends.has('stagnant')) trendBtnText.textContent = '― Stagnan Saja';
            else if (tsInsightSelectedTrends.has('empty')) trendBtnText.textContent = '- Strip Saja';
        } else {
            trendBtnText.textContent = `${sel} Tren Terpilih`;
        }
        if (trendCheckAll) {
            trendCheckAll.checked = (sel === 4);
            trendCheckAll.indeterminate = (sel > 0 && sel < 4);
        }
    }

    if (trendMenu) {
        trendMenu.querySelectorAll('.ts-insight-trend-cb').forEach(cb => {
            cb.checked = tsInsightSelectedTrends.has(cb.dataset.trend);
            cb.onchange = function() {
                const t = this.dataset.trend;
                if (this.checked) tsInsightSelectedTrends.add(t);
                else tsInsightSelectedTrends.delete(t);
                updateInsightTrendBtnText();
                computeAndRenderTimeSeriesInsights();
            };
        });
    }

    if (trendCheckAll) {
        trendCheckAll.checked = (tsInsightSelectedTrends.size === 4);
        trendCheckAll.onchange = function() {
            if (this.checked) {
                ['up', 'down', 'stagnant', 'empty'].forEach(t => tsInsightSelectedTrends.add(t));
            } else {
                tsInsightSelectedTrends.clear();
            }
            if (trendMenu) {
                trendMenu.querySelectorAll('.ts-insight-trend-cb').forEach(cb => cb.checked = trendCheckAll.checked);
            }
            updateInsightTrendBtnText();
            computeAndRenderTimeSeriesInsights();
        };
    }

    updateInsightTrendBtnText();
    updateInsightEntityBtnText();

}

function syncInsightEntityChecklistUI() {
    const listEl = document.getElementById('ts-insight-entity-list');
    const btnText = document.getElementById('ts-insight-entity-btn-text');
    if (currentTimeSeriesData && currentTimeSeriesData.entityMap) {
        const allEntities = _sortEntitiesWithKabLast(Object.keys(currentTimeSeriesData.entityMap));
        tsInsightSelectedEntities = new Set(allEntities.filter(e => !tsHiddenEntities.has(e)));

        if (listEl) {
            listEl.querySelectorAll('.ts-insight-entity-cb').forEach(cb => {
                const ent = cb.getAttribute('data-entity');
                cb.checked = !tsHiddenEntities.has(ent);
            });
        }

        if (btnText) {
            const total = allEntities.length;
            const sel = allEntities.filter(e => !tsHiddenEntities.has(e)).length;
            if (sel === total) {
                btnText.textContent = `Semua Rincian (${total})`;
            } else if (sel === 0) {
                btnText.textContent = `0 Rincian Terpilih`;
            } else {
                btnText.textContent = `${sel} Rincian Terpilih`;
            }
        }

        // Recompute Wawasan Tren insights if panel is open
        if (tsInsightsExpanded) {
            computeAndRenderTimeSeriesInsights();
        }
    }
}




function onInsightVariantFilterChanged() {
    const sel = document.getElementById('ts-insight-select-variant');
    if (!sel) return;
    const newVariant = sel.value;
    tsCurrentSubType = newVariant;
    tsHiddenEntities.clear();
    
    // Sinkronkan pilihan radio chip di bagian atas jika ada
    const radio = document.querySelector(`input[name="ts-subtype"][value="${CSS.escape(newVariant)}"]`);
    if (radio) {
        radio.checked = true;
        const container = document.getElementById('ts-tipe-rincian-picker');
        if (container) {
            container.querySelectorAll('.ts-variant-chip').forEach(c => c.classList.remove('active'));
            const parent = radio.closest('.ts-variant-chip');
            if (parent) parent.classList.add('active');
        }
    }
    
    if (tsOriginalTablesData && tsCurrentKeyword) {
        renderTimeSeriesTable(tsOriginalTablesData, tsCurrentKeyword, true);
    }
}

function onInsightFilterChanged() {
    const selStart = document.getElementById('ts-insight-select-year-start');
    const selEnd = document.getElementById('ts-insight-select-year-end');
    const selInd = document.getElementById('ts-insight-select-indicator');

    if (selStart) tsInsightYearStart = String(selStart.value);
    if (selEnd) tsInsightYearEnd = String(selEnd.value);
    if (selInd) tsInsightActiveVk = selInd.value || tsInsightActiveVk;

    // Auto-adjust if start year > end year
    if (Number(tsInsightYearStart) > Number(tsInsightYearEnd)) {
        tsInsightYearEnd = tsInsightYearStart;
        if (selEnd) selEnd.value = tsInsightYearEnd;
    }

    computeAndRenderTimeSeriesInsights();
}

function computeAndRenderTimeSeriesInsights() {
    if (!currentTimeSeriesData || !currentTimeSeriesData.years || !currentTimeSeriesData.entityMap) return;

    const { years, valueKeys, entityMap, vkUnits } = currentTimeSeriesData;
    const checked = (typeof getCheckedVKs === 'function' ? getCheckedVKs() : valueKeys) || valueKeys;

    if (!tsInsightActiveVk || !checked.includes(tsInsightActiveVk)) {
        tsInsightActiveVk = (checked && checked.length > 0) ? checked[0] : valueKeys[0];
    }
    
    const strYears = years.map(String);
    if (!tsInsightYearStart || !strYears.includes(String(tsInsightYearStart))) {
        tsInsightYearStart = String(years[0]);
    }
    if (!tsInsightYearEnd || !strYears.includes(String(tsInsightYearEnd))) {
        tsInsightYearEnd = String(years[years.length - 1]);
    }

    const startYear = tsInsightYearStart;
    const endYear = tsInsightYearEnd;
    const activeVk = tsInsightActiveVk;



    const subtitleEl = document.getElementById('ts-insights-subtitle');

    const gainerNameEl = document.getElementById('ts-gainer-name');

    const gainerBadgeEl = document.getElementById('ts-gainer-badge');

    const gainerDetailEl = document.getElementById('ts-gainer-detail');



    const declinerNameEl = document.getElementById('ts-decliner-name');

    const declinerBadgeEl = document.getElementById('ts-decliner-badge');

    const declinerDetailEl = document.getElementById('ts-decliner-detail');



    const avgBadgeEl = document.getElementById('ts-avg-badge');

    const trendSummaryEl = document.getElementById('ts-trend-summary');

    const trendDetailEl = document.getElementById('ts-trend-detail');



    const countEl = document.getElementById('ts-growth-table-count');

    const tbody = document.getElementById('ts-growth-ranking-tbody');

    const thStart = document.getElementById('ts-th-year-start');

    const thEnd = document.getElementById('ts-th-year-end');



    if (!activeVk || years.length < 2) {

        if (subtitleEl) subtitleEl.textContent = 'Membutuhkan minimal data 2 tahun untuk analisis pertumbuhan.';

        if (tbody) tbody.innerHTML = `<tr><td colspan="6" class="text-center py-3 text-muted">Diperlukan minimal data 2 tahun untuk menghitung laju pertumbuhan & tren.</td></tr>`;

        return;

    }



    const yearIdxStart = strYears.indexOf(String(startYear));
    const yearIdxEnd = strYears.indexOf(String(endYear));
    const intervalYears = Math.max(1, (yearIdxEnd >= 0 && yearIdxStart >= 0) ? (yearIdxEnd - yearIdxStart) : 1);

    if (thStart) thStart.textContent = `Thn ${startYear}`;
    if (thEnd) thEnd.textContent = `Thn ${endYear}`;
    if (subtitleEl) subtitleEl.textContent = `Berdasarkan indikator "${activeVk}" dari Tahun ${startYear} ke ${endYear} (${intervalYears + 1} Tahun Observasi)`;

    const vkUnit = (vkUnits && vkUnits[activeVk]) || '';
    const unitConfig = getUnitConfigForVK(activeVk);
    const uSuffix = unitConfig ? ' ' + unitConfig.label : (vkUnit ? ' ' + vkUnit : '');

    const allEntities = _sortEntitiesWithKabLast(Object.keys(entityMap));
    const isSummaryEntity = (typeof getSummaryEntityDetector === 'function') 
        ? getSummaryEntityDetector(allEntities) 
        : (ent => ['jumlah', 'total', 'subtotal', 'grand total', 'keseluruhan', 'seluruh', 'kabupaten tasikmalaya'].some(kw => ent.trim().toLowerCase() === kw));

    if (!tsInsightSelectedEntities) {
        tsInsightSelectedEntities = new Set(allEntities);
    }

    const calculations = [];



    allEntities.forEach(ent => {

        const startRaw = entityMap[ent]?.[startYear]?.[activeVk];

        const endRaw = entityMap[ent]?.[endYear]?.[activeVk];



        let startNum = (startRaw != null && startRaw !== '-' && startRaw !== '...' && startRaw !== '') ? parseIndoNumberToFloat(startRaw) : null;

        let endNum = (endRaw != null && endRaw !== '-' && endRaw !== '...' && endRaw !== '') ? parseIndoNumberToFloat(endRaw) : null;



        if (unitConfig && unitConfig.factor != null) {

            if (startNum !== null) startNum *= unitConfig.factor;

            if (endNum !== null) endNum *= unitConfig.factor;

        }



        let delta = (startNum !== null && endNum !== null) ? (endNum - startNum) : null;

        let pctChange = (startNum !== null && endNum !== null && startNum !== 0) ? ((endNum - startNum) / Math.abs(startNum)) * 100 : null;



        calculations.push({

            entity: ent,

            isSummary: isSummaryEntity(ent),

            startVal: startNum,

            endVal: endNum,

            delta: delta,

            pctChange: pctChange

        });

    });



    // Sort calculations for ranking:
    // 1. Entities with valid pctChange sorted descending
    const validCalculations = calculations.filter(c => !c.isSummary && c.pctChange !== null).sort((a, b) => b.pctChange - a.pctChange);
    // 2. Entities with missing / null pctChange (e.g. data missing in start or end year)
    const unrankedCalculations = calculations.filter(c => !c.isSummary && c.pctChange === null);
    // Combined non-summary items in proper order
    const rankable = [...validCalculations, ...unrankedCalculations];
    const summaryItems = calculations.filter(c => c.isSummary);

    // Filter calculations by tsInsightSelectedEntities (strictly respect user selection)
    const filteredRankable = rankable.filter(c => tsInsightSelectedEntities.has(c.entity));
    const filteredSummaries = summaryItems.filter(c => tsInsightSelectedEntities.has(c.entity));

    // Top Gainer & Decliner computed only from entities with valid percent change
    const validFilteredRankable = filteredRankable.filter(c => c.pctChange !== null);

    // Top Gainer (from selected entities)
    if (validFilteredRankable.length > 0 && validFilteredRankable[0].pctChange > 0) {
        const g = validFilteredRankable[0];
        const gPct = (g.pctChange >= 0 ? '+' : '') + g.pctChange.toFixed(2).replace('.', ',') + '%';
        const gStartFmt = formatWithUnitScale(g.startVal, { factor: 1, isInteger: unitConfig?.isInteger, maxDecimals: unitConfig?.maxDecimals });
        const gEndFmt = formatWithUnitScale(g.endVal, { factor: 1, isInteger: unitConfig?.isInteger, maxDecimals: unitConfig?.maxDecimals });
        const gDeltaFmt = (g.delta >= 0 ? '+' : '') + formatWithUnitScale(g.delta, { factor: 1, isInteger: unitConfig?.isInteger, maxDecimals: unitConfig?.maxDecimals });

        if (gainerNameEl) gainerNameEl.textContent = g.entity;
        if (gainerBadgeEl) gainerBadgeEl.textContent = gPct;
        if (gainerDetailEl) gainerDetailEl.innerHTML = `${gStartFmt} → ${gEndFmt}${uSuffix} (${gDeltaFmt})`;
    } else {
        if (gainerNameEl) gainerNameEl.textContent = 'Tidak Ada Kenaikan';
        if (gainerBadgeEl) gainerBadgeEl.textContent = '0%';
        if (gainerDetailEl) gainerDetailEl.textContent = 'Tidak ditemukan tren positif pada periode ini';
    }

    // Top Decliner (from selected entities)
    const decliners = validFilteredRankable.filter(c => c.pctChange < 0);
    if (decliners.length > 0) {
        const d = decliners[decliners.length - 1]; // most negative
        const dPct = d.pctChange.toFixed(2).replace('.', ',') + '%';
        const dStartFmt = formatWithUnitScale(d.startVal, { factor: 1, isInteger: unitConfig?.isInteger, maxDecimals: unitConfig?.maxDecimals });
        const dEndFmt = formatWithUnitScale(d.endVal, { factor: 1, isInteger: unitConfig?.isInteger, maxDecimals: unitConfig?.maxDecimals });
        const dDeltaFmt = formatWithUnitScale(d.delta, { factor: 1, isInteger: unitConfig?.isInteger, maxDecimals: unitConfig?.maxDecimals });

        if (declinerNameEl) declinerNameEl.textContent = d.entity;
        if (declinerBadgeEl) declinerBadgeEl.textContent = dPct;
        if (declinerDetailEl) declinerDetailEl.innerHTML = `${dStartFmt} → ${dEndFmt}${uSuffix} (${dDeltaFmt})`;
    } else {
        if (declinerNameEl) declinerNameEl.textContent = 'Tidak Ada Penurunan';
        if (declinerBadgeEl) declinerBadgeEl.textContent = '0%';
        if (declinerDetailEl) declinerDetailEl.textContent = 'Semua rincian data stabil atau mengalami pertumbuhan';
    }

    // Average Annual Growth / Overall Summary (from selected entities)
    const validPcts = validFilteredRankable.map(c => c.pctChange);
    const avgPct = validPcts.length > 0 ? (validPcts.reduce((a, b) => a + b, 0) / validPcts.length) : 0;
    const avgAnnualPct = (intervalYears > 0) ? (avgPct / intervalYears) : avgPct;

    const gainersCount = validFilteredRankable.filter(c => c.pctChange > 0).length;
    const declinersCount = validFilteredRankable.filter(c => c.pctChange < 0).length;
    const stableCount = validFilteredRankable.filter(c => c.pctChange === 0).length;



    if (avgBadgeEl) {

        avgBadgeEl.textContent = (avgAnnualPct >= 0 ? '+' : '') + avgAnnualPct.toFixed(2).replace('.', ',') + '% / thn';

        avgBadgeEl.className = `badge ${avgAnnualPct >= 0 ? 'bg-success-subtle text-success border border-success-subtle' : 'bg-danger-subtle text-danger border border-danger-subtle'} px-2 py-0.5 fw-bold`;

    }

    if (trendSummaryEl) {

        trendSummaryEl.textContent = avgAnnualPct > 0 ? 'Tren Tumbuh Positif' : (avgAnnualPct < 0 ? 'Tren Menurun' : 'Tren Stabil');

    }

    if (trendDetailEl) {

        trendDetailEl.innerHTML = `<span class="text-success fw-semibold">${gainersCount} Naik</span>, <span class="text-danger fw-semibold">${declinersCount} Turun</span>, <span class="text-muted">${stableCount} Stagnan</span>`;

    }



    // Multi-Select Trend Direction Filter (Up, Down, Stagnant, Empty)
    if (!window.tsInsightSelectedTrends || !(window.tsInsightSelectedTrends instanceof Set)) {
        window.tsInsightSelectedTrends = new Set(['up', 'down', 'stagnant', 'empty']);
    }

    let trendFilteredRankable = filteredRankable.filter(c => {
        const isUp = (c.pctChange !== null && c.pctChange > 0) || (c.pctChange === null && c.delta !== null && c.delta > 0);
        const isDown = (c.pctChange !== null && c.pctChange < 0) || (c.pctChange === null && c.delta !== null && c.delta < 0);
        const isStagnant = (c.pctChange !== null && c.pctChange === 0) || (c.pctChange === null && c.delta !== null && c.delta === 0);
        const isEmpty = (c.pctChange === null && c.delta === null);

        if (isUp && tsInsightSelectedTrends.has('up')) return true;
        if (isDown && tsInsightSelectedTrends.has('down')) return true;
        if (isStagnant && tsInsightSelectedTrends.has('stagnant')) return true;
        if (isEmpty && tsInsightSelectedTrends.has('empty')) return true;
        return false;
    });

    let trendFilteredSummaries = filteredSummaries.filter(c => {
        const isUp = (c.pctChange !== null && c.pctChange > 0) || (c.pctChange === null && c.delta !== null && c.delta > 0);
        const isDown = (c.pctChange !== null && c.pctChange < 0) || (c.pctChange === null && c.delta !== null && c.delta < 0);
        const isStagnant = (c.pctChange !== null && c.pctChange === 0) || (c.pctChange === null && c.delta !== null && c.delta === 0);
        const isEmpty = (c.pctChange === null && c.delta === null);

        if (isUp && tsInsightSelectedTrends.has('up')) return true;
        if (isDown && tsInsightSelectedTrends.has('down')) return true;
        if (isStagnant && tsInsightSelectedTrends.has('stagnant')) return true;
        if (isEmpty && tsInsightSelectedTrends.has('empty')) return true;
        return false;
    });

    // Populate Ranking Table Count
    if (countEl) {
        const nRincian = trendFilteredRankable.length;
        const nSummary = trendFilteredSummaries.length;
        let suffix = 'Rincian Terdaftar';
        const sel = tsInsightSelectedTrends.size;
        if (sel === 2 && tsInsightSelectedTrends.has('up') && tsInsightSelectedTrends.has('down')) suffix = 'Rincian Naik & Turun';
        else if (sel === 1 && tsInsightSelectedTrends.has('up')) suffix = 'Rincian Mengalami Kenaikan';
        else if (sel === 1 && tsInsightSelectedTrends.has('down')) suffix = 'Rincian Mengalami Penurunan';
        else if (sel === 1 && tsInsightSelectedTrends.has('stagnant')) suffix = 'Rincian Stagnan/Tetap';

        if (nSummary > 0) {
            countEl.textContent = `${nRincian} ${suffix} + ${nSummary} Total Ringkasan`;
        } else {
            countEl.textContent = `${nRincian} ${suffix}`;
        }
    }

    if (tbody) {
        if (trendFilteredRankable.length === 0 && trendFilteredSummaries.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-muted">Tidak ada rincian data yang sesuai dengan filter saat ini. Silakan centang rincian wilayah pada filter di atas.</td></tr>`;
            return;
        }

        let tableRowsHtml = '';
        let rankNum = 1;

        // Render sorted rankable items
        trendFilteredRankable.forEach(item => {
            const startFmt = item.startVal !== null ? formatWithUnitScale(item.startVal, unitConfig) : '-';
            const endFmt = item.endVal !== null ? formatWithUnitScale(item.endVal, unitConfig) : '-';
            const deltaFmt = item.delta !== null ? ((item.delta >= 0 ? '+' : '') + formatWithUnitScale(item.delta, unitConfig)) : '-';
            
            let pctBadge = '<span class="badge bg-light text-muted border px-2 py-0.5" style="font-size:0.75rem;" title="Data tidak lengkap pada rentang tahun ini">-</span>';
            if (item.pctChange !== null) {
                const isPos = item.pctChange > 0;
                const isNeg = item.pctChange < 0;
                const badgeClass = isPos ? 'bg-success-subtle text-success border-success-subtle' : (isNeg ? 'bg-danger-subtle text-danger border-danger-subtle' : 'bg-secondary-subtle text-secondary');
                const icon = isPos ? '▲ +' : (isNeg ? '▼ ' : '');
                const pctFormatted = item.pctChange.toFixed(2).replace('.', ',');
                pctBadge = `<span class="badge ${badgeClass} border px-2 py-1 fw-bold" style="font-size:0.76rem;">${icon}${pctFormatted}%</span>`;
            }

            tableRowsHtml += `
                <tr>
                    <td style="text-align:center; font-weight:600; color:var(--text-secondary, #64748b);">${rankNum++}</td>
                    <td class="fw-medium text-dark">${escHtml(item.entity)}</td>
                    <td style="text-align:right; font-variant-numeric:tabular-nums;">${startFmt}</td>
                    <td style="text-align:right; font-variant-numeric:tabular-nums; font-weight:600;">${endFmt}</td>
                    <td style="text-align:right; font-variant-numeric:tabular-nums; color:${item.delta > 0 ? cssVar('--success-emerald') || '#10b981' : (item.delta < 0 ? cssVar('--danger') || '#ef4444' : cssVar('--text-secondary') || '#64748b')}; font-weight:600;">${deltaFmt}</td>
                    <td style="text-align:right;">${pctBadge}</td>
                </tr>
            `;
        });

        // Summary items at bottom (e.g. Kabupaten Tasikmalaya)
        trendFilteredSummaries.forEach(item => {
            const startFmt = item.startVal !== null ? formatWithUnitScale(item.startVal, unitConfig) : '-';
            const endFmt = item.endVal !== null ? formatWithUnitScale(item.endVal, unitConfig) : '-';
            const deltaFmt = item.delta !== null ? ((item.delta >= 0 ? '+' : '') + formatWithUnitScale(item.delta, unitConfig)) : '-';
            
            let pctBadge = '-';
            if (item.pctChange !== null) {
                const isPos = item.pctChange > 0;
                const isNeg = item.pctChange < 0;
                const badgeClass = isPos ? 'bg-success-subtle text-success border-success-subtle' : (isNeg ? 'bg-danger-subtle text-danger border-danger-subtle' : 'bg-secondary-subtle text-secondary');
                const icon = isPos ? '▲ +' : (isNeg ? '▼ ' : '');
                const pctFormatted = item.pctChange.toFixed(2).replace('.', ',');
                pctBadge = `<span class="badge ${badgeClass} border px-2 py-1 fw-bold" style="font-size:0.76rem;">${icon}${pctFormatted}%</span>`;
            }

            tableRowsHtml += `
                <tr class="table-light fw-bold" style="background:#f1f5f9;">
                    <td style="text-align:center; color:#3b82f6;">★</td>
                    <td class="fw-bold text-dark">${escHtml(item.entity)} <span class="badge bg-secondary-subtle text-secondary ms-1" style="font-size:0.68rem;">Total</span></td>
                    <td style="text-align:right; font-variant-numeric:tabular-nums;">${startFmt}</td>
                    <td style="text-align:right; font-variant-numeric:tabular-nums; font-weight:700;">${endFmt}</td>
                    <td style="text-align:right; font-variant-numeric:tabular-nums; color:${item.delta > 0 ? cssVar('--success-emerald') || '#10b981' : (item.delta < 0 ? cssVar('--danger') || '#ef4444' : cssVar('--text-secondary') || '#64748b')}; font-weight:700;">${deltaFmt}</td>
                    <td style="text-align:right;">${pctBadge}</td>
                </tr>
            `;
        });

        tbody.innerHTML = tableRowsHtml;
    }
}



function renderTimeSeriesSourcesLineage(checkedKeys) {

    const tbody = document.getElementById('ts-sources-lineage-body');

    if (!tbody) return;

    tbody.innerHTML = '';

    if (!currentTimeSeriesData || !currentTimeSeriesData.sourcesMap) {

        tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-3">Belum ada data sumber yang dimuat.</td></tr>`;

        return;

    }



    const sourcesMap = currentTimeSeriesData.sourcesMap;

    const years = currentTimeSeriesData.years || [];

    const checked = (checkedKeys && checkedKeys.length > 0) ? checkedKeys : (currentTimeSeriesData.valueKeys || []);



    const rows = [];

    years.forEach(y => {

        checked.forEach(vk => {

            const s = sourcesMap[`${y}::${vk}`];

            if (s) {

                rows.push({

                    year: y,

                    indicator: vk,

                    ...s

                });

            }

        });

    });



    if (rows.length === 0) {

        tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-3">Tidak ada data sumber untuk indikator yang dipilih.</td></tr>`;

        return;

    }



    tbody.innerHTML = rows.map(r => {

        const tn = (r.table_name || '').replace(/'/g, "\\'");

        const docLabel = r.doc_year ? `Tahun ${r.doc_year} <span class="text-muted small">(${escHtml(r.doc_filename || 'PDF')})</span>` : escHtml(r.doc_filename || '-');

        return `<tr>

            <td style="text-align:center;"><span class="badge bg-primary text-white font-monospace">${r.year}</span></td>

            <td><span class="fw-semibold text-dark">${escHtml(r.indicator)}</span></td>

            <td><span class="badge bg-light text-secondary border px-2 py-1">${docLabel}</span></td>

            <td><span class="text-truncate d-inline-block" style="max-width:320px;" title="${escHtml(formatCleanTableName(r.table_name) || r.table_name || '')}">${escHtml(formatCleanTableName(r.table_name) || '-')}</span></td>

            <td><code style="background:#f1f5f9; color:var(--text-secondary, #475569); padding:2px 6px; border-radius:4px; font-size:0.8rem;">${escHtml(r.raw_col || '-')}</code></td>

            <td style="text-align:center;">

                <button class="btn btn-xs btn-outline-primary" style="padding:2px 8px; font-size:0.75rem;" onclick="previewCsv(${r.table_id}, '${tn}')" title="Buka dan periksa tabel ini di editor">

                    <i class="bi bi-box-arrow-up-right"></i> Buka Tabel

                </button>

            </td>

        </tr>`;

    }).join('');

}



function showSourceLineageDetail(year, indicator, tableId, tableName, docYear, docFilename, rawCol) {

    const isDark = document.body.classList.contains('dark-mode') || document.documentElement.getAttribute('data-bs-theme') === 'dark';

    const tn = (tableName || '').replace(/'/g, "\\'");

    const cardBg = isDark ? cssVar('--text-primary') || '#1e293b' : cssVar('--bg-page') || '#f8fafc';

    const cardBorder = isDark ? cssVar('--text-tertiary') || '#334155' : cssVar('--border') || '#e2e8f0';

    const textDark = isDark ? cssVar('--bg-page') || '#f8fafc' : cssVar('--text-primary') || '#1e293b';

    const textMuted = isDark ? cssVar('--text-light') || '#94a3b8' : cssVar('--text-secondary') || '#64748b';

    const codeBg = isDark ? 'rgba(37, 99, 235, 0.25)' : cssVar('--primary-faint') || '#eff6ff';

    const codeColor = isDark ? cssVar('--primary-light') || '#93c5fd' : cssVar('--primary') || '#1d4ed8';



    Swal.fire({

        title: '<i class="bi bi-diagram-3-fill text-primary me-2"></i> Asal Sumber Data',

        html: `

            <div style="text-align:left; font-size:0.88rem; line-height:1.6; padding:4px;">

                <div style="background:${cardBg}; border:1px solid ${cardBorder}; border-radius:10px; padding:12px 14px; margin-bottom:14px;">

                    <div style="margin-bottom:6px; color:${textDark};"><b>Tahun Data:</b> <span class="badge bg-primary ms-1">${escHtml(year)}</span></div>

                    <div style="color:${textDark};"><b>Indikator:</b> <span class="fw-semibold" style="color:${textDark};">${escHtml(indicator)}</span></div>

                </div>

                <div style="display:flex; flex-direction:column; gap:10px;">

                    <div>
                        <label style="font-size:0.75rem; font-weight:700; color:${textMuted}; text-transform:uppercase; display:block; margin-bottom:2px;">Publikasi Asal (BPS):</label>
                        <div style="font-weight:600; color:${textDark};">Kabupaten Tasikmalaya Dalam Angka <span style="font-weight:400; color:${textMuted};">(${escHtml(docYear || year || '-')})</span></div>
                    </div>
                    <div>
                        <label style="font-size:0.75rem; font-weight:700; color:${textMuted}; text-transform:uppercase; display:block; margin-bottom:4px;">Tabel Asal:</label>
                        <div style="font-weight:600; color:${textDark};">${renderCleanTableTitleHtml(tableName || '-')}</div>
                    </div>
                    <div>
                        <label style="font-size:0.75rem; font-weight:700; color:${textMuted}; text-transform:uppercase; display:block; margin-bottom:2px;"><i class="bi bi-layout-three-columns text-primary me-1"></i> Kolom Asli di Tabel:</label>
                        <div><code style="background:${codeBg}; color:${codeColor}; padding:4px 10px; border-radius:6px; font-weight:600; font-size:0.85rem;">${escHtml((rawCol && rawCol !== '-' && rawCol !== 'undefined') ? rawCol : indicator)}</code></div>
                    </div>
                </div>

            </div>

        `,

        showCancelButton: true,

        cancelButtonText: 'Tutup',

        confirmButtonText: '<i class="bi bi-box-arrow-up-right me-1"></i> Buka Tabel Asal di Editor',

        confirmButtonColor: cssVar('--info') || '#3b82f6',

        cancelButtonColor: isDark ? cssVar('--text-tertiary') || '#334155' : cssVar('--border') || '#e2e8f0',

        backdrop: 'rgba(15, 23, 42, 0.65)'

    }).then((res) => {

        if (res.isConfirmed && tableId) {

            previewCsv(tableId, tableName);

        }

    });

}



function backToTablePicker() {

    tsHiddenEntities.clear();

    tsRenderCallback = null;

    tsOriginalTablesData = null;

    tsCurrentSubType = 'Semua';

    tsCurrentKeyword = '';

    tsSavedVKChecks = null;

    if (timeSeriesChartInstance) {

        timeSeriesChartInstance.destroy();

        timeSeriesChartInstance = null;

    }

    if (timeSeriesChartYAxisInstance) {

        timeSeriesChartYAxisInstance.destroy();

        timeSeriesChartYAxisInstance = null;

    }

    if (timeSeriesChart2Instance) {

        timeSeriesChart2Instance.destroy();

        timeSeriesChart2Instance = null;

    }

    if (timeSeriesChart3Instance) {

        timeSeriesChart3Instance.destroy();

        timeSeriesChart3Instance = null;

    }

    document.getElementById("ts-results-content").style.display = "none";

    const resultTitleEl = document.getElementById("ts-result-title");
    if (resultTitleEl) resultTitleEl.style.display = "none";

    const badgesOutsideEl = document.getElementById("ts-result-badges-outside");
    if (badgesOutsideEl) { badgesOutsideEl.innerHTML = ''; badgesOutsideEl.style.display = 'none'; }

    const dataControlCard = document.getElementById('ts-data-control-card');
    if (dataControlCard) dataControlCard.style.display = 'none';

    const chartControlCard = document.getElementById('ts-chart-control-card');
    if (chartControlCard) chartControlCard.style.display = 'none';

    toggleTimeSeriesInsights(false);

    const pickerEl = document.getElementById("ts-table-picker");

    if (pickerEl) pickerEl.style.display = "block";

}



function _getTimeSeriesFileName(ext) {

    if (!currentTimeSeriesData) {

        return `Deret_Waktu_BPS_${new Date().toISOString().slice(0, 10)}.${ext}`;

    }

    const { years, valueKeys } = currentTimeSeriesData;

    

    // Format nama indikator/kolom yang diunduh

    let cleanNames = (valueKeys || []).map(vk => {

        return String(vk)

            .replace(/[\\/:*?"<>|]/g, '')

            .trim()

            .replace(/\s+/g, '_')

            .replace(/_+/g, '_');

    }).filter(Boolean);

    

    let indPart = cleanNames.join('__');

    if (indPart.length > 60) {

        indPart = indPart.substring(0, 60).replace(/_+$/, '');

    }

    if (!indPart) indPart = 'Deret_Waktu';

    

    // Format rentang tahun

    let yearPart = '';

    if (years && years.length > 0) {

        const sortedY = [...years].map(Number).filter(n => !isNaN(n)).sort((a, b) => a - b);

        if (sortedY.length > 1) {

            yearPart = `_${sortedY[0]}-${sortedY[sortedY.length - 1]}`;

        } else if (sortedY.length === 1) {

            yearPart = `_${sortedY[0]}`;

        }

    }

    

    return `Deret_Waktu_${indPart}${yearPart}.${ext}`;

}



async function exportTimeSeriesExcel() {

    if (!currentTimeSeriesData) {

        showToast('error', 'Error', 'Tidak ada data deret waktu untuk diekspor.');

        return;

    }

    

    const { years, valueKeys, entityMap, vkUnits } = currentTimeSeriesData;

    const allEntities = _sortEntitiesWithKabLast(Object.keys(entityMap));

    const entities = allEntities.filter(ent => !tsHiddenEntities.has(ent));

    

    // Scale data and units according to active unit converter

    let activeVkUnits = { ...(vkUnits || {}) };

    let activeEntityMap = JSON.parse(JSON.stringify(entityMap));



    valueKeys.forEach(vk => {

        const vkUnit = (vkUnits && vkUnits[vk]) || '';

        const unitConfig = getUnitConfigForVK(vk);

        if (unitConfig) {

            activeVkUnits[vk] = unitConfig.label;

            entities.forEach(ent => {

                years.forEach(y => {

                    const rawVal = activeEntityMap[ent]?.[y]?.[vk];

                    if (rawVal != null && rawVal !== '-' && rawVal !== '...' && rawVal !== '') {

                        const rawNum = parseIndoNumberToFloat(rawVal);

                        if (rawNum !== null && !isNaN(rawNum)) {

                            activeEntityMap[ent][y][vk] = formatWithUnitScale(rawNum, unitConfig);

                        }

                    }

                });

            });

        }

    });



    showToast('info', 'Mengekspor...', 'Menyiapkan file Excel (.xlsx) rapi & auto-width...', 2000);

    

    try {

        const res = await fetch(`${API_BASE}/timeseries/export-excel`, {

            method: 'POST',

            headers: { 'Content-Type': 'application/json' },

            body: JSON.stringify({

                years: years,

                valueKeys: valueKeys,

                vkUnits: activeVkUnits,

                entities: entities,

                entityMap: activeEntityMap

            })

        });

        

        if (!res.ok) {

            const err = await res.json().catch(() => ({}));

            throw new Error(err.detail || 'Gagal mengekspor data ke Excel');

        }

        

        const blob = await res.blob();

        const url = window.URL.createObjectURL(blob);

        const a = document.createElement('a');

        a.href = url;

        a.download = _getTimeSeriesFileName('xlsx');

        document.body.appendChild(a);

        a.click();

        document.body.removeChild(a);

        window.URL.revokeObjectURL(url);

        showToast('success', 'Berhasil', 'File Excel (.xlsx) berhasil diunduh.');

    } catch (err) {

        console.error("Export Excel error:", err);

        showToast('error', 'Gagal Ekspor', err.message);

    }

}



function exportTimeSeriesCSV() {

    if (!currentTimeSeriesData) return;

    

    const { years, valueKeys, entityMap, vkUnits } = currentTimeSeriesData;

    const allEntities = _sortEntitiesWithKabLast(Object.keys(entityMap));

    const sortedEntities = allEntities.filter(ent => !tsHiddenEntities.has(ent));

    

    let activeVkUnits = { ...(vkUnits || {}) };

    let activeEntityMap = JSON.parse(JSON.stringify(entityMap));



    valueKeys.forEach(vk => {

        const vkUnit = (vkUnits && vkUnits[vk]) || '';

        const unitConfig = getUnitConfigForVK(vk);

        if (unitConfig) {

            activeVkUnits[vk] = unitConfig.label;

            sortedEntities.forEach(ent => {

                years.forEach(y => {

                    const rawVal = activeEntityMap[ent]?.[y]?.[vk];

                    if (rawVal != null && rawVal !== '-' && rawVal !== '...' && rawVal !== '') {

                        const rawNum = parseIndoNumberToFloat(rawVal);

                        if (rawNum !== null && !isNaN(rawNum)) {

                            activeEntityMap[ent][y][vk] = formatWithUnitScale(rawNum, unitConfig);

                        }

                    }

                });

            });

        }

    });



    let rows = [];

    

    // Baris 1: Tahun

    let row1 = ["Rincian"];

    years.forEach(y => {

        row1.push(y);

        for (let i = 1; i < valueKeys.length; i++) row1.push("");

    });

    rows.push(row1.map(c => `"${String(c).replace(/"/g, '""')}"`).join(","));

    

    // Baris 2: Metrik

    let row2 = [""];

    years.forEach(() => {

        valueKeys.forEach(vk => {

            var unitSuffix = activeVkUnits && activeVkUnits[vk] ? ' (' + activeVkUnits[vk] + ')' : '';

            row2.push(`"${(vk + unitSuffix).replace(/"/g, '""')}"`);

        });

    });

    rows.push(row2.join(","));

    

    // Baris Data

    sortedEntities.forEach(ent => {

        let r = [`"${String(ent).replace(/"/g, '""')}"`];

        years.forEach(y => {

            const yearData = activeEntityMap[ent][y] || {};

            valueKeys.forEach(vk => {

                const val = yearData[vk] !== undefined && yearData[vk] !== null ? yearData[vk] : "-";

                r.push(`"${String(val).replace(/"/g, '""')}"`);

            });

        });

        rows.push(r.join(","));

    });

    

    // Sisipkan UTF-8 BOM dan deklarasi 'sep=,' agar Microsoft Excel otomatis memisahkan kolom ke kolom A, B, C, dst.

    const csvString = "\ufeffsep=,\r\n" + rows.join("\r\n");

    const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });

    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");

    link.setAttribute("href", url);

    link.setAttribute("download", _getTimeSeriesFileName('csv'));

    document.body.appendChild(link);

    link.click();

    document.body.removeChild(link);

    URL.revokeObjectURL(url);

}



// ==========================================

// FITUR EKSPOR KUSTOM PDF & PNG (TIME SERIES)

// ==========================================



function selectExportFormat(format) {

    const radioPdf = document.getElementById('ts-export-radio-pdf');

    const radioPng = document.getElementById('ts-export-radio-png');

    const cardPdf = document.getElementById('ts-export-card-pdf');

    const cardPng = document.getElementById('ts-export-card-png');

    const pdfOpts = document.getElementById('ts-export-pdf-options');



    if (format === 'pdf') {

        if (radioPdf) radioPdf.checked = true;

        if (cardPdf) cardPdf.classList.add('active');

        if (cardPng) cardPng.classList.remove('active');

        if (pdfOpts) pdfOpts.style.display = 'block';

    } else {

        if (radioPng) radioPng.checked = true;

        if (cardPng) cardPng.classList.add('active');

        if (cardPdf) cardPdf.classList.remove('active');

        if (pdfOpts) pdfOpts.style.display = 'none';

    }

}



function applyExportPreset(presetType) {

    const cbChart = document.getElementById('ts-export-opt-chart');

    const cbTable = document.getElementById('ts-export-opt-table');

    const cbInsights = document.getElementById('ts-export-opt-insights');



    if (presetType === 'all') {

        if (cbChart) cbChart.checked = true;

        if (cbTable) cbTable.checked = true;

        if (cbInsights) cbInsights.checked = true;

    } else if (presetType === 'chart') {

        if (cbChart) cbChart.checked = true;

        if (cbTable) cbTable.checked = false;

        if (cbInsights) cbInsights.checked = false;

    } else if (presetType === 'table') {

        if (cbChart) cbChart.checked = false;

        if (cbTable) cbTable.checked = true;

        if (cbInsights) cbInsights.checked = false;

    } else if (presetType === 'chart_insights') {

        if (cbChart) cbChart.checked = true;

        if (cbTable) cbTable.checked = false;

        if (cbInsights) cbInsights.checked = true;

    }



    // Update active visual status on preset buttons
    const container = document.getElementById('ts-export-preset-container');
    if (container) {
        container.querySelectorAll('.ts-export-preset-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.preset === presetType);
        });
    }
}

function syncExportPresetState() {
    const cbChart = document.getElementById('ts-export-opt-chart')?.checked ?? false;
    const cbTable = document.getElementById('ts-export-opt-table')?.checked ?? false;
    const cbInsights = document.getElementById('ts-export-opt-insights')?.checked ?? false;

    let matchedPreset = '';
    if (cbChart && cbTable && cbInsights) {
        matchedPreset = 'all';
    } else if (cbChart && !cbTable && !cbInsights) {
        matchedPreset = 'chart';
    } else if (!cbChart && cbTable && !cbInsights) {
        matchedPreset = 'table';
    } else if (cbChart && !cbTable && cbInsights) {
        matchedPreset = 'chart_insights';
    }

    const container = document.getElementById('ts-export-preset-container');
    if (container) {
        container.querySelectorAll('.ts-export-preset-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.preset === matchedPreset);
        });
    }
}



function toggleInsightsSuboptions(show) {

    const sub = document.getElementById('ts-export-insights-suboptions');

    if (sub) sub.style.display = show ? 'flex' : 'none';

}



function openTimeSeriesExportModal() {

    if (!currentTimeSeriesData || !currentTimeSeriesData.years || currentTimeSeriesData.years.length === 0) {

        showToast('warning', 'Perhatian', 'Tidak ada data deret waktu yang siap untuk diekspor.');

        return;

    }

    const modalEl = document.getElementById('modal-ts-export-custom');

    if (modalEl) {

        const modal = bootstrap.Modal.getOrCreateInstance(modalEl);

        modal.show();

    }

}



async function executeTimeSeriesExport() {

    if (!currentTimeSeriesData) return;



    const optChart = document.getElementById('ts-export-opt-chart')?.checked ?? true;

    const optTable = document.getElementById('ts-export-opt-table')?.checked ?? true;

    const optInsights = document.getElementById('ts-export-opt-insights')?.checked ?? true;

    const insightsScope = document.querySelector('input[name="ts-export-insights-scope"]:checked')?.value || 'both';

    const format = document.querySelector('input[name="ts-export-format"]:checked')?.value || 'pdf';

    const orientation = document.getElementById('ts-export-pdf-orientation')?.value || 'landscape';

    const includeHeader = document.getElementById('ts-export-include-header')?.checked ?? true;



    if (!optChart && !optTable && !optInsights) {

        showToast('warning', 'Peringatan', 'Silakan pilih minimal satu komponen (Grafik, Tabel, atau Tren) untuk diekspor.');

        return;

    }



    // Hide modal

    const modalEl = document.getElementById('modal-ts-export-custom');

    if (modalEl) {

        const modal = bootstrap.Modal.getInstance(modalEl);

        if (modal) modal.hide();

    }



    Swal.fire({

        title: 'Menyiapkan Dokumen...',

        text: `Memproses ekspor ${format.toUpperCase()} resolusi tinggi dengan komponen terpilih...`,

        allowOutsideClick: false,

        didOpen: () => { Swal.showLoading(); }

    });



    try {

        const { years, valueKeys, entityMap, vkUnits } = currentTimeSeriesData;

        const allEntities = _sortEntitiesWithKabLast(Object.keys(entityMap));

        const entities = allEntities.filter(ent => !tsHiddenEntities.has(ent));

        const cbs = document.querySelectorAll('.ts-vk-cb:checked');

        const checkedVKs = Array.from(cbs).map(cb => cb.dataset.vk);

        const activeVKs = checkedVKs.length > 0 ? checkedVKs : valueKeys;



        const firstVk = activeVKs[0];

        const vkUnit = (vkUnits && vkUnits[firstVk]) || '';

        const unitConfig = getUnitConfigForVK(firstVk);

        const unitLabel = unitConfig ? unitConfig.label : (vkUnit || '-');



        const now = new Date();

        const dateStr = now.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });

        const keywordTitle = tsCurrentKeyword ? tsCurrentKeyword.toUpperCase() : 'ANALISIS DERET WAKTU';

        const yearPeriodStr = years.length > 1 ? `Periode: ${years[0]} – ${years[years.length - 1]} (${years.length} Tahun)` : `Tahun: ${years[0]}`;



        // Ensure insights data is fresh

        if (optInsights && typeof computeAndRenderTimeSeriesInsights === 'function') {

            try { computeAndRenderTimeSeriesInsights(); } catch (e) { console.warn("Auto compute insights error:", e); }

        }



        // Ekstraksi gambar grafik beresolusi tinggi terlebih dahulu (jika optChart dipilih)
        const chartImages = [];
        if (optChart) {
            const chartConfigs = [
                { canvasId: 'timeSeriesChart', containerId: 'ts-chart-container', title: activeVKs[0] },
                { canvasId: 'timeSeriesChart2', containerId: 'ts-chart-container-2', title: activeVKs[1] },
                { canvasId: 'timeSeriesChart3', containerId: 'ts-chart-container-3', title: activeVKs[2] }
            ];

            for (const c of chartConfigs) {
                const cont = document.getElementById(c.containerId);
                if (cont && cont.style.display !== 'none') {
                    try {
                        const canvas = document.getElementById(c.canvasId);
                        if (!canvas) continue;

                        let dataUrl = null;
                        const originalChart = (window.Chart && Chart.getChart(canvas)) || (window.timeSeriesCharts && window.timeSeriesCharts[c.canvasId]);

                        if (originalChart && originalChart.data && originalChart.data.datasets) {
                            try {
                                const offCanvas = document.createElement('canvas');
                                offCanvas.width = 1100;
                                offCanvas.height = 460;
                                const offCtx = offCanvas.getContext('2d');

                                offCtx.fillStyle = '#ffffff';
                                offCtx.fillRect(0, 0, 1100, 460);

                                const clonedDatasets = (originalChart.data.datasets || []).map(ds => {
                                    const isHidden = ds.hidden || tsHiddenEntities.has(ds.entity || ds.label);
                                    return {
                                        ...ds,
                                        hidden: isHidden,
                                        borderWidth: (ds.borderWidth || 2) + 0.5,
                                        pointRadius: (ds.pointRadius || 3) + 1
                                    };
                                });

                                const origYScale = (originalChart.options.scales && originalChart.options.scales.y) || {};
                                const yTitleText = (origYScale.title && origYScale.title.text) || unitLabel || '';

                                const tempChart = new Chart(offCtx, {
                                    type: originalChart.config.type || 'line',
                                    data: {
                                        labels: originalChart.data.labels || [],
                                        datasets: clonedDatasets
                                    },
                                    options: {
                                        responsive: false,
                                        animation: false,
                                        plugins: {
                                            legend: {
                                                display: true,
                                                position: 'bottom',
                                                labels: {
                                                    boxWidth: 12,
                                                    boxHeight: 12,
                                                    font: { family: 'Inter, sans-serif', size: 11, weight: '600' },
                                                    color: '#334155',
                                                    padding: 10,
                                                    filter: function(item, chartData) {
                                                        const ds = chartData.datasets[item.datasetIndex];
                                                        return !(ds && ds.hidden);
                                                    }
                                                }
                                            },
                                            tooltip: { enabled: false }
                                        },
                                        scales: {
                                            x: {
                                                grid: { display: false },
                                                ticks: {
                                                    font: { family: 'Inter, sans-serif', size: 11, weight: '500' },
                                                    color: '#475569',
                                                    maxRotation: 45,
                                                    minRotation: 0
                                                }
                                            },
                                            y: {
                                                beginAtZero: true,
                                                grace: '8%',
                                                grid: { color: '#f1f5f9' },
                                                title: {
                                                    display: !!yTitleText,
                                                    text: yTitleText,
                                                    font: { family: 'Inter, sans-serif', size: 11, weight: '600' },
                                                    color: '#64748b'
                                                },
                                                ticks: {
                                                    font: { family: 'Inter, sans-serif', size: 10 },
                                                    color: '#64748b',
                                                    callback: function(v) {
                                                        if (v >= 1e6) return (v / 1e6).toFixed(1) + 'jt';
                                                        if (v >= 1e3) return (v / 1e3).toFixed(v >= 1e4 ? 0 : 1) + 'rb';
                                                        return v;
                                                    }
                                                }
                                            }
                                        }
                                    }
                                });

                                dataUrl = offCanvas.toDataURL('image/png', 1.0);
                                tempChart.destroy();
                            } catch (renderErr) {
                                console.warn('Offscreen chart render fallback:', renderErr);
                            }
                        }

                        if (!dataUrl) {
                            dataUrl = canvas.toDataURL('image/png', 1.0);
                        }

                        if (dataUrl && dataUrl.length > 100) {
                            chartImages.push({ title: c.title, dataUrl });
                        }
                    } catch (err) {
                        console.error('Error capturing chart canvas:', err);
                    }
                }
            }
        }

        const fileNameBase = _getTimeSeriesFileName('pdf').replace(/\.pdf$/i, '');

        if (format === 'png') {
            // PNG Download: buat kontainer kontinu sederhana untuk snapshot gambar utuh
            const pngContainer = document.createElement('div');
            pngContainer.id = 'ts-export-png-report';
            pngContainer.style.cssText = 'position:fixed; left:-99999px; top:0; width:1200px; background:#ffffff; color:#1e293b; font-family:"Inter", -apple-system, BlinkMacSystemFont, sans-serif; padding:32px 36px; box-sizing:border-box; z-index:-1000;';

            let pngHtml = '';
            if (includeHeader) {
                pngHtml += `
                    <div style="display:flex; align-items:center; justify-content:space-between; border-bottom:1.5px solid #cbd5e1; padding-bottom:12px; margin-bottom:20px;">
                        <div style="display:flex; align-items:center; gap:12px;">
                            <img src="/static/logo_sipedas.png" alt="SIPEDAS" style="height:36px; width:auto; object-fit:contain;">
                            <div>
                                <div style="font-size:13px; font-weight:800; color:#0f2b5c;">SIPEDAS <span style="font-weight:600; color:#475569;">— Sistem Integrasi, Pencarian, dan Analisis Data Statistik</span></div>
                                <div style="font-size:11px; font-weight:800; color:#1e293b; text-transform:uppercase; margin-top:2px;">Badan Pusat Statistik Kabupaten Tasikmalaya</div>
                            </div>
                        </div>
                    </div>
                `;
            }

            // Kartu Ringkasan
            pngHtml += `
                <div style="background:#f8fafc; border:1px solid #bfdbfe; border-radius:10px; padding:16px 20px; margin-bottom:20px;">
                    <div style="font-size:11px; font-weight:800; color:#2563eb; text-transform:uppercase; letter-spacing:1px; margin-bottom:4px;">Laporan Analisis Deret Waktu</div>
                    <div style="font-size:18px; font-weight:900; color:#0f172a; margin-bottom:6px;">${escHtml(keywordTitle)}</div>
                    <div style="font-size:12px; color:#475569;">${escHtml(yearPeriodStr)} \u2022 Satuan: <b>${escHtml(unitLabel)}</b></div>
                </div>
            `;

            if (optChart && chartImages.length > 0) {
                pngHtml += `<div style="margin-bottom:24px;">`;
                chartImages.forEach(c => {
                    pngHtml += `
                        <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:8px; padding:14px; margin-bottom:16px; text-align:center;">
                            ${c.title ? `<div style="font-size:13px; font-weight:700; text-align:left; margin-bottom:10px;">${escHtml(c.title)}</div>` : ''}
                            <img src="${c.dataUrl}" style="width:100%; max-width:1100px; height:auto; display:block; margin:0 auto; border-radius:6px;">
                        </div>
                    `;
                });
                pngHtml += `</div>`;
            }

            pngContainer.innerHTML = pngHtml;
            document.body.appendChild(pngContainer);

            await new Promise(r => setTimeout(r, 200));

            const canvas = await html2canvas(pngContainer, {
                scale: 2,
                backgroundColor: '#ffffff',
                useCORS: true,
                logging: false
            });

            canvas.toBlob(blob => {
                if (!blob) throw new Error('Gagal membuat berkas gambar PNG');
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${fileNameBase}.png`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                if (pngContainer && pngContainer.parentNode) {
                    pngContainer.parentNode.removeChild(pngContainer);
                }
                Swal.close();
                showToast('success', 'Berhasil', 'Gambar grafik & data (.png) berhasil diunduh.');
            }, 'image/png');

        } else {
            // =========================================================================
            // PDF GENERATION: DETERMINISTIC PAGE-BASED LAYOUT ENGINE (A4 PRINT READY)
            // =========================================================================
            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF({ orientation, unit: 'pt', format: 'a4' });

            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            const isLandscape = (orientation === 'landscape');

            // Tetapkan rasio piksel presisi yang sinkron 1:1 dengan rasio A4
            const pagePxW = isLandscape ? 1190 : 842;
            const pagePxH = isLandscape ? 841 : 1191;

            // Wadah offscreen terisolasi
            const stagingContainer = document.createElement('div');
            stagingContainer.id = 'ts-export-staging';
            stagingContainer.style.cssText = 'position:fixed; left:-99999px; top:0; z-index:-1000; font-family:"Inter", -apple-system, BlinkMacSystemFont, sans-serif;';
            document.body.appendChild(stagingContainer);

            const pageElements = [];

            // Tinggi area konten efektif per halaman
            const paddingVertical = 56; // 22px top + 34px bottom
            const runningHeaderH = includeHeader ? 54 : 0;
            const usableContentH = pagePxH - paddingVertical - runningHeaderH;

            // Factory Pembuat Halaman Konten
            function createContentPage(pageNum) {
                const page = document.createElement('div');
                page.className = 'ts-pdf-page';
                page.style.cssText = `width:${pagePxW}px; height:${pagePxH}px; max-height:${pagePxH}px; padding:22px 32px 34px 32px; box-sizing:border-box; background:#ffffff; position:relative; overflow:hidden; display:flex; flex-direction:column;`;

                if (includeHeader) {
                    const hdr = document.createElement('div');
                    hdr.className = 'ts-pdf-running-header';
                    hdr.style.cssText = 'display:flex; align-items:center; justify-content:space-between; border-bottom:1.5px solid #cbd5e1; padding-bottom:8px; margin-bottom:14px; flex-shrink:0;';
                    hdr.innerHTML = `
                        <div style="display:flex; align-items:center; gap:10px;">
                            <img src="/static/logo_sipedas.png" alt="SIPEDAS" style="height:32px; width:auto; object-fit:contain;">
                            <div>
                                <div style="font-size:12px; font-weight:800; color:#0f2b5c; letter-spacing:0.3px; font-family:'Inter', sans-serif;">
                                    SIPEDAS <span style="font-weight:600; color:#475569;">— Sistem Integrasi, Pencarian, dan Analisis Data Statistik</span>
                                </div>
                                <div style="font-size:10px; font-weight:800; color:#1e293b; text-transform:uppercase; letter-spacing:0.5px; margin-top:1px; font-family:'Inter', sans-serif;">
                                    Badan Pusat Statistik Kabupaten Tasikmalaya
                                </div>
                            </div>
                        </div>
                        <div style="font-size:9.5px; font-weight:700; color:#2563eb; background:#eff6ff; padding:3px 10px; border-radius:4px; border:1px solid #bfdbfe;">
                            ${escHtml(keywordTitle)}
                        </div>
                    `;
                    page.appendChild(hdr);
                }

                const body = document.createElement('div');
                body.className = 'ts-pdf-content-body';
                body.style.cssText = 'flex:1 1 auto; display:flex; flex-direction:column; overflow:hidden;';
                page.appendChild(body);

                const ftr = document.createElement('div');
                ftr.className = 'ts-pdf-page-footer';
                ftr.style.cssText = 'position:absolute; bottom:12px; left:32px; right:32px; display:flex; justify-content:space-between; align-items:center; font-size:9px; color:#94a3b8; border-top:1px solid #f1f5f9; padding-top:6px;';
                ftr.innerHTML = `
                    <div>SIPEDAS BPS Kabupaten Tasikmalaya</div>
                    <div class="ts-pdf-page-number">Halaman ${pageNum}</div>
                `;
                page.appendChild(ftr);

                return page;
            }

            // =========================================================================
            // 1. HALAMAN 1: SAMPUL RESMI MANDIRI (DEDICATED FULL COVER PAGE)
            // =========================================================================
            const coverPage = document.createElement('div');
            coverPage.className = 'ts-pdf-page';
            coverPage.style.cssText = `width:${pagePxW}px; height:${pagePxH}px; max-height:${pagePxH}px; padding:32px 36px; box-sizing:border-box; background:#ffffff; position:relative; overflow:hidden; display:flex; flex-direction:column; justify-content:center; align-items:center;`;
            coverPage.innerHTML = `
                <div style="width:100%; max-width:${isLandscape ? '820px' : '700px'}; border:1.5px solid #cbd5e1; border-radius:18px; background:radial-gradient(circle at 50% 35%, #ffffff 0%, #f8fafc 100%); padding:${isLandscape ? '36px 36px' : '48px 36px'}; box-sizing:border-box; text-align:center; box-shadow:0 4px 20px rgba(15, 43, 92, 0.05); margin:auto;">
                    <!-- Logo SIPEDAS -->
                    <div style="margin-bottom:14px;">
                        <img src="/static/logo_sipedas.png" alt="SIPEDAS" style="height:${isLandscape ? 88 : 110}px; width:auto; object-fit:contain; filter:drop-shadow(0 4px 10px rgba(15, 43, 92, 0.12));">
                    </div>
                    <!-- Brand Title -->
                    <div style="font-size:${isLandscape ? '30px' : '34px'}; font-weight:900; letter-spacing:3px; color:#0f2b5c; margin-bottom:4px; font-family:'Inter', sans-serif;">SIPEDAS</div>
                    <!-- Tagline -->
                    <div style="font-size:${isLandscape ? '13.5px' : '14.5px'}; font-weight:600; color:#475569; letter-spacing:0.3px; max-width:620px; margin:0 auto 14px auto; line-height:1.45; font-family:'Inter', sans-serif;">
                        Sistem Integrasi, Pencarian, dan Analisis Data Statistik
                    </div>
                    <!-- Garis Aksen BPS (Tricolor) -->
                    <div style="display:flex; gap:6px; margin:0 auto 16px auto; justify-content:center; align-items:center;">
                        <span style="width:36px; height:3.5px; background:#0284c7; border-radius:2px;"></span>
                        <span style="width:36px; height:3.5px; background:#16a34a; border-radius:2px;"></span>
                        <span style="width:36px; height:3.5px; background:#f59e0b; border-radius:2px;"></span>
                    </div>
                    <!-- Nama Instansi Resmi -->
                    <div style="font-size:${isLandscape ? '13px' : '14px'}; font-weight:800; color:#1e293b; letter-spacing:0.8px; text-transform:uppercase; margin-bottom:20px; font-family:'Inter', sans-serif;">
                        Badan Pusat Statistik Kabupaten Tasikmalaya
                    </div>
                    <!-- Kartu Identitas Laporan -->
                    <div style="background:#ffffff; border:1px solid #bfdbfe; border-radius:12px; padding:16px 24px; text-align:center; box-shadow:0 3px 12px rgba(37, 99, 235, 0.08); max-width:640px; margin:0 auto; box-sizing:border-box;">
                        <div style="font-size:10.5px; font-weight:800; color:#2563eb; text-transform:uppercase; letter-spacing:1px; margin-bottom:4px;">
                            Laporan Analisis Deret Waktu
                        </div>
                        <div style="font-size:${isLandscape ? '20px' : '22px'}; font-weight:900; color:#0f172a; margin-bottom:8px; letter-spacing:-0.2px; font-family:'Inter', sans-serif;">
                            ${escHtml(keywordTitle)}
                        </div>
                        <div style="font-size:11.5px; color:#334155; font-weight:600; display:flex; align-items:center; justify-content:center; gap:10px; flex-wrap:wrap;">
                            <span style="background:#f1f5f9; padding:4px 12px; border-radius:6px; color:#334155;">${escHtml(yearPeriodStr)}</span>
                            <span style="background:#f1f5f9; padding:4px 12px; border-radius:6px; color:#334155;">Satuan: <b>${escHtml(unitLabel)}</b></span>
                        </div>
                    </div>
                </div>
                <!-- Cover Footer -->
                <div style="position:absolute; bottom:16px; left:36px; right:36px; display:flex; justify-content:space-between; align-items:center; font-size:9.5px; color:#94a3b8; border-top:1px solid #f1f5f9; padding-top:6px;">
                    <div>Dokumen resmi digenerasi oleh SIPEDAS BPS Kabupaten Tasikmalaya</div>
                    <div>SIPEDAS \u00A9 2026</div>
                </div>
            `;
            stagingContainer.appendChild(coverPage);
            pageElements.push(coverPage);

            // =========================================================================
            // 2. HALAMAN KONTEN: HALAMAN 2 KE ATAS
            // =========================================================================
            let currentPage = createContentPage(2);
            stagingContainer.appendChild(currentPage);
            pageElements.push(currentPage);
            let currentUsedH = 0;

            function ensureSpace(neededH) {
                if (currentUsedH + neededH > usableContentH) {
                    const nextPageNum = pageElements.length + 1;
                    currentPage = createContentPage(nextPageNum);
                    stagingContainer.appendChild(currentPage);
                    pageElements.push(currentPage);
                    currentUsedH = 0;
                }
            }

            // A. KOMPONEN: QUICK INSIGHTS & PERINGKAT PERTUMBUHAN
            if (optInsights) {
                const insTitleEl = document.createElement('div');
                insTitleEl.style.cssText = 'font-size:13px; font-weight:800; color:#0f2b5c; border-bottom:1.5px solid #e2e8f0; padding-bottom:5px; margin-bottom:10px; letter-spacing:0.3px; flex-shrink:0;';
                insTitleEl.textContent = 'RINGKASAN TREN & PERINGKAT PERTUMBUHAN';

                if (insightsScope === 'both' || insightsScope === 'card_only') {
                    const gainerName = document.getElementById('ts-gainer-name')?.textContent || '-';
                    const gainerBadge = document.getElementById('ts-gainer-badge')?.textContent || '0%';
                    const declinerName = document.getElementById('ts-decliner-name')?.textContent || '-';
                    const declinerBadge = document.getElementById('ts-decliner-badge')?.textContent || '0%';
                    const avgBadge = document.getElementById('ts-avg-badge')?.textContent || '0%';
                    const trendSummary = document.getElementById('ts-trend-summary')?.textContent || 'Tren Stabil';

                    const cardsEl = document.createElement('div');
                    cardsEl.style.cssText = 'display:grid; grid-template-columns:repeat(3, 1fr); gap:10px; margin-bottom:12px; flex-shrink:0;';
                    cardsEl.innerHTML = `
                        <div style="background:#f8fafc; border:1px solid #e2e8f0; padding:10px 12px; border-radius:8px;">
                            <div style="font-size:10px; color:#64748b; font-weight:600; text-transform:uppercase;">Pertumbuhan Tertinggi</div>
                            <div style="font-size:13px; font-weight:700; color:#0f172a; margin-top:2px;">${escHtml(gainerName)}</div>
                            <div style="font-size:11.5px; font-weight:700; color:#16a34a; margin-top:2px;">${escHtml(gainerBadge)}</div>
                        </div>
                        <div style="background:#f8fafc; border:1px solid #e2e8f0; padding:10px 12px; border-radius:8px;">
                            <div style="font-size:10px; color:#64748b; font-weight:600; text-transform:uppercase;">Penurunan Tertinggi</div>
                            <div style="font-size:13px; font-weight:700; color:#0f172a; margin-top:2px;">${escHtml(declinerName)}</div>
                            <div style="font-size:11.5px; font-weight:700; color:#dc2626; margin-top:2px;">${escHtml(declinerBadge)}</div>
                        </div>
                        <div style="background:#f8fafc; border:1px solid #e2e8f0; padding:10px 12px; border-radius:8px;">
                            <div style="font-size:10px; color:#64748b; font-weight:600; text-transform:uppercase;">Laju Rata-Rata Tahunan</div>
                            <div style="font-size:13px; font-weight:700; color:#0f172a; margin-top:2px;">${escHtml(trendSummary)}</div>
                            <div style="font-size:11.5px; font-weight:700; color:#2563eb; margin-top:2px;">${escHtml(avgBadge)}</div>
                        </div>
                    `;
                    ensureSpace(115);
                    currentPage.querySelector('.ts-pdf-content-body').appendChild(insTitleEl);
                    currentPage.querySelector('.ts-pdf-content-body').appendChild(cardsEl);
                    currentUsedH += 115;
                } else {
                    ensureSpace(35);
                    currentPage.querySelector('.ts-pdf-content-body').appendChild(insTitleEl);
                    currentUsedH += 35;
                }

                if (insightsScope === 'both' || insightsScope === 'table_only') {
                    const rankingTableEl = document.getElementById('ts-growth-ranking-table');
                    if (rankingTableEl) {
                        const startYearText = document.getElementById('ts-th-year-start')?.textContent || 'Tahun Awal';
                        const endYearText = document.getElementById('ts-th-year-end')?.textContent || 'Tahun Akhir';
                        const rankingTrs = Array.from(document.querySelectorAll('#ts-growth-ranking-tbody tr'));

                        if (rankingTrs.length > 0) {
                            ensureSpace(150);

                            const tblTitleEl = document.createElement('div');
                            tblTitleEl.style.cssText = 'font-size:11.5px; font-weight:700; color:#1e293b; margin-bottom:6px; flex-shrink:0;';
                            tblTitleEl.textContent = `Tabel Urutan Peringkat Pertumbuhan (${startYearText} ke ${endYearText})`;
                            currentPage.querySelector('.ts-pdf-content-body').appendChild(tblTitleEl);
                            currentUsedH += 24;

                            const rankingTheadHtml = `
                                <thead style="background:#f1f5f9;">
                                    <tr>
                                        <th style="background:#f1f5f9; color:#0f172a; font-weight:700; border:1px solid #cbd5e1; padding:5px 8px; text-align:center; width:40px; font-size:9.5px;">No.</th>
                                        <th style="background:#f1f5f9; color:#0f172a; font-weight:700; border:1px solid #cbd5e1; padding:5px 8px; text-align:left; font-size:9.5px;">Rincian</th>
                                        <th style="background:#f1f5f9; color:#0f172a; font-weight:700; border:1px solid #cbd5e1; padding:5px 8px; text-align:right; font-size:9.5px;">${escHtml(startYearText)}</th>
                                        <th style="background:#f1f5f9; color:#0f172a; font-weight:700; border:1px solid #cbd5e1; padding:5px 8px; text-align:right; font-size:9.5px;">${escHtml(endYearText)}</th>
                                        <th style="background:#f1f5f9; color:#0f172a; font-weight:700; border:1px solid #cbd5e1; padding:5px 8px; text-align:right; font-size:9.5px;">Selisih Nominal</th>
                                        <th style="background:#f1f5f9; color:#0f172a; font-weight:700; border:1px solid #cbd5e1; padding:5px 8px; text-align:right; font-size:9.5px;">Perubahan (%)</th>
                                    </tr>
                                </thead>
                            `;

                            const rankingRowH = 24;
                            const rankingTheadH = 28;
                            let rIdx = 0;

                            while (rIdx < rankingTrs.length) {
                                const availH = usableContentH - currentUsedH - rankingTheadH - 8;
                                const maxFit = Math.max(1, Math.floor(availH / rankingRowH));
                                const batch = rankingTrs.slice(rIdx, rIdx + maxFit);
                                rIdx += batch.length;

                                const tbl = document.createElement('table');
                                tbl.style.cssText = 'width:100%; border-collapse:collapse; font-size:10px; font-family:"Inter", sans-serif; margin-bottom:10px;';
                                tbl.innerHTML = rankingTheadHtml + `<tbody>${batch.map(tr => tr.outerHTML).join('')}</tbody>`;

                                tbl.querySelectorAll('td').forEach((td, colIdx) => {
                                    td.style.border = '1px solid #e2e8f0';
                                    td.style.padding = '3.5px 7px';
                                    td.style.fontSize = '9px';
                                    td.style.color = '#334155';
                                    if (colIdx === 0) td.style.textAlign = 'center';
                                    else if (colIdx === 1) td.style.textAlign = 'left';
                                    else td.style.textAlign = 'right';
                                });
                                tbl.querySelectorAll('tr:nth-child(even) td').forEach(td => {
                                    td.style.backgroundColor = '#f8fafc';
                                });

                                currentPage.querySelector('.ts-pdf-content-body').appendChild(tbl);
                                currentUsedH += rankingTheadH + (batch.length * rankingRowH) + 10;

                                if (rIdx < rankingTrs.length) {
                                    const nextPageNum = pageElements.length + 1;
                                    currentPage = createContentPage(nextPageNum);
                                    stagingContainer.appendChild(currentPage);
                                    pageElements.push(currentPage);
                                    currentUsedH = 0;
                                }
                            }
                        }
                    }
                }
            }

            // B. KOMPONEN: GRAFIK VISUAL DERET WAKTU
            if (optChart && chartImages.length > 0) {
                const chartCardH = isLandscape ? 385 : 430;
                const chartTitleH = 30;

                for (let cIdx = 0; cIdx < chartImages.length; cIdx++) {
                    const cImg = chartImages[cIdx];
                    const isFirstChart = (cIdx === 0);
                    const totalNeeded = (isFirstChart ? chartTitleH : 0) + chartCardH + 10;

                    // Cegah Orphan Header: Jika judul + grafik tidak muat, pindah ke halaman baru
                    ensureSpace(totalNeeded);

                    if (isFirstChart) {
                        const chartTitleEl = document.createElement('div');
                        chartTitleEl.style.cssText = 'font-size:13px; font-weight:800; color:#0f2b5c; border-bottom:1.5px solid #e2e8f0; padding-bottom:5px; margin-top:4px; margin-bottom:10px; letter-spacing:0.3px; flex-shrink:0;';
                        chartTitleEl.textContent = 'GRAFIK VISUAL DERET WAKTU';
                        currentPage.querySelector('.ts-pdf-content-body').appendChild(chartTitleEl);
                        currentUsedH += chartTitleH;
                    }

                    const cardDiv = document.createElement('div');
                    cardDiv.className = 'ts-pdf-chart-card';
                    cardDiv.style.cssText = 'background:#ffffff; border:1px solid #e2e8f0; border-radius:10px; padding:12px 14px; text-align:center; margin-bottom:12px; box-shadow:0 1px 3px rgba(0,0,0,0.04); flex-shrink:0;';

                    if (cImg.title) {
                        cardDiv.innerHTML = `<div style="font-size:12px; font-weight:700; color:#0f172a; margin-bottom:8px; text-align:left; border-bottom:1px solid #f1f5f9; padding-bottom:5px;">${escHtml(cImg.title)}</div>`;
                    }

                    const imgEl = document.createElement('img');
                    imgEl.src = cImg.dataUrl;
                    imgEl.style.cssText = 'width:100%; max-width:1080px; height:auto; display:block; margin:0 auto; object-fit:contain; border-radius:6px;';
                    cardDiv.appendChild(imgEl);

                    currentPage.querySelector('.ts-pdf-content-body').appendChild(cardDiv);
                    currentUsedH += chartCardH;
                }
            }

            // C. KOMPONEN: TABEL DATA TABULAR
            if (optTable) {
                const tableEl = document.getElementById('ts-grid');
                if (tableEl) {
                    const tabularTrs = Array.from(document.querySelectorAll('#ts-grid-body tr'));
                    if (tabularTrs.length > 0) {
                        const tabTitleH = 30;
                        const tabTheadH = 48;
                        const tabRowH = 23;
                        const minRowsToStart = 5;
                        const minNeeded = tabTitleH + tabTheadH + (minRowsToStart * tabRowH); // ~190px

                        // Cegah tabel terpecah canggung di bawah grafik: jika sisa ruang < 190px, buat halaman baru
                        ensureSpace(minNeeded);

                        const tabTitleEl = document.createElement('div');
                        tabTitleEl.style.cssText = 'font-size:13px; font-weight:800; color:#0f2b5c; border-bottom:1.5px solid #e2e8f0; padding-bottom:5px; margin-top:4px; margin-bottom:10px; letter-spacing:0.3px; flex-shrink:0;';
                        tabTitleEl.textContent = 'TABEL DATA TABULAR';
                        currentPage.querySelector('.ts-pdf-content-body').appendChild(tabTitleEl);
                        currentUsedH += tabTitleH;

                        // 2-Level Thead Resmi: Baris 1 (Tahun) & Baris 2 (Indikator + Satuan)
                        const tabularTheadHtml = `
                            <thead style="background:#f1f5f9;">
                                <tr>
                                    <th rowspan="2" style="background:#f1f5f9; color:#0f172a; font-weight:700; border:1px solid #cbd5e1; padding:5px 8px; text-align:center; font-size:9.5px; vertical-align:middle; min-width:150px;">Rincian</th>
                                    ${years.map(y => `<th colspan="${activeVKs.length}" style="background:#f1f5f9; color:#0f172a; font-weight:700; border:1px solid #cbd5e1; padding:5px 8px; text-align:center; font-size:10px; border-left:1.5px solid #cbd5e1;">${escHtml(y)}</th>`).join('')}
                                </tr>
                                <tr>
                                    ${years.map(y => activeVKs.map((vk, vIdx) => {
                                        const uCfg = getUnitConfigForVK(vk);
                                        const uLbl = uCfg ? uCfg.label : (vkUnits && vkUnits[vk] ? vkUnits[vk] : '');
                                        const uClean = uLbl ? ` (${String(uLbl).trim().replace(/^\(+|\)+$/g, '')})` : '';
                                        const dotColor = (typeof getIndicatorColor === 'function') ? getIndicatorColor(vk) : '#2563eb';
                                        const bLeft = vIdx === 0 ? 'border-left:1.5px solid #cbd5e1;' : 'border-left:1px dashed #cbd5e1;';
                                        return `<th style="background:#f8fafc; color:#334155; font-weight:600; border:1px solid #cbd5e1; ${bLeft} padding:3.5px 5px; text-align:center; font-size:8.5px; white-space:nowrap;">
                                            <span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:${dotColor};margin-right:3px;vertical-align:middle;"></span>${escHtml(vk + uClean)}</th>`;
                                    }).join('')).join('')}
                                </tr>
                            </thead>
                        `;

                        let tIdx = 0;
                        while (tIdx < tabularTrs.length) {
                            const availH = usableContentH - currentUsedH - tabTheadH - 8;
                            const maxFit = Math.max(1, Math.floor(availH / tabRowH));
                            const batch = tabularTrs.slice(tIdx, tIdx + maxFit);
                            tIdx += batch.length;

                            const tbl = document.createElement('table');
                            tbl.style.cssText = 'width:100%; border-collapse:collapse; font-size:9.5px; font-family:"Inter", sans-serif; margin-bottom:10px;';
                            tbl.innerHTML = tabularTheadHtml + `<tbody>${batch.map(tr => tr.outerHTML).join('')}</tbody>`;

                            // Sanitasi: hilangkan tautan/tombol interaktif dan seragamkan styling cell
                            tbl.querySelectorAll('a, button, .bi-box-arrow-up-right').forEach(el => el.remove());
                            tbl.querySelectorAll('td').forEach((td, colIdx) => {
                                td.style.border = '1px solid #e2e8f0';
                                td.style.padding = '3.5px 6px';
                                td.style.fontSize = '9px';
                                td.style.color = '#334155';
                                if (colIdx === 0) td.style.textAlign = 'left';
                                else td.style.textAlign = 'right';
                            });
                            tbl.querySelectorAll('tr:nth-child(even) td').forEach(td => {
                                td.style.backgroundColor = '#f8fafc';
                            });

                            currentPage.querySelector('.ts-pdf-content-body').appendChild(tbl);
                            currentUsedH += tabTheadH + (batch.length * tabRowH) + 10;

                            if (tIdx < tabularTrs.length) {
                                const nextPageNum = pageElements.length + 1;
                                currentPage = createContentPage(nextPageNum);
                                stagingContainer.appendChild(currentPage);
                                pageElements.push(currentPage);
                                currentUsedH = 0;
                            }
                        }
                    }
                }
            }

            // Update Total Halaman ("Halaman X dari Y") dan Footer Penutup Resmi
            const totalPages = pageElements.length;
            pageElements.forEach((p, idx) => {
                if (idx === 0) return; // Sampul memiliki footer khusus
                const pNumEl = p.querySelector('.ts-pdf-page-number');
                if (pNumEl) {
                    pNumEl.textContent = `Halaman ${idx + 1} dari ${totalPages}`;
                }
            });

            const lastPage = pageElements[totalPages - 1];
            const lastFtr = lastPage.querySelector('.ts-pdf-page-footer');
            if (lastFtr) {
                lastFtr.innerHTML = `
                    <div>Dokumen digenerasi secara otomatis oleh SIPEDAS BPS Kabupaten Tasikmalaya \u2022 SIPEDAS \u00A9 2026</div>
                    <div>Halaman ${totalPages} dari ${totalPages}</div>
                `;
            }

            // Render Setiap Halaman ke jsPDF
            await new Promise(r => setTimeout(r, 250));

            for (let i = 0; i < pageElements.length; i++) {
                const pEl = pageElements[i];
                const pageCanvas = await html2canvas(pEl, {
                    scale: 2,
                    backgroundColor: '#ffffff',
                    useCORS: true,
                    logging: false
                });
                const pageImgData = pageCanvas.toDataURL('image/jpeg', 0.95);
                if (i > 0) pdf.addPage();
                pdf.addImage(pageImgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
            }

            pdf.save(`${fileNameBase}.pdf`);

            if (stagingContainer && stagingContainer.parentNode) {
                stagingContainer.parentNode.removeChild(stagingContainer);
            }

            Swal.close();
            showToast('success', 'Berhasil', 'Laporan Deret Waktu (.pdf) berhasil diunduh.');
        }




    } catch (error) {

        console.error('Error during TS export:', error);

        // Ensure cleanup
        const sEl = document.getElementById('ts-export-staging');
        if (sEl && sEl.parentNode) sEl.parentNode.removeChild(sEl);
        const pEl = document.getElementById('ts-export-png-report');
        if (pEl && pEl.parentNode) pEl.parentNode.removeChild(pEl);
        const tempEl = document.getElementById('ts-export-temp-report');
        if (tempEl && tempEl.parentNode) tempEl.parentNode.removeChild(tempEl);



        Swal.close();

        showToast('error', 'Gagal Ekspor', error.message || 'Terjadi kesalahan saat memproses ekspor.');

    }

}



// ==========================================

// ROLE & ADMIN LOGIC

// ==========================================



let currentUserRole = "pegawai";

window.currentUserRole = "pegawai";

function toggleUserMenu(e) {
    if (e) e.stopPropagation();
    if (document.body && document.body.classList.contains('sidebar-collapsed')) {
        return; // Saat sidebar tertutup, interaksi menggunakan hover popover
    }
    const dropdown = document.getElementById('sidebar-user-dropdown');
    const card = document.getElementById('sidebar-user-btn');
    if (!dropdown || !card) return;

    const isShown = dropdown.style.display === 'block';
    if (isShown) {
        hideUserMenu();
    } else {
        // Pindahkan dropdown ke body agar bebas dari overflow dan clipping sidebar
        if (!dropdown._originalParent) dropdown._originalParent = dropdown.parentNode;
        if (dropdown.parentNode !== document.body) {
            document.body.appendChild(dropdown);
        }

        const rect = card.getBoundingClientRect();
        dropdown.style.display = 'block';
        dropdown.style.position = 'fixed';

        // Deteksi mobile: sidebar sempit, dropdown harus ke bawah
        const isMobile = window.innerWidth < 768 ||
            document.body.classList.contains('mobile-sidebar-active') ||
            (document.querySelector('.sidebar')?.classList.contains('mobile-open'));

        const dropHeight = dropdown.offsetHeight || 105;
        const sidebarWidth = Math.min(document.querySelector('.sidebar')?.offsetWidth || 285, window.innerWidth);

        if (isMobile) {
            // Mobile: dropdown muncul di BAWAH kartu admin, dalam area sidebar
            let targetTop = rect.bottom + 8;
            if (targetTop + dropHeight > window.innerHeight - 10) {
                targetTop = Math.max(10, window.innerHeight - dropHeight - 10);
            }
            dropdown.style.top = Math.round(targetTop) + 'px';
            dropdown.style.left = Math.max(4, rect.left) + 'px';
            dropdown.style.width = Math.min(sidebarWidth - 8, 260) + 'px';
            dropdown.style.right = 'auto';
            dropdown.classList.add('dropdown-below');
        } else {
            // Desktop: dropdown muncul di SEBELAH KANAN kartu admin
            dropdown.style.top = Math.round(targetTop) + 'px';
            dropdown.style.left = Math.round(rect.right + 12) + 'px';
            dropdown.style.width = '';
            dropdown.style.right = '';
            dropdown.classList.remove('dropdown-below');
        }
        card.classList.add('active');
    }
}

function hideUserMenu() {
    const dropdown = document.getElementById('sidebar-user-dropdown');
    const card = document.getElementById('sidebar-user-btn');
    if (dropdown) {
        dropdown.style.display = 'none';
        dropdown.classList.remove('dropdown-below');
        if (dropdown._originalParent && dropdown.parentNode !== dropdown._originalParent) {
            dropdown._originalParent.appendChild(dropdown);
        }
    }
    if (card) card.classList.remove('active');
}

document.addEventListener('click', hideUserMenu);

function updateRoleUI(role) {

    const isAdmin = role === 'admin';

    if (document.body) {
        // Bekukan transisi CSS sementara saat role berubah agar sidebar tidak kejapan membuka/menutup
        document.documentElement.classList.add('no-sidebar-transition');

        document.body.classList.toggle('role-admin', isAdmin);

        document.body.classList.toggle('role-pegawai', !isAdmin);

        // Pastikan state sidebar-collapsed langsung terkunci sebelum browser render frame berikutnya (hanya desktop)
        const savedState = localStorage.getItem('sipedas_sidebar_collapsed');
        const hasCookie = document.cookie.indexOf('sipedas_sidebar_collapsed=true') !== -1;
        const isCollapsed = savedState === 'true' || (savedState === null && hasCookie);
        if (isCollapsed && window.innerWidth >= 992) {
            document.body.classList.add('sidebar-collapsed');
            document.documentElement.classList.add('sidebar-collapsed-early');
        } else {
            document.body.classList.remove('sidebar-collapsed');
            document.documentElement.classList.remove('sidebar-collapsed-early');
        }

        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                document.documentElement.classList.remove('no-sidebar-transition');
            });
        });
    }

    const btnLogin = document.getElementById('btn-admin-login');
    const btnLogout = document.getElementById('btn-admin-logout-btn');
    const userWidget = document.getElementById('sidebar-user-widget');

    if (isAdmin) {

        if (btnLogin) btnLogin.style.setProperty('display', 'none', 'important');
        if (userWidget) userWidget.style.setProperty('display', 'none', 'important');
        if (btnLogout) btnLogout.style.setProperty('display', 'flex', 'important');

        document.querySelectorAll(".admin-only").forEach(el => el.style.removeProperty('display'));

        const opHeader = document.getElementById('operator-header');
        if (opHeader) opHeader.style.removeProperty('display');

    } else {

        tsShowSources = false;

        if (btnLogin) btnLogin.style.setProperty('display', 'flex', 'important');
        if (userWidget) userWidget.style.setProperty('display', 'none', 'important');
        if (btnLogout) btnLogout.style.setProperty('display', 'none', 'important');

        document.querySelectorAll(".admin-only").forEach(el => el.style.setProperty('display', 'none', 'important'));

        const opHeader = document.getElementById('operator-header');
        if (opHeader) opHeader.style.removeProperty('display');

        const container = document.getElementById('ts-sources-lineage-container');

        if (container) container.style.display = 'none';

        const btnToggleSources = document.getElementById('btn-ts-toggle-sources');

        if (btnToggleSources) {

            btnToggleSources.classList.remove('btn-primary');

            btnToggleSources.classList.add('btn-outline-primary');

            btnToggleSources.innerHTML = `<i class="bi bi-diagram-3"></i> <span>Lacak Asal Sumber Data</span>`;

        }

    }

    if (typeof tsRenderCallback === 'function') {

        tsRenderCallback();

    }

}



async function checkAuthSession() {
    try {
        const res = await fetch(`${API_BASE}/auth/me`, { credentials: 'same-origin' });
        if (res.ok) {
            const data = await res.json();
            currentUserRole = data.role;
            window.currentUserRole = data.role;
            updateRoleUI(data.role);
            if (data.role === 'admin') {
                try { localStorage.setItem('sipedas_user_role', 'admin'); } catch(e) {}
            } else {
                try { localStorage.removeItem('sipedas_user_role'); } catch(e) {}
            }
            return data.role;
        }
    } catch(e) {}

    currentUserRole = "pegawai";
    window.currentUserRole = "pegawai";
    updateRoleUI("pegawai");
    try { localStorage.removeItem('sipedas_user_role'); } catch(e) {}
    return "pegawai";
}



async function adminLogin() {

    const isDark = document.body.classList.contains('dark-mode') || document.documentElement.getAttribute('data-bs-theme') === 'dark';

    const { value: isSuccess } = await Swal.fire({

        html: `

            <div style="text-align: center; padding: 6px 4px 0 4px;">

                <!-- Logo SIPEDAS -->
                <div style="margin: 0 auto 16px auto; width: 64px; height: 64px; display: flex; align-items: center; justify-content: center;">
                    <img src="/static/logo_sipedas.png" alt="SIPEDAS" style="width: 64px; height: 64px; object-fit: contain;">
                </div>



                <h5 style="margin: 0 0 4px 0; font-size: 1.15rem; font-weight: 700; color: ${isDark ? cssVar('--bg-page') || '#f8fafc' : cssVar('--slate-900') || '#0f172a'}; letter-spacing: -0.3px;">

                    Login Admin SIPEDAS

                </h5>

                <div style="font-size: 0.78rem; color: ${isDark ? cssVar('--text-light') || '#94a3b8' : cssVar('--text-secondary') || '#64748b'}; margin-bottom: 16px; font-weight: 500;">

                    BPS Kabupaten Tasikmalaya

                </div>



                <div style="font-size: 0.83rem; color: ${isDark ? cssVar('--text-muted') || '#cbd5e1' : cssVar('--text-tertiary') || '#475569'}; margin-bottom: 18px; line-height: 1.5; padding: 0 10px;">

                    Masukkan kredensial administrator untuk mengakses modul ekstraksi PDF, editor data tabel, dan manajemen basis data.

                </div>



                <!-- Input Box Terpadu -->

                <div style="text-align: left; margin-bottom: 14px;">

                    <label style="display: block; font-size: 0.78rem; font-weight: 600; color: ${isDark ? cssVar('--border') || '#e2e8f0' : cssVar('--text-tertiary') || '#334155'}; margin-bottom: 6px;">

                        Username <span style="color: #ef4444;">*</span>

                    </label>

                    <div class="sipedas-login-input-group">

                        <input type="text" id="swal-login-username" class="sipedas-login-input" placeholder="Masukkan username..." autocomplete="username">

                    </div>

                </div>

                <div style="text-align: left; margin-bottom: 6px;">

                    <label style="display: block; font-size: 0.78rem; font-weight: 600; color: ${isDark ? cssVar('--border') || '#e2e8f0' : cssVar('--text-tertiary') || '#334155'}; margin-bottom: 6px;">

                        Password Admin <span style="color: #ef4444;">*</span>

                    </label>

                    <div class="sipedas-login-input-group">

                        <input type="password" id="swal-login-password" class="sipedas-login-input" placeholder="Masukkan password admin..." autocomplete="current-password">

                        <button type="button" class="sipedas-login-eye-btn" onclick="const p=document.getElementById('swal-login-password'); const isPw=p.type==='password'; p.type=isPw?'text':'password'; this.querySelector('i').className=isPw?'bi bi-eye-slash-fill text-primary':'bi bi-eye';">

                            <i class="bi bi-eye"></i>

                        </button>

                    </div>

                </div>

            </div>

        `,

        showCancelButton: true,

        confirmButtonText: '<i class="bi bi-check-lg me-1"></i> Masuk Sekarang',

        cancelButtonText: 'Batal',

        confirmButtonColor: cssVar('--info') || '#2563eb',

        cancelButtonColor: isDark ? cssVar('--text-tertiary') || '#334155' : cssVar('--bg-hover') || '#f1f5f9',

        buttonsStyling: true,

        focusConfirm: false,

        backdrop: 'rgba(15, 23, 42, 0.65)',

        showLoaderOnConfirm: true,

        customClass: {

            popup: 'sipedas-login-modal border-0',

            actions: 'mt-3 mb-0 w-100 justify-content-center gap-2'

        },

        didOpen: () => {

            const first = document.getElementById('swal-login-username');

            const second = document.getElementById('swal-login-password');

            if (first) first.focus();

            [first, second].forEach((el) => {

                if (el) el.addEventListener('keydown', (e) => {

                    if (e.key === 'Enter') Swal.clickConfirm();

                });

            });

        },

        preConfirm: async () => {

            const userInp = document.getElementById('swal-login-username');

            const pwInp = document.getElementById('swal-login-password');

            const username = userInp ? userInp.value.trim() : '';

            const pw = pwInp ? pwInp.value.trim() : '';

            if (!username) {

                Swal.showValidationMessage('Silakan masukkan username terlebih dahulu.');

                return false;

            }

            if (!pw) {

                Swal.showValidationMessage('Silakan masukkan password terlebih dahulu.');

                return false;

            }

            try {

                const res = await fetch(`${API_BASE}/auth/login`, {

                    method: 'POST',

                    headers: { 'Content-Type': 'application/json' },

                    credentials: 'same-origin',

                    body: JSON.stringify({ username: username, password: pw })

                });

                if (!res.ok) {

                    const err = await res.json().catch(() => ({}));

                    Swal.showValidationMessage(err.detail || 'Username atau password salah!');

                    return false;

                }

                return true;

            } catch(e) {

                Swal.showValidationMessage('Gagal terhubung ke server backend SIPEDAS.');

                return false;

            }

        }

    });



    if (isSuccess) {
        currentUserRole = "admin";
        window.currentUserRole = "admin";
        try { localStorage.setItem('sipedas_user_role', 'admin'); } catch(e) {}
        updateRoleUI("admin");

        // Cross-tab sync: notify other tabs about login
        try { localStorage.setItem('sipedas_auth_event', JSON.stringify({ type: 'login', ts: Date.now() })); } catch(e) {}

        if (window.location.pathname === '/login') {
            window.location.href = '/?_t=' + Date.now();
            return;
        }

        navigate('dashboard', document.getElementById('nav-dashboard'));
        showToast('success', 'Selamat Datang, Admin SIPEDAS!', 'Akses penuh Admin SIPEDAS aktif.', 3000);
    }
}



function adminLogout() {

    // Auto-close mobile sidebar agar modal terlihat jelas
    const mobileSidebar = document.querySelector('.sidebar');
    if (mobileSidebar && mobileSidebar.classList.contains('mobile-open') && typeof toggleMobileSidebar === 'function') {
        toggleMobileSidebar();
    }

    const isDark = document.body.classList.contains('dark-mode') || document.documentElement.getAttribute('data-bs-theme') === 'dark';

    Swal.fire({

        html: `
            <div style="text-align: center; padding: 6px 4px 0 4px;">
                <div style="margin: 0 auto 16px auto; width: 64px; height: 64px; display: flex; align-items: center; justify-content: center;">
                    <img src="/static/logo_sipedas.png" alt="SIPEDAS" style="width: 64px; height: 64px; object-fit: contain;">
                </div>
                <h5 style="margin: 0 0 4px 0; font-size: 1.15rem; font-weight: 700; color: ${isDark ? cssVar('--bg-page') || '#f8fafc' : cssVar('--slate-900') || '#0f172a'}; letter-spacing: -0.3px;">
                    Logout Admin SIPEDAS?
                </h5>
                <div style="font-size: 0.83rem; color: ${isDark ? cssVar('--text-muted') || '#cbd5e1' : cssVar('--text-tertiary') || '#475569'}; margin-bottom: 6px; line-height: 1.5; padding: 0 10px;">
                    Anda akan kembali ke mode Operator SIPEDAS.
                </div>
            </div>
        `,

        showCancelButton: true,

        confirmButtonText: '<i class="bi bi-box-arrow-right me-1"></i> Ya, Logout',

        cancelButtonText: 'Batal',

        confirmButtonColor: cssVar('--danger') || '#ef4444',

        cancelButtonColor: isDark ? cssVar('--text-tertiary') || '#334155' : cssVar('--bg-hover') || '#f1f5f9',

        buttonsStyling: true,

        backdrop: 'rgba(15, 23, 42, 0.65)',

        customClass: {

            popup: 'sipedas-login-modal border-0',

            actions: 'mt-3 mb-0 w-100 justify-content-center gap-2'

        }

    }).then(async (result) => {

        if (result.isConfirmed) {
            showLoadingModal("Logging out...", "Menghapus sesi dan beralih ke mode publik...");
            try {
                await fetch(`${API_BASE}/auth/logout`, { method: 'POST', credentials: 'same-origin' });
            } catch(e) {}

            // Cross-tab sync: notify other tabs about logout
            try { localStorage.setItem('sipedas_auth_event', JSON.stringify({ type: 'logout', ts: Date.now() })); } catch(e) {}

            window.location.href = '/?_public=1&_t=' + Date.now();
        }

    });

}



async function loadAdminTables() {
    const list = document.getElementById("admin-table-list");
    list.innerHTML = `<tr><td colspan="5" class="text-center text-muted py-4"><span class="spinner-border spinner-border-sm text-primary me-2" role="status"></span>Memuat data inventaris database...</td></tr>`;
    loadAdminSummary();
    try {
        const res = await fetch(`${API_BASE}/admin/tables`);
        if (!res.ok) throw new Error("Gagal mengambil data admin");
        const tables = await res.json();
        window.__adminTables = tables;
        renderAdminTables();
    } catch(e) {
        list.innerHTML = `<tr><td colspan="5" class="text-center text-danger py-3">Error: ${e.message}</td></tr>`;
    }
}



async function loadAdminSummary() {
    try {
        const res = await fetch(`${API_BASE}/stats`);
        if (!res.ok) return;
        const s = await res.json();
        const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
        set("stat-total-docs", (s.total_docs || 0).toLocaleString('id-ID'));
        set("stat-total-tables", (s.total_tables || 0).toLocaleString('id-ID'));
        set("stat-total-rows", (s.total_rows || 0).toLocaleString('id-ID'));

        // Set metrik di halaman Manajemen Database > Database (5 kartu)
        set("admin-db-metric-docs", `${(s.total_docs || 0).toLocaleString('id-ID')} Dokumen`);
        set("admin-db-metric-tables", `${(s.total_tables || 0).toLocaleString('id-ID')} Tabel`);
        set("admin-db-metric-rows", `${(s.total_rows || 0).toLocaleString('id-ID')} Baris`);
        set("admin-db-metric-cells", `${(s.total_data_points || (s.total_rows ? s.total_rows * 4 : 0)).toLocaleString('id-ID')} Titik`);
        // Sync ke compact stats mobile
        const _cd = document.getElementById("compact-docs");
        const _ct = document.getElementById("compact-tables");
        const _cr = document.getElementById("compact-rows");
        const _cc = document.getElementById("compact-cells");
        if (_cd) _cd.textContent = (s.total_docs || 0).toLocaleString('id-ID');
        if (_ct) _ct.textContent = (s.total_tables || 0).toLocaleString('id-ID');
        if (_cr) _cr.textContent = (s.total_rows || 0).toLocaleString('id-ID');
        if (_cc) _cc.textContent = (s.total_data_points || (s.total_rows ? s.total_rows * 4 : 0)).toLocaleString('id-ID');
    } catch(e) {}
    const backups = (window.__adminBackups || []).length;
    const backupsEl = document.getElementById("admin-stat-backups");
    if (backupsEl) backupsEl.textContent = backups;
}



async function loadAdminBackups() {

    const list = document.getElementById("admin-backup-list");

    if (!list) return;

    list.innerHTML = 'Memuat daftar backup...';

    try {

        const res = await fetch(`${API_BASE}/admin/backups`);

        if (!res.ok) throw new Error("Gagal mengambil daftar backup");

        const data = await res.json();

        const files = data.backups || [];

        window.__adminBackups = files;

        const backupsEl = document.getElementById("admin-stat-backups");

        if (backupsEl) backupsEl.textContent = files.length;

        if (files.length === 0) {

            list.innerHTML = '<div class="p-3 text-muted text-center border rounded-3 bg-light">Belum ada backup tersimpan. Klik "Buat Backup Sekarang" untuk membuat cadangan database pertama Anda.</div>';

            return;

        }

        const base = API_BASE.replace(/\/api\/?$/, '');

        list.innerHTML = `<div class="table-responsive bg-white rounded-3 border mb-3"><table class="table table-hover table-admin-compact align-middle mb-0" style="min-width:680px; width:100%;">
            <thead class="table-light">
                <tr>
                    <th style="min-width:240px;">Nama File Cadangan</th>
                    <th class="text-center" style="width:100px;">Ukuran</th>
                    <th class="text-center" style="width:150px;">Tanggal Dibuat</th>
                    <th class="text-center" style="width:200px;">Aksi Kontrol</th>
                </tr>
            </thead><tbody>${files.map(f => {
                const fnEsc = f.file.replace(/'/g, "\\'");
                return `<tr>
                    <td class="fw-semibold text-dark text-nowrap">
                        <span class="badge bg-light text-dark border font-monospace px-2 py-1" style="font-size:0.76rem;">
                            <i class="bi bi-file-earmark-code text-teal me-1"></i>${escHtml(f.file)}
                        </span>
                    </td>
                    <td class="text-nowrap text-center text-muted" style="font-size:0.76rem;">${formatFileSize(f.size)}</td>
                    <td class="text-nowrap text-center text-muted" style="font-size:0.76rem;">${f.modified}</td>
                    <td class="text-center">
                        <div class="d-inline-flex gap-1">
                            <a href="${API_BASE}/admin/backups/${encodeURIComponent(f.file)}" download="${escHtml(f.file)}" class="btn btn-sm btn-outline-secondary py-1 px-2 d-inline-flex align-items-center gap-1 shadow-none" style="font-size:0.72rem; border-radius:5px;" title="Unduh file SQL ini ke komputer">
                                <i class="bi bi-download"></i> Unduh
                            </a>
                            <button onclick="restoreBackup('${fnEsc}')" class="btn btn-sm btn-outline-teal py-1 px-2 d-inline-flex align-items-center gap-1 shadow-none" style="font-size:0.72rem; border-color:#0d9488; color:#0d9488; border-radius:5px;" title="Pulihkan database dari file ini">
                                <i class="bi bi-arrow-counterclockwise"></i> Restore
                            </button>
                            <button onclick="deleteBackup('${fnEsc}')" class="btn btn-sm btn-outline-danger py-1 px-2 d-inline-flex align-items-center gap-1 shadow-none" style="font-size:0.72rem; border-radius:5px;" title="Hapus file cadangan ini">
                                <i class="bi bi-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>`;
            }).join('')}
            </tbody></table></div>`;

    } catch(e) {

        list.innerHTML = `<span class="text-danger">Error: ${e.message}</span>`;

    }

}



async function restoreBackup(filename) {

    const result = await Swal.fire({

        title: 'Pulihkan (Restore) Database?',

        html: `<div class="text-start">

            <p>Anda akan memulihkan database dari file backup:</p>

            <div class="p-2.5 bg-light border rounded-3 mb-3 font-monospace small text-primary fw-bold text-break">${escHtml(filename)}</div>

            <div class="alert alert-warning border-0 bg-warning bg-opacity-10 text-warning-emphasis small mb-0 py-2">

                <i class="bi bi-exclamation-triangle-fill text-warning me-1"></i>

                <b>Peringatan:</b> Seluruh data database aktif saat ini akan digantikan dengan data dari backup ini. Sistem akan membuat backup darurat snapshot sebelum restore dimulai.

            </div>

        </div>`,

        icon: 'warning',

        showCancelButton: true,

        confirmButtonColor: cssVar('--info') || '#0d9488',

        cancelButtonColor: cssVar('--text-light') || cssVar('--text-light') || '#94a3b8',

        confirmButtonText: 'Ya, Pulihkan Sekarang',

        cancelButtonText: 'Batal',

        showLoaderOnConfirm: true,

        preConfirm: async () => {

            try {

                const res = await fetch(`${API_BASE}/admin/restore`, {

                    method: 'POST',

                    headers: { 'Content-Type': 'application/json' },

                    body: JSON.stringify({ filename: filename })

                });

                if (!res.ok) {

                    const err = await res.json().catch(() => ({}));

                    throw new Error(err.detail || 'Restore gagal');

                }

                return await res.json();

            } catch (e) {

                Swal.showValidationMessage(`Gagal: ${e.message}`);

            }

        },

        allowOutsideClick: () => !Swal.isLoading()

    });



    if (result.isConfirmed) {

        Swal.fire({

            title: 'Restore Berhasil!',

            text: result.value.message || 'Database berhasil dipulihkan.',

            icon: 'success'

        });

        await loadAdminBackups();

        if (typeof loadDashboardStats === 'function') loadDashboardStats();

        if (typeof loadDashboardBackupInfo === 'function') loadDashboardBackupInfo();
        notifyDataChange('backup');

    }

}



async function handleRestoreFileUpload(input) {

    const file = input.files?.[0];

    if (!file) return;

    input.value = ''; // reset input agar bisa upload file sama jika perlu



    const result = await Swal.fire({

        title: 'Upload & Restore Database?',

        html: `<div class="text-start">

            <p>Anda akan mengunggah dan langsung me-restore file:</p>

            <div class="p-2.5 bg-light border rounded-3 mb-3 font-monospace small text-primary fw-bold text-break">${escHtml(file.name)} (${formatFileSize(file.size)})</div>

            <div class="alert alert-warning border-0 bg-warning bg-opacity-10 text-warning-emphasis small mb-0 py-2">

                <i class="bi bi-exclamation-triangle-fill text-warning me-1"></i>

                <b>Peringatan:</b> Data aktif saat ini akan ditimpa. Backup pengaman otomatis akan dibuat terlebih dahulu sebelum eksekusi.

            </div>

        </div>`,

        icon: 'warning',

        showCancelButton: true,

        confirmButtonColor: cssVar('--info') || '#0d9488',

        cancelButtonColor: cssVar('--text-light') || cssVar('--text-light') || '#94a3b8',

        confirmButtonText: 'Upload & Pulihkan',

        cancelButtonText: 'Batal',

        showLoaderOnConfirm: true,

        preConfirm: async () => {

            try {

                const formData = new FormData();

                formData.append('file', file);

                const res = await fetch(`${API_BASE}/admin/restore-upload`, {

                    method: 'POST',

                    body: formData

                });

                if (!res.ok) {

                    const err = await res.json().catch(() => ({}));

                    throw new Error(err.detail || 'Upload restore gagal');

                }

                return await res.json();

            } catch (e) {

                Swal.showValidationMessage(`Gagal: ${e.message}`);

            }

        },

        allowOutsideClick: () => !Swal.isLoading()

    });



    if (result.isConfirmed) {

        Swal.fire({

            title: 'Restore Berhasil!',

            text: result.value.message || 'File berhasil diunggah dan database telah dipulihkan.',

            icon: 'success'

        });

        await loadAdminBackups();

        if (typeof loadDashboardStats === 'function') loadDashboardStats();

        if (typeof loadDashboardBackupInfo === 'function') loadDashboardBackupInfo();
        notifyDataChange('backup');

    }

}



async function deleteBackup(filename) {

    const result = await Swal.fire({

        title: 'Hapus File Backup?',

        text: `Hapus file "${filename}" dari server? Tindakan ini tidak dapat dibatalkan.`,

        icon: 'question',

        showCancelButton: true,

        confirmButtonColor: cssVar('--danger') || cssVar('--danger') || '#ef4444',

        cancelButtonColor: cssVar('--text-light') || cssVar('--text-light') || '#94a3b8',

        confirmButtonText: 'Ya, Hapus',

        cancelButtonText: 'Batal',

        showLoaderOnConfirm: true,

        preConfirm: async () => {

            try {

                const res = await fetch(`${API_BASE}/admin/backups/${encodeURIComponent(filename)}`, {

                    method: 'DELETE'

                });

                if (!res.ok) {

                    const err = await res.json().catch(() => ({}));

                    throw new Error(err.detail || 'Hapus backup gagal');

                }

                return await res.json();

            } catch(e) {

                Swal.showValidationMessage(`Gagal: ${e.message}`);

            }

        }

    });



    if (result.isConfirmed) {

        showToast('success', 'Terhapus', `File ${filename} berhasil dihapus.`);

        await loadAdminBackups();

        if (typeof loadDashboardBackupInfo === 'function') loadDashboardBackupInfo();
        notifyDataChange('backup');

    }

}



async function createAdminBackup() {
    const btn = event?.currentTarget;
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

            await loadAdminBackups();
            if (typeof loadDashboardBackupInfo === 'function') await loadDashboardBackupInfo();
            notifyDataChange('backup');
            if (typeof loadDashboardStats === 'function') await loadDashboardStats();
        } else {
            const err = await res.json().catch(() => ({}));
            showToast('error', 'Backup Gagal', err.detail || 'Terjadi kesalahan');
        }
    } catch(e) {
        showToast('error', 'Backup Gagal', String(e));
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = origHtml || '<i class="bi bi-cloud-arrow-down-fill"></i> Buat Backup Sekarang';
        }
    }
}



function formatFileSize(bytes) {

    if (bytes === null || bytes === undefined) return '-';

    if (bytes < 1024) return bytes + ' B';

    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';

    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';

}



let adminCurrentPage = 1;
let adminPageSize = 10;

function onAdminSearchInput() {
    adminCurrentPage = 1;
    renderAdminTables();
}

function onAdminFilterChange() {
    adminCurrentPage = 1;
    renderAdminTables();
}

function changeAdminPage(page) {
    adminCurrentPage = page;
    renderAdminTables();
}

function formatDocumentSourceHtml(docName, babNum, docYear) {
    const raw = String(docName || "").trim();
    
    // Bersihkan nama menjadi Publikasi BPS Resmi (tanpa .pdf/.xlsx)
    let cleanName = raw.replace(/\.(xlsx|xls|pdf)$/i, '').replace(/[-_]+/g, ' ').trim();
    // Capitalize words
    cleanName = cleanName.replace(/\b\w/g, l => l.toUpperCase());
    if (!cleanName || cleanName.toLowerCase() === 'template') {
        cleanName = `Kabupaten Tasikmalaya Dalam Angka ${docYear || ''}`.trim();
    }
    
    const babInfo = babNum ? ` · Bab ${babNum}` : '';
    const fullText = cleanName + babInfo;
    
    // Teks murni yang bersih, elegan, dan profesional
    return `<span class="text-truncate text-secondary fw-medium" style="max-width: 560px;" title="${escHtml(fullText)}">${escHtml(fullText)}</span>`;
}

function renderAdminTables() {
    const list = document.getElementById("admin-table-list");
    if (!list) return;
    const tables = window.__adminTables || [];
    const q = (document.getElementById("admin-table-search")?.value || "").trim().toLowerCase();
    const sourceFilter = document.getElementById("admin-filter-source")?.value || "all";
    const yearFilter = document.getElementById("admin-filter-year")?.value || "";
    const sortMode = document.getElementById("admin-sort")?.value || "id";
    const sourceSelect = document.getElementById("admin-filter-source");
    const paginationInfoEl = document.getElementById("admin-pagination-info");
    const paginationListEl = document.getElementById("admin-pagination-list");
    const metricTablesEl = document.getElementById("admin-db-metric-tables");
    const metricRowsEl = document.getElementById("admin-db-metric-rows");

    // Hitung total baris keseluruhan untuk metrik & hitung per jalur
    let totalAllRows = 0;
    let pdfCount = 0;
    let excelCount = 0;
    let webCount = 0;

    tables.forEach(t => {
        totalAllRows += (t.db_rows || 0);
        const docName = String(t.document_name || '').toLowerCase();
        if (docName.endsWith('.xlsx') || docName.endsWith('.xls')) {
            t.__sourceType = 'excel';
            excelCount++;
        } else if (docName.endsWith('.pdf')) {
            t.__sourceType = 'pdf';
            pdfCount++;
        } else {
            t.__sourceType = 'web';
            webCount++;
        }
    });

    if (metricTablesEl) metricTablesEl.textContent = `${tables.length} Tabel`;
    if (metricRowsEl) metricRowsEl.textContent = `${totalAllRows.toLocaleString('id-ID')} Baris`;

    // Update opsi dropdown Jalur Masuk dengan jumlah data real-time
    if (sourceSelect) {
        const optAll = sourceSelect.querySelector('option[value="all"]');
        const optPdf = sourceSelect.querySelector('option[value="pdf"]');
        const optExcel = sourceSelect.querySelector('option[value="excel"]');
        const optWeb = sourceSelect.querySelector('option[value="web"]');
        if (optAll) optAll.textContent = `Semua Jalur Masuk (${tables.length})`;
        if (optPdf) optPdf.textContent = `Ekstraksi PDF (${pdfCount})`;
        if (optExcel) optExcel.textContent = `Import Excel (${excelCount})`;
        if (optWeb) optWeb.textContent = `Entri Manual Web (${webCount})`;
    }

    if (tables.length === 0) {
        list.innerHTML = `<tr><td colspan="5" class="text-center text-muted py-4">Basis data kosong atau belum terhubung.</td></tr>`;
        if (paginationInfoEl) paginationInfoEl.textContent = "Menampilkan 0 dari 0 tabel";
        if (paginationListEl) paginationListEl.innerHTML = "";
        return;
    }

    // Filter Terpadu (Pencarian + Jalur Masuk + Tahun)
    let filtered = tables.filter(t => {
        const matchQ = !q || String(t.table_name || "").toLowerCase().includes(q) ||
            String(t.year || "").toLowerCase().includes(q) ||
            String(t.id || "").includes(q) ||
            String(t.document_name || "").toLowerCase().includes(q);
        const matchSource = sourceFilter === "all" || t.__sourceType === sourceFilter;
        const matchYear = !yearFilter || String(t.year) === yearFilter;
        return matchQ && matchSource && matchYear;
    });

    // Sort
    filtered = filtered.slice();
    if (sortMode === "name") {
        filtered.sort((a, b) => String(a.table_name || "").localeCompare(String(b.table_name || "")));
    } else if (sortMode === "year") {
        filtered.sort((a, b) => (a.year || 0) - (b.year || 0) || (a.id || 0) - (b.id || 0));
    } else if (sortMode === "rows") {
        filtered.sort((a, b) => (b.db_rows || 0) - (a.db_rows || 0) || (a.id || 0) - (b.id || 0));
    } else {
        filtered.sort((a, b) => (a.id || 0) - (b.id || 0));
    }

    const totalFiltered = filtered.length;
    if (totalFiltered === 0) {
        list.innerHTML = `<tr><td colspan="5" class="text-center text-muted py-4">Tidak ada tabel yang cocok dengan filter pencarian.</td></tr>`;
        if (paginationInfoEl) paginationInfoEl.textContent = `Menampilkan 0 dari 0 tabel`;
        if (paginationListEl) paginationListEl.innerHTML = "";
        return;
    }

    // Hitung halaman
    const totalPages = Math.ceil(totalFiltered / adminPageSize) || 1;
    if (adminCurrentPage > totalPages) adminCurrentPage = totalPages;
    if (adminCurrentPage < 1) adminCurrentPage = 1;

    const startIndex = (adminCurrentPage - 1) * adminPageSize;
    const endIndex = Math.min(startIndex + adminPageSize, totalFiltered);
    const paginatedItems = filtered.slice(startIndex, endIndex);

    let html = "";
    paginatedItems.forEach(t => {
        const rowCount = t.db_rows || 0;
        const volumeBadge = `<span class="badge bg-primary-subtle text-primary border border-primary-subtle px-2 py-0.5 rounded-pill fw-semibold" style="font-size:0.72rem;"><i class="bi bi-grid-3x3 me-1"></i>${rowCount.toLocaleString('id-ID')} Baris</span>`;
        const docSourceHtml = formatDocumentSourceHtml(t.document_name, t.bab_num, t.year);

        html += `<tr class="cursor-pointer" onclick="viewState.selectedDocId=${t.document_id || ''}; viewState.selectedBabNum=${t.bab_num || 'null'}; navigateDataTabelTab('publikasi');" title="Klik untuk membuka data tabel di menu Data Tabel">
            <td class="text-center">
                <span class="badge bg-light text-primary border border-primary-subtle px-1.5 py-0.5 rounded-2 font-monospace fw-bold" style="font-size:0.74rem;">
                    #${t.id}
                </span>
            </td>
            <td>
                <div class="d-flex align-items-center flex-wrap" style="line-height:1.4;">${renderCleanTableTitleHtml(t.table_name)}</div>
            </td>
            <td>
                <div class="text-muted small d-flex align-items-center flex-wrap" style="font-size:0.76rem;">
                    ${docSourceHtml}
                </div>
            </td>
            <td class="text-center">
                <span class="badge bg-light text-dark border px-2 py-0.5 rounded-pill" style="font-size:0.72rem;"><i class="bi bi-calendar3 me-1"></i>${t.year}</span>
            </td>
            <td class="text-center">
                ${volumeBadge}
            </td>
        </tr>`;
    });

    list.innerHTML = html;

    // Update Pagination Footer Info
    if (paginationInfoEl) {
        paginationInfoEl.textContent = `Menampilkan ${startIndex + 1} - ${endIndex} dari ${totalFiltered} tabel`;
    }

    // Render Pagination Navigation Buttons
    if (paginationListEl) {
        let pagHtml = "";
        
        // Prev Button
        pagHtml += `<li class="page-item ${adminCurrentPage === 1 ? 'disabled' : ''}">
            <button class="page-link" onclick="changeAdminPage(${adminCurrentPage - 1})" aria-label="Previous">
                <span aria-hidden="true">&laquo;</span>
            </button>
        </li>`;

        // Page Number Windows
        let startPage = Math.max(1, adminCurrentPage - 2);
        let endPage = Math.min(totalPages, startPage + 4);
        if (endPage - startPage < 4) {
            startPage = Math.max(1, endPage - 4);
        }

        if (startPage > 1) {
            pagHtml += `<li class="page-item"><button class="page-link" onclick="changeAdminPage(1)">1</button></li>`;
            if (startPage > 2) pagHtml += `<li class="page-item disabled"><span class="page-link">...</span></li>`;
        }

        for (let p = startPage; p <= endPage; p++) {
            pagHtml += `<li class="page-item ${p === adminCurrentPage ? 'active fw-bold' : ''}">
                <button class="page-link" onclick="changeAdminPage(${p})">${p}</button>
            </li>`;
        }

        if (endPage < totalPages) {
            if (endPage < totalPages - 1) pagHtml += `<li class="page-item disabled"><span class="page-link">...</span></li>`;
            pagHtml += `<li class="page-item"><button class="page-link" onclick="changeAdminPage(${totalPages})">${totalPages}</button></li>`;
        }

        // Next Button
        pagHtml += `<li class="page-item ${adminCurrentPage === totalPages ? 'disabled' : ''}">
            <button class="page-link" onclick="changeAdminPage(${adminCurrentPage + 1})" aria-label="Next">
                <span aria-hidden="true">&raquo;</span>
            </button>
        </li>`;

        paginationListEl.innerHTML = pagHtml;
    }
}

function toggleBackupIcon() {
    const icon = document.getElementById('admin-backup-icon');
    if (icon) icon.textContent = icon.textContent.trim() === '▶' ? '▼' : '▶';
}



document.addEventListener('click', function(e) {

    const toggleEl = e.target.closest('[data-bs-target="#admin-backup-collapse"]');

    if (toggleEl) {

        toggleBackupIcon();

    }

});



async function deleteTableAdmin(id) {

    const { isConfirmed } = await Swal.fire({

        title: 'Hapus Tabel dari Database?',

        text: 'Data tabel ini akan dihapus permanen dari database. Aksi ini tidak dapat dibatalkan.',

        icon: 'warning',

        showCancelButton: true,

        confirmButtonColor: cssVar('--danger') || cssVar('--danger') || '#ef4444',

        cancelButtonColor: cssVar('--swal-cancel') || cssVar('--text-muted') || '#cbd5e1',

        confirmButtonText: 'Ya, Hapus',

        cancelButtonText: 'Batal'

    });

    if (!isConfirmed) return;

    try {

        const res = await fetch(`${API_BASE}/tables/${id}`, { method: 'DELETE' });

        if (res.ok) { showToast('success', 'Terhapus', 'Tabel berhasil dihapus'); loadAdminTables(); loadDashboardStats(); notifyDataChange('table'); }

        else showToast('error', 'Gagal', 'Gagal menghapus');

    } catch(e) { showToast('error', 'Error', e.message); }

}



async function loadAdminDataAnomalies() {

    const dataTbody = document.getElementById('admin-data-anomalies-tbody');

    if (!dataTbody) return;

    dataTbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted py-3">Memuat rincian anomali data...</td></tr>';

    try {

        const dataAnomRes = await fetch(`${API_BASE}/admin/all-data-anomalies`);

        if (!dataAnomRes.ok) throw new Error("Gagal memuat anomali data");

        const dData = await dataAnomRes.json();

        const anomalies = dData.anomalies || [];

        if (anomalies.length === 0) {

            dataTbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted py-3">Tidak ada data anomali. Semua baris dalam kondisi prima.</td></tr>';

            return;

        }

        dataTbody.innerHTML = anomalies.map(a => {

            const cleanName = formatCleanTableName(a.table_name);

            const details = Object.entries(a.data)

                .map(([k, v]) => `<strong>${escHtml(k)}</strong>: <span style="color:${String(v).includes("?") ? cssVar('--danger') || '#ef4444' : cssVar('--text-tertiary') || '#334155'}; font-weight:${String(v).includes("?") ? 'bold' : 'normal'}">${escHtml(String(v || ''))}</span>`)

                .join(" | ");

            return `
                <tr>
                    <td class="fw-medium text-dark text-truncate" style="max-width: 250px;" title="${escHtml(a.table_name)}">
                        <span style="cursor: pointer; color: #4f46e5; text-decoration: underline;" onclick="viewDataEditor(${a.table_id}, '${String(cleanName).replace(/'/g, "\\'")}')">
                            ${escHtml(cleanName)}
                        </span>
                    </td>
                    <td class="text-center text-muted" style="font-size:0.76rem;">${a.document_year}</td>
                    <td style="font-size:0.76rem; color:var(--text-secondary, #475569); max-width:400px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${details.replace(/<[^>]*>/g, '')}">
                        ${details}
                    </td>
                    <td class="text-center">
                        <button class="btn btn-sm btn-action-compact" style="background:#10b981; border-color:#10b981; color:white; font-size:0.72rem; padding:2px 8px; border-radius:5px;" onclick="viewDataEditor(${a.table_id}, '${String(cleanName).replace(/'/g, "\\'")}')">
                            Perbaiki
                        </button>
                    </td>
                </tr>
            `;

        }).join('');

    } catch(e) {

        dataTbody.innerHTML = `<tr><td colspan="4" class="text-center text-danger py-3">Error: ${escHtml(e.message)}</td></tr>`;

    }

}







async function clearAllLoadedData() {

    const { isConfirmed } = await Swal.fire({

        title: 'VERIFIKASI 1: HAPUS SEMUA DATA TER-LOAD?',

        text: "Anda akan menghapus SELURUH isi data baris tabel (TableRow) yang telah dimasukkan ke database. Struktur dokumen dan tabel CSV terdaftar akan tetap dipertahankan. Tindakan ini tidak dapat dibatalkan!",

        icon: 'warning',

        showCancelButton: true,

        confirmButtonColor: cssVar('--danger') || cssVar('--danger') || '#ef4444',

        cancelButtonColor: cssVar('--swal-cancel') || cssVar('--text-muted') || '#cbd5e1',

        confirmButtonText: 'Ya, Lanjut ke Verifikasi 2',

        cancelButtonText: 'Batal'

    });

    

    if (!isConfirmed) return;

    

    const { value: confirmText } = await Swal.fire({

        title: 'VERIFIKASI 2: KONFIRMASI KATA KUNCI',

        input: 'text',

        inputLabel: 'Ketik kata kunci "HAPUS" (huruf kapital) untuk melanjutkan:',

        placeholder: 'HAPUS',

        showCancelButton: true,

        cancelButtonText: 'Batal',

        confirmButtonText: 'Hapus Semua Data',

        confirmButtonColor: cssVar('--danger') || cssVar('--danger') || '#dc2626',

        inputValidator: (value) => {

            if (value !== 'HAPUS') {

                return 'Kata kunci konfirmasi salah!';

            }

        }

    });

    

    if (confirmText !== 'HAPUS') return;



    Swal.fire({

        title: 'Sedang menghapus...',

        html: '<div class="spinner-border text-danger" role="status"><span class="visually-hidden">Loading...</span></div>',

        showConfirmButton: false,

        allowOutsideClick: false

    });



    try {

        const res = await fetch(`${API_BASE}/admin/clear-loaded-data`, { method: 'POST' });

        if (res.ok) {

            showToast('success', 'Berhasil!', 'Semua data baris tabel di database telah berhasil dibersihkan.');

            loadAdminTables();

            loadDashboardStats();

            populateDocumentList();
            notifyDataChange('document');

        } else {

            const d = await res.json();

            showToast('error', 'Gagal', d.detail || 'Terjadi kesalahan di server');

        }

    } catch(e) {

        showToast('error', 'Error', e.message);

    }

}



async function loadAllCsvForDoc(docId, filename) {

    Swal.fire({

        title: 'Load Semua CSV?',

        text: `Apakah Anda yakin ingin memasukkan seluruh tabel dari publikasi "${filename}" ke database? Ini akan menimpa data yang lama.`,

        icon: 'question',

        showCancelButton: true,

        confirmButtonColor: cssVar('--swal-confirm-primary') || cssVar('--indigo-600') || '#4f46e5',

        cancelButtonColor: cssVar('--swal-cancel') || cssVar('--text-muted') || '#cbd5e1',

        confirmButtonText: 'Ya, Load Semua',

        cancelButtonText: 'Batal',

        showLoaderOnConfirm: true,

        preConfirm: async () => {

            try {

                const res = await fetch(`${API_BASE}/documents/${docId}/load-all`, { method: "POST" });

                if (!res.ok) throw new Error("Gagal me-load data");

                return await res.json();

            } catch (err) {

                Swal.showValidationMessage(`Gagal: ${err.message}`);

            }

        },

        allowOutsideClick: () => !Swal.isLoading()

    }).then((result) => {

        if (result.isConfirmed) {

            Swal.fire('Berhasil!', result.value.message, 'success');

            populateDocumentList();

            loadDashboardStats();
            notifyDataChange('document');

        }

    });

}



async function loadAllCsvForBab(docId, babNum) {

    Swal.fire({

        title: `Load Semua CSV Bab ${babNum}?`,

        text: `Apakah Anda yakin ingin memasukkan seluruh tabel dari Bab ${babNum} ke database? Ini akan menimpa data yang lama.`,

        icon: 'question',

        showCancelButton: true,

        confirmButtonColor: cssVar('--swal-confirm-primary') || cssVar('--indigo-600') || '#4f46e5',

        cancelButtonColor: cssVar('--swal-cancel') || cssVar('--text-muted') || '#cbd5e1',

        confirmButtonText: 'Ya, Load Semua',

        cancelButtonText: 'Batal',

        showLoaderOnConfirm: true,

        preConfirm: async () => {

            try {

                const res = await fetch(`${API_BASE}/documents/${docId}/bab/${babNum}/load-all`, { method: "POST" });

                if (!res.ok) throw new Error("Gagal me-load data");

                return await res.json();

            } catch (err) {

                Swal.showValidationMessage(`Gagal: ${err.message}`);

            }

        },

        allowOutsideClick: () => !Swal.isLoading()

    }).then((result) => {

        if (result.isConfirmed) {

            Swal.fire('Berhasil!', result.value.message, 'success');

            populateDocumentList();

            loadDashboardStats();
            notifyDataChange('document');

        }

    });

}



async function deleteAllTablesForDoc(docId, filename) {

    Swal.fire({

        title: 'Hapus Semua Hasil Ekstraksi?',

        text: `Apakah Anda yakin ingin menghapus seluruh tabel hasil ekstraksi untuk "${filename}"? Tindakan ini akan menghapus semua file CSV lokal dan data di database untuk publikasi ini.`,

        icon: 'warning',

        showCancelButton: true,

        confirmButtonColor: cssVar('--danger') || cssVar('--danger') || '#ef4444',

        cancelButtonColor: cssVar('--swal-cancel') || cssVar('--text-muted') || '#cbd5e1',

        confirmButtonText: 'Ya, Hapus Semua',

        cancelButtonText: 'Batal',

        showLoaderOnConfirm: true,

        preConfirm: async () => {

            try {

                const res = await fetch(`${API_BASE}/documents/${docId}/tables`, { method: "DELETE" });

                if (!res.ok) throw new Error("Gagal menghapus");

                return await res.json();

            } catch (err) {

                Swal.showValidationMessage(`Gagal: ${err.message}`);

            }

        },

        allowOutsideClick: () => !Swal.isLoading()

    }).then((result) => {

        if (result.isConfirmed) {

            Swal.fire('Berhasil!', result.value.message || 'Semua hasil ekstraksi berhasil dihapus.', 'success');

            viewState.selectedBabNum = null;

            populateDocumentList();

            loadDashboardStats();
            notifyDataChange('document');

        }

    });

}



async function deleteAllTablesForBab(docId, babNum) {

    Swal.fire({

        title: `Hapus Semua Tabel Bab ${babNum}?`,

        text: `Apakah Anda yakin ingin menghapus seluruh tabel hasil ekstraksi untuk Bab ${babNum}? Tindakan ini akan menghapus file CSV lokal dan data di database.`,

        icon: 'warning',

        showCancelButton: true,

        confirmButtonColor: cssVar('--danger') || cssVar('--danger') || '#ef4444',

        cancelButtonColor: cssVar('--swal-cancel') || cssVar('--text-muted') || '#cbd5e1',

        confirmButtonText: 'Ya, Hapus Semua',

        cancelButtonText: 'Batal',

        showLoaderOnConfirm: true,

        preConfirm: async () => {

            try {

                const res = await fetch(`${API_BASE}/documents/${docId}/bab/${babNum}`, { method: "DELETE" });

                if (!res.ok) throw new Error("Gagal menghapus");

                return await res.json();

            } catch (err) {

                Swal.showValidationMessage(`Gagal: ${err.message}`);

            }

        },

        allowOutsideClick: () => !Swal.isLoading()

    }).then((result) => {

        if (result.isConfirmed) {

            Swal.fire('Berhasil!', result.value.message || 'Semua tabel bab berhasil dihapus.', 'success');

            viewState.selectedBabNum = null;

            populateDocumentList();

            loadDashboardStats();
            notifyDataChange('document');

        }

    });

}



function openDocFromDashboard(docId) {

    viewState.selectedDocId = docId;

    viewState.selectedBabNum = null;

    navigate('publikasi', document.getElementById('nav-publikasi'));

    populateDocumentList();

}



