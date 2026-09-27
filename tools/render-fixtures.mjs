#!/usr/bin/env node
// Dev only: engraves the fixture pieces (tools/fixtures/pieces.mjs) with Verovio, rasterises the SVG in Playwright's
// Chromium and writes src/scan/__fixtures__/<id>.pgm.gz (grayscale) plus <id>.json (the Score recognition must
// read). Neither Verovio nor Chromium reaches the bundle; the tests only read the files written here.
//
//   node tools/render-fixtures.mjs [id …]      (all pieces without arguments; --svg keeps the SVG next to them)
import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { VerovioToolkit } from 'verovio/esm';
import createVerovioModule from 'verovio/wasm-hum';
import { kernBody, parseVoice, scoreNotes } from './fixtures/kern.mjs';
import { PIECES } from './fixtures/pieces.mjs';

const OUT = 'src/scan/__fixtures__';

// Kern columns and header per layout: the lowest staff is the leftmost spine, `*^` puts two voices on one staff
// (left sub-spine = upper voice, stems up)
const LAYOUTS = {
  melody: { columns: ['S', 'text'], clefs: ['*clefG2', '*'], split: false },
  satb2: { columns: ['T', 'B', 'S', 'A', 'text'], clefs: ['*clefF4', '*clefG2', '*'], split: true },
  satb4: {
    columns: ['B', 'T', 'A', 'S', 'text'],
    clefs: ['*clefF4', '*clefGv2', '*clefG2', '*clefG2', '*'],
    split: false,
  },
};

const kernOf = (piece, parsed) => {
  const layout = LAYOUTS[piece.layout];
  const spines = layout.clefs.map((clef) => (clef === '*' ? '**text' : '**kern'));
  const tandem = (value) => layout.clefs.map((clef) => (clef === '*' ? '*' : value)).join('\t');
  const header = [spines.join('\t'), layout.clefs.join('\t'), tandem(`*k[${piece.key}]`)];
  if (piece.meter !== null) header.push(tandem(`*M${String(piece.meter[0])}/${String(piece.meter[1])}`));
  if (layout.split) header.push(layout.clefs.map((clef) => (clef === '*' ? '*' : '*^')).join('\t'));
  const body = kernBody(layout.columns, parsed, piece.lyrics);
  const title = piece.title === undefined ? [] : [`!!!OTL: ${piece.title}`];
  return [...title, ...header, ...body, layout.columns.map(() => '*-').join('\t')].join('\n') + '\n';
};

const expectedScore = (piece, parsed) => {
  const beatsPerBar = piece.meter === null ? 4 : (piece.meter[0] * 4) / piece.meter[1];
  const voices = {};
  for (const voice of Object.keys(piece.voices)) voices[voice] = scoreNotes(parsed[voice]);
  return { voices, beatsPerBar, keyFifths: piece.keyFifths };
};

const rasterise = async (page, svg) => {
  await page.setContent('<html><body style="margin:0"></body></html>');
  const base64 = await page.evaluate(async (source) => {
    const image = new Image();
    image.src = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(source)))}`;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext('2d');
    context.fillStyle = '#fff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0);
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
    let binary = '';
    for (let i = 0; i < data.length; i += 4) {
      binary += String.fromCharCode((data[i] * 77 + data[i + 1] * 151 + data[i + 2] * 28) >> 8);
    }
    return `${String(canvas.width)} ${String(canvas.height)} ${btoa(binary)}`;
  }, svg);
  const [width, height, pixels] = base64.split(' ');
  return { width: Number(width), height: Number(height), data: Buffer.from(pixels, 'base64') };
};

const main = async () => {
  const args = process.argv.slice(2);
  const keepSvg = args.includes('--svg');
  const ids = args.filter((arg) => !arg.startsWith('--'));
  const pieces = PIECES.filter((piece) => ids.length === 0 || ids.includes(piece.id));
  const toolkit = new VerovioToolkit(await createVerovioModule());
  const browser = await chromium.launch();
  const page = await browser.newPage();
  for (const piece of pieces) {
    const beatsPerBar = piece.meter === null ? 4 : (piece.meter[0] * 4) / piece.meter[1];
    const parsed = Object.fromEntries(
      Object.entries(piece.voices).map(([voice, text]) => [voice, parseVoice(text, beatsPerBar)]),
    );
    const kern = kernOf(piece, parsed);
    toolkit.setOptions({
      inputFrom: 'humdrum',
      pageWidth: piece.pageWidth,
      pageHeight: 60000,
      adjustPageHeight: true,
      scale: piece.scale,
      font: piece.font,
      header: 'none',
      footer: 'none',
      pageMarginLeft: 60,
      pageMarginRight: 60,
      pageMarginTop: 60,
      pageMarginBottom: 60,
      ...piece.options,
    });
    toolkit.loadData(kern);
    const svg = toolkit.renderToSVG(1);
    if (keepSvg) writeFileSync(join(OUT, `${piece.id}.svg`), svg);
    const image = await rasterise(page, svg);
    const pgm = Buffer.concat([
      Buffer.from(`P5\n${String(image.width)} ${String(image.height)}\n255\n`, 'latin1'),
      image.data,
    ]);
    writeFileSync(join(OUT, `${piece.id}.pgm.gz`), gzipSync(pgm, { level: 9 }));
    writeFileSync(join(OUT, `${piece.id}.json`), `${JSON.stringify(expectedScore(piece, parsed))}\n`);
    console.log(`${piece.id}: ${String(image.width)}×${String(image.height)}`);
  }
  await browser.close();
};

await main();
