/**
 * boardUtils.js
 * Pure data-building helpers shared by BoardView and PrintPage.
 */

import { FLAVORS } from '../data/flavors_data';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Color assigned to each lens in order of addition. */
export const LENS_COLORS = ['#d4a840', '#c0603a', '#4a8c5c', '#7a5ab8', '#c06080', '#4a7ab8'];

// ─── Utilities ────────────────────────────────────────────────────────────────

/** Split a comma-separated string, treating commas inside parentheses as part of the item. */
export function splitOutsideParens(str) {
  const items = [];
  let depth = 0, start = 0;
  for (let i = 0; i < str.length; i++) {
    if (str[i] === '(') depth++;
    else if (str[i] === ')') depth--;
    else if (str[i] === ',' && depth === 0) {
      const item = str.slice(start, i).trim();
      if (item) items.push(item);
      start = i + 1;
    }
  }
  const last = str.slice(start).trim();
  if (last) items.push(last);
  return items;
}

// ─── Constants ────────────────────────────────────────────────────────────────

export const STRENGTH_COLOR = {
  4: '#d4a840',
  3: '#d4a840',
  2: '#e07840',
  1: '#5a9e6a',
};

export const STRENGTH_LABEL = {
  4: 'Holy Grail',
  3: 'Essential',
  2: 'Highly Recommended',
  1: 'Recommended',
};

export const TIER_ORDER = [4, 3, 2, 1];

// Label → ingredient id lookup. Indexes both the full label and the short name
// before any "(see also…)" parenthetical so affinity strings like "basil" match
// "BASIL (See also Basil, Thai, and Lemon Basil)".
export const LABEL_TO_ID = Object.fromEntries(
  FLAVORS.index.flatMap(item => {
    const full = item.label.toLowerCase();
    const entries = [[full, item.id]];
    const paren = full.indexOf(' (');
    if (paren > 0) entries.push([full.slice(0, paren).trim(), item.id]);
    return entries;
  })
);

// ─── Pure helpers ─────────────────────────────────────────────────────────────

/** All k-element ordered subsets of arr (preserving original order). */
export function combos(arr, k) {
  if (k === arr.length) return [[...arr]];
  if (k === 1) return arr.map(x => [x]);
  const out = [];
  for (let i = 0; i <= arr.length - k; i++) {
    combos(arr.slice(i + 1), k - 1).forEach(rest => out.push([arr[i], ...rest]));
  }
  return out;
}

/**
 * Single scan over all lenses. Returns a map:
 *   { [lowerCaseLabel]: { label, id, modifier, perLens: { lensId: strength } } }
 */
export function buildPairingMap(lenses, filterFn = null) {
  const map = {};
  lenses.forEach(lens => {
    const ing = FLAVORS.ingredients[lens.id];
    if (!ing) return;
    const pairings = filterFn ? ing.pairings.filter(filterFn) : ing.pairings;
    pairings.forEach(p => {
      const key = p.label.toLowerCase();
      if (!map[key]) map[key] = { label: p.label, id: p.id, modifier: p.modifier, perLens: {} };
      map[key].perLens[lens.id] = p.strength;
    });
  });
  return map;
}

/**
 * Generate "Shared by" groups for every combination of 2+ lenses.
 * Top group (all lenses) always included even when empty.
 * Smaller groups use strict intersection.
 */
export function buildSharedGroups(lenses, pairingMap) {
  const all = Object.values(pairingMap);
  const groups = [];

  for (let size = lenses.length; size >= 2; size--) {
    combos(lenses, size).forEach(combo => {
      const isTop = size === lenses.length;
      const matched = all
        .filter(p =>
          combo.every(l => p.perLens[l.id] !== undefined) &&
          (isTop || Object.keys(p.perLens).length === size)
        )
        .sort((a, b) => {
          const aMax = Math.max(...combo.map(l => a.perLens[l.id] ?? 0));
          const bMax = Math.max(...combo.map(l => b.perLens[l.id] ?? 0));
          return bMax - aMax || a.label.localeCompare(b.label);
        });

      groups.push({ label: combo.map(l => l.label).join(' & '), lenses: combo, pairings: matched, isTop });
    });
  }
  return groups;
}

/** Find affinities that span 2+ active lenses, sorted by hit count. */
export function buildAffinities(lenses) {
  if (lenses.length < 2) return [];
  const labelSet = new Set(lenses.map(l => l.label.toLowerCase()));
  const idSet    = new Set(lenses.map(l => l.id));
  const seen = new Set();
  const out  = [];

  lenses.forEach(lens => {
    const ing = FLAVORS.ingredients[lens.id];
    if (!ing) return;
    (ing.affinities || []).forEach(str => {
      if (seen.has(str)) return;
      seen.add(str);
      const parts = str.split(' + ').map(p => p.trim().toLowerCase());
      const hits = parts.filter(p => {
        const pid = LABEL_TO_ID[p] ?? null;
        return labelSet.has(p) || (pid && idSet.has(pid));
      }).length;
      if (hits >= 2) out.push({ str, hits });
    });
  });

  return out.sort((a, b) => b.hits - a.hits);
}

/** Parse an affinity string into parts with isActive / isTappable flags. */
export function parseAffinityStr(str, labelSet, idSet) {
  return str.split(' + ').map(raw => {
    const trimmed = raw.trim();
    const lower   = trimmed.toLowerCase();
    const id      = LABEL_TO_ID[lower] ?? null;
    const isActive = (id && idSet.has(id)) || labelSet.has(lower);
    return { label: trimmed, id, isActive, isTappable: !!id && !isActive };
  });
}

/**
 * Build per-lens individual pairing columns.
 * In solo mode: all pairings. In multi-lens: only those NOT in any intersection.
 */
export function buildLensColumns(lenses, pairingMap, isSolo, pairingFilterFn) {
  const sharedKeys = isSolo ? new Set() : new Set(
    Object.entries(pairingMap)
      .filter(([, p]) => Object.keys(p.perLens).length >= 2)
      .map(([key]) => key)
  );

  return lenses.map(lens => {
    const ing = FLAVORS.ingredients[lens.id];
    if (!ing) return { lens, pairings: [] };
    let pairings = isSolo ? ing.pairings : ing.pairings.filter(p => !sharedKeys.has(p.label.toLowerCase()));
    if (pairingFilterFn) pairings = pairings.filter(pairingFilterFn);
    pairings = pairings.slice().sort((a, b) => b.strength - a.strength || a.label.localeCompare(b.label));
    return { lens, pairings };
  });
}
