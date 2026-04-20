import { useState } from 'react';
import useExplorerStore from '../store/useExplorerStore';
import { FLAVORS } from '../data/flavors_data';
import { matchesFilters, hasActiveFilters } from '../utils/filterUtils';
import {
  STRENGTH_COLOR, STRENGTH_LABEL, TIER_ORDER, LABEL_TO_ID,
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
  const hasBody = ing.tips.length > 0 || ing.quotes.length > 0;

  return (
    <div className="ingredient-card ingredient-card--profile" style={{ borderTopColor: lens.color }}>

      <div className="ingredient-card-header">
        <div className="ingredient-card-name" style={{ color: lens.color }}>
          {lens.label}
        </div>
        {metaEntries.map(([key, val]) => (
          <div key={key} className="profile-meta-row">
            <span className="profile-meta-key">
              {key.charAt(0).toUpperCase() + key.slice(1)}:
            </span>
            {' '}{val}
          </div>
        ))}
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
    ? p => !!(p.id && matchesFilters(FLAVORS.ingredients[p.id], filters))
    : null;

  // Single scan — used for both shared groups and individual column filtering
  const pairingMap  = buildPairingMap(lenses, pairingFilterFn);
  const sharedGroups = isSolo ? [] : buildSharedGroups(lenses, pairingMap);
  const affinities   = buildAffinities(lenses);
  const lensColumns  = buildLensColumns(lenses, pairingMap, isSolo, pairingFilterFn);

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
