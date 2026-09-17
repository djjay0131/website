# Active Context

Status: Draft
Last updated: 2026-09-16
Owner: Chief Architect

What belongs here: the current focus, the current stop point, and next steps —
what a contributor needs to pick up work today.

## Current position

- Sprint `2026-09-hub`: **Phase 3 — Private area is MERGED and DEPLOYED** (issue #24,
  PR #25, plus PR #29 for the Checkpoint 4 wiring). The Chief Reviewer's verdict was
  *Request changes* on two documentary findings; both were fixed before merge.
  **Checkpoint 4 has been executed**: 29 cloud resources created, the gate deployed to
  Cloud Run, `phd-milestones` published for the first time, and 81 objects synced to the
  private bucket with 0 deletions. The members' allowlist holds `djjay@vt.edu` (owner) and
  `cbrown@vt.edu`, those two only.
- **Sign in at `https://jason.cusati.us/signin/` using the "Send link" form as
  `djjay@vt.edu`.** The Google button will fail until the OAuth provider is configured in
  the console (issue #31), and the owner's Google identity `djjay0131@gmail.com` is not on
  the allowlist in any case.
- Open after Checkpoint 4: **#27** (private-area link base — fixed and merged, verified by
  `check:private-links`), **#30** (`terraform apply` is not idempotent: the Firestore
  deny-all ruleset is replaced every run, briefly unreleasing the rules that protect
  `members/{email}`), **#31** (Google sign-in provider not configured).
- Sprint `2026-09-hub`: **Phase 2 — Publishing contract is COMPLETE.** Checkpoint 3 passed
  2026-09-16/17; the hub serves the CV through the contract. (issue #16,
  PR #17, branch `feat/publishing-contract`). Reviewed — Chief Reviewer verdict *Comment,
  nothing blocking the merge*. All six required checks green.
- Phase 1 — Foundation is complete. PR #12 merged 2026-09-15; Checkpoint 2 verified live the
  same day. The Email and Privacy pages merged (PR #15) and are live at `/email/` and
  `/privacy/`.
- The hub is live at **https://jason.cusati.us** on Firebase Hosting, deployed from `main`
  through Workload Identity Federation; `https://research.cusati.us` 301-redirects to it
  (paths preserved). GitHub Pages still serves until Phase 6.
- **Checkpoint 3 is part done.** On the owner's authorisation the Lead Architect deleted
  `cv`'s `WEBSITE_DISPATCH_PAT` secret and `WEBSITE_REPO` variable, applied `infra/` from a
  clean checkout at `91b7a39` (9 added, 0 changed, 0 destroyed), set the Actions variables in
  both repositories, and ran the prefix-boundary proofs — 9 of 9 as expected, under a
  temporary impersonation grant that was removed and verified removed.
  **Do not re-apply and do not re-delete: both are done.** Evidence: `STATE.md`
  §Checkpoint 3 execution record.
- **Stop point:** the rest of Checkpoint 3 is the owner's alone — revoke the PAT *token* at
  github.com/settings/tokens (deleting the repository secret did not), then merge `cv` #14,
  hub #17, `cv` #13, in that order. Agents do not merge.
- Orchestration state: `llm/sprints/2026-09-hub/STATE.md`.

## Decisions on record

- Q1 — domain `cusati.us`, **amended by ADR-0006:** the hub is at `jason.cusati.us`
  (canonical); `research.cusati.us` redirects to it; `cusati.us` and `www` are reserved
  for a family site.
- Q2 — GCP project `cusati-hub` (number 410552878319) on the owner's personal account,
  created 2026-09-15, billing linked (Blaze).
- Q5 — the Astro app moves under `site/`: proposed in ADR-0001, approved by
  merging PR #9.
- ADRs 0001–0011: `llm/governance/adr/`. ADR-0007 settles how a publish reaches the hub —
  the hub polls the content bucket and no satellite holds a GitHub credential for `website`,
  closing the contradiction ADR-0002 left open. ADR-0008 adds the `data` format and corrects
  design doc §2: `cv` is public, default branch `master`. ADR-0009 lands `manifest_version`
  optional first; ADR-0010 fixes withdrawal semantics (the manifest is the authority, and a
  private withdrawal must actually stop serving); ADR-0011 records that the private build is a
  second `srcDir` rather than a visibility filter, amending design doc §5 requirement 4.
- Roadmap: `llm/master-roadmap.md`.

## Open

- Design doc §10 Q3, Q4, Q6.
- **ADR-0008 needs the owner's eye at Checkpoint 3.** It amends design doc §4 to add a `data`
  format, knowingly weakening §3's "the hub never needs to know how a satellite built its
  output" for that one format, because the CV is data the hub renders rather than a document
  `cv` renders. The alternative preserving §3 completely is costed in the ADR.
- Design doc §10 Q3, Q4, Q6.
- Brief / design-doc / canon conflicts K1–K12 (`STATE.md`). K13 is closed by ADR-0007.

## Governance adoption

- 2026-09-14: adopted agentic-governance **v0.9** (canon `VERSION` 0.9.0; the pin moved
  from 0.8.3 by PR #22, and `.github/workflows/ci.yml` pins canon at `851a50a`) via
  `/governance:establish` — issue #7, branch `gov/establish-hub`.
- Governance delta: `llm/governance/governance-delta.md`. Steward merge
  authority: INACTIVE.
