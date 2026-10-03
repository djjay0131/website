# Handoff — `infra`, Wave 4 (Phase 5: `construction-ai`)

Status: Delivered
Date: 2026-10-03
Stream: `infra` (`infra/**`)
Issue: `hub-005`
Branch: `feat/construction-ai`
Contract: `llm/sprints/2026-09-hub/contracts/infra-wave-4.md`
Seams: `llm/sprints/2026-09-hub/contracts/phase-5-seams.md` (SEAM-C1)

## Summary

One roster entry keyed `construction-ai` was added to `var.satellites`. Terraform
derives the four resources per satellite unchanged: the WIF provider
`github-construction-ai` in the `satellites` pool, the service account
`publish-construction-ai`, the `roles/iam.workloadIdentityUser` impersonation
binding pinned to `refs/heads/master`, and the `satellitePublisher` bucket
binding conditioned to `sources/construction-ai/`. No project-level role and no
`list`; the provider condition pins repository id `1134376420`, owner id
`5666389`, name `djjay0131/construction-ai-proposal`, and refuses
`pull_request_target`.

The IDs and branch were read live from the GitHub REST API (recorded below), not
copied from the brief. `terraform fmt -check` and `terraform validate` are clean,
`check_private_bucket_config.py` and the inline satellite guard are green, and the
read-only plan adds exactly **4, with 0 to change and 0 to destroy**. No
stateful/existing resource appears in the action set. **Not applied** — the Lead
Architect applies under D5/D11.

## Diff

`git diff --stat` (no other files touched):

```
 infra/README.md    |  2 +-
 infra/variables.tf | 21 +++++++++++++++++++++
 2 files changed, 22 insertions(+), 1 deletion(-)
```

**`infra/variables.tf`** — appended a fifth entry to the `satellites` default
map, after `agentic-kg-research`, in the existing per-entry comment style:

```hcl
    # Satellite 5 (D10, 2026-10-03). PUBLIC repository (private: false read
    # live), PRIVATE items: ... (SEAM-C4) ...
    #
    # The key is construction-ai, NOT the repository name: the SA is named
    # publish-<key> and a service-account ID is at most 30 characters, while
    # publish-construction-ai-proposal would be 32 (SEAM-C1). ...
    construction-ai = {
      repository          = "djjay0131/construction-ai-proposal"
      repository_id       = "1134376420"
      repository_owner_id = "5666389"
      default_branch      = "master"
    }
```

**`infra/README.md`** — the `satellites` row in the Variables table enumerated
the roster (and was already stale at "two entries"); updated to the five real
entries and the per-entry branch/key notes:

```
- | `satellites` | no | two entries, `cv` and `phd-milestones` | ... `cv` is `master`, `phd-milestones` is `main` |
+ | `satellites` | no | five entries: `cv`, `phd-milestones`, `kgis`, `agentic-kg-research`, `construction-ai` | ... `cv` and `construction-ai` are `master`, ... The key is independent of the repository name (`kgis` for `agentic-kgis`, `construction-ai` for `construction-ai-proposal`) |
```

**Deliberately not changed:** `infra/satellites.tf` (every resource is
`for_each = var.satellites`; not one character changed), the private bucket, the
ruleset/release, existing SAs/providers/bindings, and the budget. No
satellite-count assertion exists in any guard or test (the inline guard's
`satellite_bindings` is computed dynamically and asserts `>= 1`, not a fixed
count); `EXPECTED_SOURCES` is not touched (SEAM-C5: add only after first publish).

## GitHub API values (live, recorded)

```
$ gh api repos/djjay0131/construction-ai-proposal \
    --jq '{id, owner_id: .owner.id, default_branch}'
{"default_branch":"master","id":1134376420,"owner_id":5666389}

$ gh api repos/djjay0131/construction-ai-proposal --jq '{private, full_name}'
{"full_name":"djjay0131/construction-ai-proposal","private":false}
```

Matches the contract: `repository_id = 1134376420`,
`repository_owner_id = 5666389`, `default_branch = master`.

## Plan summary (exact lines)

Read-only `terraform plan -no-color` (no `-out`; refresh only, no state write):

```
Plan: 4 to add, 0 to change, 0 to destroy.
```

The action set is exactly the four derived resources, all keyed
`["construction-ai"]` and all `will be created`:

```
  # google_iam_workload_identity_pool_provider.satellite["construction-ai"] will be created
  # google_service_account.satellite_publish["construction-ai"] will be created
  # google_service_account_iam_member.satellite_publish_wif["construction-ai"] will be created
  # google_storage_bucket_iam_member.satellite_publish_prefix["construction-ai"] will be created
```

Selected derived values from the plan, confirming the SEAM-C1 boundary:

```
provider  workload_identity_pool_provider_id = "github-construction-ai"
SA        account_id = "publish-construction-ai"
binding   role = "roles/iam.workloadIdentityUser"
          member = "principalSet://.../attribute.repository_id_ref/1134376420/refs/heads/master"
bucket    role = "projects/cusati-hub/roles/satellitePublisher"
          condition.expression = "... resource.name.startsWith('projects/_/buckets/cusati-hub-content/objects/sources/construction-ai/')"
```

Outputs change only by gaining a `construction-ai` key in the four satellite
maps (`satellite_github_actions_variables`, `satellite_prefixes`,
`satellite_publish_service_accounts`, `satellite_workload_identity_providers`);
no resource update/destroy/replace of any existing or stateful resource. The
budget, buckets, Firestore DB, Identity Platform config, ruleset/release pair,
existing service accounts, WIF pool/providers and every existing satellite
resource are absent from the action set.

## Guard results (verbatim)

`cd infra && terraform fmt -check` → exit 0. `terraform fmt -check -recursive`
→ exit 0. `terraform validate`:

```
Success! The configuration is valid.
```

`python3 infra/scripts/check_private_bucket_config.py` → exit 0:

```
OK: private bucket declares uniform bucket-level access and enforced public access prevention, names no anonymous principal, and carries exactly two bindings -- the gate (storage.objects.get) and the hub's sync (create/delete/get/list). The CI auditor role holds exactly projects.getIamPolicy, buckets.get and buckets.getIamPolicy, and no storage.objects.* permission of any kind.
```

Inline satellite guard — extracted verbatim from the
`Check the satellite boundary invariants are declared` step in
`.github/workflows/build.yml` (~529–628) and executed from the repository root,
so the real guard ran, not a copy. Exit 0:

```
OK: uniform bucket-level access is declared on BOTH buckets; satellite_publisher holds exactly ['storage.objects.create', 'storage.objects.delete', 'storage.objects.get'] and never storage.objects.list; all 1 satellite binding(s) use that custom role with a startsWith prefix condition; and no satellite holds a project-level role.
```

("1 satellite binding" is the count of `for_each` binding *blocks* whose member
is `google_service_account.satellite_publish`, not the number of satellites; the
guard computes it dynamically. It is the real CI step.)

## Assumptions

- The read-only plan was run against the existing local state
  (`infra/terraform.tfstate`) with live ADC; it refreshed remote state and wrote
  nothing. Apply is out of scope for this stream (D5/D11).
- The repository is public (`private: false`, read live), while its items are
  declared private in the satellite manifest (SEAM-C4). Repository privacy does
  not affect the identity or the prefix boundary, so the entry is identical in
  shape to a private satellite's.
- The `gh api` values are stable because they are immutable numeric IDs; a rename
  or transfer of the repository would fail the provider condition (by design).

## Risks

- None material to the roster change: the plan adds four new resources only and
  touches nothing stateful. The only runtime risk is the ordinary one —
  `GCP_WIF_PROVIDER` in the satellite repository must be the `satellites`-pool
  value (`.../providers/github-construction-ai`), not the hub's; a wrong value
  fails closed and reads like a broken provider.
- The plan's provider resource shows `(known after apply)` fields (id/name);
  those are computed, not replacements.

## Open questions

- SEAM-C5: add `construction-ai` to `EXPECTED_SOURCES` **after** its first
  successful publish, on the `kgis` pattern (`required: false`, `since:
  "Wave 4 (satellite 5)"`, then flip to `true` once the publish is verified).
  Deferred by the seam, not an omission.
- SEAM-C6 (boundary proof) belongs to the satellite stream once the identity is
  applied; it needs a temporary impersonation grant, which this read-only stream
  does not create.

## Related docs

- `llm/sprints/2026-09-hub/contracts/infra-wave-4.md`
- `llm/sprints/2026-09-hub/contracts/phase-5-seams.md` (SEAM-C1, SEAM-C4, SEAM-C5)
- `infra/variables.tf` (`satellites`), `infra/satellites.tf`, `infra/README.md`
- ADR-0007 (satellite publishing and the prefix boundary)
