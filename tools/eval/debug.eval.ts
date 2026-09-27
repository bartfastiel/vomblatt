// Dev only: runs the pipeline on one fixture (or a PGM file) under one distortion and logs what it read.
//   EVAL_OUT=<dir> EVAL_PIECE=entchen EVAL_VARIANT=1 [EVAL_FILE=x.pgm] [EVAL_CROP=x0,y0,x1,y1] \
//     npx vitest run --config tools/eval/vitest.config.mjs debug
import { readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import type { Voice } from '../../src/score/score';
import { decodePgm, readScore, readSheet } from '../../src/scan/__fixtures__/fixtures';
import { describeNotes, scoreAccuracy } from '../../src/scan/__fixtures__/metrics';
import { ALL_VARIANTS } from '../../src/scan/__fixtures__/variants';
import type { BinaryImage } from '../../src/scan/binarize';
import { type Recognition, recognizeGray } from '../../src/scan/pipeline';
import type { GrayImage } from '../../src/scan/raster';

const out = process.env.EVAL_OUT ?? tmpdir();
const lines: string[] = [];
const log = (...parts: unknown[]): void => {
  lines.push(parts.map(String).join(' '));
  writeFileSync(join(out, 'eval.log'), lines.join('\n'));
};

const writePgm = (name: string, image: GrayImage): void => {
  const header = Buffer.from(`P5\n${String(image.width)} ${String(image.height)}\n255\n`, 'latin1');
  writeFileSync(join(out, name), Buffer.concat([header, Buffer.from(image.data)]));
};

const piece = process.env.EVAL_PIECE ?? 'entchen';

const input = (): GrayImage => {
  const file = process.env.EVAL_FILE;
  const sheet = file === undefined ? readSheet(piece) : decodePgm(readFileSync(file));
  const variant = ALL_VARIANTS[Number(process.env.EVAL_VARIANT ?? 1)] ?? ALL_VARIANTS[0];
  log('variant', variant?.name);
  return variant === undefined ? sheet : variant.render(sheet);
};

const logStaves = (result: Recognition): void => {
  for (const { staff, header, barlines } of result.readings) {
    log('staff', staff.x0, staff.x1, 'knots', staff.knots.length, 'clef', header.clef, 'key', header.keyFifths);
    log('  header end', header.end, 'digits', header.digits.length, 'bars', barlines.map(Math.round).join(','));
  }
};

const logCrop = (image: BinaryImage, crop: string): void => {
  const [x0 = 0, y0 = 0, x1 = 0, y1 = 0] = crop.split(',').map(Number);
  for (let y = y0; y < y1; y++) {
    let row = '';
    for (let x = x0; x < x1; x++) row += image.data[y * image.width + x] === 1 ? '#' : '.';
    log(row);
  }
};

const logScore = (result: Recognition): void => {
  log('beatsPerBar', result.score.beatsPerBar, 'key', result.score.keyFifths);
  if (process.env.EVAL_FILE !== undefined) {
    for (const [voice, notes] of Object.entries(result.score.voices)) log(voice, describeNotes(notes));
    return;
  }
  const expected = readScore(piece);
  log('accuracy', JSON.stringify(scoreAccuracy(expected, result.score)));
  for (const voice of Object.keys(expected.voices) as Voice[]) {
    log(voice, 'expected  ', describeNotes(expected.voices[voice] ?? []));
    log(voice, 'recognized', describeNotes(result.score.voices[voice] ?? []));
  }
};

it('logs what the pipeline reads', () => {
  const photo = input();
  writePgm('input.pgm', photo);
  const t0 = performance.now();
  const result = recognizeGray(photo);
  log('ms', (performance.now() - t0).toFixed(0), 'scale', result.scale.toFixed(3), 'angle', result.angle);
  writePgm('clean.pgm', { ...result.clean, data: result.clean.data.map((v) => (v === 1 ? 0 : 255)) });
  logStaves(result);
  if (process.env.EVAL_CROP !== undefined) logCrop(result.clean, process.env.EVAL_CROP);
  logScore(result);
  expect(lines.length).toBeGreaterThan(0);
});
