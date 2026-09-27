// What makes it sound like a (rough) piano instead of a raw sine: a handful of harmonic partials with slightly
// decaying weight, and a percussive volume envelope (fast attack, exponential decay) instead of a flat gain.
// Pure data and math only; src/ui/audio-engine.ts turns this into real oscillators and AudioParam automation.

export interface Overtone {
  readonly ratio: number; // multiple of the fundamental frequency
  readonly gain: number; // relative weight, loudest partial is 1
}

// A few harmonics, quieter as they go up, plus a faintly detuned unison for a less sterile, less sine-like tone.
export const pianoPartials: readonly Overtone[] = [
  { ratio: 1, gain: 1 },
  { ratio: 1.003, gain: 0.5 },
  { ratio: 2, gain: 0.35 },
  { ratio: 3, gain: 0.18 },
  { ratio: 4, gain: 0.08 },
];

export interface EnvelopePoint {
  readonly time: number; // seconds from the note's start
  readonly value: number; // gain multiplier, 0..1
}

const ATTACK = 0.006; // seconds to reach full volume – fast and percussive, like a hammer strike
const DECAY_TO = 0.35; // volume right after the attack peak, before settling into the longer decay
const RELEASE = 0.35; // seconds of tail rung out after the note's notated duration

// Attack, a quick partial decay (piano tone thins fast after the strike), a slower decay across the note's
// length, then a short release. `setValueAtTime`/`exponentialRampToValueAtTime` follow these points directly –
// exponential ramps cannot target exactly 0, so the envelope never quite reaches it either.
export const envelopePoints = (duration: number): readonly EnvelopePoint[] => {
  const floor = 0.0001;
  const sustainEnd = Math.max(ATTACK * 2 + 0.001, duration);
  return [
    { time: 0, value: floor },
    { time: ATTACK, value: 1 },
    { time: ATTACK * 2, value: DECAY_TO },
    { time: sustainEnd, value: Math.max(floor, DECAY_TO * 0.4) },
    { time: sustainEnd + RELEASE, value: floor },
  ];
};
