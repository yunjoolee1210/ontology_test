import difflib

with open('/Users/yunjoolee/Desktop/ai-service/kongdang/kongdang_PRD_v0.1.md', 'r', encoding='utf-8') as f:
    v01 = f.readlines()

with open('/Users/yunjoolee/Desktop/ai-service/kongdang/kongdang_PRD_v0.9.md', 'r', encoding='utf-8') as f:
    v09 = f.readlines()

diff = difflib.unified_diff(v01, v09, fromfile='v0.1', tofile='v0.9', lineterm='')
for line in list(diff)[:200]: # Look at first 200 lines of diff
    print(line)
