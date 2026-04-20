"""
build_data_js.py
Converts data/flavors.json → app/src/data/flavors_data.js

Output sets window.FLAVORS with:
  ingredients  — { [id]: entry }  (full data per ingredient)
  index        — [ { id, label } ] sorted alphabetically (for search)

Each pairing gets an `id` field: the ingredient id it resolves to,
or null if no matching ingredient exists. This enables double-click promote.
"""

import json, unicodedata, re
from pathlib import Path

SRC  = Path(__file__).parent.parent / "data" / "flavors.json"
DEST = Path(__file__).parent.parent / "app" / "src" / "data" / "flavors_data.js"


def slugify(text):
    normalized = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("ascii")
    return re.sub(r"[^a-z0-9]+", "-", normalized.lower()).strip("-")


def build():
    data = json.loads(SRC.read_text(encoding="utf-8"))
    ings = data["ingredients"]

    # Build label → id lookup for pairing promotion
    label_to_id = {}
    for entry in ings:
        label_to_id[entry["label"].lower()] = entry["id"]
        label_to_id[entry["id"].replace("-", " ")] = entry["id"]
        label_to_id[entry["id"]] = entry["id"]
        for alias in entry.get("aliases", []):
            label_to_id[alias.replace("-", " ")] = entry["id"]

    def resolve_id(label):
        key = label.lower().strip()
        if key in label_to_id:
            return label_to_id[key]
        # Try slugified label
        slug = slugify(label)
        if slug in label_to_id:
            return label_to_id[slug]
        return None

    # Build ingredients dict
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
            "aliases":    entry.get("aliases", []),
        }

    # Build sorted index for search
    index = sorted(
        [{"id": e["id"], "label": e["label"]} for e in ings],
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
