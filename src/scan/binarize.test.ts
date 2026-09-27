import { describe, expect, it } from 'vitest';
import { asciiFromBinary, binaryFromAscii, grayFromAscii } from './__fixtures__/ascii';
import { binarize, darkBorders, inkRunDown, inkRunRight, paperWhite, whitenBorders } from './binarize';
import type { GrayImage } from './raster';

const flat = (width: number, height: number, value: number): GrayImage => ({
  width,
  height,
  data: new Uint8Array(width * height).fill(value),
});

describe('paperWhite', () => {
  it('is the 70th percentile of the brightness', () => {
    const data = new Uint8Array(100);
    for (let i = 0; i < 100; i++) data[i] = i;
    expect(paperWhite({ width: 10, height: 10, data })).toBe(69);
  });

  it('is 255 for a white image', () => {
    expect(paperWhite(flat(4, 4, 255))).toBe(255);
  });
});

describe('darkBorders', () => {
  it('finds the table at the edges', () => {
    const image = flat(20, 20, 240);
    for (let y = 0; y < 20; y++) {
      for (let x = 0; x < 20; x++) if (x < 3 || y >= 18) image.data[y * 20 + x] = 20;
    }
    expect(darkBorders(image, 240)).toEqual({ x0: 3, y0: 0, x1: 20, y1: 18 });
  });

  it('stops at a quarter of the image even when everything is dark', () => {
    expect(darkBorders(flat(40, 40, 10), 240)).toEqual({ x0: 10, y0: 10, x1: 30, y1: 30 });
  });
});

describe('whitenBorders', () => {
  it('returns the image itself without dark borders', () => {
    const image = flat(8, 8, 230);
    expect(whitenBorders(image, 230).image).toBe(image);
  });

  it('continues the paper next to the border, shadow included', () => {
    const image = flat(20, 12, 200);
    for (let y = 0; y < 12; y++) {
      for (let x = 0; x < 20; x++) {
        if (x >= 16 || y < 2)
          image.data[y * 20 + x] = 30; // table on the right and at the top
        else if (x >= 6) image.data[y * 20 + x] = 120; // shadow on the paper
      }
    }
    const { image: filled, crop } = whitenBorders(image, 200);
    expect(crop).toEqual({ x0: 0, y0: 2, x1: 16, y1: 12 });
    expect(filled.data[5 * 20 + 18]).toBe(120);
    expect(filled.data[3]).toBe(200);
    expect(filled.data[18]).toBe(120);
    expect(image.data[5 * 20 + 18]).toBe(30); // the input stays untouched
  });
});

describe('binarize', () => {
  it('marks a stroke with its 3×3 surroundings and leaves the paper itself empty', () => {
    const stroke = '.'.repeat(5) + '#'.repeat(30) + '.'.repeat(5);
    const rows = Array.from({ length: 40 }, (_, y) => (y === 20 ? stroke : '.'.repeat(40)));
    const ink = asciiFromBinary(binarize(grayFromAscii(rows), 255));
    expect(ink[20]).toBe(stroke);
    expect(ink[19]?.slice(5, 35)).toBe('#'.repeat(30)); // a one-pixel line reads three pixels thick
    expect(ink[18]).toBe('.'.repeat(40));
    expect(ink[22]).toBe('.'.repeat(40));
  });

  it('closes gaps in a washed-out stroke through the 3×3 mean', () => {
    const image = flat(40, 40, 255);
    for (let x = 5; x < 35; x++) image.data[20 * 40 + x] = x % 2 === 0 ? 0 : 200;
    expect(binarize(image, 255).data[20 * 40 + 11]).toBe(1);
  });

  it('leaves areas that are no paper empty', () => {
    const image = flat(40, 40, 60);
    image.data[20 * 40 + 20] = 0;
    expect([...binarize(image, 255).data].every((value) => value === 0)).toBe(true);
  });
});

describe('ink runs', () => {
  const image = binaryFromAscii(['..#..', '..#..', '.###.', '.....']);

  it('measure downwards and to the right', () => {
    expect(inkRunDown(image, 2, 0)).toBe(3);
    expect(inkRunRight(image, 1, 2)).toBe(4);
    expect(inkRunDown(image, 0, 0)).toBe(0);
  });
});
