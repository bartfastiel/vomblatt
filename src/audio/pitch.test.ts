import { describe, expect, it } from 'vitest';
import { mtof } from './pitch';

describe('mtof', () => {
  it('tunes A4 (midi 69) to 440 Hz', () => {
    expect(mtof(69)).toBe(440);
  });

  it('doubles per octave up and down', () => {
    expect(mtof(81)).toBe(880);
    expect(mtof(57)).toBe(220);
  });

  it('computes C4 in equal temperament', () => {
    expect(mtof(60)).toBeCloseTo(261.626, 3);
  });
});
