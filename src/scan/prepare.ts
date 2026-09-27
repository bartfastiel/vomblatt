// From any photo to a level binary image at a known scale: a first binarisation measures the staff spacing, the image
// is scaled so that the spacing becomes SPACING pixels (every later threshold is tuned to it), binarised again with
// a window of a few spacings, deskewed and binarised once more.
import { binarize, type BinaryImage, paperWhite } from './binarize';
import { findSkew, rotate } from './deskew';
import { type GrayImage, resizeArea } from './raster';
import { estimateSpacing, type Region, type SpacingEstimate } from './spacing';

export const SPACING = 18; // target line distance in pixels
const MIN_SCALE = 0.2;
const MAX_SCALE = 2.5;

export interface Prepared {
  readonly gray: GrayImage; // scaled and deskewed
  readonly binary: BinaryImage; // for the symbols
  readonly lines: BinaryImage; // with faint lines, for the staves
  readonly scale: number; // gray = scale × input
  readonly angle: number; // skew removed, degrees
  readonly spacing: SpacingEstimate; // measured again after scaling
}

const windowRadius = (): number => Math.round(2.5 * SPACING);

// The part of the photo with staves in it, with room for the clef, ledger lines and notes beyond the lines and for a
// staff whose lines were too faint to be counted (a photo of a phone on a desk is mostly desk)
export const cropTo = (image: GrayImage, region: Region, spacing: number): GrayImage => {
  const x0 = Math.max(0, Math.floor(region.x0 - 12 * spacing));
  const x1 = Math.min(image.width, Math.ceil(region.x1 + 12 * spacing));
  const y0 = Math.max(0, Math.floor(region.y0 - 20 * spacing));
  const y1 = Math.min(image.height, Math.ceil(region.y1 + 20 * spacing));
  if (x0 === 0 && y0 === 0 && x1 === image.width && y1 === image.height) return image;
  const width = x1 - x0;
  const data = new Uint8Array(width * (y1 - y0));
  for (let y = y0; y < y1; y++)
    data.set(image.data.subarray(y * image.width + x0, y * image.width + x1), (y - y0) * width);
  return { width, height: y1 - y0, data };
};

// `faint`: look for staff lines with the sensitive threshold (thin lines of a screen photographed from afar) – not by
// default, since it also turns a screen's pixel grid into ink
export const prepare = (photo: GrayImage, faint = false): Prepared | null => {
  const paper = paperWhite(photo);
  const first = estimateSpacing(binarize(photo, paper, undefined, faint));
  if (first === null) return null;
  const input = cropTo(photo, first.region, first.spacing);
  const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, SPACING / first.spacing));
  const scaled =
    Math.abs(scale - 1) < 0.05
      ? input
      : resizeArea(input, Math.round(input.width * scale), Math.round(input.height * scale));
  const level = binarize(scaled, paper, windowRadius(), faint);
  const thickness = Math.max(1, first.thickness * scale);
  const skew = findSkew(level, Math.max(3, Math.round(2 * thickness + 1)));
  const gray = skew.angle === 0 ? scaled : rotate(scaled, skew.angle, paper);
  const lines = skew.angle === 0 ? level : binarize(gray, paper, windowRadius(), faint);
  const binary = faint ? binarize(gray, paper, windowRadius()) : lines;
  // Measured again at the new scale; where that disagrees with the scaled first estimate, the first one holds
  const again = estimateSpacing(lines);
  const expected = { spacing: first.spacing * scale, thickness };
  const spacing =
    again !== null && Math.abs(again.spacing - expected.spacing) < 0.2 * expected.spacing ? again : expected;
  return { gray, binary, lines, scale, angle: skew.angle, spacing };
};
