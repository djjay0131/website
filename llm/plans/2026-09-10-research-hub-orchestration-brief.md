# Research Hub — Orchestration Brief for Claude Code

You are executing under **agentic-governance** (Jason's AI Engineering
Operating System). Read this whole brief before acting. The design
authority is `llm/specs/2026-09-10-research-hub-design.md` in this repo;
it is the source of truth and you implement against it rather than
re-deciding it. You are on branch `handoff/research-hub`, which contains
only this brief, the design doc, and the phd-milestones tarball; Phase 0
starts by branching from `main` and bringing these files across.

Use an ultracode dynamic workflow. Construct a dependency-aware
orchestration plan, launch bounded specialist agents, run an independent
Governance Audit, reconcile through the Lead Architect, and preserve
progress across interruptions.

---

## 0. Ground rules that override everything below

- **Workflow mode: Mode 3 (Ultracode).** Multi-concern, dependencies
  between work units, repo-wide scope. Record the mode selection in the
  Phase 0 issue per the Project Operating System.
- **Governance level: L2 for every work stream** (semantic implementation
  work). Every PR requires human review by Jason. **You do not merge.**
  You open draft PRs, mark them ready when their Definition of Done is
  met, and stop at the checkpoints in §5.
- **Every agent gets a bounded contract** using the Universal
  Bounded-Contract Skeleton from `prompt-patterns.md`. No improvised
  prompts. Contracts are written to `llm/sprints/2026-09-hub/contracts/`
  before the agent launches.
- **Git rule for sub-agents: no git or gh mutations.** Sub-agents write
  files and report. The Lead Architect (you, top level) is the only actor
  that stages, commits, opens PRs. Commit as Jason Cusati
  <djjay@vt.edu> with the attribution trailer your environment specifies.
- **Secrets never touch the repo.** No cloud JSON keys, no tokens, no
  `.env` with real values. WIF only. If you find yourself needing a key
  file, stop and raise it at the next checkpoint.
- **Ask only the questions in design doc §10.** Anything else, make the
  conservative choice, record it as an assumption in your handoff, and
  flag it as an ADR candidate if it is a decision.
- **Interruption resilience.** Write orchestration state to
  `llm/sprints/2026-09-hub/STATE.md` after every completed unit: what is
  done, what is in flight, what is blocked and on what. On restart, read
  STATE.md first.

## 1. Preconditions — verify, do not assume

Run these and report the results in the Phase 0 issue before any other
work. If any fails, stop and tell Jason exactly which one.

```
# repo
cd ~/code/website          # or wherever `website` is cloned; clone it if absent
git status && git remote -v

# governance plugin available
ls ~/code/agentic-governance/plugin/scripts/governance-checks.mjs
# and confirm /governance:establish is invocable in this session

# tooling
node --version && npm --version
python3 --version
gh auth status
gcloud auth list && gcloud config get-value project
firebase --version && firebase login:list
terraform --version

# inputs (committed on this branch)
ls llm/plans/handoff/phd-milestones.tar.gz
```

Required from Jason before Phase 1 (design doc §10): **Q1 domain**, **Q2
GCP project id + Blaze confirmed**, **Q5 layout choice**. If any is
missing, complete Phase 0, open its PR, and stop at Checkpoint 1 with the
questions listed.

## 2. Roles

Map your agents to the governance personas. Do not invent new roles.

| Persona | Used for |
|---|---|
| **Chief-Architect** (you, top level, Lead Architect) | Orchestration plan; mode selection; ADRs 1–5; contract authoring; reconciliation; the only committer |
| **Chief-Product-Officer** | Phase 0: write the Phase 0–3 roadmap and acceptance criteria from the design doc; confirm scope boundaries per phase |
| **Repository-Steward** | Phase 0: run `/governance:establish`; write governance delta; wire governance checks; verify branch protection reality via `gh api` and record it in the delta |
| **Chief-Reviewer** | Independent review of every PR against the design doc, review checklist, and Definition of Done, before it is marked ready. Also runs the L0 Governance Audit at the end of each phase |
| Constellize specialist personas | Delegate specialist analysis here where the framework says to: system-architect for the Terraform module structure review; QA for the gate test plan. Do not duplicate them as ad hoc agents |
| agentic-research | Not used in Phases 0–3. It is Jason's academic-writing plugin, not a content source; do not treat it as a satellite |

Specialist implementation agents (bounded contracts, disjoint file
scopes, launched in parallel where the dependency graph allows):

| Agent | Allowed paths | Deliverable |
|---|---|---|
| `site` | `site/**`, `firebase.json` | Astro restructure, tokens, collection schema, two-output build, leak check, section shells |
| `contract` | `contract/**`, `docs/satellites.md` | JSON Schema, publish composite action, satellite how-to |
| `gate` | `gate/**` | FastAPI service, tests, Dockerfile |
| `infra` | `infra/**`, `.github/workflows/**` | Terraform modules, WIF, budget, Actions workflows |
| `satellite-cv` | in the `cv` repo only | Publish workflow + manifest for cv |
| `satellite-phd` | in the `phd-milestones` repo only | Create repo from tarball; publish workflow + manifest |

Each contract must state `Do not modify:` as every path not in its
allowed list, and `Sprint scope boundary:` as the phase it belongs to.

## 3. Dependency graph

```
Phase 0 ─────────────────────────────────────────────────────▶ Checkpoint 1
  establish → delta → ADRs 1–5 → design doc committed → roadmap

Phase 1 (after CP1 approval)
  infra: project, WIF, budget, buckets, AR ──┐
  site: tokens, layout, shells, dist-public ─┼──▶ build.yml deploy ──▶ Checkpoint 2
  firebase.json (site agent) ────────────────┘

Phase 2 (after CP2)
  contract: schema + action ──▶ site: collection schema mirrors it ──┐
  infra: content bucket IAM + dispatch trigger ────────────────────────┼──▶ satellite-cv ──▶ Checkpoint 3
                                                                       ┘
Phase 3 (after CP3)
  gate: service + tests ──▶ infra: Cloud Run, Identity Platform, Firestore, private bucket ──┐
  site: HUB_OUTPUT=private build + leak check ────────────────────────────────────────────────┼──▶ satellite-phd ──▶ Checkpoint 4
  contract: visibility docs ──────────────────────────────────────────────────────────────────┘
```

Phases 4–6 are out of scope for this brief. Stop at Checkpoint 4.

## 4. Phase instructions

### Phase 0 — Establish

1. Open issue `hub-000: Adopt agentic-governance and record hub design`.
   Declare Mode 3, level L2.
2. Branch `gov/establish-hub`.
3. Repository-Steward runs `/governance:establish`. Choose the canonical
   layout defaults. Governance delta:
   - Mission: paste design doc §1.
   - Design-authority document: `llm/specs/2026-09-10-research-hub-design.md`.
   - Project principles: design doc §12, verbatim.
   - Domain review questions: "Does this change put any private-visibility
     item on the public path?" · "Does this change introduce a long-lived
     credential?" · "Can a satellite affect anything outside its prefix?"
   - Governance check command: the real path on this machine, with `--layout`.
   - Platform enforcement reality: verify with `gh api` and record truthfully.
   - Steward activation: INACTIVE.
   - Related repos: cv, phd-milestones, agentic-kg, construction-ai-proposal
     (satellites); agentic-governance (canon).
4. Bring `llm/specs/2026-09-10-research-hub-design.md` and this brief
   (`llm/plans/2026-09-10-research-hub-orchestration-brief.md`) across from
   `handoff/research-hub` onto `gov/establish-hub`. Move the tarball out of
   the repo to `~/code/phd-milestones.tar.gz` and do not commit it on the
   PR branch.
5. Chief-Architect writes ADRs 1–5 (design doc §9) using the repo's ADR
   template. Each ADR: context, decision, alternatives, consequences,
   status Accepted, links to the design doc section.
6. Chief-Product-Officer writes `llm/master-roadmap.md` with Phases 0–6
   as checkbox items and per-phase acceptance criteria from design doc
   §11.
7. Write STATE.md. Open draft PR. Chief-Reviewer reviews. Mark ready.
   **Checkpoint 1.**

### Phase 1 — Foundation

Issue `hub-001`. Branch `feat/foundation`. Launch `infra` and `site` in
parallel with disjoint contracts.

`infra` contract deliverables:
- `infra/` Terraform: provider, project data source, APIs enabled, Artifact
  Registry, content + private GCS buckets (uniform access, versioning,
  lifecycle 30-day noncurrent), WIF pool + provider for
  `djjay0131/website`, deploy SA with least privilege, `google_billing_budget`
  $5 with email to Jason. Variables for project id, region, domain.
- `.github/workflows/build.yml`: on push to main and on
  `repository_dispatch: publish` — WIF auth, sync bucket (Phase 2 makes
  this real; stub now), `astro build` public, deploy to Firebase Hosting
  via `firebase-tools` with WIF-issued token.
- Handoff must state: what `terraform apply` will create, estimated cost,
  and the exact manual steps left (Blaze enable, DNS records at registrar,
  `firebase projects:addfirebase`).

`site` contract deliverables:
- Restructure per Q5 decision (ADR 1). Preserve the existing cv
  consumption so the current site does not regress.
- `site/src/styles/tokens.css` with the design system in design doc §5,
  light + dark.
- Layouts: base, section index, item page. Section shells: research,
  projects, writing, cv, phd (phd hidden from public nav).
- `firebase.json` per design doc §8, with rewrites present but pointing at
  a `hub-gate` service that does not yet exist (Hosting tolerates this
  until requested).
- `npm run build` produces `site/dist-public`.

Reconcile. Chief-Reviewer. **Checkpoint 2:** Jason runs `terraform apply`,
enables Blaze, adds DNS records, merges. You verify the domain serves the
site and record the result in STATE.md.

### Phase 2 — Publishing contract

Issue `hub-002`. Branch `feat/contract`.

`contract` agent: `manifest.schema.json` exactly per design doc §4;
`contract/publish/action.yml` composite action (validate with ajv → WIF
auth → `gcloud storage rsync` to prefix → `gh api` dispatch);
`docs/satellites.md` how-to, including the ten-line workflow snippet.

`site` agent: `content.config.ts` collection schema mirroring the JSON
Schema field-for-field; loader that reads `site/src/content/sources/**/
manifest.json`; build-time sync step in `build.yml` (`gcloud storage rsync
gs://<content>/sources/ site/src/content/sources/`); section pages render
from collections.

`infra` agent: per-satellite WIF provider entries and SAs scoped by
prefix (`cv/`, `phd-milestones/`, …) using IAM conditions; dispatch
permission for satellite SAs limited to `repository_dispatch` on `website`.

Then `satellite-cv` (in the `cv` repo): a publish workflow that builds
whatever cv already builds into `dist/`, writes a manifest with the PDF
and HTML CV as `visibility: public`, `section: cv`, and calls the action.
Handoff documents what the old integration did and confirms the new one
produces the same public URLs or lists the redirects needed.

Chief-Reviewer. **Checkpoint 3:** Jason merges hub PR, then cv PR; a cv
push publishes through the contract; you verify the CV appears.

### Phase 3 — Private area

Issue `hub-003`. Branch `feat/private-area`. Launch `gate`, `infra`,
`site` in parallel; `satellite-phd` after `contract` docs update.

`gate` agent: FastAPI per design doc §6, `firebase-admin`, `google-cloud-
storage`, `google-cloud-firestore`. Routes: `POST /session`, `GET /p/
{path}`, `POST /share`, `DELETE /share/{token}`, `GET /s/{token}/{path}`,
`GET /healthz`. Pytest suite covering every case in §6 with Firebase Admin
and GCS mocked. Dockerfile on `python:3.12-slim`, non-root, `uvicorn`.
Delegate the test plan review to the Constellize QA persona before
finalizing.

`infra` agent: `google_cloud_run_v2_service` `hub-gate` (min 0, max 3,
service account with `roles/storage.objectViewer` on private bucket only
and `roles/datastore.user`), `google_identity_platform_config` enabling
Google and email-link sign-in, `google_firestore_database` Native,
`.github/workflows/gate.yml` (pytest → build → push AR → deploy).
Delegate module-structure review to the Constellize system-architect
persona.

`site` agent: `HUB_OUTPUT=private` build path to `site/dist-private`;
`build.yml` runs both builds, then the leak check
(`scripts/check-no-private-in-public.mjs`: load all manifests, collect
private slugs, fail if any path under `dist-public` matches), then
`gcloud storage rsync dist-private gs://<private>/`. A minimal sign-in
page at `/signin` using the Firebase Web SDK that posts the ID token to
`/session`. Private nav appears only in the private build.

`satellite-phd` agent: extract `~/code/phd-milestones.tar.gz` into `~/code/phd-milestones`,
create it as a **private** GitHub repo via `gh repo create --private`,
add a publish workflow with a manifest marking both items
`visibility: private`, `section: phd`. Do not alter the tarball's content
beyond adding the workflow and manifest.

Seed script `gate/scripts/seed_members.py` that adds Q4 emails to
Firestore `members/` with `role: owner` for Jason — run by Jason, not by
you.

Chief-Reviewer on every PR. Chief-Reviewer then runs the Governance Audit
across Phases 0–3. **Checkpoint 4:** Jason applies Terraform, merges,
runs the seed script, signs in, sees the tracker and dossier. Stop here.

## 5. Checkpoints — what you hand Jason at each stop

At every checkpoint, post in the PR and print to the terminal:

1. **State**: STATE.md contents.
2. **What to review**: PR links, ADRs touched, the one or two decisions
   most worth his attention.
3. **What only he can do**: exact commands or console steps, in order,
   with the expected result of each.
4. **Open questions**: only from design doc §10, with your recommended
   default for each.
5. **Governance**: mode, level, checks passing, audit result if run.

Then stop. Do not proceed to the next phase without an explicit go.

## 6. Handoff shape for every agent (from the Project Operating System)

Summary · Assumptions · Recommendations · Alternatives considered · Risks ·
Open questions · Related docs · ADR candidates. Written to
`llm/sprints/2026-09-hub/handoffs/<agent>-<phase>.md`.

## 7. Definition of Done (implementation work, per canon)

Approved issue exists · design doc and ADRs present · code reviewed via PR
by Chief-Reviewer · tests included and passing · docs updated · data,
security, privacy impacts documented in the PR · memory bank updated if
project state changed · governance checks pass with `--layout`.

---

Begin with §1. Report precondition results, then proceed to Phase 0.
