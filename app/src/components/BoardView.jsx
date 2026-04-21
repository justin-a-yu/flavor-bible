import { useState } from 'react';
import { Link } from 'react-router-dom';
import useExplorerStore from '../store/useExplorerStore';
import { FLAVORS } from '../data/flavors_data';
import { matchesFilters, hasActiveFilters } from '../utils/filterUtils';
import {
  STRENGTH_COLOR, STRENGTH_LABEL, TIER_ORDER,
  buildPairingMap, buildSharedGroups, buildAffinities, buildLensColumns, parseAffinityStr,
} from '../utils/boardUtils';
import IngredientCard from './IngredientCard';
import PairingDetailDrawer from './PairingDetailDrawer';
import PrintExportButton from './PrintExportButton';
import './BoardView.css';

// ─── Constants ────────────────────────────────────────────────────────────────

// Only compact, single-line meta shown in the board card; longer fields live on the full profile page
const CARD_META_KEYS = new Set(['taste', 'weight', 'volume', 'season', 'function']);

// ─── Section components ───────────────────────────────────────────────────────

function IngredientProfileCard({ lens }) {
  const ing = FLAVORS.ingredients[lens.id];
  if (!ing) return null;
  const metaEntries = Object.entries(ing.meta ?? {}).filter(([k, v]) => v && CARD_META_KEYS.has(k));
  const avoids = ing.avoids ?? [];
  const hasBody = ing.tips.length > 0 || ing.quotes.length > 0;

  return (
    <div className="ingredient-card ingredient-card--profile" style={{ borderTopColor: lens.color }}>

      <div className="ingredient-card-header">
        <Link
          to={`/ingredient/${lens.id}`}
          className="ingredient-card-name ingredient-card-name--link"
          style={{ color: lens.color }}
        >
          {lens.label}
        </Link>
        {metaEntries.map(([key, val]) => (
          <div key={key} className="profile-meta-row">
            <span className="profile-meta-key">
              {key.charAt(0).toUpperCase() + key.slice(1)}:
            </span>
            {' '}{val}
          </div>
        ))}
        {avoids.length > 0 && (
          <div className="profile-avoid-row">
            <span className="profile-avoid-label">Avoid:</span>
            {' '}{avoids.map(a => a.label).join(', ')}
          </div>
        )}
      </div>

      {hasBody && (
        <div className="ingredient-card-pairings">
          {ing.tips.length > 0 && (
            <div className="profile-section">
              <div className="profile-section-label">Tips</div>
              {ing.tips.map((tip, i) => (
                <div key={i} className="profile-tip">{tip}</div>
              ))}
            </div>
          )}
          {ing.quotes.length > 0 && (
            <div className="profile-section">
              <div className="profile-section-label">From the book</div>
              {ing.quotes.map((q, i) => (
                <div key={i} className="profile-quote">
                  <div className="profile-quote-text">&ldquo;{q.text}&rdquo;</div>
                  {q.attribution && (
                    <div className="profile-quote-attr">— {q.attribution}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

    </div>
  );
}

function IngredientProfileSection({ lenses }) {
  return (
    <section className="board-section">
      <div className="section-label">Ingredients</div>
      <div className="ingredient-columns">
        {lenses.map(lens => (
          <IngredientProfileCard key={lens.id} lens={lens} />
        ))}
      </div>
    </section>
  );
}

function SharedBySection({ groups, onPairingClick }) {
  return (
    <section className="board-section">
      <div className="section-label">Pairings</div>
      <div className="shared-groups">
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
            <div key={group.label} className="shared-group">
              <div className="shared-group-header">
                <span className="shared-group-title">Shared by {group.label}</span>
                {group.pairings.length > 0 && (
                  <span className="shared-group-count">{group.pairings.length}</span>
                )}
              </div>

              {group.pairings.length === 0
                ? <div className="shared-none">none</div>
                : byTier.map(tier => (
                  <div key={tier.strength} className="chip-tier">
                    <div className="pairing-tier-label" style={{ color: STRENGTH_COLOR[tier.strength] }}>
                      {STRENGTH_LABEL[tier.strength]}
                    </div>
                    <div className="shared-pairing-chips">
                      {tier.pairings.map(p => (
                        <button
                          key={p.label}
                          className="shared-pairing-chip"
                          onClick={() => onPairingClick(p)}
                        >
                          <span
                            className="pairing-dot"
                            style={{
                              background: STRENGTH_COLOR[tier.strength],
                              boxShadow: tier.strength === 4 ? '0 0 5px 1px rgba(212,168,64,0.6)' : 'none',
                            }}
                          />
                          {p.label}
                        </button>
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

function AffinitiesSection({ lenses, affinities, onAddLens }) {
  if (!affinities.length) return null;
  const labelSet = new Set(lenses.map(l => l.label.toLowerCase()));
  const idSet    = new Set(lenses.map(l => l.id));

  return (
    <section className="board-section">
      <div className="section-label">Affinities</div>
      <div className="affinities-list">
        {affinities.map(({ str }) => {
          const parts = parseAffinityStr(str, labelSet, idSet);
          return (
            <div key={str} className="affinity-row">
              {parts.map((part, i) => (
                <span key={i} className="affinity-part">
                  {i > 0 && <span className="affinity-plus">+</span>}
                  {part.isTappable
                    ? (
                      <button
                        className="affinity-chip"
                        onClick={() => onAddLens(part.id)}
                        title={`Add ${part.label} to board`}
                      >
                        {part.label}
                      </button>
                    ) : (
                      <span className="affinity-active">{part.label}</span>
                    )
                  }
                </span>
              ))}
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ─── BoardView ────────────────────────────────────────────────────────────────

export default function BoardView() {
  const lenses  = useExplorerStore(s => s.lenses);
  const addLens = useExplorerStore(s => s.addLens);
  const filters = useExplorerStore(s => s.filters);
  const [selectedPairing, setSelectedPairing] = useState(null);

  if (lenses.length === 0) {
    return (
      <div className="board-empty">
        <div className="board-empty-text">Search for an ingredient above to begin</div>
        <div className="board-empty-hint">Try: garlic, lemon, chocolate, lamb, ginger…</div>
      </div>
    );
  }

  const isSolo = lenses.length === 1;

  // Build a content filter predicate from active cuisine/season/taste filters.
  // Visibility is handled at the map/column level, not via matchesFilters.
  const contentFiltersActive = hasActiveFilters({ ...filters, visibility: 'all' });
  const pairingFilterFn = contentFiltersActive
    ? p => {
        if (filters.strengths?.length > 0 && !filters.strengths.includes(p.strength)) return false;
        if (!p.id) return filters.strengths?.length === 0;
        return matchesFilters(FLAVORS.ingredients[p.id], filters);
      }
    : null;

  // Single scan — used for both shared groups and individual column filtering
  const pairingMap  = buildPairingMap(lenses, pairingFilterFn);
  const sharedGroups = isSolo ? [] : buildSharedGroups(lenses, pairingMap);
  const affinities   = buildAffinities(lenses);
  const lensColumns  = buildLensColumns(lenses, pairingMap, isSolo, pairingFilterFn);

  // Cross-lens avoid conflicts: lens A avoids lens B (or vice versa)
  const avoidConflicts = [];
  if (!isSolo) {
    for (let i = 0; i < lenses.length; i++) {
      for (let j = i + 1; j < lenses.length; j++) {
        const a = lenses[i];
        const b = lenses[j];
        const ingA = FLAVORS.ingredients[a.id];
        const ingB = FLAVORS.ingredients[b.id];
        const aAvoidsB = ingA?.avoids?.some(av => av.id === b.id);
        const bAvoidsA = ingB?.avoids?.some(av => av.id === a.id);
        if (aAvoidsB || bAvoidsA) {
          avoidConflicts.push({ a, b, aAvoidsB, bAvoidsA });
        }
      }
    }
  }

  return (
    <div className="board-view">

      <div className="board-toolbar">
        <PrintExportButton />
      </div>

      <div className="board-print-title">
        {lenses.map(l => l.label).join(' · ')}
      </div>

      <div className="board-doc">

        <IngredientProfileSection lenses={lenses} />

        {avoidConflicts.length > 0 && (
          <section className="board-section board-avoid-conflicts">
            {avoidConflicts.map(({ a, b, aAvoidsB, bAvoidsA }) => (
              <div key={`${a.id}-${b.id}`} className="board-avoid-conflict">
                <span className="board-avoid-icon">⚠</span>
                {aAvoidsB && bAvoidsA
                  ? <>{' '}<strong style={{ color: a.color }}>{a.label}</strong> and{' '}
                    <strong style={{ color: b.color }}>{b.label}</strong> each avoid the other</>
                  : aAvoidsB
                  ? <>{' '}<strong style={{ color: a.color }}>{a.label}</strong> avoids{' '}
                    <strong style={{ color: b.color }}>{b.label}</strong></>
                  : <>{' '}<strong style={{ color: b.color }}>{b.label}</strong> avoids{' '}
                    <strong style={{ color: a.color }}>{a.label}</strong></>
                }
              </div>
            ))}
          </section>
        )}

        {!isSolo && filters.visibility !== 'individual' && (
          <SharedBySection
            groups={sharedGroups}
            onPairingClick={setSelectedPairing}
          />
        )}

        <AffinitiesSection
          lenses={lenses}
          affinities={affinities}
          onAddLens={addLens}
        />

        {filters.visibility !== 'shared' && (
          <section className="board-section board-section--columns">
            <div className="section-label">Remaining Flavors</div>
            <div className="ingredient-columns">
              {lensColumns.map(({ lens, pairings }) => (
                <IngredientCard
                  key={lens.id}
                  lens={lens}
                  pairings={pairings}
                  isSolo={isSolo}
                  onPairingClick={setSelectedPairing}
                />
              ))}
            </div>
          </section>
        )}

      </div>

      {selectedPairing && (
        <PairingDetailDrawer
          pairing={selectedPairing}
          onClose={() => setSelectedPairing(null)}
        />
      )}

    </div>
  );
}
