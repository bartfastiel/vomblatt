// Thin WebAudio glue: turns the pure event list (src/audio/events.ts) and envelope (src/audio/timbre.ts) into
// real oscillators, with look-ahead scheduling so timing survives the main thread being briefly busy. See
// https://www.html5rocks.com/en/tutorials/audio/scheduling/ for the scheduling pattern this follows.
import { eventsFor, passLengthSeconds } from '../audio/events';
import { mtof } from '../audio/pitch';
import { envelopePoints, pianoPartials } from '../audio/timbre';
import type { PlaybackEvent, PlaybackOptions } from '../audio/events';
import type { Score } from '../score/score';

export interface EngineOptions extends PlaybackOptions {
  readonly loop: boolean;
}

export interface AudioEngine {
  readonly unlock: () => void;
  readonly play: (score: Score, options: EngineOptions) => void;
  readonly pause: () => void;
  readonly isPlaying: () => boolean;
  readonly currentQuarter: () => number | null;
}

const LOOKAHEAD_INTERVAL_MS = 25;
const SCHEDULE_AHEAD_SECONDS = 0.15;
const RELEASE_TAIL_SECONDS = 0.05;
const MASTER_GAIN = 0.2; // headroom for several simultaneous partials across up to four simultaneous voices

const scheduleNote = (context: AudioContext, output: GainNode, at: number, event: PlaybackEvent): void => {
  const points = envelopePoints(event.duration);
  const noteGain = context.createGain();
  noteGain.connect(output);
  for (const point of points) {
    const value = Math.max(0.0001, point.value * event.gain);
    if (point.time === 0) noteGain.gain.setValueAtTime(value, at);
    else noteGain.gain.exponentialRampToValueAtTime(value, at + point.time);
  }
  const stopAt = at + Math.max(...points.map((point) => point.time)) + RELEASE_TAIL_SECONDS;
  const frequency = mtof(event.midi);
  for (const partial of pianoPartials) {
    const oscillator = context.createOscillator();
    oscillator.type = 'sine';
    oscillator.frequency.value = frequency * partial.ratio;
    const partialGain = context.createGain();
    partialGain.gain.value = partial.gain;
    oscillator.connect(partialGain).connect(noteGain);
    oscillator.start(at);
    oscillator.stop(stopAt);
  }
};

export const createAudioEngine = (): AudioEngine => {
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  let timer: ReturnType<typeof setInterval> | null = null;

  let options: EngineOptions | null = null;
  let events: readonly PlaybackEvent[] = [];
  let passLength = 0; // seconds
  let playStartContextTime = 0;
  let eventIndex = 0;
  let cycle = 0;

  const ensureContext = (): AudioContext => {
    if (ctx !== null) return ctx;
    // Some WebKit builds (including Safari for a long time) only expose the vendor-prefixed constructor; the
    // DOM types assume AudioContext always exists, so its presence is re-checked at runtime regardless.
    const standard = window.AudioContext as typeof AudioContext | undefined;
    const Ctor = standard ?? window.webkitAudioContext;
    if (Ctor === undefined) throw new Error('Web Audio is not supported in this browser');
    ctx = new Ctor();
    return ctx;
  };

  const unlock = (): void => {
    const context = ensureContext();
    if (context.state === 'suspended') void context.resume();
  };

  const stopScheduling = (): void => {
    if (timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  };

  const scheduleWindow = (): void => {
    if (ctx === null || master === null || options === null) return;
    const context = ctx;
    const output = master;
    const windowEnd = context.currentTime - playStartContextTime + SCHEDULE_AHEAD_SECONDS;
    let event = events[eventIndex];
    while (event !== undefined) {
      const eventTime = event.time + cycle * passLength;
      if (eventTime >= windowEnd) return;
      scheduleNote(context, output, playStartContextTime + eventTime, event);
      eventIndex += 1;
      if (eventIndex >= events.length) {
        if (!options.loop) {
          stopScheduling();
          return;
        }
        eventIndex = 0;
        cycle += 1;
      }
      event = events[eventIndex];
    }
  };

  const play = (score: Score, playOptions: EngineOptions): void => {
    const context = ensureContext();
    if (context.state === 'suspended') void context.resume();
    master?.disconnect();
    master = context.createGain();
    master.gain.value = MASTER_GAIN;
    master.connect(context.destination);

    options = playOptions;
    events = eventsFor(score, playOptions);
    passLength = passLengthSeconds(score, playOptions);
    eventIndex = 0;
    cycle = 0;
    playStartContextTime = context.currentTime;

    stopScheduling();
    if (events.length === 0) return; // nothing sounds on this voice (e.g. it is a whole rest) – nothing to schedule
    scheduleWindow();
    timer = setInterval(scheduleWindow, LOOKAHEAD_INTERVAL_MS);
  };

  const pause = (): void => {
    stopScheduling();
    master?.disconnect();
    master = null;
    options = null;
  };

  const isPlaying = (): boolean => timer !== null;

  const currentQuarter = (): number | null => {
    if (ctx === null || options === null) return null;
    let elapsed = ctx.currentTime - playStartContextTime;
    if (passLength > 0) elapsed = options.loop ? elapsed % passLength : Math.min(elapsed, passLength);
    return options.start + elapsed * (options.tempo / 60);
  };

  return { unlock, play, pause, isPlaying, currentQuarter };
};
