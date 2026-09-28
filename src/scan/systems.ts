// Which staves are sounded together, and who sings on which: staves joined by the system's start line (or a bar line
// running through) form a system; a treble staff directly followed by a bass staff is a pair even when the join is
// cut off the photo. One staff carries the melody, two staves are S/A over T/B (stems up and down), four staves are
// S, A, T, B from top to bottom.
import type { Voice } from '../score/score';
import type { BinaryImage } from './binarize';
import type { Header } from './header';
import type { Clef } from './pitch-from-staff';
import type { System, VoicePart } from './score-builder';
import type { StaffReading } from './staff-reader';
import { lineY, type Staff } from './staves';

// Whether the rows between two staves are ink in column x (a few rows of blur or moiré may be missing)
const joinedAt = (image: BinaryImage, x: number, from: number, to: number): boolean => {
  let ink = 0;
  let rows = 0;
  for (let y = Math.round(from); y <= Math.round(to); y++) {
    rows++;
    const row = y * image.width;
    if (image.data[row + x] === 1 || image.data[row + x - 1] === 1 || image.data[row + x + 1] === 1) ink++;
  }
  return rows > 0 && ink >= 0.85 * rows;
};

// A vertical line from the bottom line of the upper staff to the top line of the lower one, at the start of the
// system or at a bar line
export const joined = (image: BinaryImage, upper: Staff, lower: Staff, barlines: readonly number[]): boolean => {
  const start = Math.round(Math.max(upper.x0, lower.x0));
  const columns = [
    ...Array.from({ length: Math.round(2 * upper.spacing) }, (_, i) => start - Math.round(upper.spacing) + i),
    ...barlines.map(Math.round),
  ];
  return columns.some(
    (x) => x > 0 && x < image.width - 1 && joinedAt(image, x, lineY(upper, 4, x), lineY(lower, 0, x)),
  );
};

const PARTS: Readonly<Record<number, readonly (readonly [Voice, 'all' | 'up' | 'down', Clef][])[]>> = {
  1: [[['S', 'all', 'treble']]],
  2: [
    [
      ['S', 'up', 'treble'],
      ['A', 'down', 'treble'],
    ],
    [
      ['T', 'up', 'bass'],
      ['B', 'down', 'bass'],
    ],
  ],
  4: [[['S', 'all', 'treble']], [['A', 'all', 'treble']], [['T', 'all', 'treble8']], [['B', 'all', 'bass']]],
};

// Other numbers of staves (a melody over a piano part, for instance): the top staff carries the melody
const partsOf = (staves: readonly number[]): VoicePart[] => {
  const layout = PARTS[staves.length] ?? PARTS[1] ?? [];
  return staves.flatMap((staff, i) =>
    (layout[i] ?? []).map(([voice, select, clef]): VoicePart => ({ voice, staff, select, clef })),
  );
};

// Bar lines at the same places: the staves of one system share their bars even where the lines do not run through
export const alignedBars = (upper: readonly number[], lower: readonly number[], spacing: number): boolean => {
  const inner = (xs: readonly number[]): number[] => xs.slice(0, -1); // the last one ends every staff
  const a = inner(upper);
  const b = inner(lower);
  if (a.length < 2 || b.length < 2) return false;
  const matched = a.filter((x) => b.some((y) => Math.abs(x - y) <= 0.6 * spacing)).length;
  return matched >= 0.7 * Math.max(a.length, b.length);
};

export const groupSystems = (
  image: BinaryImage,
  staves: readonly Staff[],
  headers: readonly Header[],
  barlines: readonly (readonly number[])[],
): System[] => {
  const systems: number[][] = [];
  staves.forEach((staff, i) => {
    const previous = staves[i - 1];
    const current = systems[systems.length - 1];
    const byLine =
      previous !== undefined &&
      (joined(image, previous, staff, barlines[i - 1] ?? []) ||
        alignedBars(barlines[i - 1] ?? [], barlines[i] ?? [], staff.spacing));
    const byClef =
      previous !== undefined &&
      current?.length === 1 &&
      headers[i - 1]?.clef === 'treble' &&
      headers[i]?.clef === 'bass';
    if (current !== undefined && (byLine || byClef)) current.push(i);
    else systems.push([i]);
  });
  return systems.map((members) => ({ staves: members, parts: partsOf(members) }));
};

// Two voices on a staff: notes with stems up and down at the same place, again and again
export const twoVoiced = (reading: StaffReading): boolean => {
  const notes = reading.events.flatMap((e) =>
    e.kind === 'note' && e.stem !== null ? [{ x: e.x, up: e.stem.up }] : [],
  );
  const pairs = notes.filter(
    (a) => a.up && notes.some((b) => !b.up && Math.abs(a.x - b.x) < 0.8 * reading.staff.spacing),
  ).length;
  return pairs >= 2 && pairs >= 0.2 * notes.length;
};

// Two staves joined into a system that carry one voice each and no bass clef are two lines of a melody (a photo's
// frame or a phone's bezel can look like a system line)
export const splitMelodies = (systems: readonly System[], readings: readonly StaffReading[]): System[] =>
  systems.flatMap((system) => {
    const [upper, lower] = system.staves;
    if (system.staves.length !== 2 || upper === undefined || lower === undefined) return [system];
    const pair = [readings[upper], readings[lower]];
    const bass = pair.some((r) => r?.header.clef === 'bass');
    if (bass || pair.some((r) => r !== undefined && twoVoiced(r))) return [system];
    return [upper, lower].map((staff) => ({ staves: [staff], parts: partsOf([staff]) }));
  });

// The voices the systems give, in the order S, A, T, B
export const voicesOf = (systems: readonly System[]): Voice[] => {
  const present = new Set(systems.flatMap((system) => system.parts.map((part) => part.voice)));
  return (['S', 'A', 'T', 'B'] as const).filter((voice) => present.has(voice));
};
