import { describe, expect, it } from 'vitest';
import { letterOf, stepMidi } from './pitch-from-staff';

describe('stepMidi', () => {
  it('counts naturals from E4 on the lowest line in C major', () => {
    expect([-2, -1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((step) => stepMidi(step, 0))).toEqual([
      60, 62, 64, 65, 67, 69, 71, 72, 74, 76, 77, 79, 81, 83, 84,
    ]);
    expect(stepMidi(-9, 0)).toBe(48); // C3
    expect(stepMidi(-7, 0)).toBe(52); // E3
  });

  // Alteration of the letters C D E F G A B (steps −2…4) by every key signature
  it.each([
    [6, [1, 1, 1, 1, 1, 1, 0]],
    [5, [1, 1, 0, 1, 1, 1, 0]],
    [4, [1, 1, 0, 1, 1, 0, 0]],
    [3, [1, 0, 0, 1, 1, 0, 0]],
    [2, [1, 0, 0, 1, 0, 0, 0]],
    [1, [0, 0, 0, 1, 0, 0, 0]],
    [0, [0, 0, 0, 0, 0, 0, 0]],
    [-1, [0, 0, 0, 0, 0, 0, -1]],
    [-2, [0, 0, -1, 0, 0, 0, -1]],
    [-3, [0, 0, -1, 0, 0, -1, -1]],
    [-4, [0, -1, -1, 0, 0, -1, -1]],
    [-5, [0, -1, -1, 0, -1, -1, -1]],
    [-6, [-1, -1, -1, 0, -1, -1, -1]],
  ])('applies the key signature %s', (signature, alterations) => {
    const naturals = [60, 62, 64, 65, 67, 69, 71];
    const expected = naturals.map((midi, i) => midi + (alterations[i] ?? 0));
    expect([-2, -1, 0, 1, 2, 3, 4].map((step) => stepMidi(step, signature))).toEqual(expected);
  });

  it('reads E♯ in F♯ major and C♭ in G♭ major enharmonically', () => {
    expect(stepMidi(0, 6)).toBe(65);
    expect(stepMidi(5, -6)).toBe(71);
  });

  it('keeps F♯ in G major an octave apart', () => {
    expect(stepMidi(1, 1)).toBe(66);
    expect(stepMidi(8, 1)).toBe(78);
    expect(stepMidi(-6, 1)).toBe(54);
  });
});

describe('clefs', () => {
  it('puts G2 on the lowest line of the bass clef and E3 on that of the octave treble clef', () => {
    expect(stepMidi(0, 0, 'bass')).toBe(43);
    expect(stepMidi(8, 0, 'bass')).toBe(57); // A3 on the top line
    expect(stepMidi(0, 0, 'treble8')).toBe(52);
    expect(stepMidi(1, 1, 'bass')).toBe(45); // A2, no F
    expect(stepMidi(-1, 1, 'bass')).toBe(42); // F♯2
  });

  it('lets an accidental replace the key signature', () => {
    expect(stepMidi(1, 1, 'treble', 0)).toBe(65); // F natural in G major
    expect(stepMidi(4, 0, 'treble', -1)).toBe(70); // B♭
    expect(letterOf(-2)).toEqual({ letter: 0, octave: 4 });
  });
});
