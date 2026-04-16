import { useState, useCallback, useEffect } from 'react';
import LensCanvas from '../components/LensCanvas';
import BoardView from '../components/BoardView';
import FilterPanel from '../components/FilterPanel';
import useExplorerStore from '../store/useExplorerStore';
import { FLAVORS } from '../data/flavors_data';

// ── Minimal search bar ─────────────────────────────────────────────────────────

function SearchBar() {
  const [query, setQuery]   = useState('');
  const [results, setResults] = useState([]);
  const addLens   = useExplorerStore(s => s.addLens);
  const lenses    = useExplorerStore(s => s.lenses);

  const onInput = (e) => {
    const val = e.target.value;
    setQuery(val);
    if (val.trim().length < 2) { setResults([]); return; }
    const matches = FLAVORS.index
      .filter(s => s.label.toLowerCase().includes(val.toLowerCase()) && !lenses.find(l => l.id === s.id))
      .slice(0, 10);
    setResults(matches);
  };

  const pick = (id) => {
    addLens(id);
    setQuery('');
    setResults([]);
  };

  return (
    <div style={{ position: 'relative' }}>
      <input
        value={query}
        onChange={onInput}
        placeholder="Add an ingredient…"
        style={{
          background: '#f5f0e8', border: '1px solid #e0d6c4', borderRadius: 8,
          padding: '8px 14px', fontFamily: 'Georgia, serif', fontSize: '0.88rem',
          color: '#2c2416', outline: 'none', minWidth: 240,
        }}
        onKeyDown={e => {
          if (e.key === 'Enter' && results.length) pick(results[0].id);
          if (e.key === 'Escape') setResults([]);
        }}
      />
      {results.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, marginTop: 4,
          background: '#fff', border: '1px solid #e0d6c4', borderRadius: 8,
          boxShadow: '0 8px 24px rgba(0,0,0,0.08)', minWidth: 240,
          maxHeight: 320, overflowY: 'auto', zIndex: 100,
        }}>
          {results.map(r => (
            <div
              key={r.id}
              onClick={() => pick(r.id)}
              style={{
                padding: '10px 14px', fontSize: '0.84rem', color: '#2c2416',
                cursor: 'pointer', borderBottom: '1px solid #f0ebe0',
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#faf5ea'}
              onMouseLeave={e => e.currentTarget.style.background = ''}
            >
              {r.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── View toggle ────────────────────────────────────────────────────────────────

function ViewToggle() {
  const activeView  = useExplorerStore(s => s.activeView);
  const setActiveView = useExplorerStore(s => s.setActiveView);

  const btn = (view, label) => (
    <button
      onClick={() => setActiveView(view)}
      className="view-toggle-group"
      style={{
        padding: '5px 14px', fontSize: '0.72rem', letterSpacing: '0.08em',
        textTransform: 'uppercase', cursor: 'pointer', border: 'none',
        fontFamily: 'Georgia, serif',
        background: activeView === view ? '#2c2416' : 'transparent',
        color:      activeView === view ? '#faf7f2' : '#8a7450',
        borderRadius: view === 'lens' ? '6px 0 0 6px' : '0 6px 6px 0',
        transition: 'background 0.15s, color 0.15s',
      }}
    >{label}</button>
  );

  return (
    <div style={{ display: 'flex', border: '1px solid #d4c9b0', borderRadius: 7, overflow: 'hidden', flexShrink: 0 }}>
      {btn('lens',  'Lens')}
      {btn('board', 'Board')}
    </div>
  );
}

// ── Lens pills ─────────────────────────────────────────────────────────────────

function LensPills() {
  const lenses     = useExplorerStore(s => s.lenses);
  const removeLens = useExplorerStore(s => s.removeLens);

  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {lenses.map(l => (
        <div key={l.id} style={{
          display: 'flex', alignItems: 'center', gap: 5,
          background: '#fff', border: '1px solid #d4c9b0', borderRadius: 20,
          padding: '3px 10px 3px 12px', fontSize: '0.75rem', color: '#5a4a2e',
        }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: l.color, flexShrink: 0 }} />
          {l.label}
          <span
            onClick={() => removeLens(l.id)}
            style={{ cursor: 'pointer', color: '#b0a488', fontSize: 10, lineHeight: 1, padding: '0 1px' }}
          >✕</span>
        </div>
      ))}
    </div>
  );
}

// ── Bubble detail card ─────────────────────────────────────────────────────────

const STRENGTH_LABEL = ['', 'Recommended', 'Highly Recommended', 'Essential', 'Holy Grail'];
function strengthColor(s) {
  return s >= 3 ? '#d4a840' : s === 2 ? '#e07840' : '#5a9e6a';
}

function DetailCard({ bubble, clientX, clientY, onClose }) {
  if (!bubble) return null;
  const p   = bubble.pairing;
  const col = strengthColor(p.strength);
  const ing = p.id ? FLAVORS.ingredients[p.id] : null;

  // Position: try right of cursor, flip left if near edge
  const left = Math.min(clientX + 20, window.innerWidth  - 310);
  const top  = Math.min(clientY - 20, window.innerHeight - 300);

  return (
    <div style={{
      position: 'fixed', left, top,
      background: '#fff', border: '1px solid #e0d6c4', borderRadius: 10,
      boxShadow: '0 10px 32px rgba(0,0,0,0.1)', padding: '16px 18px',
      minWidth: 220, maxWidth: 280, zIndex: 50, pointerEvents: 'auto',
    }}>
      <div
        onClick={onClose}
        style={{ position: 'absolute', top: 10, right: 12, cursor: 'pointer', fontSize: 11, color: '#b0a488' }}
      >✕</div>

      <div style={{ fontSize: '1rem', color: '#2c2416', marginBottom: 2 }}>{p.label}</div>
      <div style={{ fontSize: '0.68rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: col, marginBottom: 8 }}>
        {STRENGTH_LABEL[p.strength] || ''}
      </div>

      {p.modifier && (
        <div style={{ fontSize: '0.75rem', color: '#8a7450', fontStyle: 'italic', marginBottom: 8 }}>
          {p.modifier}
        </div>
      )}

      {ing && ing.quotes.length > 0 && (
        <div style={{ fontSize: '0.76rem', color: '#6a5a3a', lineHeight: 1.55, fontStyle: 'italic', marginBottom: 10, maxHeight: 80, overflow: 'hidden' }}>
          &ldquo;{ing.quotes[0].text.slice(0, 140)}{ing.quotes[0].text.length > 140 ? '…' : ''}&rdquo;
        </div>
      )}
      {!ing?.quotes?.length && ing?.tips?.length > 0 && (
        <div style={{ fontSize: '0.76rem', color: '#6a5a3a', lineHeight: 1.55, fontStyle: 'italic', marginBottom: 10 }}>
          {ing.tips[0]}
        </div>
      )}

      {bubble.lensIds.length > 1 && (
        <div style={{ fontSize: '0.68rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#b0a488', marginBottom: 5 }}>
          Shared by {bubble.lensIds.map(id => FLAVORS.ingredients[id]?.label).filter(Boolean).join(' & ')}
        </div>
      )}

      {ing && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {ing.pairings.slice(0, 5).map(a => (
            <span key={a.label} style={{ padding: '2px 8px', background: '#f5f0e8', borderRadius: 10, fontSize: '0.7rem', color: '#8a7450' }}>
              {a.label}
            </span>
          ))}
        </div>
      )}

      {ing?.meta && Object.keys(ing.meta).length > 0 && (
        <div style={{ fontSize: '0.68rem', color: '#b0a488', marginTop: 8, lineHeight: 1.6 }}>
          {ing.meta.taste  && <div>Taste: {ing.meta.taste}</div>}
          {ing.meta.weight && <div>Weight: {ing.meta.weight}</div>}
          {ing.meta.volume && <div>Volume: {ing.meta.volume}</div>}
          {ing.meta.season && <div>Season: {ing.meta.season}</div>}
        </div>
      )}
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function ExplorerPage() {
  const activeView = useExplorerStore(s => s.activeView);
  const [detail, setDetail] = useState(null); // { bubble, clientX, clientY }

  // Restore state from URL hash on initial load
  useEffect(() => {
    if (window.location.hash) {
      useExplorerStore.getState().loadFromHash(window.location.hash);
    }
  }, []);

  const handleBubbleClick = useCallback((bubble, clientX, clientY) => {
    setDetail(prev => prev?.bubble.uid === bubble.uid ? null : { bubble, clientX, clientY });
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100vw', height: '100vh', background: '#faf7f2', overflow: 'hidden' }}>

      {/* Header */}
      <header style={{
        display: 'flex', alignItems: 'center', gap: 20,
        padding: '14px 28px', background: '#fff', borderBottom: '1px solid #e8e0d0',
        flexShrink: 0, zIndex: 20, flexWrap: 'wrap',
      }}>
        <div style={{ fontSize: '1rem', letterSpacing: '0.16em', textTransform: 'uppercase', color: '#b8863a', fontWeight: 'normal', flexShrink: 0 }}>
          Flavor <span style={{ color: '#2c2416' }}>Bible</span> Explorer
        </div>
        <SearchBar />
        <LensPills />
        <ViewToggle />
        <FilterPanel />
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 16, fontSize: '0.68rem', color: '#a09070', letterSpacing: '0.07em' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#d4a840', display: 'inline-block' }} />
            Essential &nbsp;/&nbsp;
            <span style={{ background: 'radial-gradient(ellipse at center, rgba(212,168,64,0.55) 0%, rgba(212,168,64,0.22) 55%, transparent 100%)', padding: '1px 7px', borderRadius: 10 }}>
              Holy Grail
            </span>
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#e07840', display: 'inline-block' }} />
            Highly Recommended
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#5a9e6a', display: 'inline-block' }} />
            Recommended
          </span>
        </div>
      </header>

      {/* Main view */}
      {activeView === 'board' ? (
        <BoardView />
      ) : (
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          <LensCanvas onBubbleClick={handleBubbleClick} />
          {detail && (
            <DetailCard
              bubble={detail.bubble}
              clientX={detail.clientX}
              clientY={detail.clientY}
              onClose={() => setDetail(null)}
            />
          )}
        </div>
      )}

      {/* Hint bar — lens view only */}
      {activeView === 'lens' && (
        <div className="hint-bar" style={{
          padding: '10px 24px', background: '#fff', borderTop: '1px solid #e8e0d0',
          fontSize: '0.72rem', color: '#b0a488', letterSpacing: '0.08em',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0,
        }}>
          <span>Drag lenses together — shared flavors migrate to the overlap</span>
          <span>Click bubble for notes · Double-click to open as lens · Scroll to resize · R to shuffle · Space+drag to pan · Space+scroll to zoom</span>
        </div>
      )}
    </div>
  );
}
