import { useParams, Link } from 'react-router-dom';
import { FLAVORS } from '../data/flavors_data';
import './IngredientProfilePage.css';

// ─── Constants ────────────────────────────────────────────────────────────────

const STRENGTH_COLOR = { 4: '#d4a840', 3: '#d4a840', 2: '#e07840', 1: '#5a9e6a' };
const STRENGTH_LABEL = { 4: 'Holy Grail', 3: 'Essential', 2: 'Highly Recommended', 1: 'Recommended' };
const TIER_ORDER     = [4, 3, 2, 1];

// ─── IngredientProfilePage ────────────────────────────────────────────────────

export default function IngredientProfilePage() {
  const { id } = useParams();
  const ing = FLAVORS.ingredients[id];

  if (!ing) {
    return (
      <div className="profile-page">
        <header className="profile-header">
          <Link to="/" className="profile-back">← Flavor Bible Explorer</Link>
        </header>
        <div className="profile-notfound">
          <div className="profile-notfound-title">Ingredient not found</div>
          <div className="profile-notfound-hint">"{id}" doesn't match any entry.</div>
        </div>
      </div>
    );
  }

  const metaEntries = Object.entries(ing.meta ?? {}).filter(([, v]) => v);
  const tiers = TIER_ORDER
    .map(s => ({ strength: s, pairings: ing.pairings.filter(p => p.strength === s) }))
    .filter(t => t.pairings.length > 0);

  return (
    <div className="profile-page">

      <header className="profile-header">
        <Link to="/" className="profile-back">← Flavor Bible Explorer</Link>
        <button className="profile-print-btn" onClick={() => window.print()}>
          <span>⎙</span> Print
        </button>
      </header>

      <main className="profile-main">

        {/* ── Hero ── */}
        <div className="profile-hero">
          <h1 className="profile-name">{ing.label}</h1>
          {metaEntries.length > 0 && (
            <div className="profile-meta">
              {metaEntries.map(([key, val]) => (
                <span key={key} className="profile-meta-item">
                  <span className="profile-meta-key">
                    {key.charAt(0).toUpperCase() + key.slice(1)}:
                  </span>
                  {' '}{val}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* ── Pairings ── */}
        {tiers.length > 0 && (
          <section className="profile-section">
            <div className="profile-section-label">Pairings</div>
            {tiers.map(tier => (
              <div key={tier.strength} className="profile-chip-tier">
                <div className="profile-tier-label" style={{ color: STRENGTH_COLOR[tier.strength] }}>
                  {STRENGTH_LABEL[tier.strength]}
                </div>
                <div className="profile-chips">
                  {tier.pairings.map(p =>
                    p.id ? (
                      <Link
                        key={p.label}
                        to={`/ingredient/${p.id}`}
                        className="profile-chip profile-chip--link"
                      >
                        <span
                          className="profile-chip-dot"
                          style={{
                            background: STRENGTH_COLOR[tier.strength],
                            boxShadow: tier.strength === 4 ? '0 0 5px 1px rgba(212,168,64,0.6)' : 'none',
                          }}
                        />
                        {p.label}
                        {p.modifier && <span className="profile-chip-modifier">{p.modifier}</span>}
                      </Link>
                    ) : (
                      <span key={p.label} className="profile-chip">
                        <span
                          className="profile-chip-dot"
                          style={{ background: STRENGTH_COLOR[tier.strength] }}
                        />
                        {p.label}
                        {p.modifier && <span className="profile-chip-modifier">{p.modifier}</span>}
                      </span>
                    )
                  )}
                </div>
              </div>
            ))}
          </section>
        )}

        {/* ── Affinities ── */}
        {ing.affinities.length > 0 && (
          <section className="profile-section">
            <div className="profile-section-label">Affinities</div>
            <div className="profile-affinities">
              {ing.affinities.map((str, i) => (
                <div key={i} className="profile-affinity">{str}</div>
              ))}
            </div>
          </section>
        )}

        {/* ── From the book ── */}
        {ing.quotes.length > 0 && (
          <section className="profile-section">
            <div className="profile-section-label">From the book</div>
            <div className="profile-quotes">
              {ing.quotes.map((q, i) => (
                <div key={i} className="profile-quote">
                  <div className="profile-quote-text">&ldquo;{q.text}&rdquo;</div>
                  {q.attribution && (
                    <div className="profile-quote-attr">— {q.attribution}</div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Tips ── */}
        {ing.tips.length > 0 && (
          <section className="profile-section">
            <div className="profile-section-label">Tips</div>
            <div className="profile-tips">
              {ing.tips.map((tip, i) => (
                <div key={i} className="profile-tip">{tip}</div>
              ))}
            </div>
          </section>
        )}

      </main>
    </div>
  );
}
