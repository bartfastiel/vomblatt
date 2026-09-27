// Thin SVG glue around the pure layout maths (src/render/layout.ts): draws the staff, noteheads, bar lines and
// the playback cursor, and turns a tap into a "set start position" callback. No VexFlow, no canvas – plain SVG so
// the cursor is just one element to move and a tap target needs no hit-testing beyond the SVG's own geometry.
import { nearestOnset, noteOnsets } from '../audio/events';
import { barLines, clefFor, layoutScore, xForTime } from '../render/layout';
import type { Clef, LaidOutNote } from '../render/layout';
import type { Score, Voice } from '../score/score';

const SVG_NS = 'http://www.w3.org/2000/svg';

const PX_PER_QUARTER = 44;
const LEFT_MARGIN = 24;
const RIGHT_MARGIN = 24;
const LINE_GAP = 10;
const PX_PER_STEP = LINE_GAP / 2;
const STAFF_HEIGHT = LINE_GAP * 4;
const STAFF_TOP_MARGIN = 24;
const STAFF_GAP = 40;
const BOTTOM_MARGIN = 24;
const MIDDLE_POSITION = 4; // where a rest is drawn: the middle line of its staff

type Attrs = Readonly<Record<string, string>>;

const el = <K extends keyof SVGElementTagNameMap>(tag: K, attrs: Attrs): SVGElementTagNameMap[K] => {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, value);
  return node;
};

export interface ScoreView {
  readonly svg: SVGSVGElement;
  readonly render: (score: Score, voice: Voice) => void;
  readonly setCursor: (quarter: number | null) => void;
  readonly onTap: (handler: (quarter: number) => void) => void;
}

export const createScoreView = (): ScoreView => {
  const svg = el('svg', { class: 'score' });
  let currentScore: Score | null = null;
  let cursor: SVGLineElement | null = null;
  let tapHandler: ((quarter: number) => void) | null = null;

  const clefsPresent = (score: Score): readonly Clef[] => {
    const clefs = new Set(Object.keys(score.voices).map((voice) => clefFor(voice as Voice)));
    return (['treble', 'bass'] as const).filter((clef) => clefs.has(clef));
  };

  const staffBottomY = (clef: Clef, clefs: readonly Clef[]): number => {
    const slot = clefs.indexOf(clef);
    return STAFF_TOP_MARGIN + STAFF_HEIGHT + slot * (STAFF_GAP + STAFF_HEIGHT);
  };

  const yFor = (note: LaidOutNote, clefs: readonly Clef[]): number => {
    const position = note.position ?? MIDDLE_POSITION;
    return staffBottomY(note.clef, clefs) - position * PX_PER_STEP;
  };

  const drawStaffLines = (clefs: readonly Clef[], width: number): SVGElement[] =>
    clefs.flatMap((clef) => {
      const bottom = staffBottomY(clef, clefs);
      return Array.from({ length: 5 }, (_, line) =>
        el('line', {
          x1: '0',
          x2: String(width),
          y1: String(bottom - line * LINE_GAP),
          y2: String(bottom - line * LINE_GAP),
          class: 'staff-line',
        }),
      );
    });

  const drawBarLines = (score: Score, clefs: readonly Clef[]): SVGElement[] => {
    const top = staffBottomY(clefs[0] ?? 'treble', clefs) - STAFF_HEIGHT;
    const bottom = staffBottomY(clefs.at(-1) ?? 'treble', clefs);
    return barLines(score).map((quarter) =>
      el('line', {
        x1: String(LEFT_MARGIN + xForTime(quarter, PX_PER_QUARTER)),
        x2: String(LEFT_MARGIN + xForTime(quarter, PX_PER_QUARTER)),
        y1: String(top),
        y2: String(bottom),
        class: 'bar-line',
      }),
    );
  };

  const noteClass = (note: LaidOutNote): string => {
    const parts = ['note', note.emphasis ? 'note--chosen' : 'note--other'];
    if (note.uncertain) parts.push('note--uncertain');
    return parts.join(' ');
  };

  const drawStemAndFlags = (group: SVGElement, note: LaidOutNote, x: number, y: number): void => {
    const stemUp = note.stemUp;
    const stemX = x + (stemUp ? 6 : -6);
    const stemY2 = y + (stemUp ? -30 : 30);
    group.append(
      el('line', { x1: String(stemX), y1: String(y), x2: String(stemX), y2: String(stemY2), class: 'stem' }),
    );
    for (let flag = 0; flag < note.flags; flag++) {
      const flagY = stemY2 + (stemUp ? 1 : -1) * flag * 7;
      const flagEndY = flagY + (stemUp ? 8 : -8);
      group.append(
        el('path', {
          d: `M${String(stemX)},${String(flagY)} q8,${stemUp ? '4' : '-4'} 9,${String(flagEndY - flagY)}`,
          class: 'flag',
        }),
      );
    }
  };

  const drawNote = (note: LaidOutNote, clefs: readonly Clef[]): SVGElement => {
    const group = el('g', { class: noteClass(note) });
    const x = LEFT_MARGIN + note.x;
    const y = yFor(note, clefs);

    if (note.notehead === 'rest') {
      group.append(el('rect', { x: String(x - 4), y: String(y - 3), width: '10', height: '6', class: 'rest' }));
      return group;
    }

    const hollow = note.notehead !== 'filled';
    group.append(
      el('ellipse', {
        cx: String(x),
        cy: String(y),
        rx: '6',
        ry: '4.5',
        class: hollow ? 'notehead notehead--hollow' : 'notehead',
      }),
    );
    if (note.notehead !== 'whole') drawStemAndFlags(group, note, x, y);
    if (note.dotted) group.append(el('circle', { cx: String(x + 10), cy: String(y), r: '1.6', class: 'dot' }));
    return group;
  };

  const render = (score: Score, voice: Voice): void => {
    currentScore = score;
    const clefs = clefsPresent(score);
    const laidOut = layoutScore(score, { voice, pxPerQuarter: PX_PER_QUARTER });
    const lastNoteX = laidOut.reduce((max, note) => Math.max(max, note.x), 0);
    const width = LEFT_MARGIN + lastNoteX + RIGHT_MARGIN;
    const height =
      (clefs.length === 0 ? STAFF_TOP_MARGIN + STAFF_HEIGHT : staffBottomY(clefs.at(-1) ?? 'treble', clefs)) +
      BOTTOM_MARGIN;

    svg.setAttribute('viewBox', `0 0 ${String(width)} ${String(height)}`);
    svg.setAttribute('width', String(width));
    svg.setAttribute('height', String(height));
    svg.replaceChildren();
    for (const line of drawStaffLines(clefs, width)) svg.append(line);
    for (const line of drawBarLines(score, clefs)) svg.append(line);
    for (const note of laidOut) svg.append(drawNote(note, clefs));

    cursor = el('line', {
      x1: String(LEFT_MARGIN),
      x2: String(LEFT_MARGIN),
      y1: '0',
      y2: String(height),
      class: 'cursor',
      visibility: 'hidden',
    });
    svg.append(cursor);
  };

  const setCursor = (quarter: number | null): void => {
    if (cursor === null) return;
    if (quarter === null) {
      cursor.setAttribute('visibility', 'hidden');
      return;
    }
    cursor.setAttribute('visibility', 'visible');
    const x = String(LEFT_MARGIN + xForTime(quarter, PX_PER_QUARTER));
    cursor.setAttribute('x1', x);
    cursor.setAttribute('x2', x);
  };

  const onTap = (handler: (quarter: number) => void): void => {
    tapHandler = handler;
  };

  svg.addEventListener('pointerdown', (event) => {
    if (currentScore === null || tapHandler === null) return;
    const rect = svg.getBoundingClientRect();
    if (rect.width === 0) return;
    const viewBoxWidth = svg.viewBox.baseVal.width;
    const scaleX = viewBoxWidth / rect.width;
    const xInSvg = (event.clientX - rect.left) * scaleX;
    const quarter = Math.max(0, (xInSvg - LEFT_MARGIN) / PX_PER_QUARTER);
    tapHandler(nearestOnset(noteOnsets(currentScore), quarter));
  });

  return { svg, render, setCursor, onTap };
};
