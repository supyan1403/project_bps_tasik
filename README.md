<div align="center">

<p align="center">
  <img src="backend/static/logo_bps.png" alt="Logo Badan Pusat Statistik" height="80" style="margin-right: 20px; vertical-align: middle;" />
  <img src="backend/static/logo_sipedas.png" alt="Logo SIPEDAS" height="80" style="vertical-align: middle;" />
</p>

# SIPEDAS
### **Sistem Integrasi, Pencarian, dan Analisis Data Statistik**
**Badan Pusat Statistik Kabupaten Tasikmalaya**

<p align="center">
  <img src="https://img.shields.io/badge/Python-3.10%20%7C%203.11%20%7C%203.12-3776AB?style=flat-square&logo=python&logoColor=white" alt="Python" />
  <img src="https://img.shields.io/badge/Backend-FastAPI-009688?style=flat-square&logo=fastapi&logoColor=white" alt="FastAPI" />
  <img src="https://img.shields.io/badge/Database-MySQL%20%2F%20SQLite-4479A1?style=flat-square&logo=mysql&logoColor=white" alt="Database" />
  <img src="https://img.shields.io/badge/Frontend-Vanilla%20SPA%20%26%20Bootstrap%205-7952B3?style=flat-square&logo=bootstrap&logoColor=white" alt="Frontend" />
  <img src="https://img.shields.io/badge/Charts-Chart.js-FF6384?style=flat-square&logo=chartdotjs&logoColor=white" alt="Chart.js" />
  <img src="https://img.shields.io/badge/Status-Beta%20Preview-F59E0B?style=flat-square" alt="Status" />
</p>

<p align="center">
  <em>Platform terpadu digitalisasi, ekstraksi cerdas, dan analisis deret waktu (time series) multi-tahun publikasi data statistik resmi Badan Pusat Statistik Kabupaten Tasikmalaya.</em>
</p>

</div>

---

## Navigasi Dokumentasi

| Kategori | Modul & Panduan | Deskripsi Ringkas |
| :--- | :--- | :--- |
| **Pengenalan** | [Tentang SIPEDAS](#tentang-sipedas) | Latar belakang dan tujuan sistem |
| **Fitur** | [Fitur Utama](#fitur-fitur-utama) | 8 modul utama sistem |
| **Instalasi** | [Panduan Instalasi Lengkap](#panduan-instalasi-lengkap) | Step-by-step dari nol sampai jalan |
| **API** | [Dokumentasi REST API](#dokumentasi-rest-api) | Endpoint Swagger |
| **Troubleshooting** | [Panduan Troubleshooting](#panduan-troubleshooting) | Solusi kendala umum |
| **Struktur** | [Struktur Direktori](#struktur-direktori-proyek) | Pohon berkas proyek |

---

## Tentang SIPEDAS

Publikasi data statistik berkala resmi, seperti buku **Kabupaten Dalam Angka (DDA)**, diterbitkan dalam bentuk dokumen buku PDF berukuran besar yang memuat ratusan hingga ribuan tabel statistik. Format dokumen statis ini menghadirkan beberapa tantangan nyata:
- **Sulit Dicari**: Membutuhkan waktu untuk menemukan indikator statistik tertentu di antara ribuan halaman.
- **Tidak Terintegrasi Lintas Tahun**: Sulit membandingkan perkembangan angka dan tren deret waktu antar edisi publikasi.
- **Format Statis**: Data tidak dapat langsung diolah atau diekspor ke dalam format analitik visual.

**SIPEDAS (Sistem Integrasi, Pencarian, dan Analisis Data Statistik)** hadir sebagai solusi komprehensif yang mentransformasi buku PDF publikasi BPS menjadi basis data relasional dinamis. Sistem ini memungkinkan pencarian indikator secara instan, perbandingan tren multi-tahun, pembuatan grafik otomatis, serta pelaporan data yang fleksibel dan aman.

---

## Fitur-Fitur Utama

- **Dashboard Eksekutif Interaktif**: Ringkasan akumulasi data statistik secara langsung, visualisasi sebaran tabel per bab publikasi, banner selamat datang dengan jam & kalender digital dinamis, serta indikator pemantauan status basis data.
- **Modern Responsive Layout & Smart Sidebar**:
  - Sidebar pintar yang mendukung mode diperluas (*expanded*) dan mode ringkas (*collapsed 68px*) dengan satu klik pada logo SIPEDAS.
  - *Floating Submenu Popover* mulus saat sidebar tertutup (pada menu Manajemen Database dan Akun Administrator).
  - Kartu profil Administrator dengan *Space-Between Layout*, avatar perisai resmi BPS dengan indikator status online aktif, serta menu *Logout Flyout* melayang ke samping kanan tanpa pernah menutupi menu navigasi.
- **Pemisahan Peran & Keamanan Berlapis (Role-Based Access Control)**:
  - **Mode Publik / Pegawai**: Akses cepat pencarian indikator, penelusuran tabel, dan grafik deret waktu tanpa menu sensitif.
  - **Mode Administrator**: Kontrol penuh pengelolaan basis data, impor, koreksi kolom, hingga backup sistem.
  - Enkripsi password menggunakan algoritma PBKDF2-HMAC-SHA256 dengan Salt acak 16-byte, serta proteksi pembatasan percobaan gagal (*Anti-Brute Force Lockout* 5 menit).
- **Mode Pemeliharaan (Maintenance Mode) & Sistem**: Kontrol status pemeliharaan sistem dengan countdown timer otomatis, pelacakan log aktivitas admin, dan pembersihan berkas cache/sampah langsung dari antarmuka atau `start.bat`.
- **Ekstraksi PDF Cerdas**: Ekstraksi otomatis nomor tabel, judul publikasi, satuan unit, dan multi-level header menggunakan integrasi pdfplumber & pypdf.
- **Sinkronisasi & Parser Excel**: Dukungan impor berkas lembar kerja spreadsheet Excel (`.xlsx` / `.xls`) langsung ke dalam basis data relasional.
- **Data Table Explorer & Live Cell Editor**: Penelusuran data tabel per bab/kategori, pencarian cepat pada tingkat kolom maupun baris, serta fitur pengeditan sel nilai data langsung di browser.
- **Modul Analisis Deret Waktu (Time Series Engine)**: Pelacakan tren statistik lintas tahun secara dinamis, penyaringan indikator tunggal/gabungan, visualisasi grafik garis & batang interaktif, serta ekspor laporan kustom (PDF, PNG, CSV, Excel).
- **Deteksi & Resolusi Anomali Data**: Pemindaian otomatis anomali nama kolom bilingual / duplikat serta koreksi inkonsistensi struktur tabel secara massal.
- **Manajemen Database & Restore Web**: Pencadangan basis data otomatis (`.sql`), pemulihan data instan langsung melalui antarmuka web, serta kompatibilitas multi-database (MySQL / SQLite).

---

## Panduan Instalasi Lengkap

> **Penting**: Ikuti setiap langkah secara berurutan. Jangan melompati langkah apapun.

### Langkah 1: Prasyarat Sistem

Pastikan perangkat Anda telah terpasang:

1. **Python** versi `3.10`, `3.11`, atau `3.12`
   - Unduh di: https://www.python.org/downloads/
   - **WAJIB**: Centang pilihan **"Add Python to PATH"** saat instalasi
   - Verifikasi instalasi: buka terminal lalu ketik `python --version`

2. **Git**
   - Unduh di: https://git-scm.com/
   - Verifikasi: buka terminal lalu ketik `git --version`

3. **XAMPP** (opsional, untuk database MySQL)
   - Unduh di: https://www.apachefriends.org/
   - Jika tidak ingin pakai XAMPP, sistem akan otomatis menggunakan SQLite

### Langkah 2: Clone Repository

Buka terminal (PowerShell atau Command Prompt), lalu jalankan:

```bash
git clone https://github.com/supyan1403/project_bps_tasik.git
cd project_bps_tasik
```

### Langkah 3: Buat Virtual Environment

Virtual environment direkomendasikan dibuat di dalam direktori `backend/` agar selaras dengan skrip otomatis `start.bat`:

```bash
cd backend
python -m venv venv
```

### Langkah 4: Aktifkan Virtual Environment & Instal Dependensi

**Windows (PowerShell):**
```powershell
venv\Scripts\activate
pip install -r ../requirements.txt
```

**Windows (Command Prompt):**
```cmd
venv\Scripts\activate.bat
pip install -r ..\requirements.txt
```

**Linux / macOS:**
```bash
source venv/bin/activate
pip install -r ../requirements.txt
```

> **Tanda berhasil**: Prompt terminal akan menampilkan `(venv)` di awal baris.

### Langkah 5: Konfigurasi Database

SIPEDAS mendukung dua mode database. Pilih **salah satu**:

#### Opsi A: MySQL via XAMPP (Default)

1. Buka **XAMPP Control Panel**
2. Klik **Start** pada modul **Apache** dan **MySQL**
3. Buka browser ke `http://localhost/phpmyadmin`
4. Buat basis data baru bernama: `bps_tasikmalaya`
   - Klik **New** di menu kiri
   - Masukkan nama: `bps_tasikmalaya`
   - Klik **Create**

> Sistem akan otomatis terkoneksi ke `mysql+pymysql://root:@127.0.0.1:3306/bps_tasikmalaya`

#### Opsi B: SQLite (Tanpa XAMPP)

Jika tidak ingin menggunakan MySQL, set variabel lingkungan sebelum menjalankan server:

**Windows (PowerShell):**
```powershell
$env:DATABASE_URL="sqlite:///./bps_dashboard.db"
```

**Windows (Command Prompt):**
```cmd
set DATABASE_URL=sqlite:///./bps_dashboard.db
```

**Linux / macOS:**
```bash
export DATABASE_URL="sqlite:///./bps_dashboard.db"
```

### Langkah 6: Jalankan Server

**Cara 1: Menggunakan Start Script (Windows - Direkomendasikan)**

Kembali ke root proyek lalu klik dua kali berkas `start.bat` (atau jalankan `.\start.bat` di terminal):
- Pilih opsi `1` untuk Normal Mode
- Pilih opsi `2` untuk Maintenance Mode (bisa menentukan target waktu selesai)
- Pilih opsi `3` untuk Menonaktifkan Maintenance

**Cara 2: Melalui Terminal**

Dari dalam folder `backend/` dengan venv aktif:

```bash
python run_server.py
```

### Langkah 7: Akses Aplikasi

Buka peramban (browser) dan akses:

**http://127.0.0.1:8000**

### Langkah 8: Login Admin

1. Klik tombol **"Login Admin"** di pojok kiri bawah sidebar
2. Masukkan password admin:
   - **Password Default Awal**: `ganti_password_saya` (atau sesuai nilai variabel lingkungan `SIPEDAS_ADMIN_PASSWORD` pada `.env`).
   - Setelah login pertama kali, sangat disarankan segera mengganti password melalui menu **Manajemen Database > Ganti Password**.
3. Klik **"Masuk Sekarang"**

### Langkah 9: Isi Data

Setelah login, Anda memiliki tiga cara untuk mengisi data:

#### Cara A: Upload & Ekstrak PDF Publikasi

1. Buka menu **Data Tabel** di sidebar
2. Klik **"Tambah Publikasi Baru"**
3. Upload berkas PDF publikasi BPS (format `.pdf`)
4. Sistem akan otomatis mengekstrak tabel-tabel dari PDF
5. Tunggu hingga proses selesai

#### Cara B: Restore dari Backup Database

1. Pastikan Anda memiliki berkas backup `.sql`
2. Login sebagai Administrator
3. Buka menu **Manajemen Database**
4. Pada panel **"Unggah Berkas Backup (.sql)"**, pilih berkas `.sql`
5. Klik **"Unggah & Pulihkan"**
6. Sistem akan memproses impor data secara otomatis

#### Cara C: Import Excel

1. Login sebagai Administrator
2. Buka menu **Import Excel**
3. Upload berkas `.xlsx` atau `.xls`
4. Ikuti panduan mapping kolom yang muncul

---

## Dokumentasi REST API

FastAPI menyediakan dokumentasi API interaktif secara bawaan. Saat server berjalan:

- **Swagger UI Interaktif**: `http://127.0.0.1:8000/docs`
- **ReDoc Dokumentasi**: `http://127.0.0.1:8000/redoc`

### Ringkasan Router Endpoint

| Endpoint Prefix | Modul Router | Fungsi Utama |
| :--- | :--- | :--- |
| `/api/documents` | `documents.py` | Manajemen dokumen publikasi dan ekstraksi PDF |
| `/api/tables` | `tables.py` | Penelusuran tabel, pencarian data, dan live cell editor |
| `/api/timeseries` | `timeseries.py` | Agregasi data deret waktu multi-tahun |
| `/api/stats` | `stats.py` | KPI agregat statistik untuk dashboard |
| `/api/master-data` | `master_data.py` | Standarisasi master kolom dan kamus indikator |
| `/api/anomaly` | `anomaly.py` | Deteksi dan resolusi anomali struktur kolom |
| `/api/admin` | `admin.py` | Pencadangan, pemulihan database, maintenance, dan logs |
| `/api/auth` | `auth.py` | Otentikasi admin, manajemen sesi, dan ganti password |
| `/api/import` | `import_excel.py` | Template parser dan pengunggahan data lembar kerja Excel |

---

## Panduan Troubleshooting

| Gejala Kendala | Penyebab | Solusi |
| :--- | :--- | :--- |
| **Error: Address already in use (Port 8000)** | Proses Python lain masih berjalan di port 8000 | Jalankan `start.bat` (otomatis membersihkan port), atau matikan proses manual lewat Task Manager |
| **Error: Can't connect to MySQL server (10061)** | Layanan MySQL di XAMPP belum menyala | Buka XAMPP Control Panel, klik **Start** pada modul **MySQL**, atau gunakan [Mode SQLite](#opsi-b-sqlite-tanpa-xampp) |
| **ModuleNotFoundError: No module named 'xxx'** | Dependensi belum terinstal | Jalankan ulang `pip install -r requirements.txt` di dalam venv |
| **Ekstraksi PDF tidak membaca angka** | PDF merupakan hasil scan gambar, bukan teks digital | Pastikan menggunakan PDF resmi BPS yang teksnya bisa diseleksi/disalin |
| **Lupa password admin** | Belum mengatur ulang kredensial | Hapus file `backend/data/auth_credentials.json` lalu restart server untuk kembali ke default (`ganti_password_saya`) |
| **Database tidak terkoneksi** | MySQL belum jalan atau DATABASE_URL salah | Cek apakah XAMPP MySQL sudah running, atau set `DATABASE_URL` untuk SQLite |

---

## Struktur Direktori Proyek

```text
project_bps_tasik/
│
├── start.bat                   # Skrip otomatis runner server (Normal & Maintenance Mode)
├── start_maintenance.bat       # Skrip cepat aktifasi mode pemeliharaan
├── requirements.txt            # Daftar dependensi paket Python
├── README.md                   # Dokumentasi resmi sistem
├── .env.example                # Templat variabel lingkungan (production/keamanan)
├── .gitignore                  # Berkas pengecualian Git
├── table_mods.json             # Konfigurasi penggabungan tabel PDF multi-halaman
│
├── pipeline/                   # Pipeline inti pemrosesan & ekstraksi dokumen
│   ├── __init__.py
│   ├── pdf_table_pipeline.py   # Ekstraktor tabel PDF cerdas (pdfplumber)
│   ├── pipeline_utils.py       # Utilitas pembersihan teks & header
│   └── extract_toc.py          # Ekstraktor daftar isi & struktur bab
│
├── backups/                    # Direktori penyimpanan file cadangan database (.sql)
│
└── backend/                    # Core backend server (FastAPI)
    ├── venv/                   # Python Virtual Environment
    ├── main.py                 # Titik masuk utama & konfigurasi FastAPI
    ├── database.py             # Konfigurasi koneksi SQLAlchemy ORM
    ├── models.py               # Definisi skema tabel basis data relasional
    ├── schemas.py              # Skema validasi request/response Pydantic
    ├── run_server.py           # Runner server backend
    │
    ├── routers/                # Modul router endpoint API terpisah
    │   ├── admin.py            # Manajemen backup, restore, maintenance & activity logs
    │   ├── anomaly.py          # Deteksi & resolusi anomali kolom
    │   ├── auth.py             # Otentikasi admin, PBKDF2 hash & lockout
    │   ├── documents.py        # Pengelolaan dokumen & ekstraksi PDF
    │   ├── import_excel.py     # Parser & import berkas spreadsheet Excel
    │   ├── master_data.py      # Master kamus kolom statistik
    │   ├── stats.py            # KPI & metrik agregasi dashboard
    │   ├── tables.py           # Penelusuran data tabel & live editor
    │   └── timeseries.py       # Analisis deret waktu multi-tahun
    │
    ├── data/                   # Berkas konfigurasi JSON & kredensial
    │   ├── auth_credentials.json (auto-generated saat runtime)
    │   ├── master_columns.json
    │   └── master_dictionary.json
    │
    ├── static/                 # Aset web statis (Frontend)
    │   ├── app.js              # Logika utama SPA
    │   ├── auth_role_logic.js  # Logika otentikasi & dialog ganti password
    │   ├── logo_bps.png        # Logo resmi BPS
    │   ├── logo_sipedas.png    # Logo sistem SIPEDAS
    │   └── css/                # Modul stylesheet CSS terstruktur
    │       ├── theme.css       # Design system CSS variables
    │       ├── base.css        # Base resets
    │       ├── sidebar.css     # Sidebar navigation
    │       ├── components.css  # Buttons, badges, modals
    │       ├── dashboard.css   # Dashboard cards/widgets
    │       ├── tables.css      # Table styling
    │       └── timeseries.css  # Time series wizard & charts
    │
    └── templates/              # Antarmuka template HTML & Error Pages
        ├── index.html          # Halaman utama aplikasi SIPEDAS
        ├── maintenance.html    # Halaman interaktif status pemeliharaan
        ├── 404.html            # Halaman kesalahan 404 Not Found
        └── 500.html            # Halaman kesalahan 500 Server Error
```

---

## Spesifikasi Teknologi (Tech Stack)

| Komponen | Teknologi | Keterangan |
| :--- | :--- | :--- |
| **Backend** | Python 3.10+ & FastAPI | Performa asinkron tinggi |
| **Server** | Uvicorn (ASGI) | Server web berkecepatan tinggi |
| **ORM & Database** | SQLAlchemy 2.0+ | MySQL & SQLite |
| **Data Processing** | Pandas & OpenPyXL | Manipulasi tabel & spreadsheet |
| **PDF Extraction** | pdfplumber | Ekstraksi teks berbasis grid |
| **Frontend** | Vanilla JavaScript SPA | Tanpa build tools |
| **Styling** | Bootstrap 5.3 & Bootstrap Icons | Tata letak modern |
| **Charts** | Chart.js | Visualisasi tren deret waktu |
| **Security** | PBKDF2-HMAC-SHA256 | Hashing kredensial dengan Salt |

---

## Hak Cipta & Lisensi Resmi

Hak Cipta © 2026 **Badan Pusat Statistik Kabupaten Tasikmalaya**. Seluruh hak cipta dilindungi undang-undang.

Aplikasi ini dikembangkan untuk mendukung kegiatan pengumpulan, pengolahan, integrasi, digitalisasi, dan diseminasi data statistik resmi di lingkungan **Badan Pusat Statistik Kabupaten Tasikmalaya**.
