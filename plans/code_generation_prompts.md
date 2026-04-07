# Code Generation Prompts — Flavor Bible Explorer

Each prompt is self-contained and references prior outputs so they can be executed in sequence.

---

## Phase 1 — Project Scaffold

**Task:** Refer to the component model in `flavor-bible/docs/task_component_model.md`. Scaffold a new React + Vite project for the Flavor Bible Explorer. Do not generate any business logic yet — only the project structure, routing shell, and empty component files.

Specifically:
- Initialize the project in a new `flavor-bible/app/` directory using Vite with the React template
- Install dependencies: `react-router-dom`, `zustand`
- Set up two routes using React Router:
  - `/` → `ExplorerPage` (empty shell)
  - `/ingredient/:id` → `IngredientProfilePage` (empty shell)
- Create empty component files in `src/components/` for each component listed in the component model: `Header`, `SearchBar`, `SearchDropdown`, `ViewToggle`, `FilterPanel`, `CuisineFilter`, `SeasonFilter`, `TasteFilter`, `VisibilityFilter`, `LensCanvas`, `DetailCard`, `BoardView`, `IngredientCard`, `PairingDetailDrawer`, `PrintExportButton`
- Create empty page files in `src/pages/`: `ExplorerPage`, `IngredientProfilePage`
- Create an empty store file at `src/store/useExplorerStore.js`
- Copy `flavor-bible/mockup/flavors_data.js` into `src/data/flavors_data.js` and export it as an ES module
- Set up a minimal `App.jsx` that wires routing
- Include a basic global CSS reset in `src/index.css`; use the color palette from the mockup (`#faf7f2` background, `#2c2416` text, `#b8863a` gold)

Do not implement any component logic. Each file should export an empty functional component or placeholder.

---

## Phase 2 — Zustand State Store

**Task:** Refer to the component model in `flavor-bible/docs/task_component_model.md` and the scaffolded store at `flavor-bible/app/src/store/useExplorerStore.js`. Implement the full Zustand store for the Flavor Bible Explorer.

The store must include:
- State shape exactly as specified in the component model: `lenses[]`, `activeView`, `filters`, `viewport`
- The `Lens` shape: `{ id, label, color, x, y, r, seed }`
- A color palette constant (6 colors from the mockup: `['#d4a840','#c0603a','#4a8c5c','#7a5ab8','#c06080','#4a7ab8']`) used to assign `color` when adding a lens
- All actions: `addLens`, `removeLens`, `updateLens`, `setActiveView`, `setFilter`, `clearFilters`, `setViewport`
- Two URL hash utilities as standalone functions (not store actions): `serializeHash(state)` and `deserializeHash(hash)` that encode/decode the format `#@panX,panY,zoom;id:x,y,r,seed;...` as defined in the component model
- Seeded RNG utilities: `mulberry32(seed)` and `seededShuffle(arr, seed)` as standalone functions exported from `src/utils/rng.js`

Save the store to `flavor-bible/app/src/store/useExplorerStore.js` and the RNG utilities to `flavor-bible/app/src/utils/rng.js`.

---

## Phase 3 — LensCanvas Component

**Task:** Refer to the component model in `flavor-bible/docs/task_component_model.md` and the existing vanilla JS canvas implementation in `flavor-bible/mockup/lens.html`. Port the lens canvas simulation into a React component at `flavor-bible/app/src/components/LensCanvas.jsx`.

The component must:
- Mount a `<canvas>` element via `useRef` and run the physics loop via `requestAnimationFrame` in a `useEffect`
- Read `lenses`, `filters`, and `viewport` from the Zustand store
- Implement all canvas behaviors from the component model: drag lenses, scroll to resize, Space+drag to pan, Space+scroll to zoom, R key to reshuffle, single-click bubble → open DetailCard, double-click bubble → call `addLens`, click lens label → open `/ingredient/:id` in new tab
- Apply `viewport.panX`, `viewport.panY`, `viewport.zoom` to the canvas transform
- Apply active `filters` to determine bubble visibility (fade non-matching bubbles)
- Use the seeded shuffle from `src/utils/rng.js` and the orbit ring / ring capacity logic from the mockup
- Call store actions (`updateLens`, `addLens`, `setViewport`) on relevant interactions
- Debounce URL hash saves (300ms) using `history.replaceState` and `serializeHash` after drag-end, scroll-end, and zoom-end
- Keep all transient interaction state (hoveredBubble, dragging, isPanning) in React refs, not in Zustand
- Accept one prop: `onBubbleClick(bubble)` — called when a bubble is single-clicked, used by ExplorerPage to open DetailCard

---

## Phase 4 — BoardView, IngredientCard, PairingDetailDrawer, PrintExportButton

**Task:** Refer to the component model in `flavor-bible/docs/task_component_model.md`. Implement the board view and its child components.

Implement the following files:
- `flavor-bible/app/src/components/BoardView.jsx` — reads `lenses` and `filters` from store; renders one `IngredientCard` per lens; computes shared pairing ids across all active lenses; renders `PrintExportButton`
- `flavor-bible/app/src/components/IngredientCard.jsx` — props: `lens`, `pairings`, `sharedIds`; renders ingredient name as a link to `/ingredient/:id` (opens new tab); lists pairings grouped by strength (Holy Grail → Essential → Highly Recommended → Recommended); highlights shared pairings; each pairing row is clickable and calls `onPairingClick(pairing)`
- `flavor-bible/app/src/components/PairingDetailDrawer.jsx` — props: `pairing`, `onClose`; renders as a side drawer; shows strength label, modifier, quote/tip, taste/season metadata; includes link to `/ingredient/:id` in new tab; dismissed on close button or outside click
- `flavor-bible/app/src/components/PrintExportButton.jsx` — on click calls `window.print()`; add a `@media print` block in a `BoardView.css` file that hides all chrome and renders cards cleanly

Use the same visual language as the mockup (Georgia serif font, warm cream palette, gold/orange/green strength colors).

---

## Phase 5 — Header, SearchBar, ViewToggle, FilterPanel

**Task:** Refer to the component model in `flavor-bible/docs/task_component_model.md`. Implement the header and filter components.

Implement the following files:
- `flavor-bible/app/src/components/Header.jsx` — horizontal bar with logo ("Flavor Bible Explorer"), `SearchBar`, `ViewToggle`, and a strength legend (Essential / Holy Grail / Highly Recommended / Recommended with color dots)
- `flavor-bible/app/src/components/SearchBar.jsx` and `SearchDropdown.jsx` — reads `lenses` from store; filters `FLAVORS.index` on input (≥2 chars, partial match, excludes active lenses); on selection calls `addLens(id)`; on Escape closes dropdown; on Enter selects first result; outside click closes dropdown
- `flavor-bible/app/src/components/ViewToggle.jsx` — reads `activeView` from store; on toggle calls `setActiveView`; renders as a two-option segmented control ("Lens" / "Board")
- `flavor-bible/app/src/components/FilterPanel.jsx` and its four children (`CuisineFilter.jsx`, `SeasonFilter.jsx`, `TasteFilter.jsx`, `VisibilityFilter.jsx`) — reads and writes `filters` from store; `CuisineFilter` derives available cuisines from `FLAVORS.index`; all filters are multi-select toggles except `VisibilityFilter` which is a three-way segmented control (All / Shared / Individual); "Clear all" resets to defaults

---

## Phase 6 — IngredientProfilePage and DetailCard

**Task:** Refer to the component model in `flavor-bible/docs/task_component_model.md`. Implement the ingredient profile page and the detail card overlay.

Implement the following files:
- `flavor-bible/app/src/pages/IngredientProfilePage.jsx` — reads `:id` from route params; looks up `FLAVORS.ingredients[id]`; renders all data: label, meta (taste/weight/volume/season), full pairing list sorted by strength descending, all quotes with attribution, all tips, all affinities; clean self-contained layout with print stylesheet; graceful not-found state if id is invalid; no store dependency
- `flavor-bible/app/src/components/DetailCard.jsx` — props: `bubble`, `onClose`, `onPromote(id)`; renders as a floating card positioned near the clicked bubble; shows strength label, modifier, quote/tip from `FLAVORS.ingredients`, taste/season metadata; "Open full profile" link to `/ingredient/:id` in new tab; dismissed on X or outside click; position clamped to screen space (accounting for pan/zoom transform)

Once all six phases are complete, update `ExplorerPage.jsx` to compose all components: render `Header`, `FilterPanel`, `LensCanvas` or `BoardView` based on `activeView`, and `DetailCard` overlay. Wire `onBubbleClick` from `LensCanvas` to show/hide `DetailCard`. On mount, read `location.hash` and call `deserializeHash` to restore state. On state change, call `serializeHash` and `history.replaceState` (debounced).
