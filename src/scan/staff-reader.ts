// One staff from its symbols: heads with their stems, beams, flags, dots and accidentals become notes, the pieces
// shaped like rests become rests, stems that carry no head and span the staff are bar lines. Chords share a stem;
// the stem direction tells the voice where two voices share a staff.
import { type Accidental, accidentalFor, accidentalsOf, beamCount, dotCount, noteValue, specksOf } from './attachments';
import type { BinaryImage } from './binarize';
import type { Component, Labeled } from './components';
import type { Head } from './heads';
import type { Header } from './header';
import { restOf } from './rests';
import { lineY, type Staff } from './staves';
import type { Vertical } from './verticals';

export interface Stem {
  readonly vertical: Vertical;
  readonly up: boolean;
}

export interface NoteHead extends Head {
  readonly accidental?: number; // alteration printed in front of it
}

export interface NoteEvent {
  readonly kind: 'note';
  readonly x: number;
  readonly heads: readonly NoteHead[]; // top → bottom
  readonly stem: Stem | null;
  readonly duration: number; // quarter notes
  readonly uncertain: boolean;
}

export interface RestEvent {
  readonly kind: 'rest';
  readonly x: number;
  readonly y: number;
  readonly duration: number;
  readonly wholeBar: boolean; // a whole rest lasts the whole bar, whatever its length
  readonly uncertain: boolean;
}

export type StaffEvent = NoteEvent | RestEvent;

export interface StaffReading {
  readonly staff: Staff;
  readonly header: Header;
  readonly events: readonly StaffEvent[]; // left to right
  readonly barlines: readonly number[]; // x, left to right
}

export interface Page {
  readonly clean: BinaryImage; // lines removed
  readonly labeled: Labeled; // its pieces
  readonly verticals: readonly Vertical[];
}

const HEAD_HALF_WIDTH = 0.6; // line distances from the centre to the side where the stem attaches

// The stem at the head's right going up, or at its left going down; heads in the middle of a chord sit along it
export const stemOf = (head: Head, verticals: readonly Vertical[], spacing: number): Stem | null => {
  let best: Stem | null = null;
  let bestScore = Infinity;
  for (const vertical of verticals) {
    if (vertical.y1 - vertical.y0 < 1.1 * spacing) continue;
    const dx = (vertical.x - head.x) / spacing;
    // The stroke starts at the head: a bar line next to a head reaches past it and is no stem
    const reachesUp = vertical.y0 < head.y - spacing && Math.abs(vertical.y1 - head.y + 0.2 * spacing) <= 0.7 * spacing;
    const reachesDown =
      vertical.y1 > head.y + spacing && Math.abs(vertical.y0 - head.y - 0.2 * spacing) <= 0.7 * spacing;
    const up = reachesUp && Math.abs(dx - HEAD_HALF_WIDTH) <= 0.4;
    const down = reachesDown && Math.abs(dx + HEAD_HALF_WIDTH) <= 0.4;
    if (!up && !down) continue;
    const score = Math.abs(Math.abs(dx) - HEAD_HALF_WIDTH);
    if (score < bestScore) {
      bestScore = score;
      best = { vertical, up };
    }
  }
  return best;
};

// A bar line: a stroke from the top line to the bottom line that carries no head
export const isBarline = (vertical: Vertical, staff: Staff): boolean => {
  const { spacing } = staff;
  const top = lineY(staff, 0, vertical.x);
  const bottom = lineY(staff, 4, vertical.x);
  return Math.abs(vertical.y0 - top) <= 0.5 * spacing && Math.abs(vertical.y1 - bottom) <= 0.8 * spacing;
};

interface Group {
  readonly heads: Head[];
  readonly stem: Stem | null;
}

// Heads on one stem form a chord: the stem's stroke starts at the head at its far end, the other heads of the chord
// are stacked on that head, towards the stem's other end
const groupByStem = (heads: readonly Head[], verticals: readonly Vertical[], spacing: number): Group[] => {
  const byStem = new Map<Vertical | Head, Group>();
  const loose: Head[] = [];
  for (const head of heads) {
    const stem = stemOf(head, verticals, spacing);
    if (stem === null) {
      loose.push(head);
      continue;
    }
    const group = byStem.get(stem.vertical) ?? { heads: [], stem };
    group.heads.push(head);
    byStem.set(stem.vertical, group);
  }
  let pending = loose;
  for (let changed = true; changed;) {
    changed = false;
    const rest: Head[] = [];
    for (const head of pending) {
      const group = [...byStem.values()].find((g) => stacksOn(head, g, spacing));
      if (group === undefined) {
        rest.push(head);
      } else {
        group.heads.push(head);
        changed = true;
      }
    }
    pending = rest;
  }
  for (const head of pending) byStem.set(head, { heads: [head], stem: null });
  return [...byStem.values()].flatMap((group) => oneEnd(group, spacing));
};

// A stem carries its heads at one end; a "head" at the other end is the thick part of a flag – the thinner one goes
const oneEnd = (group: Group, spacing: number): Group[] => {
  const { stem } = group;
  if (stem === null || group.heads.length < 2) return [group];
  const middle = (stem.vertical.y0 + stem.vertical.y1) / 2;
  const top = group.heads.filter((h) => h.y < middle - spacing);
  const bottom = group.heads.filter((h) => h.y > middle + spacing);
  if (top.length === 0 || bottom.length === 0) return [group];
  const thickest = (heads: readonly Head[]): number => Math.max(...heads.map((h) => h.thickness));
  const keep = thickest(top) > thickest(bottom) ? top : bottom;
  const inner = group.heads.filter((h) => !top.includes(h) && !bottom.includes(h));
  return [{ heads: [...keep, ...inner], stem: { ...stem, up: keep === bottom } }];
};

// A head right beside (a second) or on top of a head of the group, on the side away from the stem's tip
const stacksOn = (head: Head, group: Group, spacing: number): boolean => {
  const { stem } = group;
  if (stem === null || Math.abs(head.x - stem.vertical.x) > 1.3 * spacing) return false;
  return group.heads.some((other) => {
    const dy = head.y - other.y;
    const beyond = stem.up ? dy > 0 : dy < 0;
    return beyond && Math.abs(dy) <= 1.15 * spacing && Math.abs(head.x - other.x) <= 1.4 * spacing;
  });
};

interface Context {
  readonly page: Page;
  readonly spacing: number;
  readonly specks: readonly Component[];
  readonly accidentals: readonly (Accidental & { readonly y: number })[];
}

const noteOf = ({ heads, stem }: Group, context: Context): NoteEvent => {
  const { spacing, page } = context;
  const sorted = [...heads].sort((a, b) => a.y - b.y);
  const filled = sorted.some((h) => h.filled);
  const beams = stem === null || !filled ? 0 : beamCount(page.clean, stem.vertical, stem.up, spacing);
  const dots = Math.max(...sorted.map((h) => dotCount(h, context.specks, spacing)));
  return {
    kind: 'note',
    x: sorted.reduce((sum, h) => sum + h.x, 0) / sorted.length,
    heads: sorted.map((head) => {
      const accidental = accidentalFor(head, context.accidentals, spacing);
      return accidental === undefined ? head : { ...head, accidental: accidental.alteration };
    }),
    stem,
    duration: noteValue(filled, stem !== null, beams, dots),
    uncertain: sorted.some((h) => h.uncertain) || (filled && stem === null),
  };
};

const overlaps = (c: Component, x0: number, y0: number, x1: number, y1: number): boolean =>
  c.x0 <= x1 && c.x1 >= x0 && c.y0 <= y1 && c.y1 >= y0;

// The pieces of this staff after its header that are part of no note
export const looseComponents = (
  staff: Staff,
  header: Header,
  labeled: Labeled,
  notes: readonly NoteEvent[],
): Component[] => {
  const { spacing } = staff;
  return labeled.components.filter((c) => {
    const x = (c.x0 + c.x1) / 2;
    const y = (c.y0 + c.y1) / 2;
    if (c.x0 <= header.end || x > staff.x1 + spacing) return false;
    if (y < lineY(staff, 0, x) - 2 * spacing || y > lineY(staff, 4, x) + 2 * spacing) return false;
    return !notes.some(
      (note) =>
        note.heads.some((h) => overlaps(c, h.x, h.y, h.x, h.y)) ||
        (note.stem !== null &&
          overlaps(c, note.stem.vertical.x0, note.stem.vertical.y0, note.stem.vertical.x1, note.stem.vertical.y1 - 1)),
    );
  });
};

// A filled head without a stem at the far end of another note's stem is the thick end of a beam or flag
const dropStemTips = (groups: readonly Group[], spacing: number): Group[] => {
  const stems = groups.flatMap((g) => (g.stem === null ? [] : [g.stem]));
  const atTip = (head: Head): boolean =>
    stems.some(({ vertical, up }) => {
      const end = up ? vertical.y0 : vertical.y1;
      return Math.abs(head.x - vertical.x) <= spacing && Math.abs(head.y - end) <= 1.2 * spacing;
    });
  return groups.filter((g) => g.stem !== null || !g.heads.every((head) => head.filled && atTip(head)));
};

export const readStaff = (staff: Staff, header: Header, heads: readonly Head[], page: Page): StaffReading => {
  const { spacing } = staff;
  const { labeled, clean, verticals } = page;
  const own = heads.filter((head) => head.x - 0.5 * spacing > header.end);
  const groups = dropStemTips(groupByStem(own, verticals, spacing), spacing);
  const bare: NoteEvent[] = groups.map((g) => noteOf(g, { page, spacing, specks: [], accidentals: [] }));
  const loose = looseComponents(staff, header, labeled, bare);
  const accidentals = accidentalsOf(labeled, clean.width, loose, spacing);
  const context: Context = { page, spacing, specks: specksOf(labeled, spacing), accidentals };
  const notes = groups.map((g) => noteOf(g, context));
  const used = new Set(accidentals.map((a) => a.component));
  const rests: RestEvent[] = loose.flatMap((c) => {
    const rest = used.has(c) ? null : restOf(c, labeled, clean.width, staff);
    return rest === null
      ? []
      : [{ kind: 'rest', x: rest.x, y: rest.y, duration: rest.duration, wholeBar: rest.wholeBar, uncertain: false }];
  });
  const stems = new Set(notes.map((event) => event.stem?.vertical));
  const barlines = verticals
    .filter((v) => !stems.has(v) && v.x > header.end && v.x >= staff.x0 - spacing && v.x <= staff.x1 + spacing)
    .filter((v) => isBarline(v, staff))
    .map((v) => v.x);
  const events: StaffEvent[] = [...notes, ...rests].sort((a, b) => a.x - b.x);
  return { staff, header, events, barlines: mergeClose(barlines, spacing) };
};

// A double bar line is one bar line
export const mergeClose = (xs: readonly number[], spacing: number): number[] => {
  const merged: number[] = [];
  for (const x of [...xs].sort((a, b) => a - b)) {
    const last = merged[merged.length - 1];
    if (last !== undefined && x - last < 1.2 * spacing) continue;
    merged.push(x);
  }
  return merged;
};
