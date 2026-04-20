# Project Tasks — Flavor Bible Explorer

> Status: **Phases 2 (data), 3, 4 & 5 complete. Phase 6 (polish) in progress — RegionMap rebuilt.**

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
  "meta": { "taste": "...", "weight": "...", "volume": "...", "season": "..." },
  "pairings": [{ "id": "olive-oil", "label": "olive oil", "strength": 3, "modifier": "..." }],
  "quotes": [{ "text": "...", "attribution": "Chef Name, Restaurant" }],
  "tips": ["Add early in cooking."],
  "notes": ["Long-form sidebar text (e.g. pasta pairing guide)"],
  "dishes": [{ "text": "Dish Name", "attribution": "Chef, Restaurant" }],
  "affinities": ["garlic + lemon + olive oil"],
  "cuisines": ["mediterranean", "afghan", "african-west"]
}
```
- **Strength tiers**: 1=Recommended, 2=Highly Recommended, 3=Essential, 4=Holy Grail
- **Cuisines** are NOT stored as ingredient entries — they become filter tags on ingredients
- **Affinities** are flavor combination groups within an entry (e.g. "allspice + garlic + pork")
- **Quotes** and **tips** stored per ingredient, surfaced on demand in the UI
- **Dishes** — chef dish examples from "Dishes" sidebars; 459 entries across 120 ingredients
- **Notes** — long-form sidebar prose (e.g. pasta's "Pairing Pastas with Sauces" guide)

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
  - `looks_like_quote` false-positives on pairing-with-variants lines: `\bgo` matched `goat` in CHEESE modifier; `\bcur` matched `cured` in "cured meats". Fix: colon-label guards — `^[A-Z][A-Z ]+:\s*\S` (caps) and `^[^:(]{2,40}:\s*[a-z]` (any case) short-circuit before QUOTE_INDICATORS runs.
  - Note section exiting too early on sentence-fragment lines: `has some character.` (18 chars, no verb, no _cont_word) slipped out of the note buffer, leaving subsequent bullets to open a prose_buffer that swallowed `pepper` through `zucchini`. Fix: added `ends_with_period` guard — ingredient pairings never end with `.`.
  - Multi-line pairing continuation: lines ending with a bare trailing comma (e.g. `CHEESE: ..., mozzarella,`) weren't buffered because `rstrip(",;")` ran first. Fix: check `clean` (pre-strip) for trailing comma → set `pending_pairing`; added empty-base-label guard after `split_modifier` for overflow lines starting with `(esp. ...`.
  - Global result: 0 empty pairing labels across all 502 ingredients.

### Known parser issues (deferred)
- [ ] **Option A — Quote misattribution:** Pre-header quotes (e.g. pine nut quotes filed under pineapple)
  are attributed to the wrong ingredient. Root cause: book places intro quotes *before* the ingredient
  header they belong to. Fix: post-processing re-attribution pass — scan quote text for named ingredients
  and reassign. Affects ~10–20 entries.
- [ ] **18 prose-leakage pairings** in anise, asparagus-white, brined-dishes, horseradish, lavender,
  lettuces, mangoes, cantaloupe-honeydew, mushrooms, oil-avocado, oregano, pepper-black, pickles,
  quail, rosemary, salt-kosher, smokiness, strawberries. Root cause: `is_clear_ingredient` requires
  uppercase first char, so once a prose_buffer opens, lowercase pairings accumulate until the next
  header. Fix: relax uppercase requirement in `is_clear_ingredient`. Deferred.
- [ ] **QUOTE_INDICATORS coverage:** Spot-check pairings for prose leakage after each parse run;
  expand verb stems as new edge cases are found. (See project_quote_indicators.md in memory)

---

## Phase 3 — React App (Lens + Board views) ✅
- [x] Set up React + Vite project scaffold
- [x] Zustand store (`useExplorerStore`) with lenses, activeView, viewport
- [x] `flavors_data.js` data layer (static JSON, FLAVORS.index + FLAVORS.ingredients)
- [x] `SearchBar` with autocomplete dropdown
- [x] `LensPills` — removable active-ingredient chips in header
- [x] `ViewToggle` — Lens / Board segmented control
- [x] `LensCanvas` — canvas physics simulation with orbit rings, shared bubble migration
- [x] `DetailCard` — floating pairing detail card in lens view
- [x] `BoardView` — structured document view: ingredient profiles, shared pairings, affinities, remaining flavors
- [x] `IngredientProfileSection` — per-lens profile cards (meta in header, tips → quotes)
- [x] `SharedBySection` — intersection groups (all-N, then strict pairs); chips grouped by strength tier; all-caps raw labels
- [x] `AffinitiesSection` — flavor affinity strings with tappable non-active chips
- [x] `IngredientCard` — per-lens remaining flavors as strength-tiered chips
- [x] `PairingDetailDrawer` — slide-in drawer on pairing click; "Add as ingredient" / "Open full profile"
- [x] `PrintExportButton` — triggers `window.print()` with print stylesheet
- [x] URL hash persistence (camera + lens positions + seeds)
- [x] Pan (Space + drag), Zoom (Space + scroll, cursor-centered), R to reshuffle
- [x] Trackpad click fix — 4px drag threshold prevents micro-movement swallowing clicks

### Known issues / deferred
- [ ] No reset-view shortcut yet

---

## Phase 4 — Filters & Search ✅
Scope: filter state in Zustand + filtering logic wired into LensCanvas and BoardView.
FilterPanel UI shell deferred to polish phase.

### Filter types
| Filter | Data source | UI control |
|--------|-------------|------------|
| Cuisine | `ingredient.cuisines[]` (101 available) | Multi-select checklist |
| Season | `ingredient.meta.season` (spring/summer/autumn/winter) | 4 toggles |
| Taste | `ingredient.meta.taste` (sweet/sour/bitter/salty/umami/spicy) | 6 toggles |
| Visibility | n/a — controls which bubbles render | All / Shared / Individual radio |

### Implementation plan
1. **Zustand filter slice** — add to `useExplorerStore`:
   ```js
   filters: {
     cuisines: [],        // [] = no filter (show all)
     seasons: [],         // [] = no filter
     tastes: [],          // [] = no filter
     visibility: 'all',   // 'all' | 'shared' | 'individual'
   },
   setFilter(key, value) — replaces filter value
   toggleFilter(key, item) — adds/removes from array filters
   clearFilters() — resets all
   ```
2. **Filter predicate** — `matchesFilters(ingredient, filters)` pure function
   - cuisine: ingredient.cuisines intersects filters.cuisines (OR logic — any match passes)
   - season: meta.season string contains any of filters.seasons
   - taste: meta.taste string contains any of filters.tastes
   - Returns boolean
3. **LensCanvas** — pass filtered pairing set to physics sim; grey-out or hide filtered-out bubbles
4. **BoardView** — apply same predicate to SharedBySection and IngredientCard chip lists
5. **FilterPanel UI** — collapsible panel with checkboxes/toggles (deferred to Phase 6 polish)
6. **Active filter indicator** — show badge/count on filter button when filters are active

### Progress
- [x] Zustand filter slice (`filters`, `setFilter`, `toggleFilter`, `clearFilters` in `useExplorerStore`)
- [x] `matchesFilters` predicate — `app/src/utils/filterUtils.js` (cuisine OR, season OR, taste OR); also `hasActiveFilters` / `activeFilterCount`
- [x] LensCanvas filtering — cuisine + season + taste via `matchesFilters`; visibility unchanged
- [x] BoardView filtering — `buildPairingMap` accepts `filterFn`; `lensColumns` also filtered; both use same predicate
- [x] FilterPanel UI shell — season toggles, taste toggles, visibility radio, clear-all button; dropdown attached to header
- [x] Active filter badge — gold badge on Filter button showing count of active dimensions
- [x] Region filter — geographic dimension added to filter state; `REGIONS` map (6 labels → cuisine slug arrays); `regionsToCuisineSlugs()` for O(1) lookup; `matchesFilters` updated to include region check; LensCanvas + BoardView both use updated predicate
- [x] `RegionMap.jsx` v1 — custom inline SVG world map (6 hand-crafted bezier-curve blobs, no dependencies); hover/selected states; click toggles region; integrated into FilterPanel replacing region toggle buttons; panel widened to 360px
- [x] `RegionMap.jsx` v2 — **full rebuild**: fetches `world.svg` (real country shapes, ~458KB); 214 ISO country codes embedded as region→code mapping; imperative `.sm_state_XX` class targeting for per-country fills; 7 regions (split South & SE Asia into South Asia + Southeast Asia); overlay SVG with 7 hit zones + labels in `0 0 701 300` viewBox; same two-layer architecture (fill div + React overlay)
- [x] `filterUtils.js` — REGIONS map updated from 6 → 7 entries; `South & SE Asia` split into `South Asia` (indian, pakistani, sri-lankan, afghan) and `Southeast Asia` (southeast-asian-*, indonesian, malaysian, thai, vietnamese, cambodian, burmese, australian); `afghan-cuisine` moved from East Asia → South Asia
- [x] `app/public/` — user-supplied SVGs: `world.svg` (base map, all countries `#c2beb5`) + 7 region SVGs (`americas.svg`, `europe.svg`, `me-nafrica.svg`, `africa.svg`, `south-asia.svg`, `southeast-asia.svg`, `east-asia.svg`); region SVGs are reference only and not loaded at runtime

### 7-Region breakdown (culinary, not political)
| Region | Countries (ISO) | Count |
|--------|----------------|-------|
| Americas | US CA MX GL + Caribbean + S. America | 52 |
| Europe | EU countries + RU AM AZ GE + Balkans | 47 |
| Middle East & N. Africa | Arab world + IR TR + Central Asia + CY DJ ER SD | 31 |
| Africa | Sub-Saharan Africa (SO → Africa, not MENA) | 47 |
| South Asia | AF BD BT IN MV NP PK LK | 8 |
| Southeast Asia | SE Asian nations + AU NZ + Pacific islands | 22 |
| East Asia | CN HK JP KP KR MN TW | 7 |

### Deferred
- [ ] Cuisine filter UI (101 options — needs search/scrollable checklist, deferred to Phase 6 polish)
- [ ] FilterPanel close-on-outside-click (minor UX polish)
- [ ] Tune RegionMap hit zone coordinates after live visual review

---

## Phase 5 — `IngredientProfilePage` ✅
- [x] Route `/ingredient/:id` → full-page ingredient profile
- [x] Render all data: label, meta, full pairing list (strength-tiered chips), all quotes, all tips, all affinities
- [x] Pairing chips link to `/ingredient/:id` for further exploration
- [x] Clean printable layout
- [x] Graceful not-found state

### Profile page enhancements
- [x] Show dishes[] section — list with chef/restaurant attribution, subtle dividers
- [x] Show notes[] section — long-form prose; PDF line-wraps re-joined into semantic paragraphs by "Word(s): " header detection

---

## Phase 6 — Polish & Launch
- [x] RegionMap rebuild — real country shapes, 7 culinary regions, per-country fill targeting (see Phase 4 details)
- [ ] Tune RegionMap hit zone coordinates after live visual review
- [ ] FilterPanel full UI (built on Phase 4 state/logic)
- [ ] Responsive / mobile considerations
- [ ] Performance optimization for large graph
- [ ] Option A — quote re-attribution post-processing script
- [x] Add dishes + notes to IngredientProfilePage
- [ ] Testing and QA
- [ ] Deployment (Vercel/Netlify)
- [ ] User feedback loop
