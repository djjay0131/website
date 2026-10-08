# Contract — `infra`, Wave 6 notes-sync (D18)

Status: Issued
Date: 2026-10-07
Owner: Lead Architect
Stream: `infra` (`infra/**`)
Issue: #107
Branch: `feat/annotations-sync`
Seams: `contracts/wave-6-notes-sync-seams.md`
Design: ADR-0022 (amended, Accepted)

## Purpose

Grant the gate SA read access to the `notes-export-app-key` secret and set the
gate's notes-sync configuration. **All changes are adds/updates only — no
destroy, no replace.** The plan/apply follows the two owner hard stops (the
secret must exist first).

## Scope

- `infra/notes-sync.tf` (new), `infra/gate.tf` (env block additions),
  `infra/README.md`

Do NOT touch `gate/**` or `site/**`.

## Requirements

1. **Secret Manager accessor (adds only).** Grant `hub-gate`
   `roles/secretmanager.secretAccessor` on the secret **`notes-export-app-key`**
   in `var.project_id`. Use `google_secret_manager_secret_iam_member` with
   `secret_id = "notes-export-app-key"`. **Do not create the secret** — the owner
   creates it (`gcloud secrets create`), so Terraform must not own it. If the
   provider requires the secret to exist to plan, that is expected and the plan
   runs **after** owner step 2; `terraform validate` must pass now.
2. **Gate env (updates only).** On `google_cloud_run_v2_service.gate`, add:
   - `GATE_NOTES_EXPORT_ENABLED = "1"`
   - `GATE_NOTES_APP_ID = var.notes_export_app_id`
   - `GATE_NOTES_INSTALLATION_ID = var.notes_export_installation_id`
   - `GATE_NOTES_SECRET_NAME = "notes-export-app-key"`
   - `GATE_NOTES_ROUTING` = the contents of `site/notes-routing.json` (read with
     `file("../site/notes-routing.json")`), so routing has ONE source of truth.
   Add `variable`s for the App id and installation id (default empty), with the
   defaults documented. These are identifiers, not secrets.
3. **No other IAM, no key file.** No GitHub Actions secret, no service-account
   key, no new service account.
4. **Plan.** Run `terraform fmt -check`, `terraform validate`. Once the secret
   exists (owner step 2), a saved `plan -out=…` must be **adds only** (secret
   accessor binding + the gate service env update); paste the summary. If any
   destroy/replace appears, **stop and report** — do not apply.

## Evidence

`handoffs/infra-wave-6-notes-sync.md`: fmt/validate results; the plan summary and
exit code (or an honest "plan awaits the owner's secret").

## Exit

Terraform written and validated; plan/apply deferred to after the owner steps.
No credential is created by this stream.
