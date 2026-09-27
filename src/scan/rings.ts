// Hollow heads whose ring the photo or the line removal has broken, so that no hole could be filled: at every staff
// position along the staff, an elliptic ring of ink around paper – rows on staff and ledger lines left out, since a
// line crosses every head there.
import type { BinaryImage } from './binarize';
import type { Head } from './heads';
import type { Vertical } from './verticals';
import { stepAt, stepY, type Staff } from './staves';

const TILT = -0.35;

interface Score {
  readonly ring: number; // ink share of the ring
  readonly inside: number; // ink share of the inside
}

// Ink shares of ring (normalised radius 0.7…1.05) and inside (below 0.45), line rows left out
export const ringScore = (image: BinaryImage, staff: Staff, x: number, y: number): Score => {
  const { spacing } = staff;
  const a = 0.62 * spacing;
  const b = 0.46 * spacing;
  const cos = Math.cos(TILT);
  const sin = Math.sin(TILT);
  const lineReach = Math.max(1, 0.12 * spacing);
  let ring = 0;
  let ringInk = 0;
  let inside = 0;
  let insideInk = 0;
  for (let yy = Math.round(y - 1.1 * b); yy <= Math.round(y + 1.1 * b); yy++) {
    const step = stepAt(staff, x, yy);
    const nearest = 2 * Math.round(step / 2); // lines and ledger lines sit on even steps
    if (Math.abs(stepY(staff, x, nearest) - yy) <= lineReach) continue;
    for (let xx = Math.round(x - 1.1 * a); xx <= Math.round(x + 1.1 * a); xx++) {
      const dx = xx - x;
      const dy = yy - y;
      const u = (dx * cos + dy * sin) / a;
      const v = (-dx * sin + dy * cos) / b;
      const r = Math.sqrt(u * u + v * v);
      const ink = image.data[yy * image.width + xx] === 1 ? 1 : 0;
      if (r >= 0.7 && r <= 1.05) {
        ring++;
        ringInk += ink;
      } else if (r < 0.45) {
        inside++;
        insideInk += ink;
      }
    }
  }
  return { ring: ring === 0 ? 0 : ringInk / ring, inside: inside === 0 ? 1 : insideInk / inside };
};

const isRing = (s: Score): boolean => s.ring >= 0.55 && s.inside <= 0.15;

// A column of ink over the whole staff within a line distance and a half: a (thick) bar line, whose gap to the thin
// one is no ring
const nearFullColumn = (image: BinaryImage, staff: Staff, x: number): boolean => {
  const reach = Math.round(1.5 * staff.spacing);
  for (let xx = Math.round(x) - reach; xx <= Math.round(x) + reach; xx++) {
    const top = Math.round(stepY(staff, xx, 8));
    const bottom = Math.round(stepY(staff, xx, 0));
    let ink = 0;
    for (let y = top; y <= bottom; y++) if (image.data[y * image.width + xx] === 1) ink++;
    if (Math.abs(xx - x) > 0.3 * staff.spacing && ink >= 0.95 * (bottom - top + 1)) return true;
  }
  return false;
};

// Hollow heads on a staff not yet found among `known`
export const findRings = (
  image: BinaryImage,
  staff: Staff,
  index: number,
  start: number,
  known: readonly Head[],
  verticals: readonly Vertical[] = [],
): Head[] => {
  const { spacing } = staff;
  const found: (Head & { score: number })[] = [];
  // A bar line (a long stroke not where a stem would be) next to the ring: the gap of a double bar line or repeat
  const byBarline = (h: Head): boolean =>
    verticals.some((v) => {
      const dx = Math.abs(v.x - h.x);
      const stemPlace = Math.abs(dx - 0.6 * spacing) <= 0.3 * spacing;
      return v.y1 - v.y0 >= 3 * spacing && dx <= 1.5 * spacing && !stemPlace && h.y >= v.y0 && h.y <= v.y1;
    });
  for (let step = -2; step <= 10; step++) {
    for (let x = Math.round(start); x <= staff.x1; x += 2) {
      const y = stepY(staff, x, step);
      const score = ringScore(image, staff, x, y);
      if (!isRing(score)) continue;
      const near = found.find((h) => h.step === step && Math.abs(h.x - x) < 0.8 * spacing);
      const head = {
        x,
        y,
        staff: index,
        step,
        filled: false,
        uncertain: true,
        thickness: 0.4 * spacing,
        width: 1.2 * spacing,
        score: score.ring,
      };
      if (near === undefined) found.push(head);
      else if (score.ring > near.score) found.splice(found.indexOf(near), 1, head);
    }
  }
  return (
    found
      // Not a found head again, and not squeezed between found ones (a flag and a stem enclose paper like a ring)
      .filter(
        (h) =>
          !known.some((k) => Math.abs(k.x - h.x) < 1.6 * spacing) && !byBarline(h) && !nearFullColumn(image, staff, h.x),
      )
      .filter(
        (h) => !found.some((o) => o !== h && o.score > h.score && Math.hypot(o.x - h.x, o.y - h.y) < 0.8 * spacing),
      )
      .map((h): Head => ({
        x: h.x,
        y: h.y,
        staff: h.staff,
        step: h.step,
        filled: false,
        uncertain: true,
        thickness: h.thickness,
        width: h.width,
      }))
  );
};
