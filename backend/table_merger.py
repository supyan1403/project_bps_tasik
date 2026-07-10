"""
Auto-merge untuk tabel yang terpisah jadi beberapa file CSV.
Dijalankan otomatis setiap kali extraction selesai.
"""
import os, csv, re, shutil
from collections import defaultdict

def normalize_guru_columns(specific_output_dir):
    """Rename kolom Guru di semua CSV:
    - 'Guru 1' -> 'Guru' (di semua konteks, mis: 'Guru 1 - Negeri' -> 'Guru - Negeri')
    - 'Guru 2' -> 'Guru'
    - 'Guru Non ASN 1' -> 'Guru Non ASN'
    """
    for fname in os.listdir(specific_output_dir):
        if not fname.endswith(".csv") or fname.startswith("_"):
            continue
        fpath = os.path.join(specific_output_dir, fname)
        try:
            with open(fpath, "r", encoding="utf-8") as f:
                content = f.read()
        except:
            continue

        old_content = content
        # Urutan penting: Guru Non ASN 1 dulu baru Guru 1/Guru 2
        content = content.replace("Guru Non ASN 1", "Guru Non ASN")
        content = content.replace("Guru 1", "Guru")
        content = content.replace("Guru 2", "Guru")

        if content != old_content:
            with open(fpath, "w", newline="", encoding="utf-8") as f:
                f.write(content)
            old_header = old_content.split("\n")[0]
            new_header = content.split("\n")[0]
            print(f"  Normalized: {fname}")
            print(f"    Old: {old_header[:100]}...")
            print(f"    New: {new_header[:100]}...")


def merge_tables_in_dir(specific_output_dir):
    """
    Scan folder hasil extraction, deteksi tabel yang terpecah menjadi
    beberapa file CSV, dan gabungkan.
    """
    csv_files = [f for f in os.listdir(specific_output_dir) if f.endswith(".csv") and not f.startswith("_")]
    
    # Grouping berdasarkan nomor tabel (misal: "4.1.5")
    groups = defaultdict(list)
    for f in csv_files:
        m = re.search(r'(Tabel \d+\.\d+\.?\d*)', f)
        if m:
            table_num = m.group(1)
            groups[table_num].append(f)
    
    for table_num, files in groups.items():
        if len(files) < 2:
            continue  # tidak perlu merge
        
        print(f"Merging {table_num}: {len(files)} files")
        
        # Baca semua file
        file_data = {}
        for fname in files:
            fpath = os.path.join(specific_output_dir, fname)
            try:
                with open(fpath, "r", encoding="utf-8") as f:
                    reader = csv.reader(f)
                    rows = list(reader)
                if len(rows) > 1:
                    file_data[fname] = rows
                    print(f"  {fname}: {len(rows)} rows, {len(rows[0])} cols")
            except:
                print(f"  {fname}: error reading")
        
        if len(file_data) < 2:
            continue
        
        # Cari file dengan kolom terbanyak (primary) dan yang lainnya
        sorted_files = sorted(file_data.items(), key=lambda x: len(x[1][0]), reverse=True)
        primary_name, primary_rows = sorted_files[0]
        secondary_name, secondary_rows = sorted_files[1]
        
        # Ambil header baris 1 (nama kolom)
        header_p = [h.strip() for h in primary_rows[0]]
        header_s = [h.strip() for h in secondary_rows[0]]
        
        # Cari kolom yang ADA di secondary tapi TIDAK di primary
        # (atau sebaliknya - kolom kosong di primary yang perlu diisi)
        
        # Identifikasi: 
        # Primary punya lebih banyak kolom → sebagian kolom mungkin kosong untuk beberapa baris
        # Secondary punya data untuk baris yang kosong di primary
        
        # Cari posisi kolom "Kecamatan"
        def find_kecamatan_col(header):
            for i, h in enumerate(header):
                if h.lower() == "kecamatan":
                    return i
            return 0
        
        kec_p = find_kecamatan_col(header_p)
        kec_s = find_kecamatan_col(header_s)
        
        # Baca data rows (skip baris header tambahan seperti "satuan", "tahun")
        def is_data_row(row, header_len):
            return row and len(row) > kec_p and row[kec_p].strip() and row[kec_p].strip() not in ("Kecamatan", "satuan", "tahun", "Total", "Jumlah", "Subtotal", "Grand Total") and not row[kec_p].strip().startswith("Tabel")
        
        data_p = [r for r in primary_rows if is_data_row(r, len(header_p))]
        data_s = [r for r in secondary_rows if is_data_row(r, len(header_s))]
        
        # Cari Total row
        total_p = None
        for r in primary_rows:
            if r and len(r) > 0 and r[0].strip() == "Total":
                total_p = r
                break
        
        total_s = None
        for r in secondary_rows:
            if r and len(r) > 0 and r[0].strip() == "Total":
                total_s = r
                break
        
        # Map data_s by kecamatan
        data_s_by_kec = {}
        for r in data_s:
            if len(r) > kec_s:
                kec = r[kec_s].strip()
                data_s_by_kec[kec] = r
        
        # Merge: untuk setiap baris di primary, isi kolom kosong dari secondary
        merged = [primary_rows[0]]  # header
        
        # Cari baris satuan/tahun jika ada
        row_idx = 1
        while row_idx < len(primary_rows) and primary_rows[row_idx] and len(primary_rows[row_idx]) > 0 and primary_rows[row_idx][0].strip() in ("satuan", "tahun", ""):
            merged.append(primary_rows[row_idx])
            row_idx += 1
        
        # Kolom secondary yang TIDAK ada di primary
        # Sesuaikan: secondary punya lebih sedikit kolom, tapi kolom-kolom itu
        # mungkin sesuai dengan kolom tertentu di primary
        
        # Strategy: cari kolom secondary yang value-nya cocok dengan
        # kecamatan yang sama di primary, lalu isi yang kosong
        filled_count = 0
        for rp in data_p:
            if len(rp) <= kec_p:
                continue
            kec = rp[kec_p].strip()
            rs = data_s_by_kec.get(kec)
            if rs:
                new_row = list(rp)
                # Isi kolom yang kosong di primary dari secondary
                empty_cols = [i for i in range(1, len(new_row)) if i < len(new_row) and (not new_row[i] or new_row[i].strip() == "")]
                s_data = [rs[j].strip() for j in range(1, len(rs)) if j < len(rs)]
                
                for si, sv in enumerate(s_data):
                    if si < len(empty_cols):
                        new_row[empty_cols[si]] = sv
                    else:
                        for ci in range(1, len(new_row)):
                            if ci < len(new_row) and (not new_row[ci] or new_row[ci].strip() == ""):
                                if ci not in empty_cols[:si]:
                                    new_row[ci] = sv
                                    break
                
                merged.append(new_row)
                filled_count += 1
            else:
                merged.append(list(rp))
        
        # Update Total row
        if total_p:
            new_total = ["Total"]
            for ci in range(1, len(total_p)):
                total_val = 0.0
                all_empty = True
                for dr in merged[1:]:
                    if dr[0].strip() not in ("Total", "satuan", "tahun") and ci < len(dr):
                        raw = dr[ci].strip()
                        if raw in ("", "-", "..", "."):
                            continue
                        try:
                            val = raw.replace(".", "").replace(",", ".")
                            total_val += float(val)
                            all_empty = False
                        except Exception:
                            pass
                if all_empty:
                    new_total.append("")
                else:
                    new_total.append(str(int(total_val)) if total_val == int(total_val) else str(total_val))
            merged.append(new_total)
        
        print(f"  Filled {filled_count} rows with data from secondary file")
        print(f"  Total rows in merged: {len(merged)}")
        
        # Tulis merged ke primary file
        primary_path = os.path.join(specific_output_dir, primary_name)
        temp_path = primary_path + ".tmp"
        with open(temp_path, "w", newline="", encoding="utf-8") as f:
            csv.writer(f).writerows(merged)
        shutil.move(temp_path, primary_path)
        
        # Backup dan hapus secondary files
        for fname in file_data:
            if fname != primary_name:
                fpath = os.path.join(specific_output_dir, fname)
                os.remove(fpath)
                print(f"  Deleted: {fname}")
        
        print(f"  Merged into: {primary_name}")
    
    # Normalisasi kolom Guru di semua CSV (merged maupun tidak)
    print("\nNormalizing Guru columns across all CSVs...")
    normalize_guru_columns(specific_output_dir)
    
    return True


if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1:
        merge_tables_in_dir(sys.argv[1])
        print("Done!")
    else:
        print("Usage:")
        print("  python table_merger.py <directory>")
