with open(r"d:\Kuliah\KP\project_bps_tasik\backend\static\app.js", "r", encoding="utf-8") as f:
    content = f.read()
    
import re
matches = [m.start() for m in re.finditer(r"function\s+deleteBab", content)]
if matches:
    start = matches[0]
    lines = content[start:].split("\n")[:100]
    for i, line in enumerate(lines):
        clean_line = line.encode('ascii', errors='replace').decode('ascii')
        print(f"{i+1}: {clean_line}")
else:
    print("Function deleteBab not found.")
