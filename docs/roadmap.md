# Roadmap

Order is priority. Customer decisions of 2026-09-27.

1. **On-device recognition, fast (top priority).** Everything the browser can do, no network. First milestone:
   "Alle meine Entchen" photographed from a second phone's screen plays correctly.
2. **Player.** Voice S/A/T/B, others quietly on request, slower tempo, tap to set the start, loop, piano sound.
   Repeats and voltas: played straight through.
3. **Hymnal melodies** (Evangelisches Gesangbuch style, one staff, lyrics between the systems).
4. **Demanding choral scores** (SATB on two or four staves, octave-treble tenor clef, modern settings).
5. **Metre.** First and as fallback: every note evenly after the other. Then honour the time signature (4/4, 3/4, …)
   and bar lines for timing and bar numbers.
6. **AI fallback on click** ("Genauer lesen"), only when the user is not satisfied: the photo goes to a backend on the
   existing server (frag-daniel), which asks a vision model and returns a Score. Rate limits per IP and in total,
   both reset every hour. A short legal notice before the first upload (what is sent, to whom, that nothing is
   stored). Photos are not kept.
7. Later: a pure "ooh" voice sound as an option to the piano.

## Test material

Only generated fixtures in the repository (public-domain music engraved by our own tools, degraded by simulation).
Real-world photos from the web stay outside the repository and are used for local evaluation only.
