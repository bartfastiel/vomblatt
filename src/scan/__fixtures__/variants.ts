// The distortions every fixture is read under: clean, simulated screen photos (moiré, glare, perspective) and
// simulated camera photos of paper (rotation, shadow, blur, noise, perspective).
import { simulateDeskPhoto } from '../desk-photo';
import { simulatePhoto } from '../photo-simulation';
import type { GrayImage } from '../raster';
import { screenQuad, simulateScreenPhoto } from '../screen-photo';

export interface Variant {
  readonly name: string;
  readonly render: (sheet: GrayImage) => GrayImage;
}

const screen = (
  tilt: number,
  keystone: number,
  glare: number,
  seed: number,
  screenPixels = 700,
  width = 1600,
): Variant => ({
  name: `screen ${String(tilt)}° k${String(keystone)} g${String(glare)} s${String(seed)} px${String(screenPixels)}`,
  render: (sheet) => {
    // A tall sheet is photographed in portrait
    const portrait = sheet.height > 0.8 * sheet.width;
    const frameWidth = portrait ? Math.round(0.75 * width) : width;
    const height = portrait ? width : Math.round(0.75 * width);
    return simulateScreenPhoto(sheet, {
      width: frameWidth,
      height,
      screen: screenQuad(frameWidth, height, sheet.height / sheet.width, { tilt, keystone, cover: 0.85 }),
      screenPixels,
      glare,
      seed,
    });
  },
});

const paper = (angle: number, seed: number): Variant => ({
  name: `paper ${String(angle)}° s${String(seed)}`,
  render: (sheet) => simulatePhoto(sheet, { angle, seed }),
});

export const CLEAN: Variant = { name: 'clean', render: (sheet) => sheet };

export const SCREEN_VARIANTS: readonly Variant[] = [
  screen(3, 0.06, 0.5, 3),
  screen(-2, 0.04, 0.3, 1),
  screen(5, 0.08, 0.6, 2),
  screen(0, 0.1, 0.4, 4, 600),
  screen(-4, 0, 0.7, 5, 800),
];

// A phone showing the image at full width (1080 screen pixels), photographed at the working size of recognize()
export const PHONE_SCREEN_VARIANTS: readonly Variant[] = [
  screen(2, 0.05, 0.4, 7, 1080, 2400),
  screen(-3, 0.08, 0.6, 8, 1080, 2400),
  screen(6, 0.03, 0.3, 9, 1080, 2400),
];

export const PAPER_VARIANTS: readonly Variant[] = [paper(1.5, 1), paper(-3, 2), paper(4.5, 3)];

// A phone lying on a desk, photographed by another phone at full camera size (as the acceptance check does it)
const desk = (tilt: number, zoom: number, seed: number): Variant => ({
  name: `desk tilt ${String(tilt)}° zoom ${String(zoom)}`,
  render: (sheet) => simulateDeskPhoto(sheet, { width: 4000, height: 3000, tilt, turn: -5, zoom, seed }),
});

export const DESK_VARIANTS: readonly Variant[] = [desk(8, 1, 1), desk(18, 1, 2), desk(10, 1.9, 3)];

export const ALL_VARIANTS: readonly Variant[] = [
  CLEAN,
  ...SCREEN_VARIANTS,
  ...PHONE_SCREEN_VARIANTS,
  ...PAPER_VARIANTS,
  ...DESK_VARIANTS,
];
