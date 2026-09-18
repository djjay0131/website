# Research Hub — Orchestration State

Status: Active
Last updated: 2026-09-16
Owner: Chief Architect (Lead Architect)

**Sprint:** 2026-09-hub · **Mode:** 3 (Ultracode) · **Level:** L2 for the work streams; **L3 for PR #12** (roadmap requirement changes — delta review 2, Part D)
**Design authority:** `llm/specs/2026-09-10-research-hub-design.md`
**Brief:** `llm/plans/2026-09-10-research-hub-orchestration-brief.md`

Machine-specific paths are never written here. `<canon checkout>` means the path
declared in `llm/governance/governance-delta.md` §Canon Location.

---

## Current position

**Phase 3 — Private area. IN PROGRESS** (issue #24, branch `feat/private-area`, owner's go
2026-09-17). Phase 2 is complete and the hub serves the CV through the contract. Phase 3 puts
the milestone tracker and committee dossier behind sign-in, and is the first phase where
private material touches the system.

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
- [x] **Chief Reviewer** report received and persisted verbatim to
      `handoffs/chief-reviewer-phase-0.md` (local only — not committed or posted
      until A1 is remediated, because it describes the exposure).
- [x] A1 verified independently by the Lead Architect (see Blocked).
- [x] ADR reconciliation applied and committed: A2, A3, A5, A6, A7, A10, A12,
      A16, A19, A20. Governance checks 4/4 PASS.
- [x] **A1 remediated** (owner-approved 2026-09-14): remote branch
      `handoff/research-hub` deleted 2026-09-15T02:51:24Z. See §Incident A1.
- [x] Delta (A13), `ci.yml` SHA pins (A14), memory bank (A11, A15) committed
      (`f4a32e9`). Issue #7 no longer carries the billing account ID (A16).
- [x] Chief Reviewer report committed (one commit SHA redacted, A10) and posted
      to PR #9.
- [x] **Chief Product Officer amendments** integrated for A2, A7, A9, A10, A17,
      A18, A19 — verified: only its two files changed, 137 checkboxes (A7 added one),
      all unchecked, no machine paths, governance checks 4/4 PASS. Left unchanged by
      decision: five factual mentions of the handoff branch or tarball (scope and
      history, no SHA), and three Q5 lines that remain accurate.
- [x] **Checkpoint 1 passed** (2026-09-15). Owner: "PR 9 looks good please merge ad
      move o to phase 1". PR #9 merged (`d32cd36`) by the Lead Architect on that
      instruction, with the instruction recorded on the PR (A11). Issue #7 closed.
- [x] `governance-checks` made a **required status check** on `main` after its
      green run there; verified via the API. Delta updated on `feat/foundation`.
- [x] Post-merge `build-and-deploy` on `main` green, Pages smoke test included.
- [x] Phase 0 bookkeeping opened as a separate L0 PR, **#11** (`admin/phase-0-bookkeeping`):
      18 roadmap checkboxes and a memory-bank sync. Three Phase 0 boxes stay
      unchecked (branch-protection match pending this delta update; "no agent
      merged it" — A11; Checkpoint 1 recorded here).
- [x] Issue **hub-001** (#10) opened: Mode 3, L2, preconditions, and the
      conservative choice for each of K1–K13.
- [x] Astro app moved under `site/` as a pure rename (42 files at 100%
      similarity; `git log --follow` verified), with `.gitignore` following.
      Commit message corrected before any PR: the moved app builds, and 1 of 22
      tests fails locally on data (A12).
- [x] Contracts: `phase-1-seams.md` (SEAM-1..6), `site-phase-1.md`,
      `infra-phase-1.md`.
- [x] **Phase 1 workflow** (`wf_89beac5f-e7f`, 8 agents, 0 errors): site and infra
      implemented in parallel; both per-stream verifications passed with no
      must-fix; the seam check raised two should-fix findings (Firebase-variant
      build gating → infra; release-dependent test assertions → site), both fixed,
      and the seam re-check passed.
- [x] Lead Architect checks before commit: only in-scope paths changed; ci.yml
      identical; no secrets, key files, state or machine paths; GitHub repository
      and owner ids in Terraform verified against the API; actionlint clean;
      terraform fmt + validate clean; `npm test` 45 passed, 1 skipped.
- [x] Committed per scope: site `0ce2865`, infra `9f0718a`.
- [x] Seams clarified (SEAM-4 `SITE_URL` ordering; SEAM-6 snapshot currency); site
      contract D2 amended (A16).
- [x] **Draft PR #12** opened (L2). Chief Reviewer contract written
      (`chief-reviewer-phase-1.md`); it launches after the palette re-work lands.
- [x] **Palette re-work (A16)**: tokens carry over all 14 tracker/dossier colours per
      theme exactly (verified against amended D2); all 52 text pairings at WCAG AA.
      Two light-theme text colours adjusted to the nearest compliant shade — muted
      #636a68 (carried-over ink-3 #6B7370 is 4.45:1 on paper) and caution #87620d
      (brass #8A6512 is 4.32:1 on brass-soft) — with the originals kept for non-text
      use. `npm test` 47 passed, 1 skipped; builds clean.
- [x] **Chief Reviewer report** received (Request Changes: 1 must-fix, 7 should-fix,
      6 notes; L2 confirmed) and persisted to `handoffs/chief-reviewer-phase-1.md`;
      posted to PR #12. SEAM-7 added to the seams (F8).
- [x] **Review remediation committed**: site SEAM-7 check `b5327b1`; infra F1–F5, F8,
      F10–F12 `3ec90ed`. Lead Architect reruns: terraform fmt + validate clean,
      actionlint clean, `npm test` 54 passed / 1 skipped, lockfile resolves only from
      registry.npmjs.org, no node_modules / secrets / machine paths committed.
- [x] Checked the one wiring change that could have regressed notifications:
      `budget-guard` runs only on push and pull_request, and is in the needs of both
      notify jobs. Both gate on status functions (`failure()`; `!cancelled()` with
      explicit result checks), so a skipped `budget-guard` on schedule or dispatch
      runs neither suppresses recovery nor triggers failure.
- [x] F9 tracked on issue #10; F14 handoff status lines updated. Delta-review contract
      `chief-reviewer-phase-1-delta.md` committed (`d54204d`).
- [x] **Chief Reviewer delta review** (verdict Comment): F1 must-fix and F2–F14 all
      RESOLVED on evidence; persisted to `handoffs/chief-reviewer-phase-1-delta.md`
      and posted to PR #12. B4 (SEAM-7 "one source" overstated) corrected in the
      seams.
- [x] Delta-review notes B1–B3 closed by infra (budget-guard on every trigger; tracked
      and local override-file checks; credential-free locked-install job); B4 closed by
      the Lead Architect. Lead Architect checks: actionlint clean, terraform fmt +
      validate clean, `budget.tf` change comment-only.
- [x] **Owner decision, Checkpoint 2 (2026-09-15):** Option B — `cusati.us` and `www` for
      a family home page (outside hub scope); hub on a subdomain; both `jason.cusati.us`
      and `research.cusati.us` reach it, `jason.` canonical, `research.` a 301 redirect.
      Recorded as ADR-0006 (amends ADR-0001 Decision 2). PR #12 moved back to draft.
- [x] **Owner request:** public OpenClaw Email homepage and privacy policy at
      `https://jason.cusati.us/openclaw-email/` and `/openclaw-email/privacy/` — issue #13,
      a separate PR after #12.
- [x] **ADR-0006 amendment implemented:** roadmap `132389c`, site `1229d31`, infra `8c14ce8`
      (canonical `jason.cusati.us`; `research.cusati.us` redirect custom domain; per-host DNS
      outputs; Terraform rejects the apex and `www`; DNS steps never change apex, `www`, MX or
      TXT). CI green on `8c14ce8`.
- [x] **Correction (process), `20e9f41`:** that commit held only the ADR-0006 file although its
      message described the whole change set. The edit script aborted on a wrong anchor, and
      the chain committed and pushed despite a failing governance check (`ci` run 34992910006,
      adr-index). `46136e5` landed the missing edits. Rule adopted since: the commit chain
      refuses to commit unless the governance checks report 4 of 4.
- [x] **Chief Reviewer delta review 2** (verdict **Comment**): ADR-0006 conforms; no regression;
      platform claims verified (redirect 301, certificate for a redirect domain, CNAME-only TLS
      failure, cross-variable validation). Persisted to `handoffs/chief-reviewer-phase-1-delta-2.md`.
      Required before ready: B1 PR body, B2 declare L3 — done. Notes B3 (this correction record),
      B4 (STATE), B5 (memory bank Q1 + ADR range), B7 (ADR-0006 cross-reference) — done.
- [x] **Checkpoint 2, runbook steps 1–5, 6 (partial) and 8 — run by the Lead Architect on the
      owner's instruction (2026-09-15, A19):**
  - Project `cusati-hub` (number 410552878319) created; ACTIVE; no parent (personal account).
  - Billing linked to the owner's personal billing account (Blaze). Preflight: the owner holds
    `roles/billing.admin`; the account is open and bills in USD (review F13 confirmed).
  - Bootstrap APIs enabled; ADC quota project set to `cusati-hub`.
  - **Terraform applied from `2cece92`** (clean checkout of the reviewed PR head; `budget-guard`
    green; no override files), 2026-09-15T18:29:11Z–18:30:05Z, via the `hashicorp/terraform:1.14.0`
    container: `Apply complete! Resources: 19 added, 0 changed, 0 destroyed.` Post-apply plan
    after `apply -refresh-only`: `No changes.` State backed up privately outside the repository.
  - Outputs: WIF provider
    `projects/410552878319/locations/global/workloadIdentityPools/github-actions/providers/website`;
    deploy SA `hub-deploy@cusati-hub.iam.gserviceaccount.com`; default Hosting URL
    `https://cusati-hub.web.app` (404 until the first deploy).
  - Custom domains `jason.cusati.us` and `research.cusati.us` (redirect target `jason.cusati.us`)
    created: `OWNERSHIP_MISSING`, `HOST_UNHOSTED`, `CERT_VALIDATING` until DNS exists.
  - Actions variables set: `GCP_PROJECT_ID`, `GCP_WIF_PROVIDER`, `GCP_DEPLOY_SA`. `SITE_URL`
    deliberately not set until `jason.cusati.us` is `CERT_ACTIVE`.
  - Hosting release retention set to 20 through the Hosting API (runbook step 6).
  - Verified: no user-managed keys on `hub-deploy`; no Actions secrets; the applied WIF
    attribute condition admits only repository id 1212933399, owner id 5666389 and
    `djjay0131/website`, and refuses `pull_request_target`.
- [x] **Checkpoint 2 passed (2026-09-15)** — verified live; evidence on issue #10:
  - Owner added the two CNAMEs (`jason`, `research` → `cusati-hub.web.app`) and merged PR #12 at
    18:53:37Z (merge `59e576f`); the owner also merged PR #11.
  - First post-merge `build-and-deploy` run 35010300517: every job green — `firebase-deploy`
    (`Deploy complete!`, 159 files, released by `hub-deploy` through WIF), `firebase-smoke-test`,
    Pages `deploy` (deploy-pages v5, first real run — review F11) and `smoke-test`, `budget-guard`,
    `deploy-tools`.
  - Firebase activated both domains at about 20:06Z (roughly 80 minutes after DNS);
    `SITE_URL` set to `https://jason.cusati.us` at 20:06:43Z once its certificate was valid.
  - `https://jason.cusati.us`: all 48 inventory routes return 200; certificate `CN=jason.cusati.us`
    (Google Trust Services); `build-info.json` from `59e576f`; nav has no `/phd`; `/phd/` noindex
    and out of the sitemap; fonts self-hosted; petrol accent and dark theme in the served CSS.
  - `https://research.cusati.us`: 301 to `https://jason.cusati.us/`, **paths preserved**
    (`/cv/academic/` → `/cv/academic/`); valid certificate.
  - Legacy Astro redirects (`/research/agentic-harnesses*`): all forward to their targets under `/` (meta refresh; targets return 200).
  - `terraform apply -refresh-only`: 0 changes; `plan`: `No changes.`; state backed up privately.
  - GitHub Pages still serves; apex `cusati.us` MX, TXT, A, CAA and `www` unchanged.
- [x] Phase 1 bookkeeping PR: roadmap checkboxes, this record, memory-bank sync (issue #10, F9).
- [x] **Phase 1 fingerprint criterion verified:** scheduled run 35032163362 (2026-09-15T22:40:53Z)
      logged "reading deployed build info from https://jason.cusati.us/build-info.json", compared
      fingerprints and correctly skipped the rebuild. The roadmap box is ticked.
- [x] **`budget-guard` made a required status check** on `main` (owner decision); delta and memory
      bank updated.
- [x] **Email and Privacy pages built** (#13) on `feat/email-privacy-pages`: the owner's wording
      exactly, verified character for character against the contract; redirect map 48 → 50.

## In flight

**Phase 3 (#24), draft PR #25, branch `feat/private-area`.** Governance wave committed and
pushed as `9888daa`, CI green on all six required checks: ADR-0009, ADR-0010, the ADR index,
`phase-3-seams.md`, five bounded contracts, `manifest_version` in the schema with its
rejection fixture, and the two-version documentation in `contract/README.md` and
`docs/satellites.md`.

**`djjay0131/phd-milestones` exists — do not create it again.** Private, created 2026-09-17
from the Incident A1 seed blob in the Lead Architect's local object store (the remote handoff
branch is long deleted). Default branch `main` at `24afd9d`, the seed's single commit
preserved. Working checkout at `/mnt/c/code/phd-milestones`, already on branch
`feat/publish-contract`. For the WIF entry: `repository_id=1373915518`,
`owner_id=5666389`, `default_branch=main` — note `cv` is `master`, which is why that field is
per satellite.

**All four specialist streams launched 2026-09-17 and running:**

- **`gate`** — `gate/**` and `.github/workflows/gate.yml`, against `contracts/gate-phase-3.md`.
- **`infra`** — `infra/**`, against `contracts/infra-phase-3.md`. Must resolve the conflict in
  its open question (a): the roadmap's bucket IAM test forbids any reader of the private
  bucket other than the gate, but ADR-0010's destructive sync needs the hub's identity to list
  and delete there.
- **`site`** — `site/**` and `.github/workflows/build.yml`, against `contracts/site-phase-3.md`.
- **`satellite-phd`** — the private `phd-milestones` checkout, against
  `contracts/satellite-phd-phase-3.md`.

**On restart: do not relaunch any of these without first checking for its handoff in
`handoffs/` and whether its files already exist.** Relaunching over a stream's own work is the
failure this record exists to prevent.

Not yet started: the **Chief Reviewer** (`contracts/chief-reviewer-phase-3.md`), which also
carries this phase's **Governance Audit across Phases 0-3** against canon **v0.9.0** — whose
`audit` skill gained the stale-branch check. It runs only once all four streams have landed.

## Blocked

Nothing. Phase 2 waits for the owner's go.

## Incident A1 — private material on a public branch

- **What:** the phd-milestones seed tarball (milestone tracker, committee
  material, VT policy — private per design doc §2) was committed on branch
  `handoff/research-hub` of this public repository.
- **Exposure window:** from the commit on 2026-09-10 until the branch was deleted
  at 2026-09-15T02:51:24Z.
- **How found:** Chief Reviewer, finding A1; verified independently by the Lead
  Architect (public repository; file served on that branch; commit on no other
  branch; no pull request ever opened from it; no forks).
- **Remediation:** owner chose to delete the remote branch; done. The branch path
  now returns 404. The out-of-repo copy was verified byte-identical first; the
  local branch is kept.
- **Residual:** the commit remains reachable by its SHA until GitHub
  garbage-collects it. Tarball retrievable through the commit: YES — the tarball is still retrievable through the commit (68565 bytes).
  The SHA is withheld from every public artifact (A10).
- **Owner actions outstanding:** (1) ask GitHub Support to remove cached views of
  the commit (the owner has the SHA); (2) decide whether anyone named in the
  committee material should be told.
- **Prevention:** ADR candidate C9 (incident runbook); review recommendation 5 (a
  secret and large-binary scan in `ci.yml`).
**Closed by owner decision (2026-09-15):** the owner chose not to file the GitHub Support purge
request and accepts the residual exposure ("it's fine leave it"). No further action.

## Next

Lead Architect: write the four specialist contracts, launch the streams in dependency order
(`contract` → `infra`/`site` → `satellite-cv`), reconcile, draft PR, Chief Reviewer.

Owner, at Checkpoint 3: apply Terraform, set `GCP_CONTENT_BUCKET`, merge the hub PR, then the
`cv` PR; a `cv` push then publishes through the contract and the CV appears on
`jason.cusati.us`.

Still open from earlier phases: whether "OpenClaw" may stay on the two pre-existing research
pages (it names a third-party harness in the literature review); whether to delete the merged
remote branches `gov/establish-hub`, `feat/foundation`, `admin/phase-0-bookkeeping`,
`feat/email-privacy-pages`.

## Brief / design-doc / canon conflicts (owner decides at Checkpoint 1)

Raised by the Chief Product Officer and extended by the Chief Reviewer. The
delta ranks the design doc above the brief, so the roadmap and ADRs follow the
design doc; each item still needs the owner's word, because the brief and the
design doc are both the owner's own documents.

Brief vs design doc:

- **K1 — Buckets and Artifact Registry.** Brief: Phase 1. Design doc §11: content
  bucket Phase 2, private bucket Phase 3; Artifact Registry unassigned (first
  consumer is the Phase 3 gate).
- **K2 — Gate rewrites in the Phase 1 `firebase.json`.** Brief §4 says Hosting
  tolerates rewrites to a `hub-gate` service that does not yet exist.
  **VERIFIED false:** the Hosting REST reference (v1beta1 `CloudRunRewrite`)
  states that setting or updating the Hosting configuration fails if the Cloud
  Run service does not exist. Checkpoint 2 fails as briefed unless Phase 1 omits
  the rewrites until the gate exists.
- **K3 — Share routes.** Brief: built in Phase 3. §11: shares are Phase 4, and
  Q3 may cut them.
- **K4 — Bucket IAM test.** Required on every deploy by §12.1 and ADR-0005; the
  brief assigns it to no agent.
- **K5 — Satellite prefix.** Brief scopes identities to `cv/`, `phd-milestones/`;
  §4 uploads to `sources/<source>/`. IAM conditions match literal prefixes.
- **K9 — Dispatch stub.** Brief stubs the dispatch trigger in Phase 1; §11 has it
  in Phase 2 only.
- **K11 — Leak-check semantics.** Brief §4 (Phase 3): fail if any *path* under
  `dist-public` matches. Design doc §5: grep contents for any private slug.
  ADR-0005 follows §5.

Inside the brief:

- **K6 — Blaze timing.** §1 requires Blaze confirmed before Phase 1; §4 has it
  enabled at Checkpoint 2. (Design doc §10 Q2 sides with §1.)
- **K7 — Roadmap span.** §2 asks for a Phase 0–3 roadmap; §4 asks for 0–6. The
  roadmap covers 0–6.
- **K10 — Phase 3 ordering.** §3 runs the gate before infra; §4 launches them in
  parallel.

Brief vs canon:

- **K12 — Check-command path.** Brief §4 asks for "the real path on this machine"
  in the delta; canon permits exactly one machine path (the canon checkout) and
  forbids expanding it in the check command. The delta follows canon.

Inside the design doc:

- **K8 — Design doc internals.** §6 requires share-link tests while §11 defers
  shares to Phase 4; §11's share "list" operation is not defined in §6; §11
  Phase 6 both redirects from Pages and retires Pages; the header still pins
  governance v0.5, names the handoff branch, and misstates the authority
  hierarchy (the memory bank, not the delta, is rank 1); §10 Q4 names a third
  party in a public repository.
- **K13 — Dispatch contradiction.** §3 and §4 require each satellite to fire
  `repository_dispatch` at `website`, which needs a credential with Contents:
  write on `website` — contradicting §3's "a satellite never has write access to
  the hub" and principle 3. Recorded in ADR-0002; the owner decides the
  constraint before Phase 2.
**Outcome at Checkpoint 1:** the owner merged without ruling on K1–K13
individually. Phase 1 takes the conservative choice for each — the design doc and
the merged roadmap over the brief — recorded in issue #10. K2 in particular:
Phase 1's `firebase.json` carries no gate rewrites.

## Decisions on the record

| # | Decision | Where |
|---|---|---|
| Q1 | Domain `cusati.us`, **amended by ADR-0006:** hub at `jason.cusati.us` (canonical), `research.cusati.us` 301-redirects, `cusati.us` + `www` reserved for a family site | ADR-0001, ADR-0006; issues #7, #10 |
| Q2 | New GCP project, intended id `cusati-hub`, personal account | ADR-0001 |
| Q5 | **Proposed:** Astro app moves under `site/`; `gate/`, `contract/`, `infra/` at root. Merging PR #9 accepts it. | ADR-0001 |
| — | Ownership chain on personal accounts, not institutional — survives graduation | Design doc §1; ADR-0001 |
| — | Branch protection mirrors canon (enforce_admins off) — owner, 2026-09-14 | Delta §Platform Enforcement Reality |
| — | Full label taxonomy + phase milestones — owner, 2026-09-14 | Delta §Milestone Labels |
| — | **Phase 2 publish notification — option A:** the hub polls the content bucket on a schedule and rebuilds on change; satellites hold no GitHub credential for `website` (resolves the direction of C1/K13; the ADR is written at Phase 2 start) — owner, 2026-09-15 | STATE C1 |
| — | **Email and Privacy pages** at `/email/` and `/privacy/`, titled "Email" and "Privacy", no "OpenClaw" name, owner's wording used as supplied — owner, 2026-09-15 | Issue #13 |
- **§10 Q4 — answered (owner, 2026-09-17).** Seed members: **`djjay@vt.edu`** with
  `role: owner`, **`cbrown@vt.edu`** as member. Those two only. **The allowlist matches the
  exact email in the Firebase ID token**, and the owner's gcloud/GitHub identity is
  `djjay0131@gmail.com` — signing in with that account yields a token that will not match and
  produces the "not shared with you" page, which is indistinguishable from a gate bug. Sign-in
  must use the VT Google account or email-link to `djjay@vt.edu`. Recorded in the seed
  script's output and in the Checkpoint 4 steps.

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
- **A9** — `/governance:establish` and the delta were run by the Lead Architect
  (top-level session), not a Repository Steward agent as brief §2 assigns. The
  steward agent has no Write, Edit or Skill tools, and establish needs the
  owner's interactive approval for GitHub-side changes, which only the
  top-level session can obtain. Recorded so auditor independence can be traced
  (review A22).
- **A10** — The commit SHA that carried the tarball is redacted from every public
  artifact, including the otherwise-verbatim Chief Reviewer report, until GitHub
  confirms the cached views are purged.
- **A11** — PR #9 was merged by the Lead Architect on the owner's explicit
  instruction. Canon (`governance-levels.md` §Level-Aware Merge Authority) says no
  AI role merges semantic work; the decision was the owner's and is recorded on
  PR #9, but the platform action was an agent's. The roadmap criterion "no agent
  merged it" is left unchecked for the owner to accept or not. Default for later
  PRs: the owner merges, unless the owner again instructs otherwise on that PR.
- **A12** — Local test baseline: `cv-data.test.ts > resolveVariant > resolves
  academic variant with correct section order` fails locally (education 4 vs 3)
  because the local CV data (2026-08-17) is newer than the `cv` release CI tests
  against (assets 2026-07-27); CI passes. Not Phase 1 work; the owner's
  `fix/derive-education-assertion` branch appears to address it.
- **A13** — GitHub Pages and Firebase Hosting are both built from each commit
  until Phase 6 (ADR-0001 Decision 4); the Firebase deploy stays switched off
  until the owner sets the SEAM-4 variables at Checkpoint 2.
- **A14** — Phase 1 runs as a generated ultracode workflow (the Mode 3 fan-out
  deferred in A2). Verification inside the workflow does not replace the Chief
  Reviewer's review of the PR.
- **A15** — Contract deviation accepted: the site contract said not to modify
  `cv-data.test.ts`. The seam check found it pinned exact counts from whatever `cv`
  release CI fetches, so a new release could fail CI on content alone. The fix
  moved exact assertions onto an invented fixture and kept structural checks on
  the fetched data. It may overlap the owner's `fix/derive-education-assertion`
  branch.
- **A16** — Lead Architect contract error: site contract D2 told the specialist to
  choose brass and clay colours, but design doc §5 says to carry over the tracker
  and dossier palette. The specialist never saw that palette (it lives in the
  private tarball outside the repo). D2 is amended with the colour values only,
  and the tokens are re-worked.
- **A17** — OpenClaw privacy-policy wording: the owner chose "not shared with, sold to, or
  stored by any third party", after being told Anthropic may retain API inputs and
  outputs briefly under its data-retention policy. The owner's decision, used as given
  (issue #13).
- **A18** — Dated records (review reports, Phase 0 contracts and handoffs) keep their
  `cusati.us` references; canon forbids rewriting where things were. Current-facing docs,
  code and the infra contract move to `jason.cusati.us`.
- **A19** — Brief §4 and the infra handoff have the owner run the Checkpoint 2 cloud steps. On
  2026-09-15 the owner instructed the Lead Architect to perform every step that can be automated
  and hand over only what cannot be. The Lead Architect ran project creation, billing link, API
  enablement, the ADC quota project, the Terraform apply (under the review F1 provenance rule),
  the Actions variables and Hosting release retention. Still the owner's: DNS at the registrar
  (no registrar API credential), merges, and decisions.
- **A20** — `cv` work happens in a git worktree on branch `feat/publish-contract`, created
  from `origin/master`, so the owner's `cv` checkout (on `add-mit-to-all-variants`) is never
  touched. The Lead Architect alone commits there, as in `website`.
- **A21** — ADR-0008 amends design doc §4 rather than asking the owner. It is a decision, not
  a §10 question, so per brief §0 it is taken conservatively and recorded as an ADR. It is
  flagged for the owner at Checkpoint 3 because it weakens §3's independence property for one
  named format, and the owner may prefer the `format: html` alternative despite its cost.
- **A22** — The artifacts slot `docs/` is declared in this PR, which creates its first content
  (`docs/satellites.md`), exactly as A1 said it would be.
- **A23** — The `phd-milestones` seed's embedded git history (1 commit, 1 branch, no remotes,
  tracked set identical to the working tree) is **preserved** rather than squashed, so
  provenance survives. It adds no exposure beyond what Incident A1 already assessed.
- **A24** — The seed carries a `.gitlab-ci.yml`, dead config in a GitHub-bound repository. The
  brief says not to alter the tarball's content beyond adding the workflow and manifest, so it
  is **left in place and flagged** rather than silently deleted.
- **A25** — The brief has a `satellite-phd` agent run `gh repo create --private` from
  `~/code/phd-milestones.tar.gz`. That path does not exist — the only surviving copy is a blob
  in the Lead Architect's local object store from the Incident A1 commit — and sub-agents make
  no `gh` mutations. The **Lead Architect** extracts it and creates the repository; the agent
  works in a checkout.

## ADR candidates

- **C1** — Satellite → hub dispatch credential. `repository_dispatch` needs a
  GitHub-side credential; a GCP service account cannot hold it. A per-satellite
  PAT is a long-lived credential. Decide before Phase 2. (ADR-0002)
  **Owner direction 2026-09-15: option A (hub polls the bucket); satellites hold no GitHub
  credential.** Record as an ADR when Phase 2 starts.
- **C2** — Leak-check matching rules and the derived outputs they cover
  (sitemap, RSS, search index, OG images). Decide in Phase 3. (ADR-0005)
- **C3** — Branch naming convention for this repo vs canon (A3).
- **C4** — Content bucket as published-content store vs §12.5 rebuild-from-repo.
- **C5** — Branch protection and identity model: 0 approvals, enforce_admins off,
  no required checks, one shared token (review R2).
- **C6** — Canon pin and update policy: CI SHA binding, plugin auto-update
  locally, who bumps the pin (review R3, A13).
- **C7** — Governance CI gate kept separate from `build.yml`; `ci.yml` carved out
  of the Phase 1 infra scope (review R5; A4 above).
- **C8** — What public-build islands may call at runtime (review R7; ADR-0003).
- **C9** — Handling private content found in a public repository — incident
  runbook (review R8; A1).
- **C10** — Terraform state backend (local, git-ignored, in Phase 1; remote GCS **Owner 2026-09-15: local for Phase 1; revisit in Phase 2.**
  backend proposed — it needs a bucket, which K1 keeps out of Phase 1).
- **C11** — Deploy identity: `roles/firebasehosting.admin` plus
  `roles/serviceusage.apiKeysViewer` is the narrowest supported grant. The
  custom-role alternative is withdrawn: custom roles cannot control Firebase
  Hosting resources (review F2, F3).
- **C12** — WIF admission policy: repository id + owner id + name; main-only deploy
  binding via `repository_id_ref`; `pull_request_target` refused. **Invariant:** the
  binding keeps other providers out only while every provider in the pool maps
  `repository_id_ref` from `repository_id + '/' + ref`. Phase 2 should prefer a
  separate pool for satellites, which makes this structural (review F4).
- **C13** — One source for the smoke-test route list.
- **C14** — Budget guardrail enforcement: `prevent_destroy`, a CI presence check,
  and apply provenance (review F1).
- **C15** — CI supply-chain pinning: actions by SHA, CLI tools by lockfile, runtimes
  by exact version (review F5, F10).
- **C16** — Canonical URL form, design-token policy, self-hosted fonts, the
  host-agnostic build interface, the redirect-map lifecycle, test-data policy, and
  deploy activation by repository variables (review Part F).
- **C17** — Redirect-domain duplicate check compares raw strings, so a case or trailing-dot
  variant of the same hostname passes validation and plans a second resource (delta review 2,
  B6; fails loudly at plan review, no apex or mail risk). Tracked for a follow-up.
- **C18** — First-party pages on the hub: the hub now serves `/email/` and `/privacy/` for a
  project unrelated to the research hub, which the delta's Mission does not anticipate ("content
  is authored in satellites; the hub renders it"). It also shares the root namespace with the
  Phase 2 `section` set (ADR-0002 Decision 4), so a future section named `email` would collide
  with a live OAuth homepage URL Google has on file (review B2).
- **C1 — CLOSED 2026-09-16** by ADR-0007 (the publish-notification mechanism). Conflict K13
  is closed with it.
- **C19** — A second `data` source would make the hub carry a second first-party renderer.
  ADR-0008 sets a high bar deliberately; revisit at Phase 5 when `agentic-kg` and
  `construction-ai-proposal` arrive.
- **C20 — CLOSED 2026-09-17** by ADR-0009 (optional now, required in Phase 5). Manifest versioning. `schema_version` versions one payload; the *contract itself*
  also changes (ADR-0008 altered the "fixed" format set three weeks after the design doc). With
  `additionalProperties: false`, a satellite cannot send a field before the hub accepts it, so
  a `manifest_version` must land optional first and become required later. Recommended: ADR
  now, optional in Phase 3, required in Phase 5.
- **C21** — The publish action cannot verify what it uploaded, because verifying means listing
  and satellites are denied `list` (ADR-0007). The consequence is permanent: a partial upload
  leaves a mixed state no satellite can detect or prune.
- **C22** — Lexical constraints on `slug` and `path`. `slug` becomes a URL segment, so the
  contract stream constrained it to `^[a-z0-9]+(?:-[a-z0-9]+)*$`, max 64.
- **C23 — CLOSED 2026-09-17** by ADR-0010. Retention and withdrawal semantics for published objects. An empty `items` array is
  the only way a satellite can retract content, since it cannot list and therefore cannot
  prune. This matters from Phase 3, when a withdrawn item may be private.
- **C24** — `schema_version` convention, raised by the `cv` stream and binding on both
  repositories. The schema permits `1.2.3`, which invites compatibility reasoning the hub's
  exact-match check does not implement; the recommendation is integers only, incremented one
  at a time, and **bump the hub first** — a version published before the hub understands it
  takes the hub build down, whereas bumping early is merely loud. The rule is now written in
  `docs/satellites.md`; tightening the schema pattern to match is deferred because the `site`
  stream is mirroring the current pattern as this is written, and desyncing the two ends
  mid-flight is exactly the failure SEAM-1 exists to prevent.
- **C25** — A bucket read grant usable from a pull-request ref. The hub's deploy binding admits
  only `refs/heads/main`, so PR builds cannot read the content bucket and `fetch-data.sh` must
  stay as their CV source. Options: a pool-level `principalSet`, or a second read-only service
  account. Once it exists, the fallback can be deleted as the seams originally intended. This
  is the single change that closes the largest remaining gap in the publishing design.
- **C26 — CLOSED 2026-09-16** (owner moved it to Phase 5; roadmap updated). "Section pages render from collections" (roadmap Phase 2, brief §4) was not
  implemented, and was not assigned in any of the four stream contracts. That is the Lead
  Architect's omission. It also sits against this phase's requirement that rendered output must
  not change, and with `cv` as the only satellite there is nothing a collection-driven section
  page would show that the existing first-party pages do not. Owner's decision at Checkpoint 3:
  accept the deferral to Phase 5 when real satellites arrive, or hold Phase 2 open for it.
- **C27 — CLOSED 2026-09-17** by ADR-0010 decision 4 (the hub declares its expected sources). A source whose entire bucket prefix vanishes is undetectable. Withdrawal is
  expressible only as an empty `items` array, so a missing manifest is treated as a fault and
  fails the build — but a wholly absent prefix looks like a source that never existed.
  Detecting it needs a recorded expected-source set. Matters from Phase 3, when the missing
  source may be the private one.
- **C28** — `format: html` does not say what travels with a page. The `satellite-phd` stream
  established this concretely: the manifest names two files while correct publication needs
  three, because nothing names the stylesheet both pages load. It reaches the bucket only
  because the publish action uploads all of `dist/` — a property of the upload step, not of
  the contract. §4 calls `html` "a self-contained page or folder", and neither reading holds:
  the pages are not self-contained, and "folder" collapses because **both items share one
  directory**. The contract should state that a file-valued `html` path serves its containing
  directory, and define what happens when two items share one. Not changed mid-phase: the
  `site` stream is reading the schema and the fixtures as this is written.
- **C29** — The refusal shape. The gate answers **404 with a static body** for every refused
  caller, never a redirect. Its reasoning is good and worth preserving: the natural redirect
  implementation ("look up, redirect if found, 404 if not") is an existence oracle for private
  slugs; a redirect also puts the private path into `?next=`, browser history, `Referer` and
  logs, and adds an open-redirect surface. A uniform 404 carries no information. GitHub does
  this for private repositories for the same reason.
- **C30** — Session lifetime and revocation. The cookie lasts 14 days and membership is re-read
  per request, so removal from the allowlist takes effect immediately — but every sub-asset of
  a page triggers an Identity Toolkit lookup, which is a real cost and a real dependency.
- **C31** — Whether member access should be logged at all, given the material. The gate keeps
  object paths out of logs by default; whether *any* record of who read what should exist is a
  privacy decision, not an engineering one.

## Constraints discovered (bind later contracts)

- **"Dependency-free X" does not imply "dependency-free X's tests."** `contract/`'s
  validator is deliberately dependency-free — `contract/publish/action.yml` runs it with
  nothing installed. Its *test suite* imports `ajv` to cross-check the hand-written
  validator against a real JSON Schema implementation. Wiring the suite into CI without
  `npm ci` passed locally (where `node_modules` already existed) and failed on the runner's
  clean checkout with `ERR_MODULE_NOT_FOUND`. Any job added for a tree that was previously
  untested in CI must be proven against an **empty** checkout, not the working tree — move
  `node_modules` aside and run it. This is the same class as the exit-126 defect and the
  non-hermetic tests, and it was introduced by the Lead Architect while fixing S-5.

- **A cross-stream environment variable is a contract, and nothing checks it.** Two streams
  can each be green while disagreeing about the name of a variable one sets and the other
  reads; neither runs the other's code. Any future phase that splits a producer and a
  consumer across streams must name the exact variable in the seam, not in prose. Phase 3
  cost one such defect (the gate's `GATE_PRIVATE_BUCKET`).

- **Gate session cookie must be named `__session`** — Firebase Hosting strips
  every other cookie on Cloud Run rewrites. Phase 3 gate contract. (ADR-0004)
- **Gate invoker is `allUsers`** — every check must hold on direct `*.run.app`
  requests. (ADR-0004)
- **Leak-check script location** — brief names `scripts/…` but scopes the site
  agent to `site/**`. Settle in the Phase 3 contract. (ADR-0005)
- **Phase 1 site scope must include** the files the `site/` move touches outside
  `site/**`: `.gitignore`, `.vscode/`, root `package.json`/lockfile removal,
  `scripts/`. (ADR-0001)
Phase 2, verified against primary sources before any implementation (ADR-0007, ADR-0008):

- **`storage.objects.list` cannot be prefix-restricted.** "Since the storage.objects.list
  permission is granted at the bucket level, you cannot use the resource.name condition
  attribute to restrict object listing access to a subset of objects in the bucket." A
  satellite granted `list` could enumerate every other source's object names, including
  Phase 3's private `phd-milestones`. Satellites get **no `list`**, ever.
- **`gcloud storage cp --recursive` requires `storage.objects.list`** and is therefore
  forbidden as the publish primitive — the one permission that cannot be granted.
- **`roles/storage.objectCreator` cannot overwrite**; replacing an object needs
  `storage.objects.create` **and** `storage.objects.delete`. `objectCreator` alone would
  succeed on a satellite's first publish and fail on every republish.
- **`google-github-actions/upload-cloud-storage` v3.0.0 makes no bucket `list` call** — it
  globs locally (`src/util.ts`) and uploads per file (`src/client.ts`). This is a property of
  its source, not a documented guarantee: any version bump must re-verify it.
- **IAM Conditions require uniform bucket-level access**; the object-prefix form is
  `resource.name.startsWith('projects/_/buckets/<bucket>/objects/<prefix>')`.
- **Scheduled runs authenticate through the existing binding.** Scheduled workflows run on
  the default branch, so the OIDC `ref` claim is `refs/heads/main`.
- **`cv`'s default branch is `master`** and the repository is **public** — its WIF condition
  admits `refs/heads/master` (design doc §2 was wrong; corrected by ADR-0008).

**File modes cannot be observed on this workstation (2026-09-16).** The repository lives on
`/mnt/c`, a DrvFs mount that reports every file as `0777`. A script committed `100644`
therefore runs perfectly locally and fails on a Linux runner with
`Permission denied`, exit 126. This cost a red CI in Phase 2: `site/scripts/sync-content.sh`
was committed non-executable and `fetch-data.sh` invokes it directly, so `build` and
`build-firebase` both died in ~11 seconds — after the specialist had run the script locally,
repeatedly, and could not have caught it. No amount of local testing can.

Binding on later contracts, Phase 3's `gate/` especially, which adds shell scripts and a
Dockerfile:

- Set the bit explicitly with `git update-index --chmod=+x`, and verify with
  `git ls-files -s` — not with `ls -l`, which lies on this mount.
- Prefer `bash script.sh` over `./script.sh` in CI where the caller is ours, but note that a
  script documented for humans as `scripts/foo.sh` must still carry the bit.
- Audited repo-wide on 2026-09-16: every tracked `*.sh` is now `100755`, and
  `sync-content.sh` was the only instance. Five `.mjs` files carry a shebang while committed
  `100644`, which is **not** a defect: every one is reached through `import` or `node …`,
  never executed directly. A naive grep for `./name.mjs` flags all of them, because an ES
  module import looks identical to a shell invocation — so the guard below must classify by
  how the file is *reached*, not by how its path is *spelled*, or it will be noise.

## Phase 1 review dispositions (Chief Reviewer, PR #12)

All accepted. Owner of each fix in brackets.

| # | Finding | Disposition |
|---|---|---|
| **F1** must-fix | `prevent_destroy` does not stop removal when the budget's block is deleted; rollback step 10 would delete the budget | Correct the texts; rewrite step 10 so no rollback removes `budget.tf`; add a CI presence check for the budget and its guard; record apply provenance (applied commit SHA in STATE) [infra] |
| F2 | Deploy identity omits `roles/serviceusage.apiKeysViewer`, which Firebase documents for CLI deploys | Grant it (read-only; the project has no API keys) so the first deploy follows the documented path; the owner may reverse at Checkpoint 2 [infra] |
| F3 | Custom-role tightening is unsupported for Hosting | Withdraw it; Hosting Admin (+ API Keys Viewer) is the narrowest supported grant [infra; C11 here] |
| F4 | Shared-pool binding safety rests on an unrecorded mapping invariant | State the invariant in `wif.tf` and C12; recommend a separate satellite pool in the Phase 2 ADR [infra; C12 here] |
| F5 | firebase-tools dependency tree resolved at deploy time with no lockfile | Commit a pinned `infra/deploy-tools` package with lockfile; deploy runs `npm ci` from it [infra] |
| F6 | PR #12 body stale | Update after remediation [Lead Architect] |
| F7 | AA-adjusted text colours and a status green not put to the owner | Added to the Checkpoint 2 decisions [Lead Architect] |
| F8 | Test rewrite lost the pre-deploy check that smoke-test routes exist | SEAM-7: site provides `npm run check:smoke-routes`; `build.yml` runs it after each build [site + infra] |
| F9 | Memory-bank sync deferral has no tracked end | Checklist item on issue #10 [Lead Architect] |
| F10 | `check-latest` floats Node on the deploy path | Pin an exact version [infra] |
| F11 | Major action-version bumps on the Pages path are undocumented | Document them; first post-merge run is their verification step [infra; PR body] |
| F12 | Terraform-created default site's type unverified; import line unnecessary | Add a `DEFAULT_SITE` postcondition; drop the import line [infra] |
| F13 | Budget creation needs Billing Account Administrator, not User | Reworded in the Checkpoint 2 decisions [Lead Architect] |
| F14 | Handoff status lines stale | Update after remediation [Lead Architect] |

## Delta review notes (B1–B4) — dispositions

| # | Note | Disposition |
|---|---|---|
| B1 | `budget-guard` skipped on dispatch/schedule/manual runs, so recovery can close the failure issue without it | Run it on every trigger [infra] |
| B2 | Git-ignored Terraform override files can set `prevent_destroy = false` without touching `budget.tf` | Provenance rule checks for override files; `budget-guard` fails on tracked override files [infra] |
| B3 | The locked firebase-tools install is never exercised before the first real deploy | Credential-free CI job running the same `npm ci` and `firebase --version` [infra] |
| B4 | SEAM-7 claimed one source for the smoke routes; `build.yml` keeps two copies | Seam wording corrected; unification stays C13 [Lead Architect] |

Notes only; fixed before merge rather than tracked. No further re-review: none changes
what `terraform apply` creates.

## Apex DNS snapshot before any hub DNS change (2026-09-15T18:29Z)

Runbook step 7 and step 9 compare against these. Public records, recorded here because the
working snapshot lived in temporary storage.

- `cusati.us` MX: `10 aspmx.l.google.com.`, `20 alt1.aspmx.l.google.com.`,
  `30 alt2.aspmx.l.google.com.`, `40 aspmx2.googlemail.com.`, `50 aspmx3.googlemail.com.`
- `cusati.us` TXT: one `google-site-verification=…` record
- `cusati.us` A: `15.197.148.33`, `3.33.130.190` (registrar parking)
- `cusati.us` CAA: none (nothing restricts Hosting's certificate issuer)
- `www.cusati.us`: CNAME `cusati.us.`
- `jason.cusati.us`, `research.cusati.us`: no records
- NS: `ns65.domaincontrol.com.`, `ns66.domaincontrol.com.`

## Checkpoint 2 decisions — resolved (owner, 2026-09-15)

| Decision | Owner's answer |
|---|---|
| `budget-guard` as a required status check on `main` | **Yes** — applied and verified; `main` now requires `governance-checks` and `budget-guard` |
| `roles/serviceusage.apiKeysViewer` on `hub-deploy` | **Keep** |
| AA-adjusted light-theme text colours (muted `#636a68`, caution `#87620d`) and the added status green | **Accept both**; tracker originals stay for non-text use |
| Deploy tool's install scripts and 7 moderate advisories | **Accept for now**; revisit at the next firebase-tools update |
| Terraform state backend | **Local for now**, git-ignored with a private backup; move to a bucket in Phase 2 (C10) |
| `/phd/` in the redirect map | **Leave it in** |
| Two-hop legacy research redirects | **Accept**; host-level redirects come in Phase 6 |
| Font payload (55 woff2 subsets) | **Leave as is**; browsers fetch only what they need |
| Billing role (verified, not a decision) | Owner holds `roles/billing.admin`; the account is open and bills in USD |

## Phase 2 review dispositions (Chief Reviewer, PR #17)

**Verdict: Comment — nothing blocking the merge.** One item blocks **Checkpoint 3**:
the live `WEBSITE_DISPATCH_PAT`. Final report: `handoffs/chief-reviewer-phase-2.md`,
posted to PR #17. (An earlier interim report was posted before the `cv` CI question was
resolved; the final one supersedes it.)

It verified rather than accepted: enumerated every binding in the module rather than reading
the custom role alone, confirmed no authoritative `iam_binding`/`iam_policy` exists that could
replace the conditioned grant, read `upload-cloud-storage` at its pinned SHA to confirm the
no-list property from source, and ran **33 adversarial manifests through both validator ends
— zero disagreements**. It also ran `cv`'s real generator against the hub's real schema.

| Finding | Disposition |
|---|---|
| **B1** live `WEBSITE_DISPATCH_PAT` in `cv` | **Owner, first at Checkpoint 3.** Blocks the phase's central claim, not the merge. Both halves: delete the secret *and* revoke the token. |
| **S1–S4** delta, design doc §9/§11, README debris, binary handoff | **Fixed** (commit `72b9188`), before the final report landed. |
| **S5** satellite-role guard | **Fixed.** Steps added to the existing `budget-guard` job — deliberately not a new job, because `budget-guard` is already a *required* status check and a new one would sit unenforced until branch protection changed. Verified green before wiring. |
| **S6** executable-bit guard | **Fixed**, using the reviewer's rule rather than mine: a shebang-bearing `*.sh` must be `100755`. Spelling-independent, so no false-positive class. 3 files, 0 violations. |
| **S7** draft + labels | **Done.** |
| **S8** normative second-`data`-source rule; `manifest_version` | Rule **made normative in ADR-0008**. `manifest_version` (C20) is a **Phase 3 ADR**. |
| **S9** withdrawal-semantics ADR | **Phase 3**, before a private satellite exists. |
| **S10** no-other-grant Checkpoint 3 checks | **Fixed** in `infra/README.md`. |
| **S11** `cv`'s stale spec | **Fixed** in `cv` — superseded banner, body left unedited. |
| **N4, N5, N7** | **Fixed.** ADR-0008 amendment dated; STATE/activeContext tidied; the `@main` floating-ref decision now stated in `docs/satellites.md`. |
| **N1, N2, N3, N6, N8** | Recorded, no action this phase. |

**Recorded disagreement — governance level.** The final report says **L2** is correct
(highest level touched; ADRs are L1, implementation L2). The interim report asked whether the
PR #12 precedent makes it **L3**, since this PR changes roadmap acceptance criteria. I had
already escalated to L3. Canon is explicit that AI roles may escalate up and **never** down,
so L3 stands; the owner may reclassify to L2. Nothing operational turns on it — L1, L2 and L3
are all human-reviewed and owner-merged.

**Its closing point, unchanged from the interim report:** everything else concerns whether the
boundary is correctly *designed*. The PAT is the one place where it is currently not *true*.

## Checkpoint 3 execution record (2026-09-16)

**Owner decisions taken:** ADR-0008 **approved**. "Section pages render from collections"
**moved to Phase 5** (C26 closed). Deletion of the `cv` secret and variable **authorised**.

**Apply provenance** (`infra/README.md` §Guardrails). Applied from a clean checkout of
`feat/publishing-contract` at **`91b7a39`**, no override file tracked or untracked, plan
reviewed before applying and applied from the saved plan file rather than re-planned:
**9 to add, 0 to change, 0 to destroy** — confirmed, all nine addresses present in state
afterwards. Nothing existing was modified, so Phase 1's resources and the budget are
untouched.

Created: `google_storage_bucket.content` (`cusati-hub-content`),
`google_project_iam_custom_role.satellite_publisher`,
`google_iam_workload_identity_pool.satellites`, the `github-cv` provider, the
`publish-cv` service account, its `workloadIdentityUser` binding, the conditioned bucket
binding, the hub's `objectViewer` grant, and `storage.googleapis.com`.

**Verified against the live project, not the plan:**

| Check | Result |
|---|---|
| `uniform_bucket_level_access` | **true** — so every prefix condition is genuinely in effect. This is the one that fails *open*; had it been false the boundary would have been inert with no error anywhere. |
| `public_access_prevention` | `enforced` |
| versioning / soft delete / lifecycle | enabled / 7 days / noncurrent rules present |
| custom role permissions | exactly `storage.objects.create`, `.delete`, `.get` — **no `list`** |
| project-level roles for `publish-cv` | **none** — this is the leg Terraform structurally cannot prove, since it sees only what it declares |
| user-managed keys on `publish-cv` | **none** |

**Finding — the bucket policy has more than the two bindings the Chief Reviewer predicted.**
Alongside the two intended ones it carries `legacyBucketOwner`, `legacyObjectOwner`
(`projectEditor`, `projectOwner`) and `legacyBucketReader`, `legacyObjectReader`
(`projectViewer`). These are Cloud Storage's automatic defaults on bucket creation, not
anything this module declares, and they are unaffected by uniform bucket-level access.
They do **not** widen the satellite: `publish-cv` holds no project role at all, so it
reaches nothing through them. What they do mean is that **any principal granted project
Viewer on `cusati-hub` can read every object in the content bucket** — today only the
owner. That is acceptable now and would need revisiting in Phase 3, when the private
bucket exists and project-viewer access would be a real exposure. Recorded because the
review's stated expectation and reality differ, and a future reader should not have to
rediscover why.

**Prefix-boundary proofs — RUN AND PASSED 2026-09-16.** The roadmap asks for a *recorded*
test; this is it. Run by impersonating `publish-cv` under a temporary
`serviceAccountTokenCreator` grant, authorised by the owner and **removed immediately
afterwards** — verified removed: the account's only remaining binding is the WIF
principalSet for `cv` `master`.

| # | Check | Expected | Result |
|---|---|---|---|
| 0 | create **inside** `sources/cv/` (positive control) | 200 | **200** |
| 1 | overwrite the same object — the case `objectCreator` alone fails | 200 | **200** |
| 2 | read its own object back | 200 | **200** |
| 3 | create in `sources/phd-milestones/` | 403 | **403** |
| 4 | create at the bucket root | 403 | **403** |
| 5 | create in `sources/cv-other/` — **the trailing-slash probe** | 403 | **403** |
| 6 | list the bucket | 403 | **403** |
| 7 | list its **own** prefix | 403 | **403** |
| 8 | delete its own object | 204 | **204** |

Check 5 proves the condition ends in a slash: a source whose name merely *starts with* `cv`
is refused. Check 7 confirms the satellite cannot enumerate even its own prefix — intended,
since `list` cannot be prefix-restricted, so the only safe grant is none. After check 8,
`ls --all-versions` as the owner showed the noncurrent generations retained, which is the
mitigation ADR-0007 relies on when it accepts that a satellite can delete its own objects.

**A defect in our own runbook, found by running it.** The documented procedure used
`gcloud storage cp` as the satellite and expected the in-prefix writes to succeed. They
cannot: **`gcloud storage cp` requires `storage.objects.list` even for a single
non-recursive file**, including into the satellite's own prefix. The first positive control
failed for exactly that reason and read like a broken boundary. ADR-0007 decision 6 had
recorded this only for `--recursive`; it is broader. `infra/README.md` is rewritten to the
JSON-API form, which exercises the same permissions the real publish path uses. The
documented expected error text was wrong too — denials name `storage.objects.get`/`list`,
not `storage.objects.create`.

**Still outstanding at Checkpoint 3:** revoking the PAT
itself (owner-only); and the merges — `cv` #14, then hub #17, then `cv` #13.

## Test 4 — the end-to-end criterion, half proven (2026-09-16)

The owner merged `cv` #14 then #13. Merging #13 pushed `cv` master, which ran the contract
for the first time for real.

**Satellite half: PASSED, on real infrastructure.** `cv` run 35135238409 completed `success`
including `Publish to the research hub`. 19 objects landed under `sources/cv/`: four variant
PDFs, the full `cv-data/` payload (8 content YAMLs, 4 variants, `own-bib.bib`, the photo) and
`manifest.json`. The manifest declares the four `pdf` items plus `cv-data` as `format: data`,
`schema_version` `"1"`, and **passes the hub's own validator** on both the schema and source
checks. So: WIF auth from a satellite, manifest validation, and a per-file upload by an
identity that cannot list — all exercised for real, not simulated.

**Hub half: proven locally, not yet live.** Downloaded the published objects as owner, fed
them through the hub's own `sync-content.sh --from`: 19 synced, the four PDFs and the photo
staged into `public/`, `astro build` 35 pages, `check:smoke-routes` **7 of 7**, and `npm test`
102 passed / 1 skipped — the structural block *ran*, so it asserted against genuinely
published data rather than a fixture. The hub can consume exactly what `cv` published.

**What is not done:** no hub deploy has served it. `main` is red at `ee81929` from the
bootstrap defect (issue #19), so the live site still serves `22c419a`. Merging PR #20 pushes
`main`, and that build will now find content. Checkpoint 3 is not passed until it does.

**Also found while verifying:** `sync-content.sh` needs curl >= 7.76 and misreports an old
curl as a bucket-listing failure (issue #21). CI is unaffected; it costs a contributor an hour.

## Post-merge defect: the hub could not build on an empty bucket (issue #19)

Merging PR #17 turned `main` red. `build` and `build-firebase` failed on `ee81929`;
`notify-failure` opened #18. **No deploy ran** — all four deploy/smoke jobs skipped — so the
live site was never affected and kept serving `22c419a`.

**Cause.** Checkpoint 3 set `GCP_CONTENT_BUCKET`, so `check` correctly chose the bucket path
on `main`. The bucket is empty, because `cv` #13 (the thing that publishes) is not merged. The
sync handled that gracefully and exited 0 — `no objects under sources/ -- nothing to sync` —
and everything downstream then failed on the empty tree. Reproduced locally: `npm test` → 8
failures, `npm run build` → exit 1, ENOENT in `getStaticPaths` for `/cv/[variant]`.

**Two defects, and I own both.**

1. **I dispositioned the Chief Reviewer's N1 wrongly.** N1 said `npm test` is not hermetic on
   a fresh clone; I recorded "CI is unaffected; a contributor sharp edge." That held only
   while `fetch-data.sh` ran before `npm test` and populated the tree. The moment `main`
   switched to the bucket path, N1 became a CI failure. The reviewer named the defect
   precisely and I misjudged its blast radius.
2. **The build defect was broader and nobody raised it.** The hub could not build at all while
   a claimed `data` source had published nothing. My `fetch-data.sh` fallback covered
   pull-request builds and the pre-apply window, but not the window between enabling the
   bucket and the first publish.

**Fix, on `fix/content-bootstrap`.** A fourth fallback condition in `check`: when the bucket is
reachable but its fingerprint is `empty` — a state `sync-content.sh` already models
deliberately — fall back to the release path. This does **not** weaken the rule that a source
which *has* published and then lost its manifest fails the build; `empty` means no objects at
all, while a vanished manifest leaves objects behind and still fails. Verified by executing the
step across all three input cases. Plus loud skip-guards on the two live-data test files,
preserving A15's intent (they assert against real published data, so a fixture would make them
assert nothing). Verified both ways: with content, 102 passed / 1 skipped, unchanged; with an
empty tree, 94 passed / 9 skipped and **zero failures**, where it was 8 failures before.

**Note on sequencing.** Merging `cv` #13 also clears the red, by publishing and filling the
bucket — and it should be merged. But that treats the symptom: an empty or withdrawn source
would break the build again.

## Checkpoint 3 — PASSED (2026-09-16/17)

**Test 4, end to end.** Merging `cv` #13 pushed `cv` master with no commit to `website`. Its
publish job authenticated through WIF, validated the manifest and uploaded 19 objects under
`sources/cv/` — an identity that cannot list, uploading file by file. The next hub build found
that content and deployed. Live evidence: `content_source: bucket`, `built_from_sha`
`52a8a15` then `0d91a19`, and `/`, `/cv/`, `/cv/academic/`, `/cv/research-professional/`,
`/resumes/`, `/pdfs/academic.pdf`, `/projects/`, `/papers/` all 200.

**Correction to my own account.** I told the owner that merging PR #20 would be what fixed the
red `main`. It was not. `main` recovered hours earlier at `52a8a15` — an unrelated push whose
build found the freshly published content and deployed, after which `notify-recovery` closed
issue #18 automatically at 19:14:58 on 2026-09-16. PR #20 is still the right fix, because
without it an empty or withdrawn source breaks the build again, but it did not restore `main`
and I should not have implied it would.

**PR #20 merged by the Lead Architect on the owner's explicit instruction** ("go ahead and
merge it please", 2026-09-16), the same basis as PR #9. Canon reserves merge authority to the
human owner; the decision was the owner's and the platform action was an agent's. Recorded
here as A11 requires, and the default stands: the owner merges unless they again instruct
otherwise on a specific PR.

**Issues closed:** #18 (CI failure tracking, auto-closed by `notify-recovery`), #19 (the
bootstrap defect, closed by PR #20). **Left open:** #21 — `sync-content.sh` needs curl >= 7.76
and misreports an old curl as a bucket-listing failure. CI is unaffected; it costs a
contributor an hour on a first local sync.

## Phase 3 integration findings (Lead Architect, 2026-09-17)

All four streams reported green. These are the defects that existed **between** them —
none discoverable by a stream validating its own scope, which is the point.

- **The gate could not have started.** `infra/gate.tf` rendered the Cloud Run env var as
  `PRIVATE_BUCKET`; `gate/app/config.py:71` reads `GATE_PRIVATE_BUCKET` and line 73 raises
  `ValueError` when it is empty. Nothing in `gate/` reads the bare name, no gate test pins
  it, and `gate.yml`'s deploy sets no env at all (only `--image`), so nothing would have
  masked it. The revision would have failed its health check at Checkpoint 4 with a message
  pointing at the gate, not at infra. **Fixed in `infra/gate.tf`** — every other gate
  variable already carries the `GATE_` prefix, so infra was the deviant, not the gate.
  `terraform fmt -check` and `validate` pass after the change.

- **The leak check is inert in CI, and was going to stay that way.** It runs on every
  deploy but exits 0 while printing that it proved nothing, because no private item is
  published until Checkpoint 4. The deliberate failing demonstration existed and ran
  nowhere. **Added the `leak-check-self-test` job** to `build.yml`: it publishes the
  committed fixture, builds, and asserts the check *fails* on an injected slug. It runs in
  its own job because `content:fixture` rewrites `site/src/content`, and doing that inside
  `build` or `build-firebase` would put fixture content into the artifact those jobs upload
  to the live site. It gates nothing; promoting it to a required check is a Checkpoint 4
  decision for the owner.

- **`vars.GCP_PRIVATE_BUCKET` was a false alarm.** The site stream flagged it as a name it
  had invented and could not find in infra. `infra/outputs.tf` exports exactly that name in
  `gate_github_actions_variables`. The two streams agreed by coincidence rather than by
  contract, which is worth noting even though the outcome was correct.

- **The leak check was verified failing, by hand.** 9 leaks on the injected build, exit 1 —
  and five of them are content-only hits in `index.html` with no matching path (qualified-id,
  slug, route, source, title). That is the class a path-only check misses, and it is the
  disagreement ADR-0005 settled against the brief's §4 on reasoning alone. It now has
  evidence.

## Phase 3 review dispositions (Chief Reviewer, PR #25)

Verdict **Request changes**; governance audit **DRIFTING**, no blocking audit finding. The
full report is persisted verbatim at `handoffs/chief-reviewer-phase-3.md` and posted to #25.

**Blocking — both fixed.**

- **B-1 — design doc §6 still said the gate SA was the bucket's only reader.** Accepted and
  fixed. §6 requirement 3 carries a dated amendment citing ADR-0010 decision 5 and SEAM-1,
  and ADR-0010's Related Documents now declares the amendment, as ADR-0008 did for §2/§4. The
  reviewer's reasoning is the point: every downstream artifact was amended and the one
  artifact that outranks them was left contradicted, so a Phase 4 contributor "restoring" the
  stated invariant would silently disable withdrawal.
- **B-2 — the two-`srcDir` structure was an undocumented deviation from §5 requirement 4.**
  Accepted and fixed: **ADR-0011** records it, naming the filter alternative and why it was
  rejected, and the module-graph path a filter could never close.

**Should-fix.**

- **S-1 — nothing in the private output links to anything the gate can serve. NOT fixed
  here, deliberately; tracked as its own issue.** Verified independently: five distinct
  targets resolve outside `/p/` (the stylesheet, both `_payload` iframes, both item routes).
  The fix belongs in the follow-up PR that adds the rewrites, because setting Astro's `base`
  to `/p/` interacts with where files are emitted and therefore with the object names the
  sync uploads and the gate resolves — and that cannot be tested against a gate that does
  not exist yet. The guard the reviewer asks for (no link in `dist-private` resolving outside
  `/p/`) would fail today, so it lands with the fix rather than before it.
- **S-2 — the bucket IAM test ran nowhere while three documents said it ran on every push.**
  Fixed: `check_private_bucket_config.py` is now a step in `budget-guard`, which is already a
  required check on `main`, so it binds immediately. The three claims now name the job.
- **S-3 — the sign-in page and the gate disagreed, producing the redirect loop SEAM-3
  forbids.** Fixed, and it was slightly worse than reported: the gate returns **200** with
  `{"status":"not_a_member"}`, so `response.ok` was *true* and a non-member took the success
  branch; the `403` branch was unreachable. The page now branches on the body. SEAM-2 gains
  the `/session` response contract.
- **S-4 — `leak-check-self-test` gates nothing.** Owner action at Checkpoint 4: promoting it
  to a required context is a branch-protection change, not a repository edit.
- **S-5 — `contract/`'s suite ran nowhere in the PR that edits the schema (issue #26).**
  Fixed: a `contract-tests` job in `ci.yml`.
- **S-6 — the memory bank stated things that were false about merged reality.** Fixed:
  PR #17 is no longer "pending merge", canon is v0.9.0 in all three files, and the ADR range
  is 0001–0011.

**Audit findings.**

- **A-1 stale branches — RESOLVED as a non-finding, 2026-09-17.** The remote carries only
  `main`, `feat/private-area`, `fellowship-sprint-notebook` and `fix/derive-education-assertion`.
  `admin/phase-2-closeout` and `fix/content-bootstrap` were deleted at merge:
  `delete_branch_on_merge` is `true` and worked. The reviewer was reading **stale local
  remote-tracking refs**, which it could not have known, because pruning them is a git
  mutation its contract forbade. Pruned. `handoff/research-hub` still must never be deleted.
  Original finding, for the record:
- **A-1 stale branches — report only, no deletion recommended.** `handoff/research-hub` must
  **never** be recommended for deletion: it was never pushed, it is the only copy of its
  commit, and it holds the SHA an Incident A1 purge would need. That `admin/phase-2-closeout`
  and `fix/content-bootstrap` survive after merge is worth checking against
  `delete_branch_on_merge`; three older branches need a PR query the reviewer could not run.
- **A-2 L0 allowlist drift.** Fixed: the three vestigial root denies are annotated and
  retained (so recreating those paths is denied by default rather than unlisted), and
  `CLAUDE.md`, `AGENTS.md`, `CONTRIBUTING.md` and `.gitignore` — covered by no rule at all —
  are now denied.
- **A-3 memory bank.** Fixed as S-6.

**Notes accepted without change**, each recorded rather than actioned: N-1 (`firebaseauth.admin`
is the widest grant in the phase and must not survive Checkpoint 4 quietly), N-3 (the deny-all
Firestore ruleset stays), N-4 (`format: html` in the public output stays unexpanded pending its
own ADR — the reviewer agrees and would have argued for it), N-5 (the deletion ceiling's
denominator is inflated by ~70 public assets, so it is weaker than 34% suggests), N-7 (commit in
`phd-milestones` with `core.fileMode=false`), N-8 (H-5, webfonts from a public CDN on private
pages — an owner decision), N-11 (roadmap criterion 7 is half-unsatisfiable until Phase 4 and
must be recorded **deferred**, not ticked), N-12/N-13 (no sign-out, no rate limit on
`POST /session` — both belong to Phase 4 scope now, while the reasoning is fresh), N-14 (C30),
N-15 (H-4 closed for the material that mattered). N-2, N-6, N-9, N-10 and N-16 were stale
records and are now corrected.


## Audit items the Chief Reviewer could not verify, closed by the Lead Architect (2026-09-17)

The reviewer had no `gh`. These are the checks it named as UNVERIFIABLE, run and closed:

- **Check 4 — governance level.** #25 declares **L3** in its body (the row names the L1 and
  L2 components it mixes) and carries the `gov-L3` label, alongside `implementation`,
  `priority-high`, `security-privacy` and `phase-3-private-area`. The reviewer's judgement
  that L3 is right matches the actual declaration. PASS.
- **Check 7 — platform surface.** `delete_branch_on_merge: true`. Required contexts on
  `main` are exactly `governance-checks` and `budget-guard`; `strict: false`,
  `enforce_admins: false` — which is what the delta's §Platform Enforcement Reality already
  records honestly. All four `gov-L0..L3` labels exist, as do all seven phase labels (42
  labels total). PASS.
- **Consequence worth acting on:** neither `contract-tests` nor `leak-check-self-test` is a
  required context, so both run without gating a merge. Promoting them is a one-time
  branch-protection change and is on the Checkpoint 4 list (S-4).


## Phase 3 — implementation complete, handed to Checkpoint 4 (2026-09-17)

PR #25 is **out of draft** at `d8a2465`, with every check green: `governance-checks`,
`budget-guard`, `contract-tests`, `build`, `build-firebase`, `check`, `deploy-tools`,
`gate/test` and `leak-check-self-test`. Every deploy job is correctly skipped — nothing in
Phase 3 has touched a cloud resource, by design.

**Agents do not merge.** The PR stops here for the owner.

What Phase 3 proved locally, and what it did not:

- **Proved.** The leak check catches content-only leaks with no matching path (verified by
  hand and now on every CI run via `leak-check-self-test`); the public build's router is
  never shown private pages; the gate refuses signed-out and non-member callers on both
  transports across 204 tests; the destructive sync refuses on an empty or unvalidated build
  and deletes exactly a withdrawn item's objects.
- **Not proved, and cannot be until Checkpoint 4.** Every cloud resource. The private sync's
  bucket driver has never executed. The gate has never started. No satellite has published.
  The private area's links do not work yet (issue #27).


## Checkpoint 4 execution record (2026-09-17)

Owner instruction: "just deploy, if I don't like it we'll fix it." Executed by the Lead
Architect. `gcloud` required `CLOUDSDK_PYTHON` pointed at uv's CPython 3.12 (WSL's system
Python is 3.8 and gcloud refuses it) -- worth knowing before the next checkpoint.

- **`terraform apply`: 29 added, 0 changed, 0 destroyed.** One binding failed on the first
  pass -- `privateSyncWriter` did not yet exist in the resource hierarchy when the bucket
  binding was attempted, which is custom-role propagation, not a defect. A second apply
  converged it.
- **The config is NOT idempotent, and this is a real finding.** A third plan reports
  `2 to add, 1 to change, 2 to destroy`: `google_firebaserules_ruleset.firestore_deny_all`
  and its release are **replaced on every apply**, because the API does not return
  `source.language` and the provider then sees `+ language = "FIREBASE_RULES"` as forcing
  replacement. Every apply therefore briefly unreleases the deny-all ruleset protecting
  `members/{email}` -- the protection the Chief Reviewer's N-3 exists for.
  `google_identity_platform_config.hub` also updates in place every run, because the API
  returns a `phone_number` block the config does not declare.
- **The live bucket IAM test had never been run, and failed on its first run -- in the
  CHECK, not the bucket.** It asked gcloud for `uniform_bucket_level_access.enabled` while
  this gcloud returns the field flat, so the projection resolved empty, the tab-separated
  values shifted by one, and UBLA was compared against public access prevention's value
  (`'enforced'`). The bucket is correct: UBLA true, PAP enforced, versioning on, 7-day soft
  delete, 30-day noncurrent rule. Fixed to parse JSON and tolerate both field shapes.
- **`/healthz` is intercepted before it reaches the gate.** `gate.yml`'s smoke test fails
  with `hub-gate /healthz returned 404`. The gate is healthy: revision 00002 is Ready with
  100% traffic on the real digest, and running that exact digest locally returns
  `{"status":"ok"}` on `/healthz`. The 404 body is **1568 bytes of Google's error page**
  (`<html lang=en>`, unquoted) while the gate's own 404 is **329 bytes** (`<html lang="en">`),
  and no `/healthz` request ever appears in the container log -- while `/session` returns 405
  and `/healthz/` returns 307, both from the app. So the path is taken by Google's frontend
  for this service. It does not affect `/p/**` or `/session`, which is what the private area
  uses. The health route needs a different path, or the smoke test does.
- **The satellite published for the first time**, successfully: `manifest.json`,
  `site/index.html`, `site/committee.html` and `site/assets/style.css` are under
  `sources/phd-milestones/`. Before that, `private-sync` correctly refused with **P5 --
  "the build produced 0 private item(s)"** rather than deleting the private area, which is
  ADR-0010 decision 2 versus a build defect being indistinguishable. That refusal was the
  system working, not failing.
- **`firebase.json` now carries the `/p/**` and `/session` rewrites**, which SEAM-6 allowed
  only once the Cloud Run service existed. It does now.


## Sign-in: what works at Checkpoint 4, and what needs the console (2026-09-17)

- **The Firebase Web app did not exist** until Checkpoint 4 — `webApps` returned zero — so
  `/signin/` was deployed rendering its "not configured yet" state and posting nothing. The
  page reads `PUBLIC_FIREBASE_API_KEY`, `PUBLIC_FIREBASE_AUTH_DOMAIN` and
  `PUBLIC_FIREBASE_PROJECT_ID` from the build environment and deliberately invents nothing.
  Created the web app, set the three values as repository **variables** (they are public
  client configuration, not credentials — the key identifies the project to the browser and
  appears in any deployed page using Firebase Auth), and wired them into both public build
  steps. **Setting the variables alone would have done nothing:** `build.yml` did not
  reference them, so the build never passed them to Astro.
- **Email-link sign-in works; the Google button does not.** Identity Platform has email
  enabled and `jason.cusati.us` in `authorizedDomains`, but `defaultSupportedIdpConfigs`
  returns **zero providers**, so `signInWithPopup(GoogleAuthProvider)` will fail. Configuring
  Google needs an OAuth client and consent screen, which is console work and cannot be done
  non-interactively. **Owner action.** Until then the working route is the "Send link" form,
  which is the right one anyway: the allowlist holds `djjay@vt.edu`, while the owner's Google
  identity is `djjay0131@gmail.com` and would produce the "not shared with you" page (SEAM-3's
  matching trap).
- **The allowlist is seeded and verified**: `members/djjay@vt.edu` with `role: owner` and
  `members/cbrown@vt.edu` with no role, both `added_by: djjay@vt.edu`. Those two only.


## Public branding, and one deliberate disclosure (2026-09-17)

- **Virginia Tech colours replace petrol as the accent family** (PR #36, live on
  `eadd904f`). The hex values were read out of VT's own delivered stylesheet
  (`brand.vt.edu` `root.min.css`), where `#861f41` occurs 138 times and `#e5751f`
  36 — not recalled from memory. Maroon leads in light and orange in dark, because
  Chicago Maroon is very nearly black on the dark ground and fails AA as text;
  both are VT primaries, so which one leads is a legibility decision. Contrast
  improved: maroon is 8.39:1 on the light ground where petrol was 7.11, and the
  suite still reports 52 pairs, 0 below AA. `--tracker-petrol` remains **declared
  but consumed by nothing**, because `tokens.test.ts` pins the tracker palette
  verbatim; it paints nothing.
- **`tokens.test.ts` was re-pointed, not gutted.** It had pinned the petrol accent
  and required every site token to map onto the tracker palette — both assertions
  encoded the previous decision. The accent pin now names the VT colours so the
  brand cannot drift a shade at a time, and the mapping rule gained a carve-out
  exactly three tokens wide (`color-accent`, `color-link`, `color-focus`) plus a
  new positive test proving those three resolve to the `--vt-*` ramp. The Phase 3
  review found a test defending a broken value; the lesson cuts both ways, and
  deleting an inconvenient assertion is the same failure wearing the other face.
- **THE DISCLOSURE DECISION.** The public footer now links to `/signin/`. Until
  now nothing on the public site revealed that a members' area exists, and the
  gate's uniform 404 (C29) meant `/p/` was not an existence oracle either. This is
  a deliberate, owner-chosen widening of that: it names no item, no slug and no
  count, so it does not touch ADR-0005's guarantee that no public page lists,
  links or names a private item — the leak check still proves that on every build,
  and `/signin/` keeps `noindex` and stays out of the sitemap. The footer was
  chosen over the main navigation as the smallest disclosure that still makes it
  findable. Recorded here because "the private area's existence is undisclosed"
  was previously true and is now, deliberately, not.
- **The VT logo and the HokieBird are NOT used, and must not be added casually.**
  `brand.vt.edu` states downloading the logos "is permitted by authorized
  employees and external parties with approval from the Virginia Tech Office of
  Licensing and Trademarks. Unauthorized use of these trademarks is prohibited."
  Colours are not trademarks; the marks are. A logo may be added only once the
  owner confirms permitted use.
- Open, owner's call: adding VT's open-source brand fonts (`@fontsource/crimson-text`
  and `@fontsource/rubik`, both OFL-1.1, the same licence as the three already
  self-hosted); and `#c64600`, VT's own darkened orange, which would let orange
  carry text in the light theme — `#e5751f` is ~3:1 on paper and is decorative only.


## Risks carried forward

1. **Base-path + tree migration (Phase 1).** Current site is GitHub Pages at
   `djjay0131.github.io/website/`, `base: '/website/'`. Moving to `site/` and
   to `/` on `jason.cusati.us` shifts every link, asset and sitemap entry; inbound
   `/website/...` links break. `main` already carries more than the smoke-test
   routes: PR #8 moved research under `/research/soa-agentic-se/**` and added
   `astro.config.mjs` redirects whose targets hardcode `/website/`. Site work owes
   a redirect map and route parity for every route in the current build.
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
8. **Local and CI canon can diverge.** CI pins canon by SHA; the plugin
   auto-updates locally (delta §Canon Location).
9. **Shared owner token + enforce_admins off** — any agent session can push to
   `main`; the controls are procedural.
10. **Two CV fetches per run.** The Pages and Firebase builds each fetch the `cv`
    latest release seconds apart; a release replaced in that window can leave the
    hosts briefly out of step until the next scheduled poll.
11. **The tracker and dossier themselves likely fail AA** where they set ink-3 text on
    paper or brass text on brass-soft (the same pairings the site had to adjust).
    They live in `phd-milestones`; address when it becomes a satellite (Phase 3).
12. **Mail on `cusati.us`.** The domain carries Google Workspace MX records. Hub DNS work
    adds records for `jason.` and `research.` only; the apex, `www`, MX and TXT records are
    never changed (ADR-0006).
13. **Cookie collision with a future family site** setting `__session` on
    `Domain=cusati.us` (ADR-0006).
14. **PARTLY CLOSED 2026-09-16 — the repository half is done; the token is not.** On the
    owner's authorisation the Lead Architect deleted the `cv` repository secret
    `WEBSITE_DISPATCH_PAT` and the variable `WEBSITE_REPO`; `cv` now holds zero Actions
    secrets and zero variables beyond the four publish variables. **The token itself may
    still be valid in the owner's GitHub account and can only be revoked there**
    (github.com/settings/tokens). Until it is, a credential with write access to the hub
    exists, merely no longer stored in the satellite. Original finding:
    **`WEBSITE_DISPATCH_PAT` existed in `cv` (verified 2026-09-16).** Not hypothetical:
    `gh api repos/djjay0131/cv/actions/secrets` returns it, created 2026-08-17, and the
    variable `WEBSITE_REPO = djjay0131/website` is set beside it. Per `build-cv.yml`'s own
    comment it is "a PAT with `repo` scope on the website repo" — a long-lived credential
    giving a satellite write access to the hub. This is the exact condition ADR-0007
    forbids, principle 3 prohibits, and domain review question 2 asks about, and it is live
    now. **Deleting the workflow step does not remove it**, and any future workflow in `cv`
    could use it. Remediation has two halves, both the owner's: delete the repository secret
    (and the `WEBSITE_REPO` variable), *and* revoke the token itself at
    github.com/settings/tokens — removing the secret alone leaves a valid token in the
    account. Raised rather than done, because revocation is account-level and deleting a
    secret is irreversible.
15. **`cv`'s CI is red on a fresh install, and this blocks Checkpoint 3.** Confirmed
    independently: `pyproject.toml` asks for `bibtexparser>=1.4.1` unbounded, PyPI's current
    release is 2.0.1, and it removed the v1 API `tools/lint_bib.py` uses
    (`bibtexparser.bparser`). A fresh `pip install -e ".[dev]"` gives 36 failed / 147 passed.
    Every job in `build-cv.yml` depends on `tests`, so the publish job **can never run** and
    the satellite path cannot be verified at Checkpoint 3. Entirely unrelated to Phase 2;
    found while integrating it. Prepared as its own PR in `cv` (`fix/bibtexparser-pin`,
    one line, no behaviour change) rather than buried in the publishing PR. Migrating to the
    v2 API is a separate change and a separate issue.

    **Correction, 2026-09-16 — I overstated this.** I wrote that the pin "restores green CI"
    before the full run had finished. What is actually established, at commit `5ee7515`:
    the pin **does** fix the `Python tests & lint` job, and the **push-event run
    (35052550773) is fully green**, all four Compile jobs passing. But the
    **pull_request-event run (35052617717) failed** — so PR #14 shows red. The cause is not
    the pin and not Phase 2: `xelatex` **segfaulted**. latexmk reports the exit code divided
    by 256, and `0.54296875 × 256 = 139 = 128 + 11 = SIGSEGV`. The "Missing character …
    SimpleIcons.otf" lines in that log are a red herring: the **passing** run contains 22 of
    them and still completes, and `settings.sty` and `cv-llt.tex` both document that hazard
    and work around it deliberately. Failed jobs were re-run to distinguish flake from a
    deterministic crash. **Verdict: flake.** Re-run of the identical commit, with no changes
    of any kind, finished `success` with all four Compile jobs green — including the three
    that had failed. So `cv` PR #14 is green, the pin does what it claims, and there is no
    defect in `cv` to fix beyond the pin itself. The segfault is environmental.

    **What this means for Checkpoint 3:** `cv`'s publish job runs only on
    `push` to `master` (`if: github.ref == 'refs/heads/master' && github.event_name !=
    'pull_request'`), and the push path is green with the pin. So publishing can work even
    while the PR check is red — but the owner should not merge a red PR on my say-so, and the
    crash needs to be understood first.
16. **`cv`'s CI is not reproducible.** Every action in `build-cv.yml` floats on a tag —
    `actions/checkout@v4`, `setup-python@v5`, `upload-artifact@v4`, `download-artifact@v4`,
    `softprops/action-gh-release@v2`, and critically `xu-cheng/latex-action@v3`, which supplies
    the whole TeXLive image. Two runs minutes apart on identical content can therefore build
    against different toolchains, which is a plausible mechanism for the xelatex segfault in
    Risk 15 hitting one run and not the other. The hub pins every action by commit SHA
    (Phase 1 SEAM); `cv` does not. Worth an issue in `cv` regardless of how the segfault
    resolves — it also means a retagged action can change that pipeline with no commit.

## Follow-ups

- **A dev/staging site is needed, and Phase 3 proved why (owner, 2026-09-17).** The private
  area cannot be looked at before it is deployed: the gate needs Cloud Run, Identity Platform
  and a real session, so there is no way to review the members' area as a member without
  either shipping it or hand-rolling a local mount. During this session the owner — working
  over SSH, with no local browser — could not view a local preview at all, and the only
  reviewable artifact was a text render. That is not a sustainable review loop for a feature
  whose entire point is what a signed-in person sees. A dev site (its own project or its own
  Hosting site + gate revision, with its own allowlist and fixture content) should be scoped
  before Phase 4 adds shares, which multiplies the number of states that can only be seen
  live. ADR candidate: whether dev is a separate GCP project or a second Hosting target in
  the same project, and how its budget is bounded.

- **The private area's links resolve outside `/p/` — the members' area is unreachable as
  built.** Roadmap criterion 1 fails at Checkpoint 4 unless this lands with the rewrites.
  Fix, both halves required: set the private build's base so Astro emits `/p/_astro/…`, and
  prefix `routeFor()` and `payloadUrlFor()` in `site/src-private/lib/private-content.mjs`,
  which build raw strings Astro's base does not touch. Update the two assertions in
  `private-content.test.ts` that currently pin the broken values, and add the guard: no link
  in `dist-private` may resolve outside `/p/`. Chief Reviewer S-1, and the single thing the
  report says to look at before merging.
- **Checkpoint 4 owner actions**, beyond the apply itself: flip `phd-milestones` to
  `required: true` in `EXPECTED_SOURCES` after its first successful publish (until then C27
  is not closed for the only source it was written for); promote `leak-check-self-test` to a
  required status check (S-4); narrow `roles/firebaseauth.admin` (N-1); confirm
  `phd-milestones` is private on GitHub — the Chief Reviewer could not, and if it is public
  the entire boundary argument is moot; and run the prefix-boundary test's reverse leg **as
  `cv`**, the direction where a defect would let a public satellite reach private source
  material.
- **Prove the private sync's bucket driver on its first run, in this order** (Chief Reviewer,
  Part C): after the first successful `private-sync`, confirm the dry run's delete list is
  empty against an empty bucket; then withdraw one item deliberately and confirm the next dry
  run names exactly that item's objects and no others **before** the apply step runs. Cheap
  while the bucket is nearly empty; do not skip to trusting it on a full one.

- The tarball follow-up formerly here (delete it in Phase 3) is **withdrawn**: it
  is now immediate — see Blocked, A1.
- Delete the merged remote branches (`gov/establish-hub`, `feat/foundation`,
  `admin/phase-0-bookkeeping`) — administrative cleanup, with the owner's word.
- Keep the local `handoff/research-hub` branch until the Incident A1 purge is confirmed (it holds
  the commit SHA the request needs).
- C17: normalise the redirect-domain duplicate check.

From the Phase 2 infra stream (2026-09-16):

- **`roles/storage.objectViewer` does not include `storage.buckets.get`.** It is enough to
  list and download objects, but any hub code that reads *bucket metadata* will 403. The
  infra stream implemented SEAM-4 as written rather than widening the grant. Verify at
  Checkpoint 3, and keep the hub's sync to object operations only.
- **A `satellite-role-guard` CI check is recommended**, mirroring `budget-guard`: assert the
  custom role holds exactly its three permissions and that `uniform_bucket_level_access` is
  `true`. These are the two invariants whose breakage is invisible — a missing UBLA makes
  every prefix condition inapplicable, so the boundary fails **open** with no error anywhere.
  `build.yml` belongs to the `site` stream this phase, so this lands at reconciliation or in
  Phase 3.
- **Terraform remote state (C10) is now unblocked.** The owner's Checkpoint 2 decision was to
  move state to a bucket in Phase 2; Cloud Storage is enabled and this module now creates
  buckets, removing the reason it was deferred. It is not in the roadmap's Phase 2 scope, so
  it needs the owner's word rather than being absorbed silently.
- **Custom role `deletion_policy = "PREVENT"`**: a destroyed custom role locks its ID for 7–37
  days, which would block all publishing with no way to apply out of it.

**Checkpoint 3 owner actions (2026-09-16).** In order:

1. **Revoke `WEBSITE_DISPATCH_PAT`** (Risk 14) — delete the `cv` repository secret and the
   `WEBSITE_REPO` variable, then revoke the token at github.com/settings/tokens. Do this
   first: it closes a live credential, and it is independent of everything else here.
2. Merge **`cv` PR #14** (`bibtexparser<2`). Until it lands, `cv`'s CI is red on a fresh
   install and no job in `build-cv.yml` runs, so the satellite path cannot be exercised at
   all (Risk 15).
3. `terraform apply` in `infra/` from a clean checkout of the reviewed head; record the SHA.
4. Set `GCP_CONTENT_BUCKET` in `website`, and the four publish variables in `cv`
   (`GCP_PROJECT_ID`, `GCP_WIF_PROVIDER`, `GCP_PUBLISH_SA`, `GCP_CONTENT_BUCKET`).
5. Run the three prefix-boundary proofs from `handoffs/infra-phase-2.md` (cannot write
   outside `sources/cv/`, cannot list, can overwrite on republish).
6. Merge the hub PR #17, then `cv` PR #13. A `cv` push then publishes; the next hub poll
   deploys.

From the Phase 2 `cv` stream (2026-09-16):

- **`cv` has two divergent memory banks**, `memory-bank/` and `llm/memory_bank/`. The stream
  updated both rather than pick a winner. Which one governs is `cv`'s question, not the hub's,
  but it should be settled before `cv` adopts governance.
- **`build-cv.yml` has 3 pre-existing `actionlint` findings** (lines 8, 54, 94), none in the
  code Phase 2 added, and its existing actions are pinned by tag rather than SHA. Out of scope
  here; worth an issue in `cv`.
- **Checkpoint 3 ordering changed:** merge `cv`'s `fix/bibtexparser-pin` PR **first**, or
  `cv`'s CI stays red and the publish job cannot run at all.
- **A guard for the executable bit.** Nothing in the repo checks it, and the one defect that
  reached CI in Phase 2 was exactly this. A cheap check — assert every tracked `*.sh`, and
  every tracked file beginning `#!`, is mode `100755` — would have caught it before push. It
  belongs alongside `budget-guard`, which exists for the same reason: an invariant whose
  breakage is invisible where it is authored. Deferred out of Phase 2 because `build.yml`
  was the site stream's file and the Chief Reviewer is mid-review.

Opened during Phase 3 (2026-09-17):

- **Issue #26 — `contract/`'s test suite never runs in CI.** Found while adding
  `manifest_version`: I ran the suite locally (57/57), then went looking for the CI job that
  would confirm it and there isn't one. `build`/`build-firebase` run `npm test` with
  `working-directory: site`; `deploy-tools` installs firebase-tools; nothing invokes
  `contract/`'s `node --test`. So the schema, the dependency-free validator the publish action
  actually runs, the 13 rejection fixtures and the fixture-coverage guard are verified only by
  hand. Same shape as the exit-126 defect and the non-hermetic tests: passes locally,
  unguarded on the runner. Not fixed now because `build.yml` belongs to the in-flight `site`
  stream; lands at reconciliation or as its own PR.
- **`firebase.json` rewrites are deliberately absent from this PR** and are a Checkpoint 4
  sequencing item. Hosting rejects a configuration naming a Cloud Run service that does not
  exist, so merging with `/p/**` and `/session` rewrites would break the **public** site's
  deploy, not merely the private area. They land once `hub-gate` is live.
- **The shared example fixture still names the real private item, and it is load-bearing.**
  The `satellite-phd` stream found (H-4) that the public worked example used
  `phd-milestones` / `committee-dossier` / "Twelve vetted external committee candidates,
  ranked." The two **prose** files are fixed — `docs/satellites.md` and `contract/README.md`
  now use a neutral placeholder. `contract/examples/manifest.example.json` is **not** fixed,
  deliberately: it is asserted as the design doc §4 example verbatim
  (`validate.test.mjs:95`), its `source` value is asserted at `:293`, the site suite reads it
  too, and **eleven** invalid fixtures are derived from it and carry the same slug. Changing
  it cascades across 11 fixtures and two test files, breaks a stated seam property, and
  collides with the in-flight `site` stream which also reads them.

  This is **propagation, not a new leak**: the identifiers and that summary have been public
  in design doc §4 since 2026-09-10, and the Chief Reviewer flagged §4's example at Phase 0
  (finding A1). The question for the owner and the reviewer is whether §4 itself, and the
  fixture derived from it, should be re-worded — which is a design-authority change, not a
  tidy-up, and should not be made mid-phase by an agent.
- **Checkpoint 4 action — flip `phd-milestones` to `required: true`** in the hub's
  `EXPECTED_SOURCES` after its first successful publish. Declaring it required before it has
  ever published would fail the hub build on a source whose prefix does not exist yet
  (ADR-0010 decision 4) — the same bootstrap shape as issue #19.
- **The private pages load webfonts from a third-party CDN** (`satellite-phd` finding H-5).
  A signed-in member reading private material therefore makes a request to that CDN, which
  learns the reader's IP and the referring page. Not fixed: it would mean editing seed
  content, which this phase's contract forbids. It is a real privacy property of the private
  area and the owner should decide whether to self-host those fonts — the hub already
  self-hosts its own via @fontsource.

Decisions and flags from the Phase 3 `infra` stream (2026-09-17):

- **Open question (a) resolved in the ADR's favour.** The roadmap clause and SEAM-1 are
  amended; ADR-0010 decision 5 stands. Recorded above.
- **The stronger form, for the owner.** A dedicated `private-sync` identity would mean the
  **public** site's deploy identity holds no private-bucket access at all. Not taken
  unilaterally — it needs a second auth step in `build.yml`, which is the site stream's file.
  It is the available tightening if the owner wants it.
- **`projectViewer` can read every private object.** Cloud Storage's automatic legacy
  bindings apply to the private bucket as they do to the content bucket. That was accepted at
  Checkpoint 3 for public content; on a bucket holding the committee dossier it needs an
  explicit owner decision. Today the only project Viewer is the owner.
- **`roles/firebaseauth.admin` on the gate is wider than needed.** Session-cookie minting
  requires `firebaseauth.users.createSession` and no narrower *predefined* role was
  confirmable from a primary source in this environment. Tightening to a custom role is a
  Checkpoint 4 command in the infra handoff.
- **A deny-all Firestore ruleset was added beyond the contract's deliverables**, and it is
  kept. Without it `members/{email}` — two real email addresses — is readable by any
  signed-in stranger through the public sign-in page's Web SDK. Beyond-scope work, flagged
  honestly by the stream rather than smuggled in.

From the Phase 3 `gate` stream (2026-09-17):

- **SD-3 — CLOSED by the Lead Architect.** The gate was granted `roles/datastore.user`
  (read **and** write) on the reasoning that Phase 4 shares would need write. Verified instead:
  `gate/app/` contains no Firestore write of any kind — the only call sites are the import, the
  client, and one `.document(key).get()` per request. Narrowed to `roles/datastore.viewer`.
  Granting write now for a capability a later phase might need is the wrong trade when the
  privilege is write access to the allowlist itself.
- **SD-4 — there is no way to sign out.** A 14-day `HttpOnly` session cookie with no in-band
  clear: a member on a shared machine cannot end their own session. Not in any Phase 3
  acceptance criterion, and not built. It belongs with the Phase 4 session work.
- **SD-7 — `dist-private` filenames must match the gate's path allowlist** (`[A-Za-z0-9._-]`
  per segment) or the file is unreachable: it syncs fine, the build is green, and a signed-in
  member gets 404. Undocumented in the contract, the seams and ADR-0005. Sent to the `site`
  stream mid-flight; it should fail the private build on a violating segment.
- **A defect in my own contracts, across the whole sprint.** Ten contracts told agents to run
  bare `gh` (`gh issue view 24`). **`gh` is not on this machine's PATH** — only a Windows
  binary the Lead Architect invokes by full path. The gate stream could not read issue #24 and
  said so. Everything it needed was in the repository, so nothing was lost, but the instruction
  was wrong in every contract that carried it. Corrected in the reviewer contract; future
  contracts must not assume `gh`.

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
