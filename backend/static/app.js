let __excelDragFiles = [];

// Global error handler — tangkap unhandled JS errors
window.addEventListener('error', function(e) {
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
    
    const badgeHtml = num 
        ? `<span class="badge bg-primary-subtle text-primary border border-primary-subtle py-1 rounded-2 font-monospace fw-bold text-center" style="font-size:0.82rem; line-height:1.25; letter-spacing:0.3px; width:66px !important; min-width:66px !important; max-width:66px !important; flex-shrink:0 !important; margin-right:14px !important; display:inline-block;">${escHtml(num)}</span>`
        : '';
        
    return `<div class="d-flex align-items-center w-100 ${customClass}" style="line-height:1.45; text-align:left;">
        ${badgeHtml}
        <div class="flex-grow-1" style="min-width:0; overflow-wrap:break-word; word-break:break-word;">
            <span class="fw-bold text-dark" style="font-size:0.9rem; white-space:normal !important; line-height:1.45;">${escHtml(mainTitle)}</span>
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

// Universal Premium Loading Modal
function showLoadingModal(title = "Memuat Data...", message = "Mohon tunggu sejenak, sistem sedang menyiapkan data...") {
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
}

function hideLoadingModal() {
    Swal.close();
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

                input.style.borderColor = cssVar('--stat-purple') || cssVar('--purple-500') || '#8b5cf6';

                input.style.background = cssVar('--purple-50') || '#ede9fe';

                input.style.color = cssVar('--text-primary') || '#1e1b4b';

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

        badge.style.background = checkedCount > 0 ? cssVar('--purple-50') || '#ede9fe' : cssVar('--bg-hover') || '#f1f5f9';

        badge.style.color = checkedCount > 0 ? cssVar('--stat-violet') || '#7c3aed' : cssVar('--text-secondary') || '#64748b';

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

            input.style.borderColor = cssVar('--stat-purple') || cssVar('--purple-500') || '#8b5cf6';

            input.style.background = cssVar('--purple-50') || '#ede9fe';

            input.style.color = cssVar('--text-primary') || '#1e1b4b';

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

            input.style.borderColor = cssVar('--stat-purple') || cssVar('--purple-500') || '#8b5cf6';

            input.style.background = cssVar('--purple-50') || '#ede9fe';

            input.style.color = cssVar('--text-primary') || '#1e1b4b';

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
        updateRoleUI('pegawai');
    }

    // Terapkan default UI role pegawai secara instan sebelum async session check

    updateRoleUI('pegawai');



    // Check auth session dari backend (cookie-based)

    const role = _isPostMaintenance ? 'pegawai' : await checkAuthSession();

    

    // Default landing page berdasarkan role

    if (role === 'admin') {

        navigate('dashboard', document.getElementById('nav-dashboard'));

    } else {

        navigate('timeseries', document.getElementById('nav-timeseries'));

    }

    // Handle /login path — trigger login modal otomatis
    if (window.location.pathname === '/login') {
        if (role === 'admin') {
            // Sudah admin, redirect ke root
            history.replaceState(null, '', '/');
        } else {
            // Belum login, trigger modal login
            adminLogin().then(() => {
                history.replaceState(null, '', '/');
            });
        }
    }

    populateDocumentList();

    // Cross-tab sync: listen for logout/login events from other tabs
    window.addEventListener('storage', (e) => {
        if (e.key === 'sipedas_auth_event' && e.newValue) {
            try {
                const evt = JSON.parse(e.newValue);
                localStorage.removeItem('sipedas_auth_event');
                if (evt.type === 'logout') {
                    window.location.href = '/?_t=' + Date.now();
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
            if (typeof _force_maintenance_1 !== 'undefined') return; // skip jika sudah di halaman maintenance
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



// ===================== EDITOR STATE =====================

let editorState = {

    tableId: null,

    tableName: '',

    mode: 'csv-view' // 'csv-view', 'csv-edit', or 'db'

};

let previousActivePageId = 'tabel';



// ===================== ROLE ACCESS CONTROL =====================

function checkRoleAccess(targetPage) {

    const adminPages = ['publikasi', 'import', 'tabel', 'editor', 'admin'];

    const currentRole = window.currentUserRole || "pegawai";

    if (adminPages.includes(targetPage) && currentRole !== 'admin') {

        const titles = {

            publikasi: 'Ekstraksi PDF',

            import: 'Import Excel',

            tabel: 'Data Tabel',

            editor: 'Editor Data Tabel',

            admin: 'Manajemen Database'

        };

        Swal.fire({

            title: 'Akses Dibatasi',

            html: `Halaman <b>${titles[targetPage] || targetPage}</b> hanya dapat diakses oleh akun <b>Admin SIPEDAS</b>.<br><small class="text-muted">Role Anda saat ini: <b>Operator SIPEDAS</b>. Silakan login sebagai Admin SIPEDAS di sidebar jika Anda adalah Administrator.</small>`,

            icon: 'warning',

            confirmButtonColor: cssVar('--swal-confirm-primary') || cssVar('--indigo-600') || '#4f46e5',

            confirmButtonText: 'Mengerti'

        });

        return false;

    }

    return true;

}



// ===================== NAVIGATION =====================

function navigate(pageId, element) {

    // Tutup mobile sidebar jika terbuka
    const mobileSidebar = document.querySelector('.sidebar.mobile-open');
    if (mobileSidebar) toggleMobileSidebar();

    // Validasi Akses Role Sistem (Pegawai BPS vs Admin)

    if (!checkRoleAccess(pageId)) return;



    // Jika sedang dalam mode edit dan mencoba keluar dari editor, minta konfirmasi

    if (editorState && editorState.mode === 'csv-edit' && pageId !== 'editor') {

        Swal.fire({

            title: 'Batalkan Pengeditan?',

            text: "Semua perubahan data yang belum disimpan akan hilang.",

            icon: 'warning',

            showCancelButton: true,

            confirmButtonColor: cssVar('--danger') || cssVar('--danger') || '#ef4444',

            cancelButtonColor: cssVar('--swal-cancel') || cssVar('--text-muted') || '#cbd5e1',

            confirmButtonText: 'Ya, Batalkan',

            cancelButtonText: 'Kembali Edit'

        }).then((result) => {

            if (result.isConfirmed) {

                editorState.mode = 'csv-view'; // Reset mode agar bisa berpindah

                navigate(pageId, element);

            }

        });

        return;

    }



    document.querySelectorAll('.page-section').forEach(el => el.classList.remove('active'));

    document.querySelectorAll('.nav-link').forEach(el => el.classList.remove('active'));



    const page = document.getElementById(`page-${pageId}`);

    if (page) page.classList.add('active');

    if (element) element.classList.add('active');



    // Sembunyikan nav editor jika keluar dari editor

    if (pageId !== 'editor') {

        // Reset editor state

        editorState.mode = 'csv-view';

    }



    // Scroll ke atas

    const mc = document.querySelector('.main-content');

    if (mc) mc.scrollTop = 0;



    if (pageId === 'dashboard') loadDashboardStats();

    if (pageId === 'publikasi') loadDocuments();

    if (pageId === 'import') loadImportExcelPage();

    if (pageId === 'timeseries') initTimeSeriesWizard();

}



/** Navigate to the full-page editor. Mode: 'csv' or 'db' */

function navigateToEditor(tableId, tableName, mode = 'csv') {

    // Validasi Akses Role Sistem

    if (!checkRoleAccess('editor')) return;

    editorState = { tableId, tableName, mode };



    // Record the current active page before changing to editor

    const activeSection = document.querySelector('.page-section.active');

    if (activeSection && activeSection.id !== 'page-editor') {

        previousActivePageId = activeSection.id.replace('page-', '');

    }



    // Show editor page & set mode class

    document.querySelectorAll('.page-section').forEach(el => el.classList.remove('active'));

    const pe = document.getElementById('page-editor');

    if (pe) {

        pe.classList.add('active');

        pe.classList.remove('mode-view', 'mode-edit');

        pe.classList.add(mode === 'csv-edit' ? 'mode-edit' : 'mode-view');

    }



    // Scroll to top

    const mc = document.querySelector('.main-content');

    if (mc) mc.scrollTop = 0;



    // Set title + badge

    let cleanName = formatCleanTableName(tableName);

    let pageText = '';

    const pageMatch = tableName.match(/\s*(\([Hh]al.*?\))\s*$/i);

    if (pageMatch) { pageText = pageMatch[1]; }



    // Pisahkan nomor tabel (e.g. Tabel 1.1.1 atau 1.1.1) dari nama tabel

    let displayNum = '';
    let displayNameOnly = cleanName;

    // Pisahkan nomor tabel murni (misal: '1.1.2' dari 'Tabel 1.1.2' atau '1.1.2 - Judul')
    const numMatch = cleanName.match(/^(?:Tabel[\s_]*|)(\d+(?:\.\d+)*)\s*(?:[\-–—:]\s*|\.\s*|\s+)(.+)$/i);
    if (numMatch && numMatch[1] && numMatch[2]) {
        displayNum = numMatch[1].trim();
        displayNameOnly = numMatch[2].trim();
    } else {
        const fallbackMatch = cleanName.match(/^(?:Tabel[\s_]*|)(\d+(?:\.\d+)*)\s*$/i);
        if (fallbackMatch && fallbackMatch[1]) {
            displayNum = fallbackMatch[1].trim();
            displayNameOnly = '';
        }
    }

    const tableNumEl = document.getElementById('editor-table-number');
    if (tableNumEl) {
        tableNumEl.value = displayNum;
        tableNumEl.style.display = 'inline-block';
    }



    const titleEl = document.getElementById('editor-title');

    if (titleEl) {

            const pageTag = document.getElementById('editor-page-tag');

    if (pageTag) {

        pageTag.textContent = '';

        pageTag.style.display = 'none';

    }

        titleEl.value = displayNameOnly;

    }



    const badge = document.getElementById('editor-mode-badge');

    if (badge) {

        if (mode === 'csv-view') {

            badge.textContent = 'Lihat Data';

            badge.className = 'editor-mode-badge badge-csv-view';

        } else if (mode === 'csv-edit') {

            badge.textContent = 'Edit Data';

            badge.className = 'editor-mode-badge badge-csv';

        } else {

            badge.textContent = 'Mode Database';

            badge.className = 'editor-mode-badge badge-db';

        }

    }



    // Atur status editability judul & numbering berdasarkan mode

    const isReadOnly = (mode === 'csv-view');

    const containers = document.querySelectorAll('.editable-input-container');

    const tableNumInput = document.getElementById('editor-table-number');

    const titleInput = document.getElementById('editor-title');



    if (tableNumInput) tableNumInput.readOnly = isReadOnly;

    if (titleInput) titleInput.readOnly = isReadOnly;



    containers.forEach(container => {

        const icon = container.querySelector('span');

        if (isReadOnly) {

            container.style.border = 'none';

            container.style.background = 'transparent';

            container.setAttribute('onmouseenter', '');

            container.setAttribute('onmouseleave', '');

            if (icon) icon.style.display = 'none';

        } else {

            container.style.border = '1px dashed #cbd5e1';

            container.style.background = cssVar('--bg-page') || '#fafafa';

            container.setAttribute('onmouseenter', "this.style.borderColor=cssVar('--indigo-600') || '#4F46E5'; this.style.background=cssVar('--text-white') || '#ffffff';");

            container.setAttribute('onmouseleave', "this.style.borderColor=cssVar('--text-muted') || '#cbd5e1'; this.style.background=cssVar('--bg-page') || '#fafafa';");

            if (icon) icon.style.display = 'inline';

        }

    });

}



async function saveTableIdentityInline() {
    const tableId = editorState.tableId;
    if (!tableId) return;

    const rawNum = document.getElementById('editor-table-number')?.value?.replace(/^Tabel[\s_]*/i, '').trim() || '';
    const titleVal = document.getElementById('editor-title')?.value?.trim() || '';

    if (!titleVal) {
        return; // Jangan simpan jika judul kosong
    }

    const fullNewName = rawNum ? `Tabel ${rawNum} - ${titleVal}` : titleVal;
    if (fullNewName === editorState.tableName) return; // tidak ada perubahan



    try {

        const res = await fetch(`${API_BASE}/tables/${tableId}/rename`, {

            method: 'PUT',

            headers: { 'Content-Type': 'application/json' },

            body: JSON.stringify({ new_name: fullNewName })

        });

        if (res.ok) {

            editorState.tableName = fullNewName;

        } else {

            const errData = await res.json();

            showToast("error", "Gagal", `Gagal menyimpan nama tabel: ${errData.detail || 'Terjadi kesalahan'}`);

        }

    } catch(e) {

        console.error("Gagal menyimpan identitas tabel", e);

        showToast("error", "Error", "Terjadi kesalahan jaringan saat menyimpan nama tabel.");

    }

}



/** Go back to the table browser page or cancel edit mode */

function backToTableList() {

    if (editorState.mode === 'csv-edit') {

        Swal.fire({

            title: 'Batalkan Pengeditan?',

            text: "Semua perubahan data yang belum disimpan akan hilang.",

            icon: 'warning',

            showCancelButton: true,

            confirmButtonColor: cssVar('--danger') || cssVar('--danger') || '#ef4444',

            cancelButtonColor: cssVar('--swal-cancel') || cssVar('--text-muted') || '#cbd5e1',

            confirmButtonText: 'Ya, Batalkan',

            cancelButtonText: 'Kembali Edit'

        }).then((result) => {

            if (result.isConfirmed) {

                // Kembalikan ke mode Lihat (Preview)

                previewCsv(editorState.tableId, editorState.tableName);

            }

        });

        return;

    }



    // Arahkan kembali ke halaman asal (riwayat sebelumnya)

    const targetPageId = previousActivePageId || 'tabel';

    const navEl = document.getElementById(`nav-${targetPageId}`);

    

    navigate(targetPageId, navEl);

}



/** Refresh current editor without re-navigating */

function refreshEditor() {

    if (editorState.mode === 'csv-view') {

        _loadCsvIntoEditor(editorState.tableId, editorState.tableName, false);

    } else if (editorState.mode === 'csv-edit') {

        _loadCsvIntoEditor(editorState.tableId, editorState.tableName, true);

    } else {

        _loadDbIntoEditor(editorState.tableId, editorState.tableName);

    }

}



/** Build the toolbar */

function buildEditorToolbar(tableId, tableName, mode) {

    const toolbar = document.getElementById('editor-toolbar');

    if (!toolbar) return;

    const tn = tableName.replace(/'/g, "\\'");

    if (mode === 'csv-view') {

        toolbar.innerHTML = `

            <div style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap; width:100%;">

                <!-- Tombol Kembali -->

                <button onclick="backToTableList()" class="btn btn-sm btn-light border d-inline-flex align-items-center gap-1" style="font-weight:600; font-size:0.8rem; padding:5px 12px; border-radius:6px; color:#334155; background:#f8fafc; border-color:#cbd5e1 !important;" title="Kembali ke Daftar Tabel">

                    <i class="bi bi-arrow-left"></i> Kembali

                </button>

                

                <!-- Tombol Navigasi Prev / Next -->

                <div id="nav-buttons" class="btn-group" role="group">

                    <button id="btn-prev" onclick="navigateTable('prev')" class="btn btn-sm btn-light border d-inline-flex align-items-center gap-1" style="font-weight:600; font-size:0.8rem; padding:5px 10px; color:var(--text-secondary, #475569); background:#f8fafc; border-color:#cbd5e1 !important;" title="Tabel Sebelumnya">

                        <i class="bi bi-chevron-left"></i> Prev

                    </button>

                    <button id="btn-next" onclick="navigateTable('next')" class="btn btn-sm btn-light border d-inline-flex align-items-center gap-1" style="font-weight:600; font-size:0.8rem; padding:5px 10px; color:var(--text-secondary, #475569); background:#f8fafc; border-color:#cbd5e1 !important; border-left:none;" title="Tabel Selanjutnya">

                        Next <i class="bi bi-chevron-right"></i>

                    </button>

                </div>

                

                <div class="vr mx-1 my-auto" style="height:20px; opacity:0.25;"></div>



                <!-- Export Buttons Group -->

                <div class="btn-group" role="group">

                    <button onclick="downloadExcel(${tableId})" class="btn btn-sm btn-light border d-inline-flex align-items-center gap-1" style="font-weight:600; font-size:0.8rem; padding:5px 11px; color:#15803d; background:#f0fdf4; border-color:#bbf7d0 !important;" title="Unduh format Microsoft Excel (.xlsx)">

                        <i class="bi bi-file-earmark-excel-fill"></i> Excel (.xlsx)

                    </button>

                    <button onclick="downloadCsv(${tableId})" class="btn btn-sm btn-light border d-inline-flex align-items-center gap-1" style="font-weight:600; font-size:0.8rem; padding:5px 11px; color:var(--text-secondary, #475569); background:#f8fafc; border-color:#cbd5e1 !important; border-left:none;" title="Unduh format CSV">

                        <i class="bi bi-filetype-csv"></i> CSV

                    </button>

                </div>

                

                <div class="vr mx-1 my-auto" style="height:20px; opacity:0.25;"></div>



                <!-- Analisis Deret Waktu -->

                <button onclick="openTimeSeriesForTable(${tableId}, '${tn}')" class="btn btn-sm btn-light border d-inline-flex align-items-center gap-1" style="font-weight:600; font-size:0.8rem; padding:5px 11px; border-radius:6px; color:#b45309; background:#fffbeb; border-color:#fde68a !important;" title="Buka analisis grafik deret waktu">

                    <i class="bi bi-graph-up-arrow"></i> Deret Waktu

                </button>

                

                <!-- Beralih ke Edit Data -->

                <button onclick="switchToCsvEdit(${tableId}, '${tn}')" class="btn btn-sm btn-primary d-inline-flex align-items-center gap-1" style="font-weight:600; font-size:0.8rem; padding:5px 14px; border-radius:6px; box-shadow: 0 1px 3px rgba(79, 70, 229, 0.25);" title="Beralih ke mode pengeditan data">

                    <i class="bi bi-pencil-square me-1"></i> Edit Data

                </button>



                <!-- Status Badge -->

                <span style="margin-left:auto; font-size:0.8rem; display:flex; align-items:center; gap:6px;">

                    <span class="badge bg-light text-secondary border" style="font-size:0.75rem; padding:5px 10px; font-weight:600; background:#f8fafc; border-color:#e2e8f0 !important;">

                        <i class="bi bi-eye me-1"></i> Mode Lihat (Baca Saja)

                    </span>

                </span>

            </div>

        `;

        fetchTableNeighbors(tableId);

    } else if (mode === 'csv-edit') {

        toolbar.innerHTML = `

            <div style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap; width:100%;">

                <!-- Action Back / Cancel -->

                <button onclick="backToTableList()" class="btn btn-sm btn-light border border-danger-subtle text-danger d-inline-flex align-items-center gap-1" style="font-weight:600; font-size:0.8rem; padding:5px 12px; border-radius:6px; background:#fef2f2;" title="Kembali ke daftar tanpa menyimpan">

                    <i class="bi bi-x-circle-fill"></i> Batal / Kembali

                </button>

                

                <div class="vr mx-1 my-auto" style="height:20px; opacity:0.25;"></div>



                <!-- Export Group -->

                <div class="btn-group" role="group">

                    <button onclick="downloadExcel(${tableId})" class="btn btn-sm btn-light border d-inline-flex align-items-center gap-1" style="font-weight:600; font-size:0.8rem; padding:5px 10px; color:#15803d; background:#f0fdf4; border-color:#bbf7d0 !important;" title="Unduh Excel">

                        <i class="bi bi-file-earmark-excel-fill"></i> Excel

                    </button>

                    <button onclick="downloadCsv(${tableId})" class="btn btn-sm btn-light border d-inline-flex align-items-center gap-1" style="font-weight:600; font-size:0.8rem; padding:5px 10px; color:var(--text-secondary, #475569); background:#f8fafc; border-color:#cbd5e1 !important; border-left:none;" title="Unduh CSV">

                        <i class="bi bi-filetype-csv"></i> CSV

                    </button>

                </div>

                

                <div class="vr mx-1 my-auto" style="height:20px; opacity:0.25;"></div>



                <!-- Transform & Master Group -->

                <button onclick="transposeCsvLocal()" class="btn btn-sm btn-light border d-inline-flex align-items-center gap-1" style="font-weight:600; font-size:0.8rem; padding:5px 10px; border-radius:6px; color:#b45309; background:#fffbeb; border-color:#fde68a !important;" title="Tukar baris dan kolom tabel">

                    <i class="bi bi-arrow-left-right"></i> Transpose

                </button>

                <button onclick="renameHeadersToMaster(${tableId}, '${tn}')" class="btn btn-sm btn-light border d-inline-flex align-items-center gap-1" style="font-weight:600; font-size:0.8rem; padding:5px 10px; border-radius:6px; color:#4338ca; background:#eef2ff; border-color:#c7d2fe !important;" title="Ganti header sesuai master kolom">

                    <i class="bi bi-pencil-square"></i> Nama Master

                </button>

                <button onclick="matchColumnsToMaster(${tableId}, '${tn}')" class="btn btn-sm btn-light border d-inline-flex align-items-center gap-1" style="font-weight:600; font-size:0.8rem; padding:5px 10px; border-radius:6px; color:#0e7490; background:#ecfeff; border-color:#a5f3fc !important;" title="Cocokkan header secara otomatis ke master kolom">

                    <i class="bi bi-stars"></i> Cocokkan Master

                </button>

                <button onclick="addColFromMaster(${tableId}, '${tn}')" class="btn btn-sm btn-light border d-inline-flex align-items-center gap-1" style="font-weight:600; font-size:0.8rem; padding:5px 10px; border-radius:6px; color:#334155; background:#f1f5f9; border-color:#cbd5e1 !important;" title="Daftarkan kolom tabel ini ke master">

                    <i class="bi bi-clipboard-plus"></i> Daftarkan Master

                </button>

                

                <!-- Save Changes Button -->

                <button onclick="saveCsvChangesToServer(${tableId})" class="btn btn-sm btn-success d-inline-flex align-items-center gap-1 ms-auto" style="font-weight:700; font-size:0.82rem; padding:5px 16px; border-radius:6px; box-shadow: 0 1px 3px rgba(16, 185, 129, 0.3);">

                    <i class="bi bi-check2-circle"></i> Simpan Perubahan

                </button>

            </div>

        `;

    } else {

        toolbar.innerHTML = `

            <button onclick="backToTableList()" class="btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-1" style="font-weight:600; font-size:0.8rem; padding:5px 12px; border-radius:6px;">

                <i class="bi bi-arrow-left"></i> Kembali

            </button>

            <div id="nav-buttons" class="btn-group" role="group" style="margin-left: 8px;">

                <button id="btn-prev" onclick="navigateTable('prev')" class="btn btn-sm btn-outline-secondary" style="font-size:0.8rem; padding:5px 10px;">

                    <i class="bi bi-chevron-left"></i> Prev

                </button>

                <button id="btn-next" onclick="navigateTable('next')" class="btn btn-sm btn-outline-secondary" style="font-size:0.8rem; padding:5px 10px;">

                    Next <i class="bi bi-chevron-right"></i>

                </button>

            </div>

            <button onclick="markAllSafeInTable(${tableId}, '${tn}')" class="btn btn-sm btn-success d-inline-flex align-items-center gap-1" style="font-weight:600; font-size:0.8rem; padding:5px 12px; border-radius:6px;">

                <i class="bi bi-shield-check"></i> Tandai Semua Aman

            </button>

            <span style="margin-left:auto; font-size:0.8rem; color:#94a3b8;">Baris <span style='color:#ef4444;font-weight:700;'>merah</span> = data anomali. Auto-save aktif.</span>

        `;

        fetchTableNeighbors(tableId);

    }

}



let neighbors = { prev_id: null, next_id: null, prev_name: null, next_name: null };



async function fetchTableNeighbors(tableId) {

    try {

        const res = await fetch(`${API_BASE}/tables/${tableId}/neighbors`);

        if (res.ok) {

            neighbors = await res.json();

            const btnPrev = document.getElementById('btn-prev');

            const btnNext = document.getElementById('btn-next');

            

            if (btnPrev) {

                btnPrev.disabled = !neighbors.prev_id;

                btnPrev.title = neighbors.prev_name || '';

                btnPrev.style.opacity = neighbors.prev_id ? '1' : '0.5';

            }

            if (btnNext) {

                btnNext.disabled = !neighbors.next_id;

                btnNext.title = neighbors.next_name || '';

                btnNext.style.opacity = neighbors.next_id ? '1' : '0.5';

            }

        }

    } catch(e) { console.error("Gagal memuat tetangga tabel", e); }

}



function navigateTable(direction) {

    const targetId = (direction === 'prev') ? neighbors.prev_id : neighbors.next_id;

    const targetName = (direction === 'prev') ? neighbors.prev_name : neighbors.next_name;

    

    if (targetId) {

        if (editorState.mode === 'csv-view') {

            previewCsv(targetId, targetName);

        } else if (editorState.mode === 'db') {

            viewDataEditor(targetId, targetName);

        }

        // Note: CSV edit mode saat ini belum didukung navigasi karena perlu simpan perubahan.

    }

}



/** Switch from CSV view mode to CSV edit mode */

function switchToCsvEdit(tableId, tableName) {

    editorState.mode = 'csv-edit';

    const badge = document.getElementById('editor-mode-badge');

    if (badge) { badge.textContent = 'Edit Data'; badge.className = 'editor-mode-badge badge-csv'; }

    buildEditorToolbar(tableId, tableName, 'csv-edit');





    // Update editability status input inline ketika beralih ke mode edit

    const containers = document.querySelectorAll('.editable-input-container');

    const tableNumInput = document.getElementById('editor-table-number');

    const titleInput = document.getElementById('editor-title');



    if (tableNumInput) tableNumInput.readOnly = false;

    if (titleInput) titleInput.readOnly = false;



    containers.forEach(container => {

        const icon = container.querySelector('span');

        container.style.border = '1px dashed #cbd5e1';

        container.style.background = cssVar('--bg-page') || '#fafafa';

        container.setAttribute('onmouseenter', "this.style.borderColor=cssVar('--indigo-600') || '#4F46E5'; this.style.background=cssVar('--text-white') || '#ffffff';");

        container.setAttribute('onmouseleave', "this.style.borderColor=cssVar('--text-muted') || '#cbd5e1'; this.style.background=cssVar('--bg-page') || '#fafafa';");

        if (icon) icon.style.display = 'inline';

    });



    _loadCsvIntoEditor(tableId, tableName, true);

}



let dashboardChartInstance = null;



// Page 1: Dashboard Stats

async function backupDatabase(evt) {
    const btn = document.getElementById('btn-dashboard-backup') || (evt && evt.currentTarget ? evt.currentTarget : null);
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
            const base = API_BASE.replace(/\/api\/?$/, '');
            const a = document.createElement('a');
            a.href = `${base}/backups/${encodeURIComponent(data.file)}`;
            a.download = data.file;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);

            if (typeof loadDashboardBackupInfo === 'function') await loadDashboardBackupInfo();
            if (typeof loadAdminBackups === 'function') await loadAdminBackups();
            if (typeof loadDashboardStats === 'function') await loadDashboardStats();
        } else {
            const err = await res.json().catch(() => ({}));
            showToast('error', 'Backup Gagal', err.detail || 'Terjadi kesalahan');
        }
    } catch (e) {
        showToast('error', 'Backup Gagal', String(e));
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = origHtml || '<i class="bi bi-shield-check"></i> Backup Sekarang';
        }
    }
}



function uploadWithProgress(url, formData, barEl, statusEl) {

    return new Promise((resolve, reject) => {

        const xhr = new XMLHttpRequest();

        xhr.open('POST', url, true);

        xhr.onload = () => {

            if (barEl) { barEl.style.width = '100%'; barEl.classList.remove('progress-bar-animated'); }

            if (statusEl) statusEl.textContent = 'Selesai';

            let payload;

            try { payload = JSON.parse(xhr.responseText); } catch { payload = {}; }

            resolve({ ok: xhr.status >= 200 && xhr.status < 300, status: xhr.status, json: async () => payload });

        };

        xhr.onerror = () => { if (statusEl) statusEl.textContent = 'Error koneksi'; reject(new Error('Network error')); };

        xhr.upload.onprogress = (e) => {

            if (e.lengthComputable && barEl) barEl.style.width = Math.round((e.loaded / e.total) * 100) + '%';

        };

        xhr.send(formData);

    });

}



function setupDropZone(zoneId, inputId, onActivate, allowMultiple = false) {

    const zone = document.getElementById(zoneId);

    const input = document.getElementById(inputId);

    if (!zone || !input) return;

    zone.addEventListener('click', (e) => { if (e.target !== input) input.click(); });

    zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.style.borderColor = cssVar('--swal-confirm-primary') || cssVar('--indigo-600') || '#4f46e5'; zone.style.background = cssVar('--primary-faint') || '#eef2ff'; });

    zone.addEventListener('dragleave', () => { zone.style.borderColor = cssVar('--swal-cancel') || cssVar('--text-muted') || '#cbd5e1'; zone.style.background = 'var(--bg-page, #f8fafc)'; });

    zone.addEventListener('drop', (e) => { 

        e.preventDefault(); 

        zone.style.borderColor = cssVar('--swal-cancel') || cssVar('--text-muted') || '#cbd5e1'; 

        zone.style.background = 'var(--bg-page, #f8fafc)'; 

        if (e.dataTransfer.files.length) {

            if (allowMultiple) onActivate(e.dataTransfer.files);

            else onActivate(e.dataTransfer.files[0]);

        }

    });

    input.addEventListener('change', () => { 

        if (input.files.length) {

            if (allowMultiple) onActivate(input.files);

            else onActivate(input.files[0]);

        }

    });

}



async function loadDashboardBackupInfo() {
    const infoEl = document.getElementById('dashboard-backup-info');
    if (!infoEl) return;
    try {
        const res = await fetch(`${API_BASE}/admin/backups`);
        if (!res.ok) throw new Error('Gagal memuat info backup');
        const data = await res.json();
        const files = data.backups || [];
        if (files.length === 0) {
            infoEl.innerHTML = '<span class="text-muted">Belum ada backup.</span>';
            return;
        }
        const latest = files[0];
        infoEl.innerHTML = `
            <div class="d-flex flex-wrap gap-3 align-items-center mt-1">
                <span class="text-dark fw-medium">${escHtml(latest.file)}</span>
                <span class="text-muted">Ukuran: <strong>${formatFileSize(latest.size)}</strong></span>
                <span class="text-muted">Tanggal: <strong>${latest.modified}</strong></span>
            </div>
        `;
    } catch (e) {
        infoEl.innerHTML = `<span class="text-danger">Gagal memuat info backup: ${e.message}</span>`;
    }
}



async function loadDashboardStats() {

    const adminView = document.getElementById('dashboard-admin-view');

    const welcomeRoleText = document.getElementById('welcome-role-text');

    

    // Fetch chart data secara paralel di awal agar instan

    const chartDataPromise = fetch(`${API_BASE}/stats/chart`).then(r => r.ok ? r.json() : null).catch(() => null);

    

    // Selalu tampilkan dashboard (hanya ada 1 view sekarang)

    if (adminView) adminView.style.display = 'block';

    

    // Sembunyikan admin-only sections untuk pegawai

    const isAdmin = currentUserRole === 'admin';

    const adminSections = document.querySelectorAll('#dashboard-admin-view .glass-panel, #dashboard-admin-view .alert');

    adminSections.forEach(el => {

        const isAdminOnly = el.id === 'admin-anomalies-panel' || 

                           el.id === 'admin-db-clean-banner' ||

                           el.querySelector('#admin-anomalies-tbody') ||

                           el.querySelector('#admin-recent-tbody') ||

                           el.querySelector('#dashboard-backup-info');

        if (isAdminOnly) {

            el.style.display = isAdmin ? '' : 'none';

        }

    });

    

    if (welcomeRoleText) {

        welcomeRoleText.textContent = isAdmin 

            ? 'Admin SIPEDAS (Kontrol Penuh)' 

            : 'Operator SIPEDAS';

    }



    // Stale-While-Revalidate: render kartu analitik langsung dari localStorage cache jika ada
    try {
        const cachedStats = localStorage.getItem('sipedas_dashboard_stats_cache');
        if (cachedStats) {
            const stats = JSON.parse(cachedStats);
            const ptsEl = document.getElementById('stat-total-pts');
            const tablesEl = document.getElementById('stat-total-tables');
            const rowsEl = document.getElementById('stat-total-rows');
            const docsEl = document.getElementById('stat-total-docs');
            if (ptsEl && stats.total_data_points !== undefined) ptsEl.textContent = stats.total_data_points.toLocaleString('id-ID');
            if (tablesEl && stats.total_tables !== undefined) tablesEl.textContent = stats.total_tables.toLocaleString('id-ID');
            if (rowsEl && stats.total_rows !== undefined) rowsEl.textContent = stats.total_rows.toLocaleString('id-ID');
            if (docsEl && stats.total_docs !== undefined) docsEl.textContent = stats.total_docs.toLocaleString('id-ID');
        }
    } catch (e) {}

    try {
        const res = await fetch(`${API_BASE}/stats`);
        if(res.ok) {
            const stats = await res.json();
            try { localStorage.setItem('sipedas_dashboard_stats_cache', JSON.stringify(stats)); } catch (e) {}
            // Populate 4 kartu ANALITIK DATA ENGINE (ID: stat-*)
            const ptsEl = document.getElementById('stat-total-pts');
            const tablesEl = document.getElementById('stat-total-tables');
            const rowsEl = document.getElementById('stat-total-rows');
            const docsEl = document.getElementById('stat-total-docs');
            if (ptsEl) ptsEl.textContent = (stats.total_data_points || 0).toLocaleString('id-ID');
            if (tablesEl) tablesEl.textContent = (stats.total_tables || 0).toLocaleString('id-ID');
            if (rowsEl) rowsEl.textContent = (stats.total_rows || 0).toLocaleString('id-ID');
            if (docsEl) docsEl.textContent = (stats.total_docs || 0).toLocaleString('id-ID');
        }

        

        // Load anomalies list hanya untuk admin

        if (isAdmin) {

            const anomaliesRes = await fetch(`${API_BASE}/admin/anomalies`);

            const cleanBanner = document.getElementById('admin-db-clean-banner');

            const anomaliesPanel = document.getElementById('admin-anomalies-panel');

            

            if (anomaliesRes.ok) {

                const anomalies = await anomaliesRes.json();

                const tbody = document.getElementById('admin-anomalies-tbody');

                if (tbody) {

                    if (anomalies.length === 0) {

                        if (cleanBanner) cleanBanner.style.display = 'flex';

                        if (anomaliesPanel) anomaliesPanel.style.display = 'none';

                        tbody.innerHTML = '';

                    } else {

                        if (cleanBanner) cleanBanner.style.display = 'none';

                        if (anomaliesPanel) anomaliesPanel.style.display = 'block';

                        tbody.innerHTML = anomalies.map(a => `

                            <tr style="border-bottom: 1px solid #f1f5f9;">

                                <td style="padding: 10px; font-weight: 500; color: #334155; max-width: 400px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${a.table_name}">

                                    <span style="cursor: pointer; color: #4f46e5; text-decoration: underline;" onclick="viewDataEditor(${a.table_id}, '${a.table_name.replace(/'/g, "\\'")}')">

                                        ${a.table_name}

                                    </span>

                                </td>

                                <td style="padding: 10px; text-align: center; color: #64748b;">${a.year}</td>

                                <td style="padding: 10px; text-align: center; color: #ef4444; font-weight: 600;">${a.anomaly_count} baris</td>

                                <td style="padding: 10px; text-align: center;">

                                    <button class="btn btn-small btn-primary" style="background:#6366f1; padding:4px 10px; font-size:0.8rem; cursor:pointer;" onclick="viewDataEditor(${a.table_id}, '${a.table_name.replace(/'/g, "\\'")}')">

                                        Perbaiki

                                    </button>

                                </td>

                            </tr>

                        `).join('');

                    }

                }

            }

            

            // Load recent activity logs

            const actRes = await fetch(`${API_BASE}/admin/activity-logs?limit=10`);

            if (actRes.ok) {

                const actData = await actRes.json();

                const recentTbody = document.getElementById('admin-recent-tbody');

                if (recentTbody) {

                    const logs = actData.logs || [];

                    if (logs.length === 0) {

                        recentTbody.innerHTML = `<tr><td colspan="4" class="text-center py-4 text-muted small">Belum ada aktivitas tercatat.</td></tr>`;

                    } else {

                        const actionLabels = {

                            upload: '<i class="bi bi-cloud-arrow-up-fill text-primary"></i> Upload',

                            extract: '<i class="bi bi-file-earmark-code-fill text-info"></i> Ekstraksi',

                            edit_row: '<i class="bi bi-pencil-square text-warning"></i> Edit Data',

                            delete_row: '<i class="bi bi-trash3-fill text-danger"></i> Hapus Baris',

                            save_table: '<i class="bi bi-save-fill text-success"></i> Simpan Tabel',

                            reload_all: '<i class="bi bi-arrow-repeat text-primary"></i> Reload Semua',

                            reload_chapter: '<i class="bi bi-arrow-repeat text-info"></i> Reload Bab',

                            backup: '<i class="bi bi-shield-check-fill text-success"></i> Backup',

                            restore: '<i class="bi bi-clock-history text-warning"></i> Restore',

                            safe_anomaly: '<i class="bi bi-check-circle-fill text-success"></i> Tandai Aman',

                            safe_all_anomaly: '<i class="bi bi-check-circle-fill text-success"></i> Semua Aman',

                            delete_document: '<i class="bi bi-x-octagon-fill text-danger"></i> Hapus Publikasi',

                            fix_header: '<i class="bi bi-tools text-warning"></i> Fix Header'

                        };

                        recentTbody.innerHTML = logs.map(l => {

                            const label = actionLabels[l.action] || ('<i class="bi bi-activity"></i> ' + l.action);

                            const time = l.timestamp ? l.timestamp.replace(/(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}):\d+/, '$1 $2') : '-';

                            const detail = l.detail ? Object.entries(l.detail).map(([k,v]) => `${k}: ${v}`).join(', ') : '';

                            return `<tr>

                                <td class="ps-4 py-3" style="font-size:0.82rem; white-space:nowrap; color:var(--text-secondary, #64748b);">${time}</td>

                                <td class="py-3" style="font-size:0.82rem;">${label}</td>

                                <td class="py-3" style="font-size:0.82rem; color:#334155; max-width:250px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${escHtml(l.target)}">${escHtml(l.target || '-')}</td>

                                <td class="pe-4 py-3" style="font-size:0.78rem; color:#94a3b8; max-width:300px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${escHtml(detail)}">${escHtml(detail || '-')}</td>

                            </tr>`;

                        }).join('');

                    }

                }

            }

        }

        // Render Multi-Visualisasi Chart.js untuk semua role

        if (typeof loadDashboardBackupInfo === 'function') loadDashboardBackupInfo();

        try {

            const statsData = await chartDataPromise;

            if (statsData) {

                // 1. Bar Chart: Sebaran Tabel per Tahun

                const barCanvas = document.getElementById('dashboardBarChart');

                if (barCanvas && statsData.bar_chart) {

                    window.cachedBarChartData = JSON.parse(JSON.stringify(statsData.bar_chart));

                    const ctx = barCanvas.getContext('2d');

                    if (window.dashboardBarChartInstance) window.dashboardBarChartInstance.destroy();

                    window.dashboardBarChartInstance = new Chart(ctx, {

                        type: 'bar',

                        data: statsData.bar_chart,

                        options: {

                            responsive: true,

                            maintainAspectRatio: false,

                            maxBarThickness: 55,

                            barPercentage: 0.75,

                            categoryPercentage: 0.8,

                            animations: {

                                y: {

                                    type: 'number',

                                    easing: 'easeOutQuart',

                                    duration: 750,

                                    from: (ctx) => {

                                        if (typeof ctx.dataIndex === 'number' && ctx.chart && ctx.chart.scales && ctx.chart.scales.y) {

                                            return ctx.chart.scales.y.getPixelForValue(0);

                                        }

                                    },

                                    delay: (ctx) => {

                                        if (typeof ctx.dataIndex === 'number') {

                                            return ctx.dataIndex * 150;

                                        }

                                        return 0;

                                    }

                                }

                            },

                            plugins: {

                                legend: { display: false },

                                tooltip: {

                                    callbacks: {

                                        label: (ctx) => ` ${ctx.raw} Tabel Data Terintegrasi`

                                    }

                                }

                            },

                            scales: {

                                y: {

                                    beginAtZero: true,

                                    grid: { color: document.documentElement.getAttribute('data-bs-theme') === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)' },

                                    ticks: { color: document.documentElement.getAttribute('data-bs-theme') === 'dark' ? cssVar('--text-light') || '#94a3b8' : cssVar('--text-secondary') || '#64748b', font: { family: "'Inter', sans-serif", size: 10 } }

                                },

                                x: {

                                    grid: { display: false },

                                    ticks: { color: document.documentElement.getAttribute('data-bs-theme') === 'dark' ? cssVar('--text-light') || '#94a3b8' : cssVar('--text-secondary') || '#64748b', font: { family: "'Inter', sans-serif", size: 10 } }

                                }

                            }

                        }

                    });

                    if (window.cachedBarChartData && window.cachedBarChartData.labels.length > 10) {

                        const _sel = document.getElementById('barChartYearFilter');

                        if (_sel) { _sel.value = '10'; filterBarChart('10'); }

                    }

                }







                // 3. Line/Area Chart: Tren Akumulasi Volume Data (Simpan cache data & inisialisasi render)

                if (statsData.line_chart) {

                    window.cachedTrendChartData = statsData.line_chart;

                    renderTrendChartMode(window.currentTrendChartMode || 'points');

                }



                // 4. Bar Chart: Simpan cache data tahun referensi & inisialisasi render

                if (statsData.ref_year_chart) {

                    window.cachedRefChartData = statsData.ref_year_chart;

                    renderRefChartMode(window.currentRefChartMode || 'points');

                    if (window.cachedRefChartData.labels.length > 10) {

                        const _sel = document.getElementById('refChartYearFilter');

                        if (_sel) { _sel.value = '10'; filterRefChart('10'); }

                    }

                }

            }



            // 5. Load Feed Publikasi Terbaru

            const docsRes = await fetch(`${API_BASE}/documents`);

            const recentListEl = document.getElementById('recent-docs-list');

            if (docsRes.ok && recentListEl) {

                const docs = await docsRes.json();

                if (!docs || docs.length === 0) {

                    recentListEl.innerHTML = `<div class="text-center py-4 text-muted small">Belum ada publikasi terbit di sistem.</div>`;

                } else {

                    const sortedDocs = [...docs].sort((a, b) => (b.year || 0) - (a.year || 0) || b.id - a.id);

                    recentListEl.innerHTML = sortedDocs.map(d => {

                        const isExcel = (d.filename || '').toLowerCase().endsWith('.xlsx') || d.status === 'ready_excel';

                        const pubTitle = d.year ? `Publikasi ${d.year}` : d.filename.replace(/\.(pdf|xlsx)$/i, '');

                        const iconHtml = isExcel 

                            ? `<div class="rounded-3 bg-success bg-opacity-10 text-success flex-shrink-0 d-flex align-items-center justify-content-center" style="width: 42px; height: 42px; font-size: 1.2rem;">

                                   <i class="bi bi-file-earmark-spreadsheet-fill"></i>

                               </div>`

                            : `<div class="rounded-3 bg-danger bg-opacity-10 text-danger flex-shrink-0 d-flex align-items-center justify-content-center" style="width: 42px; height: 42px; font-size: 1.2rem;">

                                   <i class="bi bi-file-earmark-pdf"></i>

                               </div>`;



                        return `

                            <div class="recent-doc-item d-flex align-items-center justify-content-between rounded-3 border shadow-2xs" style="padding: 0.95rem 1.25rem;">

                                <div class="d-flex align-items-center min-w-0" style="gap: 16px;">

                                    ${iconHtml}

                                    <div class="min-w-0 pe-2">

                                        <div class="fw-bold recent-doc-title text-truncate" style="font-size: 0.92rem; letter-spacing: -0.01em;" title="${d.filename}">

                                            ${pubTitle}

                                        </div>

                                        <div class="d-flex align-items-center gap-2 recent-doc-subtext mt-1" style="font-size: 0.76rem;">

                                            <span class="d-inline-flex align-items-center"><i class="bi bi-calendar-event me-2 text-secondary"></i>Data ${d.year ? d.year - 1 : '-'}</span>

                                            <span class="opacity-40">•</span>

                                            <span class="badge bg-primary-subtle text-primary border border-primary-subtle" style="font-size: 0.72rem; padding: 2.5px 8.5px; border-radius: 6px; font-weight: 600;">

                                                ${d.table_count || 0} Tabel

                                            </span>

                                        </div>

                                    </div>

                                </div>

                                <button onclick="viewState.selectedDocId=${d.id}; viewState.selectedBabNum=null; navigateDataTabelTab('publikasi');" class="btn btn-sm btn-outline-primary py-1.5 px-3 rounded-2 flex-shrink-0" style="font-size: 0.78rem; font-weight: 600;">

                                    Buka <i class="bi bi-arrow-right-short"></i>

                                </button>

                            </div>

                        `;

                    }).join('');

                }

            }

        } catch (chartErr) {

            console.error("Gagal memuat visualisasi chart dashboard:", chartErr);

        }

    } catch (err) {

        console.error("Gagal memuat statistik dashboard:", err);

    }

}



async function markAllDbAnomaliesSafe() {

    Swal.fire({

        title: 'Tandai Semua Aman?',

        text: "Seluruh baris berstatus anomali di SELURUH DATABASE akan ditandai aman sekaligus.",

        icon: 'warning',

        showCancelButton: true,

        confirmButtonColor: cssVar('--success') || cssVar('--success-emerald') || '#10b981',

        cancelButtonColor: cssVar('--swal-cancel') || cssVar('--text-muted') || '#cbd5e1',

        confirmButtonText: 'Ya, Tandai Semua Aman',

        cancelButtonText: 'Batal'

    }).then(async (result) => {

        if (result.isConfirmed) {

            try {

                const res = await fetch(`${API_BASE}/admin/safe-all`, { method: "PUT" });

                if (res.ok) {

                    showToast('success', 'Berhasil!', 'Seluruh database telah bersih dari anomali.');

                    loadDashboardStats();

                } else {

                    showToast('error', 'Gagal', 'Gagal memproses permintaan.');

                }

            } catch(e) {

                showToast('error', 'Error', e.message);

            }

        }

    });

}



function openDocFromDashboard(id) {

    if (!checkRoleAccess('tabel')) return;

    viewState.selectedDocId = id;

    viewState.selectedBabNum = null;

    navigateDataTabelTab('publikasi');

}



// Fungsi Switch Tampilan Grafik Tren Pertumbuhan Akumulasi Volume (Titik Data vs Baris Record)

function switchTrendChartView(mode) {

    window.currentTrendChartMode = mode;

    renderTrendChartMode(mode);

}



function renderTrendChartMode(mode) {

    if (!window.cachedTrendChartData) return;

    const canvas = document.getElementById('dashboardTrendChart');

    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    

    const btnPts = document.getElementById('btn-trend-view-points');

    const btnRows = document.getElementById('btn-trend-view-rows');

    const titleEl = document.getElementById('trend-chart-title');

    const subTitleEl = document.getElementById('trend-chart-subtitle');

    

    const isPoints = mode === 'points';

    

    if (btnPts && btnRows) {

        btnPts.classList.toggle('active', isPoints);

        btnRows.classList.toggle('active', !isPoints);

    }

    

    if (titleEl && subTitleEl) {

        if (isPoints) {

            titleEl.textContent = 'Tren Pertumbuhan Akumulasi Titik Data';

            subTitleEl.textContent = 'Akumulasi titik nilai sel data statistik berdasarkan tahun publikasi';

        } else {

            titleEl.textContent = 'Tren Pertumbuhan Akumulasi Baris Record';

            subTitleEl.textContent = 'Akumulasi baris record data statistik berdasarkan tahun publikasi';

        }

    }

    

    const dataset = isPoints ? window.cachedTrendChartData.datasets[0] : window.cachedTrendChartData.datasets[1];

    const isDark = document.documentElement.getAttribute('data-bs-theme') === 'dark';

    const tickColor = isDark ? cssVar('--text-light') || '#94a3b8' : cssVar('--text-secondary') || '#64748b';

    const gridColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)';

    

    // Batalkan loop animasi sebelumnya jika masih berjalan

    if (window._trendAnimRafId) {

        cancelAnimationFrame(window._trendAnimRafId);

        window._trendAnimRafId = null;

    }



    const animStartTime = performance.now();

    const segDuration = 380; // ms per segmen penarikan garis

    const totalSegs = Math.max(dataset.data.length - 1, 1);

    const totalAnimTime = segDuration * totalSegs;



    const sequentialPenPlugin = {

        id: 'trendSequentialPenPlugin',

        afterDatasetsDraw(chart) {

            const { ctx, scales: { x, y } } = chart;

            if (!x || !y || !dataset.data || dataset.data.length === 0) return;



            const isDarkTheme = document.documentElement.getAttribute('data-bs-theme') === 'dark';

            const now = performance.now();

            const elapsed = now - animStartTime;

            const progress = Math.min(Math.max(elapsed / totalAnimTime, 0), 1);

            const activeProgress = progress * totalSegs; // rentang 0.0 sampai totalSegs

            const currentSegIndex = Math.min(Math.floor(activeProgress), totalSegs - 1);

            const segSubProgress = activeProgress - currentSegIndex;



            // Easing kuadratik halus untuk goresan pena

            const ease = (t) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

            const easedSegProgress = ease(Math.min(Math.max(segSubProgress, 0), 1));



            // Koordinat pixel target seluruh titik data

            const pts = dataset.data.map((val, i) => ({

                x: x.getPixelForTick(i),

                y: y.getPixelForValue(val),

                val: val

            }));



            if (pts.length === 0) return;



            const yZero = y.getPixelForValue(0);

            const strokeColor = isPoints ? (isDarkTheme ? cssVar('--purple-500') || '#818cf8' : cssVar('--indigo-600') || '#4f46e5') : (isDarkTheme ? cssVar('--primary-light') || '#38bdf8' : cssVar('--info') || '#0284c7');

            const fillColor = isPoints ? (isDarkTheme ? 'rgba(99, 102, 241, 0.22)' : 'rgba(99, 102, 241, 0.12)') : (isDarkTheme ? 'rgba(56, 189, 248, 0.22)' : 'rgba(2, 132, 199, 0.12)');



            // Koordinat ujung garis yang sedang meluncur

            const startPt = pts[currentSegIndex];

            const nextPt = pts[currentSegIndex + 1] || startPt;

            const currentTipX = startPt.x + (nextPt.x - startPt.x) * easedSegProgress;

            const currentTipY = startPt.y + (nextPt.y - startPt.y) * easedSegProgress;



            // 1. Gambar Area Fill Dinamis di Bawah Garis (Satu lapis murni mengikuti ujung pena)

            ctx.save();

            ctx.beginPath();

            ctx.moveTo(pts[0].x, yZero);

            ctx.lineTo(pts[0].x, pts[0].y);



            // Sambungkan segmen garis yang sudah selesai

            for (let j = 0; j < currentSegIndex; j++) {

                ctx.lineTo(pts[j + 1].x, pts[j + 1].y);

            }

            // Tarik tepat ke posisi ujung pena saat ini

            ctx.lineTo(currentTipX, currentTipY);

            ctx.lineTo(currentTipX, yZero);

            ctx.closePath();

            ctx.fillStyle = fillColor;

            ctx.fill();

            ctx.restore();



            // 2. Gambar Garis Kurva (Tarik Garis Bertahap)

            ctx.save();

            ctx.beginPath();

            ctx.moveTo(pts[0].x, pts[0].y);

            for (let j = 0; j < currentSegIndex; j++) {

                ctx.lineTo(pts[j + 1].x, pts[j + 1].y);

            }

            ctx.lineTo(currentTipX, currentTipY);

            ctx.strokeStyle = strokeColor;

            ctx.lineWidth = 3;

            ctx.lineCap = 'round';

            ctx.lineJoin = 'round';

            ctx.shadowColor = strokeColor;

            ctx.shadowBlur = 6;

            ctx.stroke();

            ctx.restore();



            // 3. Gambar Titik Node (Hanya muncul jika garis sudah sampai ke titik tersebut)

            const visiblePointCount = (progress >= 1) ? pts.length : (currentSegIndex + 1);



            for (let i = 0; i < visiblePointCount; i++) {

                const pt = pts[i];

                ctx.save();

                // Halo lingkaran luar

                ctx.beginPath();

                ctx.arc(pt.x, pt.y, 6.5, 0, Math.PI * 2);

                ctx.fillStyle = isDarkTheme ? cssVar('--text-primary') || '#1e293b' : cssVar('--text-white') || '#ffffff';

                ctx.fill();

                ctx.lineWidth = 2.5;

                ctx.strokeStyle = strokeColor;

                ctx.stroke();



                // Titik inti dalam

                ctx.beginPath();

                ctx.arc(pt.x, pt.y, 3.5, 0, Math.PI * 2);

                ctx.fillStyle = strokeColor;

                ctx.fill();

                ctx.restore();

            }



            // Gambar Pen-Tip Dot bersinar di ujung garis yang sedang meluncur

            if (progress < 1) {

                ctx.save();

                ctx.beginPath();

                ctx.arc(currentTipX, currentTipY, 5, 0, Math.PI * 2);

                ctx.fillStyle = cssVar('--text-white') || '#ffffff';

                ctx.shadowColor = strokeColor;

                ctx.shadowBlur = 10;

                ctx.fill();

                ctx.lineWidth = 2;

                ctx.strokeStyle = strokeColor;

                ctx.stroke();

                ctx.restore();

            }



            // 4. Gambar Badge Indikator Pertumbuhan (Hanya untuk titik yang sudah tercapai)

            const _drawnBadgeRects = [];

            for (let i = 0; i < visiblePointCount; i++) {

                const pt = pts[i];

                let badgeText = '';

                let isUp = true;



                if (i === 0) {

                    badgeText = `Awal: ${pt.val.toLocaleString('id-ID')}`;

                } else {

                    const prevVal = pts[i - 1].val;

                    const delta = pt.val - prevVal;

                    if (delta > 0) {

                        badgeText = `▲ +${delta.toLocaleString('id-ID')}`;

                        isUp = true;

                    } else if (delta < 0) {

                        badgeText = `▼ -${Math.abs(delta).toLocaleString('id-ID')}`;

                        isUp = false;

                    } else {

                        badgeText = `0`;

                    }

                }



                ctx.save();

                ctx.font = '600 10.5px "Inter", sans-serif';

                ctx.textAlign = 'center';

                ctx.textBaseline = 'middle';



                const textWidth = ctx.measureText(badgeText).width;

                const pillWidth = textWidth + 12;

                const pillHeight = 19;



                const isFirst = (i === 0);

                const isLast = (i === pts.length - 1);



                let pillX = pt.x;

                let pillY = pt.y - 18;



                if (isFirst) {

                    pillX = pt.x + (pillWidth / 2) + 8;

                    pillY = pt.y - 14;

                } else if (isLast) {

                    pillX = pt.x - (pillWidth / 2) - 8;

                    pillY = pt.y - 14;

                } else {

                    pillX = Math.max(pillWidth / 2 + 10, Math.min(chart.width - pillWidth / 2 - 10, pt.x));

                    pillY = Math.max(pt.y - 18, 14);

                }



                // Collision detection: push down if overlapping previous badge

                let badgeRect = {

                    left: pillX - pillWidth / 2,

                    right: pillX + pillWidth / 2,

                    top: pillY - pillHeight / 2,

                    bottom: pillY + pillHeight / 2

                };

                for (const prev of _drawnBadgeRects) {

                    if (badgeRect.left < prev.right && badgeRect.right > prev.left &&

                        badgeRect.top < prev.bottom && badgeRect.bottom > prev.top) {

                        pillY = prev.bottom + pillHeight / 2 + 3;

                        badgeRect.top = pillY - pillHeight / 2;

                        badgeRect.bottom = pillY + pillHeight / 2;

                    }

                }

                _drawnBadgeRects.push(badgeRect);



                ctx.beginPath();

                if (typeof ctx.roundRect === 'function') {

                    ctx.roundRect(pillX - pillWidth / 2, pillY - pillHeight / 2, pillWidth, pillHeight, 9);

                } else {

                    ctx.rect(pillX - pillWidth / 2, pillY - pillHeight / 2, pillWidth, pillHeight);

                }



                if (i === 0) {

                    ctx.fillStyle = isDarkTheme ? 'rgba(30, 41, 59, 0.92)' : 'rgba(241, 245, 249, 0.95)';

                    ctx.strokeStyle = isDarkTheme ? cssVar('--text-tertiary') || '#475569' : cssVar('--text-muted') || '#cbd5e1';

                } else if (isUp) {

                    ctx.fillStyle = isDarkTheme ? 'rgba(6, 78, 59, 0.9)' : 'rgba(209, 250, 229, 0.95)';

                    ctx.strokeStyle = isDarkTheme ? cssVar('--success-emerald') || '#10b981' : cssVar('--success') || '#059669';

                } else {

                    ctx.fillStyle = isDarkTheme ? 'rgba(127, 29, 29, 0.9)' : 'rgba(254, 226, 226, 0.95)';

                    ctx.strokeStyle = isDarkTheme ? cssVar('--danger') || '#ef4444' : cssVar('--danger') || '#dc2626';

                }

                ctx.lineWidth = 1;

                ctx.fill();

                ctx.stroke();



                if (i === 0) {

                    ctx.fillStyle = isDarkTheme ? cssVar('--text-muted') || '#cbd5e1' : cssVar('--text-tertiary') || '#475569';

                } else if (isUp) {

                    ctx.fillStyle = isDarkTheme ? cssVar('--success-light') || '#34d399' : cssVar('--success-dark') || '#047857';

                } else {

                    ctx.fillStyle = isDarkTheme ? cssVar('--danger') || '#f87171' : cssVar('--danger-text') || '#b91c1c';

                }

                ctx.fillText(badgeText, pillX, pillY);

                ctx.restore();

            }



            // Loop frame animasi jika belum selesai

            if (progress < 1) {

                window._trendAnimRafId = requestAnimationFrame(() => {

                    chart.render();

                });

            }

        }

    };



    if (window.dashboardTrendChartInstance) window.dashboardTrendChartInstance.destroy();

    window.dashboardTrendChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: window.cachedTrendChartData.labels,
            datasets: [{
                ...dataset,
                fill: false, // Hilangkan lapisan background statis bawaan Chart.js
                pointRadius: 4,
                pointHoverRadius: 8,
                pointHitRadius: 35, // Sensitivitas hover tinggi di sepanjang sumbu X
                pointHoverBorderWidth: 2,
                borderWidth: 0 // Garis digambar oleh sequentialPenPlugin
            }]
        },
        plugins: [sequentialPenPlugin],
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false, // Animasi dikendalikan oleh pen-drawing RAF loop
            interaction: {
                mode: 'index',
                intersect: false,
                axis: 'x'
            },
            hover: {
                mode: 'index',
                intersect: false
            },
            layout: {
                padding: {
                    top: 25,

                    left: 15,

                    right: 25,

                    bottom: 0

                }

            },

            plugins: {

                legend: { display: false },

                tooltip: {

                    padding: 10,

                    callbacks: {

                        label: (ctx) => ` Total Akumulasi: ${ctx.raw.toLocaleString('id-ID')} ${isPoints ? 'Titik Nilai Data' : 'Baris Record'}`,

                        afterLabel: (ctx) => {

                            const idx = ctx.dataIndex;

                            if (idx === 0) return ` 📍 Basis Awal Terbit (Tahun ${window.cachedTrendChartData.labels[0]})`;

                            const prev = dataset.data[idx - 1];

                            const diff = ctx.raw - prev;

                            const pct = prev > 0 ? ((diff / prev) * 100).toFixed(1) : '0';

                            if (diff > 0) return ` 📈 Penambahan Data: ▲ +${diff.toLocaleString('id-ID')} (+${pct}%)`;

                            if (diff < 0) return ` 📉 Pengurangan Data: ▼ -${Math.abs(diff).toLocaleString('id-ID')} (${pct}%)`;

                            return ` → Penambahan Data: 0 (Tetap)`;

                        }

                    }

                }

            },

            scales: {

                y: { 

                    beginAtZero: true, 

                    grid: { color: gridColor }, 

                    ticks: { color: tickColor, font: { family: "'Inter', sans-serif", size: 10 } } 

                },

                x: { 

                    grid: { display: false }, 

                    ticks: { color: tickColor, font: { family: "'Inter', sans-serif", size: 10 } } 

                }

            }

        }

    });

}



// Fungsi Year Filter untuk Bar Chart Sebaran Tabel

function filterBarChart(range) {

    if (!window.cachedBarChartData) return;

    const src = window.cachedBarChartData;

    const n = range === 'all' ? src.labels.length : parseInt(range);

    const labels = src.labels.slice(-n);

    const datasets = src.datasets.map(d => ({ ...d, data: d.data.slice(-n) }));

    if (window.dashboardBarChartInstance) window.dashboardBarChartInstance.destroy();

    const ctx = document.getElementById('dashboardBarChart').getContext('2d');

    const isDark = document.documentElement.getAttribute('data-bs-theme') === 'dark';

    window.dashboardBarChartInstance = new Chart(ctx, {

        type: 'bar',

        data: { labels, datasets },

        options: {

            responsive: true,

            maintainAspectRatio: false,

            maxBarThickness: 55,

            barPercentage: 0.75,

            categoryPercentage: 0.8,

            plugins: {

                legend: { display: false },

                tooltip: { callbacks: { label: (ctx) => ` ${ctx.raw} Tabel Data Terintegrasi` } }

            },

            scales: {

                y: { beginAtZero: true, grid: { color: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)' }, ticks: { color: isDark ? cssVar('--text-light') || '#94a3b8' : cssVar('--text-secondary') || '#64748b', font: { family: "'Inter', sans-serif", size: 10 } } },

                x: { grid: { display: false }, ticks: { color: isDark ? cssVar('--text-light') || '#94a3b8' : cssVar('--text-secondary') || '#64748b', font: { family: "'Inter', sans-serif", size: 10 } } }

            }

        }

    });

}



// Fungsi Year Filter untuk Bar Chart Ref Year

function filterRefChart(range) {

    window.currentRefYearFilter = range;

    renderRefChartMode(window.currentRefChartMode || 'points');

}



// Fungsi Switch Tampilan Grafik Titik Nilai Data vs Baris Record Data

function switchRefChartView(mode) {

    window.currentRefChartMode = mode;

    renderRefChartMode(mode);

}



function renderRefChartMode(mode) {

    if (!window.cachedRefChartData) return;

    const canvas = document.getElementById('dashboardRefYearChart');

    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    

    const btnPts = document.getElementById('btn-chart-view-points');

    const btnRows = document.getElementById('btn-chart-view-rows');

    const titleEl = document.getElementById('ref-chart-title');

    const subTitleEl = document.getElementById('ref-chart-subtitle');

    

    const isPoints = mode === 'points';

    

    if (btnPts && btnRows) {

        btnPts.classList.toggle('active', isPoints);

        btnRows.classList.toggle('active', !isPoints);

    }

    

    if (titleEl && subTitleEl) {

        const _refRange = window.currentRefYearFilter || 'all';

        const _refN = _refRange === 'all' ? window.cachedRefChartData.labels.length : parseInt(_refRange);

        const _filteredData0 = window.cachedRefChartData.datasets[0].data.slice(-_refN);

        const _filteredData1 = window.cachedRefChartData.datasets[1].data.slice(-_refN);

        if (isPoints) {
            titleEl.textContent = 'Sebaran Banyak Titik Nilai Data per Tahun';
            subTitleEl.textContent = 'Distribusi titik nilai sel data statistik berdasarkan tahun kejadian riil';
        } else {
            titleEl.textContent = 'Sebaran Baris Record Data per Tahun';
            subTitleEl.textContent = 'Distribusi baris entitas observasi per tahun kejadian riil';
        }

    }

    

    const dataset = isPoints ? window.cachedRefChartData.datasets[0] : window.cachedRefChartData.datasets[1];

    const isDark = document.documentElement.getAttribute('data-bs-theme') === 'dark';

    const tickColor = isDark ? cssVar('--text-light') || '#94a3b8' : cssVar('--text-secondary') || '#64748b';

    const gridColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)';



    // Apply year filter

    const _refRange = window.currentRefYearFilter || 'all';

    const _refN = _refRange === 'all' ? window.cachedRefChartData.labels.length : parseInt(_refRange);

    const _refLabels = window.cachedRefChartData.labels.slice(-_refN);

    const _refData = dataset.data.slice(-_refN);

    const _filteredDataset = { ...dataset, data: _refData };



    if (window.dashboardRefYearChartInstance) window.dashboardRefYearChartInstance.destroy();

    window.dashboardRefYearChartInstance = new Chart(ctx, {

        type: 'bar',

        data: {

            labels: _refLabels,

            datasets: [_filteredDataset]

        },

        options: {

            responsive: true,

            maintainAspectRatio: false,

            animations: {

                y: {

                    type: 'number',

                    easing: 'easeOutQuart',

                    duration: 750,

                    from: (ctx) => {

                        if (typeof ctx.dataIndex === 'number' && ctx.chart && ctx.chart.scales && ctx.chart.scales.y) {

                            return ctx.chart.scales.y.getPixelForValue(0);

                        }

                    },

                    delay: (ctx) => {

                        if (typeof ctx.dataIndex === 'number') {

                            return ctx.dataIndex * 120;

                        }

                        return 0;

                    }

                }

            },

            plugins: {

                legend: { display: false },

                tooltip: {

                    callbacks: {

                        label: (ctx) => ` ${dataset.label}: ${ctx.raw.toLocaleString('id-ID')} ${isPoints ? 'Titik Nilai Data' : 'Baris Record'}`

                    }

                }

            },

            scales: {

                y: { 

                    beginAtZero: true, 

                    grid: { color: gridColor }, 

                    ticks: { color: tickColor, font: { family: "'Inter', sans-serif", size: 10 } } 

                },

                x: { 

                    grid: { display: false }, 

                    ticks: { color: tickColor, font: { family: "'Inter', sans-serif", size: 10 } } 

                }

            }

        }

    });

}



// Page 2: Publikasi List (Khusus Dokumen PDF)

async function loadDocuments() {

    const res = await fetch(`${API_BASE}/documents`);

    const docs = await res.json();

    const listEl = document.getElementById("docs-list");



    // Simpan input user saat ini (agar tidak hilang saat auto-refresh)

    const savedInputs = {};

    document.querySelectorAll("input[id^='start-']").forEach(inp => savedInputs[inp.id] = inp.value);

    document.querySelectorAll("input[id^='end-']").forEach(inp => savedInputs[inp.id] = inp.value);

    document.querySelectorAll("select[id^='select-bab-']").forEach(sel => savedInputs[sel.id] = sel.value);

    

    listEl.innerHTML = "";

    

    // Filter HANYA dokumen PDF asli (file .pdf). Dokumen hasil template Excel (.xlsx) dikelola di menu Import Excel.

    const pdfDocs = docs.filter(doc => (doc.filename || "").toLowerCase().endsWith(".pdf"));

    

    if (pdfDocs.length === 0) {

        listEl.innerHTML = `

            <div class="text-center py-4 text-muted">

                <i class="bi bi-file-earmark-pdf" style="font-size:2.2rem; opacity:0.4;"></i>

                <div class="mt-2 fw-semibold">Belum ada file buku PDF yang diunggah</div>

                <small class="text-muted">Unggah file PDF publikasi BPS melalui form di atas untuk mulai ekstraksi bab dan tabel.</small>

            </div>

        `;

        return;

    }

    

    pdfDocs.forEach(doc => {

        let statusBadge = '';

        if (doc.status === 'ready') statusBadge = '<span style="background:var(--badge-green-bg, #dcfce7);color:var(--badge-green-text, #15803d);padding:4px 10px;border-radius:20px;font-size:0.75rem;font-weight:700;">✓ Siap</span>';

        else if (doc.status.startsWith('extracting')) statusBadge = '<span style="background:var(--warning-light, #fef3c7);color:var(--warning-dark, #b45309);padding:4px 10px;border-radius:20px;font-size:0.75rem;font-weight:700;">¢³ Ekstraksi...</span>';

        else if (doc.status.startsWith('error')) statusBadge = `<span style="background:var(--danger-light, #fee2e2);color:var(--danger-dark, #b91c1c);padding:4px 10px;border-radius:20px;font-size:0.75rem;font-weight:700;" title="${escHtml(doc.status)}">⚠️ Gagal</span>`;

        else statusBadge = `<span style="background:var(--bg-hover, #f1f5f9);color:var(--text-secondary, #475569);padding:4px 10px;border-radius:20px;font-size:0.75rem;font-weight:700;">${doc.status.toUpperCase()}</span>`;



        let actionsHtml = "";

        if (doc.status === "ready" || doc.status.startsWith("error") || doc.status === "pending") {

            actionsHtml = `

                <div class="mt-2">

                    <select id="select-bab-${doc.id}" class="form-select form-select-sm">

                        <option value="">Memuat daftar bab...</option>

                    </select>

                </div>

                <div class="d-flex gap-2 mt-2 flex-wrap">

                    <button onclick="detectToc(${doc.id})" class="btn btn-success btn-sm">Deteksi Bab Otomatis</button>

                    <button onclick="openTocEditor(${doc.id}, '${doc.filename}')" class="btn btn-outline-primary btn-sm">Edit Bab Manual</button>

                </div>

                <div class="d-flex gap-2 mt-2 align-items-center flex-wrap">

                    <input type="number" id="start-${doc.id}" placeholder="Hal Awal" class="form-control form-control-sm" style="width:90px;">

                    <input type="number" id="end-${doc.id}" placeholder="Hal Akhir" class="form-control form-control-sm" style="width:90px;">

                    <button onclick="extractPages(${doc.id})" class="btn btn-primary btn-sm">Ekstrak</button>

                    <button onclick="deleteDocument(${doc.id})" class="btn btn-outline-danger btn-sm ms-auto">Hapus</button>

                </div>

            `;

        }

        

        listEl.innerHTML += `

            <div class="glass-panel p-3 mb-2">

                <div class="d-flex justify-content-between gap-2 align-items-start flex-wrap">

                    <div class="fw-semibold" style="word-break:break-all;">${doc.filename}</div>

                    <div class="d-flex gap-1.5 align-items-center flex-wrap">

                        <span class="badge bg-primary-subtle text-primary border" style="font-size:0.75rem; font-weight:600;">Publikasi ${doc.year}</span>

                        <span class="badge bg-light text-dark border" style="font-size:0.75rem; font-weight:600;">Data ${doc.year ? doc.year - 1 : '-'}</span>

                        ${statusBadge}

                    </div>

                </div>

                ${actionsHtml}

            </div>

        `;

    });

    

    // Kembalikan input user

    for (const [id, val] of Object.entries(savedInputs)) {

        const inp = document.getElementById(id);

        if (inp) inp.value = val;

    }



    // Panggil fungsi pembuat dropdown bab dinamis

    pdfDocs.forEach(doc => {

        if (doc.status === "ready" || doc.status.startsWith("error") || doc.status === "pending") {

            populateBabDropdown(doc.id);

        }

    });

}



// ===== IMPORT EXCEL PAGE =====

let importSrcTables = [];



function syncImportColYear() {

    const pubYearInp = document.getElementById('import-pub-year');

    const colYearInp = document.getElementById('import-col-year');

    if (!pubYearInp || !colYearInp) return;

    const py = parseInt(pubYearInp.value, 10);

    if (!isNaN(py) && py > 1900) {

        colYearInp.value = py - 1;

    }

}



async function loadImportExcelPage() {

    const srcSelect = document.getElementById('import-src-doc');

    if (!srcSelect) return;

    try {

        const res = await fetch(`${API_BASE}/documents`);

        const docs = await res.json();

        srcSelect.innerHTML = '<option value="">-- Pilih publikasi --</option>';

        docs.filter(d => d.status === 'ready')

            .sort((a, b) => (b.year || 0) - (a.year || 0))

            .forEach(d => {

                const opt = document.createElement('option');

                opt.value = d.id;

                opt.dataset.year = d.year || '';

                const dataYear = d.year ? d.year - 1 : '-';

                opt.textContent = `Publikasi ${d.year} (Data ${dataYear}) - ${d.filename}`;

                srcSelect.appendChild(opt);

            });

        document.getElementById('import-src-bab').innerHTML = '<option value="">-- Pilih Bab --</option>';

        document.getElementById('import-src-table').innerHTML = '<option value="">-- Pilih Tabel --</option>';

        document.getElementById('import-template-hint').textContent = '';

        

        // Muat daftar publikasi hasil import template

        loadImportedExcelPublications();

    } catch (err) {

        showToast('error', 'Gagal', `Gagal memuat publikasi: ${err.message}`);

    }

}



async function loadImportedExcelPublications() {

    const listEl = document.getElementById('excel-imported-pub-list');

    if (!listEl) return;

    try {

        const res = await fetch(`${API_BASE}/documents`);

        const docs = await res.json();

        const excelDocs = docs.filter(doc => (doc.filename || '').toLowerCase().endsWith('.xlsx') || doc.status === 'ready_excel');

        

        if (excelDocs.length === 0) {

            listEl.innerHTML = `

                <div class="text-center py-3 text-muted" style="font-size:0.82rem;">

                    <i class="bi bi-info-circle me-1"></i> Belum ada publikasi yang diimpor dari template Excel.

                </div>

            `;

            return;

        }



        // Ambil jumlah tabel per dokumen secara paralel

        const docCounts = await Promise.all(excelDocs.map(async (doc) => {

            try {

                const tblRes = await fetch(`${API_BASE}/documents/${doc.id}/tables`);

                if (tblRes.ok) {

                    const tbls = await tblRes.json();

                    return { id: doc.id, count: Array.isArray(tbls) ? tbls.length : 0 };

                }

            } catch (_) {}

            return { id: doc.id, count: 0 };

        }));

        const tableCountMap = {};

        docCounts.forEach(dc => {

            tableCountMap[dc.id] = dc.count;

        });



        listEl.innerHTML = excelDocs.map(doc => {
            const count = tableCountMap[doc.id] || 0;
            return `
                <div class="excel-pub-card p-3 rounded-3 d-flex justify-content-between align-items-center flex-wrap gap-3">
                    <div class="d-flex flex-column gap-1.5" style="min-width:280px;">
                        <div class="d-flex align-items-center gap-2 flex-wrap">
                            <div class="pub-card-icon-box d-flex align-items-center justify-content-center rounded-2" style="width:32px; height:32px; font-size:1.1rem; background: var(--primary-faint, #eff6ff); color: var(--primary, #1e40af);">
                                <i class="bi bi-journal-bookmark-fill"></i>
                            </div>
                            <span class="fw-bold pub-card-title text-dark" style="font-size:0.95rem;">Publikasi Kabupaten Tasikmalaya Dalam Angka ${doc.year}</span>
                        </div>
                        <div class="pub-card-subtext small d-flex gap-3 align-items-center flex-wrap" style="font-size:0.8rem; margin-left: 40px;">
                            <span class="d-inline-flex align-items-center gap-1"><i class="bi bi-calendar3"></i> Tahun Publikasi: <strong class="pub-card-strong">${doc.year}</strong> (Data ${doc.year ? doc.year - 1 : '-'})</span>
                            <span class="opacity-50">•</span>
                            <span class="d-inline-flex align-items-center gap-1"><i class="bi bi-table text-primary"></i> <strong class="text-primary">${count} Tabel</strong> Aktif</span>
                        </div>
                    </div>

                    <div class="d-flex align-items-center gap-2 flex-wrap ms-auto">

                        <button class="btn btn-edit-bab btn-sm px-3 py-1.5 d-inline-flex align-items-center gap-1.5 rounded-2" onclick="openTocEditor(${doc.id}, 'Publikasi ${doc.year}')" style="font-size:0.82rem; font-weight:500;" title="Edit daftar nama bab untuk Publikasi ${doc.year}">

                            <i class="bi bi-pencil-square text-primary"></i> Edit Bab Manual

                        </button>

                        <button class="btn btn-primary btn-sm px-3 py-1.5 d-inline-flex align-items-center gap-1.5 rounded-2 shadow-sm" onclick="viewState.selectedDocId=${doc.id}; viewState.selectedBabNum=null; navigateDataTabelTab('publikasi');" style="font-size:0.82rem; font-weight:500;" title="Lihat semua tabel di Publikasi ${doc.year}">

                            <i class="bi bi-folder2-open"></i> Buka Data Tabel

                        </button>

                        <button class="btn btn-outline-danger btn-sm px-2.5 py-1.5 d-inline-flex align-items-center rounded-2" onclick="deleteDocument(${doc.id})" style="font-size:0.82rem;" title="Hapus publikasi ini">

                            <i class="bi bi-trash"></i>

                        </button>

                    </div>

                </div>

            `;

        }).join('');

    } catch (err) {

        listEl.innerHTML = `<div class="text-danger small p-2">Gagal memuat status publikasi Excel: ${err.message}</div>`;

    }

}



async function importLoadTables() {

    const docSelect = document.getElementById('import-src-doc');

    const docId = docSelect ? docSelect.value : null;

    const babSelect = document.getElementById('import-src-bab');

    const tableSelect = document.getElementById('import-src-table');

    const hint = document.getElementById('import-template-hint');

    const pubYearInp = document.getElementById('import-pub-year');

    const colYearInp = document.getElementById('import-col-year');



    tableSelect.innerHTML = '<option value="">-- Pilih Tabel --</option>';

    babSelect.innerHTML = '<option value="">-- Pilih Bab --</option>';

    hint.textContent = '';



    if (!docId) return;



    // Auto-fill Tahun Publikasi & Tahun Data (T-1)

    const selectedOpt = docSelect.options[docSelect.selectedIndex];

    if (selectedOpt && selectedOpt.dataset.year) {

        const py = parseInt(selectedOpt.dataset.year, 10);

        if (pubYearInp) pubYearInp.value = py;

        if (colYearInp) colYearInp.value = py - 1;

    }



    try {

        const res = await fetch(`${API_BASE}/documents/${docId}/tables`);

        importSrcTables = await res.json();



        // Group by bab (dari nomor tabel, konsisten dgn halaman Data Tabel)

        const grouped = {};

        importSrcTables.forEach(t => {

            const match = (t.table_name || '').match(/Tabel[\s_]*(\d+)/i);

            const babNum = match && match[1] ? parseInt(match[1], 10) : 999;

            const babName = match ? `Bab ${babNum}` : 'Lainnya';

            if (!grouped[babNum]) grouped[babNum] = { name: babName, num: babNum, tables: [] };

            grouped[babNum].tables.push(t);

        });



        Object.values(grouped)

            .sort((a, b) => a.num - b.num)

            .forEach(g => {

                const opt = document.createElement('option');

                opt.value = g.num;

                opt.textContent = `${g.name} (${g.tables.length})`;

                babSelect.appendChild(opt);

            });

    } catch (err) {

        showToast('error', 'Gagal', `Gagal memuat tabel: ${err.message}`);

    }

}



function importOnBabChange() {

    const babNum = document.getElementById('import-src-bab').value;

    const tableSelect = document.getElementById('import-src-table');

    tableSelect.innerHTML = '<option value="">-- Pilih Tabel --</option>';

    if (!babNum) return;



    const tables = importSrcTables.filter(t => {

        const m = (t.table_name || '').match(/Tabel[\s_]*(\d+)/i);

        const bn = m && m[1] ? parseInt(m[1], 10) : 999;

        return bn === parseInt(babNum, 10);

    });



    tables.sort((a, b) => (a.table_name || '').localeCompare(b.table_name || ''))

        .forEach(t => {

            const opt = document.createElement('option');

            opt.value = t.id;

            opt.textContent = t.table_name;

            tableSelect.appendChild(opt);

        });

}



function importOnTableChange() {

    const tableId = document.getElementById('import-src-table').value;

    const hint = document.getElementById('import-template-hint');

    if (!tableId) { hint.textContent = ''; return; }

    const t = importSrcTables.find(x => x.id === parseInt(tableId, 10));

    if (t) {

        hint.textContent = `Template: ${t.table_name} (${(t.headers || []).length} kolom). Kolom 1 (rincian) terisi otomatis; header, satuan, dan tahun juga terisi. Isi data angka di kolom lain.`;

    }

}



async function importDownloadTemplate() {

    const tableId = document.getElementById('import-src-table').value;

    if (!tableId) {

        showToast('warning', 'Perhatian', 'Pilih Tabel terlebih dahulu.');

        return;

    }

    const pubYear = document.getElementById('import-pub-year') ? document.getElementById('import-pub-year').value : '';

    const colYear = document.getElementById('import-col-year') ? document.getElementById('import-col-year').value : '';

    const params = [`table_id=${tableId}`];

    if (pubYear) params.push(`pub_year=${pubYear}`);

    if (colYear) params.push(`col_year=${colYear}`);

    const query = `?${params.join('&')}`;



    try {

        const res = await fetch(`${API_BASE}/import/template${query}`);

        if (!res.ok) {

            const err = await res.json().catch(() => ({}));

            showToast('error', 'Gagal', err.detail || 'Gagal mengunduh template.');

            return;

        }

        const blob = await res.blob();

        const t = importSrcTables.find(x => x.id === parseInt(tableId, 10));

        const filename = `${(t && t.table_name ? t.table_name : 'template').replace(/[\\/:*?"<>|]/g, '_')}.xlsx`;

        const a = document.createElement('a');

        a.href = URL.createObjectURL(blob);

        a.download = filename;

        document.body.appendChild(a);

        a.click();

        a.remove();

        URL.revokeObjectURL(a.href);

        showToast('success', 'Berhasil!', 'Template berhasil diunduh.', 2500);

    } catch (err) {

        showToast('error', 'Gagal', `Gagal mengunduh template: ${err.message}`);

    }

}



async function importDownloadBabZip() {

    const docId = document.getElementById('import-src-doc').value;

    const babNum = document.getElementById('import-src-bab').value;

    if (!docId) {

        showToast('warning', 'Perhatian', 'Pilih Sumber Header (Publikasi) terlebih dahulu.');

        return;

    }

    if (!babNum) {

        showToast('warning', 'Perhatian', 'Pilih Bab terlebih dahulu.');

        return;

    }

    const pubYear = document.getElementById('import-pub-year') ? document.getElementById('import-pub-year').value : '';

    const colYear = document.getElementById('import-col-year') ? document.getElementById('import-col-year').value : '';

    const params = [`doc_id=${docId}`, `bab_num=${babNum}`];

    if (pubYear) params.push(`pub_year=${pubYear}`);

    if (colYear) params.push(`col_year=${colYear}`);

    const query = `?${params.join('&')}`;



    try {

        const res = await fetch(`${API_BASE}/import/template/zip${query}`);

        if (!res.ok) {

            const err = await res.json().catch(() => ({}));

            showToast('error', 'Gagal', err.detail || 'Gagal mengunduh ZIP.');

            return;

        }

        const blob = await res.blob();

        const a = document.createElement('a');

        a.href = URL.createObjectURL(blob);

        a.download = `templates_Bab${babNum}.zip`;

        document.body.appendChild(a);

        a.click();

        a.remove();

        URL.revokeObjectURL(a.href);

        showToast('success', 'Berhasil!', 'Semua template bab berhasil diunduh (ZIP).', 2500);

    } catch (err) {

        showToast('error', 'Gagal', `Gagal mengunduh ZIP: ${err.message}`);

    }

}



async function importUploadExcel() {

    const year = document.getElementById('import-year').value;

    const fileInput = document.getElementById('import-file');

    const resultDiv = document.getElementById('import-result');

    const excelBar = document.getElementById('excel-upload-bar');

    const excelProgress = document.getElementById('excel-upload-progress');

    const excelStatus = document.getElementById('excel-upload-status');



    let files = [];

    if (typeof __excelDragFiles !== 'undefined' && __excelDragFiles && __excelDragFiles.length) {

        files = __excelDragFiles;

    } else if (fileInput && fileInput.files && fileInput.files.length) {

        files = Array.from(fileInput.files);

    }



    if (!files || files.length === 0) {

        showToast('warning', 'Perhatian', 'Pilih minimal satu file .xlsx terlebih dahulu.');

        return;

    }



    const fd = new FormData();

    if (year) fd.append('year', year);

    files.forEach(f => {

        fd.append('files', f);

    });



    resultDiv.textContent = `Mengimpor ${files.length} file...`;

    if (excelProgress) excelProgress.style.display = 'block';

    if (excelBar) { excelBar.style.width = '0%'; excelBar.classList.add('progress-bar-animated'); excelBar.classList.remove('bg-success','bg-danger'); }

    if (excelStatus) excelStatus.textContent = `Mengunggah ${files.length} file...`;



    Swal.fire({ 

        title: `Mengimpor ${files.length} File Excel...`, 

        text: 'Membaca seluruh tabel dan sheet, mohon tunggu sebentar...', 

        allowOutsideClick: false, 

        didOpen: () => Swal.showLoading() 

    });



    try {

        const res = await uploadWithProgress(`${API_BASE}/import/excel`, fd, excelBar, excelStatus);

        Swal.close();

        const data = await res.json();

        if (!res.ok) {

            resultDiv.textContent = '';

            showToast('error', 'Gagal', data.detail || 'Gagal mengimpor file.');

            if (excelStatus) excelStatus.textContent = 'Gagal';

            if (excelBar) { excelBar.classList.remove('progress-bar-animated'); excelBar.classList.add('bg-danger'); }

            return;

        }

        resultDiv.innerHTML = (data.message || 'Berhasil diimpor.') + ` &nbsp;<a href="javascript:void(0)" onclick="viewState.selectedDocId=${data.document_id}; viewState.selectedBabNum=null; navigateDataTabelTab('publikasi');" style="color:var(--info, #2563eb); font-weight:600; text-decoration:underline;">Buka publikasi →</a>`;

        showToast('success', 'Berhasil!', data.message || 'Tabel berhasil diimpor.', 4000);

        

        __excelDragFiles = [];

        if (fileInput) fileInput.value = '';

        document.getElementById('import-year').value = '';

        const txt = document.getElementById('excel-drop-text');

        if (txt) {

            txt.innerHTML = `

                <i class="bi bi-file-earmark-spreadsheet text-success dropzone-icon"></i><br>

                <span class="fw-semibold text-dark">Seret & lepas 1 atau banyak file .xlsx di sini</span>, atau <span class="text-success text-decoration-underline">pilih file</span>

                <div class="text-muted" style="font-size:0.72rem; margin-top:2px;">Dapat memilih banyak file sekaligus (Multi-File Import)</div>

            `;

        }

        if (excelProgress) excelProgress.style.display = 'none';

        loadImportedExcelPublications();

        if (typeof populateDocumentList === 'function') populateDocumentList();

    } catch (err) {

        Swal.close();

        resultDiv.textContent = '';

        showToast('error', 'Gagal', `Gagal mengimpor: ${err.message}`);

        if (excelStatus) excelStatus.textContent = 'Error';

    }

}



async function detectToc(docId) {

    Swal.fire({

        title: 'Mendeteksi Bab Otomatis',

        text: 'Membaca daftar isi dokumen PDF (TOC)...',

        allowOutsideClick: false,

        didOpen: () => {

            Swal.showLoading();

        }

    });

    

    try {

        const res = await fetch(`${API_BASE}/documents/${docId}/detect_toc`, {

            method: "POST"

        });

        

        Swal.close();

        if (res.ok) {

            const data = await res.json();

            showToast('success', 'Berhasil!', data.message || 'Deteksi bab otomatis selesai.', 2000);

            await populateBabDropdown(docId);

        } else {

            const err = await res.json();

            showToast('error', 'Gagal', err.detail || 'Gagal mendeteksi bab secara otomatis.');

        }

    } catch (e) {

        Swal.close();

        showToast('error', 'Error', e.message);

    }

}



async function populateBabDropdown(docId) {

    const select = document.getElementById(`select-bab-${docId}`);

    if (!select) return;

    try {

        const res = await fetch(`${API_BASE}/documents/${docId}/toc`);

        if (res.ok) {

            const toc = await res.json();

            if (toc && toc.length > 0) {

                select.innerHTML = '<option value="">-- Pilih Bab (Otomatis) --</option>';

                toc.forEach((item, index) => {

                    select.innerHTML += `<option value="${index}" data-start="${item.start_page}" data-end="${item.end_page}">${item.title} (Hal ${item.start_page}-${item.end_page})</option>`;

                });

                

                select.onchange = () => {

                    const selectedOpt = select.options[select.selectedIndex];

                    const startVal = selectedOpt.getAttribute('data-start');

                    const endVal = selectedOpt.getAttribute('data-end');

                    if (startVal && endVal) {

                        document.getElementById(`start-${docId}`).value = startVal;

                        document.getElementById(`end-${docId}`).value = endVal;

                    } else {

                        document.getElementById(`start-${docId}`).value = '';

                        document.getElementById(`end-${docId}`).value = '';

                    }

                };

            } else {

                select.innerHTML = '<option value="">Daftar Bab belum terdeteksi</option>';

            }

        }

    } catch (err) {

        console.error("Gagal memuat daftar bab:", err);

        select.innerHTML = '<option value="">Gagal memuat bab</option>';

    }

}



async function openTocEditor(docId, filename) {

    try {

        const res = await fetch(`${API_BASE}/documents/${docId}/toc`);

        if (!res.ok) throw new Error("Gagal mengambil TOC");

        let toc = await res.json() || [];



        // Deteksi apakah dokumen adalah Excel (tidak memerlukan input nomor halaman)

        const isPdf = typeof filename === 'string' && filename.toLowerCase().endsWith('.pdf');



        // Buat editor HTML

        let descText = isPdf 

            ? "Edit atau tambahkan bab dan halaman jangkauannya secara manual. Klik Simpan jika sudah selesai."

            : "Edit atau sesuaikan nama bab untuk publikasi ini. Klik Simpan jika sudah selesai.";



        let editorHtml = `

            <div style="max-height: 400px; overflow-y: auto; text-align: left; padding: 0.5rem;" id="toc-editor-rows">

                <p style="font-size: 0.85rem; color: #64748b; margin-bottom: 1rem;">

                    ${descText}

                </p>

        `;



        function renderRow(title, start, end, index) {

            if (!isPdf) {

                // Tampilan simpel tanpa input nomor halaman untuk Excel

                return `

                    <div class="toc-row" data-index="${index}" style="display: flex; gap: 8px; align-items: center; margin-bottom: 8px;">

                        <input type="text" class="toc-title" value="${title}" placeholder="Judul Bab (e.g. Bab 1 - Geografi dan Iklim)" style="flex: 1; padding: 7px 10px; border: 1px solid var(--swal-cancel, #cbd5e1); border-radius: 6px; font-size: 0.88rem;">

                        <button onclick="this.parentElement.remove()" style="background: var(--danger-light, #fee2e2); color: var(--danger, #ef4444); border: 1px solid #fecaca; border-radius: 6px; padding: 6px 10px; cursor: pointer; font-size: 0.85rem; font-weight: bold;" title="Hapus Bab">✕</button>

                    </div>

                `;

            }

            return `

                <div class="toc-row" data-index="${index}" style="display: flex; gap: 8px; align-items: center; margin-bottom: 8px;">

                    <input type="text" class="toc-title" value="${title}" placeholder="Judul Bab (e.g. Bab 1 - Geografi)" style="flex: 2; padding: 6px; border: 1px solid var(--swal-cancel, #cbd5e1); border-radius: 4px; font-size: 0.85rem;">

                    <input type="number" class="toc-start" value="${start}" placeholder="Mulai" style="width: 70px; padding: 6px; border: 1px solid var(--swal-cancel, #cbd5e1); border-radius: 4px; font-size: 0.85rem;">

                    <input type="number" class="toc-end" value="${end}" placeholder="Akhir" style="width: 70px; padding: 6px; border: 1px solid var(--swal-cancel, #cbd5e1); border-radius: 4px; font-size: 0.85rem;">

                    <button onclick="this.parentElement.remove()" style="background: var(--danger, #ef4444); color: white; border: none; border-radius: 4px; padding: 6px 10px; cursor: pointer; font-size: 0.85rem;">✕</button>

                </div>

            `;

        }



        toc.forEach((item, idx) => {

            editorHtml += renderRow(item.title, item.start_page, item.end_page, idx);

        });



        editorHtml += `</div>

            <div style="text-align: left; margin-top: 10px; padding-left: 0.5rem;">

                <button id="add-toc-row-btn" class="btn btn-small" style="background-color: var(--success, #10b981); color: white; padding: 6px 12px; border-radius: 4px; border: none; cursor: pointer; font-size: 0.85rem;">+ Tambah Bab</button>

            </div>

        `;



        Swal.fire({

            title: `Edit Bab - ${filename}`,

            html: editorHtml,

            width: '580px',

            showCancelButton: true,

            confirmButtonText: 'Simpan',

            cancelButtonText: 'Batal',

            confirmButtonColor: cssVar('--swal-confirm-primary') || cssVar('--indigo-600') || '#4f46e5',

            didOpen: () => {

                const addBtn = document.getElementById('add-toc-row-btn');

                const container = document.getElementById('toc-editor-rows');

                addBtn.addEventListener('click', () => {

                    const tempDiv = document.createElement('div');

                    tempDiv.innerHTML = renderRow('', '', '', Date.now());

                    container.appendChild(tempDiv.firstElementChild);

                });

            },

            preConfirm: () => {

                const rows = document.querySelectorAll('#toc-editor-rows .toc-row');

                const updatedToc = [];

                let idx = 1;

                for (const row of rows) {

                    const title = row.querySelector('.toc-title').value.trim();

                    if (!title) {

                        Swal.showValidationMessage("Judul Bab tidak boleh kosong!");

                        return false;

                    }



                    let start = idx;

                    let end = idx;

                    const startEl = row.querySelector('.toc-start');

                    const endEl = row.querySelector('.toc-end');



                    if (isPdf && startEl && endEl) {

                        start = parseInt(startEl.value);

                        end = parseInt(endEl.value);

                        if (isNaN(start) || isNaN(end)) {

                            Swal.showValidationMessage("Halaman awal dan akhir harus berupa angka!");

                            return false;

                        }

                    }



                    updatedToc.push({

                        title: title,

                        start_page: start,

                        end_page: end

                    });

                    idx++;

                }

                return updatedToc;

            }

        }).then(async (result) => {

            if (result.isConfirmed) {

                Swal.fire({

                    title: 'Menyimpan...',

                    allowOutsideClick: false,

                    didOpen: () => { Swal.showLoading(); }

                });



                const saveRes = await fetch(`${API_BASE}/documents/${docId}/toc`, {

                    method: "POST",

                    headers: { "Content-Type": "application/json" },

                    body: JSON.stringify(result.value)

                });



                Swal.close();

                if (saveRes.ok) {

                    showToast('success', 'Tersimpan!', 'Daftar bab berhasil diperbarui secara manual.');

                    populateBabDropdown(docId);

                    populateDocumentList();

                } else {

                    const errData = await saveRes.json();

                    showToast('error', 'Gagal!', `Gagal menyimpan: ${errData.detail || 'Terjadi kesalahan'}`);

                }

            }

        });



    } catch (err) {

        Swal.close();

        showToast("error", "Error", `Gagal memuat editor bab: ${err.message}`);

    }

}





async function extractPages(docId) {

    const startInput = document.getElementById(`start-${docId}`).value;

    const endInput = document.getElementById(`end-${docId}`).value;

    

    if(!startInput || !endInput) {

        showToast("warning", "Peringatan", "Masukkan halaman awal dan halaman akhir!");

        return;

    }

    

    Swal.fire({

        title: 'Memulai Ekstraksi',

        text: 'Menyiapkan proses di latar belakang...',

        allowOutsideClick: false,

        didOpen: () => {

            Swal.showLoading();

        }

    });

    try {

        const res = await fetch(`${API_BASE}/documents/${docId}/extract`, {

            method: "POST",

            headers: { "Content-Type": "application/json" },

            body: JSON.stringify({

                start_page: parseInt(startInput),

                end_page: parseInt(endInput)

            })

        });

        

        Swal.close();

        if(res.ok) {

            showToast("info", "Informasi", "Mengekstrak halaman di background...", 2000);

            await loadDocuments();

        } else {

            showToast("error", "Gagal", "Gagal memulai ekstraksi");

        }

    } catch(err) {

        Swal.close();

        showToast("error", "Error", err.message);

    }

}



function deleteBab(docId, babNum, babName) {

    Swal.fire({

        title: 'Hapus Bab?',

        text: `Anda yakin ingin menghapus semua tabel di ${babName} secara permanen?`,

        icon: 'warning',

        showCancelButton: true,

        confirmButtonColor: cssVar('--danger') || cssVar('--danger') || '#ef4444',

        cancelButtonColor: cssVar('--swal-cancel') || cssVar('--text-muted') || '#cbd5e1',

        confirmButtonText: 'Ya, Hapus',

        cancelButtonText: 'Batal',

        showLoaderOnConfirm: true,

        preConfirm: async () => {

            try {

                const res = await fetch(`${API_BASE}/documents/${docId}/bab/${babNum}`, { method: "DELETE" });

                if (!res.ok) throw new Error("Gagal menghapus");

                await loadDocuments();

                await populateDocumentList();

                return await res.json();

            } catch (error) {

                Swal.showValidationMessage(`Request failed: ${error}`);

            }

        },

        allowOutsideClick: () => !Swal.isLoading()

    }).then((result) => {

        if (result.isConfirmed) {

            Swal.fire('Berhasil!', result.value.message || 'Bab berhasil dihapus.', 'success');

        }

    });

}



function deleteDocument(docId) {

    Swal.fire({

        title: 'Hapus Publikasi?',

        text: "PERMANEN! Semua tabel + folder hasil ekstraksinya (CSV) akan ikut terhapus dan TIDAK BISA dikembalikan. Disarankan backup DB dulu.",

        icon: 'warning',

        showCancelButton: true,

        confirmButtonColor: cssVar('--danger') || cssVar('--danger') || '#ef4444',

        cancelButtonColor: cssVar('--swal-cancel') || cssVar('--text-muted') || '#cbd5e1',

        confirmButtonText: 'Ya, Hapus',

        cancelButtonText: 'Batal',

        showLoaderOnConfirm: true,

        preConfirm: async () => {

            try {

                const res = await fetch(`${API_BASE}/documents/${docId}`, { method: "DELETE" });

                if (!res.ok) throw new Error("Gagal menghapus");

                await loadDocuments();

                await populateDocumentList();

            } catch (error) {

                Swal.showValidationMessage(`Request failed: ${error}`);

            }

        },

        allowOutsideClick: () => !Swal.isLoading()

    }).then((result) => {

        if (result.isConfirmed) {

            Swal.fire('Terhapus!', 'Publikasi berhasil dihapus.', 'success');

        }

    });

}



// State untuk navigasi drill-down (Folder Explorer)

let viewState = {

    selectedDocId: null,

    selectedBabNum: null

};



// Page 3: Tabel Data (CRUD)
async function populateDocumentList() {
    let docs = window.__cachedDocsList;
    const container = document.getElementById("document-list-container");
    if (!container) return;

    if (!docs) {
        try {
            const cachedDocsStr = localStorage.getItem('sipedas_docs_cache');
            if (cachedDocsStr) {
                docs = JSON.parse(cachedDocsStr);
                window.__cachedDocsList = docs;
            }
        } catch (e) {}
    }

    // Jalankan fetch docs, toc, dan tables secara paralel jika doc dipilih
    const fetchPromises = [
        fetch(`${API_BASE}/documents`).then(r => r.ok ? r.json() : []).catch(() => [])
    ];

    let docChapters = {};
    let preloadedTables = null;

    if (viewState.selectedDocId) {
        fetchPromises.push(
            fetch(`${API_BASE}/documents/${viewState.selectedDocId}/toc`).then(r => r.ok ? r.json() : []).catch(() => [])
        );
        fetchPromises.push(
            fetch(`${API_BASE}/documents/${viewState.selectedDocId}/tables`).then(r => r.ok ? r.json() : []).catch(() => [])
        );
    }

    const results = await Promise.all(fetchPromises);
    const freshDocs = results[0];
    if (freshDocs && freshDocs.length > 0) {
        docs = freshDocs;
        window.__cachedDocsList = docs;
        try { localStorage.setItem('sipedas_docs_cache', JSON.stringify(docs)); } catch (e) {}
    }

    if (viewState.selectedDocId) {
        const tocData = results[1] || [];
        preloadedTables = results[2] || [];
        tocData.forEach(item => {

                    // Cari pola "Bab" diikuti angka biasa atau romawi

                    const match = item.title.match(/Bab\s+(\d+|[IVXLCDM]+)(?:\s*[\-\–\—\.\:]\s*(.*))?/i);

                    if (match) {

                        const rawNum = match[1];

                        let num = parseInt(rawNum, 10);

                        if (isNaN(num)) {

                            num = romanToInt(rawNum) || rawNum;

                        }

                        let name = match[2] ? match[2].trim() : "";

                        

                        // Jika match[2] kosong tetapi ada tanda "-" di string asli, coba pecah manual

                        if (!name && item.title.includes("-")) {

                            const parts = item.title.split("-");

                            if (parts.length > 1) {

                                name = parts.slice(1).join("-").trim();

                            }

                        }

                        

                        docChapters[num] = name;
                    }
                });
            }



    const STANDARD_BPS_CHAPTERS = {

        1: "Geografi dan Iklim",

        2: "Pemerintahan",

        3: "Penduduk dan Ketenagakerjaan",

        4: "Sosial dan Kesejahteraan Rakyat",

        5: "Pertanian, Kehutanan, dan Perikanan",

        6: "Industri, Pertambangan, Energi, dan Air",

        7: "Pariwisata",

        8: "Transportasi dan Komunikasi",

        9: "Koperasi dan Usaha Mikro Kecil Menengah (UMKM)",

        10: "Pengeluaran dan Konsumsi Penduduk",

        11: "Perdagangan",

        12: "Pendapatan Regional",

        13: "Perbandingan Regional / Antar Wilayah"

    };



    const getChapterTitle = (num) => {
        if (docChapters && docChapters[num]) return docChapters[num];
        if (STANDARD_BPS_CHAPTERS[num]) return STANDARD_BPS_CHAPTERS[num];
        return "";
    };

    window.__documentsList = docs;
    window.__getChapterTitle = getChapterTitle;
    if (typeof updateSearchScopeIndicator === 'function') {
        updateSearchScopeIndicator();
    }



    // ===================== NAV BAR: Breadcrumb + Action Buttons =====================

    const navBar = document.createElement("div");

    navBar.className = "doc-breadcrumb";

    navBar.style.marginBottom = "1rem";

    navBar.style.fontSize = "0.95rem";

    navBar.style.padding = "0.75rem 1.25rem";

    navBar.style.borderRadius = "8px";

    navBar.style.background = "var(--bg-page, #f8fafc)";

    navBar.style.border = "1px solid var(--border, #e2e8f0)";

    navBar.style.display = "flex";

    navBar.style.justifyContent = "space-between";

    navBar.style.alignItems = "center";

    navBar.style.gap = "12px";

    navBar.style.flexWrap = "wrap";

    

    // KIRI: Breadcrumb links

    const bcLeft = document.createElement("div");

    bcLeft.style.display = "flex";

    bcLeft.style.alignItems = "center";

    bcLeft.style.gap = "8px";

    bcLeft.style.flexWrap = "wrap";

    

    let bcHTML = `<span class="doc-bc-link d-inline-flex align-items-center" style="cursor:pointer; color:var(--info, #2563eb); font-weight:600; padding:4px 8px; border-radius:6px;" onclick="viewState.selectedDocId=null; viewState.selectedBabNum=null; populateDocumentList();"><i class="bi bi-folder2 me-2 fs-6"></i> Semua Dokumen</span>`;

    

    const doc = docs.find(d => d.id === viewState.selectedDocId);

    if (viewState.selectedDocId && doc) {

        const pubLabel = doc.year ? `Publikasi ${doc.year}` : doc.filename;

        bcHTML += `<span style="color:#94a3b8;">/</span><span class="doc-bc-link" style="cursor:pointer; color:var(--info, #2563eb); font-weight:600; padding:4px 8px; border-radius:6px;" onclick="viewState.selectedBabNum=null; populateDocumentList();">${pubLabel}</span>`;

        if (viewState.selectedBabNum !== null) {

            const chapterTitle = getChapterTitle(viewState.selectedBabNum);

            const chapterSuffix = chapterTitle ? ` - ${chapterTitle}` : "";

            bcHTML += `<span style="color:#94a3b8;">/</span><span class="doc-bc-active" style="font-weight:600; padding:4px 8px;">Bab ${viewState.selectedBabNum}${chapterSuffix}</span>`;

        }

    }

    bcLeft.innerHTML = bcHTML;

    navBar.appendChild(bcLeft);

    

    // KANAN: Action buttons

    const bcRight = document.createElement("div");

    bcRight.style.display = "flex";

    bcRight.style.alignItems = "center";

    bcRight.style.gap = "8px";

    bcRight.style.flexWrap = "wrap";

    

    // Tombol "Tambah Tabel Baru" — cerdas auto-detect context

    let addTableOnclick = "openCreateTableModal()";

    let addTableLabel = '<i class="bi bi-plus-circle-fill"></i> Tambah Tabel Baru';

    if (viewState.selectedDocId && doc && viewState.selectedBabNum !== null) {

        addTableOnclick = `openCreateTableModal(${viewState.selectedDocId}, ${viewState.selectedBabNum})`;

        addTableLabel = '<i class="bi bi-plus-circle-fill"></i> Tambah Tabel';

    } else if (viewState.selectedDocId && doc) {

        addTableOnclick = `openCreateTableModal(${viewState.selectedDocId})`;

        addTableLabel = '<i class="bi bi-plus-circle-fill"></i> Tambah Tabel';

    }

    

    bcRight.innerHTML = `

        <button onclick="${addTableOnclick}" class="btn btn-sm fw-semibold px-3 py-1.5 rounded-3 d-inline-flex align-items-center gap-1.5 shadow-sm" style="background:#059669; border-color:#059669; color:white;">

            ${addTableLabel}

        </button>

        <button onclick="openCreateDocModal()" class="btn btn-sm btn-outline-primary fw-semibold px-3 py-1.5 rounded-3 d-inline-flex align-items-center gap-1.5">

            <i class="bi bi-journal-plus"></i> Publikasi Baru

        </button>

    `;

    

    // Tombol "Hapus" — hanya muncul saat di dalam doc/bab

    if (viewState.selectedDocId && doc) {

        if (viewState.selectedBabNum !== null) {

            bcRight.innerHTML += `

                <button onclick="deleteAllTablesForBab(${doc.id}, ${viewState.selectedBabNum})" class="btn btn-sm btn-outline-danger fw-semibold px-3 py-1.5 rounded-3 d-inline-flex align-items-center gap-1.5">

                    <i class="bi bi-trash"></i> Hapus Tabel Bab

                </button>

            `;

        } else {

            bcRight.innerHTML += `

                <button onclick="deleteAllTablesForDoc(${doc.id}, '${doc.filename.replace(/'/g, "\\'")}')" class="btn btn-sm btn-outline-danger fw-semibold px-3 py-1.5 rounded-3 d-inline-flex align-items-center gap-1.5">

                    <i class="bi bi-trash"></i> Hapus Semua

                </button>

            `;

        }

    }

    

    navBar.appendChild(bcRight);

    container.appendChild(navBar);

    

    if (!viewState.selectedDocId) {

        // LEVEL 1: Tampilkan Grid Dokumen

        const grid = document.createElement("div");

        grid.style.display = "grid";

        grid.style.gridTemplateColumns = "repeat(auto-fill, minmax(320px, 1fr))";

        grid.style.gap = "1.5rem";

        

        for (const d of docs) {

            if(d.status === 'ready' || d.status.startsWith('extracting') || d.status.startsWith('done')) {

                const card = document.createElement("div");

                card.className = "doc-folder-card";

                card.style.borderRadius = "16px";

                card.style.padding = "2rem 1.5rem";

                card.style.cursor = "pointer";

                card.style.position = "relative";

                card.style.display = "flex";

                card.style.flexDirection = "column";

                card.style.justifyContent = "space-between";

                card.style.alignItems = "center";

                card.onclick = () => {
                    showLoadingModal("Membuka Publikasi...", "Memuat bab dan daftar tabel publikasi...");
                    viewState.selectedDocId = d.id;
                    populateDocumentList().finally(() => hideLoadingModal());
                };

                let loadingBadge = '';

                if (d.status.startsWith('extracting')) {

                    loadingBadge = `

                        <div style="position:absolute; top:15px; right:15px; display:flex; align-items:center; gap:6px; background:#fffbeb; color:#b45309; padding:4px 10px; border-radius:20px; font-size:0.8rem; font-weight:700; border:1px solid #fcd34d; box-shadow:0 2px 4px rgba(0,0,0,0.05);">

                            <div style="width:12px; height:12px; border:2px solid #fcd34d; border-top-color:#b45309; border-radius:50%; animation:spin 1s linear infinite;"></div>

                            <style>@keyframes spin { 100% { transform: rotate(360deg); } }</style>

                            Mengekstrak...

                        </div>`;

                }

                

                const pubTitle = d.year ? `Publikasi ${d.year}` : d.filename;

                const tableBadge = d.table_count !== undefined 

                    ? `<span style="color:var(--info, #2563eb); font-weight:600; font-size:0.78rem; background:#eff6ff; border:1px solid #bfdbfe; padding:3px 8px; border-radius:20px; white-space:nowrap;">${d.table_count} Tabel</span>` 

                    : '';



                card.innerHTML = `

                    ${loadingBadge}

                    <div style="text-align:center; width:100%;">

                        <div class="doc-icon-wrapper"><i class="bi bi-folder2-open text-primary" style="font-size:2rem;"></i></div>

                        <h3 class="doc-card-title" style="margin:0 0 0.6rem 0; font-size:1.25rem; font-weight:700; word-break:break-word; line-height:1.4;">${pubTitle}</h3>

                    </div>

                    <div style="display:flex; justify-content:center; align-items:center; gap:5px; flex-wrap:nowrap; margin-top:12px; width:100%;">

                        <span class="doc-card-badge" style="font-size:0.78rem; padding:3px 8px; border-radius:20px; font-weight:600; background:#e0e7ff; color:#3730a3; white-space:nowrap;">Publikasi ${d.year || '-'}</span>

                        <span class="doc-card-badge" style="font-size:0.78rem; padding:3px 8px; border-radius:20px; font-weight:600; background:#f1f5f9; color:#334155; white-space:nowrap;">Data ${d.year ? d.year - 1 : '-'}</span>

                        ${tableBadge}

                    </div>

                `;

                grid.appendChild(card);

            }

        }

        if (grid.children.length === 0) {

            grid.innerHTML = `<p style="color:var(--text-secondary, #64748b); font-style:italic;">Belum ada dokumen yang siap dilihat.</p>`;

        }

        container.appendChild(grid);

    } 

    else {

        const d = docs.find(doc => doc.id === viewState.selectedDocId);

        if (!d) {

            viewState.selectedDocId = null;

            return populateDocumentList();

        }

        

        let tables = preloadedTables;
        if (!tables) {
            const loadingDiv = document.createElement("div");
            loadingDiv.id = "tables-loading-spinner";
            loadingDiv.style.textAlign = "center";
            loadingDiv.style.padding = "4rem 2rem";
            loadingDiv.innerHTML = `
                <div class="spinner-border text-primary" role="status" style="width:2.5rem; height:2.5rem; border-width: 0.22em;">
                    <span class="visually-hidden">Loading...</span>
                </div>
                <div class="text-muted small mt-3" style="font-weight:500; letter-spacing: 0.5px;">Memuat daftar tabel...</div>
            `;
            container.appendChild(loadingDiv);

            const tRes = await fetch(`${API_BASE}/documents/${d.id}/tables`);
            tables = await tRes.json();
            loadingDiv.remove();
        }

        

        if (d.status.startsWith('extracting')) {

            const loadingBanner = document.createElement("div");

            loadingBanner.style.background = "var(--warning-light, #fffbeb)";

            loadingBanner.style.border = "1px solid #fcd34d";

            loadingBanner.style.color = "var(--warning-dark, #b45309)";

            loadingBanner.style.padding = "0.75rem 1rem";

            loadingBanner.style.borderRadius = "8px";

            loadingBanner.style.marginBottom = "1.5rem";

            loadingBanner.style.display = "flex";

            loadingBanner.style.alignItems = "center";

            loadingBanner.style.gap = "10px";

            loadingBanner.innerHTML = `

                <div style="width:16px; height:16px; border:2px solid #fcd34d; border-top-color:#b45309; border-radius:50%; animation:spin 1s linear infinite;"></div>

                <style>@keyframes spin { 100% { transform: rotate(360deg); } }</style>

                <span style="font-size:0.95rem; font-weight:500;">Sistem sedang mengekstrak halaman PDF di latar belakang. Anda tetap dapat membuka dan melihat tabel yang sudah ada!</span>

            `;

            container.appendChild(loadingBanner);

        }

        

        if (tables.length === 0) {

            let msg = d.status.startsWith('extracting') ? "Mohon tunggu sebentar, tabel pertama sedang diekstrak..." : "Belum ada tabel yang berhasil diekstrak.";

            const emptyDiv = document.createElement("div");

            emptyDiv.style.textAlign = "center";

            emptyDiv.style.padding = "3rem";

            emptyDiv.className = "doc-empty-state";

            emptyDiv.style.borderRadius = "12px";

            emptyDiv.innerHTML = `<p style="font-style:italic; font-size:1.1rem; margin:0;">${msg}</p>`;

            container.appendChild(emptyDiv);

            return;

        }

        

        // Group tables by Bab

        const grouped = {};

        tables.forEach(t => {

            const match = t.table_name.match(/Tabel[\s_]*(\d+)/i);

            let babName = "Lainnya";

            let babNum = 999;

            if (match && match[1]) {

                babNum = parseInt(match[1], 10);

                const chapterTitle = getChapterTitle(babNum);

                const chapterSuffix = chapterTitle ? ` - ${chapterTitle}` : "";

                babName = `Bab ${babNum}${chapterSuffix}`;

            }

            if (!grouped[babNum]) grouped[babNum] = { name: babName, num: babNum, tables: [] };

            grouped[babNum].tables.push(t);

        });

        

        if (viewState.selectedBabNum === null) {

            // LEVEL 2: Tampilkan Grid Bab

            const grid = document.createElement("div");

            grid.style.display = "grid";

            grid.style.gridTemplateColumns = "repeat(auto-fill, minmax(280px, 1fr))";

            grid.style.gap = "1.5rem";

            

            const sortedBabs = Object.values(grouped).sort((a, b) => a.num - b.num);

            sortedBabs.forEach(bab => {

                const card = document.createElement("div");

                card.className = "doc-chapter-card";

                card.style.borderRadius = "16px";

                card.style.padding = "1.75rem 1.5rem";

                card.style.cursor = "pointer";

                

                card.onclick = (e) => {
                    if(e.target.tagName.toLowerCase() === 'button') return;
                    showLoadingModal("Membuka Bab...", `Menyiapkan daftar tabel ${bab.name}...`);
                    viewState.selectedBabNum = bab.num;
                    populateDocumentList().finally(() => hideLoadingModal());
                };

                

                let cardHTML = `

                    <div class="doc-icon-wrapper"><i class="bi bi-collection text-primary" style="font-size:1.8rem;"></i></div>

                    <h4 class="doc-card-title" style="margin:0 0 0.75rem 0; font-size:1.15rem; font-weight:700; text-align:center; line-height:1.4;">${bab.name}</h4>

                    <p class="doc-card-subtitle" style="margin:0 0 1.25rem 0; text-align:center; font-size:0.9rem; font-weight:500;">${bab.tables.length} Tabel</p>

                `;

                

                const deleteBtn = `<div style="text-align:center;"><button style="background:transparent; border:1px solid #ef4444; color:#ef4444; padding:6px 16px; font-size:0.8rem; border-radius:20px; font-weight:600; cursor:pointer; transition:all 0.2s;" onclick="deleteBab(${d.id}, ${bab.num}, '${bab.name}')" onmouseenter="this.style.background=cssVar('--danger') || '#ef4444'; this.style.color='white'" onmouseleave="this.style.background='transparent'; this.style.color=cssVar('--danger') || '#ef4444'">Hapus Bab</button></div>`;

                

                card.innerHTML = cardHTML + deleteBtn;

                grid.appendChild(card);

            });

            container.appendChild(grid);

            

        } else {

            // LEVEL 3: Tampilkan Daftar Tabel

            const bab = grouped[viewState.selectedBabNum];

            if (!bab) {

                viewState.selectedBabNum = null;

                return populateDocumentList();

            }

            

            const tableListWrapper = document.createElement("div");

            tableListWrapper.className = "doc-table-list-wrapper";

            tableListWrapper.style.borderRadius = "12px";

            tableListWrapper.style.overflow = "hidden";

            

            const ul = document.createElement("ul");

            ul.style.listStyle = "none";

            ul.style.padding = "0";

            ul.style.margin = "0";

            

            bab.tables.sort((a, b) => {

                const numA = a.table_name.match(/(\d+\.\d+\.\d+)/);

                const numB = b.table_name.match(/(\d+\.\d+\.\d+)/);

                if (numA && numB) return numA[1].localeCompare(numB[1], undefined, {numeric: true});

                return a.table_name.localeCompare(b.table_name);

            });

            

            bab.tables.forEach((t, index) => {

                const li = document.createElement("li");

                li.className = "doc-table-list-item";

                li.style.display = "flex";

                li.style.justifyContent = "space-between";

                li.style.alignItems = "center";

                li.style.padding = "1.25rem 1.5rem";

                li.style.borderBottom = index !== bab.tables.length - 1 ? "1px solid #f1f5f9" : "none";

                li.style.transition = "background-color 0.2s ease";

                

                let displayName = formatCleanTableName(t.table_name);

                let displayNum = "";

                let displayNameOnly = displayName;

                const numMatch = displayName.match(/^(Tabel[\s_]*\d+(?:\.\d+)*\s*|^\d+(?:\.\d+)+\s*)/i);

                if (numMatch) {

                    displayNum = numMatch[1].trim();

                    displayNameOnly = displayName.substring(numMatch[0].length).trim();

                }



                const hasDb = t.has_db_data;

                const dbButtonHtml = hasDb

                    ? `<button onclick="viewDataEditor(${t.id}, '${t.table_name.replace(/'/g, "\\'")}')" class="btn btn-sm btn-success" style="font-weight:600; font-size:0.72rem; padding:4px 8px; border-radius:6px;">Lihat DB</button>`

                    : `<button class="btn btn-sm btn-outline-secondary" disabled style="font-weight:500; font-size:0.72rem; padding:4px 8px; border-radius:6px; opacity:0.5; cursor:not-allowed;" title="Data belum ada di database.">Lihat DB (Kosong)</button>`;



                li.innerHTML = `
                    <div style="display:flex; flex-direction:column; flex: 1; padding-right: 15px; overflow-wrap: break-word; word-wrap: break-word;">
                        <div class="doc-card-title d-flex align-items-center flex-wrap" style="line-height: 1.5; white-space: normal;">
                            ${renderCleanTableTitleHtml(t.table_name)}
                        </div>
                    </div>

                    <div style="display:flex; gap:0.45rem; flex-shrink: 0; flex-wrap: wrap; justify-content: flex-end; align-items:center;">

                        <!-- Quick Snippet & Tren -->

                        <button onclick="openTableSnippet(${t.id})" class="btn btn-sm btn-light border" style="font-weight:600; font-size:0.75rem; padding:4px 9px; border-radius:6px; color:var(--info, #0284c7); background:#f0f9ff; border-color:#bae6fd !important; display:inline-flex; align-items:center; gap:4px;" title="Lihat pratinjau ringkas 5 baris">

                            <i class="bi bi-eye me-1"></i> Snippet

                        </button>

                        <button onclick="openTimeSeriesForTable(${t.id}, '${t.table_name.replace(/'/g, "\\'")}')" class="btn btn-sm btn-light border" style="font-weight:600; font-size:0.75rem; padding:4px 9px; border-radius:6px; color:var(--warning, #d97706); background:var(--warning-light, #fffbeb); border-color:#fde68a !important; display:inline-flex; align-items:center; gap:4px;" title="Buka analisis grafik deret waktu">

                            <i class="bi bi-graph-up-arrow"></i> Tren

                        </button>



                        <!-- Tombol Aksi Data Terpisah -->

                        <button onclick="previewCsv(${t.id}, '${t.table_name.replace(/'/g, "\\'")}')" class="btn btn-sm btn-light border" style="font-weight:600; font-size:0.75rem; padding:4px 10px; border-radius:6px; color:var(--text-secondary, #475569); background:#f8fafc; border-color:#cbd5e1 !important; display:inline-flex; align-items:center; gap:4px;" title="Lihat Data Tabel">

                            <i class="bi bi-table me-1"></i> Lihat Data

                        </button>

                        <button onclick="previewCsvEditor(${t.id}, '${t.table_name.replace(/'/g, "\\'")}')" class="btn btn-sm btn-primary" style="font-weight:600; font-size:0.75rem; padding:4px 10px; border-radius:6px; display:inline-flex; align-items:center; gap:4px; box-shadow: 0 1px 2px rgba(79, 70, 229, 0.2);" title="Edit Data Tabel (Tersimpan ke Database)">

                            <i class="bi bi-pencil-square me-1"></i> Edit Data

                        </button>

                        

                        <!-- Hapus -->

                        <button onclick="deleteTable(${t.id})" class="btn btn-sm btn-outline-danger" style="font-weight:600; font-size:0.75rem; padding:4px 8px; border-radius: 6px; display:inline-flex; align-items:center; gap:3px;" title="Hapus Tabel">

                            <i class="bi bi-trash3"></i>

                        </button>

                    </div>

                `;

                ul.appendChild(li);

            });

            

            tableListWrapper.appendChild(ul);

            container.appendChild(tableListWrapper);

        }

    }

}



function deleteTable(tableId) {

    Swal.fire({

        title: 'Hapus Tabel?',

        text: "Anda yakin ingin menghapus tabel ini secara permanen?",

        icon: 'warning',

        showCancelButton: true,

        confirmButtonColor: cssVar('--danger') || cssVar('--danger') || '#ef4444',

        cancelButtonColor: cssVar('--swal-cancel') || cssVar('--text-muted') || '#cbd5e1',

        confirmButtonText: 'Ya, Hapus',

        cancelButtonText: 'Batal',

        showLoaderOnConfirm: true,

        preConfirm: async () => {

            try {

                const res = await fetch(`${API_BASE}/tables/${tableId}`, { method: "DELETE" });

                if (!res.ok) throw new Error("Gagal menghapus");

                await populateDocumentList();

            } catch (error) {

                Swal.showValidationMessage(`Request failed: ${error}`);

            }

        },

        allowOutsideClick: () => !Swal.isLoading()

    }).then((result) => {

        if (result.isConfirmed) {

            Swal.fire('Terhapus!', 'Tabel berhasil dihapus.', 'success');

        }

    });

}



async function loadToDatabase(tableId) {

    if(!tableId) return;

    

    Swal.fire({

        title: 'Memuat Data',

        text: 'Membaca CSV dan mendeteksi anomali...',

        allowOutsideClick: false,

        didOpen: () => {

            Swal.showLoading();

        }

    });

    

    try {

        const res = await fetch(`${API_BASE}/tables/${tableId}/load`, { method: "POST" });

        if (res.ok) {

            Swal.close();

            viewDataEditor(tableId);

        } else {

            showToast("error", "Gagal", "Gagal memuat data");

        }

    } catch (e) {

        showToast("error", "Error", e.message);

    }

    

    loadDashboardStats();

}



async function viewDataEditor(tableId, tableName = "") {

    if(!tableId) { showToast("warning", "Peringatan", "Pilih tabel dulu!"); return; }

    navigateToEditor(tableId, tableName, 'db');

    buildEditorToolbar(tableId, tableName, 'db');

    await _loadDbIntoEditor(tableId, tableName);

}



async function _loadDbIntoEditor(tableId, tableName) {

    const thead = document.getElementById("data-grid-head");

    const tbody = document.getElementById("data-grid-body");

    thead.innerHTML = "<tr><th colspan='20' style='color:var(--text-secondary, #64748b);'>Memuat data dari database...</th></tr>";
    tbody.innerHTML = "";

    showLoadingModal("Membuka Data Tabel...", "Memuat data baris dan struktur kolom...");

    try {
        const res = await fetch(`${API_BASE}/tables/${tableId}/data`);

        const payload = await res.json();

        const rows = payload.rows || [];

        const headers = (payload.headers && payload.headers.length > 0)

            ? payload.headers

            : (rows.length > 0 ? Object.keys(rows[0].data) : []);

        const units = payload.units || [];

        const years = payload.years || [];



        thead.innerHTML = ""; tbody.innerHTML = "";



        if (rows.length === 0) {

            thead.innerHTML = "<tr><th>—</th></tr>";

            tbody.innerHTML = `<tr><td style='color:var(--text-secondary, #64748b); padding:2rem; text-align:center;'>Belum ada data di database. Gunakan tombol <b>Load CSV</b> terlebih dahulu dari halaman Daftar Tabel.</td></tr>`;

            return;

        }



        const formattedHeaders = headers.map((h, idx) => {

            let displayHeader = h.replace(/\.\d+$/, ''); // Strip pandas duplicate suffix (.1)

            

            const unit = units[idx] ? units[idx].trim() : "";

            const year = years[idx] ? years[idx].trim() : "";

            

            const skipUnit = !unit || unit === "-" || unit.toLowerCase() === "satuan";

            const skipYear = !year || year === "-" || year.toLowerCase() === "tahun";

            if (!skipUnit || !skipYear) {

                let suffix = "";

                if (!skipUnit) suffix += unit;

                if (!skipYear) suffix += suffix ? `, ${year}` : year;

                if (suffix) displayHeader += ` (${suffix})`;

            }

            return `<th>${displayHeader}</th>`;

        }).join("");



        thead.innerHTML = `<tr><th>Aksi</th>${formattedHeaders}</tr>`;



        rows.forEach(row => {

            const tr = document.createElement("tr");

            tr.id = `row-${row.id}`;

            if(row.is_anomaly) tr.classList.add("row-anomaly");



            const safeBtn = row.is_anomaly 

                ? `<button onclick="markRowSafe(${row.id}, ${tableId}, '${tableName.replace(/'/g, "\\'")}')" class="btn-row-safe" style="background:var(--success, #10b981); border:1px solid var(--success, #10b981); color:white; padding:3px 6px; border-radius:4px; font-size:0.75rem; cursor:pointer; margin-left:4px; font-weight:600;">Aman</button>`

                : '';

            let html = `<td><div class="row-action-cell"><button onclick="deleteRow(${row.id})" class="btn-row-del">Hapus</button>${safeBtn}</div></td>`;

            headers.forEach((h, idx) => {

                let val = row.data[h] != null ? row.data[h] : "";

                if (idx === 0) val = normalizeEntityName(val);

                html += `<td class="editable-cell" contenteditable="true" onblur="updateCell(${row.id}, '${h}', this.innerText)" onkeydown="if(event.key === 'Enter') { event.preventDefault(); this.blur(); }">${val}</td>`;

            });



            tr.innerHTML = html;
            tbody.appendChild(tr);
        });
    } catch(err) {
        thead.innerHTML = `<tr><th style="color:red">Error: ${err.message}</th></tr>`;
    } finally {
        hideLoadingModal();
    }
}



async function addDbRow(tableId, tableName) {

    try {

        const res = await fetch(`${API_BASE}/tables/${tableId}/csv/row`, { method: "POST" });

        if (res.ok) {

            // Re-load CSV into DB

            await fetch(`${API_BASE}/tables/${tableId}/load`, { method: "POST" });

            await _loadDbIntoEditor(tableId, tableName);

        } else {

            showToast("error", "Gagal", "Gagal menambah baris");

        }

    } catch(e) {

        showToast("error", "Error", e.message);

    }

}



async function addDbColumn(tableId, tableName) {

    // Use the same column add flow as CSV mode, then reload DB view

    const origState = { ...editorState };

    await addCsvColumn(tableId, tableName);

    // addCsvColumn calls previewCsv at the end; we need to re-enter DB mode

    editorState = origState;

    editorState.mode = 'db';

}



async function updateCell(rowId, column, newValue) {

    const tr = document.getElementById(`row-${rowId}`);

    if (!tr) return;

    const headers = Array.from(document.getElementById("data-grid-head").querySelector("tr").children).slice(1).map(th => th.innerText);

    const cells = Array.from(tr.children).slice(1);

    

    const newData = {};

    headers.forEach((h, idx) => { newData[h] = cells[idx].innerText; });



    await fetch(`${API_BASE}/data/${rowId}`, {

        method: "PUT",

        headers: { "Content-Type": "application/json" },

        body: JSON.stringify({ data: newData })

    });

    // Can optionally re-fetch to see if anomaly status changed, but for speed we just save.

}



function deleteRow(rowId) {

    Swal.fire({

        title: 'Hapus Baris?',

        icon: 'warning',

        showCancelButton: true,

        confirmButtonColor: cssVar('--danger') || cssVar('--danger') || '#ef4444',

        cancelButtonColor: cssVar('--swal-cancel') || cssVar('--text-muted') || '#cbd5e1',

        confirmButtonText: 'Ya, Hapus',

        cancelButtonText: 'Batal',

        showLoaderOnConfirm: true,

        preConfirm: async () => {

            try {

                const res = await fetch(`${API_BASE}/data/${rowId}`, { method: "DELETE" });

                if (!res.ok) throw new Error("Gagal");

                document.getElementById(`row-${rowId}`).remove();

                await loadDashboardStats();

            } catch (error) {

                Swal.showValidationMessage(`Gagal menghapus: ${error}`);

            }

        },

        allowOutsideClick: () => !Swal.isLoading()

    });

}



async function markRowSafe(rowId, tableId, tableName) {

    try {

        const res = await fetch(`${API_BASE}/data/${rowId}/safe`, { method: "PUT" });

        if (res.ok) {

            const tr = document.getElementById(`row-${rowId}`);

            if (tr) {

                tr.classList.remove("row-anomaly");

                // Hapus tombol Aman dari kolom Aksi

                const safeBtn = tr.querySelector(".btn-row-safe");

                if (safeBtn) safeBtn.remove();

            }

            await loadDashboardStats();

            showToast('success', 'Tandai Aman', 'Baris ini sudah ditandai aman (bukan anomali) dan disimpan.', 2000);

        } else {

            showToast("error", "Gagal", "Gagal menandai baris aman");

        }

    } catch (e) {

        showToast("error", "Error", e.message);

    }

}



async function markAllSafeInTable(tableId, tableName) {

    Swal.fire({

        title: 'Tandai Semua Aman?',

        text: "Seluruh baris berstatus anomali pada tabel ini akan ditandai aman.",

        icon: 'question',

        showCancelButton: true,

        confirmButtonColor: cssVar('--success') || cssVar('--success-emerald') || '#10b981',

        cancelButtonColor: cssVar('--swal-cancel') || cssVar('--text-muted') || '#cbd5e1',

        confirmButtonText: 'Ya, Tandai Semua Aman',

        cancelButtonText: 'Batal'

    }).then(async (result) => {

        if (result.isConfirmed) {

            try {

                const res = await fetch(`${API_BASE}/tables/${tableId}/safe-all`, { method: "PUT" });

                if (res.ok) {

                    showToast('success', 'Berhasil!', 'Semua data tabel telah ditandai aman.');

                    _loadDbIntoEditor(tableId, tableName);

                    loadDashboardStats();

                } else {

                    showToast('error', 'Gagal', 'Gagal memproses permintaan.');

                }

            } catch(e) {

                showToast('error', 'Error', e.message);

            }

        }

    });

}





// --- AUTO REFRESH POLLING ---

let previousDocsForPolling = [];



async function pollStatus() {

    try {

        const res = await fetch(`${API_BASE}/documents`, { cache: "no-store" });

        if (!res.ok) return;

        const currentDocs = await res.json();

        

        let hasChanged = false;

        

        if (currentDocs.length !== previousDocsForPolling.length) {

            hasChanged = true;

        } else {

            for (const cur of currentDocs) {

                const prev = previousDocsForPolling.find(p => p.id === cur.id);

                if (!prev || prev.status !== cur.status) {

                    hasChanged = true;

                    break;

                }

            }

        }

        

        if (hasChanged) {

            previousDocsForPolling = currentDocs;

            

            const isPublikasiActive = document.getElementById('page-publikasi').classList.contains('active');

            const isTabelActive = document.getElementById('page-tabel').classList.contains('active');

            const isDashboardActive = document.getElementById('page-dashboard').classList.contains('active');

            

            if (isPublikasiActive) loadDocuments();

            if (isTabelActive) populateDocumentList();

            if (isDashboardActive) loadDashboardStats();

        }

    } catch(e) {

        // Silently ignore network errors during polling

    }

}



// Start polling every 5 seconds to auto-refresh UI when extraction finishes

setInterval(pollStatus, 5000);

// Initialize the cache on load

fetch(`${API_BASE}/documents`, { cache: "no-store" }).then(r=>r.json()).then(d=>previousDocsForPolling = d).catch(e=>{});





function downloadExcel(tableId) {

    window.location.href = `${API_BASE}/tables/${tableId}/excel`;

}



function downloadCsv(tableId) {

    window.location.href = `${API_BASE}/tables/${tableId}/csv`;

}



/** Mode Lihat CSV: read-only, tidak bisa edit */

async function previewCsv(tableId, tableName, highlightCol) {

    navigateToEditor(tableId, tableName, 'csv-view');

    buildEditorToolbar(tableId, tableName, 'csv-view');

    await _loadCsvIntoEditor(tableId, tableName, false, highlightCol);

}



/** Mode Edit CSV: full CRUD + rename kolom + rename tabel */

async function previewCsvEditor(tableId, tableName) {

    navigateToEditor(tableId, tableName, 'csv-edit');

    buildEditorToolbar(tableId, tableName, 'csv-edit');

    await _loadCsvIntoEditor(tableId, tableName, true);

}



/** Open a table in CSV view mode from anomaly panels / search results / usage modal */

function openTable(tableId) {

    fetch(API_BASE + '/tables/' + tableId)

        .then(function(r) { return r.json(); })

        .then(function(info) {

            previewCsv(tableId, info.table_name || 'Tabel #' + tableId);

        })

        .catch(function() {

            previewCsv(tableId, 'Tabel #' + tableId);

        });

}



/** Open a table in CSV edit mode from search results */

function openTableForEdit(tableId) {

    fetch(API_BASE + '/tables/' + tableId)

        .then(function(r) { return r.json(); })

        .then(function(info) {

            previewCsvEditor(tableId, info.table_name || 'Tabel #' + tableId);

        })

        .catch(function() {

            previewCsvEditor(tableId, 'Tabel #' + tableId);

        });

}



/**

 * Load CSV into the editor grid.

 * @param {boolean} isEditable - true = edit mode (CRUD), false = view mode (read-only)

 */

async function _loadCsvIntoEditor(tableId, tableName, isEditable = false, highlightCol) {

    // Reset col-delete-bar

    const colBar = document.getElementById("col-delete-bar");

    const colBarBtns = document.getElementById("col-delete-bar-buttons");

    if (colBar) { colBar.classList.remove('visible'); if(colBarBtns) colBarBtns.innerHTML = ""; }



    const thead = document.getElementById("data-grid-head");

    const tbody = document.getElementById("data-grid-body");

    thead.innerHTML = "<tr><th colspan='20' style='color:var(--text-secondary, #64748b); padding:1.25rem; text-align:center; font-weight:500;'><span class='spinner-border spinner-border-sm text-primary me-2' role='status'></span>Memuat Data Tabel...</th></tr>";

    tbody.innerHTML = "";

    

    try {

        const res = await fetch(`${API_BASE}/tables/${tableId}/csv_preview`);

        if (!res.ok) throw new Error("Gagal mengambil preview CSV");



        const data = await res.json();

        await checkColumnAnomalies(tableId);



        if (data.headers && data.headers.length > 0) {

            if (isEditable) {

                // Edit mode: header menampilkan tiga baris input (Nama, Satuan, Tahun) secara terpisah & rapi

                thead.innerHTML = `<tr>

                    <th class="th-action-col" style="vertical-align: middle; text-align: center;">Aksi Baris</th>

                    ${data.headers.map((h, idx) => {

                        const unit = data.units && data.units[idx] ? data.units[idx] : "";

                        const year = data.years && data.years[idx] ? data.years[idx] : "";

                        var anomalyInfo = getAnomalyInfo(idx);

                        var isAnom = anomalyInfo !== undefined;

                        

                        return `

                        <th class="editable-header-wrapper" style="min-width: 170px; padding: 0.75rem 0.5rem; text-align: left; border-bottom: 2px solid var(--swal-cancel, #cbd5e1); background: var(--bg-page, #f8fafc);">

                            <div style="margin-bottom: 6px;">

                                <label style="font-size: 0.68rem; font-weight: 700; color: #64748b; display: block; margin-bottom: 2px;">NAMA KOLOM</label>

                                <input type="text" class="header-name-input" value="${h}" onchange="onHeaderNameChange(${idx}, this.value)" style="width: 100%; padding: 4px 6px; font-size: 0.8rem; font-weight: 600; border-radius: 4px; border: 1px solid var(--swal-cancel, #cbd5e1); outline:none; font-family: 'Inter', sans-serif;">

                            </div>

                            <div style="display: flex; gap: 4px; margin-bottom: 8px;">

                                <div style="flex: 1;">

                                    <label style="font-size: 0.65rem; font-weight: 700; color: #64748b; display: block; margin-bottom: 2px;">SATUAN</label>

                                    <input type="text" class="header-unit-input" value="${unit}" onchange="updateCsvUnitLocal(${idx}, this.value)" placeholder="e.g. Jiwa" style="width: 100%; padding: 3px 6px; font-size: 0.75rem; border-radius: 4px; border: 1px solid var(--swal-cancel, #cbd5e1); outline:none; font-family: 'Inter', sans-serif; background: white;">

                                </div>

                                <div style="width: 65px;">

                                    <label style="font-size: 0.65rem; font-weight: 700; color: #64748b; display: block; margin-bottom: 2px;">TAHUN</label>

                                    <input type="text" class="header-year-input" value="${year}" onchange="updateCsvYearLocal(${idx}, this.value)" placeholder="e.g. 2025" style="width: 100%; padding: 3px 6px; font-size: 0.75rem; border-radius: 4px; border: 1px solid var(--swal-cancel, #cbd5e1); outline:none; font-family: 'Inter', sans-serif; background: white;">

                                </div>

                            </div>

                            <div style="display: flex; gap: 4px; justify-content: center; padding-top: 6px; border-top: 1px dashed var(--border, #e2e8f0);">

                                <button onclick="insertCsvColBelowLocal(${idx})" class="btn-row-insert" style="padding: 3px 8px; font-size: 0.72rem; border-radius: 4px; border: 1px solid var(--swal-cancel, #cbd5e1); background: #f1f5f9; color: #475569; cursor: pointer; transition: all 0.15s;" onmouseenter="this.style.background=cssVar('--border') || '#e2e8f0'; this.style.color=cssVar('--text-primary') || '#1e293b'" onmouseleave="this.style.background=cssVar('--bg-hover') || '#f1f5f9'; this.style.color=cssVar('--text-tertiary') || '#475569'">Sisip</button>

                                <button onclick="deleteCsvColumnLocal(${idx})" class="btn-row-del" style="padding: 3px 8px; font-size: 0.72rem; border-radius: 4px; border: 1px solid #fca5a5; background: var(--danger-light, #fee2e2); color: var(--danger-dark, #b91c1c); cursor: pointer; transition: all 0.15s;" onmouseenter="this.style.background=cssVar('--danger-light-bg') || '#fecaca'; this.style.color=cssVar('--danger-hover') || '#991b1b'" onmouseleave="this.style.background=cssVar('--danger-light') || '#fee2e2'; this.style.color=cssVar('--danger-text') || '#b91c1c'">Hapus</button>

                            </div>

                            ${isAnom ? `

                            <div style="position: absolute; top: 2px; right: 2px; display: flex; gap: 4px; align-items: center; z-index: 10;">

                                <div style="padding: 2px 4px; background: #fef2f2; border: 1px solid #fecaca; border-radius: 4px;" title="Terdeteksi Anomali">

                                    <span style="color:var(--danger, #dc2626); font-size:0.65rem; font-weight:700;">⚠️</span>

                                </div>

                                <button onclick="dismissColumnAnomalyLocal(${tableId}, ${idx}, '${h.replace(/'/g, "\\'")}')" style="background:var(--success, #22c55e); border:1px solid var(--success-hover, #16a34a); color:white; padding:2px 5px; font-size:0.65rem; border-radius:4px; cursor:pointer; font-weight:600; line-height: 1;" title="Tandai Aman">Aman</button>

                            </div>` : ''}

                        </th>`;

                    }).join("")}

                </tr>`;

            } else {

                // View mode: header digabung menjadi "Nama Kolom (Satuan, Tahun)" jika ada metadatanya

                thead.innerHTML = `<tr>${data.headers.map((h, idx) => {

                    const unit = data.units && data.units[idx] ? data.units[idx].trim() : "";

                    const year = data.years && data.years[idx] ? data.years[idx].trim() : "";

                    var anomalyInfo = getAnomalyInfo(idx);

                    var isAnom = anomalyInfo !== undefined;

                    

                    let displayHeader = h;

                    // Tampilkan satuan dan tahun untuk semua kolom yang memilikinya (bukan "-" atau "satuan"/"tahun")

                    const skipUnit = !unit || unit === "-" || unit.toLowerCase() === "satuan";

                    const skipYear = !year || year === "-" || year.toLowerCase() === "tahun";

                    if (!skipUnit || !skipYear) {

                        let suffix = "";

                        if (!skipUnit) suffix += unit;

                        if (!skipYear) suffix += suffix ? `, ${year}` : year;

                        if (suffix) displayHeader += ` (${suffix})`;

                    }

                    

                    return `<th data-col-name="${escHtml(h.toLowerCase())}">${isAnom ? '⚠️ ' : ''}${displayHeader}</th>`;

                }).join("")}</tr>`;

            }

        } else {

            thead.innerHTML = `<tr><th>Data Kosong / Belum ada kolom</th></tr>`;

        }

        

        // Kata kunci untuk mendeteksi baris ringkasan/agregat (kolom pertama)

        const SUMMARY_KEYWORDS = [

            'jumlah', 'total', 'kabupaten', 'tasikmalaya', 'kota', 'provinsi',

            'jawa barat', 'indonesia', 'rata-rata', 'rata rata', 'average',

            'subtotal', 'grand total', 'keseluruhan', 'seluruh'

        ];



        function isSummaryRow(row) {

            if (!row || row.length === 0) return false;

            const firstCell = String(row[0] || '').trim().toLowerCase();

            return SUMMARY_KEYWORDS.some(kw => firstCell.includes(kw));

        }



        if (data.rows && data.rows.length > 0) {

            // Render semua baris langsung ke tabel utama (tidak ada pemisahan summary)

            data.rows.forEach((row, rowIndex) => {

                const tr = document.createElement("tr");

                tr.id = isEditable ? `csv-row-${rowIndex}` : `csv-view-row-${rowIndex}`;



                let html = '';

                if (isEditable) {

                    html = `<td><div class="row-action-cell">

                        <button onclick="insertCsvRowBelowLocal(${rowIndex})" class="btn-row-insert" title="Sisipkan baris baru di bawah baris ini">Sisip</button>

                        <button onclick="deleteCsvRowLocal(${rowIndex})" class="btn-row-del">Hapus</button>

                    </div></td>`;



                    row.forEach((cell, cellIdx) => {

                        let val = cell != null ? cell : "";

                        if (cellIdx === 0) val = normalizeEntityName(val);

                        html += `<td class="editable-cell" contenteditable="true" onkeydown="if(event.key === 'Enter') { event.preventDefault(); this.blur(); }">${val}</td>`;

                    });

                } else {

                    // Read-only cells

                    row.forEach((cell, cellIdx) => {

                        let val = cell != null ? cell : "";

                        if (cellIdx === 0) val = normalizeEntityName(val);

                        html += `<td class="readonly-cell">${val}</td>`;

                    });

                }



                tr.innerHTML = html;

                tbody.appendChild(tr);

            });

        } else {

            const colSpan = data.headers ? (isEditable ? data.headers.length + 1 : data.headers.length) : 1;

            tbody.innerHTML = `<tr><td colspan="${colSpan}" style="text-align:center;color:var(--text-secondary, #64748b);padding:2rem;">Tidak ada baris data.</td></tr>`;

        }

        // === Column highlight: apply when navigated from search results ===
        if (highlightCol && !isEditable) {
            setTimeout(() => {
                const target = highlightCol.toLowerCase().trim();
                if (!target) return;
                const ths = document.querySelectorAll('#data-grid-head th[data-col-name]');
                for (const th of ths) {
                    if (th.getAttribute('data-col-name').includes(target) || target.includes(th.getAttribute('data-col-name'))) {
                        th.classList.add('col-highlight');
                        th.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
                        const colIdx = Array.from(th.parentNode.children).indexOf(th);
                        document.querySelectorAll('#data-grid-body tr').forEach(tr => {
                            const td = tr.children[colIdx];
                            if (td) td.classList.add('col-cell-highlight');
                        });
                        break;
                    }
                }
            }, 150);
        }

    } catch (err) {

        thead.innerHTML = `<tr><th style="color:red">Error: ${err.message}</th></tr>`;

    }

}



/** Rename a CSV column header by clicking on it */

async function renameCsvColumn(tableId, colIndex, tableName) {

    const th = document.querySelector(`#data-grid-head tr th.editable-header:nth-child(${colIndex + 2})`);

    const currentName = th ? th.innerText.replace('✏️¯¸', '').trim() : `Kolom ${colIndex + 1}`;



    const { value: newName } = await Swal.fire({

        title: 'Rename Kolom',

        input: 'text',

        inputLabel: 'Nama Kolom Baru',

        inputValue: currentName,

        inputPlaceholder: 'Masukkan nama kolom baru',

        showCancelButton: true,

        cancelButtonText: 'Batal',

        confirmButtonText: 'Simpan',

        inputValidator: (val) => { if (!val || !val.trim()) return 'Nama kolom tidak boleh kosong!'; }

    });

    if (!newName || newName.trim() === currentName) return;



    try {

        const res = await fetch(`${API_BASE}/tables/${tableId}/csv/rename_column`, {

            method: 'PUT',

            headers: { 'Content-Type': 'application/json' },

            body: JSON.stringify({ col_index: colIndex, new_name: newName.trim() })

        });

        if (res.ok) {

            await _loadCsvIntoEditor(tableId, tableName, true);

        } else {

            const err = await res.json();

            showToast('error', 'Gagal', err.detail || 'Gagal rename kolom');

        }

    } catch(e) {

        showToast('error', 'Error', e.message);

    }

}



/** Rename tabel (judul & nomor) */

async function renameTable(tableId) {

    const currentTitle = document.getElementById('editor-title')?.textContent?.trim() || '';

    const currentNum = document.getElementById('editor-table-number')?.textContent?.trim() || '';



    const { value: formValues } = await Swal.fire({

        title: 'Edit Identitas Tabel',

        html: `

            <div style="text-align: left; margin-bottom: 12px;">

                <label for="swal-table-number" style="font-weight: 600; font-size: 0.9rem; color: #475569; display: block; margin-bottom: 4px;">Nomor Tabel</label>

                <input id="swal-table-number" class="swal2-input" placeholder="Contoh: Tabel 1.1.1" value="${currentNum}" style="margin: 0; width: 100%; box-sizing: border-box;">

            </div>

            <div style="text-align: left;">

                <label for="swal-table-title" style="font-weight: 600; font-size: 0.9rem; color: #475569; display: block; margin-bottom: 4px;">Judul Tabel</label>

                <input id="swal-table-title" class="swal2-input" placeholder="Masukkan judul tabel" value="${currentTitle}" style="margin: 0; width: 100%; box-sizing: border-box;">

            </div>

        `,

        focusConfirm: false,

        showCancelButton: true,

        cancelButtonText: 'Batal',

        confirmButtonText: 'Simpan',

        preConfirm: () => {

            const num = document.getElementById('swal-table-number').value.trim();

            const title = document.getElementById('swal-table-title').value.trim();

            if (!title) {

                Swal.showValidationMessage('Judul tabel tidak boleh kosong!');

                return false;

            }

            return { num, title };

        }

    });



    if (!formValues) return;



    const { num: newNum, title: newTitle } = formValues;

    const fullNewName = newNum ? `${newNum} - ${newTitle}` : newTitle;



    try {

        const res = await fetch(`${API_BASE}/tables/${tableId}/rename`, {

            method: 'PUT',

            headers: { 'Content-Type': 'application/json' },

            body: JSON.stringify({ new_name: fullNewName })

        });

        if (res.ok) {

            // Update UI

            const numEl = document.getElementById('editor-table-number');

            if (numEl) {

                numEl.textContent = newNum;

                numEl.style.display = newNum ? 'inline' : 'none';

            }

            const titleEl = document.getElementById('editor-title');

            if (titleEl) titleEl.textContent = newTitle;

            editorState.tableName = fullNewName;

            showToast('success', 'Berhasil!', 'Identitas tabel berhasil diperbarui.', 1500);

        } else {

            const err = await res.json();

            showToast('error', 'Gagal', err.detail || 'Gagal merubah identitas tabel');

        }

    } catch(e) {

        showToast('error', 'Error', e.message);

    }

}



async function updateCsvRow(tableId, rowIndex) {

    const tr = document.getElementById(`csv-row-${rowIndex}`);

    if (!tr) return;

    

    const cells = Array.from(tr.children).slice(1);

    const newData = cells.map(td => td.innerText);



    try {

        await fetch(`${API_BASE}/tables/${tableId}/csv/row/${rowIndex}`, {

            method: "PUT",

            headers: { "Content-Type": "application/json" },

            body: JSON.stringify({ data: newData })

        });

    } catch(err) {

        console.error("Failed to update CSV row", err);

    }

}



function deleteCsvRow(tableId, rowIndex) {

    Swal.fire({

        title: 'Hapus Baris CSV?',

        icon: 'warning',

        showCancelButton: true,

        confirmButtonColor: cssVar('--danger') || cssVar('--danger') || '#ef4444',

        cancelButtonColor: cssVar('--swal-cancel') || cssVar('--text-muted') || '#cbd5e1',

        confirmButtonText: 'Ya, Hapus',

        cancelButtonText: 'Batal',

        showLoaderOnConfirm: true,

        preConfirm: async () => {

            try {

                const res = await fetch(`${API_BASE}/tables/${tableId}/csv/row/${rowIndex}`, { method: "DELETE" });

                if (!res.ok) throw new Error("Gagal menghapus baris");

                

                document.getElementById(`csv-row-${rowIndex}`).remove();

                

                // Re-index the remaining rows

                const tbody = document.getElementById("data-grid-body");

                Array.from(tbody.children).forEach((tr, newIdx) => {

                    tr.id = `csv-row-${newIdx}`;

                    const delBtn = tr.querySelector(".btn-row-del");

                    const insBtn = tr.querySelector(".btn-row-insert");

                    if(delBtn) delBtn.setAttribute("onclick", `deleteCsvRow(${tableId}, ${newIdx})`);

                    if(insBtn) insBtn.setAttribute("onclick", `insertCsvRowBelow(${tableId}, ${newIdx})`);

                    const cells = Array.from(tr.children).slice(1);

                    cells.forEach(td => td.setAttribute("onblur", `updateCsvRow(${tableId}, ${newIdx})`));

                });

                

            } catch (error) {

                Swal.showValidationMessage(`Gagal menghapus: ${error}`);

            }

        },

        allowOutsideClick: () => !Swal.isLoading()

    });

}



async function addCsvRow(tableId, tableName) {

    try {

        const res = await fetch(`${API_BASE}/tables/${tableId}/csv/row`, { method: "POST" });

        if(res.ok) {

            await _loadCsvIntoEditor(tableId, tableName);

        } else {

            showToast("error", "Gagal", "Gagal menambah baris");

        }

    } catch(e) {

        showToast("error", "Error", e.message);

    }

}



async function insertCsvRowBelow(tableId, rowIndex) {

    try {

        // rowIndex is 0-based data row; API insert_row uses 0-based data row

        const res = await fetch(`${API_BASE}/tables/${tableId}/csv/insert_row/${rowIndex + 1}`, { method: "POST" });

        if (res.ok) {

            await _loadCsvIntoEditor(editorState.tableId, editorState.tableName);

        } else {

            showToast("error", "Gagal", "Gagal menyisipkan baris");

        }

    } catch(e) {

        showToast("error", "Error", e.message);

    }

}



async function addCsvColumn(tableId, tableName) {

    // Step 1: Ask column name

    const { value: colName } = await Swal.fire({

        title: 'Tambah Kolom Baru',

        input: 'text',

        inputLabel: 'Nama Kolom Baru',

        inputPlaceholder: 'Contoh: Status Kecamatan',

        showCancelButton: true,

        cancelButtonText: 'Batal',

        confirmButtonText: 'Lanjut →',

        inputValidator: (value) => {

            if (!value || !value.trim()) return 'Nama kolom tidak boleh kosong!'

        }

    });

    if (!colName) return;



    // Step 2: Ask insert position with current column list

    // Fetch current headers

    let currentHeaders = [];

    try {

        const hRes = await fetch(`${API_BASE}/tables/${tableId}/csv_preview`);

        if (hRes.ok) {

            const hData = await hRes.json();

            currentHeaders = hData.headers || [];

        }

    } catch(e) { /* ignore */ }



    // Build options HTML

    let optionsHtml = `

        <option value="start">Paling Awal (Kolom Pertama)</option>

        ${currentHeaders.map((h, i) => `<option value="after_${i}">Sesudah "${h}"</option>`).join('')}

        ${currentHeaders.map((h, i) => `<option value="before_${i}">Sebelum "${h}"</option>`).join('')}

        <option value="end" selected>Paling Akhir (Kolom Terakhir)</option>

    `;

    // Reorder: start, then after each col, then end

    optionsHtml = `

        <option value="start">Paling Awal</option>

        ${currentHeaders.map((h, i) => `<option value="after_${i}">Sesudah kolom: "${h}"</option>`).join('')}

        <option value="end" selected>Paling Akhir</option>

        ${currentHeaders.map((h, i) => `<option value="before_${i}">Sebelum kolom: "${h}"</option>`).join('')}

    `;



    const { value: posValue } = await Swal.fire({

        title: 'Pilih Posisi Kolom',

        html: `

            <p style="margin-bottom:12px; color:var(--text-secondary, #475569); font-size:0.95rem;">

                Kolom <strong>"${colName}"</strong> akan disisipkan di mana?

            </p>

            <select id="swal-col-position" style="

                width:100%; padding:10px 14px; border-radius:8px;

                border:1.5px solid #cbd5e1; font-size:0.95rem;

                background:#f8fafc; color:#1e293b; cursor:pointer;

                outline:none; appearance:none; -webkit-appearance:none;

            ">

                ${optionsHtml}

            </select>

        `,

        showCancelButton: true,

        cancelButtonText: 'Batal',

        confirmButtonText: 'Sisipkan',

        preConfirm: () => {

            return document.getElementById('swal-col-position').value;

        }

    });

    if (!posValue) return;



    // Resolve position payload

    let positionPayload;

    if (posValue === 'start') {

        positionPayload = 'start';

    } else if (posValue === 'end') {

        positionPayload = 'end';

    } else if (posValue.startsWith('after_')) {

        const idx = parseInt(posValue.replace('after_', ''));

        const targetCol = currentHeaders[idx];

        positionPayload = { after_column: targetCol };

    } else if (posValue.startsWith('before_')) {

        const idx = parseInt(posValue.replace('before_', ''));

        const targetCol = currentHeaders[idx];

        positionPayload = { before_column: targetCol };

    } else {

        positionPayload = 'end';

    }



    try {

        const res = await fetch(`${API_BASE}/tables/${tableId}/csv/column`, { 

            method: "POST",

            headers: { "Content-Type": "application/json" },

            body: JSON.stringify({ column_name: colName.trim(), position: positionPayload })

        });

        if (res.ok) {

            showToast('success', 'Berhasil!', `Kolom "${colName}" berhasil disisipkan.`, 1500);

            await _loadCsvIntoEditor(editorState.tableId, editorState.tableName);

        } else {

            const err = await res.json();

            showToast("error", "Gagal", err.detail || "Gagal menambah kolom");

        }

    } catch(e) {

        showToast("error", "Error", e.message);

    }

}



// --- CLIENT-SIDE ONLY CSV MODIFICATION FUNCTIONS (NO AUTO-SAVE) ---



function isDimensionColumn(header) {

    if (!header) return true;

    const headerLower = header.trim().toLowerCase();

    const dimensionKeywords = [

        "kecamatan", "kabupaten", "desa", "kelurahan", "nomor", "no", "no.", 

        "rincian", "uraian", "kategori", "bulan", "hari", "provinsi", "kota",

        "sex", "jenis kelamin", "dimensi", "nama"

    ];

    if (headerLower === "" || headerLower === "-") return true;

    return dimensionKeywords.some(keyword => headerLower.includes(keyword));

}



function onHeaderNameChange(idx, newName) {

    // No-op: perubahan nama kolom tidak mempengaruhi state satuan/tahun

    // Nilai satuan dan tahun dibaca langsung dari input saat simpan

}



function updateCsvUnitLocal(idx, val) {

    // No-op, values are read directly from inputs when saving

}



function updateCsvYearLocal(idx, val) {

    // No-op, values are read directly from inputs when saving

}



// Menyisipkan baris baru secara lokal ke DOM

function insertCsvRowBelowLocal(rowIndex) {

    const tbody = document.getElementById("data-grid-body");

    const numCols = document.getElementById("data-grid-head").querySelector("tr").children.length - 1;

    const tr = document.createElement("tr");

    

    let html = `<td><div class="row-action-cell">

        <button onclick="insertCsvRowBelowLocal(0)" class="btn-row-insert" title="Sisipkan baris baru di bawah baris ini">Sisip</button>

        <button onclick="deleteCsvRowLocal(0)" class="btn-row-del">Hapus</button>

    </div></td>`;



    for (let i = 0; i < numCols; i++) {

        html += `<td class="editable-cell" contenteditable="true" onkeydown="if(event.key === 'Enter') { event.preventDefault(); this.blur(); }"></td>`;

    }

    

    tr.innerHTML = html;

    

    // Sisipkan setelah baris target

    const targetTr = tbody.children[rowIndex];

    if (targetTr && targetTr.nextSibling) {

        tbody.insertBefore(tr, targetTr.nextSibling);

    } else {

        tbody.appendChild(tr);

    }

    

    reindexLocalRows();

}



// Menghapus baris secara lokal dari DOM

function deleteCsvRowLocal(rowIndex) {

    const tbody = document.getElementById("data-grid-body");

    if (tbody.children[rowIndex]) {

        tbody.children[rowIndex].remove();

        reindexLocalRows();

    }

}



// Menata ulang index baris lokal setelah ada penyisipan atau penghapusan

function reindexLocalRows() {

    const tbody = document.getElementById("data-grid-body");

    Array.from(tbody.children).forEach((tr, idx) => {

        tr.id = `csv-row-${idx}`;

        const insBtn = tr.querySelector(".btn-row-insert");

        const delBtn = tr.querySelector(".btn-row-del");

        if (insBtn) insBtn.setAttribute("onclick", `insertCsvRowBelowLocal(${idx})`);

        if (delBtn) delBtn.setAttribute("onclick", `deleteCsvRowLocal(${idx})`);

    });

}



// Mengganti nama kolom secara lokal

async function renameCsvColumnLocal(colIndex) {

    const th = document.querySelector(`#data-grid-head tr th:nth-child(${colIndex + 2})`);

    const titleContainer = th.querySelector(".editable-header-title");

    const currentName = titleContainer ? titleContainer.innerText.replace('(Edit)', '').trim() : `Kolom ${colIndex + 1}`;



    const { value: newName } = await Swal.fire({

        title: 'Rename Kolom',

        input: 'text',

        inputLabel: 'Nama Kolom Baru',

        inputValue: currentName,

        inputPlaceholder: 'Masukkan nama kolom baru',

        showCancelButton: true,

        cancelButtonText: 'Batal',

        confirmButtonText: 'Simpan',

        inputValidator: (val) => { if (!val || !val.trim()) return 'Nama kolom tidak boleh kosong!'; }

    });

    

    if (newName && newName.trim() !== currentName) {

        titleContainer.innerHTML = `${newName.trim()} <span style="font-size: 0.7rem; color: #6366f1; opacity: 0.8; font-weight: normal; margin-left: 2px;">(Edit)</span>`;

    }

}



// Menyisipkan kolom baru secara lokal ke DOM

async function insertCsvColBelowLocal(colIndex) {

    const { value: colName } = await Swal.fire({

        title: 'Tambah Kolom Baru',

        input: 'text',

        inputLabel: 'Nama Kolom Baru',

        inputPlaceholder: 'Masukkan nama kolom baru',

        showCancelButton: true,

        cancelButtonText: 'Batal',

        confirmButtonText: 'Sisipkan',

        inputValidator: (value) => {

            if (!value || !value.trim()) return 'Nama kolom tidak boleh kosong!'

        }

    });

    if (!colName) return;



    const theadTr = document.getElementById("data-grid-head").querySelector("tr");

    

    // Buat element th baru

    const newTh = document.createElement("th");

    newTh.className = "editable-header-wrapper";

    newTh.style.cssText = "min-width: 170px; padding: 0.75rem 0.5rem; text-align: left; border-bottom: 2px solid var(--swal-cancel, #cbd5e1); background: var(--bg-page, #f8fafc);";

    

    const isDim = false;

    const unitVal = "";

    const yearVal = "";



    newTh.innerHTML = `

        <div style="margin-bottom: 6px;">

            <label style="font-size: 0.68rem; font-weight: 700; color: #64748b; display: block; margin-bottom: 2px;">NAMA KOLOM</label>

            <input type="text" class="header-name-input" value="${colName.trim()}" onchange="onHeaderNameChange(0, this.value)" style="width: 100%; padding: 4px 6px; font-size: 0.8rem; font-weight: 600; border-radius: 4px; border: 1px solid var(--swal-cancel, #cbd5e1); outline:none; font-family: 'Inter', sans-serif;">

        </div>

        <div style="display: flex; gap: 4px; margin-bottom: 8px;">

            <div style="flex: 1;">

                <label style="font-size: 0.65rem; font-weight: 700; color: #64748b; display: block; margin-bottom: 2px;">SATUAN</label>

                <input type="text" class="header-unit-input" value="${unitVal}" onchange="updateCsvUnitLocal(0, this.value)" placeholder="e.g. Jiwa" style="width: 100%; padding: 3px 6px; font-size: 0.75rem; border-radius: 4px; border: 1px solid var(--swal-cancel, #cbd5e1); outline:none; font-family: 'Inter', sans-serif; background: white;">

            </div>

            <div style="width: 65px;">

                <label style="font-size: 0.65rem; font-weight: 700; color: #64748b; display: block; margin-bottom: 2px;">TAHUN</label>

                <input type="text" class="header-year-input" value="${yearVal}" onchange="updateCsvYearLocal(0, this.value)" placeholder="e.g. 2025" style="width: 100%; padding: 3px 6px; font-size: 0.75rem; border-radius: 4px; border: 1px solid var(--swal-cancel, #cbd5e1); outline:none; font-family: 'Inter', sans-serif; background: white;">

            </div>

        </div>

        <div style="display: flex; gap: 4px; justify-content: center; padding-top: 6px; border-top: 1px dashed var(--border, #e2e8f0);">

            <button class="btn-row-insert" style="padding: 3px 8px; font-size: 0.72rem; border-radius: 4px; border: 1px solid var(--swal-cancel, #cbd5e1); background: #f1f5f9; color: #475569; cursor: pointer; transition: all 0.15s;" onmouseenter="this.style.background=cssVar('--border') || '#e2e8f0'; this.style.color=cssVar('--text-primary') || '#1e293b'" onmouseleave="this.style.background=cssVar('--bg-hover') || '#f1f5f9'; this.style.color=cssVar('--text-tertiary') || '#475569'">Sisip</button>

            <button class="btn-row-del" style="padding: 3px 8px; font-size: 0.72rem; border-radius: 4px; border: 1px solid #fca5a5; background: var(--danger-light, #fee2e2); color: var(--danger-dark, #b91c1c); cursor: pointer; transition: all 0.15s;" onmouseenter="this.style.background=cssVar('--danger-light-bg') || '#fecaca'; this.style.color=cssVar('--danger-hover') || '#991b1b'" onmouseleave="this.style.background=cssVar('--danger-light') || '#fee2e2'; this.style.color=cssVar('--danger-text') || '#b91c1c'">Hapus</button>

        </div>

    `;



    // Sisipkan th di pos target + 2 (karena kolom pertama di index 1 adalah aksi baris)

    const targetTh = theadTr.children[colIndex + 1];

    if (targetTh && targetTh.nextSibling) {

        theadTr.insertBefore(newTh, targetTh.nextSibling);

    } else {

        theadTr.appendChild(newTh);

    }



    // Sisipkan sel kosong di setiap baris data

    const tbody = document.getElementById("data-grid-body");

    Array.from(tbody.children).forEach(tr => {

        const newTd = document.createElement("td");

        newTd.className = "editable-cell";

        newTd.contentEditable = "true";

        newTd.setAttribute("onkeydown", "if(event.key === 'Enter') { event.preventDefault(); this.blur(); }");

        

        const targetTd = tr.children[colIndex + 1];

        if (targetTd && targetTd.nextSibling) {

            tr.insertBefore(newTd, targetTd.nextSibling);

        } else {

            tr.appendChild(newTd);

        }

    });



    reindexLocalColumns();

}



// Menghapus kolom secara lokal dari DOM

function deleteCsvColumnLocal(colIndex) {

    const theadTr = document.getElementById("data-grid-head").querySelector("tr");

    if (theadTr.children[colIndex + 1]) {

        theadTr.children[colIndex + 1].remove();

    }



    const tbody = document.getElementById("data-grid-body");

    Array.from(tbody.children).forEach(tr => {

        if (tr.children[colIndex + 1]) {

            tr.children[colIndex + 1].remove();

        }

    });



    reindexLocalColumns();

}



// Menata ulang index th/kolom setelah ada penyisipan atau penghapusan kolom lokal

function reindexLocalColumns() {

    const theadTr = document.getElementById("data-grid-head").querySelector("tr");

    if (!theadTr) return;

    

    // headers start from index 1 (0 is action column)

    Array.from(theadTr.children).slice(1).forEach((th, idx) => {

        const nameInput = th.querySelector(".header-name-input");

        if (nameInput) {

            nameInput.setAttribute("onchange", `onHeaderNameChange(${idx}, this.value)`);

        }

        

        const unitInput = th.querySelector(".header-unit-input");

        if (unitInput) {

            unitInput.setAttribute("onchange", `updateCsvUnitLocal(${idx}, this.value)`);

        }

        

        const yearInput = th.querySelector(".header-year-input");

        if (yearInput) {

            yearInput.setAttribute("onchange", `updateCsvYearLocal(${idx}, this.value)`);

        }

        

        const insBtn = th.querySelector(".btn-row-insert");

        const delBtn = th.querySelector(".btn-row-del");

        if (insBtn) insBtn.setAttribute("onclick", `insertCsvColBelowLocal(${idx})`);

        if (delBtn) delBtn.setAttribute("onclick", `deleteCsvColumnLocal(${idx})`);

    });

}



// Menyimpan seluruh perubahan data dari DOM langsung ke API (Massal)

async function saveCsvChangesToServer(tableId) {

    if (editorState.mode !== 'csv-edit') {

        showToast("error", "Gagal", "Anda tidak sedang berada dalam mode edit.");

        return;

    }



    const theadTr = document.getElementById("data-grid-head")?.querySelector("tr");

    if (!theadTr) {

        showToast("error", "Gagal", "Elemen header tabel tidak ditemukan. Harap muat ulang.");

        return;

    }



    // 1. Ekstrak Headers

    const headers = Array.from(theadTr.children).slice(1).map(th => {

        const input = th.querySelector(".header-name-input");

        return input ? input.value.trim() : "";

    });



    const non_empty_headers = headers.filter(h => h !== "");

    if (headers.length === 0 || non_empty_headers.length === 0) {

        showToast("error", "Gagal", "Nama kolom (headers) tidak boleh kosong. Silakan muat ulang halaman atau periksa kembali input Anda.");

        return;

    }



    Swal.fire({

        title: 'Menyimpan Perubahan...',

        allowOutsideClick: false,

        didOpen: () => {

            Swal.showLoading();

        }

    });



    // 2. Ekstrak Units (Satuan)

    const units = Array.from(theadTr.children).slice(1).map(th => {

        const input = th.querySelector(".header-unit-input");

        let val = input ? input.value.trim() : "-";

        if (val.toLowerCase() === "persen" || val.toLowerCase() === "persentase" || val.toLowerCase() === "percent") {

            val = "%";

        }

        return val;

    });



    // 3. Ekstrak Years (Tahun)

    const years = Array.from(theadTr.children).slice(1).map(th => {

        const input = th.querySelector(".header-year-input");

        return input ? input.value.trim() : "-";

    });



    // 4. Ekstrak Baris Data

    const tbody = document.getElementById("data-grid-body");

    const rows = Array.from(tbody.children).map(tr => {

        return Array.from(tr.children).slice(1).map(td => td.innerText.trim());

    });



    try {

        const res = await fetch(`${API_BASE}/tables/${tableId}/csv/save`, {

            method: "PUT",

            headers: { "Content-Type": "application/json" },

            body: JSON.stringify({ headers, units, years, rows })

        });

        

        Swal.close();



        if (res.ok) {

            showToast("success", "Berhasil", "Perubahan tabel berhasil disimpan secara permanen.", 2000);

            // Beralih kembali ke mode preview

            previewCsv(tableId, editorState.tableName);

        } else {

            const err = await res.json();

            showToast("error", "Gagal", err.detail || "Gagal menyimpan data tabel");

        }

    } catch (e) {

        Swal.close();

        showToast("error", "Error", e.message);

    }

}



// Menukar baris dan kolom tabel secara lokal di editor

function transposeCsvLocal() {

    // 1. Ekstrak data saat ini dari DOM

    const theadTr = document.getElementById("data-grid-head").querySelector("tr");

    if (!theadTr) return;



    const currentHeaders = Array.from(theadTr.children).slice(1).map(th => {

        const input = th.querySelector(".header-name-input");

        return input ? input.value.trim() : "";

    });



    const currentUnits = Array.from(theadTr.children).slice(1).map(th => {

        const input = th.querySelector(".header-unit-input");

        return input ? input.value.trim() : "-";

    });



    const currentYears = Array.from(theadTr.children).slice(1).map(th => {

        const input = th.querySelector(".header-year-input");

        return input ? input.value.trim() : "-";

    });



    const tbody = document.getElementById("data-grid-body");

    const currentRows = Array.from(tbody.children).map(tr => {

        return Array.from(tr.children).slice(1).map(td => td.innerText.trim());

    });



    if (currentHeaders.length === 0 || currentRows.length === 0) {

        showToast("warning", "Peringatan", "Tidak ada data untuk ditranspose.");

        return;

    }



    // 2. Lakukan transpose data

    const newHeaders = [];

    const newUnits = [];

    const newYears = [];

    const newRows = [];



    // Header kolom pertama yang baru

    newHeaders.push(currentHeaders[0] || "Kecamatan / Kategori");

    newUnits.push(currentUnits[0] || "-");

    newYears.push(currentYears[0] || "-");



    // Baris pertama kolom pertama dari row-row lama akan menjadi header baru

    currentRows.forEach(row => {

        const cellVal = row[0] || "";

        // Ekstrak Metadata Satuan/Tahun dari nama baris jika ada (misal: "Produksi Listrik (KWh, 2025)")

        let parsedName = cellVal;

        let parsedUnit = "-";

        let parsedYear = "-";



        const matchParentheses = cellVal.match(/\(([^)]+)\)$/);

        if (matchParentheses) {

            const content = matchParentheses[1].trim();

            parsedName = cellVal.replace(/\s*\([^)]+\)$/, "").trim();

            

            const parts = content.split(",").map(p => p.trim());

            if (parts.length === 2) {

                parsedUnit = parts[0];

                parsedYear = parts[1];

            } else if (parts.length === 1) {

                if (/^\d{4}$/.test(parts[0])) {

                    parsedYear = parts[0];

                } else {

                    parsedUnit = parts[0];

                }

            }

        }



        newHeaders.push(parsedName);

        newUnits.push(parsedUnit);

        newYears.push(parsedYear);

    });



    // Buat data baris baru

    // Setiap baris baru mewakili satu kolom data lama (mulai dari indeks 1)

    for (let colIdx = 1; colIdx < currentHeaders.length; colIdx++) {

        const newRow = [];

        // Sel pertama adalah nama header lama

        let oldHeaderName = currentHeaders[colIdx];

        let oldUnit = currentUnits[colIdx];

        let oldYear = currentYears[colIdx];

        let suffix = "";

        if (oldUnit && oldUnit !== "-" && oldUnit.toLowerCase() !== "satuan") suffix += oldUnit;

        if (oldYear && oldYear !== "-" && oldYear.toLowerCase() !== "tahun") suffix += suffix ? `, ${oldYear}` : oldYear;

        

        let label = oldHeaderName;

        if (suffix) {

            label += ` (${suffix})`;

        }

        newRow.push(label);



        // Sel berikutnya adalah data dari baris-baris lama pada kolom tersebut

        currentRows.forEach(row => {

            newRow.push(row[colIdx] || "");

        });



        newRows.push(newRow);

    }



    // 3. Re-render Grid DOM dengan data baru yang sudah ditranspose (dalam mode edit)

    const thead = document.getElementById("data-grid-head");

    thead.innerHTML = `<tr>

        <th class="th-action-col" style="vertical-align: middle; text-align: center;">Aksi Baris</th>

        ${newHeaders.map((h, idx) => {

            const unit = newUnits[idx] || "";

            const year = newYears[idx] || "";

            return `

            <th class="editable-header-wrapper" style="min-width: 170px; padding: 0.75rem 0.5rem; text-align: left; border-bottom: 2px solid var(--swal-cancel, #cbd5e1); background: var(--bg-page, #f8fafc);">

                <div style="margin-bottom: 6px;">

                    <label style="font-size: 0.68rem; font-weight: 700; color: #64748b; display: block; margin-bottom: 2px;">NAMA KOLOM</label>

                    <input type="text" class="header-name-input" value="${h}" onchange="onHeaderNameChange(${idx}, this.value)" style="width: 100%; padding: 4px 6px; font-size: 0.8rem; font-weight: 600; border-radius: 4px; border: 1px solid var(--swal-cancel, #cbd5e1); outline:none; font-family: 'Inter', sans-serif;">

                </div>

                <div style="display: flex; gap: 4px; margin-bottom: 8px;">

                    <div style="flex: 1;">

                        <label style="font-size: 0.65rem; font-weight: 700; color: #64748b; display: block; margin-bottom: 2px;">SATUAN</label>

                        <input type="text" class="header-unit-input" value="${unit}" onchange="updateCsvUnitLocal(${idx}, this.value)" placeholder="e.g. Jiwa" style="width: 100%; padding: 3px 6px; font-size: 0.75rem; border-radius: 4px; border: 1px solid var(--swal-cancel, #cbd5e1); outline:none; font-family: 'Inter', sans-serif; background: white;">

                    </div>

                    <div style="width: 65px;">

                        <label style="font-size: 0.65rem; font-weight: 700; color: #64748b; display: block; margin-bottom: 2px;">TAHUN</label>

                        <input type="text" class="header-year-input" value="${year}" onchange="updateCsvYearLocal(${idx}, this.value)" placeholder="e.g. 2025" style="width: 100%; padding: 3px 6px; font-size: 0.75rem; border-radius: 4px; border: 1px solid var(--swal-cancel, #cbd5e1); outline:none; font-family: 'Inter', sans-serif; background: white;">

                    </div>

                </div>

                <div style="display: flex; gap: 4px; justify-content: center; padding-top: 6px; border-top: 1px dashed var(--border, #e2e8f0);">

                    <button onclick="insertCsvColBelowLocal(${idx})" class="btn-row-insert" style="padding: 3px 8px; font-size: 0.72rem; border-radius: 4px; border: 1px solid var(--swal-cancel, #cbd5e1); background: #f1f5f9; color: #475569; cursor: pointer; transition: all 0.15s;" onmouseenter="this.style.background=cssVar('--border') || '#e2e8f0'; this.style.color=cssVar('--text-primary') || '#1e293b'" onmouseleave="this.style.background=cssVar('--bg-hover') || '#f1f5f9'; this.style.color=cssVar('--text-tertiary') || '#475569'">Sisip</button>

                    <button onclick="deleteCsvColumnLocal(${idx})" class="btn-row-del" style="padding: 3px 8px; font-size: 0.72rem; border-radius: 4px; border: 1px solid #fca5a5; background: var(--danger-light, #fee2e2); color: var(--danger-dark, #b91c1c); cursor: pointer; transition: all 0.15s;" onmouseenter="this.style.background=cssVar('--danger-light-bg') || '#fecaca'; this.style.color=cssVar('--danger-hover') || '#991b1b'" onmouseleave="this.style.background=cssVar('--danger-light') || '#fee2e2'; this.style.color=cssVar('--danger-text') || '#b91c1c'">Hapus</button>

                </div>

            </th>`;

        }).join("")}

    </tr>`;



    tbody.innerHTML = "";

    newRows.forEach((row, rowIndex) => {

        const tr = document.createElement("tr");

        tr.id = `csv-row-${rowIndex}`;



        let html = `<td><div class="row-action-cell">

            <button onclick="insertCsvRowBelowLocal(${rowIndex})" class="btn-row-insert" title="Sisipkan baris baru di bawah baris ini">Sisip</button>

            <button onclick="deleteCsvRowLocal(${rowIndex})" class="btn-row-del">Hapus</button>

        </div></td>`;



        row.forEach(cell => {

            html += `<td class="editable-cell" contenteditable="true" onkeydown="if(event.key === 'Enter') { event.preventDefault(); this.blur(); }">${cell != null ? cell : ""}</td>`;

        });



        tr.innerHTML = html;

        tbody.appendChild(tr);

    });



    showToast('success', 'Sukses', 'Tabel berhasil ditranspose secara lokal. Tekan "Simpan Perubahan" untuk menyimpan perubahan secara permanen.', 2000);

}



// Membatalkan pengeditan CSV (tanpa simpan, reload data asli)

function cancelCsvEditMode(tableId, tableName) {

    Swal.fire({

        title: 'Batalkan Pengeditan?',

        text: "Semua perubahan data yang belum disimpan akan hilang.",

        icon: 'warning',

        showCancelButton: true,

        confirmButtonColor: cssVar('--danger') || cssVar('--danger') || '#ef4444',

        cancelButtonColor: cssVar('--swal-cancel') || cssVar('--text-muted') || '#cbd5e1',

        confirmButtonText: 'Ya, Batalkan',

        cancelButtonText: 'Kembali Edit'

    }).then((result) => {

        if (result.isConfirmed) {

            previewCsv(tableId, tableName);

        }

    });

}



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



let tsActiveUnitKey = null;



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

    const combined = `${unitStr || ''} ${indicatorName || ''} ${tableName || ''}`.toLowerCase();

    

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

    const chartBtnGroup = document.getElementById('ts-chart-unit-btn-group');
    const chartUnitWrapper = document.getElementById('ts-chart-unit-wrapper');

    if (!currentTimeSeriesData || !checkedVKs || checkedVKs.length === 0) {
        container.style.setProperty('display', 'none', 'important');
        if (chartUnitWrapper) chartUnitWrapper.style.setProperty('display', 'none', 'important');
        return;
    }

    const firstVk = checkedVKs[0];
    const vkUnit = (currentTimeSeriesData.vkUnits && currentTimeSeriesData.vkUnits[firstVk]) || '';
    const familyKey = detectUnitFamily(vkUnit, firstVk, typeof tsCurrentKeyword !== 'undefined' ? tsCurrentKeyword : '');

    if (!familyKey || !UNIVERSAL_UNIT_FAMILIES[familyKey]) {
        container.style.setProperty('display', 'none', 'important');
        if (chartUnitWrapper) chartUnitWrapper.style.setProperty('display', 'none', 'important');
        tsActiveUnitKey = null;
        return;
    }

    const family = UNIVERSAL_UNIT_FAMILIES[familyKey];
    if (!tsActiveUnitKey || !family.units[tsActiveUnitKey]) {
        tsActiveUnitKey = family.baseUnit;
    }

    function buildChips(groupName) {
        let html = '';
        const combinedInfo = `${vkUnit || ''} ${firstVk || ''} ${typeof tsCurrentKeyword !== 'undefined' ? tsCurrentKeyword : ''}`.toLowerCase();
        const isEkor = /\b(ekor|ternak|populasi ternak|unggas|sapi|kambing|domba|ayam|itik|kerbau|kuda|babi)\b/i.test(combinedInfo);
        const isPohon = /\b(pohon|batang)\b/i.test(combinedInfo);

        for (const [unitKey, unitCfg] of Object.entries(family.units)) {
            const isActive = (unitKey === tsActiveUnitKey);
            let displayLabel = unitCfg.btnLabel || unitCfg.label;

            // Context-aware dynamic labels for count family
            if (familyKey === 'count') {
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
                            ? vkUnit.trim()
                            : 'Unit';
                    } else if (unitKey === 'ribu_unit') {
                        displayLabel = 'Ribu Unit';
                    } else if (unitKey === 'juta_unit') {
                        displayLabel = 'Juta Unit';
                    }
                }
            }

            html += `
                <label class="ts-variant-chip${isActive ? ' active' : ''}" onclick="switchTimeSeriesUnit('${unitKey}')">
                    <input type="radio" name="${groupName}" value="${unitKey}" ${isActive ? 'checked' : ''}>
                    <span>${typeof escHtml === 'function' ? escHtml(displayLabel) : displayLabel}</span>
                </label>`;
        }
        return html;
    }

    btnGroup.innerHTML = buildChips('ts-unit-radio-table');
    if (chartBtnGroup) chartBtnGroup.innerHTML = buildChips('ts-unit-radio-chart');

    container.style.removeProperty('display');
    container.style.display = 'flex';
    if (chartUnitWrapper) {
        chartUnitWrapper.style.removeProperty('display');
        chartUnitWrapper.style.display = 'flex';
    }
}



function switchTimeSeriesUnit(targetUnitKey) {

    tsActiveUnitKey = targetUnitKey;

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

            ” Ditemukan <strong>${groupKeys.length}</strong> varian/tabel yang sesuai dengan kata kunci "<strong>${keyword}</strong>".

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

            titleEl.innerHTML = `<span>Deret Waktu: <span class="text-primary fw-semibold">${escHtml(rawKeywords[0])}</span></span>`;

        } else if (rawKeywords.length > 1) {

            titleEl.innerHTML = `<span>Hasil Analisis Deret Waktu <span class="badge bg-primary-subtle text-primary border ms-2" style="font-size:0.78rem; font-weight:600;">${rawKeywords.length} Indikator</span></span>`;

        } else {

            titleEl.innerHTML = `<span>Hasil Analisis Deret Waktu</span>`;

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

                        const sourceTooltip = `Publikasi: Kabupaten Tasikmalaya Dalam Angka (${sInfo.doc_year || 'BPS'})\nTabel: ${sInfo.table_name || ''}\nKolom Asli: ${sInfo.raw_col || ''}`;

                        cellDisplay += ` <a href="javascript:void(0)" onclick="showSourceLineageDetail('${y}', '${vkEsc}', '${sInfo.table_id}', '${tnEsc}', '${sInfo.doc_year || ''}', '${fnEsc}', '${rcEsc}')" style="font-size:0.72rem; text-decoration:none; margin-left:3px; padding:1px 4px; background:#e0e7ff; color:#4338ca; border-radius:3px; font-weight:600; vertical-align:middle;" title="${escHtml(sourceTooltip)}" class="d-inline-flex align-items-center gap-1"><i class="bi bi-box-arrow-up-right" style="font-size:0.65rem;"></i></a>`;

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
                                    const scaled = unitConfig ? num * (unitConfig.factor != null ? unitConfig.factor : 1) : num;
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

                statTotalPts.textContent = totalPoints > 0 ? totalPoints.toLocaleString('id-ID') + ' Titik Data' : '0';

                if (minVal !== Infinity && maxVal !== -Infinity) {
                    const minFmt = formatWithUnitScale(minVal, { factor: 1, isInteger: unitConfig?.isInteger, maxDecimals: unitConfig?.maxDecimals });
                    const maxFmt = formatWithUnitScale(maxVal, { factor: 1, isInteger: unitConfig?.isInteger, maxDecimals: unitConfig?.maxDecimals });
                    const uSuffix = unitConfig ? ' ' + unitConfig.label : '';
                    let rangeHtml = `${minFmt} — ${maxFmt}${uSuffix}`;
                    if (summaryTotalVal !== null) {
                        const sumFmt = formatWithUnitScale(summaryTotalVal, { factor: 1, isInteger: unitConfig?.isInteger, maxDecimals: unitConfig?.maxDecimals });
                        rangeHtml += ` <span style="font-size:0.75rem; font-weight:500; color:var(--text-secondary,#64748b); display:block; margin-top:2px;">(Total: ${sumFmt}${uSuffix})</span>`;
                    }
                    statRange.innerHTML = rangeHtml;
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
    const familyKey = detectUnitFamily(vkUnit, activeVk, typeof tsCurrentKeyword !== 'undefined' ? tsCurrentKeyword : '');
    const family = familyKey ? UNIVERSAL_UNIT_FAMILIES[familyKey] : null;
    const unitConfig = (family && tsActiveUnitKey && family.units[tsActiveUnitKey]) ? family.units[tsActiveUnitKey] : null;
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

    const codeBg = isDark ? 'rgba(124, 58, 237, 0.25)' : cssVar('--purple-50') || '#ede9fe';

    const codeColor = isDark ? cssVar('--purple-500') || '#c4b5fd' : cssVar('--badge-purple-text') || '#6d28d9';



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

        reportContainer.style.cssText = 'position:fixed; left:-99999px; top:0; width:1200px; background:var(--bg-card, #ffffff); color:var(--text-primary, #1e293b); font-family:"Inter", -apple-system, BlinkMacSystemFont, sans-serif; padding:32px 36px; box-sizing:border-box; z-index:-1000;';



        let reportHtml = '';

        // Tentukan section aktif terakhir agar footer resmi SIPEDAS menempel di akhir halaman dokumen
        const lastSectionKey = optTable ? 'data-table' : (optChart ? 'charts' : (optInsights ? 'insights' : 'cover'));
        const footerHtml = `
            <div id="ts-pdf-footer" style="border-top:1px solid var(--border, #e2e8f0); padding-top:10px; margin-top:20px; display:flex; justify-content:space-between; align-items:center; font-size:10.5px; color:var(--text-secondary, #64748b);">
                <div>Dokumen digenerasi secara otomatis oleh SIPEDAS BPS Kabupaten Tasikmalaya</div>
                <div>SIPEDAS \u00A9 2026</div>
            </div>
        `;

        // Running Header resmi BPS & SIPEDAS untuk semua halaman konten (halaman 2 ke atas)
        if (includeHeader) {
            reportHtml += `
                <div id="ts-pdf-page-running-header" style="display:flex; align-items:center; justify-content:space-between; border-bottom:1.5px solid #cbd5e1; padding:4px 0 14px 0; margin-bottom:28px; background:#ffffff;">
                    <div style="display:flex; align-items:center; gap:12px;">
                        <img src="/static/logo_sipedas.png" alt="SIPEDAS" style="height:36px; width:auto; object-fit:contain;">
                        <div>
                            <div style="font-size:13px; font-weight:800; color:#0f2b5c; letter-spacing:0.4px; font-family:'Inter', sans-serif;">
                                SIPEDAS <span style="font-weight:600; color:#475569;">— Sistem Integrasi, Pencarian, dan Analisis Data Statistik</span>
                            </div>
                            <div style="font-size:11px; font-weight:800; color:#1e293b; text-transform:uppercase; letter-spacing:0.5px; margin-top:2px; font-family:'Inter', sans-serif;">
                                Badan Pusat Statistik Kabupaten Tasikmalaya
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }

        // Wrap Executive Modern Minimalist Cover (Option 1)
        reportHtml += `
            <div data-pdf-section="cover" style="min-height:510px; display:flex; flex-direction:column; justify-content:center; align-items:center; border:1.5px solid #cbd5e1; border-radius:16px; background:radial-gradient(circle at 50% 40%, #ffffff 0%, #f8fafc 100%); padding:40px 32px; box-sizing:border-box; position:relative; box-shadow:inset 0 0 40px rgba(0,0,0,0.015); margin-bottom:10px;">
                
                <!-- Logo SIPEDAS -->
                <div style="margin-bottom:18px;">
                    <img src="/static/logo_sipedas.png" alt="SIPEDAS" style="height:120px; width:auto; object-fit:contain; filter:drop-shadow(0 4px 10px rgba(15, 43, 92, 0.12));">
                </div>

                <!-- Brand Title -->
                <div style="font-size:36px; font-weight:900; letter-spacing:3px; color:#0f2b5c; margin-bottom:6px; font-family:'Inter', sans-serif;">SIPEDAS</div>

                <!-- Tagline / Kepanjangan -->
                <div style="font-size:15px; font-weight:600; color:#475569; letter-spacing:0.3px; max-width:680px; text-align:center; line-height:1.45; margin-bottom:16px; font-family:'Inter', sans-serif;">
                    Sistem Integrasi, Pencarian, dan Analisis Data Statistik
                </div>

                <!-- Garis Aksen BPS (Tricolor) -->
                <div style="display:flex; gap:6px; margin-bottom:20px; align-items:center;">
                    <span style="width:36px; height:3.5px; background:#0284c7; border-radius:2px;"></span>
                    <span style="width:36px; height:3.5px; background:#16a34a; border-radius:2px;"></span>
                    <span style="width:36px; height:3.5px; background:#f59e0b; border-radius:2px;"></span>
                </div>

                <!-- Nama Instansi Resmi -->
                <div style="font-size:15px; font-weight:800; color:#1e293b; letter-spacing:0.8px; text-transform:uppercase; margin-bottom:28px; font-family:'Inter', sans-serif;">
                    Badan Pusat Statistik Kabupaten Tasikmalaya
                </div>

                <!-- Kartu Identitas Laporan -->
                <div style="background:#ffffff; border:1px solid #bfdbfe; border-radius:12px; padding:18px 32px; text-align:center; box-shadow:0 3px 12px rgba(37, 99, 235, 0.08); max-width:720px; width:100%; box-sizing:border-box;">
                    <div style="font-size:11px; font-weight:800; color:#2563eb; text-transform:uppercase; letter-spacing:1px; margin-bottom:6px;">
                        Laporan Analisis Deret Waktu
                    </div>
                    <div style="font-size:22px; font-weight:900; color:#0f172a; margin-bottom:10px; letter-spacing:-0.2px; font-family:'Inter', sans-serif;">
                        ${escHtml(keywordTitle)}
                    </div>
                    <div style="font-size:12.5px; color:#334155; font-weight:600; display:flex; align-items:center; justify-content:center; gap:12px; flex-wrap:wrap;">
                        <span style="background:#f1f5f9; padding:4px 14px; border-radius:6px; color:#334155;">${escHtml(yearPeriodStr)}</span>
                        <span style="background:#f1f5f9; padding:4px 14px; border-radius:6px; color:#334155;">Satuan: <b>${escHtml(unitLabel)}</b></span>
                    </div>
                </div>
        `;

        if (lastSectionKey === 'cover') {
            reportHtml += footerHtml;
        }
        // Close cover section
        reportHtml += `</div>`;

        // 2. Komponen: Quick Insights & Peringkat Pertumbuhan (Berdasarkan Sub-opsi)
        if (optInsights) {
            reportHtml += `<div data-pdf-section="insights">`;
            reportHtml += `
                <div style="margin-bottom:26px;">
                    <div style="font-size:14px; font-weight:800; color:#0f2b5c; border-bottom:1.5px solid #e2e8f0; padding-bottom:8px; margin-top:10px; margin-bottom:18px; letter-spacing:0.3px;">
                        RINGKASAN TREN & PERINGKAT PERTUMBUHAN
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
                        <div style="background:var(--bg-page, #f8fafc); border:1px solid var(--border, #e2e8f0); padding:12px 14px; border-radius:8px;">
                            <div style="font-size:11px; color:var(--text-secondary, #64748b); font-weight:600; text-transform:uppercase;">Pertumbuhan Tertinggi</div>
                            <div style="font-size:14px; font-weight:700; color:var(--text-primary, #0f172a); margin-top:2px;">${escHtml(gainerName)}</div>
                            <div style="font-size:12px; font-weight:700; color:var(--success, #16a34a); margin-top:2px;">${escHtml(gainerBadge)}</div>
                        </div>
                        <div style="background:var(--bg-page, #f8fafc); border:1px solid var(--border, #e2e8f0); padding:12px 14px; border-radius:8px;">
                            <div style="font-size:11px; color:var(--text-secondary, #64748b); font-weight:600; text-transform:uppercase;">Penurunan Tertinggi</div>
                            <div style="font-size:14px; font-weight:700; color:var(--text-primary, #0f172a); margin-top:2px;">${escHtml(declinerName)}</div>
                            <div style="font-size:12px; font-weight:700; color:var(--danger, #dc2626); margin-top:2px;">${escHtml(declinerBadge)}</div>
                        </div>
                        <div style="background:var(--bg-page, #f8fafc); border:1px solid var(--border, #e2e8f0); padding:12px 14px; border-radius:8px;">
                            <div style="font-size:11px; color:var(--text-secondary, #64748b); font-weight:600; text-transform:uppercase;">Laju Rata-Rata Tahunan</div>
                            <div style="font-size:14px; font-weight:700; color:var(--text-primary, #0f172a); margin-top:2px;">${escHtml(trendSummary)}</div>
                            <div style="font-size:12px; font-weight:700; color:var(--info, #2563eb); margin-top:2px;">${escHtml(avgBadge)}</div>
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
                        <div style="margin-top:14px;">
                            <div style="font-size:12.5px; font-weight:700; color:#1e293b; margin-bottom:8px;">Tabel Urutan Peringkat Pertumbuhan (${escHtml(startYearText)} ke ${escHtml(endYearText)})</div>
                            <table style="width:100%; border-collapse:collapse; font-size:11px; font-family:'Inter', sans-serif;" data-pdf-table="ranking">
                                <thead data-pdf-table-header="ranking">
                                    <tr>
                                        <th style="background:#f1f5f9; color:var(--text-primary, #0f172a); font-weight:700; border:1px solid #cbd5e1; padding:6px 8px; text-align:center; width:45px;">No.</th>
                                        <th style="background:#f1f5f9; color:var(--text-primary, #0f172a); font-weight:700; border:1px solid #cbd5e1; padding:6px 8px; text-align:left;">Rincian</th>
                                        <th style="background:#f1f5f9; color:var(--text-primary, #0f172a); font-weight:700; border:1px solid #cbd5e1; padding:6px 8px; text-align:right;">${escHtml(startYearText)}</th>
                                        <th style="background:#f1f5f9; color:var(--text-primary, #0f172a); font-weight:700; border:1px solid #cbd5e1; padding:6px 8px; text-align:right;">${escHtml(endYearText)}</th>
                                        <th style="background:#f1f5f9; color:var(--text-primary, #0f172a); font-weight:700; border:1px solid #cbd5e1; padding:6px 8px; text-align:right;">Selisih Nominal</th>
                                        <th style="background:#f1f5f9; color:var(--text-primary, #0f172a); font-weight:700; border:1px solid #cbd5e1; padding:6px 8px; text-align:right;">Perubahan (%)</th>
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
            if (lastSectionKey === 'insights') {
                reportHtml += footerHtml;
            }
            // Close insights section
            reportHtml += `</div>`;
        }

        // 3. Komponen: Grafik Visual
        if (optChart) {
            reportHtml += `<div data-pdf-section="charts">`;
            reportHtml += `
                <div style="margin-bottom:26px; page-break-inside:avoid; break-inside:avoid;">
                    <div style="font-size:14px; font-weight:800; color:#0f2b5c; border-bottom:1.5px solid #e2e8f0; padding-bottom:8px; margin-top:10px; margin-bottom:20px; letter-spacing:0.3px;">
                        GRAFIK VISUAL DERET WAKTU
                    </div>
                    <div id="ts-export-chart-images-container" style="display:flex; flex-direction:column; gap:16px;"></div>
                </div>
            `;
            if (lastSectionKey === 'charts') {
                reportHtml += footerHtml;
            }
            // Close charts section
            reportHtml += `</div>`;
        }

        // 4. Komponen: Tabel Data Tabular
        if (optTable) {
            reportHtml += `<div data-pdf-section="data-table">`;
            const tableEl = document.getElementById('ts-grid');
            if (tableEl) {
                reportHtml += `
                    <div style="margin-bottom:24px;">
                        <div style="font-size:14px; font-weight:800; color:#0f2b5c; border-bottom:1.5px solid #e2e8f0; padding-bottom:8px; margin-top:10px; margin-bottom:18px; letter-spacing:0.3px;">
                            TABEL DATA TABULAR
                        </div>
                        <div style="overflow-x:auto;">
                            <table style="width:100%; border-collapse:collapse; font-size:11px; font-family:'Inter', sans-serif;" data-pdf-table="tabular">
                                ${tableEl.innerHTML}
                            </table>
                        </div>
                    </div>
                `;
            }
            if (lastSectionKey === 'data-table') {
                reportHtml += footerHtml;
            }
            // Close data-table section
            reportHtml += `</div>`;
        }

        reportContainer.innerHTML = reportHtml;
        const clonedTables = reportContainer.querySelectorAll('table');
        clonedTables.forEach(tbl => {
            // Sanitasi: Hapus semua elemen tautan dan ikon lacak sumber data (↗) dari ekspor PDF
            tbl.querySelectorAll('a, button, .bi-box-arrow-up-right').forEach(el => {
                el.remove();
            });

            tbl.querySelectorAll('th').forEach(th => {
                th.style.cssText = 'background:#f1f5f9; color:var(--text-primary, #0f172a); font-weight:700; border:1px solid #cbd5e1; padding:6px 8px; text-align:center; font-size:10.5px;';
            });
            tbl.querySelectorAll('td').forEach(td => {
                td.style.cssText = 'border:1px solid #e2e8f0; padding:5px 8px; font-size:10px; color:#334155;';
            });
            tbl.querySelectorAll('tr:nth-child(even) td').forEach(td => {
                td.style.backgroundColor = cssVar('--bg-page') || '#f8fafc';
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
                    const cont = document.getElementById(c.containerId);
                    if (cont && cont.style.display !== 'none') {
                        try {
                            const canvas = document.getElementById(c.canvasId);
                            if (!canvas) return;

                            let dataUrl = null;
                            const originalChart = (window.Chart && Chart.getChart(canvas)) || (window.timeSeriesCharts && window.timeSeriesCharts[c.canvasId]);

                            if (originalChart && originalChart.data && originalChart.data.datasets) {
                                try {
                                    const offCanvas = document.createElement('canvas');
                                    offCanvas.width = 1100;
                                    offCanvas.height = 480;
                                    const offCtx = offCanvas.getContext('2d');

                                    offCtx.fillStyle = '#ffffff';
                                    offCtx.fillRect(0, 0, 1100, 480);

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
                                                        padding: 12,
                                                        filter: function(item, chartData) {
                                                            const ds = chartData.datasets[item.datasetIndex];
                                                            return !(ds && ds.hidden);
                                                        }
                                                    }
                                                },
                                                tooltip: { enabled: false },
                                                progressiveLineTracer: false
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
                                const imgDiv = document.createElement('div');
                                imgDiv.className = 'ts-pdf-chart-card';
                                imgDiv.style.cssText = 'background:#ffffff; border:1px solid #e2e8f0; border-radius:10px; padding:16px 18px; text-align:center; margin-bottom:16px; page-break-inside:avoid; break-inside:avoid; box-shadow:0 1px 3px rgba(0,0,0,0.05);';

                                if (c.title) {
                                    imgDiv.innerHTML = `<div style="font-size:13.5px; font-weight:700; color:var(--text-primary, #0f172a); margin-bottom:12px; text-align:left; border-bottom:1px solid #f1f5f9; padding-bottom:8px;">${escHtml(c.title)}</div>`;
                                }

                                const img = document.createElement('img');
                                img.src = dataUrl;
                                img.style.cssText = 'width:100%; max-width:1100px; height:auto; display:block; margin:0 auto; object-fit:contain; border-radius:6px;';

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
        let capturedSections = [];
        let capturedRunningHeader = null;

        const canvas = await html2canvas(reportContainer, {
            scale: 2,
            backgroundColor: cssVar('--text-white') || '#ffffff',
            useCORS: true,
            logging: false,
            onclone: function(clonedDoc) {
                const clonedContainer = clonedDoc.getElementById('ts-export-temp-report');
                if (!clonedContainer) return;
                const containerRect = clonedContainer.getBoundingClientRect();

                const runningHdr = clonedContainer.querySelector('#ts-pdf-page-running-header');
                if (runningHdr) {
                    const hdrRect = runningHdr.getBoundingClientRect();
                    capturedRunningHeader = {
                        top: Math.max(0, hdrRect.top - containerRect.top),
                        height: hdrRect.height
                    };
                }

                const sections = clonedContainer.querySelectorAll('[data-pdf-section]');
                
                sections.forEach(sec => {
                    const secRect = sec.getBoundingClientRect();
                    const secTop = Math.max(0, secRect.top - containerRect.top);
                    const secBottom = Math.max(0, secRect.bottom - containerRect.top);
                    if (secBottom <= secTop) return;

                    let tableInfo = null;
                    const table = sec.querySelector('table');
                    if (table) {
                        const thead = table.querySelector('thead');
                        const tbodyRows = table.querySelectorAll('tbody tr').length > 0 
                            ? table.querySelectorAll('tbody tr') 
                            : table.querySelectorAll('tr:not(thead tr)');
                        let theadTop = 0;
                        let theadH = 0;
                        if (thead) {
                            const theadRect = thead.getBoundingClientRect();
                            theadTop = Math.max(0, theadRect.top - containerRect.top);
                            theadH = theadRect.height;
                        }

                        const rowBoundaries = [];
                        tbodyRows.forEach(tr => {
                            const trRect = tr.getBoundingClientRect();
                            const rTop = Math.max(0, trRect.top - containerRect.top);
                            const rBottom = Math.max(0, trRect.bottom - containerRect.top);
                            if (rBottom > rTop) {
                                rowBoundaries.push({ top: rTop, bottom: rBottom });
                            }
                        });

                        tableInfo = {
                            theadTop: theadTop,
                            theadH: theadH,
                            rows: rowBoundaries
                        };
                    }

                    const chartCards = sec.querySelectorAll('.ts-pdf-chart-card');
                    const chartCardBoundaries = [];
                    chartCards.forEach(card => {
                        const cRect = card.getBoundingClientRect();
                        const cTop = Math.max(0, cRect.top - containerRect.top);
                        const cBottom = Math.max(0, cRect.bottom - containerRect.top);
                        if (cBottom > cTop) {
                            chartCardBoundaries.push({ top: cTop, bottom: cBottom });
                        }
                    });

                    capturedSections.push({
                        name: sec.dataset.pdfSection,
                        top: secTop,
                        bottom: secBottom,
                        table: tableInfo,
                        chartCards: chartCardBoundaries
                    });
                });
            }
        });

        if (!capturedRunningHeader) {
            const liveHdr = reportContainer.querySelector('#ts-pdf-page-running-header');
            if (liveHdr) {
                const cRect = reportContainer.getBoundingClientRect();
                const hRect = liveHdr.getBoundingClientRect();
                capturedRunningHeader = {
                    top: Math.max(0, hRect.top - cRect.top),
                    height: hRect.height
                };
            }
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
                if (reportContainer && reportContainer.parentNode) {
                    reportContainer.parentNode.removeChild(reportContainer);
                }
                Swal.close();
                showToast('success', 'Berhasil', 'Gambar grafik & data (.png) berhasil diunduh.');
            }, 'image/png');
        } else {
            // PDF Generation: Smart Row-Aware & Section-Aware pagination
            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF({ orientation, unit: 'pt', format: 'a4' });

            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            const marginTop = 36, marginBottom = 36, marginLeft = 28, marginRight = 28;
            const contentWidth = pdfWidth - (marginLeft + marginRight);
            const pageEffectiveHeight = pdfHeight - (marginTop + marginBottom);
            const maxCanvasSliceH = Math.floor((pageEffectiveHeight * canvas.width) / contentWidth);
            const totalSrcHeight = canvas.height;

            const canvasScale = canvas.width / (reportContainer.offsetWidth || 1200);

            let runningHeaderCanvasTop = 0;
            let runningHeaderCanvasH = 0;
            if (capturedRunningHeader) {
                runningHeaderCanvasTop = Math.floor(capturedRunningHeader.top * canvasScale);
                runningHeaderCanvasH = Math.ceil(capturedRunningHeader.height * canvasScale);
            }

            let sectionDataList = [];
            if (capturedSections.length > 0) {
                sectionDataList = capturedSections.map(s => {
                    let tableData = null;
                    if (s.table) {
                        tableData = {
                            theadCanvasTop: Math.floor(s.table.theadTop * canvasScale),
                            theadCanvasH: Math.ceil(s.table.theadH * canvasScale),
                            rows: s.table.rows.map(r => ({
                                top: Math.floor(r.top * canvasScale),
                                bottom: Math.ceil(r.bottom * canvasScale)
                            }))
                        };
                    }
                    return {
                        name: s.name,
                        canvasTop: Math.floor(s.top * canvasScale),
                        canvasBottom: Math.min(totalSrcHeight, Math.ceil(s.bottom * canvasScale)),
                        table: tableData,
                        chartCards: s.chartCards.map(c => ({
                            top: Math.floor(c.top * canvasScale),
                            bottom: Math.ceil(c.bottom * canvasScale)
                        }))
                    };
                });
            } else {
                const containerRect = reportContainer.getBoundingClientRect();
                const containerHeight = reportContainer.offsetHeight || containerRect.height || 1;
                const canvasScaleY = canvas.height / containerHeight;
                const sections = reportContainer.querySelectorAll('[data-pdf-section]');

                sections.forEach(sec => {
                    const secRect = sec.getBoundingClientRect();
                    const secTop = Math.max(0, Math.floor((secRect.top - containerRect.top) * canvasScaleY));
                    const secBottom = Math.min(totalSrcHeight, Math.ceil((secRect.bottom - containerRect.top) * canvasScaleY));
                    if (secBottom <= secTop) return;

                    let tableInfo = null;
                    const table = sec.querySelector('table');
                    if (table) {
                        const thead = table.querySelector('thead');
                        const tbodyRows = table.querySelectorAll('tbody tr').length > 0
                            ? table.querySelectorAll('tbody tr')
                            : table.querySelectorAll('tr:not(thead tr)');
                        let theadCanvasTop = 0;
                        let theadCanvasH = 0;
                        if (thead) {
                            const theadRect = thead.getBoundingClientRect();
                            theadCanvasTop = Math.max(0, Math.floor((theadRect.top - containerRect.top) * canvasScaleY));
                            theadCanvasH = Math.ceil(theadRect.height * canvasScaleY);
                        }

                        const rowBoundaries = [];
                        tbodyRows.forEach(tr => {
                            const trRect = tr.getBoundingClientRect();
                            const rTop = Math.max(0, Math.floor((trRect.top - containerRect.top) * canvasScaleY));
                            const rBottom = Math.min(totalSrcHeight, Math.ceil((trRect.bottom - containerRect.top) * canvasScaleY));
                            if (rBottom > rTop) {
                                rowBoundaries.push({ top: rTop, bottom: rBottom });
                            }
                        });

                        tableInfo = {
                            theadCanvasTop: theadCanvasTop,
                            theadCanvasH: theadCanvasH,
                            rows: rowBoundaries
                        };
                    }

                    const chartCards = sec.querySelectorAll('.ts-pdf-chart-card');
                    const chartCardBoundaries = [];
                    chartCards.forEach(card => {
                        const cRect = card.getBoundingClientRect();
                        const cTop = Math.max(0, Math.floor((cRect.top - containerRect.top) * canvasScaleY));
                        const cBottom = Math.min(totalSrcHeight, Math.ceil((cRect.bottom - containerRect.top) * canvasScaleY));
                        if (cBottom > cTop) {
                            chartCardBoundaries.push({ top: cTop, bottom: cBottom });
                        }
                    });

                    sectionDataList.push({
                        name: sec.dataset.pdfSection,
                        canvasTop: secTop,
                        canvasBottom: secBottom,
                        table: tableInfo,
                        chartCards: chartCardBoundaries
                    });
                });
            }

            let pageNum = 1;

            if (sectionDataList.length > 0) {
                for (const secData of sectionDataList) {
                    let currY = secData.canvasTop;
                    const secEnd = secData.canvasBottom;
                    let isFirstPageOfSec = true;

                    while (currY < secEnd) {
                        const isCover = (secData.name === 'cover');
                        // Running header appears on ALL pages EXCEPT the cover
                        const includeRunningHeader = !isCover && (runningHeaderCanvasH > 0);
                        const runningH = includeRunningHeader ? runningHeaderCanvasH : 0;
                        // Jarak napas lega antara garis bawah kop resmi dan judul konten di bawahnya (28pt)
                        const headerGap = includeRunningHeader ? Math.round(28 * canvasScale) : 0;

                        const hasTable = !!(secData.table && secData.table.theadCanvasH > 0);
                        // Repeat table header ONLY if this section has a table, and we are beyond the first page of this section
                        const needTableHeader = !isFirstPageOfSec && hasTable && (currY >= (secData.table.theadCanvasTop + secData.table.theadCanvasH));
                        const tableH = needTableHeader ? secData.table.theadCanvasH : 0;

                        const availContentH = maxCanvasSliceH - runningH - headerGap - tableH;

                        if (availContentH <= 30) {
                            break;
                        }

                        const idealCutY = currY + availContentH;
                        let cutY = idealCutY;

                        if (idealCutY >= secEnd) {
                            cutY = secEnd;
                        } else if (hasTable && secData.table.rows.length > 0) {
                            const remainingRows = secData.table.rows.filter(r => r.bottom > currY + 2);
                            if (remainingRows.length > 0) {
                                const fittingRows = remainingRows.filter(r => r.bottom <= idealCutY);
                                if (fittingRows.length > 0) {
                                    if (fittingRows.length === remainingRows.length && secEnd <= idealCutY) {
                                        cutY = secEnd;
                                    } else {
                                        const lastFit = fittingRows[fittingRows.length - 1];
                                        cutY = lastFit.bottom;
                                    }
                                } else {
                                    cutY = Math.min(secEnd, Math.max(currY + 30, idealCutY));
                                }
                            }
                        } else if (secData.chartCards && secData.chartCards.length > 0) {
                            const remainingCards = secData.chartCards.filter(c => c.bottom > currY + 2);
                            if (remainingCards.length > 0) {
                                const fittingCards = remainingCards.filter(c => c.bottom <= idealCutY);
                                if (fittingCards.length > 0) {
                                    if (fittingCards.length === remainingCards.length && secEnd <= idealCutY) {
                                        cutY = secEnd;
                                    } else {
                                        cutY = fittingCards[fittingCards.length - 1].bottom;
                                    }
                                }
                            }
                        }

                        const contentH = cutY - currY;
                        if (contentH <= 0) break;

                        const totalSliceH = contentH + runningH + headerGap + tableH;
                        const sliceCanvas = document.createElement('canvas');
                        sliceCanvas.width = canvas.width;
                        sliceCanvas.height = totalSliceH;
                        const sCtx = sliceCanvas.getContext('2d');
                        sCtx.fillStyle = '#ffffff';
                        sCtx.fillRect(0, 0, sliceCanvas.width, totalSliceH);

                        // 1. Draw Running Header (for all content pages)
                        if (runningH > 0) {
                            sCtx.drawImage(
                                canvas,
                                0, runningHeaderCanvasTop, canvas.width, runningHeaderCanvasH,
                                0, 0, canvas.width, runningH
                            );
                        }

                        // 2. Draw Table Header if continuation page
                        if (tableH > 0) {
                            sCtx.drawImage(
                                canvas,
                                0, secData.table.theadCanvasTop, canvas.width, secData.table.theadCanvasH,
                                0, runningH + headerGap, canvas.width, tableH
                            );
                        }

                        // 3. Draw content slice below headers
                        const destY = runningH + headerGap + tableH;
                        sCtx.drawImage(
                            canvas,
                            0, currY, canvas.width, contentH,
                            0, destY, canvas.width, contentH
                        );

                        const sliceData = sliceCanvas.toDataURL('image/jpeg', 0.95);
                        const slicePdfH = (totalSliceH * contentWidth) / canvas.width;

                        // Position calculation:
                        // Page 1 (Cover): 100% symmetrically centered vertically on the A4 sheet!
                        const finalY = (pageNum === 1 && isCover)
                            ? Math.max(0, Math.floor((pdfHeight - slicePdfH) / 2))
                            : marginTop;

                        if (pageNum > 1) pdf.addPage();
                        pdf.addImage(sliceData, 'JPEG', marginLeft, finalY, contentWidth, slicePdfH);

                        // Print page number footer on content pages (not on cover)
                        if (!isCover || pageNum > 1) {
                            pdf.setFontSize(8);
                            pdf.setTextColor(148, 163, 184);
                            pdf.text('SIPEDAS BPS Kabupaten Tasikmalaya  \u2022  Halaman ' + pageNum, marginLeft, pdfHeight - 16);
                        }
                        pageNum++;

                        // Advance currY to the next row boundary
                        let nextY = cutY;
                        if (hasTable && secData.table.rows.length > 0) {
                            const nextRow = secData.table.rows.find(r => r.top >= cutY - 2);
                            if (nextRow && nextRow.top > cutY) {
                                nextY = nextRow.top;
                            }
                        }
                        if (nextY <= currY) {
                            currY = cutY + 1;
                        } else {
                            currY = nextY;
                        }
                        isFirstPageOfSec = false;
                    }
                }
            } else {
                for (let srcY = 0; srcY < totalSrcHeight; srcY += maxCanvasSliceH) {
                    const contentH = Math.min(maxCanvasSliceH, totalSrcHeight - srcY);
                    if (contentH <= 0) break;

                    const sliceCanvas = document.createElement('canvas');
                    sliceCanvas.width = canvas.width;
                    sliceCanvas.height = contentH;
                    const sCtx = sliceCanvas.getContext('2d');
                    sCtx.fillStyle = '#ffffff';
                    sCtx.fillRect(0, 0, sliceCanvas.width, contentH);
                    sCtx.drawImage(canvas, 0, srcY, canvas.width, contentH, 0, 0, canvas.width, contentH);

                    const sliceData = sliceCanvas.toDataURL('image/jpeg', 0.95);
                    const slicePdfH = (contentH * contentWidth) / canvas.width;

                    if (pageNum > 1) pdf.addPage();
                    pdf.addImage(sliceData, 'JPEG', marginLeft, marginTop, contentWidth, slicePdfH);
                    pdf.setFontSize(8);
                    pdf.setTextColor(148, 163, 184);
                    pdf.text('SIPEDAS BPS Kabupaten Tasikmalaya  \u2022  Halaman ' + pageNum, marginLeft, pdfHeight - 16);
                    pageNum++;
                }
            }

            pdf.save(`${fileNameBase}.pdf`);

            if (reportContainer && reportContainer.parentNode) {
                reportContainer.parentNode.removeChild(reportContainer);
            }

            Swal.close();
            showToast('success', 'Berhasil', 'Laporan Deret Waktu (.pdf) berhasil diunduh.');
        }




    } catch (error) {

        console.error('Error during TS export:', error);

        // Ensure cleanup

        const tempEl = document.getElementById('ts-export-temp-report');

        if (tempEl && tempEl.parentNode) tempEl.parentNode.removeChild(tempEl);
        else if (reportContainer && reportContainer.parentNode) reportContainer.parentNode.removeChild(reportContainer);



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
        
        // Posisikan tepat di samping kanan kartu akun (selaras vertikal)
        const dropHeight = dropdown.offsetHeight || 105;
        let targetTop = rect.top + (rect.height / 2) - (dropHeight / 2);
        if (targetTop < 10) targetTop = 10;
        if (targetTop + dropHeight > window.innerHeight - 10) {
            targetTop = window.innerHeight - dropHeight - 10;
        }

        dropdown.style.top = Math.round(targetTop) + 'px';
        dropdown.style.left = Math.round(rect.right + 12) + 'px';
        card.classList.add('active');
    }
}

function hideUserMenu() {
    const dropdown = document.getElementById('sidebar-user-dropdown');
    const card = document.getElementById('sidebar-user-btn');
    if (dropdown) {
        dropdown.style.display = 'none';
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

        document.body.classList.toggle('role-admin', isAdmin);

        document.body.classList.toggle('role-pegawai', !isAdmin);

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
        if (opHeader) opHeader.style.display = 'none';

    } else {

        tsShowSources = false;

        if (btnLogin) btnLogin.style.setProperty('display', 'flex', 'important');
        if (userWidget) userWidget.style.setProperty('display', 'none', 'important');

        if (btnLogout) btnLogout.style.setProperty('display', 'none', 'important');

        document.querySelectorAll(".admin-only").forEach(el => el.style.setProperty('display', 'none', 'important'));

        const opHeader = document.getElementById('operator-header');
        if (opHeader) opHeader.style.setProperty('display', 'flex', 'important');

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

        updateRoleUI("admin");

        // Cross-tab sync: notify other tabs about login
        try { localStorage.setItem('sipedas_auth_event', JSON.stringify({ type: 'login', ts: Date.now() })); } catch(e) {}

        navigate('dashboard', document.getElementById('nav-dashboard'));

        showToast('success', 'Selamat Datang, Admin SIPEDAS!', 'Akses penuh Admin SIPEDAS aktif.', 3000);

    }

}



function adminLogout() {

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
    list.innerHTML = `<div class="text-center text-muted py-3">Memuat data...</div>`;
    loadAdminSummary();
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
            const base = API_BASE.replace(/\/api\/?$/, '');
            const a = document.createElement('a');
            a.href = `${base}/backups/${encodeURIComponent(data.file)}`;
            a.download = data.file;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);

            await loadAdminBackups();
            if (typeof loadDashboardBackupInfo === 'function') await loadDashboardBackupInfo();
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

        }

    });

}



function openDocFromDashboard(docId) {

    viewState.selectedDocId = docId;

    viewState.selectedBabNum = null;

    navigate('publikasi', document.getElementById('nav-publikasi'));

    populateDocumentList();

}



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

                '<td style="padding:10px; text-align:center; color:var(--text-secondary, #64748b);">' + (a.document_year || '') + '</td>' +

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
                <div class="d-flex gap-1.5 flex-shrink-0">
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

    if (!checkRoleAccess('admin')) return;

    document.querySelectorAll('.page-section').forEach(el => el.classList.remove('active'));

    document.querySelectorAll('.nav-link').forEach(el => el.classList.remove('active'));

    const page = document.getElementById('page-sistem');

    if (page) page.classList.add('active');

    const parent = document.getElementById('nav-sistem');

    if (parent) parent.classList.add('active');

    const el = element || document.getElementById(`nav-sistem-${tab}`);

    if (el) el.classList.add('active');

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

// Palet 60 warna unik, kontras tinggi, dan saling berselang-seling (Glasbey/Polychrome standard)
const TS_DISTINCT_60_COLORS = [
    '#2563eb', '#dc2626', '#16a34a', '#d97706', '#7c3aed',
    '#0891b2', '#db2777', '#4b5563', '#84cc16', '#4f46e5',
    '#ea580c', '#059669', '#9333ea', '#ca8a04', '#0284c7',
    '#e11d48', '#65a30d', '#6366f1', '#b45309', '#0d9488',
    '#c026d3', '#78716c', '#0369a1', '#be123c', '#15803d',
    '#f59e0b', '#6d28d9', '#0e7490', '#9f1239', '#3b82f6',
    '#4d7c0f', '#a855f7', '#78350f', '#14b8a6', '#f43f5e',
    '#312e81', '#854d0e', '#047857', '#ec4899', '#1e293b',
    '#06b6d4', '#eab308', '#8b5cf6', '#ef4444', '#10b981',
    '#f97316', '#008080', '#d946ef', '#374151', '#22c55e',
    '#4338ca', '#e05638', '#065f46', '#e59819', '#818cf8',
    '#fb7185', '#166534', '#c2410c', '#7e22ce', '#0f172a'
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
    const hint = document.getElementById('ts-view-mode-hint');

    if (btnChart) btnChart.classList.toggle('active', mode === 'chart');
    if (btnTable) btnTable.classList.toggle('active', mode === 'table');
    if (btnBoth) btnBoth.classList.toggle('active', mode === 'both');

    if (mode === 'chart') {
        if (secChart) secChart.style.display = 'block';
        if (secTable) secTable.style.display = 'none';
        if (hint) hint.innerHTML = '<i class="bi bi-graph-up text-primary me-1"></i> Visualisasi grafik deret waktu & analisis tren';
    } else if (mode === 'table') {
        if (secChart) secChart.style.display = 'none';
        if (secTable) secTable.style.display = 'block';
        if (hint) hint.innerHTML = '<i class="bi bi-table text-success me-1"></i> Matriks data tabular lengkap per tahun';
    } else { // 'both'
        if (secChart) secChart.style.display = 'block';
        if (secTable) secTable.style.display = 'block';
        if (hint) hint.innerHTML = '<i class="bi bi-layout-split text-info me-1"></i> Mode komparasi: Grafik visual & tabel data';
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

                <input type="checkbox" id="${checkboxId(i)}" class="ren-col-cb" value="${i}" data-header="${escHtml(h)}" ${meta ? 'disabled' : ''} style="width:18px;height:18px;accent-color:#8b5cf6;flex-shrink:0;cursor:pointer;" onchange="document.getElementById('${containerId(i)}').style.display=this.checked?'':'none'; updateRenameSelectedCount();">

                <span style="flex:1; min-width:240px; font-size:0.92rem; font-weight:600; color:#1e293b; white-space:normal; word-break:break-word; line-height:1.35; text-align:left; padding-right:8px;" title="${escHtml(h)}">${escHtml(h)}${meta ? ' <em style="color:#94a3b8;font-size:0.78rem;">(metadata)</em>' : ''}</span>

                

                <div id="${containerId(i)}" class="custom-select-container" style="display:none; position:relative; flex:1.4; min-width:460px;">

                    <div style="display:flex; align-items:center; gap:8px;">

                        <input type="text" id="${selectId(i)}" class="master-select-input" placeholder="” Cari & Pilih Master Kolom..." style="flex:1; min-width:220px; padding:8px 12px; border-radius:6px; border:1.5px solid #cbd5e1; font-size:0.88rem; background:#fff; cursor:pointer;" readonly onclick="showCustomDropdown(${i})" title="Klik untuk memilih master kolom">

                        ${sameKwCount > 1 ? `

                        <button type="button" title="Salin nilai master ini ke semua kolom yang mengandung '${escHtml(kw)}'" style="background:#f3e8ff; border:1px solid #d8b4fe; border-radius:6px; padding:7px 10px; cursor:pointer; font-size:0.78rem; color:#6b21a8; font-weight:600; display:flex; align-items:center; gap:4px; white-space:nowrap; flex-shrink:0;" onclick="copyMasterToSimilar(${i}, '${kw.replace(/'/g, "\\'")}')" onmouseenter="this.style.background=cssVar('--purple-50') || '#e9d5ff'" onmouseleave="this.style.background=cssVar('--purple-50') || '#f3e8ff'">

                            <span>📋 Salin Sejenis</span>

                        </button>

                        ` : ''}

                        <button type="button" title="Salin nilai master baris ini ke semua kolom yang tercentang" style="background:#f1f5f9; border:1px solid #cbd5e1; border-radius:6px; padding:7px 10px; cursor:pointer; font-size:0.78rem; color:var(--text-secondary, #475569); font-weight:500; display:flex; align-items:center; gap:4px; white-space:nowrap; flex-shrink:0;" onclick="copyMasterToChecked(${i})" onmouseenter="this.style.background=cssVar('--border') || '#e2e8f0'" onmouseleave="this.style.background=cssVar('--bg-hover') || '#f1f5f9'">

                            <span>📑 Ke Tercentang</span>

                        </button>

                    </div>

                    <div id="custom-dropdown-${i}" class="custom-select-dropdown" style="display:none; position:absolute; z-index:9999; max-height:280px; overflow-y:auto; background:#fff; border:1.5px solid #8b5cf6; border-radius:6px; margin-top:4px; padding:6px; width:100%; box-shadow:0 14px 28px rgba(0,0,0,0.18);">

                        <input type="text" id="custom-dropdown-search-${i}" placeholder="Ketik kata kunci pencarian..." autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" style="width:100%; padding:7px 10px; border:1px solid #cbd5e1; border-radius:4px; font-size:0.82rem; margin-bottom:6px; outline:none;" oninput="filterCustomDropdownOptions(${i}, this.value)">

                        <div id="custom-dropdown-options-${i}">

                            ${masterCols.map(c => `<div class="custom-dropdown-option" style="padding:8px 12px; cursor:pointer; border-radius:4px; font-size:0.85rem; white-space:normal; word-break:break-word; text-align:left; border-bottom:1px solid #f8fafc; transition:background 0.15s;" onclick="selectCustomOption(${i}, '${c.standard.replace(/'/g, "\'")}')" onmouseenter="this.style.background=cssVar('--purple-50') || '#f3e8ff'" onmouseleave="this.style.background='transparent'">${c.standard}</div>`).join('')}

                        </div>

                    </div>

                </div>

            </div>`;

        }).join('');



        const quickChipsHtml = uniqueKeywords.length > 1 ? `

            <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin-bottom:10px; padding:8px 12px; background:#fff; border:1px dashed #cbd5e1; border-radius:8px;">

                <span style="font-size:0.8rem; font-weight:700; color:var(--text-secondary, #475569);">🎯 Pilih Cepat Kolom:</span>

                ${uniqueKeywords.map(kw => `

                    <button type="button" style="background:#ede9fe; color:#6d28d9; border:1px solid #c4b5fd; border-radius:14px; padding:3px 12px; font-size:0.78rem; font-weight:600; cursor:pointer; transition:all 0.15s;" onclick="selectColumnsByKeyword('${kw.replace(/'/g, "\\'")}')" onmouseenter="this.style.background=cssVar('--purple-50') || '#ddd6fe'" onmouseleave="this.style.background=cssVar('--purple-50') || '#ede9fe'">

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

                        <input type="checkbox" id="ren-select-all-cb" style="width: 18px; height: 18px; accent-color: #8b5cf6; cursor: pointer;" onchange="toggleSelectAllRenameColumns(this)">

                        <label for="ren-select-all-cb" style="font-weight: 600; font-size: 0.92rem; color: #1e293b; cursor: pointer; margin: 0;">Pilih Semua Kolom Data</label>

                        <span id="ren-selected-count-badge" style="font-size: 0.78rem; font-weight: 600; padding: 3px 10px; border-radius: 20px; background: #f1f5f9; color: #64748b; transition: all 0.2s;">0 kolom dipilih</span>

                    </div>

                    <span style="font-size: 0.8rem; color: #64748b;">Pilih master di bawah untuk menerapkan ke banyak kolom sekaligus</span>

                </div>

                

                ${quickChipsHtml}

                

                <div style="display: flex; align-items: center; gap: 10px;">

                    <div class="custom-select-container" style="position: relative; flex: 1;">

                        <input type="text" id="bulk-ren-sel" class="master-select-input" placeholder="” Cari & Pilih Master Kolom untuk diterapkan massal..." style="width: 100%; padding: 9px 14px; border-radius: 8px; border: 1.5px solid #cbd5e1; font-size: 0.9rem; background: #fff; cursor: pointer; box-shadow: 0 1px 2px rgba(0,0,0,0.04);" readonly onclick="showBulkCustomDropdown()">

                        <div id="custom-dropdown-bulk" class="custom-select-dropdown" style="display: none; position: absolute; z-index: 10000; max-height: 380px; overflow-y: auto; background: #fff; border: 1.5px solid #8b5cf6; border-radius: 8px; margin-top: 6px; padding: 8px; width: 100%; box-shadow: 0 16px 36px rgba(0,0,0,0.18), 0 6px 12px rgba(0,0,0,0.08);">

                            <input type="text" id="custom-dropdown-search-bulk" placeholder="Ketik kata kunci master..." autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" style="width: 100%; padding: 8px 12px; border: 1.5px solid #cbd5e1; border-radius: 6px; font-size: 0.85rem; margin-bottom: 8px; outline:none;" oninput="filterBulkCustomDropdownOptions(this.value)">

                            <div id="custom-dropdown-options-bulk">

                                ${masterCols.map(c => `<div class="custom-dropdown-option" style="padding: 8px 12px; cursor: pointer; border-radius: 6px; font-size: 0.85rem; white-space: normal; word-break: break-word; text-align: left; border-bottom: 1px solid #f8fafc; transition: background 0.15s;" onclick="selectBulkCustomOption('${c.standard.replace(/'/g, "\'")}')" onmouseenter="this.style.background=cssVar('--purple-50') || '#f3e8ff'" onmouseleave="this.style.background='transparent'">${c.standard}</div>`).join('')}

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

        const secs = String(now.getSeconds()).padStart(2, '0');

        clockEl.textContent = `${hrs}:${mins}:${secs}`;



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

    localStorage.setItem('sipedas_sidebar_collapsed', isCollapsed ? 'true' : 'false');

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
        document.body.style.overflow = '';
    } else {
        overlay.style.display = 'block';
        requestAnimationFrame(() => {
            sidebar.classList.add('mobile-open');
            overlay.classList.add('active');
        });
        document.body.style.overflow = 'hidden';
    }
}



function initSidebarState() {

    const savedState = localStorage.getItem('sipedas_sidebar_collapsed');

    if (savedState === 'true') {

        document.body.classList.add('sidebar-collapsed');

    }

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

            if (!document.body.classList.contains('sidebar-collapsed')) return;



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

    const filenameInput = document.getElementById('create-doc-filename');

    

    const nextYr = new Date().getFullYear() + 1;

    const initialYr = nextYr > 2026 ? nextYr : 2027;

    if (yearInput) yearInput.value = initialYr;



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

    const yr = document.getElementById('create-doc-year')?.value || '2027';

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

            pdfBox.classList.add('border-primary');

            pdfBox.style.backgroundColor = 'rgba(37, 99, 235, 0.08)';

        }

        if (emptyBox) {

            emptyBox.classList.remove('border-primary');

            emptyBox.style.backgroundColor = '';

        }

        if (pdfContainer) pdfContainer.style.display = 'block';

    } else {

        if (emptyRadio) emptyRadio.checked = true;

        if (emptyBox) {

            emptyBox.classList.add('border-primary');

            emptyBox.style.backgroundColor = 'rgba(37, 99, 235, 0.08)';

        }

        if (pdfBox) {

            pdfBox.classList.remove('border-primary');

            pdfBox.style.backgroundColor = '';

        }

        if (pdfContainer) pdfContainer.style.display = 'none';

    }

}



async function submitCreateDoc() {

    const yearInput = document.getElementById('create-doc-year');

    const filenameInput = document.getElementById('create-doc-filename');

    const pdfRadio = document.getElementById('doc-mode-pdf');

    const fileInput = document.getElementById('create-doc-file');



    const year = yearInput ? parseInt(yearInput.value) : null;

    const filename = filenameInput ? filenameInput.value.trim() : '';

    const isPdfMode = pdfRadio ? pdfRadio.checked : false;



    if (!year || isNaN(year)) {

        showToast('warning', 'Peringatan', 'Silakan masukkan tahun publikasi!');

        if (yearInput) yearInput.focus();

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

                year: year

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



        const fromCreateTable = _createDocCallback;

        _createDocCallback = false;



        if (fromCreateTable) {

            // Kembali ke modal create table dan langsung pilih publikasi yang baru dibuat

            Swal.fire({

                title: '🎉 Publikasi Berhasil Dibuat!',

                text: `Publikasi '${filename}' (${year}) siap digunakan. Membuka formulir tambah tabel...`,

                icon: 'success',

                timer: 1600,

                showConfirmButton: false

            });

            setTimeout(() => {

                openCreateTableModal(createdDoc.id);

            }, 600);

        } else {

            Swal.fire({

                title: '🎉 Publikasi Berhasil Ditambahkan!',

                html: `<div class="text-start small text-muted">

                    <p class="mb-1"><b>Nama:</b> ${escHtml(createdDoc.filename)}</p>

                    <p class="mb-2"><b>Tahun:</b> ${createdDoc.year}</p>

                    <p class="text-dark mb-0">Publikasi telah terdaftar. Anda dapat langsung menambahkan tabel baru ke publikasi ini.</p>

                </div>`,

                icon: 'success',

                showCancelButton: true,

                confirmButtonColor: cssVar('--info') || '#2563eb',

                cancelButtonColor: cssVar('--text-secondary') || '#64748b',

                confirmButtonText: '➕ Tambah Tabel ke Publikasi Ini',

                cancelButtonText: 'Tutup'

            }).then((res) => {

                if (res.isConfirmed) {

                    openCreateTableModal(createdDoc.id);

                }

            });

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

                    opts += `<option value="${d.id}" data-year="${d.year || ''}" ${isSelected ? 'selected' : ''}>${escHtml(pubTitle)}</option>`;

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



    updateCreateTableBabOptions();

    updateCreateTableNumberPrefix();



    const modalEl = document.getElementById('modal-create-table');

    if (modalEl) {

        const modal = bootstrap.Modal.getOrCreateInstance(modalEl);

        modal.show();

    }

}



function updateCreateTableBabOptions() {

    const docSelect = document.getElementById('create-table-doc-id');

    const colYearInput = document.getElementById('create-table-col-year');

    if (!docSelect) return;



    const opt = docSelect.options[docSelect.selectedIndex];

    if (opt && opt.dataset.year && colYearInput && !colYearInput.value) {

        colYearInput.value = opt.dataset.year;

    }

}



function updateCreateTableNumberPrefix() {

    const babSelect = document.getElementById('create-table-bab-num');

    const numInput = document.getElementById('create-table-number');

    if (!babSelect || !numInput) return;



    const bab = babSelect.value || '1';

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

            if (result.isConfirmed) {

                navigateToEditor(newTableId, fullTableName, 'db');

            }

        });



    } catch (e) {

        Swal.close();

        showToast('error', 'Gagal', e.message || 'Terjadi kesalahan saat membuat tabel');

    }

}



