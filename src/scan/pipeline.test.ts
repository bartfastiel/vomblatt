import { describe, expect, it } from 'vitest';
import { readScore, readSheet } from './__fixtures__/fixtures';
import { scoreAccuracy } from './__fixtures__/metrics';
import { PAPER_VARIANTS, SCREEN_VARIANTS } from './__fixtures__/variants';
import { NoStaffError, recognizeGray } from './pipeline';

// Simulated photos take a second or more under coverage on a slow runner
const SLOW = { timeout: 120_000 };

describe('recognizeGray on "Alle meine Entchen"', SLOW, () => {
  const sheet = readSheet('entchen');
  const expected = readScore('entchen');

  it('reads the clean engraving exactly: pitches, durations, starts, bars', () => {
    const { score, staves } = recognizeGray(sheet);
    expect(staves).toHaveLength(3);
    expect(score).toEqual(expected);
  });

  it.each(SCREEN_VARIANTS.map((v) => [v.name, v] as const))(
    'reads a simulated screen photo (%s) with at least 90 % pitch and rhythm accuracy',
    (_, variant) => {
      const accuracy = scoreAccuracy(expected, recognizeGray(variant.render(sheet)).score).S;
      expect(accuracy?.pitch).toBeGreaterThanOrEqual(0.9);
      expect(accuracy?.rhythm).toBeGreaterThanOrEqual(0.9);
    },
  );

  it.each(PAPER_VARIANTS.map((v) => [v.name, v] as const))(
    'reads a simulated photo of paper (%s) with at least 80 % pitch and rhythm accuracy',
    (_, variant) => {
      const accuracy = scoreAccuracy(expected, recognizeGray(variant.render(sheet)).score).S;
      expect(accuracy?.pitch).toBeGreaterThanOrEqual(0.8);
      expect(accuracy?.rhythm).toBeGreaterThanOrEqual(0.8);
    },
  );
});

// Hymn-style melodies with key signatures, rests, dots, beams, flags and accidentals: minimum accuracy (pitch and
// rhythm, averaged over the voices) clean and as simulated screen photos
const HYMNS = [
  { id: 'hymn-g-major', clean: 0.9, screen: 0.65 },
  { id: 'hymn-f-major', clean: 0.85, screen: 0.55 },
];

describe.each(HYMNS)('recognizeGray on $id', SLOW, ({ id, clean, screen }) => {
  const sheet = readSheet(id);
  const expected = readScore(id);

  it('reads the clean engraving with its key signature', () => {
    const { score } = recognizeGray(sheet);
    const accuracy = scoreAccuracy(expected, score).S;
    expect(score.keyFifths).toBe(expected.keyFifths);
    expect(score.beatsPerBar).toBe(expected.beatsPerBar);
    expect(accuracy?.pitch).toBeGreaterThanOrEqual(clean);
    expect(accuracy?.rhythm).toBeGreaterThanOrEqual(clean);
  });

  it('reads simulated screen photos', () => {
    for (const variant of SCREEN_VARIANTS.slice(0, 3)) {
      const accuracy = scoreAccuracy(expected, recognizeGray(variant.render(sheet)).score).S;
      expect(accuracy?.pitch).toBeGreaterThanOrEqual(screen);
      expect(accuracy?.rhythm).toBeGreaterThanOrEqual(screen);
    }
  });
});

describe('recognizeGray without music', () => {
  it('finds no staff on blank paper', () => {
    const blank = { width: 300, height: 200, data: new Uint8Array(300 * 200).fill(250) };
    expect(() => recognizeGray(blank)).toThrow(NoStaffError);
  });

  it('finds no staff in lines that are not equidistant', () => {
    const data = new Uint8Array(400 * 300).fill(240);
    for (const y of [20, 32, 70, 82, 120, 132, 170, 182, 220, 232]) data.fill(10, y * 400 + 20, y * 400 + 380);
    expect(() => recognizeGray({ width: 400, height: 300, data })).toThrow(NoStaffError);
  });
});
