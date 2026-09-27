// Dev only, never in CI: reads the local real-world test images (decoded by decode-images.mjs into EVAL_REAL), each
// as it is and as a simulated screen photo, and prints what it read. Skips when the folder is missing.
//   node tools/eval/decode-images.mjs C:/tmp/vomblatt-testbilder <dir>
//   EVAL_REAL=<dir> EVAL_OUT=<dir> npx vitest run --config tools/eval/vitest.config.mjs realworld
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import type { Note, Voice } from '../../src/score/score';
import { decodePgm } from '../../src/scan/__fixtures__/fixtures';
import { SCREEN_VARIANTS } from '../../src/scan/__fixtures__/variants';
import { recognizeGray } from '../../src/scan/pipeline';
import type { GrayImage } from '../../src/scan/raster';

const real = process.env.EVAL_REAL ?? join(tmpdir(), 'vomblatt-testbilder-pgm');
const out = process.env.EVAL_OUT ?? tmpdir();
const lines: string[] = [];
const log = (line: string): void => {
  lines.push(line);
  writeFileSync(join(out, 'realworld.log'), lines.join('\n'));
};

const NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'G#', 'A', 'Bb', 'B'];
const nameOf = (note: Note): string => {
  if (note.midi === null) return 'r';
  return `${NAMES[note.midi % 12] ?? '?'}${note.uncertain === true ? '?' : ''}`;
};
const names = (notes: readonly Note[]): string => notes.map(nameOf).join(' ');

// Known melodies (pitch names only) for the images that show one
const KNOWN: Record<string, string> = {
  'entchen-melodie-cc': 'C D E F G G A A A A G A A A A G F F F F E E D D D D C',
};

const similarity = (a: string, b: string): number => {
  const x = a.split(' ');
  const y = b.split(' ');
  const table = Array.from({ length: x.length + 1 }, () => new Array<number>(y.length + 1).fill(0));
  for (let i = 1; i <= x.length; i++) {
    const row = table[i] ?? [];
    const previous = table[i - 1] ?? [];
    for (let j = 1; j <= y.length; j++) {
      row[j] = x[i - 1] === y[j - 1] ? (previous[j - 1] ?? 0) + 1 : Math.max(previous[j] ?? 0, row[j - 1] ?? 0);
    }
  }
  return (table[x.length]?.[y.length] ?? 0) / Math.max(x.length, y.length);
};

const run = (name: string, variant: string, image: GrayImage): void => {
  const t0 = performance.now();
  try {
    const result = recognizeGray(image);
    const ms = (performance.now() - t0).toFixed(0);
    log(`${name} [${variant}] ${ms} ms, ${String(result.staves.length)} staves, key ${String(result.score.keyFifths)}`);
    for (const voice of Object.keys(result.score.voices) as Voice[]) {
      const read = names(result.score.voices[voice] ?? []).replaceAll('?', '');
      const known = KNOWN[name];
      const score = known === undefined ? '' : ` — match ${(100 * similarity(known, read)).toFixed(0)}%`;
      log(`  ${voice}: ${names(result.score.voices[voice] ?? [])}${score}`);
    }
  } catch (error) {
    log(`${name} [${variant}] error ${String(error)}`);
  }
};

it('reads the real-world images', () => {
  if (!existsSync(real)) {
    log(`${real} missing – skipped`);
    return;
  }
  for (const file of readdirSync(real).filter((f) => f.endsWith('.pgm'))) {
    const name = file.replace('.pgm', '');
    const image = decodePgm(readFileSync(join(real, file)));
    run(name, 'as is', image);
    for (const variant of SCREEN_VARIANTS.slice(0, 2)) run(name, variant.name, variant.render(image));
  }
  expect(lines.length).toBeGreaterThan(0);
});
