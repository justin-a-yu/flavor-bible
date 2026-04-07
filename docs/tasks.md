# Project Tasks — Flavor Bible Explorer

> Status: **Board view complete — Phase 3 done. Phase 5 (filter panel) next.**

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
  "affinities": ["garlic + lemon + olive oil"],
  "cuisines": ["mediterranean", "afghan", "african-west"]
}
```
- **Strength tiers**: 1=Recommended, 2=Highly Recommended, 3=Essential, 4=Holy Grail
- **Cuisines** are NOT stored as ingredient entries — they become filter tags on ingredients
- **Affinities** are flavor combination groups within an entry (e.g. "allspice + garlic + pork")
- **Quotes** and **tips** stored per ingredient, surfaced on demand in the UI

---

## Phase 1 — Ideation & Requirements
- [x] Read and understand The Flavor Bible source material
- [x] Define primary user (home cooks)
- [x] Define core interaction model (single/dual ingredient network expansion)
- [x] Define data depth requirements (connection strength + contextual notes on demand)
- [x] Define visual/UI direction
- [x] Define platform and technical constraints
- [x] Define lens interaction model (click, double-click, resize, pan, zoom, shuffle)

---

## Phase 2 — Data Processing
- [x] Inspect PDF font structure (PyMuPDF) — font signatures mapped to strength tiers
- [x] Validate parser on 10-page sample (pages 50–60)
- [x] Run full parse — flavors.json generated
- [ ] Fix remaining parser issues: span concatenation, Flavor Affinities header, cuisine detection
- [ ] Parse quotes and attribution lines per ingredient
- [ ] Parse tips per ingredient
- [ ] Parse flavor affinities per ingredient
- [ ] Detect cuisine headers → tag ingredient pairings with cuisine flags
- [ ] Validate data completeness and spot-check accuracy (26 empty entries known, arugula slug issue)
- [ ] Expand `QUOTE_INDICATORS` verb list (iterative — re-check after each parse run)
- [ ] Export final cleaned flavors.json

---

## Phase 3 — React App (Lens + Board views)
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

### Known issues / deferred
- [ ] Pan: no reset-view shortcut yet
- [ ] `IngredientProfilePage` (`/ingredient/:id`) — linked from drawers but not yet built
- [ ] "Open full profile" links in `PairingDetailDrawer` will 404 until above is built

---

## Phase 4 — Filters & Search
- [ ] `FilterPanel` — collapsible side panel
- [ ] `CuisineFilter` — multi-select (depends on Phase 2 cuisine parsing)
- [ ] `SeasonFilter` — Spring / Summer / Autumn / Winter toggles
- [ ] `TasteFilter` — sweet / sour / bitter / umami / salty toggles
- [ ] `VisibilityFilter` — All / Shared only / Individual only
- [ ] Wire filters through `LensCanvas` and `BoardView` rendering

---

## Phase 5 — `IngredientProfilePage`
- [ ] Route `/ingredient/:id` → full-page ingredient profile
- [ ] Render all data: label, meta, full pairing list, all quotes, all tips, all affinities
- [ ] Clean printable layout
- [ ] Graceful not-found state

---

## Phase 6 — Polish & Launch
- [ ] Responsive / mobile considerations
- [ ] Performance optimization for large graph
- [ ] Testing and QA
- [ ] Deployment (Vercel/Netlify)
- [ ] User feedback loop
