# No framework: plain TypeScript, Web Components once there is more than one view

Date: 2026-09-27 · Status: accepted

## Context

The app starts as one screen (take a photo, see it played back) and is expected to grow a few more (recognised
notation, playback controls, voice choice). It must load fast on a phone on a mobile connection and stay easy to
reason about without a build-time framework.

## Decision

No UI framework. The placeholder wires up plain DOM in `src/main.ts`; once there is more than one view, they become
custom elements (`vb-*`) the same way wumble structures its `wm-*` components, with state kept in small, testable
modules and logic in pure TypeScript functions below them. Zero runtime dependencies.

## Consequences

No framework migrations, no third-party security updates, small bundles. Templates and bindings are hand-written,
so views stay thin and logic moves into modules that Vitest can cover without a DOM.

## Rejected

_A rendering framework (React, Lit, Svelte, …)._ Adds a runtime dependency and a build step for a UI that is a
handful of screens with ordinary DOM elements, not a large interactive surface like wumble's playing field.
