"""
Jalankan SETELAH ekstrak ulang via web.
Script ini akan mencari file 4.1.5 yang terpisah dan menggabungkannya kembali.
"""
import os, shutil, csv, re

extract_dir = r"C:\Users\MyBook Z Series\BPS_Data\hasil_ekstraksi_web\doc_81"

# Cari semua folder Ekstraksi_Hal_*
for root, dirs, files in os.walk(extract_dir):
    csv_files = [f for f in files if f.endswith(".csv")]
    
    # Cari file 4.1.5 yang mengandung "Hal 118, 120" (bagian 2 - hanya Guru+Murid)
    file_118 = None
    file_115 = None
    for f in csv_files:
        if "4.1.5" in f:
            if "118" in f and "120" in f:
                file_118 = os.path.join(root, f)
            elif "115" in f and "117" in f:
                file_115 = os.path.join(root, f)
    
    if file_118 and file_115:
        print(f"Folder: {root}")
        print(f"  File 1 (115,117,119,116): {os.path.basename(file_115)}")
        print(f"  File 2 (118,120): {os.path.basename(file_118)}")
        
        # Backup dulu
        backup_dir = os.path.join(root, "_backup")
        os.makedirs(backup_dir, exist_ok=True)
        shutil.copy2(file_115, os.path.join(backup_dir, os.path.basename(file_115) + ".bak"))
        shutil.copy2(file_118, os.path.join(backup_dir, os.path.basename(file_118) + ".bak"))
        print("  Backup created in _backup/")
        
        # Baca kedua file
        with open(file_115, "r", encoding="utf-8") as f:
            r1 = list(csv.reader(f))
        with open(file_118, "r", encoding="utf-8") as f:
            r2 = list(csv.reader(f))
        
        if not r1 or not r2:
            print("  ERROR: File kosong!")
            continue
        
        print(f"  File 1: {len(r1)} baris (termasuk header), {len(r1[0])} kolom")
        print(f"  File 2: {len(r2)} baris (termasuk header), {len(r2[0])} kolom")
        
        # Cari baris Kecamatan (bukan Total, bukan header)
        def is_data_row(row):
            return row and row[0] and row[0].strip() not in ("", "Kecamatan", "Total") and not row[0].startswith("Tabel")
        
        data1 = [r for r in r1 if is_data_row(r)]
        data2 = [r for r in r2 if is_data_row(r)]
        print(f"  Data rows file 1: {len(data1)}, file 2: {len(data2)}")
        
        # Merge: ambil header dari file 1, ganti kolom ".1" dengan data dari file 2
        header1 = r1[0]
        
        # Cari kolom ".1" di header file 1
        col1_indices = [i for i, h in enumerate(header1) if h.strip().endswith(".1")]
        
        if not col1_indices:
            print("  ERROR: Tidak ada kolom .1 di file 1 - mungkin sudah pernah dimerge")
            continue
        
        print(f"  Kolom .1 di file 1: {[header1[i] for i in col1_indices]}")
        
        # Cari header file 2 yang sesuai (tanpa .1)
        header2_clean = [h.replace(" 2024/2025", "").replace(" 2025/2026", "").replace(".1", "").strip() for h in r2[0]]
        
        # Map: untuk setiap kolom .1 di file 1, cari posisi yang sama di file 2
        # Asumsi: urutan kolom sama persis
        if len(r2[0]) >= len(col1_indices):
            print(f"  File 2 header: {r2[0]}")
            
            # Bangun merged rows
            merged = [header1]  # header tetap dari file 1
            
            for i, row1 in enumerate(r1[1:]):  # skip header
                if is_data_row(row1):
                    match = None
                    kec = row1[0].strip()
                    
                    # Cari kecamatan yang sama di file 2
                    for j, row2 in enumerate(r2[1:]):
                        if is_data_row(row2) and row2[0].strip() == kec:
                            match = row2
                            break
                    
                    if match:
                        new_row = list(row1)
                        # Ganti nilai kolom .1 dengan nilai dari file 2
                        for idx, col_idx in enumerate(col1_indices):
                            if idx + 1 < len(match):  # +1 karena kolom 0 adalah Kecamatan
                                new_row[col_idx] = match[idx + 1]
                        merged.append(new_row)
                    else:
                        print(f"  WARNING: Kecamatan '{kec}' tidak ditemukan di file 2, pakai data file 1")
                        merged.append(list(row1))
                else:
                    # Total row atau baris lain
                    if row1[0].strip() == "Total" and len(row1) > 1:
                        # Update total row dengan menjumlahkan semua data rows
                        total_row = ["Total"]
                        for col_idx in range(1, len(row1)):
                            total = 0
                            for data_row in merged[1:]:
                                if data_row[0].strip() != "Total" and col_idx < len(data_row):
                                    try:
                                        total += int(data_row[col_idx].strip())
                                    except:
                                        pass
                            total_row.append(str(total))
                        merged.append(total_row)
                    else:
                        merged.append(list(row1))
            
            # Tulis merged file
            temp_path = file_115 + ".tmp"
            with open(temp_path, "w", newline="", encoding="utf-8") as f:
                csv.writer(f).writerows(merged)
            shutil.move(temp_path, file_115)
            
            # Hapus file 118, 120 (udah dimerge)
            os.remove(file_118)
            print(f"  Merged: {len(merged)} baris (header + {len(data1)} data + Total)")
            print(f"  Deleted: {os.path.basename(file_118)}")
            print(f"  Updated: {os.path.basename(file_115)}")
        else:
            print(f"  ERROR: File 2 kolom ({len(r2[0])}) < jumlah kolom .1 ({len(col1_indices)})")
    else:
        if csv_files:
            for f in csv_files:
                if "4.1.5" in f:
                    print(f"Skipped (no pair): {os.path.join(root, f)}")

print("\nDone! Restart server agar mendaftarkan ulang extracted_tables.")
