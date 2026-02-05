
file_path = "frontend/src/app/dashboard/transporte/page.tsx"

with open(file_path, "r", encoding="utf-8") as f:
    text = f.read()

def check_balance(open_char, close_char, name):
    count = 0
    stack = []
    for i, char in enumerate(text):
        if char == open_char:
            count += 1
            stack.append(i)
        elif char == close_char:
            count -= 1
            if stack:
                stack.pop()
    
    print(f"{name}: Open {text.count(open_char)}, Close {text.count(close_char)}")
    if stack:
        first_unclosed = stack[0]
        line_num = text.count('\n', 0, first_unclosed) + 1
        print(f"First unclosed {name} at index {first_unclosed} (line {line_num})")
        # Show context
        start = max(0, first_unclosed - 50)
        end = min(len(text), first_unclosed + 50)
        print(f"Context: {text[start:end]}")

check_balance('(', ')', "Parentheses")
check_balance('[', ']', "Brackets")
# check_balance('`', '`', "Backticks") # Harder because they are pairs
