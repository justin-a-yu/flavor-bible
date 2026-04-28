import { useState, useMemo, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import useExplorerStore from '../store/useExplorerStore';
import { STRENGTH_COLOR, STRENGTH_LABEL, TIER_ORDER } from '../utils/boardUtils';
import './EditorPage.css';

function slugify(label) {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function emptyIngredient(label = '') {
  return {
    id: slugify(label),
    label,
    pairings: [],
    avoids: [],
    quotes: [],
    tips: [],
    notes: [],
    dishes: [],
    affinities: [],
    cuisines: [],
    meta: {},
    relatedIds: [],
  };
}

function resolvePairingIds(pairings, labelToId) {
  return pairings.map(p => ({ ...p, id: labelToId[p.label.toLowerCase()] ?? null }));
}

// ── useFlipUp ─────────────────────────────────────────────────────────────────
// Returns true if a dropdown should open upward to avoid being clipped.
// dropdownHeight: estimated height of the dropdown in px.

function useFlipUp(wrapRef, open, dropdownHeight = 200) {
  const [flipUp, setFlipUp] = useState(false);
  useEffect(() => {
    if (!open || !wrapRef.current) return;
    const rect = wrapRef.current.getBoundingClientRect();
    setFlipUp(rect.bottom + dropdownHeight > window.innerHeight - 8);
  }, [open, wrapRef, dropdownHeight]);
  return flipUp;
}

// ── SuggestInput ──────────────────────────────────────────────────────────────
// Controlled input that shows a filtered dropdown of suggestions.

function SuggestInput({ value, onChange, suggestions, placeholder, className }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const flipUp  = useFlipUp(wrapRef, open, 220);

  const filtered = useMemo(() => {
    const q = (value ?? '').toLowerCase().trim();
    if (!q) return [];
    return suggestions
      .filter(s => s.toLowerCase().includes(q) && s.toLowerCase() !== q)
      .slice(0, 10);
  }, [value, suggestions]);

  // Close on outside click
  useEffect(() => {
    function handle(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  return (
    <div className="suggest-wrap" ref={wrapRef}>
      <input
        className={`editor-input${className ? ' ' + className : ''}`}
        value={value ?? ''}
        placeholder={placeholder}
        onChange={e => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
      />
      {open && filtered.length > 0 && (
        <ul className={`suggest-dropdown${flipUp ? ' suggest-dropdown--up' : ''}`}>
          {filtered.map(s => (
            <li
              key={s}
              className="suggest-item"
              onMouseDown={e => { e.preventDefault(); onChange(s); setOpen(false); }}
            >
              {s}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── CuisinesEditor ────────────────────────────────────────────────────────────
// Chip-based cuisine selector with autocomplete.

function CuisinesEditor({ cuisines, onChange, allCuisines }) {
  const [inputVal, setInputVal] = useState('');
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  const filtered = useMemo(() => {
    const q = inputVal.toLowerCase().trim();
    if (!q) return [];
    return allCuisines
      .filter(c => c.toLowerCase().includes(q) && !cuisines.includes(c))
      .slice(0, 10);
  }, [inputVal, allCuisines, cuisines]);

  useEffect(() => {
    function handle(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  function add(val) {
    const v = val.trim();
    if (!v || cuisines.includes(v)) return;
    onChange([...cuisines, v]);
    setInputVal('');
    setOpen(false);
  }

  function remove(c) {
    onChange(cuisines.filter(x => x !== c));
  }

  return (
    <div className="cuisines-editor">
      <div className="cuisines-chips">
        {cuisines.map(c => (
          <span key={c} className="cuisine-chip">
            {c}
            <button
              className="cuisine-chip-remove"
              onMouseDown={e => { e.preventDefault(); remove(c); }}
            >×</button>
          </span>
        ))}
      </div>
      <div className="suggest-wrap" ref={wrapRef}>
        <input
          className="editor-input cuisines-add-input"
          value={inputVal}
          placeholder="Add cuisine…"
          onChange={e => { setInputVal(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(inputVal); } }}
        />
        {open && filtered.length > 0 && (
          <ul className="suggest-dropdown">
            {filtered.map(c => (
              <li
                key={c}
                className="suggest-item"
                onMouseDown={e => { e.preventDefault(); add(c); }}
              >
                {c}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ── StrengthPicker ────────────────────────────────────────────────────────────
// Custom dropdown that shows a colored dot + label for each strength level.

function StrengthPicker({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const flipUp  = useFlipUp(wrapRef, open, 160);

  useEffect(() => {
    function handle(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  return (
    <div className="strength-picker" ref={wrapRef}>
      <button
        type="button"
        className="strength-trigger"
        onClick={() => setOpen(o => !o)}
      >
        <span className="strength-trigger-dot" style={{ background: STRENGTH_COLOR[value] }} />
        <span className="strength-trigger-label">{STRENGTH_LABEL[value]}</span>
        <span className="strength-trigger-arrow">▾</span>
      </button>
      {open && (
        <ul className={`strength-dropdown${flipUp ? ' strength-dropdown--up' : ''}`}>
          {TIER_ORDER.map(s => (
            <li
              key={s}
              className={`strength-option${value === s ? ' strength-option--active' : ''}`}
              onMouseDown={e => { e.preventDefault(); onChange(s); setOpen(false); }}
            >
              <span className="strength-option-dot" style={{ background: STRENGTH_COLOR[s] }} />
              {STRENGTH_LABEL[s]}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── PairingRow ────────────────────────────────────────────────────────────────

function PairingRow({ pairing, onChange, onDelete, ingredientLabels }) {
  return (
    <div className="editor-pairing-row">
      <SuggestInput
        className="editor-pairing-label"
        value={pairing.label}
        placeholder="ingredient"
        suggestions={ingredientLabels}
        onChange={val => onChange({ ...pairing, label: val })}
      />
      <StrengthPicker
        value={pairing.strength}
        onChange={val => onChange({ ...pairing, strength: val })}
      />
      <input
        className="editor-input editor-pairing-modifier"
        value={pairing.modifier || ''}
        placeholder="modifier (optional)"
        onChange={e => onChange({ ...pairing, modifier: e.target.value })}
      />
      <button className="editor-btn-icon editor-delete-btn" onClick={onDelete} title="Remove">×</button>
    </div>
  );
}

// ── EditorPage ─────────────────────────────────────────────────────────────────

export default function EditorPage() {
  const flavors   = useExplorerStore(s => s.flavors);
  const labelToId = useExplorerStore(s => s.labelToId);

  const [ingredients,  setIngredients]  = useState(() => ({ ...flavors.ingredients }));
  const [selectedId,   setSelectedId]   = useState(null);
  const [draft,        setDraft]        = useState(null);
  const [modifiedIds,  setModifiedIds]  = useState(() => new Set());
  const [search,       setSearch]       = useState('');
  const [isCreating,   setIsCreating]   = useState(false);
  const [newLabel,     setNewLabel]     = useState('');
  const [newError,     setNewError]     = useState('');
  const newInputRef    = useRef(null);
  const activeItemRef  = useRef(null);

  // ── Derived / suggestion data ─────────────────────────────────────────────────

  const sortedIds = useMemo(() =>
    Object.keys(ingredients).sort((a, b) =>
      ingredients[a].label.localeCompare(ingredients[b].label)
    ),
    [ingredients]
  );

  const filteredIds = useMemo(() => {
    if (!search.trim()) return sortedIds;
    const q = search.toLowerCase();
    return sortedIds.filter(id => ingredients[id].label.toLowerCase().includes(q));
  }, [sortedIds, search, ingredients]);

  const ingredientLabels = useMemo(() =>
    Object.values(ingredients).map(i => i.label).sort(),
    [ingredients]
  );

  const metaSuggestions = useMemo(() => {
    const keys = ['taste', 'weight', 'volume', 'season', 'function', 'techniques', 'botanical relatives'];
    const result = {};
    for (const key of keys) {
      const vals = new Set();
      for (const ing of Object.values(ingredients)) {
        const v = ing.meta?.[key];
        if (v) vals.add(v);
      }
      result[key] = [...vals].sort();
    }
    return result;
  }, [ingredients]);

  const allCuisines = useMemo(() => {
    const vals = new Set();
    for (const ing of Object.values(ingredients)) {
      for (const c of (ing.cuisines ?? [])) vals.add(c);
    }
    return [...vals].sort();
  }, [ingredients]);

  // ── Actions ──────────────────────────────────────────────────────────────────

  // Resolve IDs and write current draft back to ingredients state.
  function syncDraft(currentDraft) {
    if (!currentDraft) return;
    const resolved = {
      ...currentDraft,
      pairings: resolvePairingIds(currentDraft.pairings, labelToId),
      avoids:   resolvePairingIds(currentDraft.avoids,   labelToId),
    };
    setIngredients(prev => ({ ...prev, [resolved.id]: resolved }));
    return resolved;
  }

  function selectIngredient(id) {
    // Auto-sync current draft before switching away
    if (draft) syncDraft(draft);
    setDraft(JSON.parse(JSON.stringify(ingredients[id])));
    setSelectedId(id);
    // Scroll the active sidebar item into view after render
    setTimeout(() => activeItemRef.current?.scrollIntoView({ block: 'nearest' }), 0);
  }

  function updateDraft(patch) {
    setDraft(prev => ({ ...prev, ...patch }));
    // Only trigger a re-render of sidebar once per ingredient (first edit)
    setModifiedIds(prev => {
      if (prev.has(selectedId)) return prev;
      return new Set([...prev, selectedId]);
    });
  }

  function startCreating() {
    setIsCreating(true);
    setNewLabel('');
    setTimeout(() => newInputRef.current?.focus(), 0);
  }

  function cancelCreating() {
    setIsCreating(false);
    setNewLabel('');
    setNewError('');
  }

  function confirmCreating() {
    const label = newLabel.trim();
    if (!label) { cancelCreating(); return; }
    const id = slugify(label);
    if (ingredients[id]) {
      setNewError(`"${id}" already exists`);
      newInputRef.current?.select();
      return;
    }
    // Sync current draft before switching to new ingredient
    if (draft) syncDraft(draft);
    const ing = emptyIngredient(label);
    setIngredients(prev => ({ ...prev, [id]: ing }));
    setDraft(JSON.parse(JSON.stringify(ing)));
    setSelectedId(id);
    setModifiedIds(prev => new Set([...prev, id]));
    setIsCreating(false);
    setNewLabel('');
    setNewError('');
    // Scroll new ingredient into view after render
    setTimeout(() => activeItemRef.current?.scrollIntoView({ block: 'nearest' }), 0);
  }

  function exportJson() {
    // Sync current draft so the open ingredient is always included
    const synced = draft ? { ...ingredients, [draft.id]: { ...draft, pairings: resolvePairingIds(draft.pairings, labelToId), avoids: resolvePairingIds(draft.avoids, labelToId) } } : { ...ingredients };
    const data = synced;
    const index = Object.values(data)
      .sort((a, b) => a.label.localeCompare(b.label))
      .map(({ id, label }) => ({ id, label }));
    const blob = new Blob(
      [JSON.stringify({ ingredients: data, index }, null, 2)],
      { type: 'application/json' }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'flavors_data.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Pairing / avoid helpers ──────────────────────────────────────────────────

  function addPairing(field) {
    updateDraft({ [field]: [...(draft[field] || []), { id: null, label: '', strength: 1, modifier: '' }] });
  }

  function updatePairing(field, i, val) {
    const arr = [...draft[field]];
    arr[i] = val;
    updateDraft({ [field]: arr });
  }

  function removePairing(field, i) {
    updateDraft({ [field]: draft[field].filter((_, idx) => idx !== i) });
  }

  // ── Affinity helpers ─────────────────────────────────────────────────────────

  function addAffinity() {
    updateDraft({ affinities: [...(draft.affinities || []), ''] });
  }

  function updateAffinity(i, val) {
    const arr = [...draft.affinities];
    arr[i] = val;
    updateDraft({ affinities: arr });
  }

  function removeAffinity(i) {
    updateDraft({ affinities: draft.affinities.filter((_, idx) => idx !== i) });
  }

  // ── Quote helpers ────────────────────────────────────────────────────────────

  function addQuote() {
    updateDraft({ quotes: [...(draft.quotes || []), { text: '', attribution: '' }] });
  }

  function updateQuote(i, patch) {
    const arr = [...draft.quotes];
    arr[i] = { ...arr[i], ...patch };
    updateDraft({ quotes: arr });
  }

  function removeQuote(i) {
    updateDraft({ quotes: draft.quotes.filter((_, idx) => idx !== i) });
  }

  // ── Note helpers ─────────────────────────────────────────────────────────────

  function addNote() {
    updateDraft({ notes: [...(draft.notes || []), ''] });
  }

  function updateNote(i, val) {
    const arr = [...draft.notes];
    arr[i] = val;
    updateDraft({ notes: arr });
  }

  function removeNote(i) {
    updateDraft({ notes: draft.notes.filter((_, idx) => idx !== i) });
  }

  // ── Tip helpers ──────────────────────────────────────────────────────────────

  function addTip() {
    updateDraft({ tips: [...(draft.tips || []), ''] });
  }

  function updateTip(i, val) {
    const arr = [...(draft.tips || [])];
    arr[i] = val;
    updateDraft({ tips: arr });
  }

  function removeTip(i) {
    updateDraft({ tips: draft.tips.filter((_, idx) => idx !== i) });
  }

  // ── Dish helpers ─────────────────────────────────────────────────────────────

  function addDish() {
    updateDraft({ dishes: [...(draft.dishes || []), { text: '', attribution: '' }] });
  }

  function updateDish(i, patch) {
    const arr = [...(draft.dishes || [])];
    arr[i] = { ...arr[i], ...patch };
    updateDraft({ dishes: arr });
  }

  function removeDish(i) {
    updateDraft({ dishes: draft.dishes.filter((_, idx) => idx !== i) });
  }

  // ── Related helpers ──────────────────────────────────────────────────────────

  function addRelated(id) {
    if (!id || (draft.relatedIds || []).includes(id)) return;
    updateDraft({ relatedIds: [...(draft.relatedIds || []), id] });
  }

  function removeRelated(id) {
    updateDraft({ relatedIds: draft.relatedIds.filter(r => r !== id) });
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="editor-page">
      <header className="editor-header">
        <Link to="/" className="editor-back">← Back to Explorer</Link>
        <h1 className="editor-title">Flavor <span style={{ color: '#2c2416' }}>Bible</span> Editor</h1>
        <button className="editor-export-btn" onClick={exportJson}>
          ↓ Export flavors_data.json
        </button>
      </header>

      <div className="editor-layout">

        {/* ── Sidebar ── */}
        <aside className="editor-sidebar">
          <div className="editor-sidebar-top">
            <input
              className="editor-search"
              placeholder="Search ingredients…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <button className="editor-new-btn" onClick={startCreating}>+ New</button>
          </div>
          {isCreating && (
            <div className="editor-new-row">
              <div className="editor-new-field">
                <div className="editor-new-inputs">
                  <input
                    ref={newInputRef}
                    className={`editor-input editor-new-input${newError ? ' editor-new-input--error' : ''}`}
                    value={newLabel}
                    placeholder="Ingredient name…"
                    onChange={e => { setNewLabel(e.target.value); setNewError(''); }}
                    onKeyDown={e => {
                      if (e.key === 'Enter') confirmCreating();
                      if (e.key === 'Escape') cancelCreating();
                    }}
                  />
                  <button className="editor-new-confirm" onClick={confirmCreating} title="Create">✓</button>
                  <button className="editor-btn-icon editor-delete-btn" onClick={cancelCreating} title="Cancel">×</button>
                </div>
                {newError && <div className="editor-new-error">{newError}</div>}
              </div>
            </div>
          )}
          <div className="editor-sidebar-count">
            {filteredIds.length} ingredient{filteredIds.length !== 1 ? 's' : ''}
          </div>
          <ul className="editor-ingredient-list">
            {filteredIds.map(id => (
              <li
                key={id}
                ref={selectedId === id ? activeItemRef : null}
                className={`editor-ingredient-item${selectedId === id ? ' editor-ingredient-item--active' : ''}`}
                onClick={() => selectIngredient(id)}
              >
                {ingredients[id].label}
                {modifiedIds.has(id) && (
                  <span className="editor-dirty-dot" title="Modified since load" />
                )}
              </li>
            ))}
          </ul>
        </aside>

        {/* ── Editor ── */}
        <main className="editor-editor">
          {!draft ? (
            <div className="editor-empty">Select an ingredient or create a new one.</div>
          ) : (
            <>
              <div className="editor-editor-header">
                <div>
                  <h2 className="editor-editor-title">{draft.label || '(untitled)'}</h2>
                  <div className="editor-editor-id">{draft.id}</div>
                </div>
              </div>

              {/* ── Label ── */}
              <section className="editor-section">
                <div className="editor-section-label">Label</div>
                <input
                  className="editor-input"
                  value={draft.label}
                  onChange={e => updateDraft({ label: e.target.value })}
                />
              </section>

              {/* ── Pairings ── */}
              <section className="editor-section">
                <div className="editor-section-label">
                  Pairings
                  <span className="editor-section-count">{draft.pairings?.length ?? 0}</span>
                </div>
                {draft.pairings?.map((p, i) => (
                  <PairingRow
                    key={i}
                    pairing={p}
                    ingredientLabels={ingredientLabels}
                    onChange={val => updatePairing('pairings', i, val)}
                    onDelete={() => removePairing('pairings', i)}
                  />
                ))}
                <button className="editor-add-btn" onClick={() => addPairing('pairings')}>
                  + Add pairing
                </button>
              </section>

              {/* ── Avoids ── */}
              <section className="editor-section">
                <div className="editor-section-label">
                  Avoid
                  <span className="editor-section-count">{draft.avoids?.length ?? 0}</span>
                </div>
                {draft.avoids?.map((p, i) => (
                  <PairingRow
                    key={i}
                    pairing={p}
                    ingredientLabels={ingredientLabels}
                    onChange={val => updatePairing('avoids', i, val)}
                    onDelete={() => removePairing('avoids', i)}
                  />
                ))}
                <button className="editor-add-btn" onClick={() => addPairing('avoids')}>
                  + Add avoid
                </button>
              </section>

              {/* ── Affinities ── */}
              <section className="editor-section">
                <div className="editor-section-label">
                  Affinities
                  <span className="editor-section-count">{draft.affinities?.length ?? 0}</span>
                </div>
                {draft.affinities?.map((aff, i) => (
                  <div key={i} className="editor-affinity-row">
                    <input
                      className="editor-input"
                      value={aff}
                      placeholder="e.g. ingredient + ingredient + ingredient"
                      onChange={e => updateAffinity(i, e.target.value)}
                    />
                    <button className="editor-btn-icon editor-delete-btn" onClick={() => removeAffinity(i)}>×</button>
                  </div>
                ))}
                <button className="editor-add-btn" onClick={addAffinity}>+ Add affinity</button>
              </section>

              {/* ── Meta ── */}
              <section className="editor-section">
                <div className="editor-section-label">Meta</div>
                {['taste', 'weight', 'volume', 'season', 'function', 'techniques', 'botanical relatives'].map(key => (
                  <div key={key} className="editor-meta-row">
                    <label className="editor-meta-key">
                      {key.charAt(0).toUpperCase() + key.slice(1)}
                    </label>
                    <SuggestInput
                      value={draft.meta?.[key] ?? ''}
                      placeholder={`${key}…`}
                      suggestions={metaSuggestions[key] ?? []}
                      onChange={val => updateDraft({ meta: { ...(draft.meta ?? {}), [key]: val } })}
                    />
                  </div>
                ))}
              </section>

              {/* ── Cuisines ── */}
              <section className="editor-section">
                <div className="editor-section-label">Cuisines</div>
                <CuisinesEditor
                  cuisines={draft.cuisines ?? []}
                  allCuisines={allCuisines}
                  onChange={val => updateDraft({ cuisines: val })}
                />
              </section>

              {/* ── Quotes ── */}
              <section className="editor-section">
                <div className="editor-section-label">
                  Quotes
                  <span className="editor-section-count">{draft.quotes?.length ?? 0}</span>
                </div>
                {draft.quotes?.map((q, i) => (
                  <div key={i} className="editor-quote-block">
                    <div className="editor-quote-top">
                      <textarea
                        className="editor-textarea editor-quote-text"
                        value={q.text}
                        placeholder="Quotation…"
                        rows={3}
                        onChange={e => updateQuote(i, { text: e.target.value })}
                      />
                      <button className="editor-btn-icon editor-delete-btn" onClick={() => removeQuote(i)}>×</button>
                    </div>
                    <input
                      className="editor-input editor-quote-attribution"
                      value={q.attribution ?? ''}
                      placeholder="Attribution (e.g. Chef name, restaurant)"
                      onChange={e => updateQuote(i, { attribution: e.target.value })}
                    />
                  </div>
                ))}
                <button className="editor-add-btn" onClick={addQuote}>+ Add quote</button>
              </section>

              {/* ── Notes ── */}
              <section className="editor-section">
                <div className="editor-section-label">
                  Notes
                  <span className="editor-section-count">{draft.notes?.length ?? 0}</span>
                </div>
                {draft.notes?.map((note, i) => (
                  <div key={i} className="editor-note-block">
                    <textarea
                      className="editor-textarea editor-note-text"
                      value={note}
                      placeholder="Notes…"
                      rows={5}
                      onChange={e => updateNote(i, e.target.value)}
                    />
                    <button className="editor-btn-icon editor-delete-btn editor-note-delete" onClick={() => removeNote(i)}>×</button>
                  </div>
                ))}
                <button className="editor-add-btn" onClick={addNote}>+ Add note</button>
              </section>

              {/* ── Tips ── */}
              <section className="editor-section">
                <div className="editor-section-label">
                  Tips
                  <span className="editor-section-count">{draft.tips?.length ?? 0}</span>
                </div>
                {draft.tips?.map((tip, i) => (
                  <div key={i} className="editor-note-block">
                    <textarea
                      className="editor-textarea editor-note-text"
                      value={tip}
                      placeholder="Tip…"
                      rows={2}
                      onChange={e => updateTip(i, e.target.value)}
                    />
                    <button className="editor-btn-icon editor-delete-btn editor-note-delete" onClick={() => removeTip(i)}>×</button>
                  </div>
                ))}
                <button className="editor-add-btn" onClick={addTip}>+ Add tip</button>
              </section>

              {/* ── Dishes ── */}
              <section className="editor-section">
                <div className="editor-section-label">
                  Dishes
                  <span className="editor-section-count">{draft.dishes?.length ?? 0}</span>
                </div>
                {draft.dishes?.map((d, i) => (
                  <div key={i} className="editor-quote-block">
                    <div className="editor-quote-top">
                      <textarea
                        className="editor-textarea editor-quote-text"
                        value={d.text}
                        placeholder="Dish description…"
                        rows={2}
                        onChange={e => updateDish(i, { text: e.target.value })}
                      />
                      <button className="editor-btn-icon editor-delete-btn" onClick={() => removeDish(i)}>×</button>
                    </div>
                    <input
                      className="editor-input editor-quote-attribution"
                      value={d.attribution ?? ''}
                      placeholder="Attribution (e.g. Chef name, restaurant)"
                      onChange={e => updateDish(i, { attribution: e.target.value })}
                    />
                  </div>
                ))}
                <button className="editor-add-btn" onClick={addDish}>+ Add dish</button>
              </section>

              {/* ── See also (relatedIds) ── */}
              <section className="editor-section">
                <div className="editor-section-label">
                  See Also
                  <span className="editor-section-count">{draft.relatedIds?.length ?? 0}</span>
                </div>
                <div className="cuisines-chips" style={{ marginBottom: 8 }}>
                  {(draft.relatedIds || []).map(rid => {
                    const label = ingredients[rid]?.label ?? rid;
                    return (
                      <span key={rid} className="cuisine-chip">
                        {label}
                        <button
                          className="cuisine-chip-remove"
                          onMouseDown={e => { e.preventDefault(); removeRelated(rid); }}
                        >×</button>
                      </span>
                    );
                  })}
                </div>
                <SuggestInput
                  value=""
                  placeholder="Add related ingredient…"
                  suggestions={ingredientLabels.filter(l => {
                    const rid = labelToId[l.toLowerCase()];
                    return rid && !(draft.relatedIds || []).includes(rid) && rid !== draft.id;
                  })}
                  onChange={val => {
                    const rid = labelToId[val.toLowerCase()];
                    if (rid) addRelated(rid);
                  }}
                  className="cuisines-add-input"
                />
              </section>

            </>
          )}
        </main>

      </div>
    </div>
  );
}
