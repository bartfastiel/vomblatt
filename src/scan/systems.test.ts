import { describe, expect, it } from 'vitest';
import { HEADER, straightStaff } from './__fixtures__/synthetic';
import type { BinaryImage } from './binarize';
import type { Header } from './header';
import { alignedBars, groupSystems, joined, voicesOf } from './systems';

const WIDTH = 400;
const HEIGHT = 400;

// Staves with their top line at the given rows (10 px apart), and vertical lines drawn from y0 to y1 at x
const page = (lines: readonly (readonly [number, number, number])[]): BinaryImage => {
  const data = new Uint8Array(WIDTH * HEIGHT);
  for (const [x, y0, y1] of lines) for (let y = y0; y <= y1; y++) data[y * WIDTH + x] = 1;
  return { width: WIDTH, height: HEIGHT, data };
};

const staves = [20, 100, 220, 300].map((top) => straightStaff(top, 50, 390));
const treble: Header = { ...HEADER, clef: 'treble' };
const bass: Header = { ...HEADER, clef: 'bass' };

describe('joined', () => {
  const [upper, lower] = staves;
  it('sees the system line at the start and bar lines running through', () => {
    if (upper === undefined || lower === undefined) throw new Error('no staves');
    expect(joined(page([[50, 20, 140]]), upper, lower, [])).toBe(true);
    expect(joined(page([[200, 20, 140]]), upper, lower, [200])).toBe(true);
    expect(joined(page([[200, 20, 140]]), upper, lower, [])).toBe(false);
    expect(joined(page([[50, 20, 80]]), upper, lower, [])).toBe(false);
  });
});

describe('alignedBars', () => {
  it('pairs staves whose bar lines stand at the same places', () => {
    expect(alignedBars([100, 200, 300, 390], [101, 199, 302, 390], 10)).toBe(true);
    expect(alignedBars([100, 200, 300, 390], [150, 250, 390], 10)).toBe(false);
    expect(alignedBars([100, 390], [100, 390], 10)).toBe(false);
  });
});

describe('groupSystems', () => {
  it('makes a system of joined staves: S/A over T/B for two staves', () => {
    const image = page([
      [50, 20, 140],
      [50, 220, 340],
    ]);
    const systems = groupSystems(image, staves, [treble, bass, treble, bass], [[], [], [], []]);
    expect(systems.map((s) => s.staves)).toEqual([
      [0, 1],
      [2, 3],
    ]);
    expect(systems[0]?.parts).toEqual([
      { voice: 'S', staff: 0, select: 'up', clef: 'treble' },
      { voice: 'A', staff: 0, select: 'down', clef: 'treble' },
      { voice: 'T', staff: 1, select: 'up', clef: 'bass' },
      { voice: 'B', staff: 1, select: 'down', clef: 'bass' },
    ]);
    expect(voicesOf(systems)).toEqual(['S', 'A', 'T', 'B']);
  });

  it('pairs a treble staff with the bass staff under it when the join is cut off', () => {
    const systems = groupSystems(page([]), staves, [treble, bass, treble, bass], [[], [], [], []]);
    expect(systems.map((s) => s.staves)).toEqual([
      [0, 1],
      [2, 3],
    ]);
  });

  it('reads four joined staves as S, A, T (octave treble clef) and B', () => {
    const systems = groupSystems(page([[50, 20, 340]]), staves, [treble, treble, treble, bass], [[], [], [], []]);
    expect(systems).toHaveLength(1);
    expect(systems[0]?.parts.map((p) => [p.voice, p.select, p.clef])).toEqual([
      ['S', 'all', 'treble'],
      ['A', 'all', 'treble'],
      ['T', 'all', 'treble8'],
      ['B', 'all', 'bass'],
    ]);
  });

  it('keeps single staves of a melody apart and gives three staves the melody on top', () => {
    const melody = groupSystems(page([]), staves, [treble, treble, treble, treble], [[], [], [], []]);
    expect(melody.map((s) => s.staves)).toEqual([[0], [1], [2], [3]]);
    expect(voicesOf(melody)).toEqual(['S']);
    const piano = groupSystems(page([[50, 20, 260]]), staves.slice(0, 3), [treble, treble, bass], [[], [], []]);
    expect(piano[0]?.parts).toEqual([{ voice: 'S', staff: 0, select: 'all', clef: 'treble' }]);
  });
});
