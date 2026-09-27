import { describe, expect, it } from 'vitest';
import { simulatePhoto } from './photo-simulation';
import type { GrayImage } from './raster';
import { GrayCanvas } from './rasterizer';

const WIDTH = 400;
const HEIGHT = 200;

const sheetWithLine = (): GrayImage => {
  const canvas = new GrayCanvas(WIDTH, HEIGHT);
  canvas.horizontalLine(40, 360, 100.5, 1);
  return canvas.image();
};

const at = (image: GrayImage, x: number, y: number): number => image.data[y * image.width + x] ?? 0;

describe('simulatePhoto', () => {
  const photo = simulatePhoto(sheetWithLine(), { angle: 0, seed: 1 });

  it('keeps the size and shows the table around the sheet', () => {
    expect(photo.width).toBe(WIDTH);
    expect(photo.height).toBe(HEIGHT);
    expect(at(photo, 2, 2)).toBeLessThan(120);
    expect(at(photo, WIDTH - 3, HEIGHT - 3)).toBeLessThan(120);
    expect(at(photo, 60, 40)).toBeGreaterThan(200);
  });

  it('is reproducible per seed and noisy', () => {
    expect(simulatePhoto(sheetWithLine(), { angle: 0, seed: 1 }).data).toEqual(photo.data);
    const other = simulatePhoto(sheetWithLine(), { angle: 0, seed: 7 });
    expect(other.data).not.toEqual(photo.data);
    let maxDifference = 0;
    for (let i = 0; i < photo.data.length; i++) {
      maxDifference = Math.max(maxDifference, Math.abs((photo.data[i] ?? 0) - (other.data[i] ?? 0)));
    }
    expect(maxDifference).toBeLessThanOrEqual(28);
  });

  it('darkens towards the bottom right and under the hand shadow', () => {
    expect(at(photo, 60, 40)).toBeGreaterThan(at(photo, 340, 160));
    expect(at(photo, 60, 40)).toBeGreaterThan(at(photo, Math.round(0.82 * WIDTH), Math.round(0.45 * HEIGHT)));
  });

  it('draws the line smaller inside the margins and blurred', () => {
    // The line at y = 100.5 of the sheet lands at 30 + 100.5 · (140/200) ≈ 100 – the centre stays the centre
    const column = Array.from({ length: HEIGHT }, (_, y) => at(photo, 200, y));
    const darkest = column.indexOf(Math.min(...column.slice(31, HEIGHT - 31)));
    expect(Math.abs(darkest - 100)).toBeLessThanOrEqual(1);
    expect(at(photo, 200, darkest - 1)).toBeLessThan(at(photo, 200, darkest - 4));
  });

  it('rotates the sheet clockwise for a positive angle', () => {
    const turned = simulatePhoto(sheetWithLine(), { angle: 3, seed: 1 });
    const darkestRow = (x: number): number => {
      const column = Array.from({ length: HEIGHT }, (_, y) => (y < 45 || y > 155 ? 255 : at(turned, x, y)));
      return column.indexOf(Math.min(...column));
    };
    expect(darkestRow(300)).toBeGreaterThan(darkestRow(100));
  });
});
