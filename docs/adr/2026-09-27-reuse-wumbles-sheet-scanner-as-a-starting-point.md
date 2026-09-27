# Reuse wumble's sheet scanner as the starting point for recognition

Date: 2026-09-27 · Status: accepted

## Context

Vomblatt's core feature – turning a photographed sheet of music into a melody – already exists in large part in
[wumble](https://github.com/bartfastiel/wumble)'s `src/scan` (binarisation, deskewing, staff-line detection,
notehead detection, pitch-from-staff, rasterising a photo into a song). Vomblatt's scope is a single melody line
without wumble's harmonic field, so the scanner cannot simply be imported as a dependency – there is no shared
package, and wumble stays a separate, unrelated app.

## Decision

When recognition work starts, `src/scan/*` and its tests are copied from wumble into this repository as the starting
point and adapted (SATB voice selection, tempo/time signature/ties/triplets per `docs/musician-notes.md`, dropping
whatever wumble's scanner does that vomblatt does not need). This is a note of intent only – no scanner code is part
of this scaffold.

## Consequences

Recognition work starts from tested, working code instead of a blank page, at the cost of a one-time copy instead of
an ongoing shared dependency; the two codebases are free to diverge afterwards.

## Rejected

_Building recognition from scratch._ Would re-solve problems (deskewing a phone photo, separating noteheads from
staff lines) that wumble's scanner already solves and tests.

_A shared npm package between wumble and vomblatt._ Two small hobby projects with different owners of the code going
forward; a shared package adds versioning and release overhead neither needs yet.
