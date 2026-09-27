// Noteheads: the thickest places of the ink once hollow heads are filled – a head is the only symbol about one line
// distance thick in every direction (beams, stems, lines, rests, dots and accidentals are thinner). Each candidate
// must look like a head (an ellipse full of ink), must stand on a staff, and beyond the staff on its ledger lines.
import type { BinaryImage } from './binarize';
import { numberAt, shortAt } from './raster';
import { type Staff, stepAt, stepY } from './staves';

export interface Head {
  readonly x: number;
  readonly y: number;
  readonly staff: number; // index into the staves
  readonly step: number; // 0 = bottom line, one step per half spacing
  readonly filled: boolean;
  readonly uncertain: boolean; // pitch between two steps, or neither clearly filled nor clearly hollow
  readonly thickness: number; // distance of the centre to the paper, pixels: heads are thicker than flags
}

export interface HeadImages {
  readonly original: BinaryImage; // binarised, lines still in
  readonly clean: BinaryImage; // lines removed
  readonly solid: BinaryImage; // lines removed, holes filled
  readonly distance: Uint16Array; // chamfer distance of `solid`, thirds of a pixel
}

interface Candidate {
  readonly x: number;
  readonly y: number;
  readonly d: number; // distance to paper, pixels
}

// Pixels whose distance to the paper is a local maximum of at least `min` pixels
const ridgeMaxima = (distance: Uint16Array, width: number, height: number, min: number): Candidate[] => {
  const threshold = Math.ceil(3 * min);
  const found: Candidate[] = [];
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      const d = distance[i] ?? 0;
      if (d < threshold) continue;
      if (
        d >= (distance[i - 1] ?? 0) &&
        d >= (distance[i + 1] ?? 0) &&
        d >= (distance[i - width] ?? 0) &&
        d >= (distance[i + width] ?? 0)
      ) {
        found.push({ x, y, d: d / 3 });
      }
    }
  }
  return found;
};

// Strongest first; a point closer than `radius` to a kept one goes. A grid of radius-sized cells keeps it linear.
export const suppress = <T extends { readonly x: number; readonly y: number; readonly d: number }>(
  points: readonly T[],
  radius: number,
): T[] => {
  const cells = new Map<string, T[]>();
  const key = (cx: number, cy: number): string => `${String(cx)},${String(cy)}`;
  const kept: T[] = [];
  for (const p of [...points].sort((a, b) => b.d - a.d)) {
    const cx = Math.floor(p.x / radius);
    const cy = Math.floor(p.y / radius);
    let near = false;
    for (let dx = -1; dx <= 1 && !near; dx++) {
      for (let dy = -1; dy <= 1 && !near; dy++) {
        near = (cells.get(key(cx + dx, cy + dy)) ?? []).some((k) => Math.hypot(k.x - p.x, k.y - p.y) < radius);
      }
    }
    if (near) continue;
    kept.push(p);
    const cell = cells.get(key(cx, cy)) ?? [];
    cell.push(p);
    cells.set(key(cx, cy), cell);
  }
  return kept;
};

// Share of ink inside an ellipse (semi-axes a, b, rotated by `angle` radians)
export const inkInEllipse = (
  image: BinaryImage,
  cx: number,
  cy: number,
  a: number,
  b: number,
  angle: number,
): number => {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const reach = Math.ceil(Math.max(a, b));
  let inside = 0;
  let ink = 0;
  for (let y = Math.round(cy) - reach; y <= Math.round(cy) + reach; y++) {
    for (let x = Math.round(cx) - reach; x <= Math.round(cx) + reach; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const u = (dx * cos + dy * sin) / a;
      const v = (-dx * sin + dy * cos) / b;
      if (u * u + v * v > 1) continue;
      inside++;
      if (x >= 0 && y >= 0 && x < image.width && y < image.height && image.data[y * image.width + x] === 1) ink++;
    }
  }
  return inside === 0 ? 0 : ink / inside;
};

const HEAD_TILT = -0.35; // radians: engraved heads rise to the right

// The staff whose lines (with up to four ledger lines) reach the point, nearest to its middle
export const staffOfPoint = (staves: readonly Staff[], x: number, y: number): number => {
  let best = -1;
  let bestDistance = Infinity;
  staves.forEach((staff, i) => {
    if (x < staff.x0 - staff.spacing || x > staff.x1 + staff.spacing) return;
    const step = stepAt(staff, x, y);
    const distance = Math.abs(step - 4);
    if (step >= -9 && step <= 17 && distance < bestDistance) {
      best = i;
      bestDistance = distance;
    }
  });
  return best;
};

// A ledger line through row y reaches beyond the head on both sides: thin ink on the row, paper just above and below
const hasLedger = (image: BinaryImage, x: number, y: number, spacing: number): boolean => {
  const row = Math.round(y);
  const reach = Math.max(1, Math.round(0.12 * spacing));
  const clear = Math.round(0.35 * spacing);
  const inkAt = (xx: number, yy: number): boolean => image.data[yy * image.width + xx] === 1;
  const lineAt = (xx: number): boolean => {
    let onRow = false;
    for (let dy = -reach; dy <= reach && !onRow; dy++) onRow = inkAt(xx, row + dy);
    return onRow && !inkAt(xx, row - clear) && !inkAt(xx, row + clear);
  };
  const side = (from: number, to: number): boolean => {
    let hits = 0;
    let total = 0;
    for (let xx = Math.round(from); xx <= Math.round(to); xx++) {
      total++;
      if (lineAt(xx)) hits++;
    }
    return hits >= 0.5 * total;
  };
  return side(x - 0.88 * spacing, x - 0.7 * spacing) && side(x + 0.7 * spacing, x + 0.88 * spacing);
};

// Heads below the staff from C4 (treble) on need their ledger lines, likewise above – lyrics have none
export const ledgersPresent = (image: BinaryImage, staff: Staff, x: number, step: number): boolean => {
  for (let ledger = -2; ledger >= step; ledger -= 2) {
    if (!hasLedger(image, x, stepY(staff, x, ledger), staff.spacing)) return false;
  }
  for (let ledger = 10; ledger <= step; ledger += 2) {
    if (!hasLedger(image, x, stepY(staff, x, ledger), staff.spacing)) return false;
  }
  return true;
};

// Centre of the thick part: mean of the pixels at least 80 % as far from the paper as the maximum
const centreOf = (images: HeadImages, c: Candidate, spacing: number): { x: number; y: number } => {
  const { width } = images.solid;
  const threshold = 0.8 * 3 * c.d;
  const reach = Math.round(0.6 * spacing);
  let sx = 0;
  let sy = 0;
  let n = 0;
  for (let y = c.y - reach; y <= c.y + reach; y++) {
    for (let x = c.x - reach; x <= c.x + reach; x++) {
      if ((images.distance[y * width + x] ?? 0) < threshold) continue;
      sx += x;
      sy += y;
      n++;
    }
  }
  return n === 0 ? c : { x: sx / n, y: sy / n };
};

// Height of the solid ink through the centre column: a bar line or a clef is taller than a chord of heads
const verticalExtent = (image: BinaryImage, x: number, y: number): number => {
  const column = Math.round(x);
  let top = Math.round(y);
  let bottom = top;
  while (top > 0 && image.data[(top - 1) * image.width + column] === 1) top--;
  while (bottom < image.height - 1 && image.data[(bottom + 1) * image.width + column] === 1) bottom++;
  return bottom - top + 1;
};

// A head ends left and right of itself; a beam goes on. Ink on one side is fine (a dot, the other head of a second).
const isolated = (image: BinaryImage, x: number, y: number, spacing: number): boolean => {
  const share = (from: number, to: number): number => {
    let ink = 0;
    let total = 0;
    for (let yy = Math.round(y - 0.12 * spacing); yy <= Math.round(y + 0.12 * spacing); yy++) {
      for (let xx = Math.round(from); xx <= Math.round(to); xx++) {
        total++;
        if (image.data[yy * image.width + xx] === 1) ink++;
      }
    }
    return ink / total;
  };
  const left = share(x - 1.15 * spacing, x - 0.9 * spacing);
  const right = share(x + 0.9 * spacing, x + 1.15 * spacing);
  return left < 0.5 || right < 0.5;
};

// Width of the solid ink through the centre row: a head is wider than the bowl of a letter or a natural sign
const horizontalExtent = (image: BinaryImage, x: number, y: number): number => {
  const row = Math.round(y) * image.width;
  let left = Math.round(x);
  let right = left;
  while (left > 0 && image.data[row + left - 1] === 1) left--;
  while (right < image.width - 1 && image.data[row + right + 1] === 1) right++;
  return right - left + 1;
};

// Ink in all four corners around the centre: a block (a half or whole rest on its line), not an ellipse
const squareCorners = (image: BinaryImage, x: number, y: number, spacing: number): boolean =>
  [-1, 1].every((sx) =>
    [-1, 1].every(
      (sy) => image.data[Math.round(y + sy * 0.28 * spacing) * image.width + Math.round(x + sx * 0.5 * spacing)] === 1,
    ),
  );

// Width over height of the core (at least half as far from the paper as the centre): a head is an ellipse lying on
// its side, the filled bowl of a letter or the middle of a natural sign is round
const coreAspect = (distance: Uint16Array, width: number, x: number, y: number, d: number): number => {
  const threshold = 1.5 * d; // half of the centre's distance, in thirds of a pixel
  const cx = Math.round(x);
  const cy = Math.round(y);
  const reach = (dx: number, dy: number): number => {
    let n = 0;
    while (shortAt(distance, (cy + (n + 1) * dy) * width + cx + (n + 1) * dx) >= threshold) n++;
    return n;
  };
  return (reach(1, 0) + reach(-1, 0) + 1) / (reach(0, 1) + reach(0, -1) + 1);
};

const headOf = (images: HeadImages, staves: readonly Staff[], c: Candidate): Head | null => {
  const staffIndex = staffOfPoint(staves, c.x, c.y);
  const staff = staves[staffIndex];
  if (staff === undefined) return null;
  const { spacing } = staff;
  if (c.d > 0.7 * spacing) return null;
  const { x, y } = centreOf(images, c, spacing);
  if (inkInEllipse(images.solid, x, y, 0.5 * spacing, 0.36 * spacing, HEAD_TILT) < 0.9) return null;
  const extent = verticalExtent(images.solid, x, y);
  if (extent > 3.2 * spacing || extent < 0.72 * spacing) return null;
  if (coreAspect(images.distance, images.solid.width, x, y, c.d) < 0.9) return null;
  if (horizontalExtent(images.solid, x, y) < 1.05 * spacing) return null;
  if (!isolated(images.solid, x, y, spacing)) return null;
  const rawStep = stepAt(staff, x, y);
  const step = Math.round(rawStep);
  if (!ledgersPresent(images.original, staff, x, step)) return null;
  // Hollow: part of the head is a filled hole – paper in the image as it was, ink in the solid one
  const ink = inkInEllipse(images.clean, x, y, 0.45 * spacing, 0.32 * spacing, HEAD_TILT);
  const hole = 1 - ink;
  if (hole < 0.1 && squareCorners(images.solid, x, y, spacing)) return null;
  return {
    x,
    y,
    staff: staffIndex,
    step,
    filled: hole < 0.1,
    uncertain: Math.abs(rawStep - step) > 0.35 || (hole > 0.06 && hole < 0.14),
    thickness: c.d,
  };
};

export const findHeads = (images: HeadImages, staves: readonly Staff[]): Head[] => {
  const spacing = numberAt(
    staves.map((s) => s.spacing).sort((a, b) => a - b),
    Math.floor(staves.length / 2),
  );
  const { width, height } = images.solid;
  const candidates = suppress(ridgeMaxima(images.distance, width, height, 0.3 * spacing), 0.35 * spacing);
  const heads = candidates.flatMap((c) => {
    const head = headOf(images, staves, c);
    return head === null ? [] : [{ ...head, d: c.d }];
  });
  const kept = suppress(heads, 0.9 * spacing);
  return kept.map((h): Head => ({
    x: h.x,
    y: h.y,
    staff: h.staff,
    step: h.step,
    filled: h.filled,
    uncertain: h.uncertain,
    thickness: h.thickness,
  }));
};
