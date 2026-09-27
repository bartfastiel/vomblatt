// Dev only: every fixture under every distortion, accuracy and time per run
//   EVAL_OUT=<dir> [EVAL_PIECES=a,b] npx vitest run --config tools/eval/vitest.config.mjs sweep
import { readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import type { Voice } from '../../src/score/score';
import { readScore, readSheet } from '../../src/scan/__fixtures__/fixtures';
import { scoreAccuracy } from '../../src/scan/__fixtures__/metrics';
import { ALL_VARIANTS } from '../../src/scan/__fixtures__/variants';
import { recognizeGray } from '../../src/scan/pipeline';

const out = process.env.EVAL_OUT ?? tmpdir();
const lines: string[] = [];
const log = (line: string): void => {
  lines.push(line);
  writeFileSync(join(out, 'sweep.log'), lines.join('\n'));
};

const pieces =
  process.env.EVAL_PIECES?.split(',') ??
  readdirSync('src/scan/__fixtures__')
    .filter((f) => f.endsWith('.pgm.gz'))
    .map((f) => f.replace('.pgm.gz', ''));

it('sweeps', () => {
  const totals = new Map<string, { pitch: number; rhythm: number; runs: number }>();
  for (const piece of pieces) {
    const sheet = readSheet(piece);
    const expected = readScore(piece);
    for (const variant of ALL_VARIANTS) {
      const t0 = performance.now();
      let summary: string;
      try {
        const result = recognizeGray(variant.render(sheet));
        const accuracy = scoreAccuracy(expected, result.score);
        summary = (Object.keys(accuracy) as Voice[])
          .map((voice) => {
            const a = accuracy[voice];
            if (a === undefined) return '';
            const total = totals.get(piece) ?? { pitch: 0, rhythm: 0, runs: 0 };
            totals.set(piece, { pitch: total.pitch + a.pitch, rhythm: total.rhythm + a.rhythm, runs: total.runs + 1 });
            return `${voice} ${(100 * a.pitch).toFixed(0)}%/${(100 * a.rhythm).toFixed(0)}% (${String(a.recognized)}/${String(a.expected)})`;
          })
          .join('  ');
      } catch (error) {
        summary = `error ${String(error)}`;
      }
      log(
        `${piece.padEnd(16)} ${variant.name.padEnd(34)} ${(performance.now() - t0).toFixed(0).padStart(5)} ms  ${summary}`,
      );
    }
  }
  for (const [piece, t] of totals) {
    log(
      `TOTAL ${piece.padEnd(16)} pitch ${((100 * t.pitch) / t.runs).toFixed(1)}%  rhythm ${((100 * t.rhythm) / t.runs).toFixed(1)}%`,
    );
  }
  expect(lines.length).toBeGreaterThan(0);
});
