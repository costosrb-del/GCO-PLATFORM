
import os

file_path = "frontend/src/app/dashboard/transporte/page.tsx"

with open(file_path, "r", encoding="utf-8") as f:
    lines = f.readlines()

# We want to remove lines 123 to 162 (1-based index)
# In 0-based index: 122 to 161 (inclusive)
# Let's double check content
start_idx = 122
end_idx = 162 # Up to 162 means we keep 163. Wait.
# Line 163 was empty in view_file. Line 164 was new handleReceive.
# We want to delete the OLD duplicates.

print(f"Line 123 (idx 122): {lines[122]}")
print(f"Line 162 (idx 161): {lines[161]}")
print(f"Line 163 (idx 162): {lines[162]}")
print(f"Line 164 (idx 163): {lines[163]}")

# Check if they look like the old functions
if "const handleReceive = async" in lines[122] and "const handleAddInvoice = async" in lines[143]:
    print("Found duplicates. Removing...")
    del lines[122:162] # Remove 122 up to (but not including) 162? No, python slice [start:end] excludes end.
    # We want to remove up to line 162 (index 161). So [122:162].
    # Wait, line 162 is closing brace of handleAddInvoice?
    # view_file 162: "    };"
    # view_file 163: ""
    # view_file 164: "    const handleReceive = (item: any) => {"
    
    # So we want to remove indices 122 to 161.
    # python del lines[122:162] removes indices 122, 123, ..., 161.
    
    with open(file_path, "w", encoding="utf-8") as f:
        f.writelines(lines)
    print("File updated.")
else:
    print("Did not find expected content at expected lines.")
    # Search for them
    for i, line in enumerate(lines):
        if "const handleReceive = async" in line:
            print(f"Found handleReceive (async) at {i+1}")
        if "const handleReceive = (item" in line:
            print(f"Found handleReceive (modal) at {i+1}")
