with open('pdf_table_pipeline.py', 'r', encoding='utf-8') as f:
    code = f.read()

target = """                                        # Batasi panjang nama file agar tidak menabrak batas Windows MAX_PATH
                                        if len(title_safe) > 100:
                                            import re
                                            hal_match = re.search(r'\\s*\\(Hal\\s+[\\d,\\s]+\\)$', title_safe)
                                            hal_suffix = hal_match.group(0) if hal_match else ''
                                            allowed_desc_len = 100 - len(f'Tabel {table_number} - ') - len(hal_suffix) - 5
                                            if allowed_desc_len > 10:
                                                truncated_desc = desc[:allowed_desc_len].strip() + '...'
                                                title_safe = f'Tabel {table_number} - {truncated_desc} {hal_suffix}'
                                                title_safe = re.sub(r'\\s+', ' ', title_safe).strip()
                                                
                                        file_prefix = title_safe"""

replacement = """                                        # Batasi panjang nama file agar tidak menabrak batas Windows MAX_PATH
                                        if len(title_safe) > 100:
                                            import re
                                            hal_match = re.search(r'\\s*\\(Hal\\s+[\\d,\\s]+\\)$', title_safe)
                                            hal_suffix = hal_match.group(0) if hal_match else ''
                                            allowed_desc_len = 100 - len(f'Tabel {table_number} - ') - len(hal_suffix) - 5
                                            if allowed_desc_len > 10:
                                                truncated_desc = desc[:allowed_desc_len].strip() + '...'
                                                truncated_desc = truncated_desc.replace("/", " __SLASH__ ")
                                                title_safe = f"Tabel {table_number} - {truncated_desc} {hal_suffix}"
                                                title_safe = re.sub(r'[\\\\*?:\"<>|]', '', title_safe)
                                                title_safe = re.sub(r'\\s+', ' ', title_safe).strip()
                                                
                                        file_prefix = title_safe"""

if target in code:
    code = code.replace(target, replacement, 1)
    with open('pdf_table_pipeline.py', 'w', encoding='utf-8') as f:
        f.write(code)
    print('SUCCESSFULLY PATCHED SLASH BUG')
else:
    print('Target not found exactly')
