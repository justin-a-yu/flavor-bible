import { create } from 'zustand';
import { FLAVORS } from '../data/flavors_data';

// ── Constants ──────────────────────────────────────────────────────────────
const LENS_COLORS = ['#d4a840', '#c0603a', '#4a8c5c', '#7a5ab8', '#c06080', '#4a7ab8'];

const DEFAULT_FILTERS = {
  regions:    [],
  cuisines:   [],
  seasons:    [],
  tastes:     [],
  strengths:  [], // [] = all; [4,3] = Holy Grail + Essential only
  visibility: 'all', // 'all' | 'shared' | 'individual'
};

const DEFAULT_VIEWPORT = {
  panX: 0,
  panY: 0,
  zoom: 1,
};

// ── Store ──────────────────────────────────────────────────────────────────
const useExplorerStore = create((set, get) => ({
  lenses:     [],
  activeView: 'lens',
  filters:    { ...DEFAULT_FILTERS },
  viewport:   { ...DEFAULT_VIEWPORT },

  // ── Lens actions ──────────────────────────────────────────────────────

  addLens(id) {
    if (!FLAVORS.ingredients[id]) return;
    if (get().lenses.find(l => l.id === id)) return;

    const { lenses } = get();
    const color = LENS_COLORS[lenses.length % LENS_COLORS.length];
    const seed  = Math.floor(Math.random() * 0xffffffff);

    // x/y = null signals LensCanvas to place it at canvas center on first render
    set(state => ({
      lenses: [
        ...state.lenses,
        {
          id,
          label: FLAVORS.ingredients[id].label,
          color,
          x: null,
          y: null,
          r: 160,
          seed,
        },
      ],
    }));
  },

  removeLens(id) {
    set(state => ({ lenses: state.lenses.filter(l => l.id !== id) }));
  },

  updateLens(id, patch) {
    set(state => ({
      lenses: state.lenses.map(l => l.id === id ? { ...l, ...patch } : l),
    }));
  },

  // ── View ─────────────────────────────────────────────────────────────

  setActiveView(view) {
    set({ activeView: view });
  },

  // ── Filters ───────────────────────────────────────────────────────────

  setFilter(key, value) {
    set(state => ({ filters: { ...state.filters, [key]: value } }));
  },

  // Toggle an item in an array-type filter (cuisines, seasons, tastes)
  toggleFilter(key, item) {
    set(state => {
      const current = state.filters[key];
      if (!Array.isArray(current)) return state;
      const next = current.includes(item)
        ? current.filter(v => v !== item)
        : [...current, item];
      return { filters: { ...state.filters, [key]: next } };
    });
  },

  clearFilters() {
    set({ filters: { ...DEFAULT_FILTERS } });
  },

  // ── Viewport ──────────────────────────────────────────────────────────

  setViewport(patch) {
    set(state => ({ viewport: { ...state.viewport, ...patch } }));
  },

  // ── Hash restore ──────────────────────────────────────────────────────

  loadFromHash(hash) {
    const state = deserializeHash(hash);
    if (!state) return;
    set(state);
  },
}));

export default useExplorerStore;

// ── URL hash utilities (exported standalone) ───────────────────────────────

/**
 * serializeHash({ lenses, viewport })
 * → "#@panX,panY,zoom;id:x,y,r,seed;..."
 */
export function serializeHash({ lenses, viewport }) {
  if (!lenses || lenses.length === 0) return '';
  const cam = `@${Math.round(viewport.panX)},${Math.round(viewport.panY)},${viewport.zoom.toFixed(3)}`;
  const parts = lenses.map(l =>
    `${l.id}:${Math.round(l.x)},${Math.round(l.y)},${Math.round(l.r)},${l.seed}`
  );
  return '#' + [cam, ...parts].join(';');
}

/**
 * deserializeHash(hash)
 * Parses the URL hash string and returns a partial store state,
 * or null if the hash is empty/invalid.
 */
export function deserializeHash(hash) {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  if (!raw) return null;

  const viewport = { ...DEFAULT_VIEWPORT };
  const lenses   = [];

  for (const part of raw.split(';')) {
    if (part.startsWith('@')) {
      const [px, py, pz] = part.slice(1).split(',').map(Number);
      if (!isNaN(px)) viewport.panX = px;
      if (!isNaN(py)) viewport.panY = py;
      if (!isNaN(pz) && pz > 0) viewport.zoom = pz;
      continue;
    }

    const colonIdx = part.indexOf(':');
    if (colonIdx === -1) continue;
    const id   = part.slice(0, colonIdx);
    const nums = part.slice(colonIdx + 1).split(',').map(Number);
    if (nums.length < 4 || !FLAVORS.ingredients[id]) continue;

    const [x, y, r, seed] = nums;
    const ing = FLAVORS.ingredients[id];
    lenses.push({
      id,
      label: ing.label,
      color: LENS_COLORS[lenses.length % LENS_COLORS.length],
      x, y,
      r: Math.max(80, r),
      seed,
    });
  }

  if (lenses.length === 0) return null;
  return { lenses, viewport };
}
