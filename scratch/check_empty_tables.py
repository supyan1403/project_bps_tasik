import os
import pandas as pd

base_dir = r"d:\Kuliah\KP\project_bps_tasik\backend\hasil_ekstraksi_web"

# Find all Tabel 3.1.1 csv files
for root, dirs, files in os.walk(base_dir):
    for file in files:
        if file.endswith(".csv") and "Tabel 3.1.1" in file:
            path = os.path.join(root, file)
            print(f"\nCSV: {path}")
            try:
                df = pd.read_csv(path)
                # Check for empty cells in each row
                empty_rows = df[df.isnull().any(axis=1) | (df == "").any(axis=1)]
                if not empty_rows.empty:
                    print(f"  Ditemukan {len(empty_rows)} baris dengan sel kosong!")
                    # Print some of the empty rows to see what is missing
                    print(empty_rows.head(5).to_string())
                else:
                    print("  Aman! Tidak ada baris dengan sel kosong.")
            except Exception as e:
                print(f"  Error reading CSV: {e}")
