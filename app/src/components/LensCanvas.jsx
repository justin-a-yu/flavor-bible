import { useEffect, useRef, useCallback } from 'react';
import useExplorerStore from '../store/useExplorerStore';
import { FLAVORS } from '../data/flavors_data';
import { seededShuffle } from '../utils/rng';
import { matchesFilters } from '../utils/filterUtils';

// ── Drawing helpers ────────────────────────────────────────────────────────────

function strengthColor(s) {
  return s >= 3 ? '#d4a840' : s === 2 ? '#e07840' : '#5a9e6a';
}

function strengthBubbleR(s) {
  return s >= 3 ? 22 : s === 2 ? 17 : 13;
}

// Pre-parsed RGB cache so hexAlpha never re-parses the same string
const _rgbCache = {};
function hexAlpha(hex, alpha) {
  if (!_rgbCache[hex]) {
    _rgbCache[hex] = [
      parseInt(hex.slice(1, 3), 16),
      parseInt(hex.slice(3, 5), 16),
      parseInt(hex.slice(5, 7), 16),
    ];
  }
  const [r, g, b] = _rgbCache[hex];
  return `rgba(${r},${g},${b},${alpha})`;
}

function wrapText(text, maxW) {
  const words = text.split(' ');
  if (words.length === 1) return [text];
  if (text.length * 6 < maxW) return [text];
  const mid = Math.ceil(words.length / 2);
  return [words.slice(0, mid).join(' '), words.slice(mid).join(' ')];
}

function orbitFraction(strength) {
  if (strength >= 3) return 0.40;
  if (strength === 2) return 0.66;
  return 0.86;
}

function ringCapacity(lensR, ringFrac, bubbleR) {
  return Math.max(1, Math.floor(2 * Math.PI * lensR * ringFrac / (2 * bubbleR + 8)));
}

function lensesOverlapping(l1, l2) {
  return Math.hypot(l1.x - l2.x, l1.y - l2.y) < (l1.r + l2.r) * 0.85;
}

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * LensCanvas — canvas-based physics simulation of ingredient lenses and pairing bubbles.
 * @param {function} onBubbleClick(bubble, clientX, clientY) — called on single-click of a bubble
 */
export default function LensCanvas({ onBubbleClick }) {
  const canvasRef = useRef(null);

  // All transient (non-React) state lives here to avoid re-renders
  const stateRef = useRef({
    bubbles:      [],
    hoveredBubble: null,
    hoveredLens:  null,
    dragging:     null,
    dragOffX:     0,
    dragOffY:     0,
    didDrag:      false,
    spaceDown:    false,
    isPanning:    false,
    panStartX:    0,
    panStartY:    0,
    animFrame:    null,
    dimLevels:    {}, // per-lens animated dim: lensId → 0.5–1.0
    ctx:          null, // cached 2d context
    overlapping:  new Set(), // precomputed "lensId:lensId" pairs that overlap this tick
  });

  // ── Bubble rebuild ──────────────────────────────────────────────────────────

  const rebuildBubbles = useCallback(() => {
    const { lenses, filters } = useExplorerStore.getState();
    const st = stateRef.current;

    // Preserve existing positions/velocities
    const existing = {};
    st.bubbles.forEach(b => {
      existing[b.uid] = { x: b.x, y: b.y, vx: b.vx, vy: b.vy, scale: b.scale };
    });

    st.bubbles = [];
    if (lenses.length === 0) return;

    // Build flavor map from all lens pairings
    const flavorMap = {};
    lenses.forEach(lens => {
      const ing = FLAVORS.ingredients[lens.id];
      if (!ing) return;

      let pairings = ing.pairings;

      // Apply content filters (cuisine / season / taste) — OR within each dimension
      const needsFilter = (
        (filters.regions?.length  > 0) ||
        (filters.cuisines?.length > 0) ||
        (filters.seasons?.length  > 0) ||
        (filters.tastes?.length   > 0)
      );
      if (needsFilter) {
        pairings = pairings.filter(p => {
          if (!p.id) return false;
          return matchesFilters(FLAVORS.ingredients[p.id], filters);
        });
      }

      const shuffled = seededShuffle(pairings, lens.seed);
      shuffled.sort((a, b) => b.strength - a.strength);

      shuffled.forEach(p => {
        // Apply strength filter
        if (filters.strengths?.length > 0 && !filters.strengths.includes(p.strength)) return;
        // Apply visibility filter
        if (filters.visibility === 'shared' && lenses.length < 2) return;

        const key = p.label.toLowerCase();
        if (!flavorMap[key]) {
          flavorMap[key] = { pairing: p, lensIds: [lens.id] };
        } else if (!flavorMap[key].lensIds.includes(lens.id)) {
          flavorMap[key].lensIds.push(lens.id);
          if (p.strength > flavorMap[key].pairing.strength)
            flavorMap[key].pairing = p;
        }
      });
    });

    // Determine which bubbles to display
    const s3Counts = {}, s2Counts = {}, s1Counts = {};
    const toDisplay = Object.values(flavorMap).filter(({ pairing, lensIds }) => {
      // Visibility filter: shared-only mode
      if (filters.visibility === 'shared' && lensIds.length < 2) return false;
      if (filters.visibility === 'individual' && lensIds.length > 1) return false;

      if (lensIds.length > 1) return true;

      const lid   = lensIds[0];
      const lensR = lenses.find(l => l.id === lid)?.r || 120;

      if (pairing.strength >= 3) {
        s3Counts[lid] = (s3Counts[lid] || 0) + 1;
        return s3Counts[lid] <= ringCapacity(lensR, 0.40, 22);
      }
      if (pairing.strength === 2) {
        s2Counts[lid] = (s2Counts[lid] || 0) + 1;
        return s2Counts[lid] <= ringCapacity(lensR, 0.66, 17);
      }
      if (pairing.strength === 1) {
        s1Counts[lid] = (s1Counts[lid] || 0) + 1;
        return s1Counts[lid] <= ringCapacity(lensR, 0.86, 13);
      }
      return false;
    });

    // Count per ring for evenly-spaced angles
    const ringTotals = {};
    toDisplay.forEach(({ pairing, lensIds }) => {
      const rKey = lensIds[0] + ':' + orbitFraction(pairing.strength);
      ringTotals[rKey] = (ringTotals[rKey] || 0) + 1;
    });

    const ringCounters = {};
    toDisplay.forEach(({ pairing, lensIds }) => {
      const isShared  = lensIds.length > 1;
      const ownerLens = lenses.find(l => l.id === lensIds[0]);
      const baseR     = strengthBubbleR(pairing.strength);
      const lensId    = lensIds[0];
      const uid       = lensId + ':' + pairing.label;
      const ring      = orbitFraction(pairing.strength);
      const rKey      = lensId + ':' + ring;

      if (!ringCounters[rKey]) ringCounters[rKey] = 0;
      const idx        = ringCounters[rKey]++;
      const total      = ringTotals[rKey] || 1;
      const orbitAngle = (idx / total) * Math.PI * 2 - Math.PI / 2;
      const orbitDist  = (ownerLens?.r || 120) * ring;

      const prev = existing[uid];

      st.bubbles.push({
        uid, id: pairing.id, label: pairing.label, pairing,
        lensIds, isShared,
        ownerColor: ownerLens ? ownerLens.color : '#888',
        r: baseR, orbitAngle, orbitDist,
        ringIdx: idx,
        x:  prev ? prev.x  : (ownerLens?.x != null ? ownerLens.x + Math.cos(orbitAngle) * orbitDist : 0),
        y:  prev ? prev.y  : (ownerLens?.y != null ? ownerLens.y + Math.sin(orbitAngle) * orbitDist : 0),
        vx: prev ? prev.vx : 0,
        vy: prev ? prev.vy : 0,
        scale: prev ? prev.scale : (isShared ? 0 : 1),
      });
    });
  }, []);

  // ── Physics ─────────────────────────────────────────────────────────────────

  const tick = useCallback(() => {
    const { lenses } = useExplorerStore.getState();
    const st = stateRef.current;

    // Precompute all overlapping lens pairs once per tick (used many times below)
    st.overlapping = new Set();
    for (let i = 0; i < lenses.length; i++) {
      for (let j = i + 1; j < lenses.length; j++) {
        if (lensesOverlapping(lenses[i], lenses[j])) {
          st.overlapping.add(lenses[i].id + ':' + lenses[j].id);
          st.overlapping.add(lenses[j].id + ':' + lenses[i].id);
        }
      }
    }

    const areLensesOverlapping = (a, b) =>
      st.overlapping.has(a.id + ':' + b.id);

    const sharedBubbleVisible = (b) => {
      if (!b.isShared || lenses.length < 2) return false;
      const owning = lenses.filter(l => b.lensIds.includes(l.id));
      for (let i = 0; i < owning.length; i++)
        for (let j = i + 1; j < owning.length; j++)
          if (!areLensesOverlapping(owning[i], owning[j])) return false;
      return true;
    };

    const damping = 0.82;

    st.bubbles.forEach(b => {
      const lens = lenses.find(l => l.id === b.lensIds[0]);
      if (!lens) return;

      // Shared bubbles at the intersection when lenses overlap; orbit owner ring otherwise
      const atIntersection = b.isShared && sharedBubbleVisible(b);

      let blockHalf   = 0;
      let dangerAngle = 0;
      let fitsInSafeArc = true;

      // Compute blocked arc for any bubble that is orbiting the owner lens
      if (!atIntersection) {
        const overlapping = lenses.filter(o => o !== lens && areLensesOverlapping(lens, o));
        if (overlapping.length > 0) {
          let dX = 0, dY = 0;
          overlapping.forEach(o => {
            const dx = o.x - lens.x, dy = o.y - lens.y;
            const d  = Math.hypot(dx, dy) || 1;
            dX += dx / d; dY += dy / d;
            const cosA = (b.orbitDist * b.orbitDist + d * d - o.r * o.r) / (2 * b.orbitDist * d);
            const ba   = cosA >= 1 ? 0 : cosA <= -1 ? Math.PI : Math.acos(cosA);
            if (ba > blockHalf) blockHalf = ba;
          });
          dangerAngle = Math.atan2(dY, dX);

          if (!b.isShared) {
            const safeArcLen = Math.max(0, 2 * Math.PI - 2 * blockHalf) * b.orbitDist;
            const safeFit    = Math.floor(safeArcLen / (2 * b.r + 8));
            fitsInSafeArc    = b.ringIdx < safeFit;
          }
        }
      }

      // Shared bubbles are always visible; they orbit until lenses meet, then migrate
      const targetScale = b.isShared ? 1 : (fitsInSafeArc ? 1 : 0);
      b.scale += (targetScale - b.scale) * 0.12;
      if (b.scale < 0.01) return;

      let tx, ty;

      if (atIntersection) {
        // Lenses overlapping — pull shared bubble to the midpoint
        const owning = lenses.filter(l => b.lensIds.includes(l.id));
        tx = owning.reduce((s, l) => s + l.x, 0) / owning.length;
        ty = owning.reduce((s, l) => s + l.y, 0) / owning.length;
      } else if (blockHalf > 0 && !b.isShared) {
        // Non-shared: remap into safe arc away from overlap zone
        const safeStart   = dangerAngle + blockHalf;
        const safeArc     = 2 * Math.PI - 2 * blockHalf;
        const normPos     = (((b.orbitAngle + Math.PI / 2) / (2 * Math.PI)) % 1 + 1) % 1;
        const targetAngle = safeStart + normPos * safeArc;
        tx = lens.x + Math.cos(targetAngle) * b.orbitDist;
        ty = lens.y + Math.sin(targetAngle) * b.orbitDist;
      } else {
        // Orbit owner lens ring (non-shared normally, shared when lenses are apart)
        tx = lens.x + Math.cos(b.orbitAngle) * b.orbitDist;
        ty = lens.y + Math.sin(b.orbitAngle) * b.orbitDist;
      }

      b.vx += (tx - b.x) * 0.018;
      b.vy += (ty - b.y) * 0.018;

      // Keep orbiting bubbles inside their owner lens boundary
      if (!atIntersection) {
        const cdx = b.x - lens.x, cdy = b.y - lens.y;
        const cd  = Math.hypot(cdx, cdy) || 1;
        const maxD = lens.r - b.r - 6;
        if (cd > maxD) {
          b.vx -= (cdx / cd) * (cd - maxD) * 0.18;
          b.vy -= (cdy / cd) * (cd - maxD) * 0.18;
        }
      }

      st.bubbles.forEach(other => {
        if (other === b || other.scale < 0.01) return;
        const rdx = b.x - other.x, rdy = b.y - other.y;
        const rd  = Math.hypot(rdx, rdy) || 1;
        const minD = b.r + other.r + 5;
        if (rd < minD) {
          const force = (minD - rd) / minD * 0.5;
          b.vx += (rdx / rd) * force * 3.5;
          b.vy += (rdy / rd) * force * 3.5;
        }
      });

      b.vx *= damping;
      b.vy *= damping;
      b.x  += b.vx;
      b.y  += b.vy;
    });
  }, []);

  // ── Draw ────────────────────────────────────────────────────────────────────

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const st = stateRef.current;
    // Use cached context — getContext on every frame is wasteful
    if (!st.ctx) st.ctx = canvas.getContext('2d');
    const ctx = st.ctx;
    const { lenses, viewport } = useExplorerStore.getState();
    const { panX, panY, zoom } = viewport;
    // Use CSS pixel dimensions for coordinate math — DPR transform handles physical scaling
    const W = canvas.offsetWidth, H = canvas.offsetHeight;

    ctx.clearRect(0, 0, W, H);
    ctx.save();
    ctx.translate(panX, panY);
    ctx.scale(zoom, zoom);

    if (lenses.length === 0) {
      ctx.fillStyle = '#c8b89a';
      ctx.font = '15px Georgia';
      ctx.textAlign = 'center';
      ctx.fillText('Search for an ingredient above to begin', W / 2, H / 2 - 10);
      ctx.font = '13px Georgia';
      ctx.fillStyle = '#d8c8a8';
      ctx.fillText('Try: garlic, lemon, chocolate, lamb, ginger…', W / 2, H / 2 + 14);
      ctx.restore();
      return;
    }

    // Draw lenses
    lenses.forEach(lens => {
      const grad = ctx.createRadialGradient(lens.x, lens.y, 0, lens.x, lens.y, lens.r);
      grad.addColorStop(0,   hexAlpha(lens.color, 0.06));
      grad.addColorStop(0.7, hexAlpha(lens.color, 0.03));
      grad.addColorStop(1,   hexAlpha(lens.color, 0.01));
      ctx.beginPath();
      ctx.arc(lens.x, lens.y, lens.r, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(lens.x, lens.y, lens.r, 0, Math.PI * 2);
      ctx.strokeStyle = hexAlpha(lens.color, 0.3);
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 4]);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = lens.color;
      ctx.font = 'bold 13px Georgia';
      ctx.textAlign = 'center';
      ctx.fillText(lens.label, lens.x, lens.y - lens.r - 10);

      if (st.hoveredLens && st.hoveredLens.id === lens.id) {
        ctx.fillStyle = hexAlpha(lens.color, 0.5);
        ctx.font = '9px Georgia';
        ctx.fillText('scroll to resize', lens.x, lens.y - lens.r - 22);
      }

      ctx.beginPath();
      ctx.arc(lens.x, lens.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = hexAlpha(lens.color, 0.35);
      ctx.fill();
    });

    // Per-lens dim: lerp each lens toward 0.5 if it overlaps another, else 1.0
    lenses.forEach(lens => {
      const overlapping = lenses.some(o => o !== lens && st.overlapping.has(lens.id + ':' + o.id));
      const target = overlapping ? 0.5 : 1;
      const cur = st.dimLevels[lens.id];
      st.dimLevels[lens.id] = (cur == null || isNaN(cur) ? 1 : cur) + (target - (cur ?? 1)) * 0.06;
    });

    // Draw bubbles
    st.bubbles.forEach(b => {
      if (b.scale < 0.01) return;

      const isHovered = st.hoveredBubble && st.hoveredBubble.uid === b.uid;
      const col = strengthColor(b.pairing.strength);
      const r   = (isHovered ? b.r + 3 : b.r) * b.scale;

      // Shared bubbles always full; non-shared bubbles use their owning lens's dim level
      const dimFactor = b.isShared ? 1 : (st.dimLevels[b.lensIds[0]] ?? 1);

      ctx.save();
      ctx.globalAlpha = b.scale * dimFactor;

      const isHolyGrail = b.pairing.strength >= 4;

      if (isHolyGrail) {
        const glowR = r + 14;
        const glow  = ctx.createRadialGradient(b.x, b.y, r * 0.8, b.x, b.y, glowR);
        glow.addColorStop(0,   hexAlpha(col, 0.45));
        glow.addColorStop(0.4, hexAlpha(col, 0.20));
        glow.addColorStop(1,   hexAlpha(col, 0));
        ctx.beginPath();
        ctx.arc(b.x, b.y, glowR, 0, Math.PI * 2);
        ctx.fillStyle = glow;
        ctx.fill();
      }

      ctx.shadowColor = hexAlpha(col, 0.2);
      ctx.shadowBlur  = isHovered ? 12 : 4;

      ctx.beginPath();
      ctx.arc(b.x, b.y, r, 0, Math.PI * 2);
      ctx.fillStyle = isHolyGrail
        ? hexAlpha(col, isHovered ? 0.5 : 0.10)
        : (isHovered ? hexAlpha(col, 0.22) : hexAlpha(col, 0.1));
      ctx.fill();

      ctx.beginPath();
      ctx.arc(b.x, b.y, r, 0, Math.PI * 2);
      ctx.strokeStyle = hexAlpha(col, isHovered ? 0.95 : 0.55);
      ctx.lineWidth = isHovered ? 2 : 1.5;
      ctx.stroke();

      ctx.shadowColor = 'transparent';
      ctx.shadowBlur  = 0;

      ctx.fillStyle  = isHovered ? col : '#4a3a20';
      ctx.font       = `${r > 20 ? 11 : 9}px Georgia`;
      ctx.textAlign  = 'center';
      const lines = wrapText(b.label, r * 1.7);
      lines.forEach((line, i) => {
        ctx.fillText(line, b.x, b.y + (i - (lines.length - 1) / 2) * 12 + 1);
      });

      if (isHovered && b.id && FLAVORS.ingredients[b.id]) {
        ctx.font      = '8px Georgia';
        ctx.fillStyle = hexAlpha(col, 0.6);
        ctx.fillText('dbl-click to expand', b.x, b.y + r + 11);
      }

      ctx.restore();
    });

    ctx.restore();
  }, []);

  // ── Animation loop ──────────────────────────────────────────────────────────

  const loop = useCallback(() => {
    tick();
    draw();
    stateRef.current.animFrame = requestAnimationFrame(loop);
  }, [tick, draw]);

  // ── Canvas coordinate helpers ───────────────────────────────────────────────

  const canvasXY = useCallback((e) => {
    const canvas = canvasRef.current;
    const rect   = canvas.getBoundingClientRect();
    const { viewport } = useExplorerStore.getState();
    return {
      ox: (e.clientX - rect.left  - viewport.panX) / viewport.zoom,
      oy: (e.clientY - rect.top   - viewport.panY) / viewport.zoom,
    };
  }, []);

  const screenXY = useCallback((e) => {
    const canvas = canvasRef.current;
    const rect   = canvas.getBoundingClientRect();
    return { sx: e.clientX - rect.left, sy: e.clientY - rect.top };
  }, []);

  // ── Hit detection ───────────────────────────────────────────────────────────

  const bubbleAt = useCallback((ox, oy) => {
    const st = stateRef.current;
    for (const b of st.bubbles) {
      if (b.scale > 0.4 && Math.hypot(ox - b.x, oy - b.y) < b.r + 5) return b;
    }
    return null;
  }, []);

  const lensAt = useCallback((ox, oy) => {
    const { lenses } = useExplorerStore.getState();
    for (let i = lenses.length - 1; i >= 0; i--) {
      if (Math.hypot(ox - lenses[i].x, oy - lenses[i].y) < lenses[i].r) return lenses[i];
    }
    return null;
  }, []);

  // ── Mount, resize, event wiring ─────────────────────────────────────────────

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Size canvas to container, capped at 2× DPR to avoid huge pixel buffers on HiDPI
    const sizeCanvas = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w   = canvas.offsetWidth;
      const h   = canvas.offsetHeight;
      canvas.width  = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.getContext('2d').setTransform(dpr, 0, 0, dpr, 0, 0);
      // Invalidate cached ctx so the transform is reapplied
      stateRef.current.ctx = null;
    };

    sizeCanvas();

    const ro = new ResizeObserver(() => {
      sizeCanvas();
      rebuildBubbles();
    });
    ro.observe(canvas);

    // Start loop
    stateRef.current.animFrame = requestAnimationFrame(loop);

    return () => {
      ro.disconnect();
      cancelAnimationFrame(stateRef.current.animFrame);
    };
  }, [loop, rebuildBubbles]);

  // Subscribe to store so any lens/filter change triggers rebuildBubbles.
  // Uses the plain subscribe API (no subscribeWithSelector middleware needed).
  useEffect(() => {
    const unsub = useExplorerStore.subscribe((state, prevState) => {
      if (state.lenses === prevState.lenses && state.filters === prevState.filters) return;

      // Place only newly-added lenses (x/y === null); existing lenses keep their positions.
      // Angle is based on the lens's index in the full array so distribution stays even.
      const canvas = canvasRef.current;
      if (canvas && state.lenses.length !== prevState.lenses.length) {
        const n = state.lenses.length;
        const { viewport } = useExplorerStore.getState();
        const cx = (canvas.offsetWidth  / 2 - viewport.panX) / viewport.zoom;
        const cy = (canvas.offsetHeight / 2 - viewport.panY) / viewport.zoom;
        const dist = n <= 1 ? 0 : 230;
        state.lenses.forEach((lens, i) => {
          if (lens.x === null || lens.y === null) {
            const angle = n === 1 ? 0 : (i / n) * Math.PI * 2 - Math.PI / 2;
            useExplorerStore.getState().updateLens(lens.id, {
              x: cx + Math.cos(angle) * dist,
              y: cy + Math.sin(angle) * dist,
            });
          }
        });
      }

      // Skip expensive rebuild when only lens x/y changed (dragging).
      // Only rebuild for structural changes: add/remove lens, radius, seed, or filters.
      const filtersChanged = state.filters !== prevState.filters;
      const structuralChange = filtersChanged ||
        state.lenses.length !== prevState.lenses.length ||
        state.lenses.some((l, i) => {
          const p = prevState.lenses[i];
          return !p || l.id !== p.id || l.r !== p.r || l.seed !== p.seed;
        });

      if (structuralChange) {
        rebuildBubbles();
      }
    });
    // Seed initial bubbles
    rebuildBubbles();
    return unsub;
  }, [rebuildBubbles]);

  // Canvas and document event listeners
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const st = stateRef.current;

    const onMouseDown = (e) => {
      if (st.spaceDown) {
        st.isPanning = true;
        const { sx, sy } = screenXY(e);
        st.panStartX = sx; st.panStartY = sy;
        canvas.style.cursor = 'grabbing';
        return;
      }
      const { ox, oy } = canvasXY(e);
      const { sx, sy } = screenXY(e);
      st.didDrag = false;
      st.mouseDownSX = sx;
      st.mouseDownSY = sy;
      const lens = lensAt(ox, oy);
      if (lens) {
        st.dragging = lens;
        st.dragOffX = ox - lens.x;
        st.dragOffY = oy - lens.y;
      }
    };

    const onMouseMove = (e) => {
      if (st.isPanning) {
        const { sx, sy } = screenXY(e);
        const dx = sx - st.panStartX;
        const dy = sy - st.panStartY;
        st.panStartX = sx; st.panStartY = sy;
        useExplorerStore.getState().setViewport({
          panX: useExplorerStore.getState().viewport.panX + dx,
          panY: useExplorerStore.getState().viewport.panY + dy,
        });
        return;
      }

      const { ox, oy } = canvasXY(e);

      if (st.dragging) {
        const { sx, sy } = screenXY(e);
        const moved = Math.hypot(sx - st.mouseDownSX, sy - st.mouseDownSY);
        if (!st.didDrag && moved < 4) return;
        // Move lens directly — update the store lens position
        useExplorerStore.getState().updateLens(st.dragging.id, {
          x: ox - st.dragOffX,
          y: oy - st.dragOffY,
        });
        st.didDrag = true;
        return;
      }

      const b = bubbleAt(ox, oy);
      if (b !== st.hoveredBubble) {
        st.hoveredBubble = b;
        canvas.style.cursor = st.spaceDown ? 'grab' : (b ? 'pointer' : 'default');
      }
      const l = lensAt(ox, oy);
      st.hoveredLens = l || null;
    };

    const onMouseUp = (e) => {
      if (st.isPanning) {
        st.isPanning = false;
        canvas.style.cursor = st.spaceDown ? 'grab' : 'default';
        return;
      }
      const wasDragging = st.dragging && st.didDrag;
      const wasLens     = st.dragging;
      st.dragging = null;

      if (wasDragging) {
        return;
      }
      // If we clicked inside a lens without dragging, don't open a bubble detail
      const { ox, oy } = canvasXY(e);
      const b = bubbleAt(ox, oy);
      if (b) {
        if (onBubbleClick) onBubbleClick(b, e.clientX, e.clientY);
      }
    };

    const onDblClick = (e) => {
      if (st.spaceDown) return;
      const { ox, oy } = canvasXY(e);
      const b = bubbleAt(ox, oy);
      if (!b || !b.id || !FLAVORS.ingredients[b.id]) return;
      const { lenses } = useExplorerStore.getState();
      if (lenses.find(l => l.id === b.id)) return;
      useExplorerStore.getState().addLens(b.id);
    };

    const onWheel = (e) => {
      e.preventDefault();
      const { viewport } = useExplorerStore.getState();

      if (st.spaceDown) {
        // Zoom canvas
        const { sx, sy } = screenXY(e);
        const factor  = e.deltaY > 0 ? 0.92 : 1.08;
        const newZoom = Math.max(0.15, Math.min(8, viewport.zoom * factor));
        useExplorerStore.getState().setViewport({
          panX: sx - (sx - viewport.panX) * newZoom / viewport.zoom,
          panY: sy - (sy - viewport.panY) * newZoom / viewport.zoom,
          zoom: newZoom,
        });
        return;
      }

      const { ox, oy } = canvasXY(e);
      const lens = lensAt(ox, oy);
      if (!lens) return;
      const delta = e.deltaY > 0 ? -10 : 10;
      useExplorerStore.getState().updateLens(lens.id, { r: Math.max(80, lens.r + delta) });
    };

    const onMouseLeave = () => {
      st.isPanning    = false;
      st.dragging     = null;
      st.hoveredLens  = null;
      st.hoveredBubble = null;
    };

    const onKeyDown = (e) => {
      if (e.code === 'Space' && !e.repeat) {
        st.spaceDown = true;
        canvas.style.cursor = 'grab';
        e.preventDefault();
      }
      if ((e.key === 'r' || e.key === 'R') && st.hoveredLens) {
        useExplorerStore.getState().updateLens(st.hoveredLens.id, {
          seed: Math.floor(Math.random() * 0xffffffff),
        });
        rebuildBubbles();
      }
    };

    const onKeyUp = (e) => {
      if (e.code === 'Space') {
        st.spaceDown = false;
        st.isPanning = false;
        canvas.style.cursor = st.hoveredBubble ? 'pointer' : 'default';
      }
    };

    canvas.addEventListener('mousedown',  onMouseDown);
    canvas.addEventListener('mousemove',  onMouseMove);
    canvas.addEventListener('mouseup',    onMouseUp);
    canvas.addEventListener('dblclick',   onDblClick);
    canvas.addEventListener('wheel',      onWheel,     { passive: false });
    canvas.addEventListener('mouseleave', onMouseLeave);
    document.addEventListener('keydown',  onKeyDown);
    document.addEventListener('keyup',    onKeyUp);

    return () => {
      canvas.removeEventListener('mousedown',  onMouseDown);
      canvas.removeEventListener('mousemove',  onMouseMove);
      canvas.removeEventListener('mouseup',    onMouseUp);
      canvas.removeEventListener('dblclick',   onDblClick);
      canvas.removeEventListener('wheel',      onWheel);
      canvas.removeEventListener('mouseleave', onMouseLeave);
      document.removeEventListener('keydown',  onKeyDown);
      document.removeEventListener('keyup',    onKeyUp);
    };
  }, [canvasXY, screenXY, bubbleAt, lensAt, rebuildBubbles, onBubbleClick]);

  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
    />
  );
}
