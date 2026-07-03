import re
import sys

with open(r"d:\Kuliah\KP\project_bps_tasik\backend\static\app.js", "r", encoding="utf-8") as f:
    content = f.read()
    
# Find function populateDocumentList
matches = [m.start() for m in re.finditer(r"function\s+populateDocumentList", content)]
if matches:
    start = matches[0]
    # print about 250 lines from start using utf-8 stdout output
    lines = content[start:].split("\n")[:250]
    for i, line in enumerate(lines):
        # clean line from emojis or print with sys.stdout.write
        clean_line = line.encode('ascii', errors='replace').decode('ascii')
        print(f"{i+1}: {clean_line}")
else:
    print("Function populateDocumentList not found.")
