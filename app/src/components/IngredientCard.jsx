import { Link } from 'react-router-dom';
import { STRENGTH_COLOR, STRENGTH_LABEL, TIER_ORDER } from '../utils/boardUtils';

/**
 * IngredientCard — one column per active lens in the Remaining Flavors section.
 *
 * Shows pairings not captured in any shared intersection group, grouped by
 * strength tier and rendered as chips. In solo mode shows every pairing.
 *
 * Props:
 *   lens           — { id, label, color }
 *   pairings       — pre-sorted pairings (strength desc, alpha within tier)
 *   isSolo         — bool
 *   onPairingClick — (pairing) => void
 */
export default function IngredientCard({ lens, pairings, isSolo, onPairingClick }) {
  const tiers = TIER_ORDER
    .map(s => ({ strength: s, pairings: pairings.filter(p => p.strength === s) }))
    .filter(t => t.pairings.length > 0);

  return (
    <div className="ingredient-card" style={{ borderTopColor: lens.color }}>

      <div className="ingredient-card-header">
        <Link
          to={`/ingredient/${lens.id}`}
          className="ingredient-card-name ingredient-card-name--link"
          style={{ color: lens.color }}
        >
          {lens.label}
        </Link>
        <div className="ingredient-card-count">
          {pairings.length} {isSolo ? '' : 'individual '}pairing{pairings.length !== 1 ? 's' : ''}
        </div>
      </div>

      <div className="ingredient-card-pairings">
        {tiers.length === 0
          ? <div className="pairing-empty">No pairings.</div>
          : tiers.map(tier => (
            <div key={tier.strength} className="chip-tier">
              <div
                className="pairing-tier-label"
                style={{ color: STRENGTH_COLOR[tier.strength] }}
              >
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
                        background: STRENGTH_COLOR[p.strength],
                        boxShadow: p.strength === 4 ? '0 0 5px 1px rgba(212,168,64,0.65)' : 'none',
                      }}
                    />
                    {p.label}
                    {p.modifier && <span className="chip-modifier">{p.modifier}</span>}
                  </button>
                ))}
              </div>
            </div>
          ))
        }
      </div>

    </div>
  );
}
