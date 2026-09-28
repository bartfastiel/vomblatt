// Staff spacing and line thickness before any staff is found: every column that crosses a staff shows five thin ink
// runs at equal distances. Only such fives count – text, noise, a screen's scan lines or a phone's bezel do not
// produce them, however much of the photo they fill.
import type { BinaryImage } from './binarize';
import { numberAt, wordAt } from './raster';

export interface SpacingEstimate {
  readonly spacing: number; // line to line, pixels
  readonly thickness: number; // of a staff line, pixels
}

export interface Region {
  readonly x0: number;
  readonly y0: number;
  readonly x1: number; // exclusive
  readonly y1: number;
}

export interface StaffEstimate extends SpacingEstimate {
  readonly region: Region; // where the five-line patterns were seen
}

const COLUMN_STEP = 2;
const MIN_COLUMNS = 8; // columns with a five-line pattern needed to trust the estimate

interface Run {
  readonly centre: number;
  readonly length: number;
}

// Ink runs of one column
const columnRuns = (image: BinaryImage, x: number): Run[] => {
  const { width, height, data } = image;
  const runs: Run[] = [];
  let y = 0;
  while (y < height) {
    if (data[y * width + x] !== 1) {
      y++;
      continue;
    }
    const start = y;
    while (y < height && data[y * width + x] === 1) y++;
    runs.push({ centre: (start + y - 1) / 2, length: y - start });
  }
  return runs;
};

// Line distance of five consecutive runs that are thin and equally spaced (±15 %), or null
export const fiveLineGap = (five: readonly Run[]): number | null => {
  const first = five[0];
  const last = five[4];
  if (first === undefined || last === undefined) return null;
  const mean = (last.centre - first.centre) / 4;
  if (mean < 4) return null;
  for (let k = 1; k < 5; k++) {
    const gap = (five[k]?.centre ?? 0) - (five[k - 1]?.centre ?? 0);
    if (Math.abs(gap - mean) > 0.15 * mean) return null;
  }
  return five.every((run) => run.length <= 0.4 * mean) ? mean : null;
};

// Weighted mean around the most frequent bin: a spacing of 17.5 px shows as 17 and 18
const refinedMode = (histogram: Uint32Array): number => {
  let mode = 0;
  for (let i = 1; i < histogram.length; i++) if (wordAt(histogram, i) > wordAt(histogram, mode)) mode = i;
  let sum = 0;
  let weight = 0;
  for (let i = Math.max(0, mode - 1); i <= Math.min(histogram.length - 1, mode + 1); i++) {
    sum += i * wordAt(histogram, i);
    weight += wordAt(histogram, i);
  }
  return weight === 0 ? mode : sum / weight;
};

export const estimateSpacing = (image: BinaryImage): StaffEstimate | null => {
  const gaps = new Uint32Array(Math.max(8, Math.round(image.height / 4)) + 1);
  const found: { gap: number; runs: Run[]; x: number }[] = [];
  for (let x = 0; x < image.width; x += COLUMN_STEP) {
    const runs = columnRuns(image, x);
    for (let i = 0; i + 4 < runs.length; i++) {
      const five = runs.slice(i, i + 5);
      const gap = fiveLineGap(five);
      if (gap === null || gap >= gaps.length) continue;
      gaps[Math.round(gap)] = wordAt(gaps, Math.round(gap)) + 1;
      found.push({ gap, runs: five, x });
      i += 4;
    }
  }
  const spacing = refinedMode(gaps);
  const near = found.filter((f) => Math.abs(f.gap - spacing) <= Math.max(1, 0.1 * spacing));
  if (near.length < MIN_COLUMNS) return null;
  const lengths = near.flatMap((f) => f.runs.map((run) => run.length)).sort((a, b) => a - b);
  const region: Region = {
    x0: Math.min(...near.map((f) => f.x)),
    x1: Math.max(...near.map((f) => f.x)) + 1,
    y0: Math.min(...near.map((f) => f.runs[0]?.centre ?? 0)),
    y1: Math.max(...near.map((f) => f.runs[4]?.centre ?? 0)) + 1,
  };
  // The lower quartile: where a symbol touches a line the run is longer, never shorter
  return { spacing, thickness: numberAt(lengths, Math.floor(lengths.length / 4)), region };
};
