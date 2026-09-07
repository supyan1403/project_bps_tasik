# Catatan Sesi: Perbaikan Kolom "Rincian" Deret Waktu

Tanggal Sesi: 7 September 2026
Status: SELESAI (SUKSES DIVERIFIKASI)

---

## 1. Topik yang Dibahas
Masalah pada tampilan **Tabel Data Deret Waktu** (Timeseries) untuk indikator:
`Penduduk Berumur 15 Tahun - Total (Jiwa)` (Tahun 2021, 2022, 2024)
Di mana kolom **Rincian** menampilkan angka desimal/persentase yang salah:
- `54,12`
- `67,83`
- `68,76`
- `70,69`
- `78,11`
- `83,88`
- `Kabupaten Tasikmalaya`

---

## 2. Hasil Investigasi & Akar Masalah (Root Cause)

### Akar Masalah 1: Bug Urutan Kolom JSON di Backend
- **Lokasi File**: `backend/routers/timeseries.py`
- **Masalah**: Mengambil urutan kolom dengan `list(all_rows[0].data.keys())` yang urutan kuncinya acak di PostgreSQL Supabase, sehingga kolom terakhir (`TPAK`) terpilih sebagai `entity_key`.
- **Solusi Diterapkan**: Menggunakan `get_table_headers(db, table)` yang membaca `table.headers` (urutan kolom asli).

### Akar Masalah 2: Label Kolom Pertama Berupa Kode Footnote PDF (0, 1, 2, 3)
- **Tabel Terkait**: Tabel 3.2.2 (ID 6623, 7208, 7516) - *Penduduk Berumur 15 Tahun ke Atas Menurut Pendidikan Tertinggi yang Ditamatkan*
- **Solusi Diterapkan**:
  - `backend/routers/timeseries.py`: `normalize_entity_name` memetakan kode `0, 1, 2, 3` ke:
    - `0`: ≤ Sekolah Dasar (SD)
    - `1`: SMP / Sederajat
    - `2`: SMA / SMK / Sederajat
    - `3`: Perguruan Tinggi
    - `Kabupaten Tasikmalaya` (Total)
  - Database Supabase dipatch langsung pada baris tabel 6623, 7208, 7516.

### Akar Masalah 3: Header Kolom 0 Tabel 7516 (2021) Tertulis 'Tahun'
- **Masalah**: Tabel 7516 memiliki `headers[0] = 'Tahun'` dan row key `'Tahun'`, memicu deteksi tabel vertikal yang keliru sehingga tabel 2021 terabaikan.
- **Solusi Diterapkan**: Memperbaiki `table_name`, `headers[0]`, dan baris data ke `'Pendidikan Tertinggi Yang Ditamatkan'`.

---

## 3. Eksekusi yang Telah Selesai
1. **[backend/routers/timeseries.py](file:///d:/Kuliah/KP/project_bps_tasik/backend/routers/timeseries.py)**:
   - Baris 697, 764, 803 menggunakan `get_table_headers(db, table)`.
   - `normalize_entity_name` dilengkapi pemetaan dan standardisasi jenjang pendidikan.
2. **Database Patching & Backup**:
   - Backup otomatis disimpan di `backups/backup_tables_322_prepatch.json`.
   - Script `backend/patch_timeseries_edu.py` berhasil mempatch Tabel 7516, 7208, dan 6623.
3. **[backend/static/app.js](file:///d:/Kuliah/KP/project_bps_tasik/backend/static/app.js)**:
   - Fungsi `_sortEntitiesWithKabLast` diperbarui untuk mengurutkan jenjang pendidikan secara berurutan: SD -> SMP -> SMA -> PT -> Kabupaten Tasikmalaya.
4. **Verifikasi**:
   - Matriks data 2021, 2022, dan 2024 untuk indikator total maupun angkatan kerja bekerja telah diverifikasi dan 100% konsisten.
