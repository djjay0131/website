# Contract — `infra`, Wave 4 (Phase 5: `construction-ai`)

Status: Issued
Date: 2026-10-03
Owner: Lead Architect
Stream: `infra` (`infra/**`)
Issue: `hub-005`
Branch: `feat/construction-ai`
Seams: `llm/sprints/2026-09-hub/contracts/phase-5-seams.md` (SEAM-C1)

## Purpose

Add the `construction-ai` satellite roster entry so its GitHub Actions can
authenticate through WIF and write only `sources/construction-ai/`.

## Scope

- `infra/variables.tf` (the `satellites` default map)
- `infra/README.md` if it enumerates the roster
- any satellite-count assertion in guards/tests

Do NOT touch the private bucket, the ruleset/release, existing SAs/providers/
bindings, or the budget.

## Requirements

1. Add to the `satellites` map, keyed `construction-ai`:
   `repository = "djjay0131/construction-ai-proposal"`,
   `repository_id = "1134376420"`, `repository_owner_id = "5666389"`,
   `default_branch = "master"`. The values come from the GitHub REST API, read
   live and recorded, not from the brief.
2. Terraform derives, unchanged: provider `github-construction-ai` (pool
   `satellites`), display name fallback `GitHub: construction-ai`,
   SA `publish-construction-ai`, WIF condition pinning repository id + owner id +
   name and refusing `pull_request_target`, impersonation binding pinned to
   `refs/heads/master`, and the content-bucket binding using
   `satellite_publisher` with the `startsWith('…/sources/construction-ai/')`
   condition.
3. No project-level role for the satellite; no `list`. The inline satellite guard
   in `.github/workflows/build.yml` and `infra/scripts/check_private_bucket_config.py`
   must stay green.
4. `terraform fmt -check` and `terraform validate` clean.

## Evidence

A **read-only** `terraform plan` (the stream does not apply; the Lead Architect
applies under D5/D11). The plan must add exactly: the WIF provider, the SA, the
`workloadIdentityUser` impersonation binding and the conditioned bucket binding
(4 to add), with **0 to destroy / 0 to replace** of any stateful resource
(buckets, Firestore DB, Identity Platform config, ruleset/release pair, service
accounts, WIF pools, budget, and every existing satellite resource). Paste the
summary lines into the handoff. Stop and report if any existing stateful resource
appears in the action set.
