import os
base = r"d:\Kuliah\KP\project_bps_tasik\backend\hasil_ekstraksi_web\doc_55\Ekstraksi_Hal_41_sd_404"
for f in os.listdir(base):
    if "32" in f or "32." in f:
        print(repr(f))
