// Pure scroll maths for following the playback cursor: src/ui/app.ts sets the score container's scrollLeft to
// this every animation frame while playing. The cursor sits in the horizontal centre of the viewport, except
// where centring it would scroll past either edge of the content – there the view stops at that edge instead
// and the cursor drifts on towards it (away from centre at the very start, past centre at the very end).
export const followScrollLeft = (cursorX: number, viewportWidth: number, scrollWidth: number): number => {
  const maxScrollLeft = Math.max(0, scrollWidth - viewportWidth);
  const centred = cursorX - viewportWidth / 2;
  return Math.min(maxScrollLeft, Math.max(0, centred));
};
