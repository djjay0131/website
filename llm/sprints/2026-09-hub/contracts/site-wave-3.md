# Contract — `site`, Wave 3 (Phase 4 sharing)

Status: Issued
Date: 2026-10-03
Owner: Lead Architect
Stream: `site` (`site/**`, `firebase.json`)
Issue: `hub-004`
Branch: `feat/sharing`
Seams: `llm/sprints/2026-09-hub/contracts/phase-4-seams.md` (SEAM-S4, SEAM-S6)
Design: design doc §6 responsibility 4; ADR-0003 (React islands); roadmap §phase-4-sharing

## Purpose

Wire the two sharing rewrites and build the owner-only Shares island in the
**private** build. Nothing about sharing may appear in the public build.

## Scope

- `firebase.json` (rewrites only; the existing four rewrites and the three
  anthropic-fellow redirects stay byte-identical in effect)
- `site/src-private/**` (new page, island, lib)
- `site/package.json` / `site/package-lock.json` (React island dependencies)
- `site/astro.config.mjs` (React integration, **private branch only**)
- `site/scripts/**` only if a check must learn about the new route

Do NOT touch `gate/**` or `infra/**`; those are other streams.

## Requirements

1. **Rewrites (SEAM-S4).** Add to `firebase.json` `hosting.rewrites`:
   `/share/**` and `/s/**` → `hub-gate`, region `us-east1`. Both are prefix
   rewrites; `/share/**` carries POST/GET/DELETE and `/s/**` the public share
   view. Do not reorder or alter the existing `/p/**`, `/session`,
   `/session/end`, `/client-events` rewrites; keep `trailingSlash: true`.
2. **The Shares page is private-build only.** A new page under
   `site/src-private/pages/` (at `/p/shares/`). The public build's `srcDir` is
   `./src`, so the route cannot exist publicly by construction; prove it by
   build, not by assertion.
3. **React island (ADR-0003, SEAM-S6).** Add `@astrojs/react`, `react`,
   `react-dom` and mount the integration **inside the `isPrivate` branch of
   `astro.config.mjs` only**, so the public output ships no framework. The
   island:
   - calls `GET /share` same-origin with `credentials: "same-origin"`;
   - if `GET /share` is **403**, renders no mint/revoke controls at all (a
     non-owner member must not see them) — a short "only the owner manages
     shares" note is allowed;
   - if 200, renders the active-share list (`id`, `section`, `source`, `slug`,
     `created_by`, `expires_at`), a mint form (`section`, `source`, `slug`,
     `expires_in_days` 1–30) that `POST /share`s, shows the returned URL to
     copy, and retains the returned token in the browser session so that row can
     be revoked with `DELETE /share/{token}`;
   - offers a paste-a-token-or-link revoke for shares the owner saved, since
     `GET /share` deliberately returns no full token (gate ruling 2).
   - never logs a token; sends no token anywhere but `DELETE /share/{token}`.
4. **Owner detection is the API's, not the build's.** The page is static; the
   island decides by the `GET /share` status. The gate is the authority and
   enforces 403 regardless of what the browser renders.
5. **Chrome and nav.** Add a "Shares" entry to the private members' navigation
   in `site/src-private/layouts/PrivateBase.astro` so it appears on every
   `/p/**` page, without touching `Base.astro` or any shared component.
6. **No public traces.** `npm run check:no-private-in-public`,
   `check:publish-allowlist`, `check:private-links` and the existing
   `private-structure.test.ts` import rules all stay green. The island must not
   be reachable from `src/`; shared `src/components/*` must not import anything
   private.
7. **Tests (vitest).** Unit-test the island's pure logic (status→UI branch,
   request shapes, token retention) with injected `fetch`/`sessionStorage`
   doubles, mirroring `src-private/lib/signout.test.ts`. Add a
   `firebase.json` rewrite assertion to the existing structured tests.

## Evidence

`npm ci`; `npm test`; `npm run build:public`; `npm run build:private`;
`npm run check:no-private-in-public`; `npm run check:publish-allowlist`;
`npm run check:private-links`; `npm run check:smoke-routes`; governance
`--layout`. Record exact counts.

## Exit

Rewrites present; island renders in `dist-private` and is absent from
`dist-public`; owner controls gated on `GET /share` red→green; all checks green.
The owner's live mint/open/revoke (SEAM-S7) is a separate, owner-only step.
