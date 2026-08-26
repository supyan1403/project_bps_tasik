import json
c = json.load(open('truncated_fix_changelog.json'))
# find doc 85 entries
d85 = [x for x in c if x['doc'] == 85]
print(f'Doc85 entries in changelog: {len(d85)}')
# find any with 'regional' or 'bruto' in col
pdrb = [x for x in d85 if 'regional' in x['col'].lower() or 'bruto' in x['col'].lower()]
print(f'Doc85 PDRB entries: {len(pdrb)}')
for x in pdrb[:5]:
    print(f"  col={x['col'][:40]} old={x['old']!r} new={x['new']!r}")
# specifically the PKRT entity row - need to check DB row content
print('\n--- DB check doc85 Tabel12.6 PKRT row now ---')
