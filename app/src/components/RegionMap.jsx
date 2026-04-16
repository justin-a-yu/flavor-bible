/**
 * RegionMap.jsx
 *
 * Renders world_map_regions.svg — a preprocessed SVG with 6 <g> elements,
 * one per filter region. Fills are controlled by React state:
 *
 *   selected  → gold  (#b8863a)
 *   hovered   → light gold  (rgba 184,134,58 × 0.45)
 *   dimmed    → pale warm-grey when any other region is selected
 *   default   → warm grey (#c2beb4)
 *
 * The SVG is fetched once and injected via dangerouslySetInnerHTML so we
 * can target individual <g> fills without bundling 5 MB of path data.
 */

import { useState, useEffect, useRef } from 'react';

// ── Region metadata ───────────────────────────────────────────────────────────

const REGIONS = [
  { key: 'Americas',              gId: 'region-americas'     },
  { key: 'Europe',                gId: 'region-europe'       },
  { key: 'Middle East & N. Africa', gId: 'region-me-nafrica' },
  { key: 'Africa',                gId: 'region-africa'       },
  { key: 'South & SE Asia',       gId: 'region-south-se-asia'},
  { key: 'East Asia',             gId: 'region-east-asia'    },
];

// ── Colours ───────────────────────────────────────────────────────────────────

const CLR_DEFAULT  = '#c2beb4';
const CLR_SELECTED = '#b8863a';
const CLR_HOVERED  = 'rgba(184,134,58,0.55)';
const CLR_DIMMED   = '#dbd8d1';
const CLR_OCEAN    = '#dae8f2';

// ── Component ─────────────────────────────────────────────────────────────────

export default function RegionMap({ selected = [], onToggle }) {
  const [svgMarkup, setSvgMarkup] = useState(null);
  const [hovered, setHovered]     = useState(null);
  const containerRef = useRef(null);

  // Fetch the regions SVG once
  useEffect(() => {
    fetch('/world_map_regions.svg')
      .then(r => r.text())
      .then(text => {
        // Strip the XML declaration and any width/height attrs; we'll control sizing via CSS
        const cleaned = text
          .replace(/<\?xml[^?]*\?>\s*/g, '')
          .replace(/\s+width="[^"]*"/, '')
          .replace(/\s+height="[^"]*"/, '');
        setSvgMarkup(cleaned);
      });
  }, []);

  // Update fills whenever selected/hovered/svgMarkup changes
  useEffect(() => {
    if (!containerRef.current || !svgMarkup) return;

    const anySelected = selected.length > 0;

    REGIONS.forEach(({ key, gId }) => {
      const g = containerRef.current.querySelector(`#${gId}`);
      if (!g) return;

      const isSelected = selected.includes(key);
      const isHovered  = hovered === key;

      let fill;
      if (isSelected)        fill = CLR_SELECTED;
      else if (isHovered)    fill = CLR_HOVERED;
      else if (anySelected)  fill = CLR_DIMMED;
      else                   fill = CLR_DEFAULT;

      g.setAttribute('fill', fill);
      g.style.transition = 'fill 0.18s';
    });
  }, [selected, hovered, svgMarkup]);

  // Attach mouse + click handlers after SVG is injected
  useEffect(() => {
    if (!containerRef.current || !svgMarkup) return;

    const handlers = [];

    REGIONS.forEach(({ key, gId }) => {
      const g = containerRef.current.querySelector(`#${gId}`);
      if (!g) return;

      const onEnter = () => setHovered(key);
      const onLeave = () => setHovered(null);
      const onClick = () => onToggle(key);

      g.style.cursor = 'pointer';
      g.addEventListener('mouseenter', onEnter);
      g.addEventListener('mouseleave', onLeave);
      g.addEventListener('click',      onClick);

      handlers.push({ g, onEnter, onLeave, onClick });
    });

    return () => {
      handlers.forEach(({ g, onEnter, onLeave, onClick }) => {
        g.removeEventListener('mouseenter', onEnter);
        g.removeEventListener('mouseleave', onLeave);
        g.removeEventListener('click',      onClick);
      });
    };
  }, [svgMarkup, onToggle]);

  return (
    <div style={{
      width: '100%',
      borderRadius: 6,
      overflow: 'hidden',
      lineHeight: 0,
      background: CLR_OCEAN,
    }}>
      {svgMarkup ? (
        <div
          ref={containerRef}
          dangerouslySetInnerHTML={{ __html: svgMarkup }}
          style={{ width: '100%', display: 'block' }}
        />
      ) : (
        // Loading placeholder
        <div style={{
          width: '100%', aspectRatio: '2280 / 1293',
          background: CLR_OCEAN, display: 'flex',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ fontSize: '0.7rem', color: '#a09070', letterSpacing: '0.08em' }}>
            Loading map…
          </span>
        </div>
      )}
    </div>
  );
}
