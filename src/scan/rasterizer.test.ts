import { describe, expect, it } from 'vitest';
import { GrayCanvas } from './rasterizer';

const at = (canvas: GrayCanvas, x: number, y: number): number => canvas.data[y * canvas.width + x] ?? -1;
const inkSum = (canvas: GrayCanvas): number => canvas.data.reduce((sum, value) => sum + (255 - value) / 255, 0);

describe('GrayCanvas', () => {
  it('starts white and reports its image', () => {
    const canvas = new GrayCanvas(4, 3);
    expect(canvas.image()).toEqual({ width: 4, height: 3, data: new Uint8Array(12).fill(255) });
  });

  it('fills rectangles with exact edge coverage', () => {
    const canvas = new GrayCanvas(10, 10);
    canvas.fillRect(2, 2, 4.5, 3);
    expect(at(canvas, 2, 2)).toBe(0);
    expect(at(canvas, 3, 2)).toBe(0);
    expect(at(canvas, 4, 2)).toBe(128);
    expect(at(canvas, 5, 2)).toBe(255);
    expect(at(canvas, 2, 3)).toBe(255);
  });

  it('draws crisp one-pixel lines on half pixels', () => {
    const canvas = new GrayCanvas(10, 10);
    canvas.horizontalLine(1, 9, 4.5, 1);
    canvas.verticalLine(7.5, 0, 3, 1);
    expect(at(canvas, 5, 4)).toBe(0);
    expect(at(canvas, 5, 3)).toBe(255);
    expect(at(canvas, 5, 5)).toBe(255);
    expect(at(canvas, 7, 1)).toBe(0);
    expect(at(canvas, 7, 3)).toBe(255);
  });

  it('spreads a wide stem over neighbouring pixels', () => {
    const canvas = new GrayCanvas(10, 10);
    canvas.verticalLine(5, 0, 10, 1.6);
    expect(at(canvas, 4, 5)).toBe(51);
    expect(at(canvas, 5, 5)).toBe(51);
    expect(at(canvas, 3, 5)).toBe(255);
  });

  it('ignores ink outside the canvas', () => {
    const canvas = new GrayCanvas(4, 4);
    canvas.fillRect(-5, -5, 20, 20);
    canvas.fillEllipse({ cx: 30, cy: 30, rx: 3, ry: 2, rotation: 0 });
    expect(inkSum(canvas)).toBe(16);
  });

  it('fills an ellipse with roughly its area, anti-aliased at the edge', () => {
    const canvas = new GrayCanvas(40, 40);
    canvas.fillEllipse({ cx: 20, cy: 20, rx: 9, ry: 6, rotation: -0.35 });
    expect(inkSum(canvas)).toBeCloseTo(Math.PI * 9 * 6, -1);
    expect(at(canvas, 20, 20)).toBe(0);
    const edge = at(canvas, 20, 13);
    expect(edge).toBeGreaterThan(0);
    expect(edge).toBeLessThan(255);
  });

  it('leaves the hole of a ring white', () => {
    const canvas = new GrayCanvas(40, 40);
    const outer = { cx: 20, cy: 20, rx: 9, ry: 6, rotation: 0 };
    canvas.fillRing(outer, { ...outer, rx: 6, ry: 3 });
    expect(at(canvas, 20, 20)).toBe(255);
    expect(at(canvas, 12, 20)).toBe(0);
    expect(inkSum(canvas)).toBeCloseTo(Math.PI * (9 * 6 - 6 * 3), -1);
  });
});
