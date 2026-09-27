// Ported from wumble (src/scan, MIT, same author).
// Pitch from the staff position: the step above the lowest line names the natural, the key signature adds its
// sharp or flat, the clef sets the octave.

const LETTERS = 'CDEFGAB';
const SHARP_ORDER = 'FCGDAEB';
const FLAT_ORDER = 'BEADGCF';
export const MAJOR: readonly number[] = [0, 2, 4, 5, 7, 9, 11]; // semitones of C D E F G A B above C

export type Clef = 'treble' | 'bass' | 'treble8';

// Letters counted from C4 for step 0, the lowest line: E4 in treble, G2 in bass, E3 in the octave treble clef
const CLEF_OFFSET: Readonly<Record<Clef, number>> = { treble: 2, bass: -10, treble8: -5 };

export const signatureAlteration = (letterIndex: number, signature: number): number => {
  const letter = LETTERS.charAt(letterIndex);
  if (signature > 0) return SHARP_ORDER.slice(0, signature).includes(letter) ? 1 : 0;
  if (signature < 0) return FLAT_ORDER.slice(0, -signature).includes(letter) ? -1 : 0;
  return 0;
};

// Letter index (0 = C … 6 = B) and octave of a staff step
export const letterOf = (step: number, clef: Clef = 'treble'): { letter: number; octave: number } => {
  const index = step + CLEF_OFFSET[clef];
  return { letter: ((index % 7) + 7) % 7, octave: 4 + Math.floor(index / 7) };
};

// Step 0 = lowest line, every step one letter; `alteration` (sharps positive) replaces the key signature's when given
export const stepMidi = (step: number, signature: number, clef: Clef = 'treble', alteration?: number): number => {
  const { letter, octave } = letterOf(step, clef);
  return 12 * (octave + 1) + (MAJOR[letter] ?? 0) + (alteration ?? signatureAlteration(letter, signature));
};
