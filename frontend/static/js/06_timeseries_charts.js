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

        if (isMobile) {
            // Mobile: dropdown muncul di BAWAH kartu admin
            let targetTop = rect.bottom + 8;
            if (targetTop + dropHeight > window.innerHeight - 10) {
                targetTop = Math.max(10, window.innerHeight - dropHeight - 10);
            }
            dropdown.style.top = Math.round(targetTop) + 'px';
            dropdown.style.left = '8px';
            dropdown.classList.add('dropdown-below');
        } else {
            // Desktop: dropdown muncul di SEBELAH KANAN kartu admin
            dropdown.style.top = Math.round(targetTop) + 'px';
            dropdown.style.left = Math.round(rect.right + 12) + 'px';
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

        // Pastikan state sidebar-collapsed langsung terkunci sebelum browser render frame berikutnya
        const savedState = localStorage.getItem('sipedas_sidebar_collapsed');
        const hasCookie = document.cookie.indexOf('sipedas_sidebar_collapsed=true') !== -1;
        const isCollapsed = savedState === 'true' || (savedState === null && hasCookie);
        if (isCollapsed) {
            document.body.classList.add('sidebar-collapsed');
            document.documentElement.classList.add('sidebar-collapsed-early');
        }

        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                document.documentElement.classList.remove('no-sidebar-transition');
            });
        });
    }

    const btnLogin = document.getElementById('btn-admin-login');
    const btnLogout = document.getElementById('btn-admin-logout');
    const userWidget = document.getElementById('sidebar-user-widget');

    if (isAdmin) {

        if (btnLogin) btnLogin.style.setProperty('display', 'none', 'important');
        if (userWidget) userWidget.style.setProperty('display', 'block', 'important');

        if (btnLogout) btnLogout.style.setProperty('display', 'none', 'important');

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

            const inp = document.getElementById('swal-login-password');

            if (inp) {

                inp.focus();

                inp.addEventListener('keydown', (e) => {

                    if (e.key === 'Enter') Swal.clickConfirm();

                });

            }

        },

        preConfirm: async () => {

            const pwInp = document.getElementById('swal-login-password');

            const pw = pwInp ? pwInp.value.trim() : '';

            if (!pw) {

                Swal.showValidationMessage('Silakan masukkan password terlebih dahulu.');

                return false;

            }

            try {

                const res = await fetch(`${API_BASE}/auth/login`, {

                    method: 'POST',

                    headers: { 'Content-Type': 'application/json' },

                    credentials: 'same-origin',

                    body: JSON.stringify({ password: pw })

                });

                if (!res.ok) {

                    const err = await res.json().catch(() => ({}));

                    Swal.showValidationMessage(err.detail || 'Password salah!');

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

        list.innerHTML = `<div class="table-responsive bg-white rounded-3 border"><table class="table table-hover align-middle mb-0" style="font-size:0.875rem;">

            <thead class="table-light">

                <tr>

                    <th class="fw-semibold">Nama File Cadangan</th>

                    <th class="fw-semibold text-center" style="width:110px;">Ukuran</th>

                    <th class="fw-semibold text-center" style="width:160px;">Tanggal Dibuat</th>

                    <th class="fw-semibold text-end pe-3" style="width:230px;">Aksi Kontrol</th>

                </tr>

            </thead><tbody>${files.map(f => {

                const fnEsc = f.file.replace(/'/g, "\\'");

                return `<tr>

                    <td style="word-break:break-all;" class="fw-medium text-dark">

                        <i class="bi bi-file-earmark-code text-teal me-1.5"></i>${escHtml(f.file)}

                    </td>

                    <td class="text-nowrap text-center text-muted small">${formatFileSize(f.size)}</td>

                    <td class="text-nowrap text-center text-muted small">${f.modified}</td>

                    <td class="text-end pe-3">

                        <div class="d-inline-flex gap-1">

                            <a href="${API_BASE}/admin/backups/${encodeURIComponent(f.file)}" download="${escHtml(f.file)}" class="btn btn-sm btn-outline-secondary py-1 px-2 d-inline-flex align-items-center gap-1 shadow-none" style="font-size:0.75rem;" title="Unduh file SQL ini ke komputer">
                                <i class="bi bi-download"></i> Unduh
                            </a>

                            <button onclick="restoreBackup('${fnEsc}')" class="btn btn-sm btn-outline-teal py-1 px-2 d-inline-flex align-items-center gap-1 shadow-none" style="font-size:0.75rem; border-color:#0d9488; color:#0d9488;" title="Pulihkan database dari file ini">

                                <i class="bi bi-arrow-counterclockwise"></i> Restore

                            </button>

                            <button onclick="deleteBackup('${fnEsc}')" class="btn btn-sm btn-outline-danger py-1 px-2 d-inline-flex align-items-center gap-1 shadow-none" style="font-size:0.75rem;" title="Hapus file cadangan ini">

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
        const volumeBadge = `<span class="badge bg-primary-subtle text-primary border border-primary-subtle px-2.5 py-0.5 rounded-pill fw-semibold" style="font-size:0.75rem;"><i class="bi bi-grid-3x3 me-1"></i>${rowCount.toLocaleString('id-ID')} Baris</span>`;
        const docSourceHtml = formatDocumentSourceHtml(t.document_name, t.bab_num, t.year);

        html += `<tr class="cursor-pointer" onclick="viewState.selectedDocId=${t.document_id || ''}; viewState.selectedBabNum=${t.bab_num || 'null'}; navigateDataTabelTab('publikasi');" title="Klik untuk membuka data tabel di menu Data Tabel">
            <td class="text-center">
                <span class="badge bg-light text-primary border border-primary-subtle px-2 py-1 rounded-2 font-monospace fw-bold" style="font-size:0.78rem;">
                    #${t.id}
                </span>
            </td>
            <td>
                <div class="d-flex align-items-center flex-wrap" style="line-height:1.35;">${renderCleanTableTitleHtml(t.table_name)}</div>
            </td>
            <td>
                <div class="text-muted small d-flex align-items-center flex-wrap" style="font-size:0.8rem;">
                    ${docSourceHtml}
                </div>
            </td>
            <td class="text-center">
                <span class="badge bg-light text-dark border px-2 py-0.5 rounded-pill" style="font-size:0.75rem;"><i class="bi bi-calendar3 me-1"></i>${t.year}</span>
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

                <tr style="border-bottom: 1px solid #f1f5f9;">

                    <td style="padding: 10px; font-weight: 500; color: #334155; max-width: 280px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${escHtml(a.table_name)}">

                        <span style="cursor: pointer; color: #4f46e5; text-decoration: underline;" onclick="viewDataEditor(${a.table_id}, '${String(cleanName).replace(/'/g, "\\'")}')">

                            ${escHtml(cleanName)}

                        </span>

                    </td>

                    <td style="padding: 10px; text-align: center; color: #64748b;">${a.document_year}</td>

                    <td style="padding: 10px; font-size:0.8rem; color:var(--text-secondary, #475569); max-width:450px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${details.replace(/<[^>]*>/g, '')}">

                        ${details}

                    </td>

                    <td style="padding: 10px; text-align: center;">

                        <button class="btn btn-small" style="background:#10b981; border-color:#10b981; color:white; padding:4px 10px; font-size:0.8rem; cursor:pointer;" onclick="viewDataEditor(${a.table_id}, '${String(cleanName).replace(/'/g, "\\'")}')">

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

                        <input type="text" id="${selectId(i)}" class="master-select-input" placeholder="” Cari & Pilih Master Kolom..." style="flex:1; min-width:220px; padding:8px 12px; border-radius:6px; border:1.5px solid #cbd5e1; font-size:0.88rem; background:#fff; cursor:pointer;" readonly onclick="showCustomDropdown(${i})" title="Klik untuk memilih master kolom">

                        ${sameKwCount > 1 ? `

                        <button type="button" title="Salin nilai master ini ke semua kolom yang mengandung '${escHtml(kw)}'" style="background:#eff6ff; border:1px solid #bfdbfe; border-radius:6px; padding:7px 10px; cursor:pointer; font-size:0.78rem; color:#1d4ed8; font-weight:600; display:flex; align-items:center; gap:4px; white-space:nowrap; flex-shrink:0;" onclick="copyMasterToSimilar(${i}, '${kw.replace(/'/g, "\\'")}')" onmouseenter="this.style.background='#dbeafe'" onmouseleave="this.style.background='#eff6ff'">

                            <span>📋 Salin Sejenis</span>

                        </button>

                        ` : ''}

                        <button type="button" title="Salin nilai master baris ini ke semua kolom yang tercentang" style="background:#f1f5f9; border:1px solid #cbd5e1; border-radius:6px; padding:7px 10px; cursor:pointer; font-size:0.78rem; color:var(--text-secondary, #475569); font-weight:500; display:flex; align-items:center; gap:4px; white-space:nowrap; flex-shrink:0;" onclick="copyMasterToChecked(${i})" onmouseenter="this.style.background=cssVar('--border') || '#e2e8f0'" onmouseleave="this.style.background=cssVar('--bg-hover') || '#f1f5f9'">

                            <span>📑 Ke Tercentang</span>

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

                <span style="font-size:0.8rem; font-weight:700; color:var(--text-secondary, #475569);">🎯 Pilih Cepat Kolom:</span>

                ${uniqueKeywords.map(kw => `

                    <button type="button" style="background:#eff6ff; color:#1d4ed8; border:1px solid #bfdbfe; border-radius:14px; padding:3px 12px; font-size:0.78rem; font-weight:600; cursor:pointer; transition:all 0.15s;" onclick="selectColumnsByKeyword('${kw.replace(/'/g, "\\'")}')" onmouseenter="this.style.background='#dbeafe'" onmouseleave="this.style.background='#eff6ff'">

                        ${escHtml(kw)}

                    </button>

                `).join('')}

                <button type="button" style="background:#f1f5f9; color:var(--text-secondary, #475569); border:1px solid #cbd5e1; border-radius:14px; padding:3px 10px; font-size:0.76rem; cursor:pointer;" onclick="selectColumnsByKeyword('all')">Semua</button>

                <button type="button" style="background:#fef2f2; color:#b91c1c; border:1px solid #fecaca; border-radius:14px; padding:3px 10px; font-size:0.76rem; cursor:pointer;" onclick="selectColumnsByKeyword('')">¢Ã…â€™ Hapus Pilihan</button>

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

                        <input type="text" id="bulk-ren-sel" class="master-select-input" placeholder="” Cari & Pilih Master Kolom untuk diterapkan massal..." style="width: 100%; padding: 9px 14px; border-radius: 8px; border: 1.5px solid #cbd5e1; font-size: 0.9rem; background: #fff; cursor: pointer; box-shadow: 0 1px 2px rgba(0,0,0,0.04);" readonly onclick="showBulkCustomDropdown()">

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



