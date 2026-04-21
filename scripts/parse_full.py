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
    "techniques", "technique", "tip", "tips",
    "botanical relatives", "flavor affinities", "flavor affinity",
}

CUISINE_WORDS = {"cuisine", "cuisines"}

SKIP_EXACT = {"flavor affinities", "flavor affinity"}


# Section headers that are not actual flavor ingredients
NON_INGREDIENT_SLUGS = {
    "appetizers", "beverages", "foods", "general",
    "ingredients", "recipes", "techniques", "seasons", "menu",
    # Abstract section headings that appear at header size in the book
    "aroma", "balance", "freshness", "desserts", "cuisines",
    "bitter-dishes", "chicken-as-a-two",
    # Short sidebar titles not caught by is_sidebar_title word-count filter
    "pairing-pastas-with-sauces",
    # Dish examples used as section headers (not ingredients)
    "chicken-cacciatore",
    # Generic category headers (no pairing content, just tips/meta)
    "salads", "meats", "spices", "vegetarian-dishes",
    # Technique/process sidebars
    "sous-vide-cooking",
    # Abstract flavor concepts — described in the book but not pairing ingredients
    "slow-cooked", "sourness",
}

# These headers appear as sidebars *within* an ingredient entry and should NOT
# reset current_ingredient — pairings that follow still belong to the same entry.
#
# DISH_SIDEBARS  — content is parsed as {text, attribution} dish entries
# NOTE_SIDEBARS  — content is collected as long-form notes (too long for tips)
DISH_SIDEBARS = {"dishes"}
NOTE_SIDEBARS = {"pairing-pastas-with-sauces"}
MID_ENTRY_SIDEBARS = DISH_SIDEBARS | NOTE_SIDEBARS

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
    r"enjoy|appreciat|discover|learn|realiz|rememb|eat|ate|eaten|benefit|"
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
      'Beef — Braised'                            → 'beef-braised'
      'ANISE (See also Anise, Star, and Fennel)'  → 'anise'
      'AMARETTO (sweet almond liqueur)'           → 'amaretto'
      'Anise, Star'                               → 'anise-star'
      'Anise Hyssop'                              → 'anise-hyssop'
    """
    text = raw.strip()
    # Strip parentheticals first so the em-dash regex always sees end-of-string.
    # "NUTS — IN GENERAL (See also Pecans, Walnuts, etc.)" must become "nuts",
    # not "nuts-in-general" (which happens when parens are stripped after).
    text = re.sub(r'\([^)]*\)', '', text).strip()
    # Strip ONLY "— In General" / "— in general" em-dash qualifiers.
    # All other em-dash qualifiers (e.g. "— Braised", "— Smoked", "— Oyster")
    # are kept so sub-sections become separate ingredient entries
    # (e.g. "Beef — Braised" → slug "beef-braised", not merged into "beef").
    # Note: do NOT touch ASCII hyphens — compound names like
    # "FIVE-SPICE POWDER" and "SOUS-VIDE COOKING" use in-word hyphens.
    text = re.sub(r'\s*[—–]{1,2}\s*in general\s*$', '', text, flags=re.IGNORECASE).strip()
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
    if len(text) < 40:
        return False
    if is_affinity_line(text):
        return False
    # Lines like "CHEESE: cheddar, ..." / "cured meats: bacon, ham, ..." /
    # "SAUCES: Bolognese, ..." are pairing-with-variants, not prose sentences —
    # even when the modifier contains food names that match verb stems
    # (e.g. "goat" triggers \bgo, "cured" triggers \bcur).
    # Guard: label-before-colon is 2–40 chars with no nested paren/colon,
    # and the value after the colon starts with a lowercase letter (a list of variants).
    if re.match(r'^[^:(]{2,40}:\s*[a-z]', text):
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


# ── Block pre-processing: join consecutive header lines ───────────────────────
#
# Sidebar titles in the book (e.g. "Holly Smith of Café Juanita in Seattle on
# Five Flavors that / Will Take You to Northern Italy") span multiple lines but
# share the same PDF block. Without joining, each line becomes a separate junk
# ingredient entry. We merge consecutive header-sized lines within a block into
# a single logical line before running the state machine.

def _is_header_span(line):
    spans = [s for s in line["spans"] if s["text"].strip()]
    if not spans:
        return False
    dominant = max(spans, key=lambda s: (s["size"], int("Bold" in s["font"])))
    return HEADER_FONT in dominant["font"] and dominant["size"] >= HEADER_SIZE


def preprocess_block_lines(block):
    """Return block lines with consecutive header-sized lines merged."""
    lines = block["lines"]
    out = []
    i = 0
    while i < len(lines):
        if _is_header_span(lines[i]):
            j = i + 1
            while j < len(lines) and _is_header_span(lines[j]):
                j += 1
            if j > i + 1:
                # Merge lines[i:j]: concatenate all spans with a space between lines
                merged_spans = list(lines[i]["spans"])
                for k in range(i + 1, j):
                    merged_spans.append({
                        "text": " ", "font": HEADER_FONT,
                        "size": HEADER_SIZE, "flags": 0,
                    })
                    merged_spans.extend(lines[k]["spans"])
                out.append({"spans": merged_spans, "bbox": lines[i]["bbox"]})
                i = j
                continue
        out.append(lines[i])
        i += 1
    return out


_SIDEBAR_STOP = frozenset({
    'and', 'or', 'of', 'the', 'in', 'on', 'at', 'for', 'a', 'an', 'to',
    'with', 'as', 'by', 'aka', 'see', 'also',
})

def is_sidebar_title(text):
    """
    True if a header-sized line looks like a chapter sidebar or section title
    rather than an ingredient name. Real ingredient names are short (≤4 content
    words); sidebar titles are longer prose phrases.

    Counting rules:
      • Strip parentheticals and everything from the first em-dash onward —
        the qualifier ("— In General", "— Braised") is irrelevant for length.
      • Normalize "/" to a space so "CHOCOLATE / COCOA" counts as 2 words.
      • Strip leading/trailing hyphens from tokens ("EGG-" → "EGG").
      • Exclude common function words so "EGGS AND EGG-BASED DISHES" counts
        its 4 content words, not 5 with "and".
    """
    base = re.sub(r'\([^)]*\)', '', text).strip()
    # Strip em-dash qualifier entirely — we only count the ingredient name part
    base = re.sub(r'\s*[—–].*$', '', base).strip()
    # Normalise slash-separated alternates: "CHOCOLATE / COCOA" → "CHOCOLATE  COCOA"
    base = base.replace('/', ' ')
    # Count only meaningful content words
    tokens = re.split(r'[\s,]+', base)
    words = [
        t.strip('-') for t in tokens
        if t.strip('-') and t.strip('-').lower() not in _SIDEBAR_STOP
    ]
    return len(words) >= 5


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
            # Handle "TANGERINES (see Oranges, Mandarin) TARRAGON" — a cross-ref
            # merged with a real ingredient on the same line.  Extract whatever
            # follows the closing paren and treat it as the actual header.
            after = re.sub(r'^.*\)', '', full_text).strip()
            if after:
                return ("header", 0, after)
            # Nothing after closing paren — extract pre-paren content as the header.
            # e.g. "FISH — IN GENERAL (See individual fish; Seafood)" → "FISH — IN GENERAL"
            before = re.sub(r'\s*\(see\b[^)]*\)', '', full_text, flags=re.IGNORECASE).strip()
            if before:
                return ("header", 0, before)
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

    # ── Medium sans: sidebar content (dish items, sidebar notes/prose) ────────
    # LiberationSans at pairing size but below header size — used for dish names,
    # dish attributions inside "Dishes" sidebars, and sidebar prose intros.
    if "LiberationSans" in font and PAIRING_SIZE <= size < HEADER_SIZE:
        return ("sans_content", 0, full_text)

    return None


# ── Quote re-attribution ───────────────────────────────────────────────────────

def fix_quote_attribution(ingredients):
    """
    Post-processing pass: move quotes that were incorrectly filed under the
    preceding ingredient because they appeared before the ingredient header
    in the PDF (the book places intro quotes at the top of each section,
    before the bold all-caps header).

    A quote is moved from ingredient A to ingredient B when ALL of:
      1. The quote text starts with B's name (≥5 chars, case-insensitive).
      2. A's name does not start with B's name (avoids "Fennel Pollen → Fennel",
         "Rosemary → Rose", "Chardonnay Vinegar → Chard" false positives).
      3. B is mentioned at least as often as A in the quote text (filters
         comparison quotes like "Apples are more popular than pears…" under Pears).
      4. The quote text is prose, not a pairing list (≤5 commas in first 120 chars).
    """
    # Build label→id lookup: full label + short form before dash/paren
    # Minimum 4 chars to avoid matching tiny words like "a", "an", "of".
    label_to_id = {}
    for slug, ing in ingredients.items():
        name = ing['label'].lower()
        if len(name) >= 4:
            label_to_id[name] = slug
        short = re.split(r'[—(,]', ing['label'])[0].strip().lower()
        if len(short) >= 4 and short not in label_to_id:
            label_to_id[short] = slug

    moved = 0
    for ing_id in list(ingredients.keys()):
        ing = ingredients[ing_id]
        ing_name = ing['label'].lower()
        quotes = ing.get('quotes', [])
        to_move = []  # [(quote_index, target_id)]

        for qi, q in enumerate(quotes):
            text = q['text'].strip()
            text_lower = text.lower()

            # Rule 4: skip pairing lists (dense commas in the opening)
            if text_lower[:120].count(',') > 5:
                continue

            for target_label, target_id in label_to_id.items():
                if target_id == ing_id:
                    continue
                # Rule 2: skip if the target name is part of the current ingredient's
                # name — catches "Fennel Pollen → Fennel", "Rosemary → Rose",
                # and "Vinegar, Chardonnay → Chardonnay".
                if target_label in ing_name:
                    continue
                # Rule 1: quote text must start with target ingredient's name,
                # followed by a word boundary (space, comma, or end) so that
                # "Chardonnay vinegar…" doesn't match the 5-char target "chard".
                if not text_lower.startswith(target_label):
                    continue
                pos = len(target_label)
                if pos < len(text_lower) and text_lower[pos].isalpha():
                    continue
                # Rule 3: target mentioned ≥ as often as current ingredient
                current_short = re.split(r'[—(,]', ing['label'])[0].strip().lower()
                target_count   = text_lower.count(target_label)
                current_count  = text_lower.count(current_short)
                if target_count < current_count:
                    continue
                to_move.append((qi, target_id, target_label))
                break

        # Remove in reverse order so indices stay valid
        for qi, target_id, match in sorted(to_move, reverse=True):
            q = quotes.pop(qi)
            ingredients[target_id]['quotes'].append(q)
            moved += 1
            print(f"  Moved quote [{ing['label']}] → [{ingredients[target_id]['label']}]"
                  f" (starts with '{match}')")

    print(f"Re-attribution: {moved} quote(s) moved.")


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

    # Dish sidebar state
    in_dishes_section  = False   # True while inside a "Dishes" sidebar
    pending_dish_name  = None    # dish name awaiting its attribution line

    # Note sidebar state (long-form sidebar prose, e.g. "Pairing Pastas with Sauces")
    in_note_section    = False
    note_buffer        = []      # accumulates lines until sidebar ends

    # Avoid section state
    in_avoid_section   = False

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
                "avoids":     [],
                "quotes":     [],
                "tips":       [],
                "notes":      [],
                "dishes":     [],
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

            for line in preprocess_block_lines(block):
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
                    in_avoid_section = False
                    # Close any open sidebar sections before moving on
                    in_dishes_section = False
                    if pending_dish_name and current_ingredient in ingredients:
                        ingredients[current_ingredient]["dishes"].append(
                            {"text": pending_dish_name, "attribution": ""}
                        )
                    pending_dish_name = None
                    if in_note_section and note_buffer and current_ingredient in ingredients:
                        ingredients[current_ingredient]["notes"].append(
                            "\n".join(note_buffer)
                        )
                    in_note_section = False
                    note_buffer = []

                    if not found_first:
                        if slugify(clean) == "achiote-seeds":
                            found_first = True
                        else:
                            continue
                    # Mid-entry sidebars appear inside an ingredient's section —
                    # activate the appropriate collection mode, don't reset context.
                    if canonical_label(clean) in MID_ENTRY_SIDEBARS:
                        slug = canonical_label(clean)
                        if slug in DISH_SIDEBARS:
                            in_dishes_section = True
                        elif slug in NOTE_SIDEBARS:
                            in_note_section = True
                            note_buffer = []
                        continue
                    if canonical_label(clean) in NON_INGREDIENT_SLUGS:
                        current_ingredient = None
                        current_cuisines   = []
                        continue
                    # Sidebar titles (chef essays, section intros) share the
                    # same header font but are too long to be ingredient names.
                    if is_sidebar_title(clean):
                        current_ingredient = None
                        continue
                    if clean.count('(') > clean.count(')'):
                        pending_header = ("header", clean)
                    else:
                        current_cuisines   = []
                        current_ingredient = get_or_create(clean)

                # ── Cuisine header ─────────────────────────────────────────
                elif role == "cuisine_header":
                    discard_prose_buffer()
                    in_avoid_section = False
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

                # ── Sans-font sidebar content (dish items / notes) ─────────
                elif role == "sans_content":
                    if not current_ingredient or current_ingredient not in ingredients:
                        continue
                    if in_dishes_section:
                        # Lines starting with "—" are dish attributions
                        if clean.startswith("—") or clean.startswith("–"):
                            attr = re.sub(r'^[—–]\s*', '', clean).strip()
                            if pending_dish_name:
                                ingredients[current_ingredient]["dishes"].append(
                                    {"text": pending_dish_name, "attribution": attr}
                                )
                                pending_dish_name = None
                        else:
                            # Dish name — may be multi-line, concatenate
                            if pending_dish_name:
                                pending_dish_name += " " + clean
                            else:
                                pending_dish_name = clean
                    elif in_note_section:
                        note_buffer.append(clean)

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

                    # Exit the dishes section — serif pairings resume
                    if in_dishes_section:
                        in_dishes_section = False
                        if pending_dish_name and current_ingredient in ingredients:
                            ingredients[current_ingredient]["dishes"].append(
                                {"text": pending_dish_name, "attribution": ""}
                            )
                        pending_dish_name = None

                    # Note section: route bullet/prose lines into note_buffer;
                    # a short clean line signals we're back to normal pairings.
                    if in_note_section and current_ingredient and current_ingredient in ingredients:
                        stripped = clean.lstrip("•").strip()
                        # Sentence-continuation words never start an ingredient name
                        _cont_words = ("the ", "a ", "an ", "or ", "and ", "but ",
                                       "so ", "when ", "if ", "then ", "in ", "with ",
                                       "from ", "to ", "that ", "which ", "as ", "at ",
                                       "into ", "for ", "of ")
                        is_continuation = any(clean.lower().startswith(w) for w in _cont_words)
                        # Prose sentences end with a period; ingredient pairings never do.
                        ends_with_period = clean.rstrip().endswith('.')
                        if clean.startswith("•") or looks_like_quote(clean) \
                                or len(clean) > 60 or is_continuation or ends_with_period:
                            note_buffer.append(stripped if clean.startswith("•") else clean)
                            continue
                        else:
                            # Short content-word line — back to normal pairings
                            in_note_section = False
                            if note_buffer:
                                ingredients[current_ingredient]["notes"].append(
                                    "\n".join(note_buffer)
                                )
                            note_buffer = []

                    # Skip structural section labels
                    if clean_lower in SKIP_EXACT:
                        continue

                    # AVOID section header — standalone bold-caps "AVOID" line
                    if clean_lower == "avoid":
                        discard_prose_buffer()
                        in_avoid_section = True
                        continue

                    # Any other section header resets avoid mode
                    if is_affinity_line(clean) or is_meta_key(clean_lower.rstrip(":")):
                        in_avoid_section = False

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

                    # If the raw line ends with a trailing comma the entry
                    # continues on the next line (e.g. "CHEESE: cheddar, ..., mozzarella,")
                    # — buffer before stripping so the continuation can be appended.
                    if clean.rstrip().endswith(','):
                        pending_pairing = (pending_pairing + " " + clean.strip()
                                           if pending_pairing else clean.strip())
                        continue

                    pairing_label = clean.rstrip(",;").strip()
                    if not pairing_label:
                        continue

                    # Guard: prose sentences end with a period; ingredient pairings never do.
                    # Catches fragments like "heat diminishes the pungency of horseradish."
                    # and "etc." list-endings that leaked out of note/quote detection.
                    if pairing_label.rstrip().endswith('.'):
                        continue

                    # Guard: a line starting with a subject pronoun is a sentence fragment,
                    # not an ingredient name (e.g. "i use garlic primarily in two ways").
                    if re.match(r'^(i|we|you|he|she|they|it)\s', pairing_label, re.IGNORECASE):
                        continue

                    # If this pairing has an unclosed paren buffer it.
                    if pairing_label.count('(') > pairing_label.count(')'):
                        pending_pairing = pairing_label
                        continue

                    base_label, modifier = split_modifier(pairing_label)
                    base_lower = base_label.lower().strip()
                    # Skip overflow continuation lines that produce an empty base
                    # (e.g. second line of "SAUCES: ... Mornay\n(esp. with macaroni), ...")
                    if not base_lower:
                        continue

                    if current_cuisines:
                        for cs in current_cuisines:
                            cuisine_buckets[cs].add(base_lower)

                    elif current_ingredient and current_ingredient in ingredients:
                        # If we're in the AVOID section, route to avoids[]
                        if in_avoid_section:
                            entry = {"label": base_lower}
                            if modifier:
                                entry["modifier"] = modifier.lower()
                            ingredients[current_ingredient]["avoids"].append(entry)
                        # If the pairing is itself a cuisine, tag it instead of listing it
                        elif is_cuisine_header(base_lower):
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

    # ── Pairing deduplication pass ────────────────────────────────────────────
    # Some entries appear twice in the PDF (column-break repeats, e.g. Sardines,
    # Sauerkraut) or pick up stray pairings from merged cross-ref headers.
    # Keep only the highest-strength occurrence for each pairing label.
    total_dupes = 0
    for entry in ingredients.values():
        seen = {}   # label → index in best list
        best = []
        for p in entry["pairings"]:
            label = p["label"]
            if label not in seen:
                seen[label] = len(best)
                best.append(p)
            else:
                if p["strength"] > best[seen[label]]["strength"]:
                    best[seen[label]] = p
                total_dupes += 1
        entry["pairings"] = best
    if total_dupes:
        print(f"Deduplication: removed {total_dupes} duplicate pairing(s).")

    # ── Dish reassignment pass ────────────────────────────────────────────────
    # Dishes are sometimes attributed to the preceding ingredient when the
    # sidebar appears at a column break (e.g. Pimenton gets Pineapple's dishes).
    # Heuristic: if a dish name starts with a known ingredient label (or its
    # singular form) and the host ingredient's key word doesn't appear in the
    # dish text, move the dish to the matching ingredient.
    #
    # We only index FULL labels (not single first-words of multi-word labels)
    # to prevent "Grilled Dishes" from capturing "Grilled Duck Breast…".
    label_to_slug_dishes = {}
    for slug, entry in ingredients.items():
        lbl = entry["label"].lower()
        label_to_slug_dishes[lbl] = slug
        label_to_slug_dishes[slug.replace("-", " ")] = slug
        # Add singular form for common plurals so "pineapple-…" matches "pineapples"
        if lbl.endswith("s") and len(lbl) >= 5:
            singular = lbl[:-1]
            if len(singular) >= 4:
                label_to_slug_dishes.setdefault(singular, slug)

    def dish_starts_with(dish_text, candidate):
        """True if dish_text begins with candidate followed by a word boundary."""
        if not dish_text.startswith(candidate):
            return False
        pos = len(candidate)
        return pos >= len(dish_text) or dish_text[pos] in " -,;:()["

    dishes_moved = 0
    for slug, entry in list(ingredients.items()):
        host_key = entry["label"].lower().split()[0].rstrip(",")
        # Also check singular form so "pears" catches "pear" in dish names
        host_key_bare = host_key.rstrip("s") if host_key.endswith("s") else host_key
        to_reassign = []
        for i, dish in enumerate(entry.get("dishes", [])):
            dish_text_lower = dish["text"].lower()
            for candidate_label, candidate_slug in label_to_slug_dishes.items():
                if candidate_slug == slug:
                    continue
                if len(candidate_label) < 4:
                    continue
                if not dish_starts_with(dish_text_lower, candidate_label):
                    continue
                # Only reassign when neither the host's plural nor singular key
                # appears in the dish name — prevents "Spring Artichoke Fritto"
                # from leaving Artichokes, or "Honey-Roasted Pear Napoleon"
                # from leaving Pears.
                host_in_dish = (host_key in dish_text_lower or
                                (host_key_bare != host_key and host_key_bare in dish_text_lower))
                if not host_in_dish:
                    to_reassign.append((i, candidate_slug))
                    break
        for i, target_slug in reversed(to_reassign):
            dish = entry["dishes"].pop(i)
            ingredients[target_slug]["dishes"].append(dish)
            dishes_moved += 1
            print(f"  Dish reassigned [{entry['label']}] → "
                  f"[{ingredients[target_slug]['label']}]: {dish['text'][:60]}")
    if dishes_moved:
        print(f"Dish reassignment: moved {dishes_moved} dish(es).")

    # ── Quote re-attribution pass ──────────────────────────────────────────────
    fix_quote_attribution(ingredients)

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
