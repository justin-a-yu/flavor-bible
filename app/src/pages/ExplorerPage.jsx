import { useState, useCallback, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import Fuse from 'fuse.js';
import LensCanvas from '../components/LensCanvas';
import BoardView from '../components/BoardView';
import FilterPanel from '../components/FilterPanel';
import PrintExportButton from '../components/PrintExportButton';
import useExplorerStore, { serializeParams, deserializeParams } from '../store/useExplorerStore';
import { STRENGTH_COLOR, STRENGTH_LABEL } from '../utils/boardUtils';
import { FLAVORS } from '../data/flavors_data';

// ── Minimal search bar ─────────────────────────────────────────────────────────

const fuse = new Fuse(FLAVORS.index, { keys: ['label'], threshold: 0.4, distance: 100 });

function SearchBar() {
  const [query, setQuery]   = useState('');
  const [results, setResults] = useState([]);
  const addLens   = useExplorerStore(s => s.addLens);
  const lenses    = useExplorerStore(s => s.lenses);

  const onInput = (e) => {
    const val = e.target.value;
    setQuery(val);
    if (val.trim().length < 2) { setResults([]); return; }
    const matches = fuse.search(val)
      .map(r => r.item)
      .filter(s => !lenses.find(l => l.id === s.id))
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

function DetailCard({ bubble, clientX, clientY, onClose }) {
  const cardRef = useRef(null);

  // Close on outside click — same pattern as FilterPanel
  useEffect(() => {
    const handler = (e) => {
      if (cardRef.current && !cardRef.current.contains(e.target)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  if (!bubble) return null;
  const p   = bubble.pairing;
  const col = STRENGTH_COLOR[p.strength];
  const ing = p.id ? FLAVORS.ingredients[p.id] : null;

  // Position: try right of cursor, flip left if near edge
  const left = Math.min(clientX + 20, window.innerWidth  - 310);
  const top  = Math.min(clientY - 20, window.innerHeight - 300);

  return (
    <div ref={cardRef} style={{
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
      <div style={{ fontSize: '0.68rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: col, marginBottom: 4 }}>
        {STRENGTH_LABEL[p.strength] || ''}
      </div>

      {p.modifier && (
        <div style={{ fontSize: '0.75rem', color: '#8a7450', fontStyle: 'italic', marginBottom: 6 }}>
          {p.modifier}
        </div>
      )}

      {/* Meta — right under strength */}
      {ing?.meta && (ing.meta.taste || ing.meta.weight || ing.meta.volume || ing.meta.season) && (
        <div style={{ fontSize: '0.68rem', color: '#b0a488', marginBottom: 8, lineHeight: 1.6 }}>
          {ing.meta.taste  && <div>Taste: {ing.meta.taste}</div>}
          {ing.meta.weight && <div>Weight: {ing.meta.weight}</div>}
          {ing.meta.volume && <div>Volume: {ing.meta.volume}</div>}
          {ing.meta.season && <div>Season: {ing.meta.season}</div>}
        </div>
      )}

      {bubble.lensIds.length > 1 && (
        <div style={{ fontSize: '0.68rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#b0a488', marginBottom: 8 }}>
          Shared by {bubble.lensIds.map(id => FLAVORS.ingredients[id]?.label).filter(Boolean).join(' & ')}
        </div>
      )}

      {/* Tips — italic, above quote */}
      {ing?.tips?.length > 0 && (
        <div style={{ fontSize: '0.76rem', color: '#6a5a3a', lineHeight: 1.55, fontStyle: 'italic', marginBottom: 8 }}>
          {ing.tips[0]}
        </div>
      )}

      {/* Quote — at the bottom */}
      {ing?.quotes?.length > 0 && (
        <div style={{ fontSize: '0.76rem', color: '#6a5a3a', lineHeight: 1.55, fontStyle: 'italic' }}>
          &ldquo;{ing.quotes[0].text.slice(0, 160)}{ing.quotes[0].text.length > 160 ? '…' : ''}&rdquo;
        </div>
      )}
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function ExplorerPage() {
  const activeView = useExplorerStore(s => s.activeView);
  const lenses     = useExplorerStore(s => s.lenses);
  const [detail, setDetail] = useState(null); // { bubble, clientX, clientY }
  const [searchParams] = useSearchParams();

  // Restore full state from URL query params on mount
  useEffect(() => {
    const state = deserializeParams(searchParams);
    if (state) useExplorerStore.getState().loadFromHash(state);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Always-on URL sync — writes /#/?... whenever lenses, viewport, view, or filters change
  useEffect(() => {
    let timer;
    const unsub = useExplorerStore.subscribe((state, prevState) => {
      if (
        state.lenses    === prevState.lenses    &&
        state.viewport  === prevState.viewport  &&
        state.activeView === prevState.activeView &&
        state.filters   === prevState.filters
      ) return;
      if (state.lenses.length === 0) return;
      clearTimeout(timer);
      timer = setTimeout(() => {
        const s = useExplorerStore.getState();
        const url = serializeParams(s);
        history.replaceState(null, '', url || '/');
      }, 300);
    });
    return () => { unsub(); clearTimeout(timer); };
  }, []);

  const handleBubbleClick = useCallback((bubble, clientX, clientY) => {
    setDetail(prev => prev?.bubble.uid === bubble.uid ? null : { bubble, clientX, clientY });
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100vw', height: '100vh', background: '#faf7f2', overflow: 'hidden' }}>

      {/* Header */}
      <header className="app-header" style={{
        display: 'flex', flexDirection: 'column',
        padding: '14px 28px', background: '#fff', borderBottom: '1px solid #e8e0d0',
        flexShrink: 0, zIndex: 20, gap: 10,
      }}>
        {/* Row 1: controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
          <div style={{ fontSize: '1rem', letterSpacing: '0.16em', textTransform: 'uppercase', color: '#b8863a', fontWeight: 'normal', flexShrink: 0 }}>
            Flavor <span style={{ color: '#2c2416' }}>Bible</span> Explorer
          </div>
          <SearchBar />
          <ViewToggle />
          <FilterPanel />
          {activeView === 'lens' && lenses.length > 0 && <PrintExportButton />}
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
        </div>

        {/* Row 2: ingredient pills (only when lenses are active) */}
        {lenses.length > 0 && <LensPills />}
      </header>

      {/* Main view — both views share this container so the empty-state overlay is identical */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {activeView === 'board' ? (
          <BoardView />
        ) : (
          <>
            <LensCanvas onBubbleClick={handleBubbleClick} />
            {detail && (
              <DetailCard
                bubble={detail.bubble}
                clientX={detail.clientX}
                clientY={detail.clientY}
                onClose={() => setDetail(null)}
              />
            )}
          </>
        )}

        {/* Shared empty state — same node in both views for pixel-perfect alignment */}
        {lenses.length === 0 && (
          <div style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 8, fontFamily: 'Georgia, serif',
          }}>
            <div style={{ fontSize: '0.94rem', color: '#c8b89a' }}>Search for an ingredient above to begin</div>
            <div style={{ fontSize: '0.8125rem', color: '#d8c8a8' }}>Try: garlic, lemon, chocolate, lamb, ginger…</div>
          </div>
        )}
      </div>

      {/* Hint bar */}
      <div className="app-hint-bar" style={{
        padding: '10px 24px', background: '#fff', borderTop: '1px solid #e8e0d0',
        fontSize: '0.72rem', color: '#b0a488', letterSpacing: '0.08em',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0,
      }}>
        {activeView === 'lens' ? (
          <>
            <span>Drag lenses together — shared flavors migrate to the overlap</span>
            <span>Click flavor bubble for info · Double-click to add · Scroll to resize · R to shuffle lens · E to expand overlap · Space+drag to pan · Space+scroll to zoom</span>
          </>
        ) : (
          <>
            <span>Click ingredient for full profile</span>
            <span>Click flavor chip for info</span>
          </>
        )}
      </div>
    </div>
  );
}
