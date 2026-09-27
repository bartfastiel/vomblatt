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
];
