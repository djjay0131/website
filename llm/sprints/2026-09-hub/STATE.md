# Research Hub — Orchestration State

Status: Active
Last updated: 2026-09-14
Owner: Chief Architect (Lead Architect)

**Sprint:** 2026-09-hub · **Mode:** 3 (Ultracode) · **Level:** L2 (all work streams)
**Design authority:** `llm/specs/2026-09-10-research-hub-design.md`
**Brief:** `llm/plans/2026-09-10-research-hub-orchestration-brief.md`

Machine-specific paths are never written here. `<canon checkout>` means the path
declared in `llm/governance/governance-delta.md` §Canon Location.

---

## Current position

**Phase 0 — Establish. IN PROGRESS.** Draft **PR #9** is open. `/governance:establish`
is complete; the governance check passes locally. The roadmap has landed. Next: the
Chief Reviewer's independent review and Phase 0 Governance Audit.

## Done

- [x] §1 preconditions verified — all pass. Recorded in issue #7.
- [x] Issue **hub-000** (#7) opened; Mode 3 / L2 declared; labelled
      `governance`, `in-progress`, `priority-high`, `phase-0-establish`.
- [x] Branch `gov/establish-hub` cut from `main`; design doc and brief brought
      across; phd-milestones tarball moved out of the repo (brief §4 location),
      confirmed absent from the tree.
- [x] `/governance:establish`, steps 1–12:
  - Step 2 layout — governance, adr, specs, sprints, plans, memory bank declared;
    constitution, features, artifacts not declared (A1).
  - Step 10 — branch protection applied and verified (owner chose to mirror
    canon: PR required, 0 approvals, enforce_admins off); 32 labels created, 41
    total, verified.
  - Step 11 — `ci.yml` (canon SHA-pinned, v0.8.3); declared check command run
    locally: **4 of 4 PASS** (links, adr-index, adr-status, layout), both via the
    plugin and from the canon checkout.
- [x] ADRs 0001–0005 + index (Chief Architect).
- [x] Commits on `gov/establish-hub`: `ee59299` (design authority + scaffolding),
      `92fcc88` (routing rule, templates, CI gate), `effd377` (delta, ADRs).
- [x] **Draft PR #9** opened — L2, labels `gov-L2`, `governance`,
      `phase-0-establish`, `in-progress`. Closes #7.
- [x] Contracts: `chief-product-officer-phase-0.md`, `chief-reviewer-phase-0.md`
      (`fcdb1eb`; amended with the brief/design-doc conflicts to verify).
- [x] CI on PR #9 verified from the run log: `governance-checks` ran against the
      pinned canon and reported 4 of 4 PASS — no SKIP. `build` (tests) PASS.
- [x] **Chief Product Officer** delivered `llm/master-roadmap.md` (Phases 0–6,
      136 checkboxes, all unchecked) and `handoffs/chief-product-officer-phase-0.md`.
      Verified against its contract: only its two paths touched, no machine paths,
      governance checks 4 of 4 PASS.

## In flight

- **Chief Reviewer** — PR #9 review + Phase 0 Governance Audit, as a final report.

## Blocked

Nothing.

## Next

1. Persist the Chief Reviewer's report verbatim to
   `handoffs/chief-reviewer-phase-0.md`; post it to PR #9.
2. Reconcile: route each finding to its document owner, apply, commit.
3. Update the PR body (roadmap landed, review result); mark PR #9 ready.
4. **Checkpoint 1 — STOP.** Present K1–K8 below alongside the §10 questions.

## Brief vs design-doc conflicts (owner decides at Checkpoint 1)

Raised by the Chief Product Officer. The delta ranks the design doc above the
brief, so the roadmap follows §11; each still needs the owner's word because the
brief is the owner's own instruction.

- **K1 — Buckets and Artifact Registry.** Brief: Phase 1. Design doc §11: content
  bucket Phase 2, private bucket Phase 3; Artifact Registry unassigned (first
  consumer is the Phase 3 gate).
- **K2 — Gate rewrites in the Phase 1 `firebase.json`.** Brief §4 says Hosting
  tolerates rewrites to a `hub-gate` service that does not yet exist. Public
  reports say the deploy is rejected with HTTP 400 ("Cloud Run service … does
  not exist"). **Unverified in this project.** If true, Checkpoint 2 fails as
  written and Phase 1 must omit the rewrites until the gate exists.
- **K3 — Share routes.** Brief: built in Phase 3. §11: shares are Phase 4, and
  Q3 may cut them.
- **K4 — Bucket IAM test.** Required on every deploy by §12.1 and ADR-0005; the
  brief assigns it to no agent.
- **K5 — Satellite prefix.** Brief scopes identities to `cv/`, `phd-milestones/`;
  §4 uploads to `sources/<source>/`. IAM conditions match literal prefixes.
- **K6 — Blaze timing.** Brief §1 requires Blaze confirmed before Phase 1; §4 has
  it enabled at Checkpoint 2.
- **K7 — Roadmap span.** Brief §2 asks for a Phase 0–3 roadmap; §4 asks for 0–6.
  The roadmap covers 0–6.
- **K8 — Design doc internals.** §6 requires share-link tests while §11 defers
  shares to Phase 4; §11's share "list" operation is not defined in §6; §11
  Phase 6 both redirects from Pages and retires Pages (the only host those
  redirects could run on); the design doc header still pins governance v0.5 and
  names the handoff branch.

## Decisions on the record

| # | Decision | Where |
|---|---|---|
| Q1 | Domain `cusati.us` | ADR-0001; issue #7 |
| Q2 | New GCP project, intended id `cusati-hub`, personal account | ADR-0001 |
| Q5 | **Proposed:** Astro app moves under `site/`; `gate/`, `contract/`, `infra/` at root. Merging PR #9 accepts it. | ADR-0001 |
| — | Ownership chain on personal accounts, not institutional — survives graduation | Design doc §1; ADR-0001 |
| — | Branch protection mirrors canon (enforce_admins off) — owner, 2026-09-14 | Delta §Platform Enforcement Reality |
| — | Full label taxonomy + phase milestones — owner, 2026-09-14 | Delta §Milestone Labels |

## Assumptions (conservative choices, not §10 questions)

- **A1** — Artifacts slot (`docs/`) undeclared until its first content lands
  (Phase 2). `--layout` fails a declared path that does not exist; the
  checker's data-plane scan still covers `docs/` by default.
- **A2** — Phase 0 runs its two personas (CPO, Chief Reviewer) through the Agent
  tool. The generated ultracode workflow is reserved for the Phase 1–3 fan-out,
  where dependency waves exist.
- **A3** — Branch names follow the brief (`gov/…`, `feat/…`), not canon's
  `governance/…` and `feature/…` prefixes. Flag at Checkpoint 1.
- **A4** — Governance checks live in `ci.yml`, separate from `build.yml`. The
  Phase 1 infra contract (`.github/workflows/**`) must carve out `ci.yml`.
- **A5** — ADR statuses are `Accepted` per the brief; acceptance takes effect
  on merge.
- **A6** — `governance-checks` becomes a required status check only after a
  green run on `main`.
- **A7** — Constellize is not installed. The brief's delegations to its
  system-architect (Phase 1) and QA (Phase 3) personas cannot run as written.
  Raise at Checkpoint 1.
- **A8** — The Chief Reviewer charter records outcomes with `gh pr review`, but
  the brief forbids sub-agent gh mutations. The reviewer returns its review as a
  final report; the Lead Architect persists it verbatim and posts it to the PR,
  attributed to the Chief Reviewer role.

## ADR candidates

- **C1** — Satellite → hub dispatch credential. `repository_dispatch` needs a
  GitHub-side credential; a GCP service account cannot hold it. A per-satellite
  PAT is a long-lived credential. Decide before Phase 2. (ADR-0002)
- **C2** — Leak-check matching rules and the derived outputs they cover
  (sitemap, RSS, search index, OG images). Decide in Phase 3. (ADR-0005)
- **C3** — Branch naming convention for this repo vs canon (A3).
- **C4** — Content bucket as published-content store vs §12.5 rebuild-from-repo.

## Constraints discovered (bind later contracts)

- **Gate session cookie must be named `__session`** — Firebase Hosting strips
  every other cookie on Cloud Run rewrites. Phase 3 gate contract. (ADR-0004)
- **Gate invoker is `allUsers`** — every check must hold on direct `*.run.app`
  requests. (ADR-0004)
- **Leak-check script location** — brief names `scripts/…` but scopes the site
  agent to `site/**`. Settle in the Phase 3 contract. (ADR-0005)
- **Phase 1 site scope must include** the files the `site/` move touches outside
  `site/**`: `.gitignore`, `.vscode/`, root `package.json`/lockfile removal,
  `scripts/`. (ADR-0001)

## Risks carried forward

1. **Base-path + tree migration (Phase 1).** Current site is GitHub Pages at
   `djjay0131.github.io/website/`, `base: '/website/'`. Moving to `site/` and
   to `/` on `cusati.us` shifts every link, asset and sitemap entry; inbound
   `/website/...` links break. Site work owes a redirect map and route parity
   against `build.yml`'s smoke-test routes.
2. **`build.yml`'s hourly `cv` fingerprint reads the Pages URL** — stale once the
   site moves unless repointed in Phase 1.
3. **`gh` and `terraform` are Windows executables not on the WSL PATH** on the
   primary workstation. Contracts must not assume bare `gh` / `terraform`
   locally.
4. **gcloud depends on a uv-managed Python 3.12** via `CLOUDSDK_PYTHON`; uv can
   prune it. A native Linux gcloud is sturdier.
5. **ADC has no quota project** — set it once the project exists.
6. **Project id `cusati-hub` unverified** — keep it a Terraform variable.
7. **System Python is 3.8** vs the gate's 3.12 target — use a uv-managed 3.12
   for Phase 3 tests.

## Follow-ups

- Delete the tarball from `handoff/research-hub` (design doc §2) once the
  `phd-milestones` repo exists (Phase 3) — branch cleanup.

## Standing constraints

- Sub-agents: **no git or gh mutations.** They write files and report. The Lead
  Architect alone stages, commits and opens PRs, naming files explicitly.
- Every agent gets a bounded contract in `llm/sprints/2026-09-hub/contracts/`
  **before** it launches; handoffs go to `handoffs/<agent>-<phase>.md`.
- Secrets never touch the repo. WIF only. A key file means **stop and raise at
  the next checkpoint**.
- Ask only design doc §10 questions; everything else is a conservative choice
  recorded above.
- **Agents do not merge.** Draft PR → ready when DoD is met → stop at the
  checkpoint.
