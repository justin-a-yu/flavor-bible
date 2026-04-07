import { useState } from 'react';
import useExplorerStore from '../store/useExplorerStore';
import { FLAVORS } from '../data/flavors_data';
import IngredientCard from './IngredientCard';
import PairingDetailDrawer from './PairingDetailDrawer';
import PrintExportButton from './PrintExportButton';
import './BoardView.css';

// ─── Constants ────────────────────────────────────────────────────────────────

const STRENGTH_COLOR = {
  4: '#d4a840',
  3: '#d4a840',
  2: '#e07840',
  1: '#5a9e6a',
};

const STRENGTH_LABEL = { 4: 'Holy Grail', 3: 'Essential', 2: 'Highly Recommended', 1: 'Recommended' };
const TIER_ORDER     = [4, 3, 2, 1];

// Label → ingredient id lookup. Indexes both the full label and the short name
// before any "(see also…)" parenthetical so affinity strings like "basil" match
// "BASIL (See also Basil, Thai, and Lemon Basil)".
const LABEL_TO_ID = Object.fromEntries(
  FLAVORS.index.flatMap(item => {
    const full = item.label.toLowerCase();
    const entries = [[full, item.id]];
    const paren = full.indexOf(' (');
    if (paren > 0) entries.push([full.slice(0, paren).trim(), item.id]);
    return entries;
  })
);

// ─── Pure helpers ─────────────────────────────────────────────────────────────

/** All k-element ordered subsets of arr (preserving original order). */
function combos(arr, k) {
  if (k === arr.length) return [[...arr]];
  if (k === 1) return arr.map(x => [x]);
  const out = [];
  for (let i = 0; i <= arr.length - k; i++) {
    combos(arr.slice(i + 1), k - 1).forEach(rest => out.push([arr[i], ...rest]));
  }
  return out;
}

/**
 * Single scan over all lenses. Returns a map:
 *   { [lowerCaseLabel]: { label, id, modifier, perLens: { lensId: strength } } }
 */
function buildPairingMap(lenses) {
  const map = {};
  lenses.forEach(lens => {
    const ing = FLAVORS.ingredients[lens.id];
    if (!ing) return;
    ing.pairings.forEach(p => {
      const key = p.label.toLowerCase();
      if (!map[key]) map[key] = { label: p.label, id: p.id, modifier: p.modifier, perLens: {} };
      map[key].perLens[lens.id] = p.strength;
    });
  });
  return map;
}

/**
 * Generate "Shared by" groups for every combination of 2+ lenses,
 * descending from all lenses down to pairs.
 *
 * The top group (all lenses) is always included even when empty.
 * Smaller groups use strict intersection: a pairing appears in exactly
 * those combo lenses, no others.
 *
 * Each group: { label, lenses: combo, pairings (sorted strength desc → alpha) }
 */
function buildSharedGroups(lenses, pairingMap) {
  const all = Object.values(pairingMap);
  const groups = [];

  for (let size = lenses.length; size >= 2; size--) {
    combos(lenses, size).forEach(combo => {
      const isTop = size === lenses.length;
      const matched = all
        .filter(p =>
          combo.every(l => p.perLens[l.id] !== undefined) &&
          (isTop || Object.keys(p.perLens).length === size)
        )
        .sort((a, b) => {
          const aMax = Math.max(...combo.map(l => a.perLens[l.id] ?? 0));
          const bMax = Math.max(...combo.map(l => b.perLens[l.id] ?? 0));
          return bMax - aMax || a.label.localeCompare(b.label);
        });

      groups.push({
        label: combo.map(l => l.label).join(' & '),
        lenses: combo,
        pairings: matched,
        isTop,
      });
    });
  }
  return groups;
}

/**
 * Find affinities that span 2+ active lenses. Returns them sorted by
 * how many active lenses they mention, descending.
 */
function buildAffinities(lenses) {
  if (lenses.length < 2) return [];
  const labelSet = new Set(lenses.map(l => l.label.toLowerCase()));
  const idSet    = new Set(lenses.map(l => l.id));
  const seen = new Set();
  const out  = [];

  lenses.forEach(lens => {
    const ing = FLAVORS.ingredients[lens.id];
    if (!ing) return;
    (ing.affinities || []).forEach(str => {
      if (seen.has(str)) return;
      seen.add(str);
      const parts = str.split(' + ').map(p => p.trim().toLowerCase());
      const hits = parts.filter(p => {
        const pid = LABEL_TO_ID[p] ?? null;
        return labelSet.has(p) || (pid && idSet.has(pid));
      }).length;
      if (hits >= 2) out.push({ str, hits });
    });
  });

  return out.sort((a, b) => b.hits - a.hits);
}

/** Parse an affinity string into parts with isActive / isTappable flags. */
function parseAffinityStr(str, labelSet, idSet) {
  return str.split(' + ').map(raw => {
    const trimmed = raw.trim();
    const lower   = trimmed.toLowerCase();
    const id      = LABEL_TO_ID[lower] ?? null;
    const isActive = (id && idSet.has(id)) || labelSet.has(lower);
    return { label: trimmed, id, isActive, isTappable: !!id && !isActive };
  });
}

// ─── Section components ───────────────────────────────────────────────────────

function IngredientProfileCard({ lens }) {
  const ing = FLAVORS.ingredients[lens.id];
  if (!ing) return null;
  const metaEntries = Object.entries(ing.meta ?? {}).filter(([, v]) => v);
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

  // Single scan — used for both shared groups and individual column filtering
  const pairingMap = buildPairingMap(lenses);

  // Keys of any pairing appearing in 2+ lenses — excluded from individual columns
  const sharedKeys = new Set(
    Object.entries(pairingMap)
      .filter(([, p]) => Object.keys(p.perLens).length >= 2)
      .map(([key]) => key)
  );

  const sharedGroups = isSolo ? [] : buildSharedGroups(lenses, pairingMap);
  const affinities   = buildAffinities(lenses);

  // Per-lens individual pairings: everything NOT in any intersection, sorted by strength
  const lensColumns = lenses.map(lens => {
    const ing = FLAVORS.ingredients[lens.id];
    if (!ing) return { lens, pairings: [] };
    const pairings = (isSolo ? ing.pairings : ing.pairings.filter(p => !sharedKeys.has(p.label.toLowerCase())))
      .slice()
      .sort((a, b) => b.strength - a.strength || a.label.localeCompare(b.label));
    return { lens, pairings };
  });

  return (
    <div className="board-view">

      <div className="board-toolbar">
        <PrintExportButton />
      </div>

      <div className="board-doc">

        <IngredientProfileSection lenses={lenses} />

        {!isSolo && (
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
