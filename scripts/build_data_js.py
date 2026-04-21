"""
build_data_js.py
Converts data/flavors.json → app/src/data/flavors_data.js

Output sets window.FLAVORS with:
  ingredients  — { [id]: entry }  (full data per ingredient)
  index        — [ { id, label } ] sorted alphabetically (for search)

Each pairing gets an `id` field: the ingredient id it resolves to,
or null if no matching ingredient exists. This enables double-click promote.

Each ingredient gets a `relatedIds` field: resolved ids from its "See also"
aliases, for display as navigable links on the ingredient profile page.
"""

import json, unicodedata, re
from pathlib import Path

SRC  = Path(__file__).parent.parent / "data" / "flavors.json"
DEST = Path(__file__).parent.parent / "app" / "src" / "data" / "flavors_data.js"

# Common alternate phrasings used in pairing lists that differ from the
# ingredient's header format (usually reversed adjective-noun order).
# Maps the pairing label (lowercase) → ingredient id.
ALTERNATE_NAMES = {
    # Reversed adjective-noun forms
    "star anise":             "anise-star",
    "black pepper":           "pepper-black",
    "white pepper":           "pepper-white",
    "green pepper":           "pepper-green",
    "pink pepper":            "pepper-pink",
    "red pepper":             "pepper-red",
    "cayenne":                "cayenne-ground",
    "dijon mustard":          "mustard-dijon",
    "chinese mustard":        "mustard-chinese",
    "sea salt":               "salt-sea-fine",
    "flat-leaf parsley":      "parsley-flat-leaf",
    "thai basil":             "basil-thai",
    "lemon basil":            "lemon-basil",
    "meyer lemon":            "lemons-meyer",
    "preserved lemon":        "lemons-preserved",
    "blood orange":           "oranges-blood",
    # Comma-inverted forms ("adjective, noun" → ingredient id)
    "mustard, dijon":         "mustard-dijon",
    "mustard, chinese":       "mustard-chinese",
    "parsley, flat-leaf":     "parsley-flat-leaf",
    "parsley, italian":       "parsley-flat-leaf",
    "pepper, black":          "pepper-black",
    "pepper, white":          "pepper-white",
    "pepper, red":            "pepper-red",
    "pepper, green":          "pepper-green",
    "lemon, juice":           "lemons",
    "lime, juice":            "limes",
    "orange, juice":          "oranges",
    "lemon juice":            "lemons",
    "lime juice":             "limes",
    "orange juice":           "oranges",
    # Shorthand / common alternate forms
    # "pepper" alone almost always means black pepper in pairing context
    "pepper":                 "pepper-black",
    # Chocolate/cocoa merged entry
    "chocolate":              "chocolate-cocoa",
    "cocoa":                  "chocolate-cocoa",
    # Eggs merged entry
    "eggs":                   "eggs-and-egg-based-dishes",
    "egg":                    "eggs-and-egg-based-dishes",
    # Melon entry (actual ID = melon-muskmelons)
    "melon":                  "melon-muskmelons",
    "muskmelon":              "melon-muskmelons",
    # Figs (fresh vs dried split; fresh is the primary entry)
    "figs":                   "figs-fresh",
    "fig":                    "figs-fresh",
    # Walnuts (parser merged "Walnut Oil" + "Walnuts" into one entry)
    "walnuts":                "walnut-oil-walnuts",
    "walnut":                 "walnut-oil-walnuts",
    # Coconut merged entry
    "coconut":                "coconut-and-coconut-milk",
    "coconut milk":           "coconut-and-coconut-milk",
    # Rice — default to white; arborio has its own entry
    "rice":                   "rice-white",
    # Sesame
    "sesame seeds":           "sesame-seeds-white",
    "sesame seed":            "sesame-seeds-white",
    "sesame":                 "sesame-seeds-white",
    # Singular forms of plural-ID ingredients
    "mushroom":               "mushrooms",
    "bean":                   "beans",
    "nut":                    "nuts",
    # Coffee (book uses "Coffee And Espresso" as the entry)
    "coffee":                 "coffee-and-espresso",
    "espresso":               "coffee-and-espresso",
    # Peanuts merged entry
    "peanut":                 "peanuts-and-peanut-butter",
    "peanuts":                "peanuts-and-peanut-butter",
    "peanut butter":          "peanuts-and-peanut-butter",
    # Curry (no plain "curry" entry; curry powder is the closest)
    "curry":                  "curry-powder-and-sauces",
    "curry powder":           "curry-powder-and-sauces",
    # Red pepper flakes are dried chiles; closest entry is chile peppers general
    "red pepper flakes":      "chile-peppers",
    "chile flakes":           "chile-peppers",
    # Risotto → arborio/carnaroli rice entry
    "risotto":                "rice-arborio-or-carnaroli",
}


def slugify(text):
    normalized = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("ascii")
    return re.sub(r"[^a-z0-9]+", "-", normalized.lower()).strip("-")


def build():
    data = json.loads(SRC.read_text(encoding="utf-8"))
    ings = data["ingredients"]

    # ── Build label → id lookup ───────────────────────────────────────────────
    # Rules:
    #   1. Each ingredient registers its own label, slug, and slug-as-words.
    #   2. We also register the singular/plural alternate (lemons ↔ lemon,
    #      walnuts ↔ walnut) so pairing labels match regardless of number.
    #   3. ALTERNATE_NAMES handles reversed adjective-noun forms (star anise,
    #      black pepper, etc.).
    #   4. Aliases from "See also" clauses are intentionally NOT added here —
    #      they create wrong redirections (bourbon → whiskey). Instead they are
    #      resolved and stored as `relatedIds` for UI navigation.
    label_to_id = {}

    for entry in ings:
        iid = entry["id"]
        lbl = entry["label"].lower()

        label_to_id[lbl]                    = iid   # full label
        label_to_id[iid]                    = iid   # slug
        label_to_id[iid.replace("-", " ")]  = iid   # slug with spaces

        # Singular ↔ plural variants — use iid (slug) which is clean of parentheticals
        if iid.endswith("s") and len(iid) > 3:
            label_to_id.setdefault(iid[:-1], iid)          # lemons → lemon
        else:
            label_to_id.setdefault(iid + "s", iid)         # lemon → lemons

    # Alternate names go in last so they can override generic slug matches
    label_to_id.update(ALTERNATE_NAMES)

    def resolve_id(label):
        key = label.lower().strip()
        if key in label_to_id:
            return label_to_id[key]
        # Try slugified label (handles accents, punctuation)
        slug = slugify(label)
        if slug in label_to_id:
            return label_to_id[slug]
        # Try singular/plural of the slugified form
        if slug.endswith("s") and slug[:-1] in label_to_id:
            return label_to_id[slug[:-1]]
        if (slug + "s") in label_to_id:
            return label_to_id[slug + "s"]
        return None

    # ── Resolve See Also aliases → relatedIds ────────────────────────────────
    # Aliases are the slugs extracted from "(See also X, Y)" in the book header.
    # We resolve each to a real ingredient id for use as navigation links.
    # If no matching ingredient exists we drop it (e.g. "pecans-walnuts-etc"
    # is a catch-all phrase, not a real entry).
    def resolve_aliases(aliases):
        related = []
        for alias in aliases:
            rid = label_to_id.get(alias) or label_to_id.get(alias.replace("-", " "))
            if rid and rid not in related:
                related.append(rid)
        return related

    # ── Build ingredients dict ────────────────────────────────────────────────
    out_ings = {}
    for entry in ings:
        pairings = []
        for p in entry["pairings"]:
            pid = resolve_id(p["label"])
            pairings.append({
                "id":       pid,
                "label":    p["label"],
                "strength": p["strength"],
                "modifier": p.get("modifier", ""),
            })

        avoids = []
        for a in entry.get("avoids", []):
            aid = resolve_id(a["label"])
            avoids.append({
                "id":       aid,
                "label":    a["label"],
                "modifier": a.get("modifier", ""),
            })

        out_ings[entry["id"]] = {
            "id":         entry["id"],
            "label":      entry["label"],
            "pairings":   pairings,
            "avoids":     avoids,
            "quotes":     entry.get("quotes", [])[:3],
            "tips":       entry.get("tips", [])[:3],
            "notes":      entry.get("notes", []),
            "dishes":     entry.get("dishes", []),
            "affinities": entry.get("affinities", [])[:4],
            "cuisines":   entry.get("cuisines", []),
            "meta":       entry.get("meta", {}),
            "relatedIds": resolve_aliases(entry.get("aliases", [])),
        }

    # ── Drop ghost/empty entries ──────────────────────────────────────────────
    # Some ingredients exist in the PDF with two name orderings (e.g., both
    # "BLACK PEPPER" and "PEPPER, BLACK").  The parser creates both slugs, but
    # only the canonical form (comma-inverted) gets pairings.  The alternate
    # form is a ghost: 0 pairings, 0 tips, 0 notes, 0 quotes.
    # We drop ghosts here so they don't appear in the search index or as empty
    # pages.  Pairing links are unaffected because ALTERNATE_NAMES already
    # redirects "black pepper" → "pepper-black" at resolve time.
    def is_ghost(entry):
        return (
            not entry["pairings"]
            and not entry["tips"]
            and not entry["notes"]
            and not entry["quotes"]
            and not entry.get("affinities")
            and not entry.get("dishes")
        )

    ghosts = {iid for iid, e in out_ings.items() if is_ghost(e)}
    for iid in ghosts:
        del out_ings[iid]

    # Build sorted index for search (exclude ghosts)
    index = sorted(
        [{"id": e["id"], "label": e["label"]} for e in ings
         if e["id"] not in ghosts],
        key=lambda x: x["label"].lower()
    )

    payload = json.dumps({"ingredients": out_ings, "index": index},
                         ensure_ascii=False, separators=(",", ":"))

    DEST.write_text(f"export const FLAVORS={payload};", encoding="utf-8")
    print(f"✓  Written {DEST}")
    print(f"   {len(out_ings)} ingredients, {len(index)} index entries")
    size_kb = DEST.stat().st_size / 1024
    print(f"   {size_kb:.0f} KB")


if __name__ == "__main__":
    build()
