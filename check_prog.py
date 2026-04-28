import io

output = []
with io.open(r'b:\Downloads\clax\prog2.txt', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if '∩║æ∩║⌐∩╗¡∩╗Ñ' in line: # 'بدون'
        output.append(f"Line {i+1}: {line.strip()}")
    if '∩╗Å∩║│∩╗á∩╗¬ ∩║¡∩║ï∩╗│∩║│∩╗│∩╗¬' in line: # 'غسلة رئيسية'
        output.append(f"Line {i+1}: {line.strip()}")

with io.open(r'b:\Downloads\clax\check_out.txt', 'w', encoding='utf-8') as f:
    f.write('\n'.join(output))
