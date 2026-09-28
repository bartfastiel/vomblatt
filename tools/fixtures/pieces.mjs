// The fixture pieces: public-domain melodies (traditional songs) and short hymn-style melodies and four-part settings
// written for these tests. Each one is engraved by tools/render-fixtures.mjs and must be read back by recognition.

const ENTCHEN_LYRICS = [
  'Al-',
  '-le',
  'mei-',
  '-ne',
  'Ent-',
  '-chen',
  'schwim-',
  '-men',
  'auf',
  'dem',
  'See,',
  'schwim-',
  '-men',
  'auf',
  'dem',
  'See,',
  'Köpf-',
  '-chen',
  'in',
  'das',
  'Was-',
  '-ser,',
  'Schwänz-',
  '-chen',
  'in',
  'die',
  'Höh.',
];

// Syllables for the hymn-style melodies: a verse written for the fixtures, repeated as needed
const HYMN_LYRICS = (
  'Wir sin- gen dir mit Herz und Mund, dein Lob sei al- le Zeit be- kannt, so weit der Him- mel reicht und steht, ' +
  'so weit das Meer die Er- de trägt. Wir sin- gen dir mit Herz und Mund, dein Lob sei al- le Zeit be- kannt.'
)
  .split(' ')
  .map((syllable, i, all) => (all[i - 1]?.endsWith('-') ? `-${syllable}` : syllable));

// A four-part setting in G major written for the tests: eighth passing notes, C sharp, unisons (one head with two
// stems), whole notes at the end
const CHORALE = {
  S: '4g 4g 4a 4b | 4cc 4b 2a | 4b 8aL 8gJ 4a 4b | 4a 4a 2g | 4b 4b 4cc# 4dd | 4ee 4dd 2cc# | 4dd 4b 4a 4g | 1g',
  A: '4d 4e 4f# 4g | 4g 4g 2f# | 4g 4f# 4f# 4g | 4e 4f# 2d | 4g 4g 4g 4f# | 4g 4f# 2e | 4f# 4g 4f# 4g | 1d',
  T: '4B 4c 4d 4d | 4e 4d 2d | 4d 8cL 8BJ 4A 4d | 4c 4c 2B | 4d 4e 4e 4d | 4c 4d 2A | 4A 4d 4d 4B | 1B',
  B: '4G 4C 4D 4GG | 4C 4GG 2D | 4G 4D 4D 4G | 4C 4D 2GG | 4G 4E 4A 4D | 4C 4D 2A | 4D 4GG 4D 4E | 1GG',
};

export const PIECES = [
  {
    // "Alle meine Entchen", traditional German children's song, as printed on countless song sheets
    id: 'entchen',
    layout: 'melody',
    key: '',
    keyFifths: 0,
    meter: [4, 4],
    font: 'Leipzig',
    pageWidth: 1300,
    scale: 100,
    lyrics: ENTCHEN_LYRICS,
    voices: {
      S: '4c 4d 4e 4f | 2g 2g | 4a 4a 4a 4a | 1g | 4a 4a 4a 4a | 1g | 4f 4f 4f 4f | 2e 2e | 4d 4d 4d 4d | 1c',
    },
  },
  {
    // Hymn-style melody in G major, 3/4 with a pickup: dotted notes, beamed and flagged eighths, a quarter rest,
    // a sharp and a natural within one bar, F natural against the key signature
    id: 'hymn-g-major',
    layout: 'melody',
    key: 'f#',
    keyFifths: 1,
    meter: [3, 4],
    font: 'Leipzig',
    pageWidth: 1250,
    scale: 90,
    lyrics: HYMN_LYRICS,
    voices: {
      S:
        '4d | 4g 4.a 8b | 4cc 4b 4a | 2g 4r | 4b 8ccL 8ddJ 4ee | 8ddL 8cc#J 4dd 4ccn | 2.b | 4a 8bL 8aJ 4g | ' +
        '4f# 4e 4d | 4g 4fn 4g | 2.g | 8d 8e 4f# 4g | 2.g',
    },
  },
  {
    // Hymn-style melody in F major, 4/4: half, quarter and eighth rests, sixteenths, a flag, a whole note, E flat and
    // naturals within a bar
    id: 'hymn-f-major',
    layout: 'melody',
    key: 'b-',
    keyFifths: -1,
    meter: [4, 4],
    font: 'Bravura',
    pageWidth: 1350,
    scale: 85,
    lyrics: HYMN_LYRICS,
    voices: {
      S:
        '2f 4g 4a | 4b- 4a 2g | 4a 8gL 8fJ 4e 4r | 2f 2r | 4cc 4bn 4a 4g | 4a 4b- 2cc | ' +
        '4dd 16ccL 16b- 8aJ 4g 4f | 1f | 8r 8f 4f 4a 4cc | 4.dd 8cc 4b- 4a | 2g 2r | 4e- 4f 4g 4en | 1f',
    },
  },
  {
    // Chorale on two staves: soprano and alto on the treble staff (stems up / down), tenor and bass on the bass staff
    id: 'chorale-satb2',
    layout: 'satb2',
    key: 'f#',
    keyFifths: 1,
    meter: [4, 4],
    font: 'Leipzig',
    pageWidth: 1300,
    scale: 85,
    lyrics: HYMN_LYRICS,
    voices: CHORALE,
  },
  {
    // The same chorale in open score: four staves, the tenor in the octave treble clef
    id: 'chorale-satb4',
    layout: 'satb4',
    key: 'f#',
    keyFifths: 1,
    meter: [4, 4],
    font: 'Bravura',
    pageWidth: 1500,
    scale: 75,
    lyrics: HYMN_LYRICS,
    voices: CHORALE,
  },
  {
    // "Alle meine Entchen" as the popular song sheets print it: a title, eighths beamed in fours, two systems, small
    // on the page – what people show on a phone to be photographed
    id: 'entchen-sheet',
    title: 'Alle meine Entchen',
    layout: 'melody',
    key: '',
    keyFifths: 0,
    meter: [4, 4],
    font: 'Leipzig',
    pageWidth: 1400,
    scale: 58,
    lyrics: ENTCHEN_LYRICS,
    options: { header: 'auto' },
    voices: {
      S: '8cL 8d 8e 8fJ 4g 4g | 8aL 8a 8a 8aJ 2g | 8aL 8a 8a 8aJ 2g | 8fL 8f 8f 8fJ 4e 4e | 8dL 8d 8d 8dJ 2c',
    },
  },
  {
    // "Alle meine Entchen" as a lead sheet on a web page: a tempo mark, a repeat, quarters and halves, the whole note
    // C4 on a ledger line at the very end, two bars per system
    id: 'entchen-leadsheet',
    title: 'Alle meine Entchen',
    tempo: 140,
    layout: 'melody',
    key: '',
    keyFifths: 0,
    meter: [4, 4],
    font: 'Bravura',
    pageWidth: 950,
    scale: 90,
    lyrics: ENTCHEN_LYRICS,
    barlines: { 1: '!|:', 3: ':|!' },
    options: { header: 'auto' },
    voices: {
      S: '4c 4d 4e 4f | 2g 2g | 4a 4a 4a 4a | 1g | 4f 4f 4f 4f | 2e 2e | 4g 4g 4g 4g | 1c',
    },
  },
  {
    // A hymn-style melody in B flat major as a spiral-bound songbook prints it, written for the tests: two flats,
    // half notes in the spaces, eighths with flags after eighth rests, quarter rests, a tie over the bar line, a
    // dotted half, whole notes, a double bar in the middle of a system, chord names above, three verses below
    id: 'songbook-b-flat',
    layout: 'hymnal',
    key: 'b-e-',
    keyFifths: -2,
    meter: [4, 4],
    font: 'Leland',
    pageWidth: 1200,
    scale: 80,
    barlines: { 7: '||' },
    verses: [HYMN_LYRICS, HYMN_LYRICS.slice(8), HYMN_LYRICS.slice(16)],
    chords: [
      'B-',
      'B-',
      'B-',
      'E-',
      'E-',
      'E-',
      'F',
      'F',
      'Gm',
      'Gm',
      'E-',
      'C',
      'F',
      'F',
      'B-',
      'E-',
      'B-',
      'F',
      'F',
      'F',
      'F',
      'F',
      'F',
      'F',
      'F',
      'B-',
      'B-',
      'B-',
      'B-',
      'B-',
      'B-',
      'B-',
    ],
    voices: {
      S:
        '2dd 4b- 4b- | 2b- 4g 4g | 2f 2a | 2b- 4r 4d | 2g 2e- | 2d [2c | 4c] 4r 2B- | 1e- | ' +
        '2d 8r 8d 8e- 8f | 4f 2g 4r | 2a 8r 8a 8b- 8cc | 2.b- 4r | 1b-',
    },
  },
];
