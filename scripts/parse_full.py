"""
parse_full.py
Full parser for Flavor Bible Chapter 3 (pages 40–811).

Data model per ingredient:
  {
    "id":         "garlic",
    "label":      "Garlic",
    "meta":       { "taste": "...", "weight": "...", "volume": "...", ... },
    "pairings":   [ { "label": "olive oil", "strength": 3 } ],
    "quotes":     [ { "text": "...", "attribution": "Chef, Restaurant" } ],
    "tips":       [ "Add early in cooking." ],
    "affinities": [ "garlic + lemon + olive oil" ],
    "cuisines":   [ "mediterranean", "afghan" ]
  }

Cuisine entries are NOT stored as ingredients.
Each pairing under a cuisine header gets that cuisine slug appended
to its cuisines[] list in the second pass.

Strength tiers:
  1 = LiberationSerif, regular     → Recommended
  2 = LiberationSerif-Bold, mixed  → Highly Recommended
  3 = LiberationSerif-Bold, CAPS   → Essential
  4 = LiberationSerif-Bold, CAPS + * → Holy Grail

Quote detection (retrospective buffering):
  Prose-like lines are buffered. When an attribution line (10.8pt bold
  starting with "—") follows, the buffer is flushed as a quote attached
  to the current ingredient. If a new header or clear pairing arrives
  before attribution, the buffer is discarded.
"""

import fitz
import json
import re
import unicodedata
from pathlib import Path

PDF_PATH   = "/Users/juyu/Documents/flavor bible/Flavor-Bible-epub.pdf"
START_PAGE = 39   # 0-indexed = book page 40
END_PAGE   = 811  # exclusive
OUT_PATH   = "/Users/juyu/Documents/flavor bible/data/flavors.json"

# ── Font constants ─────────────────────────────────────────────────────────────
HEADER_FONT  = "LiberationSans-Bold"
SERIF_FONT   = "LiberationSerif"
HEADER_SIZE  = 18.0
PAIRING_SIZE = 12.0
FOOTNOTE_MAX = 11.9   # ≤ this size → attribution / footnote

# ── Keywords ───────────────────────────────────────────────────────────────────
META_KEYS = {
    "season", "taste", "weight", "volume", "function",
    "techniques", "technique", "tip", "tips", "avoid",
    "botanical relatives", "flavor affinities", "flavor affinity",
}

CUISINE_WORDS = {"cuisine", "cuisines"}

SKIP_EXACT = {"flavor affinities", "flavor affinity"}


# Section headers that are not actual flavor ingredients
NON_INGREDIENT_SLUGS = {
    "appetizers", "dishes", "beverages", "foods", "general",
    "ingredients", "recipes", "techniques", "seasons", "menu",
}

# Generic descriptor words that make a "See also" alias meaningless
_ALIAS_STOP_WORDS = {"specific", "various", "other", "all", "different", "similar", "related"}

# A line is "quote-like" if it's a full sentence — has a verb marker.
# We detect this by looking for common verb patterns rather than fixed starters,
# since chef quotes can begin with any subject.
# Verb stems that mark a line as prose/quote rather than a pairing.
# No trailing \b so stems match conjugated forms (cook → cooked, cooking, etc.)
QUOTE_INDICATORS = re.compile(
    r"\b(is|are|was|were|have|has|had|do|does|did|can|could|will|would|should|"
    # common verbs (stems — matches present, past, -ing, -s forms)
    r"love|like|think|believ|use|prefer|find|make|add|cook|taste|serv|work|get|go|"
    r"need|want|feel|know|try|put|com|tak|give|bring|keep|let|set|run|build|start|"
    r"becom|remain|stay|seem|appear|call|suggest|recommend|avoid|notic|"
    r"enjoy|appreciat|discover|learn|realiz|rememb|eat|ate|eaten|"
    r"transform|absorb|pack|broke|break|stay|lead|leads|led|my\b|"
    r"toast|evaporat|increas|improv|creat|develop|produc|result|allow|"
    # flavor / pairing verbs
    r"pair|complement|enhanc|intensif|balanc|highlight|"
    r"cut|offset|marr|combin|match|blend|draw|"
    r"elevat|deepen|brighten|round|mellow|accentuat|"
    # cooking technique verbs
    r"roast|saute|brais|poach|grill|fry|carameli|reduc|simmer|"
    r"steep|infus|marinat|season|finish|garnish|incorporat|"
    r"substitut|replac|toss|coat|dress|fold|whisk|stir|"
    r"bak|boil|steam|smok|cur|pickl|ferment|render|emulsif)",
    re.IGNORECASE
)

# Short noun-phrase pairings don't have these
PAIRING_WORDS = re.compile(r"^[a-z].*,\s*(esp\.|e\.g\.|such as|including)", re.IGNORECASE)

# ── Cuisine slug helpers ───────────────────────────────────────────────────────

def parse_cuisine_header(raw_text):
    """
    Given a raw cuisine header like:
      "AFRICAN CUISINE (See also Ethiopian and Moroccan Cuisines)"
      "AFRICAN CUISINE (NORTH) (See also Moroccan Cuisine)"
      "AFGHAN CUISINE"

    Returns:
      primary_slug  — the main cuisine slug (parentheticals stripped)
      alias_slugs   — list of additional slugs from "See also ... and ..." clause
    """
    text = raw_text.strip()

    # Extract "See also X and Y" from any parenthetical
    see_also_match = re.search(r'\(see also ([^)]+)\)', text, re.IGNORECASE)
    alias_slugs = []
    if see_also_match:
        see_also_text = see_also_match.group(1)
        # Split on " and " to separate multiple references
        parts = re.split(r'\s+and\s+', see_also_text, flags=re.IGNORECASE)
        for part in parts:
            part = part.strip().rstrip('s')  # remove trailing plural 's' from "Cuisines"
            if part:
                alias_slugs.append(slugify(part + " cuisine") if "cuisine" not in part.lower() else slugify(part))

    # Remove ALL parentheticals from main text for the primary slug
    primary = re.sub(r'\([^)]*\)', '', text).strip()
    primary_slug = slugify(primary)

    return primary_slug, alias_slugs


def slugify(text):
    """'AFGHAN CUISINE (NORTH)' → 'afghan-cuisine-north', 'Provençal' → 'provencal'"""
    normalized = unicodedata.normalize('NFKD', text).encode('ascii', 'ignore').decode('ascii')
    return re.sub(r'[^a-z0-9]+', '-', normalized.lower()).strip('-')


def canonical_label(raw):
    """
    Strip qualifiers to produce a clean ID slug for matching.
      'Apricots — In General'                    → 'apricots'
      'ANISE (See also Anise, Star, and Fennel)'  → 'anise'
      'AMARETTO (sweet almond liqueur)'           → 'amaretto'
      'Anise, Star'                               → 'anise-star'
      'Anise Hyssop'                              → 'anise-hyssop'
    """
    text = raw.strip()
    # Strip em-dash qualifiers: "— In General", "— Fresh", "— Dried", etc.
    text = re.sub(r'\s*[—–-]{1,2}\s*.+$', '', text).strip()
    # Strip all parentheticals
    text = re.sub(r'\([^)]*\)', '', text).strip()
    return slugify(text)


def parse_see_also_aliases(raw):
    """
    Extract 'See also X and Y' aliases from an ingredient header.
      'ANISE (See also Anise, Star, and Fennel)' → ['anise-star', 'fennel']
    Splits only on ' and ' so commas that are part of ingredient names
    (e.g. 'Anise, Star') are preserved.
    Returns list of canonical slugs (may be empty).
    """
    m = re.search(r'\(see also ([^)]+)\)', raw, re.IGNORECASE)
    if not m:
        return []
    # Split on ' and ' only — commas may be part of the ingredient name
    parts = re.split(r'\s+and\s+', m.group(1), flags=re.IGNORECASE)
    aliases = []
    for p in parts:
        p = p.strip().rstrip(',')
        if not p:
            continue
        # Skip generic references like "specific mushrooms", "various types"
        if any(w in p.lower().split() for w in _ALIAS_STOP_WORDS):
            continue
        aliases.append(canonical_label(p))
    return aliases


def is_cuisine_header(text):
    words = set(text.lower().split())
    return bool(words & CUISINE_WORDS)


def is_meta_key(text):
    return text.rstrip(":").lower() in META_KEYS


def is_affinity_line(text):
    return ' + ' in text


def looks_like_quote(text):
    """
    True if the line looks like a prose sentence rather than an ingredient pairing.
    Heuristics: has a verb, is longer than 40 chars, and doesn't look like a noun phrase.
    """
    if len(text) < 50:
        return False
    if is_affinity_line(text):
        return False
    if QUOTE_INDICATORS.search(text):
        return True
    return False


# ── Pairing label splitting ────────────────────────────────────────────────────

# Qualifiers that introduce modifiers — comma-separated or inside parens
_MODIFIER_RE = re.compile(
    r'(?:,\s*|\s*\()\s*(esp\.?|e\.g\.?|particularly|such as|including|especially|i\.e\.?)',
    re.IGNORECASE
)

def split_modifier(label):
    """
    Split pairing labels into (base, modifier):
      'almonds, esp. blanched'              → ('almonds', 'esp. blanched')
      'game and game birds (e.g., quail)'  → ('game and game birds', 'e.g., quail')
      'chocolate: dark, milk'              → ('chocolate', 'dark, milk')
      'anchovies (key ingredient)'         → ('anchovies', 'key ingredient')
    Returns (base, modifier) where modifier is None if no qualifier found.
    """
    # Colon pattern: "Ingredient: variant1, variant2"
    colon_m = re.match(r'^([^:(]{2,40}):\s*(.+)$', label)
    if colon_m:
        return colon_m.group(1).strip(), colon_m.group(2).strip()

    # esp. / e.g. / etc. — comma-separated or inside parens
    m = _MODIFIER_RE.search(label)
    if m:
        base         = label[:m.start()].strip().rstrip(',( ')
        modifier_raw = label[m.start():]
        paren_wrapped = modifier_raw.lstrip()[:1] == '('
        modifier      = modifier_raw.strip().lstrip(',( ')
        # Strip exactly one outer closing paren if the match was paren-wrapped,
        # so inner parens like (key ingredient) are preserved intact.
        if paren_wrapped and modifier.endswith(')'):
            modifier = modifier[:-1].rstrip()
        return base, modifier

    # Standalone (key ingredient...) or (ingredient, with...) — not nested in esp.
    key_m = re.search(
        r'\s*\((key ingredients?|typical ingredient|ingredient,)[^)]*\)',
        label, re.IGNORECASE
    )
    if key_m:
        base     = label[:key_m.start()].strip().rstrip(',')
        modifier = label[key_m.start():].strip().strip('()')
        return base, modifier

    return label, None


# ── Span / line classification ─────────────────────────────────────────────────

def classify_line(line_spans):
    """
    Given all spans in a line, determine role and full text.
    Returns (role, strength, full_text) or None.

    Roles:
      header          — new ingredient entry
      cuisine_header  — cuisine section (not stored as ingredient)
      skip            — cross-reference, ignore
      attribution     — "— CHEF NAME" at small font
      attribution_cont— restaurant/location continuation
      pairing         — flavor pairing (strength 1–4)
    """
    visible = [s for s in line_spans if s["text"].strip()]
    if not visible:
        return None

    full_text = re.sub(r'\s+', ' ', " ".join(s["text"].strip() for s in visible)).strip()
    if not full_text:
        return None

    # Dominant span — largest, break ties preferring bold
    dominant = max(visible, key=lambda s: (s["size"], int("Bold" in s["font"])))
    font  = dominant["font"]
    size  = dominant["size"]
    flags = dominant["flags"]

    # ── Small text: attribution / footnotes ───────────────────────────────────
    if size <= FOOTNOTE_MAX:
        is_bold = bool(flags & 2**4) or "Bold" in font
        if is_bold or full_text.startswith("—") or full_text.startswith("\u2014"):
            return ("attribution", 0, full_text)
        return ("attribution_cont", 0, full_text)

    # ── Large sans-bold: ingredient / section headers ─────────────────────────
    if HEADER_FONT in font and size >= HEADER_SIZE:
        # Pure cross-reference (not "See also")
        if re.search(r'\(see\b(?! also)', full_text, re.IGNORECASE):
            return ("skip", 0, full_text)
        if is_cuisine_header(full_text):
            return ("cuisine_header", 0, full_text)
        return ("header", 0, full_text)

    # ── Serif lines: pairings, meta, prose ───────────────────────────────────
    if SERIF_FONT in font and size >= PAIRING_SIZE:
        is_bold = any("Bold" in s["font"] for s in visible)
        has_asterisk = full_text.startswith("*") or any(
            s["text"].strip().startswith("*") for s in visible
        )
        clean = full_text.lstrip("*").strip()
        is_caps = (
            clean.replace(",","").replace("(","").replace(")","")
                 .replace(".","").replace(":","").strip()
            == clean.replace(",","").replace("(","").replace(")","")
                    .replace(".","").replace(":","").strip().upper()
            and any(c.isalpha() for c in clean)
        )

        # Determine strength
        if is_bold and is_caps and has_asterisk:
            strength = 4
        elif is_bold and is_caps:
            strength = 3
        elif is_bold:
            strength = 2
        else:
            strength = 1

        return ("pairing", strength, full_text)

    return None


# ── Main parse ─────────────────────────────────────────────────────────────────

def parse(start=START_PAGE, end=END_PAGE, out=OUT_PATH):
    doc = fitz.open(PDF_PATH)
    end = min(end, len(doc))

    ingredients    = {}          # slug → entry dict
    cuisine_buckets = {}         # cuisine_slug → set of pairing labels

    current_ingredient  = None   # slug
    current_cuisines    = []     # slugs active in cuisine-header mode
    pending_header      = None   # (type, text) — wraps a header with unclosed paren
    pending_pairing     = None   # partial pairing text with unclosed parenthesis
    found_first         = False  # skip headers until "achiote seeds" is reached

    # Quote buffering
    prose_buffer   = []          # lines buffered waiting to see if attribution follows

    def get_or_create(label):
        slug = canonical_label(label)
        if slug not in ingredients:
            clean_label = label.title() if label == label.upper() else label
            aliases = parse_see_also_aliases(label)
            ingredients[slug] = {
                "id":         slug,
                "label":      clean_label,
                "aliases":    aliases,
                "meta":       {},
                "pairings":   [],
                "quotes":     [],
                "tips":       [],
                "affinities": [],
                "cuisines":   [],
            }
        return slug

    def flush_prose_as_quote(attribution):
        """Buffer was followed by attribution → it's a quote."""
        if prose_buffer and current_ingredient and current_ingredient in ingredients:
            ingredients[current_ingredient]["quotes"].append({
                "text":        " ".join(prose_buffer).strip(),
                "attribution": attribution.strip().lstrip("—").strip(),
            })
        prose_buffer.clear()

    def discard_prose_buffer():
        """Buffer was NOT followed by attribution → discard."""
        prose_buffer.clear()

    for page_num in range(start, end):
        page   = doc[page_num]
        blocks = page.get_text("dict", flags=fitz.TEXT_PRESERVE_WHITESPACE)["blocks"]

        if page_num % 50 == 0:
            print(f"  page {page_num + 1}…")

        for block in blocks:
            if block["type"] != 0:
                continue

            for line in block["lines"]:
                result = classify_line(line["spans"])
                if result is None:
                    continue

                role, strength, text = result
                clean = text.lstrip("*").strip()
                clean_lower = clean.lower()

                # ── Pending wrapped header continuation ───────────────────
                # Either a cuisine or ingredient header had an unclosed paren;
                # absorb lines until balanced, then process the combined text.
                if pending_header is not None:
                    ph_type, ph_text = pending_header
                    combined = ph_text + " " + clean
                    if combined.count('(') <= combined.count(')'):
                        pending_header = None
                        if ph_type == "cuisine_header":
                            primary_slug, alias_slugs = parse_cuisine_header(combined)
                            current_cuisines = [primary_slug] + alias_slugs
                            for slug in current_cuisines:
                                if slug not in cuisine_buckets:
                                    cuisine_buckets[slug] = set()
                        else:
                            if canonical_label(combined) not in NON_INGREDIENT_SLUGS:
                                current_cuisines   = []
                                current_ingredient = get_or_create(combined)
                    else:
                        pending_header = (ph_type, combined)
                    continue

                # ── New ingredient header ──────────────────────────────────
                if role == "header":
                    discard_prose_buffer()
                    pending_pairing = None
                    if not found_first:
                        if slugify(clean) == "achiote-seeds":
                            found_first = True
                        else:
                            continue
                    if canonical_label(clean) in NON_INGREDIENT_SLUGS:
                        current_ingredient = None
                        current_cuisines   = []
                        continue
                    if clean.count('(') > clean.count(')'):
                        pending_header = ("header", clean)
                    else:
                        current_cuisines   = []
                        current_ingredient = get_or_create(clean)

                # ── Cuisine header ─────────────────────────────────────────
                elif role == "cuisine_header":
                    discard_prose_buffer()
                    current_ingredient = None
                    if clean.count('(') > clean.count(')'):
                        pending_header = ("cuisine_header", clean)
                    else:
                        primary_slug, alias_slugs = parse_cuisine_header(clean)
                        current_cuisines = [primary_slug] + alias_slugs
                        for slug in current_cuisines:
                            if slug not in cuisine_buckets:
                                cuisine_buckets[slug] = set()

                # ── Skip ───────────────────────────────────────────────────
                elif role == "skip":
                    continue

                # ── Attribution line — flush prose buffer as quote ─────────
                elif role == "attribution":
                    flush_prose_as_quote(clean)

                # ── Attribution continuation (restaurant name) ─────────────
                elif role == "attribution_cont":
                    if current_ingredient and current_ingredient in ingredients:
                        quotes = ingredients[current_ingredient]["quotes"]
                        if quotes:
                            last = quotes[-1]
                            # Append restaurant to attribution
                            last["attribution"] = (
                                last["attribution"].rstrip(", ") + ", " + clean
                            ).strip(", ")

                # ── Pairing / meta / prose lines ───────────────────────────
                elif role == "pairing":

                    # Skip structural section labels
                    if clean_lower in SKIP_EXACT:
                        continue

                    # Meta key-only line (e.g. standalone "Season:")
                    if is_meta_key(clean_lower.rstrip(":")):
                        discard_prose_buffer()
                        continue

                    # Meta key: value on same line (e.g. "Taste: sweet, bitter")
                    colon_match = re.match(r'^([A-Za-z ]{2,30}):\s*(.+)$', clean)
                    if colon_match:
                        key = colon_match.group(1).strip().lower()
                        val = colon_match.group(2).strip()
                        if key in META_KEYS:
                            discard_prose_buffer()
                            if current_ingredient and current_ingredient in ingredients:
                                # Tips go to tips[], others to meta{}
                                if key in ("tip", "tips"):
                                    ingredients[current_ingredient]["tips"].append(val)
                                else:
                                    ingredients[current_ingredient]["meta"][key] = val
                            continue

                    # Flavor affinity line
                    if is_affinity_line(clean):
                        discard_prose_buffer()
                        if current_ingredient and current_ingredient in ingredients:
                            ingredients[current_ingredient]["affinities"].append(clean)
                        continue

                    # Explicit tip line
                    tip_match = re.match(r'^tip[s]?:\s*(.+)', clean, re.IGNORECASE)
                    if tip_match:
                        discard_prose_buffer()
                        if current_ingredient and current_ingredient in ingredients:
                            ingredients[current_ingredient]["tips"].append(tip_match.group(1).strip())
                        continue

                    # ── Quote detection ────────────────────────────────────
                    # Opening trigger: a long line with a recognisable verb.
                    if looks_like_quote(clean):
                        prose_buffer.append(clean)
                        continue

                    # Continuation: once the buffer is open, keep absorbing lines
                    # unless the line is clearly a short ingredient noun-phrase.
                    # A "clear ingredient" is short, starts with uppercase in the
                    # original PDF text, and has no sentence-verb — i.e. it looks
                    # like a pairing entry, not a mid-sentence fragment.
                    if prose_buffer:
                        is_clear_ingredient = (
                            len(clean) < 40
                            and clean[:1] == clean[:1].upper()
                            and clean[:1].isalpha()
                            and not QUOTE_INDICATORS.search(clean)
                        )
                        if not is_clear_ingredient:
                            prose_buffer.append(clean)
                            continue
                        # Looks like a real pairing — close the buffer and fall through
                        discard_prose_buffer()
                    # ── No open buffer: nothing to discard ────────────────────

                    # ── Actual pairing ─────────────────────────────────────
                    # If there's a partial pairing with an unclosed paren, append
                    # this line to it and keep waiting for the closing paren.
                    if pending_pairing is not None:
                        combined_pairing = pending_pairing + " " + clean.strip()
                        if combined_pairing.count('(') <= combined_pairing.count(')'):
                            pending_pairing = None
                            clean = combined_pairing
                        else:
                            pending_pairing = combined_pairing
                            continue

                    pairing_label = clean.rstrip(",;").strip()
                    if not pairing_label:
                        continue

                    # If this pairing has an unclosed paren, buffer it
                    if pairing_label.count('(') > pairing_label.count(')'):
                        pending_pairing = pairing_label
                        continue

                    base_label, modifier = split_modifier(pairing_label)
                    base_lower = base_label.lower()

                    if current_cuisines:
                        for cs in current_cuisines:
                            cuisine_buckets[cs].add(base_lower)

                    elif current_ingredient and current_ingredient in ingredients:
                        # If the pairing is itself a cuisine, tag it instead of listing it
                        if is_cuisine_header(base_lower):
                            cuisine_slug = slugify(base_lower)
                            if cuisine_slug not in cuisine_buckets:
                                cuisine_buckets[cuisine_slug] = set()
                            if cuisine_slug not in ingredients[current_ingredient]["cuisines"]:
                                ingredients[current_ingredient]["cuisines"].append(cuisine_slug)
                        else:
                            entry = {"label": base_lower, "strength": strength}
                            if modifier:
                                entry["modifier"] = modifier.lower()
                            ingredients[current_ingredient]["pairings"].append(entry)

    doc.close()

    # ── Second pass: tag ingredients with cuisine slugs ────────────────────────
    print("Tagging cuisines…")
    label_to_slug = {}
    for slug, entry in ingredients.items():
        label_to_slug[entry["label"].lower()] = slug
        label_to_slug[slug.replace("-", " ")] = slug
        label_to_slug[slug] = slug

    for cuisine_slug, pairing_set in cuisine_buckets.items():
        for pairing_label in pairing_set:
            target = label_to_slug.get(pairing_label.lower())
            if target and target in ingredients:
                if cuisine_slug not in ingredients[target]["cuisines"]:
                    ingredients[target]["cuisines"].append(cuisine_slug)

    # ── Write output ───────────────────────────────────────────────────────────
    out_data = {
        "ingredients": list(ingredients.values()),
        "cuisines":    {s: sorted(l) for s, l in cuisine_buckets.items()},
        "meta": {
            "source":   "The Flavor Bible, Karen Page & Andrew Dornenburg, 2008",
            "pages":    f"{start + 1}–{end}",
            "total":    len(ingredients),
            "cuisines": len(cuisine_buckets),
        },
    }

    Path(out).parent.mkdir(parents=True, exist_ok=True)
    with open(out, "w", encoding="utf-8") as f:
        json.dump(out_data, f, indent=2, ensure_ascii=False)

    print(f"\n✓ Done.")
    print(f"  Ingredients : {len(ingredients)}")
    print(f"  Cuisines    : {len(cuisine_buckets)}")
    print(f"  Output      : {out}")
    return ingredients, cuisine_buckets


# ── Quick validation run ───────────────────────────────────────────────────────

def validate():
    print("Validation run — pages 40–65…")
    ings, cuisines = parse(
        start=39, end=65,
        out="/Users/juyu/Documents/flavor bible/scripts/parse_preview_v3.json"
    )

    print("\n── Cuisine slugs ─────────────────────────────────────────────────────")
    for slug, labels in cuisines.items():
        print(f"  {slug:45s} {len(labels)} flavors")

    print("\n── Cuisine tags on ingredients ───────────────────────────────────────")
    for entry in ings.values():
        if entry["cuisines"]:
            print(f"  {entry['label']:30s} {entry['cuisines']}")

    print("\n── Quote check ───────────────────────────────────────────────────────")
    for entry in ings.values():
        for q in entry["quotes"]:
            print(f"  [{entry['label']}]")
            print(f"    \"{q['text'][:80]}\"")
            print(f"    — {q['attribution']}")

    print("\n── Allspice full entry ────────────────────────────────────────────────")
    if "allspice" in ings:
        e = ings["allspice"]
        print(f"  tips      : {e['tips']}")
        print(f"  affinities: {e['affinities']}")
        print(f"  quotes    : {len(e['quotes'])}")
        bad = [p for p in e["pairings"] if looks_like_quote(p["label"])]
        print(f"  prose leaking into pairings: {len(bad)}")
        for b in bad[:3]:
            print(f"    → {b['label'][:70]}")


if __name__ == "__main__":
    import sys
    if "--validate" in sys.argv or len(sys.argv) == 1:
        validate()
    else:
        print(f"Full parse — pages {START_PAGE+1}–{END_PAGE}…")
        parse()
