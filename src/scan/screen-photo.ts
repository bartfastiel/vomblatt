// Turns a clean sheet into a phone photo of another phone's screen showing it: the sheet resampled to the coarser
// screen pixels, the screen seen at an angle (perspective) inside a dark bezel on a bright desk, the sub-pixel grid
// sampled by the camera (moiré), a glare spot, lens blur and sensor noise. Reproducible per seed – a test bench.
import { type Homography, homography, project, type Quad } from './homography';
import { byteAt, type GrayImage, resize } from './raster';

export interface ScreenPhotoOptions {
  readonly width: number; // camera image
  readonly height: number;
  readonly screen: Quad; // corners of the screen's visible area in the camera image
  readonly screenPixels: number; // screen pixels across the sheet's width
  readonly glare: number; // 0…1, strength of the reflected light spot
  readonly seed: number;
}

const DESK = 205;
const BEZEL = 28;
const BEZEL_WIDTH = 0.06; // of the screen size, around it
const SCREEN_WHITE = 238;
const SCREEN_BLACK = 45;
const NOISE = 22; // peak to peak
const GRID_DEPTH = 0.35; // share of light lost in the gaps between (sub-)pixels

const clampByte = (value: number): number => Math.max(0, Math.min(255, Math.round(value)));

// Light a screen pixel emits at a position inside it: three sub-pixel stripes with dark gaps and a dark row gap
export const gridMask = (u: number, v: number): number => {
  const fu = u - Math.floor(u);
  const fv = v - Math.floor(v);
  if (fv < 0.12) return 1 - GRID_DEPTH;
  const sub = (fu * 3) % 1;
  return sub < 0.18 ? 1 - GRID_DEPTH : 1;
};

// Bright spot of reflected light: a wide Gaussian placed by the seed
const glareAt = (x: number, y: number, centre: { x: number; y: number }, radius: number): number =>
  Math.exp(-((x - centre.x) ** 2 + (y - centre.y) ** 2) / (2 * radius * radius));

const lcg = (seed: number): (() => number) => {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
};

const BLUR = [1, 2, 1, 2, 4, 2, 1, 2, 1];

const blur = (image: GrayImage): GrayImage => {
  const { width, height, data } = image;
  const out = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      for (let k = 0; k < 9; k++) {
        const xx = Math.min(width - 1, Math.max(0, x + (k % 3) - 1));
        const yy = Math.min(height - 1, Math.max(0, y + Math.floor(k / 3) - 1));
        sum += (BLUR[k] ?? 0) * byteAt(data, yy * width + xx);
      }
      out[y * width + x] = clampByte(sum / 16);
    }
  }
  return { width, height, data: out };
};

interface Scene {
  readonly screen: GrayImage; // the sheet as the screen shows it, in screen pixels
  readonly toScreen: Homography; // camera → screen pixel coordinates
  readonly bezel: number; // in screen pixels
}

// The screen is as tall as the sheet needs (letterboxed in white), a bezel around it
const sceneOf = (sheet: GrayImage, options: ScreenPhotoOptions): Scene => {
  const width = options.screenPixels;
  const height = Math.round((sheet.height * width) / sheet.width);
  const screen = resize(sheet, width, height);
  const corners: Quad = [
    { x: 0, y: 0 },
    { x: width, y: 0 },
    { x: width, y: height },
    { x: 0, y: height },
  ];
  return { screen, toScreen: homography(options.screen, corners), bezel: BEZEL_WIDTH * width };
};

const cameraValue = (scene: Scene, x: number, y: number): number => {
  const { screen, bezel } = scene;
  const { x: u, y: v } = project(scene.toScreen, x + 0.5, y + 0.5);
  const inside = u >= 0 && v >= 0 && u < screen.width && v < screen.height;
  if (!inside) {
    const onPhone = u > -bezel && v > -bezel && u < screen.width + bezel && v < screen.height + bezel;
    return onPhone ? BEZEL : DESK;
  }
  // Nearest screen pixel: the screen shows hard pixel edges
  const value = byteAt(screen.data, Math.floor(v) * screen.width + Math.floor(u));
  const lit = SCREEN_BLACK + ((SCREEN_WHITE - SCREEN_BLACK) * value) / 255;
  return lit * gridMask(u, v);
};

export const simulateScreenPhoto = (sheet: GrayImage, options: ScreenPhotoOptions): GrayImage => {
  const { width, height, glare, seed } = options;
  const scene = sceneOf(sheet, options);
  const random = lcg(seed);
  const centre = { x: (0.25 + 0.5 * random()) * width, y: (0.2 + 0.4 * random()) * height };
  const radius = 0.18 * Math.min(width, height);
  const data = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const value = cameraValue(scene, x, y);
      data[y * width + x] = clampByte(value + glare * glareAt(x, y, centre, radius) * (255 - value));
    }
  }
  const blurred = blur({ width, height, data });
  for (let i = 0; i < blurred.data.length; i++) {
    blurred.data[i] = clampByte(byteAt(blurred.data, i) + (random() - 0.5) * NOISE);
  }
  return blurred;
};

// A screen quad for a camera image: the phone lying across the frame at `tilt` degrees with a keystone of `keystone`
// (share by which the far edge is narrower), covering `cover` of the width
export const screenQuad = (
  width: number,
  height: number,
  aspect: number, // screen height / width
  { tilt = 0, keystone = 0, cover = 0.8 }: { tilt?: number; keystone?: number; cover?: number } = {},
): Quad => {
  const w = Math.min(cover * width, (cover * height) / aspect); // the whole screen in the frame
  const h = w * aspect;
  const cx = width / 2;
  const cy = height / 2;
  const rad = (tilt * Math.PI) / 180;
  const turn = (x: number, y: number): { x: number; y: number } => ({
    x: cx + x * Math.cos(rad) - y * Math.sin(rad),
    y: cy + x * Math.sin(rad) + y * Math.cos(rad),
  });
  const top = (w / 2) * (1 - keystone);
  return [turn(-top, -h / 2), turn(top, -h / 2), turn(w / 2, h / 2), turn(-w / 2, h / 2)];
};
