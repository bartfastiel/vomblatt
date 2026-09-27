// Pure layout maths for the score view: where a note sits (x from its time, y from its pitch), what it looks
// like (notehead shape, stem, flags, dot) and where the bar lines fall. src/ui/score-view.ts turns this into SVG.
import { diatonicStep, spellPitch } from './pitch-spelling';
import type { Note, Score, Voice } from '../score/score';

export type Clef = 'treble' | 'bass';

export const clefFor = (voice: Voice): Clef => (voice === 'S' || voice === 'A' ? 'treble' : 'bass');

// Diatonic step of the bottom line of each clef (E4 for treble, G2 for bass), i.e. staff position 0.
const BOTTOM_LINE_STEP: Readonly<Record<Clef, number>> = {
  treble: diatonicStep({ letter: 'E', octave: 4 }),
  bass: diatonicStep({ letter: 'G', octave: 2 }),
};

// Staff position in half-line-spacings above the clef's bottom line (negative = below, ledger-line territory).
export const staffPosition = (midi: number, keyFifths: number, clef: Clef): number =>
  diatonicStep(spellPitch(midi, keyFifths)) - BOTTOM_LINE_STEP[clef];

export const xForTime = (start: number, pxPerQuarter: number): number => start * pxPerQuarter;

export type NoteheadShape = 'whole' | 'open' | 'filled';

export const noteheadShape = (duration: number): NoteheadShape => {
  if (duration >= 4) return 'whole';
  if (duration >= 2) return 'open';
  return 'filled';
};

export const hasStem = (duration: number): boolean => duration < 4;

// 0 for a quarter note or longer, 1 for an eighth, 2 for a sixteenth (a triplet eighth, duration 1/3, is drawn
// like a plain eighth – close enough without a triplet bracket, which this renderer does not draw).
export const flagCount = (duration: number): number => {
  if (duration < 0.5) return 2;
  if (duration < 1) return 1;
  return 0;
};

const DOTTED_BASES = [0.25, 0.5, 1, 2, 4, 8];

export const isDotted = (duration: number): boolean =>
  !DOTTED_BASES.includes(duration) && DOTTED_BASES.some((base) => Math.abs(duration - base * 1.5) < 1e-9);

export interface LaidOutNote {
  readonly voice: Voice;
  readonly clef: Clef;
  readonly bar: number;
  readonly x: number;
  readonly position: number | null; // staffPosition, or null for a rest
  readonly notehead: NoteheadShape | 'rest';
  readonly stemUp: boolean; // stem points up when the note sits below the middle line
  readonly flags: number;
  readonly dotted: boolean;
  readonly emphasis: boolean; // this is the voice the singer chose
  readonly uncertain: boolean;
}

export interface LayoutOptions {
  readonly voice: Voice; // the emphasised voice
  readonly pxPerQuarter: number;
}

const layoutOne = (voice: Voice, note: Note, keyFifths: number, options: LayoutOptions): LaidOutNote => {
  const clef = clefFor(voice);
  const position = note.midi === null ? null : staffPosition(note.midi, keyFifths, clef);
  return {
    voice,
    clef,
    bar: note.bar,
    x: xForTime(note.start, options.pxPerQuarter),
    position,
    notehead: position === null ? 'rest' : noteheadShape(note.duration),
    stemUp: position !== null && position < 4, // middle line (B4 treble / D3 bass) is position 4
    flags: flagCount(note.duration),
    dotted: isDotted(note.duration),
    emphasis: voice === options.voice,
    uncertain: note.uncertain ?? false,
  };
};

export const layoutScore = (score: Score, options: LayoutOptions): readonly LaidOutNote[] => {
  const laidOut: LaidOutNote[] = [];
  for (const entry of Object.entries(score.voices)) {
    const [voice, notes] = entry as [Voice, readonly Note[]];
    for (const note of notes) laidOut.push(layoutOne(voice, note, score.keyFifths, options));
  }
  return laidOut.sort((a, b) => a.x - b.x);
};

// Quarter-note position where each bar (after the first) starts, plus a closing line at the very end –
// derived from the notes themselves so an irregular pickup bar needs no special casing.
export const barLines = (score: Score): readonly number[] => {
  const startOfBar = new Map<number, number>();
  let end = 0;
  for (const notes of Object.values(score.voices)) {
    for (const note of notes) {
      const current = startOfBar.get(note.bar);
      if (current === undefined || note.start < current) startOfBar.set(note.bar, note.start);
      end = Math.max(end, note.start + note.duration);
    }
  }
  const bars = [...startOfBar.entries()].sort(([barA], [barB]) => barA - barB);
  const lines = bars.slice(1).map(([, start]) => start);
  return end > 0 ? [...lines, end] : lines;
};
