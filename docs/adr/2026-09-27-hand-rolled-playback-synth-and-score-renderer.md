# Hand-rolled Web Audio synth and SVG score renderer, no audio/notation library

Date: 2026-09-27 · Status: accepted

## Context

Playback needs a piano-ish sound (not a raw sine, per `docs/musician-notes.md`) with look-ahead scheduling, and the
re-rendered score needs noteheads, stems, bar lines and a moving cursor on one or two staves. Both problems have
well-known off-the-shelf solutions – but this repository has zero runtime dependencies (see the "no framework" ADR).

## Decision

Playback: a handful of detuned sine oscillators per note (`src/audio/timbre.ts`) with a short percussive gain
envelope, scheduled via `AudioContext` with a look-ahead timer. Notation: a small hand-written SVG renderer
(`src/render/layout.ts` for the pure pitch/time maths, `src/ui/score-view.ts` for the DOM/SVG glue) – noteheads as
positioned ellipses, stems and flags as lines, no attempt at full engraving (no ledger lines, no key signature
glyphs, triplets drawn like plain eighths). Good enough to show "this is roughly what was recognised", not a
publishing-quality renderer.

## Consequences

No new runtime dependency, no bundle-size or supply-chain surface added for either feature; both stay inside the
60 kB gzip budget (see `tools/size-budget.mjs`) with room to spare. The trade-off is a simpler renderer and a
simpler instrument than a dedicated library would give – acceptable because the goal is "recognisable and
correctable", not sheet-music engraving or a convincing piano sample.

## Rejected

_A notation library (VexFlow, OSMD, abcjs)._ Full engraving quality this app does not need, at tens to hundreds of
kilobytes gzip – would burn most or all of the size budget on the least essential feature.

_A synthesis library (Tone.js) or sampled piano (soundfont/audio files)._ Tone.js is a sizeable runtime dependency
for what is, here, a look-ahead scheduler and a few oscillators – both easy to write directly against Web Audio.
Sampled audio needs shipping and loading real audio files, working against the "first sound in under 10 s, offline
after first load" requirement and the size budget.
