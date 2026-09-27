// The one screen of the app: photograph a sheet of music (or load the example), see it re-rendered, play it
// back. Thin DOM glue over the pure modules (src/score, src/audio, src/render) and the WebAudio/SVG glue next to
// this file (audio-engine.ts, score-view.ts) – state and wiring only, no logic worth unit-testing on its own.
import { createAudioEngine } from './audio-engine';
import { createScoreView } from './score-view';
import { loadLastVoice, saveLastVoice } from './storage';
import { createTapTempo } from '../audio/tap-tempo';
import { formatBuildStamp } from '../format/build-info';
import { followScrollLeft } from '../render/follow-scroll';
import { recognize } from '../scan/recognize';
import { demoScore } from '../score/demo';
import { VOICES } from '../score/score';
import type { Score, Voice } from '../score/score';

const VOICE_LABEL: Readonly<Record<Voice, string>> = { S: 'Sopran', A: 'Alt', T: 'Tenor', B: 'Bass' };
const OTHER_VOICES_GAIN = 0.25;
const MIN_TEMPO = 30; // quarter notes per minute
const MAX_TEMPO = 200;
const TEMPO_STEP = 1;
const DEFAULT_TEMPO = 80; // quarter notes per minute, when the score itself gives none
const SCROLL_FOLLOW_EPSILON = 1.5; // px; a scroll further than this from where we last put it is the user's own

const SCREEN_HTML = `
  <main>
    <header class="app-header"><h1>Vomblatt</h1></header>

    <section class="screen" id="start-screen">
      <label class="photo-button">
        <input type="file" accept="image/*" capture="environment" id="photo-input" />
        Notenblatt fotografieren
      </label>
      <button type="button" class="link-button" id="demo-button">Beispiel anhören</button>
      <p class="hint" id="error-hint" role="alert" hidden></p>
    </section>

    <section class="screen" id="loading-screen" hidden>
      <p>Lese Noten …</p>
    </section>

    <section class="screen screen--score" id="score-screen" hidden>
      <p class="hint" id="stub-hint" hidden>Erkennung noch im Aufbau – du hörst ein Beispiel.</p>
      <div class="score-container" id="score-container"></div>

      <div class="voice-picker" id="voice-picker"></div>

      <label class="toggle">
        <input type="checkbox" id="others-toggle" />
        Andere Stimmen leise dazu
      </label>

      <button type="button" class="play-button" id="play-button">Abspielen</button>

      <div class="tempo-control" id="tempo-control">
        <button type="button" class="tempo-step-button" id="tempo-down" aria-label="Langsamer">−</button>
        <output class="tempo-value" id="tempo-value">♩ = ${String(DEFAULT_TEMPO)}</output>
        <button type="button" class="tempo-step-button" id="tempo-up" aria-label="Schneller">+</button>
        <button type="button" class="tap-tempo-button" id="tap-tempo-button">Tippen</button>
        <input
          type="range"
          id="tempo-slider"
          min="${String(MIN_TEMPO)}"
          max="${String(MAX_TEMPO)}"
          step="${String(TEMPO_STEP)}"
          value="${String(DEFAULT_TEMPO)}"
          aria-label="Tempo in Vierteln pro Minute"
        />
      </div>

      <label class="toggle">
        <input type="checkbox" id="loop-toggle" />
        Schleife
      </label>
      <p class="hint-small">Wiederholt ab der Startposition bis zum Ende.</p>

      <button type="button" class="secondary-button" id="new-photo-button">Neues Foto</button>
    </section>
  </main>
  <footer class="build-info" id="build-info"></footer>
`;

// Only ever called right after setting innerHTML from SCREEN_HTML above, so a missing element is a programming
// error in that template, not something to handle gracefully.
const mustFind = <T>(value: T | null, selector: string): T => {
  if (value === null) throw new Error(`missing element: ${selector}`);
  return value;
};

export const startApp = (root: HTMLElement): void => {
  root.innerHTML = SCREEN_HTML;

  mustFind(root.querySelector<HTMLElement>('#build-info'), '#build-info').textContent = formatBuildStamp(
    __BUILD_TIME__,
    __BUILD_SHA__,
  );

  const startScreen = mustFind(root.querySelector<HTMLElement>('#start-screen'), '#start-screen');
  const loadingScreen = mustFind(root.querySelector<HTMLElement>('#loading-screen'), '#loading-screen');
  const scoreScreen = mustFind(root.querySelector<HTMLElement>('#score-screen'), '#score-screen');
  const photoInput = mustFind(root.querySelector<HTMLInputElement>('#photo-input'), '#photo-input');
  const demoButton = mustFind(root.querySelector<HTMLButtonElement>('#demo-button'), '#demo-button');
  const stubHint = mustFind(root.querySelector<HTMLElement>('#stub-hint'), '#stub-hint');
  const errorHint = mustFind(root.querySelector<HTMLElement>('#error-hint'), '#error-hint');
  const scoreContainer = mustFind(root.querySelector<HTMLElement>('#score-container'), '#score-container');
  const voicePicker = mustFind(root.querySelector<HTMLElement>('#voice-picker'), '#voice-picker');
  const othersToggle = mustFind(root.querySelector<HTMLInputElement>('#others-toggle'), '#others-toggle');
  const playButton = mustFind(root.querySelector<HTMLButtonElement>('#play-button'), '#play-button');
  const tempoSlider = mustFind(root.querySelector<HTMLInputElement>('#tempo-slider'), '#tempo-slider');
  const tempoValue = mustFind(root.querySelector<HTMLOutputElement>('#tempo-value'), '#tempo-value');
  const tempoDownButton = mustFind(root.querySelector<HTMLButtonElement>('#tempo-down'), '#tempo-down');
  const tempoUpButton = mustFind(root.querySelector<HTMLButtonElement>('#tempo-up'), '#tempo-up');
  const tapTempoButton = mustFind(root.querySelector<HTMLButtonElement>('#tap-tempo-button'), '#tap-tempo-button');
  const loopToggle = mustFind(root.querySelector<HTMLInputElement>('#loop-toggle'), '#loop-toggle');
  const newPhotoButton = mustFind(root.querySelector<HTMLButtonElement>('#new-photo-button'), '#new-photo-button');

  const engine = createAudioEngine();
  const scoreView = createScoreView();
  const tapTempo = createTapTempo();
  scoreContainer.append(scoreView.svg);

  let score: Score | null = null;
  let voice: Voice = 'S';
  let startQuarter = 0;
  let playing = false;
  let cursorFrame: number | null = null;
  let tempo = DEFAULT_TEMPO;
  let followCursor = true; // false once the user has scrolled the score container by hand while playing
  let lastAutoScrollLeft = 0; // what we last set scoreContainer.scrollLeft to, to tell our own scrolling from theirs

  const playbackOptions = () => ({
    voice,
    othersGain: othersToggle.checked ? OTHER_VOICES_GAIN : 0,
    tempo,
    start: startQuarter,
    loop: loopToggle.checked,
  });

  const stopCursorLoop = (): void => {
    if (cursorFrame !== null) {
      cancelAnimationFrame(cursorFrame);
      cursorFrame = null;
    }
  };

  // Keeps the cursor centred in the score container, except at either end of the content where centring it
  // would scroll past the edge (src/render/follow-scroll.ts has the maths). Marks the result as our own doing
  // so the 'scroll' listener below does not mistake it for the user scrolling by hand.
  const updateScroll = (quarter: number): void => {
    const target = followScrollLeft(
      scoreView.xForQuarter(quarter),
      scoreContainer.clientWidth,
      scoreContainer.scrollWidth,
    );
    lastAutoScrollLeft = target;
    scoreContainer.scrollLeft = target;
  };

  // Called whenever playback (re)starts, i.e. exactly the moments after which the customer wants following
  // resumed: pressing "Abspielen" and any restart of an already-running playback (tempo/voice/loop change, or
  // tapping a new start position while playing – restartIfPlaying below covers all of those).
  const resumeFollowing = (): void => {
    followCursor = true;
    updateScroll(startQuarter);
  };

  const tickCursor = (): void => {
    if (!engine.isPlaying()) {
      playing = false;
      playButton.textContent = 'Abspielen';
      scoreView.setCursor(startQuarter);
      stopCursorLoop();
      return;
    }
    const quarter = engine.currentQuarter();
    scoreView.setCursor(quarter);
    if (followCursor && quarter !== null) updateScroll(quarter);
    cursorFrame = requestAnimationFrame(tickCursor);
  };

  const restartIfPlaying = (): void => {
    if (!playing || score === null) return;
    startQuarter = engine.currentQuarter() ?? startQuarter;
    engine.play(score, playbackOptions());
    resumeFollowing();
  };

  // A scroll that does not match what we ourselves just set must be the user dragging the score by hand;
  // playback keeps running but stops being followed until it is (re)started or a new start position is tapped.
  scoreContainer.addEventListener('scroll', () => {
    if (Math.abs(scoreContainer.scrollLeft - lastAutoScrollLeft) > SCROLL_FOLLOW_EPSILON) followCursor = false;
  });

  const setTempo = (value: number): void => {
    tempo = Math.min(MAX_TEMPO, Math.max(MIN_TEMPO, Math.round(value)));
    tempoSlider.value = String(tempo);
    tempoValue.textContent = `♩ = ${String(tempo)}`;
    restartIfPlaying();
  };

  const renderVoicePicker = (present: readonly Voice[]): void => {
    voicePicker.replaceChildren(
      ...present.map((candidate) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = VOICE_LABEL[candidate];
        button.className = 'voice-button' + (candidate === voice ? ' voice-button--chosen' : '');
        button.addEventListener('click', () => {
          if (candidate === voice || score === null) return;
          voice = candidate;
          saveLastVoice(voice);
          renderVoicePicker(present);
          scoreView.render(score, voice);
          scoreView.setCursor(startQuarter);
          restartIfPlaying();
        });
        return button;
      }),
    );
  };

  const showScore = (result: Score): void => {
    engine.pause();
    stopCursorLoop();
    score = result;
    const present = VOICES.filter((candidate) => result.voices[candidate] !== undefined);
    const remembered = loadLastVoice();
    voice = (remembered !== null && present.includes(remembered) ? remembered : present[0]) ?? 'S';
    startQuarter = 0;
    playing = false;
    playButton.textContent = 'Abspielen';
    stubHint.hidden = result !== demoScore;
    setTempo(result.tempo ?? DEFAULT_TEMPO);

    scoreView.render(result, voice);
    scoreView.setCursor(0);
    followCursor = true;
    lastAutoScrollLeft = 0;
    scoreContainer.scrollLeft = 0;
    scoreView.onTap((quarter) => {
      startQuarter = quarter;
      scoreView.setCursor(quarter);
      restartIfPlaying();
    });
    renderVoicePicker(present);

    loadingScreen.hidden = true;
    startScreen.hidden = true;
    scoreScreen.hidden = false;
  };

  photoInput.addEventListener('change', () => {
    const file = photoInput.files?.[0];
    if (file === undefined) return;
    startScreen.hidden = true;
    loadingScreen.hidden = false;
    errorHint.hidden = true;
    recognize(file)
      .then(showScore)
      .catch((error: unknown) => {
        // recognize() rejects with a German message meant for the user (e.g. no staff lines found)
        errorHint.textContent = error instanceof Error ? error.message : 'Die Erkennung ist fehlgeschlagen.';
        errorHint.hidden = false;
        loadingScreen.hidden = true;
        startScreen.hidden = false;
      });
  });

  demoButton.addEventListener('click', () => {
    showScore(demoScore);
  });

  playButton.addEventListener('click', () => {
    engine.unlock();
    if (score === null) return;
    if (playing) {
      engine.pause();
      playing = false;
      playButton.textContent = 'Abspielen';
      stopCursorLoop();
      scoreView.setCursor(startQuarter);
    } else {
      engine.play(score, playbackOptions());
      resumeFollowing();
      playing = true;
      playButton.textContent = 'Pause';
      stopCursorLoop();
      cursorFrame = requestAnimationFrame(tickCursor);
    }
  });

  othersToggle.addEventListener('change', restartIfPlaying);
  loopToggle.addEventListener('change', restartIfPlaying);
  tempoSlider.addEventListener('input', () => {
    setTempo(Number(tempoSlider.value));
  });
  tempoDownButton.addEventListener('click', () => {
    setTempo(tempo - TEMPO_STEP);
  });
  tempoUpButton.addEventListener('click', () => {
    setTempo(tempo + TEMPO_STEP);
  });
  tapTempoButton.addEventListener('click', () => {
    const tapped = tapTempo.tap();
    if (tapped !== null) setTempo(tapped);
  });

  newPhotoButton.addEventListener('click', () => {
    engine.pause();
    playing = false;
    stopCursorLoop();
    score = null;
    photoInput.value = '';
    scoreScreen.hidden = true;
    startScreen.hidden = false;
  });
};
