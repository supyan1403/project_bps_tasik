import os
import json

base_dir = r"d:\Kuliah\KP\project_bps_tasik\backend\hasil_ekstraksi_web"

# Loop all doc folders
for folder in os.listdir(base_dir):
    toc_path = os.path.join(base_dir, folder, "toc.json")
    if os.path.exists(toc_path):
        print(f"\n=== Folder: {folder} ===")
        try:
            with open(toc_path, "r", encoding="utf-8") as f:
                toc = json.load(f)
                # Print Bab 3 or any Bab containing "kependudukan" or "penduduk"
                for item in toc:
                    title = item.get("title", "")
                    if "bab 3" in title.lower() or "penduduk" in title.lower() or "kependudukan" in title.lower():
                        print(f"  {title}: Halaman {item.get('start_page')} - {item.get('end_page')}")
        except Exception as e:
            print(f"Error reading {toc_path}: {e}")
