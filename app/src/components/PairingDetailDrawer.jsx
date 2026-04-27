import { useEffect, useRef } from 'react';
import useExplorerStore from '../store/useExplorerStore';
import { STRENGTH_COLOR, STRENGTH_LABEL } from '../utils/boardUtils';

// ── Component ──────────────────────────────────────────────────────────────────

/**
 * PairingDetailDrawer — side drawer that slides in from the right when a
 * pairing row is clicked in BoardView. Equivalent to DetailCard in lens view.
 *
 * Props:
 *   pairing  — the clicked pairing object { id, label, strength, modifier? }
 *   onClose  — called on overlay click or ✕ button
 */
export default function PairingDetailDrawer({ pairing, onClose }) {
  const overlayRef = useRef(null);

  // Close on click outside the drawer panel (i.e. on the dim overlay)
  useEffect(() => {
    const handle = (e) => {
      if (e.target === overlayRef.current) onClose();
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    const handle = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handle);
    return () => document.removeEventListener('keydown', handle);
  }, [onClose]);

  const lenses        = useExplorerStore(s => s.lenses);
  const addLens       = useExplorerStore(s => s.addLens);
  const flavors       = useExplorerStore(s => s.flavors);
  const isAlreadyActive = lenses.some(l => l.id === pairing?.id);

  if (!pairing) return null;

  const ing = pairing.id ? flavors?.ingredients[pairing.id] : null;
  const col = STRENGTH_COLOR[pairing.strength];

  return (
    <div
      ref={overlayRef}
      className="pairing-drawer-overlay"
      style={{
        position: 'absolute', inset: 0,
        background: 'rgba(44, 36, 22, 0.18)',
        zIndex: 40,
        display: 'flex', justifyContent: 'flex-end',
      }}
    >
      <div style={{
        width: 320, height: '100%',
        background: '#fff', borderLeft: '1px solid #e8e0d0',
        boxShadow: '-8px 0 32px rgba(0,0,0,0.1)',
        overflowY: 'auto',
        display: 'flex', flexDirection: 'column',
        fontFamily: 'Georgia, serif',
        animation: 'slideIn 0.18s ease-out',
      }}>

        {/* ── Header ── */}
        <div style={{ padding: '20px 20px 14px', borderBottom: '1px solid #f0ebe0', position: 'relative' }}>
          <button
            onClick={onClose}
            style={{
              position: 'absolute', top: 14, right: 16,
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#b0a488', fontSize: 13, padding: 4, lineHeight: 1,
            }}
          >✕</button>

          <div style={{ fontSize: '1.05rem', color: '#2c2416', paddingRight: 28, lineHeight: 1.3 }}>
            {pairing.label}
          </div>
          <div style={{ fontSize: '0.68rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: col, marginTop: 5 }}>
            {STRENGTH_LABEL[pairing.strength] || ''}
          </div>
          {pairing.modifier && (
            <div style={{ fontSize: '0.78rem', color: '#8a7450', fontStyle: 'italic', marginTop: 6, lineHeight: 1.5 }}>
              {pairing.modifier}
            </div>
          )}
        </div>

        {/* ── Body ── */}
        <div style={{ padding: '18px 20px', flex: 1 }}>

          {/* Metadata — right under strength */}
          {ing?.meta && (ing.meta.taste || ing.meta.weight || ing.meta.volume || ing.meta.season) && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: '0.78rem', color: '#6a5a3a', lineHeight: 1.9 }}>
                {ing.meta.taste  && <div><span style={{ color: '#b0a488' }}>Taste: </span>{ing.meta.taste}</div>}
                {ing.meta.weight && <div><span style={{ color: '#b0a488' }}>Weight: </span>{ing.meta.weight}</div>}
                {ing.meta.volume && <div><span style={{ color: '#b0a488' }}>Volume: </span>{ing.meta.volume}</div>}
                {ing.meta.season && <div><span style={{ color: '#b0a488' }}>Season: </span>{ing.meta.season}</div>}
              </div>
            </div>
          )}

          {/* Tips — italic, above quote */}
          {ing?.tips?.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: '0.8rem', color: '#6a5a3a', lineHeight: 1.65, fontStyle: 'italic' }}>
                {ing.tips[0]}
              </div>
            </div>
          )}

          {/* Quote — at the bottom */}
          {ing?.quotes?.length > 0 && (
            <div>
              <div style={{ fontSize: '0.66rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#b0a488', marginBottom: 7 }}>
                Chefs say
              </div>
              <div style={{ fontSize: '0.8rem', color: '#6a5a3a', lineHeight: 1.65, fontStyle: 'italic' }}>
                &ldquo;{ing.quotes[0].text.slice(0, 260)}{ing.quotes[0].text.length > 260 ? '\u2026' : ''}&rdquo;
              </div>
              {ing.quotes[0].attribution && (
                <div style={{ fontSize: '0.68rem', color: '#b0a488', marginTop: 5 }}>
                  — {ing.quotes[0].attribution}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        {ing && (
          <div style={{ padding: '14px 20px', borderTop: '1px solid #f0ebe0', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {/* Add as lens — only if the ingredient has its own entry and isn't already active */}
            {pairing.id && !isAlreadyActive && (
              <button
                onClick={() => { addLens(pairing.id); onClose(); }}
                style={{
                  display: 'block', width: '100%',
                  padding: '9px 0', cursor: 'pointer',
                  background: '#2c2416', border: 'none', borderRadius: 8,
                  fontSize: '0.78rem', color: '#faf7f2',
                  letterSpacing: '0.06em', fontFamily: 'Georgia, serif',
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#3e3420'}
                onMouseLeave={e => e.currentTarget.style.background = '#2c2416'}
              >
                Add as ingredient →
              </button>
            )}
            <a
              href={`/ingredient/${pairing.id}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'block', textAlign: 'center',
                padding: '9px 0',
                background: '#faf5ea', border: '1px solid #e0d6c4', borderRadius: 8,
                fontSize: '0.78rem', color: '#b8863a',
                textDecoration: 'none', letterSpacing: '0.06em',
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#f5ede0'}
              onMouseLeave={e => e.currentTarget.style.background = '#faf5ea'}
            >
              Open full profile →
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
