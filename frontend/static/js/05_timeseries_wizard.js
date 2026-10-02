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

}

// --- End Wizard ---


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

            🔍  Ditemukan <strong>${groupKeys.length}</strong> varian/tabel yang sesuai dengan kata kunci "<strong>${keyword}</strong>".

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
    var eduRank = function(name) {
        if (!name) return 999;
        var s = String(name).toLowerCase();
        if (s.includes('sekolah dasar') || s.includes('≤ sd') || s.includes('<= sd') || s.includes('sd /')) return 1;
        if (s.includes('smp')) return 2;
        if (s.includes('sma') || s.includes('smk')) return 3;
        if (s.includes('perguruan tinggi') || s.includes('diploma') || s.includes('universitas')) return 4;
        return 999;
    };

    var romanValues = {
        'i': 1, 'ii': 2, 'iii': 3, 'iv': 4, 'v': 5, 'vi': 6, 'vii': 7, 'viii': 8, 'ix': 9, 'x': 10,
        'xi': 11, 'xii': 12, 'xiii': 13, 'xiv': 14, 'xv': 15, 'xvi': 16, 'xvii': 17, 'xviii': 18, 'xix': 19, 'xx': 20
    };

    var getRank = function(name) {
        if (!name) return [9999, 0, ''];
        var s = String(name).trim();
        var sLower = s.toLowerCase();

        // 1. Summary rows always at the very bottom
        if (sLower === 'kabupaten tasikmalaya' || sLower === 'jumlah' || sLower === 'total') {
            return [9999, 0, sLower];
        }

        // 2. Education levels
        var er = eduRank(sLower);
        if (er !== 999) {
            return [1, er, sLower];
        }

        // 3. Pure Roman Numerals (e.g. PPPK Golongan I - XVII)
        var mRoman = sLower.match(/^(?:golongan\s+)?([ivx]+)$/);
        if (mRoman && romanValues[mRoman[1]]) {
            return [2, romanValues[mRoman[1]], sLower];
        }

        // 4. PNS Rank Hierarchy (e.g. I/A, Golongan I/Range I)
        var mPnsGol = sLower.match(/^golongan\s+([ivx]+)(?:\/.*)?$/);
        if (mPnsGol && romanValues[mPnsGol[1]]) {
            return [3, romanValues[mPnsGol[1]] * 100 + 90, sLower];
        }
        var mPnsSub = sLower.match(/^([ivx]+)\s*\/\s*([a-e])(?:\s*\(.*\))?$/);
        if (mPnsSub && romanValues[mPnsSub[1]]) {
            var subVal = mPnsSub[2].charCodeAt(0) - 96; // 'a'=1, 'b'=2, etc.
            return [3, romanValues[mPnsSub[1]] * 100 + subVal, sLower];
        }

        // 5. Numbered items (e.g. 1. xxx)
        var mNum = s.match(/^(\d+)/);
        if (mNum) {
            return [4, parseInt(mNum[1], 10), sLower];
        }

        return [5, 0, sLower];
    };

    return arr.sort(function(a, b) {
        var rA = getRank(a), rB = getRank(b);
        if (rA[0] !== rB[0]) return rA[0] - rB[0];
        if (rA[1] !== rB[1]) return rA[1] - rB[1];
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

        Object.keys(tsActiveUnitVKMap).forEach(vk => {
            const vkUnit = (currentTimeSeriesData && currentTimeSeriesData.vkUnits && currentTimeSeriesData.vkUnits[vk]) || '';
            const fk = detectUnitFamily(vkUnit, vk, '');
            if (!fk || !UNIVERSAL_UNIT_FAMILIES[fk]) {
                delete tsActiveUnitVKMap[vk];
            }
        });

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

    const badgesEl = document.getElementById("ts-result-badges-outside");

    const rawKeywords = (keyword || '').split(',').map(k => k.trim()).filter(Boolean);



    if (titleEl) {

        if (rawKeywords.length === 1) {

            titleEl.innerHTML = `<div class="d-flex align-items-center gap-2 px-4 py-2.5" style="border-left:4px solid var(--primary, #1e40af);"><i class="bi bi-graph-up-arrow text-primary fs-4"></i><span style="font-size:1.05rem; font-weight:700; letter-spacing:0.5px; color:var(--text-primary, #1e293b);">Hasil Analisis Deret Waktu</span><span class="badge bg-primary text-white ms-2" style="font-size:0.72rem;">1 Indikator</span></div>`;

        } else if (rawKeywords.length > 1) {

            titleEl.innerHTML = `<div class="d-flex align-items-center gap-2 px-4 py-2.5" style="border-left:4px solid var(--primary, #1e40af);"><i class="bi bi-graph-up-arrow text-primary fs-4"></i><span style="font-size:1.05rem; font-weight:700; letter-spacing:0.5px; color:var(--text-primary, #1e293b);">Hasil Analisis Deret Waktu</span><span class="badge bg-primary text-white ms-1" style="font-size:0.72rem;">${rawKeywords.length} Indikator</span></div>`;

        } else {

            titleEl.innerHTML = `<div class="d-flex align-items-center gap-2 px-4 py-2.5" style="border-left:4px solid var(--primary, #1e40af);"><i class="bi bi-graph-up-arrow text-primary fs-4"></i><span style="font-size:1.05rem; font-weight:700; letter-spacing:0.5px; color:var(--text-primary, #1e293b);">Hasil Analisis Deret Waktu</span></div>`;

        }

        titleEl.style.display = 'block';

    }

    if (badgesEl) {

        if (rawKeywords.length > 0) {

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

    const isAdminAnom = (currentUserRole === 'admin' || window.currentUserRole === 'admin');

    if (isAdminAnom && detectedAnomalies && detectedAnomalies.length > 0) {

        let anomListHtml = detectedAnomalies.slice(0, 4).map(a => `<li style="margin-bottom:2px;"><b>${escHtml(a.entitas)} (${a.year}):</b> ${escHtml(a.message)}</li>`).join('');

        if (detectedAnomalies.length > 4) {

            anomListHtml += `<li style="list-style:none; font-style:italic; margin-top:3px;">...dan ${detectedAnomalies.length - 4} anomali lainnya (lihat menu Admin &gt; Anomali Deret Waktu)</li>`;

        }

        const bannerHtml = `

            <div style="display:flex; align-items:flex-start; gap:10px;">

                <span style="font-size:1.25rem; line-height:1;">⚠️</span>

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

    const chartControlCard = document.getElementById('ts-chart-control-card');
    if (chartControlCard) chartControlCard.style.display = 'block';

    const viewModeBar = document.getElementById('ts-view-mode-bar');
    if (viewModeBar) viewModeBar.style.display = 'flex';
    setTimeSeriesViewMode(tsCurrentViewMode || 'chart');



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


        const thead = document.getElementById("ts-grid-head");

        let headHtml = `<tr><th rowspan="2" style="min-width: 220px; width: 220px;">Rincian</th>`;

        years.forEach(y => {

            headHtml += `<th colspan="${checked.length}" style="text-align: center; border-left: 2px solid #e2e8f0; background: #f8fafc;">${y}</th>`;

        });

        headHtml += `</tr><tr>`;

        function getCleanUnitSuffix(vk) {
            var perVkCfg = getUnitConfigForVK(vk);
            var rawUnit = perVkCfg ? perVkCfg.label : (currentTimeSeriesData && currentTimeSeriesData.vkUnits && currentTimeSeriesData.vkUnits[vk] ? currentTimeSeriesData.vkUnits[vk] : '');

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

                            val = formatWithUnitScale(rawNum, getUnitConfigForVK(vk));

                        } else {

                            val = formatIndoNumber(rawVal);

                        }

                    }

                    const borderStyle = idx === 0 ? "border-left: 2px solid #e2e8f0;" : "border-left: 1px dashed #e2e8f0;";

                    

                    const anom = anomMap[ent + '::' + vk + '::' + y];

                    let cellDisplay = val;

                    const isAdmin = (currentUserRole === 'admin' || window.currentUserRole === 'admin');

                    if (isAdmin && anom && val !== '-' && val !== '...') {

                        cellDisplay = `<span title="${escHtml(anom.message)}" style="cursor:help; font-size:0.8rem; margin-right:3px;">⚠️</span><span style="font-weight:600; color:#b45309; background:#fef3c7; padding:1px 4px; border-radius:4px;" title="${escHtml(anom.message)}">${val}</span>`;

                    }



                    const sInfo = (currentTimeSeriesData && currentTimeSeriesData.entitySourceMap && currentTimeSeriesData.entitySourceMap[ent + '::' + y + '::' + vk]) ||

                                  (currentTimeSeriesData && currentTimeSeriesData.sourcesMap && currentTimeSeriesData.sourcesMap[y + '::' + vk]);

                    if (isAdmin && tsShowSources && sInfo && val !== '-' && val !== '...') {

                        const tnEsc = (sInfo.table_name || '').replace(/'/g, "\\'");

                        const fnEsc = (sInfo.doc_filename || '').replace(/'/g, "\\'");

                        const rcEsc = (sInfo.raw_col || '').replace(/'/g, "\\'");

                        const vkEsc = (vk || '').replace(/'/g, "\\'");

                        const sourceTooltip = `Publikasi: Kabupaten Tasikmalaya Dalam Angka (${sInfo.doc_year || 'BPS'})\nTabel: ${sInfo.table_name || ''}\nKolom Asli: ${sInfo.raw_col || ''}`;

                        cellDisplay += ` <a href="javascript:void(0)" onclick="showSourceLineageDetail('${y}', '${vkEsc}', '${sInfo.table_id}', '${tnEsc}', '${sInfo.doc_year || ''}', '${fnEsc}', '${rcEsc}')" style="font-size:0.72rem; text-decoration:none; margin-left:3px; padding:1px 4px; background:#eff6ff; color:#1d4ed8; border-radius:3px; font-weight:600; vertical-align:middle;" title="${escHtml(sourceTooltip)}" class="d-inline-flex align-items-center gap-1"><i class="bi bi-box-arrow-up-right" style="font-size:0.65rem;"></i></a>`;

                    }



                    bodyHtml += `<td style="${borderStyle} min-width: 140px; width: 140px; text-align: right; white-space: nowrap; color: ${val === '-' || val === '...' ? cssVar('--text-light') || '#94a3b8' : cssVar('--text-tertiary') || '#334155'};">${cellDisplay}</td>`;

                });

            });

            bodyHtml += `</tr>`;

        });

        tbody.innerHTML = bodyHtml;

        if (tbody) {
            tbody.onmouseover = function(e) {
                const tr = e.target.closest('tr[data-entity]');
                if (!tr) return;
                const entityName = tr.dataset.entity;
                if (!entityName || tsHiddenEntities.has(entityName)) return;

                [window.timeSeriesChartInstance, window.timeSeriesChart2Instance, window.timeSeriesChart3Instance].forEach(inst => {
                    if (inst && inst.data && inst.data.datasets) {
                        inst.data.datasets.forEach(ds => {
                            if (ds.entity === entityName) {
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
            };

            tbody.onmouseleave = function() {
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
            };
        }

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

        

        // Helper deteksi entitas rekapitulasi/total secara kontekstual
        // (Kecamatan vs Antar Kab/Kota se-Jawa Barat)
        function getSummaryEntityDetector(allEntitiesList) {
            if (!allEntitiesList || allEntitiesList.length === 0) {
                return (ent) => {
                    if (!ent) return false;
                    const c = ent.trim().toLowerCase();
                    return ['kabupaten tasikmalaya', 'jumlah', 'total', 'grand total', 'keseluruhan', 'subtotal'].includes(c);
                };
            }
            const lower = allEntitiesList.map(e => (typeof e === 'string' ? e.trim().toLowerCase() : ''));
            const isJabarTable = lower.some(e =>
                e === 'jawa barat' ||
                e === 'provinsi jawa barat' ||
                e.includes('garut') ||
                e.includes('ciamis') ||
                e.includes('pangandaran') ||
                e.includes('kota tasikmalaya') ||
                e.includes('bandung') ||
                e.includes('bogor') ||
                e.includes('sukabumi') ||
                e.includes('cianjur')
            );

            if (isJabarTable) {
                return (ent) => {
                    if (!ent) return false;
                    const c = ent.trim().toLowerCase();
                    return ['jawa barat', 'provinsi jawa barat', 'jumlah', 'total', 'keseluruhan', 'grand total', 'subtotal'].includes(c);
                };
            } else {
                return (ent) => {
                    if (!ent) return false;
                    const c = ent.trim().toLowerCase();
                    return ['kabupaten tasikmalaya', 'jumlah', 'total', 'keseluruhan', 'grand total', 'subtotal'].includes(c);
                };
            }
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
                let summaryTotalVal = null;
                const isSummaryChecker = getSummaryEntityDetector(filteredEntities);

                filteredEntities.forEach(ent => {
                    const isSummaryRow = isSummaryChecker(ent);
                    years.forEach(y => {
                        const yearData = entityMap[ent][y] || {};
                        checked.forEach(vk => {
                            const raw = yearData[vk];
                            if (raw != null && raw !== '-' && raw !== '...' && raw !== '') {
                                totalPoints++;
                                const num = parseIndoNumberToFloat(raw);
                                if (num !== null && !isNaN(num)) {
                                    const perVkCfg = getUnitConfigForVK(vk);
                                    const scaled = perVkCfg ? num * (perVkCfg.factor != null ? perVkCfg.factor : 1) : num;
                                    if (!isSummaryRow) {
                                        // Min dan Max hanya dihitung dari entitas wilayah murni (bukan total)
                                        if (scaled < minVal) minVal = scaled;
                                        if (scaled > maxVal) maxVal = scaled;
                                    } else {
                                        // Simpan nilai total jika ada
                                        summaryTotalVal = scaled;
                                    }
                                }
                            }
                        });
                    });
                });

                // Safety fallback jika semua baris terdeteksi summary
                if (minVal === Infinity && maxVal === -Infinity && summaryTotalVal !== null) {
                    minVal = summaryTotalVal;
                    maxVal = summaryTotalVal;
                }

                statTotalPts.textContent = totalPoints > 0 ? totalPoints.toLocaleString('id-ID') : '0';

                if (minVal !== Infinity && maxVal !== -Infinity) {
                    const firstVkCfg = getUnitConfigForVK(checked[0]);
                    const minFmt = formatWithUnitScale(minVal, { factor: 1, isInteger: firstVkCfg?.isInteger, maxDecimals: firstVkCfg?.maxDecimals });
                    const maxFmt = formatWithUnitScale(maxVal, { factor: 1, isInteger: firstVkCfg?.isInteger, maxDecimals: firstVkCfg?.maxDecimals });
                    const uSuffix = firstVkCfg ? ' ' + firstVkCfg.label : '';
                    statRange.textContent = `${minFmt} – ${maxFmt}${uSuffix}`;
                    const statRangeTotal = document.getElementById('ts-stat-range-total');
                    if (statRangeTotal) {
                        if (summaryTotalVal !== null) {
                            const sumFmt = formatWithUnitScale(summaryTotalVal, { factor: 1, isInteger: firstVkCfg?.isInteger, maxDecimals: firstVkCfg?.maxDecimals });
                            statRangeTotal.textContent = `(Total: ${sumFmt}${uSuffix})`;
                        } else {
                            statRangeTotal.textContent = '';
                        }
                    }
                } else {
                    statRange.textContent = '-';
                    const statRangeTotal = document.getElementById('ts-stat-range-total');
                    if (statRangeTotal) statRangeTotal.textContent = '';
                }

                if (years.length > 0) {
                    const isConsecutive = years.every((y, i) => i === 0 || y === years[i - 1] + 1);
                    if (isConsecutive && years.length > 1) {
                        statYears.textContent = `${years[0]} – ${years[years.length - 1]}`;
                    } else if (years.length <= 3) {
                        statYears.textContent = years.join(' & ');
                    } else {
                        statYears.textContent = `${years[0]} – ${years[years.length - 1]}`;
                    }
                    let yearSubtitle = document.getElementById('ts-stat-years-subtitle');
                    if (!yearSubtitle) {
                        yearSubtitle = document.createElement('div');
                        yearSubtitle.id = 'ts-stat-years-subtitle';
                        yearSubtitle.className = 'text-muted mt-1';
                        yearSubtitle.style.fontSize = '0.72rem';
                        statYears.parentElement.appendChild(yearSubtitle);
                    }
                    yearSubtitle.textContent = `(${years.length} Tahun)`;
                } else {
                    statYears.textContent = '-';
                    const yearSubtitle = document.getElementById('ts-stat-years-subtitle');
                    if (yearSubtitle) yearSubtitle.textContent = '';
                }

                // --- 2 kartu: Rincian, Indikator ---
                const statEntities = document.getElementById('ts-stat-total-entities');
                const statIndicators = document.getElementById('ts-stat-active-indicators');

                if (statEntities) {
                    const detailEntities = filteredEntities.filter(ent => {
                        const t = currentTimeSeriesData.entityTypeMap?.[ent] || '';
                        return t !== 'Total' && t !== 'Kabupaten/Kota';
                    });
                    statEntities.textContent = detailEntities.length > 0 ? detailEntities.length.toLocaleString('id-ID') : '-';
                }

                if (statIndicators) {
                    const totalVks = currentTimeSeriesData.valueKeys?.length || 0;
                    statIndicators.textContent = checked.length > 0 ? `${checked.length} / ${totalVks}` : '-';
                }
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

    

    // Display Toggles (Khusus Grafik): Badge Naik/Turun & Tooltip
    const chartBadgeToggle = document.getElementById('ts-chart-growth-badge-toggle');
    if (chartBadgeToggle) {
        tsGrowthBadgeEnabled = chartBadgeToggle.checked;
        window.tsGrowthBadgeEnabled = chartBadgeToggle.checked;

        chartBadgeToggle.addEventListener('change', function() {
            const isChecked = this.checked;
            tsGrowthBadgeEnabled = isChecked;
            window.tsGrowthBadgeEnabled = isChecked;

            const chip = this.closest('.ts-filter-chip');
            if (chip) chip.classList.toggle('active', isChecked);

            // Re-render grafik aktif secara instan
            ['timeSeriesChartInstance', 'timeSeriesChart2Instance', 'timeSeriesChart3Instance'].forEach(key => {
                if (window[key] && typeof window[key].update === 'function') {
                    window[key].update('none');
                }
            });
        });
    }

    const chartTooltipToggle = document.getElementById('ts-chart-tooltip-toggle');
    if (chartTooltipToggle) {
        tsTooltipEnabled = chartTooltipToggle.checked;
        window.tsTooltipEnabled = chartTooltipToggle.checked;

        const chip = chartTooltipToggle.closest('.ts-filter-chip');
        if (chip) chip.classList.toggle('active', chartTooltipToggle.checked);

        chartTooltipToggle.addEventListener('change', function() {
            const isChecked = this.checked;
            tsTooltipEnabled = isChecked;
            window.tsTooltipEnabled = isChecked;

            const c = this.closest('.ts-filter-chip');
            if (c) c.classList.toggle('active', isChecked);

            if (!isChecked) {
                ['ts-chart-tooltip', 'ts-chart-tooltip-2', 'ts-chart-tooltip-3'].forEach(id => {
                    const el = document.getElementById(id);
                    if (el) {
                        el.style.opacity = '0';
                        el.style.display = 'none';
                    }
                });
            }

            // Update active chart instances segera
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



