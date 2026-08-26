"""
Script: Standardisasi Kolom "Penduduk Berumur 15 Tahun" - Sections 3.2.1-3.2.3
Tujuan: Standardisasi nama kolom, hapus duplikat, update table_name
"""
import json
import os
import sys
import subprocess
from datetime import datetime
from sqlalchemy import text
from database import engine

# Fix Windows encoding
sys.stdout.reconfigure(encoding='utf-8')

# ============================================================
# 1. BACKUP DATABASE
# ============================================================
print("=" * 60)
print("STEP 1: BACKUP DATABASE")
print("=" * 60)

timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
backup_dir = os.path.join(os.path.dirname(__file__), "..", "backups")
os.makedirs(backup_dir, exist_ok=True)
backup_file = os.path.join(backup_dir, f"backup_before_15tahun_standardize_{timestamp}.sql")

try:
    result = subprocess.run(
        ["mysqldump", "-u", "root", "--password=", "bps_tasikmalaya"],
        capture_output=True, text=True, timeout=120
    )
    if result.returncode == 0:
        with open(backup_file, "w", encoding="utf-8") as f:
            f.write(result.stdout)
        print(f"✅ Backup berhasil: {backup_file}")
    else:
        print(f"⚠️ mysqldump error: {result.stderr}")
        print("Melanjutkan tanpa backup file...")
except FileNotFoundError:
    print("⚠️ mysqldump tidak ditemukan, backup via Python...")
    # Fallback: backup via SELECT
    conn = engine.connect()
    rows = conn.execute(text("SELECT * FROM extracted_tables WHERE id IN (7098,7099,7100,7207,7208,7209,7515,7516,7517)")).fetchall()
    with open(backup_file, "w", encoding="utf-8") as f:
        f.write(f"-- Backup extracted_tables for 15 Tahun tables\n")
        f.write(f"-- Date: {timestamp}\n\n")
        for row in rows:
            f.write(f"-- ID: {row[0]}, table_name: {row[2]}\n")
            f.write(f"-- headers: {row[4]}\n")
            f.write(f"-- units: {row[5]}\n\n")
    conn.close()
    print(f"✅ Backup metadata berhasil: {backup_file}")
except Exception as e:
    print(f"⚠️ Backup error: {e}")
    print("Melanjutkan tanpa backup...")

# ============================================================
# 2. STANDARDISASI NAMA KOLOM
# ============================================================
print("\n" + "=" * 60)
print("STEP 2: STANDARDISASI NAMA KOLOM")
print("=" * 60)

COLUMN_MAPPING = {
    # 3.2.1 - Jenis Kegiatan
    "Jumlah Penduduk Berumur 15 Tahun Keatas Menurut Jenis Kegiatan Selama Seminggu Terakhir Jenis Kelamin - Laki-Laki":
        "Penduduk Berumur 15 Tahun - Jenis Kegiatan - Laki-Laki",
    "Jumlah Penduduk Berumur 15 Tahun Keatas Menurut Jenis Kegiatan Selama Seminggu Terakhir Jenis Kelamin - Perempuan":
        "Penduduk Berumur 15 Tahun - Jenis Kegiatan - Perempuan",
    "Jumlah Penduduk Berumur 15 Tahun Keatas Menurut Jenis Kegiatan Selama Seminggu Terakhir Jenis Kelamin - Laki-Laki + Perempuan":
        "Penduduk Berumur 15 Tahun - Jenis Kegiatan - Total",
    
    # 3.2.2 - Angkatan Kerja
    "Jumlah Angkatan Kerja/Economically Active - Bekerja":
        "Penduduk Berumur 15 Tahun - Angkatan Kerja - Bekerja",
    "Jumlah Angkatan Kerja/Economically Active - Bekerja.1":
        "Penduduk Berumur 15 Tahun - Angkatan Kerja - Bekerja",
    "Jumlah Angkatan Kerja/Economically Active - Pengangguran":
        "Penduduk Berumur 15 Tahun - Angkatan Kerja - Pengangguran",
    "Jumlah Angkatan Kerja/Economically Active - Pengangguran.1":
        "Penduduk Berumur 15 Tahun - Angkatan Kerja - Pengangguran",
    "Jumlah Angkatan Kerja/Economically Active - Bekerja dan Pengangguran":
        "Penduduk Berumur 15 Tahun - Angkatan Kerja - Total",
    "Jumlah Angkatan Kerja/Economically Active - Bekerja dan Pengangguran.1":
        "Penduduk Berumur 15 Tahun - Angkatan Kerja - Total",
    "Persentase Bekerja Terhadap Angkatan Kerja/Economically Active":
        "Penduduk Berumur 15 Tahun - Persentase Bekerja",
    "Persentase Bekerja Terhadap Angkatan Kerja/Economically Active.1":
        "Penduduk Berumur 15 Tahun - Persentase Bekerja",
    "Jumlah Bukan Angkatan Kerja":
        "Penduduk Berumur 15 Tahun - Bukan Angkatan Kerja",
    "Jumlah Bukan Angkatan Kerja.1":
        "Penduduk Berumur 15 Tahun - Bukan Angkatan Kerja",
    "Jumlah Angkatan Kerja Dan Bukan":
        "Penduduk Berumur 15 Tahun - Total",
    "Jumlah Angkatan Kerja Dan Bukan.1":
        "Penduduk Berumur 15 Tahun - Total",
    "Persentase Angkatan Kerja terhadap Penduduk Usia Kerja":
        "Penduduk Berumur 15 Tahun - Persentase AK terhadap PUK",
    "Persentase Angkatan Kerja terhadap Penduduk Usia Kerja.1":
        "Penduduk Berumur 15 Tahun - Persentase AK terhadap PUK",
    "Tingkat Partisipasi Angkatan Kerja (TPAK)":
        "Penduduk Berumur 15 Tahun - TPAK",
    
    # 3.2.3 - Status Pekerjaan
    "Penduduk Berumur 15 Tahun Ke Atas yang Bekerja Selama Seminggu Terakhir - Jumlah":
        "Penduduk Berumur 15 Tahun - Status Pekerjaan - Total",
    "Penduduk Berumur 15 Tahun Ke Atas yang Bekerja Selama Seminggu Terakhir - Laki-Laki":
        "Penduduk Berumur 15 Tahun - Status Pekerjaan - Laki-Laki",
    "Penduduk Berumur 15 Tahun Ke Atas yang Bekerja Selama Seminggu Terakhir - Perempuan":
        "Penduduk Berumur 15 Tahun - Status Pekerjaan - Perempuan",
    "Penduduk Berumur 15 Tahun Ke Atas yang Bekerja Selama Seminggu Terakhir Jenis Kelamin - Laki-Laki":
        "Penduduk Berumur 15 Tahun - Status Pekerjaan - Laki-Laki",
    "Penduduk Berumur 15 Tahun Ke Atas yang Bekerja Selama Seminggu Terakhir Jenis Kelamin - Perempuan":
        "Penduduk Berumur 15 Tahun - Status Pekerjaan - Perempuan",
    "Penduduk Berumur 15 Tahun Ke Atas yang Bekerja Selama Seminggu Terakhir Jenis Kelamin - Laki-Laki + Perempuan":
        "Penduduk Berumur 15 Tahun - Status Pekerjaan - Total",
}

TABLE_IDS = [7098, 7099, 7100, 7207, 7208, 7209, 7515, 7516, 7517]

conn = engine.connect()
updated_count = 0

for tid in TABLE_IDS:
    row = conn.execute(text("SELECT headers FROM extracted_tables WHERE id = :id"), {"id": tid}).fetchone()
    if not row or not row[0]:
        continue
    
    headers = json.loads(row[0]) if isinstance(row[0], str) else row[0]
    new_headers = []
    changed = False
    
    for h in headers:
        if h in COLUMN_MAPPING:
            new_h = COLUMN_MAPPING[h]
            new_headers.append(new_h)
            if new_h != h:
                changed = True
                print(f"  ID {tid}: '{h[:60]}...' → '{new_h}'")
        else:
            new_headers.append(h)
    
    if changed:
        conn.execute(
            text("UPDATE extracted_tables SET headers = :headers WHERE id = :id"),
            {"headers": json.dumps(new_headers), "id": tid}
        )
        updated_count += 1

conn.commit()
print(f"\n✅ {updated_count} tabel berhasil di-update namanya")

# ============================================================
# 3. UPDATE TABLE_NAME
# ============================================================
print("\n" + "=" * 60)
print("STEP 3: UPDATE TABLE_NAME")
print("=" * 60)

TABLE_NAME_UPDATES = {
    7207: "Tabel 3.2.1 - Penduduk Berumur 15 Tahun Menurut Jenis Kegiatan",
    7208: "Tabel 3.2.2 - Penduduk Berumur 15 Tahun Menurut Pendidikan dan Jenis Kegiatan",
    7209: "Tabel 3.2.3 - Penduduk Berumur 15 Tahun Menurut Status Pekerjaan",
}

for tid, new_name in TABLE_NAME_UPDATES.items():
    conn.execute(
        text("UPDATE extracted_tables SET table_name = :name WHERE id = :id"),
        {"name": new_name, "id": tid}
    )
    print(f"  ID {tid}: → {new_name}")

conn.commit()
print(f"\n✅ {len(TABLE_NAME_UPDATES)} nama tabel berhasil di-update")

# ============================================================
# 4. HAPUS DUPLIKAT
# ============================================================
print("\n" + "=" * 60)
print("STEP 4: HAPUS DUPLIKAT")
print("=" * 60)

# Keep doc 87 (ID 7207, 7208, 7209)
# Delete doc 91 (ID 7098, 7099, 7100) and doc 92 (ID 7515, 7516, 7517)
DELETE_IDS = [7098, 7099, 7100, 7515, 7516, 7517]

for did in DELETE_IDS:
    # First delete table_rows
    conn.execute(
        text("DELETE FROM table_rows WHERE table_id = :id"),
        {"id": did}
    )
    # Then delete extracted_table
    conn.execute(
        text("DELETE FROM extracted_tables WHERE id = :id"),
        {"id": did}
    )
    print(f"  ID {did}: dihapus (duplikat)")

conn.commit()
print(f"\n✅ {len(DELETE_IDS)} duplikat berhasil dihapus")

# ============================================================
# 5. VERIFIKASI
# ============================================================
print("\n" + "=" * 60)
print("STEP 5: VERIFIKASI")
print("=" * 60)

remaining = conn.execute(
    text("SELECT id, table_name, headers FROM extracted_tables WHERE id IN :ids ORDER BY id"),
    {"ids": tuple([7207, 7208, 7209])}
).fetchall()

for row in remaining:
    headers = json.loads(row[2]) if isinstance(row[2], str) else row[2]
    print(f"\nID {row[0]}: {row[1]}")
    print(f"  Headers: {headers}")

conn.close()
print("\n" + "=" * 60)
print("SELESAI! Semua perubahan berhasil.")
print("=" * 60)
