import re

headers = ['Pangkat/Golongan/Ruang Hierarchy', 'Kolom_Kosong', 'Laki-laki Male', 'Perempuan Female', 'Jumlah Total']
rows = [
    ['', 'Golongan I/Range I', '3', '0', '0'],
    ['1. I/A', '(Juru Muda/Junior Clerk)', '0', '0', '0'],
    ['4. I/D', '(Juru Tingkat I/First Class Clerk)', '3', '0', '3'],
    ['', 'Golongan II/Range II', '', '', '455'],
    ['5. II/A', '(Pengatur Muda/Junior Supervisor)', '10', '', '10']
]

# Jalankan simulasi penggabungan
if len(headers) >= 2 and any(x in headers[0].lower() for x in ['pangkat', 'golongan', 'hierarchy']) and headers[1] == 'Kolom_Kosong':
    headers.pop(1)
    new_rows = []
    for r in rows:
        val1 = str(r[0]).strip()
        val2 = str(r[1]).strip()
        # Bersihkan penomoran baris
        val1 = re.sub(r'^\s*\d+\.\s*(?=[a-zA-Z])', '', val1)
        combined = f"{val1} {val2}".strip()
        new_rows.append([combined] + r[2:])
    rows = new_rows

print("Cleaned Headers:", headers)
print("Cleaned Rows:")
for r in rows:
    print(r)
