import { describe, expect, it } from 'vitest';
import { scoreLength } from './score';

describe('scoreLength', () => {
  it('is the end of the last note over all voices', () => {
    expect(
      scoreLength({
        beatsPerBar: 4,
        keyFifths: 0,
        voices: {
          S: [{ midi: 60, start: 0, duration: 2, bar: 1 }],
          B: [{ midi: null, start: 2, duration: 3, bar: 1 }],
        },
      }),
    ).toBe(5);
  });

  it('is 0 for an empty score', () => {
    expect(scoreLength({ beatsPerBar: 4, keyFifths: 0, voices: {} })).toBe(0);
  });
});
