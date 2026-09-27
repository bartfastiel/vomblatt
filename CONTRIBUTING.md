# Contributing

## Ten rules

1. No runtime dependencies. Dev dependencies only when they earn their place – pinned exactly.
2. English everywhere; text shown to users is German (the singers this app is for) but stays isolated so it can be
   found and changed in one place. Speaking names instead of comments – a comment explains why, never what.
3. Small files, one job per module. Pure functions below, thin UI above.
4. Logic is merged with its test. Every pure module in `src/` (outside `src/ui`) is covered by Vitest.
5. No `any`, no warnings, zero Sonar findings.
6. Every record in `docs/adr` names what was rejected – the rejected path is the part that gets forgotten.
7. Conventional Commits, small PRs; the description says what, why and how to verify.
8. Merging needs green checks, an up-to-date `main` and one approval; the preview is linked on the PR.
9. Decisions with reach get an ADR in `docs/adr` (date prefix, half a page).
10. Docs are short. What the code says is not repeated next to it.

## Workflow

`npm ci` (enables the git hooks) · `npm run dev` · `npm run check` before pushing · PR against `main`.
