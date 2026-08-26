import json
from collections import Counter
c = json.load(open('truncated_fix_changelog.json'))
f = Counter(round(x['factor'], 4) for x in c)
print('Factor distribution:', dict(f))
div = [x for x in c if x['factor'] == 0.001]
print(f'\nDivide-by-1000 (risky) cases: {len(div)}')
for x in div[:30]:
    print(f"  doc {x['doc']} | {x['col'][:42]:42s} | {x['old']!r} -> {x['new']!r}")
print(f'\nMultiply-by-1000 (safe) cases: {len(c) - len(div)}')
