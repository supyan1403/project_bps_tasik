import os

csv_dir = r"d:\Kuliah\KP\project_bps_tasik\backend\hasil_ekstraksi_web\doc_58\Ekstraksi_Hal_57_sd_78"
for f in os.listdir(csv_dir):
    if f.startswith("Tabel 2.3.3") and f.endswith(".csv"):
        path = os.path.join(csv_dir, f)
        print("CSV Path:", path)
        with open(path, 'r', encoding='utf-8') as file:
            print(file.read())
        break
