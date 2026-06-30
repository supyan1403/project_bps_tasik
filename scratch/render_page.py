import os
import pdfplumber

pdf_path = r"D:\Kuliah\KP\project_bps_tasik\uploads\kabupaten-tasikmalaya-dalam-angka-2026.pdf"
output_dir = r"D:\Kuliah\KP\project_bps_tasik\scratch"

with pdfplumber.open(pdf_path) as pdf:
    # Render page 41 (index 40)
    p41 = pdf.pages[40]
    im41 = p41.to_image(resolution=150)
    im41.save(os.path.join(output_dir, "page_41.png"), format="PNG")
    print("Page 41 saved.")

    # Render page 42 (index 41)
    p42 = pdf.pages[41]
    im42 = p42.to_image(resolution=150)
    im42.save(os.path.join(output_dir, "page_42.png"), format="PNG")
    print("Page 42 saved.")
