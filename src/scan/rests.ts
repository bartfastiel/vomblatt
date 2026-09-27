// Rests among the pieces on a staff that are nothing else: a block hanging from a line (whole) or sitting on one
// (half), the zigzag of a quarter rest, the hooked slash of an eighth rest – told apart by size and position.
import type { Component, Labeled } from './components';
import { boxOf, strokesOf } from './glyphs';
import { lineY, type Staff } from './staves';

export interface Rest {
  readonly x: number;
  readonly y: number;
  readonly duration: number; // quarter notes; a whole rest is a whole bar, resolved later
  readonly wholeBar: boolean;
  readonly component: Component;
}

const between = (value: number, low: number, high: number): boolean => value >= low && value <= high;

// Whole rest below its line, half rest above it
const blockRest = (component: Component, staff: Staff): number => {
  const x = (component.x0 + component.x1) / 2;
  const y = (component.y0 + component.y1) / 2;
  let nearest = 0;
  for (let line = 1; line < 5; line++) {
    if (Math.abs(lineY(staff, line, x) - y) < Math.abs(lineY(staff, nearest, x) - y)) nearest = line;
  }
  return y > lineY(staff, nearest, x) ? 4 : 2;
};

export const restOf = (component: Component, labeled: Labeled, width: number, staff: Staff): Rest | null => {
  const { spacing } = staff;
  const { w, h, fill } = boxOf(component, spacing);
  const x = (component.x0 + component.x1) / 2;
  const y = (component.y0 + component.y1) / 2;
  const middle = lineY(staff, 2, x);
  if (Math.abs(y - middle) > 3 * spacing) return null;
  const rest = (duration: number, wholeBar = false): Rest => ({ x, y, duration, wholeBar, component });
  if (between(w, 0.8, 1.8) && between(h, 0.3, 0.85) && fill >= 0.7) {
    const duration = blockRest(component, staff);
    return rest(duration, duration === 4);
  }
  // Quarter and eighth rests stand within the staff (shifted by at most a line distance for a second voice)
  const inside = component.y0 >= lineY(staff, 0, x) - spacing && component.y1 <= lineY(staff, 4, x) + spacing;
  if (!inside || Math.abs(y - middle) > 1.5 * spacing) return null;
  // A zigzag or a hooked slash: at most one long run (the quarter rest's spine), never two like a sharp or natural
  if (!between(w, 0.5, 1.5) || strokesOf(component, labeled, width, 0.6).length > 1) return null;
  if (between(h, 2.1, 3.4) && fill >= 0.25) return rest(1);
  if (between(h, 1.2, 2.1) && fill >= 0.2) return rest(0.5);
  return null;
};
