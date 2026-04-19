/**
 * RegionMap.jsx
 *
 * Two-layer map:
 *  1. fillRef div — world.svg injected once via fetch (~458KB).
 *     Country fills are set imperatively by querying .sm_state_XX classes.
 *     React NEVER renders children into this div after the initial mount so
 *     innerHTML is not wiped on re-renders.
 *
 *  2. Overlay SVG — transparent rects for hit-testing + labels, pure React state.
 *
 * The 7 region SVGs in public/ are not loaded at runtime — the mapping from
 * ISO country code → region is embedded directly below.
 */

import { useState, useEffect, useRef } from 'react';

// ── Region metadata ───────────────────────────────────────────────────────────

const REGIONS = [
  { key: 'Americas',                labelX: 155, labelY: 150, shortLabel: 'Americas'         },
  { key: 'Europe',                  labelX: 368, labelY: 44,  shortLabel: 'Europe'            },
  { key: 'Middle East & N. Africa', labelX: 390, labelY: 112, shortLabel: 'M.E. & N. Africa'  },
  { key: 'Africa',                  labelX: 380, labelY: 198, shortLabel: 'Africa'            },
  { key: 'South Asia',              labelX: 490, labelY: 125, shortLabel: 'S. Asia'           },
  { key: 'Southeast Asia',          labelX: 580, labelY: 195, shortLabel: 'SE Asia'           },
  { key: 'East Asia',               labelX: 543, labelY: 78,  shortLabel: 'E. Asia'           },
];

// Clickable hit zones in viewBox coords (0 0 701 300).
// Ordered largest-first so smaller zones render on top and take pointer priority.
const ZONES = [
  { key: 'Americas',                x: 0,   y: 0,   w: 308, h: 300 },
  { key: 'Europe',                  x: 308, y: 0,   w: 120, h: 90  },
  { key: 'Middle East & N. Africa', x: 308, y: 90,  w: 168, h: 72  },
  { key: 'Africa',                  x: 308, y: 162, w: 152, h: 138 },
  { key: 'East Asia',               x: 500, y: 20,  w: 201, h: 120 },
  { key: 'Southeast Asia',          x: 455, y: 162, w: 246, h: 138 },
  { key: 'South Asia',              x: 450, y: 82,  w: 82,  h: 82  },
];

// ── Country → region mapping ──────────────────────────────────────────────────
// ISO 3166-1 alpha-2 codes. All 214 codes assigned exactly once.

const REGION_COUNTRIES = {
  'Americas': [
    'US','CA','MX','GL','BZ','GT','HN','SV','NI','CR','PA',
    'CU','JM','HT','DO','PR','TT','BB','LC','VC','GD','DM','KN','AG',
    'BS','BM','KY','VG','VI','TC','AW','AI','MS','MF','SX','CW','MQ','GP',
    'AR','BO','BR','CL','CO','EC','GY','PE','PY','SR','UY','VE','GF','FK',
  ],
  'Europe': [
    'AL','AD','AM','AT','AZ','BA','BE','BG','BY','CH','CZ','DE','DK',
    'EE','ES','FI','FO','FR','GB','GE','GR','HR','HU','IC','IE','IS',
    'IT','LI','LT','LU','LV','MD','ME','MK','MT','NL','NO','PL','PT',
    'RO','RS','RU','SE','SI','SK','UA','XK',
  ],
  'Middle East & N. Africa': [
    'AE','BH','CY','DJ','DZ','EG','EH','ER','IL','IQ','IR','JO','KW',
    'KZ','KG','LB','LY','MA','MR','OM','PS','QA','SA','SD','SY','TJ',
    'TM','TN','TR','UZ','YE',
  ],
  'Africa': [
    'AO','BI','BJ','BF','BW','CF','CG','CD','CI','CM','CV','ET','GA',
    'GH','GM','GN','GQ','GW','KE','KM','LS','LR','MG','ML','MW','MU',
    'MZ','NA','NE','NG','RE','RW','SC','SL','SN','SO','SS','ST','SZ',
    'TD','TG','TZ','UG','YT','ZA','ZM','ZW',
  ],
  'South Asia': [
    'AF','BD','BT','IN','MV','NP','PK','LK',
  ],
  'Southeast Asia': [
    'AU','BN','FJ','ID','KH','LA','MM','MY','NC','NR','NZ','PF','PG',
    'PH','PN','SB','SG','TH','TL','TO','VN','VU',
  ],
  'East Asia': [
    'CN','HK','JP','KP','KR','MN','TW',
  ],
};

// Reverse lookup: ISO code → region key (built once at module load)
const COUNTRY_TO_REGION = {};
Object.entries(REGION_COUNTRIES).forEach(([region, codes]) => {
  codes.forEach(code => { COUNTRY_TO_REGION[code] = region; });
});

// ── Colours ───────────────────────────────────────────────────────────────────

const CLR_DEFAULT  = '#c2beb5'; // matches world.svg default fill
const CLR_SELECTED = '#b8863a';
const CLR_HOVERED  = 'rgba(184,134,58,0.6)';
const CLR_DIMMED   = '#dbd9d3';

// ── Component ─────────────────────────────────────────────────────────────────

export default function RegionMap({ selected = [], onToggle }) {
  const [svgLoaded, setSvgLoaded] = useState(false);
  const [hovered, setHovered]     = useState(null);
  const fillRef    = useRef(null);
  const codeMapRef = useRef(null); // Map<isoCode, Element[]>

  // Fetch and inject world.svg once — never touched by React again
  useEffect(() => {
    fetch('/world.svg')
      .then(r => r.text())
      .then(text => {
        if (!fillRef.current) return;
        // Strip XML declaration; keep the <svg> element
        const cleaned = text.replace(/<\?xml[^>]*\?>\s*/g, '');
        fillRef.current.innerHTML = cleaned;
        const svg = fillRef.current.querySelector('svg');
        if (svg) {
          svg.style.cssText = 'display:block;width:100%;height:auto;pointer-events:none;';
        }
        // Build ISO code → [element] map for fast imperative updates
        const map = new Map();
        fillRef.current.querySelectorAll('.sm_state').forEach(el => {
          const cls = el.getAttribute('class') || '';
          const m = cls.match(/sm_state_([A-Z0-9]+)/);
          if (m) {
            const code = m[1];
            if (!map.has(code)) map.set(code, []);
            map.get(code).push(el);
          }
        });
        codeMapRef.current = map;
        setSvgLoaded(true);
      });
  }, []); // run once only

  // Update country fills on state change
  useEffect(() => {
    if (!svgLoaded || !codeMapRef.current) return;
    const anySelected = selected.length > 0;

    codeMapRef.current.forEach((elements, code) => {
      const region     = COUNTRY_TO_REGION[code];
      const isSelected = region != null && selected.includes(region);
      const isHovered  = region != null && hovered === region;
      let fill;
      if (isSelected)       fill = CLR_SELECTED;
      else if (isHovered)   fill = CLR_HOVERED;
      else if (anySelected) fill = CLR_DIMMED;
      else                  fill = CLR_DEFAULT;
      elements.forEach(el => {
        el.style.fill       = fill;
        el.style.transition = 'fill 0.18s';
      });
    });
  }, [selected, hovered, svgLoaded]);

  return (
    <div style={{ position: 'relative', width: '100%', borderRadius: 6, overflow: 'hidden', background: '#f0ede6', lineHeight: 0 }}>

      {/* Fill layer — React renders nothing here, only imperative innerHTML */}
      <div ref={fillRef} style={{ width: '100%', display: 'block' }} />

      {/* Loading placeholder — sits on top until SVG is ready */}
      {!svgLoaded && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          minHeight: 90,
        }}>
          <span style={{ fontSize: '0.7rem', color: '#a09070', letterSpacing: '0.08em' }}>Loading…</span>
        </div>
      )}

      {/* Interaction + label overlay */}
      {svgLoaded && (
        <svg
          viewBox="0 0 701 300"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
        >
          {/* Hit zones */}
          {ZONES.map(({ key, x, y, w, h }) => (
            <rect
              key={key}
              x={x} y={y} width={w} height={h}
              fill="transparent"
              style={{ cursor: 'pointer' }}
              onClick={() => onToggle(key)}
              onMouseEnter={() => setHovered(key)}
              onMouseLeave={() => setHovered(null)}
            />
          ))}

          {/* Labels */}
          {REGIONS.map(({ key, labelX, labelY, shortLabel }) => {
            const isOn  = selected.includes(key);
            const isHov = hovered === key;
            return (
              <text
                key={key}
                x={labelX}
                y={labelY}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={isOn ? 26 : 22}
                fontWeight={isOn ? 700 : 500}
                fontFamily="Georgia, serif"
                fill={isOn ? '#5a3800' : isHov ? 'rgba(60,30,0,0.85)' : 'rgba(50,30,0,0.55)'}
                stroke="rgba(255,255,255,0.85)"
                strokeWidth={isOn ? 9 : 7}
                paintOrder="stroke"
                style={{ pointerEvents: 'none', userSelect: 'none', transition: 'fill 0.15s' }}
              >
                {shortLabel}
              </text>
            );
          })}
        </svg>
      )}
    </div>
  );
}
