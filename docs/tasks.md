# Project Tasks — Flavor Bible Explorer

> Status: **Lens mockup actively in development — Phase 4 underway**

## Decisions Log
- **User:** Home cooks
- **Core interaction:** Single ingredient expands network; add more ingredients freely; double-click bubble promotes to new lens
- **Data depth:** Connection strength (primary) + contextual notes on click (secondary)
- **Visual encoding:** Orbit rings by strength tier; bubble size by strength; shared bubbles identified spatially not by color
- **Platform:** Desktop-first web app
- **Stack:** Vanilla JS canvas (mockup phase); React + React Flow + Tailwind CSS + static JSON (production target)
- **Views:** Lens view (primary exploration) + Board view (printable reference); seamless toggle between them
- **Deployment:** GitHub repo at https://github.com/justin-a-yu/flavor-bible; local dev server on port 8765

## Data Model
Each ingredient entry in the JSON:
```json
{
  "id": "garlic",
  "label": "Garlic",
  "meta": { "taste": "...", "weight": "...", "volume": "...", "season": "..." },
  "pairings": [{ "label": "olive oil", "strength": 3 }],
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
- [ ] Export final cleaned flavors.json

---

## Phase 3 — Lens Mockup (canvas prototype)
- [x] Physics simulation with orbit rings (three concentric rings by strength)
- [x] Dynamic bubble count based on lens size (ring capacity formula)
- [x] Geometric block angle calculation — non-shared bubbles avoid overlap zone
- [x] Safe arc remapping — excess bubbles fade out cleanly
- [x] Shared bubble detection — migrate to midpoint when lenses overlap
- [x] Holy Grail visual treatment (radial glow + solid fill)
- [x] Detail card (click bubble → notes, modifier, quote, meta)
- [x] Seeded randomization (mulberry32 RNG, one seed per lens)
- [x] URL hash persistence (camera + lens positions + seeds)
- [x] Pan (Space + drag) and Zoom (Space + scroll, cursor-centered)
- [x] R key to reshuffle hovered lens
- [x] Lens size cap removed
- [x] New ingredient spawn doesn't move existing lenses
- [ ] Fix detail card position under pan/zoom transform
- [ ] Pan: decide on reset view shortcut
- [ ] Board view (board.html — multi-ingredient tile/grid, printable)

---

## Phase 4 — Production Engineering
- [ ] Set up React project scaffold
- [ ] Port canvas simulation to React + React Flow (or keep canvas, wrap in React)
- [ ] Implement data layer / graph store
- [ ] Implement search and filtering
- [ ] Implement contextual notes reveal
- [ ] Performance optimization for large graph
- [ ] Responsive / mobile considerations

---

## Phase 5 — Launch
- [ ] Testing and QA
- [ ] Deployment (Vercel/Netlify)
- [ ] User feedback loop
