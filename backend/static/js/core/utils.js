let __excelDragFiles = [];

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
    let borderColor = '#3b82f6';
    let iconBg = '#dbeafe';
    let iconColor = '#1d4ed8';
    
    if (icon === 'success') {
        borderColor = '#10b981';
        iconBg = '#d1fae5';
        iconColor = '#047857';
        iconSvg = '<svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"></path></svg>';
    } else if (icon === 'error') {
        borderColor = '#ef4444';
        iconBg = '#fee2e2';
        iconColor = '#b91c1c';
        iconSvg = '<svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>';
    } else if (icon === 'warning') {
        borderColor = '#f59e0b';
        iconBg = '#fef3c7';
        iconColor = '#b45309';
        iconSvg = '<svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>';
    } else {
        borderColor = '#3b82f6';
        iconBg = '#dbeafe';
        iconColor = '#1d4ed8';
        iconSvg = '<svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>';
    }

    toast.style.cssText = `
        pointer-events: auto;
        background: #ffffff;
        color: #1e293b;
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
            ${title ? `<div style="font-weight:600; font-size:0.9rem; color:#0f172a; line-height:1.3; margin-bottom:${text ? '2px' : '0'};">${title}</div>` : ''}
            ${text ? `<div style="font-size:0.8rem; color:#64748b; line-height:1.35; word-break:break-word;">${text}</div>` : ''}
        </div>
        <button type="button" style="background:none; border:none; color:#94a3b8; cursor:pointer; padding:0; margin-left:4px; font-size:1.1rem; line-height:1;" onclick="this.parentElement.remove()">×</button>
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
                input.style.borderColor = '#8b5cf6';
                input.style.background = '#ede9fe';
                input.style.color = '#1e1b4b';
                input.style.fontWeight = '600';
                setTimeout(() => {
                    input.style.borderColor = '#cbd5e1';
                    input.style.background = '#fff';
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
        badge.style.background = checkedCount > 0 ? '#ede9fe' : '#f1f5f9';
        badge.style.color = checkedCount > 0 ? '#7c3aed' : '#64748b';
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
            input.style.borderColor = '#8b5cf6';
            input.style.background = '#ede9fe';
            input.style.color = '#1e1b4b';
            input.style.fontWeight = '600';
            setTimeout(() => {
                input.style.borderColor = '#cbd5e1';
                input.style.background = '#fff';
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
            input.style.borderColor = '#8b5cf6';
            input.style.background = '#ede9fe';
            input.style.color = '#1e1b4b';
            input.style.fontWeight = '600';
            setTimeout(() => {
                input.style.borderColor = '#cbd5e1';
                input.style.background = '#fff';
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

const API_BASE = "http://127.0.0.1:8000/api";

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
    // Terapkan default UI role pegawai secara instan sebelum async session check
    updateRoleUI('pegawai');

    // Check auth session dari backend (cookie-based)
    const role = await checkAuthSession();
    
    // Default landing page berdasarkan role
    if (role === 'admin') {
        navigate('dashboard', document.getElementById('nav-dashboard'));
    } else {
        navigate('timeseries', document.getElementById('nav-timeseries'));
    }
    populateDocumentList();
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
    const tickColor = isDark ? '#94a3b8' : '#64748b';
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
    // Tutup semua popover yang mungkin terbuka saat sidebar di-toggle
    document.querySelectorAll('.sidebar-floating-popover').forEach(p => {
        p.classList.remove('popover-visible');
        p.style.display = '';
    });
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

        let hideTimeout = null;

        function showPopover() {
            if (!document.body.classList.contains('sidebar-collapsed')) return;

            // Pindahkan popover ke body jika belum
            if (popover.parentNode !== document.body) {
                document.body.appendChild(popover);
            }

            // Hitung posisi berdasarkan bounding rect nav-link
            const rect = navLink.getBoundingClientRect();
            const sidebarRect = sidebarEl.getBoundingClientRect();

            popover.style.position = 'fixed';
            popover.style.top = rect.top + 'px';
            popover.style.left = (sidebarRect.right + 8) + 'px';
            popover.style.display = 'block';

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

