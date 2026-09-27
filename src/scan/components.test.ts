import { describe, expect, it } from 'vitest';
import { binaryFromAscii } from './__fixtures__/ascii';
import { connectedComponents } from './components';

describe('connectedComponents', () => {
  it('finds boxes, sizes and centroids', () => {
    const { components, labels } = connectedComponents(
      binaryFromAscii(['##......', '##......', '.....###', '........']),
    );
    expect(components).toEqual([
      { id: 1, x0: 0, y0: 0, x1: 1, y1: 1, size: 4, cx: 0.5, cy: 0.5 },
      { id: 2, x0: 5, y0: 2, x1: 7, y1: 2, size: 3, cx: 6, cy: 2 },
    ]);
    expect(labels[0]).toBe(1);
    expect(labels[2 * 8 + 6]).toBe(2);
    expect(labels[3 * 8]).toBe(0);
  });

  it('joins diagonal neighbours', () => {
    const { components } = connectedComponents(binaryFromAscii(['#...', '.#..', '..#.', '...#']));
    expect(components).toHaveLength(1);
    expect(components[0]?.size).toBe(4);
  });

  it('finds nothing on empty paper', () => {
    expect(connectedComponents(binaryFromAscii(['....', '....'])).components).toEqual([]);
  });
});
