# Contract — `site`, Wave 0b (private by default)

Status: Executed
Issued: 2026-10-02
Owner: Lead Architect
Stream: `site`
Issue: #46 (hub-008)
Branch: `feat/private-by-default`
Seams: `llm/sprints/2026-09-hub/contracts/private-by-default-seams.md`
Decision: D8; ADR-0016

## Purpose

Implement owner decision D8: an item is public only when **both** its manifest
says `visibility: public` **and** the hub's committed publish allowlist names its
`(source, slug)`. Before this wave, `cv/anthropic-fellow` was served publicly on
every origin because its manifest said `public` (STATE A-6). This is the change
that makes the hub, not the satellite, the authority.

## Scope — paths this stream may touch

- `site/publish-allowlist.json` (new)
- `site/src/lib/hub-content.mjs`, `site/src/lib/frame-content.mjs`
- `site/src/content.config.ts` (the one collection loader, shared by both outputs)
- `site/src/pages/**`, `site/src-private/pages/**` (visibility consumers only)
- `site/scripts/public-build.mjs`, `private-build.mjs`, `stage-public-assets.mjs`,
  `check-no-private-in-public.mjs`, `check-publish-allowlist.mjs` (new)
- `site/package.json` (script name only)
- `firebase.json` (the private item's historical-URL redirect)
- Tests beside the above.

## Must NOT touch

- `contract/manifest.schema.json` (no schema change, SEAM-B7).
- `site/src/lib/cv-data.ts`, `bib.ts`, `md.ts` (CV rendering unchanged).
- The private bucket, the gate, Terraform.

## Requirements

1. **SEAM-B1/B2.** `publish-allowlist.json` is committed and is the only way to
   publish. `effectiveVisibility()` in `hub-content.mjs` is the single
   computation; no consumer reads `item.visibility` for a public decision.

2. **SEAM-B4.** In the public build the content collection stores only
   effectively-public items; the private build stores every item and renders
   public and private alike. The private build's paid payload is unchanged except
   that `format: data` items are not staged or framed.

3. **SEAM-B3.** The CV variant list and its routes are filtered by effective
   visibility, so the variant defined inside the shared `cv-data` payload cannot
   leak through the directory listing. `pdfs/` and `cv/` emit the three public
   variants only. The Skeptic Verifier's job is to show the leak check catches a
   planted marker.

4. **SEAM-B5.** `check-publish-allowlist.mjs` fails on condition A (an allowlist
   entry naming a manifest-private item) in every mode, and on condition B (a
   stale entry, source present, slug gone) in `pr` mode only; `deploy` mode warns
   and continues. Wire it into both build jobs with the mode chosen from the
   event.

5. **SEAM-B6.** The leak check's private set is every non-allowlisted item. A
   source name shorter than 4 characters is not used as a bare bounded needle
   ("cv" occurs in every `/cv/…` link); its qualified-id, route and payload-path
   needles still apply.

6. **Historical URL.** `/pdfs/anthropic-fellow.pdf` and `/cv/anthropic-fellow`
   are never 200. Firebase Hosting redirects them to `/signin/`; the public
   build emits neither, so Pages 404s them (recorded residual until Phase 6).

## Evidence required (all run locally, 2026-10-02)

- `npm test` — 291 passed, 1 skipped.
- `npm run build:public` — 26 pages, no `anthropic-fellow` in any path or byte,
  absent from `sitemap-0.xml`, `cv/index.html` lists three variants.
- `npm run check:no-private-in-public` — PASS, 4 effectively-private items.
- `npm run check:publish-allowlist` — PASS, 14 entries, 0 conflicts, 0 stale.
- `npm run build:private` — 9 pages, receipt `privateItemCount: 4`,
  `renderedItemCount: 8`.
- `npm run check:private-links`, `npm run contrast`, `demo:leak-check` — PASS.
- `governance-checks --layout` — 4 of 4.

## Exit

Merged only after the adversarial round (Red Team, Dissenter, Skeptic Verifier),
the Security Tester gate and Chief Reviewer for this wave, and live verification
on both hosts. This contract records the implementation; it does not by itself
authorise merge.
