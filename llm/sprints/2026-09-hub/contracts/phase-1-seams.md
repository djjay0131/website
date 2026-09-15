# Phase 1 Seams: site ↔ build and deploy

Status: Active
Last updated: 2026-09-15
Owner: Chief Architect (Lead Architect)

## Purpose

The interfaces between the Phase 1 `site` and `infra` specialists, stated once.
Both contracts cite this file and neither restates it. A seam is specified here
or nowhere: a specialist may not assume the other one defined it, and a
specialist that finds a seam wrong or insufficient reports it rather than
inventing one.

## Scope

Phase 1 — Foundation (issue #10) only.

## Seams

### SEAM-1 — Site build interface

- **Owner:** site. **Consumer:** infra (`build.yml`).
- `site/` is a self-contained npm project. From `site/`: `npm ci`, `npm test`,
  `npm run build`.
- `npm run build` writes the static site to `site/dist-public/`.
- Environment inputs, both optional:
  - `SITE_URL` — absolute origin, no trailing slash. Default `https://cusati.us`.
  - `SITE_BASE` — path base. Default `/`.
- The GitHub Pages build sets `SITE_URL=https://djjay0131.github.io` and
  `SITE_BASE=/website/`. The Firebase Hosting build uses the defaults.
- `npm test` needs no network. `npm run build` needs no credentials; it reads the
  CV data prepared by SEAM-2.
- Node: `site/package.json` `engines`; CI uses Node 22.

### SEAM-2 — CV data

- **Owner:** site. **Consumer:** infra.
- `site/scripts/fetch-data.sh`, run from `site/` with `GH_TOKEN` set, is the one
  place that downloads the CV data. It produces exactly what `build.yml`'s current
  inline "Fetch CV data and PDF" step produces, relative to `site/`.
- `build.yml` calls the script instead of inlining the download.
- `site/public/build-info.json` is written by CI (infra), not by the script.

### SEAM-3 — Hosting configuration

- **Owner:** site. **Consumer:** infra.
- `firebase.json` at the repository root: `hosting.public` is `site/dist-public`;
  the design doc §8 headers; **no `rewrites`** in Phase 1 (issue #10, K2); no
  Cloud Functions, SSR or framework backend (§12.4).
- No `.firebaserc`. The deploy passes the project explicitly (SEAM-4).

### SEAM-4 — Deploy configuration

- **Owner:** infra.
- GitHub Actions **variables** (not secrets — none of these is secret):
  `GCP_PROJECT_ID`, `GCP_WIF_PROVIDER` (full provider resource name),
  `GCP_DEPLOY_SA` (service account email), and optional `SITE_URL`.
- Terraform outputs the first three; the owner sets them at Checkpoint 2.
- The Firebase deploy runs only when `vars.GCP_PROJECT_ID` is non-empty. Until
  then it is skipped and the GitHub Pages path behaves exactly as today.

### SEAM-5 — GitHub Pages transition

- **Owner:** infra, building per SEAM-1.
- Until Phase 6, `build.yml` keeps building and deploying GitHub Pages (Pages
  variant of SEAM-1) and keeps its smoke test. The Firebase deploy uses a separate
  build with the defaults, from the same commit.
- The hourly `cv` fingerprint check reads `build-info.json` from `vars.SITE_URL`
  when set, else from `https://djjay0131.github.io/website`.

### SEAM-6 — Redirect map

- **Owner:** site. **Consumer:** Phase 6 (serving redirects).
- `site/redirects/github-pages.json`: an entry `{ "from": "/website/<path>",
  "to": "/<path>" }` for every route the GitHub Pages build serves. Generated from
  a route inventory and covered by a test. Recorded in Phase 1; not served until
  Phase 6.

## Assumptions

- GitHub Pages stays live and authoritative until Checkpoint 2 verifies Firebase
  Hosting (ADR-0001 Decision 4).
- The GCP project does not exist yet. Nothing in Phase 1 may need it in order to
  build, test or validate.

## Open Questions

- None.

## Cross-References

- `llm/governance/adr/0001-promote-website-to-hub-on-firebase-hosting.md`
- `llm/specs/2026-09-10-research-hub-design.md` §5, §8, §11, §12
- `llm/master-roadmap.md` §phase-1-foundation
- Issue #10
