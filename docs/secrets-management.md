# Secrets management — how secrets reach this project (derived view)

This is a **derived view**. The authority is the control-plane document
`llm/governance/patterns/secrets-management.md`; if this page and that document
disagree, that document wins and this page is corrected.

The rule, in short: a secret is pasted into the repository's GitHub Actions
secrets once; a workflow syncs it to Secret Manager; Terraform binds the runtime
identity to that one secret; the runtime reads it from Secret Manager. Nobody
runs `gcloud` by hand. See `llm/governance/patterns/secrets-management.md` for
the invariants, the reference implementation (`secrets-sync.yml`,
`notes-export-app-key`), and the checklist for adding a new secret.

Owner decision D19 (2026-10-08); recorded in `llm/governance/adr/0022-annotation-export-transport.md`.
