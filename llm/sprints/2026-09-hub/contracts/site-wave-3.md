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

## Addendum — the share-servable document (`_doc/`), 2026-10-03

The Dissenter's Wave 3 D1 found that a share serving the member frame
`<section>/<source>/<slug>/index.html` is broken and leaks: the frame carries the
members' nav (every private item title) and absolute `/p/…` links. SEAM-S1 is
amended so the share prefix is `<section>/<source>/<slug>/_doc/`. The `site`
stream stages that namespace; the `gate` stream serves it.

8. **Stage `_doc/` for every effectively-private item.** Add an item-scoped
   staging plan (do not change `stagingPlanFor`'s public behaviour) that, for a
   private item, copies into `<section>/<source>/<slug>/_doc/`:
   - the item's own document (`path`) **under its own filename** (do NOT rename
     it: a `pdf` renamed to `index.html` would be served as HTML);
   - every non-document file (assets: css/js/images/fonts, and any
     non-`.html/.htm` file) from the document's containing directory, preserving
     relative structure;
   - a document declared by **another** item of the same source is excluded, so
     one token reaches one item. A prefix-root item stages its whole subtree
     except sibling-declared documents. Record the residual: a withdrawn item's
     shared non-document asset may still travel (C28).
   `_doc` is a reserved hub segment (SEAM-S1); the build must still refuse a
   manifest whose `source`/`slug` is `_doc`.
8b. **The Shares page supplies `entry`.** The page passes its effectively-private
   items' `{section, source, slug, entry, title}` (entry = `basename(path)`) to
   the island; the mint form selects a real item and `POST /share`s
   `{section, source, slug, entry, expires_in_days}`. A free-text fallback may
   remain but must send an `entry`.
9. **Keep the member frame unchanged.** `<section>/<source>/<slug>/index.html`
   and `_payload/<source>/…` remain for members exactly as they are. The new
   `_doc/` tree is additive.
10. **`check:private-links` must treat `_doc/**` as satellite bytes**, the way it
    treats `_payload/**` (no off-origin sub-resource, no base escape inside the
    tree), and stay green.
11. **Tests:** unit-test the item-scoped plan (sibling-declared documents
    excluded; entry kept under its basename; assets kept; a prefix-root single
    item keeps its whole site) against the phd fixture (`site/committee.html`,
    `site/index.html`, `site/internal.html`, `assets/style.css`), and assert the
    built `dist-private` contains
    `phd/phd-milestones/committee-dossier/_doc/index.html` plus its asset and
    does NOT contain a sibling document under that `_doc/`.

## Exit

Rewrites present (`/share`, `/share/**`, `/s/**`); island renders in
`dist-private` and is absent from `dist-public`; owner controls gated on
`GET /share` red→green; `_doc/` staged item-scoped and self-contained; all checks
green. The owner's live mint/open/revoke (SEAM-S7) is a separate, owner-only
step.
