// Accuracy of a recognised Score against the known one, per voice: the two note sequences are aligned (dynamic
// programming, a pair scores for equal pitch and for equal duration), then pitch and rhythm accuracy are the shares
// of correct pairs among max(expected, recognised) notes – missing and extra notes both count against it.
import type { Note, Score, Voice } from '../../score/score';

export interface Accuracy {
  readonly expected: number;
  readonly recognized: number;
  readonly pitch: number; // 0…1
  readonly rhythm: number; // 0…1
}

const pairScore = (a: Note, b: Note): number => (a.midi === b.midi ? 1 : 0) + (a.duration === b.duration ? 1 : 0);

export const alignNotes = (expected: readonly Note[], recognized: readonly Note[]): [Note, Note][] => {
  const n = expected.length;
  const m = recognized.length;
  const table: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  const at = (i: number, j: number): number => table[i]?.[j] ?? 0;
  const score = (i: number, j: number): number => {
    const a = expected[i - 1];
    const b = recognized[j - 1];
    return a === undefined || b === undefined ? 0 : pairScore(a, b);
  };
  for (let i = 1; i <= n; i++) {
    const row = table[i] ?? [];
    for (let j = 1; j <= m; j++) row[j] = Math.max(at(i - 1, j - 1) + score(i, j), at(i - 1, j), at(i, j - 1));
  }
  const pairs: [Note, Note][] = [];
  let i = n;
  let j = m;
  while (i > 0 && j > 0) {
    const a = expected[i - 1];
    const b = recognized[j - 1];
    if (a !== undefined && b !== undefined && at(i, j) === at(i - 1, j - 1) + score(i, j) && score(i, j) > 0) {
      pairs.unshift([a, b]);
      i--;
      j--;
    } else if (at(i, j) === at(i - 1, j)) {
      i--;
    } else {
      j--;
    }
  }
  return pairs;
};

export const voiceAccuracy = (expected: readonly Note[], recognized: readonly Note[]): Accuracy => {
  const pairs = alignNotes(expected, recognized);
  const total = Math.max(1, expected.length, recognized.length);
  return {
    expected: expected.length,
    recognized: recognized.length,
    pitch: pairs.filter(([a, b]) => a.midi === b.midi).length / total,
    rhythm: pairs.filter(([a, b]) => a.duration === b.duration).length / total,
  };
};

export const scoreAccuracy = (expected: Score, recognized: Score): Partial<Record<Voice, Accuracy>> => {
  const result: Partial<Record<Voice, Accuracy>> = {};
  for (const voice of Object.keys(expected.voices) as Voice[]) {
    result[voice] = voiceAccuracy(expected.voices[voice] ?? [], recognized.voices[voice] ?? []);
  }
  return result;
};

export const describeNotes = (notes: readonly Note[]): string =>
  notes
    .map((n) => `${n.midi === null ? 'r' : String(n.midi)}/${String(n.duration)}${n.uncertain ? '?' : ''}`)
    .join(' ');
