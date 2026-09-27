import { describe, expect, it } from 'vitest';
import { binaryFromAscii } from './__fixtures__/ascii';
import { binarize } from './binarize';
import { findSkew, projectRows, rotate, thinInkPixels, thinRun } from './deskew';
import { GrayCanvas } from './rasterizer';

const linesOnPaper = (skewDegrees: number): ReturnType<typeof binarize> => {
  const canvas = new GrayCanvas(400, 200);
  for (let i = 0; i < 5; i++) canvas.horizontalLine(40, 360, 80.5 + 12 * i, 1);
  // Rotating by −θ leaves the content skewed by θ
  return binarize(rotate(canvas.image(), -skewDegrees, 255), 255);
};

describe('thinRun', () => {
  it('grows with the width, at least four pixels', () => {
    expect(thinRun(1400)).toBe(7);
    expect(thinRun(400)).toBe(4);
  });
});

describe('thinInkPixels', () => {
  it('keeps short vertical runs and drops tall objects', () => {
    const image = binaryFromAscii(['....#', '####.', '####.', '....#', '....#', '....#', '....#']);
    const points = thinInkPixels(image, 3);
    expect([...points.xs]).toEqual([0, 0, 1, 1, 2, 2, 3, 3, 4]);
    expect([...points.ys]).toEqual([1, 2, 1, 2, 1, 2, 1, 2, 0]);
  });
});

describe('projectRows', () => {
  it('counts pixels per sheared row', () => {
    const xs = Int32Array.from([0, 10, 20, 30, 40]);
    const tan = 0.1;
    const ys = Int32Array.from(xs, (x) => 10 + (x - 20) * tan);
    const profile = projectRows({ xs, ys }, tan, 40, 20);
    expect(profile[10]).toBe(5);
    expect(profile.reduce((sum, value) => sum + value, 0)).toBe(5);
  });

  it('drops points that shear out of the image', () => {
    const corner = { xs: Int32Array.from([0]), ys: Int32Array.from([0]) };
    expect([...projectRows(corner, 1, 40, 20)].every((value) => value === 0)).toBe(true);
  });
});

describe('findSkew', () => {
  it('finds level lines at 0°', () => {
    const skew = findSkew(linesOnPaper(0), 4);
    expect(skew.angle).toBe(0);
    expect(skew.profile[80]).toBeGreaterThan(300);
  });

  it.each([2, -3.5, 6])('finds the skew of %s°', (degrees) => {
    expect(findSkew(linesOnPaper(degrees), 4).angle).toBeCloseTo(degrees, 1);
  });
});

describe('rotate', () => {
  const paper = (): { width: number; height: number; data: Uint8Array } => ({
    width: 6,
    height: 6,
    data: new Uint8Array(36).fill(200),
  });

  it('keeps the centre and fills the outside', () => {
    const image = paper();
    image.data[3 * 6 + 3] = 0;
    const turned = rotate(image, 90, 255);
    expect(turned.data[3 * 6 + 3]).toBe(0);
    expect(turned.data[0]).toBe(255);
  });

  it('turns content counter-clockwise, undoing a clockwise skew', () => {
    const image = paper();
    image.data[3 * 6 + 4] = 0; // right of the centre
    const turned = rotate(image, 90, 255);
    expect(turned.data[2 * 6 + 3]).toBe(0); // above the centre
  });
});
