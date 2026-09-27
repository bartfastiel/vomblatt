import { describe, expect, it } from 'vitest';
import {
  barLines,
  clefFor,
  flagCount,
  hasStem,
  isDotted,
  layoutScore,
  noteheadShape,
  staffPosition,
  xForTime,
} from './layout';
import type { Score } from '../score/score';

const defined = <T>(value: T | undefined): T => {
  if (value === undefined) throw new Error('expected a value');
  return value;
};

describe('clefFor', () => {
  it('puts soprano and alto on the treble staff, tenor and bass on the bass staff', () => {
    expect(clefFor('S')).toBe('treble');
    expect(clefFor('A')).toBe('treble');
    expect(clefFor('T')).toBe('bass');
    expect(clefFor('B')).toBe('bass');
  });
});

describe('staffPosition', () => {
  it('places the treble clef lines E4-G4-B4-D5-F5 two steps apart', () => {
    expect(staffPosition(64, 0, 'treble')).toBe(0); // E4, bottom line
    expect(staffPosition(67, 0, 'treble')).toBe(2); // G4
    expect(staffPosition(71, 0, 'treble')).toBe(4); // B4, middle line
    expect(staffPosition(74, 0, 'treble')).toBe(6); // D5
    expect(staffPosition(77, 0, 'treble')).toBe(8); // F5, top line
  });

  it('places the bass clef lines G2-B2-D3-F3-A3 two steps apart', () => {
    expect(staffPosition(43, 0, 'bass')).toBe(0); // G2, bottom line
    expect(staffPosition(47, 0, 'bass')).toBe(2); // B2
    expect(staffPosition(50, 0, 'bass')).toBe(4); // D3, middle line
    expect(staffPosition(53, 0, 'bass')).toBe(6); // F3
    expect(staffPosition(57, 0, 'bass')).toBe(8); // A3, top line
  });

  it('keeps a sharped and flatted spelling of the same key on the same line', () => {
    // C#4 (in a key with C#) sits on the C4 line, same as plain C4 – only the accidental differs.
    expect(staffPosition(61, 3, 'treble')).toBe(staffPosition(60, 0, 'treble'));
  });
});

describe('xForTime', () => {
  it('is proportional to the start time', () => {
    expect(xForTime(0, 20)).toBe(0);
    expect(xForTime(2, 20)).toBe(40);
    expect(xForTime(1.5, 40)).toBe(60);
  });
});

describe('noteheadShape / hasStem / flagCount / isDotted', () => {
  it('classifies durations in quarter notes', () => {
    expect(noteheadShape(4)).toBe('whole');
    expect(noteheadShape(2)).toBe('open');
    expect(noteheadShape(1)).toBe('filled');
    expect(noteheadShape(0.5)).toBe('filled');
  });

  it('gives every duration except the whole note a stem', () => {
    expect(hasStem(4)).toBe(false);
    expect(hasStem(2)).toBe(true);
    expect(hasStem(1)).toBe(true);
  });

  it('flags eighths once and sixteenths twice', () => {
    expect(flagCount(1)).toBe(0);
    expect(flagCount(0.5)).toBe(1);
    expect(flagCount(0.25)).toBe(2);
  });

  it('recognises dotted durations but not plain or triplet ones', () => {
    expect(isDotted(1.5)).toBe(true); // dotted quarter
    expect(isDotted(0.75)).toBe(true); // dotted eighth
    expect(isDotted(1)).toBe(false);
    expect(isDotted(1 / 3)).toBe(false); // triplet eighth
  });
});

describe('barLines', () => {
  it('derives bar boundaries from the notes, pickup bar included', () => {
    const score: Score = {
      beatsPerBar: 4,
      keyFifths: 0,
      voices: {
        S: [
          { midi: 60, start: 0, duration: 1, bar: 0 }, // pickup
          { midi: 60, start: 1, duration: 2, bar: 1 },
          { midi: 60, start: 3, duration: 2, bar: 1 }, // later note in the same bar: does not move the bar line
          { midi: 60, start: 5, duration: 4, bar: 2 },
        ],
      },
    };
    expect(barLines(score)).toEqual([1, 5, 9]);
  });

  it('is empty for an empty score', () => {
    expect(barLines({ beatsPerBar: 4, keyFifths: 0, voices: {} })).toEqual([]);
  });
});

describe('layoutScore', () => {
  const score: Score = {
    beatsPerBar: 4,
    keyFifths: 0,
    voices: {
      S: [{ midi: 72, start: 0, duration: 1, bar: 1, uncertain: true }],
      B: [
        { midi: null, start: 0, duration: 1, bar: 1 },
        { midi: 43, start: 1, duration: 1, bar: 1 },
      ],
    },
  };

  it('lays out notes ordered by time, marking the chosen voice and uncertain notes', () => {
    const laidOut = layoutScore(score, { voice: 'S', pxPerQuarter: 20 });
    expect(laidOut.map((note) => note.x)).toEqual([0, 0, 20]);
    const soprano = defined(laidOut.find((note) => note.voice === 'S'));
    expect(soprano.emphasis).toBe(true);
    expect(soprano.uncertain).toBe(true);
    const bass = defined(laidOut.find((note) => note.voice === 'B' && note.position !== null));
    expect(bass.emphasis).toBe(false);
  });

  it('lays out a rest with no staff position and the rest notehead', () => {
    const laidOut = layoutScore(score, { voice: 'S', pxPerQuarter: 20 });
    const rest = defined(laidOut.find((note) => note.notehead === 'rest'));
    expect(rest.position).toBeNull();
  });
});
