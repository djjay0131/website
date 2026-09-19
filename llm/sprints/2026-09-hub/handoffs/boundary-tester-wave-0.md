# Handoff — `boundary-tester`, Wave 0

Stream: `boundary-tester` · Wave 0 · Issue #44 (hub-007) · 2026-09-19
Contract: `llm/sprints/2026-09-hub/contracts/boundary-tester-wave-0.md`

---

**Six boundaries verified live, plus five supporting invariants re-verified that the
contract did not ask for. Three proof families — 26 probes — specified for the Lead
Architect to run under a temporary grant. Nothing was mutated; no grant was made.**

Two of the six verified boundaries did **not** hold as the contract describes them, and
both corrections are in the table below:

- **Item 4** — the default-branch ref is **not** pinned on the WIF *provider*. It is pinned
  one layer down, on each service account's `workloadIdentityUser` binding. The pin is real
  and per-satellite; the account of *where* it lives was wrong.
- **Item 6** — the claim's two halves are both true, but they are not the whole risk.
  `projectViewer` is empty, so the legacy *reader* bindings grant nobody anything today.
  `projectEditor` is **not** empty, and it carries `legacyObjectOwner` — **write and delete**
  on every object in both buckets, including the private one.

Also: the satellite set is **two** (`cv`, `phd-milestones`), not four. `construction-ai-proposal`
and `agentic-kgis`/`kgis` do not exist in this project — no service account, no WIF provider,
no bucket prefix, no Terraform entry. They are Phase 5 roadmap items. See §Open questions 1,
which matters for the `sources/kgis/` reverse leg the contract asks for.

---

## Verdict table

Verified live by me, read-only, as `user:djjay0131@gmail.com`. No impersonation was used
and none was possible — see supporting invariant S3.

| # | Boundary | Identity | Command | Expected | Actual | Verdict |
|---|---|---|---|---|---|---|
| 1 | Private bucket carries exactly **two** non-legacy principals, in the roles `check_private_bucket_config.py` asserts | owner | `gcloud storage buckets get-iam-policy gs://cusati-hub-private --format=json` | `privateObjectReader`→`hub-gate`, `privateSyncWriter`→`hub-deploy`, and nothing else non-legacy | exactly those two; 4 legacy bindings; no `allUsers`/`allAuthenticatedUsers` | **PASS** |
| 1a | `privateObjectReader` permission set | owner | `gcloud iam roles describe privateObjectReader --project=cusati-hub` | `[storage.objects.get]` | `[storage.objects.get]` | **PASS** |
| 1b | `privateSyncWriter` permission set | owner | `gcloud iam roles describe privateSyncWriter --project=cusati-hub` | `create,delete,get,list` | `create,delete,get,list` | **PASS** |
| 2 | UBLA `true` + PAP `enforced`, **content** bucket, parsed from JSON | owner | `gcloud storage buckets describe gs://cusati-hub-content --format=json` | `true` / `enforced` | `uniform_bucket_level_access: true`, `public_access_prevention: "enforced"` | **PASS** |
| 2a | UBLA `true` + PAP `enforced`, **private** bucket | owner | `gcloud storage buckets describe gs://cusati-hub-private --format=json` | `true` / `enforced` | `uniform_bucket_level_access: true`, `public_access_prevention: "enforced"` | **PASS** |
| 3 | `satellitePublisher` is exactly create/delete/get, **no `list`** | owner | `gcloud iam roles describe satellitePublisher --project=cusati-hub` | 3 permissions, no `list` | `storage.objects.create`, `.delete`, `.get` | **PASS** |
| 4 | WIF pool separation | owner | `gcloud iam workload-identity-pools list --location=global` | two distinct pools; no satellite provider in the hub's pool | `github-actions` (1 provider: `website`) and `satellites` (2 providers: `github-cv`, `github-phd-milestones`), both ACTIVE | **PASS** |
| 4a | Every provider pins numeric `repository_id` **and** `owner_id` | owner | `... providers list --workload-identity-pool=satellites` | both numeric IDs in `attributeCondition` | both pinned on all 3 providers, plus repo name and `event_name != 'pull_request_target'` | **PASS** |
| 4b | Every provider pins the **default-branch ref** | owner | same as 4a | ref pinned in `attributeCondition` | **NOT on the provider.** No `attributeCondition` mentions `ref` | **CORRECTED — see 4c** |
| 4c | The default-branch ref is pinned, per satellite, on the SA binding | owner | `gcloud iam service-accounts get-iam-policy publish-<s>@…` | `…/attribute.repository_id_ref/<repo_id>/refs/heads/<branch>` | `publish-cv` ← `…/1211056144/refs/heads/`**`master`**; `publish-phd-milestones` ← `…/1373915518/refs/heads/`**`main`** | **PASS** |
| 5 | Anonymous GET of a private object is refused | **none (unauthenticated)** | `curl …/storage/v1/b/cusati-hub-private/o/<obj>?alt=media` | 401/403/404 | **401**, body names `storage.objects.get` denied | **PASS** |
| 5a | Anonymous GET via the XML endpoint | none | `curl https://storage.googleapis.com/cusati-hub-private/<obj>` | refused | **403** | **PASS** |
| 5b | Anonymous **list** of either bucket | none | `curl …/storage/v1/b/<bucket>/o` | refused | **401** both buckets | **PASS** |
| 6 | Who actually holds project Viewer on `cusati-hub` | owner | `projects:getIamPolicy` at `requestedPolicyVersion: 3` | enumerate | **No `roles/viewer` binding exists at all** — 14 bindings, none conditional. `projectViewer` expands to the empty set | **PASS (claim confirmed)** |
| 6a | The owner holds `roles/owner` → `projectOwner` | owner | same | `roles/owner` | `roles/owner` → `user:djjay0131@gmail.com`; no separate viewer grant | **PASS (claim confirmed)** |
| 6b | What `projectEditor` expands to | owner | same | — | `roles/editor` → `serviceAccount:410552878319-compute@developer.gserviceaccount.com` — **non-empty**, and holds `legacyObjectOwner` (read+write+delete) on both buckets | **FINDING — see Risks 1** |

### Supporting invariants — not asked for, re-verified because they carry the same weight

| # | Invariant | Result |
|---|---|---|
| S1 | Project-level roles for `publish-cv` | **none** — re-confirms the Checkpoint 3 leg "Terraform structurally cannot prove" |
| S2 | Project-level roles for `publish-phd-milestones` | **none** — this had never been checked; the second satellite was created at Checkpoint 4 |
| S3 | Outstanding `serviceAccountTokenCreator` on either satellite SA | **none.** Each SA's policy holds exactly one binding: `workloadIdentityUser` to its branch-pinned principalSet. The Checkpoint 3 temporary grant is confirmed still removed, and no impersonation path is open today |
| S4 | User-managed keys on both satellite SAs | **none** on either |
| S5 | Both content-bucket prefix conditions end in a slash | **yes**, live: `…/objects/sources/cv/` and `…/objects/sources/phd-milestones/`. This is the *static* half of the trailing-slash proof; the dynamic half needs impersonation (F7 below) |

`publish-phd-milestones`' conditioned bucket binding is verified live here for the first
time — it was created at Checkpoint 4 and only ever checked in the plan.

---

## Transcripts

### Item 1 — private bucket policy (verbatim, non-legacy bindings)

```json
{"role": "projects/cusati-hub/roles/privateObjectReader",
 "members": ["serviceAccount:hub-gate@cusati-hub.iam.gserviceaccount.com"]}
{"role": "projects/cusati-hub/roles/privateSyncWriter",
 "members": ["serviceAccount:hub-deploy@cusati-hub.iam.gserviceaccount.com"]}
```

Legacy, unchanged and not granted by this module: `legacyBucketOwner` and `legacyObjectOwner`
→ `projectEditor:cusati-hub`, `projectOwner:cusati-hub`; `legacyBucketReader` and
`legacyObjectReader` → `projectViewer:cusati-hub`. No anonymous principal anywhere.

This matches `EXPECTED_PRIVATE_BUCKET_BINDINGS` in `infra/scripts/check_private_bucket_config.py`
exactly — `gate_private_reader`→`private_object_reader`, `hub_deploy_private_sync`→`private_sync_writer`
— and both role permission sets match `EXPECTED_ROLE_PERMISSIONS`.

**On "two, not one".** The roadmap clause reads "any reader other than the gate's service
account", which sounds like a one-principal invariant. It is a **two**-principal invariant,
and ADR-0010 decision 5 is why: withdrawal must remove the artifact from the private output,
so the sync is destructive, so it needs `list` + `delete` on that bucket — permissions the
gate must never hold. The second principal is load-bearing, not slack. A future reader
tempted to "tighten" this to one principal would break withdrawal semantics.

### Item 2 — the field shape, which is the whole point of this check

This gcloud returns both fields **flat and snake_case**, and UBLA as a JSON **boolean**, not
a nested `{"enabled": true}`:

```json
{"name": "cusati-hub-content", "location": "US-EAST1",
 "public_access_prevention": "enforced", "uniform_bucket_level_access": true}
{"name": "cusati-hub-private", "location": "US-EAST1",
 "public_access_prevention": "enforced", "uniform_bucket_level_access": true}
```

I parsed JSON with a shape-tolerant reader rather than a `--format=value(...)` projection,
which is the defect recorded at Checkpoint 4. `check-private-bucket-iam.sh` has already been
fixed for this and is correct for both shapes of UBLA — but see Recommendations 2 for a
residual asymmetry in that script that will bite on a future gcloud.

### Item 5 — the anonymous probes, verbatim statuses

```
JSON API, alt=media (private object)      401
JSON API, object metadata                 401
XML endpoint (private object)             403
JSON API, list private bucket             401
JSON API, list content bucket             401
JSON API, private bucket metadata         401
```

Error body: `Anonymous caller does not have storage.objects.get access to the Google Cloud
Storage object. Permission 'storage.objects.get' denied on resource '…/buckets/cusati-hub-private/objects/…'
(or it may not exist).`

No bytes were written to any transcript: every probe used `-o /dev/null -w '%{http_code}'`
except the one error-body read above, which returned a permission-denied message, not content.

Note the denial names **`storage.objects.get`** — consistent with the Checkpoint 3 correction
that denials name `get`/`list`, never `.create`. The `(or it may not exist)` suffix is the
correct behaviour: GCS refuses to disclose existence to a caller without `get`. Probe R2
below is designed to confirm that property still holds for a *satellite* identity.

The **content** bucket is equally unreadable anonymously (401). Public content reaches the
world through Firebase Hosting and the hub build, never by direct bucket access.

### Item 6 — the project policy, at policy version 3

Requested with `{"options":{"requestedPolicyVersion":3}}` against `cloudresourcemanager.googleapis.com`
(a read-only `getIamPolicy`, despite the POST verb) specifically so that **conditional**
bindings could not hide. The server returned `"version": 1` with 14 bindings, which means
the policy contains no conditional bindings at all — so the enumeration is complete, not a
version-1 truncation.

```
roles/owner                        -> user:djjay0131@gmail.com
roles/editor                       -> serviceAccount:410552878319-compute@developer.gserviceaccount.com
roles/datastore.viewer             -> serviceAccount:hub-gate@cusati-hub.iam.gserviceaccount.com
roles/firebaseauth.admin           -> serviceAccount:hub-gate@cusati-hub.iam.gserviceaccount.com
roles/firebasehosting.admin        -> serviceAccount:hub-deploy@cusati-hub.iam.gserviceaccount.com
roles/serviceusage.apiKeysViewer   -> serviceAccount:hub-deploy@cusati-hub.iam.gserviceaccount.com
roles/iam.serviceAccountTokenCreator -> serviceAccount:firebase-adminsdk-fbsvc@cusati-hub.iam.gserviceaccount.com
+ 7 Google-managed service-agent bindings
```

**No `roles/viewer`. No `roles/browser`. No `publish-*` member in any binding.** Both halves
of the reported claim are confirmed, and the absence is stronger than reported: the legacy
*reader* bindings on both buckets currently grant nobody anything, because their principal
set is empty.

`roles/firebaseauth.admin` on `hub-gate` is still present — that is A12 / issue #49, already
tracked and being fixed by the `infra` stream. Recorded here only as an independent
confirmation that it survived Checkpoint 4.

---

## What I did NOT run, and why

The forward and reverse prefix proofs require impersonating `publish-cv` and
`publish-phd-milestones`, which requires granting `roles/iam.serviceAccountTokenCreator`.
That is a cloud mutation. **I made none, and I verified (S3) that no such grant is
outstanding right now.** The specification below is written to be run by the Lead Architect
under an owner-authorised temporary grant, removed immediately and verified removed, exactly
as at Checkpoint 3.

---

## SPECIFICATION — 26 probes, for the Lead Architect

### Protocol around the grant

1. Owner authorises `roles/iam.serviceAccountTokenCreator` in advance, naming both satellite
   service accounts and the operator principal.
2. Grant it, run everything below, delete the probe objects, **remove the grant**.
3. Verify removal: `gcloud iam service-accounts get-iam-policy publish-<s>@cusati-hub.iam.gserviceaccount.com`
   must return **exactly one** binding — `roles/iam.workloadIdentityUser` to the branch-pinned
   principalSet — for each satellite. That is the S3 state recorded above; restoring it is
   the exit condition.

### Rules that make the transcript trustworthy

- **Use the JSON API. Never `gcloud storage`.** `gcloud storage cp` requires
  `storage.objects.list` *at all* — not only with `--recursive` — even for a single file into
  the satellite's own allowed prefix. A `gcloud` run fails on the **allowed** path and reads
  exactly like a broken boundary. This made our own runbook unrunnable at Checkpoint 3
  (ADR-0007 decision 6, strengthened 2026-09-16).
- **Expect denials to name `storage.objects.get` / `storage.objects.list`, never `.create`.**
  A denial naming `.create` means something else is wrong.
- **Record status codes only** (`-o /dev/null -w '%{http_code}\n'`). The reverse probes target
  private source material; if one returns 200, that *is* the finding — record the status and
  stop, do not capture the body.
- **Never echo `$TOKEN`** and never paste it into the handoff.
- Run the **positive control first**. At Checkpoint 3 the first positive control failed and
  it was the runbook, not the boundary. If F1 is not 200, stop and fix the harness before
  believing any 403 below.

### Environment

```sh
export CLOUDSDK_PYTHON=/home/djjay/.local/share/uv/python/cpython-3.12.11-linux-x86_64-gnu/bin/python3.12
U=https://storage.googleapis.com
CONTENT=cusati-hub-content
PRIVATE=cusati-hub-private
CV_SA=publish-cv@cusati-hub.iam.gserviceaccount.com
PHD_SA=publish-phd-milestones@cusati-hub.iam.gserviceaccount.com
echo boundary-check > /tmp/boundary.txt

code() { curl -s -o /dev/null -w '%{http_code}\n' "$@"; }
```

### FORWARD — inside its own prefix (expect 200, 200, 200, 204)

Run twice: once with `S=cv` / `SA=$CV_SA`, once with `S=phd-milestones` / `SA=$PHD_SA`.

```sh
S=cv; SA=$CV_SA          # then: S=phd-milestones; SA=$PHD_SA
TOKEN="$(gcloud auth print-access-token --impersonate-service-account="$SA")"
OBJ="sources%2F${S}%2F_probe.txt"

# F1  create in own prefix                     -> 200   (POSITIVE CONTROL: stop if not)
code -X POST -H "Authorization: Bearer $TOKEN" -H 'Content-Type: text/plain' \
  --data-binary @/tmp/boundary.txt "$U/upload/storage/v1/b/$CONTENT/o?uploadType=media&name=$OBJ"

# F2  overwrite the SAME object                -> 200   (needs create AND delete;
#                                                        objectCreator alone fails here)
code -X POST -H "Authorization: Bearer $TOKEN" -H 'Content-Type: text/plain' \
  --data-binary @/tmp/boundary.txt "$U/upload/storage/v1/b/$CONTENT/o?uploadType=media&name=$OBJ"

# F3  read it back                             -> 200
code -H "Authorization: Bearer $TOKEN" "$U/storage/v1/b/$CONTENT/o/$OBJ?alt=media"

# F4  delete it                                -> 204
code -X DELETE -H "Authorization: Bearer $TOKEN" "$U/storage/v1/b/$CONTENT/o/$OBJ"
```

After F4, as the **owner**, `gcloud storage ls --all-versions gs://$CONTENT/sources/$S/`
should still show the noncurrent generation. That retention is the mitigation ADR-0007
decision 8 relies on when it accepts that a satellite can delete its own objects.

### FORWARD — outside its own prefix (expect 403, 403, 403)

```sh
# For S=cv the other source is phd-milestones, and vice versa.
OTHER=phd-milestones      # then: OTHER=cv

# F5  another source's prefix                  -> 403
# F6  the bucket root                          -> 403
# F7  TRAILING-SLASH PROBE: sources/<S>-other/ -> 403
for NAME in "sources%2F${OTHER}%2F_probe.txt" "_probe.txt" "sources%2F${S}-other%2F_probe.txt"; do
  code -X POST -H "Authorization: Bearer $TOKEN" -H 'Content-Type: text/plain' \
    --data-binary @/tmp/boundary.txt "$U/upload/storage/v1/b/$CONTENT/o?uploadType=media&name=$NAME"
done
```

**F7 is the one that earns its place.** The live condition is
`resource.name.startsWith('projects/_/buckets/cusati-hub-content/objects/sources/cv/')` —
verified present with its trailing slash (S5). F7 proves the slash is actually *load-bearing*
at evaluation time: a source whose name merely **starts with** `cv` is refused. Without F7,
a condition that had lost its slash would pass every other probe in this document.

### LIST — both refused (expect 403, 403, 403)

```sh
# L1  list the bucket                          -> 403
code -H "Authorization: Bearer $TOKEN" "$U/storage/v1/b/$CONTENT/o?maxResults=1"

# L2  list its OWN prefix                      -> 403
code -H "Authorization: Bearer $TOKEN" "$U/storage/v1/b/$CONTENT/o?prefix=sources%2F${S}%2F&maxResults=1"

# L3  list the PRIVATE bucket entirely         -> 403
code -H "Authorization: Bearer $TOKEN" "$U/storage/v1/b/$PRIVATE/o?maxResults=1"
```

L2 is not redundant with L1. `storage.objects.list` **cannot** be prefix-restricted — the
IAM condition attribute does not apply to it — so the only safe grant is none, and L2 is
what demonstrates that the satellite cannot enumerate even the prefix it owns. A future
change that granted `list` "just for its own prefix" would pass L1 and fail L2.

### REVERSE — the leg nobody has run (expect 403 throughout)

This is the direction where a defect lets a **public** satellite reach **private** source
material. Standing Checkpoint 4 action, issue #50. Run as `cv` only.

```sh
TOKEN="$(gcloud auth print-access-token --impersonate-service-account="$CV_SA")"

# R1  cv READS an object that EXISTS in phd-milestones' prefix   -> 403
#     (sources/phd-milestones/manifest.json, 565 B, confirmed present)
code -H "Authorization: Bearer $TOKEN" \
  "$U/storage/v1/b/$CONTENT/o/sources%2Fphd-milestones%2Fmanifest.json?alt=media"

# R2  cv READS a name that does NOT exist in that prefix         -> 403  (NOT 404)
code -H "Authorization: Bearer $TOKEN" \
  "$U/storage/v1/b/$CONTENT/o/sources%2Fphd-milestones%2Fno-such-object?alt=media"

# R3  cv WRITES into phd-milestones' prefix                      -> 403
code -X POST -H "Authorization: Bearer $TOKEN" -H 'Content-Type: text/plain' \
  --data-binary @/tmp/boundary.txt \
  "$U/upload/storage/v1/b/$CONTENT/o?uploadType=media&name=sources%2Fphd-milestones%2F_probe.txt"

# R4  cv LISTS phd-milestones' prefix                            -> 403
code -H "Authorization: Bearer $TOKEN" \
  "$U/storage/v1/b/$CONTENT/o?prefix=sources%2Fphd-milestones%2F&maxResults=1"
```

**R1 and R2 are a designed pair, and the pair is the test.** Both must be **403**. If R1
returns 403 but R2 returns 404, `cv` can distinguish "exists" from "does not exist" inside
the private source's prefix — an existence oracle over private object names, which is
precisely the exposure ADR-0007 decision 4 excludes `list` to prevent. A 404 on R2 is a
**finding**, not a pass, even though nothing was read.

If any of R1–R4 returns 200: record the status code, **do not capture the body**, stop the
run, and treat it as a live exposure of private source material.

### REVERSE — `sources/kgis/`: specified, but vacuous today

The contract asks for `as cv, READ sources/kgis/`. **That prefix does not exist**, and
neither does the `agentic-kgis` satellite — no service account, no WIF provider, no
Terraform entry (§Open questions 1).

```sh
# R5  cv READS sources/kgis/   -> 403   (vacuous today: see below)
code -H "Authorization: Bearer $TOKEN" \
  "$U/storage/v1/b/$CONTENT/o/sources%2Fkgis%2Fmanifest.json?alt=media"

# R6  cv WRITES sources/kgis/  -> 403   (vacuous today)
code -X POST -H "Authorization: Bearer $TOKEN" -H 'Content-Type: text/plain' \
  --data-binary @/tmp/boundary.txt \
  "$U/upload/storage/v1/b/$CONTENT/o?uploadType=media&name=sources%2Fkgis%2F_probe.txt"
```

Both return 403 today, and **that 403 proves nothing about a `kgis` boundary**, because no
`kgis` boundary exists yet — the refusal comes from `cv`'s own condition not matching, which
R3 already established. Recording R5/R6 as a passed boundary test would be exactly the kind
of half-satisfied tick this sprint keeps punishing. They become meaningful the day
`agentic-kgis` is provisioned, and they should be run then, against a prefix that holds a
real manifest.

### Operational note, worth knowing before F1 runs

Writing `_probe.txt` into a live source prefix changes the content bucket's fingerprint, so
the hub's next scheduled poll will sync, rebuild and deploy. The probe object is **not**
rendered — the manifest is the authority (ADR-0010 decision 1) and no manifest lists it — so
this is churn, not exposure. Delete the probes promptly (F4), and prefer running the whole
set in one window rather than leaving objects between sessions.

---

## Summary

The declared boundary and the live boundary agree on every structural item I could check
without a credential I am not allowed to hold. The private bucket carries exactly its two
intended principals with exactly their intended permission sets; both buckets have UBLA on
and public access prevention enforced; `satellitePublisher` has never acquired `list`; the
two WIF pools are genuinely separate and no satellite provider sits in the hub's pool; and
an anonymous caller is refused on every surface of both buckets, by three different paths.

Two things are not as previously described. The **default-branch ref pin is real but lives
on the service-account binding, not the provider** — the boundary holds, the documentation of
it does not, and a reviewer checking only `attributeCondition` would wrongly conclude the ref
was unpinned. And the **project-level exposure is an editor exposure, not a viewer one**: the
records all discuss `projectViewer`, which is empty and grants nobody anything, while
`projectEditor` is non-empty and carries `legacyObjectOwner` — write and delete on every
object in both buckets.

What remains unproven is what was always going to remain unproven without impersonation: that
the prefix conditions actually *evaluate* the way they read. I have verified the conditions
exist, target the right prefixes, and end in a slash. Whether the slash bites is F7's job,
and F7 needs a token I must not obtain. The reverse leg — issue #50, `cv` reaching
`phd-milestones` — is specified here command-by-command for the first time, including the
R1/R2 existence-oracle pair that the prior runbook did not contain.

## Assumptions

1. `check_private_bucket_config.py` is the authority on which two principals and which two
   roles the private bucket must carry. I compared the live policy against that file rather
   than against the Terraform it guards, which is the point of a guard.
2. "Non-legacy" excludes the four `roles/storage.legacy*` bindings Cloud Storage creates on
   every bucket, consistent with the filter in `check-private-bucket-iam.sh`.
3. For item 5 I probed `_astro/client-events.QsUPomcU.js` (1,986 B) as a representative
   private object. The private bucket holds 83 objects and the result is a property of the
   bucket's IAM and PAP settings, not of the object chosen; `index.html` is the object the
   Checkpoint 4 runbook uses and would return the same status.
4. The satellite roster is what Terraform's `var.satellites` default declares and what the
   project actually holds — two. I did not assume the four named in my instructions.

## Recommendations

1. **Correct the ref-pin claim wherever it is written as a provider property** (contract text,
   and any runbook or review checklist that says "every provider pins the ref"). State it as:
   the provider pins repository identity; the **service-account binding** pins the ref, via
   `attribute.repository_id_ref`. The current wording would let a reviewer accept a provider
   with no ref pin, or "fix" a non-problem by adding a ref condition to the provider.
2. **Fix the residual field-shape asymmetry in `check-private-bucket-iam.sh`.** PAP is read
   shape-tolerantly (`d.get('public_access_prevention') or d.get('publicAccessPrevention')`);
   UBLA is not — it tries only the snake_case key, then `.enabled` if that yielded a dict. If
   a future gcloud returns `uniformBucketLevelAccess`, UBLA resolves to `None`, prints `None`,
   and the script exits 1. That fails **closed**, so it is not dangerous — but it is the same
   cry-wolf failure that Checkpoint 4 already paid for once, and the stated reason that
   matters ("a check that cries wolf stops being run") applies unchanged. One `or` fixes it.
3. **Run the reverse leg (R1–R4) before Checkpoint 4 is recorded passed**, and record the
   R1/R2 pair explicitly. Issue #50 currently asks for read and write; it does not ask for the
   existence-oracle distinction, which is the part most likely to be quietly wrong.
4. **Decide what to do about the default compute service account** (Risks 1). It is not used
   by the one Cloud Run service — `hub-gate` runs as `hub-gate@` — so removing `roles/editor`
   from it is likely to be free, and it is the single widest grant in the project.
5. **Do not record R5/R6 (`kgis`) as a passed boundary test** until `agentic-kgis` exists.

## Alternatives considered

- **Testing the prefix conditions with `gcloud storage` instead of the JSON API.** Rejected on
  measurement, not preference: `gcloud storage cp` needs `storage.objects.list` even for one
  file into the satellite's own prefix, so it fails on the allowed path and manufactures a
  false negative. This is ADR-0007 decision 6 as strengthened at Checkpoint 3.
- **Using `gcloud ... --format="value(...)"` projections for item 2.** Rejected — that is the
  exact construction that produced the Checkpoint 4 false failure by shifting two
  tab-separated values by one. I parsed JSON and tolerated both shapes.
- **Reading the project policy only via `gcloud projects get-iam-policy`.** Insufficient on its
  own: it returned `"version": 1`, and a version-1 read can omit conditional bindings. Since
  item 6 is an enumeration claim, I re-read it at `requestedPolicyVersion: 3` to establish that
  the absence of `roles/viewer` is a real absence and not a truncation.
- **Requesting a temporary `serviceAccountTokenCreator` grant to finish the job myself.**
  Refused by contract and by constraint. The grant is a cloud mutation; a sub-agent makes none.

## Risks

1. **`projectEditor` is non-empty and holds `legacyObjectOwner` on the private bucket.**
   `roles/editor` → `410552878319-compute@developer.gserviceaccount.com` (the default compute
   service account), which through the automatic legacy bindings can **read, overwrite and
   delete every object in both buckets**, including the private one. Every prior record frames
   this exposure as a `projectViewer` *read* risk and notes "today only the owner"; the live
   policy says `projectViewer` is empty and the real exposure is an editor **write** exposure.
   It is not currently the runtime identity of anything — the only Cloud Run service uses
   `hub-gate@` — but it is the default identity for Cloud Build, Cloud Functions, and any Cloud
   Run service created without an explicit service account, so the exposure activates silently
   the first time someone deploys without naming an identity.
2. **The prefix conditions are verified to exist, not verified to bite.** F7 is the only probe
   that distinguishes a correct condition from one that has lost its trailing slash, and it
   cannot run without impersonation. Until F7 runs, "the satellite cannot escape its prefix" is
   supported by the `cv` leg from Checkpoint 3 and by static inspection of the `phd-milestones`
   condition — not by measurement of the second satellite.
3. **`hub-gate` still holds project-level `roles/firebaseauth.admin`** (A12, issue #49),
   independently confirmed live here. Out of my scope to fix; recorded because it survived
   Checkpoint 4 and this is an independent sighting rather than a relay.
4. **The private bucket's two principals are a floor, not a ceiling, in the other direction.**
   `privateSyncWriter` holds `storage.objects.list` on a bucket whose object names are
   themselves private material. That is deliberate and necessary for destructive sync
   (ADR-0010 decision 5), and it is single-tenant — but it means the hub's deploy identity can
   enumerate the private area, and that identity authenticates from GitHub Actions on
   `refs/heads/main`.

## Open questions

1. **The satellite roster disagrees between my instructions and the project.** I was asked to
   verify four satellites (`cv`, `construction-ai-proposal`, `phd-milestones`, `agentic-kgis`)
   and to probe `sources/kgis/`. Live and in Terraform there are **two**. `agentic-kgis`
   (publishing as source `kgis`) and `construction-ai-proposal` are Phase 5 roadmap items —
   owner decision D4, `llm/master-roadmap.md:400`. Is the four-satellite framing a forward-
   looking description of the proofs' eventual scope, or does someone believe two more exist?
   It changes whether R5/R6 are "deferred" or "failing".
2. Should the F1–F7 / L1–L3 set be run for **both** satellites, or only `phd-milestones`?
   Issue #50 is scoped to `phd-milestones` (its leg was never run) plus the reverse. Re-running
   the full `cv` set costs little and re-establishes the positive control on today's policy, so
   I specified both — but the Lead Architect may prefer to scope the transcript.
3. Does removing `roles/editor` from the default compute service account break any build path
   not visible from the Cloud Run service list (Cloud Build triggers, for instance)? I did not
   probe build history.

## Related docs

- `llm/sprints/2026-09-hub/contracts/boundary-tester-wave-0.md` — this contract
- `llm/governance/adr/0007-hub-polls-content-bucket-no-satellite-github-credential.md` —
  decision 4 (the three permissions and why `list` is excluded), decision 5 (separate WIF
  pool, and why Terraform cannot enforce the invariant a separate pool makes structural),
  decision 6 as strengthened 2026-09-16 (the `gcloud storage` measurement)
- `llm/governance/adr/0010-withdrawal-semantics.md` — decision 5, which is why the private
  bucket has two principals rather than one
- `llm/sprints/2026-09-hub/STATE.md` — §Checkpoint 3 execution record (the nine proofs, the
  runbook defect); §Wave 0 — Checkpoint 4 is NOT passed (the UBLA parsing defect, A13)
- `infra/scripts/check_private_bucket_config.py` — the credential-free half; the authority for
  item 1
- `infra/scripts/check-private-bucket-iam.sh` — the live half; see Recommendations 2
- `infra/README.md` §"Checkpoint 3 — verifying the boundary" and §"Proving the satellite
  boundary still holds, in both directions"
- `llm/sprints/2026-09-hub/handoffs/infra-phase-3.md` §Checkpoint 4 test 2 — the prior
  specification, which this one extends with the reverse READ probes and the R1/R2 pair
- Issue #50 — A13 half FALSE; the standing action this specification exists to make runnable

## ADR candidates

1. **The project's basic-role posture, and the legacy bucket bindings.** Not the read risk the
   existing notes describe but the write risk found here: `projectEditor` → `legacyObjectOwner`
   on the private bucket. The decision to record is whether `roles/editor` on the default
   compute service account is removed, whether the legacy bindings are stripped from both
   buckets, or whether the exposure is accepted with a named reason. Today it is accepted by
   nobody in particular, which is the worst of the three.
2. **Where the branch pin lives, stated as a decision rather than an implementation detail.**
   Pinning the ref on the service-account binding (via `attribute.repository_id_ref`) rather
   than on the provider's `attributeCondition` is a real choice with a real advantage — the
   principalSet is keyed on the immutable numeric repository id, so a repository rename cannot
   slip the binding — and it is currently discoverable only by reading two resources and
   noticing the ref is absent from one of them.
3. **A read-only auditor identity for the live bucket IAM check.** `check-private-bucket-iam.sh`
   already names this as option (b) in its closing note and the phase chose option (c). With the
   private bucket now holding real private material and the live check running nowhere, the
   choice deserves a recorded decision rather than a comment at the bottom of a script.
