// Staff spacing and line thickness from run lengths, before any staff is found: the most frequent vertical ink run is
// the line thickness, the most frequent ink-plus-paper run starting at a thin run is the distance from line to line.
import type { BinaryImage } from './binarize';
import { wordAt } from './raster';

export interface SpacingEstimate {
  readonly spacing: number; // line to line, pixels
  readonly thickness: number; // of a staff line, pixels
}

const COLUMN_STEP = 3;

const modeOf = (histogram: Uint32Array, from: number): number => {
  let best = from;
  for (let i = from; i < histogram.length; i++) if (wordAt(histogram, i) > wordAt(histogram, best)) best = i;
  return best;
};

// Weighted mean around the mode: a spacing of 17.5 px shows as 17 and 18
const refinedMode = (histogram: Uint32Array, from: number): number => {
  const mode = modeOf(histogram, from);
  let sum = 0;
  let weight = 0;
  for (let i = Math.max(from, mode - 1); i <= Math.min(histogram.length - 1, mode + 1); i++) {
    sum += i * wordAt(histogram, i);
    weight += wordAt(histogram, i);
  }
  return weight === 0 ? mode : sum / weight;
};

// Runs of one column as [ink length, following paper length] pairs
const columnRuns = (image: BinaryImage, x: number, visit: (ink: number, paper: number) => void): void => {
  const { width, height, data } = image;
  let y = 0;
  while (y < height && data[y * width + x] !== 1) y++;
  while (y < height) {
    let ink = 0;
    while (y < height && data[y * width + x] === 1) {
      ink++;
      y++;
    }
    let paper = 0;
    while (y < height && data[y * width + x] !== 1) {
      paper++;
      y++;
    }
    if (y < height) visit(ink, paper);
  }
};

// The period of line plus paper that occurs most often among thin lines (ink at most a third of the period), then
// the most frequent ink run among exactly those periods – a noise speck does not make the lines thin
export const estimateSpacing = (image: BinaryImage): SpacingEstimate | null => {
  const maxRun = Math.max(8, Math.round(image.height / 8));
  const periods = new Uint32Array(maxRun + 1);
  for (let x = 0; x < image.width; x += COLUMN_STEP) {
    columnRuns(image, x, (ink, paper) => {
      const period = ink + paper;
      if (period >= 5 && period <= maxRun && 3 * ink <= period) periods[period] = wordAt(periods, period) + 1;
    });
  }
  const spacing = refinedMode(periods, 5);
  if (wordAt(periods, Math.round(spacing)) < 20) return null;
  const inkRuns = new Uint32Array(maxRun + 1);
  const tolerance = Math.max(1, 0.1 * spacing);
  for (let x = 0; x < image.width; x += COLUMN_STEP) {
    columnRuns(image, x, (ink, paper) => {
      if (Math.abs(ink + paper - spacing) <= tolerance && 3 * ink <= ink + paper)
        inkRuns[ink] = wordAt(inkRuns, ink) + 1;
    });
  }
  return { spacing, thickness: refinedMode(inkRuns, 1) };
};
