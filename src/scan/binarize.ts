// Ported from wumble (src/scan, MIT, same author).
// Ink or paper: paper white from the histogram, dark borders (the table edge) whitened, then an adaptive threshold
// over the integral image so that shadows and uneven light do not matter.
import { byteAt, type GrayImage, IntegralImage, wordAt } from './raster';

export interface BinaryImage {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8Array; // 1 = ink
}

export interface Crop {
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
}

// The paper is the majority of the image: its white is the 70th percentile of the brightness
export const paperWhite = (image: GrayImage): number => {
  const histogram = new Uint32Array(256);
  const { data } = image;
  for (let i = 0; i < data.length; i++) histogram[byteAt(data, i)] = wordAt(histogram, byteAt(data, i)) + 1;
  const limit = 0.7 * image.data.length;
  let seen = 0;
  for (let value = 0; value < 255; value++) {
    seen += wordAt(histogram, value);
    if (seen >= limit) return value;
  }
  return 255;
};

const darkShare = (image: GrayImage, paper: number, isRow: boolean, index: number): number => {
  const { width, height, data } = image;
  const count = isRow ? width : height;
  let dark = 0;
  for (let i = 0; i < count; i++) {
    const value = byteAt(data, isRow ? index * width + i : i * width + index);
    if (value < 0.5 * paper) dark++;
  }
  return dark / count;
};

// Borders in which more than half of the pixels are very dark belong to the table, not the sheet: at most a quarter
// of the image per side is filled with paper white
export const darkBorders = (image: GrayImage, paper: number): Crop => {
  const { width, height } = image;
  const darkRow = (y: number): boolean => darkShare(image, paper, true, y) > 0.5;
  const darkColumn = (x: number): boolean => darkShare(image, paper, false, x) > 0.5;
  let x0 = 0;
  let y0 = 0;
  let x1 = width;
  let y1 = height;
  while (y0 < height / 4 && darkRow(y0)) y0++;
  while (y1 > (height * 3) / 4 && darkRow(y1 - 1)) y1--;
  while (x0 < width / 4 && darkColumn(x0)) x0++;
  while (x1 > (width * 3) / 4 && darkColumn(x1 - 1)) x1--;
  return { x0, y0, x1, y1 };
};

const EDGE_SAMPLE = 8; // pixels just inside the crop whose mean fills the border

const meanOf = (data: Uint8Array, first: number, count: number, stride: number): number => {
  let sum = 0;
  for (let i = 0; i < count; i++) sum += byteAt(data, first + i * stride);
  return sum / count;
};

// Fills the borders outside `crop` with the brightness of the paper just inside – not with the global paper white, so
// that a shadowed edge does not turn into a dark band against a white border
export const whitenBorders = (image: GrayImage, paper: number): { image: GrayImage; crop: Crop } => {
  const { width, height } = image;
  const crop = darkBorders(image, paper);
  const { x0, y0, x1, y1 } = crop;
  if (x0 === 0 && y0 === 0 && x1 === width && y1 === height) return { image, crop };
  const data = image.data.slice();
  const columns = Math.min(EDGE_SAMPLE, x1 - x0);
  const rows = Math.min(EDGE_SAMPLE, y1 - y0);
  for (let y = y0; y < y1; y++) {
    data.fill(meanOf(data, y * width + x0, columns, 1), y * width, y * width + x0);
    data.fill(meanOf(data, y * width + x1 - columns, columns, 1), y * width + x1, (y + 1) * width);
  }
  for (let x = 0; x < width; x++) {
    const top = meanOf(data, y0 * width + x, rows, width);
    const bottom = meanOf(data, (y1 - rows) * width + x, rows, width);
    for (let y = 0; y < y0; y++) data[y * width + x] = top;
    for (let y = y1; y < height; y++) data[y * width + x] = bottom;
  }
  return { image: { width, height, data }, crop };
};

// Ink where the pixel or its 3×3 mean lies below 90 % of the mean in the window ±radius (minus 6 against noise: the 3×3
// mean closes gaps in washed-out strokes, the pixel itself keeps fine bright lines). Areas that are no paper at all
// (the table) stay empty.
export const binarize = (image: GrayImage, paper: number, windowRadius?: number): BinaryImage => {
  const { width, height, data } = image;
  const integral = new IntegralImage(image);
  const out = new Uint8Array(width * height);
  const radius = windowRadius ?? Math.max(12, Math.round(width / 80));
  const isInk = (x: number, y: number): boolean => {
    const mean = integral.mean(
      Math.max(0, x - radius),
      Math.max(0, y - radius),
      Math.min(width, x + radius + 1),
      Math.min(height, y + radius + 1),
    );
    if (mean < 0.3 * paper) return false;
    const threshold = mean * 0.9 - 6;
    return byteAt(data, y * width + x) < threshold || integral.mean(x - 1, y - 1, x + 2, y + 2) < threshold;
  };
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      if (isInk(x, y)) out[y * width + x] = 1;
    }
  }
  return { width, height, data: out };
};

// End (exclusive) of the ink run that starts at (x, y) and continues downwards or to the right
export const inkRunDown = (image: BinaryImage, x: number, y: number): number => {
  let end = y;
  while (end < image.height && image.data[end * image.width + x] === 1) end++;
  return end;
};

export const inkRunRight = (image: BinaryImage, x: number, y: number): number => {
  let end = x;
  while (end < image.width && image.data[y * image.width + end] === 1) end++;
  return end;
};
