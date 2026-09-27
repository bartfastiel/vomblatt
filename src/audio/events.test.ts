import { describe, expect, it } from 'vitest';
import { eventsFor, nearestOnset, noteOnsets, passLengthSeconds } from './events';
import type { Score } from '../score/score';

const score: Score = {
  beatsPerBar: 4,
  keyFifths: 0,
  voices: {
    S: [
      { midi: 72, start: 0, duration: 1, bar: 1 },
      { midi: 74, start: 1, duration: 1, bar: 1 },
      { midi: null, start: 2, duration: 1, bar: 1 }, // rest
      { midi: 76, start: 3, duration: 1, bar: 1 },
    ],
    B: [{ midi: 48, start: 0, duration: 4, bar: 1 }],
  },
};

describe('eventsFor', () => {
  it('plays the chosen voice at full gain and mutes the rest by default', () => {
    const events = eventsFor(score, { voice: 'S', othersGain: 0, tempo: 60, start: 0 });
    expect(events).toEqual([
      { time: 0, duration: 1, midi: 72, gain: 1 },
      { time: 1, duration: 1, midi: 74, gain: 1 },
      { time: 3, duration: 1, midi: 76, gain: 1 },
    ]);
  });

  it('adds the other voices quietly when asked', () => {
    const events = eventsFor(score, { voice: 'S', othersGain: 0.25, tempo: 60, start: 0 });
    expect(events).toContainEqual({ time: 0, duration: 4, midi: 48, gain: 0.25 });
  });

  it('skips rests (midi null)', () => {
    const events = eventsFor(score, { voice: 'S', othersGain: 0, tempo: 60, start: 0 });
    expect(events.some((event) => event.time === 2)).toBe(false);
  });

  it('scales time by tempo (quarter notes per minute -> seconds)', () => {
    const events = eventsFor(score, { voice: 'S', othersGain: 0, tempo: 120, start: 0 });
    expect(events[0]).toEqual({ time: 0, duration: 0.5, midi: 72, gain: 1 });
    expect(events[1]).toEqual({ time: 0.5, duration: 0.5, midi: 74, gain: 1 });
  });

  it('starts partway through and re-bases time to zero', () => {
    const events = eventsFor(score, { voice: 'S', othersGain: 0, tempo: 60, start: 1 });
    expect(events).toEqual([
      { time: 0, duration: 1, midi: 74, gain: 1 },
      { time: 2, duration: 1, midi: 76, gain: 1 },
    ]);
  });

  it('stops at an explicit end', () => {
    const events = eventsFor(score, { voice: 'S', othersGain: 0, tempo: 60, start: 0, end: 1 });
    expect(events).toEqual([{ time: 0, duration: 1, midi: 72, gain: 1 }]);
  });
});

describe('passLengthSeconds', () => {
  it('is the excerpt length in seconds at the given tempo', () => {
    expect(passLengthSeconds(score, { tempo: 60, start: 0 })).toBe(4);
    expect(passLengthSeconds(score, { tempo: 120, start: 0 })).toBe(2);
    expect(passLengthSeconds(score, { tempo: 60, start: 2, end: 4 })).toBe(2);
  });
});

describe('noteOnsets', () => {
  it('collects the sounding start times of every voice, sorted and de-duplicated', () => {
    expect(noteOnsets(score)).toEqual([0, 1, 3]);
  });

  it('is empty for a score without sounding notes', () => {
    expect(
      noteOnsets({ beatsPerBar: 4, keyFifths: 0, voices: { S: [{ midi: null, start: 0, duration: 4, bar: 1 }] } }),
    ).toEqual([]);
  });
});

describe('nearestOnset', () => {
  it('picks the closest onset', () => {
    expect(nearestOnset([0, 1, 3], 0.4)).toBe(0);
    expect(nearestOnset([0, 1, 3], 0.6)).toBe(1);
    expect(nearestOnset([0, 1, 3], 10)).toBe(3);
  });

  it('falls back to the target when there are no onsets', () => {
    expect(nearestOnset([], 2.5)).toBe(2.5);
  });
});
