
file_path = "frontend/src/app/dashboard/transporte/page.tsx"

with open(file_path, "r", encoding="utf-8") as f:
    text = f.read()

open_braces = 0
close_braces = 0
stack = []

for i, char in enumerate(text):
    if char == '{':
        open_braces += 1
        stack.append(i)
    elif char == '}':
        close_braces += 1
        if stack:
            stack.pop()
        else:
            print(f"Extra closing brace at index {i} (approx line {text.count('\\n', 0, i) + 1})")

print(f"Total Open: {open_braces}")
print(f"Total Close: {close_braces}")

if stack:
    first_unclosed = stack[0]
    line_num = text.count('\n', 0, first_unclosed) + 1
    print(f"First unclosed brace at index {first_unclosed} (line {line_num})")
