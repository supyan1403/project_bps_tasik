import pandas as pd
import os

base = r"d:\Kuliah\KP\project_bps_tasik\backend\hasil_ekstraksi_web\doc_57\Ekstraksi_Hal_40_sd_393"
p1 = os.path.join(base, "Tabel 6.3.1_Bagian_1 - Jumlah Perusahaan Industri Kecil Menurut Kecamatan di Kab... (Hal 303, 304).csv")
p2 = os.path.join(base, "Tabel 6.3.1_Bagian_2 - Kabupaten Tasikmalaya Dalam Angka 2026 (Hal 305, 306).csv")

# Find the actual filenames since they might be truncated in python path representation
for f in os.listdir(base):
    if "6.3.1_Bagian_1" in f:
        df1 = pd.read_csv(os.path.join(base, f))
        print("Bagian 1 Columns:", list(df1.columns))
        print("Bagian 1 Shape:", df1.shape)
    elif "6.3.1_Bagian_2" in f:
        df2 = pd.read_csv(os.path.join(base, f))
        print("Bagian 2 Columns:", list(df2.columns))
        print("Bagian 2 Shape:", df2.shape)
