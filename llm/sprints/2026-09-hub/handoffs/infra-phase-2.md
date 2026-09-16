# Handoff: Infrastructure Implementation Engineer — Phase 2

Status: Draft (the Lead Architect sets the final status)
Sprint: 2026-09-hub · Phase 2 — Publishing contract (issue #16)
Branch: `feat/publishing-contract`
Contract: `llm/sprints/2026-09-hub/contracts/infra-phase-2.md`
Date: 2026-09-16

---

## Summary

One reviewed `terraform apply` now also creates a content bucket and a keyless
publishing identity for `cv` that can write **only** under `sources/cv/`, cannot
enumerate anything else in the bucket, and holds no key and no GitHub
credential. Adding `phd-milestones` in Phase 3 is one entry in `var.satellites`.

Nine resources are added. No Phase 1 resource is changed or destroyed.

Three things carry the security of the phase, and all three are implemented as
written in ADR-0007 and SEAM-3:

1. **The grant is a custom role of exactly `storage.objects.create`,
   `storage.objects.delete`, `storage.objects.get`** — and never
   `storage.objects.list`, which cannot be restricted by prefix at all. It lives
   in its own file, `infra/satellite-role.tf`, so that the permission list is
   reviewed as a unit and a diff to it is impossible to miss.
2. **`uniform_bucket_level_access = true`** on the bucket. Without it an IAM
   condition does not apply, so every satellite's prefix condition would stop
   constraining anything and each satellite's write grant would silently cover
   the whole bucket. This is the failure that looks like nothing is wrong.
3. **A separate `satellites` WIF pool.** `infra/wif.tf` records that a
   `principalSet` is scoped to the *pool*, so the hub's deploy binding is safe
   only while every provider in the hub's pool maps `repository_id_ref`
   identically — an invariant Terraform cannot enforce. Satellites in their own
   pool make the hub's trust boundary structural instead of a review obligation.

`cv`'s binding admits `refs/heads/master`, not `main` (ADR-0008 decision 6).

Validation: `terraform fmt -check -recursive`, `terraform init -backend=false`
and `terraform validate` all pass, first attempt, plus an offline
variable-validation run. **No `terraform plan` or `apply` was run and no cloud
resource was created, changed or read** — there are no credentials for this
project in the specialist environment, by contract. Every cloud check is at
Checkpoint 3, and the procedure for the three security criteria is in
[§Checkpoint 3](#checkpoint-3-the-three-security-criteria).

---

## Files delivered

| File | Change | What it holds |
|---|---|---|
| `infra/storage.tf` | new | The content bucket, the `storage.googleapis.com` enablement, and the hub's unconditioned read grant |
| `infra/satellite-role.tf` | new | The three-permission custom role — the security boundary of the phase |
| `infra/satellites.tf` | new | The `satellites` pool and, per satellite, a provider, a service account, an impersonation binding and a prefix-conditioned bucket binding |
| `infra/variables.tf` | edited | Adds `content_bucket_name` and the `satellites` map, with seven validations |
| `infra/outputs.tf` | edited | Adds `GCP_CONTENT_BUCKET` to `github_actions_variables`, and adds seven Phase 2 outputs |
| `infra/terraform.tfvars.example` | edited | Documents both new variables, commented out (both have working defaults) |
| `infra/README.md` | edited | Phase 2 section: what it adds, the two settings that must never change, manual steps with expected output, cost, rollback |
| `llm/sprints/2026-09-hub/handoffs/infra-phase-2.md` | new | This file |

Nothing outside `infra/**` and this handoff was created or edited. `infra/budget.tf`
was not touched at all (not even a comment). The `cv` repository was not touched.

---

## What this apply creates

Expected: **`Plan: 9 to add, 0 to change, 0 to destroy.`** on top of Phase 1's 19
resources. Nothing existing is modified, so a plan that wants to change or
replace a Phase 1 resource — or that mentions `google_billing_budget.hub` — is a
signal to stop.

| # | Address | What |
|---|---|---|
| 1 | `google_project_service.phase2["storage.googleapis.com"]` | Enables Cloud Storage. Phase 2's only new API; everything else it needs is already on from Phase 1 |
| 2 | `google_storage_bucket.content` | `<project_id>-content` in `US-EAST1`, Standard. UBLA on, public access prevention `enforced`, versioning on, soft delete 7 days, three lifecycle rules, `force_destroy = false` |
| 3 | `google_storage_bucket_iam_member.hub_deploy_content_viewer` | `roles/storage.objectViewer` to `hub-deploy` on the bucket, **unconditioned** (SEAM-4) |
| 4 | `google_project_iam_custom_role.satellite_publisher` | Project role `satellitePublisher`: `storage.objects.create`, `.delete`, `.get`. Nothing else. `deletion_policy = "PREVENT"` |
| 5 | `google_iam_workload_identity_pool.satellites` | The `satellites` pool, separate from `github-actions` |
| 6 | `google_iam_workload_identity_pool_provider.satellite["cv"]` | Provider `github-cv`: admits only `djjay0131/cv` by `repository_id` 1211056144 **and** `repository_owner_id` 5666389 **and** name, refusing `pull_request_target` |
| 7 | `google_service_account.satellite_publish["cv"]` | `publish-cv@<project>.iam.gserviceaccount.com`. No keys, no project role |
| 8 | `google_service_account_iam_member.satellite_publish_wif["cv"]` | `roles/iam.workloadIdentityUser` on that SA for `…/attribute.repository_id_ref/1211056144/refs/heads/master` |
| 9 | `google_storage_bucket_iam_member.satellite_publish_prefix["cv"]` | The custom role on the bucket, conditioned to `…/objects/sources/cv/` |

Read, not created: `data.google_project.hub` (unchanged).

Adding `phd-milestones` in Phase 3 adds exactly resources 6–9 again, from one map
entry. Resources 4 and 5 are shared and do not change.

---

## Validation (verbatim)

Terraform: the Windows executable through WSL interop, the same route Phase 1
used (Terraform v1.14.0 on windows_amd64, providers google and google-beta
v8.2.0 from the committed `.terraform.lock.hcl`). Run from `infra/`:

```text
$ terraform fmt -check -recursive
exit=0

$ terraform init -backend=false
Initializing provider plugins...
- Reusing previous version of hashicorp/google-beta from the dependency lock file
- Reusing previous version of hashicorp/google from the dependency lock file
- Using previously-installed hashicorp/google-beta v8.2.0
- Using previously-installed hashicorp/google v8.2.0

Terraform has been successfully initialized!

You may now begin working with Terraform. Try running "terraform plan" to see
any changes that are required for your infrastructure. All Terraform commands
should now work.

If you ever set or change modules or backend configuration for Terraform,
rerun this command to reinitialize your working directory. If you forget, other
commands will detect it and remind you to do so if necessary.
exit=0

$ terraform validate
Success! The configuration is valid.

exit=0
```

`fmt -check` passed without a formatting pass being needed, and `validate`
succeeded on the first attempt.

**Not run, by contract:** `terraform plan`, `terraform apply`, and every command
that would create, change or read a cloud resource. There is no credential for
this project in the specialist environment and none was created.

### Variable validations (offline)

Variable validation is evaluated at plan/console time, not by `validate`, so it
was exercised the same way Phase 1 exercised its own: `terraform console` in
container `hashicorp/terraform:1.14.0`, in a scratch directory holding only a
copy of `variables.tf` — no providers, no resources, no plan, no credentials.
The console exits 0 even when it prints diagnostics, so each
`Error: Invalid value for variable` line is the evidence.

The block below is the captured diagnostics with Terraform's `│` box-drawing
prefixes stripped and the wrapped message text joined, for width; the `Error:`
lines and the messages are otherwise as emitted. Each case ran with
`project_id` and a syntactically valid but **fake** `billing_account`
(`0A0A0A-0B0B0B-0C0C0C`) supplied in a scratch `terraform.tfvars` outside the
repository, which was never written into it.

```text
### defaults (expect OK)
  (no diagnostics)
### bad source name "CV_Bad" (expect error)
  Error: Invalid value for variable
  Each satellite key is a source name: a lowercase letter followed by up to
  38 lowercase letters, digits or hyphens (SEAM-2).
### source name over 22 chars (expect error)
  Error: Invalid value for variable
  A satellite key must be at most 22 characters: the service account is named
  publish-<key> and a service account ID is limited to 30 characters.
  Error: Invalid value for variable
  A satellite key must be at most 25 characters: the workload identity
  provider is named github-<key> and a provider ID is limited to 32 characters.
### non-numeric repository_id (expect error)
  Error: Invalid value for variable
  Each satellite's repository_id and repository_owner_id must be the numeric
  IDs from the GitHub API, not names.
### default_branch = "refs/heads/master" (expect error)
  Error: Invalid value for variable
  Each satellite's default_branch is a bare branch name such as master or
  main: no refs/heads/ prefix, no wildcards and no spaces.
### content_bucket_name = "Bad_Name.With.Dots" (expect error)
  Error: Invalid value for variable
  content_bucket_name must be 3-63 characters of lowercase letters, digits,
  hyphens or underscores, starting and ending with a letter or digit, and
  must not contain a dot.
### content_bucket_name = "google-hub-content" (expect error)
  Error: Invalid value for variable
  content_bucket_name must not begin with "goog" or contain "google": Cloud
  Storage reserves those names.
```

### The `list` check

Every role granted anywhere in `infra/`, and every permission in the custom role:

```text
$ grep -rn 'role  *=' *.tf
deploy.tf:49:  role    = "roles/firebasehosting.admin"
deploy.tf:55:  role    = "roles/serviceusage.apiKeysViewer"
deploy.tf:63:  role               = "roles/iam.workloadIdentityUser"
satellites.tf:136:  role               = "roles/iam.workloadIdentityUser"
satellites.tf:165:  role   = google_project_iam_custom_role.satellite_publisher.name
storage.tf:198:  role   = "roles/storage.objectViewer"

$ sed -n '/permissions = \[/,/\]/p' satellite-role.tf
  permissions = [
    "storage.objects.create",
    "storage.objects.delete",
    "storage.objects.get",
  ]
```

`grep -rn "objects\.list" *.tf` returns nine hits, **all of them comments or a
role description explaining why it is absent** — no `storage.objects.list`
appears in any `permissions` list or any granted role. The only identity holding
`list` on the bucket is the hub's `hub-deploy`, through
`roles/storage.objectViewer`, which SEAM-4 requires.

### Secret scan

`storage.tf`, `satellites.tf`, `satellite-role.tf`, the edits to `variables.tf`
and `outputs.tf`, and `terraform.tfvars.example` scanned for private keys,
service-account JSON, `credentials_json`, secrets, passwords, email addresses,
billing-account-shaped IDs and machine paths: **no hits**. The only matches for
"token" and "secret" are prose about OIDC tokens and the instruction *not* to use
GitHub secrets. The only billing-account-shaped string in `infra/` is the
pre-existing `000000-000000-000000` placeholder in `terraform.tfvars.example`.

---

## Acceptance criteria (roadmap Phase 2, this scope)

| Criterion | Status | Evidence |
|---|---|---|
| Scope: content bucket (§8, §11) | **Met locally** (config) | `infra/storage.tf`; `validate` passes |
| Scope: one service account and WIF provider per satellite, scoped by IAM condition to that satellite's prefix (§8) | **Met locally** (config) | `infra/satellites.tf`, all `for_each` over `var.satellites` |
| Scope: custom role of `create`/`delete`/`get`, **no `list`**, in a `satellites` pool separate from the hub's (ADR-0007) | **Met locally** (config) | `infra/satellite-role.tf`; the `list` check above |
| `cv` authenticates to Google Cloud through WIF only: no JSON key (§12.2) | **Met locally**, confirm at Checkpoint 3 | No key resource exists anywhere in `infra/`; confirm with `gcloud iam service-accounts keys list --managed-by=user` (step 4 below) |
| The `cv` satellite's credentials give it no write access to `website` (§12.3) | **Met locally** by construction | This module creates only GCP identities; it creates no GitHub credential of any kind. Confirm `gh secret list --repo djjay0131/cv` is clean |
| A recorded test shows `cv` cannot write outside `sources/cv/` (§12.3) | **Deferred to Checkpoint 3** | Procedure and expected output: §Checkpoint 3, test 1 |
| A recorded test shows `cv` cannot **list** the bucket (ADR-0007) | **Deferred to Checkpoint 3** | §Checkpoint 3, test 2 |
| A republish of an unchanged `cv` succeeds — overwrite works (ADR-0007) | **Deferred to Checkpoint 3** | §Checkpoint 3, test 3 |
| A push to `cv` with no commit to `website` publishes, and the next poll rebuilds | **Deferred to Checkpoint 3**, and depends on the `site` and `satellite-cv` streams | §Checkpoint 3, test 4 |
| The hub build syncs the content bucket before building (§3, §11) | **Not this stream** — `site` owns `build.yml`. Infra's half (the hub's read grant) is met locally | `google_storage_bucket_iam_member.hub_deploy_content_viewer` |

Definition of Done (canon §Implementation Work): approved issue (#16) and design
authority (design doc §8/§11/§12, ADR-0002, ADR-0007, ADR-0008, roadmap) — yes;
ADRs exist — yes; PR review — Chief Reviewer, pending; tests/validation included
— yes, above; documentation updated — `infra/README.md`; data/security/privacy
impacts — below; memory bank — Lead Architect.

---

## Checkpoint 3: the three security criteria

The owner runs these **after apply and before the first real publish**. They test
the IAM boundary directly, without needing a `cv` push, by impersonating the
publish service account.

Setup (from `infra/`, as the owner, with `gcloud` signed in):

```sh
BUCKET="$(terraform output -raw content_bucket_name)"
PROJECT="$(terraform output -raw project_id)"
SA="$(terraform output -json satellite_publish_service_accounts | jq -r .cv)"
echo boundary-check > /tmp/boundary.txt
```

Impersonation needs `iam.serviceAccounts.getAccessToken` on that service account.
If a command below fails with *"caller does not have permission to impersonate"*
rather than the expected storage error, grant yourself the token-creator role on
that one account, run the tests, then **remove it again**:

```sh
gcloud iam service-accounts add-iam-policy-binding "$SA" \
  --member="user:$(gcloud config get-value account)" \
  --role="roles/iam.serviceAccountTokenCreator" --project "$PROJECT"
# ... run the tests ...
gcloud iam service-accounts remove-iam-policy-binding "$SA" \
  --member="user:$(gcloud config get-value account)" \
  --role="roles/iam.serviceAccountTokenCreator" --project "$PROJECT"
```

Record each command and its output in `STATE.md` — the roadmap asks for a
*recorded* test.

### Test 1 — `cv` cannot write outside `sources/cv/`

```sh
gcloud storage cp /tmp/boundary.txt "gs://$BUCKET/sources/phd-milestones/boundary.txt" \
  --impersonate-service-account="$SA"

gcloud storage cp /tmp/boundary.txt "gs://$BUCKET/boundary.txt" \
  --impersonate-service-account="$SA"

gcloud storage cp /tmp/boundary.txt "gs://$BUCKET/sources/cv-other/boundary.txt" \
  --impersonate-service-account="$SA"
```

**Expected: all three FAIL**, each with an HTTP 403 naming
`storage.objects.create` access denied. The third matters as much as the first:
it proves the condition matches the prefix `sources/cv/` **with its trailing
slash**, so a source whose name merely starts with `cv` is not admitted.

**If any of these succeeds, stop.** The most likely cause is that
`uniform_bucket_level_access` is not `true`, in which case the condition is not
being applied at all — check step 2 of the README's manual steps.

### Test 2 — `cv` cannot list the bucket

```sh
gcloud storage ls "gs://$BUCKET/" --impersonate-service-account="$SA"
gcloud storage ls "gs://$BUCKET/sources/" --impersonate-service-account="$SA"
gcloud storage ls "gs://$BUCKET/sources/cv/" --impersonate-service-account="$SA"
```

**Expected: all three FAIL** with 403 naming `storage.objects.list`.

The third is not a bug: `cv` cannot list **even its own prefix**, and that is the
intended design. `list` is granted at the bucket level and cannot be narrowed by
`resource.name`, so the only safe amount to grant is none. This is why the
publish action must upload file-by-file and may never use
`gcloud storage cp --recursive` (ADR-0007 decision 6). A satellite does not need
to list: it knows what it built.

Also confirm the role itself:

```sh
gcloud iam roles describe satellitePublisher --project "$PROJECT" \
  --format="value(includedPermissions)"
```

**Expected, exactly:**
`storage.objects.create;storage.objects.delete;storage.objects.get`.

### Test 3 — a republish of an unchanged `cv` succeeds (overwrite works)

```sh
# first publish of this object
gcloud storage cp /tmp/boundary.txt "gs://$BUCKET/sources/cv/_boundary-check.txt" \
  --impersonate-service-account="$SA"

# republish the same path — this is the case roles/storage.objectCreator fails
gcloud storage cp /tmp/boundary.txt "gs://$BUCKET/sources/cv/_boundary-check.txt" \
  --impersonate-service-account="$SA"

# and the satellite can read its own object back
gcloud storage cat "gs://$BUCKET/sources/cv/_boundary-check.txt" \
  --impersonate-service-account="$SA"

# clean up
gcloud storage rm "gs://$BUCKET/sources/cv/_boundary-check.txt" \
  --impersonate-service-account="$SA"
```

**Expected: all four SUCCEED.** The second is the one that matters: overwriting
needs `storage.objects.create` **and** `storage.objects.delete`, and
`roles/storage.objectCreator` alone "[d]oes not give permission to view, delete,
or overwrite objects" — an identity holding only that role would succeed on the
first publish and fail on every republish.

Then confirm versioning kept the history, **as the owner** (the satellite cannot
list, so this check cannot be run as the satellite):

```sh
gcloud storage ls --all-versions "gs://$BUCKET/sources/cv/"
```

**Expected:** the noncurrent generations of `_boundary-check.txt` are listed even
after the `rm`, and the deleted live object is restorable for 7 days (soft
delete). This is the mitigation ADR-0007 relies on when it accepts that a
satellite can delete its own objects.

### Test 4 — the end-to-end criterion

With the `site` and `satellite-cv` streams merged: push to `cv`'s `master` with
**no commit to `website`**; the `cv` publish workflow authenticates through WIF
and uploads; the next hub poll detects the fingerprint change, builds and
deploys; the updated CV appears on `https://jason.cusati.us`. Confirm at the same
time that `gh secret list --repo djjay0131/cv` shows no Google credential and no
`WEBSITE_DISPATCH_PAT`, and that
`gcloud iam service-accounts keys list --iam-account="$SA" --managed-by=user`
lists nothing (§12.2).

---

## Open questions answered

### (a) One provider per satellite, or one provider admitting several repositories?

**Recommendation: one provider per satellite** — which is what
`infra/satellites.tf` implements, `for_each` over `var.satellites`.

The reasoning follows `wif.tf`'s own, which is that admission must be decided by
things that cannot be re-registered or quietly widened:

- **The condition is the cybersquatting defence, and a shared condition makes it
  a disjunction.** A per-repository provider condition is a conjunction: this
  numeric repository ID **and** this numeric owner ID **and** this name. A shared
  provider would have to become
  `(id==A && owner==X && name==…) || (id==B && …)`, and a disjunction is exactly
  the shape that fails open when someone edits it — a mis-grouped `||`, or an
  `&&` that binds tighter than intended, admits everything rather than nothing.
  With one provider per satellite, an edit for one satellite cannot widen
  admission for another, because it is a different resource.
- **Revocation.** Removing a satellite's map entry destroys its provider
  outright: the trust anchor is gone, not merely unreferenced. With a shared
  provider, revocation is a string edit, and any principalSet binding that
  survived the edit could still match.
- **Blast radius.** A provider is where an issuer is trusted. If a satellite's
  admission ever has to be suspended (a compromised repository, a transfer),
  `disabled = true` on its own provider is a one-line, one-satellite action.
- **The pool invariant stays structural.** `wif.tf` warns that a principalSet is
  scoped to the pool, so every provider in a pool must map
  `attribute.repository_id_ref` identically. Generating every provider from one
  `for_each` with one `attribute_mapping` means there is no second place for a
  divergent mapping to appear. A hand-written second provider — shared or not —
  is what would reintroduce the review obligation.
- **Cost and quota are not a reason to share.** IAM is free, and the per-pool
  provider quota is far beyond the handful of satellites this design will ever
  have.

The cost of this choice is one more resource per satellite and one more
`GCP_WIF_PROVIDER` value to distribute. That is the right trade: a leaked or
mis-set provider value for one satellite names only that satellite.

### (b) What does the $5 budget look like with a content bucket and hourly polling?

**Expected addition: $0.00/month. About $0.01/month if the free allowance did not
exist.** Full table with sources in `infra/README.md` §Cost. In short, at
us-east1 list prices (<https://cloud.google.com/storage/pricing>, read
2026-09-15):

| Line | Rate | Usage | Cost |
|---|---|---|---|
| Standard storage | $0.020/GB/month | ≤ ~60 MB (≈5 MB per publish; ≤5 noncurrent versions or 30 days; soft-deleted copies for 7 more) | $0.0012 |
| Class A ops (writes **and listings**) | $0.005/1,000 | ~930/mo = ~210 writes + 720 hourly poll listings | $0.005 |
| Class B ops (reads) | $0.0004/1,000 | ~210/mo | $0.0001 |
| Egress to the Actions runner | $0.12/GB (North America) | ~50 MB/mo | $0.006 |
| WIF, SAs, IAM, the custom role | $0 ("All use of Identity and Access Management API is free of charge") | — | $0.00 |

Every line is inside the Cloud Storage Always Free allowance — 5 GB-months
Standard, 5,000 Class A, 50,000 Class B, 100 GB North American egress, which
"apply to usage in US-WEST1, US-CENTRAL1, and US-EAST1 regions" — and the bucket
is in us-east1, so it qualifies. Note that storage is billed identically for
live, noncurrent and soft-deleted bytes ("Data storage charges apply in the same
way to live objects, noncurrent objects, and soft-deleted objects"), which is
precisely what the lifecycle rules bound.

**The one line that scales with time rather than content is the poll.** Hourly is
720 listings/month against 5,000 free. Polling every 5 minutes would be 8,640,
past the allowance, at roughly $0.02/month — still trivial, but it is the number
to recompute if the interval ever shortens. The $5 budget would need about
250 GB stored or a million Class A operations before it alerted on this bucket.

---

## Decisions taken within scope

1. **The custom role lives in its own file**, `infra/satellite-role.tf`, rather
   than inside `satellites.tf`. It is the security boundary of the phase, its
   permission list is the thing most worth protecting from a careless diff, and
   a single-purpose file makes a future CI presence check (like `budget-guard`)
   straightforward. See Recommendation 1.
2. **One custom role shared by all satellites, not one per satellite.** The
   permission *set* is identical for every satellite; only the *binding* differs,
   and that is where the prefix condition lives. Adding a satellite therefore
   does not touch the role at all.
3. **`deletion_policy = "PREVENT"` on the custom role.** The provider warns that
   "[a] deleted role is permanently deleted after 7 days, but it can take up to
   30 more days (i.e. between 7 and 37 days after deletion) before the role name
   is made available again." Destroying this role would leave every satellite
   unable to publish for up to 37 days with no way to apply out of it. PREVENT
   makes such a plan fail at plan time. Revoking a satellite is done at its
   binding — instant and reversible — never at the role.
4. **Soft delete kept at Google's 7-day default, and stated explicitly** rather
   than left implicit, so the bucket is rebuildable from the repo alone (§12.5).
   Rationale: a satellite's `storage.objects.delete` reaches a specific
   *generation* as well as the live object, so a satellite could purge its own
   history — versioning alone does not protect against the identity that owns the
   prefix. Soft delete does. The cost is negligible (a few MB against a 5 GB-month
   free allowance).
5. **Three lifecycle rules**, since versioning without expiry grows without
   bound and noncurrent bytes are billed like live ones:
   (i) delete a noncurrent version 30 days after it became noncurrent — one
   budget period, and anything worth restoring is noticed within the month;
   (ii) delete a noncurrent version once 5 newer ones exist — rule (i) bounds the
   *age* of history but not its *size*, so a satellite republishing in a loop
   could still accumulate 30 days of versions; (iii) abort incomplete multipart
   uploads after 7 days, because unfinished parts are billed as storage and are
   invisible to both versioning and the object listing. Both delete rules match
   `with_state = "ARCHIVED"`, so a live object is never touched.
6. **`location = upper(var.region)`.** GCS stores locations upper-cased; `upper()`
   keeps plan and state stable whatever case `var.region` carries.
7. **The satellites map is keyed by source name**, so one key is simultaneously
   the manifest's `source`, the bucket prefix and the IAM condition (SEAM-2).
   Seven variable validations enforce the SEAM-2 source shape, the service-account
   (≤22) and provider-ID (≤25) length limits that the generated names imply,
   numeric IDs, `owner/name` repository shape, and a bare branch name with no
   `refs/` prefix.
8. **A new `google_project_service.phase2`** for `storage.googleapis.com` rather
   than adding a key to Phase 1's `local.services` map, so the resource name does
   not misdescribe what it enables.
9. **The hub's grant is on the bucket, not the project**, and is
   `roles/storage.objectViewer` exactly as SEAM-4 fixes it — the narrowest
   predefined role that lists and reads objects. It cannot write, delete or
   change IAM, so a compromised hub deploy run cannot alter what a satellite
   published.

---

## Assumptions

1. **The project already exists with Phase 1 applied.** Phase 2 adds to that
   state; it does not re-create anything.
2. **`cv`'s numeric IDs are as the contract states** — `repository_id`
   1211056144, `repository_owner_id` 5666389, default branch `master`, public.
   Taken from the contract and ADR-0008; not re-read from the GitHub API here
   (no `gh` mutation was run; a read would have been permitted but the values are
   already recorded in an accepted ADR). A wrong ID fails closed: `cv` simply
   cannot authenticate.
3. **`<project_id>-content` is available** as a globally unique bucket name. If
   not, `content_bucket_name` overrides it; nothing else changes.
4. **The publish action uploads file-by-file** (ADR-0007 decision 6). The whole
   grant is built on the assumption that no step needs `list`.
5. **One `source` per satellite repository.** A repository publishing two sources
   would need a second map entry and a second identity; nothing here forbids that,
   but nothing supports two prefixes on one identity either.
6. **Hourly polling** is the interval used in the cost arithmetic, matching
   Phase 1's existing schedule.

---

## Risks

1. **Uniform bucket-level access is the silent single point of failure.** If it
   is ever turned off — by a console click, an import, or a future edit — every
   satellite's prefix condition stops applying and each satellite's write grant
   covers the whole bucket, with nothing else looking different. Mitigation: it
   is set in code, the README calls it out twice, and Checkpoint 3 step 2 checks
   it explicitly before any publish. **Recommended follow-up: a CI presence
   check** (Recommendation 1).
2. **A publish tool that starts requiring `list`** would break the design rather
   than the code, and the pressure would be to widen the grant. ADR-0007 already
   records this; any bump of `upload-cloud-storage` must re-verify that its
   source makes no `getFiles()` call. The right response to "publishing needs
   list" is to stop and raise it, never to add the permission.
3. **A satellite can still delete and overwrite its own objects**, by design.
   Versioning plus 7-day soft delete make it recoverable; the blast radius is one
   prefix. Whether that should remain true is an ADR candidate below.
4. **`roles/storage.objectViewer` does not include `storage.buckets.get`.** Its
   permissions are `resourcemanager.projects.get`/`.list`,
   `storage.folders.get`/`.list`, `storage.managedFolders.get`/`.list`,
   `storage.objects.get` and `storage.objects.list`. Listing and downloading
   objects is enough for the hub's sync, so this should be fine — but if the
   `site` stream's sync step calls something that reads *bucket metadata* (for
   example `gcloud storage buckets describe`), it will 403. I implemented SEAM-4
   exactly as written rather than widening it. If Checkpoint 3 hits this, the
   minimal fix is a second, hub-only grant; see §Seam issues.
5. **The `GCP_WIF_PROVIDER` name collision across repositories** (hub's pool vs
   satellites pool). Setting the wrong one fails closed, but the error reads like
   a broken provider rather than a wrong variable. Documented in the README step 4
   and in the outputs' own comments.
6. **Custom-role soft delete.** If the role is ever destroyed despite PREVENT
   (for example by removing the resource block, which no `deletion_policy` can
   stop — the same limitation `budget.tf` documents for `prevent_destroy`), its
   ID is unusable for 7–37 days and no satellite can publish in that window.
7. **State is still local.** Phase 2 adds IAM bindings and a bucket to a state
   file that lives on one machine. See ADR candidate C10, now unblocked.

---

## Seam issues found

Reported, not fixed — none of these is in this stream's file scope.

1. **`docs/satellites.md` says "Set the five values as GitHub Actions
   variables"** (Lead Architect owns that file, SEAM-6). The publish step it
   shows takes six inputs — `dist`, `source`, `project_id`,
   `workload_identity_provider`, `service_account`, `bucket` — of which **four**
   come from repository variables (`GCP_PROJECT_ID`, `GCP_WIF_PROVIDER`,
   `GCP_PUBLISH_SA`, `GCP_CONTENT_BUCKET`); `dist` and `source` are literals. The
   count should be four. The variable *names* it uses match this module's outputs
   exactly, so this is a wording fix, not a design mismatch.
2. **SEAM-4's hub grant may need one more permission than `objectViewer`
   provides** — `storage.buckets.get`, if the sync reads bucket metadata. Risk 4
   above. Flagged for the `site` stream to confirm at Checkpoint 3; the seam says
   `roles/storage.objectViewer` and I implemented that, unchanged.
3. **For the `site` stream, a clarification rather than a defect:** the "no
   `--recursive`" rule is a *satellite* constraint. The hub holds
   `storage.objects.list`, so the hub's own sync may use a recursive download.
   Only satellites are barred from it.
4. **The owner's Checkpoint 2 decision on Terraform state** ("local for now; move
   to a bucket in Phase 2 (C10)") is not in the roadmap's Phase 2 scope and is not
   implemented here. Phase 2 removes the reason it was deferred — Cloud Storage is
   now enabled and this module already creates buckets. It needs a decision from
   the Lead Architect or the owner. See ADR candidates.

No seam was renegotiated, and no file outside `infra/**` and this handoff was
edited.

---

## Recommendations

1. **Add a `satellite-role-guard` CI check, modelled on `budget-guard`.** Two
   properties are worth failing a PR over, and both are greppable:
   `infra/satellite-role.tf` must contain exactly the three permissions and must
   not contain `storage.objects.list` in its `permissions` list; and
   `infra/storage.tf` must contain `uniform_bucket_level_access = true`. These
   are the two things whose breakage is invisible at runtime until content leaks.
   `.github/workflows/build.yml` belongs to the `site` stream this phase, so this
   is a Lead Architect call, not a change I can make.
2. **Make Checkpoint 3's three tests a recorded artifact in `STATE.md`**, with
   the command and its output, since the roadmap asks for *recorded* tests.
3. **Decide C10 (remote state) this phase**, now that the blocker is gone.
4. **Re-verify `upload-cloud-storage` on every version bump** for the absence of
   any `getFiles()` call, as ADR-0007's Risks require. Worth a line in the
   contract stream's README so the obligation travels with the pin.
5. **When `phd-milestones` arrives in Phase 3**, add it as a map entry and
   nothing else — and re-run Checkpoint 3's tests **in both directions**
   (`cv` cannot write to `phd-milestones`' prefix, and `phd-milestones` cannot
   write to `cv`'s). Test 1 already writes the first half.

---

## Alternatives considered

1. **One WIF provider admitting several repositories** — rejected; see open
   question (a).
2. **Reusing the hub's `github-actions` pool** — rejected by ADR-0007 decision 5,
   and `wif.tf` explains why: a principalSet is scoped to the pool, so a
   satellite provider in the hub's pool would put the hub's deploy binding one
   attribute-mapping mistake away from being satisfiable by a satellite.
3. **A predefined role instead of a custom one** — impossible. `objectCreator`
   cannot overwrite (so republish fails); `objectUser` and `objectAdmin` both
   carry `storage.objects.list`; `objectViewer` carries `list` and cannot write.
   No predefined role holds exactly these three.
4. **Granting `list` conditioned to the prefix** — impossible, not merely
   unwise: the condition would have no effect, because `list` is evaluated at the
   bucket level. This is the constraint the whole phase is built around.
5. **One bucket per satellite**, which would make prefixes unnecessary — rejected:
   it multiplies buckets, IAM surface and hub configuration, and the hub would
   need a grant per bucket. The prefix condition achieves the same isolation with
   one bucket, and SEAM-2 fixes the layout.
6. **`num_newer_versions` alone, or `days_since_noncurrent_time` alone** —
   rejected; each bounds only one dimension. See decision 5.
7. **Disabling soft delete to save storage** — rejected; see decision 4. The
   saving is a fraction of a cent and it is the only thing standing between a
   satellite and its own history.

---

## ADR candidates

1. **Bucket lifecycle and retention policy.** 30-day noncurrent expiry, 5-version
   cap, 7-day soft delete, 7-day multipart abort. It is a durability-versus-cost
   policy with a real trade-off (how much satellite history is worth keeping),
   currently recorded only in code comments and this handoff.
2. **C10 — the Terraform state backend**, outstanding since Phase 1 and now
   unblocked. The owner's Checkpoint 2 answer was "local for now; move to a
   bucket in Phase 2". Proposal to decide: `<project_id>-tfstate` in the hub
   project, versioned, UBLA, public access prevention enforced, no principal but
   the owner, created outside this module and adopted with `backend "gcs"` plus
   `terraform init -migrate-state`.
3. **Whether a satellite should ever be able to delete.** `delete` is granted
   because a republish is an overwrite; versioning and soft delete are the current
   mitigations. The alternative — publish to a new immutable path each time and
   have the hub resolve the newest — removes the need for `delete` entirely but
   changes the bucket layout SEAM-2 fixes, and pushes the lifecycle problem onto
   the hub. Worth deciding before a *private* satellite exists in Phase 3.
4. **Guarding the two invisible invariants in CI** (Recommendation 1) — the same
   class of decision as the budget guard, which has its own record.

---

## Data, security and privacy impacts

- **New data stored:** published satellite content (`cv`'s four PDFs and its
  `cv-data` payload) in a private, non-public bucket in the hub's project. All of
  it is already public material — `cv` is a public repository — and all of it is
  `visibility: public`. No private item exists until Phase 3.
- **New identities:** one keyless service account per satellite, holding no
  project-level role and no key. Its only grant is object create/delete/get under
  one prefix of one bucket.
- **Credentials created:** none that outlive a workflow run. No JSON key, no
  GitHub token, no secret of any kind (§12.2, ADR-0007 decisions 2 and 3).
- **Exposure surface:** the bucket has `public_access_prevention = "enforced"`
  and UBLA on, so no object is reachable without an IAM identity, and object ACLs
  are disabled entirely.
- **Cross-satellite exposure:** none by construction — no satellite can list the
  bucket or read another prefix. This is the property Phase 3 depends on, when
  the names of private `phd-milestones` items become sensitive in themselves.
- **The hub's read access is total and deliberate.** `hub-deploy` can list and
  read every prefix. From Phase 3 on, keeping private items out of public output
  is the *build's* job (the two-output build and leak check, ADR-0005), not this
  binding's.

---

## Related docs

- `llm/governance/adr/0007-hub-polls-content-bucket-no-satellite-github-credential.md`
  — decisions 3, 4, 5, 7, 8 are implemented here
- `llm/governance/adr/0008-manifest-data-format-hub-renders-cv.md` §Decision 6 —
  `cv` is public, default branch `master`
- `llm/governance/adr/0002-satellite-publishing-via-content-bucket-and-dispatch.md`
- `llm/sprints/2026-09-hub/contracts/phase-2-seams.md` — SEAM-2, SEAM-3, SEAM-4,
  SEAM-6, SEAM-7
- `llm/sprints/2026-09-hub/contracts/infra-phase-2.md` — this stream's contract
- `llm/specs/2026-09-10-research-hub-design.md` §8, §11, §12
- `llm/master-roadmap.md` §phase-2-contract
- `llm/sprints/2026-09-hub/handoffs/infra-phase-1.md` — the Phase 1 module, its
  manual steps and its rollback rules, all of which still apply
- `infra/README.md` §Phase 2 — the operator-facing version of this handoff
- `infra/wif.tf` — the shared-pool invariant that ADR-0007 decision 5 makes
  structural
- Cloud Storage, "IAM for Cloud Storage"
  (<https://cloud.google.com/storage/docs/access-control/iam>) — `list` cannot be
  prefix-restricted
- IAM, "Overview of IAM Conditions"
  (<https://cloud.google.com/iam/docs/conditions-overview>) — conditions require
  uniform bucket-level access
- Cloud Storage, "IAM roles for Cloud Storage" — `objectCreator` cannot
  overwrite; `objectViewer`'s exact permission list
- Cloud Storage pricing (<https://cloud.google.com/storage/pricing>) — rates,
  the Always Free allowance, and soft-deleted/noncurrent billing
- `google_project_iam_custom_role` provider documentation — the custom-role
  soft-delete window and `deletion_policy`
