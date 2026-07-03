
// --- SWEETALERT2 MODALS ---

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


document.addEventListener("DOMContentLoaded", () => {
    loadDashboardStats();
    populateDocumentList();
    
    document.getElementById("upload-form").addEventListener("submit", async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const btn = e.target.querySelector('button');
        btn.disabled = true;

        Swal.fire({
            title: 'Mengunggah PDF...',
            text: 'Mohon tunggu sebentar, file sedang diunggah ke server',
            allowOutsideClick: false,
            didOpen: () => {
                Swal.showLoading();
            }
        });

        try {
            const res = await fetch(`${API_BASE}/documents`, { method: "POST", body: formData });
            if (res.ok) {
                const doc = await res.json();
                await loadDocuments();
                await populateDocumentList();
                Swal.fire("Berhasil", "Upload sukses! Silakan masukkan rentang halaman lalu klik Ekstrak.", "success");
            } else {
                Swal.fire("Gagal", "Gagal mengunggah PDF.", "error");
            }
        } catch (err) {
            Swal.fire("Gagal", "Terjadi kesalahan upload.", "error");
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

// ===================== NAVIGATION =====================
function navigate(pageId, element) {
    // Jika sedang dalam mode edit dan mencoba keluar dari editor, minta konfirmasi
    if (editorState && editorState.mode === 'csv-edit' && pageId !== 'editor') {
        Swal.fire({
            title: 'Batalkan Pengeditan?',
            text: "Semua perubahan data yang belum disimpan akan hilang.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            cancelButtonColor: '#cbd5e1',
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
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));

    const page = document.getElementById(`page-${pageId}`);
    if (page) page.classList.add('active');
    if (element) element.classList.add('active');

    // Sembunyikan nav editor jika keluar dari editor
    if (pageId !== 'editor') {
        const editorNav = document.getElementById('nav-editor');
        if (editorNav) editorNav.classList.remove('active');
        // Reset editor state
        editorState.mode = 'csv-view';
    }

    // Scroll ke atas
    const mc = document.querySelector('.main-content');
    if (mc) mc.scrollTop = 0;

    if (pageId === 'dashboard') loadDashboardStats();
    if (pageId === 'publikasi') loadDocuments();
    if (pageId === 'tabel') populateDocumentList();
}

/** Navigate to the full-page editor. Mode: 'csv' or 'db' */
function navigateToEditor(tableId, tableName, mode = 'csv') {
    editorState = { tableId, tableName, mode };

    // Show editor page
    document.querySelectorAll('.page-section').forEach(el => el.classList.remove('active'));
    document.getElementById('page-editor').classList.add('active');

    // Scroll to top
    const mc = document.querySelector('.main-content');
    if (mc) mc.scrollTop = 0;

    // Set title + badge
    let displayName = tableName;
    let pageText = '';
    const pageMatch = tableName.match(/(.*?)\s*(\([Hh]al.*?\))\s*$/i);
    if (pageMatch) { displayName = pageMatch[1]; pageText = pageMatch[2]; }

    // Pisahkan nomor tabel (e.g. Tabel 1.1.1 atau 1.1.1) dari nama tabel
    let displayNum = '';
    let displayNameOnly = displayName;
    const numMatch = displayName.match(/^(Tabel[\s_]*\d+(?:\.\d+)*\s*|^\d+(?:\.\d+)+\s*)(?:-\s*|:\s*|)/i);
    if (numMatch) {
        displayNum = numMatch[1].trim();
        displayNameOnly = displayName.substring(numMatch[0].length).trim();
    }

    const tableNumEl = document.getElementById('editor-table-number');
    if (tableNumEl) {
        tableNumEl.value = displayNum;
        tableNumEl.style.display = 'inline-block';
    }

    const titleEl = document.getElementById('editor-title');
    if (titleEl) {
        titleEl.value = displayNameOnly;
    }

    const pageTag = document.getElementById('editor-page-tag');
    if (pageTag) {
        pageTag.textContent = pageText;
        pageTag.style.display = pageText ? 'inline' : 'none';
    }

    const badge = document.getElementById('editor-mode-badge');
    if (badge) {
        if (mode === 'csv-view') {
            badge.textContent = 'Lihat CSV';
            badge.className = 'editor-mode-badge badge-csv-view';
        } else if (mode === 'csv-edit') {
            badge.textContent = 'Edit CSV';
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
            container.style.background = '#fafafa';
            container.setAttribute('onmouseenter', "this.style.borderColor='#4F46E5'; this.style.background='#ffffff';");
            container.setAttribute('onmouseleave', "this.style.borderColor='#cbd5e1'; this.style.background='#fafafa';");
            if (icon) icon.style.display = 'inline';
        }
    });
}

async function saveTableIdentityInline() {
    const tableId = editorState.tableId;
    if (!tableId) return;

    const numVal = document.getElementById('editor-table-number')?.value?.trim() || '';
    const titleVal = document.getElementById('editor-title')?.value?.trim() || '';

    if (!titleVal) {
        return; // Jangan simpan jika judul kosong
    }

    const fullNewName = numVal ? `${numVal} - ${titleVal}` : titleVal;
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
            Swal.fire("Gagal", `Gagal menyimpan nama tabel: ${errData.detail || 'Terjadi kesalahan'}`, "error");
        }
    } catch(e) {
        console.error("Gagal menyimpan identitas tabel", e);
        Swal.fire("Error", "Terjadi kesalahan jaringan saat menyimpan nama tabel.", "error");
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
            confirmButtonColor: '#ef4444',
            cancelButtonColor: '#cbd5e1',
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

    // Default flow: kembali ke daftar tabel
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    const tabelNav = document.getElementById('nav-tabel');
    if (tabelNav) tabelNav.classList.add('active');
    
    document.querySelectorAll('.page-section').forEach(el => el.classList.remove('active'));
    document.getElementById('page-tabel').classList.add('active');
    
    const mc = document.querySelector('.main-content');
    if (mc) mc.scrollTop = 0;
    populateDocumentList();
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

/** Build the action toolbar inside editor-toolbar div */
function buildEditorToolbar(tableId, tableName, mode) {
    const toolbar = document.getElementById('editor-toolbar');
    if (!toolbar) return;
    const tn = tableName.replace(/'/g, "\\'");
    if (mode === 'csv-view') {
        toolbar.innerHTML = `
            <button onclick="backToTableList()" class="editor-tool-btn btn-slate" style="background:#475569; color:white; border: 1px solid #334155;">← Kembali</button>
            <button onclick="downloadCsv(${tableId})" class="editor-tool-btn btn-indigo">Download CSV</button>
            <button onclick="switchToCsvEdit(${tableId}, '${tn}')" class="editor-tool-btn btn-slate">Beralih ke Edit CSV</button>
            <span style="margin-left:auto; font-size:0.8rem; color:#94a3b8; display:flex; align-items:center; gap:6px;">
                <span style="background:#f1f5f9; color:#64748b; border:1px solid #cbd5e1; padding:3px 10px; border-radius:20px; font-weight:600;">Mode Lihat (Baca Saja)</span>
            </span>
        `;
    } else if (mode === 'csv-edit') {
        toolbar.innerHTML = `
            <button onclick="backToTableList()" class="editor-tool-btn btn-danger" style="background:#ef4444; color:white; border: 1px solid #dc2626;">← Kembali / Batal</button>
            <button onclick="downloadCsv(${tableId})" class="editor-tool-btn btn-indigo">Download CSV</button>
            <button onclick="saveCsvChangesToServer(${tableId})" class="editor-tool-btn btn-green" style="background:#10b981;">Simpan Perubahan</button>
            <span style="margin-left:auto; font-size:0.8rem; color:#94a3b8;">Klik <b>header kolom</b> untuk rename · Klik <b>sel</b> untuk edit</span>
        `;
    } else {
        toolbar.innerHTML = `
            <button onclick="backToTableList()" class="editor-tool-btn btn-slate" style="background:#475569; color:white; border: 1px solid #334155;">← Kembali</button>
            <button onclick="markAllSafeInTable(${tableId}, '${tn}')" class="editor-tool-btn btn-green" style="background:#10b981; color:white; border: 1px solid #059669; font-weight:600; cursor:pointer;">✔️ Tandai Semua Aman</button>
            <span style="margin-left:auto; font-size:0.8rem; color:#94a3b8;">Baris <span style='color:#ef4444;font-weight:700;'>merah</span> = data anomali. Auto-save aktif.</span>
        `;
    }
}

/** Switch from CSV view mode to CSV edit mode */
function switchToCsvEdit(tableId, tableName) {
    editorState.mode = 'csv-edit';
    const badge = document.getElementById('editor-mode-badge');
    if (badge) { badge.textContent = 'Edit CSV'; badge.className = 'editor-mode-badge badge-csv'; }
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
        container.style.background = '#fafafa';
        container.setAttribute('onmouseenter', "this.style.borderColor='#4F46E5'; this.style.background='#ffffff';");
        container.setAttribute('onmouseleave', "this.style.borderColor='#cbd5e1'; this.style.background='#fafafa';");
        if (icon) icon.style.display = 'inline';
    });

    _loadCsvIntoEditor(tableId, tableName, true);
}

let dashboardChartInstance = null;

// Page 1: Dashboard Stats
async function loadDashboardStats() {
    const adminView = document.getElementById('dashboard-admin-view');
    const pegawaiView = document.getElementById('dashboard-pegawai-view');
    const welcomeRoleText = document.getElementById('welcome-role-text');
    
    if (currentUserRole === 'admin') {
        if (adminView) adminView.style.display = 'block';
        if (pegawaiView) pegawaiView.style.display = 'none';
        if (welcomeRoleText) welcomeRoleText.textContent = '🔒 Anda masuk sebagai Admin System (Kontrol Penuh).';
    } else {
        if (adminView) adminView.style.display = 'none';
        if (pegawaiView) pegawaiView.style.display = 'block';
        if (welcomeRoleText) welcomeRoleText.textContent = '🏠 Anda masuk sebagai Pegawai BPS Tasikmalaya.';
    }

    try {
        const res = await fetch(`${API_BASE}/stats`);
        if(res.ok) {
            const stats = await res.json();
            if (currentUserRole === 'admin') {
                const docEl = document.getElementById('stat-docs');
                const tabEl = document.getElementById('stat-tables');
                const rowEl = document.getElementById('stat-rows');
                const anoEl = document.getElementById('stat-anomalies');
                if (docEl) docEl.textContent = stats.total_docs;
                if (tabEl) tabEl.textContent = stats.total_tables;
                if (rowEl) rowEl.textContent = stats.total_rows;
                if (anoEl) anoEl.textContent = stats.total_anomalies;
            } else {
                const uDocEl = document.getElementById('user-stat-docs');
                const uTabEl = document.getElementById('user-stat-tables');
                const uRowEl = document.getElementById('user-stat-rows');
                if (uDocEl) uDocEl.textContent = stats.total_docs;
                if (uTabEl) uTabEl.textContent = stats.total_tables;
                if (uRowEl) uRowEl.textContent = stats.total_rows;
            }
        }
        
        // Load anomalies list untuk admin
        if (currentUserRole === 'admin') {
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
            
            // Load recent extraction activities (ambil 5 dokumen teratas)
            const docsRes = await fetch(`${API_BASE}/documents`);
            if (docsRes.ok) {
                const docs = await docsRes.json();
                const recentTbody = document.getElementById('admin-recent-tbody');
                if (recentTbody) {
                    if (docs.length === 0) {
                        recentTbody.innerHTML = `<tr><td colspan="4" style="text-align: center; padding: 20px; color: #64748b;">Belum ada publikasi yang di-upload.</td></tr>`;
                    } else {
                        const sortedDocs = [...docs].sort((a,b) => b.id - a.id).slice(0, 5);
                        recentTbody.innerHTML = sortedDocs.map(d => {
                            let statusBadge = '';
                            if (d.status === 'ready') statusBadge = '<span style="background:#dcfce7;color:#15803d;padding:4px 10px;border-radius:20px;font-size:0.75rem;font-weight:700;">✔ Siap</span>';
                            else if (d.status.startsWith('extracting')) statusBadge = '<span style="background:#fef3c7;color:#b45309;padding:4px 10px;border-radius:20px;font-size:0.75rem;font-weight:700;">⏳ Ekstraksi...</span>';
                            else if (d.status.startsWith('error')) statusBadge = `<span style="background:#fee2e2;color:#b91c1c;padding:4px 10px;border-radius:20px;font-size:0.75rem;font-weight:700;" title="${d.status}">⚠ Gagal</span>`;
                            else statusBadge = `<span style="background:#f1f5f9;color:#475569;padding:4px 10px;border-radius:20px;font-size:0.75rem;font-weight:700;">${d.status}</span>`;

                            return `
                                <tr style="border-bottom: 1px solid #f1f5f9;">
                                    <td style="padding: 10px; font-weight: 500; color: #334155; max-width: 450px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${d.filename}">
                                        📁 ${d.filename}
                                    </td>
                                    <td style="padding: 10px; text-align: center; color: #64748b;">${d.year}</td>
                                    <td style="padding: 10px; text-align: center;">${statusBadge}</td>
                                    <td style="padding: 10px; text-align: center;">
                                        <button class="btn btn-small" style="background:#4f46e5; border-color:#4f46e5; color:white; padding:4px 10px; font-size:0.8rem; cursor:pointer;" onclick="openDocFromDashboard(${d.id})">
                                            Buka Publikasi
                                        </button>
                                    </td>
                                </tr>
                            `;
                        }).join('');
                    }
                }
            }
        }
        
        // Render Chart.js untuk Pegawai
        if (currentUserRole !== 'admin') {
            const chartRes = await fetch(`${API_BASE}/stats/chart`);
            if (chartRes.ok) {
                const chartData = await chartRes.json();
                const canvas = document.getElementById('dashboardChart');
                if (canvas) {
                    const ctx = canvas.getContext('2d');
                    if (dashboardChartInstance) {
                        dashboardChartInstance.destroy();
                    }
                    dashboardChartInstance = new Chart(ctx, {
                        type: 'bar',
                        data: chartData,
                        options: {
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: {
                                legend: {
                                    display: true,
                                    position: 'top',
                                    labels: { font: { family: "'Inter', sans-serif", size: 11 } }
                                }
                            },
                            scales: {
                                y: { beginAtZero: true, ticks: { font: { family: "'Inter', sans-serif", size: 10 } } },
                                x: { ticks: { font: { family: "'Inter', sans-serif", size: 10 } } }
                            }
                        }
                    });
                }
            }
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
        confirmButtonColor: '#10b981',
        cancelButtonColor: '#cbd5e1',
        confirmButtonText: 'Ya, Tandai Semua Aman',
        cancelButtonText: 'Batal'
    }).then(async (result) => {
        if (result.isConfirmed) {
            try {
                const res = await fetch(`${API_BASE}/admin/safe-all`, { method: "PUT" });
                if (res.ok) {
                    Swal.fire('Berhasil!', 'Seluruh database telah bersih dari anomali.', 'success');
                    loadDashboardStats();
                } else {
                    Swal.fire('Gagal', 'Gagal memproses permintaan.', 'error');
                }
            } catch(e) {
                Swal.fire('Error', e.message, 'error');
            }
        }
    });
}

// Page 2: Publikasi List
async function loadDocuments() {
    const res = await fetch(`${API_BASE}/documents`);
    const docs = await res.json();
    const tbody = document.getElementById("docs-tbody");
    
    // Simpan input user saat ini (agar tidak hilang saat auto-refresh)
    const savedInputs = {};
    document.querySelectorAll("input[id^='start-']").forEach(inp => savedInputs[inp.id] = inp.value);
    document.querySelectorAll("input[id^='end-']").forEach(inp => savedInputs[inp.id] = inp.value);
    document.querySelectorAll("select[id^='select-bab-']").forEach(sel => savedInputs[sel.id] = sel.value);
    
    tbody.innerHTML = "";
    
    docs.forEach(doc => {
        let statusClass = "status-pending";
        if (doc.status === "ready") statusClass = "status-done";
        if (doc.status.startsWith("error")) statusClass = "status-pending"; // keep it simple
        
        let actionsHtml = "";
        if (doc.status === "ready" || doc.status.startsWith("error") || doc.status === "pending") {
            actionsHtml = `
                <div style="display:flex; flex-direction:column; gap: 0.3rem; margin-top: 0.5rem; align-items: stretch; max-width: 320px;">
                    <div style="margin-bottom: 2px;">
                        <select id="select-bab-${doc.id}" style="width: 100%; padding: 0.3rem; border-radius: 4px; border: 1px solid #cbd5e1; font-size: 0.85rem;">
                            <option value="">Memuat daftar bab...</option>
                        </select>
                    </div>
                    <div style="display:flex; gap: 0.3rem; align-items:center; margin-bottom: 2px;">
                        <button onclick="detectToc(${doc.id})" class="btn btn-small" style="flex: 1; font-size: 0.8rem; background-color: #10b981; color: white; padding: 0.35rem 0.5rem; border-radius: 4px; border: none; cursor: pointer;">🔍 Deteksi Bab Otomatis</button>
                        <button onclick="openTocEditor(${doc.id}, '${doc.filename}')" class="btn btn-small" style="flex: 1; font-size: 0.8rem; background-color: #6366f1; color: white; padding: 0.35rem 0.5rem; border-radius: 4px; border: none; cursor: pointer;">✏️ Edit Bab Manual</button>
                    </div>
                    <div style="display:flex; gap: 0.5rem; align-items:center;">
                        <input type="number" id="start-${doc.id}" placeholder="Hal Awal" style="width: 80px; padding: 0.3rem; border-radius: 4px; border: 1px solid #cbd5e1;">
                        <input type="number" id="end-${doc.id}" placeholder="Hal Akhir" style="width: 80px; padding: 0.3rem; border-radius: 4px; border: 1px solid #cbd5e1;">
                    </div>
                    <div style="display:flex; gap: 0.5rem; align-items:center; margin-top: 5px;">
                        <button onclick="extractPages(${doc.id})" class="btn btn-small btn-primary" style="flex: 1;">Ekstrak</button>
                        <button onclick="deleteDocument(${doc.id})" class="btn btn-small btn-danger" style="background-color: #ef4444;">Hapus</button>
                    </div>
                </div>
            `;
        }
        
        tbody.innerHTML += `
            <tr>
                <td>${doc.filename}</td>
                <td>${doc.year}</td>
                <td>
                    <span class="status-badge ${statusClass}">${doc.status.toUpperCase()}</span>
                    ${actionsHtml}
                </td>
            </tr>
        `;
    });
    
    // Kembalikan input user
    for (const [id, val] of Object.entries(savedInputs)) {
        const inp = document.getElementById(id);
        if (inp) inp.value = val;
    }

    // Panggil fungsi pembuat dropdown bab dinamis
    docs.forEach(doc => {
        if (doc.status === "ready" || doc.status.startsWith("error") || doc.status === "pending") {
            populateBabDropdown(doc.id);
        }
    });
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
        
        if (res.ok) {
            const data = await res.json();
            Swal.fire({
                title: 'Berhasil!',
                text: data.message || 'Deteksi bab otomatis selesai.',
                icon: 'success',
                timer: 2000,
                showConfirmButton: false
            });
            await populateBabDropdown(docId);
        } else {
            const err = await res.json();
            Swal.fire('Gagal', err.detail || 'Gagal mendeteksi bab secara otomatis.', 'error');
        }
    } catch (e) {
        Swal.fire('Error', e.message, 'error');
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

        // Buat editor HTML
        let editorHtml = `
            <div style="max-height: 400px; overflow-y: auto; text-align: left; padding: 0.5rem;" id="toc-editor-rows">
                <p style="font-size: 0.85rem; color: #64748b; margin-bottom: 1rem;">
                    Edit atau tambahkan bab dan halaman jangkauannya secara manual. Klik Simpan jika sudah selesai.
                </p>
        `;

        function renderRow(title, start, end, index) {
            return `
                <div class="toc-row" data-index="${index}" style="display: flex; gap: 8px; align-items: center; margin-bottom: 8px;">
                    <input type="text" class="toc-title" value="${title}" placeholder="Judul Bab (e.g. Bab 1 - Geografi)" style="flex: 2; padding: 6px; border: 1px solid #cbd5e1; border-radius: 4px; font-size: 0.85rem;">
                    <input type="number" class="toc-start" value="${start}" placeholder="Mulai" style="width: 70px; padding: 6px; border: 1px solid #cbd5e1; border-radius: 4px; font-size: 0.85rem;">
                    <input type="number" class="toc-end" value="${end}" placeholder="Akhir" style="width: 70px; padding: 6px; border: 1px solid #cbd5e1; border-radius: 4px; font-size: 0.85rem;">
                    <button onclick="this.parentElement.remove()" style="background: #ef4444; color: white; border: none; border-radius: 4px; padding: 6px 10px; cursor: pointer; font-size: 0.85rem;">✕</button>
                </div>
            `;
        }

        toc.forEach((item, idx) => {
            editorHtml += renderRow(item.title, item.start_page, item.end_page, idx);
        });

        editorHtml += `</div>
            <div style="text-align: left; margin-top: 10px; padding-left: 0.5rem;">
                <button id="add-toc-row-btn" class="btn btn-small" style="background-color: #10b981; color: white; padding: 6px 12px; border-radius: 4px; border: none; cursor: pointer; font-size: 0.85rem;">+ Tambah Bab</button>
            </div>
        `;

        Swal.fire({
            title: `Edit Bab - ${filename}`,
            html: editorHtml,
            width: '600px',
            showCancelButton: true,
            confirmButtonText: 'Simpan',
            cancelButtonText: 'Batal',
            confirmButtonColor: '#4F46E5',
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
                for (const row of rows) {
                    const title = row.querySelector('.toc-title').value.trim();
                    const start = parseInt(row.querySelector('.toc-start').value);
                    const end = parseInt(row.querySelector('.toc-end').value);

                    if (!title) {
                        Swal.showValidationMessage("Judul Bab tidak boleh kosong!");
                        return false;
                    }
                    if (isNaN(start) || isNaN(end)) {
                        Swal.showValidationMessage("Halaman awal dan akhir harus berupa angka!");
                        return false;
                    }
                    updatedToc.push({
                        title: title,
                        start_page: start,
                        end_page: end
                    });
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

                if (saveRes.ok) {
                    Swal.fire('Tersimpan!', 'Daftar bab berhasil diperbarui secara manual.', 'success');
                    populateBabDropdown(docId);
                    populateDocumentList();
                } else {
                    const errData = await saveRes.json();
                    Swal.fire('Gagal!', `Gagal menyimpan: ${errData.detail || 'Terjadi kesalahan'}`, 'error');
                }
            }
        });

    } catch (err) {
        Swal.fire("Error", `Gagal memuat editor bab: ${err.message}`, "error");
    }
}


async function extractPages(docId) {
    const startInput = document.getElementById(`start-${docId}`).value;
    const endInput = document.getElementById(`end-${docId}`).value;
    
    if(!startInput || !endInput) {
        Swal.fire("Peringatan", "Masukkan halaman awal dan halaman akhir!", "warning");
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
    const res = await fetch(`${API_BASE}/documents/${docId}/extract`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            start_page: parseInt(startInput),
            end_page: parseInt(endInput)
        })
    });
    
    if(res.ok) {
        Swal.fire({
            title: "Informasi",
            text: "Mengekstrak halaman di background...",
            icon: "info",
            timer: 2000,
            showConfirmButton: false
        });
        await loadDocuments();
    } else {
        Swal.fire("Gagal", "Gagal memulai ekstraksi", "error");
    }
}

function deleteBab(docId, babNum, babName) {
    Swal.fire({
        title: 'Hapus Bab?',
        text: `Anda yakin ingin menghapus semua tabel di ${babName} secara permanen?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#cbd5e1',
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
        text: "Semua data hasil ekstraksinya juga akan terhapus dari database.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#cbd5e1',
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
    const res = await fetch(`${API_BASE}/documents`);
    const docs = await res.json();
    const container = document.getElementById("document-list-container");
    container.innerHTML = "";
    
    let docChapters = {};
    if (viewState.selectedDocId) {
        try {
            const tocRes = await fetch(`${API_BASE}/documents/${viewState.selectedDocId}/toc`);
            if (tocRes.ok) {
                const tocData = await tocRes.json();
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
        } catch (err) {
            console.error("Gagal memuat TOC dinamis:", err);
        }
    }

    // Breadcrumb (Jalur Navigasi)
    const breadcrumb = document.createElement("div");
    breadcrumb.style.marginBottom = "1.5rem";
    breadcrumb.style.fontSize = "0.95rem";
    breadcrumb.style.padding = "0.75rem 1.25rem";
    breadcrumb.style.background = "#f1f5f9";
    breadcrumb.style.borderRadius = "8px";
    breadcrumb.style.display = "flex";
    breadcrumb.style.justifyContent = "space-between";
    breadcrumb.style.alignItems = "center";
    breadcrumb.style.gap = "8px";
    
    const bcLeft = document.createElement("div");
    bcLeft.style.display = "flex";
    bcLeft.style.alignItems = "center";
    bcLeft.style.gap = "8px";
    bcLeft.style.flexWrap = "wrap";
    
    let bcHTML = `<span style="cursor:pointer; color:#2563eb; font-weight:600; padding:4px 8px; border-radius:6px; transition:background 0.2s;" onmouseenter="this.style.background='#e2e8f0'" onmouseleave="this.style.background='transparent'" onclick="viewState.selectedDocId=null; viewState.selectedBabNum=null; populateDocumentList();">🏠 Semua Dokumen</span>`;
    
    const doc = docs.find(d => d.id === viewState.selectedDocId);
    if (viewState.selectedDocId && doc) {
        bcHTML += `<span style="color:#94a3b8;">/</span><span style="cursor:pointer; color:#2563eb; font-weight:600; padding:4px 8px; border-radius:6px; transition:background 0.2s;" onmouseenter="this.style.background='#e2e8f0'" onmouseleave="this.style.background='transparent'" onclick="viewState.selectedBabNum=null; populateDocumentList();">📁 ${doc.filename}</span>`;
        if (viewState.selectedBabNum !== null) {
            const chapterName = docChapters[viewState.selectedBabNum] ? ` - ${docChapters[viewState.selectedBabNum]}` : "";
            bcHTML += `<span style="color:#94a3b8;">/</span><span style="color:#334155; font-weight:600; padding:4px 8px;">📂 Bab ${viewState.selectedBabNum}${chapterName}</span>`;
        }
    }
    bcLeft.innerHTML = bcHTML;
    breadcrumb.appendChild(bcLeft);

    const bcRight = document.createElement("div");
    bcRight.style.display = "flex";
    bcRight.style.gap = "0.5rem";
    bcRight.style.flexWrap = "wrap";
    
    if (viewState.selectedDocId && doc) {
        if (viewState.selectedBabNum === null) {
            bcRight.innerHTML = `
                <button onclick="loadAllCsvForDoc(${doc.id}, '${doc.filename.replace(/'/g, "\\'")}')" class="btn btn-small btn-primary" style="background:#4f46e5; border-color:#4f46e5; font-weight:600; padding:5px 12px; border-radius:6px; cursor:pointer;">
                    ⚡ Load Semua Tabel ke Database
                </button>
                <button onclick="deleteAllTablesForDoc(${doc.id}, '${doc.filename.replace(/'/g, "\\'")}')" class="btn btn-small btn-danger" style="background:#ef4444; border-color:#ef4444; font-weight:600; padding:5px 12px; border-radius:6px; cursor:pointer;">
                    🗑️ Hapus Semua Hasil
                </button>
            `;
        } else {
            bcRight.innerHTML = `
                <button onclick="loadAllCsvForBab(${doc.id}, ${viewState.selectedBabNum})" class="btn btn-small btn-primary" style="background:#4f46e5; border-color:#4f46e5; font-weight:600; padding:5px 12px; border-radius:6px; cursor:pointer;">
                    ⚡ Load Semua Tabel ke Database
                </button>
                <button onclick="deleteAllTablesForBab(${doc.id}, ${viewState.selectedBabNum})" class="btn btn-small btn-danger" style="background:#ef4444; border-color:#ef4444; font-weight:600; padding:5px 12px; border-radius:6px; cursor:pointer;">
                    🗑️ Hapus Semua Tabel Bab
                </button>
            `;
        }
    }
    breadcrumb.appendChild(bcRight);
    container.appendChild(breadcrumb);
    
    if (!viewState.selectedDocId) {
        // LEVEL 1: Tampilkan Grid Dokumen
        const grid = document.createElement("div");
        grid.style.display = "grid";
        grid.style.gridTemplateColumns = "repeat(auto-fill, minmax(320px, 1fr))";
        grid.style.gap = "1.5rem";
        
        for (const d of docs) {
            if(d.status === 'ready' || d.status.startsWith('extracting') || d.status.startsWith('done')) {
                const card = document.createElement("div");
                card.style.border = "1px solid #e2e8f0";
                card.style.borderRadius = "16px";
                card.style.padding = "2rem 1.5rem";
                card.style.background = "#ffffff";
                card.style.cursor = "pointer";
                card.style.boxShadow = "0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03)";
                card.style.transition = "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)";
                card.style.position = "relative";
                
                card.onmouseenter = () => { 
                    card.style.transform = "translateY(-6px)"; 
                    card.style.boxShadow = "0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)";
                    card.style.borderColor = "#cbd5e1";
                };
                card.onmouseleave = () => { 
                    card.style.transform = "none"; 
                    card.style.boxShadow = "0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03)";
                    card.style.borderColor = "#e2e8f0";
                };
                card.onclick = () => { viewState.selectedDocId = d.id; populateDocumentList(); };
                
                let loadingBadge = '';
                if (d.status.startsWith('extracting')) {
                    loadingBadge = `
                        <div style="position:absolute; top:15px; right:15px; display:flex; align-items:center; gap:6px; background:#fffbeb; color:#b45309; padding:4px 10px; border-radius:20px; font-size:0.8rem; font-weight:700; border:1px solid #fcd34d; box-shadow:0 2px 4px rgba(0,0,0,0.05);">
                            <div style="width:12px; height:12px; border:2px solid #fcd34d; border-top-color:#b45309; border-radius:50%; animation:spin 1s linear infinite;"></div>
                            <style>@keyframes spin { 100% { transform: rotate(360deg); } }</style>
                            Mengekstrak...
                        </div>`;
                }
                
                card.innerHTML = `
                    ${loadingBadge}
                    <div style="font-size:3.5rem; margin-bottom:1.5rem; text-align:center; text-shadow: 0 2px 4px rgba(0,0,0,0.1);">📁</div>
                    <h3 style="margin:0 0 0.75rem 0; font-size:1.15rem; color:#1e293b; text-align:center; word-break:break-all; line-height:1.4;">${d.filename}</h3>
                    <p style="margin:0; color:#64748b; text-align:center; font-size:0.95rem; background:#f1f5f9; padding:4px 12px; border-radius:20px; display:inline-block; width:max-content; margin:0 auto; display:block;">Tahun: ${d.year}</p>
                `;
                grid.appendChild(card);
            }
        }
        if (grid.children.length === 0) {
            grid.innerHTML = `<p style="color:#64748b; font-style:italic;">Belum ada dokumen yang siap dilihat.</p>`;
        }
        container.appendChild(grid);
    } 
    else {
        const d = docs.find(doc => doc.id === viewState.selectedDocId);
        if (!d) {
            viewState.selectedDocId = null;
            return populateDocumentList();
        }
        
        const tRes = await fetch(`${API_BASE}/documents/${d.id}/tables`);
        const tables = await tRes.json();
        
        if (d.status.startsWith('extracting')) {
            const loadingBanner = document.createElement("div");
            loadingBanner.style.background = "#fffbeb";
            loadingBanner.style.border = "1px solid #fcd34d";
            loadingBanner.style.color = "#b45309";
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
            let icon = d.status.startsWith('extracting') ? "⏳" : "❌";
            const emptyDiv = document.createElement("div");
            emptyDiv.style.textAlign = "center";
            emptyDiv.style.padding = "3rem";
            emptyDiv.style.background = "#f8fafc";
            emptyDiv.style.borderRadius = "12px";
            emptyDiv.style.border = "1px dashed #cbd5e1";
            emptyDiv.innerHTML = `<p style="color:#64748b; font-style:italic; font-size:1.1rem; margin:0;">${msg}</p>`;
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
                const chapterName = docChapters[babNum] ? ` - ${docChapters[babNum]}` : "";
                babName = `Bab ${babNum}${chapterName}`;
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
                card.style.border = "1px solid #cbd5e1";
                card.style.borderRadius = "16px";
                card.style.padding = "1.75rem 1.5rem";
                card.style.background = "linear-gradient(145deg, #ffffff, #f8fafc)";
                card.style.cursor = "pointer";
                card.style.boxShadow = "0 2px 4px rgba(0,0,0,0.02)";
                card.style.transition = "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)";
                
                card.onmouseenter = () => { 
                    card.style.transform = "translateY(-4px)"; 
                    card.style.boxShadow = "0 8px 12px -3px rgba(0,0,0,0.08)"; 
                    card.style.borderColor = "#94a3b8";
                };
                card.onmouseleave = () => { 
                    card.style.transform = "none"; 
                    card.style.boxShadow = "0 2px 4px rgba(0,0,0,0.02)";
                    card.style.borderColor = "#cbd5e1";
                };
                
                card.onclick = (e) => {
                    if(e.target.tagName.toLowerCase() === 'button') return;
                    viewState.selectedBabNum = bab.num;
                    populateDocumentList();
                };
                
                let cardHTML = `
                    <div style="font-size:3rem; margin-bottom:1rem; text-align:center; text-shadow: 0 2px 4px rgba(0,0,0,0.05);">📂</div>
                    <h4 style="margin:0 0 0.75rem 0; font-size:1.15rem; color:#334155; text-align:center;">${bab.name}</h4>
                    <p style="margin:0 0 1.25rem 0; color:#64748b; text-align:center; font-size:0.9rem; font-weight:500;">${bab.tables.length} Tabel</p>
                `;
                
                const deleteBtn = `<div style="text-align:center;"><button style="background:transparent; border:1px solid #ef4444; color:#ef4444; padding:6px 16px; font-size:0.8rem; border-radius:20px; font-weight:600; cursor:pointer; transition:all 0.2s;" onclick="deleteBab(${d.id}, ${bab.num}, '${bab.name}')" onmouseenter="this.style.background='#ef4444'; this.style.color='white'" onmouseleave="this.style.background='transparent'; this.style.color='#ef4444'">Hapus Bab</button></div>`;
                
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
            tableListWrapper.style.background = "#ffffff";
            tableListWrapper.style.border = "1px solid #e2e8f0";
            tableListWrapper.style.borderRadius = "12px";
            tableListWrapper.style.overflow = "hidden";
            tableListWrapper.style.boxShadow = "0 4px 6px -1px rgba(0,0,0,0.05)";
            
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
                li.style.display = "flex";
                li.style.justifyContent = "space-between";
                li.style.alignItems = "center";
                li.style.padding = "1.25rem 1.5rem";
                li.style.borderBottom = index !== bab.tables.length - 1 ? "1px solid #f1f5f9" : "none";
                li.style.transition = "background-color 0.2s ease";
                li.onmouseenter = () => li.style.backgroundColor = "#f8fafc";
                li.onmouseleave = () => li.style.backgroundColor = "transparent";
                
                let displayName = t.table_name;
                let pageHeading = "";
                const pageMatch = t.table_name.match(/(.*?)\s*(\([Hh]al.*?\))\s*$/i);
                if (pageMatch) {
                    displayName = pageMatch[1];
                    pageHeading = `<h3 style="margin: 2px 0 0 32px; font-size: 0.8rem; color: #64748b; font-weight: 500;">${pageMatch[2]}</h3>`;
                }

                let displayNum = "";
                let displayNameOnly = displayName;
                const numMatch = displayName.match(/^(Tabel[\s_]*\d+(?:\.\d+)*\s*|^\d+(?:\.\d+)+\s*)/i);
                if (numMatch) {
                    displayNum = numMatch[1].trim();
                    displayNameOnly = displayName.substring(numMatch[0].length).trim();
                }

                li.innerHTML = `
                    <div style="display:flex; flex-direction:column; flex: 1; padding-right: 15px; overflow-wrap: break-word; word-wrap: break-word;">
                        <span style="font-weight:500; font-size:0.95rem; color: #1e293b; display:flex; align-items:flex-start; gap:10px; line-height: 1.5; white-space: normal;">
                            <span style="font-size:1.2rem; margin-top:-2px;">📄</span>
                            <span style="flex:1;">
                                ${displayNum ? `<strong style="color:var(--primary); margin-right:8px; white-space:nowrap;">${displayNum}</strong>` : ""}
                                ${displayNameOnly}
                            </span>
                        </span>
                        ${pageHeading}
                    </div>
                    <div style="display:flex; gap:0.5rem; flex-shrink: 0; flex-wrap: wrap; justify-content: flex-end;">
                        <button onclick="previewCsv(${t.id}, '${t.table_name}')" class="btn btn-small btn-primary" style="background-color: #64748b; padding:6px 12px; border-radius:6px; font-weight:600;">Lihat CSV</button>
                        <button onclick="previewCsvEditor(${t.id}, '${t.table_name}')" class="btn btn-small btn-primary" style="background-color: #6366f1; padding:6px 12px; border-radius:6px; font-weight:600;">Edit CSV</button>
                        <button onclick="loadToDatabase(${t.id})" class="btn btn-small btn-primary" style="background-color: var(--primary); padding:6px 12px; border-radius:6px; font-weight:600;">Load CSV</button>
                        <button onclick="viewDataEditor(${t.id}, '${t.table_name}')" class="btn btn-small btn-primary" style="background-color: var(--success); padding:6px 12px; border-radius:6px; font-weight:600;">Lihat Data</button>
                        <button onclick="deleteTable(${t.id})" class="btn btn-small btn-primary" style="background-color: var(--danger); padding:6px 12px; border-radius:6px; font-weight:600;">Hapus</button>
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
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#cbd5e1',
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
            Swal.fire("Gagal", "Gagal memuat data", "error");
        }
    } catch (e) {
        Swal.fire("Error", e.message, "error");
    }
    
    loadDashboardStats();
}

async function viewDataEditor(tableId, tableName = "") {
    if(!tableId) { Swal.fire("Peringatan", "Pilih tabel dulu!", "warning"); return; }
    navigateToEditor(tableId, tableName, 'db');
    buildEditorToolbar(tableId, tableName, 'db');
    await _loadDbIntoEditor(tableId, tableName);
}

async function _loadDbIntoEditor(tableId, tableName) {
    const thead = document.getElementById("data-grid-head");
    const tbody = document.getElementById("data-grid-body");
    thead.innerHTML = "<tr><th colspan='20' style='color:#64748b;'>Memuat data dari database...</th></tr>";
    tbody.innerHTML = "";

    try {
        const res = await fetch(`${API_BASE}/tables/${tableId}/data`);
        const payload = await res.json();
        const rows = payload.rows || [];
        const headers = (payload.headers && payload.headers.length > 0)
            ? payload.headers
            : (rows.length > 0 ? Object.keys(rows[0].data) : []);

        thead.innerHTML = ""; tbody.innerHTML = "";

        if (rows.length === 0) {
            thead.innerHTML = "<tr><th>—</th></tr>";
            tbody.innerHTML = `<tr><td style='color:#64748b; padding:2rem; text-align:center;'>Belum ada data di database. Gunakan tombol <b>Load CSV</b> terlebih dahulu dari halaman Daftar Tabel.</td></tr>`;
            return;
        }

        thead.innerHTML = `<tr><th>Aksi</th>${headers.map(h => `<th>${h}</th>`).join("")}</tr>`;

        rows.forEach(row => {
            const tr = document.createElement("tr");
            tr.id = `row-${row.id}`;
            if(row.is_anomaly) tr.classList.add("row-anomaly");

            const safeBtn = row.is_anomaly 
                ? `<button onclick="markRowSafe(${row.id}, ${tableId}, '${tableName.replace(/'/g, "\\'")}')" class="btn-row-safe" style="background:#10b981; border:1px solid #10b981; color:white; padding:3px 6px; border-radius:4px; font-size:0.75rem; cursor:pointer; margin-left:4px; font-weight:600;">Aman</button>`
                : '';
            let html = `<td><div class="row-action-cell"><button onclick="deleteRow(${row.id})" class="btn-row-del">Hapus</button>${safeBtn}</div></td>`;
            headers.forEach(h => {
                const val = row.data[h] !== null ? row.data[h] : "";
                html += `<td class="editable-cell" contenteditable="true" onblur="updateCell(${row.id}, '${h}', this.innerText)" onkeydown="if(event.key === 'Enter') { event.preventDefault(); this.blur(); }">${val}</td>`;
            });

            tr.innerHTML = html;
            tbody.appendChild(tr);
        });
    } catch(err) {
        thead.innerHTML = `<tr><th style="color:red">Error: ${err.message}</th></tr>`;
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
            Swal.fire("Gagal", "Gagal menambah baris", "error");
        }
    } catch(e) {
        Swal.fire("Error", e.message, "error");
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
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#cbd5e1',
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
            Swal.fire({
                title: 'Tandai Aman',
                text: 'Baris ini sudah ditandai aman (bukan anomali) dan disimpan.',
                icon: 'success',
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 2000
            });
        } else {
            Swal.fire("Gagal", "Gagal menandai baris aman", "error");
        }
    } catch (e) {
        Swal.fire("Error", e.message, "error");
    }
}

async function markAllSafeInTable(tableId, tableName) {
    Swal.fire({
        title: 'Tandai Semua Aman?',
        text: "Seluruh baris berstatus anomali pada tabel ini akan ditandai aman.",
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#10b981',
        cancelButtonColor: '#cbd5e1',
        confirmButtonText: 'Ya, Tandai Semua Aman',
        cancelButtonText: 'Batal'
    }).then(async (result) => {
        if (result.isConfirmed) {
            try {
                const res = await fetch(`${API_BASE}/tables/${tableId}/safe-all`, { method: "PUT" });
                if (res.ok) {
                    Swal.fire('Berhasil!', 'Semua data tabel telah ditandai aman.', 'success');
                    _loadDbIntoEditor(tableId, tableName);
                    loadDashboardStats();
                } else {
                    Swal.fire('Gagal', 'Gagal memproses permintaan.', 'error');
                }
            } catch(e) {
                Swal.fire('Error', e.message, 'error');
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

// Start polling every 3 seconds to auto-refresh UI when extraction finishes
setInterval(pollStatus, 3000);
// Initialize the cache on load
fetch(`${API_BASE}/documents`, { cache: "no-store" }).then(r=>r.json()).then(d=>previousDocsForPolling = d).catch(e=>{});


function downloadCsv(tableId) {
    window.location.href = `${API_BASE}/tables/${tableId}/csv`;
}

/** Mode Lihat CSV: read-only, tidak bisa edit */
async function previewCsv(tableId, tableName) {
    navigateToEditor(tableId, tableName, 'csv-view');
    buildEditorToolbar(tableId, tableName, 'csv-view');
    await _loadCsvIntoEditor(tableId, tableName, false);
}

/** Mode Edit CSV: full CRUD + rename kolom + rename tabel */
async function previewCsvEditor(tableId, tableName) {
    navigateToEditor(tableId, tableName, 'csv-edit');
    buildEditorToolbar(tableId, tableName, 'csv-edit');
    await _loadCsvIntoEditor(tableId, tableName, true);
}

/**
 * Load CSV into the editor grid.
 * @param {boolean} isEditable - true = edit mode (CRUD), false = view mode (read-only)
 */
async function _loadCsvIntoEditor(tableId, tableName, isEditable = false) {
    // Reset col-delete-bar
    const colBar = document.getElementById("col-delete-bar");
    const colBarBtns = document.getElementById("col-delete-bar-buttons");
    if (colBar) { colBar.classList.remove('visible'); if(colBarBtns) colBarBtns.innerHTML = ""; }

    const thead = document.getElementById("data-grid-head");
    const tbody = document.getElementById("data-grid-body");
    thead.innerHTML = "<tr><th colspan='20' style='color:#64748b;'>Memuat data CSV...</th></tr>";
    tbody.innerHTML = "";
    
    try {
        const res = await fetch(`${API_BASE}/tables/${tableId}/csv_preview`);
        if (!res.ok) throw new Error("Gagal mengambil preview CSV");

        const data = await res.json();

        if (data.headers && data.headers.length > 0) {
            if (isEditable) {
                // Edit mode: header menampilkan tiga baris input (Nama, Satuan, Tahun) secara terpisah & rapi
                thead.innerHTML = `<tr>
                    <th class="th-action-col" style="vertical-align: middle; text-align: center;">Aksi Baris</th>
                    ${data.headers.map((h, idx) => {
                        const unit = data.units && data.units[idx] ? data.units[idx] : "";
                        const year = data.years && data.years[idx] ? data.years[idx] : "";
                        
                        return `
                        <th class="editable-header-wrapper" style="min-width: 170px; padding: 0.75rem 0.5rem; text-align: left; border-bottom: 2px solid #cbd5e1; background: #f8fafc;">
                            <div style="margin-bottom: 6px;">
                                <label style="font-size: 0.68rem; font-weight: 700; color: #64748b; display: block; margin-bottom: 2px;">NAMA KOLOM</label>
                                <input type="text" class="header-name-input" value="${h}" onchange="onHeaderNameChange(${idx}, this.value)" style="width: 100%; padding: 4px 6px; font-size: 0.8rem; font-weight: 600; border-radius: 4px; border: 1px solid #cbd5e1; outline:none; font-family: 'Inter', sans-serif;">
                            </div>
                            <div style="display: flex; gap: 4px; margin-bottom: 8px;">
                                <div style="flex: 1;">
                                    <label style="font-size: 0.65rem; font-weight: 700; color: #64748b; display: block; margin-bottom: 2px;">SATUAN</label>
                                    <input type="text" class="header-unit-input" value="${unit}" onchange="updateCsvUnitLocal(${idx}, this.value)" placeholder="e.g. Jiwa" style="width: 100%; padding: 3px 6px; font-size: 0.75rem; border-radius: 4px; border: 1px solid #cbd5e1; outline:none; font-family: 'Inter', sans-serif; background: white;">
                                </div>
                                <div style="width: 65px;">
                                    <label style="font-size: 0.65rem; font-weight: 700; color: #64748b; display: block; margin-bottom: 2px;">TAHUN</label>
                                    <input type="text" class="header-year-input" value="${year}" onchange="updateCsvYearLocal(${idx}, this.value)" placeholder="e.g. 2025" style="width: 100%; padding: 3px 6px; font-size: 0.75rem; border-radius: 4px; border: 1px solid #cbd5e1; outline:none; font-family: 'Inter', sans-serif; background: white;">
                                </div>
                            </div>
                            <div style="display: flex; gap: 4px; justify-content: center; padding-top: 6px; border-top: 1px dashed #e2e8f0;">
                                <button onclick="insertCsvColBelowLocal(${idx})" class="btn-row-insert" style="padding: 3px 8px; font-size: 0.72rem; border-radius: 4px; border: 1px solid #cbd5e1; background: #f1f5f9; color: #475569; cursor: pointer; transition: all 0.15s;" onmouseenter="this.style.background='#e2e8f0'; this.style.color='#1e293b'" onmouseleave="this.style.background='#f1f5f9'; this.style.color='#475569'">Sisip</button>
                                <button onclick="deleteCsvColumnLocal(${idx})" class="btn-row-del" style="padding: 3px 8px; font-size: 0.72rem; border-radius: 4px; border: 1px solid #fca5a5; background: #fee2e2; color: #b91c1c; cursor: pointer; transition: all 0.15s;" onmouseenter="this.style.background='#fecaca'; this.style.color='#991b1b'" onmouseleave="this.style.background='#fee2e2'; this.style.color='#b91c1c'">Hapus</button>
                            </div>
                        </th>`;
                    }).join("")}
                </tr>`;
            } else {
                // View mode: header digabung menjadi "Nama Kolom (Satuan, Tahun)" jika ada metadatanya
                thead.innerHTML = `<tr>${data.headers.map((h, idx) => {
                    const unit = data.units && data.units[idx] ? data.units[idx].trim() : "";
                    const year = data.years && data.years[idx] ? data.years[idx].trim() : "";
                    
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
                    
                    return `<th>${displayHeader}</th>`;
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

                    row.forEach(cell => {
                        html += `<td class="editable-cell" contenteditable="true" onkeydown="if(event.key === 'Enter') { event.preventDefault(); this.blur(); }">${cell !== null ? cell : ""}</td>`;
                    });
                } else {
                    // Read-only cells
                    row.forEach(cell => {
                        html += `<td class="readonly-cell">${cell !== null ? cell : ""}</td>`;
                    });
                }

                tr.innerHTML = html;
                tbody.appendChild(tr);
            });
        } else {
            const colSpan = data.headers ? (isEditable ? data.headers.length + 1 : data.headers.length) : 1;
            tbody.innerHTML = `<tr><td colspan="${colSpan}" style="text-align:center;color:#64748b;padding:2rem;">Tidak ada baris data.</td></tr>`;
        }
    } catch (err) {
        thead.innerHTML = `<tr><th style="color:red">Error: ${err.message}</th></tr>`;
    }
}

/** Rename a CSV column header by clicking on it */
async function renameCsvColumn(tableId, colIndex, tableName) {
    const th = document.querySelector(`#data-grid-head tr th.editable-header:nth-child(${colIndex + 2})`);
    const currentName = th ? th.innerText.replace('✏️', '').trim() : `Kolom ${colIndex + 1}`;

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
            Swal.fire('Gagal', err.detail || 'Gagal rename kolom', 'error');
        }
    } catch(e) {
        Swal.fire('Error', e.message, 'error');
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
            await Swal.fire({
                icon: 'success',
                title: 'Berhasil!',
                text: 'Identitas tabel berhasil diperbarui.',
                timer: 1500,
                showConfirmButton: false
            });
        } else {
            const err = await res.json();
            Swal.fire('Gagal', err.detail || 'Gagal merubah identitas tabel', 'error');
        }
    } catch(e) {
        Swal.fire('Error', e.message, 'error');
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
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#cbd5e1',
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
            Swal.fire("Gagal", "Gagal menambah baris", "error");
        }
    } catch(e) {
        Swal.fire("Error", e.message, "error");
    }
}

async function insertCsvRowBelow(tableId, rowIndex) {
    try {
        // rowIndex is 0-based data row; API insert_row uses 0-based data row
        const res = await fetch(`${API_BASE}/tables/${tableId}/csv/insert_row/${rowIndex + 1}`, { method: "POST" });
        if (res.ok) {
            await _loadCsvIntoEditor(editorState.tableId, editorState.tableName);
        } else {
            Swal.fire("Gagal", "Gagal menyisipkan baris", "error");
        }
    } catch(e) {
        Swal.fire("Error", e.message, "error");
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
            <p style="margin-bottom:12px; color:#475569; font-size:0.95rem;">
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
            await Swal.fire({
                icon: 'success',
                title: 'Berhasil!',
                text: `Kolom "${colName}" berhasil disisipkan.`,
                timer: 1500,
                showConfirmButton: false
            });
            await _loadCsvIntoEditor(editorState.tableId, editorState.tableName);
        } else {
            const err = await res.json();
            Swal.fire("Gagal", err.detail || "Gagal menambah kolom", "error");
        }
    } catch(e) {
        Swal.fire("Error", e.message, "error");
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
    newTh.style.cssText = "min-width: 170px; padding: 0.75rem 0.5rem; text-align: left; border-bottom: 2px solid #cbd5e1; background: #f8fafc;";
    
    const isDim = false;
    const unitVal = "";
    const yearVal = "";

    newTh.innerHTML = `
        <div style="margin-bottom: 6px;">
            <label style="font-size: 0.68rem; font-weight: 700; color: #64748b; display: block; margin-bottom: 2px;">NAMA KOLOM</label>
            <input type="text" class="header-name-input" value="${colName.trim()}" onchange="onHeaderNameChange(0, this.value)" style="width: 100%; padding: 4px 6px; font-size: 0.8rem; font-weight: 600; border-radius: 4px; border: 1px solid #cbd5e1; outline:none; font-family: 'Inter', sans-serif;">
        </div>
        <div style="display: flex; gap: 4px; margin-bottom: 8px;">
            <div style="flex: 1;">
                <label style="font-size: 0.65rem; font-weight: 700; color: #64748b; display: block; margin-bottom: 2px;">SATUAN</label>
                <input type="text" class="header-unit-input" value="${unitVal}" onchange="updateCsvUnitLocal(0, this.value)" placeholder="e.g. Jiwa" style="width: 100%; padding: 3px 6px; font-size: 0.75rem; border-radius: 4px; border: 1px solid #cbd5e1; outline:none; font-family: 'Inter', sans-serif; background: white;">
            </div>
            <div style="width: 65px;">
                <label style="font-size: 0.65rem; font-weight: 700; color: #64748b; display: block; margin-bottom: 2px;">TAHUN</label>
                <input type="text" class="header-year-input" value="${yearVal}" onchange="updateCsvYearLocal(0, this.value)" placeholder="e.g. 2025" style="width: 100%; padding: 3px 6px; font-size: 0.75rem; border-radius: 4px; border: 1px solid #cbd5e1; outline:none; font-family: 'Inter', sans-serif; background: white;">
            </div>
        </div>
        <div style="display: flex; gap: 4px; justify-content: center; padding-top: 6px; border-top: 1px dashed #e2e8f0;">
            <button class="btn-row-insert" style="padding: 3px 8px; font-size: 0.72rem; border-radius: 4px; border: 1px solid #cbd5e1; background: #f1f5f9; color: #475569; cursor: pointer; transition: all 0.15s;" onmouseenter="this.style.background='#e2e8f0'; this.style.color='#1e293b'" onmouseleave="this.style.background='#f1f5f9'; this.style.color='#475569'">Sisip</button>
            <button class="btn-row-del" style="padding: 3px 8px; font-size: 0.72rem; border-radius: 4px; border: 1px solid #fca5a5; background: #fee2e2; color: #b91c1c; cursor: pointer; transition: all 0.15s;" onmouseenter="this.style.background='#fecaca'; this.style.color='#991b1b'" onmouseleave="this.style.background='#fee2e2'; this.style.color='#b91c1c'">Hapus</button>
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
    Swal.fire({
        title: 'Menyimpan Perubahan...',
        allowOutsideClick: false,
        didOpen: () => {
            Swal.showLoading();
        }
    });

    const theadTr = document.getElementById("data-grid-head").querySelector("tr");
    
    // 1. Ekstrak Headers
    const headers = Array.from(theadTr.children).slice(1).map(th => {
        const input = th.querySelector(".header-name-input");
        return input ? input.value.trim() : "";
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
        
        if (res.ok) {
            await Swal.fire({
                icon: "success",
                title: "Berhasil",
                text: "Perubahan tabel berhasil disimpan secara permanen.",
                timer: 1500,
                showConfirmButton: false
            });
            // Beralih kembali ke mode preview
            previewCsv(tableId, editorState.tableName);
        } else {
            const err = await res.json();
            Swal.fire("Gagal", err.detail || "Gagal menyimpan data tabel", "error");
        }
    } catch (e) {
        Swal.fire("Error", e.message, "error");
    }
}

// Membatalkan pengeditan CSV (tanpa simpan, reload data asli)
function cancelCsvEditMode(tableId, tableName) {
    Swal.fire({
        title: 'Batalkan Pengeditan?',
        text: "Semua perubahan data yang belum disimpan akan hilang.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#cbd5e1',
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
let currentMatchedTables = []; // Simpan daftar tabel yang cocok untuk dipilih user

// Normalisasi nama entitas: perbaiki kesalahan ekstraksi OCR yang umum
function normalizeEntityName(name) {
    if (!name) return "";
    let n = name.trim();
    // Hilangkan karakter berulang berlebihan (Karangnungggal -> Karangnunggal)
    n = n.replace(/(.)\1{2,}/g, '$1$1');
    // Koreksi case: CIkalong -> Cikalong
    n = n.replace(/\b([A-Z])([A-Z])([a-z])/g, (m, a, b, c) => a + b.toLowerCase() + c);
    return n;
}

// Cek apakah dua nama entitas dianggap sama setelah normalisasi
function isSameEntity(name1, name2) {
    const n1 = normalizeEntityName(name1).toLowerCase();
    const n2 = normalizeEntityName(name2).toLowerCase();
    if (n1 === n2) return true;
    
    if (Math.abs(n1.length - n2.length) > 2) return false;
    let diffCount = 0;
    const shorter = n1.length <= n2.length ? n1 : n2;
    const longer = n1.length <= n2.length ? n2 : n1;
    for (let i = 0; i < shorter.length; i++) {
        if (shorter[i] !== longer[i]) diffCount++;
        if (diffCount > 2) return false;
    }
    diffCount += (longer.length - shorter.length);
    return diffCount <= 2;
}

// Fungsi untuk mencari canonical name dari entity map
function getCanonicalName(entityMap, rawName) {
    const existing = Object.keys(entityMap);
    for (const ent of existing) {
        if (isSameEntity(ent, rawName)) return ent;
    }
    return normalizeEntityName(rawName);
}

async function searchTimeSeries(e) {
    e.preventDefault();
    
    const keyword = document.getElementById("ts-keyword").value;
    const startYear = document.getElementById("ts-start").value;
    const endYear = document.getElementById("ts-end").value;
    
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
        
        showTablePicker(data.data, keyword);
        
    } catch (err) {
        document.getElementById("ts-results-loading").style.display = "none";
        Swal.fire('Error', 'Gagal memuat data deret waktu: ' + err.message, 'error');
    }
}

function getTableNumberOrCleanName(tableName) {
    const numMatch = tableName.match(/^(Tabel[\s_]*\d+(?:\.\d+)*\s*|^\d+(?:\.\d+)+\s*)/i);
    if (numMatch) {
        return numMatch[1].trim();
    }
    let clean = tableName.replace(/\d{4}/g, '').replace(/\(Hal.*?\)/g, '').replace(/-\s*$/, '').trim();
    return clean;
}

function showTablePicker(tablesData, keyword) {
    const tableGroups = {};
    tablesData.forEach(t => {
        const groupKey = getTableNumberOrCleanName(t.table_name);
        if (!tableGroups[groupKey]) {
            tableGroups[groupKey] = {
                displayName: t.table_name,
                tables: []
            };
        }
        tableGroups[groupKey].tables.push(t);
    });
    
    const groupKeys = Object.keys(tableGroups);
    if (groupKeys.length === 1) {
        renderTimeSeriesTable(tableGroups[groupKeys[0]].tables, keyword);
        return;
    }
    
    let pickerHtml = `
    <div style="margin: 1rem 0; padding: 1rem; background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px;">
        <p style="margin-bottom: 0.75rem; font-weight: 600; color: #0369a1;">
            🔍 Ditemukan <strong>${groupKeys.length}</strong> jenis tabel yang sesuai dengan kata kunci "<strong>${keyword}</strong>".
            <br><span style="font-weight: 400; font-size: 0.9rem;">Pilih tabel yang ingin ditampilkan dalam analisis deret waktu:</span>
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
            <strong>${groupKey}</strong> - ${group.displayName.replace(/^(Tabel[\s_]*\d+(?:\.\d+)*\s*|^\d+(?:\.\d+)+\s*)(?:-\s*|:\s*|)/i, '')}
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
    const ids = tableIdsStr.split(",").map(Number);
    const filteredTables = currentMatchedTables.filter(t => ids.includes(t.table_id));
    renderTimeSeriesTable(filteredTables, keyword);
}

function renderTimeSeriesTable(tablesData, keyword) {
    document.getElementById("ts-result-title").innerText = `Hasil: "${keyword.toUpperCase()}"`;
    document.getElementById("ts-results-content").style.display = "block";
    
    const entityMap = {};
    const yearsSet = new Set();
    const valueKeysSet = new Set();
    
    tablesData.forEach(table => {
        yearsSet.add(table.year);
        
        table.data.forEach(row => {
            const rawEnt = row.entitas;
            const canonEnt = getCanonicalName(entityMap, rawEnt);
            
            if (!entityMap[canonEnt]) entityMap[canonEnt] = {};
            if (!entityMap[canonEnt][table.year]) entityMap[canonEnt][table.year] = {};
            
            for (const [k, v] of Object.entries(row.nilai)) {
                entityMap[canonEnt][table.year][k] = v;
                valueKeysSet.add(k);
            }
        });
    });
    
    const years = Array.from(yearsSet).sort((a, b) => a - b);
    const valueKeys = Array.from(valueKeysSet);
    
    currentTimeSeriesData = { years, valueKeys, entityMap };
    
    // Render thead
    const thead = document.getElementById("ts-grid-head");
    let headHtml = `<tr><th rowspan="2" style="min-width: 200px">Entitas / Wilayah</th>`;
    years.forEach(y => {
        headHtml += `<th colspan="${valueKeys.length}" style="text-align: center; border-left: 2px solid #e2e8f0; background: #f8fafc;">${y}</th>`;
    });
    headHtml += `</tr><tr>`;
    years.forEach(() => {
        valueKeys.forEach(vk => {
            headHtml += `<th style="border-left: 1px dashed #e2e8f0; font-size: 0.85rem; font-weight: 500;">${vk}</th>`;
        });
    });
    headHtml += `</tr>`;
    thead.innerHTML = headHtml;
    
    // Render tbody
    const tbody = document.getElementById("ts-grid-body");
    let bodyHtml = "";
    
    Object.keys(entityMap).sort().forEach(ent => {
        bodyHtml += `<tr><td style="font-weight: 500; color: #1e293b;">${ent}</td>`;
        years.forEach(y => {
            const yearData = entityMap[ent][y] || {};
            valueKeys.forEach((vk, idx) => {
                const val = yearData[vk] || "-";
                const borderStyle = idx === 0 ? "border-left: 2px solid #e2e8f0;" : "border-left: 1px dashed #e2e8f0;";
                bodyHtml += `<td style="${borderStyle} text-align: right; color: ${val === '-' || val === '...' ? '#94a3b8' : '#334155'};">${val}</td>`;
            });
        });
        bodyHtml += `</tr>`;
    });
    
    tbody.innerHTML = bodyHtml;
}

function exportTimeSeriesCSV() {
    if (!currentTimeSeriesData) return;
    
    const { years, valueKeys, entityMap } = currentTimeSeriesData;
    const sortedEntities = Object.keys(entityMap).sort();
    
    let csvContent = "data:text/csv;charset=utf-8,";
    
    let row1 = ["Entitas / Wilayah"];
    years.forEach(y => {
        row1.push(y);
        for (let i = 1; i < valueKeys.length; i++) row1.push("");
    });
    csvContent += row1.join(",") + "\n";
    
    let row2 = [""];
    years.forEach(() => {
        valueKeys.forEach(vk => row2.push(`"${vk.replace(/"/g, '""')}"`));
    });
    csvContent += row2.join(",") + "\n";
    
    sortedEntities.forEach(ent => {
        let r = [`"${ent.replace(/"/g, '""')}"`];
        years.forEach(y => {
            const yearData = entityMap[ent][y] || {};
            valueKeys.forEach(vk => {
                const val = yearData[vk] || "-";
                r.push(`"${String(val).replace(/"/g, '""')}"`);
            });
        });
        csvContent += r.join(",") + "\n";
    });
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Deret_Waktu_BPS.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// ==========================================
// ROLE & ADMIN LOGIC
// ==========================================

let currentUserRole = "pegawai";
const ADMIN_PASSWORD = "bps2025";

function changeRole(role) {
    if (role === "admin") {
        Swal.fire({
            title: 'Masuk sebagai Admin',
            text: 'Masukkan password untuk akses Admin:',
            input: 'password',
            inputPlaceholder: 'Password Admin...',
            inputAttributes: { autocomplete: 'current-password' },
            showCancelButton: true,
            confirmButtonText: 'Masuk',
            cancelButtonText: 'Batal',
            confirmButtonColor: '#2563eb',
            preConfirm: (pw) => {
                if (pw !== ADMIN_PASSWORD) {
                    Swal.showValidationMessage('Password salah! Akses ditolak.');
                    return false;
                }
                return true;
            }
        }).then((result) => {
            if (result.isConfirmed) {
                currentUserRole = "admin";
                document.querySelectorAll(".admin-only").forEach(el => el.style.display = "block");
                loadDashboardStats();
                Swal.fire({ title: 'Selamat Datang, Admin!', icon: 'success', toast: true, position: 'top-end', showConfirmButton: false, timer: 3000 });
            } else {
                document.getElementById("role-selector").value = "pegawai";
            }
        });
    } else {
        currentUserRole = "pegawai";
        document.querySelectorAll(".admin-only").forEach(el => el.style.display = "none");
        navigate('dashboard', document.getElementById('nav-dashboard'));
        loadDashboardStats();
        Swal.fire({ title: 'Mode Pegawai BPS', icon: 'info', toast: true, position: 'top-end', showConfirmButton: false, timer: 2000 });
    }
}

async function loadAdminTables() {
    const tbody = document.getElementById("admin-tables-tbody");
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;">Memuat data...</td></tr>`;
    try {
        const res = await fetch(`${API_BASE}/admin/tables`);
        if (!res.ok) throw new Error("Gagal mengambil data admin");
        const tables = await res.json();
        if (tables.length === 0) { tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;">Database kosong.</td></tr>`; return; }
        let html = "";
        tables.forEach(t => {
            const isLoaded = t.db_rows > 0;
            const badge = isLoaded
                ? `<span style="background:#10b981;color:white;padding:2px 6px;border-radius:4px;font-size:0.75rem;">✔ DB (${t.db_rows} baris)</span>`
                : `<span style="background:#f59e0b;color:white;padding:2px 6px;border-radius:4px;font-size:0.75rem;">⚠ Hanya CSV</span>`;
            html += `<tr><td>${t.id}</td><td>${t.table_name}</td><td>${t.year}</td><td style="font-size:0.8rem;color:gray;">${t.csv_path||'-'}</td><td>${badge}</td><td><button class="btn btn-small" style="background:#ef4444;border-color:#ef4444;padding:4px 8px;" onclick="deleteTableAdmin(${t.id})">Hapus</button></td></tr>`;
        });
        tbody.innerHTML = html;
    } catch(e) { tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:red;">Error: ${e.message}</td></tr>`; }
}

async function deleteTableAdmin(id) {
    if (!confirm("Yakin ingin menghapus tabel ini dari Supabase?")) return;
    try {
        const res = await fetch(`${API_BASE}/tables/${id}`, { method: 'DELETE' });
        if (res.ok) { Swal.fire('Terhapus', 'Tabel berhasil dihapus', 'success'); loadAdminTables(); loadDashboardStats(); }
        else Swal.fire('Gagal', 'Gagal menghapus', 'error');
    } catch(e) { Swal.fire('Error', e.message, 'error'); }
}

async function resetDatabase() {
    Swal.fire({
        title: 'PERINGATAN KRITIKAL',
        text: "Anda akan MENGHAPUS SEMUA DATA dari Supabase secara permanen!",
        icon: 'error', showCancelButton: true,
        confirmButtonColor: '#d33', cancelButtonColor: '#3085d6',
        confirmButtonText: 'Ya, Kosongkan!', cancelButtonText: 'Batal'
    }).then(async (result) => {
        if (result.isConfirmed) {
            try {
                const res = await fetch(`${API_BASE}/admin/reset`, { method: 'POST' });
                if (res.ok) { Swal.fire('Direset!', 'Semua data telah dibersihkan.', 'success'); loadAdminTables(); loadDashboardStats(); populateDocumentList(); }
                else { const d = await res.json(); Swal.fire('Gagal', d.detail || 'Error di server', 'error'); }
            } catch(e) { Swal.fire('Error', e.message, 'error'); }
        }
    });
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
        text: `Apakah Anda yakin ingin menghapus seluruh tabel hasil ekstraksi untuk "${filename}"? Tindakan ini akan menghapus semua file CSV lokal dan data di database Supabase untuk publikasi ini.`,
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
        text: `Apakah Anda yakin ingin menghapus seluruh tabel hasil ekstraksi untuk Bab ${babNum}? Tindakan ini akan menghapus file CSV lokal dan data di database Supabase.`,
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

