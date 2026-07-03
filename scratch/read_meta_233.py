import os
import json

meta_json = "backend/hasil_ekstraksi_web/doc_58/Ekstraksi_Hal_57_sd_78/metadata.json"
if os.path.exists(meta_json):
    with open(meta_json, 'r', encoding='utf-8') as f:
        meta = json.load(f)
        print(json.dumps(meta, indent=2))
