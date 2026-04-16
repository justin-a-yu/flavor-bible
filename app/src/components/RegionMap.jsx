/**
 * RegionMap.jsx
 * Uses the Wikimedia "World Map for Locators" SVG (public domain) as a
 * background, with a transparent clickable overlay SVG defining the six
 * filter regions in the same coordinate space (viewBox 0 0 2280 1293).
 *
 * Coordinate helpers (equirectangular, centred at 10 °E):
 *   x(lon) = (lon + 170) * (2280 / 360)
 *   y(lat) = (90  - lat) * (1293 / 180)
 */

import { useState } from 'react';

// ── Region zone definitions ───────────────────────────────────────────────────
// Zones are rectangles in the map's SVG coordinate space.
// Render order matters for overlap: later = on top = wins click priority.

const REGION_ZONES = [
  {
    key: 'Americas',
    // Covers all of North + South America
    x: 0, y: 108, w: 920, h: 970,
    labelX: 430,
    labelY: 530,
    label: 'Americas',
  },
  {
    key: 'South & SE Asia',
    // Indian subcontinent, SE Asia mainland + islands, Australia
    // Rendered before East Asia so East Asia wins the shared x band at the top
    x: 1457, y: 524, w: 601, h: 460,
    labelX: 1760,
    labelY: 760,
    label: 'S & SE Asia',
    fullLabel: 'South & SE Asia',
  },
  {
    key: 'East Asia',
    // China, Japan, Korea, Mongolia, eastern Russia
    x: 1539, y: 93, w: 456, h: 431,
    labelX: 1770,
    labelY: 300,
    label: 'E. Asia',
    fullLabel: 'East Asia',
  },
  {
    key: 'Africa',
    // Sub-Saharan Africa (below ~8 °N)
    x: 963, y: 589, w: 443, h: 323,
    labelX: 1185,
    labelY: 755,
    label: 'Africa',
  },
  {
    key: 'Middle East & N. Africa',
    // North Africa, Arabian Peninsula, Levant, Iran
    x: 963, y: 388, w: 506, h: 201,
    labelX: 1220,
    labelY: 480,
    label: 'M.E. & N. Africa',
    fullLabel: 'Middle East & N. Africa',
  },
  {
    key: 'Europe',
    // Western, Central, Eastern Europe + Scandinavia
    x: 1001, y: 129, w: 329, h: 259,
    labelX: 1165,
    labelY: 262,
    label: 'Europe',
  },
];

// ── Colours ───────────────────────────────────────────────────────────────────

const CLR_SELECTED     = 'rgba(184, 134,  58, 0.50)';
const CLR_HOVER        = 'rgba(184, 134,  58, 0.20)';
const CLR_LABEL_ON     = '#5a3800';
const CLR_LABEL_HOVER  = 'rgba(60, 30, 0, 0.85)';
const CLR_LABEL_OFF    = 'rgba(50, 30, 0, 0.60)';

// ── Component ─────────────────────────────────────────────────────────────────

export default function RegionMap({ selected = [], onToggle }) {
  const [hovered, setHovered] = useState(null);

  return (
    <div style={{ position: 'relative', width: '100%', borderRadius: 6, overflow: 'hidden', lineHeight: 0, border: '1px solid #d4c9b0', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>

      {/* Real-world base map (Wikimedia CC0) */}
      <img
        src="/world_map.svg"
        alt="World map"
        draggable={false}
        style={{ width: '100%', display: 'block', userSelect: 'none' }}
      />

      {/* Clickable region overlays — same coordinate space as the map */}
      <svg
        viewBox="0 0 2280 1293"
        style={{
          position: 'absolute',
          top: 0, left: 0,
          width: '100%', height: '100%',
        }}
        aria-label="World region selector"
      >
        {REGION_ZONES.map(({ key, x, y, w, h, labelX, labelY, label, fullLabel }) => {
          const isOn  = selected.includes(key);
          const isHov = hovered === key;

          return (
            <g
              key={key}
              onClick={() => onToggle(key)}
              onMouseEnter={() => setHovered(key)}
              onMouseLeave={() => setHovered(null)}
              style={{ cursor: 'pointer' }}
            >
              <title>{fullLabel ?? label}</title>

              {/* Highlight fill */}
              <rect
                x={x} y={y} width={w} height={h}
                fill={isOn ? CLR_SELECTED : isHov ? CLR_HOVER : 'transparent'}
                style={{ transition: 'fill 0.15s' }}
              />

              {/* Label — always visible, styled by state */}
              <text
                x={labelX}
                y={labelY}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={isOn ? 82 : 72}
                fontWeight={isOn ? 700 : isHov ? 600 : 500}
                fontFamily="Georgia, serif"
                fill={isOn ? CLR_LABEL_ON : isHov ? CLR_LABEL_HOVER : CLR_LABEL_OFF}
                stroke="rgba(255,255,255,0.85)"
                strokeWidth={isOn ? 26 : 20}
                paintOrder="stroke"
                style={{ pointerEvents: 'none', userSelect: 'none', transition: 'fill 0.15s, font-size 0.1s' }}
              >
                {label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
