// The start of every staff: clef, key signature, time signature – read left to right until something else follows.
// Everything up to its end is no note, even where a digit or the clef's loop looks like a head.
import type { BinaryImage } from './binarize';
import type { Component, Labeled } from './components';
import { boxOf, clefKind, type GlyphKind, isMeter, keySymbolKind } from './glyphs';
import type { Clef } from './pitch-from-staff';
import { lineY, type Staff, stepAt } from './staves';
import type { Vertical } from './verticals';

export interface Header {
  readonly clef: Clef | null; // null: none seen (the photo cuts it off)
  readonly keyFifths: number | null; // null: no key signature seen (C major, or cut off with the clef)
  readonly meter: boolean; // a time signature was seen (its value comes from the bar lengths)
  readonly end: number; // x where the notes begin
}

const MAX_GAP = 1.6; // line distances between two header symbols

// Components that belong to this staff and lie near its start, left to right
export const componentsNearStart = (labeled: Labeled, staff: Staff, reach: number): Component[] => {
  const { spacing } = staff;
  return labeled.components
    .filter((c) => {
      const x = (c.x0 + c.x1) / 2;
      const y = (c.y0 + c.y1) / 2;
      return (
        c.x0 >= staff.x0 - spacing &&
        c.x0 <= staff.x0 + reach * spacing &&
        y >= lineY(staff, 0, x) - 3 * spacing &&
        y <= lineY(staff, 4, x) + 3 * spacing
      );
    })
    .sort((a, b) => a.x0 - b.x0);
};

const isSpeck = (c: Component, spacing: number): boolean => {
  const { w, h } = boxOf(c, spacing);
  return w < 0.6 && h < 0.6;
};

const CLEFS: Partial<Record<GlyphKind, Clef>> = { trebleClef: 'treble', bassClef: 'bass' };

// The octave-treble clef: a small 8 under the treble clef's foot
const hasEightBelow = (others: readonly Component[], clef: Component, spacing: number): boolean =>
  others.some((c) => {
    const { h } = boxOf(c, spacing);
    const x = (c.x0 + c.x1) / 2;
    const centre = (clef.x0 + clef.x1) / 2;
    const below = c.y0 >= clef.y1 - 1.2 * spacing && c.y0 <= clef.y1 + 0.4 * spacing;
    return h >= 0.4 && h <= 1.3 && Math.abs(x - centre) <= 0.5 * spacing && below;
  });

interface Cursor {
  end: number;
  index: number;
}

// Skips specks (the bass clef's dots, noise) and returns the next component that starts close enough
const nextNear = (components: readonly Component[], cursor: Cursor, spacing: number): Component | null => {
  while (cursor.index < components.length) {
    const c = components[cursor.index];
    if (c === undefined || c.x0 > cursor.end + MAX_GAP * spacing) return null;
    if (c.x1 <= cursor.end || !isSpeck(c, spacing)) return c;
    cursor.index++;
  }
  return null;
};

// Removing the staff lines may cut the clef into pieces: all pieces overlapping the first one count
const unionOf = (parts: readonly Component[]): Component => {
  const [first, ...rest] = parts;
  if (first === undefined) throw new RangeError('no parts');
  return rest.reduce(
    (a, b) => ({
      ...a,
      x0: Math.min(a.x0, b.x0),
      y0: Math.min(a.y0, b.y0),
      x1: Math.max(a.x1, b.x1),
      y1: Math.max(a.y1, b.y1),
      size: a.size + b.size,
    }),
    first,
  );
};

const readClef = (components: readonly Component[], staff: Staff, cursor: Cursor): Clef | null => {
  // The first tall piece: a bar number above the staff may start further left
  const first = components.find((c) => boxOf(c, staff.spacing).h >= 2);
  if (first === undefined || first.x0 > staff.x0 + 3 * staff.spacing) return null;
  const parts = components.filter((c) => c.x0 <= first.x1 && c.x1 >= first.x0);
  const whole = unionOf(parts);
  const clef = CLEFS[clefKind(whole, staff, staff.spacing)];
  if (clef === undefined) return null;
  cursor.index = Math.max(...parts.map((c) => components.indexOf(c))) + 1;
  cursor.end = whole.x1;
  const others = components.filter((c) => !parts.includes(c));
  if (clef === 'treble' && hasEightBelow(others, whole, staff.spacing)) return 'treble8';
  return clef;
};

// Staff steps of the sharps and flats of a key signature in the treble clef, in order; the bass clef has them two
// steps lower
const SHARP_STEPS = [8, 5, 9, 6, 3, 7, 4];
const FLAT_STEPS = [4, 7, 3, 6, 2, 5, 1];

// Step at which an accidental is read: the middle of a sharp, the belly of a flat
const accidentalStep = (c: Component, kind: GlyphKind, staff: Staff): number => {
  const x = (c.x0 + c.x1) / 2;
  const y = kind === 'flat' ? c.y1 - 0.5 * staff.spacing : (c.y0 + c.y1) / 2;
  return stepAt(staff, x, y);
};

// The next sharp or flat of the key signature must stand at its place – the accidental of the first note does not
const inKeyPosition = (kind: GlyphKind, index: number, step: number, clef: Clef | null): boolean => {
  const steps = kind === 'sharp' ? SHARP_STEPS : FLAT_STEPS;
  const expected = (steps[index] ?? 0) - (clef === 'bass' ? 2 : 0);
  return index < steps.length && Math.abs(step - expected) <= 1;
};

const readKey = (
  labeled: Labeled,
  width: number,
  components: readonly Component[],
  staff: Staff,
  cursor: Cursor,
  clef: Clef | null,
) => {
  let kindSeen: GlyphKind | null = null;
  let count = 0;
  for (;;) {
    const c = nextNear(components, cursor, staff.spacing);
    if (c === null) break;
    const kind = keySymbolKind(c, labeled, width, staff.spacing);
    if (kind !== 'sharp' && kind !== 'flat') break;
    if ((kindSeen !== null && kind !== kindSeen) || !inKeyPosition(kind, count, accidentalStep(c, kind, staff), clef)) {
      break;
    }
    kindSeen = kind;
    count++;
    cursor.end = Math.max(cursor.end, c.x1);
    cursor.index++;
  }
  if (kindSeen === null) return null;
  return kindSeen === 'sharp' ? count : -count;
};

// A time signature as whole pieces: digits, both digits merged, or the C of common time
const readMeterPieces = (
  labeled: Labeled,
  width: number,
  components: readonly Component[],
  staff: Staff,
  cursor: Cursor,
) => {
  let found = false;
  for (;;) {
    const c = nextNear(components, cursor, staff.spacing);
    if (c === null || !isMeter(c, labeled, width, staff)) break;
    found = true;
    cursor.end = Math.max(cursor.end, c.x1);
    cursor.index++;
  }
  return found;
};

// Ink of the clean image in columns x of the staff's upper and lower half
const halvesInk = (image: BinaryImage, staff: Staff, x: number): [number, number] => {
  const top = Math.round(lineY(staff, 0, x));
  const middle = Math.round(lineY(staff, 2, x));
  const bottom = Math.round(lineY(staff, 4, x));
  let upper = 0;
  let lower = 0;
  for (let y = top; y <= bottom; y++) {
    if (image.data[y * image.width + x] !== 1) continue;
    if (y < middle) upper++;
    else lower++;
  }
  return [upper, lower];
};

// A time signature cut into pieces by the removal of the lines (or blurred into the lines): the next cluster of
// columns after the key is 0.8 to 2.4 line distances wide, has ink in both halves of the staff and carries no stem
const readMeterColumns = (page: HeaderPage, staff: Staff, cursor: Cursor): boolean => {
  const { spacing } = staff;
  const { clean } = page;
  let x = Math.round(cursor.end + 1);
  const limit = Math.round(cursor.end + 2 * spacing);
  while (x < limit && halvesInk(clean, staff, x).every((n) => n === 0)) x++;
  if (x >= limit) return false;
  const start = x;
  let gap = 0;
  let upper = 0;
  let lower = 0;
  while (gap <= 0.2 * spacing && x < start + 3 * spacing) {
    const [u, l] = halvesInk(clean, staff, x);
    upper += u;
    lower += l;
    gap = u + l === 0 ? gap + 1 : 0;
    x++;
  }
  const end = x - gap;
  const w = (end - start) / spacing;
  const area = (end - start) * 2 * spacing;
  const stem = page.verticals.some((v) => v.x >= start && v.x <= end && v.y1 - v.y0 >= 2.5 * spacing);
  if (w < 0.8 || w > 2.4 || stem || upper < 0.15 * area || lower < 0.15 * area) return false;
  cursor.end = end;
  return true;
};

export interface HeaderPage {
  readonly clean: BinaryImage;
  readonly labeled: Labeled;
  readonly verticals: readonly Vertical[];
}

export const readHeader = (page: HeaderPage, staff: Staff): Header => {
  const { labeled, clean } = page;
  const components = componentsNearStart(labeled, staff, 24);
  const cursor: Cursor = { end: staff.x0, index: 0 };
  const clef = readClef(components, staff, cursor);
  const keyFifths = readKey(labeled, clean.width, components, staff, cursor, clef);
  const meter =
    readMeterPieces(labeled, clean.width, components, staff, cursor) || readMeterColumns(page, staff, cursor);
  return { clef, keyFifths, meter, end: cursor.end };
};
