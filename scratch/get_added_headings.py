with open('/Users/yunjoolee/Desktop/ai-service/kongdang/scratch/prd_diff.diff', 'r', encoding='utf-8') as f:
    diff_lines = f.readlines()

added_sections = []
current_header = ""
for line in diff_lines:
    if line.startswith('@@'):
        pass
    elif line.startswith('+') and not line.startswith('+++'):
        content = line[1:].strip()
        if content.startswith('#'):
            added_sections.append(content)

print("=== Added Headings / Main Elements in PRD v0.9 ===")
for h in added_sections:
    print(h)
