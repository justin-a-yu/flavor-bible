# Project Tasks — Flavor Bible Explorer

> Status: **Phases 1–5 complete. Phase 6 (polish) in progress — data quality, print overhaul, avoid pairings, board UX all done.**

## Decisions Log
- **User:** Home cooks
- **Core interaction:** Single ingredient expands network; add more ingredients freely; double-click bubble promotes to new lens
- **Data depth:** Connection strength (primary) + contextual notes on click (secondary)
- **Visual encoding:** Orbit rings by strength tier; bubble size by strength; shared bubbles identified spatially not by color
- **Platform:** Desktop-first web app
- **Stack:** React + Vite + Zustand + Canvas (LensCanvas) + static JSON
- **Views:** Lens view (primary exploration) + Board view (printable reference); seamless toggle between them
- **Deployment:** GitHub repo at https://github.com/justin-a-yu/flavor-bible; local dev server on port 5173

## Data Model
Each ingredient entry in the JSON:
```json
{
  "id": "garlic",
  "label": "Garlic",
  "meta": { "taste": "...", "weight": "...", "volume": "...", "season": "...", "techniques": "...", "botanical relatives": "...", "function": "..." },
  "pairings": [{ "id": "olive-oil", "label": "olive oil", "strength": 3, "modifier": "..." }],
  "avoids":   [{ "id": "tarragon",  "label": "tarragon",  "modifier": "..." }],
  "quotes":   [{ "text": "...", "attribution": "Chef Name, Restaurant" }],
  "tips":     ["Add early in cooking."],
  "notes":    ["Long-form sidebar text (e.g. pasta pairing guide)"],
  "dishes":   [{ "text": "Dish Name", "attribution": "Chef, Restaurant" }],
  "affinities": ["garlic + lemon + olive oil"],
  "cuisines":   ["mediterranean", "afghan", "african-west"]
}
```
- **Strength tiers**: 1=Recommended, 2=Highly Recommended, 3=Essential, 4=Holy Grail
- **Avoids**: 21 ingredients have explicit "Avoid:" sections in the book; items have no strength tier
- **Cuisines** are NOT stored as ingredient entries — they become filter tags on ingredients
- **Affinities** are flavor combination groups within an entry (e.g. "allspice + garlic + pork")
- **Quotes** and **tips** stored per ingredient, surfaced on demand in the UI
- **Dishes** — chef dish examples from "Dishes" sidebars; 459 entries across 120 ingredients
- **Notes** — long-form sidebar prose (e.g. pasta's "Pairing Pastas with Sauces" guide)
- **Meta extended fields**: `techniques` and `botanical relatives` rendered as chip rows; `function` shown inline

---

## Phase 1 — Ideation & Requirements ✅
- [x] Read and understand The Flavor Bible source material
- [x] Define primary user (home cooks)
- [x] Define core interaction model (single/dual ingredient network expansion)
- [x] Define data depth requirements (connection strength + contextual notes on demand)
- [x] Define visual/UI direction
- [x] Define platform and technical constraints
- [x] Define lens interaction model (click, double-click, resize, pan, zoom, shuffle)

---

## Phase 2 — Data Processing ✅
- [x] Inspect PDF font structure (PyMuPDF) — font signatures mapped to strength tiers
- [x] Validate parser on 10-page sample (pages 50–60)
- [x] Run full parse — 502 ingredients, 101 cuisines
- [x] Fix multi-line sidebar titles (preprocess_block_lines + is_sidebar_title)
- [x] Fix MID_ENTRY_SIDEBARS — "Dishes" headers no longer reset ingredient context
- [x] Fix canonical_label hyphen bug — compound names (FIVE-SPICE POWDER, SOUS-VIDE COOKING) slug correctly
- [x] Parse quotes and attribution lines per ingredient
- [x] Parse tips per ingredient
- [x] Parse flavor affinities per ingredient
- [x] Detect cuisine headers → tag ingredient pairings with cuisine flags
- [x] Parse dish entries from "Dishes" sidebars — {text, attribution} per dish
- [x] Parse long-form sidebar notes (NOTE_SIDEBARS → notes[] field)
- [x] Fix pasta pairings/affinities lost to "Pairing Pastas with Sauces" sidebar reset
- [x] Fix quote detection — lower length guard 50→40 chars, add `benefit` stem to QUOTE_INDICATORS
- [x] Validate completeness — 13 genuinely sparse empty-pairing entries remain (acceptable)
- [x] **Pasta pairing deep audit** — recovered 46 lost pairings (40 → 86). Three root causes fixed:
  - `looks_like_quote` false-positives on pairing-with-variants lines: `\bgo` matched `goat` in CHEESE modifier; `\bcur` matched `cured` in "cured meats". Fix: colon-label guards.
  - Note section exiting too early on sentence-fragment lines. Fix: `ends_with_period` guard.
  - Multi-line pairing continuation: lines ending with a bare trailing comma weren't buffered. Fix: check `clean` for trailing comma → set `pending_pairing`.
  - Global result: 0 empty pairing labels across all 502 ingredients.
- [x] **19 prose-leakage pairings fixed** — two guards at pairing insertion point:
  1. Period guard: `if pairing_label.rstrip().endswith('.'): continue`
  2. Pronoun guard: `if re.match(r'^(i|we|you|he|she|they|it)\s', pairing_label): continue`
- [x] **Quote re-attribution** — `fix_quote_attribution()` post-processing pass; 10 quotes moved to correct ingredients (Chervil→Chestnuts, Dill→Duck, Fennel→Escarole, Herbes De Provence→Hazelnuts ×2, Hyssop→Tomatoes, Lemon Thyme→Lemon Verbena, Mushrooms→Caraway Seeds, Olive Oil→Olives, Pineapples→Pine Nuts).
- [x] **AVOID pairings parsed** — 21 ingredients have `avoids[]` entries. Standalone bold-caps `AVOID` line detected as section header; items routed to `avoids[]` (no strength tier). `"avoid"` removed from META_KEYS. `build_data_js.py` resolves avoid IDs same as pairings.

### Known parser issues (deferred)
- [ ] **QUOTE_INDICATORS coverage:** Spot-check pairings for prose leakage after each parse run;
  expand verb stems as new edge cases are found. (See project_quote_indicators.md in memory)

---

## Phase 3 — React App (Lens + Board views) ✅
- [x] Set up React + Vite project scaffold
- [x] Zustand store (`useExplorerStore`) with lenses, activeView, viewport
- [x] `flavors_data.js` data layer (static JSON, FLAVORS.index + FLAVORS.ingredients)
- [x] `SearchBar` with autocomplete dropdown
- [x] `LensPills` — removable active-ingredient chips in header
- [x] `ViewToggle` — Lens / Board segmented control (black fill when active)
- [x] `LensCanvas` — canvas physics simulation with orbit rings, shared bubble migration
- [x] `DetailCard` — floating pairing detail card in lens view
- [x] `BoardView` — structured document view: ingredient profiles, shared pairings, affinities, remaining flavors
- [x] `IngredientProfileSection` — per-lens profile cards (meta in header, tips → quotes)
- [x] `SharedBySection` — intersection groups (all-N, then strict pairs); chips grouped by strength tier
- [x] `AffinitiesSection` — flavor affinity strings with tappable non-active chips
- [x] `IngredientCard` — per-lens remaining flavors as strength-tiered chips
- [x] `PairingDetailDrawer` — slide-in drawer on pairing click; "Add as ingredient" / "Open full profile"
- [x] `PrintExportButton` → renamed **"Print View"** — opens `/print` route in new tab with URL-serialized state
- [x] `boardUtils.js` — shared pure functions (STRENGTH_COLOR, STRENGTH_LABEL, TIER_ORDER, LABEL_TO_ID, buildPairingMap, buildSharedGroups, buildAffinities, buildLensColumns, parseAffinityStr)
- [x] `/print` route — `PrintPage.jsx` standalone print document; user opens browser print dialog themselves
- [x] Ingredient names in board cards are clickable links to `/ingredient/:id`
- [x] Board avoid section — compact "Avoid:" row in profile card headers
- [x] Board cross-lens conflict warning — ⚠ banner when lens A avoids lens B
- [x] Board hint bar — bottom bar: "Click ingredient for full profile" (left) / "Click flavor chip for info" (right)
- [x] URL hash persistence (camera + lens positions + seeds)
- [x] Pan (Space + drag), Zoom (Space + scroll, cursor-centered), R to reshuffle
- [x] Trackpad click fix — 4px drag threshold prevents micro-movement swallowing clicks

### Known issues / deferred
- [ ] No reset-view shortcut yet

---

## Phase 4 — Filters & Search ✅
Scope: filter state in Zustand + filtering logic wired into LensCanvas and BoardView.

### Filter types
| Filter | Data source | UI control |
|--------|-------------|------------|
| Cuisine | `ingredient.cuisines[]` (101 available) | Multi-select checklist (deferred) |
| Season | `ingredient.meta.season` (spring/summer/autumn/winter) | 4 toggles |
| Taste | `ingredient.meta.taste` (sweet/sour/bitter/salty/umami/spicy) | 6 toggles |
| Region | `REGIONS` map → cuisine slug arrays | RegionMap SVG (7 regions) |
| Visibility | n/a — controls which sections render | All / Shared / Individual radio |

### Progress
- [x] Zustand filter slice (`filters`, `setFilter`, `toggleFilter`, `clearFilters`)
- [x] `matchesFilters` / `hasActiveFilters` / `activeFilterCount` in `filterUtils.js`
- [x] LensCanvas filtering — cuisine + season + taste + region via `matchesFilters`
- [x] BoardView filtering — `buildPairingMap` accepts `filterFn`; `buildLensColumns` also filtered
- [x] FilterPanel UI — season toggles, taste toggles, visibility radio, region map, clear-all button
- [x] Filter button — black fill when open (matches Lens/Board toggle); gold highlight when filters active but closed
- [x] `RegionMap.jsx` v2 — full rebuild with real country shapes (~458KB world.svg); 214 ISO country codes; 7 culinary regions; overlay SVG hit zones + labels
- [x] 7-Region breakdown (Americas, Europe, Middle East & N. Africa, Africa, South Asia, Southeast Asia, East Asia)
- [x] FilterPanel close-on-outside-click

### 7-Region breakdown (culinary, not political)
| Region | Countries (ISO) | Count |
|--------|----------------|-------|
| Americas | US CA MX GL + Caribbean + S. America | 52 |
| Europe | EU countries + RU AM AZ GE + Balkans | 47 |
| Middle East & N. Africa | Arab world + IR TR + Central Asia + CY DJ ER SD | 31 |
| Africa | Sub-Saharan Africa | 47 |
| South Asia | AF BD BT IN MV NP PK LK | 8 |
| Southeast Asia | SE Asian nations + AU NZ + Pacific islands | 22 |
| East Asia | CN HK JP KP KR MN TW | 7 |

### Deferred
- [ ] Cuisine filter UI (101 options — needs search/scrollable checklist)
- [ ] Tune RegionMap hit zone coordinates after live visual review

---

## Phase 5 — `IngredientProfilePage` ✅
- [x] Route `/ingredient/:id` → full-page ingredient profile
- [x] Render all data: label, meta, full pairing list (strength-tiered chips), all quotes, all tips, all affinities
- [x] Pairing chips link to `/ingredient/:id` for further exploration
- [x] Clean printable layout
- [x] Graceful not-found state
- [x] Show dishes[] section — list with chef/restaurant attribution, subtle dividers
- [x] Show notes[] section — long-form prose; PDF line-wraps re-joined into semantic paragraphs
- [x] Show meta fields fully — `techniques` and `botanical relatives` as chip rows (botanical relatives link to ingredient profiles); `function` stays inline with taste/weight/volume/season; BoardView cards show only compact fields
- [x] **Avoids section** — red-toned chip row labeled "Avoid" between Pairings and Affinities; chips link to avoided ingredient's profile when resolvable

---

## Phase 6 — Polish & Launch
- [x] RegionMap rebuild — real country shapes, 7 culinary regions, per-country fill targeting
- [x] FilterPanel close-on-outside-click
- [x] Filter button state — black when open; gold when filters active + closed; plain otherwise
- [x] BoardView visibility filter — shared/individual correctly hide/show respective sections
- [x] Region chips — labels below map as always-visible chips (stable panel height)
- [x] Add dishes + notes to IngredientProfilePage
- [x] Meta fields on profile page — techniques (chips), botanical relatives (linked chips), function inline
- [x] Prose leakage fix — 19 sentence fragments removed from pairings data
- [x] Quote re-attribution — 10 quotes correctly moved to their intended ingredients
- [x] AVOID pairings — 21 ingredients parsed; shown on profile page, board cards, and cross-lens conflict warning
- [x] Print overhaul — dedicated `/print` route (new tab); "Print View" button; active filters shown at bottom of print document; user opens browser print dialog themselves
- [x] Board ingredient links — ingredient names on board cards link to full profile page
- [x] Board hint bar — "Click ingredient for full profile" / "Click flavor chip for info"
- [x] Lens hint bar — updated to "Click flavor bubble for info"
- [ ] Cuisine filter UI (101 options — needs search/scrollable checklist)
- [ ] Tune RegionMap hit zone coordinates after live visual review
- [ ] Responsive / mobile considerations
- [ ] Performance optimization for large graph
- [ ] Testing and QA
- [ ] Deployment (Vercel/Netlify)
- [ ] User feedback loop
