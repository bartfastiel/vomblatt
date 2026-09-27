#!/usr/bin/env node
// Dev only: decodes the local real-world test photos (third-party images, never committed) to grayscale PGM with
// Playwright's Chromium, so that the Node evaluation can read them without an image decoder dependency.
//   node tools/eval/decode-images.mjs [sourceDir] [targetDir]
import { chromium } from '@playwright/test';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { extname, join } from 'node:path';

const source = process.argv[2] ?? 'C:/tmp/vomblatt-testbilder';
const target = process.argv[3] ?? join(tmpdir(), 'vomblatt-testbilder-pgm');
if (!existsSync(source)) {
  console.log(`${source} missing – nothing to decode`);
  process.exit(0);
}
mkdirSync(target, { recursive: true });

const TYPES = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png' };
const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent('<html><body></body></html>');
for (const name of readdirSync(source)) {
  const type = TYPES[extname(name).toLowerCase()];
  if (type === undefined) continue;
  const base64 = readFileSync(join(source, name)).toString('base64');
  const result = await page.evaluate(
    async ({ data, mime }) => {
      const blob = await (await fetch(`data:${mime};base64,${data}`)).blob();
      const bitmap = await createImageBitmap(blob);
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      const context = canvas.getContext('2d');
      context.fillStyle = '#fff';
      context.fillRect(0, 0, bitmap.width, bitmap.height);
      context.drawImage(bitmap, 0, 0);
      const pixels = context.getImageData(0, 0, bitmap.width, bitmap.height).data;
      let binary = '';
      for (let i = 0; i < pixels.length; i += 4) {
        binary += String.fromCharCode((pixels[i] * 77 + pixels[i + 1] * 151 + pixels[i + 2] * 28) >> 8);
      }
      return `${String(bitmap.width)} ${String(bitmap.height)} ${btoa(binary)}`;
    },
    { data: base64, mime: type },
  );
  const [width, height, pixels] = result.split(' ');
  const header = Buffer.from(`P5\n${width} ${height}\n255\n`, 'latin1');
  writeFileSync(
    join(target, `${name.replace(/\.[^.]+$/, '')}.pgm`),
    Buffer.concat([header, Buffer.from(pixels, 'base64')]),
  );
  console.log(`${name}: ${width}×${height}`);
}
await browser.close();
