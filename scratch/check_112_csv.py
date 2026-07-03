import os
import pandas as pd

csv_dir = r"d:\Kuliah\KP\project_bps_tasik\backend\hasil_ekstraksi_web\doc_58\Ekstraksi_Hal_39_sd_56"
for f in os.listdir(csv_dir):
    if f.startswith("Tabel 1.1.2") and f.endswith(".csv"):
        path = os.path.join(csv_dir, f)
        print("CSV Path:", path)
        df = pd.read_csv(path, header=None)
        print(df.to_string())
        break
