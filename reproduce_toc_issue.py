from extract_toc import get_toc
import json

pdf_path = "backend/uploads/kabupaten-tasikmalaya-dalam-angka-2026.pdf"
try:
    toc = get_toc(pdf_path)
    print(f"Detected {len(toc)} chapters:")
    print(json.dumps(toc, indent=4))
except Exception as e:
    print(f"Error: {e}")
