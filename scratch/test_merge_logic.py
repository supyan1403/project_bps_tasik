import pdfplumber
import re
import pandas as pd
from pdf_table_pipeline import PDFOfflineTableExtractor

pipeline = PDFOfflineTableExtractor()
pdf_path = r"d:\Kuliah\KP\project_bps_tasik\uploads\kabupaten-tasikmalaya-dalam-angka-2026.pdf"

results = pipeline.process_document(pdf_path, 79, 80)

merged_categories = []

for idx, res in enumerate(results):
    df = res['dataframe']
    is_same = False
    target_idx = -1
    
    print(f"\n--- Processing Table {idx} (Page {res['page']}, Number {res.get('table_number')}) ---")
    
    for i in range(len(merged_categories)-1, -1, -1):
        prev_cat = merged_categories[i]
        
        # Check condition 1
        t1 = res.get("table_number")
        t2 = prev_cat.get("table_number")
        if t1 and t2 and t1 != t2:
            print(f"Skipping category {i}: table numbers differ ({t1} vs {t2})")
            continue
            
        prev_df = prev_cat['dataframe']
        cols_to_check = min(2, len(df.columns), len(prev_df.columns))
        if cols_to_check > 0:
            match_found = True
            for k in range(cols_to_check):
                c1 = df.columns[k]
                c2 = prev_df.columns[k]
                if str(c1).strip().lower()[:15] != str(c2).strip().lower()[:15]:
                    print(f"Column {k} mismatch: {c1} vs {c2}")
                    match_found = False
                    break
            if match_found:
                is_same = True
                target_idx = i
                print(f"Matched category {i} vertically!")
                break
                
    if is_same:
        target_cat = merged_categories[target_idx]
        if len(df.columns) == len(target_cat['dataframe'].columns):
            df.columns = target_cat['dataframe'].columns
        target_cat['dataframe'] = pd.concat([target_cat['dataframe'], df], ignore_index=True)
        if res['page'] not in target_cat['pages']:
            target_cat['pages'].append(res['page'])
    else:
        new_cat = {
            "category_id": len(merged_categories) + 1,
            "pages": [res['page']],
            "dataframe": df,
            "index_row": res.get("index_row", []),
            "table_number": res.get("table_number")
        }
        merged_categories.append(new_cat)
        print(f"Created new category {len(merged_categories)}")

print(f"\nFinal merged_categories count: {len(merged_categories)}")
