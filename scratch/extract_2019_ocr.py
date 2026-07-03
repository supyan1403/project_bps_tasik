import os
import csv
import re
from pdf2image import convert_from_path
import pytesseract

# Pastikan path tesseract sudah benar jika diperlukan di lingkungan Anda
# pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'

PDF_PATH = r'backend/uploads/kabupaten-tasikmalaya-dalam-angka-2019.pdf'
OUTPUT_DIR = r'outputs/ocr_2019'

if not os.path.exists(OUTPUT_DIR):
    os.makedirs(OUTPUT_DIR)

def extract_page_to_csv(pdf_path, page_num):
    print(f"Memproses OCR Halaman {page_num} ke CSV...")
    try:
        images = convert_from_path(pdf_path, first_page=page_num, last_page=page_num)
        if not images:
            return None
        
        # Ekstrak teks dari gambar dengan konfigurasi PSM 6 (asumsi teks seperti blok/tabel)
        text = pytesseract.image_to_string(images[0], lang='ind', config='--psm 6')
        
        # Parse teks menjadi struktur tabel (sederhana: pisahkan berdasarkan baris baru dan spasi berlebih)
        lines = text.split('\n')
        table_data = []
        for line in lines:
            # Sederhanakan spasi menjadi koma atau pemisah
            # Ini sangat bergantung pada hasil OCR, mungkin perlu penyesuaian intensif
            parts = re.split(r'\s{2,}', line.strip())
            if len(parts) > 1:
                table_data.append(parts)
        
        return table_data
    except Exception as e:
        print(f"Error OCR Halaman {page_num}: {e}")
        return None

if __name__ == "__main__":
    # Contoh memproses satu halaman saja untuk tes
    page_to_test = 40
    data = extract_page_to_csv(PDF_PATH, page_to_test)
    
    if data:
        output_file = os.path.join(OUTPUT_DIR, f"halaman_{page_to_test}.csv")
        with open(output_file, "w", encoding="utf-8", newline='') as f:
            writer = csv.writer(f)
            writer.writerows(data)
        print(f"Tabel berhasil diekstrak dan disimpan ke: {output_file}")
    else:
        print("Gagal mengekstrak tabel.")
