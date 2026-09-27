# Hosting: own subdomain on the existing server, like wumble

Date: 2026-09-27 · Status: accepted

## Context

A server with Caddy and Docker already hosts [wumble](https://github.com/bartfastiel/wumble) as its own subdomain,
deployed by SSH from GitHub Actions with production and PR previews under separate paths. Vomblatt has the same
shape: a small static site, no backend of its own (yet), used from a phone.

## Decision

Reuse the same pattern: `vomblatt.wer-ist-daniel-schwarz.de` as its own Caddy site block, files served read-only from
`/mnt/frag-daniel/vomblatt`, deployment via SSH (`.github/workflows/deploy.yml`, scripts copied from wumble
unchanged). Production and PR previews (`pr-<nr>/`) live under separate paths.

## Consequences

No new DNS entry, no new hosting bill, no new deployment mechanism to build or debug. The Caddy config for the
subdomain is added to the server's infra repo separately from this one.

## Rejected

_A separate host or a static hosting service._ Another account, another set of credentials, another place to keep
current – for a page that will stay a few hundred kilobytes.
