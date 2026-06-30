import os

dir_path = r"D:\Kuliah\KP\project_bps_tasik\hasil_ekstraksi_web\doc_19\Ekstraksi_Hal_42_sd_54"
if os.path.exists(dir_path):
    print("Files in 2026 Bab 1:")
    for f in os.listdir(dir_path):
        print(f"  {f}")
else:
    print("2026 Bab 1 folder not found.")
