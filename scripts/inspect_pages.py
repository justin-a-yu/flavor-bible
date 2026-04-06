"""
inspect_pages.py
Dumps raw span data from pages 40-49 of the Flavor Bible PDF.
Goal: understand font names, sizes, and flags used for each strength tier
before writing the real parser.
"""

import fitz  # PyMuPDF
import json

PDF_PATH = "/Users/juyu/Documents/flavor bible/Flavor-Bible-epub.pdf"
START_PAGE = 39   # 0-indexed (page 40 in the book)
END_PAGE   = 49   # exclusive

doc = fitz.open(PDF_PATH)

print(f"Total pages in PDF: {len(doc)}")
print(f"Inspecting pages {START_PAGE+1}–{END_PAGE} (0-indexed: {START_PAGE}–{END_PAGE-1})\n")
print("=" * 70)

for page_num in range(START_PAGE, END_PAGE):
    page = doc[page_num]
    print(f"\n{'='*70}")
    print(f"PAGE {page_num + 1}")
    print(f"{'='*70}")

    blocks = page.get_text("dict", flags=fitz.TEXT_PRESERVE_WHITESPACE)["blocks"]

    for block in blocks:
        if block["type"] != 0:  # 0 = text block
            continue
        for line in block["lines"]:
            for span in line["spans"]:
                text = span["text"].strip()
                if not text:
                    continue

                font  = span["font"]
                size  = round(span["size"], 1)
                flags = span["flags"]

                # Decode flags
                is_bold       = bool(flags & 2**4)   # bit 4
                is_italic     = bool(flags & 2**1)   # bit 1
                is_superscript= bool(flags & 2**0)   # bit 0
                is_caps       = text == text.upper() and any(c.isalpha() for c in text)

                print(f"  [{font:30s}] size={size:4.1f} bold={is_bold} italic={is_italic} caps={is_caps} | {text[:80]}")

doc.close()
print("\nDone.")
