// Pure computation of "which notes, when, how loud": turns a Score into a flat, time-ordered list of sounding
// events for one straight pass. Looping is the caller's job (schedule this same pass again after loopSeconds).
import { scoreLength } from '../score/score';
import type { Note, Score, Voice } from '../score/score';

export interface PlaybackEvent {
  readonly time: number; // seconds from the start of this pass
  readonly duration: number; // seconds
  readonly midi: number;
  readonly gain: number; // 0..1
}

export interface PlaybackOptions {
  readonly voice: Voice; // the emphasised voice, played at full volume
  readonly othersGain: number; // 0 mutes the other voices, e.g. 0.25 plays them quietly
  readonly tempo: number; // quarter notes per minute, chosen by the user (BPM slider, +/- steps, or tap tempo)
  readonly start: number; // quarter notes from the beginning of the score; playback starts here
  readonly end?: number; // quarter notes; defaults to the end of the score
}

const secondsPerQuarter = (tempo: number): number => 60 / tempo;

// Seconds for one pass over [start, end) at the given tempo – the loop length, when looping.
export const passLengthSeconds = (score: Score, options: Pick<PlaybackOptions, 'tempo' | 'start' | 'end'>): number =>
  ((options.end ?? scoreLength(score)) - options.start) * secondsPerQuarter(options.tempo);

export const eventsFor = (score: Score, options: PlaybackOptions): readonly PlaybackEvent[] => {
  const end = options.end ?? scoreLength(score);
  const perQuarter = secondsPerQuarter(options.tempo);
  const events: PlaybackEvent[] = [];
  for (const entry of Object.entries(score.voices)) {
    const [voice, notes] = entry as [Voice, readonly Note[]];
    const gain = voice === options.voice ? 1 : options.othersGain;
    if (gain <= 0) continue;
    for (const note of notes) {
      if (note.midi === null || note.start < options.start || note.start >= end) continue;
      events.push({
        time: (note.start - options.start) * perQuarter,
        duration: note.duration * perQuarter,
        midi: note.midi,
        gain,
      });
    }
  }
  return events.sort((a, b) => a.time - b.time);
};

// All quarter-note positions any voice starts a sounding note on – candidates for "tap to set start position".
export const noteOnsets = (score: Score): readonly number[] => {
  const onsets = new Set<number>();
  for (const notes of Object.values(score.voices)) {
    for (const note of notes) if (note.midi !== null) onsets.add(note.start);
  }
  return [...onsets].sort((a, b) => a - b);
};

export const nearestOnset = (onsets: readonly number[], target: number): number => {
  if (onsets.length === 0) return target;
  return onsets.reduce((best, onset) => (Math.abs(onset - target) < Math.abs(best - target) ? onset : best));
};
