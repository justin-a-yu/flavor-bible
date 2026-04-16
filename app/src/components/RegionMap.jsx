/**
 * RegionMap.jsx
 * Compact inline SVG world map with six clickable regions.
 * Clicking a region calls onToggle(regionLabel).
 * Selected regions are highlighted in gold.
 *
 * Projection: simplified equirectangular-ish blobs — not geographically
 * precise, but recognisable enough for a filter UI.
 * ViewBox: 0 0 340 175
 */

const REGION_SHAPES = [
  {
    key: 'Americas',
    // North + South America, left column
    path: 'M 22,12 C 46,7 76,9 92,20 C 106,29 100,42 94,52 C 88,62 100,70 100,80 C 100,94 96,110 88,128 C 80,144 69,160 54,164 L 39,164 C 29,159 23,146 34,129 C 45,112 32,93 17,70 C 7,52 7,31 16,19 Z',
    labelX: 58,
    labelY: 90,
    label: 'Americas',
  },
  {
    key: 'Europe',
    // Western / Central / Eastern Europe + Scandinavia
    path: 'M 149,26 C 162,11 180,7 200,11 C 215,15 220,26 215,39 C 210,50 198,57 185,60 C 172,63 157,61 148,54 C 140,48 141,36 149,26 Z',
    labelX: 183,
    labelY: 37,
    label: 'Europe',
  },
  {
    key: 'Middle East & N. Africa',
    // North Africa + Arabian Peninsula + Levant + Iran
    path: 'M 148,54 C 157,61 172,63 185,60 C 198,57 210,50 217,47 C 230,49 240,58 237,70 C 232,83 220,91 205,95 C 189,98 170,97 154,92 C 139,86 133,73 136,62 Z',
    labelX: 188,
    labelY: 75,
    label: 'M.E. & N. Africa',
    fullLabel: 'Middle East & N. Africa',
  },
  {
    key: 'Africa',
    // Sub-Saharan Africa
    path: 'M 136,62 C 133,73 139,86 154,92 C 170,97 189,98 205,95 C 216,103 217,124 209,146 C 201,162 186,172 168,172 L 152,172 C 138,166 126,149 122,130 C 117,110 120,92 128,78 Z',
    labelX: 170,
    labelY: 133,
    label: 'Africa',
  },
  {
    key: 'South & SE Asia',
    // Indian subcontinent + SE Asian mainland + Maritime SE Asia + Australasia
    path: 'M 237,70 C 258,59 282,51 300,56 C 318,62 326,76 322,94 C 318,112 302,126 280,133 C 260,140 240,132 232,117 C 222,100 226,82 237,70 Z',
    labelX: 282,
    labelY: 96,
    label: 'S & SE Asia',
    fullLabel: 'South & SE Asia',
  },
  {
    key: 'East Asia',
    // China, Japan, Korea, Mongolia, Siberia
    path: 'M 250,12 C 274,7 308,7 332,9 L 340,11 L 340,90 L 322,90 C 312,86 300,74 300,56 C 282,51 258,59 242,43 C 235,33 240,16 250,12 Z',
    labelX: 298,
    labelY: 47,
    label: 'E. Asia',
    fullLabel: 'East Asia',
  },
];

// ── Colours ───────────────────────────────────────────────────────────────────

const CLR_DEFAULT  = '#ddd5c2';
const CLR_HOVER    = '#f0e4c8';
const CLR_SELECTED = '#b8863a';
const CLR_BORDER   = '#faf7f2';
const CLR_LABEL_ON = '#fff';
const CLR_LABEL_OFF = '#8a7450';

// ── Component ─────────────────────────────────────────────────────────────────

export default function RegionMap({ selected = [], onToggle }) {
  return (
    <svg
      viewBox="0 0 340 175"
      style={{ width: '100%', display: 'block', cursor: 'pointer' }}
      aria-label="World region map"
    >
      {/* Ocean background */}
      <rect x="0" y="0" width="340" height="175" rx="6" fill="#e8f0f8" />

      {REGION_SHAPES.map(({ key, path, labelX, labelY, label, fullLabel }) => {
        const isOn = selected.includes(key);
        return (
          <g key={key} onClick={() => onToggle(key)} style={{ cursor: 'pointer' }}>
            <title>{fullLabel ?? label}</title>
            <path
              d={path}
              fill={isOn ? CLR_SELECTED : CLR_DEFAULT}
              stroke={CLR_BORDER}
              strokeWidth={1.5}
              style={{ transition: 'fill 0.15s' }}
              onMouseEnter={e => { if (!isOn) e.currentTarget.setAttribute('fill', CLR_HOVER); }}
              onMouseLeave={e => { if (!isOn) e.currentTarget.setAttribute('fill', CLR_DEFAULT); }}
            />
            <text
              x={labelX}
              y={labelY}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={isOn ? 8.5 : 8}
              fontWeight={isOn ? 700 : 500}
              fontFamily="Georgia, serif"
              fill={isOn ? CLR_LABEL_ON : CLR_LABEL_OFF}
              style={{ pointerEvents: 'none', userSelect: 'none', transition: 'fill 0.15s' }}
            >
              {label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
