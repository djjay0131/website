# ADR-0001: Promote `website` to the hub and move hosting to Firebase Hosting

Status: Accepted
Date: 2026-09-14

## Context

`website` is an Astro 6 static site deployed to GitHub Pages at
`djjay0131.github.io/website/` (`base: '/website/'`). It already consumes the
`cv` repository at build time — downloading its latest release and polling
hourly for changes — and already carries a research section.

The research hub needs a public face and a gated private area on one domain,
must be owned outright on personal accounts, and must outlive the PhD
(design doc §1). GitHub Pages serves static files only: it cannot gate
content, and it cannot route paths to a service. The design requires
Firebase Hosting rewrites to a Cloud Run gate (design doc §3, §8), which in
turn requires the Blaze plan.

Two owner answers bind this decision: the domain is `cusati.us` (§10 Q1), and
the system lives in a new GCP project (§10 Q2, intended id `cusati-hub`)
under the personal account `djjay0131@gmail.com`, not the institutional one,
so ownership survives graduation with no transfer. Design doc §9 leaves the
repository layout (§10 Q5) for this ADR to propose.

## Decision

1. **`website` becomes the hub.** No new repository.
2. **Hosting moves from GitHub Pages to Firebase Hosting** on `cusati.us`, in
   a new GCP project owned by the personal account. Every link in the
   ownership chain — GitHub, GCP project, billing, domain — is personal.
3. **Layout (Q5): the Astro application moves under `site/`.** `gate/`,
   `contract/`, `infra/`, `firebase.json` and `.github/workflows/` sit at the
   repository root beside it, with the `llm/` control plane, and `docs/` as
   the data plane once it has content. The move uses `git mv` so history
   follows, and it happens in Phase 1, not in the PR that records this ADR.
4. **GitHub Pages stays live and authoritative** until the Firebase deploy is
   verified at Checkpoint 2, and is retired in Phase 6 with redirects from
   `djjay0131.github.io/website`.

## Rationale

The design document already rejects a new repository (§2: "Do not start a
new hub repo. Evolve this one."), and evolving `website` keeps its history,
its `cv` integration, its tests and its research pages.

`site/` is the layout every downstream artifact already assumes:
`firebase.json` publishes `site/dist-public` (§8), the content-collection
schema lives at `site/src/content.config.ts` (§4), and the brief scopes the
site specialist to `site/**`. Choosing it requires no amendment to the
design-authority document. It also gives each Phase 1–3 specialist a disjoint
top-level directory as a file-contract boundary, and keeps the root from
mixing Node, Python (gate) and Terraform (infra) toolchains.

## Alternatives Considered

### New hub repository

A clean slate with no migration. Loses history, the working `cv` integration
and the existing pages, and is rejected outright by design doc §2.

### Stay on GitHub Pages with a separate private host

No hosting migration. But the private area would live on a second origin,
which breaks the one-domain property (§3), pushes auth cookies across
origins, and gives up Hosting rewrites to the gate entirely.

### Keep Astro at the repository root, with `gate/`, `infra/`, `contract/` alongside (Q5)

No file moves, so Phase 1 would change the base path without also relocating
the tree. But the root would mix the Astro app (`src/`, `public/`,
`astro.config.mjs`, `package.json`, `tsconfig.json`, `scripts/`) with the
gate, infrastructure and governance files; the site specialist's scope would
become a list of root paths overlapping files other roles own; and
`firebase.json`, §4, §8 and §9 would all need amending — a change to the
design-authority document to avoid a directory move.

## Consequences

### Positive

- One repository, one domain, owned end to end on personal accounts.
- Clean, disjoint file scopes for the Phase 1–3 specialists.
- The design-authority document needs no amendment.

### Negative / Tradeoffs

- Phase 1 combines two migrations: the tree moves (`src/` → `site/src/`) and
  the base path moves (`/website/` → `/`). Every internal link, asset
  reference and sitemap entry shifts, and `build.yml`, `scripts/*.sh`,
  `.gitignore`, `.vscode/` and test paths all change.
- Inbound links to `djjay0131.github.io/website/...` break for any path the
  Phase 6 redirects do not cover.
- For the length of the transition two hosts serve the site.

### Risks

- **Regression of the current site.** Mitigation: the Phase 1 site work
  delivers a redirect map and proves route parity against the routes
  `build.yml`'s smoke test already checks (`/`, `/resumes/`, `/cv/academic`,
  `/cv/research-professional`, `/papers/`, `/pdfs/academic.pdf`,
  `/projects/`).
- **The hourly `cv` fingerprint check reads
  `https://djjay0131.github.io/website/build-info.json`.** It silently
  compares against a stale deploy once the site moves, unless repointed in
  Phase 1.
- **Project id `cusati-hub` is unverified.** GCP does not reveal whether an id
  is taken until creation, so it stays a Terraform variable.

## Impacted Areas

- [ ] Product
- [ ] Domain model
- [ ] Data architecture
- [ ] AI architecture
- [ ] Domain-specific systems (see governance delta)
- [x] Integrations
- [x] UX
- [x] Security/privacy
- [x] Implementation
- [x] Documentation

## Related Documents

- `llm/specs/2026-09-10-research-hub-design.md` §1, §2, §3, §8, §9, §10 (Q1, Q2, Q5), §11
- `llm/governance/governance-delta.md`

## Related Issues / PRs

- #7 — hub-000: Adopt agentic-governance and record hub design

## Supersedes

None.

## Superseded By

None.
