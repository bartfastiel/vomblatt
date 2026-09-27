// Thin vertical strokes – stems and bar lines: ink whose horizontal run is narrow, in vertical runs of some length,
// merged across neighbouring columns. Where a stem meets a head, a beam or a flag the ink is wide, so a stem ends
// there: its ends tell which head it carries and where its beams begin.
import type { BinaryImage } from './binarize';
import { horizontalRunWidths } from './morphology';

export interface Vertical {
  readonly x: number; // centre column
  readonly x0: number;
  readonly x1: number;
  readonly y0: number; // top
  readonly y1: number; // bottom, exclusive
}

interface Piece {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  weight: number; // ink pixels
  sumX: number;
}

const overlaps = (piece: Piece, y0: number, y1: number): boolean => {
  const overlap = Math.min(piece.y1, y1) - Math.max(piece.y0, y0);
  return overlap >= 0.5 * Math.min(piece.y1 - piece.y0, y1 - y0);
};

// Runs of narrow ink in column x as [y0, y1)
const narrowRuns = (widths: Uint16Array, width: number, height: number, x: number, maxWidth: number): number[][] => {
  const runs: number[][] = [];
  let y = 0;
  while (y < height) {
    const w = widths[y * width + x] ?? 0;
    if (w === 0 || w > maxWidth) {
      y++;
      continue;
    }
    const start = y;
    while (y < height) {
      const ww = widths[y * width + x] ?? 0;
      if (ww === 0 || ww > maxWidth) break;
      y++;
    }
    runs.push([start, y]);
  }
  return runs;
};

export const findVerticals = (image: BinaryImage, maxWidth: number, minLength: number): Vertical[] => {
  const { width, height } = image;
  const widths = horizontalRunWidths(image);
  const done: Piece[] = [];
  let open: Piece[] = [];
  for (let x = 0; x < width; x++) {
    const next: Piece[] = [];
    for (const [y0 = 0, y1 = 0] of narrowRuns(widths, width, height, x, maxWidth)) {
      if (y1 - y0 < minLength) continue;
      const piece = open.find((p) => overlaps(p, y0, y1));
      if (piece === undefined) {
        next.push({ x0: x, x1: x, y0, y1, weight: y1 - y0, sumX: x * (y1 - y0) });
        continue;
      }
      open = open.filter((p) => p !== piece);
      piece.x1 = x;
      piece.y0 = Math.min(piece.y0, y0);
      piece.y1 = Math.max(piece.y1, y1);
      piece.weight += y1 - y0;
      piece.sumX += x * (y1 - y0);
      next.push(piece);
    }
    done.push(...open);
    open = next;
  }
  done.push(...open);
  return done
    .filter((p) => p.x1 - p.x0 + 1 <= maxWidth)
    .map((p) => ({ x: p.sumX / p.weight, x0: p.x0, x1: p.x1, y0: p.y0, y1: p.y1 }))
    .sort((a, b) => a.x - b.x);
};
