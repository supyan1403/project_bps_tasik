with open('pdf_table_pipeline.py', 'r', encoding='utf-8') as f:
    code = f.read()

target = """                                            if start_idx == -1 and physical_table_number:
                                                # Fallback: just look for the table number
                                                for i, line in enumerate(lines):
                                                    line_no_spaces = re.sub(r'\s+', '', line)
                                                    if physical_table_number in line_no_spaces:
                                                        start_idx = max(0, i - 1) # start from previous line
                                                        break"""

replacement = """                                            if start_idx == -1 and physical_table_number:
                                                # Clean override suffixes like _Bagian_1
                                                search_num = re.sub(r'_Bagian_\\d+', '', physical_table_number)
                                                # Fallback: just look for the table number
                                                for i, line in enumerate(lines):
                                                    line_no_spaces = re.sub(r'\s+', '', line)
                                                    if search_num in line_no_spaces:
                                                        start_idx = max(0, i - 1) # start from previous line
                                                        break
                                            
                                            if start_idx == -1:
                                                # Fallback 2: search for the word Tabel or Table
                                                for i, line in enumerate(lines):
                                                    if re.search(r'\\b(?:Tabel|Table)\\b', line, re.IGNORECASE):
                                                        start_idx = i
                                                        break"""

if target in code:
    code = code.replace(target, replacement)
    with open('pdf_table_pipeline.py', 'w', encoding='utf-8') as f:
        f.write(code)
    print('SUCCESSFULLY PATCHED TITLE FALLBACK')
else:
    print('Target not found exactly')
