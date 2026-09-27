// From staff readings to the Score: every voice takes its events from its staff (all of them, or those with stems up
// or down where two voices share a staff), bar lines number the bars across systems, and every bar starts where the
// previous one ended – a misread duration disturbs one bar, not the rest. Accidentals hold to the end of the bar.
import type { Note, Score, Voice } from '../score/score';
import { type Clef, stepMidi } from './pitch-from-staff';
import type { NoteEvent, StaffEvent, StaffReading } from './staff-reader';
import { lineY } from './staves';

export type Selection = 'all' | 'up' | 'down';

export interface VoicePart {
  readonly voice: Voice;
  readonly staff: number; // index into the readings
  readonly select: Selection;
  readonly clef: Clef; // when the staff shows none
}

export interface System {
  readonly staves: readonly number[]; // indexes into the readings, top → bottom
  readonly parts: readonly VoicePart[];
}

interface Placed {
  readonly event: StaffEvent;
  readonly bar: number; // running index over the excerpt, from 0
  readonly staff: number;
  readonly clef: Clef;
}

// A rest shifted up belongs to the upper voice, shifted down to the lower one; a centred rest to both
const selects = (event: StaffEvent, select: Selection, middle: number, spacing: number): boolean => {
  if (select === 'all') return true;
  if (event.kind === 'rest') {
    return select === 'up' ? event.y <= middle + 0.5 * spacing : event.y >= middle - 0.5 * spacing;
  }
  if (event.stem === null) return true;
  return event.stem.up === (select === 'up');
};

// Where no stem tells, a chord gives its top head to the upper voice and its bottom head to the lower one
const headFor = (event: NoteEvent, select: Selection) =>
  select === 'down' ? event.heads[event.heads.length - 1] : event.heads[0];

// The events of a staff that belong to the part, left to right
const partEvents = (reading: StaffReading, part: VoicePart): StaffEvent[] => {
  const seen = new Set<unknown>();
  return reading.events.filter((event) => {
    const middle = lineY(reading.staff, 2, event.x);
    if (!selects(event, part.select, middle, reading.staff.spacing)) return false;
    // One voice on the staff: a head read with a stem either way is one note, not two
    const heads = event.kind === 'note' ? event.heads : [event];
    if (part.select === 'all' && heads.every((h) => seen.has(h))) return false;
    for (const h of heads) seen.add(h);
    return true;
  });
};

// Each system's events of one part with the running bar index; a system that does not end on a bar line continues
// its last bar on the next system
const placeEvents = (readings: readonly StaffReading[], systems: readonly System[], voice: Voice): Placed[] => {
  const placed: Placed[] = [];
  let bar = 0;
  for (const system of systems) {
    const part = system.parts.find((p) => p.voice === voice);
    const reading = part === undefined ? undefined : readings[part.staff];
    const barlines = systemBarlines(readings, system);
    if (part !== undefined && reading !== undefined) {
      const clef = reading.header.clef ?? part.clef;
      for (const event of partEvents(reading, part)) {
        const crossed = barlines.filter((x) => x < event.x).length;
        placed.push({ event, bar: bar + crossed, staff: part.staff, clef });
      }
    }
    bar += barlines.length;
  }
  return placed;
};

// Bar lines of a system: those of its staves, merged – a bar line through two staves counts once
export const systemBarlines = (readings: readonly StaffReading[], system: System): number[] => {
  const all = system.staves.flatMap((i) => readings[i]?.barlines ?? []).sort((a, b) => a - b);
  const spacing = readings[system.staves[0] ?? 0]?.staff.spacing ?? 1;
  const merged: number[] = [];
  for (const x of all) {
    const last = merged[merged.length - 1];
    if (last === undefined || x - last > spacing) merged.push(x);
  }
  // Only bar lines seen on every staff of the system, unless a staff has none at all
  return merged;
};

const round = (value: number): number => Math.round(value * 1000) / 1000;

// The most frequent bar length among the inner bars (the first may be a pickup, the last may be short)
export const inferBeatsPerBar = (lengths: readonly number[]): number => {
  const positive = (values: readonly number[]): number[] => values.filter((length) => length > 0);
  const inner = positive(lengths.slice(1, -1));
  const counts = new Map<number, number>();
  for (const length of inner.length > 0 ? inner : positive(lengths)) {
    counts.set(round(length), (counts.get(round(length)) ?? 0) + 1);
  }
  let best = 4;
  let bestCount = 0;
  for (const [length, count] of counts) {
    if (count > bestCount || (count === bestCount && length > best)) {
      best = length;
      bestCount = count;
    }
  }
  return best;
};

// Accidentals printed in a bar of a staff, left to right: each holds for its staff position until the bar line,
// for every voice on the staff
interface Printed {
  readonly x: number;
  readonly step: number;
  readonly alteration: number;
}

const printedKey = (staff: number, bar: number): string => `${String(staff)}:${String(bar)}`;

const printedAccidentals = (placedByVoice: readonly (readonly Placed[])[]): Map<string, Printed[]> => {
  const printed = new Map<string, Printed[]>();
  const seen = new Set<StaffEvent>();
  for (const placed of placedByVoice.flat()) {
    if (placed.event.kind === 'rest' || seen.has(placed.event)) continue;
    seen.add(placed.event);
    for (const head of placed.event.heads) {
      if (head.accidental === undefined) continue;
      const key = printedKey(placed.staff, placed.bar);
      const list = printed.get(key) ?? [];
      list.push({ x: placed.event.x, step: head.step, alteration: head.accidental });
      printed.set(key, list);
    }
  }
  return printed;
};

// The alteration in force at a head: the last accidental at its position up to its own x in this bar
const alterationAt = (printed: Map<string, Printed[]>, placed: Placed, step: number): number | undefined => {
  let found: Printed | undefined;
  for (const p of printed.get(printedKey(placed.staff, placed.bar)) ?? []) {
    if (p.step === step && p.x <= placed.event.x + 1 && (found === undefined || p.x >= found.x)) found = p;
  }
  return found?.alteration;
};

const midiOf = (placed: Placed, select: Selection, keyFifths: number, printed: Map<string, Printed[]>) => {
  const { event } = placed;
  if (event.kind === 'rest') return null;
  const head = headFor(event, select);
  if (head === undefined) return null;
  return stepMidi(head.step, keyFifths, placed.clef, alterationAt(printed, placed, head.step));
};

interface VoiceBars {
  readonly voice: Voice;
  readonly select: Selection;
  readonly placed: readonly Placed[];
}

// A whole-bar rest counts nothing here: it lasts as long as the bar turns out to be
const durationOf = (event: StaffEvent): number => (event.kind === 'rest' && event.wholeBar ? 0 : event.duration);

const sumsPerBar = (parts: readonly VoiceBars[], barCount: number): number[][] =>
  parts.map((part) => {
    const sums = new Array<number>(barCount).fill(0);
    for (const p of part.placed) sums[p.bar] = (sums[p.bar] ?? 0) + durationOf(p.event);
    return sums;
  });

const barLengths = (sums: readonly (readonly number[])[], barCount: number, beatsPerBar: number): number[] =>
  Array.from({ length: barCount }, (_, bar) => {
    const lengths = sums.map((s) => s[bar] ?? 0).filter((length) => length > 0);
    if (lengths.length === 0 || lengths.some((length) => Math.abs(length - beatsPerBar) < 1e-6)) return beatsPerBar;
    return Math.max(...lengths);
  });

export interface BuildOptions {
  readonly keyFifths: number;
}

export const buildScore = (
  readings: readonly StaffReading[],
  systems: readonly System[],
  voices: readonly Voice[],
  { keyFifths }: BuildOptions,
): Score => {
  const parts: VoiceBars[] = voices.map((voice) => {
    const select = systems.flatMap((s) => s.parts).find((p) => p.voice === voice)?.select ?? 'all';
    return { voice, select, placed: placeEvents(readings, systems, voice) };
  });
  const barCount = Math.max(0, ...parts.flatMap((p) => p.placed.map((q) => q.bar + 1)));
  const sums = sumsPerBar(parts, barCount);
  const beatsPerBar = inferBeatsPerBar(
    Array.from({ length: barCount }, (_, bar) => Math.max(0, ...sums.map((s) => s[bar] ?? 0))),
  );
  const lengths = barLengths(sums, barCount, beatsPerBar);
  const pickup = barCount > 1 && (lengths[0] ?? 0) < beatsPerBar - 1e-6;
  const starts: number[] = [];
  let start = 0;
  for (const length of lengths) {
    starts.push(start);
    start += length;
  }
  const printed = printedAccidentals(parts.map((part) => part.placed));
  const result: Partial<Record<Voice, Note[]>> = {};
  parts.forEach((part, index) => {
    const offsets = new Array<number>(barCount).fill(0);
    result[part.voice] = part.placed.map((placed): Note => {
      const offset = offsets[placed.bar] ?? 0;
      const barLength = lengths[placed.bar] ?? 0;
      const duration = durationOf(placed.event) === 0 ? barLength : placed.event.duration;
      offsets[placed.bar] = offset + duration;
      const sum = sums[index]?.[placed.bar] ?? 0;
      const overfull = sum > beatsPerBar + 1e-6;
      const complete = (Math.abs(sum - barLength) < 1e-6 && !overfull) || durationOf(placed.event) === 0;
      const note: Note = {
        midi: midiOf(placed, part.select, keyFifths, printed),
        start: round((starts[placed.bar] ?? 0) + offset),
        duration,
        bar: pickup ? placed.bar : placed.bar + 1,
      };
      return placed.event.uncertain || !complete ? { ...note, uncertain: true } : note;
    });
  });
  return { voices: result, beatsPerBar, keyFifths };
};
