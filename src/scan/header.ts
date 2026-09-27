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
        c.x1 >= staff.x0 - spacing && // the lines may be found only from the clef's right edge on
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

// The 8 drawn onto the clef's foot: the clef reaches much further below the staff than a plain treble clef does
const eightAttached = (clef: Component, staff: Staff): boolean =>
  clef.y1 > lineY(staff, 4, (clef.x0 + clef.x1) / 2) + 2.2 * staff.spacing;

// The bass clef's dots: specks just right of it, around the F line (steps 4.5 to 7.5)
const hasDots = (components: readonly Component[], clef: Component, staff: Staff): boolean =>
  components.some((c) => {
    if (!isSpeck(c, staff.spacing) || c.x0 < clef.x1 - 0.8 * staff.spacing || c.x0 > clef.x1 + staff.spacing)
      return false;
    const step = stepAt(staff, (c.x0 + c.x1) / 2, (c.y0 + c.y1) / 2);
    return step >= 4.5 && step <= 7.5;
  });

interface Cursor {
  end: number;
  index: number;
}

// Skips specks and pieces already read and returns the next component that starts close enough
const nextNear = (components: readonly Component[], cursor: Cursor, staff: Staff): Component | null => {
  const { spacing } = staff;
  while (cursor.index < components.length) {
    const c = components[cursor.index];
    if (c === undefined || c.x0 > cursor.end + MAX_GAP * spacing) return null;
    // Header symbols stand on the staff; a tempo mark or a chord name above it is skipped
    const x = (c.x0 + c.x1) / 2;
    if (c.y1 < lineY(staff, 0, x) || c.y0 > lineY(staff, 4, x)) {
      cursor.index++;
      continue;
    }
    // Pieces within what was read already are part of it; specks (the bass clef's dots) extend it
    if (c.x1 > cursor.end && !isSpeck(c, spacing)) return c;
    if (c.x1 > cursor.end) cursor.end = c.x1;
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

const readClef = (
  components: readonly Component[],
  staff: Staff,
  cursor: Cursor,
  heads: readonly { readonly x: number; readonly y: number }[],
): Clef | null => {
  // The first tall piece: a bar number above the staff may start further left, a brace is taller than any clef
  const first = components.find((c) => boxOf(c, staff.spacing).h >= 2 && boxOf(c, staff.spacing).h <= 9);
  if (first === undefined || first.x0 > staff.x0 + 3 * staff.spacing) return null;
  // Pieces overlapping it or just left of it (the ball of a bass clef) that reach into the staff – not the bar
  // number above, not the lyrics underneath, not a bracket
  const top = lineY(staff, 0, (first.x0 + first.x1) / 2);
  const bottom = lineY(staff, 4, (first.x0 + first.x1) / 2);
  const parts = components.filter(
    (c) =>
      c.x0 <= first.x1 &&
      c.x1 >= first.x0 - 1.2 * staff.spacing &&
      c.y0 <= bottom + staff.spacing &&
      c.y1 >= top &&
      boxOf(c, staff.spacing).h <= 9 &&
      (c === first || !isSpeck(c, staff.spacing)),
  );
  const whole = unionOf(parts);
  const kind = CLEFS[clefKind(whole, staff, staff.spacing)];
  // A bass clef has its two dots; without them it is something else (a note, the remains of another clef)
  const clef = kind === 'bass' && !hasDots(components, whole, staff) ? undefined : kind;
  // A clef, or something tall without a head (a clef the photo has damaged): the header goes on after it
  const headless = !heads.some((h) => h.x >= whole.x0 && h.x <= whole.x1 && h.y >= whole.y0 && h.y <= whole.y1);
  if (clef !== undefined || (boxOf(whole, staff.spacing).h >= 3.5 && headless)) {
    cursor.index = Math.max(...parts.map((c) => components.indexOf(c))) + 1;
    cursor.end = whole.x1;
  }
  if (clef === undefined) return null;
  const others = components.filter((c) => !parts.includes(c));
  if (clef === 'treble' && (hasEightBelow(others, whole, staff.spacing) || eightAttached(whole, staff)))
    return 'treble8';
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
    const c = nextNear(components, cursor, staff);
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
    const c = nextNear(components, cursor, staff);
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
// columns after the key is 0.8 to 2.4 line distances wide, has ink in both halves of the staff and holds no note
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
  // A note there instead: a long stroke like a stem – beside a head where the heads are known (a digit's stroke
  // stands in its middle)
  const stems = page.verticals.filter((v) => v.x >= start && v.x <= end && v.y1 - v.y0 >= 2.5 * spacing);
  const note =
    page.heads === undefined
      ? stems.length > 0
      : stems.some((v) =>
          (page.heads ?? []).some(
            (h) =>
              Math.abs(Math.abs(v.x - h.x) - 0.6 * spacing) <= 0.3 * spacing &&
              h.y >= v.y0 - spacing &&
              h.y <= v.y1 + spacing,
          ),
        );
  if (w < 0.8 || w > 2.4 || note || upper < 0.15 * area || lower < 0.15 * area) return false;
  cursor.end = end;
  return true;
};

export interface HeaderPage {
  readonly clean: BinaryImage;
  readonly labeled: Labeled;
  readonly verticals: readonly Vertical[];
  readonly heads?: readonly { readonly x: number; readonly y: number }[];
}

export const readHeader = (page: HeaderPage, staff: Staff): Header => {
  const { labeled, clean } = page;
  const components = componentsNearStart(labeled, staff, 24);
  const cursor: Cursor = { end: staff.x0, index: 0 };
  const clef = readClef(components, staff, cursor, page.heads ?? []);
  const keyFifths = readKey(labeled, clean.width, components, staff, cursor, clef);
  // A time signature follows a clef; where the photo cut off the clef, a tall first note is no time signature
  const afterClef = cursor.end > staff.x0;
  const meter =
    afterClef &&
    (readMeterPieces(labeled, clean.width, components, staff, cursor) || readMeterColumns(page, staff, cursor));
  return { clef, keyFifths, meter, end: cursor.end };
};
