#!/usr/bin/env python3
"""
Preprocess world_map.svg into a lightweight overlay SVG with 6 clickable region groups.

Input:  app/public/world_map.svg  (14MB Wikimedia map, viewBox 0 0 2280 1293)
Output: app/public/world_map_regions.svg

Layer5 (id="layer5") has transform="translate(-59.945171,-103.18356)".
Coordinate formula (equirectangular, centred 10°E):
  lon = x_layer * (360/2280) - 170
  lat = 90 - y_layer * (180/1293)
where x_layer, y_layer are SVG coords AFTER applying the layer translate.

Centroid strategy: bounding box center across ALL coordinate values in the
path.  Using the first 'm' coordinate was unreliable for countries like China
whose SVG path starts at a southern island — the bbox center gives a much
more accurate geographic centre.
"""

import re
import sys
from pathlib import Path
from xml.etree import ElementTree as ET

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
BASE = Path("/Users/juyu/Documents/flavor bible")
INPUT_SVG  = BASE / "app/public/world_map.svg"
OUTPUT_SVG = BASE / "app/public/world_map_regions.svg"

# ---------------------------------------------------------------------------
# Layer transform
# ---------------------------------------------------------------------------
TX, TY = -59.945171, -103.18356

# ---------------------------------------------------------------------------
# Coordinate conversion
# ---------------------------------------------------------------------------
def xy_to_lonlat(x_svg, y_svg):
    """Convert raw SVG coords (before layer transform) to lon/lat."""
    x_layer = x_svg + TX
    y_layer = y_svg + TY
    lon = x_layer * (360 / 2280) - 170
    lat = 90 - y_layer * (180 / 1293)
    return lon, lat


# ---------------------------------------------------------------------------
# Bounding box centroid from path 'd' attribute.
#
# Collects only ABSOLUTE coordinate sources:
#   - The initial lowercase 'm' (absolute at path start per SVG spec when
#     there is no current point)
#   - Any subsequent uppercase 'M' (absolute moveto) commands
#
# The bounding box centre of these points gives a reliable geographic centroid
# even for countries (e.g. China) whose path starts at a southern island,
# because the bbox across all absolute subpath starts spans the full extent
# of the territory.
#
# NOTE: We deliberately do NOT extract all numbers from the path string.
# The vast majority of coordinates in these paths are *relative* offsets
# (lowercase commands: l, c, s, q, etc.) which are not absolute positions
# and would produce wildly incorrect bbox values if treated as absolute.
# ---------------------------------------------------------------------------
FIRST_M_RE = re.compile(r'^[Mm]\s*([-\d.eE]+)[,\s]+([-\d.eE]+)', re.ASCII)
UPPER_M_RE = re.compile(r'(?<![a-zA-Z])M\s*([-\d.eE]+)[,\s]+([-\d.eE]+)', re.ASCII)

def get_bbox_center(d):
    """Get bounding box center from absolute moveto coords in path d.

    Uses the initial m (absolute at path start) plus any uppercase M subpath
    starts.  The bbox centre across all these absolute anchor points gives a
    robust geographic centroid even when the first anchor is a southern island,
    because the bbox across all absolute subpath starts spans the full extent
    of the territory.

    Special case: paths that span more than ~1500 SVG units horizontally
    (e.g. Russia, which wraps across the dateline) have a meaningless bbox
    centre.  For these we fall back to the first-m coordinate for the x axis
    while still using the bbox centre for y.  This correctly keeps Russia in
    east_asia rather than misplacing it at the mid-Atlantic.
    """
    abs_xs, abs_ys = [], []

    # Initial moveto — always absolute
    m0 = FIRST_M_RE.match(d)
    if m0:
        abs_xs.append(float(m0.group(1)))
        abs_ys.append(float(m0.group(2)))

    # Subsequent uppercase M commands
    for mx in UPPER_M_RE.finditer(d):
        abs_xs.append(float(mx.group(1)))
        abs_ys.append(float(mx.group(2)))

    if not abs_xs:
        return None, None

    # Filter to viewBox-plausible range to exclude degenerate subpaths
    xs = [x for x in abs_xs if -500 < x < 2800]
    ys = [y for y in abs_ys if -500 < y < 1800]

    if not xs or not ys:
        return None, None

    x_range = max(xs) - min(xs)
    if x_range > 1500:
        # Dateline-spanning path (e.g. Russia): bbox x is meaningless.
        # Use first-m x to preserve primary geographic longitude.
        cx = abs_xs[0] + TX
    else:
        cx = (min(xs) + max(xs)) / 2 + TX
    cy = (min(ys) + max(ys)) / 2 + TY
    return cx, cy


# ---------------------------------------------------------------------------
# Region assignment  (priority order as specified)
#
# Notes on boundary extensions (vs. original spec):
#   - Americas uses lon < -22 (original: -25) to capture South Atlantic islands
#     at lon≈-23 to -24 (e.g. Trindade / São Paulo Archipelago, Brazilian territory).
#     The gap between -25 and -22 was leaving ~8 small paths unassigned.
#   - south_se_asia extends to lon ≤ 200 (original: ≤ 165) to capture New Zealand
#     (lon ≈ 165–178) and Chatham Islands (lon ≈ 183) which are east of the 165° cutoff.
#   - Paths with SVG y near 0 (Iceland, Svalbard) can compute lat > 90 due to the
#     map canvas crop; they are still correctly captured by the europe rule (lat > 40).
#   - east_asia is checked BEFORE south_se_asia so that China/Japan/Korea/Mongolia
#     (bbox lat 30–50) are not swallowed by the south_se_asia lat ≤ 35 rule.
#     Threshold lat > 18 ensures Australia (bbox lat ≈ -28) still falls to
#     south_se_asia while China (bbox lat ≈ 35) lands in east_asia.
# ---------------------------------------------------------------------------
REGION_ORDER = [
    "americas",
    "africa",
    "me_nafrica",
    "europe",
    "east_asia",
    "south_se_asia",
]

def assign_region(lon, lat):
    # Americas: western hemisphere + anything west of -22° (includes South Atlantic
    # islands like Trindade that sit between -22° and -25°).
    if lon < -22:
        return "americas"
    # Sub-Saharan Africa: lon -22 to 55, lat < 10
    if -22 <= lon <= 55 and lat < 10:
        return "africa"
    # Middle East & North Africa: lon -22 to 65, lat 8 to 40
    if -22 <= lon <= 65 and 8 <= lat <= 40:
        return "me_nafrica"
    # Europe: lon -30 to 45, lat > 40
    # (lat computed as > 90 for Iceland/Svalbard paths whose SVG y ≈ 0 is fine here)
    if -30 <= lon <= 45 and lat > 40:
        return "europe"
    # East Asia: lon > 65, lat > 18  (China, Japan, Korea, Mongolia, Russia east)
    # Checked BEFORE south_se_asia so these countries are not misclassified.
    # Australia bbox lat ≈ -28 so lat > 18 safely excludes it.
    if lon > 65 and lat > 18:
        return "east_asia"
    # South/SE Asia + Australia + New Zealand + Pacific (up to dateline + 20°):
    # lon 55 to 200, lat ≤ 35
    if 55 <= lon <= 200 and lat <= 35:
        return "south_se_asia"
    return "unassigned"


# ---------------------------------------------------------------------------
# Parse SVG
# ---------------------------------------------------------------------------
print(f"Parsing {INPUT_SVG} …", flush=True)

tree = ET.parse(str(INPUT_SVG))
root = tree.getroot()

ns_match = re.match(r'\{([^}]+)\}', root.tag)
SVG_NS = ns_match.group(1) if ns_match else "http://www.w3.org/2000/svg"

print(f"SVG namespace: {SVG_NS}", flush=True)

# Find layer5
layer5 = root.find(f'.//*[@id="layer5"]')
if layer5 is None:
    print("ERROR: could not find element with id='layer5'")
    sys.exit(1)

print(f"Found layer5: {layer5.tag}", flush=True)

# Collect all <path> elements in layer5 (including nested group children)
all_paths = layer5.findall(f'.//{{{SVG_NS}}}path')
if not all_paths:
    all_paths = layer5.findall('.//path')

print(f"Total paths in layer5: {len(all_paths)}", flush=True)

# ---------------------------------------------------------------------------
# Classify paths
# ---------------------------------------------------------------------------
buckets = {r: [] for r in REGION_ORDER}
buckets["unassigned"] = []

skipped_no_anchor = 0
debug_unassigned = []  # (lon, lat, d_preview)

for path in all_paths:
    d = path.get("d", "")
    if not d:
        skipped_no_anchor += 1
        continue

    cx, cy = get_bbox_center(d)
    if cx is None:
        skipped_no_anchor += 1
        continue

    lon, lat = xy_to_lonlat(cx, cy)
    region = assign_region(lon, lat)
    buckets[region].append((d, lon, lat))
    if region == "unassigned":
        debug_unassigned.append((lon, lat, d[:60]))

# ---------------------------------------------------------------------------
# Report
# ---------------------------------------------------------------------------
print("\n=== Region counts ===")
for r in REGION_ORDER:
    print(f"  {r:20s}: {len(buckets[r])}")
print(f"  {'unassigned':20s}: {len(buckets['unassigned'])}")
print(f"  {'skipped (no anchor)':20s}: {skipped_no_anchor}")
total = sum(len(v) for v in buckets.values()) + skipped_no_anchor
print(f"  {'TOTAL':20s}: {total}")

print("\n=== Spot-check: first 5 bbox centroids per region ===")
for r in REGION_ORDER:
    print(f"  {r}:")
    for d, lon, lat in buckets[r][:5]:
        print(f"    lon={lon:.1f}  lat={lat:.1f}  d={d[:50]!r}")

if debug_unassigned:
    print(f"\n--- Remaining unassigned paths (lon, lat) ---")
    for lon, lat, preview in debug_unassigned[:20]:
        print(f"  lon={lon:.1f}  lat={lat:.1f}  d={preview!r}")

# ---------------------------------------------------------------------------
# Build output SVG
# ---------------------------------------------------------------------------
REGION_IDS = {
    "americas":      "region-americas",
    "europe":        "region-europe",
    "me_nafrica":    "region-me-nafrica",
    "africa":        "region-africa",
    "south_se_asia": "region-south-se-asia",
    "east_asia":     "region-east-asia",
}

TRANSFORM = 'translate(-59.945171,-103.18356)'

lines = []
lines.append('<?xml version="1.0" encoding="UTF-8"?>')
lines.append('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2280 1293">')

for region in REGION_ORDER:
    gid = REGION_IDS[region]
    lines.append(f'  <g id="{gid}" transform="{TRANSFORM}">')
    for d, _lon, _lat in buckets[region]:
        d_safe = d.replace('"', '&quot;')
        lines.append(f'    <path d="{d_safe}"/>')
    lines.append('  </g>')

lines.append('</svg>')

output_text = "\n".join(lines)

OUTPUT_SVG.write_text(output_text, encoding="utf-8")

size_bytes = OUTPUT_SVG.stat().st_size
size_kb = size_bytes / 1024
print(f"\nWrote {OUTPUT_SVG}")
print(f"Output file size: {size_kb:.1f} KB  ({size_kb/1024:.2f} MB)")
