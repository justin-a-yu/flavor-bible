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

| Route | Component | Description |
|---|---|---|
| `/` | `ExplorerPage` | Main exploration view (lens or board) |
| `/ingredient/:id` | `IngredientProfilePage` | Full ingredient profile, deep-linkable |

URL hash on `/` encodes session state: `#@panX,panY,zoom;id:x,y,r,seed;...`

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
    cuisines: string[],        // selected cuisine/region slugs
    seasons: string[],         // 'spring' | 'summer' | 'autumn' | 'winter'
    tastes: string[],          // 'sweet' | 'sour' | 'bitter' | 'umami' | 'salty'
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
  x: number,          // canvas world position
  y: number,
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
  meta: { taste, weight, volume, season },
  pairings: [{ id, label, strength, modifier? }],
  quotes: [{ text, attribution }],
  tips: string[],
  affinities: string[],
  cuisines: string[],
}
```

---

## 5. Component Catalogue

---

### `App`

**Responsibility:** Root component. Sets up routing and initializes state from URL hash on mount.

**Attributes:**
- No props

**Behaviors:**
- On mount: reads `location.hash`, calls `loadFromHash()` to restore session
- Renders `<Router>` with routes for `ExplorerPage` and `IngredientProfilePage`

---

### `ExplorerPage`

**Responsibility:** Top-level page for the exploration experience. Composes all exploration UI.

**Attributes:**
- No props; reads everything from Zustand store

**Behaviors:**
- Renders `Header`, `FilterPanel`, and either `LensCanvas` or `BoardView` based on `activeView`
- Renders `DetailCard` (always mounted, conditionally visible)
- Subscribes to viewport and lens state for URL hash sync on change (debounced `history.replaceState`)

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

**Responsibility:** Ingredient search input with autocomplete dropdown. Always accessible.

**Attributes:**
- No props; reads `lenses` from store to exclude already-active ingredients

**Behaviors:**
- On input (≥2 chars): filters `FLAVORS.index` by partial name match, excludes active lens ids, shows `SearchDropdown`
- On selection: calls `addLens(id)`
- On Escape: closes dropdown
- On Enter: selects first result

**Child components:**
- `SearchDropdown` — the suggestion list rendered below the input

---

### `SearchDropdown`

**Responsibility:** Renders filtered ingredient suggestions below the search input.

**Attributes:**
- `items: { id, label }[]` — filtered suggestions
- `onSelect: (id) => void`

**Behaviors:**
- Renders up to 10 items
- On item click: calls `onSelect(id)`, closes dropdown
- Dismissed on outside click

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

**Responsibility:** Collapsible side panel exposing all filter controls.

**Attributes:**
- No props; reads and writes `filters` from store

**Child components:**
- `CuisineFilter`
- `SeasonFilter`
- `TasteFilter`
- `VisibilityFilter`

**Behaviors:**
- On any filter change: calls `setFilter(key, value)`
- "Clear all" button calls `clearFilters()`
- Filter state persists when switching between lens and board view

---

### `CuisineFilter`

**Responsibility:** Multi-select list of cuisine/region options.

**Attributes:**
- `selected: string[]`
- `onChange: (cuisines: string[]) => void`

**Behaviors:**
- Renders all available cuisines derived from `FLAVORS.index`
- Toggle-selects individual cuisines
- Selecting none = show all

---

### `SeasonFilter`

**Responsibility:** Season selector (Spring / Summer / Autumn / Winter).

**Attributes:**
- `selected: string[]`
- `onChange: (seasons: string[]) => void`

**Behaviors:**
- Renders four season options as toggle buttons
- Multi-select; selecting none = show all

---

### `TasteFilter`

**Responsibility:** Taste profile selector (sweet / sour / bitter / umami / salty).

**Attributes:**
- `selected: string[]`
- `onChange: (tastes: string[]) => void`

**Behaviors:**
- Renders five taste options as toggle buttons
- Multi-select (OR logic); selecting none = show all

---

### `VisibilityFilter`

**Responsibility:** Toggle between All / Shared only / Individual only pairings.

**Attributes:**
- `value: 'all' | 'shared' | 'individual'`
- `onChange: (value) => void`

**Behaviors:**
- Renders three options as a segmented control
- On change: updates store filter

---

### `LensCanvas`

**Responsibility:** Full-canvas physics simulation of lens and bubble interaction. The core exploration view.

**Attributes:**
- No props; reads `lenses`, `filters`, `viewport` from store

**Behaviors:**
- Mounts a `<canvas>` element via `useRef`
- Runs physics loop via `requestAnimationFrame` in `useEffect`
- On lens drag-end: calls `updateLens(id, { x, y })`; triggers URL hash save
- On scroll over lens: calls `updateLens(id, { r })`; triggers URL hash save (debounced)
- On Space+drag: calls `setViewport({ panX, panY })`
- On Space+scroll: calls `setViewport({ zoom })`, centered on cursor
- On R key over hovered lens: calls `updateLens(id, { seed: newSeed })`
- On bubble single-click: opens `DetailCard` for that pairing
- On bubble double-click: calls `addLens(id)` to promote pairing to new lens
- On lens label click: opens `/ingredient/:id` in new tab
- Applies active filters to determine which bubbles are visible/faded
- Translates all drawing by `viewport.panX/Y` and scales by `viewport.zoom`
- Rebuilds bubble layout when `lenses` or `filters` change

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

**Responsibility:** Triggers print or PDF export of the board view.

**Attributes:**
- No props

**Behaviors:**
- On click: calls `window.print()`
- A `@media print` stylesheet hides all chrome (header, filter panel, buttons) and makes cards full-width and clean
- Alternatively can use a library (e.g. `react-to-print`) to target only the board content node

---

### `IngredientProfilePage`

**Responsibility:** Full-page profile for a single ingredient. Opened in a new tab from lens or board view.

**Attributes:**
- Reads `id` from route params (`/ingredient/:id`)

**Behaviors:**
- Looks up ingredient from `FLAVORS.ingredients[id]`
- Renders all available data: label, meta (taste/weight/volume/season), full pairing list with strengths, all quotes with attribution, all tips, all affinities
- Pairing list sorted by strength descending
- Page is self-contained — no store dependency, no header navigation
- Clean printable layout (print stylesheet strips any non-content chrome)
- If `id` not found: renders a graceful not-found message
- **Could Have:** Displays a photo of the ingredient (Story 4.3a) — fetched from a public image API (e.g. Unsplash) or served from a local assets folder

---

## 6. Component Interaction Map

```
App
├── Router
│   ├── ExplorerPage  [reads: lenses, activeView, filters, viewport]
│   │   ├── Header
│   │   │   ├── SearchBar  [reads: lenses] [writes: addLens]
│   │   │   │   └── SearchDropdown
│   │   │   ├── ViewToggle  [reads: activeView] [writes: setActiveView]
│   │   │   └── Legend
│   │   ├── FilterPanel  [reads: filters] [writes: setFilter, clearFilters]
│   │   │   ├── CuisineFilter
│   │   │   ├── SeasonFilter
│   │   │   ├── TasteFilter
│   │   │   └── VisibilityFilter
│   │   ├── LensCanvas (when activeView='lens')
│   │   │   [reads: lenses, filters, viewport]
│   │   │   [writes: updateLens, addLens, setViewport]
│   │   │   [opens: DetailCard, /ingredient/:id tab]
│   │   ├── BoardView (when activeView='board')
│   │   │   [reads: lenses, filters]
│   │   │   ├── IngredientCard (×N)
│   │   │   │   [opens: /ingredient/:id tab, PairingDetailDrawer]
│   │   │   ├── PairingDetailDrawer
│   │   │   └── PrintExportButton
│   │   └── DetailCard (lens view overlay)
│   │       [opens: /ingredient/:id tab]
│   │       [writes: addLens (promote)]
│   │
│   └── IngredientProfilePage  [reads: route param :id → FLAVORS.ingredients]
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
| 1.1 Start from single ingredient | `SearchBar`, `SearchDropdown`, `LensCanvas` |
| 1.2 Add second ingredient | `SearchBar`, `LensCanvas` |
| 1.3 Promote pairing to lens | `LensCanvas`, `DetailCard` |
| 1.4 Resize lens | `LensCanvas` |
| 1.5 Reshuffle pairings | `LensCanvas` |
| 1.6 Pan and zoom | `LensCanvas` |
| 2.1 Switch to board view | `ViewToggle`, `ExplorerPage` |
| 2.2 Browse as cards | `BoardView`, `IngredientCard` |
| 2.3 Print or export board view | `PrintExportButton`, print stylesheet |
| 3.1 Filter by cuisine | `FilterPanel`, `CuisineFilter`, `LensCanvas`, `BoardView` |
| 3.2 Filter by season | `FilterPanel`, `SeasonFilter`, `LensCanvas`, `BoardView` |
| 3.3 Filter by taste profile | `FilterPanel`, `TasteFilter`, `LensCanvas`, `BoardView` |
| 3.4 Filter shared/individual | `FilterPanel`, `VisibilityFilter`, `LensCanvas`, `BoardView` |
| 4.1 Pairing detail on click | `DetailCard`, `PairingDetailDrawer` |
| 4.2 Top pairings in detail panel | `DetailCard`, `PairingDetailDrawer` |
| 4.3 Full ingredient profile page | `IngredientProfilePage`, `IngredientCard`, `LensCanvas` |
| 4.3a Ingredient photo (Could Have) | `IngredientProfilePage` |
| 5.1 Search by name | `SearchBar`, `SearchDropdown` |
| 6.1 Restore from URL | `App` (on mount), `ExplorerPage` (on change) |
