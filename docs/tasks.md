# Project Tasks — Flavor Bible Explorer

> Status: **Requirements complete — moving to data processing**

## Decisions Log
- **User:** Home cooks
- **Core interaction:** Single ingredient expands network; add more ingredients freely; double-click bubble promotes to new lens
- **Data depth:** Connection strength (primary) + contextual notes on click (secondary)
- **Visual encoding:** Edge thickness + color gradient + node size; shared bubbles identified spatially not by color
- **Platform:** Desktop-first web app
- **Stack:** React + React Flow + Tailwind CSS + static JSON
- **Views:** Lens view (primary exploration) + Board view (printable reference); seamless toggle between them
- **Deployment:** Local first, Vercel/Netlify later

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
- **Cuisines** are NOT stored as ingredient entries — they become filter tags on ingredients
- **Affinities** are flavor combination groups within an entry (e.g. "allspice + garlic + pork")
- **Quotes** and **tips** stored per ingredient, surfaced on demand in the UI

---

## Phase 1 — Ideation & Requirements
- [x] Read and understand The Flavor Bible source material
- [x] Define primary user (home cooks)
- [x] Define core interaction model (single/dual ingredient network expansion)
- [x] Define data depth requirements (connection strength + contextual notes on demand)
- [x] Define visual/UI direction (edge thickness + color + node size)
- [x] Define platform and technical constraints (desktop-first, React + React Flow + Tailwind + static JSON)
- [ ] Define data extraction approach (Chapter 3 charts)
- [ ] Define network/graph data model
- [ ] Finalize MVP feature scope

---

## Phase 2 — Data Processing
- [x] Inspect PDF font structure (PyMuPDF) — font signatures mapped to strength tiers
- [x] Validate parser on 10-page sample (pages 50–60)
- [ ] Fix parser issues: start page, span concatenation, Flavor Affinities header, cuisine detection
- [ ] Parse quotes and attribution lines per ingredient
- [ ] Parse tips per ingredient
- [ ] Parse flavor affinities per ingredient
- [ ] Detect cuisine headers → tag ingredient pairings with cuisine flags (not stored as entries)
- [ ] Run full parse — pages 40–811
- [ ] Validate data completeness and spot-check accuracy
- [ ] Export final flavors.json

---

## Phase 3 — Design
- [ ] Define visual language (color, typography, layout)
- [ ] Design network graph component
- [ ] Design single-ingredient search flow
- [ ] Design two-ingredient exploration flow
- [ ] Design contextual notes panel (on-click, progressive disclosure)
- [ ] Design connection strength visual encoding (weight, color, size)
- [ ] Prototype and iterate

---

## Phase 4 — Engineering
- [ ] Set up project scaffold
- [ ] Implement data layer / graph store
- [ ] Implement graph visualization
- [ ] Implement search and filtering
- [ ] Implement contextual notes reveal
- [ ] Implement two-ingredient bridge/intersection logic
- [ ] Performance optimization for large graph
- [ ] Responsive / mobile considerations

---

## Phase 5 — Launch
- [ ] Testing and QA
- [ ] Deployment
- [ ] User feedback loop
