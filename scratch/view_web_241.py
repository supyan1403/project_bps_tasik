import os
import pandas as pd

web_dir = r"d:\Kuliah\KP\project_bps_tasik\backend\hasil_ekstraksi_web\doc_58\Ekstraksi_Hal_57_sd_78"
csv_file = None
for f in os.listdir(web_dir):
    if "2.4.1" in f and f.endswith(".csv"):
        csv_file = os.path.join(web_dir, f)
        break

if csv_file:
    df = pd.read_csv(csv_file, header=None)
    print(df.to_string())
else:
    print("CSV not found in web dir!")
