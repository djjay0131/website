# Active Context

Status: Draft
Last updated: 2026-09-23
Owner: Chief Architect

What belongs here: the current focus, the current stop point, and next steps —
what a contributor needs to pick up work today.

## Current position

- Sprint `2026-09-hub`: **Wave 0 of the run-to-completion is MERGED** (issue #44).
  `main` is at `01bc7cd` and green on all three workflows. Apply provenance:
  `63fc0d3`, applied 2026-09-23.
- Merged in order, each `main` run watched before the next: **#45** (the record,
  D1–D9, ADR-0012/0013/0014) → **#48** (astro 6→7, SD-4's caller) → **#65** (link
  guard narrowed) → **#53** (auth-role narrowing, `GATE_ALLOWED_ORIGINS`) → **#67**
  (`roles/editor` emptied, #55) → **#47** (gate sign-out).
- **Sign-out is live.** Same-origin `POST /session/end` returns 200 on both
  transports, cross-origin 403. SD-4 is closed.
- **The gate is narrowed.** It holds only `gateSessionMinter` (two permissions) and
  `datastore.viewer`; `roles/firebaseauth.admin` is gone. `roles/editor` is empty
  project-wide, so the private bucket's legacy `projectEditor` path grants nobody
  anything.

## The one thing only the owner can do

**A1 remains open, and it is the last criterion no agent can verify.**

Sign in at **https://jason.cusati.us/signin/ as `djjay@vt.edu`** and reach `/p/`.

- Both providers now work: `google.com` is configured and **enabled**, and
  email-link (`signIn.email.enabled`) is **true**. Verified 2026-09-23 — this is
  what lifted D-3, and it makes issue #31 stale.
- **The identity matters more than the method.** The allowlist holds `djjay@vt.edu`
  and `cbrown@vt.edu`, those two only. The machine's Google identity
  `djjay0131@gmail.com` is **deliberately not a member** — signing in as it will
  correctly get the "not shared with you" page. If `djjay@vt.edu` is not a Google
  account, use the "Send link" form.

**Why this cannot be delegated.** Session *minting* is still unproven. An invalid
token never reaches `createSession`, so the 401 that was verified shows only that
the gate reaches the Admin SDK without a permission error under the narrowed role.
A real sign-in is the only thing that exercises `firebaseauth.users.createSession`
on the new `gateSessionMinter` role.

Also owner-only: the **alert-channel verification link**. Four policies are enabled
and may deliver nothing until it is clicked.

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
