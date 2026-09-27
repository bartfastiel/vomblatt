import { describe, expect, it } from 'vitest';
import { head, HEADER, note, reading, rest } from './__fixtures__/synthetic';
import { buildScore, inferBeatsPerBar, type System, systemBarlines } from './score-builder';

const melody = (staves: readonly number[]): System[] =>
  staves.map((staff) => ({ staves: [staff], parts: [{ voice: 'S', staff, select: 'all', clef: 'treble' }] }));

describe('inferBeatsPerBar', () => {
  it('takes the most frequent inner bar length', () => {
    expect(inferBeatsPerBar([1, 3, 3, 2.5, 3, 2])).toBe(3);
  });

  it('prefers the longer length on a tie and falls back to 4', () => {
    expect(inferBeatsPerBar([2, 4])).toBe(4);
    expect(inferBeatsPerBar([])).toBe(4);
    expect(inferBeatsPerBar([0, 0, 0])).toBe(4);
  });
});

describe('buildScore', () => {
  it('numbers bars across systems and starts every bar where the previous ended', () => {
    const first = reading(
      [note(10, 1, [head(10, 0)]), note(20, 1, [head(20, 1)]), note(40, 2, [head(40, 2)])],
      [30, 50],
    );
    const second = reading([note(10, 2, [head(10, 3)]), note(20, 1, [head(20, 4)])]);
    const score = buildScore([first, second], melody([0, 1]), ['S'], { keyFifths: 0 });
    expect(score.beatsPerBar).toBe(2);
    expect(score.voices.S).toEqual([
      { midi: 64, start: 0, duration: 1, bar: 1 },
      { midi: 65, start: 1, duration: 1, bar: 1 },
      { midi: 67, start: 2, duration: 2, bar: 2 },
      { midi: 69, start: 4, duration: 2, bar: 3, uncertain: true }, // the bar is too long for 2/4
      { midi: 71, start: 6, duration: 1, bar: 3, uncertain: true },
    ]);
  });

  it('continues a bar on the next system when the system does not end with a bar line', () => {
    const first = reading([note(10, 1, [head(10, 0)]), note(20, 1, [head(20, 0)]), note(40, 1, [head(40, 0)])], [30]);
    const second = reading([note(10, 1, [head(10, 0)]), note(40, 2, [head(40, 0)])], [20]);
    const score = buildScore([first, second], melody([0, 1]), ['S'], { keyFifths: 0 });
    expect(score.voices.S?.map((n) => n.bar)).toEqual([1, 1, 2, 2, 3]);
    expect(score.voices.S?.map((n) => n.start)).toEqual([0, 1, 2, 3, 4]);
  });

  it('numbers a short first bar as pickup bar 0', () => {
    const r = reading([note(10, 1, [head(10, 0)]), note(30, 3, [head(30, 0)]), note(50, 3, [head(50, 0)])], [20, 40]);
    const score = buildScore([r], melody([0]), ['S'], { keyFifths: 0 });
    expect(score.beatsPerBar).toBe(3);
    expect(score.voices.S?.map((n) => [n.bar, n.start])).toEqual([
      [0, 0],
      [1, 1],
      [2, 4],
    ]);
  });

  it('applies the key signature and lets an accidental hold to the end of the bar, across voices', () => {
    const r = reading(
      [
        note(10, 1, [head(10, 1, 100, { accidental: 0 })], true), // F natural in G major
        note(12, 1, [head(12, 1)], false), // alto, same position: natural too
        note(20, 1, [head(20, 1)], true), // still natural
        note(40, 1, [head(40, 1)], true), // next bar: F♯ again
        note(42, 1, [head(42, 1)], false),
      ],
      [30],
    );
    const system: System = {
      staves: [0],
      parts: [
        { voice: 'S', staff: 0, select: 'up', clef: 'treble' },
        { voice: 'A', staff: 0, select: 'down', clef: 'treble' },
      ],
    };
    const score = buildScore([r], [system], ['S', 'A'], { keyFifths: 1 });
    expect(score.voices.S?.map((n) => n.midi)).toEqual([65, 65, 66]);
    expect(score.voices.A?.map((n) => n.midi)).toEqual([65, 66]);
  });

  it('gives stemless chords their top head to the upper and their bottom head to the lower voice', () => {
    const r = reading(
      [note(10, 4, [head(10, 4), head(10, 2)]), rest(20, 4, 100), rest(30, 4, 140), rest(40, 4, 120)],
      [15, 25, 35],
    );
    const system: System = {
      staves: [0],
      parts: [
        { voice: 'S', staff: 0, select: 'up', clef: 'treble' },
        { voice: 'A', staff: 0, select: 'down', clef: 'treble' },
      ],
    };
    const score = buildScore([r], [system], ['S', 'A'], { keyFifths: 0 });
    expect(score.voices.S?.map((n) => n.midi)).toEqual([71, null, null]);
    expect(score.voices.A?.map((n) => n.midi)).toEqual([67, null, null]);
  });

  it('makes a whole rest last the whole bar, however long the bar is', () => {
    const r = reading([note(10, 3, [head(10, 0)]), rest(30, 4, 120, true), note(50, 3, [head(50, 0)])], [20, 40]);
    const score = buildScore([r], melody([0]), ['S'], { keyFifths: 0 });
    expect(score.voices.S).toEqual([
      { midi: 64, start: 0, duration: 3, bar: 1 },
      { midi: null, start: 3, duration: 3, bar: 2 },
      { midi: 64, start: 6, duration: 3, bar: 3 },
    ]);
  });

  it('uses the part clef where the staff shows none and passes uncertainty on', () => {
    const r = reading([{ ...note(10, 4, [head(10, 0)]), uncertain: true }], [], { ...HEADER, clef: null });
    const system: System = { staves: [0], parts: [{ voice: 'B', staff: 0, select: 'all', clef: 'bass' }] };
    expect(buildScore([r], [system], ['B'], { keyFifths: 0 }).voices.B).toEqual([
      { midi: 43, start: 0, duration: 4, bar: 1, uncertain: true },
    ]);
  });

  it('leaves a voice without a part empty', () => {
    expect(buildScore([reading([])], melody([0]), ['S', 'T'], { keyFifths: 0 }).voices).toEqual({ S: [], T: [] });
  });
});

describe('systemBarlines', () => {
  it('counts a bar line seen on two staves once', () => {
    const readings = [reading([], [100, 300]), reading([], [102, 200, 301], HEADER, 200)];
    expect(systemBarlines(readings, { staves: [0, 1], parts: [] })).toEqual([100, 200, 300]);
  });
});
