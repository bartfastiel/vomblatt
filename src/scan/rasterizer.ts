// Ported from wumble (src/scan, MIT, same author).
// A tiny anti-aliased rasterizer for grayscale: rectangles with fractional edges (lines), filled and hollow ellipses.
// Enough to draw a sheet of music without a canvas, so the example sheet and its tests run in Node.
import { byteAt, type GrayImage } from './raster';

const SUBSAMPLES = 4; // per axis: 16 samples per pixel for curved edges

export interface Ellipse {
  readonly cx: number;
  readonly cy: number;
  readonly rx: number;
  readonly ry: number;
  readonly rotation: number; // radians
}

const insideEllipse = ({ cx, cy, rx, ry, rotation }: Ellipse, x: number, y: number): boolean => {
  const dx = x - cx;
  const dy = y - cy;
  const u = (dx * Math.cos(rotation) + dy * Math.sin(rotation)) / rx;
  const v = (-dx * Math.sin(rotation) + dy * Math.cos(rotation)) / ry;
  return u * u + v * v <= 1;
};

const overlap = (a0: number, a1: number, b0: number, b1: number): number =>
  Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));

// Share of the pixel (x, y) inside the shape, sampled on a grid
const coverageAt = (x: number, y: number, outer: Ellipse, hole?: Ellipse): number => {
  let hits = 0;
  for (let sy = 0; sy < SUBSAMPLES; sy++) {
    for (let sx = 0; sx < SUBSAMPLES; sx++) {
      const px = x + (sx + 0.5) / SUBSAMPLES;
      const py = y + (sy + 0.5) / SUBSAMPLES;
      if (insideEllipse(outer, px, py) !== (hole !== undefined && insideEllipse(hole, px, py))) hits++;
    }
  }
  return hits / (SUBSAMPLES * SUBSAMPLES);
};

export class GrayCanvas {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8Array;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.data = new Uint8Array(width * height).fill(255);
  }

  image(): GrayImage {
    return { width: this.width, height: this.height, data: this.data };
  }

  // Darkens a pixel by the covered share, so overlapping strokes stay black and edges stay soft
  private ink(x: number, y: number, coverage: number): void {
    if (coverage <= 0 || x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    const i = y * this.width + x;
    this.data[i] = Math.round(byteAt(this.data, i) * (1 - coverage));
  }

  fillRect(x0: number, y0: number, x1: number, y1: number): void {
    for (let y = Math.floor(y0); y < Math.ceil(y1); y++) {
      for (let x = Math.floor(x0); x < Math.ceil(x1); x++) {
        this.ink(x, y, overlap(x, x + 1, x0, x1) * overlap(y, y + 1, y0, y1));
      }
    }
  }

  horizontalLine(x0: number, x1: number, y: number, thickness: number): void {
    this.fillRect(x0, y - thickness / 2, x1, y + thickness / 2);
  }

  verticalLine(x: number, y0: number, y1: number, thickness: number): void {
    this.fillRect(x - thickness / 2, Math.min(y0, y1), x + thickness / 2, Math.max(y0, y1));
  }

  // Coverage sampled on a grid inside each pixel; `hole` cuts an inner ellipse out (even-odd, as the canvas does it)
  private fillShape(outer: Ellipse, hole?: Ellipse): void {
    const reach = Math.max(outer.rx, outer.ry);
    for (let y = Math.floor(outer.cy - reach); y <= Math.ceil(outer.cy + reach); y++) {
      for (let x = Math.floor(outer.cx - reach); x <= Math.ceil(outer.cx + reach); x++) {
        this.ink(x, y, coverageAt(x, y, outer, hole));
      }
    }
  }

  fillEllipse(ellipse: Ellipse): void {
    this.fillShape(ellipse);
  }

  fillRing(outer: Ellipse, hole: Ellipse): void {
    this.fillShape(outer, hole);
  }
}
