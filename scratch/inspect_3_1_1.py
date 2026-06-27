import pandas as pd
import glob
import os

path = r"d:\Kuliah\KP\project_bps_tasik\hasil_ekstraksi_web\doc_14\Ekstraksi_Hal_79_sd_88"
files = glob.glob(os.path.join(path, "*3.1.1*.csv"))
for f in sorted(files):
    df = pd.read_csv(f)
    print(f"\nFile: {os.path.basename(f)}")
    print(f"Columns: {list(df.columns)}")
    print(f"Shape: {df.shape}")
    print("Head:\n", df.head(2))
