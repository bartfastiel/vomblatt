// A tiny subset of Humdrum **kern for the fixture pieces: every voice is a string of kern tokens with `|` between the
// bars. From it come both the kern file that Verovio engraves and the Score that recognition is expected to read.
//
// Token: [tie start] duration dots pitch accidentals [tie end or continue] [L|J beam start/end], e.g. `4.cc#`, `[2g`,
// `8eL`, `4r`. Durations: 1 whole … 16 sixteenth, 12 triplet eighth. Pitch: c = C4, cc = C5, C = C3, CC = C2.

const TOKEN = /^(\[?)(\d+)(\.*)([a-gA-G]+|r)([#n-]*)([\]_]?)([LJ]*)$/;
const LETTERS = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };

export const parseToken = (token) => {
  const match = TOKEN.exec(token);
  if (match === null) throw new Error(`not a kern token: ${token}`);
  const [, tieStart, number, dots, pitch, accidentals, tieEnd] = match;
  const duration = (4 / Number(number)) * (2 - 1 / 2 ** dots.length); // each dot adds half of the previous
  let midi = null;
  if (pitch !== 'r') {
    const letter = pitch.charAt(0).toLowerCase();
    const lower = pitch.charAt(0) === letter;
    const octave = lower ? 3 + pitch.length : 4 - pitch.length;
    const ALTERATION = { '#': 1, '-': -1, n: 0 };
    const alter = [...accidentals].reduce((sum, a) => sum + ALTERATION[a], 0);
    midi = 12 * (octave + 1) + LETTERS[letter] + alter;
  }
  return { token, duration, midi, tieStart: tieStart === '[', tieEnd: tieEnd === ']', tieMiddle: tieEnd === '_' };
};

// Bars of events with start times; a first bar shorter than `beatsPerBar` is the pickup, bar 0
export const parseVoice = (text, beatsPerBar) => {
  const bars = text
    .split('|')
    .map((bar) => bar.trim())
    .filter((bar) => bar.length > 0)
    .map((bar) => bar.split(/\s+/).map(parseToken));
  const firstLength = bars[0].reduce((sum, e) => sum + e.duration, 0);
  const pickup = firstLength < beatsPerBar - 1e-6;
  let time = 0;
  return bars.map((events, i) => ({
    number: pickup ? i : i + 1,
    events: events.map((event) => {
      const placed = { ...event, start: time };
      time += event.duration;
      return placed;
    }),
  }));
};

const round = (value) => Math.round(value * 1e6) / 1e6;

// The Score notes of a voice: tied notes become one
export const scoreNotes = (bars) => {
  const notes = [];
  for (const bar of bars) {
    for (const event of bar.events) {
      const previous = notes[notes.length - 1];
      if ((event.tieEnd || event.tieMiddle) && previous !== undefined && previous.midi === event.midi) {
        notes[notes.length - 1] = { ...previous, duration: round(previous.duration + event.duration) };
        continue;
      }
      notes.push({ midi: event.midi, start: round(event.start), duration: round(event.duration), bar: bar.number });
    }
  }
  return notes;
};

// All voices side by side, one kern record per onset; `columns` lists the voice of each kern column (or 'text')
export const kernBody = (columns, parsed, lyrics) => {
  const voices = columns.filter((c) => c !== 'text');
  const barCount = parsed[voices[0]].length;
  const lines = [];
  let syllable = 0;
  const melody = voices.includes('S') ? 'S' : voices[0];
  for (let b = 0; b < barCount; b++) {
    const onsets = new Set();
    for (const v of voices) for (const e of parsed[v][b].events) onsets.add(round(e.start));
    for (const onset of [...onsets].sort((x, y) => x - y)) {
      const fields = columns.map((c) => {
        const voice = c === 'text' ? melody : c;
        const event = parsed[voice][b].events.find((e) => round(e.start) === onset);
        if (c !== 'text') return event === undefined ? '.' : event.token;
        const sung = event !== undefined && event.midi !== null && !event.tieEnd && !event.tieMiddle;
        if (!sung || lyrics === undefined || syllable >= lyrics.length) return '.';
        return lyrics[syllable++];
      });
      lines.push(fields.join('\t'));
    }
    const isLast = b === barCount - 1;
    lines.push(columns.map(() => (isLast ? '==' : `=${String(b + 1)}`)).join('\t'));
  }
  return lines;
};
