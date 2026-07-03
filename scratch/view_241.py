import os
import pandas as pd

path = r"d:\Kuliah\KP\project_bps_tasik\outputs\Ekstraksi_Hal_73_sd_76"
for f in os.listdir(path):
    if "2.4.1" in f and f.endswith(".csv"):
        csv_path = os.path.join(path, f)
        df = pd.read_csv(csv_path, header=None)
        print(df.to_string())
        break
