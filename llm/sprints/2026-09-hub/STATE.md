# Research Hub — Orchestration State

**Sprint:** 2026-09-hub · **Mode:** 3 (Ultracode) · **Level:** L2 (all work streams)
**Design authority:** `llm/specs/2026-09-10-research-hub-design.md`
**Brief:** `llm/plans/2026-09-10-research-hub-orchestration-brief.md`
**Last updated:** 2026-09-14

Machine-specific paths are never written here. `<canon checkout>` means the path
declared in `llm/governance/governance-delta.md` §Canon Location.

---

## Current position

**Phase 0 — Establish. IN PROGRESS.** `/governance:establish` steps 1–10 and 12
are done; step 11 (the local `--layout` run) and step 13 (report) are next.
ADRs 0001–0005 are drafted. The roadmap is delegated to the Chief Product
Officer, running.

## Done

- [x] §1 preconditions verified — all pass. Recorded in issue #7.
- [x] Issue **hub-000** (#7) opened; Mode 3 / L2 declared; labelled.
- [x] Branch `gov/establish-hub` cut from `main`; design doc and brief brought
      across; phd-milestones tarball moved out of the repo (brief §4 location),
      confirmed absent from the tree.
- [x] `/governance:establish`:
  - [x] Step 1 preflight — new adoption; canon v0.8.3.
  - [x] Step 2 layout — governance, adr, specs, sprints, plans, memory bank
        declared. Constitution, features, artifacts not declared (see A1).
  - [x] Step 3 governance delta written.
  - [x] Steps 4–7 — directories, `CLAUDE.md` / `AGENTS.md` routing rule
        (created), ADR system, execution-patterns file.
  - [x] Step 8 — plugin registered by git URL in `.claude/settings.json`.
  - [x] Step 9 — PR template, five issue templates, CODEOWNERS, CONTRIBUTING.
  - [x] Step 10 — branch protection applied and verified (owner chose to mirror
        canon: PR required, 0 approvals, enforce_admins off). 32 labels created
        (canonical + gov-L0…L3 + seven phase milestones), 41 total, verified.
  - [x] Step 11 wiring — `.github/workflows/ci.yml`, canon SHA-pinned (v0.8.3).
  - [x] Step 12 — memory-bank stubs at `llm/memory_bank/`.
- [x] ADRs 0001–0005 + index (Chief Architect).
- [x] Contract: `contracts/chief-product-officer-phase-0.md`.

## In flight

- **Chief Product Officer** — `llm/master-roadmap.md` + handoff
  `handoffs/chief-product-officer-phase-0.md`. Launched 2026-09-14.

## Blocked

Nothing.

## Next

1. Run the governance check with `--layout` locally; fix or record findings.
2. Commit the delta, ADRs, this file and the contract correction.
3. On the CPO report: verify the roadmap against its contract, commit it.
4. Open the draft PR (L2; labels `gov-L2`, `governance`, `phase-0-establish`).
5. Write the Chief Reviewer contract; launch the review.
6. Reconcile findings through their owners; commit; mark the PR ready.
7. **Checkpoint 1 — STOP.**

## Decisions on the record

| # | Decision | Where |
|---|---|---|
| Q1 | Domain `cusati.us` | ADR-0001; issue #7 |
| Q2 | New GCP project, intended id `cusati-hub`, personal account | ADR-0001 |
| Q5 | **Proposed:** Astro app moves under `site/`; `gate/`, `contract/`, `infra/` at root. Owner approves at Checkpoint 1 — merging the PR accepts it. | ADR-0001 |
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
