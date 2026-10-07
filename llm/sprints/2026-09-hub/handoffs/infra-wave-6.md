# Handoff — `infra`, Wave 6 (annotations)

Status: Delivered
Date: 2026-10-07
Stream: `infra` (`infra/gate.tf`, `infra/README.md`)
Branch: `feat/annotations`
Contract: `llm/sprints/2026-09-hub/contracts/infra-wave-6.md`
Seams: `llm/sprints/2026-09-hub/contracts/wave-6-annotations-seams.md` (AN-IAM); ADR-0021 decision 4; ADR-0022 (Proposed)
Issue: #107
Planned by: `terraform` 1.16.4 (`/home/djjay/.local/bin/terraform`), local state, live project `cusati-hub`

## Summary

The finding held: `google_project_iam_member.hub_gate_firestore` already grants
`hub-gate` project-wide `roles/datastore.user`, and Firestore data roles are
project-level, so that one binding reaches the new `annotations/{id}` collection
exactly as it reaches `shares/{token}`. **No second binding was added** — a
second member+role pair is not a narrower grant, it is the same grant, which the
API reports as already present and Terraform shows as a needless plan change.

The change is **comment-only**: one comment block at the existing grant naming
`annotations/` as the second store the role reaches, citing ADR-0021 decision 4
and recording that no export credential is created (ADR-0022, Proposed; hard
stop). `infra/README.md`'s `gate.tf` row, which names the gate's Firestore
collections, was updated in the same way. No resource, variable, output or
`.tf` logic changed. **This edit must produce a no-op plan**, and it did
(exit code 0, "No changes").

`fmt -check` and `validate` are clean. No `apply` was run and none is needed.

## Comment diff

### `infra/gate.tf` (at `google_project_iam_member.hub_gate_firestore`)

```diff
 # The grant described at point 2 above. The role changed 2026-10-03 (Phase 4
 # sharing): datastore.user, so the gate can write shares/{token}. See the
 # comment block at the head of this file for why a collection-scoped grant is
 # not expressible and why the delete permission is accepted.
+#
+# WAVE 6 (annotations; ADR-0021 decision 4). This same project-wide grant also
+# reaches `annotations/{id}` -- the second store the gate writes, after
+# `shares/{token}` -- exactly as it reaches shares/: Firestore data roles are
+# project-level and no collection-scoped spelling exists, so NO second binding
+# is added. A second google_project_iam_member for the same member+role is not a
+# narrower grant; it is the same grant, which the API reports as already present
+# and Terraform shows as a needless plan change. The control is the collection
+# discipline (one writer class per collection; deny-all released rules), exactly
+# as SEAM-S5 records for shares.
+#
+# NO EXPORT CREDENTIAL IS ADDED HERE. The cross-repository export transport is
+# ADR-0022, still Proposed, and a hard stop (§9/§7): this wave creates no GitHub
+# App, PAT, WIF provider, service account or IAM binding for export. v1 ships
+# only the credential-free render (`POST /annotations/export`).
 resource "google_project_iam_member" "hub_gate_firestore" {
   project = var.project_id
   role    = "roles/datastore.user"
   member  = google_service_account.hub_gate.member
 }
```

### `infra/README.md` (`gate.tf` row, "What this module manages")

```diff
-... Firestore read/write — `datastore.user` since Phase 4 sharing, for the
-allowlist read and the `shares/{token}` write — and session minting) ...
+... Firestore read/write — `datastore.user` since Phase 4 sharing, for the
+allowlist read and the `shares/{token}` and `annotations/{id}` writes —
+ADR-0021 decision 4 adds no new binding, because the project-wide role already
+reaches a second collection — and session minting) ...
```

(Text wrapped here for readability; the README line is a single table row.)

## Verification

Run from `infra/`, local state (`terraform.tfstate`), authenticated against
`cusati-hub`.

| Command | Result |
|---|---|
| `terraform fmt -check` | exit **0** — no files need formatting |
| `terraform validate` | exit **0** — `Success! The configuration is valid.` |
| `terraform plan -detailed-exitcode -out=/tmp/opencode/wave6.tfplan` | exit **0** (detailed-exitcode `0` = **no changes**) |

### Plan summary (exact)

The saved plan is a clean no-op. Because nothing changes, Terraform prints its
short form rather than a `Plan: N to add...` line:

```
No changes. Your infrastructure matches the configuration.
Terraform has compared your real infrastructure against your configuration
and found no differences, so no changes are needed.
```

That is **0 to add, 0 to change, 0 to destroy**, as the contract requires.
Exit code `0`. `google_project_iam_member.hub_gate_firestore` refreshed
unchanged (`id=cusati-hub/roles/datastore.user/serviceAccount:hub-gate@cusati-hub.iam.gserviceaccount.com`);
no resource anywhere in the 93-line refresh/plan output shows a `-/+ destroy and
then create` (replace), a `- destroy`, or a `+ create`. **No destroy or replace
anywhere.**

Plan output saved outside the repo at `/tmp/opencode/wave6.tfplan` (and stdout
log at `/tmp/opencode/wave6.plan.txt`); neither is committed.

## Notes / residual

- **No new IAM, no export credential.** Nothing for export (GitHub App, PAT,
  WIF provider, service account or binding) was created, and the ADR-0022 hard
  stop was not crossed.
- **No apply.** The plan is a no-op, so there is nothing to apply; none was run.
- Only `infra/gate.tf` and `infra/README.md` were edited. `gate/**` and
  `site/**` were not touched, and no `git`/`gh` command was run by this stream.
- If a later plan is ever run from a state where the grant is missing, it would
  show one `+ create` for this one binding — still no destroy/replace.

## Related docs

- `infra/gate.tf` (`google_project_iam_member.hub_gate_firestore`)
- `infra/README.md` (`gate.tf` row)
- `llm/sprints/2026-09-hub/contracts/infra-wave-6.md`
- `llm/sprints/2026-09-hub/contracts/wave-6-annotations-seams.md` (AN-IAM, AN-EXPORT)
- `llm/governance/adr/0021-annotations-private-item-notes.md` (decision 4)
- `llm/governance/adr/0022-annotation-export-transport.md` (Proposed; hard stop)
