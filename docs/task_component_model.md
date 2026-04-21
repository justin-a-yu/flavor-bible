# Component Model — Flavor Bible Explorer

## 1. Structural Layers

```
┌─────────────────────────────────────────────────┐
│                  Routing Layer                  │
│         React Router — page-level routing       │
├─────────────────────────────────────────────────┤
│                   Page Layer                    │
│     ExplorerPage  │  IngredientProfilePage      │
├─────────────────────────────────────────────────┤
│                   UI Layer                      │
│  Header │ SearchBar │ LensCanvas │ BoardView    │
│  FilterPanel │ DetailCard │ ViewToggle          │
├─────────────────────────────────────────────────┤
│                  State Layer                    │
│         Zustand store (useExplorerStore)        │
├─────────────────────────────────────────────────┤
│                   Data Layer                    │
│     flavors_data.js — static JSON, imported     │
│     once at app start, never mutated            │
└─────────────────────────────────────────────────┘
```

---

## 2. Routing

Uses **HashRouter** (`/#/` prefix) so the app works on static hosts without server-side fallback.

| Route | Component | Description |
|---|---|---|
| `/#/` | `ExplorerPage` | Main exploration view (lens or board) |
| `/#/ingredient/:id` | `IngredientProfilePage` | Full ingredient profile, deep-linkable |
| `/#/print` | `PrintPage` | Print-ready layout; opened in new tab by PrintExportButton |

URL hash on `/#/` encodes session state: `#@panX,panY,zoom;id:x,y,r,seed;...`

---

## 3. Global State (Zustand — `useExplorerStore`)

### State shape

```
{
  // Active lenses
  lenses: Lens[],              // ordered list of active ingredient lenses

  // View
  activeView: 'lens' | 'board',

  // Filters
  filters: {
    cuisines: string[],        // selected cuisine/region slugs (unused in UI; kept for future)
    regions: string[],         // culinary regions derived from pairing metadata
    seasons: string[],         // 'spring' | 'summer' | 'autumn' | 'winter'
    tastes: string[],          // 'sweet' | 'sour' | 'bitter' | 'umami' | 'salty'
    strengths: number[],       // 1 | 2 | 3 | 4 (Recommended → Holy Grail)
    visibility: 'all' | 'shared' | 'individual',
  },

  // Viewport (lens view only)
  viewport: {
    panX: number,
    panY: number,
    zoom: number,
  },
}
```

### Lens shape

```
{
  id: string,          // ingredient id (e.g. 'garlic')
  label: string,
  color: string,       // assigned from palette
  x: number | null,   // canvas world position; null until placed by heuristic
  y: number | null,
  r: number,           // radius (no cap)
  seed: number,        // randomization seed for pairing selection
}
```

### Actions

| Action | Description |
|---|---|
| `addLens(id)` | Add ingredient as a new lens; spawn at canvas center |
| `removeLens(id)` | Remove lens and rebuild bubbles |
| `updateLens(id, patch)` | Update x, y, r, or seed on a lens |
| `setActiveView(view)` | Switch between 'lens' and 'board' |
| `setFilter(key, value)` | Update a filter field |
| `clearFilters()` | Reset all filters to defaults |
| `setViewport(patch)` | Update panX, panY, or zoom |
| `loadFromHash(hash)` | Parse URL hash and restore full state |
| `toHash()` | Serialize current state to URL hash string |

---

## 4. Data Layer

- Source: `flavors_data.js` — static JS module exporting `FLAVORS.ingredients` (keyed object) and `FLAVORS.index` (array for search)
- Imported once at app start, stored in a module-level constant, never held in Zustand
- Components access it directly via import — no fetching, no async

### Ingredient shape (reference)

```
{
  id: string,
  label: string,
  meta: {
    taste, weight, volume, season, function,
    techniques,              // comma-separated string
    'botanical relatives',   // comma-separated string
  },
  pairings:   [{ id, label, strength, modifier? }],
  quotes:     [{ text, attribution }],
  tips:       string[],
  affinities: string[],
  avoids:     [{ id, label, modifier? }],
  notes:      string[],        // free-form prose paragraphs
  dishes:     [{ text, attribution }],
  cuisines:   string[],
}
```

---

## 5. Component Catalogue

---

### `App`

**Responsibility:** Root component. Sets up routing.

**Attributes:**
- No props

**Behaviors:**
- Renders `<HashRouter>` with routes for `ExplorerPage`, `IngredientProfilePage`, and `PrintPage`
- State restoration from URL hash is handled by `ExplorerPage` on mount

---

### `ExplorerPage`

**Responsibility:** Top-level page for the exploration experience. Composes all exploration UI.

**Attributes:**
- No props; reads everything from Zustand store

**Behaviors:**
- On mount: reads `window.location.hash`, calls `loadFromHash()` to restore session
- Always-on store subscriber: whenever `lenses` or `viewport` change, debounces `history.replaceState` to write URL hash. This runs regardless of active view (lens or board), so URLs stay current when adding ingredients from board view.
- Renders header (logo, `SearchBar`, `LensPills`, `ViewToggle`, `FilterPanel`, legend), then either `LensCanvas` or `BoardView` based on `activeView`
- Renders `DetailCard` overlay (lens view only) and a hint bar at the bottom

---

### `Header`

**Responsibility:** Top bar containing the logo, `SearchBar`, `ViewToggle`, and legend.

**Attributes:**
- No props

**Behaviors:**
- Renders child components in a horizontal layout
- No direct state ownership

---

### `SearchBar`

**Responsibility:** Ingredient search input with fuzzy autocomplete dropdown. Always accessible.

**Attributes:**
- No props; reads `lenses` from store to exclude already-active ingredients

**Behaviors:**
- Uses **Fuse.js** (`threshold: 0.4, distance: 100`) for fuzzy matching against `FLAVORS.index`
- On input (≥2 chars): runs fuzzy search, excludes active lens ids, shows up to 10 suggestions inline
- On selection: calls `addLens(id)`, clears input
- On Escape: closes dropdown
- On Enter: selects first result
- Suggestions rendered inline (no separate component)

---

### `ViewToggle`

**Responsibility:** Lens / Board toggle control in the header.

**Attributes:**
- No props; reads `activeView` from store

**Behaviors:**
- On toggle: calls `setActiveView()`
- Visual state reflects current active view

---

### `FilterPanel`

**Responsibility:** Collapsible panel exposing all filter controls. All sub-controls are inline (no separate child components).

**Attributes:**
- No props; reads and writes `filters` from store

**Filter rows (in order):**

| Row | Type | Options |
|---|---|---|
| Regions | `ToggleGroup` (multi) | Derived from `REGION_MAP` |
| Seasons | `ToggleGroup` (multi) | Spring / Summer / Autumn / Winter |
| Tastes | `ToggleGroup` (multi) | Sweet / Sour / Bitter / Umami / Salty |
| Strengths | `ToggleGroup` (multi) | Recommended / Highly Recommended / Essential / Holy Grail |
| Overlap | `RadioGroup` (single) | All / Shared / Individual |

**Behaviors:**
- Toggle buttons call `toggleFilter(key, value)`; radio buttons call `setFilter(key, value)`
- "Clear all" button calls `clearFilters()`
- Filter state persists when switching between lens and board view
- All filters apply to both `LensCanvas` (bubble visibility/fade) and `BoardView` (pairing lists)
- Active filter count displayed on the panel toggle button

---

### `LensCanvas`

**Responsibility:** Full-canvas physics simulation of lens and bubble interaction. The core exploration view.

**Attributes:**
- `onBubbleClick: (bubble, clientX, clientY) => void` — called when user clicks a bubble

**Behaviors:**
- Mounts a `<canvas>` element via `useRef`
- Runs physics loop via `requestAnimationFrame` in `useEffect`
- On lens drag-end: calls `updateLens(id, { x, y })`
- On scroll over lens: calls `updateLens(id, { r })`
- On Space+drag: calls `setViewport({ panX, panY })`
- On Space+scroll: calls `setViewport({ zoom })`, centered on cursor
- On R key over hovered lens: calls `updateLens(id, { seed: newSeed })`
- On bubble single-click: calls `onBubbleClick` (ExplorerPage shows DetailCard)
- On bubble double-click: calls `addLens(id)` to promote pairing to new lens
- On lens label click: opens `/#/ingredient/:id` in new tab
- When lens count changes: places newly added lenses (those with `x === null`) at radially spaced positions around the canvas center; existing lenses are not moved
- Applies active filters to determine which bubbles are visible/faded (all filter dimensions including strengths and regions)
- Translates all drawing by `viewport.panX/Y` and scales by `viewport.zoom`
- Rebuilds bubble layout when `lenses` or `filters` change
- **Does not** handle URL sync — that is owned by `ExplorerPage`

**Internal state (React refs, not Zustand):**
- `bubblesRef` — computed bubble physics objects
- `hoveredBubble`, `hoveredLens`, `dragging` — transient interaction state
- `animFrameRef` — animation frame handle

---

### `DetailCard`

**Responsibility:** Floating overlay card showing pairing detail on bubble click. Visible in lens view.

**Attributes:**
- `bubble: Bubble | null` — currently selected bubble; null = hidden
- `onClose: () => void`
- `onPromote: (id) => void` — called on double-click CTA to open as lens

**Behaviors:**
- Renders when `bubble` is not null
- Displays: pairing label, strength label, modifier, quote/tip, taste/season metadata
- Displays top pairings of the pairing ingredient (Could Have — 4.2)
- "Open full profile" link navigates to `/ingredient/:id` in new tab (Story 4.3)
- Positioned near the clicked bubble, clamped to viewport in screen space
- Dismissed on X click or outside click

---

### `BoardView`

**Responsibility:** Structured card grid showing all active ingredients and their pairings.

**Attributes:**
- No props; reads `lenses`, `filters` from store

**Behaviors:**
- Renders one `IngredientCard` per active lens
- Applies active filters to pairing lists before passing to cards
- Highlights pairings shared across multiple active lenses
- Renders `PrintExportButton`

**Child components:**
- `IngredientCard`
- `PrintExportButton`

---

### `IngredientCard`

**Responsibility:** Card displaying one ingredient and its filtered pairing list in board view.

**Attributes:**
- `lens: Lens` — the active lens this card represents
- `pairings: Pairing[]` — filtered and sorted pairing list
- `sharedIds: string[]` — pairing ids shared with other active lenses

**Behaviors:**
- Renders ingredient name as a clickable link → opens `/ingredient/:id` in new tab (Story 4.3)
- Lists pairings grouped by strength tier
- Shared pairings are visually highlighted
- Each pairing row is clickable → opens `PairingDetailDrawer` (board view equivalent of DetailCard)
- Pairing list is ordered: Holy Grail → Essential → Highly Recommended → Recommended

---

### `PairingDetailDrawer`

**Responsibility:** Side drawer or modal showing pairing detail when a pairing row is clicked in board view.

**Attributes:**
- `pairing: Pairing | null`
- `onClose: () => void`

**Behaviors:**
- Same content as `DetailCard` but styled for board view context
- "Open full profile" link navigates to `/ingredient/:id` in new tab
- Dismissed on close button or outside click

---

### `PrintExportButton`

**Responsibility:** Opens the print view in a new tab.

**Attributes:**
- No props; reads `lenses` and `filters` from store

**Behaviors:**
- On click: builds `?lenses=id1,id2&seasons=...&tastes=...&visibility=...` query params from current store state, opens `/#/print?{params}` in a new tab
- The `PrintPage` at that URL is self-contained and has its own print button

---

### `PrintPage`

**Responsibility:** Print-ready layout showing profiles, shared pairings, affinities, and per-lens remaining pairings. Always opened in a new tab.

**Attributes:**
- No props; reads state from `?lenses=...&seasons=...` search params

**Sections (in order):**
1. Profile cards (meta, techniques, botanicals, avoids, tips, quotes)
2. Shared Pairings (multi-lens only, respects `visibility` filter)
3. Affinities
4. Remaining Flavors / Pairings (respects `visibility` filter)
5. Filters footer (shown when content filters are active)

**Behaviors:**
- No back button (always a new tab)
- Print button calls `window.print()`
- Uses `buildPairingMap`, `buildSharedGroups`, `buildAffinities`, `buildLensColumns` from `boardUtils.js`

---

### `IngredientProfilePage`

**Responsibility:** Full-page profile for a single ingredient. Opened via `<Link>` from lens, board, or print views.

**Attributes:**
- Reads `id` from route params (`/#/ingredient/:id`)

**Section order:**
1. Header (Back button → `useNavigate(-1)`, Print button)
2. Hero (name, inline meta, techniques chips, botanical relatives chips)
3. Tips
4. Pairings (by strength tier, each chip links to `/ingredient/:id`)
5. Affinities
6. Avoid (chips, styled distinctly)
7. Notes
8. From the book (quotes with attribution)
9. Dishes

**Behaviors:**
- Back button uses `useNavigate(-1)` (React Router) — goes back in browser history
- Botanical relatives that match known ingredient ids are rendered as `<Link>` chips
- Pairing chips that have an id are rendered as `<Link>` chips
- Page is self-contained — no store dependency
- If `id` not found: renders a graceful not-found message

---

## 6. Component Interaction Map

```
App (HashRouter)
├── ExplorerPage  [reads: lenses, activeView, filters, viewport]
│   │             [on mount: loadFromHash]
│   │             [always-on subscriber: history.replaceState on lens/viewport change]
│   ├── Header (inline)
│   │   ├── SearchBar  [reads: lenses] [writes: addLens]  (Fuse.js fuzzy search)
│   │   ├── LensPills  [reads: lenses] [writes: removeLens]
│   │   ├── ViewToggle  [reads: activeView] [writes: setActiveView]
│   │   ├── FilterPanel  [reads: filters] [writes: toggleFilter, setFilter, clearFilters]
│   │   └── Legend (inline)
│   ├── LensCanvas (when activeView='lens')
│   │   [reads: lenses, filters, viewport]
│   │   [writes: updateLens, addLens, setViewport]
│   │   [calls: onBubbleClick prop → ExplorerPage shows DetailCard]
│   ├── BoardView (when activeView='board')
│   │   [reads: lenses, filters]
│   │   ├── IngredientCard (×N)  [opens: /#/ingredient/:id]
│   │   └── PrintExportButton  [opens: /#/print?... in new tab]
│   ├── DetailCard (lens view overlay)  [opens: /#/ingredient/:id]
│   └── HintBar (inline, changes text per activeView)
│
├── IngredientProfilePage  [reads: route param :id → FLAVORS.ingredients]
│   [back: useNavigate(-1)]
│
└── PrintPage  [reads: ?lenses=&seasons=&tastes=&visibility= search params]
    [no store dependency]
```

---

## 7. URL Hash ↔ State Mapping

| Hash segment | State field |
|---|---|
| `@panX,panY,zoom` | `viewport.panX`, `viewport.panY`, `viewport.zoom` |
| `id:x,y,r,seed` (×N, `;` separated) | `lenses[]` |

Filters and active view are **not** persisted in the URL hash (they are transient session preferences). This keeps URLs clean and shareable without over-encoding.

> If in future filters should be shareable, they can be appended as a `?filters=` query param.

---

## 8. Story → Component Coverage

| Story | Components involved |
|---|---|
| 1.1 Start from single ingredient | `SearchBar`, `LensCanvas` |
| 1.2 Add second ingredient | `SearchBar`, `LensCanvas` |
| 1.3 Promote pairing to lens | `LensCanvas`, `DetailCard` |
| 1.4 Resize lens | `LensCanvas` |
| 1.5 Reshuffle pairings | `LensCanvas` |
| 1.6 Pan and zoom | `LensCanvas` |
| 2.1 Switch to board view | `ViewToggle`, `ExplorerPage` |
| 2.2 Browse as cards | `BoardView`, `IngredientCard` |
| 2.3 Print or export board view | `PrintExportButton`, `PrintPage` |
| 3.1 Filter by region | `FilterPanel`, `LensCanvas`, `BoardView` |
| 3.2 Filter by season | `FilterPanel`, `LensCanvas`, `BoardView` |
| 3.3 Filter by taste profile | `FilterPanel`, `LensCanvas`, `BoardView` |
| 3.4 Filter by strength | `FilterPanel`, `LensCanvas`, `BoardView` |
| 3.5 Filter shared/individual (Overlap) | `FilterPanel`, `LensCanvas`, `BoardView`, `PrintPage` |
| 4.1 Pairing detail on click | `DetailCard` |
| 4.3 Full ingredient profile page | `IngredientProfilePage` |
| 5.1 Fuzzy search by name | `SearchBar` (Fuse.js) |
| 6.1 Restore from URL | `ExplorerPage` (on mount + always-on subscriber) |
| 6.2 Add ingredients from board view → updates URL | `BoardView`, `SearchBar`, `ExplorerPage` subscriber |
