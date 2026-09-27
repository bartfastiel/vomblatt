// Dev only: photos of "Alle meine Entchen" (decoded to PGM by decode-images.mjs into EVAL_ACC), each drawn at the
// app's working size and read; logs the melody, how much of the song it has (recall) and how much of what was read
// belongs to the song (precision – a zoomed photo shows only part of it).
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import type { Note } from '../../src/score/score';
import { decodePgm } from '../../src/scan/__fixtures__/fixtures';
import { recognizeGray } from '../../src/scan/pipeline';
import { workingSize } from '../../src/scan/protocol';
import { type GrayImage, resizeArea } from '../../src/scan/raster';

const dir = process.env.EVAL_ACC ?? join(tmpdir(), 'vomblatt-acceptance-pgm');
const out = process.env.EVAL_OUT ?? tmpdir();
const lines: string[] = [];
const log = (line: string): void => {
  lines.push(line);
  writeFileSync(join(out, 'acceptance.log'), lines.join('\n'));
};

const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const SONG = 'C4 D4 E4 F4 G4 G4 A4 A4 A4 A4 G4 A4 A4 A4 A4 G4 F4 F4 F4 F4 E4 E4 D4 D4 D4 D4 C4'.split(' ');

const nameOf = (midi: number): string => `${NAMES[midi % 12] ?? '?'}${String(Math.floor(midi / 12) - 1)}`;
const melodyOf = (notes: readonly Note[]): string[] => notes.flatMap((n) => (n.midi === null ? [] : [nameOf(n.midi)]));

const common = (a: readonly string[], b: readonly string[]): number => {
  const table = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = 1; i <= a.length; i++) {
    const row = table[i] ?? [];
    const previous = table[i - 1] ?? [];
    for (let j = 1; j <= b.length; j++) {
      row[j] = a[i - 1] === b[j - 1] ? (previous[j - 1] ?? 0) + 1 : Math.max(previous[j] ?? 0, row[j - 1] ?? 0);
    }
  }
  return table[a.length]?.[b.length] ?? 0;
};

const read = (file: string, image: GrayImage): void => {
  const t0 = performance.now();
  try {
    const { score, staves } = recognizeGray(image);
    const melody = melodyOf(score.voices.S ?? []);
    const hits = String(common(SONG, melody));
    const ms = (performance.now() - t0).toFixed(0);
    log(
      `${file} ${ms} ms, ${String(staves.length)} staves, recall ${hits}/27, precision ${hits}/${String(melody.length)}`,
    );
    log(`   ${melody.join(' ')}`);
  } catch (error) {
    log(`${file} ${String(error)}`);
  }
};

it('reads the acceptance photos', () => {
  if (!existsSync(dir)) {
    log(`${dir} missing – skipped`);
    return;
  }
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.pgm'))) {
    const raw = decodePgm(readFileSync(join(dir, file)));
    const size = workingSize(raw.width, raw.height);
    read(file, size.width === raw.width ? raw : resizeArea(raw, size.width, size.height));
  }
  expect(lines.length).toBeGreaterThan(0);
});
