import json
out_lines = []
with open(r'C:\Users\MyBook Z Series\.gemini\antigravity\brain\1d848a65-cc9e-47d9-98e4-6c99b5e7dfd8\.system_generated\logs\transcript.jsonl', 'r', encoding='utf-8') as f:
    for line in f:
        data = json.loads(line)
        if data.get('type') == 'USER_INPUT':
            content = data.get('content')
            if any(kw in content.lower() for kw in ['3.1.1', 'tabel', 'halaman', 'hal', 'pisah', 'gabung', 'gabungin']):
                out_lines.append(f"USER: {content.strip()}")
        elif data.get('type') == 'PLANNER_RESPONSE':
            content = data.get('content', '')
            if any(kw in content.lower() for kw in ['sebagai 2 kategori', 'dua kategori', 'pisah', 'gabung', 'gabungin']):
                out_lines.append(f"AGENT: {content[:400].strip()}...")

with open('history_search.txt', 'w', encoding='utf-8') as out_f:
    out_f.write('\n\n'.join(out_lines))
print("Done writing scratch history search")
