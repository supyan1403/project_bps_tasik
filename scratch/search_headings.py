with open(r"d:\Kuliah\KP\project_bps_tasik\backend\static\app.js", "r", encoding="utf-8") as f:
    js_lines = f.readlines()

for i, line in enumerate(js_lines):
    if "h2" in line.lower() or "h3" in line.lower() or "h4" in line.lower():
        print(f"app.js:{i+1}: {line.strip()}")

with open(r"d:\Kuliah\KP\project_bps_tasik\backend\templates\index.html", "r", encoding="utf-8") as f:
    html_lines = f.readlines()

for i, line in enumerate(html_lines):
    if "h2" in line.lower() or "h3" in line.lower() or "h4" in line.lower():
        print(f"index.html:{i+1}: {line.strip()}")
