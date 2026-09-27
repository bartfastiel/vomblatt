# Vomblatt

"Vom Blatt singen" – for the choir singer who does not get a melody: open the page on your phone, photograph the
sheet of music, and the app plays it back.

[![CI](https://github.com/bartfastiel/vomblatt/actions/workflows/ci.yml/badge.svg)](https://github.com/bartfastiel/vomblatt/actions/workflows/ci.yml)
[![License](https://img.shields.io/github/license/bartfastiel/vomblatt)](LICENSE)
![Node](https://img.shields.io/badge/node-24-339933?logo=node.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![Vitest](https://img.shields.io/badge/Vitest-6E9F18?logo=vitest&logoColor=white)
![Playwright](https://img.shields.io/badge/Playwright-2EAD33?logo=playwright&logoColor=white)
[![Dependabot](https://img.shields.io/badge/Dependabot-active-025E8C?logo=dependabot&logoColor=white)](.github/dependabot.yml)

## State

Scaffold only. The app currently shows one button, "Notenblatt fotografieren" (photograph a sheet of music); after a
photo is taken it is shown back with a note that recognition is still to come. The real feature – turning the photo
into a melody the phone can sing – follows in later PRs, together with its own ADRs.

## Development

Node 24, `npm ci`, then:

| Script                      | Purpose                                                  |
| --------------------------- | -------------------------------------------------------- |
| `npm run dev`               | Dev server (Vite)                                        |
| `npm run build` / `preview` | Production build to `dist/` and a local preview of it    |
| `npm run lint` / `lint:fix` | ESLint (typescript-eslint strict, SonarJS)               |
| `npm run format`            | Prettier                                                 |
| `npm run typecheck`         | `tsc --noEmit`                                           |
| `npm test` / `test:watch`   | Vitest with coverage (threshold 90 % outside `src/ui`)   |
| `npm run e2e`               | Playwright (Chromium, WebKit) against a production build |
| `npm run size`              | Size budget: `dist/assets/*.js` together ≤ 60 kB gzip    |
| `npm run check`             | lint + typecheck + test + build + size                   |

Git hooks (`.githooks/`, enabled by `npm ci`): lint, typecheck and unit tests before each commit; commit messages
follow [Conventional Commits](https://www.conventionalcommits.org/) (`feat|fix|docs|test|refactor|chore|ci(scope)?: …`).

## Quality

Logic lives in pure TypeScript modules without the DOM and is covered by Vitest; the UI is thin and, once it does
more than the placeholder, checked end-to-end with Playwright in Chromium and WebKit. TypeScript strict, ESLint with
Sonar rules and Prettier run in git hooks and in the pipeline. Every PR is built, tested, checked against a size
budget and deployed as a preview; merging needs green checks, an up-to-date `main` and one approval. Dependabot keeps
the dev dependencies current – there are none at runtime. Decisions are ADRs in [docs/adr](docs/adr), the rules are
in [CONTRIBUTING.md](CONTRIBUTING.md).

## Deployment

Every push to `main` puts `dist/` on the server as production, served directly under its host. Every pull request
gets a preview `pr-<nr>/` (link in the PR comment and as an environment) that disappears when the PR is closed.
Production and previews live under separate paths.
