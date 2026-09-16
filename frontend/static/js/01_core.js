let __excelDragFiles = [];

// Global error handler — tangkap unhandled JS errors
window.addEventListener('error', function(e) {
    const msg = (e.message || (e.error && e.error.message) || '').toString();
    if (
        msg.includes('ResizeObserver') ||
        msg.includes('Script error.')
    ) {
        return; // Abaikan notifikasi benign browser resize observer & cross-origin script
    }
    console.error('[SIPEDAS Error]', e.filename, e.lineno, e.message);
    if (typeof showToast === 'function') {
        showToast('error', 'Kesalahan Sistem', 'Terjadi kesalahan tak terduga. Silakan muat ulang halaman.');
    }
});
window.addEventListener('unhandledrejection', function(e) {
    console.error('[SIPEDAS Unhandled Promise]', e.reason);
    if (typeof showToast === 'function') {
        showToast('error', 'Kesalahan Jaringan', 'Gagal terhubung ke server. Periksa koneksi internet Anda.');
    }
});


// === LIVE UPDATE: Cross-tab data notification ===
function notifyDataChange(type) {
    try {
        localStorage.setItem('sipedas_data_event', JSON.stringify({
            type: type,
            timestamp: Date.now()
        }));
    } catch(e) {}
}

// === LIVE UPDATE: Handle data change from another tab ===
function handleDataChange(type) {
    try {
        switch(type) {
            case 'document':
                if (typeof loadDocuments === 'function') loadDocuments();
                if (typeof populateDocumentList === 'function') populateDocumentList();
                if (typeof loadDashboardStats === 'function') loadDashboardStats();
                break;
            case 'table':
                if (typeof populateDocumentList === 'function') populateDocumentList();
                if (typeof loadDashboardStats === 'function') loadDashboardStats();
                break;
            case 'table_data':
                if (typeof loadDashboardStats === 'function') loadDashboardStats();
                break;
            case 'master':
                if (typeof renderMasterColumns === 'function') renderMasterColumns();
                break;
            case 'anomaly':
                if (typeof loadTimeSeriesAnomalies === 'function') loadTimeSeriesAnomalies(false);
                if (typeof loadDashboardStats === 'function') loadDashboardStats();
                break;
            case 'backup':
                if (typeof loadAdminBackups === 'function') loadAdminBackups();
                if (typeof loadDashboardBackupInfo === 'function') loadDashboardBackupInfo();
                break;
            case 'dashboard':
                if (typeof loadDashboardStats === 'function') loadDashboardStats();
                break;
        }
    } catch(e) {}
}

// === GATEKEEPER INPUT SEL TABEL: CEGAH PASTE GAMBAR, FILE & FORMAT HTML ===
document.addEventListener('paste', function(e) {
    const cell = e.target && e.target.closest ? e.target.closest('.editable-cell') : null;
    if (!cell) return;

    const clipboardData = e.clipboardData || window.clipboardData;
    if (!clipboardData) return;

    // 1. Cek apakah ada file atau gambar di clipboard
    let hasImage = false;
    if (clipboardData.types) {
        for (let i = 0; i < clipboardData.types.length; i++) {
            if (clipboardData.types[i] === 'Files') {
                hasImage = true;
                break;
            }
        }
    }
    if (!hasImage && clipboardData.items) {
        for (let i = 0; i < clipboardData.items.length; i++) {
            if (clipboardData.items[i].type && clipboardData.items[i].type.indexOf('image') !== -1) {
                hasImage = true;
                break;
            }
        }
    }

    if (hasImage) {
        e.preventDefault();
        if (typeof showToast === 'function') {
            showToast('warning', 'Input Tidak Valid', 'Gambar atau file tidak dapat ditempel ke dalam sel tabel data. Kolom ini hanya menerima nilai teks atau angka.');
        }
        return;
    }

    // 2. Hanya ambil Plain Text (buang semua styling HTML & tag eksternal)
    e.preventDefault();
    let rawText = clipboardData.getData('text/plain') || '';
    let cleanText = rawText.replace(/[\r\n]+/g, ' ').trim();

    // 3. Validasi tipe data jika kolom bertipe number
    const colType = cell.getAttribute('data-type') || 'text';
    if (colType === 'number' && cleanText !== '') {
        const isBpsSymbol = /^(\-|--|\.\.\.|n\.a|na|0)$/i.test(cleanText);
        const cleanNum = cleanText.replace(/\./g, '').replace(/,/g, '.').replace(/\s/g, '');
        const isNumeric = !isNaN(Number(cleanNum)) && cleanNum !== '';

        if (!isBpsSymbol && !isNumeric) {
            cell.classList.add('cell-invalid-type');
            if (typeof showToast === 'function') {
                showToast('warning', 'Perhatian Tipe Data', 'Teks yang ditempel bukan format angka yang valid untuk kolom statistik ini.');
            }
            setTimeout(() => cell.classList.remove('cell-invalid-type'), 3000);
        }
    }

    // Sisipkan plain text ke kursor atau sel
    if (document.queryCommandSupported && document.queryCommandSupported('insertText')) {
        document.execCommand('insertText', false, cleanText);
    } else {
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0) {
            const range = sel.getRangeAt(0);
            range.deleteContents();
            range.insertNode(document.createTextNode(cleanText));
            range.collapse(false);
        } else {
            cell.innerText = cleanText;
        }
    }
});

// Cegah drag and drop gambar / file ke dalam editable-cell
document.addEventListener('dragover', function(e) {
    if (e.target && e.target.closest && e.target.closest('.editable-cell')) {
        e.preventDefault();
    }
});

document.addEventListener('drop', function(e) {
    const cell = e.target && e.target.closest ? e.target.closest('.editable-cell') : null;
    if (cell) {
        e.preventDefault();
        if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            if (typeof showToast === 'function') {
                showToast('warning', 'Aksi Ditolak', 'Tidak dapat memasukkan file atau gambar ke dalam sel tabel data.');
            }
        }
    }
});

function cssVar(name) {

    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();

}



function formatCleanTableName(tableName) {

    if (!tableName) return '';

    let s = String(tableName).trim();

    // 1. Hapus .csv di akhir jika ada

    s = s.replace(/\.csv$/i, '');

    // 2. Hapus referensi halaman seperti (Hal 46), (Hal 47, 48), (Halaman 12), (hlm. 10), dll.

    s = s.replace(/\s*\((?:Hal|Halaman|hlm)[\s\d,\-–—\.\?]+\)/gi, '');

    // 3. Hapus angka halaman dalam kurung di akhir jika hanya angka e.g. (198, 200)

    s = s.replace(/\s*\(\s*\d+[\s,\d\-–—\.]*\)\s*$/g, '');

    // 4. Hapus 'Tahun 2022', 'Pada Tahun 2021-2022', 'Year 2025' atau sisa 'Tahun' di ujung akhir

    s = s.replace(/[,.\s]+(?:(?:pada|di)\s+)?(?:tahun|years?)\s*(?:(?:19|20)\d{2}[*\d]?(?:\s*(?:[-–—/]|dan|and|sd|s\/d|to|,)\s*(?:19|20)\d{2}[*\d]?)*.*)?$/i, '');

    // 5. Hapus tahun langsung jika tanpa kata 'tahun', misal ', 2022' atau ' 2021-2025'

    s = s.replace(/[,.\s]+(?:19|20)\d{2}[*\d]?(?:\s*(?:[-–—/]|dan|and|sd|s\/d|to|,)\s*(?:19|20)\d{2}[*\d]?)*.*$/i, '');

    // 6. Hapus sisa kata 'Tahun' / 'Year' jika masih ada di ujung akhir

    s = s.replace(/[,.\s]+(?:(?:pada|di)\s+)?(?:tahun|years?)\s*$/i, '');

    // 7. Bersihkan sisa koma/strip/spasi di ujung kanan

    return s.replace(/[,.\-\s–—]+$/, '').trim();

}

function renderCleanTableTitleHtml(tableName, customClass = "") {
    const clean = formatCleanTableName(tableName);
    if (!clean) return '<span class="text-muted fst-italic">Tanpa Judul</span>';
    
    // 1. Ekstrak nomor tabel di awal jika ada (e.g. 'Tabel 1.1.1 - ', '13.1 : ', '1.1.1 ')
    let num = '';
    let mainTitle = clean;
    const numMatch = clean.match(/^(?:Tabel[\s_]*|)(\d+(?:\.\d+)*)\s*(?:[\-–—:]\s*|\.\s*|\s+)(.+)$/i);
    if (numMatch && numMatch[1] && numMatch[2]) {
        num = numMatch[1].trim();
        mainTitle = numMatch[2].trim();
    }
    
    // Badge hanya angka saja (tanpa '#' dan tanpa 'Tabel')
    const badgeHtml = num 
        ? `<div class="clean-table-badge-wrapper"><span class="clean-table-num-badge badge bg-primary-subtle text-primary border border-primary-subtle font-monospace fw-bold">${escHtml(num)}</span></div>`
        : '';
        
    return `<div class="clean-table-title-row w-100 ${customClass}">
        ${badgeHtml}
        <div class="clean-table-text-wrapper w-100">
            <span class="fw-bold text-dark clean-table-title-text">${escHtml(mainTitle)}</span>
        </div>
    </div>`;
}



function showToast(icon, title, text, timer = 3000) {

    let container = document.getElementById('custom-toast-container');

    if (!container) {

        container = document.createElement('div');

        container.id = 'custom-toast-container';

        container.style.cssText = 'position:fixed; top:20px; right:20px; z-index:9999999; display:flex; flex-direction:column; gap:10px; pointer-events:none; max-width:380px; width:calc(100% - 40px);';

        document.body.appendChild(container);

    }



    const toast = document.createElement('div');

    toast.className = 'custom-toast-item';

    

    let iconSvg = '';

    let borderColor = cssVar('--info') || '#3b82f6';

    let iconBg = cssVar('--primary-pale') || '#dbeafe';

    let iconColor = cssVar('--info') || '#1d4ed8';

    

    if (icon === 'success') {

        borderColor = cssVar('--success') || cssVar('--success-emerald') || '#10b981';

        iconBg = cssVar('--success-light') || '#d1fae5';

        iconColor = cssVar('--success-dark') || cssVar('--success-dark') || '#047857';

        iconSvg = '<svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"></path></svg>';

    } else if (icon === 'error') {

        borderColor = cssVar('--danger') || cssVar('--danger') || '#ef4444';

        iconBg = cssVar('--danger-light') || cssVar('--danger-light') || '#fee2e2';

        iconColor = cssVar('--danger-dark') || cssVar('--danger-text') || '#b91c1c';

        iconSvg = '<svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>';

    } else if (icon === 'warning') {

        borderColor = cssVar('--warning') || cssVar('--warning') || '#f59e0b';

        iconBg = cssVar('--warning-light') || cssVar('--warning-light') || '#fef3c7';

        iconColor = cssVar('--warning-dark') || cssVar('--warning-text') || '#b45309';

        iconSvg = '<svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>';

    } else {

        borderColor = cssVar('--info') || '#3b82f6';

        iconBg = cssVar('--primary-pale') || '#dbeafe';

        iconColor = cssVar('--info') || '#1d4ed8';

        iconSvg = '<svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>';

    }



    toast.style.cssText = `

        pointer-events: auto;

        background: var(--bg-card, #ffffff);

        color: var(--text-primary, #1e293b);

        border-left: 4px solid ${borderColor};

        border-radius: 8px;

        box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1);

        padding: 12px 14px;

        display: flex;

        align-items: flex-start;

        gap: 10px;

        font-family: inherit;

        opacity: 0;

        transform: translateX(30px);

        transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);

    `;



    toast.innerHTML = `

        <div style="background:${iconBg}; color:${iconColor}; width:28px; height:28px; border-radius:50%; display:flex; align-items:center; justify-content:center; flex-shrink:0; margin-top:1px;">

            ${iconSvg}

        </div>

        <div style="flex:1; min-width:0; text-align:left;">

            ${title ? `<div style="font-weight:600; font-size:0.9rem; color:var(--text-primary, #0f172a); line-height:1.3; margin-bottom:${text ? '2px' : '0'};">${title}</div>` : ''}

            ${text ? `<div style="font-size:0.8rem; color:var(--text-secondary, #64748b); line-height:1.35; word-break:break-word;">${text}</div>` : ''}

        </div>

        <button type="button" style="background:none; border:none; color:var(--text-light, #94a3b8); cursor:pointer; padding:0; margin-left:4px; font-size:1.1rem; line-height:1;" onclick="this.parentElement.remove()">×</button>

    `;



    container.appendChild(toast);



    requestAnimationFrame(() => {

        toast.style.opacity = '1';

        toast.style.transform = 'translateX(0)';

    });



    if (timer > 0) {

        setTimeout(() => {

            toast.style.opacity = '0';

            toast.style.transform = 'translateX(30px)';

            setTimeout(() => toast.remove(), 250);
        }, timer);
    }
}

// Universal Premium Smart Loading Modal (Debounced)
// Jika request selesai sangat cepat (<250ms), modal tidak pernah muncul sama sekali (mencegah flicker).
// Jika request memakan waktu lebih lama (>250ms), modal elegan baru ditampilkan ke pengguna.
let _sipedasLoadingTimer = null;
let _sipedasLoadingShown = false;

function showLoadingModal(title = "Memuat Data...", message = "Mohon tunggu sejenak, sistem sedang menyiapkan data...", immediate = false) {
    // Batalkan timer antrean sebelumnya jika ada
    if (_sipedasLoadingTimer) {
        clearTimeout(_sipedasLoadingTimer);
        _sipedasLoadingTimer = null;
    }

    const renderModal = () => {
        _sipedasLoadingShown = true;
        Swal.fire({
            title: title,
            html: `
                <div class="d-flex flex-column align-items-center justify-content-center py-2">
                    <div class="spinner-border text-primary mb-3" style="width: 3rem; height: 3rem; border-width: 0.25em;" role="status">
                        <span class="visually-hidden">Loading...</span>
                    </div>
                    <div style="font-size: 0.88rem; color: var(--text-secondary, #64748b); text-align: center;">${message}</div>
                </div>
            `,
            allowOutsideClick: false,
            allowEscapeKey: false,
            showConfirmButton: false,
            backdrop: 'rgba(15, 23, 42, 0.45)',
            customClass: {
                popup: 'rounded-4 shadow-lg border-0 p-3'
            }
        });
    };

    if (immediate) {
        renderModal();
    } else {
        // Beri jeda 250ms: jika fetch selesai sebelum 250ms, modal TIDAK AKAN PERNAH muncul
        _sipedasLoadingTimer = setTimeout(renderModal, 250);
    }
}

function hideLoadingModal() {
    // Jika timer masih berjalan (request selesai <250ms), batalkan sehingga modal tidak pernah muncul
    if (_sipedasLoadingTimer) {
        clearTimeout(_sipedasLoadingTimer);
        _sipedasLoadingTimer = null;
    }
    // Jika modal sudah terlanjur muncul karena request lama, tutup sekarang
    if (_sipedasLoadingShown) {
        _sipedasLoadingShown = false;
        Swal.close();
    }
}



function filterMasterSelects(q) {

    const words = q.toLowerCase().trim().split(/\s+/).filter(w => w.length > 0);

    const options = document.querySelectorAll('.custom-dropdown-option');

    options.forEach(opt => {

        const text = opt.textContent.toLowerCase();

        const match = words.every(w => text.includes(w));

        opt.style.display = match ? '' : 'none';

    });

}



function showCustomDropdown(index) {

    const swal = Swal.getHtmlContainer() || document;

    swal.querySelectorAll('.custom-select-dropdown').forEach(d => {

        if (d.id !== `custom-dropdown-${index}`) d.style.display = 'none';

    });

    const dropdown = swal.querySelector(`#custom-dropdown-${index}`) || document.getElementById(`custom-dropdown-${index}`);

    if (dropdown) {

        const isOpening = dropdown.style.display !== 'block';

        dropdown.style.display = isOpening ? 'block' : 'none';

        const searchInput = swal.querySelector(`#custom-dropdown-search-${index}`) || document.getElementById(`custom-dropdown-search-${index}`);

        if (searchInput && isOpening) {

            searchInput.value = '';

            searchInput.focus();

            filterCustomDropdownOptions(index, '');

            setTimeout(() => {

                dropdown.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

            }, 50);

        }

    }

}



function filterCustomDropdownOptions(index, query) {

    const swal = Swal.getHtmlContainer() || document;

    const words = query.toLowerCase().trim().split(/\s+/).filter(w => w.length > 0);

    const options = swal.querySelectorAll(`#custom-dropdown-options-${index} .custom-dropdown-option`);

    options.forEach(opt => {

        const text = opt.textContent.toLowerCase();

        const match = words.every(w => text.includes(w));

        opt.style.display = match ? '' : 'none';

    });

}



function selectCustomOption(index, val) {

    const swal = Swal.getHtmlContainer() || document;

    const input = swal.querySelector(`#ren-sel-${index}`) || document.getElementById(`ren-sel-${index}`);

    if (input) {

        input.value = val;

        input.setAttribute('value', val);

        input.setAttribute('title', val);

    }

    const dropdown = swal.querySelector(`#custom-dropdown-${index}`) || document.getElementById(`custom-dropdown-${index}`);

    if (dropdown) {

        dropdown.style.display = 'none';

    }

}



function showBulkCustomDropdown() {

    const swal = Swal.getHtmlContainer() || document;

    swal.querySelectorAll('.custom-select-dropdown').forEach(d => {

        if (d.id !== 'custom-dropdown-bulk') d.style.display = 'none';

    });

    const dropdown = swal.querySelector('#custom-dropdown-bulk') || document.getElementById('custom-dropdown-bulk');

    if (dropdown) {

        dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';

        const searchInput = swal.querySelector('#custom-dropdown-search-bulk') || document.getElementById('custom-dropdown-search-bulk');

        if (searchInput && dropdown.style.display === 'block') {

            searchInput.value = '';

            searchInput.focus();

            filterBulkCustomDropdownOptions('');

        }

    }

}



function filterBulkCustomDropdownOptions(query) {

    const swal = Swal.getHtmlContainer() || document;

    const words = query.toLowerCase().trim().split(/\s+/).filter(w => w.length > 0);

    const options = swal.querySelectorAll('#custom-dropdown-options-bulk .custom-dropdown-option');

    options.forEach(opt => {

        const text = opt.textContent.toLowerCase();

        const match = words.every(w => text.includes(w));

        opt.style.display = match ? '' : 'none';

    });

}



function selectBulkCustomOption(val) {

    const swal = Swal.getHtmlContainer() || document;

    const input = swal.querySelector('#bulk-ren-sel') || document.getElementById('bulk-ren-sel');

    if (input) {

        input.value = val;

        input.setAttribute('value', val);

        input.setAttribute('title', val);

    }

    const dropdown = swal.querySelector('#custom-dropdown-bulk') || document.getElementById('custom-dropdown-bulk');

    if (dropdown) {

        dropdown.style.display = 'none';

    }

}



function extractHeaderKeyword(h) {

    if (!h) return '';

    let s = h.trim();

    // 1. Remove year expressions like "2021/2022", "2022/2023", "2021-2022", "2021/22", "2022", "(2021/2022)", "Tahun 2022"

    // Leading year pattern:

    s = s.replace(/^(?:tahun|thn|th\.?)?\s*\(?\d{4}(?:[\/\-]\d{2,4})?\)?\s*[-–—/:]*\s*/i, '');

    // Trailing year pattern:

    s = s.replace(/\s*[-–—/:]*\s*(?:tahun|thn|th\.?)?\s*\(?\d{4}(?:[\/\-]\d{2,4})?\)?\s*$/i, '');

    // Any remaining bracketed year like (2022) or (2021/2022)

    s = s.replace(/\(\s*(?:tahun|thn|th\.?)?\s*\d{4}(?:[\/\-]\d{2,4})?\s*\)/gi, '');

    // Clean up trailing/leading dashes or punctuation

    s = s.replace(/^[-–—/:\s]+|[-–—/:\s]+$/g, '').trim();

    return s || h.trim();

}



function selectColumnsByKeyword(keyword) {

    const swal = Swal.getHtmlContainer() || document;

    const allCheckboxes = swal.querySelectorAll('.ren-col-cb:not(:disabled)');

    const kwClean = (keyword || '').toLowerCase().trim();

    

    allCheckboxes.forEach(cb => {

        const i = cb.value;

        const headerText = cb.getAttribute('data-header') || '';

        const headerKw = extractHeaderKeyword(headerText).toLowerCase();

        

        let match = false;

        if (kwClean === 'all') {

            match = true;

        } else if (!kwClean) {

            match = false;

        } else {

            match = (headerKw && headerKw === kwClean) || headerText.toLowerCase().includes(kwClean);

        }

        cb.checked = match;

        const container = swal.querySelector(`#ren-container-${i}`) || document.getElementById(`ren-container-${i}`);

        if (container) {

            container.style.display = match ? '' : 'none';

        }

    });

    updateRenameSelectedCount();

}



function copyMasterToSimilar(sourceIndex, keyword) {

    const swal = Swal.getHtmlContainer() || document;

    const sourceInput = swal.querySelector(`#ren-sel-${sourceIndex}`) || document.getElementById(`ren-sel-${sourceIndex}`);

    const masterVal = sourceInput ? sourceInput.value.trim() : '';

    if (!masterVal) {

        showToast('warning', 'Nilai Kosong', 'Pilih master kolom pada baris ini terlebih dahulu.');

        return;

    }

    

    const kwClean = (keyword || '').toLowerCase().trim();

    const allCheckboxes = swal.querySelectorAll('.ren-col-cb:not(:disabled)');

    let appliedCount = 0;

    

    allCheckboxes.forEach(cb => {

        const i = cb.value;

        const headerText = cb.getAttribute('data-header') || '';

        const headerKw = extractHeaderKeyword(headerText).toLowerCase();

        

        const isMatch = (headerKw && headerKw === kwClean) || 

                        (kwClean && headerText.toLowerCase().includes(kwClean));

                        

        if (isMatch) {

            cb.checked = true;

            const input = swal.querySelector(`#ren-sel-${i}`) || document.getElementById(`ren-sel-${i}`);

            const container = swal.querySelector(`#ren-container-${i}`) || document.getElementById(`ren-container-${i}`);

            if (input) {

                input.value = masterVal;

                input.setAttribute('value', masterVal);

                input.setAttribute('title', masterVal);

                if (container) container.style.display = '';

                appliedCount++;

                

                input.style.transition = 'all 0.3s';

                input.style.borderColor = cssVar('--primary') || '#2563eb';

                input.style.background = cssVar('--primary-faint') || '#eff6ff';

                input.style.color = cssVar('--primary') || '#1d4ed8';

                input.style.fontWeight = '600';

                setTimeout(() => {

                    input.style.borderColor = cssVar('--swal-cancel') || cssVar('--text-muted') || '#cbd5e1';

                    input.style.background = 'var(--bg-card, #fff)';

                }, 800);

            }

        }

    });

    updateRenameSelectedCount();

    showToast('success', 'Salin Berhasil', `Master Kolom "${masterVal}" disalin ke ${appliedCount} kolom sejenis ("${keyword}").`);

}



function toggleSelectAllRenameColumns(masterCb) {

    const isChecked = masterCb.checked;

    const swal = Swal.getHtmlContainer() || document;

    const allCheckboxes = swal.querySelectorAll('.ren-col-cb:not(:disabled)');

    allCheckboxes.forEach(cb => {

        cb.checked = isChecked;

        const i = cb.value;

        const container = swal.querySelector(`#ren-container-${i}`) || document.getElementById(`ren-container-${i}`);

        if (container) {

            container.style.display = isChecked ? '' : 'none';

        }

    });

    updateRenameSelectedCount();

}



function updateRenameSelectedCount() {

    const swal = Swal.getHtmlContainer() || document;

    const allCheckboxes = swal.querySelectorAll('.ren-col-cb:not(:disabled)');

    const checkedCount = swal.querySelectorAll('.ren-col-cb:not(:disabled):checked').length;

    const badge = swal.querySelector('#ren-selected-count-badge') || document.getElementById('ren-selected-count-badge');

    if (badge) {

        badge.textContent = `${checkedCount} kolom dipilih`;

        badge.style.background = checkedCount > 0 ? cssVar('--primary-faint') || '#eff6ff' : cssVar('--bg-hover') || '#f1f5f9';

        badge.style.color = checkedCount > 0 ? cssVar('--primary') || '#2563eb' : cssVar('--text-secondary') || '#64748b';

    }

    const selectAllCb = swal.querySelector('#ren-select-all-cb') || document.getElementById('ren-select-all-cb');

    if (selectAllCb) {

        selectAllCb.checked = allCheckboxes.length > 0 && checkedCount === allCheckboxes.length;

        selectAllCb.indeterminate = checkedCount > 0 && checkedCount < allCheckboxes.length;

    }

}



function applyBulkMasterToChecked() {

    const swal = Swal.getHtmlContainer() || document;

    const bulkInput = swal.querySelector('#bulk-ren-sel') || document.getElementById('bulk-ren-sel');

    const masterVal = bulkInput ? bulkInput.value.trim() : '';

    if (!masterVal) {

        showToast('warning', 'Pilih Master Kolom', 'Silakan pilih Master Kolom di panel atas terlebih dahulu.');

        return;

    }

    const checkedBoxes = swal.querySelectorAll('.ren-col-cb:not(:disabled):checked');

    if (checkedBoxes.length === 0) {

        showToast('warning', 'Pilih Kolom', 'Centang minimal satu kolom yang ingin diubah.');

        return;

    }

    

    const onlyEmpty = swal.querySelector('#bulk-only-empty')?.checked;

    let appliedCount = 0;

    let skippedCount = 0;

    checkedBoxes.forEach(cb => {

        const i = cb.value;

        const input = swal.querySelector(`#ren-sel-${i}`) || document.getElementById(`ren-sel-${i}`);

        const container = swal.querySelector(`#ren-container-${i}`) || document.getElementById(`ren-container-${i}`);

        if (input) {

            if (onlyEmpty && input.value.trim() !== '') {

                skippedCount++;

                return;

            }

            input.value = masterVal;

            input.setAttribute('value', masterVal);

            input.setAttribute('title', masterVal);

            if (container) container.style.display = '';

            appliedCount++;

            

            input.style.transition = 'all 0.3s';

            input.style.borderColor = cssVar('--primary') || '#2563eb';

            input.style.background = cssVar('--primary-faint') || '#eff6ff';

            input.style.color = cssVar('--primary') || '#1d4ed8';

            input.style.fontWeight = '600';

            setTimeout(() => {

                input.style.borderColor = cssVar('--swal-cancel') || cssVar('--text-muted') || '#cbd5e1';

                input.style.background = 'var(--bg-card, #fff)';

            }, 800);

        }

    });

    

    if (appliedCount === 0 && onlyEmpty) {

        showToast('info', 'Tidak Ada Kolom Diisi', 'Semua kolom yang dicentang sudah memiliki isian master.');

    } else {

        showToast('success', 'Terapkan Berhasil', `Master Kolom "${masterVal}" berhasil diterapkan ke ${appliedCount} kolom.`);

    }

}



function copyMasterToChecked(sourceIndex) {

    const swal = Swal.getHtmlContainer() || document;

    const sourceInput = swal.querySelector(`#ren-sel-${sourceIndex}`) || document.getElementById(`ren-sel-${sourceIndex}`);

    const masterVal = sourceInput ? sourceInput.value.trim() : '';

    if (!masterVal) {

        showToast('warning', 'Nilai Kosong', 'Pilih master kolom pada baris ini terlebih dahulu.');

        return;

    }

    const checkedBoxes = swal.querySelectorAll('.ren-col-cb:not(:disabled):checked');

    if (checkedBoxes.length === 0) {

        showToast('warning', 'Pilih Kolom', 'Centang minimal satu kolom tujuan.');

        return;

    }

    let appliedCount = 0;

    checkedBoxes.forEach(cb => {

        const i = cb.value;

        const input = swal.querySelector(`#ren-sel-${i}`) || document.getElementById(`ren-sel-${i}`);

        const container = swal.querySelector(`#ren-container-${i}`) || document.getElementById(`ren-container-${i}`);

        if (input) {

            input.value = masterVal;

            input.setAttribute('value', masterVal);

            input.setAttribute('title', masterVal);

            if (container) container.style.display = '';

            appliedCount++;

            

            input.style.transition = 'all 0.3s';

            input.style.borderColor = cssVar('--primary') || '#2563eb';

            input.style.background = cssVar('--primary-faint') || '#eff6ff';

            input.style.color = cssVar('--primary') || '#1d4ed8';

            input.style.fontWeight = '600';

            setTimeout(() => {

                input.style.borderColor = cssVar('--swal-cancel') || cssVar('--text-muted') || '#cbd5e1';

                input.style.background = 'var(--bg-card, #fff)';

            }, 800);

        }

    });

    showToast('success', 'Salin Berhasil', `Nilai disalin ke ${appliedCount} kolom tercentang.`);

}



document.addEventListener('click', function(e) {

    if (!e.target.closest('.custom-select-container')) {

        document.querySelectorAll('.custom-select-dropdown').forEach(d => d.style.display = 'none');

    }

});



function filterMasterRegistration(q) {

    const words = q.toLowerCase().trim().split(/\s+/).filter(w => w.length > 0);

    const container = document.getElementById('master-registration-list');

    if (!container) return;

    const rows = container.querySelectorAll('.master-row');

    rows.forEach(row => {

        const colNameEl = row.querySelector('.col-name');

        if (colNameEl) {

            const name = colNameEl.textContent.toLowerCase();

            const match = words.every(w => name.includes(w));

            row.style.display = match ? 'flex' : 'none';

        }

    });

}



const API_BASE = "/api";

// =====================================================================
// GLOBAL FETCH INTERCEPTOR — detect 503 maintenance response
// =====================================================================
const _originalFetch = window.fetch;
window.fetch = async function(...args) {
    const res = await _originalFetch.apply(this, args);
    if (res.status === 503) {
        if (window.location.pathname === '/login') {
            return res;
        }
        const clone = res.clone();
        try {
            const text = await clone.text();
            if ((text.includes('pemeliharaan') || text.includes('maintenance') || text.includes('sedang dalam')) && window.currentUserRole !== 'admin') {
                window.location.href = '/?_force_maintenance=1&_t=' + Date.now();
                return res;
            }
        } catch(e) {}
    }
    return res;
};



function romanToInt(roman) {

    if (!roman) return null;

    const map = {

        'i': 1, 'v': 5, 'x': 10, 'l': 50, 'c': 100, 'd': 500, 'm': 1000

    };

    let total = 0;

    let prev = 0;

    const str = roman.toLowerCase();

    for (let i = str.length - 1; i >= 0; i--) {

        const current = map[str[i]];

        if (!current) return null;

        if (current < prev) {

            total -= current;

        } else {

            total += current;

        }

        prev = current;

    }

    return total;

}





document.addEventListener("DOMContentLoaded", async () => {

    // Post-maintenance: force public view (after countdown selesai)
    const _urlParams = new URLSearchParams(window.location.search);
    const _isPostMaintenance = _urlParams.has('_public');
    if (_isPostMaintenance) {
        history.replaceState(null, '', '/');
        currentUserRole = 'pegawai';
        window.currentUserRole = 'pegawai';
        try { localStorage.removeItem('sipedas_user_role'); } catch(e) {}
        updateRoleUI('pegawai');
    }
    // Inisialisasi awal status sidebar selekas mungkin (Zero-flicker guard)
    if (typeof initSidebarState === 'function') initSidebarState();

    // Prioritaskan role dari body class yang disiapkan server (zero-flicker SSR)
    const _serverBodyRole = document.body.classList.contains('role-admin') ? 'admin' : (document.body.classList.contains('role-pegawai') ? 'pegawai' : '');

    // Periksa apakah cookie role admin 'sipedas_role' atau localStorage menandakan admin
    const _hasAdminCookie = document.cookie.split(';').some(c => c.trim().startsWith('sipedas_role=admin'));
    const _hasAdminStorage = localStorage.getItem('sipedas_user_role') === 'admin';

    let cachedRole = 'pegawai';
    if (!_isPostMaintenance) {
        if (_serverBodyRole === 'admin' || _hasAdminCookie || _hasAdminStorage) {
            cachedRole = 'admin';
        }
    }

    currentUserRole = cachedRole;
    window.currentUserRole = cachedRole;
    updateRoleUI(cachedRole);

    // Default landing page: Admin ke Dashboard, Publik/Pegawai ke Analisis Deret Waktu (Timeseries)
    const targetPageId = cachedRole === 'admin' ? 'dashboard' : 'timeseries';
    const targetNavId = cachedRole === 'admin' ? 'nav-dashboard' : 'nav-timeseries';
    const activePage = document.querySelector('.page-section.active');

    if (activePage && activePage.id === `page-${targetPageId}`) {
        // Halaman yang benar sudah aktif langsung dari server SSR (Zero-flicker)
        currentTab = targetPageId;
        const navEl = document.getElementById(targetNavId);
        if (navEl && !navEl.classList.contains('active')) {
            navEl.classList.add('active');
        }
        if (targetPageId === 'dashboard') loadDashboardStats();
        if (targetPageId === 'timeseries') initTimeSeriesWizard();
    } else {
        navigate(targetPageId, document.getElementById(targetNavId));
    }

    // Check auth session di latar belakang (validasi langsung ke server)
    if (!_isPostMaintenance) {
        checkAuthSession().then(liveRole => {
            if (liveRole !== cachedRole) {
                currentUserRole = liveRole;
                window.currentUserRole = liveRole;
                updateRoleUI(liveRole);
                if (liveRole === 'admin') {
                    try { localStorage.setItem('sipedas_user_role', 'admin'); } catch(e) {}
                    navigate('dashboard', document.getElementById('nav-dashboard'));
                } else {
                    // Sesi admin sudah habis atau tidak valid -> bersihkan cache dan kembali ke publik
                    try { localStorage.removeItem('sipedas_user_role'); } catch(e) {}
                    document.cookie = "sipedas_role=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC;";
                    if (currentTab === 'dashboard' || currentTab === 'pdf' || currentTab === 'excel' || currentTab === 'admin' || currentTab === 'sistem') {
                        navigate('timeseries', document.getElementById('nav-timeseries'));
                    }
                }
            }
        });
    }

    // Handle /login path — trigger login modal otomatis
    if (window.location.pathname === '/login') {
        if (currentUserRole === 'admin') {
            // Sudah admin, redirect ke root
            window.location.href = '/';
        } else {
            // Belum login, trigger modal login setelah DOM siap
            setTimeout(() => {
                adminLogin().then(() => {
                    if (window.location.pathname === '/login') {
                        history.replaceState(null, '', '/');
                    }
                });
            }, 300);
        }
    }

    populateDocumentList();

    // Cross-tab sync: dengarkan perubahan sesi tanpa me-refresh tab secara paksa
    window.addEventListener('storage', (e) => {
        if (e.key === 'sipedas_auth_event' && e.newValue) {
            try {
                const evt = JSON.parse(e.newValue);
                if (evt.type === 'logout') {
                    // Logout dari tab lain: hanya ubah state, jangan navigate agar tab lain tidak ikut berubah
                    if (currentUserRole === 'admin') {
                        currentUserRole = 'pegawai';
                        window.currentUserRole = 'pegawai';
                        try { localStorage.removeItem('sipedas_user_role'); } catch(err) {}
                        updateRoleUI('pegawai');
                    }
                } else if (evt.type === 'login') {
                    // Login dari tab lain: hanya perbarui tab jika sebelumnya bukan admin
                    if (currentUserRole !== 'admin') {
                        currentUserRole = 'admin';
                        window.currentUserRole = 'admin';
                        try { localStorage.setItem('sipedas_user_role', 'admin'); } catch(err) {}
                        updateRoleUI('admin');
                    }
                }
            } catch(err) {}
        }
        // Maintenance mode changed in another tab → reload to show/hide maintenance page
        if (e.key === 'sipedas_maintenance_event' && e.newValue) {
            try {
                const evt = JSON.parse(e.newValue);
                localStorage.removeItem('sipedas_maintenance_event');
                if (evt.mode === '1') {
                    // Maintenance ON → force maintenance view (skip admin bypass)
                    if (window.currentUserRole !== 'admin') {
                        window.location.href = '/?_force_maintenance=1&_t=' + Date.now();
                    }
                } else {
                    // Maintenance OFF → normal reload with cache bust
                    window.location.href = '/?_t=' + Date.now();
                }
            } catch(err) {}
        }
    });

    // Maintenance polling untuk semua tab (termasuk publik)
    // Detect jika admin aktifkan maintenance dari tab lain
    if (!window._publicMaintenancePolling) {
        window._publicMaintenancePolling = setInterval(async () => {
            if (typeof _force_maintenance_1 !== 'undefined' || window.location.pathname === '/login') return; // skip jika sudah di halaman maintenance atau login
            try {
                const res = await fetch('/api/auth/maintenance', { credentials: 'same-origin' });
                if (res.ok) {
                    const data = await res.json();
                    if (data.mode === '1' && window.currentUserRole !== 'admin') {
                        window.location.href = '/?_force_maintenance=1&_t=' + Date.now();
                    }
                }
            } catch(e) {}
        }, 15000);
    }

    if (typeof setupKeyboardShortcuts === 'function') setupKeyboardShortcuts();

    // === LIVE UPDATE: Cross-tab data sync via localStorage events ===
    window.addEventListener('storage', (e) => {
        if (e.key === 'sipedas_data_event' && e.newValue) {
            try {
                const evt = JSON.parse(e.newValue);
                handleDataChange(evt.type);
            } catch(err) {}
        }
    });

    // === LIVE UPDATE: Polling fallback (untuk sesi berbeda / laptop berbeda) ===
    // Dashboard stats: setiap 30 detik
    if (!window._liveUpdateDashboard) {
        window._liveUpdateDashboard = setInterval(() => {
            if (currentUserRole !== 'admin') return;
            if (typeof currentTab !== 'undefined' && currentTab === 'dashboard') {
                try { loadDashboardStats(); } catch(e) {}
            }
        }, 30000);
    }

    // Data Tabel list: setiap 15 detik
    if (!window._liveUpdateTables) {
        window._liveUpdateTables = setInterval(() => {
            if (currentUserRole !== 'admin') return;
            if (typeof currentTab !== 'undefined' && currentTab === 'pdf') {
                try { populateDocumentList(); } catch(e) {}
            }
        }, 15000);
    }

    // Master kolom: setiap 30 detik
    if (!window._liveUpdateMaster) {
        window._liveUpdateMaster = setInterval(() => {
            if (currentUserRole !== 'admin') return;
            if (typeof currentTab !== 'undefined' && currentTab === 'admin') {
                const masterTab = document.getElementById('page-master-columns');
                if (masterTab && masterTab.classList.contains('active')) {
                    try { renderMasterColumns(); } catch(e) {}
                }
            }
        }, 30000);
    }

    // Anomali: setiap 30 detik
    if (!window._liveUpdateAnomaly) {
        window._liveUpdateAnomaly = setInterval(() => {
            if (currentUserRole !== 'admin') return;
            if (typeof currentTab !== 'undefined' && currentTab === 'admin') {
                const anomTab = document.getElementById('page-admin-anomalies');
                if (anomTab && anomTab.classList.contains('active')) {
                    try { loadTimeSeriesAnomalies(false); } catch(e) {}
                }
            }
        }, 30000);
    }

    

    setupDropZone('pdf-drop-zone', 'pdf-file', (file) => {

        const dt = new DataTransfer(); dt.items.add(file); document.getElementById('pdf-file').files = dt.files;

        const txt = document.getElementById('pdf-drop-text');

        if (txt) txt.innerHTML = `<i class="bi bi-file-earmark-pdf" style="font-size:1.4rem;"></i><br><strong>${escHtml(file.name)}</strong>`;

    });



    __excelDragFiles = [];

    setupDropZone('excel-drop-zone', 'import-file', (filesList) => {

        const files = Array.isArray(filesList) ? filesList : (filesList instanceof FileList ? Array.from(filesList) : [filesList]);

        if (!files || !files.length) return;

        __excelDragFiles = files;

        

        const dt = new DataTransfer();

        files.forEach(f => dt.items.add(f));

        const fileInp = document.getElementById('import-file');

        if (fileInp) fileInp.files = dt.files;

        

        const txt = document.getElementById('excel-drop-text');

        if (txt) {

            if (files.length === 1) {

                txt.innerHTML = `<i class="bi bi-file-earmark-spreadsheet text-success" style="font-size:1.6rem;"></i><br><strong class="text-dark">${escHtml(files[0].name)}</strong><div class="text-muted small mt-0.5">${(files[0].size / 1024).toFixed(1)} KB</div>`;

            } else {

                const names = files.map(f => f.name).join(', ');

                txt.innerHTML = `<i class="bi bi-collection text-success" style="font-size:1.6rem;"></i><br><strong class="text-dark">📁 ${files.length} File Excel Dipilih</strong><div class="text-muted small mt-1 text-truncate" style="max-width:320px;" title="${escHtml(names)}">${escHtml(names)}</div>`;

            }

        }

    }, true);



    const excelFileInput = document.getElementById('import-file');

    if (excelFileInput) {

        excelFileInput.addEventListener('change', (e) => {

            if (e.target.files && e.target.files.length) {

                const files = Array.from(e.target.files);

                __excelDragFiles = files;

                const txt = document.getElementById('excel-drop-text');

                if (txt) {

                    if (files.length === 1) {

                        txt.innerHTML = `<i class="bi bi-file-earmark-spreadsheet text-success" style="font-size:1.6rem;"></i><br><strong class="text-dark">${escHtml(files[0].name)}</strong><div class="text-muted small mt-0.5">${(files[0].size / 1024).toFixed(1)} KB</div>`;

                    } else {

                        const names = files.map(f => f.name).join(', ');

                        txt.innerHTML = `<i class="bi bi-collection text-success" style="font-size:1.6rem;"></i><br><strong class="text-dark">📁 ${files.length} File Excel Dipilih</strong><div class="text-muted small mt-1 text-truncate" style="max-width:320px;" title="${escHtml(names)}">${escHtml(names)}</div>`;

                    }

                }

            }

        });

    }



    document.getElementById("upload-form").addEventListener("submit", async (e) => {

        e.preventDefault();

        const formData = new FormData(e.target);

        const btn = e.target.querySelector('button[type="submit"]');

        btn.disabled = true;

        const pdfBar = document.getElementById('pdf-upload-bar');

        const pdfProgress = document.getElementById('pdf-upload-progress');

        const pdfStatus = document.getElementById('pdf-upload-status');

        if (pdfProgress) pdfProgress.style.display = 'block';

        if (pdfBar) { pdfBar.style.width = '0%'; pdfBar.classList.add('progress-bar-animated'); pdfBar.classList.remove('bg-success','bg-danger'); }

        if (pdfStatus) pdfStatus.textContent = 'Mengunggah...';



        Swal.fire({ title: 'Mengunggah PDF...', text: 'Mohon tunggu sebentar', allowOutsideClick: false, didOpen: () => Swal.showLoading() });



        try {

            const res = await uploadWithProgress(`${API_BASE}/documents`, formData, pdfBar, pdfStatus);

            Swal.close();

            if (res.ok) {

                const doc = await res.json();

                await loadDocuments();

                await populateDocumentList();
                notifyDataChange('document');

                Swal.fire("Berhasil", "Upload sukses! Silakan masukkan rentang halaman lalu klik Ekstrak.", "success");

                document.getElementById('pdf-file').value = '';

                const txt = document.getElementById('pdf-drop-text');

                if (txt) txt.innerHTML = '<i class="bi bi-cloud-arrow-up" style="font-size:1.4rem;"></i><br>Seret & lepas PDF di sini, atau klik untuk pilih file';

                if (pdfProgress) pdfProgress.style.display = 'none';

            } else {

                showToast("error", "Gagal", "Gagal mengunggah PDF.");

                if (pdfStatus) pdfStatus.textContent = 'Gagal';

                if (pdfBar) { pdfBar.classList.remove('progress-bar-animated'); pdfBar.classList.add('bg-danger'); }

            }

        } catch (err) {

            Swal.close();

            showToast("error", "Gagal", "Terjadi kesalahan upload.");

            if (pdfStatus) pdfStatus.textContent = 'Error';

        } finally {

            btn.textContent = "Upload & Proses";

            btn.disabled = false;

        }

    });

});



