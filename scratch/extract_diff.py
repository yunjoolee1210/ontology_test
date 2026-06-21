import difflib

with open('/Users/yunjoolee/Desktop/ai-service/kongdang/kongdang_PRD_v0.1.md', 'r', encoding='utf-8') as f:
    v01 = f.read().splitlines()

with open('/Users/yunjoolee/Desktop/ai-service/kongdang/kongdang_PRD_v0.9.md', 'r', encoding='utf-8') as f:
    v09 = f.read().splitlines()

# We want to analyze what are the main sections and what changed between v0.1 and v0.9.
# Let's run a comparison and find blocks of additions and deletions.

diff = list(difflib.unified_diff(v01, v09, fromfile='v0.1', tofile='v0.9', lineterm=''))

additions = []
deletions = []
for line in diff:
    if line.startswith('+') and not line.startswith('+++'):
        additions.append(line[1:])
    elif line.startswith('-') and not line.startswith('---'):
        deletions.append(line[1:])

print(f"Total lines in v0.1: {len(v01)}")
print(f"Total lines in v0.9: {len(v09)}")
print(f"Added lines count: {len(additions)}")
print(f"Deleted lines count: {len(deletions)}")

# Let's write the diff to a temporary file in the scratch directory so we can read it or inspect it.
with open('/Users/yunjoolee/Desktop/ai-service/kongdang/scratch/prd_diff.diff', 'w', encoding='utf-8') as f:
    f.write('\n'.join(diff))

print("Diff file saved at scratch/prd_diff.diff")
