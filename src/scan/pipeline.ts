// Photo → Score, all steps in order. Pure code on pixel arrays: runs in a worker in the browser and in Node in tests.
import type { Score } from '../score/score';
import type { BinaryImage } from './binarize';
import { connectedComponents, type Labeled } from './components';
import { findHeads, type Head, type RejectReport } from './heads';
import { type Header, readHeader } from './header';
import { dilate, distanceToPaper, fillHoles, removeStaffLines } from './morphology';
import { type Prepared, prepare } from './prepare';
import type { GrayImage } from './raster';
import { findRings } from './rings';
import { buildScore } from './score-builder';
import { readStaff, type StaffReading } from './staff-reader';
import { findStaves, type Staff } from './staves';
import { groupSystems, splitMelodies, voicesOf } from './systems';
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
  // A faintly printed ring with gaps: its hole once the ink is grown by a pixel
  const grown = dilate(binary);
  const closed = fillHoles(grown, Math.round(0.9 * spacing), Math.round(0.8 * spacing));
  const data = withLines.data.map(
    (value, i) => value | (withoutLines.data[i] ?? 0) | ((closed.data[i] ?? 0) & (1 - (grown.data[i] ?? 0))),
  );
  return { ...clean, data };
};

// `rejected` hears about every head candidate that failed a test – for tuning, not needed to recognise
interface Found {
  readonly prepared: Prepared;
  readonly staves: Staff[];
}

// How much of the image's width the staves cover, summed over the staves, in line distances
const coverage = (found: Found | null): number =>
  found === null ? 0 : found.staves.reduce((sum, staff) => sum + (staff.x1 - staff.x0) / staff.spacing, 0);

const attempt = (input: GrayImage, faint: boolean): Found | null => {
  const prepared = prepare(input, faint);
  if (prepared === null) return null;
  const staves = findStaves(prepared.lines, prepared.spacing.spacing, prepared.spacing.thickness);
  return staves.length > 0 ? { prepared, staves } : null;
};

// Staves with the plain threshold; where it finds none or only pieces of lines (the faint lines of a screen photo
// taken from afar), also with the one for faint lines – the reading that covers more staff wins
const findPreparedStaves = (input: GrayImage): Found | null => {
  const plain = attempt(input, false);
  const longest = plain === null ? 0 : Math.max(...plain.staves.map((staff) => staff.x1 - staff.x0));
  if (plain !== null && longest >= 0.6 * plain.prepared.binary.width) return plain;
  const faint = attempt(input, true);
  return coverage(faint) > 1.2 * coverage(plain) ? faint : plain;
};

export const recognizeGray = (input: GrayImage, rejected?: RejectReport): Recognition => {
  const found = findPreparedStaves(input);
  if (found === null) throw new NoStaffError();
  const { prepared, staves } = found;
  const { binary } = prepared;
  const spacing = staves.map((s) => s.spacing).sort((a, b) => a - b)[Math.floor(staves.length / 2)] ?? 1;
  const clean = removeStaffLines(binary, staves);
  const solid = solidHeads(binary, clean, staves, spacing);
  const heads = findHeads(
    { original: prepared.lines, clean, solid, distance: distanceToPaper(solid) },
    staves,
    rejected,
  );
  const verticals = findVerticals(clean, Math.max(3, Math.round(0.42 * spacing)), Math.round(spacing));
  const labeled = connectedComponents(clean);
  const headers = staves.map((staff) => readHeader({ clean, labeled, verticals, heads }, staff));
  const all = staves.map((staff, i) => {
    const header = headers[i] ?? { clef: null, keyFifths: null, meter: false, end: staff.x0 };
    const own = heads.filter((head) => head.staff === i);
    const rings = findRings(binary, staff, i, header.end + staff.spacing, own);
    return readStaff(staff, header, [...own, ...rings], { clean, labeled, verticals });
  });
  // Five lines without a clef and without a single note on a stem (text, moiré stripes that line up by chance) are
  // no staff
  const real = (reading: StaffReading): boolean =>
    reading.header.clef !== null || reading.events.some((event) => event.kind === 'note' && event.stem !== null);
  const kept = all.flatMap((reading, i) => (real(reading) ? [{ reading, header: headers[i] }] : []));
  const readings = kept.map((k) => k.reading);
  const keptHeaders = kept.flatMap((k) => (k.header === undefined ? [] : [k.header]));
  const systems = splitMelodies(
    groupSystems(
      binary,
      readings.map((reading) => reading.staff),
      keptHeaders,
      readings.map((reading) => reading.barlines),
    ),
    readings,
  );
  const score = buildScore(readings, systems, voicesOf(systems), { keyFifths: commonKey(headers) });
  return {
    labeled,
    clean,
    verticals,
    score,
    staves: readings.map((r) => r.staff),
    readings,
    heads,
    scale: prepared.scale,
    angle: prepared.angle,
  };
};
