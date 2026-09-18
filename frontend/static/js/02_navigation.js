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
    document.querySelectorAll('.popover-item').forEach(el => el.classList.remove('active'));

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
        const icon = container.querySelector('.edit-pencil-icon');
        if (container.classList.contains('table-number-wrapper')) {
            container.style.border = isReadOnly ? '1px solid var(--border, #cbd5e1)' : '1px dashed #cbd5e1';
            container.style.background = isReadOnly ? 'var(--bg-page, #f8fafc)' : (cssVar('--bg-page') || '#fafafa');
            return;
        }

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
            <div class="editor-toolbar-inner">
                <!-- Baris 1 / Sesi Navigasi & Mode -->
                <div class="toolbar-section toolbar-section-nav">
                    <!-- Tombol Kembali -->
                    <button onclick="backToTableList()" class="btn btn-sm btn-toolbar btn-toolbar-back" title="Kembali ke Daftar Tabel">
                        <i class="bi bi-arrow-left"></i> Kembali
                    </button>
                    
                    <!-- Tombol Navigasi Prev / Next -->
                    <div id="nav-buttons" class="btn-group toolbar-nav-group" role="group">
                        <button id="btn-prev" onclick="navigateTable('prev')" class="btn btn-sm btn-toolbar btn-toolbar-prev" title="Tabel Sebelumnya">
                            <i class="bi bi-chevron-left"></i> Prev
                        </button>
                        <button id="btn-next" onclick="navigateTable('next')" class="btn btn-sm btn-toolbar btn-toolbar-next" title="Tabel Selanjutnya">
                            Next <i class="bi bi-chevron-right"></i>
                        </button>
                    </div>

                    <!-- Beralih ke Edit Data -->
                    <button onclick="switchToCsvEdit(${tableId}, '${tn}')" class="btn btn-sm btn-primary btn-toolbar btn-toolbar-edit" title="Beralih ke mode pengeditan data">
                        <i class="bi bi-pencil-square"></i> Edit Data
                    </button>
                </div>

                <div class="vr mx-1 my-auto toolbar-vr" style="height:20px; opacity:0.25;"></div>

                <!-- Baris 2 / Sesi Ekspor & Analisis -->
                <div class="toolbar-section toolbar-section-actions">
                    <div class="btn-group toolbar-export-group" role="group">
                        <button onclick="downloadExcel(${tableId})" class="btn btn-sm btn-toolbar btn-toolbar-excel" title="Unduh format Microsoft Excel (.xlsx)">
                            <i class="bi bi-file-earmark-excel-fill"></i> Excel (.xlsx)
                        </button>
                        <button onclick="downloadCsv(${tableId})" class="btn btn-sm btn-toolbar btn-toolbar-csv" title="Unduh format CSV">
                            <i class="bi bi-filetype-csv"></i> CSV
                        </button>
                    </div>

                    <!-- Analisis Deret Waktu -->
                    <button onclick="openTimeSeriesForTable(${tableId}, '${tn}')" class="btn btn-sm btn-toolbar btn-toolbar-ts" title="Buka analisis grafik deret waktu">
                        <i class="bi bi-graph-up-arrow"></i> Deret Waktu
                    </button>
                </div>

                <!-- Status Badge -->
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

        clockEl.textContent = `${hrs}:${mins}`;



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
    document.documentElement.classList.toggle('sidebar-collapsed-early', isCollapsed);

    try {
        localStorage.setItem('sipedas_sidebar_collapsed', isCollapsed ? 'true' : 'false');
        document.cookie = `sipedas_sidebar_collapsed=${isCollapsed ? 'true' : 'false'}; path=/; max-age=31536000; SameSite=Lax`;
    } catch(e) {}

    // Jika sidebar baru saja dibuka (expanded):
    // Pastikan submenu yang sedang memiliki tab aktif otomatis terbuka
    if (!isCollapsed) {
        const activeAdminSub = document.querySelector('#admin-submenu .subnav-link.active');
        if (activeAdminSub) {
            const sub = document.getElementById('admin-submenu');
            const icon = document.getElementById('admin-submenu-icon');
            if (sub) sub.style.display = 'block';
            if (icon) icon.classList.add('open');
        }
        const activeSistemSub = document.querySelector('#sistem-submenu .subnav-link.active');
        if (activeSistemSub) {
            const sub = document.getElementById('sistem-submenu');
            const icon = document.getElementById('sistem-submenu-icon');
            if (sub) sub.style.display = 'block';
            if (icon) icon.classList.add('open');
        }
    }

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
        document.documentElement.classList.remove('mobile-sidebar-active');
        document.body.classList.remove('mobile-sidebar-active');
        document.body.style.overflow = '';
    } else {
        if (window.innerWidth < 992) {
            document.body.classList.remove('sidebar-collapsed');
            document.documentElement.classList.remove('sidebar-collapsed-early');
        }
        overlay.style.display = 'block';
        requestAnimationFrame(() => {
            sidebar.classList.add('mobile-open');
            overlay.classList.add('active');
        });
        document.documentElement.classList.add('mobile-sidebar-active');
        document.body.classList.add('mobile-sidebar-active');
        document.body.style.overflow = 'hidden';
    }
}



function initSidebarState() {
    try {
        if (window.innerWidth < 992) {
            document.body.classList.remove('sidebar-collapsed');
            document.documentElement.classList.remove('sidebar-collapsed-early');
            return;
        }

        const savedState = localStorage.getItem('sipedas_sidebar_collapsed');
        const hasCookie = document.cookie.indexOf('sipedas_sidebar_collapsed=true') !== -1;
        const isCollapsed = savedState === 'true' || (savedState === null && hasCookie);

        if (isCollapsed) {
            document.body.classList.add('sidebar-collapsed');
            document.documentElement.classList.add('sidebar-collapsed-early');
        } else if (savedState === 'false') {
            document.body.classList.remove('sidebar-collapsed');
            document.documentElement.classList.remove('sidebar-collapsed-early');
        }
    } catch(e) {}
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
            // Hanya aktif di layar Desktop (>= 992px) saat sidebar dalam mode collapsed/icon-only
            if (window.innerWidth < 992 || !document.body.classList.contains('sidebar-collapsed')) return;



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



