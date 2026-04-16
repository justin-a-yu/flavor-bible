/**
 * filterUtils.js
 * Pure helpers for the filter system.
 *
 * REGIONS — maps display label → array of cuisine slugs that belong to it.
 *   Used to build the region filter UI and to resolve which cuisine slugs
 *   to check against ingredient.cuisines[].
 *
 * matchesFilters(ingredient, filters)
 *   Returns true when the ingredient passes ALL active filter dimensions.
 *   Empty arrays / 'all' visibility are treated as no-op (pass everything).
 *   Used by both LensCanvas and BoardView so the two views stay in sync.
 *
 * hasActiveFilters(filters) — true when any dimension is narrowing results
 * activeFilterCount(filters) — count of active dimensions (for badge)
 */

// ── Regional cuisine groupings ────────────────────────────────────────────────
// Each key is the display label; values are all cuisine slugs that belong.
// Slugs with 0 tagged ingredients are included so alias variants still match.

export const REGIONS = {
  'Europe': [
    'french-cuisine', 'french-cuisine-in-general', 'french-basque-cuisine',
    'provencal-cuisine', 'provencal-cuisine-french', 'alsatian-cuisine',
    'italian-cuisine', 'italian-cuisine-in-general', 'italian-cuisine-as-garbanzo-beans',
    'spanish-cuisine', 'spanish-basque-cuisine', 'spanish-cuisine-quince-paste',
    'portuguese-cuisine',
    'greek-cuisine',
    'mediterranean-cuisine', 'mediterranean-cuisines', 'mediterreanean-cuisine',
    'eastern-mediterranean-cuisine',
    'german-cuisine', 'austrian-cuisine', 'swiss-cuisine', 'belgian-cuisine',
    'english-cuisine', 'british-cuisine', 'irish-cuisine',
    'scandinavian-cuisine',
    'eastern-european-cuisine', 'eastern-european-cuisines',
    'hungarian-cuisine', 'polish-cuisine', 'russian-cuisine',
    'georgian-cuisine',
    'european-cuisine', 'european-cuisines',
  ],
  'Americas': [
    'american-cuisine', 'north-american-cuisine',
    'southern-cuisine', 'southern-cuisine-american',
    'southwestern-cuisine', 'southwestern-american-cuisine',
    'midwestern-american-cuisine', 'new-england-cuisine',
    'cajun-cuisine', 'cajun-creole-cuisines', 'creole-cuisine', 'soul-food-cuisine',
    'tex-mex-cuisine',
    'canadian-cuisine',
    'mexican-cuisine',
    'latin-american-cuisine', 'latin-american-cuisines',
    'south-american-cuisine', 'central-american-cuisine',
    'caribbean-cuisine', 'caribbean-cuisines', 'carribbean-cuisine',
    'west-indian-cuisine', 'west-indies-cuisine',
    'cuban-cuisine', 'jamaican-cuisine',
    'argentinian-cuisine', 'chilean-cuisine', 'brazilian-cuisine',
    'hawaiian-cuisine',
  ],
  'Middle East & N. Africa': [
    'middle-eastern-cuisine', 'middle-eastern-cuisines',
    'moroccan-cuisine',
    'north-african-cuisine', 'african-north-cuisine',
    'iranian-cuisine',
    'turkish-cuisine',
    'arabic-cuisine', 'lebanese-cuisine', 'egyptian-cuisine',
    'eastern-mediterranean-cuisine',
    'french-southern-italian-middle-eastern-moroccan-cuisine',
  ],
  'Africa': [
    'african-cuisine',
    'ethiopian-cuisine',
  ],
  'South & SE Asia': [
    'indian-cuisine', 'indian-cuisine-desserts', 'pakistani-cuisine', 'sri-lankan-cuisine',
    'southeast-asian-cuisine', 'southeast-asian-cuisine-as-cassia', 'southeast-asian-cuisines',
    'indonesian-cuisine', 'malaysian-cuisine',
    'thai-cuisine', 'vietnamese-cuisine', 'cambodian-cuisine', 'burmese-cuisine',
    'asian-cuisine', 'asian-cuisines',
    'australian-cuisine',
  ],
  'East Asia': [
    'chinese-cuisine', 'east-asian-cuisine',
    'japanese-cuisine', 'japanese-cuisine-say-some',
    'korean-cuisine',
    'szechuan-cuisine',
    'tibetan-cuisine',
    'afghan-cuisine',
  ],
};

/**
 * Expand selected region labels into the full set of cuisine slugs they cover.
 * Returns a Set for O(1) lookup.
 */
export function regionsToCuisineSlugs(regions) {
  const slugs = new Set();
  regions.forEach(r => {
    (REGIONS[r] ?? []).forEach(s => slugs.add(s));
  });
  return slugs;
}

// ── Filter predicate ──────────────────────────────────────────────────────────

/**
 * @param {object} ingredient - entry from FLAVORS.ingredients
 * @param {object} filters    - from useExplorerStore
 */
export function matchesFilters(ingredient, filters) {
  if (!ingredient) return false;

  const { regions = [], cuisines = [], seasons = [], tastes = [] } = filters;
  const ingCuisines = ingredient.cuisines ?? [];

  // Region — OR logic: ingredient must belong to at least one selected region
  if (regions.length > 0) {
    const allowedSlugs = regionsToCuisineSlugs(regions);
    if (!ingCuisines.some(c => allowedSlugs.has(c))) return false;
  }

  // Cuisine — OR logic: ingredient.cuisines[] must intersect the selected set
  if (cuisines.length > 0) {
    if (!cuisines.some(c => ingCuisines.includes(c))) return false;
  }

  // Season — OR logic: meta.season string must contain at least one selected value
  if (seasons.length > 0) {
    const ingSeason = ingredient.meta?.season?.toLowerCase() ?? '';
    if (!seasons.some(s => ingSeason.includes(s.toLowerCase()))) return false;
  }

  // Taste — OR logic: meta.taste string must contain at least one selected value
  if (tastes.length > 0) {
    const ingTaste = ingredient.meta?.taste?.toLowerCase() ?? '';
    if (!tastes.some(t => ingTaste.includes(t.toLowerCase()))) return false;
  }

  return true;
}

/** True when any filter dimension is actively narrowing results. */
export function hasActiveFilters(filters) {
  return (
    (filters.regions?.length   > 0) ||
    (filters.cuisines?.length  > 0) ||
    (filters.seasons?.length   > 0) ||
    (filters.tastes?.length    > 0) ||
    (filters.visibility !== 'all')
  );
}

/** Number of active filter dimensions (used for badge count). */
export function activeFilterCount(filters) {
  let n = 0;
  if (filters.regions?.length   > 0) n++;
  if (filters.cuisines?.length  > 0) n++;
  if (filters.seasons?.length   > 0) n++;
  if (filters.tastes?.length    > 0) n++;
  if (filters.visibility !== 'all')  n++;
  return n;
}
