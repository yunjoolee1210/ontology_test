import re

with open('/Users/yunjoolee/Desktop/ai-service/kongdang/kongdang_PRD_v0.1.md', 'r', encoding='utf-8') as f:
    v01 = f.read()

with open('/Users/yunjoolee/Desktop/ai-service/kongdang/kongdang_PRD_v0.9.md', 'r', encoding='utf-8') as f:
    v09 = f.read()

def get_headings(content):
    headings = []
    for line in content.splitlines():
        if line.startswith('#'):
            headings.append(line)
    return headings

h01 = get_headings(v01)
h09 = get_headings(v09)

print("=== HEADINGS IN V0.1 ===")
for h in h01[:30]:
    print(h)

print("\n=== HEADINGS IN V0.9 ===")
for h in h09[:30]:
    print(h)
