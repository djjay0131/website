# Research Hub — Master Roadmap

Status: Draft
Last updated: 2026-09-15
Owner: Chief Product Officer

## Purpose

This roadmap records Phases 0–6 of the research hub as checkbox items. Each
phase has verifiable acceptance criteria and a scope boundary, so every phase PR
can be checked against it. It **records** the phases in the design-authority
document (`llm/specs/2026-09-10-research-hub-design.md` §11). It does not
re-decide, add, or cut scope. The design document binds each phase through §10
(open questions) and §12 (non-negotiables).

## Scope

- In scope: the phase structure, each phase's units of work, its acceptance
  criteria, its boundary, what blocks it, and the checkpoint that closes it.
- Out of scope: architecture decisions (ADRs 0001–0005, Chief Architect);
  answers to design doc §10 questions (owner only); execution sequencing
  inside a phase (orchestration brief, `llm/plans/2026-09-10-research-hub-orchestration-brief.md`).

## How progress is recorded

- Every item starts unchecked. An item is checked only **after** the work that
  satisfies it has merged, or for owner-run steps (`terraform apply`, DNS,
  member seeding), after the Lead Architect records the result at the
  checkpoint in `llm/sprints/2026-09-hub/STATE.md`.
- Checkbox flips and every other edit to this file follow agentic-governance `llm/governance/l0-fast-track.md` §L0 Path Allowlist.

## Assumptions

- **R-A1.** Where the brief and the design document disagree, the design
  document wins (governance delta §Design-Authority Document). Phase
  boundaries here follow design doc §11. Known disagreements are listed under
  Open Questions and in the CPO handoff.
- **R-A2.** Brief details that refine a §11 phase without contradicting it
  are recorded and attributed to "brief §4".
- **R-A3.** Phases 4–6 are recorded but **not approved for execution**. The
  design document's status is "Approved for Phase 0–3 execution", and the
  brief stops at Checkpoint 4 (brief §3).
- **R-A4.** §11 does not assign Artifact Registry to a phase. It is recorded
  in Phase 3 because the gate is its first consumer (§8, §9 `gate.yml`). This
  classification is uncertain and is flagged for human review.
- **R-A5.** The §6 gate test list includes share-link cases. They are
  recorded in Phase 4, where §11 places share links.
- **R-A6.** Where a phase is the first to exercise a §12 non-negotiable, that
  non-negotiable is one of the phase's acceptance criteria. Later phases do
  not repeat it (see Standing Non-Negotiables).

## Standing Non-Negotiables

Every PR in every phase must still satisfy design doc §12. Reviewers
re-verify them each time (governance delta §Project Principles and §Domain
Review Questions). Each one is first an acceptance criterion in the phase
listed:

| §12 | Non-negotiable | First exercised |
|---|---|---|
| 1 | No private content in public output (build-time check + bucket IAM test, every deploy) | Phase 3 |
| 2 | No long-lived cloud keys; WIF only | Phase 1 |
| 3 | Satellites are untrusted; a satellite writes only under its own prefix | Phase 2 |
| 4 | Static public site | Phase 1 |
| 5 | Owner can rebuild from the repo | Phase 1 |
| 6 | Cost guardrail (budget alert) stays on | Phase 1 |

---

## phase-0-establish — Phase 0: Establish

**Ships:** A governed repo with its decisions on record (design doc §11).

### Scope

- [x] Issue `hub-000` (#7) opened, declaring Mode 3 and level L2 (brief §4)
- [x] Branch `gov/establish-hub` cut from `main`, with the design doc and brief brought across and the `phd-milestones` tarball kept out of the tree (brief §4)
- [x] `/governance:establish` run on `website` (§11)
- [x] Governance delta written, with mission, design authority, principles, domain review questions, check command, platform enforcement reality, steward status and related repos (§11; brief §4)
- [x] Governance checks wired into CI (brief §4)
- [x] ADRs 0001–0005 written, with index (§9, §11)
- [x] Design doc committed at `llm/specs/2026-09-10-research-hub-design.md` (§11)
- [x] Master roadmap written (this document) (§11)
- [x] Orchestration state written to `llm/sprints/2026-09-hub/STATE.md` (brief §0)
- [x] Draft PR opened, reviewed by the Chief Reviewer, and marked ready (brief §4)

### Acceptance criteria

- [x] The governance check with `--layout` passes: the `governance-checks` CI job is green on the Phase 0 PR
- [x] The delta's Project Principles match design doc §12 word for word, and the delta names the design doc as design authority
- [x] `llm/governance/adr/README.md` indexes ADRs 0001–0005, and each index status matches its file (the `adr-index` check passes)
- [x] Each of ADRs 0001–0005 has context, decision, alternatives, consequences, a status, and links to design doc sections (canon Definition of Done §ADR Work; links to design doc sections per brief §4 Phase 0 step 5)
- [x] The committed design doc is byte-identical to the copy on `handoff/research-hub`
- [x] No `phd-milestones` tarball exists anywhere in the PR branch's tree
- [x] This roadmap has one section per milestone label, `phase-0-establish` through `phase-6-polish`, and each label exists on the GitHub repository
- [x] Branch protection on `main`, read through the GitHub API, matches the delta's §Platform Enforcement Reality
- [x] The Q1 and Q2 answers are on the record (ADR-0001, issue #7), and ADR-0001 states the Q5 proposal for owner approval
- [ ] The Chief Reviewer's review is recorded on the PR, and no agent merged it

### Not in this phase

- Any file under `site/`, `gate/`, `contract/`, `infra/`, or `firebase.json`
- Moving the Astro application under `site/` (Phase 1, ADR-0001)
- Creating any cloud resource or Terraform
- Answering §10 Q3, Q4 or Q6

### Blocked on

Nothing. Q1, Q2 and Q5 gate Phase 1, not Phase 0.

### Closing checkpoint

Checkpoint 1 (brief §5). The owner reviews the PR, and merging it accepts
ADR-0001's Q5 proposal. Then the agents stop until the owner gives an
explicit go.

- [x] Checkpoint 1 passed and recorded in `STATE.md`

---

## phase-1-foundation — Phase 1: Foundation

**Ships:** The domain serves the site from Jason's cloud (design doc §11).

### Scope

- [x] The Astro application moves under `site/` with history preserved, per ADR-0001, as the owner approves it at Checkpoint 1 (§10 Q5)
- [x] The site's base path moves from `/website/` to `/` (ADR-0001)
- [x] Terraform in `infra/`: provider, project, required APIs, and variables for project id, region and domain (§8; brief §4)
- [x] Workload Identity Federation pool and provider for `djjay0131/website`, with a least-privilege hub deploy service account (§8)
- [x] Billing budget of $5 with an email alert (§8)
- [x] Firebase project and Hosting on the new GCP project, bound to `jason.cusati.us` (§8, §10 Q1, Q2; ADR-0006)
- [x] `firebase.json` at the repository root, publishing `site/dist-public` (§8)
- [x] GitHub Actions deploy to Firebase Hosting on push to `main` (§9, §11)
- [x] Design tokens in `site/src/styles/tokens.css`, light and dark (§5)
- [x] Layouts (base, section index, item page) and section shells for `research`, `projects`, `writing`, `cv`, `phd` (§4, §11; brief §4)
- [x] A redirect map from every route the current build serves under `/website/`, including `/research/**` and the existing Astro `redirects`, to its new path (ADR-0001). It is recorded here and served in Phase 6.
- [x] The hourly `cv` fingerprint check is repointed from the GitHub Pages URL to the new host (ADR-0001)
- [x] The infra handoff states what `terraform apply` creates, the estimated cost, and the manual steps that remain (brief §4)

### Acceptance criteria

- [x] `https://jason.cusati.us/` serves the site over HTTPS from Firebase Hosting with a valid certificate
- [x] `https://research.cusati.us/` answers with a 301 redirect to `https://jason.cusati.us/` over HTTPS with a valid certificate (ADR-0006)
- [x] Every route the current build serves returns HTTP 200 at `https://jason.cusati.us` under base path `/`: the `build.yml` smoke-test routes (`/`, `/resumes/`, `/cv/academic`, `/cv/research-professional`, `/papers/`, `/pdfs/academic.pdf`, `/projects/`) and every `/research/**` page; each existing Astro `redirects` source forwards to its target under `/`
- [x] `/cv/academic` and `/papers/` on `jason.cusati.us` return bodies of at least 500 bytes (the existing smoke check)
- [x] The built `site/dist-public` has no link, asset reference or redirect target under `/website/`, including the hardcoded `/website/research/soa-agentic-se/agentic-harnesses*` targets in the existing Astro `redirects`
- [x] `djjay0131.github.io/website/` still serves the site, since Pages is retired only in Phase 6 (ADR-0001)
- [x] The CV on `jason.cusati.us` matches the latest `cv` release, and the hourly fingerprint check reads the new host's build info
- [x] `git log --follow` on a moved file under `site/src/` shows its history from before the move
- [x] Every cloud resource Phase 1 uses is declared in `infra/`. After the owner's apply, `terraform plan` reports no changes (§12.5).
- [x] The manual steps Terraform cannot perform are written down in the repository (§12.5)
- [x] The project's billing account has a $5 budget that emails the owner (§12.6)
- [x] The deploy authenticates through WIF only: no service-account JSON key in the repository and none in its Actions secrets (§12.2)
- [x] `firebase.json` configures no Cloud Functions, server-side rendering or framework backend. Everything outside the gate rewrite paths is a static file from `site/dist-public` (§12.4).
- [x] Rendered pages use Spectral, IBM Plex Sans and IBM Plex Mono with the `#0F5C5A` petrol accent, and switch between light and dark themes (§5)
- [x] All five section shells exist, and the public navigation has no link to `phd` (brief §4)
- [x] The GCP project belongs to the personal account, and its project id is a Terraform variable (ADR-0001)
- [x] The redirect map covers every route the current build serves, including `/research/**` and the existing Astro `redirects`, not only the smoke-test routes

### Not in this phase

- Content bucket, per-satellite identities and prefix IAM (§11 Phase 2)
- Manifest schema, publish action, and dispatch-triggered rebuild (§11 Phase 2)
- Private bucket, gate, Identity Platform, Firestore, the `/p/**` rewrite, and Artifact Registry for gate images (§11 Phase 3; see R-A4)
- Share links and their rewrites (§11 Phase 4)
- Serving redirects from the old URL, and retiring GitHub Pages (§11 Phase 6)
- React, which enters with the first island (ADR-0003)
- The family home page at `cusati.us` / `www.cusati.us`, which is outside this project (ADR-0006)
- Brief §4 schedules several of these items into Phase 1; see Open Questions O1–O4

### Blocked on

- Checkpoint 1 (owner approval and merge of Phase 0)
- §10 Q1: answered `cusati.us` (ADR-0001), amended by ADR-0006 to `jason.cusati.us`
- §10 Q2: answered, a new GCP project with intended id `cusati-hub`. Blaze confirmation is not yet on the record, and the brief makes enabling Blaze an owner step at Checkpoint 2.
- §10 Q5 (`site/` subdirectory): Proposed in ADR-0001; approved by merging PR #9

### Closing checkpoint

Checkpoint 2 (brief §4, §5). The owner runs `terraform apply`, enables Blaze,
adds the DNS records and merges. The Lead Architect verifies that the domain
serves the site and records it in `STATE.md`.

- [x] Checkpoint 2 passed and recorded in `STATE.md`

---

## phase-2-contract — Phase 2: Publishing contract

**Ships:** The CV is published through the contract (design doc §11).

### Scope

- [ ] `contract/manifest.schema.json`, exactly per design doc §4
- [ ] The Astro content-collection schema in `site/src/content.config.ts` mirrors the JSON Schema field for field (§4)
- [ ] Composite action `contract/publish/action.yml`: validate the manifest, then upload to `gs://<content-bucket>/sources/<source>/` through WIF with `google-github-actions/upload-cloud-storage` pinned by SHA. It fires **no** `repository_dispatch` and the satellite holds no GitHub credential (§4; ADR-0007)
- [ ] Content bucket (§8, §11)
- [ ] One service account and WIF provider entry per satellite, scoped by IAM condition to that satellite's prefix (§8)
- [ ] The hub build syncs the content bucket before building; a scheduled hub workflow fingerprints the bucket and rebuilds when it differs from the deployed build (§3, §11; ADR-0007 — polling, not dispatch)
- [ ] Satellite how-to for satellite owners, `docs/satellites.md` (brief §4)
- [ ] `cv` formalized as satellite #1: a publish workflow and manifest, with items `visibility: public` and `section: cv` (§2, §11)
- [ ] `format: data` added to the manifest's fixed set, with `schema_version`; the hub renders only the `(source, slug)` data items it claims and fails the build on any other (ADR-0008; design doc §4 amended)
- [ ] Per-satellite identity: a custom role of `storage.objects.create`/`.delete`/`.get` — **no `storage.objects.list`** — bound by IAM condition to `sources/<source>/`, in a `satellites` WIF pool separate from the hub's (ADR-0007)
- [ ] The `repository_dispatch: [cv-updated]` trigger removed; `cv`'s disabled "Notify website repo" step and its `WEBSITE_DISPATCH_PAT` deleted (ADR-0007)
- [ ] `site/scripts/fetch-data.sh` **retained as a fallback**, not deleted. *(Amended 2026-09-16: deleting it would break every pull-request build — the hub's WIF binding admits only `refs/heads/main`, so a PR cannot read the bucket — and would leave `main` with no CV source between merge and Checkpoint 3. Deletion waits on a PR-usable read grant, STATE C25.)*
- [ ] The governance delta declares the artifacts directory `docs/`, whose first content (`docs/satellites.md`) lands in this phase (STATE A1)

### Acceptance criteria

- [ ] The schema accepts the §4 example manifest. It rejects a manifest whose `section`, `format` or `visibility` falls outside the fixed sets, and one missing a required field.
- [ ] A manifest the JSON Schema rejects also fails the hub build, so both ends validate (§4)
- [ ] The publish action rejects a manifest whose `path` escapes `dist/` (ADR-0002)
- [ ] A push to `cv`, with no commit to `website` and no GitHub credential held by `cv`, publishes to the bucket; the next hub poll rebuilds and the updated CV appears on `jason.cusati.us` (ADR-0007)
- [ ] Each `cv` URL that Phase 1 served still resolves, or the `satellite-cv` handoff lists every changed URL with its redirect (brief §4)
- [ ] A recorded test shows the `cv` satellite identity cannot write outside `sources/cv/`: an attempt to write under another source's prefix is denied (§12.3)
- [ ] A recorded test shows the `cv` satellite identity cannot **list** the bucket: `storage.objects.list` cannot be prefix-restricted, so granting it would expose every other source's object names (ADR-0007)
- [ ] A republish of an unchanged `cv` succeeds: the identity can overwrite its own objects (`create` + `delete`), which `roles/storage.objectCreator` alone cannot do (ADR-0007)
- [ ] The `cv` satellite's credentials give it no write access to the `website` repository (§12.3)
- [ ] `cv` authenticates to Google Cloud through WIF only: no JSON key in the `cv` repository or its secrets (§12.2)
- [x] The mechanism by which a publish reaches the hub is decided in an accepted ADR before implementation merges (ADR-0002 → **ADR-0007**, accepted 2026-09-16: the hub polls; no satellite holds a GitHub credential for `website`)

### Not in this phase

- `phd-milestones`, and any `visibility: private` item (§11 Phase 3)
- Private bucket, two-output build and leak check (§11 Phase 3)
- `agentic-kg` and `construction-ai-proposal` as satellites (§11 Phase 5)
- Search, RSS and OG images (§11 Phase 6)

### Blocked on

- Checkpoint 2
- ~~The dispatch-credential decision ADR-0002 required (STATE K13 / ADR candidate C1)~~ — **resolved by ADR-0007 (2026-09-16)**

### Closing checkpoint

Checkpoint 3 (brief §4, §5). The owner merges the hub PR, then the `cv` PR. A
`cv` push publishes through the contract, and the Lead Architect verifies
that the CV appears.

- [ ] Checkpoint 3 passed and recorded in `STATE.md`

---

## phase-3-private-area — Phase 3: Private area

**Ships:** The milestone tracker and committee dossier sit behind sign-in (design doc §11).

### Scope

- [ ] Gate service (FastAPI) handling sessions, the member allowlist, and serving `/p/**` (§6 responsibilities 1–3)
- [ ] Gate pytest suite for sessions, non-members and `/p/` path traversal (§6)
- [ ] Cloud Run service `hub-gate` in `us-east1` with minimum 0 instances (§6, §8)
- [ ] Gate image build and deploy workflow `.github/workflows/gate.yml`, with images in Artifact Registry keeping the last 5 (§8, §9; R-A4)
- [ ] Identity Platform with Google and email-link sign-in (§8)
- [ ] Firestore in Native mode (§8)
- [ ] Private bucket with uniform access and no public access (§8)
- [ ] Two-output build (`HUB_OUTPUT=public|private`), with `site/dist-private` synced to the private bucket (§5; ADR-0005)
- [ ] Post-build leak check (§5)
- [ ] Bucket IAM test on every deploy (§12.1; ADR-0005)
- [ ] `/p/**` and `/session` rewrites routed to `hub-gate` (§8, §11)
- [ ] Sign-in page that exchanges a Firebase ID token for a session (§6; brief §4)
- [ ] `phd-milestones` created as a private repository from the tarball, with a publish workflow and manifest marking both items `visibility: private`, `section: phd` (§2, §11)
- [ ] Member seed script, run by the owner, seeding the §10 Q4 members with `role: owner` for Jason (§6, §11; brief §4)
- [ ] Chief Reviewer Governance Audit across Phases 0–3 (brief §4)

### Acceptance criteria

- [ ] A seeded member signs in at `jason.cusati.us` and sees the milestone tracker and the committee dossier
- [ ] Signed out, a request for the tracker or dossier under `/p/` returns no private content
- [ ] A signed-in account that is not on the allowlist gets the "not shared with you" page and no private content (§6)
- [ ] The same signed-out and non-member requests, sent straight to the `hub-gate` `*.run.app` URL, are refused the same way (ADR-0004)
- [ ] A session minted through `jason.cusati.us` persists across page loads served through Hosting (ADR-0004 `__session` constraint)
- [ ] Every response under `/p/` carries `Cache-Control: private, no-store` (§6). Firebase Hosting marks rewrite responses `private` by default, and its CDN caches a gate response only if the gate itself sends `public` or `s-maxage` (ADR-0004).
- [ ] A gate test asserts that no `/p/**` or `/s/**` response carries `public` or `s-maxage` in `Cache-Control` (ADR-0004)
- [ ] The gate pytest suite passes in CI and covers session mint and verify, non-member rejection, and path-traversal rejection on `/p/` (§6)
- [ ] The leak check runs on every deploy, and a deliberate test run shows it failing the build when a private slug appears in any path or file content under `site/dist-public` (§12.1)
- [ ] The bucket IAM test runs on every deploy and fails if the private bucket grants public access or any reader other than the gate's service account. An anonymous request for a private object is refused (§12.1).
- [ ] No page on the public site lists, links or names a private item, and private navigation exists only in the private build (ADR-0005)
- [ ] The gate's service account can read only the private bucket and Firestore (brief §4; ADR-0004)
- [ ] `phd-milestones` is private on GitHub, and a recorded test shows its publish identity cannot write outside `sources/phd-milestones/` (§12.3)
- [ ] The gate deploy authenticates through WIF only, with no JSON key (§12.2)
- [ ] The Governance Audit result for Phases 0–3 is recorded on the PR

### Not in this phase

- Share mint, list, revoke, and serving under `/s/**` and `/share/**`, together with their tests (§11 Phase 4; §10 Q3)
- The Shares page (§11 Phase 4)
- A member-management interface; §11 schedules member seeding only
- Search over any content (§11 Phase 6, public content only)
- `agentic-kg` private research notes (§2 "optional"; unscheduled in §11)
- Brief §4 schedules the share routes into Phase 3; see Open Questions O3

### Blocked on

- Checkpoint 3
- §10 Q4: which members to seed (open)

### Closing checkpoint

Checkpoint 4 (brief §4, §5). The owner applies Terraform, merges, runs the
seed script, signs in, and sees the tracker and dossier. This is the last
checkpoint the brief defines.

- [ ] Checkpoint 4 passed and recorded in `STATE.md`

---

## phase-4-sharing — Phase 4: Sharing

**Ships:** A 14-day link to one document (design doc §11).

### Scope

- [ ] Share mint, owner only (§6, §11)
- [ ] Share list (§11); §6 defines no list endpoint, see Open Questions O5
- [ ] Share revoke (§6, §11)
- [ ] Share serving through `GET /s/{token}/{path}`, with the `/s/**` and `/share/**` rewrites live (§6, §8)
- [ ] Shares page as a React island (§11; ADR-0003)
- [ ] Gate tests for share cases (§6)

### Acceptance criteria

- [ ] The owner mints a 14-day share for one private document, and opening the link in a signed-out browser shows that document
- [ ] A share link cannot reach any file outside its own slug, shown by test and by a manual request
- [ ] A revoked link and an expired link are both refused, shown by tests (§6)
- [ ] Path-traversal requests under `/s/` are refused, shown by test (§6)
- [ ] A member without `role: owner` cannot mint or revoke a share (§6)
- [ ] Every share response carries `Cache-Control: private, no-store`. Firebase Hosting marks rewrite responses `private` by default, and its CDN caches a gate response only if the gate itself sends `public` or `s-maxage` (ADR-0004).
- [ ] The owner can see active shares on the Shares page and revoke one there

### Not in this phase

- Shares that cover more than one slug (§6)
- A member-management interface (unscheduled in §11)
- New satellites (§11 Phase 5)

### Blocked on

- §10 Q3: whether share links are wanted at all (open; the owner may cut this phase)
- The owner's go to execute beyond Phase 3 (design doc status line; R-A3)
- A closing checkpoint, which no brief yet defines

### Closing checkpoint

None defined. The brief ends at Checkpoint 4 (brief §3).

- [ ] Phase 4 PRs merged by the owner

---

## phase-5-satellites — Phase 5: Satellites

**Ships:** A self-updating projects section (design doc §11).

### Scope
- [ ] Section pages render from collections (brief §4). *(Moved from Phase 2 on the owner's
  decision, 2026-09-16, with the Chief Reviewer concurring. It was never assigned in a Phase 2
  stream contract — the Lead Architect's omission — and it could not have landed there without
  breaking that phase's requirement that rendered output not change. With `cv` the only
  satellite, a collection-driven section page would have shown exactly what `/cv/` and
  `/resumes/` already render first-party. Here it has a second and third satellite to render,
  which is the first point it does something nothing else does. The collection and its
  validation already exist and are exercised by the build; only the rendering is outstanding.
  Closes STATE C26.)*

- [ ] `agentic-kg` as satellite #3, with a public project page from its `docs/` (§2, §11)
- [ ] `construction-ai-proposal` as satellite #4, with a public project page (§2, §11)
- [ ] Project index (§11)

### Acceptance criteria

- [ ] A docs change pushed to `agentic-kg`, with no commit to `website`, updates its project page on `jason.cusati.us`
- [ ] A change pushed to `construction-ai-proposal`, with no commit to `website`, updates its project page on `jason.cusati.us`
- [ ] The project index lists both projects from their manifests, without a hand-maintained entry per project
- [ ] A recorded test shows each new satellite identity cannot write outside its own `sources/<source>/` prefix (§12.3)
- [ ] Both satellites authenticate through WIF only (§12.2)

### Not in this phase

- `agentic-kg` private research notes (§2 "optional"; unscheduled in §11)
- Project pages for the `agentic-governance` or `agentic-research` READMEs (§2 "later"; unscheduled in §11)
- Search, RSS and OG images (§11 Phase 6)

### Blocked on

- §10 Q6: the order of `agentic-kg` and `construction-ai-proposal` (open)
- The owner's go to execute beyond Phase 3 (R-A3)
- A closing checkpoint, which no brief yet defines

### Closing checkpoint

None defined. The brief ends at Checkpoint 4 (brief §3).

- [ ] Phase 5 PRs merged by the owner

---

## phase-6-polish — Phase 6: Polish

**Ships:** The old URL forwards (design doc §11).

### Scope

- [ ] Pagefind search over public content only (§11)
- [ ] RSS feed (§11)
- [ ] OG images (§11)
- [ ] Redirects from `djjay0131.github.io/website` to `jason.cusati.us`, covering the Phase 1 redirect map (§11; ADR-0001)
- [ ] GitHub Pages retired as the site's host (§11; ADR-0001); see Open Questions O6

### Acceptance criteria

- [ ] Opening each Phase 1 smoke-test route under `https://djjay0131.github.io/website` lands the browser on the matching `jason.cusati.us` URL
- [ ] Every entry in the Phase 1 redirect map forwards to its `jason.cusati.us` target
- [ ] GitHub Pages no longer serves the site's own pages
- [ ] Search on `jason.cusati.us` returns public items, and the search index contains no private slug or title (§11; ADR-0005)
- [ ] The RSS feed validates and contains no private item (ADR-0005)
- [ ] No OG image exists for a private item, and none shows a private title (ADR-0005)
- [ ] The leak check covers the sitemap, RSS feed, search index and OG images (ADR-0005)

### Not in this phase

- Search over private content (§11: "public only")
- New satellites or sections

### Blocked on

- The owner's go to execute beyond Phase 3 (R-A3)
- The redirect mechanism, given that Pages is also retired (Open Questions O6)
- A closing checkpoint, which no brief yet defines

### Closing checkpoint

None defined. The brief ends at Checkpoint 4 (brief §3).

- [ ] Phase 6 PRs merged by the owner

---

## Open Questions

### Design doc §10: status on the record

Only the owner answers these. Recording an answer here is an L1 edit.

| # | Question | Blocks | Status |
|---|---|---|---|
| Q1 | Domain name | Phase 1 deploy | Answered: `cusati.us` (ADR-0001; issue #7); amended by ADR-0006 to `jason.cusati.us` |
| Q2 | GCP project id; Blaze confirmed | Phase 1 infra | Answered: new project, intended id `cusati-hub`, personal account (ADR-0001). Blaze confirmation not yet on the record. |
| Q3 | Share links wanted, or cut | Phase 4 | Open |
| Q4 | Initial members to seed | Phase 3 | Open |
| Q5 | `site/` subdirectory or root layout | Phase 1 | Proposed in ADR-0001 (`site/` subdirectory); approved by merging PR #9 |
| Q6 | Order of `agentic-kg` and `construction-ai-proposal` | Phase 5 | Open |

### Sequencing disagreements between the brief and design doc §11

The design document wins (R-A1). Each of these is for the owner or the Chief
Architect to reconcile. Details are in the CPO Phase 0 handoff.

- **O1.** Brief §3–§4 provisions the content bucket, the private bucket and Artifact Registry in Phase 1. §11 places the content bucket in Phase 2 and the private bucket in Phase 3.
- **O2.** Brief §4 has Phase 1 ship `firebase.json` with all four gate rewrites. §11 places the `/p/**` rewrite in Phase 3, and share links, with their rewrite paths, in Phase 4. Also, Firebase Hosting rejects a deploy whose rewrite names a Cloud Run service that does not exist, which contradicts the brief's "Hosting tolerates this".
- **O3.** Brief §4 has the Phase 3 gate implement `POST /share`, `DELETE /share/{token}` and `GET /s/{token}/{path}`. §11 places share links in Phase 4, and §10 Q3 may cut them.
- **O4.** Brief §4 adds a stubbed `repository_dispatch` trigger to `build.yml` in Phase 1. §11 places the dispatch rebuild in Phase 2.
- **O5.** §11 Phase 4 names share "list", but §6 defines no list route and the brief's route list has none.
- **O6.** §11 Phase 6 both redirects from `djjay0131.github.io/website` and retires Pages. The old URL lives on GitHub Pages, so the redirects need a host after retirement. What "retire" means is undefined.
- **O7.** No brief defines checkpoints or approval for Phases 4–6.

## ADR Candidates

Product-level decisions implied by §11 that ADRs 0001–0005 do not cover are
listed in the CPO Phase 0 handoff. They cover old-URL forwarding and Pages
retirement, URL stability for migrated content, share-link expiry policy,
member management, empty-section policy, unpublishing, and the definition of
the project index.

## Cross-References

- `llm/specs/2026-09-10-research-hub-design.md`: design authority (§10, §11, §12)
- `llm/plans/2026-09-10-research-hub-orchestration-brief.md`: execution plan (§3, §4, §5)
- `llm/governance/governance-delta.md`: milestone labels, L0 allowlist, principles
- `llm/governance/adr/0001-promote-website-to-hub-on-firebase-hosting.md`
- `llm/governance/adr/0002-satellite-publishing-via-content-bucket-and-dispatch.md`
- `llm/governance/adr/0003-keep-astro-with-react-islands.md`
- `llm/governance/adr/0004-private-area-cloud-run-gate-behind-hosting.md`
- `llm/governance/adr/0005-two-output-build-with-leak-check.md`
- `llm/governance/adr/0006-hub-on-jason-cusati-us-subdomain.md`
- `llm/sprints/2026-09-hub/STATE.md`: checkpoint records, risks, ADR candidates C1–C4
- `llm/sprints/2026-09-hub/handoffs/chief-product-officer-phase-0.md`: rationale, disagreements, MVP classification
- agentic-governance `llm/governance/definition-of-done.md` §Design Work
- agentic-governance `llm/governance/labels.md` §Milestone Labels
- agentic-governance `llm/governance/l0-fast-track.md` §L0 Path Allowlist (`checkbox-only` shape)
- agentic-governance `llm/governance/governance-levels.md` (roadmap bookkeeping as L0)
