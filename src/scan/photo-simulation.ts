// Ported from wumble (src/scan, MIT, same author).
// Turns a clean sheet into a "photo": smaller on a dark table, rotated, slightly blurred, with a brightness gradient,
// a hand shadow and reproducible noise – the test bench for the scanner without a camera.
import { byteAt, type GrayImage, numberAt, sampleBilinear } from './raster';

export interface PhotoOptions {
  readonly angle: number; // degrees, clockwise
  readonly seed: number;
}

const TABLE = 90; // brown table in grayscale
const MARGIN = 30; // the sheet is drawn this much smaller on every side
const NOISE = 28; // peak-to-peak
const LIGHT_FAR = 168; // gradient from white at the top left to this at the bottom right
const SHADOW = 156; // darkest point of the hand shadow

const clampByte = (value: number): number => Math.max(0, Math.min(255, Math.round(value)));

// The sheet placed on the table: every output pixel looks up its source through the inverse rotation and scale
const place = (sheet: GrayImage, angle: number): GrayImage => {
  const { width, height } = sheet;
  const radians = (angle * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const scaleX = width / (width - 2 * MARGIN);
  const scaleY = height / (height - 2 * MARGIN);
  const data = new Uint8Array(width * height).fill(TABLE);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dx = x - width / 2;
      const dy = y - height / 2;
      const sx = (dx * cos + dy * sin + width / 2 - MARGIN) * scaleX;
      const sy = (-dx * sin + dy * cos + height / 2 - MARGIN) * scaleY;
      if (sx < 0 || sy < 0 || sx > width - 1 || sy > height - 1) continue;
      data[y * width + x] = clampByte(sampleBilinear(sheet, sx, sy));
    }
  }
  return { width, height, data };
};

// Gaussian 3×3 with σ ≈ 0.6 px
const BLUR = [0.062, 0.249, 0.062, 0.249, 1, 0.249, 0.062, 0.249, 0.062];
const BLUR_SUM = BLUR.reduce((a, b) => a + b, 0);

const blur = (image: GrayImage): GrayImage => {
  const { width, height, data } = image;
  const out = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      for (let k = 0; k < 9; k++) {
        const xx = Math.min(width - 1, Math.max(0, x + (k % 3) - 1));
        const yy = Math.min(height - 1, Math.max(0, y + Math.floor(k / 3) - 1));
        sum += numberAt(BLUR, k) * byteAt(data, yy * width + xx);
      }
      out[y * width + x] = clampByte(sum / BLUR_SUM);
    }
  }
  return { width, height, data: out };
};

// Linear gradient along the diagonal times a radial hand shadow at the right, both multiplied in
const lighting = (width: number, height: number, x: number, y: number): number => {
  const diagonal = (x * width + y * height) / (width * width + height * height);
  const gradient = 255 + diagonal * (LIGHT_FAR - 255);
  const distance = Math.hypot(x - 0.82 * width, y - 0.45 * height);
  const shade = SHADOW + Math.min(1, Math.max(0, (distance - 30) / 390)) * (255 - SHADOW);
  return (gradient / 255) * (shade / 255);
};

// Linear congruential generator: ±14 per pixel, reproducible so that tests stay comparable
const noise = (image: GrayImage, seed: number): GrayImage => {
  const { width, height, data } = image;
  const out = new Uint8Array(width * height);
  let state = seed >>> 0;
  for (let i = 0; i < out.length; i++) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    out[i] = clampByte(byteAt(data, i) + (state / 2 ** 32 - 0.5) * NOISE);
  }
  return { width, height, data: out };
};

export const simulatePhoto = (sheet: GrayImage, { angle, seed }: PhotoOptions): GrayImage => {
  const { width, height } = sheet;
  const lit = blur(place(sheet, angle));
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      lit.data[i] = clampByte(byteAt(lit.data, i) * lighting(width, height, x, y));
    }
  }
  return noise(lit, seed);
};
