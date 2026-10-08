# Pattern — secrets are synced to Secret Manager by a workflow, never by hand

Status: Active
Owner: Lead Architect
Adopted: 2026-10-08 (owner decision D19)
Authority: this document is control plane; it governs how this repository and
its services handle credentials. Where a tool or a runbook disagrees, this wins.

## The rule

**No human ever runs `gcloud secrets …` (or `aws secretsmanager …`, or a
provider console) to put a secret in place.** A secret follows this path, and
only this path:

1. **The secret lands in GitHub once.** The owner pastes it into the repository's
   GitHub Actions secrets (`Settings > Secrets and variables > Actions`). That
   paste is the *only* manual act; it exists because no API can create a
   provider credential or mint its key.
2. **A workflow syncs it to the secret store.** A dedicated workflow
   (`.github/workflows/secrets-sync.yml` here) reads the GitHub secret,
   authenticates to the cloud with the existing keyless Workload Identity
   Federation identity, and writes it into the managed secret store. It adds a
   new version and disables the prior versions.
3. **Terraform binds access.** The identity that will *read* the secret at
   runtime is granted the narrowest role on that one secret
   (`roles/secretmanager.secretAccessor`), by Terraform — reviewed, in the diff,
   and in state.
4. **The runtime reads it from the secret store.** The service reads the value
   from Secret Manager via its own identity (ADC on Cloud Run/GCE). The value is
   never an environment variable, never in the image, never in Terraform state.
5. **Nobody runs `gcloud` by hand.** No runbook step, no "ask the owner to run
   this command". If a step needs a credential, it is a workflow.

## Why (the failure this prevents)

A secret created by hand is invisible to review: it is not in the diff, not in
state, and the only record is a shell history. It also cannot be rotated without
the same manual ceremony, so it never is. Moving the write into a workflow makes
the secret's lifecycle reviewable and repeatable, and moving the *read* into
Terraform makes the access path least-privileged and auditable.

## The security invariants every implementation of this pattern must hold

- **No `pull_request` trigger on the sync workflow.** Only `workflow_dispatch`
  and a `push` to `main` (ideally scoped with `paths:` to the workflow file).
  Forks do not receive repository secrets, and a PR event must never run code
  that can read one.
- **The value is never printed.** No `echo`, no `set -x`, no step output, no
  artifact, no command-line argument. Write it to a `0600` temp file under
  `umask 077` and remove it with an `EXIT` trap. GitHub additionally masks
  `secrets.*` in the log.
- **Least privilege on the sync identity.** `secretmanager.secrets.create` is
  project-scoped (a secret cannot be scoped before it exists), so a project-level
  role is the fallback; the version-management and IAM-policy permissions belong
  on the one secret as soon as the provider allows it. Record any broadening and
  open a narrowing follow-up.
- **The read identity gets access, not the sync identity's role.** The runtime
  gets `roles/secretmanager.secretAccessor` on the secret; the sync identity is
  not a reader of values it did not create.
- **A missing GitHub secret is a clean no-op.** The first step tests for the
  empty string (an unset repository secret resolves to `""`, not an error) and
  skips every credentialed step, so a fresh install is green.

## Reference implementation in this repository

- Workflow: `.github/workflows/secrets-sync.yml` (D19).
- Secret: `notes-export-app-key` in project `cusati-hub`, read by the gate
  runtime identity `hub-gate`; created and versioned by the workflow running as
  `gate-deploy`; the Terraform binding is `infra/notes-sync.tf`.
- The identity grants the workflow needs are in `infra/secrets-sync.tf`.
- Terraform state is remote (`gs://cusati-hub-tfstate`, `infra/versions.tf`) so a
  runner can apply; a backend bucket is a one-time bootstrap.

## Applying the pattern to a new secret (checklist)

1. Add the GitHub secret (and any non-secret identifiers as repository
   variables), and print the exact name for the owner.
2. Add the sync to `secrets-sync.yml` (or a sibling workflow with the same
   trigger and hygiene rules) — one secret, one name, no sharing.
3. In Terraform, grant the runtime identity `secretmanager.secretAccessor` on
   that secret.
4. Confirm the workflow no-ops green with the secret unset, then dispatch it.
5. Record the secret's name and reader in the service's runbook (never its
   value).

## Applying it to the family site

The family site follows the same five steps with its own project, its own
`secrets-sync.yml`, and its own WIF identity. It does not share this project's
secret store or identity, and it does not run `gcloud` by hand either.
