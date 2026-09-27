// The start of every staff: clef, key signature, time signature – read left to right until something else follows.
// Everything up to its end is no note, even where a digit or the clef's loop looks like a head.
import type { Component, Labeled } from './components';
import { accidentalKind, boxOf, clefKind, type GlyphKind, isMeter } from './glyphs';
import type { Clef } from './pitch-from-staff';
import { lineY, type Staff } from './staves';

export interface Header {
  readonly clef: Clef | null; // null: none seen (the photo cuts it off)
  readonly keyFifths: number | null; // null: no key signature seen (C major, or cut off with the clef)
  readonly digits: readonly Component[]; // time signature
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

const readKey = (labeled: Labeled, width: number, components: readonly Component[], staff: Staff, cursor: Cursor) => {
  let fifths = 0;
  let seen = false;
  for (;;) {
    const c = nextNear(components, cursor, staff.spacing);
    if (c === null) break;
    const kind = accidentalKind(c, labeled, width, staff.spacing);
    if (kind !== 'sharp' && kind !== 'flat' && kind !== 'natural') break;
    seen = true;
    if (kind === 'sharp') fifths++;
    if (kind === 'flat') fifths--;
    cursor.end = Math.max(cursor.end, c.x1);
    cursor.index++;
  }
  return seen ? fifths : null;
};

const readDigits = (
  labeled: Labeled,
  width: number,
  components: readonly Component[],
  staff: Staff,
  cursor: Cursor,
): Component[] => {
  const digits: Component[] = [];
  for (;;) {
    const c = nextNear(components, cursor, staff.spacing);
    if (c === null || !isMeter(c, labeled, width, staff)) break;
    digits.push(c);
    cursor.end = Math.max(cursor.end, c.x1);
    cursor.index++;
  }
  return digits;
};

export const readHeader = (labeled: Labeled, width: number, staff: Staff): Header => {
  const components = componentsNearStart(labeled, staff, 24);
  const cursor: Cursor = { end: staff.x0, index: 0 };
  const clef = readClef(components, staff, cursor);
  const keyFifths = readKey(labeled, width, components, staff, cursor);
  const digits = readDigits(labeled, width, components, staff, cursor);
  return { clef, keyFifths, digits, end: cursor.end };
};
