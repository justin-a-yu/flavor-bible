import { useState, useMemo, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import useExplorerStore from '../store/useExplorerStore';
import { STRENGTH_COLOR, STRENGTH_LABEL, TIER_ORDER } from '../utils/boardUtils';
import './AdminPage.css';

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

// ── SuggestInput ──────────────────────────────────────────────────────────────
// Controlled input that shows a filtered dropdown of suggestions.

function SuggestInput({ value, onChange, suggestions, placeholder, className }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

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
        className={`admin-input${className ? ' ' + className : ''}`}
        value={value ?? ''}
        placeholder={placeholder}
        onChange={e => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
      />
      {open && filtered.length > 0 && (
        <ul className="suggest-dropdown">
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
          className="admin-input cuisines-add-input"
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
        <ul className="strength-dropdown">
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
    <div className="admin-pairing-row">
      <SuggestInput
        className="admin-pairing-label"
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
        className="admin-input admin-pairing-modifier"
        value={pairing.modifier || ''}
        placeholder="modifier (optional)"
        onChange={e => onChange({ ...pairing, modifier: e.target.value })}
      />
      <button className="admin-btn-icon admin-delete-btn" onClick={onDelete} title="Remove">×</button>
    </div>
  );
}

// ── AdminPage ─────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const flavors   = useExplorerStore(s => s.flavors);
  const labelToId = useExplorerStore(s => s.labelToId);

  const [ingredients,  setIngredients]  = useState(() => ({ ...flavors.ingredients }));
  const [selectedId,   setSelectedId]   = useState(null);
  const [draft,        setDraft]        = useState(null);
  const [dirty,        setDirty]        = useState(false);
  const [search,       setSearch]       = useState('');
  const [isCreating,   setIsCreating]   = useState(false);
  const [newLabel,     setNewLabel]     = useState('');
  const newInputRef = useRef(null);

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

  function selectIngredient(id) {
    setDraft(JSON.parse(JSON.stringify(ingredients[id])));
    setSelectedId(id);
    setDirty(false);
  }

  function updateDraft(patch) {
    setDraft(prev => ({ ...prev, ...patch }));
    setDirty(true);
  }

  function saveDraft() {
    const resolved = {
      ...draft,
      pairings: resolvePairingIds(draft.pairings, labelToId),
      avoids:   resolvePairingIds(draft.avoids,   labelToId),
    };
    setIngredients(prev => ({ ...prev, [resolved.id]: resolved }));
    setDraft(resolved);
    setDirty(false);
  }

  function startCreating() {
    setIsCreating(true);
    setNewLabel('');
    setTimeout(() => newInputRef.current?.focus(), 0);
  }

  function cancelCreating() {
    setIsCreating(false);
    setNewLabel('');
  }

  function confirmCreating() {
    const label = newLabel.trim();
    if (!label) { cancelCreating(); return; }
    const id = slugify(label);
    if (ingredients[id]) {
      newInputRef.current?.select();
      return;
    }
    const ing = emptyIngredient(label);
    setIngredients(prev => ({ ...prev, [id]: ing }));
    setDraft(JSON.parse(JSON.stringify(ing)));
    setSelectedId(id);
    setIsCreating(false);
    setNewLabel('');
    setDirty(false);
  }

  function exportJson() {
    const data = dirty && draft ? { ...ingredients, [draft.id]: draft } : { ...ingredients };
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

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="admin-page">
      <header className="admin-header">
        <Link to="/" className="admin-back">← Back to Explorer</Link>
        <h1 className="admin-title">Admin</h1>
        <button className="admin-export-btn" onClick={exportJson}>
          ↓ Export flavors_data.json
        </button>
      </header>

      <div className="admin-layout">

        {/* ── Sidebar ── */}
        <aside className="admin-sidebar">
          <div className="admin-sidebar-top">
            <input
              className="admin-search"
              placeholder="Search ingredients…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <button className="admin-new-btn" onClick={startCreating}>+ New</button>
          </div>
          {isCreating && (
            <div className="admin-new-row">
              <input
                ref={newInputRef}
                className="admin-input admin-new-input"
                value={newLabel}
                placeholder="Ingredient name…"
                onChange={e => setNewLabel(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') confirmCreating();
                  if (e.key === 'Escape') cancelCreating();
                }}
              />
              <button className="admin-new-confirm" onClick={confirmCreating} title="Create">✓</button>
              <button className="admin-btn-icon admin-delete-btn" onClick={cancelCreating} title="Cancel">×</button>
            </div>
          )}
          <div className="admin-sidebar-count">
            {filteredIds.length} ingredient{filteredIds.length !== 1 ? 's' : ''}
          </div>
          <ul className="admin-ingredient-list">
            {filteredIds.map(id => (
              <li
                key={id}
                className={`admin-ingredient-item${selectedId === id ? ' admin-ingredient-item--active' : ''}`}
                onClick={() => selectIngredient(id)}
              >
                {ingredients[id].label}
                {selectedId === id && dirty && (
                  <span className="admin-dirty-dot" title="Unsaved changes" />
                )}
              </li>
            ))}
          </ul>
        </aside>

        {/* ── Editor ── */}
        <main className="admin-editor">
          {!draft ? (
            <div className="admin-empty">Select an ingredient or create a new one.</div>
          ) : (
            <>
              <div className="admin-editor-header">
                <div>
                  <h2 className="admin-editor-title">{draft.label || '(untitled)'}</h2>
                  <div className="admin-editor-id">{draft.id}</div>
                </div>
                <button
                  className={`admin-save-btn${dirty ? ' admin-save-btn--dirty' : ''}`}
                  onClick={saveDraft}
                  disabled={!dirty}
                >
                  {dirty ? 'Save' : 'Saved'}
                </button>
              </div>

              {/* ── Label ── */}
              <section className="admin-section">
                <div className="admin-section-label">Label</div>
                <input
                  className="admin-input"
                  value={draft.label}
                  onChange={e => updateDraft({ label: e.target.value })}
                />
              </section>

              {/* ── Pairings ── */}
              <section className="admin-section">
                <div className="admin-section-label">
                  Pairings
                  <span className="admin-section-count">{draft.pairings?.length ?? 0}</span>
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
                <button className="admin-add-btn" onClick={() => addPairing('pairings')}>
                  + Add pairing
                </button>
              </section>

              {/* ── Avoids ── */}
              <section className="admin-section">
                <div className="admin-section-label">
                  Avoid
                  <span className="admin-section-count">{draft.avoids?.length ?? 0}</span>
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
                <button className="admin-add-btn" onClick={() => addPairing('avoids')}>
                  + Add avoid
                </button>
              </section>

              {/* ── Affinities ── */}
              <section className="admin-section">
                <div className="admin-section-label">
                  Affinities
                  <span className="admin-section-count">{draft.affinities?.length ?? 0}</span>
                </div>
                {draft.affinities?.map((aff, i) => (
                  <div key={i} className="admin-affinity-row">
                    <input
                      className="admin-input"
                      value={aff}
                      placeholder="e.g. ingredient + ingredient + ingredient"
                      onChange={e => updateAffinity(i, e.target.value)}
                    />
                    <button className="admin-btn-icon admin-delete-btn" onClick={() => removeAffinity(i)}>×</button>
                  </div>
                ))}
                <button className="admin-add-btn" onClick={addAffinity}>+ Add affinity</button>
              </section>

              {/* ── Meta ── */}
              <section className="admin-section">
                <div className="admin-section-label">Meta</div>
                {['taste', 'weight', 'volume', 'season', 'function', 'techniques', 'botanical relatives'].map(key => (
                  <div key={key} className="admin-meta-row">
                    <label className="admin-meta-key">
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
              <section className="admin-section">
                <div className="admin-section-label">Cuisines</div>
                <CuisinesEditor
                  cuisines={draft.cuisines ?? []}
                  allCuisines={allCuisines}
                  onChange={val => updateDraft({ cuisines: val })}
                />
              </section>

              {/* ── Quotes ── */}
              <section className="admin-section">
                <div className="admin-section-label">
                  Quotes
                  <span className="admin-section-count">{draft.quotes?.length ?? 0}</span>
                </div>
                {draft.quotes?.map((q, i) => (
                  <div key={i} className="admin-quote-block">
                    <div className="admin-quote-top">
                      <textarea
                        className="admin-textarea admin-quote-text"
                        value={q.text}
                        placeholder="Quotation…"
                        rows={3}
                        onChange={e => updateQuote(i, { text: e.target.value })}
                      />
                      <button className="admin-btn-icon admin-delete-btn" onClick={() => removeQuote(i)}>×</button>
                    </div>
                    <input
                      className="admin-input admin-quote-attribution"
                      value={q.attribution ?? ''}
                      placeholder="Attribution (e.g. Chef name, restaurant)"
                      onChange={e => updateQuote(i, { attribution: e.target.value })}
                    />
                  </div>
                ))}
                <button className="admin-add-btn" onClick={addQuote}>+ Add quote</button>
              </section>

              {/* ── Notes ── */}
              <section className="admin-section">
                <div className="admin-section-label">
                  Notes
                  <span className="admin-section-count">{draft.notes?.length ?? 0}</span>
                </div>
                {draft.notes?.map((note, i) => (
                  <div key={i} className="admin-note-block">
                    <textarea
                      className="admin-textarea admin-note-text"
                      value={note}
                      placeholder="Notes…"
                      rows={5}
                      onChange={e => updateNote(i, e.target.value)}
                    />
                    <button className="admin-btn-icon admin-delete-btn admin-note-delete" onClick={() => removeNote(i)}>×</button>
                  </div>
                ))}
                <button className="admin-add-btn" onClick={addNote}>+ Add note</button>
              </section>

            </>
          )}
        </main>

      </div>
    </div>
  );
}
