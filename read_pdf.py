import io
with io.open(r'b:\Downloads\clax\clean_pdf.txt', 'r', encoding='utf-16le') as f:
    text = f.read()
with io.open(r'b:\Downloads\clax\clean_utf8.txt', 'w', encoding='utf-8') as out:
    out.write(text)
