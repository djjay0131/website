# Contract — adversarial round, D19 secrets-sync

Status: Issued
Date: 2026-10-08
Owner: Lead Architect
Owner decision: **D19** — all secrets are handled by a GitHub workflow, never by a
manual `gcloud` step.
Branch: `feat/secrets-sync`
Design authority: `llm/governance/adr/0022-annotation-export-transport.md` (§5,
amended on D19); pattern `llm/governance/patterns/secrets-management.md`.

One contract for the round. Each agent reports separately under
`llm/sprints/2026-09-hub/handoffs/<agent>-d19-secrets-sync.md`. **No fixing**;
report with transcripts and file:line pointers.

## Artifacts under test

- `.github/workflows/secrets-sync.yml` (new): trigger, auth, secret sync, the
  adds-only Terraform apply.
- `infra/secrets-sync.tf` (new): the workflow identity's grants.
- `infra/versions.tf` (backend), `infra/notes-sync.tf` (the accessor binding).
- `llm/governance/adr/0022-annotation-export-transport.md`,
  `llm/governance/patterns/secrets-management.md`, `docs/secrets-management.md`.
- `llm/sprints/2026-09-hub/STATE.md` §D19.

## Red Team (attempt exfiltration)

1. **Exfiltrate via a crafted workflow change in a PR.** Author a PR that edits
   `.github/workflows/secrets-sync.yml` (or another workflow) to print or upload
   `NOTES_EXPORT_APP_KEY`. Determine whether the PR itself runs anything with the
   secret, and what protects the pre-merge and post-merge cases. Enumerate the
   exact triggers of every workflow on the branch and say which can read a
   repository secret.
2. **Exfiltrate via the sync path.** Try to make the workflow echo the value: a
   crafted `gcloud` response, a failing command under `set -x`, an artifact, a
   step output, a job summary, a temp-file leak, a core dump, or a `mktemp`
   collision.
3. **Trigger manipulation.** Can an attacker add a `pull_request`,
   `pull_request_target`, `workflow_run` or `issue_comment` trigger through a PR,
   or dispatch the workflow on an attacker branch, and reach the secret?
4. **Terraform-path abuse.** Can the adds-only apply (running as `gate-deploy`,
   with project-level `secretmanager.admin` and state access) be steered to read
   or write something it should not — state tampering, a wide apply, a target
   that leaks a value into plan output or state?
5. **Least privilege.** With `roles/secretmanager.admin` project-level, what can
   the identity read today, and what does the narrowing follow-up (#112) need to
   cover?

## Security Tester (VETO)

Own the gate. PASS / FAIL / NOT TESTED for each:

1. The key cannot leak via logs, artifacts, step outputs, job summaries, or a
   temp-file residue (the value is never echoed; no `set -x`).
2. There is **no** `pull_request` (or `pull_request_target`, `workflow_run`,
   `issue_comment`) trigger; the secret is unreachable from a fork.
3. The workflow no-ops green with the secret absent (unset secret = empty string,
   all credentialed steps skipped).
4. The workflow identity cannot read a secret it did not create — state the
   project-level-`secretmanager.admin` caveat and whether #112 closes it.
5. The accessor binding is the runtime's (`hub-gate`), secret-scoped
   `secretAccessor` only; no key file; no credential in state.
6. The Terraform changes are adds-only (no destroy/replace of a stateful
   resource), and the state backend is the one declared.

## Deliverables

Each agent writes its handoff (Summary · Assumptions · Recommendations ·
Alternatives · Risks · Open questions · Related docs · ADR candidates) and
reports a concise verdict to the Lead Architect. No git/gh/gcloud/terraform
mutation; read the committed working tree only.
