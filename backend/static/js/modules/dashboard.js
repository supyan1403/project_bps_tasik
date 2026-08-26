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
                                <td class="ps-4 py-3" style="font-size:0.82rem; white-space:nowrap; color:#64748b;">${time}</td>
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
                                    ticks: { color: document.documentElement.getAttribute('data-bs-theme') === 'dark' ? '#94a3b8' : '#64748b', font: { family: "'Inter', sans-serif", size: 10 } }
                                },
                                x: {
                                    grid: { display: false },
                                    ticks: { color: document.documentElement.getAttribute('data-bs-theme') === 'dark' ? '#94a3b8' : '#64748b', font: { family: "'Inter', sans-serif", size: 10 } }
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
        confirmButtonColor: '#10b981',
        cancelButtonColor: '#cbd5e1',
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
            titleEl.textContent = '📈 Tren Pertumbuhan Akumulasi Titik Data';
            subTitleEl.textContent = 'Akumulasi titik nilai sel data statistik berdasarkan tahun publikasi';
        } else {
            titleEl.textContent = '📈 Tren Pertumbuhan Akumulasi Baris Record';
            subTitleEl.textContent = 'Akumulasi baris record data statistik berdasarkan tahun publikasi';
        }
    }
    
    const dataset = isPoints ? window.cachedTrendChartData.datasets[0] : window.cachedTrendChartData.datasets[1];
    const isDark = document.documentElement.getAttribute('data-bs-theme') === 'dark';
    const tickColor = isDark ? '#94a3b8' : '#64748b';
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
            const strokeColor = isPoints ? (isDarkTheme ? '#818cf8' : '#4f46e5') : (isDarkTheme ? '#38bdf8' : '#0284c7');
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
                ctx.fillStyle = isDarkTheme ? '#1e293b' : '#ffffff';
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
                ctx.fillStyle = '#ffffff';
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
                    ctx.strokeStyle = isDarkTheme ? '#475569' : '#cbd5e1';
                } else if (isUp) {
                    ctx.fillStyle = isDarkTheme ? 'rgba(6, 78, 59, 0.9)' : 'rgba(209, 250, 229, 0.95)';
                    ctx.strokeStyle = isDarkTheme ? '#10b981' : '#059669';
                } else {
                    ctx.fillStyle = isDarkTheme ? 'rgba(127, 29, 29, 0.9)' : 'rgba(254, 226, 226, 0.95)';
                    ctx.strokeStyle = isDarkTheme ? '#ef4444' : '#dc2626';
                }
                ctx.lineWidth = 1;
                ctx.fill();
                ctx.stroke();

                if (i === 0) {
                    ctx.fillStyle = isDarkTheme ? '#cbd5e1' : '#475569';
                } else if (isUp) {
                    ctx.fillStyle = isDarkTheme ? '#34d399' : '#047857';
                } else {
                    ctx.fillStyle = isDarkTheme ? '#f87171' : '#b91c1c';
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
                pointRadius: 0, // Ditangani oleh sequentialPenPlugin selama animasi & render
                pointHoverRadius: 6,
                borderWidth: 0 // Garis digambar oleh sequentialPenPlugin
            }]
        },
        plugins: [sequentialPenPlugin],
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false, // Animasi dikendalikan oleh pen-drawing RAF loop
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
                            if (idx === 0) return ` 📌 Basis Awal Terbit (Tahun ${window.cachedTrendChartData.labels[0]})`;
                            const prev = dataset.data[idx - 1];
                            const diff = ctx.raw - prev;
                            const pct = prev > 0 ? ((diff / prev) * 100).toFixed(1) : '0';
                            if (diff > 0) return ` 📈 Penambahan Data: ▲ +${diff.toLocaleString('id-ID')} (+${pct}%)`;
                            if (diff < 0) return ` 📉 Pengurangan Data: ▼ -${Math.abs(diff).toLocaleString('id-ID')} (${pct}%)`;
                            return ` ➖ Penambahan Data: 0 (Tetap)`;
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
                y: { beginAtZero: true, grid: { color: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)' }, ticks: { color: isDark ? '#94a3b8' : '#64748b', font: { family: "'Inter', sans-serif", size: 10 } } },
                x: { grid: { display: false }, ticks: { color: isDark ? '#94a3b8' : '#64748b', font: { family: "'Inter', sans-serif", size: 10 } } }
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
            titleEl.textContent = '📊 Sebaran Banyak Titik Nilai Data per Tahun';
            const totalPts = _filteredData0.reduce((a, b) => a + b, 0);
            subTitleEl.textContent = `Distribusi ${totalPts.toLocaleString('id-ID')} titik nilai sel data statistik berdasarkan tahun kejadian riil`;
        } else {
            titleEl.textContent = '📊 Sebaran Baris Record Data per Tahun';
            const totalRows = _filteredData1.reduce((a, b) => a + b, 0);
            subTitleEl.textContent = `Distribusi ${totalRows.toLocaleString('id-ID')} baris entitas observasi per tahun kejadian riil`;
        }
    }
    
    const dataset = isPoints ? window.cachedRefChartData.datasets[0] : window.cachedRefChartData.datasets[1];
    const isDark = document.documentElement.getAttribute('data-bs-theme') === 'dark';
    const tickColor = isDark ? '#94a3b8' : '#64748b';
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
        if (doc.status === 'ready') statusBadge = '<span style="background:#dcfce7;color:#15803d;padding:4px 10px;border-radius:20px;font-size:0.75rem;font-weight:700;">✔ Siap</span>';
        else if (doc.status.startsWith('extracting')) statusBadge = '<span style="background:#fef3c7;color:#b45309;padding:4px 10px;border-radius:20px;font-size:0.75rem;font-weight:700;">⏳ Ekstraksi...</span>';
        else if (doc.status.startsWith('error')) statusBadge = `<span style="background:#fee2e2;color:#b91c1c;padding:4px 10px;border-radius:20px;font-size:0.75rem;font-weight:700;" title="${escHtml(doc.status)}">⚠ Gagal</span>`;
        else statusBadge = `<span style="background:#f1f5f9;color:#475569;padding:4px 10px;border-radius:20px;font-size:0.75rem;font-weight:700;">${doc.status.toUpperCase()}</span>`;

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

