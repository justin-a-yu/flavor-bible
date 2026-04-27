import { create } from 'zustand';
import { FLAVORS } from '../data/flavors_data';
import { LENS_COLORS } from '../utils/boardUtils';

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
  lenses:      [],
  activeView:  'lens',
  filters:     { ...DEFAULT_FILTERS },
  viewport:    { ...DEFAULT_VIEWPORT },
  explodeMode: false,

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

  // ── Explode mode ──────────────────────────────────────────────────────

  toggleExplodeMode() {
    set(s => ({ explodeMode: !s.explodeMode }));
  },

  // ── State restore ─────────────────────────────────────────────────────

  loadFromHash(state) {
    if (!state) return;
    set(state);
  },
}));

export default useExplorerStore;

// ── URL state utilities (exported standalone) ──────────────────────────────
//
// State lives in query params so it can be bookmarked and shared.
// Format: /?lenses=id:x,y,r,seed~id2:x,y,r,seed&vp=panX,panY,zoom
//         &v=board&seasons=spring,summer&tastes=sweet&strengths=3,4
//         &regions=french&vis=shared

export function serializeParams({ lenses, viewport, activeView, filters }) {
  if (!lenses || lenses.length === 0) return '';
  const p = new URLSearchParams();
  p.set('lenses', lenses.map(l =>
    `${l.id}:${Math.round(l.x)},${Math.round(l.y)},${Math.round(l.r)},${l.seed}`
  ).join('~'));
  p.set('vp', `${Math.round(viewport.panX)},${Math.round(viewport.panY)},${viewport.zoom.toFixed(3)}`);
  if (activeView && activeView !== 'lens') p.set('v', activeView);
  if (filters?.seasons?.length)    p.set('seasons',   filters.seasons.join(','));
  if (filters?.tastes?.length)     p.set('tastes',    filters.tastes.join(','));
  if (filters?.strengths?.length)  p.set('strengths', filters.strengths.join(','));
  if (filters?.regions?.length)    p.set('regions',   filters.regions.join(','));
  if (filters?.visibility && filters.visibility !== 'all') p.set('vis', filters.visibility);
  return `/?${p.toString()}`;
}

export function deserializeParams(searchParams) {
  const lensesStr = searchParams.get('lenses');
  if (!lensesStr) return null;

  const lenses = [];
  for (const part of lensesStr.split('~')) {
    const colonIdx = part.indexOf(':');
    if (colonIdx === -1) continue;
    const id   = part.slice(0, colonIdx);
    const nums = part.slice(colonIdx + 1).split(',').map(Number);
    if (nums.length < 4 || !FLAVORS.ingredients[id]) continue;
    const [x, y, r, seed] = nums;
    const ing = FLAVORS.ingredients[id];
    lenses.push({
      id, label: ing.label,
      color: LENS_COLORS[lenses.length % LENS_COLORS.length],
      x, y, r: Math.max(80, r), seed,
    });
  }
  if (lenses.length === 0) return null;

  const viewport = { ...DEFAULT_VIEWPORT };
  const vpStr = searchParams.get('vp');
  if (vpStr) {
    const [px, py, pz] = vpStr.split(',').map(Number);
    if (!isNaN(px)) viewport.panX = px;
    if (!isNaN(py)) viewport.panY = py;
    if (!isNaN(pz) && pz > 0) viewport.zoom = pz;
  }

  const activeView = searchParams.get('v') || 'lens';

  const filters = { ...DEFAULT_FILTERS };
  const seasons   = searchParams.get('seasons');   if (seasons)   filters.seasons   = seasons.split(',').filter(Boolean);
  const tastes    = searchParams.get('tastes');    if (tastes)    filters.tastes    = tastes.split(',').filter(Boolean);
  const strengths = searchParams.get('strengths'); if (strengths) filters.strengths = strengths.split(',').map(Number).filter(Boolean);
  const regions   = searchParams.get('regions');   if (regions)   filters.regions   = regions.split(',').filter(Boolean);
  const vis       = searchParams.get('vis');       if (vis)       filters.visibility = vis;

  return { lenses, viewport, activeView, filters };
}
