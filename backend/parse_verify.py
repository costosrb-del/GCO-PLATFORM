
import os

def check():
    path = "verify_out_3.txt"
    if not os.path.exists(path): return
    with open(path, 'rb') as f:
        raw = f.read()
        # Try UTF-16
        try:
            content = raw.decode('utf-16')
        except:
            content = raw.decode('utf-8', errors='ignore')
            
        print("Breakdown for 7702 in verify_out_3.txt:")
        lines = content.split('\n')
        for i, line in enumerate(lines):
            if "Global Average for 7702:" in line:
                print(f"L{i}: {line}")
                for j in range(i+1, min(i+10, len(lines))):
                    print(f"  L{j}: {lines[j]}")
check()
