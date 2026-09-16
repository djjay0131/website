# Research Hub — Orchestration State

Status: Active
Last updated: 2026-09-15
Owner: Chief Architect (Lead Architect)

**Sprint:** 2026-09-hub · **Mode:** 3 (Ultracode) · **Level:** L2 for the work streams; **L3 for PR #12** (roadmap requirement changes — delta review 2, Part D)
**Design authority:** `llm/specs/2026-09-10-research-hub-design.md`
**Brief:** `llm/plans/2026-09-10-research-hub-orchestration-brief.md`

Machine-specific paths are never written here. `<canon checkout>` means the path
declared in `llm/governance/governance-delta.md` §Canon Location.

---

## Current position

**Phase 1 — Foundation. COMPLETE** (Checkpoint 2 passed 2026-09-15; PR #14 merged, issue #10
closed). The hub is live at `https://jason.cusati.us`. **In progress:** the Email and Privacy
pages (issue #13), which the owner requested. **Phase 2 has not started** and waits for the
owner's go.

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

- **Email and Privacy pages PR** (#13): awaiting CI, then the Chief Reviewer
  (`contracts/chief-reviewer-email-privacy-pages.md`), then the owner's merge.

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

Owner:

1. **Go / no-go for Phase 2.** Before its contracts: decide the satellite → hub dispatch
   credential (ADR-0002 conflict; STATE C1, K13) — the constraint proposed is that no
   satellite holds any GitHub credential for `website`.
2. Approve or amend the OpenClaw Email wording (#13).
3. Remaining Checkpoint 2 decisions (§Decisions for the owner at Checkpoint 2), notably
   whether `budget-guard` becomes a required status check.

Lead Architect, after the relevant go: OpenClaw pages (#13) on their own branch; hub-002
(Phase 2) with contracts that encode the owner's dispatch-credential decision; C17 fix.

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

## Follow-ups

- The tarball follow-up formerly here (delete it in Phase 3) is **withdrawn**: it
  is now immediate — see Blocked, A1.
- Delete the merged remote branches (`gov/establish-hub`, `feat/foundation`,
  `admin/phase-0-bookkeeping`) — administrative cleanup, with the owner's word.
- Keep the local `handoff/research-hub` branch until the Incident A1 purge is confirmed (it holds
  the commit SHA the request needs).
- C17: normalise the redirect-domain duplicate check.

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
