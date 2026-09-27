import { describe, expect, it } from 'vitest';
import { homography, project, type Quad, solve } from './homography';

const SQUARE: Quad = [
  { x: 0, y: 0 },
  { x: 100, y: 0 },
  { x: 100, y: 100 },
  { x: 0, y: 100 },
];

describe('solve', () => {
  it('solves a linear system, pivoting past a zero on the diagonal', () => {
    const x = solve(new Float64Array([0, 2, 3, 1]), new Float64Array([4, 5]));
    expect(x[0]).toBeCloseTo(1);
    expect(x[1]).toBeCloseTo(2);
  });
});

describe('homography', () => {
  it('maps the corners onto the corners', () => {
    const trapezoid: Quad = [
      { x: 20, y: 10 },
      { x: 80, y: 10 },
      { x: 100, y: 90 },
      { x: 0, y: 90 },
    ];
    const h = homography(SQUARE, trapezoid);
    SQUARE.forEach((p, i) => {
      const q = project(h, p.x, p.y);
      expect(q.x).toBeCloseTo(trapezoid[i]?.x ?? NaN);
      expect(q.y).toBeCloseTo(trapezoid[i]?.y ?? NaN);
    });
  });

  it('keeps straight lines straight: the middle of an edge stays on the edge', () => {
    const skewed: Quad = [
      { x: 10, y: 5 },
      { x: 90, y: 15 },
      { x: 95, y: 95 },
      { x: 5, y: 85 },
    ];
    const h = homography(SQUARE, skewed);
    const middle = project(h, 50, 0);
    const [a, b] = skewed;
    const cross = (b.x - a.x) * (middle.y - a.y) - (b.y - a.y) * (middle.x - a.x);
    expect(cross).toBeCloseTo(0);
  });

  it('is the identity between equal quads', () => {
    expect(project(homography(SQUARE, SQUARE), 37, 61)).toEqual({
      x: expect.closeTo(37) as number,
      y: expect.closeTo(61) as number,
    });
  });
});
