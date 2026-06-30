import os
import json
import re

# Load 2026 TOC and 2025 TOC
toc_2026_path = r"D:\Kuliah\KP\project_bps_tasik\test_output\toc.json"
toc_2025_path = r"D:\Kuliah\KP\project_bps_tasik\test_output_2025\toc.json"

with open(toc_2026_path, "r") as f:
    toc_2026 = json.load(f)
with open(toc_2025_path, "r") as f:
    toc_2025 = json.load(f)

# Let's count how many tables are extracted in each page range for 2026 and 2025
# We can do this by listing the files in hasil_ekstraksi_web/doc_19 and doc_20
print("doc_19 (2026) Directory contents count:")
doc19_dir = r"D:\Kuliah\KP\project_bps_tasik\hasil_ekstraksi_web\doc_19"
for d in sorted(os.listdir(doc19_dir)):
    sub_path = os.path.join(doc19_dir, d)
    if os.path.isdir(sub_path):
        files = os.listdir(sub_path)
        print(f"  {d}: {len(files)} tables")

# Let's write a python script to count tables in the PDF for each bab based on page ranges in 2025
from pypdf import PdfReader
reader_2025 = PdfReader(r"D:\Kuliah\KP\project_bps_tasik\uploads\kabupaten-tasikmalaya-dalam-angka-2025.pdf")

print("\nScanning 2025 PDF pages for tables to see count per bab:")
for i, bab in enumerate(toc_2025):
    start = bab["start_page"]
    end = bab["end_page"]
    table_count = 0
    # Scan pages in range
    for p_idx in range(start-1, end):
        text = reader_2025.pages[p_idx].extract_text()
        if not text:
            continue
        # Look for "Tabel" or "Table"
        matches = re.findall(r'\b(?:Tabel|Table)\b', text, re.IGNORECASE)
        # We can also check how many tables pdfplumber finds on these pages
        # But this is just a quick text search count
    print(f"  Bab {i+1} ({bab['title']}): page {start}-{end}")
