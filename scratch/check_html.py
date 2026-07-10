import re
with open(r'D:\Kuliah\KP\project_bps_tasik\backend\templates\index.html', 'r', encoding='utf-8') as f:
    html = f.read()

# Find page-master section - try different patterns
m = re.search(r'page-master.*?page-editor', html, re.DOTALL)
if m:
    content = m.group(0)
    opens = content.count('<div')
    closes = content.count('</div>')
    print(f'page-master to page-editor: {opens} div opens, {closes} div closes, balanced={opens == closes}')
else:
    print('Could not find page-master boundary')

# Check sidebar nav items
nav = re.search(r'<ul class="nav flex-column mb-auto gap-1">(.*?)</ul>', html, re.DOTALL)
if nav:
    items = re.findall(r'<li class="nav-item[^"]*"[^>]*>', nav.group(1))
    print(f'Sidebar nav items: {len(items)}')
    for i, item in enumerate(items):
        has_admin = 'admin-only' in item
        print(f'  {i+1}. {item[:80]}... admin-only={has_admin}')
else:
    print('Could not find sidebar nav')
