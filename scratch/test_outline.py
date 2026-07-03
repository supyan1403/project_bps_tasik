import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../")))

from extract_toc import extract_from_outline

pdf_path = r"d:\Kuliah\KP\project_bps_tasik\backend\uploads\kabupaten-tasikmalaya-dalam-angka-2024.pdf"
babs = extract_from_outline(pdf_path)
print("=== OUTLINE BABS ===")
if babs:
    for b in babs:
        print(b)
else:
    print("No outline found or failed.")
