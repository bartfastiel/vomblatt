// The engraved fixture pieces (tools/render-fixtures.mjs): the clean grayscale sheet and the Score it shows.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import type { Score } from '../../score/score';
import type { GrayImage } from '../raster';

const here = dirname(fileURLToPath(import.meta.url));

// Binary PGM (P5, 8 bit), gzipped: header "P5\n<width> <height>\n255\n", then one byte per pixel
export const decodePgm = (bytes: Uint8Array): GrayImage => {
  const plain = bytes[0] === 0x1f ? gunzipSync(bytes) : Buffer.from(bytes);
  const header = /^P5\s+(\d+)\s+(\d+)\s+255\s/.exec(plain.subarray(0, 40).toString('latin1'));
  if (header === null) throw new Error('no 8-bit binary PGM');
  const width = Number(header[1]);
  const height = Number(header[2]);
  return { width, height, data: new Uint8Array(plain.subarray(header[0].length, header[0].length + width * height)) };
};

export const readSheet = (id: string): GrayImage => decodePgm(readFileSync(join(here, `${id}.pgm.gz`)));

export const readScore = (id: string): Score => JSON.parse(readFileSync(join(here, `${id}.json`), 'utf8')) as Score;
