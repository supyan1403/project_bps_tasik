import os
import json

doc_id = 58
# Baca metadata hasil ekstraksi untuk doc_58
metadata_path = f"backend/hasil_ekstraksi_web/doc_{doc_id}/Ekstraksi_Hal_57_sd_78/metadata.json"
if os.path.exists(metadata_path):
    with open(metadata_path, 'r', encoding='utf-8') as f:
        meta = json.load(f)
        for tbl_name, info in meta.items():
            if "2.3.3" in tbl_name:
                print(f"Table name: {tbl_name}")
                print(f"Info: {info}")
else:
    print("Metadata path not found!")
