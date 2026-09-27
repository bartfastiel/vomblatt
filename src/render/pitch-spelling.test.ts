import { describe, expect, it } from 'vitest';
import { diatonicStep, spellPitch } from './pitch-spelling';

describe('spellPitch', () => {
  it('spells the natural pitches of C major plainly', () => {
    expect(spellPitch(60, 0)).toEqual({ letter: 'C', octave: 4, accidental: 0 });
    expect(spellPitch(69, 0)).toEqual({ letter: 'A', octave: 4, accidental: 0 });
  });

  it('uses the key signature for pitches inside the key', () => {
    // A major: F#, C#, G# – midi 61 is C#4, spelled with the key's own sharp, not as Db.
    expect(spellPitch(61, 3)).toEqual({ letter: 'C', octave: 4, accidental: 1 });
    expect(spellPitch(78, 3)).toEqual({ letter: 'F', octave: 5, accidental: 1 });
  });

  it('spells a flat-side key with flats', () => {
    // Eb major: Bb, Eb, Ab – midi 70 is Bb4.
    expect(spellPitch(70, -3)).toEqual({ letter: 'B', octave: 4, accidental: -1 });
  });

  it('spells a chromatic pitch outside the key by the key’s sharp/flat side', () => {
    // A major again: D#4 (midi 63) is not in the scale – sharp side, so it is D#, not Eb.
    expect(spellPitch(63, 3)).toEqual({ letter: 'D', octave: 4, accidental: 1 });
    // C minor-ish flat key (-3): the chromatic pitch midi 66 (F#/Gb) spells flat, as Gb.
    expect(spellPitch(66, -3)).toEqual({ letter: 'G', octave: 4, accidental: -1 });
  });

  it('is total: every pitch class resolves for keys up to seven sharps or flats', () => {
    for (let keyFifths = -7; keyFifths <= 7; keyFifths++) {
      for (let midi = 48; midi < 60; midi++) {
        expect(() => spellPitch(midi, keyFifths)).not.toThrow();
      }
    }
  });
});

describe('diatonicStep', () => {
  it('increases by one per natural letter and by seven per octave', () => {
    expect(diatonicStep({ letter: 'C', octave: 4 })).toBe(diatonicStep({ letter: 'C', octave: 3 }) + 7);
    expect(diatonicStep({ letter: 'D', octave: 4 })).toBe(diatonicStep({ letter: 'C', octave: 4 }) + 1);
  });
});
