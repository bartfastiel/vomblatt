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
export interface Band {
  readonly y: number; // centre, weighted by the profile
  readonly mass: number; // line pixels in it
}

export const bandsOf = (profile: Float32Array, stripWidth: number, maxThickness: number): Band[] => {
  const low = 0.12 * stripWidth;
  const bands: Band[] = [];
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
    if (end - y <= maxThickness && mass >= 0.3 * stripWidth) bands.push({ y: weighted / mass, mass });
    y = end;
  }
  return bands;
};

// Five consecutive lines with equal gaps (±30 %: a screen's pixel grid rounds them) near the expected spacing. Where
// candidates overlap (a ledger line continues the staff at the same distance) the one with the stronger lines wins.
export const staffGroups = (bands: readonly Band[], spacing: number): number[][] => {
  const candidates: { first: number; mass: number }[] = [];
  for (let i = 0; i + 4 < bands.length; i++) {
    const five = bands.slice(i, i + 5).map((b) => b.y);
    const gaps = five.slice(1).map((y, k) => y - numberAt(five, k));
    const mean = (numberAt(five, 4) - numberAt(five, 0)) / 4;
    const regular =
      mean >= 0.7 * spacing && mean <= 1.4 * spacing && gaps.every((gap) => Math.abs(gap - mean) <= 0.3 * mean);
    if (regular) candidates.push({ first: i, mass: bands.slice(i, i + 5).reduce((sum, b) => sum + b.mass, 0) });
  }
  const taken = new Set<number>();
  const groups: number[][] = [];
  candidates.sort((a, b) => b.mass - a.mass);
  for (const { first } of candidates) {
    if ([0, 1, 2, 3, 4].some((k) => taken.has(first + k))) continue;
    for (let k = 0; k < 5; k++) taken.add(first + k);
    groups.push(bands.slice(first, first + 5).map((b) => b.y));
  }
  groups.sort((a, b) => numberAt(a, 0) - numberAt(b, 0));
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
  const maxThickness = Math.max(3, Math.round(0.45 * spacing)); // a blurred photo thickens the lines
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

// Centre of the thin ink run nearest to row `predicted` in column x (within ±window), or null
const thinRunNear = (image: BinaryImage, x: number, predicted: number, window: number, maxRun: number) => {
  let best: number | null = null;
  let y = Math.max(0, Math.round(predicted) - window);
  const last = Math.min(image.height - 1, Math.round(predicted) + window);
  while (y <= last) {
    if (image.data[y * image.width + x] !== 1) {
      y++;
      continue;
    }
    let top = y;
    while (top > 0 && image.data[(top - 1) * image.width + x] === 1) top--;
    const end = inkRunDown(image, x, y);
    const centre = (top + end - 1) / 2;
    if (end - top <= maxRun && (best === null || Math.abs(centre - predicted) < Math.abs(best - predicted))) {
      best = centre;
    }
    y = end;
  }
  return best;
};

interface Extension {
  readonly end: number; // last column where the lines were seen
  readonly knots: { x: number; ys: number[] }[]; // support points found on the way
}

// Follows the five lines beyond the outermost knot, column by column: where at least three lines show a thin run
// near their course the staff goes on (the course adapts, so a staff seen in perspective is followed); gaps of up to
// three line distances (a bar line, a beam across the lines, moiré dashes) are bridged
const follow = (image: BinaryImage, staff: Staff, from: number, direction: 1 | -1): Extension => {
  const { spacing } = staff;
  const window = Math.max(2, Math.round(0.2 * spacing));
  const maxRun = Math.max(2, Math.round(0.4 * spacing));
  const maxGap = Math.round(3 * spacing);
  const offsets = [0, 0, 0, 0, 0];
  const knots: { x: number; ys: number[] }[] = [];
  let x = Math.round(from);
  let end = x;
  while (x >= 0 && x < image.width && Math.abs(x - end) <= maxGap) {
    const found = offsets.map((offset, line) => {
      const model = lineY(staff, line, x);
      const y = thinRunNear(image, x, model + offset, window, maxRun);
      return y === null ? null : y - model;
    });
    if (found.filter((f) => f !== null).length >= 3) {
      found.forEach((f, line) => {
        if (f !== null) offsets[line] = 0.8 * (offsets[line] ?? 0) + 0.2 * f;
      });
      end = x;
      if (Math.abs(x - from) >= (knots.length + 1) * 2 * spacing) {
        knots.push({ x, ys: offsets.map((offset, line) => lineY(staff, line, x) + offset) });
      }
    }
    x += direction;
  }
  return { end, knots };
};

const withKnots = (staff: Staff, added: readonly { x: number; ys: number[] }[]): Staff => {
  const all = [
    ...Array.from(staff.knots, (x, i) => ({ x, ys: staff.lines.map((line) => floatAt(line, i)) })),
    ...added,
  ].sort((a, b) => a.x - b.x);
  return {
    ...staff,
    knots: Float32Array.from(all.map((k) => k.x)),
    lines: [0, 1, 2, 3, 4].map((line) => Float32Array.from(all.map((k) => numberAt(k.ys, line)))),
  };
};

const staffOf = (chain: readonly StripStaff[], image: BinaryImage, thickness: number): Staff => {
  const knots = Float32Array.from(chain.map((s) => s.x));
  const lines = [0, 1, 2, 3, 4].map((line) => Float32Array.from(chain.map((s) => numberAt(s.ys, line))));
  const spacing = median(chain.map((s) => (numberAt(s.ys, 4) - numberAt(s.ys, 0)) / 4));
  const draft: Staff = { spacing, thickness, x0: 0, x1: image.width - 1, knots, lines };
  const left = follow(image, draft, floatAt(knots, 0), -1);
  const right = follow(image, draft, floatAt(knots, knots.length - 1), 1);
  return { ...withKnots(draft, [...left.knots, ...right.knots]), x0: left.end, x1: right.end };
};

export const findStaves = (image: BinaryImage, spacing: number, thickness: number): Staff[] => {
  const maxRun = Math.max(2, Math.round(2 * thickness + 1), Math.round(0.4 * spacing));
  const thin = thinMask(image, maxRun);
  const stripWidth = Math.max(24, Math.round(6 * spacing));
  const strips = Math.ceil(image.width / stripWidth);
  const found: StripStaff[] = [];
  for (let strip = 0; strip < strips; strip++) found.push(...stripStaves(thin, image, strip, stripWidth, spacing));
  return chainStaves(found, spacing)
    .filter((chain) => chain.length >= 2)
    .map((chain) => staffOf(chain, image, thickness))
    .filter((staff) => lineCoverage(image, staff) >= 0.35)
    .sort((a, b) => lineY(a, 2, a.x0) - lineY(b, 2, b.x0));
};

// Share of the staff's columns where at least four of its five lines have ink: staff lines run through, lines of
// text that happen to lie at equal distances break at every letter and word
const lineCoverage = (image: BinaryImage, staff: Staff): number => {
  const reach = Math.max(1, Math.round(staff.thickness));
  let present = 0;
  let columns = 0;
  for (let x = Math.round(staff.x0); x <= staff.x1; x += 2) {
    columns++;
    let lines = 0;
    for (let line = 0; line < 5; line++) {
      const y = Math.round(lineY(staff, line, x));
      let ink = false;
      for (let dy = -reach; dy <= reach && !ink; dy++) ink = image.data[(y + dy) * image.width + x] === 1;
      if (ink) lines++;
    }
    if (lines >= 4) present++;
  }
  return columns === 0 ? 0 : present / columns;
};
