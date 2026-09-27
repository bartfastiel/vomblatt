import { describe, expect, it } from 'vitest';
import { createTapTempo } from './tap-tempo';

// A controllable clock: advance it explicitly between taps instead of relying on wall-clock time.
const fakeClock = (start = 0): { now: () => number; advance: (ms: number) => void } => {
  let time = start;
  return { now: () => time, advance: (ms: number) => (time += ms) };
};

describe('createTapTempo', () => {
  it('returns null for the first tap of a sequence (no interval yet)', () => {
    const tempo = createTapTempo(fakeClock().now);
    expect(tempo.tap()).toBeNull();
  });

  it('computes BPM from the interval between two taps', () => {
    const clock = fakeClock();
    const tempo = createTapTempo(clock.now);
    tempo.tap();
    clock.advance(500);
    expect(tempo.tap()).toBe(120);
  });

  it('averages the intervals of more than two taps', () => {
    const clock = fakeClock();
    const tempo = createTapTempo(clock.now);
    tempo.tap();
    clock.advance(500);
    expect(tempo.tap()).toBe(120);
    clock.advance(500);
    expect(tempo.tap()).toBe(120);
    clock.advance(500);
    expect(tempo.tap()).toBe(120);
  });

  it('uses only the last up to 6 taps', () => {
    const clock = fakeClock();
    const tempo = createTapTempo(clock.now);
    const gapsMs = [1000, 500, 500, 500, 500, 500]; // 7 taps total; first gap would pull the average down
    let result = tempo.tap();
    for (const gap of gapsMs) {
      clock.advance(gap);
      result = tempo.tap();
    }
    // with all 7 taps the average interval would be 3500/6 ≈ 583ms (~103 BPM); dropping the stale first
    // interval leaves 5 intervals of 500ms each, i.e. exactly 120 BPM.
    expect(result).toBe(120);
  });

  it('resets the sequence after a gap of more than 2 seconds', () => {
    const clock = fakeClock();
    const tempo = createTapTempo(clock.now);
    tempo.tap();
    clock.advance(500);
    expect(tempo.tap()).toBe(120);
    clock.advance(2001);
    expect(tempo.tap()).toBeNull(); // the long gap itself is discarded, not averaged in
    clock.advance(500);
    expect(tempo.tap()).toBe(120); // the new sequence works normally
  });

  it('does not reset on a gap of exactly 2 seconds', () => {
    const clock = fakeClock();
    const tempo = createTapTempo(clock.now);
    tempo.tap();
    clock.advance(2000);
    expect(tempo.tap()).toBe(30);
  });
});
