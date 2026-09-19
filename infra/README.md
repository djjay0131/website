# infra — the research hub's cloud foundation

Terraform for Phases 1, 2 and 3 of the research hub, per the design authority
`llm/specs/2026-09-10-research-hub-design.md` §8 and §12, ADR-0001, ADR-0004 (the
gate behind Hosting, and why its invoker is `allUsers`), ADR-0006 (the hub's
hostnames), ADR-0007 (satellite publishing and the prefix boundary), ADR-0008
(`cv` is public, default branch `master`), ADR-0010 (withdrawal is destructive on
the private side), and the seams in
`llm/sprints/2026-09-hub/contracts/phase-1-seams.md` (SEAM-4),
`phase-2-seams.md` (SEAM-2, SEAM-3, SEAM-4, SEAM-6, SEAM-7) and
`phase-3-seams.md` (SEAM-1, SEAM-3, SEAM-5, SEAM-6, SEAM-7, SEAM-8, SEAM-9).

**Phase 1 (issue #10)** — one reviewed `terraform apply`, run by the owner,
creates the project's APIs, the deploy identity and Firebase Hosting. After the
owner sets three GitHub Actions variables from its outputs, the next push to
`main` deploys the site to Firebase Hosting through Workload Identity
Federation.

**Phase 2 (issue #16)** — the same apply now also creates the **content
bucket** and a **publishing identity for each satellite**. A satellite can write
only under its own `sources/<source>/` prefix, cannot enumerate anything else in
the bucket, and holds no key and no GitHub credential. Adding the next satellite
is one entry in `var.satellites`, not a new module. See
[Phase 2: the content bucket and satellite publishing](#phase-2-the-content-bucket-and-satellite-publishing).

**Phase 3 (issue #24)** — the same apply now also creates the **private area's
cloud foundation**: a private bucket that only the gate can read, the gate's
keyless runtime identity, the `hub-gate` Cloud Run service, Artifact Registry for
its image, Identity Platform, Firestore for the member allowlist, and a separate
identity for the gate's deploy workflow. It also adds **`phd-milestones` as
satellite #2** — one entry in `var.satellites`, no new resource block anywhere.
See [Phase 3: the private area](#phase-3-the-private-area).

The full ordered runbook for Checkpoint 2 (create the project, Blaze, apply, DNS,
variables, first deploy, rollback) is in
`llm/sprints/2026-09-hub/handoffs/infra-phase-1.md` §Manual steps, the
Checkpoint 3 runbook is in `infra-phase-2.md`, and the Checkpoint 4 runbook is in
`infra-phase-3.md`. This file is the reference for the module itself.

## What this module manages

| File | Resources | Why |
|---|---|---|
| `main.tf` | `data.google_project.hub`; `google_project_service.phase1` (8 APIs) | The project is read, never created (§10 Q2). APIs: Cloud Resource Manager, Service Usage, IAM, STS, IAM Credentials, Firebase Management, Firebase Hosting, Billing Budgets |
| `wif.tf` | `google_iam_workload_identity_pool.github`, `google_iam_workload_identity_pool_provider.website` | GitHub OIDC federation; the provider admits only this repository, by immutable ID and name |
| `deploy.tf` | `google_service_account.hub_deploy`, `google_project_iam_member.hub_deploy_hosting_admin`, `google_project_iam_member.hub_deploy_api_keys_viewer`, `google_service_account_iam_member.hub_deploy_wif_main` | The keyless deploy identity, usable only from `refs/heads/main`. It holds `roles/firebasehosting.admin` and `roles/serviceusage.apiKeysViewer`, which Firebase requires for CLI deploys. That is the narrowest supported grant: custom roles cannot control Firebase Hosting resources |
| `budget.tf` | `google_billing_budget.hub` | $5/month for this project, emailing billing-account admins/users and project owners; `prevent_destroy`, a CI presence check and apply provenance (see Guardrails) |
| `firebase.tf` | `google_firebase_project.hub`, `google_firebase_hosting_site.default`, `google_firebase_hosting_custom_domain.primary`, `google_firebase_hosting_custom_domain.redirect` (one per `var.redirect_domains`) | Firebase on the project and its default Hosting site (a postcondition requires type `DEFAULT_SITE`). `var.domain`, the canonical host `jason.cusati.us`, is bound to the site, and `research.cusati.us` is connected to the same site with a 301 redirect to it (`redirect_target`) |
| `storage.tf` | `google_project_service.phase2` (1 API), `google_storage_bucket.content`, `google_storage_bucket_iam_member.hub_deploy_content_viewer` | The content bucket: uniform bucket-level access (**required** — an IAM condition does not apply without it), public access prevention enforced, versioning, soft delete, three lifecycle rules, `force_destroy = false`. The hub's `hub-deploy` gets `roles/storage.objectViewer` on it, unconditioned, because the hub owns the bucket and must list and read every prefix (SEAM-4) |
| `satellite-role.tf` | `google_project_iam_custom_role.satellite_publisher` | The satellite grant: **exactly** `storage.objects.create`, `storage.objects.delete`, `storage.objects.get`, and **never** `storage.objects.list`, which cannot be prefix-restricted (ADR-0007 decision 4). One role for all satellites; the prefix lives in the binding |
| `satellites.tf` | `google_iam_workload_identity_pool.satellites`, and per satellite `google_iam_workload_identity_pool_provider.satellite`, `google_service_account.satellite_publish`, `google_service_account_iam_member.satellite_publish_wif`, `google_storage_bucket_iam_member.satellite_publish_prefix` | One keyless identity per satellite, in a pool **separate** from the hub's (ADR-0007 decision 5), admitted only from that repository and its default branch (`master` for `cv`), and granted the custom role on the bucket conditioned to `sources/<source>/` |
| `phase3-apis.tf` | `google_project_service.phase3` (5 APIs) | Cloud Run, Artifact Registry, Firestore, Identity Toolkit and Firebase Rules. Each listed with the resource that needs it; Cloud Build and Secret Manager are deliberately **not** enabled |
| `private-bucket.tf` | `google_storage_bucket.private`, `google_storage_bucket_iam_member.gate_private_reader`, `google_storage_bucket_iam_member.hub_deploy_private_sync` | The private bucket: UBLA (**required**), public access prevention enforced, versioning, soft delete, three lifecycle rules, `force_destroy = false`. Exactly **two** principals: the gate reads, the hub's deploy identity syncs |
| `private-roles.tf` | `google_project_iam_custom_role.private_object_reader`, `google_project_iam_custom_role.private_sync_writer` | The gate's role is **exactly** `storage.objects.get` — never `list`, because private object names are themselves private. The sync role is exactly `create`/`delete`/`get`/`list`, the four ADR-0010 decision 5 needs |
| `gate.tf` | `google_service_account.hub_gate` + 2 project roles, `google_cloud_run_v2_service.gate`, `google_cloud_run_v2_service_iam_member.gate_invoker_all_users`, `google_service_account.gate_deploy` + 4 bindings | The gate's runtime identity (private bucket read, Firestore, session minting), the Cloud Run service (min 0, max 3, **invoker `allUsers` deliberately** — ADR-0004), and a *separate* deploy identity that can push an image but cannot read private content |
| `registry.tf` | `google_artifact_registry_repository.gate` | Docker repository for the gate image, keeping the 5 most recent versions (roadmap R-A4) |
| `firestore.tf` | `google_firestore_database.hub`, `google_firebaserules_ruleset.firestore_deny_all`, `google_firebaserules_release.firestore` | Firestore Native for `members/{email}` (SEAM-3), its location **permanent**, delete protection on — plus a **deny-all ruleset** so no browser client can read the allowlist |
| `identity-platform.tf` | `google_identity_platform_config.hub` | Email-link sign-in, and the authorized-domain list that makes sign-in work on `jason.cusati.us`. Google sign-in is a deliberate **manual** step: its Terraform resource requires an OAuth client secret |
| `scripts/` | none (a Python and a Bash check) | The roadmap's bucket IAM test, in two halves: `check_private_bucket_config.py` (credential-free, every push) and `check-private-bucket-iam.sh` (live, deploy path and Checkpoint 4) |
| `deploy-tools/` | none: `package.json` and `package-lock.json` | Pins `firebase-tools` to exactly 15.30.1 with its whole dependency tree. `build.yml` installs it with `npm ci --prefix infra/deploy-tools`. `node_modules/` is git-ignored |

Not managed, by design, after Phase 3 (roadmap "Not in this phase"; Phase 4 or
later owns them): share infrastructure of any kind (`/s/**`, `/share/**`, the
`shares` collection), a member-management interface, and search. Nor does this
module ever create the **contents** of anything: no member document, no
published object, no gate image. Seeding the allowlist is the owner's step at
Checkpoint 4, which is why no real email address appears anywhere in `infra/`.

Still not Terraformed and deliberately manual (see §Phase 3 manual steps):
enabling **Identity Platform in the Marketplace**, enabling **Google sign-in**
(its Terraform resource requires an OAuth client secret, which §12.2 forbids
this repository from holding), and the DNS and project/billing steps from
Phase 1.

Not Terraformable or deliberately manual: creating the project, linking billing
(Blaze), the hub hostnames' DNS records at the registrar, and deploying site content (done by
`firebase-tools` in `build.yml`). See the handoff for sources.

## Variables

| Name | Required | Default | Notes |
|---|---|---|---|
| `project_id` | yes | — | The project the owner created (intended `cusati-hub`) |
| `billing_account` | yes | — | `XXXXXX-XXXXXX-XXXXXX`; sensitive; only for the budget |
| `region` | no | `us-east1` | No Phase 1 resource is regional |
| `domain` | no | `jason.cusati.us` | The canonical hub host, bound to the default Hosting site (ADR-0006). Validation rejects `cusati.us` and `www.cusati.us` |
| `redirect_domains` | no | `["research.cusati.us"]` | Hostnames connected to the same site that 301-redirect to `domain`. Validation rejects `domain` itself, the apex, `www`, and duplicates |
| `github_repository` | no | `djjay0131/website` | Name matched by the WIF condition |
| `github_repository_id` | no | `1212933399` | Immutable repository ID matched by the WIF condition and deploy binding |
| `github_repository_owner_id` | no | `5666389` | Immutable owner ID matched by the WIF condition |
| `hosting_site_id` | no | `null` (= `project_id`) | Override only if the project ID is taken as a site ID |
| `content_bucket_name` | no | `null` (= `<project_id>-content`) | Bucket names are globally unique; override if the default stem is taken. Validation rejects dots, uppercase, and `goog*`/`*google*` |
| `satellites` | no | two entries, `cv` and `phd-milestones` | Satellites allowed to publish, **keyed by source name**. Per satellite: `repository`, `repository_id`, `repository_owner_id`, `default_branch`. Validation enforces the SEAM-2 source-name shape, the service-account and provider ID length limits, numeric IDs, and a bare branch name. Note the per-entry branch: `cv` is `master`, `phd-milestones` is `main` |
| `private_bucket_name` | no | `null` (= `<project_id>-private`) | The private bucket. Globally unique, like the content bucket. Validation rejects dots, uppercase, `goog*`/`*google*`, and a name equal to `content_bucket_name` |
| `firestore_location` | no | `us-east1` | **Permanent.** A Firestore database's location cannot be changed after creation |
| `gate_image` | no | Google's sample container | A **placeholder**. `gate.yml` pushes the real image and deploys it; Terraform ignores changes to this field afterwards |
| `gate_max_instance_count` | no | `3` | Cloud Run maximum instances for the gate (brief §4 Phase 3). The minimum is fixed at 0 in code |

Copy `terraform.tfvars.example` to `terraform.tfvars` and fill it in.
`terraform.tfvars` is git-ignored (`infra/.gitignore`), as are state files and
`.terraform/`. The dependency lock file `.terraform.lock.hcl` is committed.

## Outputs

| Output | Use |
|---|---|
| `github_actions_variables` | The variables to set on **this** repository: `GCP_PROJECT_ID`, `GCP_WIF_PROVIDER`, `GCP_DEPLOY_SA`, `GCP_CONTENT_BUCKET` |
| `satellite_github_actions_variables` | Per source name, the variables to set in **that satellite's own** repository: `GCP_PROJECT_ID`, `GCP_WIF_PROVIDER`, `GCP_PUBLISH_SA`, `GCP_CONTENT_BUCKET` |
| `content_bucket_name`, `content_bucket_url` | The bucket, as a name and as a `gs://` URL |
| `satellites_pool_name`, `satellite_publish_role_id` | The satellites WIF pool and the custom role, for the Checkpoint 3 checks |
| `satellite_publish_service_accounts`, `satellite_workload_identity_providers` | The same per-satellite values individually, keyed by source name |
| `satellite_prefixes` | The one `gs://…/sources/<source>/` prefix each satellite may write |
| `project_id`, `project_number`, `workload_identity_provider`, `deploy_service_account_email` | The same values individually |
| `hosting_default_url` | The `*.web.app` URL the Firebase smoke test uses when `SITE_URL` is unset |
| `custom_domain_dns_records` | Records to add or remove at the registrar, one entry per record, for every connected hostname. `custom_domain` names the hostname each record is for |
| `custom_domain_state` | Per hostname: `redirect_target`, and its ownership, host and certificate state |
| `gate_github_actions_variables` | The Phase 3 variables to set on **this** repository: `GCP_PRIVATE_BUCKET`, `GCP_GATE_DEPLOY_SA`, `GCP_GATE_SERVICE`, `GCP_GATE_REGION`, `GCP_ARTIFACT_REGISTRY` |
| `private_bucket_name`, `private_bucket_url` | The private bucket, as a name and as a `gs://` URL |
| `gate_service_account_email` | The gate's **runtime** identity — the only principal that reads a private object to serve it |
| `gate_deploy_service_account_email` | The **deploy** identity `gate.yml` authenticates as. It cannot read private content |
| `gate_service_name`, `gate_service_uri` | The Cloud Run service `firebase.json` must name, and its direct `*.run.app` URL — where every authorisation check must also hold (ADR-0004) |
| `gate_image_repository` | The Docker path to push the gate image to |
| `firestore_database` | The database's name, **permanent** location and type |
| `private_bucket_roles` | The two custom roles bound on the private bucket, for the Checkpoint 4 checks |
| `private_bucket_iam_check_command` | The live bucket IAM test, ready to paste |

## Running it

Prerequisites: Terraform `>= 1.14.0, < 2.0.0`; `gcloud` signed in as the owner;
the project created, billing linked, and the bootstrap APIs enabled (handoff
§Manual steps 1–3). Apply only under the apply-provenance rule in §Guardrails:
a clean checkout of the reviewed PR head or of `main`, with the applied commit
SHA recorded.

```sh
gcloud auth application-default login
gcloud auth application-default set-quota-project <project_id>

cd infra
cp terraform.tfvars.example terraform.tfvars   # then edit
terraform init
terraform plan -out=tfplan                     # review every line
terraform apply tfplan
terraform output github_actions_variables
terraform output custom_domain_dns_records
```

If an apply fails with `SERVICE_DISABLED` or `has not been used in project`, the
API enablement is still propagating: wait two minutes and run
`terraform apply` again.

After apply, `terraform plan` must report no changes (roadmap Phase 1
acceptance, §12.5). The custom domain's computed state changes as DNS and the
certificate progress; refresh it with `terraform apply -refresh-only`.

Validation that needs no cloud access:

```sh
terraform fmt -check -recursive
terraform init -backend=false
terraform validate
```

## Phase 2: the content bucket and satellite publishing

### What Phase 2 adds

Nine resources (`Plan: 9 to add, 0 to change, 0 to destroy` on top of Phase 1's
19), the layout `gs://<bucket>/sources/<source>/…`, and one publishing identity
per entry in `var.satellites` — `cv` today.

The boundary, in one line: **a satellite may create, overwrite and read objects
under its own prefix, and may do nothing else at all** — not write elsewhere,
not read another prefix, and not even list the bucket.

### The two settings that must never change

1. **`uniform_bucket_level_access = true`** on the bucket. This is not
   hardening; it is load-bearing. "To use conditions in the allow policy for a
   Cloud Storage bucket, you must enable uniform bucket-level access on the
   bucket" (<https://cloud.google.com/iam/docs/conditions-overview>). Turn it
   off and every satellite's prefix condition stops constraining anything, so
   each satellite's write grant silently covers the **whole** bucket.
2. **No satellite ever gets `storage.objects.list`**, under any role,
   conditioned or not. "Since the `storage.objects.list` permission is granted
   at the bucket level, you cannot use the `resource.name` condition attribute
   to restrict object listing access to a subset of objects in the bucket"
   (<https://cloud.google.com/storage/docs/access-control/iam>). A satellite
   holding `list` could enumerate every other source's object names — in
   Phase 3, private `phd-milestones` items. This is also why the publish step
   may not use `gcloud storage cp --recursive`, which requires `list`
   (ADR-0007 decision 6).

### Manual steps, in order

Continues from the Phase 1 runbook. Every apply follows the same apply-provenance
rule (§Guardrails): a clean checkout of the reviewed PR head or of `main`,
`budget-guard` green, no override file under `infra/`, and the applied commit SHA
recorded in the sprint `STATE.md`.

1. **Apply.** From `infra/`:
   - `terraform init` — expected: `Terraform has been successfully initialized!`
   - `terraform plan -out=tfplan` — expected: **`Plan: 9 to add, 0 to change, 0 to destroy.`**
     Nothing may be changed or destroyed. If the plan wants to change or replace
     a Phase 1 resource, or mentions `google_billing_budget.hub`, **stop**.
   - `terraform apply tfplan` — expected: `Apply complete! Resources: 9 added, 0 changed, 0 destroyed.`
   - `terraform plan` again — expected: `No changes.` (§12.5).

   If apply fails with `SERVICE_DISABLED` for `storage.googleapis.com`, the API
   is still propagating: wait two minutes and apply again.

2. **Confirm the bucket's security settings** before anything writes to it:

   ```sh
   gcloud storage buckets describe "$(terraform output -raw content_bucket_url)" \
     --format="value(uniform_bucket_level_access.enabled,public_access_prevention,versioning.enabled)"
   ```

   Expected: `True  enforced  True`. If the first value is not `True`, **stop**:
   the prefix boundary is not in effect.

3. **Confirm the custom role holds exactly three permissions and no `list`:**

   ```sh
   gcloud iam roles describe satellitePublisher --project "$(terraform output -raw project_id)" \
     --format="value(includedPermissions)"
   ```

   Expected, exactly: `storage.objects.create;storage.objects.delete;storage.objects.get`.
   If `storage.objects.list` appears, **stop and raise it** — do not proceed.

4. **Set the GitHub Actions variables in BOTH repositories.** None is secret;
   all are variables (Settings → Secrets and variables → Actions → Variables).

   In `djjay0131/website` (adds one variable to Phase 1's three):

   ```sh
   gh variable set GCP_CONTENT_BUCKET --body "$(terraform -chdir=infra output -raw content_bucket_name)"
   ```

   In `djjay0131/cv` (all four are new there):

   ```sh
   terraform -chdir=infra output -json satellite_github_actions_variables | jq -r '.cv | to_entries[] | "\(.key)\t\(.value)"'
   # then, from a checkout of cv, or with --repo djjay0131/cv:
   gh variable set GCP_PROJECT_ID     --repo djjay0131/cv --body "<GCP_PROJECT_ID>"
   gh variable set GCP_WIF_PROVIDER   --repo djjay0131/cv --body "<GCP_WIF_PROVIDER>"
   gh variable set GCP_PUBLISH_SA     --repo djjay0131/cv --body "<GCP_PUBLISH_SA>"
   gh variable set GCP_CONTENT_BUCKET --repo djjay0131/cv --body "<GCP_CONTENT_BUCKET>"
   ```

   Expected: `gh variable list --repo djjay0131/cv` shows all four.
   `GCP_WIF_PROVIDER` has the form
   `projects/<number>/locations/global/workloadIdentityPools/satellites/providers/github-cv`.
   **Note the trap:** `GCP_WIF_PROVIDER` exists in both repositories with
   *different* values — the hub's is in the `github-actions` pool, `cv`'s is in
   the `satellites` pool. Setting the hub's value in `cv` fails closed (the hub's
   provider refuses `cv`'s repository ID), but the error reads like a broken
   provider, so check the pool name in the value.

   Confirm `cv` holds no Google key and no hub credential:
   `gh secret list --repo djjay0131/cv` shows no `WEBSITE_DISPATCH_PAT` and no
   Google credential (§12.2, ADR-0007 decision 2).

5. **Verify the prefix boundary.** The three recorded tests the roadmap requires
   are written out in full, with expected output, in
   `llm/sprints/2026-09-hub/handoffs/infra-phase-2.md` §Checkpoint 3. Run them
   before the first real publish.

### Cost

Phase 2's expected addition to the bill: **$0.00/month**, and about **$0.01/month**
if the free allowance did not exist at all. Rates are us-east1 list prices from
<https://cloud.google.com/storage/pricing> (read 2026-09-15).

| Line | Rate | Phase 2 usage | Cost |
|---|---|---|---|
| Standard storage, us-east1 | $0.020 per GB per month | ≤ ~60 MB: one `cv` publish is ~5 MB (4 PDFs plus the `cv-data` payload), and the lifecycle rules keep at most 5 noncurrent versions or 30 days, with soft-deleted copies for a further 7 days | $0.0012 → **$0.00** |
| Class A operations (writes, and every bucket listing) | $0.005 per 1,000 | ~930/month: ~210 object writes (≈21 files × ~10 publishes) plus 720 hourly poll listings | $0.005 → **$0.00** |
| Class B operations (reads) | $0.0004 per 1,000 | ~210/month: the hub downloads ~21 objects on each of the ~10 polls that find a change | $0.0001 → **$0.00** |
| Network egress to the GitHub Actions runner | $0.12 per GB from North America | ~50 MB/month | $0.006 → **$0.00** |
| WIF pool, providers, service accounts, IAM bindings, the custom role | $0 — "All use of Identity and Access Management API is free of charge" | 1 pool, 1 provider, 1 SA, 3 bindings, 1 role | **$0.00** |

Every line lands at $0.00 because it sits inside the Cloud Storage Always Free
allowance — 5 GB-months of Standard storage, 5,000 Class A operations, 50,000
Class B operations and 100 GB of North American egress per month, which "apply to
usage in US-WEST1, US-CENTRAL1, and US-EAST1 regions" (Cloud Storage pricing,
"Cloud Storage Always Free usage limits"). The bucket is in us-east1, so it
qualifies. Note that storage is billed the same for live, noncurrent and
soft-deleted bytes ("Data storage charges apply in the same way to live objects,
noncurrent objects, and soft-deleted objects"), which is what the lifecycle rules
in `storage.tf` bound.

Sensitivity, so the number is honest rather than merely small:

- **Poll frequency is the only line that scales with time, not content.** Hourly
  polling is 720 listings/month, comfortably inside the 5,000 free Class A
  operations. Polling every 5 minutes would be 8,640, past the free allowance, and
  would cost about $0.02/month — still negligible, but it is the line to watch if
  the interval ever shortens.
- The $5 budget would need roughly 250 GB stored, or a million Class A
  operations, before it alerted on this bucket. Phase 1's $0.00 expectation is
  unchanged.

### Rollback (Phase 2 resources only)

The budget is never removed (§12.6), and no rollback runs `terraform destroy`
without `-target`. In increasing order of severity:

1. **Stop one satellite publishing, immediately:** remove its entry from
   `var.satellites` and apply. That destroys its provider, its service account
   and its bucket binding — nothing else. It is instant and fully reversible by
   putting the entry back.
2. **Stop every satellite publishing:** set `satellites = {}` and apply. The pool
   and the bucket remain; published content is untouched.
3. **Cut the hub's read access:** targeted destroy of
   `google_storage_bucket_iam_member.hub_deploy_content_viewer`. The hub build
   then cannot sync the bucket.
4. **Remove the bucket:** only when it is empty. `force_destroy = false` means a
   bucket still holding objects fails to destroy, by design. Restore content by
   re-publishing from each satellite.

Never target `google_project_iam_custom_role.satellite_publisher`: it is
`deletion_policy = "PREVENT"`, and a deleted custom role locks its ID for
between 7 and 37 days, so every satellite would be unable to publish for that
window with no way to apply out of it. Revoke a satellite at its **binding**
(step 1), never at the role.

## Phase 3: the private area

### What Phase 3 adds

**29 resources** (`Plan: 29 to add, 0 to change, 0 to destroy` on top of Phase 1's
19 and Phase 2's 9). Nothing existing is modified. A plan that wants to change or
replace a Phase 1 or Phase 2 resource — or that mentions
`google_billing_budget.hub` — is a signal to **stop**.

Twenty-five of them are the private area; the other four are `phd-milestones`
becoming satellite #2, generated from **one entry** in `var.satellites`. No
resource block in `satellites.tf` changed by a character, which is exactly what
the Phase 2 `for_each` design existed to make true.

The boundary, in one line: **the gate's service account is the only identity that
can read a private object to serve it, and it can do nothing else** — it cannot
list the bucket, cannot write to it, and cannot reach the content bucket at all.

### The settings that must never change

Phase 2's two still hold ([above](#the-two-settings-that-must-never-change)), and
Phase 3 adds a third and a fourth.

3. **`uniform_bucket_level_access = true` on the private bucket**, for the same
   reason as the content bucket and one more. Without it, IAM conditions stop
   applying *and* object ACLs come back — and a single object ACL can make one
   private object world-readable with no IAM change anywhere, invisible to every
   policy check. This is the setting that fails **open**, silently.
4. **The gate never gets `storage.objects.list`.** Its role is exactly
   `storage.objects.get`. The reasoning is the satellites' reasoning applied
   where the stakes are highest: object names in the private bucket are
   committee and milestone filenames, which disclose before anyone reads a byte.
   The gate is asked for a path and serves that path; it never enumerates.

Both are asserted on every push, with no credentials, by
`python3 infra/scripts/check_private_bucket_config.py`, which runs as a step in the
`budget-guard` job of `.github/workflows/build.yml` — already a required status check on
`main`, so the assertion binds immediately rather than waiting on a branch-protection
change. (Wired 2026-09-17: until then this sentence was false and the check ran nowhere.)

### Who may touch the private bucket

Exactly two principals, and the Checkpoint 4 check asserts the policy holds
these and nothing else:

| Principal | Role | Permissions | Why |
|---|---|---|---|
| `hub-gate` (Cloud Run runtime) | `privateObjectReader` (custom) | `storage.objects.get` | Streams one object by name on `/p/**` (ADR-0004 decision 4) |
| `hub-deploy` (the site's deploy identity) | `privateSyncWriter` (custom) | `storage.objects.create`, `.delete`, `.get`, `.list` | Publishes `site/dist-private` and **prunes** what the current build did not produce (ADR-0010 decision 5) |

**Why the second one exists**, since the roadmap criterion reads "no reader other
than the gate's service account": a destructive sync must list the destination to
know what to delete, and list is a read. `hub-deploy` is not a third party that
gained access — it is the process that *produces* these bytes, and it already
reads every private **source** byte in the content bucket under
`sources/phd-milestones/` (SEAM-1). Denying it here would protect nothing it
cannot already see, while making withdrawal unimplementable. The full argument,
the exact grant and the recommended wording change are in
`llm/sprints/2026-09-hub/handoffs/infra-phase-3.md` §Open question (a).

### The third and fourth readers this module does NOT declare

Cloud Storage adds four *legacy* bindings to every bucket at creation, and they
are on the private bucket exactly as they are on the content bucket:

| Role | Member |
|---|---|
| `roles/storage.legacyBucketOwner`, `roles/storage.legacyObjectOwner` | `projectEditor:<project>`, `projectOwner:<project>` |
| `roles/storage.legacyBucketReader`, `roles/storage.legacyObjectReader` | `projectViewer:<project>` |

**Uniform bucket-level access does not remove them.** That was established from
the live policy rather than assumed: UBLA is `True` on `<project>-private` and
`gcloud storage buckets get-iam-policy` still returns all four. UBLA disables
object *ACLs*; these are ordinary IAM bindings in the bucket's policy.

So `projectViewer` can read every private object — including the committee
dossier — and nothing in this module mentions it. **Today that expands to
nobody**: the project has no `roles/viewer` binding at all, and the owner holds
`roles/owner`, which maps to `projectOwner`, not `projectViewer`. The exposure
is therefore *latent*, not live, and it activates silently the first time anyone
is granted project Viewer.

Two consequences, both acted on rather than noted:

- `scripts/check-private-bucket-iam.sh` now **fails** if any principal holds
  `roles/viewer`, so the moment that grant happens it is loud rather than
  invisible.
- Removing the legacy reader bindings requires replacing the bucket's whole IAM
  policy authoritatively (`google_storage_bucket_iam_policy`), because
  `google_storage_bucket_iam_member` is additive and structurally cannot remove
  a binding. That carries a real lockout risk — dropping the Owner/Editor pair
  as well would remove the owner's own object access to the bucket — so it is an
  **owner decision**, written up in
  `llm/sprints/2026-09-hub/handoffs/infra-wave-0.md` item 5.

### The gate's Identity Platform role

`hub-gate` holds `google_project_iam_custom_role.gate_session_minter`
(`gate-auth-role.tf`), **not** `roles/firebaseauth.admin`:

| Permission | The call site that needs it |
|---|---|
| `firebaseauth.users.createSession` | `create_session_cookie` — the mint half of `POST /session` |
| `firebaseauth.users.get` | both verify paths run `check_revoked=True`, which fetches the user record |

The predefined role it replaced carried the whole Authentication surface,
including deleting both members and rewriting the sign-in configuration, on an
identity whose Cloud Run invoker is `allUsers` by design (ADR-0004). The
permission set was verified against **this project** with
`gcloud iam list-testable-permissions`, and custom-role eligibility the same way
— see the header of `gate-auth-role.tf` for exactly what was checked.

### Manual steps, in order

Continues from the Phase 2 runbook, and every apply follows the same
apply-provenance rule (§Guardrails).

1. **Enable Identity Platform in the Marketplace** — *before* the apply, or it
   fails at `google_identity_platform_config`. The provider is explicit: "You
   must enable the Google Identity Platform in the marketplace prior to using
   this resource." Enabling the `identitytoolkit` API is **not** the same action.

   <https://console.cloud.google.com/marketplace/details/google-cloud-platform/customer-identity>

   Expected: the Identity Platform page in the console loads and offers
   providers.

2. **Confirm the Firestore location before applying.** `firestore_location`
   defaults to `us-east1` and **cannot be changed afterwards**: "once you
   provision a database instance, you cannot change its location setting"
   (Firestore, "Firestore locations"). Changing it later means a second database
   and a migration.

3. **Apply.** From `infra/`:
   - `terraform init` — expected: `Terraform has been successfully initialized!`
   - `terraform plan -out=tfplan` — expected: **`Plan: 29 to add, 0 to change, 0 to destroy.`**
   - `terraform apply tfplan` — expected: `Apply complete! Resources: 29 added, 0 changed, 0 destroyed.`
   - `terraform plan` again — expected: `No changes.` (§12.5).

   If apply fails with `SERVICE_DISABLED`, an API is still propagating: wait two
   minutes and apply again.

4. **Confirm the private bucket's security settings** before anything writes to
   it:

   ```sh
   gcloud storage buckets describe "$(terraform output -raw private_bucket_url)" \
     --format="value(uniform_bucket_level_access.enabled,public_access_prevention,versioning.enabled)"
   ```

   Expected: `True  enforced  True`. **If the first value is not `True`, stop:**
   object ACLs are live and the bucket's access story is no longer IAM-only.

5. **Confirm the two private-bucket roles hold exactly their permissions:**

   ```sh
   gcloud iam roles describe privateObjectReader --project "$(terraform output -raw project_id)" \
     --format="value(includedPermissions)"
   gcloud iam roles describe privateSyncWriter --project "$(terraform output -raw project_id)" \
     --format="value(includedPermissions)"
   ```

   Expected, exactly: `storage.objects.get` for the first, and
   `storage.objects.create;storage.objects.delete;storage.objects.get;storage.objects.list`
   for the second. **If `storage.objects.list` appears in `privateObjectReader`,
   stop and raise it.**

6. **Enable Google sign-in by hand**, in the Firebase console → Authentication →
   Sign-in method → Google. This is deliberate, not an omission: the Terraform
   resource (`google_identity_platform_default_supported_idp_config`) requires
   `client_id` **and** `client_secret`, which would put a long-lived OAuth secret
   in `terraform.tfvars` and in Terraform state — the exact thing §12.2 forbids.
   The console provisions the OAuth client on the project's own behalf.

   Expected: Google shows as Enabled. Email/Password with **email link** is
   already on from the apply; confirm it shows as enabled too.

7. **Set the Phase 3 GitHub Actions variables** in `djjay0131/website`. None is
   secret.

   ```sh
   terraform -chdir=infra output -json gate_github_actions_variables | jq -r 'to_entries[] | "\(.key)\t\(.value)"'
   gh variable set GCP_PRIVATE_BUCKET    --body "<GCP_PRIVATE_BUCKET>"
   gh variable set GCP_GATE_DEPLOY_SA    --body "<GCP_GATE_DEPLOY_SA>"
   gh variable set GCP_GATE_SERVICE      --body "<GCP_GATE_SERVICE>"
   gh variable set GCP_GATE_REGION       --body "<GCP_GATE_REGION>"
   gh variable set GCP_ARTIFACT_REGISTRY --body "<GCP_ARTIFACT_REGISTRY>"
   ```

   `GCP_WIF_PROVIDER` is **unchanged**: the gate workflow runs in this repository
   and uses the hub's existing provider with a different service account.

8. **Set the `phd-milestones` variables in that repository** (all four are new
   there):

   ```sh
   terraform -chdir=infra output -json satellite_github_actions_variables \
     | jq -r '."phd-milestones" | to_entries[] | "\(.key)\t\(.value)"'
   gh variable set GCP_PROJECT_ID     --repo djjay0131/phd-milestones --body "<...>"
   gh variable set GCP_WIF_PROVIDER   --repo djjay0131/phd-milestones --body "<...>"
   gh variable set GCP_PUBLISH_SA     --repo djjay0131/phd-milestones --body "<...>"
   gh variable set GCP_CONTENT_BUCKET --repo djjay0131/phd-milestones --body "<...>"
   ```

   The same trap as `cv`: `GCP_WIF_PROVIDER` exists in several repositories with
   *different* values. This one must contain
   `.../workloadIdentityPools/satellites/providers/github-phd-milestones`.

9. **Seed the allowlist** with the member seed script (owner's step; the gate
   stream owns the script). No email address is in this repository, and none
   should be.

10. **Run the Checkpoint 4 verification** below, before announcing the private
    area works.

### Cost

Phase 3's expected addition to the bill: **$0.00/month**, with one line that can
plausibly reach a few cents. Rates and allowances read 2026-09-17.

| Line | Allowance / rate | Phase 3 usage | Cost |
|---|---|---|---|
| Cloud Run | Free tier: "2 million requests per month", "360,000 GB-seconds of memory, 180,000 vCPU-seconds of compute time", "1 GB of outbound data transfer from North America per month" ([Free Program](https://cloud.google.com/free/docs/free-cloud-features)) | `min-instances = 0`, so nothing runs at rest. A few hundred member requests a month, ~1s each at 1 vCPU / 512 MiB | **$0.00** |
| Artifact Registry | "0.5 GB of storage per month" free ([Free Program](https://cloud.google.com/free/docs/free-cloud-features)) | 5 retained versions of one Python image. Layers are shared between versions, so five builds of the same base are ≈ one base plus five small application layers, not 5× the image | **$0.00**, see the sensitivity note |
| Firestore (Native) | Free tier: "1 GiB of storage per project", "50,000 reads, 20,000 writes, and 20,000 deletes per day per project" ([Free Program](https://cloud.google.com/free/docs/free-cloud-features)) | Two documents. One read per private request | **$0.00** |
| Identity Platform | "no-cost tier of 50,000" monthly active users ([Identity Platform pricing](https://cloud.google.com/identity-platform/pricing)) | Two users | **$0.00** |
| Private bucket (Cloud Storage) | Free tier: 5 GB-months regional (US regions), 5,000 Class A, 50,000 Class B ops ([Cloud Storage pricing](https://cloud.google.com/storage/pricing)) | A few MB of rendered HTML, one destructive sync per deploy, one read per private request. us-east1 qualifies | **$0.00** |
| IAM: 2 custom roles, 2 service accounts, 6 bindings, 1 WIF binding | "All use of Identity and Access Management API is free of charge" | — | **$0.00** |

Sensitivity, so the number is honest rather than merely small:

- **Artifact Registry is the one line that can leave the free tier.** If the gate
  image is large and its layers do *not* dedupe well, five retained versions
  could exceed 0.5 GB. At the published per-GB storage rate that is single-digit
  cents a month — immaterial against the $5 budget, but it is the line to watch,
  and it is why `keep-last-5` exists rather than unbounded retention. The
  per-GB overage rate could not be re-read from the pricing page from this
  environment; confirm it at Checkpoint 4 if the repository grows.
- **Cloud Run's cost is bounded by `gate_max_instance_count = 3`**, which is what
  stops a burst of traffic to a public `*.run.app` URL from spending real money.
  The invoker is `allUsers` by design (ADR-0004), so this cap is a budget
  control, not a formality.
- The $5 budget is unchanged and untouched by this phase.

### Rollback (Phase 3 resources only)

The budget is never removed (§12.6), and no rollback runs `terraform destroy`
without `-target`. In increasing order of severity:

1. **Take the private area offline instantly, without touching data:** targeted
   destroy of `google_storage_bucket_iam_member.gate_private_reader`. The gate
   then 403s on every object; nothing is deleted. Fully reversible by re-applying.
2. **Stop the gate serving at all:** targeted destroy of
   `google_cloud_run_v2_service_iam_member.gate_invoker_all_users` (every request
   is refused at the platform), or of the service itself —
   `deletion_protection = false` makes that possible deliberately, because the
   service is stateless and one apply plus one image deploy re-creates it.
3. **Stop `phd-milestones` publishing:** remove its entry from `var.satellites`
   and apply. That destroys its provider, service account and bucket binding —
   nothing else, and nothing belonging to `cv`.
4. **Stop the hub writing private output:** targeted destroy of
   `google_storage_bucket_iam_member.hub_deploy_private_sync`. The build can then
   neither publish nor prune; existing private content stays served.
5. **Remove the private bucket:** only when it is empty. `force_destroy = false`
   means a bucket still holding objects fails to destroy, by design.

**Never** targeted-destroy `google_project_iam_custom_role.private_object_reader`
or `private_sync_writer`: both are `deletion_policy = "PREVENT"`, and a deleted
custom role locks its ID for 7–37 days, so the gate could not read (or the hub
could not publish) for that whole window with no way to apply out of it. Revoke
at the **binding** (steps 1 and 4), never at the role.

Two things this module cannot roll back, stated so nobody tries:

- **Firestore** has `delete_protection_state = "DELETE_PROTECTION_ENABLED"` and
  `deletion_policy = "ABANDON"`. A destroy removes it from state and leaves the
  database. Deleting it for real is a deliberate two-step change.
- **Identity Platform** "is created only once during intialization and cannot be
  deleted, individual Identity Providers may be disabled instead" (provider
  docs). Disable providers; do not expect to remove the config.

## Guardrails

- **No keys.** Nothing here creates a service-account key, and nothing may
  (§12.2). GitHub Actions authenticates through WIF — the hub's deploy identity
  and every satellite's publish identity alike.
- **No satellite gets `storage.objects.list`** (ADR-0007 decision 4), and the
  content bucket keeps `uniform_bucket_level_access = true`. See
  [the two settings that must never change](#the-two-settings-that-must-never-change).
  If a change appears to need either, stop and raise it; do not widen the grant.
- **Domains (ADR-0006).** The hub is `jason.cusati.us`. `research.cusati.us`
  301-redirects to it.
  - `cusati.us` and `www.cusati.us` are reserved for a family site outside this
    project. This module never binds them, and `variables.tf` rejects them.
  - The apex carries Google Workspace MX records and a Google site-verification
    TXT record. **No hub step adds, changes or removes records on the apex or
    `www`, or any MX or existing TXT record.**
  - At the registrar, change only the records `custom_domain_dns_records` lists
    for the two hub hostnames. If an entry's `domain_name` is the apex or `www`,
    stop.
- **Budget (§12.6: the budget alert is never removed).** Three controls:
  - `google_billing_budget.hub` has `lifecycle { prevent_destroy = true }`. A plan
    that would destroy or replace the budget (`terraform destroy`, or an edit
    that forces replacement) fails, but **only while the resource block is in
    the configuration**. Terraform: "This rule doesn't prevent Terraform from
    destroying a resource if you remove its configuration"
    (<https://developer.hashicorp.com/terraform/language/meta-arguments/lifecycle>).
    Deleting the block, or `budget.tf`, destroys the budget in one apply.
  - The `budget-guard` job in `.github/workflows/build.yml` runs on every
    trigger of the workflow. It fails when `infra/budget.tf` is missing,
    or lacks `resource "google_billing_budget" "hub"` or that block's
    `prevent_destroy = true`. It also fails when any tracked file under `infra/`
    matches `override.tf*` or `*_override.tf*`: Terraform merges override files
    into resource blocks, "the contents of any `lifecycle` nested block … on an
    argument-by-argument basis", so an override can set
    `prevent_destroy = false` while `budget.tf` is unchanged. The job runs on
    every trigger.
  - Apply provenance (below).

  No rollback removes `budget.tf` or the budget. To remove other resources,
  use a targeted destroy of named resources (handoff, manual step 10). If a plan
  lists `google_billing_budget.hub` to be destroyed or replaced, do not apply it.
- **Apply provenance.** Run `terraform apply` only from a clean checkout of the
  reviewed PR head or of `main`:
  - `git status --porcelain` prints nothing;
  - `git rev-parse HEAD` equals the PR's head commit, or `origin/main` after
    `git fetch`;
  - the `budget-guard` check is green on that commit;
  - from the repository root,
    `ls infra/override.tf* infra/*_override.tf* 2>/dev/null` prints nothing.
    `infra/.gitignore` ignores override files, so neither `git status --porcelain`
    nor `budget-guard` sees a local one, yet Terraform would merge it into the
    budget's `lifecycle`.

  Apply a saved plan (`terraform plan -out=tfplan`, then `terraform apply tfplan`).
  Record the applied commit SHA in the sprint `STATE.md`.
- **Destroy.** The project is a data source and survives `terraform destroy`.
  Firebase cannot be removed from a project once added; the Hosting site uses
  `deletion_policy = "ABANDON"`. APIs are left enabled.

## State

Phase 1 uses **local state**, kept out of git by `infra/.gitignore`. State holds
resource names and the billing account ID but no credentials. Back up
`terraform.tfstate` after every apply to a private location outside the
repository.

**Proposed backend (ADR candidate C10, still not adopted):** a GCS bucket in the
hub project, for example `<project_id>-tfstate`, with object versioning, uniform
bucket-level access, public access prevention, and no principal other than the
owner. It is created outside this module (it cannot hold its own state), and
adopted with a `backend "gcs"` block and `terraform init -migrate-state`.

Phase 2 removes the reason it was deferred: `storage.googleapis.com` is now
enabled and this module already creates buckets, so the Phase 1 blocker (issue
#10 K1) is gone, and the owner's Checkpoint 2 decision was "local for now; move
to a bucket in Phase 2 (C10)". It is **not** done here because the Phase 2 scope
in the roadmap does not include it. It needs a decision and its own change; see
the Phase 2 handoff §ADR candidates.

## Checkpoint 3 — verifying the boundary

**Do not use `gcloud storage` to test the satellite identity.** Verified at Checkpoint 3 on
2026-09-16: `gcloud storage cp` requires `storage.objects.list` even for a single
non-recursive file into the satellite's *own* prefix, and that permission is deliberately
never granted. A `gcloud` test therefore fails on the **allowed** path too, which looks like
a broken boundary and is not one. Test with the JSON API and an impersonated token, which
exercises exactly the permissions the real publish path uses:

```bash
TOKEN="$(gcloud auth print-access-token --impersonate-service-account="$SA")"
U=https://storage.googleapis.com

# ALLOWED inside its own prefix: create, overwrite, read, delete -> 200 200 200 204
curl -s -o /dev/null -w '%{http_code}\n' -X POST -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: text/plain' --data-binary @/tmp/boundary.txt \
  "$U/upload/storage/v1/b/$BUCKET/o?uploadType=media&name=sources%2Fcv%2F_probe.txt"

# DENIED outside it, including sources/cv-other/ which proves the trailing slash -> 403
curl -s -o /dev/null -w '%{http_code}\n' -X POST -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: text/plain' --data-binary @/tmp/boundary.txt \
  "$U/upload/storage/v1/b/$BUCKET/o?uploadType=media&name=sources%2Fcv-other%2F_probe.txt"

# DENIED listing, even its own prefix -> 403
curl -s -o /dev/null -w '%{http_code}\n' -H "Authorization: Bearer $TOKEN" \
  "$U/storage/v1/b/$BUCKET/o?prefix=sources%2Fcv%2F&maxResults=1"
```

**Prove there is no *other* grant** (Chief Reviewer S10). The checks above confirm the role
and the bucket binding are right; these confirm nothing else reaches the satellite, which
Terraform cannot show because it sees only what it declares:

```bash
# Expect NO rows: the publishing identity must hold no project-level role at all.
gcloud projects get-iam-policy "$PROJECT" \
  --flatten="bindings[].members" \
  --filter="bindings.members:publish-cv@${PROJECT}.iam.gserviceaccount.com" \
  --format="table(bindings.role)"

# Expect EXACTLY two bindings: hub-deploy objectViewer (unconditioned), and
# satellitePublisher conditioned to sources/cv/.
gcloud storage buckets get-iam-policy "gs://${CONTENT_BUCKET}"

# Expect NO user-managed keys.
gcloud iam service-accounts keys list \
  --iam-account="publish-cv@${PROJECT}.iam.gserviceaccount.com" --managed-by=user
```

## Checkpoint 4 — verifying the private area

Run **after apply and before announcing that the private area works**. The full
procedure, with expected output for every command, is in
`llm/sprints/2026-09-hub/handoffs/infra-phase-3.md` §Checkpoint 4. The two checks
that matter most are here, because they are the ones whose failure is silent.

### Proving the private bucket has exactly one reader

"Exactly one reader" is an **equality** assertion, not an absence one: it is not
enough to look for `allUsers` and find none. Enumerate the whole policy and
compare it against the expected set.

```sh
cd infra
PROJECT="$(terraform output -raw project_id)"
BUCKET="$(terraform output -raw private_bucket_name)"
GATE_SA="$(terraform output -raw gate_service_account_email)"
HUB_SA="$(terraform output -raw deploy_service_account_email)"

PROJECT="$PROJECT" BUCKET="$BUCKET" GATE_SA="$GATE_SA" HUB_SA="$HUB_SA" \
  PROBE_OBJECT="index.html" \
  bash scripts/check-private-bucket-iam.sh
```

It asserts, and fails loudly on any of them:

1. `uniform_bucket_level_access` is `True` — **checked first, and it stops the
   run if it fails**, because with it off an object ACL can publish a single
   object while the IAM policy still looks perfect.
2. `public_access_prevention` is `enforced`.
3. No `allUsers` and no `allAuthenticatedUsers` anywhere in the policy.
4. The non-legacy bindings are **exactly two**: `privateObjectReader` →
   the gate, `privateSyncWriter` → `hub-deploy`. A third binding fails the check.
5. An anonymous `GET` of a real private object is refused (401/403/404). This is
   the roadmap's last clause, and it needs no credential at all.

It also **prints, without failing on them**, the `legacyBucketOwner` /
`legacyObjectReader` bindings Cloud Storage creates automatically on every
bucket. They are not granted by this module, but they mean **any principal with
project Viewer on `cusati-hub` can read every private object**. Today that is
only the owner. This was recorded as acceptable for the content bucket at
Checkpoint 3; now that the bucket holds private material it needs the owner's
explicit acceptance. See the handoff §Risks.

### Proving the satellite boundary still holds, in both directions

Phase 2 proved `cv` cannot escape `sources/cv/`. With a second satellite the
interesting failure is cross-satellite, so run it **both ways** — and note that
the `phd-milestones` direction is the one where a leak would expose private
source object names.

Use the JSON API, never `gcloud storage`: `gcloud storage cp` requires
`storage.objects.list` even for a single file into the satellite's *own* prefix,
so a `gcloud` test fails on the allowed path too and looks like a broken
boundary that is not one (verified at Checkpoint 3). The exact commands are in
the handoff §Checkpoint 4, test 2.

### The credential-free half, which runs on every push (in `budget-guard`)

```sh
python3 infra/scripts/check_private_bucket_config.py
```

Expected: `OK: private bucket declares uniform bucket-level access and enforced
public access prevention, names no anonymous principal, and carries exactly two
bindings …`. It needs no cloud access, so it runs on every push and every pull
request in the `budget-guard` job — which is **already a required status check on
`main`**, so every assertion in it binds from the moment it lands rather than
waiting on a branch-protection change.

It now also asserts the gate's Identity Platform role holds exactly
`firebaseauth.users.createSession` and `firebaseauth.users.get`, and that
`gate.tf` names no predefined Authentication role — so re-widening N-1 fails CI
instead of passing review.

Two further credential-free guards run in the same job:

| Step | Asserts |
|---|---|
| `Check the executable bit on every tracked script` | every `*.sh` with a shebang, and every file invoked directly anywhere, is committed `100755`; every interpreted module is `100644` |
| `Check the satellite boundary invariants are declared` | uniform bucket-level access on **both** buckets; `satellitePublisher` holds exactly its three permissions and never `storage.objects.list`; every satellite binding uses that custom role **with** a `startsWith` prefix condition; no satellite holds a project-level role |

The executable-bit guard reads modes from the **index** (`git ls-files -s`) and
file contents from the index blob, never from the working tree. `/mnt/c` is a
DrvFs mount that reports every file `0777`, so anything stat-ing the filesystem
would call a file committed `100644` executable — the exact defect the guard
exists to catch, which cost a red CI in Phase 2.

### Running the private sync in plan-only mode

`private-sync` in `build.yml` is the one job that can destroy data. Its plan and
apply steps used to be consecutive, so the delete list was only readable after
the deletion. Setting the repository variable `PRIVATE_SYNC_PLAN_ONLY` to
`true` skips the apply step and leaves the enumerated delete list in the log:

```sh
gh variable set PRIVATE_SYNC_PLAN_ONLY --body true   --repo djjay0131/website
# run the workflow, read the delete list, then:
gh variable delete PRIVATE_SYNC_PLAN_ONLY            --repo djjay0131/website
```

**Unset means apply, deliberately.** The condition is
`vars.PRIVATE_SYNC_PLAN_ONLY != 'true'`, so an unset variable is `'' != 'true'`
→ true → the sync runs exactly as before. Failing closed here would silently
stop the private area updating and keep serving withdrawn content, which is
worse than the failure it prevents.

## Monitoring and alerting

Before this existed the project had **no** alert policies, **no** uptime checks, **no**
notification channels and **no** log-based metrics. Nothing would ever have said the site
was down or that sign-in was broken — and nothing did: a sign-in failure was found by
trying to sign in, and diagnosed by an afternoon of interactive troubleshooting.

Everything is declared in `monitoring.tf`. Nothing is clicked in a console, so nothing
silently reverts.

### What is watched

| | |
|---|---|
| `Hub public site` uptime | `https://<domain>/` every 5 minutes |
| `Hub private gate` uptime | the gate's `/_health`, every 5 minutes |
| `hub-gate-denials` | counts the gate's own `event=deny` lines |
| `hub-signin-failures` | counts `event=client_signin_failed`, reported by the browser |

Three alert policies — site down, gate down, sign-in failing — each carrying the literal
`gcloud logging read` command in its `documentation{}` block. The alert email is meant to be
the first page of the runbook; an alert that only says "something is wrong" restarts the
very back-and-forth this exists to end.

### After the first apply — three things that must be VERIFIED, not assumed

**1. Click the verification link. THIS IS STILL OUTSTANDING.** Google emails `var.ops_email` a
confirmation. Until it is clicked the channel exists, accepts every policy, and **delivers
nothing**. That state looks exactly like "nothing is wrong".

As of 2026-09-18 the channel has **no `verificationStatus` field at all**, which means
unverified: Google emailed `djjay@vt.edu` at 15:27:37Z and the link has not been clicked, so
all three policies are silent. This is console work and an owner step:

> Open <https://console.cloud.google.com/monitoring/alerting/notifications>, find **Hub ops
> email**, and use **Send verification email** if the original has expired, then click the
> link in the mail. If it never arrives, see the SMS channel below — the owner also reports
> Firebase sign-in emails never arriving, and two symptoms pointing at one delivery problem
> is why alerting no longer depends on email alone.

```bash
gcloud alpha monitoring channels list --project <project> \
  --format='value(displayName,type,verificationStatus)'
```

Expect `VERIFIED`. `UNVERIFIED` — or the field being **absent**, which is how it presents
before any verification attempt — means every alert below is silent.

`gcloud alpha`/`beta` may not be installed. The same answer with no components, read-only:

```bash
curl -s -H "Authorization: Bearer $(gcloud auth print-access-token)" \
  "https://monitoring.googleapis.com/v3/projects/<project>/notificationChannels"
```

**1b. The second channel, which does not depend on email.** Set `ops_sms_number` (E.164, e.g.
`+15035550123`) and a `sms` channel is created beside the email one and attached to all three
policies. It is **empty by default**, so nothing is created until the owner supplies a number.
It verifies by a code sent *to the phone*, a path that shares nothing with email — which is
the whole point, since email delivery is the thing under suspicion.

Google's own caveat, recorded rather than glossed: SMS "isn't a fully reliable notification
channel type, and it might not be available in certain regions", and Google recommends
pairing it with another type. It is therefore a **second** channel beside email, never a
replacement. Cloud Monitoring bills metrics ingestion, API calls, uptime checks and
alerting-policy metric references — not notification delivery — so this line is **$0.00**.

**2. Confirm each policy actually has the channel attached.**

**2. Confirm each policy actually has the channel attached.**

```bash
gcloud alpha monitoring policies list --project <project> \
  --format='value(displayName,enabled,notificationChannels)'
```

Expect a channel on every row. This check exists because in the project this design was
taken from, the single most important alert had its `notification_channels` line commented
out and had been firing into the void — nobody noticed, because a silent alert and a healthy
system are indistinguishable from the outside.

### Why `/_health` and not `/healthz`

Google's frontend answers `/healthz` for this service before the request reaches the
container, so an uptime check against it would report on Google's error page rather than on
the gate. Verified at Checkpoint 4: `/healthz` returns a 1568-byte Google page while the
gate's own 404 is 329 bytes, and no `/healthz` request ever appears in the container log.

### Querying by hand

```bash
# Why is sign-in failing? The class is a closed vocabulary, so this says WHICH way.
gcloud logging read 'resource.type="cloud_run_revision" AND textPayload:"event=client_signin_failed"' \
  --project <project> --freshness=30m --limit=50

# What did the gate itself decide?
gcloud logging read 'resource.type="cloud_run_revision" AND textPayload:"event=deny"' \
  --project <project> --freshness=30m --limit=50
```

A browser and the gate share one `X-Trace-Id` per page load, so one id ties the click, the
classified failure and the gate's decision onto a single timeline.

### Sharp edges, each a 400 at apply time

1. An alert filter must constrain `resource.type` even when the log metric already does.
2. Log-based counters are `DELTA` — use `ALIGN_DELTA`; `ALIGN_COUNT` is rejected.
3. `condition_absent` cannot catch "never emitted at all". The sign-in policy deliberately
   uses `EVALUATION_MISSING_DATA_INACTIVE`: no data means nobody failed, and firing on that
   would page continuously on a healthy site.
4. Uptime checks take the host **without** a scheme.
