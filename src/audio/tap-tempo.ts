// Tap tempo: turns a series of taps into a BPM, from the average interval of the last few taps. A gap longer
// than the reset threshold starts a fresh sequence, so an old, unrelated tap never drags down a new one.
export interface TapTempo {
  // Registers a tap now; returns the tempo in BPM once at least two taps in the current sequence are known,
  // otherwise null (the first tap of a sequence has no interval yet).
  readonly tap: () => number | null;
}

const MAX_TAPS = 6;
const RESET_GAP_SECONDS = 2;

export const createTapTempo = (now: () => number = () => Date.now()): TapTempo => {
  let lastTap: number | null = null;
  let intervalsMs: readonly number[] = []; // between the last up to MAX_TAPS taps, most recent last

  const tap = (): number | null => {
    const at = now();
    if (lastTap === null) {
      intervalsMs = [];
    } else {
      const gap = at - lastTap;
      intervalsMs = gap > RESET_GAP_SECONDS * 1000 ? [] : [...intervalsMs, gap].slice(-(MAX_TAPS - 1));
    }
    lastTap = at;

    if (intervalsMs.length === 0) return null;
    const averageIntervalMs = intervalsMs.reduce((sum, value) => sum + value, 0) / intervalsMs.length;
    return 60_000 / averageIntervalMs;
  };

  return { tap };
};
