import os
import pandas as pd

path = r"d:\Kuliah\KP\project_bps_tasik\outputs\Ekstraksi_Hal_76_sd_78"
for f in os.listdir(path):
    if "(Hal 76, 77, 78)" in f and f.endswith(".csv"):
        csv_path = os.path.join(path, f)
        df = pd.read_csv(csv_path, header=None)
        print(df.to_string())
        break
