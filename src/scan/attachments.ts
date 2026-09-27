// What belongs to a note besides its head and stem: beams or flags at the stem's tip (each halves the value), dots to
// the right of the head (each adds half of what the previous added), an accidental to the left of the head.
import type { BinaryImage } from './binarize';
import type { Component, Labeled } from './components';
import { accidentalKind, boxOf } from './glyphs';
import type { Head } from './heads';
import type { Vertical } from './verticals';

const inkAt = (image: BinaryImage, x: number, y: number): boolean =>
  x >= 0 && y >= 0 && x < image.width && y < image.height && image.data[y * image.width + x] === 1;

const stemInk = (image: BinaryImage, x: number, y: number): boolean =>
  inkAt(image, x - 1, y) || inkAt(image, x, y) || inkAt(image, x + 1, y);

// From the end of the stroke on, along the stem through its beams to its real tip (gaps of two pixels bridged)
export const stemTip = (image: BinaryImage, vertical: Vertical, up: boolean): number => {
  const x = Math.round(vertical.x);
  const step = up ? -1 : 1;
  let y = up ? vertical.y0 : vertical.y1 - 1;
  let tip = y;
  let gap = 0;
  while (gap <= 2 && y >= 0 && y < image.height) {
    if (stemInk(image, x, y)) {
      tip = y;
      gap = 0;
    } else {
      gap++;
    }
    y += step;
  }
  return tip;
};

// Ink runs of at least `minRun` pixels in column x between y0 and y1 that reach over to column `inner` (towards the
// stem): a beam or flag is attached to the stem, specks of noise are not
const attachedRuns = (image: BinaryImage, x: number, inner: number, y0: number, y1: number, minRun: number): number => {
  let runs = 0;
  let length = 0;
  let attached = false;
  const close = (): void => {
    if (length >= minRun && attached) runs++;
    length = 0;
    attached = false;
  };
  for (let y = y0; y <= y1; y++) {
    if (!inkAt(image, x, y)) {
      close();
      continue;
    }
    length++;
    if (inkAt(image, inner, y)) attached = true;
  }
  close();
  return runs;
};

// Beams or flags at the tip: the most separate runs beside the stem, left or right, between the tip and where the
// stroke stopped being thin
export const beamCount = (image: BinaryImage, vertical: Vertical, up: boolean, spacing: number): number => {
  const tip = stemTip(image, vertical, up);
  const end = up ? vertical.y0 : vertical.y1 - 1;
  const margin = Math.round(0.35 * spacing);
  const y0 = Math.min(tip, end) - margin;
  const y1 = Math.max(tip, end) + margin;
  const minRun = Math.max(2, Math.round(0.22 * spacing));
  let best = 0;
  for (const offset of [-0.55, -0.4, 0.4, 0.55, 0.75]) {
    const x = Math.round(vertical.x + offset * spacing);
    const inner = offset < 0 ? vertical.x0 - 2 : vertical.x1 + 2; // just outside the stem
    best = Math.max(best, attachedRuns(image, x, inner, y0, y1, minRun));
  }
  return Math.min(best, 4);
};

// Small round pieces: dots, and the parts of other symbols that look like them
export const specksOf = (labeled: Labeled, spacing: number): Component[] =>
  labeled.components.filter((c) => {
    const { w, h, fill } = boxOf(c, spacing);
    return w >= 0.2 && w <= 0.75 && h >= 0.2 && h <= 0.75 && Math.abs(w - h) <= 0.3 && fill >= 0.5;
  });

// Dots right of a head, in its space (a head on a line has its dot in the space above)
export const dotCount = (head: Head, specks: readonly Component[], spacing: number): number => {
  const dots = specks.filter((c) => {
    const x = (c.x0 + c.x1) / 2;
    const y = (c.y0 + c.y1) / 2;
    return (
      x >= head.x + 0.75 * spacing &&
      x <= head.x + 2.3 * spacing &&
      y >= head.y - 0.8 * spacing &&
      y <= head.y + 0.4 * spacing
    );
  });
  if (dots.length === 0) return 0;
  const first = Math.min(...dots.map((c) => c.x0));
  if (first > head.x + 1.9 * spacing) return 0;
  return Math.min(2, dots.length);
};

// Duration of a note from its head, stem, beams and dots
export const noteValue = (filled: boolean, stem: boolean, beams: number, dots: number): number => {
  let base = 4;
  if (filled) base = 1 / 2 ** beams;
  else if (stem) base = 2;
  let value = base;
  let add = base / 2;
  for (let i = 0; i < dots; i++) {
    value += add;
    add /= 2;
  }
  return value;
};

export interface Accidental {
  readonly alteration: number; // +1 sharp, −1 flat, 0 natural
  readonly component: Component;
}

// Accidentals of a staff: the pieces shaped like one, with the height their pitch is read at
export const accidentalsOf = (
  labeled: Labeled,
  width: number,
  candidates: readonly Component[],
  spacing: number,
): (Accidental & { readonly y: number })[] =>
  candidates.flatMap((component) => {
    const kind = accidentalKind(component, labeled, width, spacing);
    if (kind === 'sharp' || kind === 'natural') {
      return [{ alteration: kind === 'sharp' ? 1 : 0, component, y: (component.y0 + component.y1) / 2 }];
    }
    if (kind === 'flat') return [{ alteration: -1, component, y: component.y1 - 0.5 * spacing }];
    return [];
  });

// The accidental just left of a head at its height
export const accidentalFor = (
  head: Head,
  accidentals: readonly (Accidental & { readonly y: number })[],
  spacing: number,
): Accidental | undefined =>
  accidentals.find(
    (a) =>
      a.component.x1 <= head.x - 0.45 * spacing &&
      a.component.x1 >= head.x - 2.2 * spacing &&
      Math.abs(a.y - head.y) <= 0.4 * spacing,
  );
