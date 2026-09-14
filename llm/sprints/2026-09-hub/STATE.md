# Research Hub — Orchestration State

**Sprint:** 2026-09-hub · **Mode:** 3 (Ultracode) · **Level:** L2 (all work streams)
**Design authority:** `llm/specs/2026-09-10-research-hub-design.md`
**Brief:** `llm/plans/2026-09-10-research-hub-orchestration-brief.md`
**Last updated:** 2026-09-14

---

## Current position

**Phase 0 — Establish. IN PROGRESS.**
**BLOCKED ON: Claude Code session restart** (see Blocked, below).

## Done

- [x] §1 preconditions verified — all pass. Recorded in issue #7.
- [x] Issue **hub-000** opened: https://github.com/djjay0131/website/issues/7
      Mode 3 / L2 declared. Preconditions, env caveats, enforcement reality recorded.
- [x] Branch `gov/establish-hub` cut from `main` (post-pull, includes `src/pages/research/`).
- [x] Design doc + orchestration brief brought across from `handoff/research-hub`.
- [x] Tarball moved OUT of the repo → `~/code/phd-milestones.tar.gz` (68565 bytes,
      77 entries, contains a `.git/`). Confirmed absent from the working tree.
- [x] Q1 answered: **`cusati.us`**. Q2 answered: **new project**, intended id `cusati-hub`.

## Blocked

**`/governance:establish` is not invocable in the current session.**
`governance@agentic-governance` v0.8.3 is installed and enabled at user scope, but was
installed *mid-session*; plugin skills load at session start. `Skill(governance:establish)`
returns `Unknown skill`.

**Resolution:** restart Claude Code, then re-read this file and resume at "Next" below.
No other blocker. Do not re-run preconditions — they pass and are recorded in issue #7.

## Next (resume here after restart)

1. Verify `Skill(governance:establish)` resolves. If it still fails, check
   `claude plugin list` shows `governance@agentic-governance` enabled.
2. Repository-Steward: run `/governance:establish`, canonical layout defaults.
3. Write the governance delta:
   - Mission: design doc §1 (paste)
   - Design-authority document: `llm/specs/2026-09-10-research-hub-design.md`
   - Project principles: design doc §12, **verbatim**
   - Domain review questions: (a) "Does this change put any private-visibility item
     on the public path?" (b) "Does this change introduce a long-lived credential?"
     (c) "Can a satellite affect anything outside its prefix?"
   - Governance check command: real path on this machine, with `--layout`:
     `node /mnt/c/code/agentic-governance/plugin/scripts/governance-checks.mjs --layout`
   - Platform enforcement reality: **`main` is NOT protected** (gh api → 404
     "Branch not protected"). Record truthfully.
   - Steward activation: **INACTIVE**
   - Related repos: cv, phd-milestones, agentic-kg, construction-ai-proposal
     (satellites); agentic-governance (canon)
4. Chief-Architect: ADRs 1–5 per design doc §9, plus the ownership ADR candidate below.
5. Chief-Product-Officer: `llm/master-roadmap.md`, Phases 0–6 as checkboxes with
   per-phase acceptance criteria from design doc §11.
6. Update this file. Open draft PR → Chief-Reviewer → mark ready → **Checkpoint 1. STOP.**

## Decisions on the record

| # | Decision | Rationale |
|---|---|---|
| Q1 | Domain **`cusati.us`** | Parked at GoDaddy → clean bind, no teardown. Surname-based: academics search/cite by surname. Rejected `djjay.me` (live on a Google service), `djjay.org`, `djjay.info` (weak trust signal). |
| Q2 | **New** GCP project, intended id `cusati-hub` | Clean IAM boundary; $5 budget scopes to the hub alone; no WIF collision. Billing account `011A3C-D3061E-8B0DB7` (OPEN). |
| Q5 | **OPEN** | Chief-Architect proposes in ADR 1; Jason approves at Checkpoint 1. |
| — | **Ownership on `djjay0131@gmail.com`** — ADR candidate | Deliberate, not an error. Preserves ownership of the research site post-graduation with no account transfer. Institutional identity (`djjay@vt.edu`) belongs in site *content* only, never the infrastructure ownership chain. |

## Risks carried forward

1. **Base-path migration (Phase 1, `site` contract).** The current site is on
   **GitHub Pages** — `djjay0131.github.io/website/`, `base: '/website/'` in
   `astro.config.mjs`. Firebase Hosting on `cusati.us` drops base to `/`: every
   internal link, asset ref and sitemap entry shifts, and inbound `/website/...`
   links break. **The `site` agent owes a redirect map.** This is the brief's
   "do not regress" clause.
2. **`gh` and `terraform` are Windows `.exe`s not on the WSL `PATH`.** Any agent
   writing a workflow or script that calls bare `gh` / `terraform` will produce
   something that fails on this machine. State it in every contract.
3. **`CLOUDSDK_PYTHON` points at a uv-managed interpreter** (`cpython-3.12.11`),
   persisted in `~/.bashrc`, `~/.profile`, `~/.zshrc`. uv can prune or move it and
   gcloud breaks again. Native Linux `google-cloud-cli` is the sturdier fix.
4. **ADC has no quota project.** Set `gcloud auth application-default
   set-quota-project cusati-hub` once the project exists, or expect confusing
   "API not enabled" / quota errors.
5. **Project id `cusati-hub` is unverified.** GCP returns `PERMISSION_DENIED`
   for nonexistent ids, so availability cannot be pre-checked — only `gcloud
   projects create` settles it. Keep it a Terraform **variable**; do not hard-code.
6. **System python is 3.8.5** vs the gate service's 3.12 target. Blocks local
   `pytest` in Phase 3. uv has 3.12.11 and 3.13.5 available.

## Standing constraints

- Sub-agents: **no git or gh mutations.** They write files and report. The Lead
  Architect is the only actor that stages, commits, opens PRs.
- Every agent gets a bounded contract written to
  `llm/sprints/2026-09-hub/contracts/` **before** it launches.
- Handoffs to `llm/sprints/2026-09-hub/handoffs/<agent>-<phase>.md`.
- Secrets never touch the repo. WIF only. A key file means **stop and raise at the
  next checkpoint**.
- Ask only design doc §10 questions. Anything else: conservative choice, recorded
  as an assumption, flagged as an ADR candidate if it is a decision.
- **Agents do not merge.** Draft PR → ready when DoD met → stop at the checkpoint.
