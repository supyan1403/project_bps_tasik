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
    
    kolomDiv.innerHTML = '<div style="padding:4px;color:#94a3b8;font-size:0.85rem;"><i>Memuat master kolom...</i></div>';
    
    try {
        const res = await fetch(`${API_BASE}/timeseries/indicator-years`);
        const data = await res.json();
        tsIndicatorsList = data.indicators || [];
        tsIndicatorsList.sort((a, b) => {
            const oa = Array.isArray(a.order) ? a.order : [9999, 9999];
            const ob = Array.isArray(b.order) ? b.order : [9999, 9999];
            return (oa[0] - ob[0]) || (oa[1] - ob[1]) || (a.name || '').localeCompare(b.name || '');
        });
        
        renderTSIndicatorsCheckboxes(tsIndicatorsList);
    } catch (err) {
        console.error("Gagal inisialisasi wizard:", err);
        kolomDiv.innerHTML = '<span class="text-danger" style="font-size:0.75rem;">Gagal memuat master kolom</span>';
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
}
// ── End Wizard ────────────────────────────────────────────

async function searchTimeSeries(e) {
    if (e && e.preventDefault) e.preventDefault();
    tsForceRecreateChart = true;

    var indicators, keyword, startYear, endYear;
    
    if (lastTimeSeriesSearchParams && !e) {
        keyword = lastTimeSeriesSearchParams.keyword;
        startYear = lastTimeSeriesSearchParams.startYear;
        endYear = lastTimeSeriesSearchParams.endYear;
    } else {
        showToast('info', 'Info', 'Gunakan Wizard Analisis Deret Waktu untuk pencarian baru.');
        return;
    }
    
    document.getElementById("ts-results-loading").style.display = "block";
    document.getElementById("ts-results-content").style.display = "none";
    document.getElementById("ts-results-empty").style.display = "none";
    document.getElementById("ts-table-picker").style.display = "none";
    
    try {
        let url = `${API_BASE}/search/timeseries?keyword=${encodeURIComponent(keyword)}`;
        if (startYear) url += `&start_year=${startYear}`;
        if (endYear) url += `&end_year=${endYear}`;
        
        const res = await fetch(url);
        const data = await res.json();
        
        document.getElementById("ts-results-loading").style.display = "none";
        
        if (!data.data || data.data.length === 0) {
            document.getElementById("ts-results-empty").style.display = "block";
            return;
        }
        
        currentMatchedTables = data.data;
        renderTimeSeriesTable(data.data, keyword);
        
    } catch (err) {
        document.getElementById("ts-results-loading").style.display = "none";
        showToast('error', 'Error', 'Gagal memuat data deret waktu: ' + err.message);
    }
}

function getTableNumberOrCleanName(tableName) {
    const numMatch = tableName.match(/^(Tabel[\s_]*\d+(?:\.\d+)*\s*|^\d+(?:\.\d+)+\s*)/i);
    if (numMatch) {
        var prefix = numMatch[1].trim();
        var digits = prefix.replace(/^tabel\s*/i, '');
        var parts = digits.split('.');
        if (parts.length >= 2) return digits;
        return prefix;
    }
    let clean = tableName.replace(/\d{4}/g, '').replace(/\(Hal.*?\)/g, '').replace(/-\s*$/, '').trim();
    return clean;
}

/** Bersihkan nama kolom/indikator agar konsisten dengan master kolom:
 *  buang suffix deduplikasi (".1", ".2", dst), tahun, bulan, dan separator di akhir. */
function cleanIndicatorName(name) {
    if (!name) return name;
    var n = String(name).trim();
    var prev;
    do {
        prev = n;
        n = n.replace(/\.\d+(?:\s*\([^)]*\))?\s*$/, '');
        n = n.replace(/[\s,;–—(\-]+\d{4}(?:\s*[–\-/]\s*\d{4})?\s*\)?\s*$/, '');
        n = n.replace(/(Jan(?:uari)?|Feb(?:ruari)?|Mar(?:et)?|Apr(?:il)?|Mei|Jun(?:i)?|Jul(?:i)?|Ag(?:ustus)?t?|Sep(?:tember)?|Okt(?:ober)?|Nov(?:ember)?|Des(?:ember)?)[\s,;:.\-–]*\s*$/i, '');
        n = n.replace(/[\s,;:.\-–]+$/, '');
        n = n.trim();
    } while (n !== prev && n.length > 0);
    return n;
}

function showTablePicker(tablesData, keyword) {
    const tableGroups = {};
    tablesData.forEach(t => {
        const groupKey = t.table_id + "_" + t.table_name;

        if (!tableGroups[groupKey]) {
            tableGroups[groupKey] = {
                displayName: t.table_name,
                tables: [t]
            };
        }
    });
    
    const groupKeys = Object.keys(tableGroups);

    // Hapus pengecekan groupKeys.length === 1 agar picker SELALU muncul meskipun hanya ada 1 tabel/grup,
    // sehingga Anda selalu punya kendali penuh untuk memilih atau melihat tabel spesifik.
    
    let pickerHtml = `
    <div style="margin: 1rem 0; padding: 1rem; background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px;">
        <p style="margin-bottom: 0.75rem; font-weight: 600; color: #0369a1;">
            🔍 Ditemukan <strong>${groupKeys.length}</strong> varian/tabel yang sesuai dengan kata kunci "<strong>${keyword}</strong>".
            <br><span style="font-weight: 400; font-size: 0.9rem;">Silakan pilih tabel spesifik yang ingin ditampilkan dalam analisis deret waktu:</span>
        </p>
        <div style="display: flex; flex-direction: column; gap: 0.5rem;">
    `;
    
    groupKeys.forEach(groupKey => {
        const group = tableGroups[groupKey];
        const years = group.tables.map(t => t.year).sort((a,b)=>a-b);
        const yearsStr = years.join(", ");
        const tableIdsStr = group.tables.map(t => t.table_id).join(",");
        
        pickerHtml += `
        <button class="btn btn-small btn-primary" style="text-align:left; padding: 8px 12px; font-size: 0.9rem;"
            onclick="selectTableGroupForTimeSeries('${tableIdsStr}', '${keyword}')">
            ${group.displayName}
            <span style="opacity: 0.8; font-size: 0.8rem; display: block;">Tersedia: Tahun ${yearsStr}</span>
        </button>`;
    });
    
    pickerHtml += `</div></div>`;
    
    const pickerEl = document.getElementById("ts-table-picker");

    pickerEl.innerHTML = pickerHtml;
    pickerEl.style.display = "block";

}

function selectTableGroupForTimeSeries(tableIdsStr, keyword) {
    document.getElementById("ts-table-picker").style.display = "none";
    tsForceRecreateChart = true;
    const ids = tableIdsStr.split(",").map(Number);
    const filteredTables = currentMatchedTables.filter(t => ids.includes(t.table_id));
    renderTimeSeriesTable(filteredTables, keyword);
}

function _sortEntitiesWithKabLast(arr) {
    return arr.sort(function(a, b) {
        var aa = a === 'Kabupaten Tasikmalaya', bb = b === 'Kabupaten Tasikmalaya';
        if (aa && !bb) return 1;
        if (!aa && bb) return -1;
        var ma = a.match(/^(\d+)/), mb = b.match(/^(\d+)/);
        if (ma && mb) return parseInt(ma[1],10) - parseInt(mb[1],10) || a.localeCompare(b);
        if (ma) return -1;
        if (mb) return 1;
        return a.localeCompare(b);
    });
}

function formatIndoNumber(val) {
    if (typeof val !== 'string' && typeof val !== 'number') return null;
    var s = String(val).trim();
    if (s === '' || s === '-' || s === '...' || s === '—' || s === '–') return null;
    var negative = s.indexOf('-') === 0;
    var body = negative ? s.substring(1) : s;
    if (!/^\d[\d\s.]*[.,]?\d*$/.test(body)) return null;

    var hasComma = body.indexOf(',') !== -1;
    var noSpace = body.replace(/\s/g, '');
    var isThousandsPattern = /^\d{1,3}(\.\d{3})+$/.test(noSpace) && !/^0\./.test(noSpace);
    var clean;
    if (hasComma) {
        clean = body.replace(/[\s.]/g, '').replace(',', '.');
    } else if (isThousandsPattern) {
        clean = noSpace.replace(/\./g, '');
    } else {
        clean = noSpace;
    }
    if (clean === '.' || clean === '') return null;
    if (clean.endsWith('.')) clean = clean.slice(0, -1);
    if (!/^\d+(\.\d+)?$/.test(clean)) return null;
    var num = parseFloat(clean);
    if (isNaN(num)) return null;
    if (num === Math.floor(num)) {
        var intStr = String(Math.abs(num));
        intStr = intStr.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
        return (negative ? '-' : '') + intStr;
    }
    var fixed = num.toFixed(2);
    var parts = fixed.split('.');
    var intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    var out = intPart + ',' + parts[1];
    return (negative ? '-' : '') + out;
}

function findCommonPrefix(strings) {
    if (!strings || strings.length <= 1) return '';
    const parts = strings.map(s => s.replace(/^Tabel\s+[\d.]+/i, '').trim());
    let prefix = parts[0];
    for (let i = 1; i < parts.length; i++) {
        while (!parts[i].startsWith(prefix) && prefix.length > 0) {
            prefix = prefix.slice(0, -1);
        }
        if (prefix.length === 0) break;
    }
    return prefix.trim();
}

function extractSubType(tableName, allNames) {
    if (!tableName) return '';
    let s = String(tableName).trim();

    // 1. Bersihkan prefix nomor tabel (contoh: "Tabel 3.1.2 - ", "3.1.2 ")
    s = s.replace(/^Tabel\s*[\d.]+\s*[-–—:]*\s*/i, '');
    s = s.replace(/^\d+(\.\d+)+\s*[-–—:]*\s*/, '');

    // 2. Bersihkan suffix halaman (contoh: "(Hal 61)", "(Hal 68, 69, 70)", "(Halaman 10)")
    s = s.replace(/\s*\(\s*(?:Hal|Halaman)\s*[\d\s,.\-–—]+\)\s*$/i, '');
    s = s.replace(/\s*\(\s*(?:Hal|Halaman)\s*[\d\s,.\-–—]+\)/gi, '');

    // 3. Bersihkan satuan dalam tanda kurung (contoh: "(orang)", "(jiwa)", "(ha)", "(km)", "(ribu rupiah)")
    s = s.replace(/\s*\(\s*(?:orang|jiwa|ha|hektar|ton|persen|km|ribu rupiah|juta rupiah|milyar rupiah|rupiah|ekor|butir|buah|unit|lembar|kg|kuintal|meter|m2|m3|persen\s*\(%\)|%)\s*\)/gi, '');

    // 4. Bersihkan penanda waktu/bulan/tahun di akhir (contoh: ", Desember 2024", "Tahun 2025", "2021-2022", "2023")
    s = s.replace(/[\s,;–—\-]+(?:Desember|Januari|Februari|Maret|April|Mei|Juni|Juli|Agustus|September|Oktober|November|Des|Jan|Feb|Mar|Apr|Mei|Jun|Jul|Agu|Agust|Sep|Okt|Nov)?\s*(?:Tahun\s*)?\d{4}(?:\s*[-–—/]\s*\d{4})?\s*$/i, '');
    s = s.replace(/\s*Tahun\s*\d{4}(?:\s*[-–—/]\s*\d{4})?\s*$/i, '');
    s = s.replace(/\s*\(\s*\d{4}(?:\s*[-–—/]\s*\d{4})?\s*\)\s*$/i, '');
    s = s.replace(/[\s,;–—\-]+\d{4}(?:\s*[-–—/]\s*\d{4})?\s*$/i, '');
    s = s.replace(/[\s,;–—\-]+$/, '').trim();

    // 5. Cek apakah ada pola "Menurut / Berdasarkan / Per"
    const menurutMatch = s.match(/\b(Menurut|Berdasarkan|Per)\s+(.+)$/i);
    if (menurutMatch) {
        let dim = menurutMatch[2].trim();

        // Bersihkan wilayah di akhir dimensi (contoh: "di Kabupaten Tasikmalaya", "di Provinsi...")
        dim = dim.replace(/\s+di\s+(?:Kabupaten|Kota|Provinsi).*$/i, '').trim();

        // Bersihkan sub-dimensi sekunder kolom jika ada dimensi utama di depannya
        // Contoh: "Jabatan, Jenis ASN, dan Jenis Kelamin" -> "Jabatan"
        // Contoh: "Jabatan dan Jenis Kelamin" -> "Jabatan"
        // Contoh: "Tingkat Pendidikan, Jenis ASN, dan Jenis Kelamin" -> "Tingkat Pendidikan"
        let simplifiedDim = dim;
        simplifiedDim = simplifiedDim.replace(/,\s*Jenis\s+ASN\b/gi, '');
        simplifiedDim = simplifiedDim.replace(/(?:,\s*|\s+)dan\s+Jenis\s+Kelamin\b/gi, '');
        simplifiedDim = simplifiedDim.replace(/,\s*Jenis\s+Kelamin\b/gi, '');
        simplifiedDim = simplifiedDim.replace(/(?:,\s*|\s+)dan\s+Jenis\s+ASN\b/gi, '');
        simplifiedDim = simplifiedDim.replace(/[\s,;–—\-]+$/, '').trim();

        if (simplifiedDim.length > 0) {
            if (/^(Tingkat\s+Pendidikan|Pendidikan)$/i.test(simplifiedDim)) {
                simplifiedDim = "Tingkat Pendidikan";
            } else if (/^(Tingkat\s+Kepangkatan|Kepangkatan|Pangkat|Tingkat\s+Pangkat)$/i.test(simplifiedDim)) {
                simplifiedDim = "Tingkat Kepangkatan";
            } else if (/^Jabatan$/i.test(simplifiedDim)) {
                simplifiedDim = "Jabatan";
            }
            dim = simplifiedDim;
        }

        // Format: "Menurut " + Capitalized Words
        let keyword = menurutMatch[1].charAt(0).toUpperCase() + menurutMatch[1].slice(1).toLowerCase();
        let formattedDim = dim.split(/\s+/).map(w => {
            if (/^(dan|atau|di|ke|dari|pada|untuk|dengan|yang|per|se)$/i.test(w)) return w.toLowerCase();
            return w.charAt(0).toUpperCase() + w.slice(1);
        }).join(' ');

        return `${keyword} ${formattedDim}`.trim();
    }

    // 6. Fallback jika tidak ada kata "Menurut"
    const prefix = findCommonPrefix(allNames || []);
    if (prefix && s.toLowerCase().startsWith(prefix.toLowerCase())) {
        const sub = s.slice(prefix.length).replace(/^[\s,;–—\-:]+/, '').trim();
        if (sub) return normalizeSubType(sub);
    }

    return normalizeSubType(s);
}

function normalizeSubType(name) {
    if (!name) return '';
    let s = name.trim();
    s = s.replace(/\s*\(\s*(?:Hal|Halaman)\s*[\d\s,.\-–—]+\)\s*$/i, '');
    s = s.replace(/\s*\(\s*\d{4}\s*[-–—~]\s*\d{4}\s*\)\s*$/i, '');
    s = s.replace(/\s*\(\s*\d{4}\s*\)\s*$/i, '');
    s = s.replace(/\s*[-–—~]\s*\d{4}\s*$/i, '');
    s = s.replace(/\s*Tahun\s*\d{4}(?:\s*[-–—/]\s*\d{4})?\s*$/i, '');
    s = s.replace(/\s*\d{4}\s*$/i, '');
    s = s.replace(/[\s,;–—\-]+$/, '').trim();
    return s;
}

function renderSubTypePicker(subTypes, selectedSubType) {
    const container = document.getElementById('ts-tipe-rincian-picker');
    if (!container) return;
    if (!subTypes || subTypes.length <= 1) {
        container.innerHTML = '';
        container.style.display = 'none';
        return;
    }
    container.style.display = 'flex';
    container.className = 'd-flex flex-column gap-2 w-100 pt-3 mt-3 border-top';
    
    let html = `
        <div class="d-flex align-items-center justify-content-between flex-wrap gap-2">
            <span class="ts-filter-section-title"><i class="bi bi-diagram-3-fill text-primary"></i> VARIAN RINCIAN:</span>
        </div>
        <div class="d-flex align-items-center flex-wrap" style="gap: 8px;">
            <label class="ts-variant-chip ${selectedSubType === 'Semua' ? 'active' : ''}">
                <input type="radio" name="ts-subtype" value="Semua" ${selectedSubType === 'Semua' ? 'checked' : ''}>
                <span>Semua Varian</span>
            </label>`;
    
    subTypes.forEach(st => {
        const isActive = (selectedSubType === st);
        html += `
            <label class="ts-variant-chip ${isActive ? 'active' : ''}">
                <input type="radio" name="ts-subtype" value="${escHtml(st)}" ${isActive ? 'checked' : ''}>
                <span>${escHtml(st)}</span>
            </label>`;
    });
    
    html += `</div>`;
    container.innerHTML = html;
    
    container.querySelectorAll('input[name="ts-subtype"]').forEach(radio => {
        radio.addEventListener('change', function() {
            container.querySelectorAll('.ts-variant-chip').forEach(c => c.classList.remove('active'));
            const parent = this.closest('.ts-variant-chip');
            if (parent) parent.classList.add('active');

            tsCurrentSubType = this.value;
            tsHiddenEntities.clear();
            
            // Simpan pilihan VK saat ini
            const vkCbs = document.querySelectorAll('.ts-vk-cb');
            tsSavedVKChecks = Array.from(vkCbs).map(cb => cb.dataset.vk + ':' + cb.checked);
            
            // Render ulang dengan data asli + filter sub-type
            if (tsOriginalTablesData && tsCurrentKeyword) {
                renderTimeSeriesTable(tsOriginalTablesData, tsCurrentKeyword, true);
                
                // Kembalikan pilihan VK
                if (tsSavedVKChecks) {
                    tsSavedVKChecks.forEach(pair => {
                        const parts = pair.split(':');
                        const vk = parts[0];
                        const checked = parts[1] === 'true';
                        const cb = document.querySelector('.ts-vk-cb[data-vk="' + vk + '"]');
                        if (cb) cb.checked = checked;
                    });
                    if (tsRenderCallback) tsRenderCallback();
                }
            }
        });
    });
}

function renderTimeSeriesTable(tablesData, keyword, isSubTypeChange = false) {
    // Reset data asli jika pemanggilan adalah pencarian baru, bukan sekadar klik radio varian
    if (!isSubTypeChange || !tsOriginalTablesData) {
        tsOriginalTablesData = tablesData;
        tsCurrentKeyword = keyword;
        tsCurrentSubType = 'Semua';
        tsHiddenEntities.clear();
        tsSavedVKChecks = null;

        const firstTable = (tablesData && tablesData[0]) || {};
        const firstUnit = (firstTable.units && firstTable.units[1]) || '';
        const newFamily = detectUnitFamily(firstUnit, keyword, firstTable.table_name);
        const oldFamily = tsActiveUnitKey ? Object.keys(UNIVERSAL_UNIT_FAMILIES).find(fk => UNIVERSAL_UNIT_FAMILIES[fk].units[tsActiveUnitKey]) : null;
        if (newFamily !== oldFamily) {
            tsActiveUnitKey = newFamily ? UNIVERSAL_UNIT_FAMILIES[newFamily].baseUnit : null;
        }
    }
    
    // Deteksi sub-type dari kolom pertama (entity_key) setiap tabel
    const uniqueSubTypes = [...new Set(
        (tsOriginalTablesData || tablesData).map(t => t.entity_key || t.headers?.[0] || '').filter(Boolean)
    )];
    
    // Render picker sub-type (mengganti Filter Tipe Rincian) jika ada >1 varian
    if (uniqueSubTypes.length > 1) {
        renderSubTypePicker(uniqueSubTypes, tsCurrentSubType);
    } else {
        const container = document.getElementById('ts-tipe-rincian-picker');
        if (container) {
            container.innerHTML = '';
            container.style.display = 'none';
        }
        tsCurrentSubType = 'Semua';
    }
    
    // Filter data berdasarkan sub-type yang dipilih
    let filteredData = tsOriginalTablesData || tablesData;
    if (tsCurrentSubType !== 'Semua' && tsOriginalTablesData) {
        filteredData = tsOriginalTablesData.filter(t => {
            return (t.entity_key || t.headers?.[0] || '') === tsCurrentSubType;
        });
    }
    
    tsHiddenEntities.clear();
    const titleEl = document.getElementById("ts-result-title");
    const badgesEl = document.getElementById("ts-result-badges");
    const rawKeywords = (keyword || '').split(',').map(k => k.trim()).filter(Boolean);

    if (titleEl) {
        if (rawKeywords.length === 1) {
            titleEl.innerHTML = `<span>📊 Deret Waktu: <span class="text-primary fw-semibold">${escHtml(rawKeywords[0])}</span></span>`;
        } else if (rawKeywords.length > 1) {
            titleEl.innerHTML = `<span>📊 Hasil Analisis Deret Waktu <span class="badge bg-primary-subtle text-primary border ms-2" style="font-size:0.78rem; font-weight:600;">${rawKeywords.length} Indikator</span></span>`;
        } else {
            titleEl.innerHTML = `<span>📊 Hasil Analisis Deret Waktu</span>`;
        }
    }
    if (badgesEl) {
        if (rawKeywords.length > 1) {
            badgesEl.innerHTML = rawKeywords.map(ind => `<span class="badge bg-light text-secondary border px-2.5 py-1.5 rounded-pill shadow-xs" style="font-size:0.76rem; font-weight:500; letter-spacing:0.1px;">${escHtml(ind)}</span>`).join('');
            badgesEl.style.display = 'flex';
        } else {
            badgesEl.innerHTML = '';
            badgesEl.style.display = 'none';
        }
    }
    document.getElementById("ts-results-content").style.display = "block";
    document.getElementById("ts-table-picker").style.display = "none";
    
    // Deteksi dan tampilkan banner anomali deret waktu
    const detectedAnomalies = detectClientTimeSeriesAnomalies(filteredData);
    const anomMap = {};
    detectedAnomalies.forEach(a => {
        anomMap[a.entitas + '::' + a.indicator + '::' + a.year] = a;
    });

    let existingBanner = document.getElementById('ts-anomaly-banner');
    if (detectedAnomalies && detectedAnomalies.length > 0) {
        let anomListHtml = detectedAnomalies.slice(0, 4).map(a => `<li style="margin-bottom:2px;"><b>${escHtml(a.entitas)} (${a.year}):</b> ${escHtml(a.message)}</li>`).join('');
        if (detectedAnomalies.length > 4) {
            anomListHtml += `<li style="list-style:none; font-style:italic; margin-top:3px;">...dan ${detectedAnomalies.length - 4} anomali lainnya (lihat menu Admin &gt; Anomali Deret Waktu)</li>`;
        }
        const bannerHtml = `
            <div style="display:flex; align-items:flex-start; gap:10px;">
                <span style="font-size:1.25rem; line-height:1;">⚠️</span>
                <div style="flex-grow:1;">
                    <div style="font-weight:600; font-size:0.88rem; color:#92400e;">Terdeteksi ${detectedAnomalies.length} Potensi Anomali Deret Waktu (Data Anjlok / Lonjakan):</div>
                    <ul style="margin:4px 0 0 18px; padding:0; font-size:0.82rem; color:#78350f;">
                        ${anomListHtml}
                    </ul>
                </div>
            </div>
        `;
        if (!existingBanner) {
            existingBanner = document.createElement('div');
            existingBanner.id = 'ts-anomaly-banner';
            existingBanner.style.cssText = 'background:#fffbeb; border:1px solid #fde68a; border-left:4px solid #f59e0b; padding:10px 14px; border-radius:8px; margin-bottom:14px;';
            const resContent = document.getElementById('ts-results-content');
            if (resContent) resContent.insertBefore(existingBanner, resContent.firstChild);
        } else {
            existingBanner.style.display = 'block';
        }
        existingBanner.innerHTML = bannerHtml;
    } else {
        if (existingBanner) existingBanner.style.display = 'none';
    }
    
    const backBtn = document.getElementById("btn-ts-back");
    if (backBtn) backBtn.style.display = 'none';
    
    const rincianContainer = document.getElementById('ts-entity-checklist');
    rincianContainer.innerHTML = '';
    
    const entityMap = {};
    const entityTypeMap = {};
    const yearsSet = new Set();
    const valueKeysSet = new Set();
    const normalizedKeyMap = {};
    const vkUnits = {};
    function countUpper(s) {
        var c = 0;
        for (var i = 0; i < s.length; i++) {
            if (s[i] >= 'A' && s[i] <= 'Z') c++;
        }
        return c;
    }
    
    const sourcesMap = {}; // key: `${year}::${normKey}` -> source object
    const entitySourceMap = {}; // key: `${canonEnt}::${year}::${normKey}` -> source object

    filteredData.forEach(table => {
        yearsSet.add(table.year);
        var tableUnit = table.unit || '';
        var tableVkUnits = table.vk_units || {};
        var tableSources = table.sources || {};
        
        table.data.forEach(row => {
            const rawEnt = row.entitas;
            const canonEnt = getCanonicalName(entityMap, rawEnt);
            const entityType = row.tipe || 'Lainnya';
            
            if (!entityMap[canonEnt]) entityMap[canonEnt] = {};
            if (!entityTypeMap[canonEnt]) entityTypeMap[canonEnt] = entityType;
            if (!entityMap[canonEnt][table.year]) entityMap[canonEnt][table.year] = {};
            
            for (const [k, v] of Object.entries(row.nilai)) {
                var cleanKey = cleanIndicatorName(k);
                var kl = cleanKey.toLowerCase();
                if (!normalizedKeyMap[kl] || countUpper(cleanKey) > countUpper(normalizedKeyMap[kl])) {
                    normalizedKeyMap[kl] = cleanKey;
                }
                var normKey = normalizedKeyMap[kl];
                entityMap[canonEnt][table.year][normKey] = v;
                valueKeysSet.add(normKey);
                var perVkUnit = tableVkUnits[k] || '';
                if (perVkUnit && !vkUnits[normKey]) vkUnits[normKey] = perVkUnit;
                else if (!perVkUnit && tableUnit && !vkUnits[normKey]) vkUnits[normKey] = tableUnit;

                var sInfo = (row.sumber && row.sumber[k]) || tableSources[k] || {
                    table_id: table.table_id,
                    table_name: table.table_name,
                    doc_year: table.doc_year,
                    doc_filename: table.doc_filename,
                    raw_col: k,
                    data_year: table.year
                };
                if (sInfo) {
                    if (!sourcesMap[`${table.year}::${normKey}`]) {
                        sourcesMap[`${table.year}::${normKey}`] = sInfo;
                    }
                    entitySourceMap[`${canonEnt}::${table.year}::${normKey}`] = sInfo;
                }
            }
        });
    });
    
    const years = Array.from(yearsSet).sort((a, b) => a - b);
    const valueKeys = Array.from(valueKeysSet);
    
    currentTimeSeriesData = { years, valueKeys, entityMap, vkUnits, entityTypeMap, sourcesMap, entitySourceMap };
    tsInsightYearStart = null;
    tsInsightYearEnd = null;
    tsInsightActiveVk = null;
    tsInsightSelectedEntities = new Set(Object.keys(entityMap));
    
    const dataControlCard = document.getElementById('ts-data-control-card');
    if (dataControlCard) dataControlCard.style.display = 'block';

    // Helper: get consistent indicator color bound to master index
    function getIndicatorColor(vk) {
        const idx = valueKeys.indexOf(vk);
        const safeIdx = idx >= 0 ? idx : 0;
        return 'hsl(' + ((safeIdx * 137.5) % 360) + ', 70%, 50%)';
    }

    // Value key picker (checkbox group formatted as smart truncated chips in dedicated row)
    const pickerDiv = document.getElementById('ts-valuekey-picker');
    if (pickerDiv) {
        pickerDiv.className = 'd-flex flex-column gap-2.5 w-100 mt-1';
        let pickerHtml = `
            <div class="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-2">
                <div class="d-flex align-items-center gap-2 flex-wrap">
                    <span class="ts-filter-section-title"><i class="bi bi-tags-fill text-primary"></i> KOLOM INDIKATOR:</span>
                    <label class="ts-filter-chip active" id="ts-vk-all-label" style="padding: 4px 12px; margin: 0; font-size: 0.8rem;">
                        <input type="checkbox" id="ts-vk-all" checked>
                        <span>Semua Kolom</span>
                    </label>
                </div>
                <div class="d-flex align-items-center gap-2">
                    <span id="ts-vk-counter-badge" class="badge bg-primary-subtle text-primary border" style="font-size:0.75rem; font-weight:600;">
                        ${valueKeys.length} dari ${valueKeys.length} dipilih
                    </span>
                </div>
            </div>
            <div class="d-flex align-items-center flex-wrap" style="gap: 10px;" id="ts-vk-checkbox-group">`;
        valueKeys.forEach((vk, i) => {
            const dotColor = getIndicatorColor(vk);
            pickerHtml += `
                <label class="ts-filter-chip active ts-vk-chip" data-vk-label="${vk}" title="${escHtml(vk)}">
                    <input type="checkbox" class="ts-vk-cb" data-vk="${vk}" checked>
                    <span class="ts-vk-dot" style="background:${dotColor};"></span>
                    <span class="ts-vk-text">${escHtml(vk)}</span>
                </label>`;
        });
        pickerHtml += `</div>`;
        pickerDiv.innerHTML = pickerHtml;
    }
    
    // Helper: get checked value keys for TABLE
    function getCheckedVKs() {
        const cbs = document.querySelectorAll('.ts-vk-cb:checked');
        return Array.from(cbs).map(cb => cb.dataset.vk);
    }
    
    // Helper: render table + chart based on checked VKs
    function renderWithCheckedKeys(animatingEntityName) {
        const checked = getCheckedVKs();
        
        if (checked.length === 0) {
            const thead = document.getElementById("ts-grid-head");
            if (thead) thead.innerHTML = '';
            const tbody = document.getElementById("ts-grid-body");
            if (tbody) tbody.innerHTML = `<tr><td colspan="10" class="text-center py-4 text-muted" style="font-size:0.85rem;"><i>Tidak ada indikator yang dipilih. Centang minimal 1 indikator di atas untuk melihat data & grafik.</i></td></tr>`;
            
            ['ts-chart-container', 'ts-chart-container-2', 'ts-chart-container-3'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.style.display = 'none';
            });
            const summaryContainer = document.getElementById('ts-quick-summary-container');
            if (summaryContainer) summaryContainer.style.display = 'none';
            const unitBar = document.getElementById('unit-converter-bar');
            if (unitBar) unitBar.innerHTML = '';
            return;
        }

        const allEntities = _sortEntitiesWithKabLast(Object.keys(entityMap));
        const filteredEntities = allEntities.filter(ent => {
            if (tsHiddenEntities.has(ent)) return false;
            return true;
        });
        
        // Render thead & Unit Config
        renderUnitConverterBar(checked);
        
        const firstVk = checked[0];
        const vkUnit = (currentTimeSeriesData && currentTimeSeriesData.vkUnits && currentTimeSeriesData.vkUnits[firstVk]) || '';
        const familyKey = detectUnitFamily(vkUnit, firstVk, typeof tsCurrentKeyword !== 'undefined' ? tsCurrentKeyword : '');
        const family = familyKey ? UNIVERSAL_UNIT_FAMILIES[familyKey] : null;
        const unitConfig = (family && tsActiveUnitKey && family.units[tsActiveUnitKey]) ? family.units[tsActiveUnitKey] : null;

        const thead = document.getElementById("ts-grid-head");
        let headHtml = `<tr><th rowspan="2" style="min-width: 220px; width: 220px;">Rincian</th>`;
        years.forEach(y => {
            headHtml += `<th colspan="${checked.length}" style="text-align: center; border-left: 2px solid #e2e8f0; background: #f8fafc;">${y}</th>`;
        });
        headHtml += `</tr><tr>`;
        function getCleanUnitSuffix(vk) {
            var rawUnit = unitConfig ? unitConfig.label : (currentTimeSeriesData && currentTimeSeriesData.vkUnits && currentTimeSeriesData.vkUnits[vk] ? currentTimeSeriesData.vkUnits[vk] : '');
            if (!rawUnit) return '';
            let clean = String(rawUnit).trim().replace(/^\(+|\)+$/g, '').trim();
            return clean ? ' (' + clean + ')' : '';
        }

        years.forEach(y => {
            checked.forEach(vk => {
                var unitSuffix = getCleanUnitSuffix(vk);
                var sInfo = currentTimeSeriesData && currentTimeSeriesData.sourcesMap ? currentTimeSeriesData.sourcesMap[y + '::' + vk] : null;
                var sourceTitle = (tsShowSources && sInfo) ? ` title="Publikasi: ${sInfo.doc_year || 'BPS'} | Tabel: ${sInfo.table_name || ''} | Kolom: ${sInfo.raw_col || ''}"` : '';
                var dotColor = (typeof getIndicatorColor === 'function') ? getIndicatorColor(vk) : 'hsl(' + (((valueKeys.indexOf(vk) >= 0 ? valueKeys.indexOf(vk) : 0) * 137.5) % 360) + ', 70%, 50%)';
                headHtml += `<th style="border-left: 1px dashed #e2e8f0; font-size: 0.85rem; font-weight: 500; min-width: 140px; width: 140px; white-space: nowrap;"${sourceTitle}>
                    <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${dotColor};margin-right:6px;vertical-align:middle;"></span>${vk}${unitSuffix}</th>`;
            });
        });
        headHtml += `</tr>`;
        thead.innerHTML = headHtml;
        
        // Render tbody
        const tbody = document.getElementById("ts-grid-body");
        let bodyHtml = "";
        allEntities.forEach(ent => {
            const isHidden = tsHiddenEntities.has(ent);
            bodyHtml += `<tr data-entity="${escHtml(ent)}" style="${isHidden ? 'display:none;' : ''}"><td style="min-width: 220px; width: 220px; font-weight: 500; color: #1e293b; white-space: nowrap;">${ent}</td>`;
            years.forEach(y => {
                const yearData = entityMap[ent][y] || {};
                checked.forEach((vk, idx) => {
                    const rawVal = yearData[vk] || "-";
                    let val = rawVal;
                    if (rawVal !== '-' && rawVal !== '...' && rawVal !== '') {
                        const rawNum = parseIndoNumberToFloat(rawVal);
                        if (rawNum !== null && !isNaN(rawNum)) {
                            val = formatWithUnitScale(rawNum, unitConfig);
                        } else {
                            val = formatIndoNumber(rawVal);
                        }
                    }
                    const borderStyle = idx === 0 ? "border-left: 2px solid #e2e8f0;" : "border-left: 1px dashed #e2e8f0;";
                    
                    const anom = anomMap[ent + '::' + vk + '::' + y];
                    let cellDisplay = val;
                    const isAdmin = (currentUserRole === 'admin' || window.currentUserRole === 'admin');
                    if (isAdmin && anom && val !== '-' && val !== '...') {
                        cellDisplay = `<span title="${escHtml(anom.message)}" style="cursor:help; font-size:0.8rem; margin-right:3px;">⚠️</span><span style="font-weight:600; color:#b45309; background:#fef3c7; padding:1px 4px; border-radius:4px;" title="${escHtml(anom.message)}">${val}</span>`;
                    }

                    const sInfo = (currentTimeSeriesData && currentTimeSeriesData.entitySourceMap && currentTimeSeriesData.entitySourceMap[ent + '::' + y + '::' + vk]) ||
                                  (currentTimeSeriesData && currentTimeSeriesData.sourcesMap && currentTimeSeriesData.sourcesMap[y + '::' + vk]);
                    if (isAdmin && tsShowSources && sInfo && val !== '-' && val !== '...') {
                        const tnEsc = (sInfo.table_name || '').replace(/'/g, "\\'");
                        const fnEsc = (sInfo.doc_filename || '').replace(/'/g, "\\'");
                        const rcEsc = (sInfo.raw_col || '').replace(/'/g, "\\'");
                        const vkEsc = (vk || '').replace(/'/g, "\\'");
                        const sourceTooltip = `Publikasi: ${sInfo.doc_year || 'BPS'} (${sInfo.doc_filename || 'Dokumen'})\nTabel: ${sInfo.table_name || ''}\nKolom Asli: ${sInfo.raw_col || ''}`;
                        cellDisplay += ` <a href="javascript:void(0)" onclick="showSourceLineageDetail('${y}', '${vkEsc}', '${sInfo.table_id}', '${tnEsc}', '${sInfo.doc_year || ''}', '${fnEsc}', '${rcEsc}')" style="font-size:0.72rem; text-decoration:none; margin-left:3px; padding:1px 4px; background:#e0e7ff; color:#4338ca; border-radius:3px; font-weight:600; vertical-align:middle;" title="${escHtml(sourceTooltip)}">🔍</a>`;
                    }

                    bodyHtml += `<td style="${borderStyle} min-width: 140px; width: 140px; text-align: right; white-space: nowrap; color: ${val === '-' || val === '...' ? '#94a3b8' : '#334155'};">${cellDisplay}</td>`;
                });
            });
            bodyHtml += `</tr>`;
        });
        tbody.innerHTML = bodyHtml;
        const isAdmin = (currentUserRole === 'admin' || window.currentUserRole === 'admin');
        if (isAdmin) {
            renderTimeSeriesSourcesLineage(checked);
        }
        
        // Render chart 1 (first VK) + chart 2 (second VK) + chart 3 (third VK)
        var title1 = document.getElementById('ts-chart-title-1');
        var title2 = document.getElementById('ts-chart-title-2');
        var title3 = document.getElementById('ts-chart-title-3');
        var container2 = document.getElementById('ts-chart-container-2');
        var container3 = document.getElementById('ts-chart-container-3');
        
        try {
            const activeCharts = [];
            if (checked.length >= 1) {
                var vk1Unit = getCleanUnitSuffix(checked[0]);
                if (title1) { title1.style.display = checked.length > 1 ? 'block' : 'none'; title1.textContent = checked[0] + vk1Unit; }
                const c1 = renderTimeSeriesChart(checked[0], allEntities, allEntities, years, entityMap, 1, animatingEntityName);
                if (c1) activeCharts.push(c1);
            } else {
                var c1 = document.getElementById('ts-chart-container');
                if (c1) c1.style.display = 'none';
            }
            if (checked.length >= 2) {
                var vk2Unit = getCleanUnitSuffix(checked[1]);
                if (title2) title2.textContent = checked[1] + vk2Unit;
                if (container2) container2.style.display = 'block';
                const c2 = renderTimeSeriesChart(checked[1], allEntities, allEntities, years, entityMap, 2, animatingEntityName);
                if (c2) activeCharts.push(c2);
            } else {
                if (container2) container2.style.display = 'none';
                if (title1) title1.style.display = 'none';
            }
            if (checked.length >= 3) {
                var vk3Unit = getCleanUnitSuffix(checked[2]);
                if (title3) title3.textContent = checked[2] + vk3Unit;
                if (container3) container3.style.display = 'block';
                const c3 = renderTimeSeriesChart(checked[2], allEntities, allEntities, years, entityMap, 3, animatingEntityName);
                if (c3) activeCharts.push(c3);
            } else {
                if (container3) container3.style.display = 'none';
            }

            if (years && years.length > 1 && activeCharts.length > 0) {
                runTimeSeriesTracerAnimation(activeCharts);
            }
        } catch(e) {
            console.error("Failed to render Chart:", e);
        }
        
        // Update Quick Insights Summary Bar
        try {
            const summaryContainer = document.getElementById('ts-quick-summary-container');
            const statTotalPts = document.getElementById('ts-stat-total-points');
            const statRange = document.getElementById('ts-stat-range');
            const statYears = document.getElementById('ts-stat-years');
            if (summaryContainer && statTotalPts && statRange && statYears) {
                summaryContainer.style.display = 'flex';
                let totalPoints = 0;
                let minVal = Infinity;
                let maxVal = -Infinity;
                filteredEntities.forEach(ent => {
                    years.forEach(y => {
                        const yearData = entityMap[ent][y] || {};
                        checked.forEach(vk => {
                            const raw = yearData[vk];
                            if (raw != null && raw !== '-' && raw !== '...' && raw !== '') {
                                totalPoints++;
                                const num = parseIndoNumberToFloat(raw);
                                if (num !== null && !isNaN(num)) {
                                    const scaled = unitConfig ? num * (unitConfig.factor != null ? unitConfig.factor : 1) : num;
                                    if (scaled < minVal) minVal = scaled;
                                    if (scaled > maxVal) maxVal = scaled;
                                }
                            }
                        });
                    });
                });
                statTotalPts.textContent = totalPoints > 0 ? totalPoints.toLocaleString('id-ID') + ' Titik Data' : '0';
                if (minVal !== Infinity && maxVal !== -Infinity) {
                    const minFmt = formatWithUnitScale(minVal, { factor: 1, isInteger: unitConfig?.isInteger, maxDecimals: unitConfig?.maxDecimals });
                    const maxFmt = formatWithUnitScale(maxVal, { factor: 1, isInteger: unitConfig?.isInteger, maxDecimals: unitConfig?.maxDecimals });
                    const uSuffix = unitConfig ? ' ' + unitConfig.label : '';
                    statRange.textContent = `${minFmt} — ${maxFmt}${uSuffix}`;
                } else {
                    statRange.textContent = '-';
                }
                statYears.textContent = years.length > 0 ? `${years[0]} s/d ${years[years.length - 1]} (${years.length} Tahun)` : '-';
            }
        } catch(e) {
            console.error("Error populating ts insights:", e);
        }

        buildEntityChecklist(allEntities);
        if (tsInsightsExpanded) {
            initInsightFilterOptions();
            computeAndRenderTimeSeriesInsights();
        }
    }
    
    renderWithCheckedKeys();
    tsRenderCallback = renderWithCheckedKeys;
    
    // Wire checkbox changes with chip highlight styling
    const group = document.getElementById('ts-vk-checkbox-group');
    if (group) {
        const allCb = document.getElementById('ts-vk-all');
        const allLabel = document.getElementById('ts-vk-all-label');
        const itemCbs = group.querySelectorAll('.ts-vk-cb');
        function updateAllState() {
            if (!allCb) return;
            const checkedCount = Array.from(itemCbs).filter(cb => cb.checked).length;
            const allChecked = (checkedCount === itemCbs.length);
            allCb.checked = allChecked;
            allCb.indeterminate = !allChecked && checkedCount > 0;
            if (allLabel) {
                if (allChecked) allLabel.classList.add('active');
                else allLabel.classList.remove('active');
            }
            const counter = document.getElementById('ts-vk-counter-badge');
            if (counter) {
                counter.textContent = `${checkedCount} dari ${itemCbs.length} dipilih`;
            }
        }
        allCb.addEventListener('change', function() {
            itemCbs.forEach(cb => {
                cb.checked = this.checked;
                const p = cb.closest('.ts-filter-chip');
                if (p) {
                    if (this.checked) p.classList.add('active');
                    else p.classList.remove('active');
                }
            });
            updateAllState();
            renderWithCheckedKeys();
        });
        itemCbs.forEach(cb => {
            cb.addEventListener('change', function() {
                const p = this.closest('.ts-filter-chip');
                if (p) {
                    if (this.checked) p.classList.add('active');
                    else p.classList.remove('active');
                }
                updateAllState();
                renderWithCheckedKeys();
            });
        });
    }
    
    const toggleBadge = document.getElementById('ts-growth-badge-toggle');
    if (toggleBadge) {
        tsGrowthBadgeEnabled = toggleBadge.checked;
        window.tsGrowthBadgeEnabled = toggleBadge.checked;
        toggleBadge.addEventListener('change', function() {
            tsGrowthBadgeEnabled = this.checked;
            window.tsGrowthBadgeEnabled = this.checked;
            const p = this.closest('.ts-filter-chip');
            if (p) {
                if (this.checked) p.classList.add('active');
                else p.classList.remove('active');
            }
            if (typeof tsRenderCallback === 'function') {
                tsRenderCallback();
            }
        });
    }

    const toggleTooltip = document.getElementById('ts-tooltip-toggle');
    if (toggleTooltip) {
        tsTooltipEnabled = toggleTooltip.checked;
        window.tsTooltipEnabled = toggleTooltip.checked;
        const chip = document.getElementById('ts-tooltip-toggle-chip') || toggleTooltip.closest('.ts-filter-chip');
        if (chip) chip.classList.toggle('active', toggleTooltip.checked);

        toggleTooltip.addEventListener('change', function() {
            tsTooltipEnabled = this.checked;
            window.tsTooltipEnabled = this.checked;
            const p = document.getElementById('ts-tooltip-toggle-chip') || this.closest('.ts-filter-chip');
            if (p) {
                if (this.checked) p.classList.add('active');
                else p.classList.remove('active');
            }
            if (!this.checked) {
                ['ts-chart-tooltip', 'ts-chart-tooltip-2', 'ts-chart-tooltip-3'].forEach(id => {
                    const el = document.getElementById(id);
                    if (el) {
                        el.style.opacity = '0';
                        el.style.display = 'none';
                    }
                });
            }
            // Update active chart instances so single-year and multi-year tooltips reflect the new state immediately
            ['timeSeriesChartInstance', 'timeSeriesChart2Instance', 'timeSeriesChart3Instance'].forEach(key => {
                if (window[key] && typeof window[key].update === 'function') {
                    window[key].update('none');
                }
            });
        });
    }
}

function toggleTimeSeriesSources() {
    const isAdmin = (currentUserRole === 'admin' || window.currentUserRole === 'admin');
    if (!isAdmin) {
        tsShowSources = false;
        const btn = document.getElementById('btn-ts-toggle-sources');
        if (btn) btn.style.setProperty('display', 'none', 'important');
        const container = document.getElementById('ts-sources-lineage-container');
        if (container) container.style.display = 'none';
        return;
    }
    tsShowSources = !tsShowSources;
    const btn = document.getElementById('btn-ts-toggle-sources');
    if (btn) {
        btn.classList.toggle('btn-primary', tsShowSources);
        btn.classList.toggle('btn-outline-primary', !tsShowSources);
        btn.innerHTML = tsShowSources 
            ? `<i class="bi bi-eye-slash"></i> <span>Tutup Lacak Sumber</span>` 
            : `<i class="bi bi-diagram-3"></i> <span>Lacak Asal Sumber Data</span>`;
    }
    const container = document.getElementById('ts-sources-lineage-container');
    if (container) {
        container.style.display = tsShowSources ? 'block' : 'none';
    }
    if (typeof tsRenderCallback === 'function') {
        tsRenderCallback();
    }
}

// ===================== TIME SERIES INSIGHTS & GROWTH CALCULATIONS =====================
let tsInsightsExpanded = false;
let tsInsightYearStart = null;
let tsInsightYearEnd = null;
let tsInsightActiveVk = null;
let tsInsightSelectedEntities = new Set();
let tsInsightSearchKeyword = '';

function toggleTimeSeriesInsights(forceState) {
    if (typeof forceState === 'boolean') {
        tsInsightsExpanded = forceState;
    } else {
        tsInsightsExpanded = !tsInsightsExpanded;
    }

    const drawer = document.getElementById('ts-insights-drawer');
    const chevron = document.getElementById('ts-insights-chevron');
    const btn = document.getElementById('btn-ts-toggle-insights');

    if (drawer) {
        drawer.style.display = tsInsightsExpanded ? 'block' : 'none';
    }
    if (chevron) {
        chevron.className = tsInsightsExpanded ? 'bi bi-chevron-up ms-1' : 'bi bi-chevron-down ms-1';
    }
    if (btn) {
        btn.classList.toggle('btn-primary', tsInsightsExpanded);
        btn.classList.toggle('btn-outline-primary', !tsInsightsExpanded);
    }

    if (tsInsightsExpanded) {
        initInsightFilterOptions();
        computeAndRenderTimeSeriesInsights();
    }
}

function initInsightFilterOptions() {
    if (!currentTimeSeriesData || !currentTimeSeriesData.years) return;

    const years = currentTimeSeriesData.years || [];
    const checked = (typeof getCheckedVKs === 'function' ? getCheckedVKs() : currentTimeSeriesData.valueKeys) || currentTimeSeriesData.valueKeys || [];
    const allEntities = _sortEntitiesWithKabLast(Object.keys(currentTimeSeriesData.entityMap || {}));

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

    // Populate Searchable Entity Dropdown inside Insight Drawer
    const listEl = document.getElementById('ts-insight-entity-list');
    const checkAll = document.getElementById('ts-insight-check-all');
    const btnText = document.getElementById('ts-insight-entity-btn-text');

    function updateInsightEntityBtnText() {
        if (!btnText) return;
        const total = allEntities.length;
        const sel = tsInsightSelectedEntities.size;
        if (sel === total) {
            btnText.textContent = `Semua Rincian (${total})`;
        } else if (sel === 0) {
            btnText.textContent = `0 Rincian Terpilih`;
        } else {
            btnText.textContent = `${sel} Rincian Terpilih`;
        }
        if (checkAll) {
            checkAll.checked = (sel === total);
            checkAll.indeterminate = (sel > 0 && sel < total);
        }
    }

    if (listEl) {
        let listHtml = '';
        allEntities.forEach(ent => {
            const isChecked = tsInsightSelectedEntities.has(ent);
            listHtml += `
                <label class="dropdown-item px-1 py-1 ts-insight-entity-item" data-name="${ent.toLowerCase()}" style="display:flex; align-items:center; gap:6px; font-size:0.8rem; cursor:pointer;">
                    <input type="checkbox" class="ts-insight-entity-cb" data-entity="${escHtml(ent)}" ${isChecked ? 'checked' : ''} style="width:16px;height:16px;">
                    <span class="text-truncate">${escHtml(ent)}</span>
                </label>
            `;
        });
        listEl.innerHTML = listHtml;

        listEl.querySelectorAll('.ts-insight-entity-cb').forEach(cb => {
            cb.addEventListener('change', function() {
                const ent = this.dataset.entity;
                if (this.checked) {
                    tsInsightSelectedEntities.add(ent);
                } else {
                    tsInsightSelectedEntities.delete(ent);
                }
                updateInsightEntityBtnText();
                computeAndRenderTimeSeriesInsights();
            });
        });
    }

    if (checkAll) {
        checkAll.checked = (tsInsightSelectedEntities.size === allEntities.length);
        checkAll.addEventListener('change', function() {
            if (this.checked) {
                allEntities.forEach(e => tsInsightSelectedEntities.add(e));
            } else {
                tsInsightSelectedEntities.clear();
            }
            if (listEl) {
                listEl.querySelectorAll('.ts-insight-entity-cb').forEach(cb => cb.checked = checkAll.checked);
            }
            updateInsightEntityBtnText();
            computeAndRenderTimeSeriesInsights();
        });
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

    updateInsightEntityBtnText();
}

function onInsightFilterChanged() {
    const selStart = document.getElementById('ts-insight-select-year-start');
    const selEnd = document.getElementById('ts-insight-select-year-end');
    const selInd = document.getElementById('ts-insight-select-indicator');

    if (selStart) tsInsightYearStart = Number(selStart.value) || tsInsightYearStart;
    if (selEnd) tsInsightYearEnd = Number(selEnd.value) || tsInsightYearEnd;
    if (selInd) tsInsightActiveVk = selInd.value || tsInsightActiveVk;

    // Auto-adjust if start year > end year
    if (tsInsightYearStart > tsInsightYearEnd) {
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
    if (!tsInsightYearStart || !years.includes(tsInsightYearStart)) {
        tsInsightYearStart = years[0];
    }
    if (!tsInsightYearEnd || !years.includes(tsInsightYearEnd)) {
        tsInsightYearEnd = years[years.length - 1];
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

    const yearIdxStart = years.indexOf(startYear);
    const yearIdxEnd = years.indexOf(endYear);
    const intervalYears = Math.max(1, yearIdxEnd - yearIdxStart);

    if (thStart) thStart.textContent = `Thn ${startYear}`;
    if (thEnd) thEnd.textContent = `Thn ${endYear}`;
    if (subtitleEl) subtitleEl.textContent = `Berdasarkan indikator "${activeVk}" dari Tahun ${startYear} ke ${endYear} (${intervalYears + 1} Tahun Observasi)`;

    const vkUnit = (vkUnits && vkUnits[activeVk]) || '';
    const familyKey = detectUnitFamily(vkUnit, activeVk, typeof tsCurrentKeyword !== 'undefined' ? tsCurrentKeyword : '');
    const family = familyKey ? UNIVERSAL_UNIT_FAMILIES[familyKey] : null;
    const unitConfig = (family && tsActiveUnitKey && family.units[tsActiveUnitKey]) ? family.units[tsActiveUnitKey] : null;
    const uSuffix = unitConfig ? ' ' + unitConfig.label : (vkUnit ? ' ' + vkUnit : '');

    const isSummaryEntity = ent => ['jumlah', 'total', 'subtotal', 'grand total', 'keseluruhan', 'seluruh', 'kabupaten tasikmalaya'].some(kw => ent.trim().toLowerCase() === kw);

    const allEntities = _sortEntitiesWithKabLast(Object.keys(entityMap));
    if (!tsInsightSelectedEntities || tsInsightSelectedEntities.size === 0) {
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

    // Sort calculations for ranking: valid non-summary entities by pctChange descending
    const rankable = calculations.filter(c => !c.isSummary && c.pctChange !== null).sort((a, b) => b.pctChange - a.pctChange);
    const summaryItems = calculations.filter(c => c.isSummary);

    // Filter calculations by tsInsightSelectedEntities (or fallback to all if empty)
    const filteredRankable = (tsInsightSelectedEntities.size > 0) ? rankable.filter(c => tsInsightSelectedEntities.has(c.entity)) : rankable;
    const filteredSummaries = (tsInsightSelectedEntities.size > 0) ? summaryItems.filter(c => tsInsightSelectedEntities.has(c.entity)) : summaryItems;

    // Top Gainer (from selected entities)
    if (filteredRankable.length > 0 && filteredRankable[0].pctChange > 0) {
        const g = filteredRankable[0];
        const gPct = g.pctChange >= 0 ? `+${g.pctChange.toFixed(2)}%` : `${g.pctChange.toFixed(2)}%`;
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
    const decliners = filteredRankable.filter(c => c.pctChange < 0);
    if (decliners.length > 0) {
        const d = decliners[decliners.length - 1]; // most negative
        const dPct = `${d.pctChange.toFixed(2)}%`;
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
    const validPcts = filteredRankable.map(c => c.pctChange);
    const avgPct = validPcts.length > 0 ? (validPcts.reduce((a, b) => a + b, 0) / validPcts.length) : 0;
    const avgAnnualPct = (intervalYears > 0) ? (avgPct / intervalYears) : avgPct;

    const gainersCount = filteredRankable.filter(c => c.pctChange > 0).length;
    const declinersCount = filteredRankable.filter(c => c.pctChange < 0).length;
    const stableCount = filteredRankable.filter(c => c.pctChange === 0).length;

    if (avgBadgeEl) {
        avgBadgeEl.textContent = (avgAnnualPct >= 0 ? '+' : '') + avgAnnualPct.toFixed(2) + '% / thn';
        avgBadgeEl.className = `badge ${avgAnnualPct >= 0 ? 'bg-success-subtle text-success border border-success-subtle' : 'bg-danger-subtle text-danger border border-danger-subtle'} px-2 py-0.5 fw-bold`;
    }
    if (trendSummaryEl) {
        trendSummaryEl.textContent = avgAnnualPct > 0 ? '↗ Tren Tumbuh Positif' : (avgAnnualPct < 0 ? '↘ Tren Menurun' : '→ Tren Stabil');
    }
    if (trendDetailEl) {
        trendDetailEl.innerHTML = `<span class="text-success fw-semibold">${gainersCount} Naik</span>, <span class="text-danger fw-semibold">${declinersCount} Turun</span>, <span class="text-muted">${stableCount} Stagnan</span>`;
    }

    // Populate Ranking Table Count
    if (countEl) {
        const nRincian = filteredRankable.length;
        const nSummary = filteredSummaries.length;
        if (nSummary > 0) {
            countEl.textContent = `${nRincian} Rincian + ${nSummary} Total Ringkasan`;
        } else {
            countEl.textContent = `${nRincian} Rincian Terdaftar`;
        }
    }

    if (tbody) {
        if (filteredRankable.length === 0 && filteredSummaries.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="text-center py-3 text-muted">Tidak ada rincian yang dipilih pada filter rincian data.</td></tr>`;
            return;
        }

        let tableRowsHtml = '';
        let rankNum = 1;

        // Render sorted rankable items
        filteredRankable.forEach(item => {
            const startFmt = item.startVal !== null ? formatWithUnitScale(item.startVal, unitConfig) : '-';
            const endFmt = item.endVal !== null ? formatWithUnitScale(item.endVal, unitConfig) : '-';
            const deltaFmt = item.delta !== null ? ((item.delta >= 0 ? '+' : '') + formatWithUnitScale(item.delta, unitConfig)) : '-';
            
            let pctBadge = '-';
            if (item.pctChange !== null) {
                const isPos = item.pctChange > 0;
                const isNeg = item.pctChange < 0;
                const badgeClass = isPos ? 'bg-success-subtle text-success border-success-subtle' : (isNeg ? 'bg-danger-subtle text-danger border-danger-subtle' : 'bg-secondary-subtle text-secondary');
                const icon = isPos ? '▲ +' : (isNeg ? '▼ ' : '');
                pctBadge = `<span class="badge ${badgeClass} border px-2 py-1 fw-bold" style="font-size:0.76rem;">${icon}${item.pctChange.toFixed(2)}%</span>`;
            }

            tableRowsHtml += `
                <tr>
                    <td style="text-align:center; font-weight:600; color:#64748b;">${rankNum++}</td>
                    <td class="fw-medium text-dark">${escHtml(item.entity)}</td>
                    <td style="text-align:right; font-variant-numeric:tabular-nums;">${startFmt}</td>
                    <td style="text-align:right; font-variant-numeric:tabular-nums; font-weight:600;">${endFmt}</td>
                    <td style="text-align:right; font-variant-numeric:tabular-nums; color:${item.delta > 0 ? '#10b981' : (item.delta < 0 ? '#ef4444' : '#64748b')}; font-weight:600;">${deltaFmt}</td>
                    <td style="text-align:right;">${pctBadge}</td>
                </tr>
            `;
        });

        // Summary items at bottom (e.g. Kabupaten Tasikmalaya)
        filteredSummaries.forEach(item => {
            const startFmt = item.startVal !== null ? formatWithUnitScale(item.startVal, unitConfig) : '-';
            const endFmt = item.endVal !== null ? formatWithUnitScale(item.endVal, unitConfig) : '-';
            const deltaFmt = item.delta !== null ? ((item.delta >= 0 ? '+' : '') + formatWithUnitScale(item.delta, unitConfig)) : '-';
            
            let pctBadge = '-';
            if (item.pctChange !== null) {
                const isPos = item.pctChange > 0;
                const isNeg = item.pctChange < 0;
                const badgeClass = isPos ? 'bg-success-subtle text-success border-success-subtle' : (isNeg ? 'bg-danger-subtle text-danger border-danger-subtle' : 'bg-secondary-subtle text-secondary');
                const icon = isPos ? '▲ +' : (isNeg ? '▼ ' : '');
                pctBadge = `<span class="badge ${badgeClass} border px-2 py-1 fw-bold" style="font-size:0.76rem;">${icon}${item.pctChange.toFixed(2)}%</span>`;
            }

            tableRowsHtml += `
                <tr class="table-light fw-bold" style="background:#f1f5f9;">
                    <td style="text-align:center; color:#3b82f6;">⭐</td>
                    <td class="fw-bold text-dark">${escHtml(item.entity)} <span class="badge bg-secondary-subtle text-secondary ms-1" style="font-size:0.68rem;">Total</span></td>
                    <td style="text-align:right; font-variant-numeric:tabular-nums;">${startFmt}</td>
                    <td style="text-align:right; font-variant-numeric:tabular-nums;">${endFmt}</td>
                    <td style="text-align:right; font-variant-numeric:tabular-nums; color:${item.delta > 0 ? '#10b981' : (item.delta < 0 ? '#ef4444' : '#64748b')};">${deltaFmt}</td>
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
            <td><code style="background:#f1f5f9; color:#475569; padding:2px 6px; border-radius:4px; font-size:0.8rem;">${escHtml(r.raw_col || '-')}</code></td>
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
    const cardBg = isDark ? '#1e293b' : '#f8fafc';
    const cardBorder = isDark ? '#334155' : '#e2e8f0';
    const textDark = isDark ? '#f8fafc' : '#1e293b';
    const textMuted = isDark ? '#94a3b8' : '#64748b';
    const codeBg = isDark ? 'rgba(124, 58, 237, 0.25)' : '#ede9fe';
    const codeColor = isDark ? '#c4b5fd' : '#6d28d9';

    Swal.fire({
        title: '🔍 Asal Sumber Data',
        html: `
            <div style="text-align:left; font-size:0.88rem; line-height:1.6; padding:4px;">
                <div style="background:${cardBg}; border:1px solid ${cardBorder}; border-radius:10px; padding:12px 14px; margin-bottom:14px;">
                    <div style="margin-bottom:6px; color:${textDark};"><b>📅 Tahun Data:</b> <span class="badge bg-primary ms-1">${escHtml(year)}</span></div>
                    <div style="color:${textDark};"><b>📊 Indikator:</b> <span class="fw-semibold" style="color:${textDark};">${escHtml(indicator)}</span></div>
                </div>
                <div style="display:flex; flex-direction:column; gap:10px;">
                    <div>
                        <label style="font-size:0.75rem; font-weight:700; color:${textMuted}; text-transform:uppercase; display:block; margin-bottom:2px;">📚 Publikasi Asal (BPS):</label>
                        <div style="font-weight:600; color:${textDark};">Tahun ${escHtml(docYear || '-')} <span style="font-weight:400; color:${textMuted};">(${escHtml(docFilename || 'Dokumen PDF')})</span></div>
                    </div>
                    <div>
                        <label style="font-size:0.75rem; font-weight:700; color:${textMuted}; text-transform:uppercase; display:block; margin-bottom:2px;">📑 Tabel Asal:</label>
                        <div style="font-weight:600; color:${textDark};">${escHtml(tableName || '-')}</div>
                    </div>
                    <div>
                        <label style="font-size:0.75rem; font-weight:700; color:${textMuted}; text-transform:uppercase; display:block; margin-bottom:2px;">🏷️ Header / Kolom Asli di Tabel:</label>
                        <div><code style="background:${codeBg}; color:${codeColor}; padding:3px 8px; border-radius:6px; font-weight:600;">${escHtml(rawCol || '-')}</code></div>
                    </div>
                </div>
            </div>
        `,
        showCancelButton: true,
        cancelButtonText: 'Tutup',
        confirmButtonText: '<i class="bi bi-box-arrow-up-right me-1"></i> Buka Tabel Asal di Editor',
        confirmButtonColor: '#3b82f6',
        cancelButtonColor: isDark ? '#334155' : '#e2e8f0',
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
    const dataControlCard = document.getElementById('ts-data-control-card');
    if (dataControlCard) dataControlCard.style.display = 'none';
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
        const familyKey = detectUnitFamily(vkUnit, vk, typeof tsCurrentKeyword !== 'undefined' ? tsCurrentKeyword : '');
        const family = familyKey ? UNIVERSAL_UNIT_FAMILIES[familyKey] : null;
        const unitConfig = (family && tsActiveUnitKey && family.units[tsActiveUnitKey]) ? family.units[tsActiveUnitKey] : null;
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
        const familyKey = detectUnitFamily(vkUnit, vk, typeof tsCurrentKeyword !== 'undefined' ? tsCurrentKeyword : '');
        const family = familyKey ? UNIVERSAL_UNIT_FAMILIES[familyKey] : null;
        const unitConfig = (family && tsActiveUnitKey && family.units[tsActiveUnitKey]) ? family.units[tsActiveUnitKey] : null;
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
        const familyKey = detectUnitFamily(vkUnit, firstVk, typeof tsCurrentKeyword !== 'undefined' ? tsCurrentKeyword : '');
        const family = familyKey ? UNIVERSAL_UNIT_FAMILIES[familyKey] : null;
        const unitConfig = (family && tsActiveUnitKey && family.units[tsActiveUnitKey]) ? family.units[tsActiveUnitKey] : null;
        const unitLabel = unitConfig ? unitConfig.label : (vkUnit || '-');

        const now = new Date();
        const dateStr = now.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        const keywordTitle = tsCurrentKeyword ? tsCurrentKeyword.toUpperCase() : 'ANALISIS DERET WAKTU';
        const yearPeriodStr = years.length > 1 ? `Periode: ${years[0]} – ${years[years.length - 1]} (${years.length} Tahun)` : `Tahun: ${years[0]}`;

        // Ensure insights data is fresh
        if (optInsights && typeof computeAndRenderTimeSeriesInsights === 'function') {
            try { computeAndRenderTimeSeriesInsights(); } catch (e) { console.warn("Auto compute insights error:", e); }
        }

        // Create dedicated printable offscreen container
        const reportContainer = document.createElement('div');
        reportContainer.id = 'ts-export-temp-report';
        reportContainer.style.cssText = 'position:fixed; left:-99999px; top:0; width:1200px; background:#ffffff; color:#1e293b; font-family:"Inter", -apple-system, BlinkMacSystemFont, sans-serif; padding:32px 36px; box-sizing:border-box; z-index:-1000;';

        let reportHtml = '';

        // 1. Header / Kop Resmi BPS
        if (includeHeader) {
            reportHtml += `
                <div style="display:flex; align-items:center; justify-content:space-between; border-bottom:2px solid #1e293b; padding-bottom:14px; margin-bottom:20px;">
                    <div style="display:flex; align-items:center; gap:12px;">
                        <img src="/static/logo_sipedas.png" alt="BPS" style="height:46px; width:auto;">
                        <div>
                            <div style="font-size:16px; font-weight:800; color:#0f172a; letter-spacing:-0.2px;">BADAN PUSAT STATISTIK KABUPATEN TASIKMALAYA</div>
                            <div style="font-size:12px; color:#475569; font-weight:500;">SIPEDAS — Sistem Integrasi, Pencarian, dan Analisis Data Statistik</div>
                        </div>
                    </div>
                    <div style="text-align:right;">
                        <div style="font-size:11px; font-weight:600; color:#64748b; text-transform:uppercase;">Tanggal Cetak:</div>
                        <div style="font-size:12px; font-weight:700; color:#0f172a;">${dateStr} WIB</div>
                    </div>
                </div>
            `;
        }

        // Title Block
        reportHtml += `
            <div style="margin-bottom:22px;">
                <div style="display:inline-block; background:#e0e7ff; color:#3730a3; font-size:11px; font-weight:700; padding:3px 10px; border-radius:6px; margin-bottom:6px; letter-spacing:0.5px;">
                    LAPORAN EKSPOR DERET WAKTU
                </div>
                <h2 style="font-size:20px; font-weight:800; color:#0f172a; margin:0 0 4px 0; line-height:1.25;">${escHtml(keywordTitle)}</h2>
                <div style="font-size:13px; color:#475569; font-weight:500;">
                    <span>📅 ${yearPeriodStr}</span> &nbsp;|&nbsp; 
                    <span>📏 Satuan: <b>${escHtml(unitLabel)}</b></span> &nbsp;|&nbsp; 
                    <span>📊 Kolom: <b>${activeVKs.join(', ')}</b></span>
                </div>
            </div>
        `;

        // 2. Komponen: Quick Insights & Peringkat Pertumbuhan (Berdasarkan Sub-opsi)
        if (optInsights) {
            reportHtml += `
                <div style="margin-bottom:26px;">
                    <div style="font-size:14px; font-weight:700; color:#1e293b; border-bottom:1.5px solid #e2e8f0; padding-bottom:6px; margin-bottom:12px; display:flex; align-items:center; gap:6px;">
                        <span>📈</span> RINGKASAN TREN & PERINGKAT PERTUMBUHAN
                    </div>
            `;

            // Render Card Metrik (jika 'both' atau 'card_only')
            if (insightsScope === 'both' || insightsScope === 'card_only') {
                const gainerName = document.getElementById('ts-gainer-name')?.textContent || '-';
                const gainerBadge = document.getElementById('ts-gainer-badge')?.textContent || '0%';
                const declinerName = document.getElementById('ts-decliner-name')?.textContent || '-';
                const declinerBadge = document.getElementById('ts-decliner-badge')?.textContent || '0%';
                const avgBadge = document.getElementById('ts-avg-badge')?.textContent || '0%';
                const trendSummary = document.getElementById('ts-trend-summary')?.textContent || 'Tren Stabil';

                reportHtml += `
                    <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:12px; margin-bottom:14px;">
                        <div style="background:#f8fafc; border:1px solid #e2e8f0; padding:12px 14px; border-radius:8px;">
                            <div style="font-size:11px; color:#64748b; font-weight:600; text-transform:uppercase;">Pertumbuhan Tertinggi</div>
                            <div style="font-size:14px; font-weight:700; color:#0f172a; margin-top:2px;">${escHtml(gainerName)}</div>
                            <div style="font-size:12px; font-weight:700; color:#16a34a; margin-top:2px;">${escHtml(gainerBadge)}</div>
                        </div>
                        <div style="background:#f8fafc; border:1px solid #e2e8f0; padding:12px 14px; border-radius:8px;">
                            <div style="font-size:11px; color:#64748b; font-weight:600; text-transform:uppercase;">Penurunan Tertinggi</div>
                            <div style="font-size:14px; font-weight:700; color:#0f172a; margin-top:2px;">${escHtml(declinerName)}</div>
                            <div style="font-size:12px; font-weight:700; color:#dc2626; margin-top:2px;">${escHtml(declinerBadge)}</div>
                        </div>
                        <div style="background:#f8fafc; border:1px solid #e2e8f0; padding:12px 14px; border-radius:8px;">
                            <div style="font-size:11px; color:#64748b; font-weight:600; text-transform:uppercase;">Laju Rata-Rata Tahunan</div>
                            <div style="font-size:14px; font-weight:700; color:#0f172a; margin-top:2px;">${escHtml(trendSummary)}</div>
                            <div style="font-size:12px; font-weight:700; color:#2563eb; margin-top:2px;">${escHtml(avgBadge)}</div>
                        </div>
                    </div>
                `;
            }

            // Render Tabel Peringkat Pertumbuhan (jika 'both' atau 'table_only')
            if (insightsScope === 'both' || insightsScope === 'table_only') {
                const rankingTableEl = document.getElementById('ts-growth-ranking-table');
                if (rankingTableEl) {
                    const startYearText = document.getElementById('ts-th-year-start')?.textContent || 'Tahun Awal';
                    const endYearText = document.getElementById('ts-th-year-end')?.textContent || 'Tahun Akhir';
                    const rankingTbody = document.getElementById('ts-growth-ranking-tbody')?.innerHTML || '';

                    reportHtml += `
                        <div style="margin-top:10px;">
                            <div style="font-size:12px; font-weight:700; color:#334155; margin-bottom:6px;">📊 Tabel Urutan Peringkat Pertumbuhan (${escHtml(startYearText)} ke ${escHtml(endYearText)})</div>
                            <table style="width:100%; border-collapse:collapse; font-size:11px; font-family:'Inter', sans-serif;">
                                <thead>
                                    <tr>
                                        <th style="background:#f1f5f9; color:#0f172a; font-weight:700; border:1px solid #cbd5e1; padding:6px 8px; text-align:center; width:45px;">#</th>
                                        <th style="background:#f1f5f9; color:#0f172a; font-weight:700; border:1px solid #cbd5e1; padding:6px 8px; text-align:left;">Rincian</th>
                                        <th style="background:#f1f5f9; color:#0f172a; font-weight:700; border:1px solid #cbd5e1; padding:6px 8px; text-align:right;">${escHtml(startYearText)}</th>
                                        <th style="background:#f1f5f9; color:#0f172a; font-weight:700; border:1px solid #cbd5e1; padding:6px 8px; text-align:right;">${escHtml(endYearText)}</th>
                                        <th style="background:#f1f5f9; color:#0f172a; font-weight:700; border:1px solid #cbd5e1; padding:6px 8px; text-align:right;">Selisih Nominal</th>
                                        <th style="background:#f1f5f9; color:#0f172a; font-weight:700; border:1px solid #cbd5e1; padding:6px 8px; text-align:right;">Perubahan (%)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${rankingTbody}
                                </tbody>
                            </table>
                        </div>
                    `;
                }
            }

            reportHtml += `</div>`;
        }

        // 3. Komponen: Grafik Visual
        if (optChart) {
            reportHtml += `
                <div style="margin-bottom:26px;">
                    <div style="font-size:14px; font-weight:700; color:#1e293b; border-bottom:1.5px solid #e2e8f0; padding-bottom:6px; margin-bottom:14px; display:flex; align-items:center; gap:6px;">
                        <span>📊</span> GRAFIK VISUAL DERET WAKTU
                    </div>
                    <div id="ts-export-chart-images-container" style="display:flex; flex-direction:column; gap:16px;"></div>
                </div>
            `;
        }

        // 4. Komponen: Tabel Data Tabular
        if (optTable) {
            const tableEl = document.getElementById('ts-grid');
            if (tableEl) {
                reportHtml += `
                    <div style="margin-bottom:24px;">
                        <div style="font-size:14px; font-weight:700; color:#1e293b; border-bottom:1.5px solid #e2e8f0; padding-bottom:6px; margin-bottom:12px; display:flex; align-items:center; gap:6px;">
                            <span>📑</span> TABEL DATA TABULAR
                        </div>
                        <div style="overflow-x:auto;">
                            <table style="width:100%; border-collapse:collapse; font-size:11px; font-family:'Inter', sans-serif;">
                                ${tableEl.innerHTML}
                            </table>
                        </div>
                    </div>
                `;
            }
        }

        // Footer
        reportHtml += `
            <div style="border-top:1px solid #e2e8f0; padding-top:10px; margin-top:20px; display:flex; justify-content:space-between; align-items:center; font-size:10.5px; color:#64748b;">
                <div>Dokumen digenerasi secara otomatis oleh SIPEDAS BPS Kabupaten Tasikmalaya</div>
                <div>SIPEDAS © 2026</div>
            </div>
        `;

        reportContainer.innerHTML = reportHtml;

        // Apply clean styling to cloned table elements inside reportContainer
        const clonedTables = reportContainer.querySelectorAll('table');
        clonedTables.forEach(tbl => {
            tbl.querySelectorAll('th').forEach(th => {
                th.style.cssText = 'background:#f1f5f9; color:#0f172a; font-weight:700; border:1px solid #cbd5e1; padding:6px 8px; text-align:center; font-size:10.5px;';
            });
            tbl.querySelectorAll('td').forEach(td => {
                td.style.cssText = 'border:1px solid #e2e8f0; padding:5px 8px; font-size:10px; color:#334155;';
            });
            tbl.querySelectorAll('tr:nth-child(even) td').forEach(td => {
                td.style.backgroundColor = '#f8fafc';
            });
        });

        document.body.appendChild(reportContainer);

        // If chart is requested, convert active Chart canvases (timeSeriesChart) to high-res image elements
        if (optChart) {
            const chartImgContainer = reportContainer.querySelector('#ts-export-chart-images-container');
            if (chartImgContainer) {
                const chartConfigs = [
                    { canvasId: 'timeSeriesChart', containerId: 'ts-chart-container', title: activeVKs[0] },
                    { canvasId: 'timeSeriesChart2', containerId: 'ts-chart-container-2', title: activeVKs[1] },
                    { canvasId: 'timeSeriesChart3', containerId: 'ts-chart-container-3', title: activeVKs[2] }
                ];

                chartConfigs.forEach(c => {
                    const canvas = document.getElementById(c.canvasId);
                    const container = document.getElementById(c.containerId);
                    const isVisible = container ? (container.style.display !== 'none' && container.offsetParent !== null) : (canvas && canvas.offsetParent !== null);
                    
                    if (canvas && isVisible) {
                        try {
                            const dataUrl = canvas.toDataURL('image/png', 1.0);
                            if (dataUrl && dataUrl.length > 100) {
                                const imgDiv = document.createElement('div');
                                imgDiv.style.cssText = 'background:#ffffff; border:1px solid #e2e8f0; border-radius:10px; padding:14px; text-align:center; margin-bottom:12px;';
                                if (c.title) {
                                    imgDiv.innerHTML = `<div style="font-size:13px; font-weight:700; color:#0f172a; margin-bottom:10px; text-align:left;"><span style="color:#4f46e5; margin-right:6px;">📈</span> ${escHtml(c.title)}</div>`;
                                }
                                const img = document.createElement('img');
                                img.src = dataUrl;
                                img.style.cssText = 'width:100%; height:auto; max-height:420px; object-fit:contain; border-radius:6px;';
                                imgDiv.appendChild(img);
                                chartImgContainer.appendChild(imgDiv);
                            }
                        } catch (err) {
                            console.error('Error capturing chart canvas:', err);
                        }
                    }
                });
            }
        }

        // Wait brief tick for DOM rendering & images to settle
        await new Promise(r => setTimeout(r, 250));

        // Render with html2canvas
        const canvas = await html2canvas(reportContainer, {
            scale: 2,
            backgroundColor: '#ffffff',
            useCORS: true,
            logging: false
        });

        // Clean up temporary DOM element
        if (reportContainer && reportContainer.parentNode) {
            reportContainer.parentNode.removeChild(reportContainer);
        }

        const fileNameBase = _getTimeSeriesFileName('pdf').replace(/\.pdf$/i, '');

        if (format === 'png') {
            // PNG Download
            canvas.toBlob(blob => {
                if (!blob) {
                    throw new Error('Gagal membuat berkas gambar PNG');
                }
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${fileNameBase}.png`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);

                Swal.close();
                showToast('success', 'Berhasil', 'Gambar grafik & data (.png) berhasil diunduh.');
            }, 'image/png');
        } else {
            // PDF Generation using jsPDF with genuine top/bottom margins and clean canvas slicing
            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF({
                orientation: orientation,
                unit: 'pt',
                format: 'a4'
            });

            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();

            const marginTop = 36;
            const marginBottom = 36;
            const marginLeft = 28;
            const marginRight = 28;

            const contentWidth = pdfWidth - (marginLeft + marginRight);
            const pageEffectiveHeight = pdfHeight - (marginTop + marginBottom);

            // Calculate source canvas slice height corresponding to one page's effective height
            const sliceSrcHeight = Math.floor((pageEffectiveHeight * canvas.width) / contentWidth);

            let srcY = 0;
            let pageNum = 1;
            const totalSrcHeight = canvas.height;

            while (srcY < totalSrcHeight) {
                const currentSliceHeight = Math.min(sliceSrcHeight, totalSrcHeight - srcY);

                // Create clean slice canvas
                const sliceCanvas = document.createElement('canvas');
                sliceCanvas.width = canvas.width;
                sliceCanvas.height = currentSliceHeight;
                const sCtx = sliceCanvas.getContext('2d');
                sCtx.fillStyle = '#ffffff';
                sCtx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
                sCtx.drawImage(canvas, 0, srcY, canvas.width, currentSliceHeight, 0, 0, canvas.width, currentSliceHeight);

                const sliceData = sliceCanvas.toDataURL('image/jpeg', 0.95);
                const slicePdfHeight = (currentSliceHeight * contentWidth) / canvas.width;

                if (pageNum > 1) {
                    pdf.addPage();
                }

                // Add image strictly inside the top/bottom margin boundary
                pdf.addImage(sliceData, 'JPEG', marginLeft, marginTop, contentWidth, slicePdfHeight);

                // Running Footer with page number
                pdf.setFontSize(8);
                pdf.setTextColor(148, 163, 184);
                pdf.text(`SIPEDAS BPS Kabupaten Tasikmalaya  •  Halaman ${pageNum}`, marginLeft, pdfHeight - 16);

                srcY += currentSliceHeight;
                pageNum++;

                // If remaining content is negligible (< 10px in canvas space), stop to avoid trailing blank page
                if (totalSrcHeight - srcY <= 15) {
                    break;
                }
            }

            pdf.save(`${fileNameBase}.pdf`);

            Swal.close();
            showToast('success', 'Berhasil', 'Laporan Deret Waktu (.pdf) berhasil diunduh.');
        }

    } catch (error) {
        console.error('Error during TS export:', error);
        // Ensure cleanup
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

function updateRoleUI(role) {
    const isAdmin = role === 'admin';
    if (document.body) {
        document.body.classList.toggle('role-admin', isAdmin);
        document.body.classList.toggle('role-pegawai', !isAdmin);
    }
    const btnLogin = document.getElementById('btn-admin-login');
    const btnLogout = document.getElementById('btn-admin-logout');
    if (isAdmin) {
        if (btnLogin) btnLogin.style.setProperty('display', 'none', 'important');
        if (btnLogout) btnLogout.style.setProperty('display', 'flex', 'important');
        document.querySelectorAll(".admin-only").forEach(el => el.style.removeProperty('display'));
    } else {
        tsShowSources = false;
        if (btnLogin) btnLogin.style.setProperty('display', 'flex', 'important');
        if (btnLogout) btnLogout.style.setProperty('display', 'none', 'important');
        document.querySelectorAll(".admin-only").forEach(el => el.style.setProperty('display', 'none', 'important'));
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
            return data.role;
        }
    } catch(e) {}
    currentUserRole = "pegawai";
    window.currentUserRole = "pegawai";
    updateRoleUI("pegawai");
    return "pegawai";
}

async function adminLogin() {
    const isDark = document.body.classList.contains('dark-mode') || document.documentElement.getAttribute('data-bs-theme') === 'dark';
    const { value: isSuccess } = await Swal.fire({
        title: 'Login Admin SIPEDAS',
        html: `
            <div style="font-size:0.9rem; color:${isDark ? '#94a3b8' : '#64748b'}; margin-bottom:12px; line-height:1.5;">
                Masukkan password untuk mendapatkan hak akses penuh sebagai <b>Administrator SIPEDAS</b>:
            </div>
        `,
        input: 'password',
        inputPlaceholder: 'Ketik password admin di sini...',
        inputAttributes: { 
            autocomplete: 'current-password',
            style: `height: 44px; font-size: 0.95rem; border-radius: 10px; padding: 8px 14px;`
        },
        showCancelButton: true,
        confirmButtonText: '<i class="bi bi-shield-lock-fill me-1.5"></i> Masuk Sekarang',
        cancelButtonText: 'Batal',
        confirmButtonColor: '#4f46e5',
        cancelButtonColor: isDark ? '#334155' : '#e2e8f0',
        buttonsStyling: true,
        focusConfirm: false,
        backdrop: 'rgba(15, 23, 42, 0.65)',
        showLoaderOnConfirm: true,
        preConfirm: async (pw) => {
            if (!pw || !pw.trim()) {
                Swal.showValidationMessage('Silakan masukkan password terlebih dahulu.');
                return false;
            }
            try {
                const res = await fetch(`${API_BASE}/auth/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'same-origin',
                    body: JSON.stringify({ password: pw.trim() })
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
        updateRoleUI("admin");
        navigate('dashboard', document.getElementById('nav-dashboard'));
        showToast('success', 'Selamat Datang, Admin SIPEDAS!', 'Akses penuh Admin SIPEDAS aktif.', 3000);
    }
}

function adminLogout() {
    Swal.fire({
        title: 'Logout Admin SIPEDAS?',
        text: 'Anda akan kembali ke mode Operator SIPEDAS.',
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#cbd5e1',
        confirmButtonText: 'Ya, Logout',
        cancelButtonText: 'Batal'
    }).then(async (result) => {
        if (result.isConfirmed) {
            fetch(`${API_BASE}/auth/logout`, { method: 'POST', credentials: 'same-origin' }).catch(()=>{});
            currentUserRole = "pegawai";
            window.currentUserRole = "pegawai";
            updateRoleUI("pegawai");
            navigate('timeseries', document.getElementById('nav-timeseries'));
            loadDashboardStats();
            showToast('info', 'Logout Berhasil', 'Anda kembali ke mode Operator SIPEDAS.', 2000);
        }
    });
}

async function loadAdminTables() {
    const list = document.getElementById("admin-table-list");
    list.innerHTML = `<div class="text-center text-muted py-3">Memuat data...</div>`;
    try {
        const res = await fetch(`${API_BASE}/admin/tables`);
        if (!res.ok) throw new Error("Gagal mengambil data admin");
        const tables = await res.json();
        window.__adminTables = tables;
        renderAdminTables();
    } catch(e) {
        list.innerHTML = `<div class="text-center text-danger py-3">Error: ${e.message}</div>`;
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
                            <a href="${base}/backups/${encodeURIComponent(f.file)}" download="${escHtml(f.file)}" class="btn btn-sm btn-outline-secondary py-1 px-2 d-inline-flex align-items-center gap-1 shadow-none" style="font-size:0.75rem;" title="Unduh file SQL ini ke komputer">
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
        confirmButtonColor: '#0d9488',
        cancelButtonColor: '#94a3b8',
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
        confirmButtonColor: '#0d9488',
        cancelButtonColor: '#94a3b8',
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
    }
}

async function deleteBackup(filename) {
    const result = await Swal.fire({
        title: 'Hapus File Backup?',
        text: `Hapus file "${filename}" dari server? Tindakan ini tidak dapat dibatalkan.`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#94a3b8',
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
    }
}

async function createAdminBackup() {
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
            await loadAdminBackups();
        } else {
            const err = await res.json().catch(() => ({}));
            showToast('error', 'Backup Gagal', err.detail || 'Terjadi kesalahan');
        }
    } catch(e) {
        showToast('error', 'Backup Gagal', String(e));
    }
}

function formatFileSize(bytes) {
    if (bytes === null || bytes === undefined) return '-';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

function renderAdminTables() {
    const list = document.getElementById("admin-table-list");
    const tables = window.__adminTables || [];
    const countEl = document.getElementById("admin-tables-count");
    const q = (document.getElementById("admin-table-search")?.value || "").trim().toLowerCase();
    const yearFilter = document.getElementById("admin-filter-year")?.value || "";
    const statusFilter = document.getElementById("admin-filter-status")?.value || "";
    const sortMode = document.getElementById("admin-sort")?.value || "id";

    if (tables.length === 0) {
        list.innerHTML = `<div class="text-center text-muted py-3">Database kosong.</div>`;
        if (countEl) countEl.textContent = "";
        return;
    }

    let filtered = tables;
    if (q) {
        filtered = filtered.filter(t =>
            String(t.table_name || "").toLowerCase().includes(q) ||
            String(t.year || "").toLowerCase().includes(q) ||
            String(t.id || "").includes(q) ||
            String(t.document_name || "").toLowerCase().includes(q));
    }
    if (yearFilter) {
        filtered = filtered.filter(t => String(t.year) === yearFilter);
    }
    if (statusFilter === "db") filtered = filtered.filter(t => t.has_db_data);
    if (statusFilter === "csv") filtered = filtered.filter(t => !t.has_db_data);

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

    if (countEl) countEl.textContent = `Menampilkan ${filtered.length} dari ${tables.length} tabel`;
    if (filtered.length === 0) {
        list.innerHTML = `<div class="text-center text-muted py-3">Tidak ada tabel cocok dengan filter.</div>`;
        return;
    }

    let html = "";
    filtered.forEach(t => {
        const badge = t.has_db_data
            ? `<span class="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25 px-2 py-0.5 rounded-pill" style="font-size:0.72rem;">✔ DB (${t.db_rows} baris)</span>`
            : `<span class="badge bg-warning bg-opacity-10 text-warning-emphasis border border-warning border-opacity-25 px-2 py-0.5 rounded-pill" style="font-size:0.72rem;">⚠ Hanya CSV</span>`;
        const docInfo = `${t.document_name ? escHtml(t.document_name) : ''}${t.bab_num ? ` · Bab ${t.bab_num}` : ''}`;
        html += `<div class="admin-table-row-item d-flex justify-content-between align-items-start p-2.5 border-bottom">
            <div class="d-flex align-items-start gap-2">
                <span class="badge bg-primary bg-opacity-10 text-primary border border-primary border-opacity-20 px-2 py-1 rounded-2" style="font-weight:600; font-size:0.72rem;">${t.id}</span>
                <div class="small">
                    <div class="fw-semibold text-dark">${escHtml(formatCleanTableName(t.table_name))}</div>
                    <div class="text-muted mt-0.5" style="font-size:0.75rem;">Tahun ${t.year} · ${badge}</div>
                    <div class="text-muted" style="font-size:0.72rem;">${docInfo}</div>
                </div>
            </div>
            <div class="d-flex gap-1 flex-shrink-0">
                <button onclick="openTableSnippet(${t.id})" class="btn btn-sm btn-outline-info" style="font-size:0.7rem;white-space:nowrap;" title="Lihat pratinjau ringkas 5 baris">📋 Snippet</button>
                <button onclick="openTimeSeriesForTable(${t.id}, '${(t.table_name || '').replace(/'/g, "\\'")}')" class="btn btn-sm btn-outline-warning" style="font-size:0.7rem;white-space:nowrap;" title="Buka grafik deret waktu">📈 Tren</button>
                <button onclick="openTable(${t.id})" class="btn btn-sm btn-outline-primary" style="font-size:0.7rem;white-space:nowrap;">👁 Lihat</button>
                <button onclick="deleteTableAdmin(${t.id})" class="btn btn-sm btn-outline-danger" style="font-size:0.7rem;white-space:nowrap;">🗑 Hapus</button>
            </div>
        </div>`;
    });
    list.innerHTML = html;
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
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#cbd5e1',
        confirmButtonText: 'Ya, Hapus',
        cancelButtonText: 'Batal'
    });
    if (!isConfirmed) return;
    try {
        const res = await fetch(`${API_BASE}/tables/${id}`, { method: 'DELETE' });
        if (res.ok) { showToast('success', 'Terhapus', 'Tabel berhasil dihapus'); loadAdminTables(); loadDashboardStats(); }
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
                .map(([k, v]) => `<strong>${escHtml(k)}</strong>: <span style="color:${String(v).includes("?") ? '#ef4444' : '#334155'}; font-weight:${String(v).includes("?") ? 'bold' : 'normal'}">${escHtml(String(v || ''))}</span>`)
                .join(" | ");
            return `
                <tr style="border-bottom: 1px solid #f1f5f9;">
                    <td style="padding: 10px; font-weight: 500; color: #334155; max-width: 280px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${escHtml(a.table_name)}">
                        <span style="cursor: pointer; color: #4f46e5; text-decoration: underline;" onclick="viewDataEditor(${a.table_id}, '${String(cleanName).replace(/'/g, "\\'")}')">
                            ${escHtml(cleanName)}
                        </span>
                    </td>
                    <td style="padding: 10px; text-align: center; color: #64748b;">${a.document_year}</td>
                    <td style="padding: 10px; font-size:0.8rem; color:#475569; max-width:450px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${details.replace(/<[^>]*>/g, '')}">
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
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#cbd5e1',
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
        confirmButtonColor: '#dc2626',
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
        confirmButtonColor: '#4f46e5',
        cancelButtonColor: '#cbd5e1',
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
        }
    });
}

async function loadAllCsvForBab(docId, babNum) {
    Swal.fire({
        title: `Load Semua CSV Bab ${babNum}?`,
        text: `Apakah Anda yakin ingin memasukkan seluruh tabel dari Bab ${babNum} ke database? Ini akan menimpa data yang lama.`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#4f46e5',
        cancelButtonColor: '#cbd5e1',
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
        }
    });
}

async function deleteAllTablesForDoc(docId, filename) {
    Swal.fire({
        title: 'Hapus Semua Hasil Ekstraksi?',
        text: `Apakah Anda yakin ingin menghapus seluruh tabel hasil ekstraksi untuk "${filename}"? Tindakan ini akan menghapus semua file CSV lokal dan data di database untuk publikasi ini.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#cbd5e1',
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
        }
    });
}

async function deleteAllTablesForBab(docId, babNum) {
    Swal.fire({
        title: `Hapus Semua Tabel Bab ${babNum}?`,
        text: `Apakah Anda yakin ingin menghapus seluruh tabel hasil ekstraksi untuk Bab ${babNum}? Tindakan ini akan menghapus file CSV lokal dan data di database.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#cbd5e1',
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
let timeSeriesChartYAxisInstance = null;
const tsHiddenEntities = new Set();
let tsRenderCallback = null;
let tsForceRecreateChart = true;
let tsOriginalTablesData = null;
let tsCurrentSubType = 'Semua';
let tsSavedVKChecks = null;
let tsSavedSubType = 'Semua';

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
        const activeLabelsCount = isSingleYear ? entities.length : years.length;
        const parentWidth = (scrollable ? scrollable.clientWidth : container.clientWidth) - 15;
        const calculatedWidth = activeLabelsCount * 60;
        if (calculatedWidth > parentWidth) {
            wrapper.style.width = calculatedWidth + 'px';
        } else {
            wrapper.style.width = '100%';
        }
    }

    // Resolve active unit config for this VK
    const vkUnit = (currentTimeSeriesData && currentTimeSeriesData.vkUnits && currentTimeSeriesData.vkUnits[selectedVk]) || '';
    const familyKey = detectUnitFamily(vkUnit, selectedVk, typeof tsCurrentKeyword !== 'undefined' ? tsCurrentKeyword : '');
    const family = familyKey ? UNIVERSAL_UNIT_FAMILIES[familyKey] : null;
    const unitConfig = (family && tsActiveUnitKey && family.units[tsActiveUnitKey]) ? family.units[tsActiveUnitKey] : null;

    const chartType = isSingleYear ? 'bar' : 'line';
    const isSummaryEntity = ent => ['jumlah', 'total', 'subtotal', 'grand total', 'keseluruhan', 'seluruh'].some(kw => ent.trim().toLowerCase() === kw);

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
        var hueIdx = allEntities ? allEntities.indexOf(ent) : entIdx;
        var hue = (Math.max(0, hueIdx) * 137.5) % 360;
        const color = `hsl(${hue}, 70%, 50%)`;
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
                pointBackgroundColor: '#ffffff',
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
        chartInst.destroy();
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

                    const { ctx, chartArea, scales: { x } } = chart;
                    if (!chartArea || !x) return;

                    const totalLabels = (chart.data.labels || []).length;
                    if (totalLabels <= 1) return;

                    const firstTickX = x.getPixelForTick(0);
                    const lastTickX = x.getPixelForTick(totalLabels - 1);
                    const currentX = firstTickX + (lastTickX - firstTickX) * Math.max(0, Math.min(1, p));

                    ctx.save();
                    ctx.beginPath();
                    ctx.rect(chartArea.left - 25, chartArea.top - 25, Math.max(1, (currentX - chartArea.left + 30)), (chartArea.height + 50));
                    ctx.clip();
                },
                afterDatasetDraw(chart, args) {
                    if (chart.config.type !== 'line') return;
                    if (!chart.canvas || !chart.canvas.id || !chart.canvas.id.toLowerCase().includes('timeseries')) return;
                    const p = chart._tracerProgress;
                    if (p == null || p >= 1) return;
                    if (chart._animatingDatasetIndices && !chart._animatingDatasetIndices.has(args.index)) {
                        return;
                    }
                    chart.ctx.restore();
                }
            });
        }

        if (!Chart.registry.plugins.get('timeSeriesGrowthBadgePlugin')) {
            Chart.register({
                id: 'timeSeriesGrowthBadgePlugin',
                afterDatasetsDraw(chart) {
                    if (!window.tsGrowthBadgeEnabled) return;
                    if (!chart.canvas || !chart.canvas.id || !chart.canvas.id.toLowerCase().includes('timeseries')) return;
                    const { ctx, scales: { x, y } } = chart;
                    if (!x || !y) return;
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
                                ctx.strokeStyle = isDark ? '#475569' : '#cbd5e1';
                            } else if (isZero) {
                                ctx.fillStyle = isDark ? 'rgba(30, 41, 59, 0.92)' : 'rgba(241, 245, 249, 0.95)';
                                ctx.strokeStyle = isDark ? '#64748b' : '#94a3b8';
                            } else if (isUp) {
                                ctx.fillStyle = isDark ? 'rgba(6, 78, 59, 0.92)' : 'rgba(209, 250, 229, 0.96)';
                                ctx.strokeStyle = isDark ? '#10b981' : '#059669';
                            } else {
                                ctx.fillStyle = isDark ? 'rgba(127, 29, 29, 0.92)' : 'rgba(254, 226, 226, 0.96)';
                                ctx.strokeStyle = isDark ? '#ef4444' : '#dc2626';
                            }
                            ctx.lineWidth = 1.2;
                            ctx.fill();
                            ctx.stroke();

                            // Warna Teks
                            if (i === 0) {
                                ctx.fillStyle = isDark ? '#cbd5e1' : '#475569';
                            } else if (isZero) {
                                ctx.fillStyle = isDark ? '#94a3b8' : '#64748b';
                            } else if (isUp) {
                                ctx.fillStyle = isDark ? '#34d399' : '#047857';
                            } else {
                                ctx.fillStyle = isDark ? '#f87171' : '#b91c1c';
                            }
                            ctx.fillText(badgeText, pillX, pillY);
                            ctx.restore();
                        }
                    });
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
                <div class="custom-legend-item ts-legend-pill ${isHidden ? 'ts-legend-disabled' : ''}" data-index="${idx}" data-entity="${escHtml(labelText)}" data-chart="${chartIdx || 1}" style="display:flex; align-items:center; gap:6px; cursor:pointer; opacity: ${isHidden ? 0.4 : 1}; user-select:none;" title="${escHtml(labelText)}">
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
                    bottom: 8
                }
            },
            onHover: (event, elements, chart) => {
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
                        return !!(tsTooltipEnabled && window.tsTooltipEnabled !== false);
                    },
                    mode: 'nearest',
                    intersect: true,
                    backgroundColor: '#1e293b',
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
                            el.style.cssText = 'position:absolute;background:#1e293b;color:#fff;padding:10px 14px;border-radius:8px;font-size:0.8rem;font-family:Outfit,sans-serif;max-height:260px;overflow-y:auto;z-index:30;box-shadow:0 8px 24px rgba(0,0,0,0.35);pointer-events:auto;transition:opacity 0.15s;opacity:0;display:none;scrollbar-width:thin;scrollbar-color:#64748b #1e293b;';
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
                        color: document.documentElement.getAttribute('data-bs-theme') === 'dark' ? '#94a3b8' : '#475569',
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
                    grid: { color: document.documentElement.getAttribute('data-bs-theme') === 'dark' ? 'rgba(255,255,255,0.08)' : '#e8e8f0', drawTicks: true },
                    title: {
                        display: true,
                        text: unitConfig ? unitConfig.label : ((currentTimeSeriesData && currentTimeSeriesData.vkUnits && currentTimeSeriesData.vkUnits[selectedVk]) || ''),
                        font: { family: 'Outfit, sans-serif', size: 11, weight: '500' },
                        color: document.documentElement.getAttribute('data-bs-theme') === 'dark' ? '#94a3b8' : '#64748b'
                    },
                    ticks: {
                        display: true,
                        font: { family: 'Outfit, sans-serif', size: 10 },
                        color: document.documentElement.getAttribute('data-bs-theme') === 'dark' ? '#94a3b8' : '#475569',
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

    // 3. Attach click events to custom legend items (in-place toggle without removing pill)
    if (legendDiv) {
        legendDiv.querySelectorAll('.custom-legend-item').forEach(item => {
            item.addEventListener('click', function() {
                const entityName = this.dataset.entity;
                if (!entityName) return;

                const willHide = !tsHiddenEntities.has(entityName);
                if (willHide) {
                    tsHiddenEntities.add(entityName);
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
                            color: '#cbd5e1'
                        },
                        border: {
                            display: true,
                            color: '#cbd5e1'
                        },
                        ticks: {
                            font: { family: 'Outfit, sans-serif', size: 10 },
                            color: '#475569',
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
            if (!c || !c.ctx) return;
            c._tracerProgress = progress;
            c.draw();
        });

        if (raw < 1) {
            const rafId = requestAnimationFrame(step);
            validCharts.forEach(c => { c._tracerRafId = rafId; });
        } else {
            validCharts.forEach(c => {
                c._tracerProgress = 1;
                c._tracerRafId = null;
                c._animatingDatasetIndices = null;
                c.draw();
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

function buildEntityChecklist(allEntities) {
    const container = document.getElementById('ts-entity-checklist');
    if (!container) return;
    if (!allEntities || allEntities.length === 0) return;

    const visibleCount = allEntities.filter(e => !tsHiddenEntities.has(e)).length;
    const allChecked = visibleCount === allEntities.length;
    const toggleAllLabel = allChecked ? 'Semua' : `${visibleCount}/${allEntities.length}`;

    let html = `
    <div class="dropdown">
        <button class="btn btn-sm btn-outline-secondary dropdown-toggle ts-entity-btn" type="button" data-bs-toggle="dropdown" data-bs-auto-close="outside" aria-expanded="false" style="font-size:0.82rem; padding:5px 12px; border-radius:8px;">
            Pilih Entitas <span class="badge bg-secondary ms-1">${toggleAllLabel}</span>
        </button>
        <div class="dropdown-menu p-2 shadow" style="max-height:300px; width:260px;">
            <div class="px-1 pb-2 mb-1 border-bottom" onclick="event.stopPropagation();">
                <input type="text" id="ts-entity-dropdown-search" class="form-control form-control-sm" placeholder="🔍 Cari entitas..." style="font-size:0.78rem;">
            </div>
            <label class="dropdown-item px-1 py-1" style="display:flex; align-items:center; gap:6px; font-size:0.8rem; font-weight:600; border-bottom:1px solid #e2e8f0; margin-bottom:4px; cursor:pointer;">
                <input type="checkbox" id="ts-check-all" ${allChecked ? 'checked' : ''} style="width:16px;height:16px;">
                <span>Pilih Semua</span>
            </label>
            <div class="ts-entity-checklist-scroll" style="max-height:190px; overflow-y:auto;">`;

    allEntities.forEach(ent => {
        const checked = !tsHiddenEntities.has(ent);
        html += `<label class="dropdown-item px-1 py-1 ts-entity-dropdown-item" data-name="${ent.toLowerCase()}" style="display:flex; align-items:center; gap:6px; font-size:0.8rem; cursor:pointer;">
            <input type="checkbox" class="ts-entity-cb" data-entity="${ent}" ${checked ? 'checked' : ''} style="width:16px;height:16px;">
            <span class="text-truncate">${ent}</span>
        </label>`;
    });

    html += `</div></div></div>`;

    container.innerHTML = html;

    // Live search event listener inside main entity dropdown
    const searchInp = document.getElementById('ts-entity-dropdown-search');
    if (searchInp) {
        searchInp.addEventListener('input', function(e) {
            e.stopPropagation();
            const kw = this.value.trim().toLowerCase();
            container.querySelectorAll('.ts-entity-dropdown-item').forEach(item => {
                const name = item.dataset.name || '';
                item.style.display = (!kw || name.includes(kw)) ? 'flex' : 'none';
            });
        });
        searchInp.addEventListener('click', function(e) {
            e.stopPropagation();
        });
    }

    container.querySelectorAll('.ts-entity-cb').forEach(cb => {
        cb.addEventListener('change', function() {
            const isHidden = !this.checked;
            const ent = this.dataset.entity;
            if (isHidden) {
                tsHiddenEntities.add(ent);
            } else {
                tsHiddenEntities.delete(ent);
            }
            if (tsRenderCallback) tsRenderCallback(!isHidden ? ent : null);
            _syncEntityVisibility(ent, isHidden);
        });
    });

    const checkAll = document.getElementById('ts-check-all');
    if (checkAll) {
        checkAll.addEventListener('change', function() {
            const allHidden = !this.checked;
            if (allHidden) {
                allEntities.forEach(e => tsHiddenEntities.add(e));
            } else {
                tsHiddenEntities.clear();
            }
            if (tsRenderCallback) tsRenderCallback(null);
            allEntities.forEach(e => _syncEntityVisibility(e, allHidden));
        });
    }
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
                <p style="margin-bottom:12px; color:#475569; font-size:0.95rem; text-align:left;">
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
        let detailText = `${result.added.length} kolom berhasil didaftarkan sebagai Master Kolom.`;
        if (result.already_exists.length > 0) {
            detailText += `\n${result.already_exists.length} kolom sudah ada sebelumnya: ${result.already_exists.slice(0, 5).join(', ')}${result.already_exists.length > 5 ? '...' : ''}`;
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
            const color = confPct >= 90 ? '#10b981' : confPct >= 65 ? '#f59e0b' : '#ef4444';
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
            <p style="font-size:0.8rem; color:#64748b; margin-top:10px; text-align:left;">
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
            confirmButtonColor: '#06b6d4'
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
                <input type="checkbox" id="${checkboxId(i)}" class="ren-col-cb" value="${i}" data-header="${escHtml(h)}" ${meta ? 'disabled' : ''} style="width:18px;height:18px;accent-color:#8b5cf6;flex-shrink:0;cursor:pointer;" onchange="document.getElementById('${containerId(i)}').style.display=this.checked?'':'none'; updateRenameSelectedCount();">
                <span style="flex:1; min-width:240px; font-size:0.92rem; font-weight:600; color:#1e293b; white-space:normal; word-break:break-word; line-height:1.35; text-align:left; padding-right:8px;" title="${escHtml(h)}">${escHtml(h)}${meta ? ' <em style="color:#94a3b8;font-size:0.78rem;">(metadata)</em>' : ''}</span>
                
                <div id="${containerId(i)}" class="custom-select-container" style="display:none; position:relative; flex:1.4; min-width:460px;">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <input type="text" id="${selectId(i)}" class="master-select-input" placeholder="🔍 Cari & Pilih Master Kolom..." style="flex:1; min-width:220px; padding:8px 12px; border-radius:6px; border:1.5px solid #cbd5e1; font-size:0.88rem; background:#fff; cursor:pointer;" readonly onclick="showCustomDropdown(${i})" title="Klik untuk memilih master kolom">
                        ${sameKwCount > 1 ? `
                        <button type="button" title="Salin nilai master ini ke semua kolom yang mengandung '${escHtml(kw)}'" style="background:#f3e8ff; border:1px solid #d8b4fe; border-radius:6px; padding:7px 10px; cursor:pointer; font-size:0.78rem; color:#6b21a8; font-weight:600; display:flex; align-items:center; gap:4px; white-space:nowrap; flex-shrink:0;" onclick="copyMasterToSimilar(${i}, '${kw.replace(/'/g, "\\'")}')" onmouseenter="this.style.background='#e9d5ff'" onmouseleave="this.style.background='#f3e8ff'">
                            <span>✨ Salin Sejenis</span>
                        </button>
                        ` : ''}
                        <button type="button" title="Salin nilai master baris ini ke semua kolom yang tercentang" style="background:#f1f5f9; border:1px solid #cbd5e1; border-radius:6px; padding:7px 10px; cursor:pointer; font-size:0.78rem; color:#475569; font-weight:500; display:flex; align-items:center; gap:4px; white-space:nowrap; flex-shrink:0;" onclick="copyMasterToChecked(${i})" onmouseenter="this.style.background='#e2e8f0'" onmouseleave="this.style.background='#f1f5f9'">
                            <span>📋 Ke Tercentang</span>
                        </button>
                    </div>
                    <div id="custom-dropdown-${i}" class="custom-select-dropdown" style="display:none; position:absolute; z-index:9999; max-height:280px; overflow-y:auto; background:#fff; border:1.5px solid #8b5cf6; border-radius:6px; margin-top:4px; padding:6px; width:100%; box-shadow:0 14px 28px rgba(0,0,0,0.18);">
                        <input type="text" id="custom-dropdown-search-${i}" placeholder="Ketik kata kunci pencarian..." autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" style="width:100%; padding:7px 10px; border:1px solid #cbd5e1; border-radius:4px; font-size:0.82rem; margin-bottom:6px; outline:none;" oninput="filterCustomDropdownOptions(${i}, this.value)">
                        <div id="custom-dropdown-options-${i}">
                            ${masterCols.map(c => `<div class="custom-dropdown-option" style="padding:8px 12px; cursor:pointer; border-radius:4px; font-size:0.85rem; white-space:normal; word-break:break-word; text-align:left; border-bottom:1px solid #f8fafc; transition:background 0.15s;" onclick="selectCustomOption(${i}, '${c.standard.replace(/'/g, "\'")}')" onmouseenter="this.style.background='#f3e8ff'" onmouseleave="this.style.background='transparent'">${c.standard}</div>`).join('')}
                        </div>
                    </div>
                </div>
            </div>`;
        }).join('');

        const quickChipsHtml = uniqueKeywords.length > 1 ? `
            <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin-bottom:10px; padding:8px 12px; background:#fff; border:1px dashed #cbd5e1; border-radius:8px;">
                <span style="font-size:0.8rem; font-weight:700; color:#475569;">🎯 Pilih Cepat Kolom:</span>
                ${uniqueKeywords.map(kw => `
                    <button type="button" style="background:#ede9fe; color:#6d28d9; border:1px solid #c4b5fd; border-radius:14px; padding:3px 12px; font-size:0.78rem; font-weight:600; cursor:pointer; transition:all 0.15s;" onclick="selectColumnsByKeyword('${kw.replace(/'/g, "\\'")}')" onmouseenter="this.style.background='#ddd6fe'" onmouseleave="this.style.background='#ede9fe'">
                        ${escHtml(kw)}
                    </button>
                `).join('')}
                <button type="button" style="background:#f1f5f9; color:#475569; border:1px solid #cbd5e1; border-radius:14px; padding:3px 10px; font-size:0.76rem; cursor:pointer;" onclick="selectColumnsByKeyword('all')">Semua</button>
                <button type="button" style="background:#fef2f2; color:#b91c1c; border:1px solid #fecaca; border-radius:14px; padding:3px 10px; font-size:0.76rem; cursor:pointer;" onclick="selectColumnsByKeyword('')">❌ Hapus Pilihan</button>
            </div>
        ` : '';

        const bulkBarHtml = `
            <div style="background: linear-gradient(135deg, #f8fafc, #f1f5f9); border: 1.5px solid #e2e8f0; border-radius: 10px; padding: 14px 16px; margin-bottom: 14px; text-align: left; box-shadow: 0 1px 3px rgba(0,0,0,0.03);">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; flex-wrap: wrap; gap: 8px;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <input type="checkbox" id="ren-select-all-cb" style="width: 18px; height: 18px; accent-color: #8b5cf6; cursor: pointer;" onchange="toggleSelectAllRenameColumns(this)">
                        <label for="ren-select-all-cb" style="font-weight: 600; font-size: 0.92rem; color: #1e293b; cursor: pointer; margin: 0;">Pilih Semua Kolom Data</label>
                        <span id="ren-selected-count-badge" style="font-size: 0.78rem; font-weight: 600; padding: 3px 10px; border-radius: 20px; background: #f1f5f9; color: #64748b; transition: all 0.2s;">0 kolom dipilih</span>
                    </div>
                    <span style="font-size: 0.8rem; color: #64748b;">Pilih master di bawah untuk menerapkan ke banyak kolom sekaligus</span>
                </div>
                
                ${quickChipsHtml}
                
                <div style="display: flex; align-items: center; gap: 10px;">
                    <div class="custom-select-container" style="position: relative; flex: 1;">
                        <input type="text" id="bulk-ren-sel" class="master-select-input" placeholder="🔍 Cari & Pilih Master Kolom untuk diterapkan massal..." style="width: 100%; padding: 9px 14px; border-radius: 8px; border: 1.5px solid #cbd5e1; font-size: 0.9rem; background: #fff; cursor: pointer; box-shadow: 0 1px 2px rgba(0,0,0,0.04);" readonly onclick="showBulkCustomDropdown()">
                        <div id="custom-dropdown-bulk" class="custom-select-dropdown" style="display: none; position: absolute; z-index: 10000; max-height: 380px; overflow-y: auto; background: #fff; border: 1.5px solid #8b5cf6; border-radius: 8px; margin-top: 6px; padding: 8px; width: 100%; box-shadow: 0 16px 36px rgba(0,0,0,0.18), 0 6px 12px rgba(0,0,0,0.08);">
                            <input type="text" id="custom-dropdown-search-bulk" placeholder="Ketik kata kunci master..." autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" style="width: 100%; padding: 8px 12px; border: 1.5px solid #cbd5e1; border-radius: 6px; font-size: 0.85rem; margin-bottom: 8px; outline:none;" oninput="filterBulkCustomDropdownOptions(this.value)">
                            <div id="custom-dropdown-options-bulk">
                                ${masterCols.map(c => `<div class="custom-dropdown-option" style="padding: 8px 12px; cursor: pointer; border-radius: 6px; font-size: 0.85rem; white-space: normal; word-break: break-word; text-align: left; border-bottom: 1px solid #f8fafc; transition: background 0.15s;" onclick="selectBulkCustomOption('${c.standard.replace(/'/g, "\'")}')" onmouseenter="this.style.background='#f3e8ff'" onmouseleave="this.style.background='transparent'">${c.standard}</div>`).join('')}
                            </div>
                        </div>
                    </div>
                    <button type="button" class="btn btn-sm" onclick="applyBulkMasterToChecked()" style="background: #8b5cf6; color: #fff; font-weight: 600; font-size: 0.88rem; padding: 9px 18px; border-radius: 8px; border: none; display: flex; align-items: center; gap: 6px; box-shadow: 0 2px 4px rgba(139,92,246,0.25); cursor: pointer; white-space: nowrap;">
                        <span>⚡ Terapkan ke Kolom Tercentang</span>
                    </button>
                </div>
                <label style="display: flex; align-items: center; gap: 6px; font-size: 0.78rem; color: #64748b; cursor: pointer; margin-top: 8px; user-select: none;">
                    <input type="checkbox" id="bulk-only-empty" style="accent-color: #8b5cf6; width: 14px; height: 14px; cursor: pointer;">
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

