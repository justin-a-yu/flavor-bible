# Flavor Bible Explorer

An interactive tool for exploring flavor pairings from *The Flavor Bible* by Karen Page & Andrew Dornenburg. Add ingredients as overlapping "lenses" to see shared pairings, or switch to a structured board view with a print-ready export.

## Tech stack

- **React 18** + **Vite** — fast dev server and production build
- **React Router v6** (HashRouter) — client-side routing with `/#/` prefix for static hosting
- **Zustand** — global store for lenses, filters, and viewport
- **Fuse.js** — fuzzy ingredient search in the header
- **Canvas API** — physics-based lens and bubble rendering in lens view

## Project structure

```
app/
  src/
    components/
      LensCanvas.jsx        # Canvas physics simulation (lens view)
      BoardView.jsx         # Card grid (board view)
      BoardView.css
      FilterPanel.jsx       # Collapsible filter panel (regions, seasons, tastes, strengths, overlap)
      PrintExportButton.jsx # Opens /print in a new tab
    pages/
      ExplorerPage.jsx      # Main page: header, search, view toggle, URL sync
      IngredientProfilePage.jsx  # Full ingredient profile at /ingredient/:id
      IngredientProfilePage.css
      PrintPage.jsx         # Print-ready board view at /print
      PrintPage.css
    store/
      useExplorerStore.js   # Zustand store + hash serialization
    utils/
      boardUtils.js         # Shared pairing/affinity logic (board + print)
      filterUtils.js        # matchesFilters, hasActiveFilters, activeFilterCount
    data/
      flavors_data.js       # Static ingredient data (ingredients + index)
    App.jsx                 # Router setup
    main.jsx
  index.html
  package.json
```

## Running locally

```bash
npm install
npm run dev
```

## Routes

| Route | Component | Notes |
|---|---|---|
| `/#/` | `ExplorerPage` | Main app — lens or board view |
| `/#/ingredient/:id` | `IngredientProfilePage` | Full ingredient profile |
| `/#/print` | `PrintPage` | Print-ready layout; opened in new tab by PrintExportButton |

## URL state

The `/#/` route encodes session state in the hash:

```
#@panX,panY,zoom;id:x,y,r,seed;id2:x,y,r,seed
```

Lens positions, sizes, and viewport are preserved and shareable. Filters and active view are not encoded (they are transient session preferences).

## Filters

Filters apply consistently across both lens view (LensCanvas) and board view (BoardView). Available filter dimensions:

- **Regions** — culinary region/cuisine of each pairing
- **Seasons** — spring / summer / autumn / winter
- **Tastes** — sweet / sour / bitter / umami / salty
- **Strengths** — Recommended / Highly Recommended / Essential / Holy Grail
- **Overlap** — All / Shared / Individual pairings

## Building for production

```bash
npm run build
```

Output goes to `dist/`. Deploy as a static site — no server required (HashRouter handles routing).
