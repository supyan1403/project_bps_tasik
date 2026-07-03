import os
import sys
import re
import pandas as pd
sys.path.insert(0, os.path.abspath("."))

import pdfplumber
from pdf_table_pipeline import PDFOfflineTableExtractor

pipeline = PDFOfflineTableExtractor()
pdf_path = r"d:\Kuliah\KP\project_bps_tasik\backend\uploads\kabupaten-tasikmalaya-dalam-angka-2025.pdf"

with pdfplumber.open(pdf_path) as pdf:
    # Ekstrak halaman 76, 77, 78
    group = []
    for page_num in [75, 76, 77]:
        page = pdf.pages[page_num]
        tables = page.extract_tables()
        if tables:
            df = pipeline._clean_table(tables[0])
            group.append({
                "page": page_num + 1,
                "dataframe": df
            })
            
    # Simulasikan penyelarasan kolom
    ref_cols = list(group[0]['dataframe'].columns)
    for g in group[1:]:
        df = g['dataframe']
        if len(df.columns) == len(ref_cols):
            df.columns = ref_cols
            g['dataframe'] = df
            
    # Deteksi tabel kecamatan
    std_clean_kec = [
        "cipatujah", "karangnunggal", "cikalong", "pancatengah", "cikatomas",
        "cibalong", "parungponteng", "bantarkalong", "bojongasih", "culamega",
        "bojonggambir", "sodonghilir", "taraju", "salawu", "puspahiang",
        "tanjungjaya", "sukaraja", "salopa", "jatiwaras", "cineam",
        "karangjaya", "manonjaya", "gunungtanjung", "singaparna", "sukarame",
        "mangunreja", "cigalontang", "leuwisari", "sariwangi", "padakembang",
        "sukaratu", "cisayong", "sukahening", "rajapolah", "jamanis",
        "ciawi", "kadipaten", "pagerageung", "sukaresik"
    ]
    
    is_kecamatan_table = False
    for g in group:
        for val in g['dataframe'].iloc[:, 0].astype(str):
            val_clean = val.strip().lower().replace(" ", "").replace(".", "")
            if val_clean in std_clean_kec:
                is_kecamatan_table = True
                break
        if is_kecamatan_table:
            break
            
    # Cek overlap index
    has_index_overlap = False
    if len(group) > 1:
        idx0 = set(group[0]['dataframe'].iloc[:, 0].astype(str).str.strip().str.lower())
        for g in group[1:]:
            idx_other = set(g['dataframe'].iloc[:, 0].astype(str).str.strip().str.lower())
            common = idx0.intersection(idx_other) - {''}
            if len(common) > 0:
                has_index_overlap = True
                break
                
    print("Is Kecamatan Table:", is_kecamatan_table)
    print("Has Index Overlap:", has_index_overlap)
    
    if not (is_kecamatan_table or has_index_overlap):
        print("\nUsing VERTICAL CONCATENATION!")
        dfs = []
        for g in group:
            dfs.append(g['dataframe'])
        current_merged = pd.concat(dfs, axis=0, ignore_index=True)
    else:
        print("\nUsing HORIZONTAL MERGE!")
        # (simulasi logic horizontal)
        
    print("\nResult Shape:", current_merged.shape)
    print("Columns:", list(current_merged.columns))
    print("First 15 rows of first column:")
    print(current_merged.iloc[:15, 0].to_list())
    print("\nLast 5 rows of first column:")
    print(current_merged.iloc[-5:, 0].to_list())
