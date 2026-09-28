// A phone lying on a desk, showing a sheet on its screen, photographed by a second phone: the staff is small in a
// large photo, the screen is tilted away (perspective) and turned, it has scan lines, a glare band and a dark bezel,
// the camera blurs a little and adds noise. Modelled on what a real acceptance check produced – a test bench that is
// at least as hard as that.
import { homography, project, type Quad } from './homography';
import { byteAt, type GrayImage, resizeArea, sampleBilinear } from './raster';

export interface DeskPhotoOptions {
  readonly width: number; // camera image
  readonly height: number;
  readonly tilt: number; // degrees the phone's top leans away from the camera
  readonly turn: number; // degrees, clockwise
  readonly zoom: number; // sheet width / screen width (above 1 the sheet is cut off left and right)
  readonly seed: number;
}

const SCREEN_ASPECT = 1100 / 560; // height / width of the phone's screen
const SCREEN_SHARE = 0.9; // of the camera image's height taken by the screen
const BEZEL = 0.05; // of the screen width, around it
const SCAN_PERIOD = 7.5; // camera pixels from one scan line to the next
const SCAN_DEPTH = 0.06;
const NOISE = 10;

const clampByte = (value: number): number => Math.max(0, Math.min(255, Math.round(value)));

const lcg = (seed: number): (() => number) => {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
};

// Corners of the screen in the camera image: centred, the top edge narrower by the tilt, turned
const screenCorners = (options: DeskPhotoOptions): Quad => {
  const { width, height, tilt, turn } = options;
  const h = SCREEN_SHARE * height * Math.cos((tilt * Math.PI) / 180);
  const w = (SCREEN_SHARE * height) / SCREEN_ASPECT;
  const narrow = 1 - 0.6 * Math.sin((tilt * Math.PI) / 180);
  const rad = (turn * Math.PI) / 180;
  const place = (x: number, y: number): { x: number; y: number } => ({
    x: width / 2 + x * Math.cos(rad) - y * Math.sin(rad),
    y: height / 2 + x * Math.sin(rad) + y * Math.cos(rad),
  });
  return [place((-w * narrow) / 2, -h / 2), place((w * narrow) / 2, -h / 2), place(w / 2, h / 2), place(-w / 2, h / 2)];
};

// Desk: bright at the top left, darker towards the bottom right
const desk = (x: number, y: number, width: number, height: number): number =>
  232 - 45 * Math.hypot(x / width - 0.3, y / height - 0.2);

const blur = (image: GrayImage, radius: number): GrayImage => {
  const { width, height, data } = image;
  const out = new Uint8Array(width * height);
  const tmp = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      for (let d = -radius; d <= radius; d++) sum += byteAt(data, y * width + Math.min(width - 1, Math.max(0, x + d)));
      tmp[y * width + x] = sum / (2 * radius + 1);
    }
  }
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      for (let d = -radius; d <= radius; d++) sum += tmp[Math.min(height - 1, Math.max(0, y + d)) * width + x] ?? 0;
      out[y * width + x] = clampByte(sum / (2 * radius + 1));
    }
  }
  return { width, height, data: out };
};

export const simulateDeskPhoto = (sheet: GrayImage, options: DeskPhotoOptions): GrayImage => {
  const { width, height, zoom, seed } = options;
  const screenWidth = Math.round((SCREEN_SHARE * height) / SCREEN_ASPECT);
  const screenHeight = Math.round(screenWidth * SCREEN_ASPECT);
  const sheetWidth = Math.round(zoom * screenWidth);
  const shown = resizeArea(sheet, sheetWidth, Math.round((sheet.height * sheetWidth) / sheet.width));
  const left = (screenWidth - shown.width) / 2;
  const top = (screenHeight - shown.height) / 2;
  const corners: Quad = [
    { x: 0, y: 0 },
    { x: screenWidth, y: 0 },
    { x: screenWidth, y: screenHeight },
    { x: 0, y: screenHeight },
  ];
  const toScreen = homography(screenCorners(options), corners);
  const bezel = BEZEL * screenWidth;
  const data = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const { x: u, y: v } = project(toScreen, x + 0.5, y + 0.5);
      data[y * width + x] = clampByte(
        pixelAt(shown, u - left, v - top, u, v, screenWidth, screenHeight, bezel, x, y, width, height),
      );
    }
  }
  const random = lcg(seed);
  const blurred = blur({ width, height, data }, 2);
  for (let i = 0; i < blurred.data.length; i++) {
    blurred.data[i] = clampByte(byteAt(blurred.data, i) + (random() - 0.5) * NOISE);
  }
  return blurred;
};

// What the camera sees at a point: desk, bezel, or the screen with the sheet, scan lines and a glare band
const pixelAt = (
  shown: GrayImage,
  sx: number,
  sy: number,
  u: number,
  v: number,
  screenWidth: number,
  screenHeight: number,
  bezel: number,
  x: number,
  y: number,
  width: number,
  height: number,
): number => {
  if (u < -bezel || v < -bezel || u > screenWidth + bezel || v > screenHeight + bezel) return desk(x, y, width, height);
  if (u < 0 || v < 0 || u > screenWidth || v > screenHeight) return 18;
  const inSheet = sx >= 0 && sy >= 0 && sx < shown.width - 1 && sy < shown.height - 1;
  const value = inSheet ? sampleBilinear(shown, sx, sy) : 255;
  const scan = v % SCAN_PERIOD < SCAN_PERIOD / 3 ? 1 - SCAN_DEPTH : 1;
  const band = (u * Math.cos(0.4) + v * Math.sin(0.4)) / screenWidth;
  const glare = Math.max(0, 1 - Math.abs(band - 0.9) / 0.15) * 0.4;
  const lit = 0.93 * value * scan;
  return lit + glare * (255 - lit);
};
