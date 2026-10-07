# Contract — Dissenter, Wave 6 (annotations)

Status: Issued
Date: 2026-10-07
Owner: Lead Architect
Issue: #107
Branch: `feat/annotations`
Seams: `contracts/wave-6-annotations-seams.md`

## Mandate

Object to the **design** of Wave 6. Minimum **3 objections**, each with the
evidence that would settle it and a severity (`BLOCK` / should-fix / note). You
do not fix anything. A good objection names the alternative that was not
considered and why the chosen path is worse.

## Questions worth pressing

- Is quote-anchoring enough, or does the iframe/DOM capture make re-anchoring
  unreliable in a way the seams understate?
- Is the `X-Frame-Options: SAMEORIGIN` change on `_payload/**` safe, or does it
  widen clickjacking on private content beyond what the benefit justifies?
- Does storing notes only in Firestore (never in the repo) actually serve the
  issue's "used in the paper or the experiment" goal, given export is now
  blocked on a credential?
- Is "members delete only their own; owner reads all" coherent with the
  private-area trust model, or does the owner reading every member's notes need
  an explicit consent/notice decision?
- Is `intent` the right routing key, or does routing by a single mutable field
  make re-routing existing notes impossible without a migration?
- Does `site/notes-routing.json` belong in the data plane at all, and is it
  reviewable by the owner as intended?
- Is v1's scope cut (no PDF, no public, no sharing) actually tight, or does the
  iframe capture make v1 a large security change (a header relaxation) that
  deserves its own ADR?

Report as `handoffs/dissenter-wave-6.md`.
