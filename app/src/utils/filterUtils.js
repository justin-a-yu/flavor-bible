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

// ── Named cuisine → region mapping ───────────────────────────────────────────
// Single source of truth. Every cuisine slug from the parsed data maps to one
// of the 7 region keys. Alias/variant slugs (typos, sub-labels from the PDF)
// map to the same region as their canonical. REGIONS is derived from this.
//
// CUISINE_LABEL provides a human-readable name for each slug — used by future
// per-cuisine filter UI; canonical slugs get proper names, aliases get the same
// name as the canonical they duplicate.

export const CUISINE_TO_REGION = {
  // ── Europe ──────────────────────────────────────────────────────────────────
  'french-cuisine':                                        'Europe',
  'french-cuisine-in-general':                             'Europe', // alias
  'french-basque-cuisine':                                 'Europe',
  'provencal-cuisine':                                     'Europe',
  'provencal-cuisine-french':                              'Europe', // alias
  'alsatian-cuisine':                                      'Europe',
  'italian-cuisine':                                       'Europe',
  'italian-cuisine-in-general':                            'Europe', // alias
  'italian-cuisine-as-garbanzo-beans':                     'Europe', // alias
  'spanish-cuisine':                                       'Europe',
  'spanish-basque-cuisine':                                'Europe',
  'spanish-cuisine-quince-paste':                          'Europe', // alias
  'portuguese-cuisine':                                    'Europe',
  'greek-cuisine':                                         'Europe',
  'mediterranean-cuisine':                                 'Europe',
  'mediterranean-cuisines':                                'Europe', // alias
  'mediterreanean-cuisine':                                'Europe', // typo alias
  'german-cuisine':                                        'Europe',
  'austrian-cuisine':                                      'Europe',
  'swiss-cuisine':                                         'Europe',
  'belgian-cuisine':                                       'Europe',
  'english-cuisine':                                       'Europe',
  'british-cuisine':                                       'Europe',
  'irish-cuisine':                                         'Europe',
  'scandinavian-cuisine':                                  'Europe',
  'eastern-european-cuisine':                              'Europe',
  'eastern-european-cuisines':                             'Europe', // alias
  'hungarian-cuisine':                                     'Europe',
  'polish-cuisine':                                        'Europe',
  'russian-cuisine':                                       'Europe',
  'georgian-cuisine':                                      'Europe',
  'european-cuisine':                                      'Europe',
  'european-cuisines':                                     'Europe', // alias

  // ── Americas ─────────────────────────────────────────────────────────────────
  'american-cuisine':                                      'Americas',
  'north-american-cuisine':                                'Americas',
  'southern-cuisine':                                      'Americas',
  'southern-cuisine-american':                             'Americas', // alias
  'southwestern-cuisine':                                  'Americas',
  'southwestern-american-cuisine':                         'Americas', // alias
  'midwestern-american-cuisine':                           'Americas',
  'new-england-cuisine':                                   'Americas',
  'cajun-cuisine':                                         'Americas',
  'cajun-creole-cuisines':                                 'Americas', // alias
  'creole-cuisine':                                        'Americas',
  'soul-food-cuisine':                                     'Americas',
  'tex-mex-cuisine':                                       'Americas',
  'canadian-cuisine':                                      'Americas',
  'mexican-cuisine':                                       'Americas',
  'latin-american-cuisine':                                'Americas',
  'latin-american-cuisines':                               'Americas', // alias
  'south-american-cuisine':                                'Americas',
  'central-american-cuisine':                              'Americas',
  'caribbean-cuisine':                                     'Americas',
  'caribbean-cuisines':                                    'Americas', // alias
  'carribbean-cuisine':                                    'Americas', // typo alias
  'west-indian-cuisine':                                   'Americas',
  'west-indies-cuisine':                                   'Americas', // alias
  'cuban-cuisine':                                         'Americas',
  'jamaican-cuisine':                                      'Americas',
  'argentinian-cuisine':                                   'Americas',
  'chilean-cuisine':                                       'Americas',
  'brazilian-cuisine':                                     'Americas',
  'hawaiian-cuisine':                                      'Americas',

  // ── Middle East & N. Africa ──────────────────────────────────────────────────
  'middle-eastern-cuisine':                                'Middle East & N. Africa',
  'middle-eastern-cuisines':                               'Middle East & N. Africa', // alias
  'eastern-mediterranean-cuisine':                         'Middle East & N. Africa',
  'arabic-cuisine':                                        'Middle East & N. Africa',
  'lebanese-cuisine':                                      'Middle East & N. Africa',
  'egyptian-cuisine':                                      'Middle East & N. Africa',
  'iranian-cuisine':                                       'Middle East & N. Africa',
  'turkish-cuisine':                                       'Middle East & N. Africa',
  'moroccan-cuisine':                                      'Middle East & N. Africa',
  'north-african-cuisine':                                 'Middle East & N. Africa',
  'african-north-cuisine':                                 'Middle East & N. Africa', // alias
  'french-southern-italian-middle-eastern-moroccan-cuisine': ['Middle East & N. Africa', 'Europe'], // multi-region catch-all

  // ── Africa ───────────────────────────────────────────────────────────────────
  'african-cuisine':                                       'Africa',
  'ethiopian-cuisine':                                     'Africa',

  // ── South Asia ───────────────────────────────────────────────────────────────
  'indian-cuisine':                                        'South Asia',
  'indian-cuisine-desserts':                               'South Asia', // alias
  'pakistani-cuisine':                                     'South Asia',
  'sri-lankan-cuisine':                                    'South Asia',
  'afghan-cuisine':                                        'South Asia',

  // ── Southeast Asia ───────────────────────────────────────────────────────────
  'southeast-asian-cuisine':                               'Southeast Asia',
  'southeast-asian-cuisines':                              'Southeast Asia', // alias
  'southeast-asian-cuisine-as-cassia':                     'Southeast Asia', // alias
  'indonesian-cuisine':                                    'Southeast Asia',
  'malaysian-cuisine':                                     'Southeast Asia',
  'thai-cuisine':                                          'Southeast Asia',
  'vietnamese-cuisine':                                    'Southeast Asia',
  'cambodian-cuisine':                                     'Southeast Asia',
  'burmese-cuisine':                                       'Southeast Asia',
  'asian-cuisine':                                         'Southeast Asia', // broad catch-all
  'asian-cuisines':                                        'Southeast Asia', // alias
  'australian-cuisine':                                    'Southeast Asia', // closest region available

  // ── East Asia ────────────────────────────────────────────────────────────────
  'chinese-cuisine':                                       'East Asia',
  'east-asian-cuisine':                                    'East Asia',
  'japanese-cuisine':                                      'East Asia',
  'japanese-cuisine-say-some':                             'East Asia', // alias
  'korean-cuisine':                                        'East Asia',
  'szechuan-cuisine':                                      'East Asia',
  'tibetan-cuisine':                                       'East Asia',
};

// Human-readable label for each cuisine slug.
// Alias/variant slugs share the label of their canonical.
export const CUISINE_LABEL = {
  // Europe
  'french-cuisine':                    'French',
  'french-cuisine-in-general':         'French',
  'french-basque-cuisine':             'French Basque',
  'provencal-cuisine':                 'Provençal',
  'provencal-cuisine-french':          'Provençal',
  'alsatian-cuisine':                  'Alsatian',
  'italian-cuisine':                   'Italian',
  'italian-cuisine-in-general':        'Italian',
  'italian-cuisine-as-garbanzo-beans': 'Italian',
  'spanish-cuisine':                   'Spanish',
  'spanish-basque-cuisine':            'Spanish Basque',
  'spanish-cuisine-quince-paste':      'Spanish',
  'portuguese-cuisine':                'Portuguese',
  'greek-cuisine':                     'Greek',
  'mediterranean-cuisine':             'Mediterranean',
  'mediterranean-cuisines':            'Mediterranean',
  'mediterreanean-cuisine':            'Mediterranean',
  'german-cuisine':                    'German',
  'austrian-cuisine':                  'Austrian',
  'swiss-cuisine':                     'Swiss',
  'belgian-cuisine':                   'Belgian',
  'english-cuisine':                   'English',
  'british-cuisine':                   'British',
  'irish-cuisine':                     'Irish',
  'scandinavian-cuisine':              'Scandinavian',
  'eastern-european-cuisine':          'Eastern European',
  'eastern-european-cuisines':         'Eastern European',
  'hungarian-cuisine':                 'Hungarian',
  'polish-cuisine':                    'Polish',
  'russian-cuisine':                   'Russian',
  'georgian-cuisine':                  'Georgian',
  'european-cuisine':                  'European',
  'european-cuisines':                 'European',
  // Americas
  'american-cuisine':                  'American',
  'north-american-cuisine':            'North American',
  'southern-cuisine':                  'Southern (US)',
  'southern-cuisine-american':         'Southern (US)',
  'southwestern-cuisine':              'Southwestern (US)',
  'southwestern-american-cuisine':     'Southwestern (US)',
  'midwestern-american-cuisine':       'Midwestern (US)',
  'new-england-cuisine':               'New England',
  'cajun-cuisine':                     'Cajun',
  'cajun-creole-cuisines':             'Cajun / Creole',
  'creole-cuisine':                    'Creole',
  'soul-food-cuisine':                 'Soul Food',
  'tex-mex-cuisine':                   'Tex-Mex',
  'canadian-cuisine':                  'Canadian',
  'mexican-cuisine':                   'Mexican',
  'latin-american-cuisine':            'Latin American',
  'latin-american-cuisines':           'Latin American',
  'south-american-cuisine':            'South American',
  'central-american-cuisine':          'Central American',
  'caribbean-cuisine':                 'Caribbean',
  'caribbean-cuisines':                'Caribbean',
  'carribbean-cuisine':                'Caribbean',
  'west-indian-cuisine':               'West Indian',
  'west-indies-cuisine':               'West Indian',
  'cuban-cuisine':                     'Cuban',
  'jamaican-cuisine':                  'Jamaican',
  'argentinian-cuisine':               'Argentinian',
  'chilean-cuisine':                   'Chilean',
  'brazilian-cuisine':                 'Brazilian',
  'hawaiian-cuisine':                  'Hawaiian',
  // Middle East & N. Africa
  'middle-eastern-cuisine':            'Middle Eastern',
  'middle-eastern-cuisines':           'Middle Eastern',
  'eastern-mediterranean-cuisine':     'Eastern Mediterranean',
  'arabic-cuisine':                    'Arabic',
  'lebanese-cuisine':                  'Lebanese',
  'egyptian-cuisine':                  'Egyptian',
  'iranian-cuisine':                   'Iranian',
  'turkish-cuisine':                   'Turkish',
  'moroccan-cuisine':                  'Moroccan',
  'north-african-cuisine':             'North African',
  'african-north-cuisine':             'North African',
  'french-southern-italian-middle-eastern-moroccan-cuisine': 'Mediterranean / Middle Eastern',
  // Africa
  'african-cuisine':                   'African',
  'ethiopian-cuisine':                 'Ethiopian',
  // South Asia
  'indian-cuisine':                    'Indian',
  'indian-cuisine-desserts':           'Indian',
  'pakistani-cuisine':                 'Pakistani',
  'sri-lankan-cuisine':                'Sri Lankan',
  'afghan-cuisine':                    'Afghan',
  // Southeast Asia
  'southeast-asian-cuisine':           'Southeast Asian',
  'southeast-asian-cuisines':          'Southeast Asian',
  'southeast-asian-cuisine-as-cassia': 'Southeast Asian',
  'indonesian-cuisine':                'Indonesian',
  'malaysian-cuisine':                 'Malaysian',
  'thai-cuisine':                      'Thai',
  'vietnamese-cuisine':                'Vietnamese',
  'cambodian-cuisine':                 'Cambodian',
  'burmese-cuisine':                   'Burmese',
  'asian-cuisine':                     'Asian',
  'asian-cuisines':                    'Asian',
  'australian-cuisine':                'Australian',
  // East Asia
  'chinese-cuisine':                   'Chinese',
  'east-asian-cuisine':                'East Asian',
  'japanese-cuisine':                  'Japanese',
  'japanese-cuisine-say-some':         'Japanese',
  'korean-cuisine':                    'Korean',
  'szechuan-cuisine':                  'Sichuan',
  'tibetan-cuisine':                   'Tibetan',
};

// Derive REGIONS from CUISINE_TO_REGION — grouped by region for the map filter.
// This replaces the old hand-maintained arrays and stays in sync automatically.
// Values may be a string (single region) or an array (multi-region catch-all slugs).
export const REGIONS = (() => {
  const out = {};
  for (const [slug, region] of Object.entries(CUISINE_TO_REGION)) {
    const regions = Array.isArray(region) ? region : [region];
    for (const r of regions) {
      if (!out[r]) out[r] = [];
      out[r].push(slug);
    }
  }
  return out;
})();

/**
 * Stand-in ingredient used when a pairing has no id or an unresolvable id.
 * Has no cuisine/season/taste metadata, so it behaves as fully "untagged" —
 * passing through when 'untagged' is selected in any dimension, excluded otherwise.
 */
export const EMPTY_ING = { cuisines: [], meta: {} };

/**
 * Expand selected region labels into the full set of cuisine slugs they cover.
 * Returns a Set for O(1) lookup.
 */
function regionsToCuisineSlugs(regions) {
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

  // Region — OR logic: ingredient must belong to at least one selected region.
  // 'untagged' matches ingredients with no cuisine data at all.
  if (regions.length > 0) {
    const includeUntagged = regions.includes('untagged');
    const taggedRegions   = regions.filter(r => r !== 'untagged');
    const allowedSlugs    = regionsToCuisineSlugs(taggedRegions);
    const matchesTagged   = taggedRegions.length > 0 && ingCuisines.some(c => allowedSlugs.has(c));
    const matchesUntagged = includeUntagged && ingCuisines.length === 0;
    if (!matchesTagged && !matchesUntagged) return false;
  }

  // Cuisine — OR logic: ingredient.cuisines[] must intersect the selected set
  if (cuisines.length > 0) {
    if (!cuisines.some(c => ingCuisines.includes(c))) return false;
  }

  // Season — OR logic: meta.season string must contain at least one selected value.
  // 'untagged' matches ingredients with no season metadata.
  if (seasons.length > 0) {
    const includeUntagged = seasons.includes('untagged');
    const taggedSeasons   = seasons.filter(s => s !== 'untagged');
    const ingSeason       = ingredient.meta?.season?.toLowerCase() ?? '';
    const matchesTagged   = taggedSeasons.length > 0 && taggedSeasons.some(s => ingSeason.includes(s.toLowerCase()));
    const matchesUntagged = includeUntagged && !ingSeason;
    if (!matchesTagged && !matchesUntagged) return false;
  }

  // Taste — OR logic: meta.taste string must contain at least one selected value.
  // 'untagged' matches ingredients with no taste metadata.
  if (tastes.length > 0) {
    const includeUntagged = tastes.includes('untagged');
    const taggedTastes    = tastes.filter(t => t !== 'untagged');
    const ingTaste        = ingredient.meta?.taste?.toLowerCase() ?? '';
    const matchesTagged   = taggedTastes.length > 0 && taggedTastes.some(t => ingTaste.includes(t.toLowerCase()));
    const matchesUntagged = includeUntagged && !ingTaste;
    if (!matchesTagged && !matchesUntagged) return false;
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
    (filters.strengths?.length > 0) ||
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
  if (filters.strengths?.length > 0) n++;
  if (filters.visibility !== 'all')  n++;
  return n;
}
