// Pixel-level tools on binary images: staff-line removal, filling of small holes (hollow noteheads become solid), the
// distance of every ink pixel to the paper, and the width of the horizontal run through every pixel.
import { type BinaryImage, inkRunDown } from './binarize';
import { numberAt } from './raster';
import { lineY, type Staff } from './staves';

export const copyBinary = (image: BinaryImage): BinaryImage => ({ ...image, data: image.data.slice() });

// Clears the vertical run through (x, y) if it is at most `maxRun` long and touches row `lineY` (±1): then it is only
// the line, not an object sitting on it
const clearThinRun = (image: BinaryImage, x: number, y: number, maxRun: number, lineRow: number): number => {
  const { width, data } = image;
  let top = y;
  while (top > 0 && data[(top - 1) * width + x] === 1) top--;
  const bottom = inkRunDown(image, x, y) - 1;
  if (bottom - top + 1 <= maxRun && top <= lineRow + 1 && bottom >= lineRow - 1) {
    for (let yy = top; yy <= bottom; yy++) data[yy * width + x] = 0;
  }
  return bottom;
};

export const clearLineAt = (image: BinaryImage, x: number, lineRow: number, maxRun: number): void => {
  let y = Math.max(0, lineRow - maxRun);
  const last = Math.min(image.height - 1, lineRow + maxRun);
  while (y <= last) {
    y = image.data[y * image.width + x] === 1 ? clearThinRun(image, x, y, maxRun, lineRow) + 1 : y + 1;
  }
};

export const LEDGER_LINES = 4; // per side, beyond the staff

// Staff lines and the rows of possible ledger lines lose their thin runs; heads, stems, beams keep theirs
export const removeStaffLines = (source: BinaryImage, staves: readonly Staff[]): BinaryImage => {
  const image = copyBinary(source);
  for (const staff of staves) {
    const maxRun = Math.max(2, Math.round(1.8 * staff.thickness + 1));
    const reach = Math.round(1.5 * staff.spacing);
    const xa = Math.max(0, staff.x0 - reach);
    const xb = Math.min(image.width - 1, staff.x1 + reach);
    for (let x = xa; x <= xb; x++) {
      const top = lineY(staff, 0, x);
      const bottom = lineY(staff, 4, x);
      const gap = (bottom - top) / 4;
      for (let k = -LEDGER_LINES; k <= 4 + LEDGER_LINES; k++) {
        clearLineAt(image, x, Math.round(top + k * gap), maxRun);
      }
    }
  }
  return image;
};

// Enclosed paper regions (4-neighbourhood) no larger than the limits become ink: the inside of hollow heads, also
// small loops of letters and clefs – later steps tell those apart by shape
interface Region {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  open: boolean; // touches the image border
  readonly pixels: number[];
}

// Flood fill of the paper region around `start` (4-neighbourhood), marking it in `seen`
const paperRegion = (image: BinaryImage, seen: Uint8Array, start: number, stack: number[]): Region => {
  const { width, height, data } = image;
  const region: Region = { x0: width, x1: 0, y0: height, y1: 0, open: false, pixels: [] };
  const visit = (next: number): void => {
    if (data[next] === 1 || seen[next] === 1) return;
    seen[next] = 1;
    stack.push(next);
  };
  seen[start] = 1;
  stack.push(start);
  while (stack.length > 0) {
    const index = numberAt(stack, stack.length - 1);
    stack.pop();
    region.pixels.push(index);
    const x = index % width;
    const y = (index - x) / width;
    region.x0 = Math.min(region.x0, x);
    region.x1 = Math.max(region.x1, x);
    region.y0 = Math.min(region.y0, y);
    region.y1 = Math.max(region.y1, y);
    if (x === 0 || y === 0 || x === width - 1 || y === height - 1) {
      region.open = true;
      continue;
    }
    visit(index - 1);
    visit(index + 1);
    visit(index - width);
    visit(index + width);
  }
  return region;
};

// Enclosed paper regions (4-neighbourhood) no larger than the limits become ink: the inside of hollow heads, also
// small loops of letters and clefs – later steps tell those apart by shape
export const fillHoles = (source: BinaryImage, maxWidth: number, maxHeight: number): BinaryImage => {
  const image = copyBinary(source);
  const { data } = image;
  const seen = new Uint8Array(data.length);
  const stack: number[] = [];
  for (let start = 0; start < data.length; start++) {
    if (data[start] === 1 || seen[start] === 1) continue;
    const region = paperRegion(source, seen, start, stack);
    const small = region.x1 - region.x0 + 1 <= maxWidth && region.y1 - region.y0 + 1 <= maxHeight;
    if (!region.open && small) for (const index of region.pixels) data[index] = 1;
  }
  return image;
};

// Chamfer distance (3-4) of every ink pixel to the nearest paper pixel, in thirds of a pixel
export const distanceToPaper = (image: BinaryImage): Uint16Array => {
  const { width, height, data } = image;
  const far = 60000;
  const d = new Uint16Array(width * height);
  const at = (x: number, y: number): number =>
    x < 0 || y < 0 || x >= width || y >= height ? 0 : (d[y * width + x] ?? 0);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[y * width + x] !== 1) continue;
      d[y * width + x] = Math.min(far, at(x - 1, y) + 3, at(x, y - 1) + 3, at(x - 1, y - 1) + 4, at(x + 1, y - 1) + 4);
    }
  }
  for (let y = height - 1; y >= 0; y--) {
    for (let x = width - 1; x >= 0; x--) {
      if (data[y * width + x] !== 1) continue;
      const i = y * width + x;
      d[i] = Math.min(d[i] ?? 0, at(x + 1, y) + 3, at(x, y + 1) + 3, at(x + 1, y + 1) + 4, at(x - 1, y + 1) + 4);
    }
  }
  return d;
};

// Width of the horizontal ink run through every pixel (0 on paper)
export const horizontalRunWidths = (image: BinaryImage): Uint16Array => {
  const { width, height, data } = image;
  const widths = new Uint16Array(width * height);
  for (let y = 0; y < height; y++) {
    let x = 0;
    while (x < width) {
      if (data[y * width + x] !== 1) {
        x++;
        continue;
      }
      let end = x;
      while (end < width && data[y * width + end] === 1) end++;
      widths.fill(Math.min(65535, end - x), y * width + x, y * width + end);
      x = end;
    }
  }
  return widths;
};
