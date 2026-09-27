// Symbols that are one connected piece of ink once the staff lines are gone – clefs, accidentals, time signature
// digits, rests, dots – told apart by size and by their long vertical strokes, all measured in line distances.
import type { Component, Labeled } from './components';
import { numberAt } from './raster';
import { lineY, type Staff } from './staves';

export type GlyphKind =
  | 'trebleClef'
  | 'bassClef'
  | 'sharp'
  | 'flat'
  | 'natural'
  | 'digit'
  | 'wholeRest' // hangs from a line
  | 'halfRest' // sits on a line
  | 'quarterRest'
  | 'eighthRest'
  | 'sixteenthRest'
  | 'dot'
  | 'other';

export interface Glyph {
  readonly kind: GlyphKind;
  readonly component: Component;
  readonly staff: number;
}

export interface Stroke {
  readonly x: number; // centre column
  readonly y0: number;
  readonly y1: number; // exclusive
}

// Long vertical strokes of a component: groups of neighbouring columns whose longest own run covers `minShare` of
// the component's height
// The longest run of the component's own pixels in column x
const longestRun = (component: Component, labeled: Labeled, width: number, x: number): { y0: number; y1: number } => {
  let best = { y0: 0, y1: 0 };
  let y = component.y0;
  while (y <= component.y1) {
    if (labeled.labels[y * width + x] !== component.id) {
      y++;
      continue;
    }
    const start = y;
    while (y <= component.y1 && labeled.labels[y * width + x] === component.id) y++;
    if (y - start > best.y1 - best.y0) best = { y0: start, y1: y };
  }
  return best;
};

export const strokesOf = (component: Component, labeled: Labeled, width: number, minShare: number): Stroke[] => {
  const h = component.y1 - component.y0 + 1;
  const strokes: Stroke[] = [];
  let current: { xs: number[]; y0: number; y1: number } | null = null;
  for (let x = component.x0; x <= component.x1; x++) {
    const best = longestRun(component, labeled, width, x);
    const long = best.y1 - best.y0 >= minShare * h;
    if (long && current !== null) {
      current.xs.push(x);
      current.y0 = Math.min(current.y0, best.y0);
      current.y1 = Math.max(current.y1, best.y1);
    } else if (long) {
      current = { xs: [x], ...best };
    } else if (current !== null) {
      strokes.push(strokeOf(current));
      current = null;
    }
  }
  if (current !== null) strokes.push(strokeOf(current));
  return strokes;
};

const strokeOf = (group: { xs: number[]; y0: number; y1: number }): Stroke => ({
  x: group.xs.reduce((a, b) => a + b, 0) / group.xs.length,
  y0: group.y0,
  y1: group.y1,
});

export interface Box {
  readonly w: number; // in line distances
  readonly h: number;
  readonly fill: number; // ink share of the box
}

export const boxOf = (component: Component, spacing: number): Box => {
  const w = component.x1 - component.x0 + 1;
  const h = component.y1 - component.y0 + 1;
  return { w: w / spacing, h: h / spacing, fill: component.size / (w * h) };
};

const between = (value: number, low: number, high: number): boolean => value >= low && value <= high;

// Sharp and natural have two long strokes: level with each other (sharp) or the left one higher (natural)
const twoStrokeKind = (strokes: readonly Stroke[], spacing: number): GlyphKind => {
  const [left, right] = strokes;
  if (left === undefined || right === undefined) return 'other';
  const gap = (right.x - left.x) / spacing;
  if (!between(gap, 0.2, 1.0)) return 'other';
  const topShift = (right.y0 - left.y0) / spacing;
  const bottomShift = (right.y1 - left.y1) / spacing;
  if (topShift > 0.5 && bottomShift > 0.4) return 'natural';
  if (Math.abs(topShift) <= 0.5 && Math.abs(bottomShift) <= 0.6) return 'sharp';
  return 'other';
};

export const accidentalKind = (component: Component, labeled: Labeled, width: number, spacing: number): GlyphKind => {
  const { w, h } = boxOf(component, spacing);
  if (!between(h, 1.6, 3.8) || !between(w, 0.35, 1.6)) return 'other';
  const strokes = strokesOf(component, labeled, width, 0.6);
  if (strokes.length === 2) return twoStrokeKind(strokes, spacing);
  if (strokes.length !== 1 || !between(h, 1.6, 3.0) || !between(w, 0.45, 1.2)) return 'other';
  // A flat: its one stroke on the left, the belly at the bottom right
  const stroke = numberAt(
    strokes.map((s) => s.x),
    0,
  );
  return stroke - component.x0 <= 0.35 * (component.x1 - component.x0) ? 'flat' : 'other';
};

// Mean width of the component's rows between two shares of its height
const meanRowWidth = (component: Component, labeled: Labeled, width: number, from: number, to: number): number => {
  const h = component.y1 - component.y0 + 1;
  let sum = 0;
  let rows = 0;
  for (let y = component.y0 + Math.floor(from * h); y < component.y0 + Math.ceil(to * h); y++) {
    let first = -1;
    let last = -1;
    for (let x = component.x0; x <= component.x1; x++) {
      if (labeled.labels[y * width + x] !== component.id) continue;
      if (first < 0) first = x;
      last = x;
    }
    if (first >= 0) sum += last - first + 1;
    rows++;
  }
  return rows === 0 ? 0 : sum / rows;
};

// A key signature symbol too blurred for its strokes to separate: a flat is a thin stem above a wide belly, a sharp
// is about as wide at the top as at the bottom. Only for symbols already known to be in a key signature's place.
export const keySymbolKind = (component: Component, labeled: Labeled, width: number, spacing: number): GlyphKind => {
  const precise = accidentalKind(component, labeled, width, spacing);
  if (precise !== 'other') return precise;
  const { w, h } = boxOf(component, spacing);
  if (!between(h, 1.4, 3.8) || !between(w, 0.35, 1.6)) return 'other';
  const upper = meanRowWidth(component, labeled, width, 0.05, 0.35);
  const lower = meanRowWidth(component, labeled, width, 0.65, 0.95);
  return upper < 0.55 * lower ? 'flat' : 'sharp';
};

// The clef at the start of a staff: tall; the treble clef reaches beyond both outer lines, the bass clef hangs from
// the top line
export const clefKind = (component: Component, staff: Staff, spacing: number): GlyphKind => {
  const { w, h } = boxOf(component, spacing);
  if (h < 2.6 || w > 3.6 || w < 1.2) return 'other';
  const x = (component.x0 + component.x1) / 2;
  const top = lineY(staff, 0, x);
  const bottom = lineY(staff, 4, x);
  if (component.y0 < top - 0.8 * spacing && component.y1 > bottom + 0.6 * spacing) return 'trebleClef';
  if (Math.abs(component.y0 - top) <= 0.7 * spacing && component.y1 < bottom + 0.6 * spacing) return 'bassClef';
  return 'other';
};

// Share of the component's rows that are thinner than `maxWidth` pixels (from its first to its last pixel in the row)
export const thinRowShare = (component: Component, labeled: Labeled, width: number, maxWidth: number): number => {
  let thin = 0;
  for (let y = component.y0; y <= component.y1; y++) {
    let first = -1;
    let last = -1;
    for (let x = component.x0; x <= component.x1; x++) {
      if (labeled.labels[y * width + x] !== component.id) continue;
      if (first < 0) first = x;
      last = x;
    }
    if (first >= 0 && last - first + 1 <= maxWidth) thin++;
  }
  return thin / (component.y1 - component.y0 + 1);
};

// A time signature: digits filling half the staff each (from the top line to the middle line, or from there to the
// bottom line), both digits merged into one piece, or the C of common time around the middle line. A note of the
// same height is mostly a thin stem – digits are not.
export const isMeter = (component: Component, labeled: Labeled, width: number, staff: Staff): boolean => {
  const { spacing } = staff;
  const { w } = boxOf(component, spacing);
  if (!between(w, 0.8, 2.4)) return false;
  const x = (component.x0 + component.x1) / 2;
  const at = (line: number): number => lineY(staff, line, x);
  const near = (a: number, b: number): boolean => Math.abs(a - b) <= 0.45 * spacing;
  const { y0, y1 } = component;
  const placed =
    (near(y0, at(0)) && near(y1, at(2))) ||
    (near(y0, at(2)) && near(y1, at(4))) ||
    (near(y0, at(0)) && near(y1, at(4))) ||
    (near(y0, at(1)) && near(y1, at(3)));
  return placed && thinRowShare(component, labeled, width, 0.35 * spacing) < 0.3;
};
