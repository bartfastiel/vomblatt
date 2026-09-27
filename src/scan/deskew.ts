// Ported from wumble (src/scan, MIT, same author).
// Skew: the row projection of the thin dark pixels (lines, not heads) is sheared for angles −6…6°; the sharpest
// projection wins and the grayscale image is rotated back by that angle, bilinear with paper white outside.
import { type BinaryImage, inkRunDown } from './binarize';
import { floatAt, type GrayImage, intAt, sampleBilinear } from './raster';

export const MAX_SKEW_DEGREES = 6;
const SKEW_STEP_DEGREES = 0.25;

export interface Points {
  readonly xs: Int32Array;
  readonly ys: Int32Array;
}

// Vertical run of at most `maxRun` pixels at each column: staff lines and ledger lines, no heads, no table edge
export const thinRun = (width: number): number => Math.max(4, Math.round(width / 200));

export const thinInkPixels = (image: BinaryImage, maxRun: number): Points => {
  const { width, height, data } = image;
  const xs: number[] = [];
  const ys: number[] = [];
  for (let x = 0; x < width; x++) {
    let y = 0;
    while (y < height) {
      if (data[y * width + x] !== 1) {
        y++;
        continue;
      }
      const end = inkRunDown(image, x, y);
      if (end - y <= maxRun) {
        for (let yy = y; yy < end; yy++) {
          xs.push(x);
          ys.push(yy);
        }
      }
      y = end;
    }
  }
  return { xs: Int32Array.from(xs), ys: Int32Array.from(ys) };
};

// Pixel counts on the sheared rows y' = y − (x − width/2)·tan
export const projectRows = (points: Points, tan: number, width: number, height: number): Float32Array => {
  const profile = new Float32Array(height);
  const { xs, ys } = points;
  for (let i = 0; i < xs.length; i++) {
    const y = Math.round(intAt(ys, i) - (intAt(xs, i) - width / 2) * tan);
    if (y >= 0 && y < height) profile[y] = floatAt(profile, y) + 1;
  }
  return profile;
};

const sharpness = (profile: Float32Array): number => profile.reduce((sum, value) => sum + value * value, 0);

export interface Skew {
  readonly angle: number; // degrees, clockwise positive
  readonly profile: Float32Array; // row projection at that angle
}

export const findSkew = (image: BinaryImage, maxRun: number): Skew => {
  const points = thinInkPixels(image, maxRun);
  let best: Skew = { angle: 0, profile: new Float32Array(image.height) };
  let bestEnergy = -1;
  for (let angle = -MAX_SKEW_DEGREES; angle <= MAX_SKEW_DEGREES + 0.01; angle += SKEW_STEP_DEGREES) {
    const profile = projectRows(points, Math.tan((angle * Math.PI) / 180), image.width, image.height);
    const energy = sharpness(profile);
    if (energy > bestEnergy) {
      bestEnergy = energy;
      best = { angle, profile };
    }
  }
  return best;
};

// Rotates around the centre so that content skewed by `degrees` becomes level; pixels from outside are `fill`
export const rotate = (image: GrayImage, degrees: number, fill: number): GrayImage => {
  const { width, height } = image;
  const radians = (degrees * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const data = new Uint8Array(width * height).fill(fill);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dx = x - width / 2;
      const dy = y - height / 2;
      const sx = width / 2 + dx * cos - dy * sin;
      const sy = height / 2 + dx * sin + dy * cos;
      if (sx < 0 || sy < 0 || sx >= width - 1 || sy >= height - 1) continue;
      data[y * width + x] = sampleBilinear(image, sx, sy);
    }
  }
  return { width, height, data };
};
