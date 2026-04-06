"""
parse_test.py
Test parser on pages 50-60 of the Flavor Bible (first real ingredient entries).
Outputs a JSON preview so we can validate structure before the full run.

Strength tiers:
  1 = LiberationSerif, regular, any case       → Recommended
  2 = LiberationSerif-Bold, not caps           → Highly Recommended
  3 = LiberationSerif-Bold, ALL CAPS           → Essential
  4 = LiberationSerif-Bold, ALL CAPS, *prefix  → Holy Grail

Ingredient headers:
  LiberationSans-Bold, size ~20 → new ingredient entry
"""

import fitz
import json
import re

PDF_PATH   = "/Users/juyu/Documents/flavor bible/Flavor-Bible-epub.pdf"
START_PAGE = 49   # 0-indexed = book page 50
END_PAGE   = 60   # exclusive

HEADER_FONT   = "LiberationSans-Bold"
PAIRING_FONT  = "LiberationSerif"
PAIRING_BOLD  = "LiberationSerif-Bold"
HEADER_SIZE   = 18.0   # headers are ~20pt, use lower bound
PAIRING_SIZE  = 12.0   # pairings are ~14pt, use lower bound
FOOTNOTE_SIZE = 12.0   # footnotes are ~10pt — anything below this is skipped

META_KEYWORDS = {"season:", "taste:", "weight:", "volume:", "techniques:", "tip:", "avoid:", "tips:"}
TIP_PREFIXES  = ("tip:", "tips:", "avoid:", "note:", "technique:")

def classify_span(span):
    """Return (role, strength, text) or None if span should be skipped."""
    text  = span["text"].strip()
    if not text:
        return None

    font  = span["font"]
    size  = span["size"]
    flags = span["flags"]
    is_bold = bool(flags & 2**4) or "Bold" in font
    is_caps = text.replace("*","").replace(",","").replace("(","").replace(")","").strip() == \
              text.replace("*","").replace(",","").replace("(","").replace(")","").strip().upper() \
              and any(c.isalpha() for c in text)

    # Skip footnotes / quotes (small text)
    if size < FOOTNOTE_SIZE:
        return None

    # Ingredient header
    if HEADER_FONT in font and size >= HEADER_SIZE:
        # Skip cross-references like "ALMOND OIL (See Oil, Almond)"
        clean = re.sub(r'\(see.*?\)', '', text, flags=re.IGNORECASE).strip()
        if re.search(r'\bsee\b', text, re.IGNORECASE):
            return ("xref", 0, text)
        return ("header", 0, clean)

    # Pairing lines
    if PAIRING_FONT in font and size >= PAIRING_SIZE:
        # Metadata lines — season, taste, etc.
        if any(text.lower().startswith(kw) for kw in META_KEYWORDS):
            return ("meta", 0, text)

        has_asterisk = text.startswith("*")
        clean_text   = text.lstrip("*").strip()

        if is_bold and is_caps and has_asterisk:
            return ("pairing", 4, clean_text)
        elif is_bold and is_caps:
            return ("pairing", 3, clean_text)
        elif is_bold:
            return ("pairing", 2, clean_text)
        else:
            return ("pairing", 1, clean_text)

    return None

def clean_label(text):
    """Normalise a pairing label to title case, strip trailing punctuation."""
    text = re.sub(r'\s+', ' ', text).strip().rstrip(",;")
    # Keep ALL CAPS as-is for now — we'll normalise at end
    return text

def parse_pages(start, end):
    doc        = fitz.open(PDF_PATH)
    results    = {}   # { ingredient_label: { pairings: [...], meta: {} } }
    current    = None

    for page_num in range(start, min(end, len(doc))):
        page   = doc[page_num]
        blocks = page.get_text("dict", flags=fitz.TEXT_PRESERVE_WHITESPACE)["blocks"]

        for block in blocks:
            if block["type"] != 0:
                continue
            for line in block["lines"]:
                # Concatenate spans in the same line — a single pairing can span multiple spans
                line_spans = [s for s in line["spans"] if s["text"].strip()]
                if not line_spans:
                    continue

                # Use the dominant span (largest/boldest) to classify the line
                dominant = max(line_spans, key=lambda s: s["size"])
                classified = classify_span(dominant)
                if classified is None:
                    continue

                role, strength, text = classified
                full_text = " ".join(s["text"].strip() for s in line_spans if s["text"].strip())

                if role == "header":
                    label = full_text.strip().title()
                    if label and label not in results:
                        results[label] = {"pairings": [], "meta": {}}
                    current = label

                elif role == "pairing" and current:
                    pairing_text = clean_label(full_text.lstrip("*"))
                    # Skip tip/note lines that slipped through meta classification
                    if any(pairing_text.lower().startswith(t) for t in TIP_PREFIXES):
                        results[current]["meta"]["tips"] = results[current]["meta"].get("tips","") + " " + pairing_text
                        continue
                    if pairing_text:
                        results[current]["pairings"].append({
                            "label":    pairing_text,
                            "strength": strength,
                        })

                elif role == "meta" and current:
                    # Parse key: value
                    parts = full_text.split(":", 1)
                    if len(parts) == 2:
                        key = parts[0].strip().lower()
                        val = parts[1].strip()
                        results[current]["meta"][key] = val

    doc.close()
    return results

# ── Run ──────────────────────────────────────────────────────────────────────
data = parse_pages(START_PAGE, END_PAGE)

print(f"Ingredients parsed: {len(data)}\n")
for name, entry in list(data.items())[:6]:
    print(f"{'─'*50}")
    print(f"  {name}")
    meta = entry.get("meta", {})
    if meta:
        for k, v in meta.items():
            print(f"    [{k}] {v}")
    pairings = entry["pairings"]
    for p in pairings[:12]:
        stars = "★" * p["strength"]
        print(f"    {stars:4s}  {p['label']}")
    if len(pairings) > 12:
        print(f"    ... +{len(pairings)-12} more")

# Save full preview
out_path = "/Users/juyu/Documents/flavor bible/scripts/parse_preview.json"
with open(out_path, "w") as f:
    json.dump(data, f, indent=2, ensure_ascii=False)
print(f"\nFull output saved to: {out_path}")
