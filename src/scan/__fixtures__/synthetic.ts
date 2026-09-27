// Hand-made staves and readings for unit tests: a straight staff with 10 px line distance, heads and events by step.
import type { Head } from '../heads';
import type { Header } from '../header';
import type { NoteEvent, NoteHead, RestEvent, StaffReading, Stem } from '../staff-reader';
import type { Staff } from '../staves';

export const SPACING = 10;

// Five straight lines, the top one at `top`, from x0 to x1
export const straightStaff = (top: number, x0 = 0, x1 = 1000): Staff => ({
  spacing: SPACING,
  thickness: 1,
  x0,
  x1,
  knots: Float32Array.from([x0, x1]),
  lines: [0, 1, 2, 3, 4].map((line) => Float32Array.from([top + line * SPACING, top + line * SPACING])),
});

export const HEADER: Header = { clef: 'treble', keyFifths: 0, meter: false, end: 0 };

export const head = (x: number, step: number, staffTop = 100, extra: Partial<NoteHead> = {}): NoteHead => ({
  x,
  y: staffTop + 4 * SPACING - (step * SPACING) / 2,
  staff: 0,
  step,
  filled: true,
  uncertain: false,
  thickness: 5,
  ...extra,
});

export const stem = (x: number, up: boolean): Stem => ({ vertical: { x, x0: x, x1: x, y0: 0, y1: 1 }, up });

export const note = (x: number, duration: number, heads: readonly Head[], up: boolean | null = null): NoteEvent => ({
  kind: 'note',
  x,
  heads,
  stem: up === null ? null : stem(x, up),
  duration,
  uncertain: false,
});

export const rest = (x: number, duration: number, y = 120, wholeBar = false): RestEvent => ({
  kind: 'rest',
  x,
  y,
  duration,
  wholeBar,
  uncertain: false,
});

export const reading = (
  events: StaffReading['events'],
  barlines: readonly number[] = [],
  header: Header = HEADER,
  top = 100,
): StaffReading => ({ staff: straightStaff(top), header, events, barlines });
