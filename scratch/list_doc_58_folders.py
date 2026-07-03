import os
import json

base_path = "backend/hasil_ekstraksi_web/doc_58"
if os.path.exists(base_path):
    print("Folders in doc_58:")
    for f in os.listdir(base_path):
        sub_path = os.path.join(base_path, f)
        if os.path.isdir(sub_path):
            print(f"  Folder: {f}")
            # Cek jika ada metadata.json
            meta_json = os.path.join(sub_path, "metadata.json")
            if os.path.exists(meta_json):
                print(f"    Found metadata.json in {f}")
                with open(meta_json, 'r', encoding='utf-8') as file:
                    print(file.read()[:500])
else:
    print("doc_58 folder not found!")
