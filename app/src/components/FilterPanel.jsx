import { useState, useEffect, useRef } from 'react';
import useExplorerStore from '../store/useExplorerStore';
import { activeFilterCount } from '../utils/filterUtils';
import RegionMap from './RegionMap';

// ── Constants ─────────────────────────────────────────────────────────────────

const SEASONS = ['spring', 'summer', 'autumn', 'winter'];

const TASTES = ['sweet', 'sour', 'bitter', 'salty', 'umami', 'spicy'];

const VISIBILITY_OPTIONS = [
  { value: 'all',        label: 'All' },
  { value: 'shared',     label: 'Shared' },
  { value: 'individual', label: 'Individual' },
];

// ── Sub-filter components ─────────────────────────────────────────────────────

function ToggleGroup({ items, active, onToggle }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {items.map(item => {
        const isOn = active.includes(item.value ?? item);
        const val  = item.value ?? item;
        const lbl  = item.label ?? item;
        return (
          <button
            key={val}
            onClick={() => onToggle(val)}
            style={{
              padding: '4px 11px',
              fontSize: '0.72rem',
              letterSpacing: '0.06em',
              borderRadius: 20,
              border: '1px solid',
              borderColor: isOn ? '#b8863a' : '#d4c9b0',
              background:  isOn ? '#f5ecd6' : 'transparent',
              color:       isOn ? '#7a5010' : '#8a7450',
              cursor: 'pointer',
              transition: 'background 0.12s, color 0.12s, border-color 0.12s',
            }}
          >
            {lbl}
          </button>
        );
      })}
    </div>
  );
}

function RadioGroup({ options, value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      {options.map(opt => {
        const isOn = value === opt.value;
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            style={{
              padding: '4px 11px',
              fontSize: '0.72rem',
              letterSpacing: '0.06em',
              borderRadius: 20,
              border: '1px solid',
              borderColor: isOn ? '#b8863a' : '#d4c9b0',
              background:  isOn ? '#f5ecd6' : 'transparent',
              color:       isOn ? '#7a5010' : '#8a7450',
              cursor: 'pointer',
              transition: 'background 0.12s, color 0.12s, border-color 0.12s',
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

// ── FilterPanel ───────────────────────────────────────────────────────────────

export default function FilterPanel() {
  const filters      = useExplorerStore(s => s.filters);
  const toggleFilter = useExplorerStore(s => s.toggleFilter);
  const setFilter    = useExplorerStore(s => s.setFilter);
  const clearFilters = useExplorerStore(s => s.clearFilters);

  const [open, setOpen] = useState(false);
  const panelRef = useRef(null);
  const count = activeFilterCount(filters);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={panelRef} style={{ position: 'relative' }}>

      {/* Toggle button */}
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '5px 13px',
          fontSize: '0.72rem', letterSpacing: '0.08em', textTransform: 'uppercase',
          border: '1px solid', borderRadius: 7,
          borderColor: open ? '#2c2416' : count > 0 ? '#b8863a' : '#d4c9b0',
          background:  open ? '#2c2416' : count > 0 ? '#f5ecd6' : 'transparent',
          color:       open ? '#faf7f2' : count > 0 ? '#7a5010' : '#8a7450',
          cursor: 'pointer',
          fontFamily: 'Georgia, serif',
          transition: 'background 0.12s, color 0.12s, border-color 0.12s',
        }}
      >
        Filter
      </button>

      {/* Dropdown panel */}
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 8px)', right: 0,
          background: '#fff', border: '1px solid #e0d6c4',
          borderRadius: 10, boxShadow: '0 10px 32px rgba(0,0,0,0.09)',
          padding: '18px 20px', minWidth: 360, zIndex: 200,
        }}>

          {/* Region map */}
          <FilterRow label="Region">
            <RegionMap
              selected={filters.regions}
              onToggle={v => toggleFilter('regions', v)}
            />
          </FilterRow>

          {/* Season */}
          <FilterRow label="Season">
            <ToggleGroup
              items={SEASONS}
              active={filters.seasons}
              onToggle={v => toggleFilter('seasons', v)}
            />
          </FilterRow>

          {/* Taste */}
          <FilterRow label="Taste">
            <ToggleGroup
              items={TASTES}
              active={filters.tastes}
              onToggle={v => toggleFilter('tastes', v)}
            />
          </FilterRow>

          {/* Visibility */}
          <FilterRow label="Show">
            <RadioGroup
              options={VISIBILITY_OPTIONS}
              value={filters.visibility}
              onChange={v => setFilter('visibility', v)}
            />
          </FilterRow>

          {/* Clear */}
          {count > 0 && (
            <button
              onClick={clearFilters}
              style={{
                marginTop: 14, fontSize: '0.7rem', letterSpacing: '0.07em',
                textTransform: 'uppercase', color: '#b0a488', background: 'none',
                border: 'none', cursor: 'pointer', padding: 0,
                textDecoration: 'underline', fontFamily: 'Georgia, serif',
              }}
            >
              Clear all filters
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Helper ────────────────────────────────────────────────────────────────────

function FilterRow({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{
        fontSize: '0.65rem', letterSpacing: '0.1em', textTransform: 'uppercase',
        color: '#a09070', marginBottom: 7,
      }}>
        {label}
      </div>
      {children}
    </div>
  );
}
