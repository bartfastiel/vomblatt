import { describe, expect, it } from 'vitest';
import { envelopePoints, pianoPartials } from './timbre';

const last = <T>(items: readonly T[]): T => items.reduce((_, item) => item);

describe('pianoPartials', () => {
  it('is topped by the fundamental at full weight', () => {
    expect(pianoPartials[0]).toEqual({ ratio: 1, gain: 1 });
    expect(Math.max(...pianoPartials.map((partial) => partial.gain))).toBe(1);
  });

  it('has every overtone quieter than the fundamental', () => {
    for (const partial of pianoPartials.slice(1)) expect(partial.gain).toBeLessThan(1);
  });
});

describe('envelopePoints', () => {
  it('starts and ends near silence, peaking at 1 shortly after the attack', () => {
    const points = envelopePoints(1);
    expect(points[0]?.time).toBe(0);
    expect(points[0]?.value).toBeLessThan(0.01);
    expect(Math.max(...points.map((point) => point.value))).toBe(1);
    expect(last(points).value).toBeLessThan(0.01);
  });

  it('has strictly increasing times', () => {
    const points = envelopePoints(2);
    points.reduce((previousTime, point) => {
      expect(point.time).toBeGreaterThan(previousTime);
      return point.time;
    }, -Infinity);
  });

  it('stretches to cover long notes and releases after they end', () => {
    const short = envelopePoints(0.1);
    const long = envelopePoints(3);
    expect(last(long).time).toBeGreaterThan(last(short).time);
    expect(last(long).time).toBeGreaterThan(3);
  });

  it('keeps every value within a valid gain range', () => {
    for (const point of envelopePoints(1.5)) {
      expect(point.value).toBeGreaterThan(0);
      expect(point.value).toBeLessThanOrEqual(1);
    }
  });
});
