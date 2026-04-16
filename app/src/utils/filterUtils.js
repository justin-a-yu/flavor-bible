/**
 * filterUtils.js
 * Pure helpers for the filter system.
 *
 * matchesFilters(ingredient, filters)
 *   Returns true when the ingredient passes ALL active filter dimensions.
 *   Empty arrays / 'all' visibility are treated as no-op (pass everything).
 *   Used by both LensCanvas and BoardView so the two views stay in sync.
 *
 * hasActiveFilters(filters) — true when any dimension is narrowing results
 * activeFilterCount(filters) — count of active dimensions (for badge)
 */

/**
 * @param {object} ingredient - entry from FLAVORS.ingredients
 * @param {object} filters    - from useExplorerStore
 */
export function matchesFilters(ingredient, filters) {
  if (!ingredient) return false;

  const { cuisines = [], seasons = [], tastes = [] } = filters;

  // Cuisine — OR logic: ingredient.cuisines[] must intersect the selected set
  if (cuisines.length > 0) {
    const ingCuisines = ingredient.cuisines ?? [];
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
    (filters.cuisines?.length  > 0) ||
    (filters.seasons?.length   > 0) ||
    (filters.tastes?.length    > 0) ||
    (filters.visibility !== 'all')
  );
}

/** Number of active filter dimensions (used for badge count). */
export function activeFilterCount(filters) {
  let n = 0;
  if (filters.cuisines?.length  > 0) n++;
  if (filters.seasons?.length   > 0) n++;
  if (filters.tastes?.length    > 0) n++;
  if (filters.visibility !== 'all')  n++;
  return n;
}
