// Photo → Score, all steps in order. Pure code on pixel arrays: runs in a worker in the browser and in Node in tests.
import type { Score } from '../score/score';
import type { BinaryImage } from './binarize';
import { connectedComponents, type Labeled } from './components';
import { findHeads, type Head, type RejectReport } from './heads';
import { type Header, readHeader } from './header';
import { distanceToPaper, fillHoles, removeStaffLines } from './morphology';
import { prepare } from './prepare';
import type { GrayImage } from './raster';
import { buildScore } from './score-builder';
import { readStaff, type StaffReading } from './staff-reader';
import { findStaves, type Staff } from './staves';
import { groupSystems, voicesOf } from './systems';
import { findVerticals, type Vertical } from './verticals';

export class NoStaffError extends Error {
  constructor() {
    super('noStaff');
    this.name = 'NoStaffError';
  }
}

export interface Recognition {
  readonly labeled: Labeled;
  readonly clean: BinaryImage;
  readonly verticals: readonly Vertical[];
  readonly score: Score;
  readonly staves: readonly Staff[];
  readonly readings: readonly StaffReading[];
  readonly heads: readonly Head[];
  readonly scale: number;
  readonly angle: number;
}

// The key signature most staves show; a staff without one where others have it is cut off at the left
const commonKey = (headers: readonly Header[]): number => {
  const counts = new Map<number, number>();
  for (const { keyFifths } of headers) if (keyFifths !== null) counts.set(keyFifths, (counts.get(keyFifths) ?? 0) + 1);
  let best = 0;
  let bestCount = 0;
  for (const [key, count] of counts) {
    if (count > bestCount) {
      best = key;
      bestCount = count;
    }
  }
  return best;
};

// Hollow heads filled: holes of the image with lines (a head in a space keeps its ring there, lines through a head
// split its hole in two small ones) and those of the image without lines (a hole no longer split by a line), each
// smaller than the paper between two lines so that the gap between a bar line and a head stays open
const solidHeads = (binary: BinaryImage, clean: BinaryImage, staves: readonly Staff[], spacing: number) => {
  const withLines = removeStaffLines(fillHoles(binary, Math.round(spacing), Math.round(0.8 * spacing)), staves);
  const withoutLines = fillHoles(clean, Math.round(spacing), Math.round(0.9 * spacing));
  const data = withLines.data.map((value, i) => value | (withoutLines.data[i] ?? 0));
  return { ...clean, data };
};

// `rejected` hears about every head candidate that failed a test – for tuning, not needed to recognise
export const recognizeGray = (input: GrayImage, rejected?: RejectReport): Recognition => {
  const prepared = prepare(input);
  if (prepared === null) throw new NoStaffError();
  const { binary } = prepared;
  const staves = findStaves(binary, prepared.spacing.spacing, prepared.spacing.thickness);
  if (staves.length === 0) throw new NoStaffError();
  const spacing = staves.map((s) => s.spacing).sort((a, b) => a - b)[Math.floor(staves.length / 2)] ?? 1;
  const clean = removeStaffLines(binary, staves);
  const solid = solidHeads(binary, clean, staves, spacing);
  const heads = findHeads({ original: binary, clean, solid, distance: distanceToPaper(solid) }, staves, rejected);
  const verticals = findVerticals(clean, Math.max(3, Math.round(0.42 * spacing)), Math.round(spacing));
  const labeled = connectedComponents(clean);
  const headers = staves.map((staff) => readHeader({ clean, labeled, verticals }, staff));
  const readings = staves.map((staff, i) =>
    readStaff(
      staff,
      headers[i] ?? { clef: null, keyFifths: null, meter: false, end: staff.x0 },
      heads.filter((head) => head.staff === i),
      { clean, labeled, verticals },
    ),
  );
  const systems = groupSystems(
    binary,
    staves,
    headers,
    readings.map((reading) => reading.barlines),
  );
  const score = buildScore(readings, systems, voicesOf(systems), { keyFifths: commonKey(headers) });
  return { labeled, clean, verticals, score, staves, readings, heads, scale: prepared.scale, angle: prepared.angle };
};
