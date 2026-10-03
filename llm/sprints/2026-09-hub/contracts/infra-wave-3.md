# Contract — `infra`, Wave 3 (Phase 4 sharing)

Status: Issued
Date: 2026-10-03
Owner: Lead Architect
Stream: `infra` (`infra/**`)
Issue: `hub-004`
Branch: `feat/sharing`
Seams: `llm/sprints/2026-09-hub/contracts/phase-4-seams.md` (SEAM-S5)
Design: design doc §6 responsibility 4; ADR-0004

## Purpose

Give the gate runtime identity what it needs to read **and write** the
`shares/{token}` documents, and nothing it does not. The share store currently
cannot write: `hub-gate` holds `roles/datastore.viewer` only.

## Scope

- `infra/gate.tf` (the one IAM grant and its comment)
- `infra/README.md` if it records the gate's roles
- `llm/sprints/2026-09-hub/contracts/security-tester-wave-0.md` line stating the
  gate's roles (this is a stale-record correction the contract authorises)

Do NOT touch `infra/firestore.tf` — the deny-all ruleset and its release stay
exactly as they are; the `ignore_changes = [source[0].language]` at
`firestore.tf:143-145` is what keeps the release stable across applies.

## Requirements

1. **The grant.** In `infra/gate.tf:154-158`, change
   `google_project_iam_member.hub_gate_firestore` from `roles/datastore.viewer`
   to `roles/datastore.user`. Record in the comment why: Firestore data roles are
   project-level and a collection-scoped grant cannot be expressed in IAM
   (`gate.tf:101-103`); the collection discipline is the `FirestoreShareStore`
   class plus the deny-all released rules (SEAM-S5). `datastore.user` grants the
   entity create/get/update/list the store uses and delete it does not — the
   delete permission is accepted and named rather than implied.
2. **No broader change.** No other binding, SA, WIF pool/provider, bucket,
   service, budget or API changes. In particular do not touch
   `google_firebaserules_ruleset.firestore_deny_all` or its release.
3. **No secret, no key.** Nothing is created or committed that is a credential.
4. **Guard compatibility.** `infra/scripts/check_private_bucket_config.py` must
   stay green (it does not assert the datastore role; confirm). `terraform fmt
   -check` and `terraform validate` clean.

## Evidence

- `terraform fmt -check` and `terraform validate`.
- A **read-only** `terraform plan` (no apply by the stream; the Lead Architect
  applies under D5/D11). The plan must show the Firestore IAM member change and
  **0 to destroy / 0 to replace** of any stateful resource (buckets, Firestore
  DB, Identity Platform config, ruleset/release pair, service accounts, WIF
  pools/providers, budget, the four live `kgis` resources). If the ruleset or
  its release appears in the plan, stop and report.
- The exact plan summary lines pasted into the handoff.

## Exit

One in-place IAM member change; plan summary recorded; nothing applied by the
stream. The Lead Architect applies after the Wave 3 PR merges.
