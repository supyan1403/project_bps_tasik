import pandas as pd
import os

f2026_11_1 = r"D:\Kuliah\KP\project_bps_tasik\hasil_ekstraksi_web\doc_19\Ekstraksi_Hal_356_sd_368\Tabel 11.1 - Jumlah Sarana Perdagangan Menurut Jenisnya di Kabupaten Tasikmalaya, 2023–2025 (Hal 360).csv"
if os.path.exists(f2026_11_1):
    df = pd.read_csv(f2026_11_1)
    print("2026 Tabel 11.1 Columns:")
    print(df.columns.tolist())
    print(df.head(2))
else:
    print("2026 Tabel 11.1 not found.")
