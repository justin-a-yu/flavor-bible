import { useSearchParams } from 'react-router-dom';
import { FLAVORS } from '../data/flavors_data';
import { matchesFilters, hasActiveFilters } from '../utils/filterUtils';
import {
  STRENGTH_COLOR, STRENGTH_LABEL, TIER_ORDER,
  buildPairingMap, buildSharedGroups, buildAffinities, buildLensColumns, parseAffinityStr,
} from '../utils/boardUtils';
import './PrintPage.css';

// ─── Constants ────────────────────────────────────────────────────────────────

const LENS_COLORS = ['#d4a840', '#c0603a', '#4a8c5c', '#7a5ab8', '#c06080', '#4a7ab8'];

const CARD_META_KEYS = new Set(['taste', 'weight', 'volume', 'season', 'function']);

// ─── Section components ───────────────────────────────────────────────────────

function ProfileSection({ lenses }) {
  return (
    <section className="pp-section">
      <div className="pp-columns">
        {lenses.map(lens => {
          const ing = FLAVORS.ingredients[lens.id];
          if (!ing) return null;
          const metaEntries = Object.entries(ing.meta ?? {}).filter(([k, v]) => v && CARD_META_KEYS.has(k));
          const techniques  = ing.meta?.techniques?.split(',').map(s => s.trim()).filter(Boolean) ?? [];
          const botanicals  = ing.meta?.['botanical relatives']?.split(',').map(s => s.trim()).filter(Boolean) ?? [];
          const hasBody     = ing.tips.length > 0 || ing.quotes.length > 0;

          return (
            <div key={lens.id} className="pp-profile-card" style={{ borderTopColor: lens.color }}>
              <div className="pp-profile-name" style={{ color: lens.color }}>{lens.label}</div>

              {metaEntries.length > 0 && (
                <div className="pp-meta-row">
                  {metaEntries.map(([key, val]) => (
                    <span key={key} className="pp-meta-item">
                      <span className="pp-meta-key">{key.charAt(0).toUpperCase() + key.slice(1)}:</span>
                      {' '}{val}
                    </span>
                  ))}
                </div>
              )}

              {techniques.length > 0 && (
                <div className="pp-meta-expanded">
                  <span className="pp-meta-key">Techniques:</span>{' '}
                  {techniques.join(', ')}
                </div>
              )}

              {botanicals.length > 0 && (
                <div className="pp-meta-expanded">
                  <span className="pp-meta-key">Botanical relatives:</span>{' '}
                  {botanicals.join(', ')}
                </div>
              )}

              {ing.avoids?.length > 0 && (
                <div className="pp-meta-expanded pp-avoid-row">
                  <span className="pp-meta-key pp-avoid-label">Avoid:</span>{' '}
                  <span className="pp-avoid-list">
                    {ing.avoids.map(a => a.label).join(', ')}
                  </span>
                </div>
              )}

              {hasBody && (
                <div className="pp-profile-body">
                  {ing.tips.length > 0 && (
                    <div className="pp-sub-section">
                      <div className="pp-sub-label">Tips</div>
                      {ing.tips.map((tip, i) => <div key={i} className="pp-tip">{tip}</div>)}
                    </div>
                  )}
                  {ing.quotes.length > 0 && (
                    <div className="pp-sub-section">
                      <div className="pp-sub-label">From the chefs</div>
                      {ing.quotes.map((q, i) => (
                        <div key={i} className="pp-quote">
                          <div className="pp-quote-text">&ldquo;{q.text}&rdquo;</div>
                          {q.attribution && <div className="pp-quote-attr">— {q.attribution}</div>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function SharedSection({ groups }) {
  if (!groups.length) return null;
  return (
    <section className="pp-section">
      <div className="pp-section-label">Shared Pairings</div>
      <div className="pp-shared-groups">
        {groups.map(group => {
          const byTier = TIER_ORDER
            .map(s => ({
              strength: s,
              pairings: group.pairings.filter(p =>
                Math.max(...group.lenses.map(l => p.perLens[l.id] ?? 0)) === s
              ),
            }))
            .filter(t => t.pairings.length > 0);

          return (
            <div key={group.label} className="pp-shared-group">
              <div className="pp-shared-group-header">
                Shared by {group.label}
                {group.pairings.length > 0 && (
                  <span className="pp-shared-count">{group.pairings.length}</span>
                )}
              </div>
              {group.pairings.length === 0
                ? <div className="pp-none">none</div>
                : byTier.map(tier => (
                  <div key={tier.strength} className="pp-tier">
                    <div className="pp-tier-label" style={{ color: STRENGTH_COLOR[tier.strength] }}>
                      {STRENGTH_LABEL[tier.strength]}
                    </div>
                    <div className="pp-chips">
                      {tier.pairings.map(p => (
                        <span key={p.label} className="pp-chip">
                          <span
                            className="pp-dot"
                            style={{
                              background: STRENGTH_COLOR[tier.strength],
                              boxShadow: tier.strength === 4 ? '0 0 4px 1px rgba(212,168,64,0.5)' : 'none',
                            }}
                          />
                          {p.label}
                          {p.modifier && <span className="pp-modifier">{p.modifier}</span>}
                        </span>
                      ))}
                    </div>
                  </div>
                ))
              }
            </div>
          );
        })}
      </div>
    </section>
  );
}

function AffinitiesSection({ lenses, affinities }) {
  if (!affinities.length) return null;
  const labelSet = new Set(lenses.map(l => l.label.toLowerCase()));
  const idSet    = new Set(lenses.map(l => l.id));

  return (
    <section className="pp-section">
      <div className="pp-section-label">Affinities</div>
      <div className="pp-affinities">
        {affinities.map(({ str }) => {
          const parts = parseAffinityStr(str, labelSet, idSet);
          return (
            <div key={str} className="pp-affinity">
              {parts.map((part, i) => (
                <span key={i}>
                  {i > 0 && <span className="pp-plus"> + </span>}
                  <span className={part.isActive ? 'pp-affinity-active' : 'pp-affinity-other'}>
                    {part.label}
                  </span>
                </span>
              ))}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function RemainingSection({ lensColumns, isSolo }) {
  return (
    <section className="pp-section">
      <div className="pp-section-label">{isSolo ? 'Pairings' : 'Remaining Flavors'}</div>
      <div className="pp-columns">
        {lensColumns.map(({ lens, pairings }) => {
          const byTier = TIER_ORDER
            .map(s => ({ strength: s, pairings: pairings.filter(p => p.strength === s) }))
            .filter(t => t.pairings.length > 0);

          return (
            <div key={lens.id} className="pp-remaining-card" style={{ borderTopColor: lens.color }}>
              <div className="pp-remaining-name" style={{ color: lens.color }}>
                {lens.label}
                <span className="pp-remaining-count">{pairings.length}</span>
              </div>
              {byTier.map(tier => (
                <div key={tier.strength} className="pp-tier">
                  <div className="pp-tier-label" style={{ color: STRENGTH_COLOR[tier.strength] }}>
                    {STRENGTH_LABEL[tier.strength]}
                  </div>
                  <div className="pp-chips">
                    {tier.pairings.map(p => (
                      <span key={p.label} className="pp-chip">
                        <span
                          className="pp-dot"
                          style={{
                            background: STRENGTH_COLOR[tier.strength],
                            boxShadow: tier.strength === 4 ? '0 0 4px 1px rgba(212,168,64,0.5)' : 'none',
                          }}
                        />
                        {p.label}
                        {p.modifier && <span className="pp-modifier">{p.modifier}</span>}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </section>
  );
}

const STRENGTH_NAMES = { 4: 'Holy Grail', 3: 'Essential', 2: 'Highly Recommended', 1: 'Recommended' };

function FiltersFooter({ filters }) {
  const parts = [];
  if (filters.seasons.length)    parts.push(`Season: ${filters.seasons.join(', ')}`);
  if (filters.tastes.length)     parts.push(`Taste: ${filters.tastes.join(', ')}`);
  if (filters.regions.length)    parts.push(`Region: ${filters.regions.join(', ')}`);
  if (filters.strengths?.length) parts.push(`Strength: ${filters.strengths.map(s => STRENGTH_NAMES[s]).join(', ')}`);
  if (filters.visibility !== 'all') parts.push(`Overlap: ${filters.visibility}`);
  if (!parts.length) return null;
  return (
    <div className="pp-filters-footer">
      <span className="pp-filters-footer-label">Filters applied:</span>
      {parts.map((p, i) => <span key={i} className="pp-filters-footer-chip">{p}</span>)}
    </div>
  );
}

// ─── PrintPage ────────────────────────────────────────────────────────────────

export default function PrintPage() {
  const [searchParams] = useSearchParams();

  const lensIds = (searchParams.get('lenses') ?? '').split(',').filter(Boolean);

  const lenses = lensIds
    .filter(id => FLAVORS.ingredients[id])
    .map((id, i) => ({
      id,
      label: FLAVORS.ingredients[id].label,
      color: LENS_COLORS[i % LENS_COLORS.length],
    }));

  const filters = {
    cuisines:   [],
    seasons:    (searchParams.get('seasons')    ?? '').split(',').filter(Boolean),
    tastes:     (searchParams.get('tastes')     ?? '').split(',').filter(Boolean),
    regions:    (searchParams.get('regions')    ?? '').split(',').filter(Boolean),
    strengths:  (searchParams.get('strengths')  ?? '').split(',').map(Number).filter(Boolean),
    visibility: searchParams.get('visibility') ?? 'all',
  };

  if (lenses.length === 0) {
    return (
      <div className="pp-empty">
        <p>No ingredients selected.</p>
      </div>
    );
  }

  const isSolo = lenses.length === 1;
  const contentFiltersActive = hasActiveFilters({ ...filters, visibility: 'all' });
  const pairingFilterFn = contentFiltersActive
    ? p => {
        if (filters.strengths.length > 0 && !filters.strengths.includes(p.strength)) return false;
        if (!p.id) {
          const hasContentFilters = (filters.regions?.length > 0) || (filters.seasons?.length > 0) || (filters.tastes?.length > 0);
          return !hasContentFilters;
        }
        return matchesFilters(FLAVORS.ingredients[p.id], filters);
      }
    : null;

  const pairingMap   = buildPairingMap(lenses, pairingFilterFn);
  const sharedGroups = isSolo ? [] : buildSharedGroups(lenses, pairingMap);
  const affinities   = buildAffinities(lenses);
  const lensColumns  = buildLensColumns(lenses, pairingMap, isSolo, pairingFilterFn);

  const title = lenses.map(l => l.label).join(' & ');

  return (
    <div className="pp-page">

      <header className="pp-header no-print">
        <div className="pp-header-title">{title}</div>
        <button className="pp-print-btn" onClick={() => window.print()}>
          ⎙ Print
        </button>
      </header>

      <main className="pp-main">
        <div className="pp-doc-title">{title}</div>

        <ProfileSection lenses={lenses} />

        {!isSolo && filters.visibility !== 'individual' && (
          <SharedSection groups={sharedGroups} />
        )}

        <AffinitiesSection lenses={lenses} affinities={affinities} />

        {filters.visibility !== 'shared' && (
          <RemainingSection lensColumns={lensColumns} isSolo={isSolo} />
        )}

        <FiltersFooter filters={filters} />
      </main>

    </div>
  );
}
