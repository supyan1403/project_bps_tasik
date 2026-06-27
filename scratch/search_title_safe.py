with open(r"d:\Kuliah\KP\project_bps_tasik\pdf_table_pipeline.py", "r", encoding="utf-8") as f:
    for i, line in enumerate(f):
        if "title_safe" in line:
            print(f"{i+1}: {line.strip()}")
