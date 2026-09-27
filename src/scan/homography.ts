// Plane-to-plane projection (a photo of a flat sheet at an angle): the 3×3 matrix that maps four points onto four
// others, found by solving the 8×8 system with Gaussian elimination.
import { doubleAt as at } from './raster';

export interface Point {
  readonly x: number;
  readonly y: number;
}

export type Quad = readonly [Point, Point, Point, Point]; // top left, top right, bottom right, bottom left

export type Homography = Float64Array; // row-major 3×3, the last entry 1

// Solves A·x = b for an n×n row-major A (partial pivoting); a singular system yields NaN – the caller's error
export const solve = (a: Float64Array, b: Float64Array): Float64Array => {
  const n = b.length;
  const swap = (values: Float64Array, i: number, j: number, width: number): void => {
    for (let k = 0; k < width; k++) {
      const t = at(values, i * width + k);
      values[i * width + k] = at(values, j * width + k);
      values[j * width + k] = t;
    }
  };
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(at(a, row * n + col)) > Math.abs(at(a, pivot * n + col))) pivot = row;
    }
    swap(a, col, pivot, n);
    swap(b, col, pivot, 1);
    for (let row = col + 1; row < n; row++) {
      const factor = at(a, row * n + col) / at(a, col * n + col);
      for (let k = col; k < n; k++) a[row * n + k] = at(a, row * n + k) - factor * at(a, col * n + k);
      b[row] = at(b, row) - factor * at(b, col);
    }
  }
  const x = new Float64Array(n);
  for (let row = n - 1; row >= 0; row--) {
    let sum = at(b, row);
    for (let k = row + 1; k < n; k++) sum -= at(a, row * n + k) * at(x, k);
    x[row] = sum / at(a, row * n + row);
  }
  return x;
};

// The homography H with H·from[i] ~ to[i]
export const homography = (from: Quad, to: Quad): Homography => {
  const a = new Float64Array(64);
  const b = new Float64Array(8);
  from.forEach((p, i) => {
    const q = to[i] ?? p;
    a.set([p.x, p.y, 1, 0, 0, 0, -p.x * q.x, -p.y * q.x], 16 * i);
    a.set([0, 0, 0, p.x, p.y, 1, -p.x * q.y, -p.y * q.y], 16 * i + 8);
    b[2 * i] = q.x;
    b[2 * i + 1] = q.y;
  });
  const h = new Float64Array(9);
  h.set(solve(a, b));
  h[8] = 1;
  return h;
};

export const project = (h: Homography, x: number, y: number): Point => {
  const w = at(h, 6) * x + at(h, 7) * y + at(h, 8);
  return { x: (at(h, 0) * x + at(h, 1) * y + at(h, 2)) / w, y: (at(h, 3) * x + at(h, 4) * y + at(h, 5)) / w };
};
