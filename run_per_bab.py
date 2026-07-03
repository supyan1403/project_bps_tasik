import os
import subprocess
import json

BAB_RANGES = {
    1: (42, 54),
    2: (54, 75),
    3: (75, 93),
    4: (93, 179),
    5: (179, 288),
    6: (288, 310),
    7: (310, 325),
    8: (325, 336),
    9: (336, 348),
    10: (348, 356),
    11: (356, 368)
}

BAB_FILTERS = {
    1: ["Semua"],
    2: ["Semua"],
    3: ["Semua"],
    4: ["Semua"],
    5: ["Semua"],
    6: ["Semua"],
    7: ["Semua"],
    8: ["Semua"],
    9: ["Semua"],
    10: ["Semua"],
    11: ["Semua"]
}

def main():
    print("="*60)
    print("PROGRAM EKSTRAKSI TABEL BPS (MULTI-TAHUN & MULTI-MODE)")
    print("="*60)
    
    # 1. Input PDF File
    pdf_file = input("Masukkan nama file PDF (tekan Enter untuk default 'kabupaten-tasikmalaya-dalam-angka-2026.pdf'):\n> ").strip()
    if not pdf_file:
        pdf_file = "kabupaten-tasikmalaya-dalam-angka-2026.pdf"
        print(f"Menggunakan default: {pdf_file}")
        
    if not os.path.exists(pdf_file):
        print(f"\nERROR: File '{pdf_file}' tidak ditemukan di folder ini!")
        return

    while True:
        print("\n" + "-"*60)
        print("PILIH METODE EKSTRAKSI:")
        print("1. Ekstrak Berdasarkan Bab (Akan menggunakan filter judul khusus Bab)")
        print("2. Ekstrak Berdasarkan Range Halaman Manual (Ekstrak Semua Tabel)")
        print("0. Keluar")
        print("-" * 60)
        
        try:
            mode = int(input("Pilih mode (0-2): "))
            
            if mode == 0:
                print("Keluar dari program.")
                break
                
            elif mode == 1:
                pilihan = int(input("\nMasukkan nomor Bab (1-11): "))
                if pilihan < 1 or pilihan > 11:
                    print("Error: Harap masukkan angka antara 1 sampai 11.")
                    continue
                
                # Dynamic page range detection using extract_toc
                start_p, end_p = None, None
                try:
                    from extract_toc import get_toc
                    import re
                    
                    def roman_to_int(roman):
                        roman = roman.lower()
                        val = {'i': 1, 'v': 5, 'x': 10, 'l': 50, 'c': 100, 'd': 500, 'm': 1000}
                        total = 0
                        prev = 0
                        for char in reversed(roman):
                            curr = val.get(char, 0)
                            if curr < prev:
                                total -= curr
                            else:
                                total += curr
                            prev = curr
                        return total

                    print("Menganalisis PDF secara dinamis untuk mendeteksi halaman bab...")
                    babs = get_toc(pdf_file)
                    for b in babs:
                        m = re.match(r'^(bab|chapter)\s+(\d+|[ivxlcdm]+)', b["title"], re.IGNORECASE)
                        if m:
                            raw_num = m.group(2)
                            try:
                                num = int(raw_num)
                            except ValueError:
                                num = roman_to_int(raw_num)
                            
                            if num == pilihan:
                                start_p = b.get("start_page")
                                end_p = b.get("end_page")
                                print(f"[!] SUKSES: Ditemukan {b['title']} di halaman {start_p}-{end_p} secara dinamis.")
                                break
                except Exception as e:
                    print(f"[!] Gagal mendeteksi halaman secara dinamis: {e}")

                if start_p is None or end_p is None:
                    start_p, end_p = BAB_RANGES[pilihan]
                    print(f"\n[!] INFO: Menggunakan range halaman default untuk Bab {pilihan} (versi 2026): {start_p}-{end_p}.")
                
                filters = BAB_FILTERS[pilihan]
                
                print(f"Filter aktif: {filters}")
                
                # Save filters to a temporary JSON file to be read by the pipeline
                with open("current_filter.json", "w") as f:
                    json.dump({"bab": pilihan, "filters": filters}, f)
                    
                import re
                year_match = re.search(r'(\d{4})', pdf_file)
                year_str = year_match.group(1) if year_match else "unknown"
                output_dir = os.path.join("outputs", f"Hasil_Ekstraksi_{year_str}")
                
                print(f"Menjalankan ekstraksi untuk halaman {start_p} hingga {end_p} (Tahun {year_str})...")
                cmd = f'python pdf_table_pipeline.py --pdf "{pdf_file}" --start_page {start_p} --end_page {end_p} --filter_file current_filter.json --output_dir "{output_dir}"'
                subprocess.run(cmd, shell=True)
                
                print(f"\n[OK] Ekstraksi BAB {pilihan} selesai! File disimpan di folder {output_dir}")
                
            elif mode == 2:
                try:
                    start_p = int(input("\nMasukkan halaman awal (start_page): "))
                    end_p = int(input("Masukkan halaman akhir (end_page): "))
                except ValueError:
                    print("Input harus berupa angka! Kembali ke menu.")
                    continue
                
                import re
                year_match = re.search(r'(\d{4})', pdf_file)
                year_str = year_match.group(1) if year_match else "unknown"
                output_dir = os.path.join("outputs", f"Hasil_Ekstraksi_{year_str}")
                
                print(f"Menjalankan ekstraksi untuk halaman {start_p} hingga {end_p} (Tanpa Filter Bab)...")
                # Jika manual range, tidak perlu pakai --filter_file agar semua tabel di-extract
                cmd = f'python pdf_table_pipeline.py --pdf "{pdf_file}" --start_page {start_p} --end_page {end_p} --output_dir "{output_dir}"'
                subprocess.run(cmd, shell=True)
                
                print(f"\n[OK] Ekstraksi halaman {start_p}-{end_p} selesai! File disimpan di folder {output_dir}")
                
            else:
                print("Pilihan tidak valid.")
                
        except ValueError:
            print("Masukan tidak valid. Harap masukkan angka.")

if __name__ == "__main__":
    main()
