import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { deflateSync, gunzipSync } from 'node:zlib';

// A grayscale PNG from raw pixels – enough to hand the app a "photo" through the file input
const CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (bytes: Buffer): number => {
  let c = 0xffffffff;
  for (const byte of bytes) c = (CRC[(c ^ byte) & 0xff] ?? 0) ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type: string, data: Buffer): Buffer => {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
};
const png = (width: number, height: number, gray: Uint8Array): Buffer => {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  const raw = Buffer.alloc((width + 1) * height);
  for (let y = 0; y < height; y++) raw.set(gray.subarray(y * width, (y + 1) * width), y * (width + 1) + 1);
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([
    signature,
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
};

const entchen = (): Buffer => {
  const pgm = gunzipSync(readFileSync('src/scan/__fixtures__/entchen.pgm.gz'));
  const match = /^P5\s+(\d+)\s+(\d+)\s+255\s/.exec(pgm.subarray(0, 40).toString('latin1'));
  if (match === null) throw new Error('fixture is no PGM');
  const width = Number(match[1]);
  const height = Number(match[2]);
  return png(width, height, pgm.subarray(match[0].length, match[0].length + width * height));
};

test('a photo without staff lines brings back the start screen with a German hint', async ({ page }) => {
  await page.goto('/');
  const blank = png(320, 240, new Uint8Array(320 * 240).fill(250));
  await page.locator('#photo-input').setInputFiles({ name: 'leer.png', mimeType: 'image/png', buffer: blank });
  await expect(page.getByText('Keine Notenlinien gefunden')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText('Notenblatt fotografieren')).toBeVisible();
});

test('a photo of "Alle meine Entchen" is recognised in the worker and shown as a score', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.locator('#photo-input').setInputFiles({ name: 'entchen.png', mimeType: 'image/png', buffer: entchen() });
  await expect(page.locator('#score-screen')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('#stub-hint')).toBeHidden();
  expect(errors).toEqual([]);
});
