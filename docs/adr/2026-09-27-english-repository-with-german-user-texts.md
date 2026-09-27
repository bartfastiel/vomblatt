# English repository, German user-facing texts

Date: 2026-09-27 · Status: accepted

## Context

The repository should be readable and extensible by anyone, like wumble's. The app's users are choir singers who
read German; its texts, error messages and labels must be German from the first screen.

## Decision

Everything in the repository is English: identifiers, comments, docs, ADRs, README, workflow and job names, commit
messages. Text shown to users is German. For the placeholder it sits directly in `src/main.ts` and `index.html`;
once there is more than a handful of strings it moves into a small i18n module (`src/i18n/`, following wumble's
`t(key, params)` pattern) rather than staying inline.

## Consequences

One language for readers and tooling; German user text in identifiers, comments or docs is a review finding. A
German string appearing directly in a component is acceptable only while the whole app has a handful of them.

## Rejected

_German throughout._ Most of the tooling ecosystem (and any future contributor) reads English, not German.

_English user interface._ The target audience is German-speaking choir singers rehearsing German sheet music; an
English button would be a worse experience for the one person this app is built for.
