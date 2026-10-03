# Handoff — `infra`, Wave 3 (Phase 4 sharing)

Status: Delivered
Date: 2026-10-03
Stream: `infra` (`infra/**`)
Issue: `hub-004`
Branch: `feat/sharing`
Contract: `llm/sprints/2026-09-hub/contracts/infra-wave-3.md`
Seams: `llm/sprints/2026-09-hub/contracts/phase-4-seams.md` (SEAM-S5)

## Summary

The gate's runtime identity now holds `roles/datastore.user` instead of
`roles/datastore.viewer`, so `FirestoreShareStore` can write `shares/{token}`.
Firestore data roles are project-level and IAM cannot scope a grant to a
collection, so the grant necessarily also reaches `members/`; the control that
keeps the gate from writing the allowlist is the `FirestoreShareStore` class
plus the deny-all released rules (SEAM-S5), not the role. `datastore.user`
includes delete, which the store does not use, and that is named and accepted
rather than implied.

`terraform fmt -check` clean, `terraform validate` clean, the credential-free
guard green. The read-only plan shows exactly one action: the IAM member role
swap. **0 stateful resources change; the firestore ruleset and its release do
not appear in the plan's action set.**

## What changed

- **`infra/gate.tf`**
  - `google_project_iam_member.hub_gate_firestore.role`:
    `roles/datastore.viewer` → `roles/datastore.user` (`gate.tf:170`).
  - The `ROLES GRANTED` comment block, point 2 (`gate.tf:75-113`), rewritten to
    record: the re-widening is deliberate and is the change SD-3 (2026-09-17)
    explicitly deferred ("Phase 4 changes this line when Phase 4 needs it");
    why a collection-scoped grant is not expressible in IAM (Firestore data
    roles are project-level) and that the collection discipline is
    `FirestoreShareStore` + the deny-all released rules (SEAM-S5); and that
    `datastore.user` includes delete, which the store does not use, accepted
    over a bespoke custom role because no predefined role carries only
    create/get/update/list and the custom-role permission set cannot be
    confirmed from a primary source (the same reasoning that rejected the
    read-only custom role), with no scoping gained since Firestore custom roles
    are project-level too.
  - A short comment above the resource pointing back at point 2.
- **`infra/README.md`** — the `gate.tf` row now says the runtime identity holds
  "Firestore read/write — `datastore.user` since Phase 4 sharing, for the
  allowlist read and the `shares/{token}` write".
- **`llm/sprints/2026-09-hub/contracts/security-tester-wave-0.md`** — checklist
  item 4's role line corrected `datastore.viewer` → `datastore.user`, with a
  dated `CORRECTED 2026-10-03` note (authorised by the contract).

**Deliberately not changed:** `infra/firestore.tf` (ruleset, release, and
`ignore_changes = [source[0].language]` all untouched). No binding, SA, WIF
pool/provider, bucket, service, budget, API or custom-role change.

## Plan summary (exact lines)

```
  # google_project_iam_member.hub_gate_firestore must be replaced
-/+ resource "google_project_iam_member" "hub_gate_firestore" {
      ~ etag    = "BwZcK7OGJOc=" -> (known after apply)
      ~ id      = "cusati-hub/roles/datastore.viewer/serviceAccount:hub-gate@cusati-hub.iam.gserviceaccount.com" -> (known after apply)
      ~ role    = "roles/datastore.viewer" -> "roles/datastore.user" # forces replacement
        # (2 unchanged attributes hidden)
    }

Plan: 1 to add, 0 to change, 1 to destroy.
```

`google_project_iam_member` is immutable across a role change (the role is part
of the resource `id`), so the provider renders the swap as a replace
(`-/+`), not an in-place update. This is the create+destroy-of-the-binding shape
`gate.tf` already describes for the `hub_gate_session_minter` rename; it is a
non-stateful IAM member, not a data-bearing resource. **Nothing else appears in
the action set.** The ruleset and release are only refreshed (normal), never
planned for change or replacement. No bucket, Firestore database, Identity
Platform config, service account, WIF pool/provider, budget or `kgis` resource
is added, changed, replaced or destroyed.

## Guard results

```
$ cd infra && terraform fmt -check
$ echo $?
0

$ terraform validate
Success! The configuration is valid.

$ python3 infra/scripts/check_private_bucket_config.py
OK: private bucket declares uniform bucket-level access and enforced public access prevention, names no anonymous principal, and carries exactly two bindings -- the gate (storage.objects.get) and the hub's sync (create/delete/get/list). The CI auditor role holds exactly projects.getIamPolicy, buckets.get and buckets.getIamPolicy, and no storage.objects.* permission of any kind.
```

The guard does not assert the datastore role (confirmed by reading
`check_private_bucket_config.py`: it asserts the two bucket custom roles, the
gate session-minter permissions, forbidden predefined auth roles, the auditor
role, and `GATE_ALLOWED_ORIGINS` — nothing about `datastore.*`), so the role
change does not touch it.

The plan was read-only: `terraform plan -input=false -lock=false -no-color`,
against the pinned provider `hashicorp/google 8.2.0` from the committed lock
file. No `-out`, no apply.

## Assumptions

- The contract's phrase "one in-place IAM member change" means one IAM member in
  the plan; the provider's replace semantics for a role change are the expected
  rendering, not a second resource. This is stated because a reviewer scanning
  for "0 to destroy" should read that count as the IAM member's old binding,
  not a stateful resource.
- `roles/datastore.user` is the narrowest predefined Firestore role that grants
  write; it is the same role SD-3 reverted from, and Phase 4 is the phase that
  comment said would re-add it.
- The Firestore Admin SDK writes `shares/{token}` under the gate SA and bypasses
  security rules, so the released deny-all rules constrain browser clients, not
  the gate; the gate's own write boundary is the `FirestoreShareStore` class.

## Risks

- **The grant reaches `members/` as well as `shares/`.** This is unavoidable at
  project-level IAM. A flaw in the gate's share path could in principle write a
  member document. Mitigation is code-level (`FirestoreShareStore` is the only
  Firestore writer added in Phase 4) and was accepted in the contract; the plan
  makes the widening explicit and the comment names it.
- **`datastore.user` includes delete**, which the store does not use. Accepted
  over a custom role (reasoning above). If the custom-role question is ever
  settled from a primary source, tightening it is a Checkpoint item, as the
  original comment noted for the `firebaseauth.admin` case.
- **Shared worktree.** During this stream, `gate/**` and `firebase.json` showed
  as modified in the same working tree, written concurrently by the gate and
  site streams. Those changes are **not** this stream's and were not touched by
  it. They do not affect the Terraform plan (no infra input reads them). Any PR
  built from this worktree must separate the streams' files; the `infra` PR is
  only `infra/gate.tf`, `infra/README.md` and the authorised
  `security-tester-wave-0.md` correction.

## Open questions

- None blocking. The gate contract's open question 4 (this exact IAM widening)
  is closed by this change; its other open questions are the gate stream's.

## Related docs

- `llm/sprints/2026-09-hub/contracts/infra-wave-3.md` (this stream's contract)
- `llm/sprints/2026-09-hub/contracts/phase-4-seams.md` (SEAM-S5)
- `llm/sprints/2026-09-hub/handoffs/gate-wave-3.md` (open question 4)
- `llm/sprints/2026-09-hub/contracts/security-tester-wave-0.md` (item 4)
- `infra/gate.tf`, `infra/firestore.tf`
