# Handoff — `infra`, Wave 0 fixes

Stream: `infra` · Issue: #44 (hub-007); fixes #55, #58, #54's infra half, and A-11
Branch the work is based on: `feat/infra-wave-0` · Date: 2026-09-19

---

## Summary

Four contract items, all done, plus one addition the Chief Reviewer routed mid-task.

| # | Item | State |
|---|---|---|
| 1 | The guard watched the empty role (#55) | **Fixed.** It expands `roles/editor` **and** `roles/viewer`, fails on either, and says which role and what it reaches. `roles/owner` is reported, never failed on |
| 2 | The live check ran nowhere (#58) | **Fixed.** New `private-bucket-live-iam` job on the **schedule and on push to main**, as a new read-only identity. It fails the job. A credential-free **wiring guard** in `budget-guard` now makes "the check runs nowhere" a red PR |
| 3 | UBLA read in snake_case only (A-11) | **Fixed.** Both spellings, without the `or` that would have swallowed a literal `False` |
| 4 | What the gate's Origin fix needs | **Implemented, not just specified.** The gate handoff landed at 01:09 while I was working, so `GATE_ALLOWED_ORIGINS` is now rendered in `gate.tf` to the gate stream's exact name and shape |
| + | Alert on `event=misconfigured` | **Added** (Chief Reviewer request). Free today; $0.35/month from 2027-09-01 |

**The single most important result.** The guard that PR #53 ships **passes on the live
exposure**. Same stubbed policy, same fixtures, shipped script versus fixed script:

```
################ CONTROL: the SHIPPED (pre-fix) guard on the SAME planted editor policy ################
OK: no principal holds roles/viewer on cusati-hub, so projectViewer expands to the empty set
Private bucket IAM test passed.
>>> shipped guard rc=0  (expect 0 -- IT PASSES ON THE EXPOSURE. This is #55.)
```

That is the whole finding in one line: a guard counted as coverage, asserting over the empty
set, while the populated role went unwatched and the script it lived in ran nowhere at all.

### How this is delivered — read this first

**There are no commits.** My contract forbids checking out a branch (two other agents are
reading and writing this worktree) and forbids git mutations, and the worktree is on
`admin/wave-0-preconditions`, whose `infra/**` and `build.yml` are at *main's* content, not my
branch's. Editing in place would have based the work on the wrong tree. `git status` during
this task showed the other two streams' files live under my hands:

```
 M gate/app/main.py        M site/scripts/check-private-links.mjs
 M gate/tests/conftest.py  ?? site/src-private/lib/signout.mjs      (and 13 more)
```

So the work was done on a read-only extraction of `feat/infra-wave-0` (`git archive`, no git
state touched anywhere) and is delivered as a patch:

```sh
# durable, outside the repository, touches no tracked file and no git state:
/mnt/c/code/infra-wave-0-fixes.patch          # 88,358 bytes, md5 4de66fae473b43349c387f9ec7d9ada1

git checkout feat/infra-wave-0
git apply /mnt/c/code/infra-wave-0-fixes.patch
```

Verified: `git apply --check -p1` is **clean** against a fresh extraction of
`feat/infra-wave-0` (run twice, once against the durable copy).

### What changed

| File | +/− | What |
|---|---|---|
| `infra/scripts/check-private-bucket-iam.sh` | +144 −55 | §2b expands editor/viewer/owner; UBLA shape; header and footer notes made true |
| `.github/workflows/build.yml` | +251 −6 | New `private-bucket-live-iam` job; the wiring guard; two stale comments corrected; both notify jobs' `needs` |
| `infra/auditor.tf` | +158 (new) | The read-only auditor identity, its custom role, its project binding, its WIF binding |
| `infra/scripts/check_private_bucket_config.py` | +141 −1 | §8 the auditor role (and its **negative** property); §9 the `GATE_ALLOWED_ORIGINS` contract |
| `infra/monitoring.tf` | +132 | `hub-gate-misconfigured` metric and its alert policy |
| `infra/gate.tf` | +46 | `local.gate_allowed_origins` and the `GATE_ALLOWED_ORIGINS` env block |
| `infra/outputs.tf` | +20 −1 | `auditor_service_account_email`, `gate_allowed_origins`, `gate_allowed_origins_check_command` |
| `infra/variables.tf` | +18 | `gate_extra_allowed_origins`, validated |
| `infra/README.md` | +155 −29 | Every claim this work falsified, corrected |

Nothing outside `infra/**` and `.github/workflows/build.yml` was touched — checked
mechanically against the branch, file by file. `ci.yml` was in my file set and needed nothing.

---

## Item 1 — the guard now watches the role that reaches the objects (#55)

`§2b` reasoned entirely about readers, expanded `roles/viewer`, and its failure text named
`legacyObjectReader`. Live IAM: `roles/viewer` has **no binding at all**; `roles/editor` holds
the default compute SA. The rewritten block reads the project policy **once** and expands three
roles from it, so the three answers cannot disagree with each other:

- **`roles/viewer` → FAIL.** Reads (`objects.get`) and enumerates (`objects.list`) every
  private object through `legacyBucketReader`/`legacyObjectReader`.
- **`roles/editor` → FAIL.** Through `legacyBucketOwner` + `legacyObjectOwner`: create,
  delete, get, **list**, update, setIamPolicy on every object, plus `buckets.setIamPolicy`.
  The message says it can "read the committee dossier, DESTROY it, ENUMERATE every private
  object name, and rewrite who else may do so", and calls out that `objects.list` is what
  SEAM-1 withholds from the **gate** itself.
- **`roles/owner` → REPORTED, never failed on.** The owner holds it; it reaches objects by the
  same mechanism. Failing would make the check red on every correct run, and a check that is
  always red gets switched off — taking the other two expansions with it.

I did **not** attempt to remove the legacy bindings, per the contract: an authoritative
`google_storage_bucket_iam_policy` would strip the owner's own object access with them.

---

## Item 2 — the live check now runs somewhere real (#58)

### The constraint that shaped the fix

`budget-guard` runs on pull requests; `wif.tf` admits only `refs/heads/main`; a PR run carries
`refs/pull/<n>/merge`. **A PR build cannot authenticate**, so "fold it into budget-guard" could
never have worked (the same constraint as STATE C25, which keeps `fetch-data.sh` alive).

A second constraint the contract did not mention, and which decides the shape of the fix: **no
existing identity can run this check.** `hub-deploy` holds object permissions only —
`storage.objectViewer` on content, `privateSyncWriter`'s four on private. None of them reads
bucket metadata, a bucket IAM policy, or the project IAM policy. The script's own footer had
recorded this as an open question with options (a)/(b)/(c), and (c) — "accept that it is a
Checkpoint procedure" — is precisely how it came to run nowhere.

### What I chose, and what each option does *not* catch

**Option (c): both triggers.** Option (b) is the load-bearing half, as the contract says.

| Trigger | Catches | Does **not** catch |
|---|---|---|
| **`schedule`** (the existing hourly cron) | Anything granted **outside this repository**: a console click, `gcloud add-iam-policy-binding`, a role added to a service account, an inherited org-policy grant. This is exactly how #55 arises — granting `roles/editor` touches no file here | Anything in the up-to-one-hour window before it next runs. It **reports** drift; it cannot prevent it. It also cannot see a change that is reverted within the hour |
| **`push` to main** | Drift within one deploy cycle; gives a merge a live verdict rather than a configuration-only one | The PR that introduced the change — that run cannot authenticate at all. And nothing whatsoever during a quiet week when nobody pushes |
| **`pull_request`** | — | **Impossible, not omitted.** No token, no policy read. PR-time cover is the credential-free config check plus the wiring guard |

Neither trigger catches an exposure that exists and is removed between two runs, and **no**
trigger here catches a grant made at the *organisation* level that this project's policy does
not name. Both are stated rather than glossed.

### The identity: option (b), a read-only auditor

`infra/auditor.tf` adds `hub-auditor@`, keyless, admitted only from `refs/heads/main` through
the existing pool (a scheduled run carries that ref, so no second binding was needed), holding
one custom role with **exactly three** permissions:

```hcl
  permissions = [
    "resourcemanager.projects.getIamPolicy",
    "storage.buckets.get",
    "storage.buckets.getIamPolicy",
  ]
  deletion_policy = "PREVENT"
```

**It holds no `storage.objects.*` permission of any kind** — it can read the policy that says
who may reach a private object, and never the object. That negative property is what makes a
third identity acceptable, and negative properties erode one plausible permission at a time, so
`check_private_bucket_config.py` now asserts it positively (§8) rather than leaving it to
review. Rejected: widening `privateSyncWriter` (it would widen the identity that can *delete*
every private object, for a check rather than for the work) and `roles/iam.securityReviewer`
(getIamPolicy over every resource type where three permissions are needed).

**Scope trade, made deliberately.** The role is bound at **project** level, not on the bucket.
`resourcemanager.projects.getIamPolicy` has no bucket-scoped form, so a project binding was
required regardless; keeping the two storage permissions in it means the auditor can also read
the *content* bucket's metadata and policy. The alternative — a second, bucket-scoped binding —
would have added a **third principal to the private bucket's own IAM policy**, and "the private
bucket carries exactly two bindings" is an equality invariant asserted in two places and quoted
across the sprint's documents. Trading a widely-quoted invariant for a marginally narrower read
of one extra bucket's *policy metadata* is a bad trade. **The private bucket's principal set is
unchanged by this work.**

### It fails the job, and it cannot quietly stop running

The job has **no `needs:`** — it audits the live project, which no job in this workflow
changes (Terraform is applied by hand). Hanging it off `build` would mean a broken site hides
an IAM exposure, and would stop it running on the scheduled polls that find nothing to build,
which are most of the runs. It is in **both** notify jobs' `needs`, so a failure opens the
tracking issue and a failure keeps it open.

It is deliberately **not** conditioned on `vars.GCP_AUDITOR_SA`: that would turn a missing
variable into a silently skipped job — the sprint's defining defect. The first step fails
loudly instead, naming the exact command that fixes it.

**The wiring guard** (`budget-guard`, credential-free, therefore running on PRs) asserts the
live check is invoked by a real job, that the job admits `schedule`, is not
`continue-on-error`, is not conditioned on the auditor variable, and is in `notify-failure`'s
`needs` — and that the script still exists. It **parses** the workflow rather than grepping it,
which is the entire design: the state it exists to prevent is one where the only mention of the
script is a comment, and a comment does not survive `yaml.safe_load`. A grep-based version
would have passed happily on the state that produced #58.

---

## Item 3 — the UBLA shape defect (A-11)

`public_access_prevention` was read shape-tolerantly; `uniform_bucket_level_access` was not. It
fails **closed**, so it was never dangerous — it fails a *correct* bucket, which is the
Checkpoint 4 cry-wolf failure a second time.

The contract said "one `or` fixes it". I used `if ubla is None:` instead, and the difference is
load-bearing: `a or b` also swallows a literal `False`, reporting an absent field when UBLA is
present and **off** — the one case where the message must be exact, because it is the real
finding. Proven both ways in Validation below.

---

## Item 4 — `GATE_ALLOWED_ORIGINS`, implemented

The gate stream's handoff landed mid-task (01:09) and the Chief Reviewer routed it, so this
moved from "specify" to "implement". I took the name, shape and expression **from the gate
handoff itself**, not from the routing summary, and checked every identifier against my tree.

| | |
|---|---|
| Name | `GATE_ALLOWED_ORIGINS`, in the `env` block of `google_cloud_run_v2_service.gate` |
| Shape | comma-separated `https://host[:port]` — no path, trailing slash, query or fragment |
| Unset | the gate logs `event=misconfigured` at ERROR, boots `allowed_origins=none`, and refuses **every** `POST /session/end`. No header fallback, by design |

```hcl
  gate_allowed_origins = join(",", concat([
    "https://${var.domain}",
    "https://${local.gate_service_name}-${data.google_project.hub.number}.${var.region}.run.app",
  ], var.gate_extra_allowed_origins))
```

Both origins, because ADR-0004 puts the invoker at `allUsers`. `var.redirect_domains` is
excluded: those hosts answer a 301, so a browser never has one as its origin when it POSTs.

**The cycle is real.** `google_cloud_run_v2_service.gate.uri` inside the service's own env
block is a self-reference. I tried to reproduce it empirically and could not complete the test
(the throwaway copy had no provider cache), so I am **not** claiming to have observed the error
— I am accepting the gate stream's claim, which is consistent with how Terraform builds its
graph, and I defended against it instead: `check_private_bucket_config.py` §9 fails if `gate.tf`
references `.uri` at all. That guard is proven red below.

**The verification the Chief Reviewer asked for, written down.** This project has **two** live
`*.run.app` spellings for the gate — the Live Prober reached it on both the project-number form
this module constructs and an older `<service>-<hash>-<regioncode>.a.run.app` form. The
constructed value matches the project-number one, but that is inference, so:

```sh
terraform -chdir=infra output -raw gate_allowed_origins_check_command
```

prints three commands: the URL Cloud Run actually serves, the accepted set the running revision
printed at boot, and any `event=misconfigured` line. **The first two must agree.**
`allowed_origins=none` means the variable never reached the revision. If the serving URL is a
spelling this module cannot construct, add it to `var.gate_extra_allowed_origins` (validated:
`https://host[:port]` only) rather than editing the service by hand.

**The alert.** `hub-gate-misconfigured` counts `event=misconfigured`; a fourth policy alerts on
any occurrence, attaching `local.alert_notification_channels` like the other three. It is a
separate policy from the denial spike on purpose: `hub-gate-denials` would eventually show a
misconfigured deploy, but only once a member tries to sign out and fails, and reported as
"denials are up" rather than "the gate started without its origin set". This fires at boot. I
did **not** lean on `gate.yml`'s smoke assertions — U-2 records them as un-failable by
construction, and that file was not mine to touch.

---

## Validation

Every guard shown failing **and** passing. Live checks exercised against a **stubbed `gcloud`**
serving policies I control; no real IAM was read or changed. Anchors asserted unique before
every break, and the specific expected check confirmed by name after it.

### The tooling gate (contract requirement)

```
--- actionlint (all workflows) ---                 PASS
--- terraform fmt -check -recursive ---            PASS
--- terraform validate ---                         Success! The configuration is valid.
--- check_private_bucket_config.py ---             rc=0
--- wiring guard (extracted from shipped bytes) -- rc=0
--- bash -n on the shell guard ---                 PASS
```

`actionlint` v1.7.7 and Terraform v1.16.3 were downloaded for this task (neither was
installed); `terraform init -backend=false` only — **no `plan`, no `apply`**, per contract.
The baseline `build.yml` was also linted clean, so the PASS is mine and not inherited noise.

### Item 1 — the editor expansion

```
################ RED 1: roles/editor planted (issue #55, the live state) ################
OK: no principal holds roles/viewer on cusati-hub, so projectViewer expands to the empty set …
FAIL: roles/editor on cusati-hub is NOT empty. Through the automatic legacyBucketOwner/
legacyObjectOwner bindings, each principal below holds create, delete, get, LIST, update and
setIamPolicy on EVERY OBJECT in gs://cusati-hub-private, plus storage.buckets.setIamPolicy on
the bucket itself -- so it can read the committee dossier, DESTROY it, ENUMERATE every private
object name, and rewrite who else may do so:
    serviceAccount:410552878319-compute@developer.gserviceaccount.com
    storage.objects.list is the sharpest of those: SEAM-1 withholds it
    from the GATE itself, because object names in this bucket are private material.
>>> rc=1 (expect 1)

################ RED 2: roles/viewer planted ################
FAIL: roles/viewer on cusati-hub is NOT empty. … can READ (storage.objects.get) and ENUMERATE
(storage.objects.list) EVERY PRIVATE OBJECT in gs://cusati-hub-private:
OK: no principal holds roles/editor on cusati-hub …
>>> rc=1 (expect 1)
```

Note both directions: each red case shows the *other* role still passing, so the failure is
attributable to the role I planted and not to a blanket failure.

### Item 3 — UBLA, both shapes, and the `or` trap

```
################ ITEM 3: gcloud returns UBLA camelCase ################
SHIPPED: FAIL: uniform_bucket_level_access is 'None', expected True. STOP: …  -> rc=1
         (cries wolf on a CORRECT bucket)
FIXED:   OK: uniform_bucket_level_access is True …                            -> rc=0

################ ITEM 3b: UBLA genuinely OFF is still reported as False, not None ################
FAIL: uniform_bucket_level_access is 'False', expected True (read under both the snake_case and
camelCase spellings of the field). STOP: …
>>> rc=1  (the value must read 'False' -- an 'or' would have printed 'None')
```

### Item 2 — the wiring guard, green and five reds

The green run is itself a finding: my **first** version matched any step whose `run` merely
*contained* the script path, so it matched its own source and reported `budget-guard` as the
call site. Fixed to require a command position, the way the executable-bit guard classifies by
how a file is *reached*:

```
################ GREEN (after the self-match fix) ################
OK: infra/scripts/check-private-bucket-iam.sh is invoked by job(s) [private-bucket-live-iam],
on triggers ['pull_request', 'push', 'schedule', 'workflow_dispatch'], with no
continue-on-error, and a failure pages through notify-failure.
>>> rc=0
```

```
RED: the guard against the SHIPPED build.yml (#58's actual state)
  mentions of the script in the shipped workflow: 1
  ::error::no job in .github/workflows/build.yml runs infra/scripts/check-private-bucket-iam.sh.
  It was referenced only from a comment for two phases while three documents claimed it ran on
  every deploy (#58). A comment is not a call site.                              rc=1

RED: the schedule trigger is dropped from the live job's if
  anchor unique (1)
  ::error::job "private-bucket-live-iam" … its `if:` does not admit the schedule event …  rc=1

RED: the job is conditioned on GCP_AUDITOR_SA, so a missing variable would SKIP it
  naive anchor occurs 2x -- ambiguous, would also hit private-sync
  qualified anchor unique (1)
  ::error::job "private-bucket-live-iam" is conditioned on vars.GCP_AUDITOR_SA. That makes an
  unset variable SKIP the live check silently …                                  rc=1

RED: the live job is dropped from notify-failure's needs
  naive anchor occurs 2x -- ambiguous across notify-failure/notify-recovery
  qualified anchor unique (1)
  ::error::… is not in notify-failure's `needs`, so a live IAM failure would page nobody …  rc=1

RED: the live job is marked continue-on-error
  anchor unique (1)
  ::error::… sets continue-on-error, so the check reports and exits 0. It must fail the job …  rc=1

RED: the script itself is deleted
  ::error::infra/scripts/check-private-bucket-iam.sh does not exist …            rc=1
```

**The anchor rule earned its keep twice here.** Two of those breaks had a naive anchor occurring
**2×** — `&& vars.GCP_PRIVATE_BUCKET != ''` also matches `private-sync`, and
`, private-bucket-live-iam]` matches both notify jobs. Without `assert count == 1` I would have
broken the wrong job and reported a guard that "correctly failed" for the wrong reason.

### Items 2 and 4 — the configuration guard

```
GREEN: OK: private bucket declares uniform bucket-level access … The CI auditor role holds
exactly projects.getIamPolicy, buckets.get and buckets.getIamPolicy, and no storage.objects.*
permission of any kind.                                                          rc=0

RED: the auditor role gains storage.objects.get      (anchor unique (1))
  ::error::private_bucket_auditor must grant exactly [...] -- got [... 'storage.objects.get'].
  ::error::private_bucket_auditor grants ['storage.objects.get']. The auditor reads POLICIES,
  never content … storage.objects.list in particular would let a CI identity enumerate private
  object names, which SEAM-1 withholds even from the gate.                       rc=1

RED: auditor.tf deleted entirely
  ::error::auditor.tf is missing … which is issue #58.                           rc=1

RED (§9): the env var is renamed, breaking the cross-stream contract by NAME  (anchor unique (1))
  ::error::the gate service must render an env block named exactly "GATE_ALLOWED_ORIGINS" …
  without it, POST /session/end refuses EVERY request and no member can sign out.

RED (§9): the value is spelled with the service's own uri (the cycle trap)     (anchor unique (1))
  ::error::gate.tf references google_cloud_run_v2_service.gate.uri … a SELF-REFERENCE and
  Terraform refuses the configuration …
```

Both "deleted subject" cases go red rather than quietly asserting nothing — the F-1 lesson.
Every red case ran in its own fresh copy of the tree, and the work tree was confirmed green
again afterwards.

---

## Assumptions

1. **`hub-gate` is the gate's runtime SA email stem.** The live job derives
   `GATE_SA=hub-gate@<project>.iam.gserviceaccount.com` rather than adding a fourth repository
   variable, because `local.gate_service_name` is a fixed local (not a variable) precisely
   because `firebase.json` names it literally. If that ever stops matching, §2's equality
   assertion fails loudly — the correct outcome, not a silent pass.
2. **`index.html` is a real object at the private bucket root**, used as the default
   `PROBE_OBJECT` so the anonymous-request clause actually runs. It is the private build's root
   page and already appears in the README; no private path is committed. Override with
   `vars.GCP_PRIVATE_PROBE_OBJECT`.
3. **PyYAML is present on `ubuntu-24.04`.** The wiring guard fails **closed** with an explicit
   message if it is not, so a wrong assumption here is loud, not silent.
4. **The Terraform self-reference cycle**, per the gate stream — I did not reproduce it myself;
   see Item 4.
5. **`data.google_project.hub.number` is 410552878319** (consistent with the compute SA in the
   editor binding), making the constructed origin
   `https://hub-gate-410552878319.us-east1.run.app` — which the Live Prober reached live.

## Recommendations

1. **Apply, then set `GCP_AUDITOR_SA` in the same session.** `terraform output -raw
   auditor_service_account_email`. Until it is set the live job **fails every hour** — by
   design, and self-clearing, but see Risks.
2. **Run `gate_allowed_origins_check_command` after the first apply that includes the gate env
   change**, before announcing sign-out works.
3. **Route nothing else for me.** `GATE_ALLOWED_ORIGINS` is rendered by Terraform, not a
   repository variable; there is nothing for the owner to set.
4. **Narrowing `hub-gate-denials` to `event=deny scope=` is `infra/**` and was not in my
   contract** (the gate stream's recommendation 4, the Red Team's originally). I deliberately
   did not do it. It is a small, independent change and worth a follow-up.
5. **The legacy bindings remain.** Removing them is still the owner decision recorded as item 5
   of the Wave 0 infra handoff, unchanged by this work.

## Alternatives considered

- **Widening `privateSyncWriter`** with the two bucket-policy permissions — rejected: it widens
  the identity that can delete every private object, for a check rather than for the work.
- **`roles/iam.securityReviewer`** for the auditor — rejected: getIamPolicy over every resource
  type in the project where three permissions suffice.
- **A bucket-scoped auditor binding** — rejected: it would add a third principal to the private
  bucket's IAM policy and break an equality invariant quoted across the sprint. See Item 2.
- **A schedule-only job (option b alone)** — rejected: option (b) is the minimum, but a push
  trigger costs nothing and gives a merge a live verdict.
- **`if: github.event_name != 'pull_request'`** for the job — rejected in favour of enumerating
  the three triggers, so that a reader *and the wiring guard* can see the schedule is admitted.
- **Failing on `roles/owner`** — rejected: it is the owner, it is expected, and a permanently
  red check is a check that gets switched off.
- **Grepping `build.yml` for the script name** in the wiring guard — rejected: it would have
  passed on the exact state that produced #58. The workflow is parsed.

## Risks

1. **Between apply and setting `GCP_AUDITOR_SA`, the pipeline pages hourly.** The job fails
   deliberately rather than skipping. `notify-failure` comments on one tracking issue rather
   than opening a new one per run, so the noise is bounded — but it is real, it is disclosed,
   and it is fixed by one `gh variable set`. I judged a noisy, self-clearing failure better
   than a quietly skipped guard, which is the defect this whole wave exists to end.
2. **The constructed `*.run.app` origin may not be the serving URL.** Two spellings are live on
   this project. If the service answers on the hash form, sign-out from that host is refused
   until it is added to `var.gate_extra_allowed_origins`. It fails **closed** — nothing is
   exposed, a member simply cannot sign out. Recommendation 2 is the mitigation.
3. **`gate.yml`'s smoke test posts to the URL `gcloud run services describe` returns** — the
   hash form. If any of its sign-out assertions ever becomes able to fail (U-2), it will fail
   against an accepted set that does not contain that spelling. Flagged; that file was not mine.
4. **I added a fourth alert policy**, so the gate stream's #57 guard must count **4** policies
   and **4** `local.alert_notification_channels` references. Both are 4 in my tree; I verified
   the balance. If their fixed guard hard-codes 3, it will go red on my change.
5. **Alerting stops being free on 2027-09-01**: $0.35/month per metric reference, no free
   allotment. Four policies ≈ **$1.40/month** against the $5 budget, arriving without anyone
   touching this repository.
6. **The auditor can read the content bucket's policy and metadata too** (project-scoped
   binding). Read-only, no object access, no write. Stated as a deliberate trade, not an
   oversight.
7. **The live check adds an hourly dependency on `gcloud` being present** on the runner. It uses
   `setup-gcloud` pinned to the same SHA `gate.yml` already uses.

## Open questions

1. **Should the hash-form `*.run.app` origin be in the accepted set by default?** I left
   `gate_extra_allowed_origins` empty so the applied value is exactly what the gate stream
   specified. The live evidence suggests it may be needed. One command answers it.
2. **Should `PROBE_OBJECT` be a required variable rather than defaulted?** Defaulted, the
   anonymous clause always runs; required, a missing value would be loud. I chose the former
   because the check is worthless when skipped.
3. **Should the private bucket's legacy bindings be removed authoritatively?** Unchanged owner
   decision (item 5); it would strip the owner's own object access.
4. **Is an hourly live IAM read the right frequency?** It reuses the existing cron, so it cost
   no new trigger. Daily would be cheaper and blinder; hourly is ~1,500 Class B ops/month,
   inside the free allowance.

## Related docs

- `llm/sprints/2026-09-hub/contracts/infra-wave-0-fixes.md` — this contract
- `llm/sprints/2026-09-hub/handoffs/gate-wave-0-fixes.md` — the `GATE_ALLOWED_ORIGINS` spec I implemented
- `llm/sprints/2026-09-hub/handoffs/chief-reviewer-wave-0.md` — B-4
- `llm/sprints/2026-09-hub/handoffs/skeptic-verifier-wave-0.md` — F-4, and the stub-`gcloud` technique
- `llm/sprints/2026-09-hub/handoffs/boundary-tester-wave-0.md` — 6b, the editor finding
- `llm/sprints/2026-09-hub/handoffs/live-prober-wave-0.md` — the two live `*.run.app` spellings
- `llm/sprints/2026-09-hub/handoffs/infra-wave-0.md` — item 5, the legacy-binding decision
- `llm/sprints/2026-09-hub/STATE.md` — A-2, A-4, A-11, RT-7, C25
- `infra/README.md` — rewritten where it was wrong

## ADR candidates

1. **A read-only auditor identity for live security checks.** The pattern — a keyless,
   main-only identity holding policy-read permissions and *no* data permissions — is reusable,
   and it resolves the (a)/(b)/(c) question the script's footer carried since Phase 3.
2. **A guard must be wired, and the wiring is itself asserted.** Five instances this sprint of
   checks that could not fail or did not run. "Parse the workflow; a comment is not a call
   site" is a generalisable rule.
3. **Cross-stream environment variables are contracts, asserted by the renderer.** Phase 3 paid
   for `PRIVATE_BUCKET` vs `GATE_PRIVATE_BUCKET`; §9 now fails CI on the same class of defect.
4. **Alerting cost becomes non-zero on 2027-09-01** — worth an explicit decision before it
   arrives, since it changes the $5 budget's headroom without any change here.

---

## Constraints — compliance

- **No `terraform plan` or `apply`.** `fmt -check`, `init -backend=false`, `validate` only.
- **No git, `gh` or cloud mutations.** No branch checked out; the branch was read via
  `git archive`. No live IAM read or written — every live-check exercise used a stubbed `gcloud`.
- **Secrets:** none. No key file, no credential, no secret value anywhere; the auditor is WIF-only.
- **Custom roles:** `privateBucketAuditor` carries `deletion_policy = "PREVENT"`, like every
  other custom role in the module.
- **Budget:** `budget.tf` untouched; the $5 budget and its `prevent_destroy` guard are unchanged.
  Every new resource carries a cost line in `infra/README.md` §Cost.
- **No private content quoted** anywhere in this handoff or in the code.
- **File contract:** only `infra/**` and `.github/workflows/build.yml` changed, verified
  mechanically file-by-file against the branch.
