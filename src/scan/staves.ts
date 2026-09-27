// Staves in narrow vertical strips: in every strip the thin horizontal ink is projected onto rows (at the local angle
// that makes it sharpest), rows merge to lines, five equidistant lines are a staff; staves of neighbouring strips at
// the same height are chained. A staff therefore may be short (the last system of a song), bent or seen in
// perspective – every line is followed from strip to strip.
import { type BinaryImage, inkRunDown } from './binarize';
import { floatAt, numberAt } from './raster';

export interface Staff {
  readonly spacing: number; // median line distance
  readonly thickness: number; // line thickness, pixels
  readonly x0: number; // horizontal extent of the lines
  readonly x1: number;
  readonly knots: Float32Array; // x of the support points
  readonly lines: readonly Float32Array[]; // five lines, top → bottom: y at each knot
}

interface StripStaff {
  readonly strip: number;
  readonly x: number; // strip centre
  readonly ys: readonly number[]; // five lines top → bottom
}

const LOCAL_ANGLES = [-2, -1.5, -1, -0.5, 0, 0.5, 1, 1.5, 2].map((degrees) => Math.tan((degrees * Math.PI) / 180));

// Row projection of the thin runs inside [xa, xb), sheared by `tan` around the strip centre
const stripProfile = (thin: Uint8Array, width: number, height: number, xa: number, xb: number, tan: number) => {
  const profile = new Float32Array(height);
  const centre = (xa + xb) / 2;
  for (let x = xa; x < xb; x++) {
    const shift = (x - centre) * tan;
    for (let y = 0; y < height; y++) {
      if (thin[y * width + x] !== 1) continue;
      const yy = Math.round(y - shift);
      if (yy >= 0 && yy < height) profile[yy] = floatAt(profile, yy) + 1;
    }
  }
  return profile;
};

const energy = (profile: Float32Array): number => profile.reduce((sum, value) => sum + value * value, 0);

// Pixels on vertical ink runs of at most `maxRun`: staff lines, ledger lines, thin horizontal strokes
export const thinMask = (image: BinaryImage, maxRun: number): Uint8Array => {
  const { width, height, data } = image;
  const thin = new Uint8Array(width * height);
  for (let x = 0; x < width; x++) {
    let y = 0;
    while (y < height) {
      if (data[y * width + x] !== 1) {
        y++;
        continue;
      }
      const end = inkRunDown(image, x, y);
      if (end - y <= maxRun) for (let yy = y; yy < end; yy++) thin[yy * width + x] = 1;
      y = end;
    }
  }
  return thin;
};

// Bands of rows that together hold line pixels over at least 30 % of the strip width (moiré breaks lines into
// dashes) and are thin
export const bandsOf = (profile: Float32Array, stripWidth: number, maxThickness: number): number[] => {
  const low = 0.12 * stripWidth;
  const ys: number[] = [];
  let y = 0;
  while (y < profile.length) {
    if (floatAt(profile, y) <= low) {
      y++;
      continue;
    }
    let end = y;
    let mass = 0;
    let weighted = 0;
    while (end < profile.length && floatAt(profile, end) > low) {
      mass += floatAt(profile, end);
      weighted += floatAt(profile, end) * end;
      end++;
    }
    if (end - y <= maxThickness && mass >= 0.3 * stripWidth) ys.push(weighted / mass);
    y = end;
  }
  return ys;
};

// Five consecutive lines with equal gaps (±30 %: a screen's pixel grid rounds them) near the expected spacing
export const staffGroups = (ys: readonly number[], spacing: number): number[][] => {
  const groups: number[][] = [];
  let i = 0;
  while (i + 4 < ys.length) {
    const five = ys.slice(i, i + 5);
    const gaps = five.slice(1).map((y, k) => y - numberAt(five, k));
    const mean = (numberAt(five, 4) - numberAt(five, 0)) / 4;
    const regular =
      mean >= 0.7 * spacing && mean <= 1.4 * spacing && gaps.every((gap) => Math.abs(gap - mean) <= 0.3 * mean);
    if (regular) {
      groups.push(five);
      i += 5;
    } else {
      i++;
    }
  }
  return groups;
};

const stripStaves = (thin: Uint8Array, image: BinaryImage, strip: number, stripWidth: number, spacing: number) => {
  const xa = strip * stripWidth;
  const xb = Math.min(image.width, xa + stripWidth);
  let best = new Float32Array(0);
  let bestEnergy = -1;
  for (const tan of LOCAL_ANGLES) {
    const profile = stripProfile(thin, image.width, image.height, xa, xb, tan);
    const e = energy(profile);
    if (e > bestEnergy) {
      bestEnergy = e;
      best = profile;
    }
  }
  const maxThickness = Math.max(3, Math.round(0.35 * spacing));
  return staffGroups(bandsOf(best, xb - xa, maxThickness), spacing).map((ys): StripStaff => ({
    strip,
    x: (xa + xb) / 2,
    ys,
  }));
};

const middle = (staff: StripStaff): number => numberAt(staff.ys, 2);

// Chains of strip staves: each continues the chain whose last member (at most eight strips back, e.g. behind a glare)
// is at its height
export const chainStaves = (found: readonly StripStaff[], spacing: number): StripStaff[][] => {
  const chains: StripStaff[][] = [];
  const sorted = [...found].sort((a, b) => a.strip - b.strip || middle(a) - middle(b));
  for (const staff of sorted) {
    const chain = chains.find((candidate) => {
      const last = candidate[candidate.length - 1];
      return (
        last !== undefined &&
        last.strip < staff.strip &&
        staff.strip - last.strip <= 8 &&
        Math.abs(middle(last) - middle(staff)) <= (0.4 + 0.15 * (staff.strip - last.strip)) * spacing
      );
    });
    if (chain === undefined) chains.push([staff]);
    else chain.push(staff);
  }
  return chains;
};

// y of a line at x: linear between the knots, extrapolated along the outer segment
export const lineY = (staff: Staff, line: number, x: number): number => {
  const { knots } = staff;
  const ys = staff.lines[line] ?? new Float32Array(0);
  const n = knots.length;
  if (n === 1) return floatAt(ys, 0);
  let i = 0;
  while (i < n - 2 && x > floatAt(knots, i + 1)) i++;
  const xa = floatAt(knots, i);
  const xb = floatAt(knots, i + 1);
  const f = (x - xa) / (xb - xa);
  return floatAt(ys, i) * (1 - f) + floatAt(ys, i + 1) * f;
};

// Line distance at x
export const spacingAt = (staff: Staff, x: number): number => (lineY(staff, 4, x) - lineY(staff, 0, x)) / 4;

// Staff position of a point: 0 on the bottom line, 8 on the top line, one step per half spacing
export const stepAt = (staff: Staff, x: number, y: number): number =>
  (lineY(staff, 4, x) - y) / (spacingAt(staff, x) / 2);

// y of a staff step at x
export const stepY = (staff: Staff, x: number, step: number): number =>
  lineY(staff, 4, x) - (step * spacingAt(staff, x)) / 2;

const median = (values: readonly number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  return numberAt(sorted, Math.floor(sorted.length / 2));
};

// Whether at least four of the five lines have ink at column x
const linesPresent = (image: BinaryImage, staff: Staff, x: number): boolean => {
  let present = 0;
  const reach = Math.max(1, Math.round(staff.thickness));
  for (let line = 0; line < 5; line++) {
    const y = Math.round(lineY(staff, line, x));
    for (let dy = -reach; dy <= reach; dy++) {
      if (image.data[(y + dy) * image.width + x] === 1) {
        present++;
        break;
      }
    }
  }
  return present >= 4;
};

// Walks from `from` in `direction` while the lines continue (gaps up to half a spacing, e.g. a bar line gap)
const extentFrom = (image: BinaryImage, staff: Staff, from: number, direction: 1 | -1): number => {
  const maxGap = Math.max(2, Math.round(0.5 * staff.spacing));
  let x = Math.round(from);
  let last = x;
  while (x >= 0 && x < image.width && Math.abs(x - last) <= maxGap) {
    if (linesPresent(image, staff, x)) last = x;
    x += direction;
  }
  return last;
};

const staffOf = (chain: readonly StripStaff[], image: BinaryImage, thickness: number): Staff => {
  const knots = Float32Array.from(chain.map((s) => s.x));
  const lines = [0, 1, 2, 3, 4].map((line) => Float32Array.from(chain.map((s) => numberAt(s.ys, line))));
  const spacing = median(chain.map((s) => (numberAt(s.ys, 4) - numberAt(s.ys, 0)) / 4));
  const draft: Staff = { spacing, thickness, x0: 0, x1: image.width - 1, knots, lines };
  const first = floatAt(knots, 0);
  const last = floatAt(knots, knots.length - 1);
  return { ...draft, x0: extentFrom(image, draft, first, -1), x1: extentFrom(image, draft, last, 1) };
};

export const findStaves = (image: BinaryImage, spacing: number, thickness: number): Staff[] => {
  const maxRun = Math.max(2, Math.round(2 * thickness + 1), Math.round(0.3 * spacing));
  const thin = thinMask(image, maxRun);
  const stripWidth = Math.max(24, Math.round(6 * spacing));
  const strips = Math.ceil(image.width / stripWidth);
  const found: StripStaff[] = [];
  for (let strip = 0; strip < strips; strip++) found.push(...stripStaves(thin, image, strip, stripWidth, spacing));
  return chainStaves(found, spacing)
    .filter((chain) => chain.length >= 2)
    .map((chain) => staffOf(chain, image, thickness))
    .sort((a, b) => lineY(a, 2, a.x0) - lineY(b, 2, b.x0));
};
