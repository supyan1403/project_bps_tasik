import os

base_dir = r"d:\Kuliah\KP\project_bps_tasik\backend\hasil_ekstraksi_web"
for root, dirs, files in os.walk(base_dir):
    for f in files:
        if "6.3.1" in f:
            print(os.path.relpath(os.path.join(root, f), base_dir))
