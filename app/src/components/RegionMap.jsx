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
  { key: 'Americas',                shortLabel: 'Americas'        },
  { key: 'Europe',                  shortLabel: 'Europe'          },
  { key: 'Middle East & N. Africa', shortLabel: 'M.E. & N. Africa'},
  { key: 'Africa',                  shortLabel: 'Africa'          },
  { key: 'South Asia',              shortLabel: 'S. Asia'         },
  { key: 'Southeast Asia',          shortLabel: 'SE Asia'         },
  { key: 'East Asia',               shortLabel: 'E. Asia'         },
];

// Clickable hit zones in viewBox coords (0 0 701 300).
// Ordered largest-first so smaller zones render on top and take pointer priority.
// Tuned against actual country centroids (scale factor 0.3474 from world.svg internal coords):
//   TR(408,88)  → ME+NA   NG(360,154) ET(422,154) → Africa
//   TH(540,145) VN(548,139)           → SE Asia    PK(472,107) IN(501,126) → S.Asia
const ZONES = [
  { key: 'Americas',                x: 0,   y: 0,   w: 308, h: 300 },
  { key: 'Europe',                  x: 308, y: 0,   w: 130, h: 88  },
  { key: 'Middle East & N. Africa', x: 308, y: 88,  w: 168, h: 62  },
  { key: 'Africa',                  x: 308, y: 150, w: 155, h: 150 },
  { key: 'East Asia',               x: 500, y: 15,  w: 201, h: 115 },
  { key: 'Southeast Asia',          x: 455, y: 130, w: 246, h: 170 },
  { key: 'South Asia',              x: 447, y: 82,  w: 85,  h: 88  },
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

export default function RegionMap({ selected = [], onToggle, untaggedActive = false, onUntaggedToggle }) {
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
    <div>
      {/* Map — padded top/bottom for breathing room */}
      <div style={{ position: 'relative', width: '100%', borderRadius: 6, overflow: 'hidden', background: '#f0ede6', lineHeight: 0, paddingTop: 8, paddingBottom: 8 }}>

        {/* Fill layer — React renders nothing here, only imperative innerHTML */}
        <div ref={fillRef} style={{ width: '100%', display: 'block' }} />

        {/* Loading placeholder */}
        {!svgLoaded && (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            minHeight: 90,
          }}>
            <span style={{ fontSize: '0.7rem', color: '#a09070', letterSpacing: '0.08em' }}>Loading…</span>
          </div>
        )}

        {/* Hit-zone overlay — no labels, just transparent rects */}
        {svgLoaded && (
          <svg
            viewBox="0 0 701 300"
            style={{ position: 'absolute', top: 8, bottom: 8, left: 0, right: 0, width: '100%', height: 'calc(100% - 16px)' }}
          >
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
          </svg>
        )}
      </div>

      {/* Region chips + Untagged — always rendered so panel height stays stable */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 8 }}>
        {REGIONS.map(({ key, shortLabel }) => {
          const isOn  = selected.includes(key);
          const isHov = hovered === key;
          return (
            <button
              key={key}
              onClick={() => onToggle(key)}
              onMouseEnter={() => setHovered(key)}
              onMouseLeave={() => setHovered(null)}
              style={{
                padding: '3px 10px',
                fontSize: '0.68rem',
                letterSpacing: '0.05em',
                borderRadius: 12,
                border: '1px solid',
                borderColor: isOn ? '#b8863a' : isHov ? '#c9a870' : '#d4c9b0',
                background:  isOn ? '#f5ecd6' : 'transparent',
                color:       isOn ? '#7a5010' : isHov ? '#6a4a20' : '#8a7450',
                cursor: 'pointer',
                fontFamily: 'Georgia, serif',
                transition: 'background 0.12s, color 0.12s, border-color 0.12s',
              }}
            >
              {shortLabel}
            </button>
          );
        })}
        {onUntaggedToggle && (
          <button
            onClick={onUntaggedToggle}
            style={{
              padding: '3px 10px',
              fontSize: '0.68rem',
              letterSpacing: '0.05em',
              borderRadius: 12,
              border: '1px solid',
              borderColor: untaggedActive ? '#b8863a' : '#d4c9b0',
              background:  untaggedActive ? '#f5ecd6' : 'transparent',
              color:       untaggedActive ? '#7a5010' : '#8a7450',
              cursor: 'pointer',
              fontFamily: 'Georgia, serif',
              transition: 'background 0.12s, color 0.12s, border-color 0.12s',
            }}
          >
            Untagged
          </button>
        )}
      </div>
    </div>
  );
}
