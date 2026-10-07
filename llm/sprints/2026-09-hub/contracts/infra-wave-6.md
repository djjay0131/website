# Contract — `infra`, Wave 6 (annotations)

Status: Issued
Date: 2026-10-07
Owner: Lead Architect
Stream: `infra` (`infra/**`)
Issue: #107
Branch: `feat/annotations`
Seams: `llm/sprints/2026-09-hub/contracts/wave-6-annotations-seams.md`
Design: ADR-0018; ADR-0021 decision 4

## Purpose

Confirm, in Terraform, that the annotations store needs **no new IAM** — the
role ADR-0018 granted already covers it — and prove the plan is a no-op. There
is no destroy, no replace and no create.

## Scope

- `infra/gate.tf` (comment only)
- `infra/README.md` if it names the gate's Firestore collections

Do NOT touch `gate/**` or `site/**`.

## Requirements

1. **No new IAM.** `google_project_iam_member.hub_gate_firestore` already grants
   `hub-gate` project-wide `roles/datastore.user`, which reaches `annotations/`
   exactly as it reaches `shares/` (Firestore has no collection-scoped role).
   Add a comment at the grant naming `annotations/` as the second collection the
   role covers and pointing at ADR-0021 decision 4. Do **not** add a second
   member binding for the same member+role (Terraform would report it already
   exists; a duplicate binding is also a plan change for no benefit).
2. **Prove the no-op.** Run `terraform fmt -check`, `terraform validate`, and a
   saved `terraform plan -detailed-exitcode`; the summary must be **0 to add, 0
   to change, 0 to destroy** (a comment-only edit changes nothing in state).
   Paste the summary and the `-detailed-exitcode` value in the handoff.
3. **No credential or cross-repository IAM.** The export transport is ADR-0022
   (Proposed) and a hard stop; do not create a GitHub App, PAT, WIF provider,
   service account or binding for export. If a plan shows any destroy or replace
   anywhere, **stop and report** — do not apply.

## Evidence

`handoffs/infra-wave-6.md`: `fmt`/`validate` clean, the saved-plan summary, the
exit code, and the comment diff.

## Exit

Comment landed; plan proven 0/0/0. No apply is needed for this wave (there is
nothing to change), and none is run without the owner where §7 applies.

## Out of scope

The gate code, the header change, the site island, routing, and every export
credential.
