from pathlib import Path
from pypdf import PdfReader

pdf_path = Path('NodeJS Final Project.pdf')
reader = PdfReader(str(pdf_path))
text = '\n'.join(page.extract_text() or '' for page in reader.pages)
Path('NodeJS_Final_Project.txt').write_text(text, encoding='utf-8')
print(f'Extracted {len(text)} characters from {len(reader.pages)} pages into NodeJS_Final_Project.txt')
