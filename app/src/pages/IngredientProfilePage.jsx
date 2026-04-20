import { useParams, Link } from 'react-router-dom';
import { FLAVORS } from '../data/flavors_data';
import './IngredientProfilePage.css';

// ─── Constants ────────────────────────────────────────────────────────────────

const STRENGTH_COLOR = { 4: '#d4a840', 3: '#d4a840', 2: '#e07840', 1: '#5a9e6a' };
const STRENGTH_LABEL = { 4: 'Holy Grail', 3: 'Essential', 2: 'Highly Recommended', 1: 'Recommended' };
const TIER_ORDER     = [4, 3, 2, 1];

// Meta fields shown inline (short values); others get their own expanded rows
const INLINE_META_KEYS = new Set(['taste', 'weight', 'volume', 'season', 'function']);

// Label → ingredient id lookup for linking botanical relatives
const LABEL_TO_ID = Object.fromEntries(
  FLAVORS.index.flatMap(item => {
    const full = item.label.toLowerCase();
    const entries = [[full, item.id]];
    const paren = full.indexOf(' (');
    if (paren > 0) entries.push([full.slice(0, paren).trim(), item.id]);
    return entries;
  })
);

// ─── IngredientProfilePage ────────────────────────────────────────────────────

export default function IngredientProfilePage() {
  const { id } = useParams();
  const ing = FLAVORS.ingredients[id];

  if (!ing) {
    return (
      <div className="profile-page">
        <header className="profile-header">
          <button className="profile-back" onClick={() => history.back()}>← Back</button>
        </header>
        <div className="profile-notfound">
          <div className="profile-notfound-title">Ingredient not found</div>
          <div className="profile-notfound-hint">"{id}" doesn't match any entry.</div>
        </div>
      </div>
    );
  }

  const metaEntries = Object.entries(ing.meta ?? {}).filter(([, v]) => v);
  const inlineMeta  = metaEntries.filter(([k]) => INLINE_META_KEYS.has(k));
  const techniques  = ing.meta?.techniques
    ? ing.meta.techniques.split(',').map(s => s.trim()).filter(Boolean)
    : [];
  const botanicals  = ing.meta?.['botanical relatives']
    ? ing.meta['botanical relatives'].split(',').map(s => s.trim()).filter(Boolean)
    : [];

  const tiers = TIER_ORDER
    .map(s => ({ strength: s, pairings: ing.pairings.filter(p => p.strength === s) }))
    .filter(t => t.pairings.length > 0);

  return (
    <div className="profile-page">

      <header className="profile-header">
        <button className="profile-back" onClick={() => history.back()}>← Back</button>
        <button className="profile-print-btn" onClick={() => window.print()}>
          <span>⎙</span> Print
        </button>
      </header>

      <main className="profile-main">

        {/* ── Hero ── */}
        <div className="profile-hero">
          <h1 className="profile-name">{ing.label}</h1>

          {inlineMeta.length > 0 && (
            <div className="profile-meta">
              {inlineMeta.map(([key, val]) => (
                <span key={key} className="profile-meta-item">
                  <span className="profile-meta-key">
                    {key.charAt(0).toUpperCase() + key.slice(1)}:
                  </span>
                  {' '}{val}
                </span>
              ))}
            </div>
          )}

          {techniques.length > 0 && (
            <div className="profile-meta-expanded">
              <span className="profile-meta-key profile-meta-expanded-label">Techniques:</span>
              <div className="profile-meta-chips">
                {techniques.map(t => (
                  <span key={t} className="profile-meta-chip">{t}</span>
                ))}
              </div>
            </div>
          )}

          {botanicals.length > 0 && (
            <div className="profile-meta-expanded">
              <span className="profile-meta-key profile-meta-expanded-label">Botanical relatives:</span>
              <div className="profile-meta-chips">
                {botanicals.map(b => {
                  const bid = LABEL_TO_ID[b.toLowerCase()] ?? null;
                  return bid ? (
                    <Link key={b} to={`/ingredient/${bid}`} className="profile-meta-chip profile-meta-chip--link">
                      {b}
                    </Link>
                  ) : (
                    <span key={b} className="profile-meta-chip">{b}</span>
                  );
                })}
              </div>
            </div>
          )}
        </div>

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

        {/* ── Avoids ── */}
        {ing.avoids?.length > 0 && (
          <section className="profile-section">
            <div className="profile-section-label profile-section-label--avoid">Avoid</div>
            <div className="profile-chips">
              {ing.avoids.map(a =>
                a.id ? (
                  <Link
                    key={a.label}
                    to={`/ingredient/${a.id}`}
                    className="profile-chip profile-chip--avoid profile-chip--link"
                  >
                    {a.label}
                    {a.modifier && <span className="profile-chip-modifier">{a.modifier}</span>}
                  </Link>
                ) : (
                  <span key={a.label} className="profile-chip profile-chip--avoid">
                    {a.label}
                    {a.modifier && <span className="profile-chip-modifier">{a.modifier}</span>}
                  </span>
                )
              )}
            </div>
          </section>
        )}

        {/* ── Notes ── */}
        {ing.notes?.length > 0 && (
          <section className="profile-section">
            <div className="profile-section-label">Notes</div>
            <div className="profile-notes">
              {ing.notes.map((note, i) => {
                // Re-join PDF line-wraps into semantic paragraphs.
                // A new paragraph starts when a line begins with "Word(s): " pattern.
                const paras = [];
                let cur = '';
                for (const line of note.split('\n')) {
                  if (cur && /^[A-Z][A-Za-z ,[\]]+:\s/.test(line)) {
                    paras.push(cur.trim());
                    cur = line;
                  } else {
                    cur = cur ? cur + ' ' + line : line;
                  }
                }
                if (cur) paras.push(cur.trim());
                return paras.map((para, j) => (
                  <p key={`${i}-${j}`} className="profile-note-para">{para}</p>
                ));
              })}
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

        {/* ── Dishes ── */}
        {ing.dishes?.length > 0 && (
          <section className="profile-section">
            <div className="profile-section-label">Dishes</div>
            <div className="profile-dishes">
              {ing.dishes.map((d, i) => (
                <div key={i} className="profile-dish">
                  <div className="profile-dish-text">{d.text}</div>
                  {d.attribution && (
                    <div className="profile-dish-attr">— {d.attribution}</div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

      </main>
    </div>
  );
}
