// Which letter (and octave) a MIDI pitch is drawn as – needed because a staff position depends on the diatonic
// letter (C, D, E, …), not the chromatic pitch: F# and Gb sit on different lines even though they sound the same.
// Score notes only carry a MIDI number (see src/score/score.ts), so the letter is derived from the key signature:
// pitches inside the key's major scale keep that scale's spelling; anything else is spelled relative to the key's
// sharp/flat side. Good enough to place a notehead; not a claim to the "true" spelling of a given passage.

export type Letter = 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B';
export type Accidental = -1 | 0 | 1;

export interface SpelledPitch {
  readonly letter: Letter;
  readonly octave: number; // scientific pitch notation, middle C = C4
  readonly accidental: Accidental;
}

const LETTERS: readonly Letter[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const NATURAL_PITCH_CLASS: Readonly<Record<Letter, number>> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const SHARP_ORDER: readonly Letter[] = ['F', 'C', 'G', 'D', 'A', 'E', 'B'];
const FLAT_ORDER: readonly Letter[] = ['B', 'E', 'A', 'D', 'G', 'C', 'F'];

const keySignatureAccidentals = (keyFifths: number): Partial<Record<Letter, Accidental>> => {
  const accidentals: Partial<Record<Letter, Accidental>> = {};
  if (keyFifths > 0) for (const letter of SHARP_ORDER.slice(0, Math.min(keyFifths, 7))) accidentals[letter] = 1;
  else if (keyFifths < 0) for (const letter of FLAT_ORDER.slice(0, Math.min(-keyFifths, 7))) accidentals[letter] = -1;
  return accidentals;
};

// A full table (every letter present) built from `fn`, so looking it up never needs a fallback or an assertion.
const fullAccidentals = (fn: (letter: Letter) => Accidental): Record<Letter, Accidental> => {
  const table: Partial<Record<Letter, Accidental>> = {};
  for (const letter of LETTERS) table[letter] = fn(letter);
  return table as Record<Letter, Accidental>;
};

const pitchClass = (midi: number): number => ((midi % 12) + 12) % 12;

const letterFor = (letter: Letter, accidental: Accidental, midi: number, target: number): SpelledPitch | null => {
  if (pitchClass(NATURAL_PITCH_CLASS[letter] + accidental) !== target) return null;
  const octave = Math.round((midi - accidental - NATURAL_PITCH_CLASS[letter]) / 12) - 1;
  return { letter, octave, accidental };
};

// Three attempts, each covering pitch classes the previous one could not: (1) the key signature's own seven
// pitches – the common, idiomatic case; (2) a natural letter, for the pitches a key signature never alters;
// (3) a fixed sharp (sharp-side keys) or flat (flat-side keys) off a natural letter, the usual convention for an
// accidental the key signature does not supply. Together (2) and (3) already cover all twelve pitch classes
// (natural letters are at most a whole tone apart), so this never falls through without a result.
export const spellPitch = (midi: number, keyFifths: number): SpelledPitch => {
  const target = pitchClass(midi);
  const inKey = keySignatureAccidentals(keyFifths);
  const accidentalOffKey: Accidental = keyFifths >= 0 ? 1 : -1;
  const attempts: readonly Record<Letter, Accidental>[] = [
    fullAccidentals((letter) => inKey[letter] ?? 0),
    fullAccidentals(() => 0),
    fullAccidentals(() => accidentalOffKey),
  ];
  for (const accidentals of attempts) {
    for (const letter of LETTERS) {
      const spelled = letterFor(letter, accidentals[letter], midi, target);
      if (spelled !== null) return spelled;
    }
  }
  /* v8 ignore next */
  throw new Error(`unreachable: no spelling found for MIDI ${String(midi)}`);
};

// A single number that increases by one for every natural letter step (C4→D4→E4…), independent of octave
// boundaries – the basis for vertical staff position.
export const diatonicStep = (spelled: Pick<SpelledPitch, 'letter' | 'octave'>): number =>
  spelled.octave * 7 + LETTERS.indexOf(spelled.letter);
