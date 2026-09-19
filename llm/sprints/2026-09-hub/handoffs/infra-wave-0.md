# Handoff — `infra`, Wave 0

Stream: `infra` · Wave 0 · Issue #44 (hub-007) · 2026-09-18
Contract: `llm/sprints/2026-09-hub/contracts/infra-wave-0.md`

---

## Summary

Seven items. **Five implemented, one blocked on an absent input, one deliberately
not implemented with the evidence for that decision recorded below.** Plus one
item the Lead Architect added mid-flight (the private-sync kill switch), which is
implemented.

| # | Item | Outcome |
|---|---|---|
| 1 | satellite-role-guard CI check | **Done** — in `budget-guard`, shown failing 4 ways and passing |
| 2 | Executable-bit guard | **Done** — reach-based, shown failing 3 ways and passing |
| 3 | Dedicated private-sync identity | **WAITING** — the `site` seam does not exist yet; nothing implemented, by design |
| 4 | Narrow `roles/firebaseauth.admin` (N-1) | **Done** — custom role, permissions verified against this project |
| 5 | `projectViewer`'s legacy read | **Decided and recorded** — plus a new live guard; the removal itself is an owner decision |
| 6 | Second alert channel not dependent on email | **Done** — `sms`, off by default |
| 7 | dev-staging | **ADR written; NOT implemented.** The budget holds easily; a *different* blocker stops it |
| + | `PRIVATE_SYNC_PLAN_ONLY` kill switch | **Done** (Lead Architect request, mid-flight) |

**Files changed** — all within the contract's file set:

```
.github/workflows/build.yml          items 1, 2, and the kill switch
infra/gate-auth-role.tf              NEW — item 4
infra/gate.tf                        item 4
infra/monitoring.tf                  item 6
infra/variables.tf                   item 6
infra/outputs.tf                     items 4
infra/scripts/check_private_bucket_config.py   item 4 (CI guard for the new role)
infra/scripts/check-private-bucket-iam.sh      item 5 (live projectViewer guard)
infra/README.md                      items 4, 5, 6, and the kill switch
```

Nothing under `site/**`, `gate/**`, `contract/**`, `firebase.json`,
`.github/workflows/gate.yml`, `llm/**` (except this handoff) or `docs/**` was
touched. **No git mutation, no `gh` mutation, no cloud mutation, no `terraform
plan` or `apply`.** Proof in §Validation.

> **Not mine:** `git status` shows `llm/sprints/2026-09-hub/STATE.md` modified.
> I did not write it — the Lead Architect was editing it concurrently. Flagged so
> it is not mistaken for stream output.

### The three things most worth your attention

1. **My first test of the most important assertion was wrong, and it silently
   passed.** Breaking UBLA on the content bucket did *not* turn the guard red,
   because my `sed` hit the first textual occurrence — which is inside a comment
   — while the real resource line at `storage.tf:87` stayed `true`. The guard was
   correct; the test proved nothing. I only caught it because I expected red and
   got green. Re-run against the real non-comment line, it fires on both buckets.
   This is the fourth instance this sprint of a check reporting success while
   demonstrating nothing, and the first where the *test*, not the guard, was the
   vacuous half.
2. **Item 5's residual is currently empty, which the contract did not anticipate.**
   The contract says to record the residual "naming the owner as the only project
   Viewer." Live IAM says otherwise: `cusati-hub` has **no `roles/viewer` binding
   at all**. The owner holds `roles/owner`, which maps to `projectOwner`, not
   `projectViewer`. So the legacy reader bindings today grant *nobody* anything.
   The exposure is latent and activates silently on the first Viewer grant — so I
   made that moment loud instead of removing a binding that currently does
   nothing.
3. **Item 7 is not blocked by budget — it is blocked by a Hosting IAM fact.** The
   budget holds with ~99% headroom. But Firebase Hosting has no per-site IAM, so
   a `dev`-branch deploy identity could also deploy **production** Hosting. The
   contract's default design cannot be implemented safely in one project. Details
   and the ADR are in item 7.

---

## Item 1 — satellite-role-guard

**It was already half-built.** `budget-guard` already asserted UBLA on the
content bucket, the satellite role's three permissions, and (via
`check_private_bucket_config.py`) the private bucket's two-principal invariant. I
checked before writing, rather than adding a second guard beside the first.

**The real gaps, all of which let the boundary widen while the guard stayed
green:**

| Gap | Why it matters |
|---|---|
| Only `satellite-role.tf`'s permission list was checked | Swapping the binding to a **predefined** role (`roles/storage.objectViewer`) re-grants `storage.objects.list` while the permission list still reads correctly. ADR-0007 decision 4 is explicit: "NOT IN THIS ROLE, NOT IN ANY OTHER ROLE GRANTED TO A SATELLITE, CONDITIONED OR NOT" |
| The prefix `condition {}` was not asserted | An **unconditioned** binding of the correct role still covers the whole content bucket |
| No assertion that satellites hold no project-level role | `infra/README.md` says "Expect NO rows"; nothing enforced it |
| UBLA on the **private** bucket was asserted only in the other script | The contract asks this guard to cover both buckets; it now does, and the two checks are independent |

Placed in `budget-guard`, not a new job — S-5's precedent. `budget-guard` is
already a required context on `main`, so every assertion binds the moment it
lands. A new job would sit unenforced until branch protection changed, looking
like a gate while gating nothing.

---

## Item 2 — executable-bit guard

**Mode source: the INDEX.** `git ls-files -s` for modes, `git cat-file -p :<path>`
for contents, and git invoked as `git -c core.fileMode=false …` so the DrvFs
mount cannot perturb the guard's own process. Nothing stats the working tree.
`/mnt/c` reports every file `0777`, so a working-tree read would call a file
committed `100644` executable — precisely the Phase 2 defect the guard exists to
catch. A guard that fell into it would be a bad joke.

**Classification is by how a file is reached.** The contract said five `.mjs`
files carry a shebang at `100644`; the true count is **eight**, and all eight are
the same class — every one reached via `node …` or an ES `import`, never executed.
Scanning module source is what produces the false positives, so the guard scans
only surfaces that *execute* things: workflow `run:` blocks, `*.sh`, `package.json`
`scripts`, composite `action.yml`, `Dockerfile`. Comments are stripped first —
without that, prose like `# -> scripts/fetch-data.sh` reads as a call site (my
first prototype did exactly this and produced five false hits).

**Three rules, so it has signal in both directions:**

- **A** — a tracked `*.sh` with a shebang must be `100755`.
- **B** — any tracked file **invoked directly** anywhere must be `100755`.
- **C** — a tracked shebang file that is neither `*.sh` nor directly invoked must
  **not** be `100755`. Without C, everything drifts to 755 to silence B and the
  classification stops meaning anything.

**Rule B is not vacuous today**: it finds three genuine direct invocations
(`./scripts/fetch-data.sh`, `./scripts/sync-content.sh`, `./scripts/sync-local-data.sh`
in `site/package.json`, plus a bare `site/scripts/sync-content.sh` in `build.yml`).
All three are correctly `100755`. Zero violations in the repo today, as expected.

---

## Item 3 — dedicated private-sync identity: **WAITING, nothing implemented**

`llm/sprints/2026-09-hub/handoffs/site-wave-0.md` **does not exist**. The contract
is explicit: implement the seam if it exists when I start; if not, do 1, 2, 4–7
and report 3 as waiting. I did not guess at it.

That restraint is the point. Phase 3 cost a defect exactly here — infra rendered
`PRIVATE_BUCKET` while the gate read `GATE_PRIVATE_BUCKET`, and nothing pinned
it. Inventing names now and reconciling later reproduces that failure.

**What I need from the seam to implement it in one pass:**

1. The **exact** identifier for every cross-stream name — the new service
   account, the GitHub Actions variable holding its email, and the env var each
   `build.yml` step reads. Literal strings, not prose.
2. Which step authenticates as which identity, in order. Today `private-sync`
   authenticates once as `vars.GCP_DEPLOY_SA` and runs both plan and apply.
3. Whether the dev bucket (item 7), if it ever exists, uses the same split.

**What I will implement when it lands** (so the seam can be written against it):

- a `hub-private-sync` service account, no keys, WIF-bound to `refs/heads/main`;
- `google_storage_bucket_iam_member.hub_deploy_private_sync` **removed**, replaced
  by the same `privateSyncWriter` role bound to the new identity;
- `check_private_bucket_config.py`'s `EXPECTED_PRIVATE_BUCKET_BINDINGS` updated in
  the same commit — it asserts binding **resource names**, so it fails loudly if
  the two halves disagree, which is the cross-stream contract made testable;
- a second auth step in `private-sync` in `build.yml`.

**Proving half (b) — the half easy to leave unproven.** After apply, the public
deploy identity must be *unable* to touch the private bucket. The refusal, not
the success, is the evidence:

```bash
# Impersonate the PUBLIC deploy identity and attempt the private bucket.
# EVERY ONE of these must fail with 403.
TOKEN=$(gcloud auth print-access-token \
  --impersonate-service-account=hub-deploy@cusati-hub.iam.gserviceaccount.com)

# (b1) cannot LIST the private bucket
curl -s -o /dev/null -w 'list: %{http_code}\n' -H "Authorization: Bearer $TOKEN" \
  "https://storage.googleapis.com/storage/v1/b/cusati-hub-private/o?maxResults=1"

# (b2) cannot READ a known object
curl -s -o /dev/null -w 'get: %{http_code}\n' -H "Authorization: Bearer $TOKEN" \
  "https://storage.googleapis.com/storage/v1/b/cusati-hub-private/o/index.html?alt=media"

# (b3) cannot WRITE
curl -s -o /dev/null -w 'write: %{http_code}\n' -X POST -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: text/plain' --data 'x' \
  "https://storage.googleapis.com/upload/storage/v1/b/cusati-hub-private/o?uploadType=media&name=_probe.txt"
```

Expect `403` on all three. A `200` on (b1) or (b2) means the grant was not
removed and the change achieved nothing. **A 403 on (b3) alone proves nothing** —
that is the trap: a read-only leftover still defeats the purpose.

Half (a), that the sync still works, is the next successful `private-sync` run —
best exercised with `PRIVATE_SYNC_PLAN_ONLY=true` first, which now exists.

---

## Item 4 — narrowing `roles/firebaseauth.admin` (N-1)

`hub-gate` now holds `google_project_iam_custom_role.gate_session_minter`
(`infra/gate-auth-role.tf`): **exactly two permissions.**

| Permission | Call site |
|---|---|
| `firebaseauth.users.createSession` | `fb_auth.create_session_cookie(...)` — `gate/app/auth.py`, the mint half of `POST /session` |
| `firebaseauth.users.get` | both verify paths run `check_revoked=True` (`GATE_CHECK_REVOKED` defaults `True`, `gate/app/config.py`), which fetches the user record to compare `tokensValidAfterTime` |

### The correction that matters

`gate.tf`'s own comment claimed verification "need[s] NO IAM at all: both are
signature checks against Google's public certificates, done offline", and
concluded the grant existed **solely for the mint step**. That is wrong in a way
that would have produced a role too narrow to work: a custom role holding only
`createSession` — exactly what that comment proposed as the tightening — would
mint cookies successfully and then **fail on every subsequent request that
verified one**. The signature check is offline; the revocation check is not. I
found this by reading the call sites rather than the comment. The comment is
corrected in place.

### Primary source — what I actually checked

Not copied from documentation. Against **this project**:

```
$ gcloud iam list-testable-permissions \
    //cloudresourcemanager.googleapis.com/projects/cusati-hub \
    --filter="name:firebaseauth.users" --format=json
[ {"name":"firebaseauth.users.create","stage":"GA"},
  {"name":"firebaseauth.users.createSession","stage":"GA"},
  {"name":"firebaseauth.users.delete","stage":"GA"},
  {"name":"firebaseauth.users.get","stage":"GA"},
  {"name":"firebaseauth.users.sendEmail","stage":"GA"},
  {"name":"firebaseauth.users.update","stage":"GA"} ]
```

Custom-role eligibility was verified the same way rather than assumed from the
field's absence. Across all **13,673** testable permissions on this project the
API emits `customRolesSupportLevel` for **470** (70 `NOT_SUPPORTED`, 400
`TESTING`) and omits it for 13,203 — which is how it reports `SUPPORTED`. It is
omitted for both permissions above, so both are custom-role eligible. Checking
that the field *is* emitted somewhere is what makes its absence meaningful; the
Checkpoint 3 runbook was wrong in exactly this shape.

### Post-apply verification — **the Lead Architect runs this**

```bash
# 1. The role holds exactly two permissions.
gcloud iam roles describe gateSessionMinter --project cusati-hub \
  --format='value(includedPermissions)'
# EXPECT: firebaseauth.users.createSession;firebaseauth.users.get

# 2. The predefined role is GONE from the gate.
gcloud projects get-iam-policy cusati-hub \
  --flatten='bindings[].members' \
  --filter='bindings.members:hub-gate@cusati-hub.iam.gserviceaccount.com' \
  --format='value(bindings.role)'
# EXPECT exactly: roles/datastore.viewer
#                 projects/cusati-hub/roles/gateSessionMinter
# EXPECT NOT: roles/firebaseauth.admin
```

**3. SIGN-IN MUST STILL WORK, and neither command above proves it.** This is
live, and it is the only evidence that counts:

```
a. Open https://jason.cusati.us/signin/ and request a link as djjay@vt.edu
   (email-link is the working route; the Google button is still unconfigured).
b. Follow the link. The browser POSTs the ID token to /session.
c. EXPECT: HTTP 200 and Set-Cookie: __session=...
d. EXPECT: https://jason.cusati.us/p/ now returns 200, not the uniform 404.
e. Confirm from the gate's own logs, not from the status code:
   gcloud logging read \
     'resource.type="cloud_run_revision"
      AND resource.labels.service_name="hub-gate"' \
     --project cusati-hub --freshness=15m --limit=50
   EXPECT a session mint with no error, and NO line containing
   PERMISSION_DENIED or "Permission 'firebaseauth.users.get' denied".
f. Reload /p/ once more. Step (e) covers the MINT; this covers the VERIFY,
   which is the path that needs users.get. A mint that works and a reload
   that 404s is the exact signature of a role missing users.get.
```

Step (f) is not optional. Mint and verify need different permissions, and
testing only the mint is how a half-narrowed role ships looking healthy.

### Rollback — if sign-in breaks, this restores it in one command

```bash
gcloud projects add-iam-policy-binding cusati-hub \
  --member='serviceAccount:hub-gate@cusati-hub.iam.gserviceaccount.com' \
  --role='roles/firebaseauth.admin'
```

Effective immediately; no redeploy, no restart. Then revert `infra/gate.tf` and
`infra/gate-auth-role.tf` so Terraform does not undo it on the next apply.

**Do NOT delete the custom role as part of a rollback.** `deletion_policy =
"PREVENT"` is set for a reason: a destroyed custom role locks its ID for 7–37
days, so a panicked `terraform destroy` of it would make the *fix* unappliable
for over a month. Leaving an unused role in place costs nothing.

### The residual risk I cannot close without applying

`firebase_admin` may fetch the project/tenant config on first auth use, which
would need `firebaseauth.configs.get`. I found no such call in the gate's own
code, and the SDK's documented session-cookie path does not require it — but the
SDK is a dependency and I cannot exercise it against live Identity Platform from
here. **If step (c) fails with a `configs.get` permission error, add exactly that
one permission** to `gate-auth-role.tf` rather than rolling back to
`firebaseauth.admin`; that is a one-permission widening, not a return to the
whole Authentication surface.

---

## Item 5 — `projectViewer`'s legacy read on the private bucket

### Which world we are in, established from primary source

**Fact 1 — UBLA does not remove the legacy bindings.** Both are read live:

```
$ gcloud storage buckets describe gs://cusati-hub-private --format=json
  uniform_bucket_level_access: True
  public_access_prevention:    enforced

$ gcloud storage buckets get-iam-policy gs://cusati-hub-private --format=json
  projects/cusati-hub/roles/privateObjectReader -> hub-gate@…
  projects/cusati-hub/roles/privateSyncWriter   -> hub-deploy@…
  roles/storage.legacyBucketOwner   -> projectEditor:cusati-hub, projectOwner:cusati-hub
  roles/storage.legacyBucketReader  -> projectViewer:cusati-hub
  roles/storage.legacyObjectOwner   -> projectEditor:cusati-hub, projectOwner:cusati-hub
  roles/storage.legacyObjectReader  -> projectViewer:cusati-hub
```

UBLA is **enforced** and all four legacy bindings are **still present**. UBLA
disables object *ACLs*; these are ordinary IAM bindings. So the contract's
condition — "disable legacy bucket bindings **if** UBLA permits it" — is **not
satisfied**: UBLA does not provide that lever. Recording the residual honestly is
therefore the contract's own fallback, and this is it.

**Fact 2 — and this is the part the contract did not anticipate — the residual is
currently EMPTY.**

```
$ gcloud projects get-iam-policy cusati-hub   # roles/viewer rows:
(none)
```

`cusati-hub` has **no `roles/viewer` binding at all**. The owner holds
`roles/owner`, which expands to `projectOwner`, **not** `projectViewer`. So
`legacyBucketReader`/`legacyObjectReader` today grant **nobody** anything. The
contract's expected finding — "naming the owner as the only project Viewer" — is
not what the project actually says.

### The decision

The exposure is **latent, not live**, and it activates silently the first time
anyone is granted project Viewer — a natural, innocuous-looking grant ("let them
look at the project") that would hand them every private object.

So rather than remove a binding that currently does nothing, I made its
activation **loud**. `infra/scripts/check-private-bucket-iam.sh` now **fails** if
any principal holds `roles/viewer`, naming them and explaining the consequence.
It passes today (empty set) and goes red at exactly the moment a human should be
deciding whether that person may read the dossier.

### Why I did not remove the bindings, and what it would take

Removing them requires replacing the bucket's whole IAM policy authoritatively
(`google_storage_bucket_iam_policy`), because `google_storage_bucket_iam_member`
is additive and **structurally cannot remove** a binding. That carries a real
lockout hazard: an authoritative policy must re-declare everything it keeps, and
dropping the `legacyBucketOwner`/`legacyObjectOwner` pair would remove the
**owner's own** object access to the bucket — `roles/owner` does not include
`storage.objects.*`; the owner reaches the bucket *through those very bindings*.
That would break `gcloud storage ls`, the `PROBE_OBJECT` check and any manual
recovery, on the one bucket where manual recovery matters most.

**ADR-class, owner's call.** Recommended decision: **keep the bindings, keep the
new guard**, and revisit only if anyone is ever granted project Viewer. If the
owner wants them gone, the safe form declares an authoritative policy that keeps
`legacyBucketOwner`/`legacyObjectOwner` and drops only the two reader bindings —
and it must be applied with the owner watching the plan, because an authoritative
policy resource silently removes anything it does not list.

---

## Item 6 — a second alert channel not dependent on email

**Implemented: an `sms` channel, off by default** (`var.ops_sms_number`, empty
unless set), attached to all three alert policies alongside email via
`local.alert_notification_channels`.

### Why SMS, from the API rather than from memory

Channel types actually available in this project, read from
`GET …/notificationChannelDescriptors`:

| Type | Stage | Viable at zero cost? |
|---|---|---|
| `email` | GA | already in use — **and under suspicion** |
| `sms` | GA | **yes** — no third party, no receiver, no account |
| `pubsub` | GA | free-ish, but delivers to a *topic*; a topic is not a person |
| `webhook_tokenauth` / `webhook_basicauth` | GA | free in Monitoring, **not free of a receiver** — none exists here |
| `slack` | GA | needs a workspace + token this project does not have |
| `google_chat` | BETA | needs a Chat space; BETA |
| `pagerduty` | BETA | paid service |
| `campfire`, `hipchat` | DEPRECATED | Google says delete these |

The contract's warning is the deciding test: "a webhook channel is free in Cloud
Monitoring but not free of a *receiver*." No receiver exists at zero cost that
the owner already operates, so webhook and pubsub both fail it. SMS is the only
type that needs nothing but a phone number.

**Cost: $0.00.** Cloud Monitoring bills metrics ingestion, API calls, uptime
checks and alerting-policy metric references — not notification delivery.

**Google's caveat, recorded rather than glossed:** SMS "isn't a fully reliable
notification channel type, and it might not be available in certain regions," and
Google recommends pairing it with another type. It is therefore a **second**
channel beside email, never a replacement — which is also exactly what the
contract asked for.

**Why it is off by default.** A channel pointing at no number looks like
redundancy and delivers nothing — the same failure mode as the unverified email
channel. Empty means no channel is created at all.

### The email channel is still unverified — owner hard stop

```
$ curl -s -H "Authorization: Bearer $(gcloud auth print-access-token)" \
    https://monitoring.googleapis.com/v3/projects/cusati-hub/notificationChannels
{ "type":"email", "displayName":"Hub ops email",
  "labels":{"email_address":"djjay@vt.edu"},
  "enabled":true,
  "creationRecord":{"mutateTime":"2026-09-18T15:27:37.365891095Z"} }
```

**No `verificationStatus` field at all** — unverified. All three policies accept
events and deliver nothing. The exact step, which is console work:

> Open <https://console.cloud.google.com/monitoring/alerting/notifications>,
> find **Hub ops email**, use **Send verification email** if the original has
> expired, and click the link in the mail. Then set `TF_VAR_ops_sms_number` to
> the owner's mobile in E.164 form, apply, and verify that channel with the code
> Google sends **by SMS** — a path that shares nothing with email.

`gcloud beta`/`alpha` are **not installed** in this environment, so the REST call
above is the form that works; the README now records both.

---

## Item 7 — dev-staging: ADR written, **not implemented**, and why

### The budget holds. That is not what stopped it.

All figures are per-project free tiers, at **zero traffic**.

| Line | Allowance (primary source) | dev usage | Cost |
|---|---|---|---|
| Firebase Hosting, 2nd site `hub-dev` | 10 GB storage, 360 MB/day transfer; "multiple sites per project" at **no additional cost**, sharing the allowance (`firebase.google.com/pricing`) | a few MB of fixture output, ~0 transfer | **$0.00** |
| Cloud Run `hub-gate-dev`, `min_instance_count = 0` | 2M requests, 360,000 GB-s, 180,000 vCPU-s/month (Free Program) | scales to zero; **nothing runs at rest** | **$0.00** |
| Cloud Storage `cusati-hub-private-dev` | 5 GB-months regional US; us-east1 qualifies | a few MB of fixtures | **$0.00** |
| Firestore | 1 GiB, 50K reads/day | same database, own collection prefix via `GATE_MEMBERS_COLLECTION` | **$0.00** |
| Identity Platform | 50,000 MAU no-cost tier | 1–2 test users | **$0.00** |
| Cloud Logging | 50 GiB/project/month | negligible | **$0.00** |
| Cloud Monitoring | — | **no dev uptime checks recommended**: dev being down is not an incident, and a paging dev alert trains the owner to ignore alerts | **$0.00** |
| **Artifact Registry** | 0.5 GB/month free | **the only sensitivity line.** `hub-gate` is **182.37 MB** today (measured). A dev image shares base layers; worst case a separate 5-version retention adds ~180 MB → **~362 MB**, still under the 512 MB free tier | **$0.00** |

**Total incremental: $0.00/month.** Worst realistic overage, if Artifact Registry
ever crosses 0.5 GB, is $0.10/GB/month → about **$0.05/month** at 1 GB total.
Project spend stays ≈ $0.00–0.05 against the $5 budget (§12.6) — roughly **99%
headroom**. The budget is not the constraint and the $5 alert is untouched.

### The blocker: Firebase Hosting has no per-site IAM

Established from primary source — the provider's own schema, not documentation:

```
$ terraform providers schema -json | jq '…resource_schemas | keys'
google_firebase_hosting_channel        google_firebase_hosting_release
google_firebase_hosting_custom_domain  google_firebase_hosting_site
google_firebase_hosting_version        (+ 5 App Hosting resources)

resources matching *hosting* AND *iam*:  NONE
```

There is **no Hosting IAM resource of any kind**, and `roles/firebasehosting.admin`
is granted project-wide (`deploy.tf`). Therefore:

> Any identity that can deploy the `hub-dev` Hosting site can also deploy the
> **production** Hosting site.

The contract's default says dev is "deployed from a `dev` branch." A `dev` branch
is by construction less reviewed than `main`. Giving a `dev`-branch WIF binding an
identity holding `firebasehosting.admin` means **a commit to `dev` can overwrite
production** — a privilege escalation from the least-reviewed branch in the repo,
introduced by the very thing meant to make review safer. That is strictly worse
than the problem dev-staging solves.

I did not implement it, because implementing the default design would have
shipped that escalation, and implementing a silently different design would have
been deciding an ADR-class question by writing Terraform.

### The ADR, ready to file

I cannot create it: `llm/**` is Lead Architect only, and my file contract forbids
it. The handoff path is the one authorized exception. **Text ready to land as
`llm/governance/adr/0012-dev-staging-in-a-separate-project.md`:**

> **Context.** The private area cannot be reviewed before it ships: the gate needs
> Cloud Run, Identity Platform and a real session, and the owner works over SSH
> with no local browser. Phase 4 adds shares, multiplying states visible only
> live.
>
> **Decision.** Dev-staging lives in a **separate GCP project**, not as a second
> Hosting target in `cusati-hub`.
>
> **Why not the same project** — the option the brief defaulted to. Firebase
> Hosting exposes no per-site IAM (verified: zero `*hosting*iam*` resources in
> provider 8.2.0) and `roles/firebasehosting.admin` is project-wide. A dev deploy
> identity in `cusati-hub` can deploy production Hosting. The three ways out are
> all bad: (a) deploy dev from `main` only, which discards the pre-merge review
> that is the entire point; (b) accept dev-branch credentials that can write
> production; (c) a separate project. Only (c) gives a real boundary — separate
> IAM, separate WIF, separate buckets, separate Firestore, and a blast radius that
> stops at the project edge.
>
> **Cost.** Free tiers are **per project**, so a second project gets its own and
> the incremental cost at zero traffic is **$0.00** (table above). It needs its
> **own** `$5` budget alert; §12.6 binds per project.
>
> **Invariants dev inherits unchanged.** The private-dev bucket keeps the same
> two-principal invariant, UBLA `true`, `public_access_prevention = "enforced"`,
> and `check_private_bucket_config.py` extended to assert it. **Fixture content
> only — never real private material.** A dev environment mirroring production
> data is a second copy of the dossier with weaker controls. Its own members
> collection needs no gate change: `GATE_MEMBERS_COLLECTION` and
> `GATE_PRIVATE_PREFIX` already exist (`gate/app/config.py`).
>
> **Consequences.** More Terraform and a second project to bootstrap; the owner
> must link billing once more. Against that: a `dev` branch that cannot touch
> production, which the same-project design cannot offer at any price.

**Not implemented pending that decision** — it is the owner's recorded question
(STATE §Follow-ups: "whether dev is a separate GCP project or a second Hosting
target in the same project"), and this stream now supplies the evidence that
answers it rather than pre-empting it.

---

## Kill switch — `PRIVATE_SYNC_PLAN_ONLY` (Lead Architect request, mid-flight)

`private-sync`'s plan and apply were consecutive steps with nothing between them,
so the delete list was only readable **after** the deletion. That made the Chief
Reviewer's Part C impossible as written. Added to the apply step:

```yaml
if: vars.PRIVATE_SYNC_PLAN_ONLY != 'true'
```

**Default is apply-enabled, as required.** Unset → `'' != 'true'` → **true** → the
sync runs exactly as before. Failing closed here would silently stop the private
area updating and keep serving withdrawn content — worse than the failure it
prevents. A companion step emits a `::notice::` when plan-only is active, so a
skipped sync announces itself instead of looking like a no-op.

**Non-vacuous proof — honestly, this one cannot be done locally.** GitHub
evaluates `vars.*` server-side; there is no local runner here and `act` is not
available. `actionlint` validates the expression (rc=0), which is syntax, not
behaviour. **The exact commands for you to run after merge:**

```bash
GH="/mnt/c/Program Files/GitHub CLI/gh.exe"

# --- RED-equivalent: the destructive step must SKIP ---
"$GH" variable set PRIVATE_SYNC_PLAN_ONLY --body true --repo djjay0131/website
"$GH" workflow run build.yml --repo djjay0131/website
# then, on the finished run:
"$GH" run view <run-id> --repo djjay0131/website --json jobs \
  --jq '.jobs[]|select(.name=="private-sync").steps[]|"\(.conclusion)\t\(.name)"'
# EXPECT: success  Plan the private sync (dry run)
#         skipped  Sync the private output, pruning what this build did not produce
#         success  Report that this was a plan-only run
# AND: the dry-run step's log ENUMERATES the objects it would delete.

# --- GREEN: unset, the step must RUN ---
"$GH" variable delete PRIVATE_SYNC_PLAN_ONLY --repo djjay0131/website
"$GH" workflow run build.yml --repo djjay0131/website
# EXPECT: success  Sync the private output, …   (NOT skipped)
#         skipped  Report that this was a plan-only run
```

For the withdrawal proof: the dry run must **name** exactly the two objects, not
count them. A right-count/wrong-names result is one of the failure signatures
that looks like success.

---

## Validation

All commands run from `/mnt/c/code/website`. `terraform` is not on PATH (Risk 3),
so it runs through `hashicorp/terraform:1.14.0` — the container Checkpoints 2–4
used. `actionlint` likewise via `rhysd/actionlint`.

```
########## terraform fmt -check -recursive
rc=0
########## terraform validate
Success! The configuration is valid.
########## actionlint (build.yml, ci.yml)
rc=0
########## check_private_bucket_config.py
OK: private bucket declares uniform bucket-level access and enforced public access
prevention, names no anonymous principal, and carries exactly two bindings -- the
gate (storage.objects.get) and the hub's sync (create/delete/get/list).
rc=0
########## bash -n infra/scripts/check-private-bucket-iam.sh
syntax OK
########## executable-bit guard, against the project
OK: 13 shebang file(s) checked. Every *.sh and every directly invoked file is
committed 100755; every interpreted module is committed 100644.
rc=0
########## satellite guard, against the project
OK: uniform bucket-level access is declared on BOTH buckets; satellite_publisher
holds exactly ['storage.objects.create', 'storage.objects.delete',
'storage.objects.get'] and never storage.objects.list; all 1 satellite binding(s)
use that custom role with a startsWith prefix condition; and no satellite holds a
project-level role.
rc=0
```

**No mutations.** The index is untouched — which matters, because the exec-bit
demonstrations needed mode changes and I ran them in a throwaway repo rather than
here:

```
$ git -c core.fileMode=false diff --cached --name-only
(empty)
$ git -c core.fileMode=false diff --cached --summary
(empty)
$ git -c core.fileMode=false status --porcelain
 M .github/workflows/build.yml
 M infra/gate.tf
 M infra/monitoring.tf
 M infra/outputs.tf
 M infra/scripts/check-private-bucket-iam.sh
 M infra/scripts/check_private_bucket_config.py
 M infra/variables.tf
 M llm/sprints/2026-09-hub/STATE.md      <-- NOT MINE (Lead Architect, concurrent)
?? infra/gate-auth-role.tf
```

### Guard transcripts — failing deliberately, then passing

Both guards were extracted **from `build.yml` itself** and executed, so these are
the bytes CI runs, not a paraphrase.

#### Executable-bit guard

Run in a throwaway git repo in the scratchpad, so the project's index was never
mutated. Fixture: `broken.sh` (shebang, staged 100644), `tool.mjs` (shebang,
staged 100644, invoked as `./scripts/tool.mjs` from `package.json`), `module.mjs`
(shebang, staged 100755, invoked only as `node scripts/module.mjs`), `good.sh`
(shebang, 100755).

**RED — all three rules fire at once:**

```
mode    kind       reached        path
100644  shell      interpreted    scripts/broken.sh
100755  shell      interpreted    scripts/good.sh
100755  shebang    interpreted    scripts/module.mjs
100644  shebang    executed       scripts/tool.mjs
                                 <- package.json: ./scripts/tool.mjs
::error file=scripts/broken.sh::… is a *.sh beginning with a shebang but is committed 100644.
::error file=scripts/module.mjs::… is committed 100755 but nothing invokes it directly -- it is
    reached through an interpreter or an import. An executable bit here is a false signal.
::error file=scripts/tool.mjs::… is invoked directly (package.json) but is committed 100644.
    Running it fails on Linux with exit 126.

3 executable-bit violation(s).
rc=1
```

**GREEN — after correcting exactly those three modes:**

```
100755  shell      interpreted    scripts/broken.sh
100755  shell      interpreted    scripts/good.sh
100644  shebang    interpreted    scripts/module.mjs
100755  shebang    executed       scripts/tool.mjs
OK: 4 shebang file(s) checked. …
rc=0
```

Note `tool.mjs` and `module.mjs` are **both** shebang-bearing `.mjs` files that
differ only in how they are reached, and the guard classifies them oppositely.
That is the false-positive class the contract warned about, demonstrated resolved.

#### Satellite guard

Run against a scratch copy of `infra/`, restored between each break.

```
=== BASELINE ===  rc=0  (OK: …)

=== BREAK 1: UBLA = false on the CONTENT bucket ===
::error file=infra/storage.tf::google_storage_bucket.content must set
  uniform_bucket_level_access = true. … the boundary fails OPEN with no error anywhere.
rc=1

=== BREAK 1b: UBLA = false on the PRIVATE bucket ===
::error file=infra/private-bucket.tf::google_storage_bucket.private must set
  uniform_bucket_level_access = true. …                         [satellite guard] rc=1
::error file=infra/private-bucket.tf::… the boundary fails open with no error anywhere.
                                              [check_private_bucket_config.py] rc=1
  (both guards fire independently — neither relies on the other)

=== BREAK 2: satellite bound to a PREDEFINED role ===
::error file=infra/satellites.tf::binding "satellite_publish_prefix" grants a satellite
  the role "roles/storage.objectViewer". A satellite may hold ONLY
  google_project_iam_custom_role.satellite_publisher: every predefined Cloud Storage role
  that can read an object also carries storage.objects.list (ADR-0007 decision 4).
rc=1        <-- the gap the old guard could not see

=== BREAK 3: storage.objects.list added to the role ===
::error file=infra/satellite-role.tf::satellite_publisher must grant exactly [create,
  delete, get] -- got [create, delete, get, list]. …
rc=1

=== BREAK 4: prefix condition removed from the binding ===
::error file=infra/satellites.tf::binding "satellite_publish_prefix" has no prefix
  condition using startsWith. An unconditioned binding of the correct role still covers
  the WHOLE content bucket, not one sources/<source>/ prefix.
rc=1        <-- also invisible to the old guard

=== RESTORED ===  rc=0
```

**The near-miss, recorded because it is the lesson.** My *first* BREAK 1 reported
`rc=0` — the guard passed on a bucket I believed I had broken. The guard was
right: my `sed` replaced the first textual occurrence of
`uniform_bucket_level_access`, which is at `storage.tf:15` **inside a comment**,
while the real resource line at `:87` stayed `true`. Had I accepted that green as
"already covered," I would have shipped the sprint's most important assertion
believing it tested and never having seen it fire. It was caught only by
expecting red and getting green.

---

## Cost table — every new resource

| Resource | New? | Cost at zero traffic | Basis |
|---|---|---|---|
| `google_project_iam_custom_role.gate_session_minter` | yes | **$0.00** | IAM roles are free |
| `google_monitoring_notification_channel.ops_sms` | yes, **`count = 0` by default** | **$0.00** | Cloud Monitoring bills metrics ingestion, API calls, uptime checks and alerting-policy metric references — not notification delivery |
| `local.alert_notification_channels` | yes | **$0.00** | a local value |
| CI guard steps in `budget-guard` | yes | **$0.00** | GitHub-hosted minutes, public repo |
| `PRIVATE_SYNC_PLAN_ONLY` step | yes | **$0.00** | one conditional step |
| dev-staging | **not created** | **$0.00** | see item 7 |

**Net change to the bill: $0.00/month.** The `$5` budget, its
`prevent_destroy`, and the `budget-guard` presence check are untouched (§12.6).

---

## Exact required-check context names

You asked for the strings **as they appear in the check runs**, not the YAML job
keys. I enumerated the distinct check-run names across the last 8 commits on
`main` and compared them to the job keys. **For these two they are identical** —
neither job sets a `name:`, so the job key is the context:

| Promote to required | Context name (verbatim) | Workflow | App |
|---|---|---|---|
| ✅ | `contract-tests` | `.github/workflows/ci.yml` | `github-actions` |
| ✅ | `leak-check-self-test` | `.github/workflows/build.yml` | `github-actions` |

Currently required on `main`: `["governance-checks", "budget-guard"]` — so both
of the above run today **without gating a merge** (#26, S-4).

**Two cautions before you flip them:**

1. **`leak-check-self-test` is conditional**: `if: github.event_name != 'schedule'`.
   It runs on `pull_request` and `push`, so it will be present on every PR — but a
   skipped job reports `skipped`, and with `strict: false` a required context that
   never reports can block a merge indefinitely. It reports on PRs, so this is
   safe; flagged because the failure mode is a stuck merge queue, not a red X.
2. **Do not add `test`** from `gate.yml` without renaming it. It is a generic
   context name, and the full distinct set observed on `main` is:
   `budget-guard`, `build`, `build-and-deploy`, `build-firebase`, `check`,
   `contract-tests`, `deploy`, `deploy-tools`, `firebase-deploy`,
   `firebase-smoke-test`, `governance-checks`, `leak-check-self-test`,
   `notify-failure`, `notify-recovery`, `private-sync`, `smoke-test`, `test`.

---

## Assumptions

1. **The `site` seam's absence is a timing fact, not a cancellation.** I treated
   item 3 as deferred rather than dropped.
2. **`check_revoked` stays `True`.** If `GATE_CHECK_REVOKED` were ever set false,
   `firebaseauth.users.get` becomes unnecessary — but leaving it costs nothing and
   removing it would break the default.
3. **`hub-deploy` remains the private-sync identity until item 3 lands.** The
   two-principal invariant is asserted against its current resource names.
4. **The owner has a mobile that can receive SMS**, for item 6. If not, the item's
   honest answer becomes "no zero-cost non-email channel exists" and the SMS
   resource stays at `count = 0`, which is its default.
5. **`docker` is an acceptable substitute for a local `terraform`/`actionlint`**,
   as at Checkpoints 2–4.

## Recommendations

1. **Verify the email channel before anything else.** Three alert policies are
   silent right now. Everything else in monitoring is theatre until that link is
   clicked.
2. **Promote `contract-tests` and `leak-check-self-test`** (names above).
3. **Decide item 7's fork.** The evidence now favours a separate project; the
   same-project default cannot confine a dev deploy identity.
4. **Run item 4's live sign-in check including step (f).** Mint and verify use
   different permissions; testing only the mint is how a half-narrowed role ships
   looking healthy.
5. **Land item 3 next wave**, with `EXPECTED_PRIVATE_BUCKET_BINDINGS` updated in
   the same commit so the cross-stream contract is testable rather than trusted.
6. **Re-run `check-private-bucket-iam.sh` after any project IAM change.** Its new
   `roles/viewer` assertion is the only thing standing between a routine Viewer
   grant and full read access to the dossier.

## Alternatives considered

- **A new `satellite-role-guard` job** (item 1) — rejected per S-5: a new job is
  not a required context, so it would gate nothing until branch protection
  changed. Folded into `budget-guard` instead.
- **Requiring every shebang file to be `100755`** (item 2) — rejected: it flags
  all eight `.mjs` modules, and a guard that cries wolf gets deleted.
- **An explicit allowlist of interpreted files** (item 2) — rejected as drift-prone;
  reach-based classification needs no list and adapts when a file's call site
  changes.
- **`roles/firebaseauth.viewer`** (item 4) — rejected: no `createSession`, and no
  predefined role sits between viewer and admin.
- **A custom role with `createSession` only** (item 4) — rejected, and this is the
  one the old comment recommended: it breaks every *verify* under `check_revoked`.
- **`google_storage_bucket_iam_policy`** (item 5) — rejected for now: it would
  remove the owner's own object access along with `projectViewer`'s.
- **Webhook / Pub/Sub channel** (item 6) — rejected: free in Monitoring, not free
  of a receiver.
- **Same-project dev-staging** (item 7) — rejected on the Hosting-IAM finding.

## Risks

1. **Item 4 is the one that can break production for the only two members.** If
   `firebase_admin` needs `firebaseauth.configs.get`, sign-in fails at mint.
   Mitigated by the rollback above; not closable without applying.
2. **The narrowed role is applied and verified in separate acts.** Between
   `apply` and the live sign-in check, sign-in is unverified. Apply when the owner
   can immediately run the check.
3. **Item 5's guard fails the whole live script** on a `roles/viewer` grant. That
   is intended, but it will surprise whoever grants Viewer for an unrelated reason.
4. **The exec-bit guard's comment stripping can hide a call site** on a line
   containing `#` inside a string. One-directional: it can only cause a missed
   detection, never a false alarm, and rule A still covers every `*.sh`.
5. **`PRIVATE_SYNC_PLAN_ONLY` is a repository variable**, so anyone who can set
   variables can silently stop the private sync. The `::notice::` makes it visible
   in the log; nothing prevents it.
6. **Item 3 unimplemented means the public deploy identity still holds
   create/delete/get/list on the private bucket.** Unchanged from Phase 3, not a
   regression — but the widest grant still standing.

## Open questions

1. **Does `firebase_admin` fetch the project config on first auth use?** Settles
   whether `firebaseauth.configs.get` belongs in the role. Evidence: the live
   sign-in check, or a `PERMISSION_DENIED` naming the permission.
2. **Item 5 — remove the legacy reader bindings, or keep the guard?** Evidence:
   whether the owner ever intends to grant project Viewer. If never, the guard is
   sufficient and strictly safer.
3. **Item 7 — separate project or same project?** Evidence supplied above;
   the decision is the owner's.
4. **Does the owner have an SMS-capable number to use?** If not, item 6's answer
   becomes "none exists at zero cost," recorded rather than invented.
5. **Should `gate.yml`'s `test` job be renamed** before anyone promotes it? Not my
   file; flagged because the context name is ambiguous.

## Related docs

- `llm/sprints/2026-09-hub/contracts/infra-wave-0.md` — this contract
- `llm/sprints/2026-09-hub/contracts/site-wave-0.md` — item 3's seam (handoff absent)
- `llm/governance/adr/0007-…` decisions 3, 4, 8 · `0010-…` decision 5 · `0004-…`
- `llm/sprints/2026-09-hub/contracts/phase-3-seams.md` — SEAM-1, SEAM-8, SEAM-9
- `llm/specs/2026-09-10-research-hub-design.md` §12.1, §12.2, §12.3, §12.4, §12.6
- `llm/sprints/2026-09-hub/STATE.md` — N-1, S-2, S-4, S-5, §Follow-ups, §Risks
- `infra/README.md` — updated for items 4, 5, 6 and the kill switch

## ADR candidates

1. **dev-staging in a separate GCP project** (item 7) — full text above, ready to
   file as `0012`. **The one that blocks work.**
2. **`projectViewer`'s legacy read on the private bucket** (item 5) — accept the
   latent binding with a live guard, or replace the policy authoritatively.
3. **Narrowing predefined roles to custom roles as a standing rule** — this is now
   the third (satellite, private bucket, gate auth). The pattern, its
   `deletion_policy = "PREVENT"` requirement, and the rule that every such role is
   asserted by a CI guard, deserve one ADR instead of three precedents.
4. **The destructive private sync needs a readable plan before it applies** —
   `PRIVATE_SYNC_PLAN_ONLY` is the mechanism; whether plan-only should be the
   *default* for a withdrawal is a decision nobody has recorded.
