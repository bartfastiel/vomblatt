import { describe, expect, it } from 'vitest';
import { type Score, VOICES } from '../score/score';
import { readScore, readSheet } from './__fixtures__/fixtures';
import { scoreAccuracy } from './__fixtures__/metrics';
import { DESK_VARIANTS, PAPER_VARIANTS, PHONE_SCREEN_VARIANTS, SCREEN_VARIANTS } from './__fixtures__/variants';
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
    'reads a simulated screen photo (%s) with at least 85 % pitch and rhythm accuracy',
    (_, variant) => {
      const accuracy = scoreAccuracy(expected, recognizeGray(variant.render(sheet)).score).S;
      expect(accuracy?.pitch).toBeGreaterThanOrEqual(0.85);
      expect(accuracy?.rhythm).toBeGreaterThanOrEqual(0.85);
    },
  );

  // A phone on a desk showing the sheet, photographed at full camera size: small staff, perspective, scan lines,
  // glare band, bezel – as hard as a real acceptance check
  it.each(DESK_VARIANTS.slice(0, 2).map((v) => [v.name, v] as const))(
    'reads a photo of a phone on a desk (%s) with at least 95 %% of the pitches',
    (_, variant) => {
      const accuracy = scoreAccuracy(expected, recognizeGray(variant.render(sheet)).score).S;
      expect(accuracy?.pitch).toBeGreaterThanOrEqual(0.95);
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

// Four-part settings: minimum accuracy per voice, clean and as simulated photos of paper and of a phone screen
const CHORALES = [
  { id: 'chorale-satb2', clean: 0.8, photo: 0.6 },
  { id: 'chorale-satb4', clean: 0.9, photo: 0.8 },
];

describe.each(CHORALES)('recognizeGray on $id', SLOW, ({ id, clean, photo }) => {
  const sheet = readSheet(id);
  const expected = readScore(id);

  const expectVoices = (score: Score, minimum: number): void => {
    const accuracy = scoreAccuracy(expected, score);
    for (const voice of VOICES) {
      expect(accuracy[voice]?.pitch, voice).toBeGreaterThanOrEqual(minimum);
      expect(accuracy[voice]?.rhythm, voice).toBeGreaterThanOrEqual(minimum);
    }
  };

  it('reads all four voices of the clean engraving', () => {
    const { score } = recognizeGray(sheet);
    expect(Object.keys(score.voices)).toEqual(['S', 'A', 'T', 'B']);
    expectVoices(score, clean);
  });

  it('reads a photo of the printed page and a photo of a phone screen', () => {
    for (const variant of [PAPER_VARIANTS[1], PHONE_SCREEN_VARIANTS[2]]) {
      if (variant !== undefined) expectVoices(recognizeGray(variant.render(sheet)).score, photo);
    }
  });
});

// A lead sheet as a web page shows it: a tempo mark above the clef, repeat signs at the start and end of a system, the
// last note a whole C4 on a ledger line
describe('recognizeGray on the "Alle meine Entchen" lead sheet', SLOW, () => {
  const sheet = readSheet('entchen-leadsheet');
  const expected = readScore('entchen-leadsheet');

  it('reads every note with no gaps: no note from the tempo mark, no empty bar from a repeat sign', () => {
    expect(recognizeGray(sheet).score).toEqual(expected);
  });

  it('reads a photo of a phone on a desk showing it, the last note included', () => {
    const variant = DESK_VARIANTS[0];
    if (variant === undefined) throw new Error('no variant');
    const notes = recognizeGray(variant.render(sheet)).score.voices.S ?? [];
    expect(scoreAccuracy(expected, recognizeGray(variant.render(sheet)).score).S?.pitch).toBeGreaterThanOrEqual(0.95);
    expect(notes[notes.length - 1]?.midi).toBe(60);
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
