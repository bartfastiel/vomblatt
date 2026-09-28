import { describe, expect, it } from 'vitest';
import { followScrollLeft } from './follow-scroll';

describe('followScrollLeft', () => {
  it('centres the cursor in the viewport when there is room on both sides', () => {
    expect(followScrollLeft(500, 320, 2000)).toBe(500 - 160);
  });

  it('stays at the left edge while the cursor has not reached the centre yet', () => {
    expect(followScrollLeft(0, 320, 2000)).toBe(0);
    expect(followScrollLeft(100, 320, 2000)).toBe(0); // 100 - 160 would be negative
  });

  it('stops at the maximum scroll once the cursor is within half a viewport of the end', () => {
    const viewportWidth = 320;
    const scrollWidth = 2000;
    const maxScrollLeft = scrollWidth - viewportWidth;
    expect(followScrollLeft(scrollWidth, viewportWidth, scrollWidth)).toBe(maxScrollLeft);
    expect(followScrollLeft(scrollWidth - 50, viewportWidth, scrollWidth)).toBe(maxScrollLeft);
  });

  it('never scrolls when the content already fits the viewport', () => {
    expect(followScrollLeft(50, 320, 200)).toBe(0);
    expect(followScrollLeft(1000, 320, 200)).toBe(0);
  });

  it('is exactly 0 and exactly the maximum right at the transition points', () => {
    const viewportWidth = 320;
    const scrollWidth = 2000;
    const maxScrollLeft = scrollWidth - viewportWidth;
    expect(followScrollLeft(viewportWidth / 2, viewportWidth, scrollWidth)).toBe(0);
    expect(followScrollLeft(maxScrollLeft + viewportWidth / 2, viewportWidth, scrollWidth)).toBe(maxScrollLeft);
  });
});
