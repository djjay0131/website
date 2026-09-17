# Handoff: Infrastructure Implementation Engineer — Phase 3

Status: Draft (the Lead Architect sets the final status)
Sprint: 2026-09-hub · Phase 3 — Private area (issue #24)
Branch: `feat/private-area`
Contract: `llm/sprints/2026-09-hub/contracts/infra-phase-3.md`
Date: 2026-09-17

---

## Summary

One reviewed `terraform apply` now also creates the private area's cloud
foundation: a **private bucket only the gate can read**, the gate's keyless
runtime identity, the `hub-gate` Cloud Run service, Artifact Registry for its
image, Identity Platform, Firestore for the member allowlist, and a **separate**
identity for the gate's deploy workflow. It adds `phd-milestones` as satellite #2
from **one entry in `var.satellites`**.

**29 resources are added. No Phase 1 or Phase 2 resource is changed or
destroyed.** `infra/budget.tf` was not touched at all — not even a comment.

Four things carry the security of this phase:

1. **`uniform_bucket_level_access = true` on the private bucket.** Without it,
   IAM conditions stop applying *and object ACLs come back* — and one object ACL
   can make a single private object world-readable with no IAM change anywhere.
   It fails **open**, silently. It is asserted in code, in CI with no
   credentials, and again at Checkpoint 4 before anything is trusted.
2. **The gate's role is exactly `storage.objects.get`.** Not
   `roles/storage.objectViewer`, which is what a first draft reaches for: that
   adds `storage.objects.list`, and in this bucket object names *are* private
   material — committee and milestone filenames disclose before a byte is read.
3. **The private bucket has exactly two principals**, each with a custom role
   holding the minimum: the gate reads, and the hub's deploy identity syncs. See
   §Open question (a), which is the one place this phase departs from a criterion
   as written, deliberately and with a recommended fix.
4. **A deny-all Firestore ruleset.** The allowlist holds two real people's email
   addresses, and the sign-in page loads the Firebase Web SDK on a *public* page.
   The gate uses the Admin SDK and bypasses rules; nothing else may read
   `members/{email}` from a browser.

**Adding `phd-milestones` touched `satellites.tf` not at all.** That was the
contract's test of the Phase 2 design and it passed: one map entry produced a
provider, a service account, an impersonation binding and a prefix-conditioned
bucket binding, with no new module and no edit to any resource block.

Validation: `terraform fmt -check -recursive`, `terraform init -backend=false`
and `terraform validate` all pass, and the new credential-free bucket check
passes. **No `terraform plan` or `apply` was run and no cloud resource was
created, changed or read** — there are no credentials in this environment, by
contract. Every cloud check is at Checkpoint 4.

---

## Files delivered

| File | Change | What it holds |
|---|---|---|
| `infra/phase3-apis.tf` | new | The five Phase 3 APIs, each with the resource that needs it, and the two deliberately **not** enabled |
| `infra/private-bucket.tf` | new | The private bucket and its exactly-two IAM bindings |
| `infra/private-roles.tf` | new | The two custom roles — the security boundary of the phase, in its own file so a diff to a permission list is impossible to miss |
| `infra/gate.tf` | new | The gate's runtime identity and its three grants, the Cloud Run service, the `allUsers` invoker, and the separate `gate-deploy` identity |
| `infra/registry.tf` | new | Artifact Registry, keeping the 5 most recent versions |
| `infra/firestore.tf` | new | Firestore Native, delete-protected, plus the deny-all ruleset and its release |
| `infra/identity-platform.tf` | new | Email-link sign-in, the authorized-domain list, and why Google sign-in is manual |
| `infra/scripts/check_private_bucket_config.py` | new | The bucket IAM test, credential-free half. Runs anywhere, needs nothing |
| `infra/scripts/check-private-bucket-iam.sh` | new | The bucket IAM test, live half. Needs credentials; deploy path and Checkpoint 4 |
| `infra/variables.tf` | edited | `phd-milestones` added to the `satellites` default; four new Phase 3 variables with validations |
| `infra/outputs.tf` | edited | Ten Phase 3 outputs, including `gate_github_actions_variables` |
| `infra/terraform.tfvars.example` | edited | Documents the new variables and the second satellite, commented out |
| `infra/README.md` | edited | Phase 3 section: what it adds, the settings that must never change, manual steps with expected output, cost, rollback, and the Checkpoint 4 procedure |
| `llm/sprints/2026-09-hub/handoffs/infra-phase-3.md` | new | This file |

Nothing outside `infra/**` and this handoff was created or edited. `gate/**`,
`site/**`, `contract/**`, `.github/**`, `firebase.json` and `llm/` (apart from
this handoff) are untouched by this stream, as is the `cv` and `phd-milestones`
repository.

### One thing the Lead Architect must do before committing

`infra/scripts/check-private-bucket-iam.sh` begins with a shebang, and CI's
`budget-guard` job fails any tracked `*.sh` with a shebang that is not committed
`100755`. **I cannot set it** — that is a git index mutation, which this contract
forbids. Before committing:

```sh
git update-index --chmod=+x infra/scripts/check-private-bucket-iam.sh
git ls-files -s infra/scripts/   # verify 100755; `ls -l` LIES on /mnt/c
```

This is the defect that reddened CI in Phase 2, and the filesystem here reports
every file as `0777`, so no amount of local testing catches it. The other script
is deliberately a Python module with **no** shebang, invoked as `python3 …`, so
the check CI runs on every push has no mode dependency at all.

---

## What this apply creates

Expected: **`Plan: 29 to add, 0 to change, 0 to destroy.`**

| # | Address | What |
|---|---|---|
| 1–5 | `google_project_service.phase3[...]` | `run`, `artifactregistry`, `firestore`, `identitytoolkit`, `firebaserules` |
| 6 | `google_storage_bucket.private` | `<project_id>-private` in `US-EAST1`, Standard. UBLA on, public access prevention `enforced`, versioning on, soft delete 7 days, three lifecycle rules, `force_destroy = false` |
| 7 | `google_project_iam_custom_role.private_object_reader` | `privateObjectReader`: **exactly** `storage.objects.get`. `deletion_policy = "PREVENT"` |
| 8 | `google_project_iam_custom_role.private_sync_writer` | `privateSyncWriter`: exactly `create`, `delete`, `get`, `list`. `deletion_policy = "PREVENT"` |
| 9 | `google_storage_bucket_iam_member.gate_private_reader` | `privateObjectReader` → the gate, on the bucket |
| 10 | `google_storage_bucket_iam_member.hub_deploy_private_sync` | `privateSyncWriter` → `hub-deploy`, on the bucket |
| 11 | `google_artifact_registry_repository.gate` | Docker repo `hub-gate` in `us-east1`; DELETE-any + KEEP-last-5 cleanup policies; `cleanup_policy_dry_run = false` |
| 12 | `google_firestore_database.hub` | `(default)`, `FIRESTORE_NATIVE`, `us-east1` (**permanent**), delete protection enabled, `deletion_policy = "ABANDON"` |
| 13 | `google_firebaserules_ruleset.firestore_deny_all` | `allow read, write: if false` on `/{document=**}` |
| 14 | `google_firebaserules_release.firestore` | Releases it as `cloud.firestore` — without this the ruleset governs nothing |
| 15 | `google_identity_platform_config.hub` | Email + email-link sign-in (`password_required = false`); authorized domains incl. `jason.cusati.us` |
| 16 | `google_service_account.hub_gate` | `hub-gate@<project>.iam.gserviceaccount.com`. No keys |
| 17 | `google_project_iam_member.hub_gate_firestore` | `roles/datastore.user` |
| 18 | `google_project_iam_member.hub_gate_auth_admin` | `roles/firebaseauth.admin` — see §Risks 2, which proposes tightening it |
| 19 | `google_cloud_run_v2_service.gate` | `hub-gate` in `us-east1`, min 0 / max 3, runs as `hub-gate`, ingress ALL, placeholder image with `ignore_changes` |
| 20 | `google_cloud_run_v2_service_iam_member.gate_invoker_all_users` | `roles/run.invoker` → **`allUsers`** (ADR-0004; do not "fix") |
| 21 | `google_service_account.gate_deploy` | `gate-deploy@<project>.iam.gserviceaccount.com`. No keys |
| 22 | `google_artifact_registry_repository_iam_member.gate_deploy_writer` | `roles/artifactregistry.writer`, on the repository only |
| 23 | `google_cloud_run_v2_service_iam_member.gate_deploy_developer` | `roles/run.developer`, on the service only |
| 24 | `google_service_account_iam_member.gate_deploy_act_as_gate` | `roles/iam.serviceAccountUser` on `hub-gate` only — never project-wide |
| 25 | `google_service_account_iam_member.gate_deploy_wif_main` | `workloadIdentityUser` for `…/attribute.repository_id_ref/1212933399/refs/heads/main` |
| 26 | `google_iam_workload_identity_pool_provider.satellite["phd-milestones"]` | Provider `github-phd-milestones`: repository id 1373915518 **and** owner id 5666389 **and** name; refuses `pull_request_target` |
| 27 | `google_service_account.satellite_publish["phd-milestones"]` | `publish-phd-milestones@…`. No keys, no project role |
| 28 | `google_service_account_iam_member.satellite_publish_wif["phd-milestones"]` | `workloadIdentityUser` for `…/1373915518/refs/heads/main` — **`main`, not `master`** |
| 29 | `google_storage_bucket_iam_member.satellite_publish_prefix["phd-milestones"]` | `satellitePublisher` on the content bucket, conditioned to `…/objects/sources/phd-milestones/` |

Read, not created: `data.google_project.hub`. Shared and unchanged: the
`satellites` pool, the `satellitePublisher` role, both Phase 1/2 buckets.

### The IAM the gate stream should expect

| Identity | Holds | Does NOT hold |
|---|---|---|
| `hub-gate` (runtime) | `storage.objects.get` on the private bucket; `roles/datastore.user`; `roles/firebaseauth.admin` | Any list on any bucket · anything on the content bucket · any write to the private bucket · `logging.logWriter` (Cloud Run captures stdout/stderr without it) · `artifactregistry.reader` (the Cloud Run **service agent** pulls the image, not the runtime identity) · `serviceAccountTokenCreator` on itself (session cookies are minted by Identity Toolkit, not signed locally) · any key, ever |
| `gate-deploy` (CI) | `artifactregistry.writer` on the repo; `run.developer` on the service; `serviceAccountUser` on `hub-gate` | `run.admin` (it could rewrite the invoker policy) · project-level `serviceAccountUser` · anything on the private bucket or Firestore |

**Division of ownership on the Cloud Run service, which the gate stream must
respect:** Terraform owns the identity, scaling, ingress, env vars and IAM;
`gate.yml` owns the **image and nothing else**. Deploy with `--image`. A deploy
passing `--set-env-vars` or `--service-account` fights Terraform and is a defect.

Terraform sets two env vars on the service: `PRIVATE_BUCKET` and
`GOOGLE_CLOUD_PROJECT`. If the gate expects different names, say so and I (or the
Lead Architect) will change them here — do not add a second source of truth.

---

## Validation (verbatim)

Terraform through the `hashicorp/terraform:1.14.0` container with the repository
mounted, exactly as Phase 2 did, run from `infra/`. The committed
`.terraform.lock.hcl` was backed up first and verified **unchanged** afterwards.

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

`fmt -check` failed once, on `registry.tf` only, for `=` alignment; `terraform
fmt` corrected it (alignment only — the diff is three argument lines) and the
re-run above is clean. `validate` succeeded on the first attempt.

### The credential-free bucket IAM test

```text
$ python3 infra/scripts/check_private_bucket_config.py
OK: private bucket declares uniform bucket-level access and enforced public access prevention, names no anonymous principal, and carries exactly two bindings -- the gate (storage.objects.get) and the hub's sync (create/delete/get/list).
exit=0
```

### The `list` check

Every role granted anywhere in `infra/`, after Phase 3:

```text
$ grep -rn 'role  *=' *.tf
deploy.tf:49:  role    = "roles/firebasehosting.admin"
deploy.tf:55:  role    = "roles/serviceusage.apiKeysViewer"
deploy.tf:63:  role               = "roles/iam.workloadIdentityUser"
gate.tf:97:  role    = "roles/datastore.user"
gate.tf:103:  role    = "roles/firebaseauth.admin"
gate.tf:239:  role     = "roles/run.invoker"
gate.tf:290:  role       = "roles/artifactregistry.writer"
gate.tf:298:  role     = "roles/run.developer"
gate.tf:304:  role               = "roles/iam.serviceAccountUser"
gate.tf:318:  role               = "roles/iam.workloadIdentityUser"
private-bucket.tf:194:  role   = google_project_iam_custom_role.private_object_reader.name
private-bucket.tf:212:  role   = google_project_iam_custom_role.private_sync_writer.name
satellites.tf:136:  role               = "roles/iam.workloadIdentityUser"
satellites.tf:165:  role   = google_project_iam_custom_role.satellite_publisher.name
storage.tf:198:  role   = "roles/storage.objectViewer"
exit=0
```

`storage.objects.list` is granted in exactly **two** places in this project, both
of them the hub's own deploy identity and neither of them a satellite or the
gate: `roles/storage.objectViewer` on the *content* bucket (Phase 2, SEAM-4) and
`privateSyncWriter` on the *private* bucket (this phase, ADR-0010 decision 5).
No satellite role changed. The gate holds no list anywhere.

**No key resource of any kind exists in `infra/`** — no
`google_service_account_key`, no credentials file, no secret. Confirmed by
grep across the module.

---

## Open question (a) — the conflict, resolved

**The conflict.** The roadmap requires a bucket IAM test that fails if the
private bucket has "any reader other than the gate's service account", and
SEAM-1 states the bucket "has exactly one reader: the gate's service account".
But ADR-0010 decision 5 requires the private sync to *delete destination objects
the current build did not produce*, and a destructive sync must **list** the
destination to know what to prune. List is a read. As written, the two cannot
both be satisfied.

### Recommendation

**Grant it, and amend the roadmap and SEAM-1 — not ADR-0010.**

The exact grant, which is what this stream implemented:

```hcl
# infra/private-roles.tf
resource "google_project_iam_custom_role" "private_sync_writer" {
  role_id     = "privateSyncWriter"
  permissions = [
    "storage.objects.create",  # upload dist-private
    "storage.objects.delete",  # prune a withdrawal; half of an overwrite
    "storage.objects.get",     # compare, so an unchanged sync is a no-op
    "storage.objects.list",    # discover what to prune -- ADR-0010 decision 5
  ]
  deletion_policy = "PREVENT"
}

# infra/private-bucket.tf -- on the BUCKET, unconditioned, to hub-deploy only
resource "google_storage_bucket_iam_member" "hub_deploy_private_sync" {
  bucket = google_storage_bucket.private.name
  role   = google_project_iam_custom_role.private_sync_writer.name
  member = google_service_account.hub_deploy.member
}
```

**Which document should change: the roadmap (and SEAM-1), not ADR-0010.**
Proposed wording for the roadmap criterion:

> - [ ] The bucket IAM test runs on every deploy and fails if the private bucket
>   grants public access, or names any principal other than **exactly two**: the
>   gate's service account, holding only `storage.objects.get`, and the hub's
>   deploy identity, holding `storage.objects.create`/`.delete`/`.get`/`.list`,
>   which ADR-0010 decision 5 requires for a destructive sync. An anonymous
>   request for a private object is refused (§12.1).

And SEAM-1's line becomes "the gate's service account is the only identity that
**serves** from it, and the only reader outside the build's own deploy identity".

Four reasons the roadmap is the document at fault:

1. **ADR-0010 decision 5 is the substantive privacy requirement**; the roadmap
   clause is a checklist phrasing of it. Decision 5 exists because a sync that
   only adds leaves a withdrawn private item readable at its old path — "a
   privacy failure wearing the costume of a stale page". Weakening the ADR to
   preserve a sentence would trade a real property for a slogan.
2. **The criterion predates the ADR.** ADR-0010 is dated 2026-09-17; the Phase 3
   criteria were written in Phase 0. The clause never contemplated a sync
   identity, because destructive syncing was not yet decided.
3. **The criterion's intent is fully preserved.** Its purpose is that no third
   party can read private bytes. `hub-deploy` is not a third party: it is the
   process that *produces* those bytes, and it already reads the private
   **source** bytes in the content bucket under `sources/phd-milestones/` (SEAM-1
   itself says so, and Phase 2 granted `roles/storage.objectViewer` there
   unconditioned). Denying it read on the private bucket would protect nothing it
   cannot already see.
4. **The amended form is strictly more testable.** "No reader other than X" is an
   absence assertion over a set nobody enumerates; "exactly these two principals
   with exactly these roles" is an equality assertion, which is what
   `scripts/check-private-bucket-iam.sh` actually implements — and it catches a
   *third* binding, which the original wording arguably would not.

### Alternatives considered

1. **Sync without `list`, by keeping a record of the previous sync in the bucket
   and diffing against it** (needs only create/delete/get). Rejected: it
   reproduces exactly the defect ADR-0007 names for satellites — an object that
   is *not* in the recorded set, because a previous sync was interrupted or
   partial, can never be discovered or pruned. Withdrawal becomes best-effort in
   the one place it must be absolute, and the record itself becomes a single
   point of failure that silently disables pruning if lost.
2. **A dedicated `private-sync` service account, so `hub-deploy` holds nothing
   here.** *This is the one alternative worth the owner's attention*, and it is a
   real tightening: it would mean the identity that deploys the **public** site
   holds no access to the private bucket at all, so a compromise of the public
   deploy path could not read private output. The cost is a second WIF binding
   and a second `auth` step in `build.yml` (the site stream's file), for an
   identity used by the same job on the same runner — which is why I did not take
   it unilaterally. **If the owner wants the strongest form of "the gate is the
   only reader", this is how to get it**, and it changes nothing else in this
   handoff.
3. **Let the gate prune.** Rejected outright: it gives `storage.objects.delete`
   to the internet-facing runtime identity. Strictly worse than either option.
4. **Drop destructive pruning.** Rejected: it *is* ADR-0010 decision 5, and
   abandoning it is the privacy failure the ADR was written to prevent.

**ADR candidate:** "The private bucket's reader set, and why the hub's deploy
identity is on it" — recording this resolution, the amended criterion, and
alternative 2 as the available tightening.

---

## Open question (b) — what cannot be Terraformed

| Step | Why Terraform cannot do it | Reversible? |
|---|---|---|
| **Enable Identity Platform in the Marketplace** | "You must enable the Google Identity Platform in the marketplace prior to using this resource" (provider docs for `google_identity_platform_config` / `…_default_supported_idp_config`). Enabling the `identitytoolkit` API is a different action and is not sufficient | Effectively no |
| **Enable Google sign-in** | `google_identity_platform_default_supported_idp_config` requires `client_id` **and** `client_secret` — both Required. That is a long-lived OAuth secret in `terraform.tfvars` and in state, which §12.2 forbids. The Firebase console provisions the OAuth client itself and hands this repository nothing | Yes (disable the provider) |
| **The Identity Platform config's existence** | "This entity is created only once during intialization and cannot be deleted, individual Identity Providers may be disabled instead. This resource may only be created in billing-enabled projects" | No — disable providers instead |
| **The Firestore location** | "once you provision a database instance, you cannot change its location setting" (Firestore, "Firestore locations"). Terraform *can* set it; nothing can change it afterwards | **No.** A move means a second database and a migration |
| **Deleting the Firestore database** | `delete_protection_state = "DELETE_PROTECTION_ENABLED"` plus `deletion_policy = "ABANDON"`: a destroy removes it from state only. The provider notes both must be changed to actually delete | Deliberately hard |
| **Seeding `members/{email}`** | Not a Terraform concern, and deliberately so: no real email address is written into this repository. The owner runs the seed script (gate stream) | Yes |

So the owner's manual steps are, in order: enable Identity Platform in the
Marketplace → confirm the Firestore location → apply → enable Google sign-in in
the console → set the Actions variables → seed the allowlist → run the
Checkpoint 4 checks. `infra/README.md` §Phase 3 has each with its expected
output.

---

## Acceptance criteria (roadmap Phase 3, this stream's scope)

| Criterion | Status | Evidence |
|---|---|---|
| Private bucket with uniform access and no public access (§8) | **Met locally** | `infra/private-bucket.tf`; `check_private_bucket_config.py` passes; `validate` clean. Live confirmation: README manual step 4 |
| Cloud Run service `hub-gate` in `us-east1`, min 0 instances (§6, §8) | **Met locally** (config) | `infra/gate.tf`; `min_instance_count = 0`, `max = 3` |
| Images in Artifact Registry keeping the last 5 (§8, §9; R-A4) | **Met locally** (config) | `infra/registry.tf`; DELETE-any + KEEP-`keep_count = 5`, and KEEP wins ("When an artifact matches the criteria for both a delete policy and a keep policy, the artifact is kept") |
| Identity Platform with Google and email-link sign-in (§8) | **Partly met locally** | Email-link is Terraformed (`password_required = false`). **Google sign-in is a manual Checkpoint 4 step by design** — its Terraform resource requires an OAuth client secret (§12.2). See open question (b) |
| Firestore in Native mode (§8) | **Met locally** (config) | `infra/firestore.tf`; `type = "FIRESTORE_NATIVE"`, `name = "(default)"` |
| The bucket IAM test runs on every deploy and fails on public access or an unexpected reader (§12.1) | **Half met locally; half deferred** | Credential-free half delivered and passing (`check_private_bucket_config.py`). Live half (`check-private-bucket-iam.sh`) needs credentials — Checkpoint 4, plus a `build.yml` step the **site** stream must add (§Seam issues 3) |
| An anonymous request for a private object is refused (§12.1) | **Deferred to Checkpoint 4** | `PROBE_OBJECT=…` in `check-private-bucket-iam.sh`; needs no credential, so it can run on every deploy |
| The gate's service account can read only the private bucket and Firestore (brief §4; ADR-0004) | **Met locally by construction; confirm at Checkpoint 4** | `infra/gate.tf`; three grants, each justified, nothing on the content bucket. Terraform structurally cannot prove the absence of grants made outside it — Checkpoint 4 test 3 enumerates them |
| A recorded test shows `phd-milestones`' publish identity cannot write outside `sources/phd-milestones/` (§12.3) | **Deferred to Checkpoint 4** | Procedure, both directions, in §Checkpoint 4 test 2 |
| The gate deploy authenticates through WIF only, with no JSON key (§12.2) | **Met locally** | No key resource exists anywhere in `infra/`; `gate-deploy` has a WIF binding only. Confirm with `gcloud iam service-accounts keys list --managed-by=user` |
| `phd-milestones` is private on GitHub | **Not this stream** | The satellite stream and the Lead Architect own the repository |
| `/p/**` and `/session` rewrites (§8, §11) | **Not this stream, and correctly absent** | SEAM-6: Hosting rejects a config naming a service that does not exist. `firebase.json` is the site stream's and must not gain them in this PR |

**Definition of Done** (canon §Implementation Work): approved issue (#24) and
design authority (§6, §8, §12; ADR-0004, ADR-0005, ADR-0007, ADR-0010; roadmap) —
yes; ADRs exist — yes, plus two candidates below; PR review — Chief Reviewer,
pending; tests/validation included — yes, above; documentation — `infra/README.md`
§Phase 3; data/security/privacy impacts — below; memory bank — Lead Architect.

---

## Checkpoint 4

Run by the owner after apply, **before** announcing the private area works.
Record each command and its output in `STATE.md` — the roadmap asks for
*recorded* tests.

```sh
cd infra
PROJECT="$(terraform output -raw project_id)"
BUCKET="$(terraform output -raw private_bucket_name)"
GATE_SA="$(terraform output -raw gate_service_account_email)"
HUB_SA="$(terraform output -raw deploy_service_account_email)"
CONTENT="$(terraform output -raw content_bucket_name)"
```

### Test 1 — the private bucket has exactly one reader

```sh
PROJECT="$PROJECT" BUCKET="$BUCKET" GATE_SA="$GATE_SA" HUB_SA="$HUB_SA" \
  PROBE_OBJECT="index.html" bash scripts/check-private-bucket-iam.sh
```

**Expected: every line `OK`, exit 0.** It asserts UBLA first (and aborts if it
fails, because nothing below means anything without it), then public access
prevention, then the absence of `allUsers`/`allAuthenticatedUsers`, then that the
non-legacy bindings are **exactly** `privateObjectReader → gate` and
`privateSyncWriter → hub-deploy`, then that an anonymous GET is refused.

"Exactly one reader" must be proven as an **equality**, not an absence: a policy
with a third binding passes every "is there an allUsers?" check ever written.

The script also prints the `legacyBucketOwner` / `legacyObjectReader` bindings
Cloud Storage adds to every bucket automatically. **Read them.** They mean any
principal with project Viewer can read every private object — today only the
owner. Accepted for the content bucket at Checkpoint 3; it needs the owner's
explicit acceptance now that the bucket holds private material.

### Test 2 — the satellite boundary, in both directions

Phase 2 proved `cv` cannot escape `sources/cv/`. Now there are two satellites and
one of them is private, so run it **both ways**. Use the JSON API, never `gcloud
storage`: `gcloud storage cp` requires `storage.objects.list` even for a single
file into the satellite's *own* prefix, so a `gcloud` test fails on the allowed
path too and looks like a broken boundary that is not one (verified at
Checkpoint 3).

```sh
PHD_SA="$(terraform output -json satellite_publish_service_accounts | jq -r '."phd-milestones"')"
CV_SA="$(terraform output -json satellite_publish_service_accounts | jq -r .cv)"
U=https://storage.googleapis.com
echo boundary-check > /tmp/boundary.txt

# As phd-milestones (impersonation needs a temporary serviceAccountTokenCreator
# grant; REMOVE IT IMMEDIATELY AFTERWARDS, as at Checkpoint 3).
TOKEN="$(gcloud auth print-access-token --impersonate-service-account="$PHD_SA")"

# ALLOWED, inside its own prefix -> 200
curl -s -o /dev/null -w '%{http_code}\n' -X POST -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: text/plain' --data-binary @/tmp/boundary.txt \
  "$U/upload/storage/v1/b/$CONTENT/o?uploadType=media&name=sources%2Fphd-milestones%2F_probe.txt"

# DENIED: cv's prefix, the bucket root, and the trailing-slash probe -> 403 403 403
for NAME in sources%2Fcv%2F_probe.txt _probe.txt sources%2Fphd-milestones-other%2F_probe.txt; do
  curl -s -o /dev/null -w '%{http_code}\n' -X POST -H "Authorization: Bearer $TOKEN" \
    -H 'Content-Type: text/plain' --data-binary @/tmp/boundary.txt \
    "$U/upload/storage/v1/b/$CONTENT/o?uploadType=media&name=$NAME"
done

# DENIED: listing, even its own prefix -> 403
curl -s -o /dev/null -w '%{http_code}\n' -H "Authorization: Bearer $TOKEN" \
  "$U/storage/v1/b/$CONTENT/o?prefix=sources%2Fphd-milestones%2F&maxResults=1"

# DENIED: the private bucket entirely -> 403
curl -s -o /dev/null -w '%{http_code}\n' -H "Authorization: Bearer $TOKEN" \
  "$U/storage/v1/b/$BUCKET/o?maxResults=1"
```

Then the reverse, as `$CV_SA`: writing to `sources/phd-milestones/` must be
**403**. That direction is the one that matters most this phase — it is the leg
where a defect would let a public satellite reach private source material.

`sources/phd-milestones-other/` is the trailing-slash probe: it proves the
condition ends in `/`, so a source whose name merely *starts with*
`phd-milestones` is refused.

### Test 3 — no other grant reaches the gate (what Terraform cannot show)

```sh
# Expect EXACTLY two rows: roles/datastore.user and roles/firebaseauth.admin.
gcloud projects get-iam-policy "$PROJECT" \
  --flatten="bindings[].members" \
  --filter="bindings.members:${GATE_SA}" --format="table(bindings.role)"

# Expect NO rows: the gate holds nothing on the CONTENT bucket.
gcloud storage buckets get-iam-policy "gs://${CONTENT}" --format=json \
  | grep -c "${GATE_SA}" || echo "0 -- correct"

# Expect NO user-managed keys, for every identity this phase creates.
for SA in "$GATE_SA" "$(terraform output -raw gate_deploy_service_account_email)" "$PHD_SA"; do
  gcloud iam service-accounts keys list --iam-account="$SA" --managed-by=user
done
```

### Test 4 — the gate is reachable and refuses anonymous callers directly

```sh
curl -s -o /dev/null -w '%{http_code}\n' "$(terraform output -raw gate_service_uri)/p/milestones/"
```

Before the gate is deployed this hits the placeholder container. **After** the
gate stream deploys, the expected result is whatever ADR candidate (b) of the
gate contract settles (302 or 404) — but never private content, and never a
`Cache-Control` carrying `public` or `s-maxage`. The invoker is `allUsers`
deliberately (ADR-0004), so this URL is a first-class test surface, not an edge
case.

### Test 5 — the Firestore rules actually deny clients

```sh
gcloud firestore databases describe --database="(default)" \
  --format="value(name,locationId,type,deleteProtectionState)"
```

Expected: `(default)`, `us-east1`, `FIRESTORE_NATIVE`,
`DELETE_PROTECTION_ENABLED`. Then confirm in the Firebase console that the
Firestore Rules tab shows the deny-all ruleset as the **released** ruleset — a
ruleset that exists but is not released governs nothing, and looks identical in a
plan.

---

## Decisions taken within scope

1. **Two custom roles, not predefined ones**, for the private bucket. Every
   predefined role that can read an object also carries `storage.objects.list`,
   and `roles/storage.objectAdmin` (the obvious choice for the sync) carries the
   whole `storage.objects.*` surface including object IAM. A granted permission
   that happens to be unusable under UBLA is not the same as one never granted.
2. **The roles live in `private-roles.tf`**, their own file, exactly as
   `satellite-role.tf` does — so a permission-list diff is impossible to miss and
   a CI guard can assert them.
3. **`deletion_policy = "PREVENT"` on both**, for the reason Phase 2 recorded: a
   deleted custom role locks its ID for 7–37 days, which would break the private
   area with no way to apply out of it. Revocation happens at the binding.
4. **Terraform creates the Cloud Run service with a placeholder image**, and
   `ignore_changes` covers `image`, `client` and `client_version`. The
   alternative — letting `gate.yml` create the service — would move the invoker
   policy, runtime identity, scaling and ingress out of reviewed Terraform and
   into a workflow, and would leave the invoker binding nothing to attach to.
   Without `ignore_changes`, every apply after a deploy would silently roll the
   gate back to the placeholder.
5. **A separate `gate-deploy` identity**, rather than reusing `hub-deploy`.
   Different blast radii: the site's deploy identity should not be able to roll
   out gate revisions, and the gate's pipeline should not be able to deploy the
   site. Neither can read a private object.
6. **Every gate-deploy grant is on the narrowest resource**: the repository, the
   service, and the one service account it acts as — never the project.
   `roles/run.admin` is refused specifically because it includes `setIamPolicy`
   on services, which would let the deploy pipeline rewrite the very invoker
   policy ADR-0004 rests on.
7. **`deletion_protection = false` on the Cloud Run service**, against the
   provider default of `true`. What must survive is the *data* — the bucket
   (`force_destroy = false`, versioning, soft delete) and the allowlist (delete
   protection). The service is stateless; protecting it would cost the rollback
   path in README §Phase 3 and protect nothing.
8. **A deny-all Firestore ruleset, released.** The gate uses the Admin SDK and
   bypasses rules; the *sign-in page* loads the Firebase Web SDK on a public
   page with the project's public API key. Without a ruleset, `members/{email}` —
   two real people's email addresses — is one console command away from any
   signed-in stranger. This was not in the contract's deliverables; it is in
   scope because it is the difference between the allowlist being private and
   not.
9. **Firestore location `us-east1`, as a variable with a loud comment.** It
   matches §8's region, the gate and both buckets, and a same-region read is the
   cheapest path for a lookup on every private request. It is **permanent**, so
   it is an ADR candidate and a pre-apply confirmation step, not a default chosen
   in passing.
10. **`authorized_domains` set explicitly**, including `jason.cusati.us`. The
    list is authoritative rather than additive, so the defaults are restated. Left
    unset, sign-in on the custom domain fails with an unauthorized-domain error
    that looks nothing like a domain problem — a Checkpoint 4 trap avoided in
    code. Redirect domains are deliberately absent: `research.cusati.us` 301s
    away, so nothing signs in there.
11. **The bucket IAM test is split in two**, credential-free and live, because
    the roadmap wants it "on every deploy" and a live IAM read needs a token.
    The credential-free half runs everywhere and catches the widening edit at
    review time; the live half catches drift and anything granted outside
    Terraform. Neither replaces the other, and the anonymous-object probe — the
    half that actually catches a public object — needs no credential at all.
12. **The private bucket mirrors the content bucket's lifecycle** (30-day
    noncurrent, 5 versions, 7-day multipart abort, 7-day soft delete) so the two
    age the same way, with one consequence written into the code: a withdrawn
    private item's bytes survive as noncurrent generations for up to 30 days.
    The gate cannot serve them — it addresses objects by name, never by
    generation — and ADR-0010's Risks explicitly want a recovery path for a bad
    destructive sync. The trade is stated rather than left to be discovered.

---

## Seam issues found

Reported, not fixed — none is in this stream's file scope.

1. **SEAM-1 and the roadmap criterion are contradicted by ADR-0010 decision 5.**
   This is the contract's open question (a) and the full argument is above. I
   implemented the design ADR-0010 requires and did **not** renegotiate the seam:
   the Lead Architect should amend SEAM-1's "exactly one reader" and the roadmap
   criterion to the wording proposed above. If the Lead Architect prefers the
   seam exactly as written, the only implementable route is alternative 2 (a
   dedicated `private-sync` identity), which still has two principals on the
   bucket — or dropping destructive pruning, which contradicts an Accepted ADR.
2. **`build.yml` needs the private-bucket invariant guard.** The existing
   `budget-guard` job asserts the *content* bucket's UBLA and the satellite
   role's three permissions. The same class of invariant now exists for the
   private bucket, and `python3 infra/scripts/check_private_bucket_config.py` is
   the one-line step that asserts it. `build.yml` belongs to the **site** stream
   this phase (SEAM-8), so this is theirs or the Lead Architect's to wire.
3. **`build.yml` needs the bucket IAM test on the deploy path** (§12.1: "on every
   deploy"). The credential-free check plus the anonymous-object probe cover it
   without a token; the full policy enumeration needs one (see 4).
4. **The live check cannot run as `hub-deploy` without one more permission.**
   Reading a bucket's IAM policy needs `storage.buckets.getIamPolicy`, and
   `hub-deploy` holds object permissions only — the same gap Phase 2 found with
   `roles/storage.objectViewer` not including `storage.buckets.get`. I did **not**
   widen the role for the benefit of a check. Options are written at the bottom
   of `check-private-bucket-iam.sh`; the recommendation is to keep the live
   enumeration an owner/Checkpoint procedure and run the credential-free half
   plus the anonymous probe on every deploy.
5. **For the gate stream:** the service's env vars are `PRIVATE_BUCKET` and
   `GOOGLE_CLOUD_PROJECT`, set by Terraform. Deploy with `--image` only —
   `--set-env-vars` or `--service-account` would fight Terraform. If different
   names are wanted, change them in `gate.tf` rather than adding a second source
   of truth.
6. **For the gate stream:** `roles/firebaseauth.admin` is wider than the gate
   needs; see §Risks 2 for the intended tightening and the Checkpoint 4 command
   that settles it.

No seam was renegotiated, and no file outside `infra/**` and this handoff was
edited.

---

## Risks

1. **Uniform bucket-level access is still the silent single point of failure**,
   and now it guards private material. If it is ever turned off — a console
   click, an import, a future edit — object ACLs return and a single object can
   be made public with no IAM change anywhere. Mitigations: set in code, asserted
   credential-free on every push, checked first at Checkpoint 4 (and that check
   aborts rather than continuing, because nothing after it means anything).
2. **`roles/firebaseauth.admin` on the gate is wider than the gate's need.** It
   is there because minting a Firebase session cookie is Identity Toolkit's
   `CreateSessionCookie`, whose permission is `firebaseauth.users.createSession`,
   and no narrower *predefined* role was found to carry it. Verifying tokens and
   cookies needs no IAM at all. **Intended tightening, at Checkpoint 4:** confirm
   with `gcloud iam list-testable-permissions` that the permission is
   custom-role eligible, and if so replace the role with a custom role holding
   exactly it — the same move Phase 2 made for the satellite role. Recorded as an
   open item rather than left as a silent over-grant.
3. **Project-level roles bypass both buckets' IAM.** `legacyObjectReader` is
   granted to `projectViewer` automatically on every bucket, so **anyone with
   project Viewer can read every private object**. Today that is only the owner.
   This was accepted for the content bucket at Checkpoint 3; with private
   material it deserves an explicit owner decision, and the Checkpoint 4 check
   prints it rather than filtering it away.
4. **The destructive sync is the sharpest tool in the repository** (ADR-0010's
   own assessment). Infra's contribution is to make it recoverable: versioning,
   7-day soft delete, and lifecycle rules that keep 30 days of noncurrent
   versions. The gating — that it must not run on an empty or unvalidated build —
   is the **site** stream's (ADR-0010 decision 3).
5. **Withdrawn private bytes survive as noncurrent generations** for up to 30
   days. Unreachable through the gate (which never addresses a generation) but
   recoverable by the owner. The deliberate trade for having any recovery path at
   all; an item that must be unrecoverable immediately needs an owner action.
6. **The placeholder image is publicly invokable** until the gate is deployed.
   It reads nothing and holds no grant, but `firebase.json` must still not point
   at the service until the real gate exists (SEAM-6) — which is the site
   stream's constraint, and correctly enforced in their contract.
7. **`terraform destroy` of this module would not remove Identity Platform or
   Firestore**, and would leave the private bucket if it holds objects. That is
   intended, and README §Phase 3 rollback says so, but it means "destroy and
   start over" is not a clean operation in this project.
8. **State is still local** (C10, unblocked since Phase 2). It now records a
   private bucket name and the identities that reach it. Still no credentials,
   but the case for a remote backend is stronger each phase.

---

## Assumptions

1. **Phase 1 and Phase 2 are applied** and this state is added to.
2. **`phd-milestones`' numeric IDs are as the contract states** — repository
   `djjay0131/phd-milestones`, id `1373915518`, owner id `5666389`, default
   branch **`main`**. Taken from the contract; not re-read from the GitHub API
   here. A wrong ID fails closed: the satellite simply cannot authenticate.
3. **`<project_id>-private` is available** as a globally unique bucket name.
   If not, `private_bucket_name` overrides it and nothing else changes.
4. **The gate image is small enough** that five retained versions stay inside
   Artifact Registry's 0.5 GB free allowance, helped by layer sharing between
   versions. If not, the overage is cents (§Cost sensitivity).
5. **The gate deploys with `--image`**, preserving the identity, scaling and env
   Terraform owns.
6. **Identity Platform is enabled in the Marketplace before the apply.** The
   apply fails at `google_identity_platform_config` otherwise — loudly, which is
   the right failure.
7. **The owner accepts `us-east1` as the Firestore location** before applying,
   because it cannot be changed afterwards.

---

## Recommendations

1. **Amend the roadmap criterion and SEAM-1** per open question (a), and record
   the resolution as an ADR. Do not leave a shipped configuration contradicting
   a written criterion.
2. **Wire `check_private_bucket_config.py` into `build.yml`**, alongside the
   existing satellite-boundary assertions in `budget-guard`. These are the
   invariants whose breakage is invisible until content leaks.
3. **Tighten `roles/firebaseauth.admin` to a custom role** at Checkpoint 4 if
   `firebaseauth.users.createSession` proves custom-role eligible (§Risks 2).
4. **Put the legacy `projectViewer` bucket bindings to the owner explicitly**,
   now that a bucket holds private material.
5. **Consider alternative 2 of open question (a)** — a dedicated `private-sync`
   identity — if the owner wants the public-site deploy path to hold no access to
   the private bucket at all.
6. **Re-run Checkpoint 3's prefix proofs in both directions** now that a second
   satellite exists (§Checkpoint 4 test 2). Phase 2's handoff asked for exactly
   this when `phd-milestones` arrived.
7. **Decide C10 (remote state)**, still outstanding and now holding more.

---

## Alternatives considered

1. **`roles/storage.objectViewer` for the gate** — rejected: it carries
   `storage.objects.list`, and private object names are private material.
2. **`roles/storage.objectAdmin` for the sync** — rejected: it grants the whole
   `storage.objects.*` surface for four needed permissions.
3. **One custom role shared by the gate and the sync** — rejected: the gate would
   gain write and list. The permission *sets* genuinely differ here, unlike the
   satellites' case where one role and per-binding conditions was right.
4. **Letting `gate.yml` create the Cloud Run service** — rejected; see decision 4.
5. **Reusing `hub-deploy` for the gate deploy** — rejected; see decision 5.
6. **A second Firestore database for shares (Phase 4)** — not considered further;
   out of scope, and the location decision would repeat.
7. **Terraforming Google sign-in** — rejected: it requires an OAuth client secret
   in tfvars and state (§12.2).
8. **A private bucket per satellite** — rejected: the private bucket holds the
   hub's *rendered output*, not satellite sources. There is one build, so there is
   one output bucket.

---

## ADR candidates

1. **The private bucket's reader set** — open question (a): why the hub's deploy
   identity holds `list`/`delete` there, the amended criterion wording, and the
   dedicated-sync-identity alternative. This is the resolution the contract asks
   to be recorded.
2. **The Firestore location**, which is permanent. `us-east1` regional versus a
   `nam5` multi-region, and why a two-document allowlist does not need
   multi-region durability.
3. **Whether the gate should have its own WIF pool**, as satellites do. It does
   **not** today: `gate-deploy` lives in the hub's `github-actions` pool because
   the gate workflow runs in the hub's own repository, so the pool boundary
   ADR-0007 decision 5 draws (hub vs satellite) is not crossed. The invariant
   `wif.tf` records still applies — every provider in that pool must map
   `attribute.repository_id_ref` identically — and Phase 3 adds no provider to
   it, only a binding. Worth recording as considered and declined.
4. **The gate's session-minting permission** — `roles/firebaseauth.admin` now,
   a custom role of exactly `firebaseauth.users.createSession` if eligible.
5. **Deny-all Firestore rules as a standing requirement**, so a future phase that
   needs client access changes them deliberately rather than by omission.

---

## Data, security and privacy impacts

- **New data stored:** the hub's private rendered output (the milestone tracker
  and committee dossier as built pages) in a bucket with public access
  prevention enforced and exactly two principals; and the member allowlist —
  **two real email addresses** — in Firestore. No email address appears anywhere
  in this repository: seeding is an owner step, deliberately.
- **This is the first phase where private material is stored by this module.**
  Everything Phase 2 held was already public.
- **New identities:** two keyless service accounts (`hub-gate`, `gate-deploy`)
  and one satellite publisher (`publish-phd-milestones`). None holds a key; none
  holds a project-level role beyond the two the gate needs.
- **Credentials created:** none that outlive a workflow run. No JSON key, no
  GitHub token, no OAuth secret — which is precisely why Google sign-in is a
  console step.
- **Exposure surface:** the private bucket is not reachable without an IAM
  identity, object ACLs are disabled, and the only serving path is the gate,
  which checks a session first. The gate's `*.run.app` URL is deliberately public
  (ADR-0004), so authorisation correctness is the gate stream's code, not a
  network boundary — which is why the roadmap tests it directly.
- **Cross-satellite exposure:** unchanged and still none by construction. The
  new satellite holds no `list` and is conditioned to its own prefix; `cv` cannot
  reach `sources/phd-milestones/` and vice versa. Both directions are proven at
  Checkpoint 4 rather than asserted.
- **The residual exposure worth the owner's attention** is project-level access:
  project Viewer reads every object in both buckets through Cloud Storage's
  automatic legacy bindings. Named here, printed by the Checkpoint 4 check, and
  not silently filtered.

---

## Related docs

- `llm/governance/adr/0004-private-area-cloud-run-gate-behind-hosting.md` —
  decisions 1 and 4, and the `allUsers` invoker
- `llm/governance/adr/0010-withdrawal-semantics.md` — decision 5, which the
  sync grant exists to make implementable
- `llm/governance/adr/0007-hub-polls-content-bucket-no-satellite-github-credential.md`
  — decisions 4 and 5, generalised unchanged to satellite #2
- `llm/governance/adr/0005-two-output-build-with-leak-check.md` — decision 3, the
  bucket IAM test on every deploy
- `llm/sprints/2026-09-hub/contracts/phase-3-seams.md` — SEAM-1, SEAM-3, SEAM-5,
  SEAM-6, SEAM-7, SEAM-8, SEAM-9
- `llm/sprints/2026-09-hub/handoffs/infra-phase-2.md` — the module this extends,
  its rollback rules and its Checkpoint 3 proofs
- `llm/specs/2026-09-10-research-hub-design.md` §6, §8, §11, §12
- `llm/master-roadmap.md` §phase-3-private-area
- `infra/README.md` §Phase 3 — the operator-facing version of this handoff
- Cloud Storage, "IAM for Cloud Storage" — `list` cannot be prefix-restricted
- IAM, "Overview of IAM Conditions" — conditions require uniform bucket-level
  access
- Firestore, "Firestore locations" — "once you provision a database instance, you
  cannot change its location setting"
- Artifact Registry, "Configure cleanup policies" — "When an artifact matches the
  criteria for both a delete policy and a keep policy, the artifact is kept"
- Cloud Run, "Deploy container images" — the deployer needs `roles/run.developer`
  plus `roles/iam.serviceAccountUser` on the service identity
- Google Cloud Free Program, "Free cloud features" — the free-tier allowances in
  §Cost
- `google_identity_platform_config` / `_default_supported_idp_config` provider
  docs — the Marketplace prerequisite, and `client_secret` being required
