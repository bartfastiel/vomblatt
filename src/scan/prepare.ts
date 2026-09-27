// From any photo to a level binary image at a known scale: a first binarisation measures the staff spacing, the image
// is scaled so that the spacing becomes SPACING pixels (every later threshold is tuned to it), binarised again with
// a window of a few spacings, deskewed and binarised once more.
import { binarize, type BinaryImage, paperWhite } from './binarize';
import { findSkew, rotate } from './deskew';
import { type GrayImage, resizeArea } from './raster';
import { estimateSpacing, type SpacingEstimate } from './spacing';

export const SPACING = 18; // target line distance in pixels
const MIN_SCALE = 0.2;
const MAX_SCALE = 2.5;

export interface Prepared {
  readonly gray: GrayImage; // scaled and deskewed
  readonly binary: BinaryImage;
  readonly scale: number; // gray = scale × input
  readonly angle: number; // skew removed, degrees
  readonly spacing: SpacingEstimate; // measured again after scaling
}

const windowRadius = (): number => Math.round(2.5 * SPACING);

export const prepare = (input: GrayImage): Prepared | null => {
  const paper = paperWhite(input);
  const first = estimateSpacing(binarize(input, paper));
  if (first === null) return null;
  const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, SPACING / first.spacing));
  const scaled =
    Math.abs(scale - 1) < 0.05
      ? input
      : resizeArea(input, Math.round(input.width * scale), Math.round(input.height * scale));
  const level = binarize(scaled, paper, windowRadius());
  const thickness = Math.max(1, first.thickness * scale);
  const skew = findSkew(level, Math.max(3, Math.round(2 * thickness + 1)));
  const gray = skew.angle === 0 ? scaled : rotate(scaled, skew.angle, paper);
  const binary = skew.angle === 0 ? level : binarize(gray, paper, windowRadius());
  const spacing = estimateSpacing(binary) ?? { spacing: SPACING, thickness };
  return { gray, binary, scale, angle: skew.angle, spacing };
};
