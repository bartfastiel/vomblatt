// The contract between recognition and playback: what was read from the sheet, as plain data.
// Recognition produces a Score, the player and the renderer only consume it.

export type Voice = 'S' | 'A' | 'T' | 'B';

export const VOICES: readonly Voice[] = ['S', 'A', 'T', 'B'];

// Durations in quarter notes: 1 = quarter, 0.5 = eighth, 1.5 = dotted quarter, 1/3 = triplet eighth
export interface Note {
  readonly midi: number | null; // null = rest; accidentals and key signature are already applied
  readonly start: number; // in quarter notes from the beginning of the excerpt
  readonly duration: number;
  readonly bar: number; // 1-based bar within the excerpt; a pickup bar is bar 0
  readonly uncertain?: boolean; // recognition was not sure – shown marked, still played
}

export interface Score {
  readonly voices: Readonly<Partial<Record<Voice, readonly Note[]>>>;
  readonly beatsPerBar: number; // in quarter notes, e.g. 4 for 4/4, 3 for 3/4, 3 for 6/8
  readonly tempo?: number; // quarter notes per minute, when printed on the sheet
  readonly keyFifths: number; // key signature: +n sharps, -n flats
}

export const scoreLength = (score: Score): number =>
  Math.max(0, ...Object.values(score.voices).flatMap((notes) => notes.map((note) => note.start + note.duration)));
