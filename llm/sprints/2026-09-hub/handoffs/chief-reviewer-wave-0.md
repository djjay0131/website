# #45 Request changes · #47 Request changes · #48 Approve · #53 Request changes — and the §8 conditions are NOT met.

Role: Chief Reviewer, Wave 0 (`llm/sprints/2026-09-hub/contracts/chief-reviewer-wave-0.md`)
Date: 2026-09-19
Authored nothing in this wave. No git, `gh` or cloud mutation was made. Branches were read with
`git diff main...origin/<branch>` and `git show origin/<branch>:<path>`; **no branch was checked out.**
Live probes were read-only: HTTP GET (plus one anonymous POST that carries no session and changes no
server state), `gcloud ... get-iam-policy`, `gcloud storage ls`, `gcloud iam roles describe`, and one
Monitoring REST read.

---

## The §8 statement, first, because it governs everything below

**The §8 conditions are NOT met. Nothing in this wave may merge today.**

Three independent reasons, in order of how hard they are to argue with:

1. **Four Security Tester FAILs stand, and none is dispositioned.** §8 admits no judgement here: a
   single FAIL blocks. I re-derived two of the four myself rather than taking them on report
   (checks 3 and 4, below) and both are real. `STATE.md` §Wave 0 dispositions contains **no
   Security Tester section at all** — the section's own rule is "No finding is closed by silence,"
   and four FAILs are currently closed by silence.
2. **A defect that makes `main` red on merge, which neither PR's CI can see.** Issue #57. I did not
   take this on report either — I ran the guard's logic against both trees (§B-2). It is a blocker
   independent of the FAILs, and filing the issue did not remove it.
3. **The wave's own record is not yet true.** #45 is the artifact that says what happened, and it
   does not yet record the adversarial round's blocking output or the corrections below.

I **uphold** the Skeptic Verifier's reading of U-1 and U-2 — they block "done", not "merge" — and I
say why in §D. That was the one thing it asked to be overruled on; I am not overruling it.

---

# Blocking findings

## B-1 (recurrence) — ADR-0004 decision 4 still says the gate is the private bucket's *only* reader

**This is my Phase 3 finding B-1, at a node nobody amended.** Verbatim, on `main` today,
`llm/governance/adr/0004-private-area-cloud-run-gate-behind-hosting.md:23`:

> 4. **Serving.** The gate's service account is the private bucket's only
>    reader. Responses carry `Cache-Control: private, no-store`.

Every *other* artifact carrying that claim was amended when ADR-0010 decision 5 landed:

| Artifact | State |
|---|---|
| design doc §6 requirement 3 | amended 2026-09-17, and says the old wording **"must not be restored"** |
| `master-roadmap.md:282` | amended 2026-09-17, dated |
| SEAM-1 prose (`phase-3-seams.md`) | amended 2026-09-17 |
| ADR-0010 Related Documents | declares the amendment |
| **ADR-0004 decision 4** | **untouched. No amendment note. Not listed as amended by ADR-0010.** |

This is precisely the shape the contract told me to look for, and precisely the consequence: ADR-0004
is an *Accepted* ADR stating an invariant as a decision. A later contributor "restoring" it — or a
reviewer enforcing it — removes `hub-deploy` from the bucket, and **removing `hub-deploy` disables
withdrawal**, because pruning needs `list` and `delete`. A withdrawn item would keep being served
while every check reported success. That is the failure ADR-0010 decision 5 exists to prevent,
reached through the document that was left behind.

Two smaller instances of the same shape, worth fixing in the same edit:

- **SEAM-1 contradicts itself inside one document.** `phase-3-seams.md:36`, in the ASCII diagram:
  `gs://<private-bucket>/ ← gate SA is the ONLY reader` — **eight lines above** the amendment that
  calls that claim unimplementable. A reader who reads the picture and not the prose gets the wrong
  invariant.
- **Design doc header.** The status line was amended correctly — `Approved for Phase 0–6 execution`,
  attributed and dated, with R-A3 retired downstream. That direction is right and is the opposite of
  B-1. But two lines below it still read `Last updated: 2026-09-10` (a document amended 2026-09-18)
  and `Governance: agentic-governance v0.5` — the delta pins **v0.9** (CI SHA `851a50a`, verified).
  The CPO flagged the v0.5 line at Phase 0; it has now survived two canon bumps.

**Classification: blocking.** Not because it breaks anything today, but because the Phase 3 precedent
classified the identical defect as blocking and the reasoning has not changed. `llm/**` is Lead
Architect-only, so the fix belongs in **#45**.

**Evidence that would settle it:** a dated amendment note on ADR-0004 decision 4 citing ADR-0010
decision 5; ADR-0010's Related Documents listing ADR-0004; the SEAM-1 diagram line corrected.

## B-2 — #47 and #53 turn `main` red in **either** merge order (issue #57)

I did not accept this on report. I extracted the guard's own logic and ran it against both trees:

```
== gate/tests/test_monitoring_contract.py::test_every_alert_policy_has_a_notification_channel ==
   policies = tf.count('resource "google_monitoring_alert_policy"')
   attached = tf.count("notification_channels = [")
   assert attached >= policies

monitoring.tf from main                      policies=3  attached=3  -> PASSES
monitoring.tf from origin/feat/infra-wave-0  policies=3  attached=0  -> FAILS
```

#53 replaces all three inline list literals with `notification_channels = local.alert_notification_channels`.
The test asserts a **spelling**, not the property; its own docstring states the property correctly. So
the guard goes red **at the moment the code improves**, and ADR-0011 names exactly this risk: a guard
that goes red on an improvement gets deleted, and the invariant goes with it.

**The disposition is the problem, not the finding.** #57 is filed and well-written. But `STATE.md`
§8 sequencing orders #48 → #47 → #53, and following that order lands a red `main` at step 3. An issue
is not a gate. Either the test is fixed on `feat/gate-signout` before #47 merges, or #47 and #53 do
not merge in this wave.

**Classification: blocking on #47 and #53 jointly.** The fix is small and belongs in `gate/**`, which
is #47's.

## B-3 — #47's CSRF check is bypassable, and #47 ships a test that **pins the bypass as correct**

Security check 3's FAIL is real. I reproduced `_same_origin()` exactly as shipped on
`feat/gate-signout` and ran it standalone — no test harness, no fakes:

```
legit browser same-origin                ACCEPTED -> 200 + clears cookie
real cross-site POST (no XFH)            refused  -> 403
no Origin at all                         refused  -> 403
ATTACK: forged X-Forwarded-Host          ACCEPTED -> 200 + clears cookie   <== BYPASS
ATTACK: XFH comma list                   ACCEPTED -> 200 + clears cookie   <== BYPASS
ATTACK: forged Host (direct run.app)     ACCEPTED -> 200 + clears cookie   <== BYPASS
```

The cause is structural: `addressed_to` is built from headers **the caller supplies**. On the direct
`*.run.app` transport the invoker is `allUsers` by design (ADR-0004), so the caller controls every
header and the check provides nothing there.

**The part not yet on the record, and the reason this is blocking rather than should-fix:** #47 ships
`test_the_site_domain_is_recognised_when_it_arrives_in_x_forwarded_host`, which asserts the
`X-Forwarded-Host` branch returns **200**. Both the Security Tester and the Red Team recommend
deleting that branch; the Skeptic Verifier's guard #9 records that deleting it turns a test red. So
**merging #47 installs a regression test against its own fix.** Whoever applies the recommended
three-line fix meets a red suite and has to decide whether to delete a test — the exact position this
sprint keeps finding itself in.

The gate stream's reasoning for accepting both headers is honest and defensible on its own terms (it
cannot fail closed on an unsettled Hosting question). The defect is that the uncertainty was resolved
by *widening* and then pinned by a test, rather than left explicitly open.

**Classification: blocking on #47.** Either narrow the comparison now, or keep the branch and
re-classify that test as a **temporary** assertion with the probe that will retire it named in the
test itself.

**Evidence that would settle it:** probe P6 against a deployed `/session/end` showing which header
carries the site domain on a Hosting rewrite — which cannot run until #48 deploys.

## B-4 — #53's new private-bucket guard is vacuous three times over

The contract asked me whether a guard over an empty input set is being counted as proof. This one is,
and it is worse than the record states. **I verified all three halves live, myself:**

```
project IAM, cusati-hub:
  roles/editor -> serviceAccount:410552878319-compute@developer.gserviceaccount.com   [POPULATED]
  roles/owner  -> user:<owner>                                                        [POPULATED]
  roles/viewer -> (no binding at all)                                                 [EMPTY]
```

1. **It watches the empty role.** #53 adds a check that expands `roles/viewer` and fails if anyone
   holds it. Nobody does. It asserts over the empty set and passes trivially.
2. **The populated role is the one that reaches the objects.** `roles/editor` expands to
   `projectEditor:`, which the private bucket's automatic `legacyBucketOwner` + `legacyObjectOwner`
   bindings name. Union: create, delete, **list**, get, update, setIamPolicy on every object.
   `objects.list` is the sharpest part — SEAM-1 withholds it from the *gate* deliberately, because
   object names in that bucket are themselves private material, and an untracked identity has it.
3. **The script it was added to runs nowhere.** `check-private-bucket-iam.sh` is referenced by
   `.github/workflows/build.yml` only inside a **comment** (`build.yml:512`). I checked `main` and
   the branch: no workflow invokes it. So the new assertion is an empty check, on the wrong role, in
   a file nothing executes.

Issue #55 captures items 1 and 2 accurately. But #53 **ships the defective guard**, and the
`infra/README.md` text landing with it presents the check as the mitigation ("the moment that grant
happens it is loud rather than invisible"). It would not be loud. It would not run.

To be fair to the stream and to the disposition: the exposure is **latent, not live** — zero
user-managed keys on that account, no impersonation bindings, nothing runs as it, Compute API
disabled. I confirmed the private bucket's non-legacy principal set is exactly right (§A-1). The
finding is about the *guard*, not about a breach.

**Classification: blocking on #53** — a guard that cannot fail is worse than no guard, because it is
counted as coverage. One extra expansion (`roles/editor`, `roles/owner`) and one workflow step fix
both.

## B-5 — Security check 4's FAIL is **not** resolved by #53, in two separate ways

You asked me specifically whether your disposition here was right. **It is not, and this is the
correction I most want you to take.** You treated check 4's FAIL as describing pre-merge state that
#53 itself resolves. Live state, read by me:

```
roles held by hub-gate@:   roles/datastore.viewer
                           roles/firebaseauth.admin        <-- still bound, in production
gcloud iam roles describe gateSessionMinter --project cusati-hub
                        -> NOT_FOUND
private bucket, non-legacy bindings:
   hub-gate@    -> privateObjectReader
   hub-deploy@  -> privateSyncWriter                       <-- still bound
```

**(a) Merging #53 changes nothing. Only `terraform apply` does.** #53 is Terraform. The binding on
`hub-gate` is destroyed and the custom role created *at apply*, not at merge. And you have already
gated that apply behind D-3 ("I do not apply the narrowing until a sign-in route is proven to
deliver"), which depends on #31 (Google sign-in unconfigured, a console-only owner action) and on
D6.5 (email delivery under suspicion). So the state check 4 fails on persists after #53 merges, and
persists for as long as D-3's precondition is unmet. Calling it "pre-merge state that #53 resolves"
converts a live over-grant into a resolved one on paper.

**(b) The second clause of check 4 is not addressed by #53 at all.** The check requires that after
item 3, the **public deploy identity holds NO private-bucket permission**. Item 3 is openly
unimplemented — infra's own handoff heading says "WAITING, nothing implemented" — and `hub-deploy`
still holds `privateSyncWriter`. Nothing on any of the four branches changes that. The Security
Tester says so in its own words: *"`hub-deploy` still holds `privateSyncWriter` on the private bucket
in both the live policy and the plan."*

**There is a third-order effect worth seeing.** #53's `check_private_bucket_config.py` pins
`EXPECTED_PRIVATE_BUCKET_BINDINGS = {"gate_private_reader": ..., "hub_deploy_private_sync": ...}`.
That is an **equality** assertion. So the wave ships a guard that will go **red** the moment SEAM-10's
split is implemented. SEAM-10 S10.3 discloses this ("by design"), so it is not a defect — but it means
the un-narrowed state is now actively asserted as correct by a required check, and that raises the
cost of the narrowing rather than lowering it.

**Classification: blocking as a disposition correction**, not as a new defect against #53's code.
#53's narrowing is correct and well-argued; the error is in the status assigned to the FAIL.

---

# Should-fix

## S-1 — Sign-out ships with no way for a member to sign out

SD-4 exists because "a member on a shared machine could not end their own session." After **both**
#47 and #48 merge, that is still true. I searched every branch:

```
git grep -i -E 'sign[ -]?out|logout|session/end' <ref> -- site/src site/public site/scripts
  origin/feat/site-wave-0   -> (no matches)
  origin/feat/gate-signout  -> (no matches)
  main                      -> (no matches)
```

The route exists, the Hosting rewrite exists, the smoke test calls it, the README documents the
`fetch()` a client *would* use — and nothing in the site calls it. There is no button, link or script
anywhere in `site/`. The defect SD-4 names is not fixed by this wave; the *capability* is.

This is not a scope violation — no contract assigned the UI to anyone, and both streams stayed inside
their file sets. It is a seam that fell between them, and the same shape as D-5: one change, two
owners, and the half nobody owned did not happen. Record it plainly rather than letting Wave 0 close
with SD-4 marked done.

## S-2 — The second alert channel is real work that delivers nothing today

#53's `local.alert_notification_channels` is a genuine improvement and #57's fix should preserve it.
But the channel set it concatenates is, today, exactly one channel, and that channel is unverified.
Live read:

```
GET .../notificationChannels
  email  "Hub ops email"  verificationStatus=<ABSENT>  enabled=True
```

`ops_sms_number` defaults to `""`, so `count = 0` and no SMS channel exists. So "every policy attaches
every configured channel" is true and currently means "every policy attaches one channel that
delivers nothing." The README is honest about this ("THIS IS STILL OUTSTANDING") and the design is
right. The finding is that **no Wave 0 artifact should describe alerting as improved** until a channel
is verified — and verification is console work only the owner can do. This compounds with #54: fixing
delivery without fixing metric forgery turns a silent alerting path into a forgeable one.

## S-3 — `contract-tests` and `leak-check-self-test` are still not required

Live: `required_status_checks.contexts = ["governance-checks", "budget-guard"]`. Both promotions are
Wave 0 scope items on issue #44 and remain unticked. `STATE.md:600–615` records your two cautions
before flipping them, and both cautions are correct — particularly that a required context which
never reports produces a stuck merge, not a red X. Note that `leak-check-self-test` now finally has
real private items to prove something about, and still gates nothing.

Related, and I want to name it because "all green on both required contexts" reads stronger than it
is: **two of the four contexts those PRs are green on are not gates.** The claim is accurate; the
reassurance it carries is not.

## S-4 — The live half of the §12.1 bucket-IAM criterion runs in no automation

Independent of B-4. `check_private_bucket_config.py` runs in `budget-guard` on every PR — I confirmed
it sits inside that job (lines 351/481/513 fall between `budget-guard:` at 261 and `deploy-tools:` at
622), and `budget-guard` is a required context with no `if:` condition, so the placement decision is
correct and well-reasoned. But that script reads **Terraform, not the live policy**. It catches a
widening edit at review time; it cannot see drift, a console click, or anything granted outside
Terraform — which is exactly how the `roles/editor` exposure arrived. The live half exists and is
invoked by nothing. The private bucket's live policy is correct today because three agents and I read
it this week, which is people doing it once, not a test.

## S-5 — Governance: four PRs, four declared levels, zero labels

From the L0 audit I carry. All four PRs declare `## Governance Level: L2` in the body, with
justification — the declaration half is done well. **None of the four carries any label at all**,
including `gov-L*`. Canon requires exactly one per PR. This is systemic rather than a Wave 0 slip:
all ten most recently merged PRs carry neither a label nor a declaration, including PR #22, the canon
pin bump. One-minute fix, and it is a merge precondition.

## S-6 — Five durable Wave 0 decisions are sitting in `STATE.md` instead of ADRs

D8 (private by default — amends design doc §4 and §5), Q6 (satellite order — amends §2 and §11), G-8's
three gate decisions, and S-1's change to *where* ADR-0010 decision 4 applies. Four of the five are
self-flagged in PR bodies or STATE as needing an ADR. The roadmap's own Q6 row promises "Recorded as
an ADR amending design doc §2 and §11" — and no such ADR exists. A decision that lives only in a
sprint record is one restructure from being lost, and this is the orphan-decision pattern.

## S-7 — The memory bank is eight merged PRs behind

`llm/memory_bank/activeContext.md` and `progress.md` both read `Last updated: 2026-09-16`; the last
commit touching the bank was 2026-09-17 (#32). Eight PRs have merged since (#34–#43), none touching
it. It still lists issue #30 as open — #35 closed it, and #45 re-verified it does not reproduce. It
records nothing of the gate logging defect (#40), this sprint's most-cited lesson. Notably, the two
PRs literally titled "record …" (#37, #41) both wrote to `STATE.md` instead. The bank has been
displaced by the sprint record.

---

# Notes

**N-1 — Scope discipline: clean, and unusually so.** All 32 changed files across the four branches are
inside their streams' declared sets, and every contested file is granted by a verbatim clause:
`.github/workflows/gate.yml` is named in the gate contract (which forbids `build.yml` and `ci.yml`);
`firebase.json` is named in the site contract (and explicitly forbidden to infra); `build.yml` is
reassigned to infra this wave with the SEAM-8 change recorded in the contract header. No stream
edited another's file to make its own work fit — and the gate stream demonstrably declined to,
stopping and reporting the `firebase.json` rewrite rather than taking it. #45's `llm/**` edits are
Lead Architect edits, not `roadmap-truth`'s, which wrote exactly its one permitted file. **Forward
gap:** SEAM-B8's Wave 0b ownership table omits `firebase.json` entirely, where SEAM-8 covered it.
Wave 0b starts with that file unowned.

**N-2 — #48's `required: true` flip is safe, and I checked the bucket rather than the claim.** The
site stream's own assumption 4 says it could not verify the publish and relied on `STATE.md`. That is
a remote claim on a local document, so I verified it:

```
gs://cusati-hub-content/sources/  -> cv/ , phd-milestones/
sources/phd-milestones/manifest.json  present
  source=phd-milestones  published=2026-09-17T20:28:54Z  items=2  (both visibility=private)
object counts: cv 19, phd-milestones 4
```

Both required prefixes exist with valid manifests, so the flip does not break the deploy build. The
provenance marker is genuinely fail-closed — absent, unreadable or unrecognised all enforce — and was
shown failing. Good work.

**N-3 — but the flip's exemption is per-tree, not per-source.** On every pull request the fallback
tree declares `complete: false` and the expected-source check evaluates **zero** required sources. The
skip is printed loudly and cannot be suppressed, the deploy path is always `complete: true`, and the
alternative was a red build on every PR — so the design is right. Still: on a `cv-release` tree a
vanished `cv` prefix would also go unreported. The site stream raises this itself as its open
question 3. Worth answering before Wave 0b.

**N-4 — the health path is now pinned in three places, and two of those tests skip rather than fail.**
The three-way contract tests in #47 are the right idea (the app's route set, `infra/monitoring.tf`,
`gate.yml`). Two are `@pytest.mark.skipif(not <file>.exists())`. Deleting or renaming
`infra/monitoring.tf` — which SEAM-10 is about to move things around near — turns the guard **quiet**,
not red: `265 passed, 4 skipped`, exit 0. Latent today; `assert MONITORING.exists()` closes it. Live
state confirms the contract holds: `/_health` is served on the run.app URL only, `/healthz` returns
Google's 1568-byte frontend page, and `/_health` through Hosting returns the site's 404 — which is
correct by G-3 and should not be "fixed."

**N-5 — `/session/end` is genuinely not deployed.** Live: `404` on both the Hosting path and the
direct POST. That is expected, and it means every sign-out property in this wave is proven locally
only. The `gate.yml` smoke test that would prove it remotely runs only after merge and deploy.

**N-6 — two streams named the same new principal differently.** Site's SEAM-10 specifies
`private-sync@…` / `account_id = "private-sync"`; infra's handoff says `hub-private-sync`. Both
handoffs cite the `PRIVATE_BUCKET`/`GATE_PRIVATE_BUCKET` defect as the reason to name things exactly,
and have reproduced it. Settle the name before item 3 is built.

**N-7 — check 6 verified independently.** I ran it: `{critical: 1, high: 9, moderate: 6, low: 1}`;
`astro` critical and **direct**, `js-yaml` high and direct. `site/package.json` declares 13
`dependencies` and **no `devDependencies` key**, so `--omit=dev` excludes nothing. Issue #56 is
accurate in every particular.

**N-8 — the Dissenter was right on all five, and you accepted all five.** I re-checked D-1 and D-4 in
particular and agree with the acceptances, including D-1's "worse than stated." I have no objection to
overrule. The one thing I would add: D-1's accepted remediation (`attribute.workflow_ref`) rests on a
premise the Dissenter explicitly did **not** verify against a live token, and said so. Verify it
before building on it.

---

# The four questions you asked

**1. Did anything get widened?** No. I checked the three you named, live:

- **The gate's role after N-1.** Nothing widened. `#53` declares exactly
  `firebaseauth.users.createSession` + `firebaseauth.users.get`, and the reasoning for `users.get`
  (both verify paths run `check_revoked=True`, which is an accounts lookup, not an offline JWT check)
  is correct and independently confirmed by the Regression Tester. The forbidden-role guard in
  `check_private_bucket_config.py` is a real addition. **But the narrowing is declared, not applied**
  — see B-5.
- **The public deploy identity.** `hub-deploy` holds `firebasehosting.admin` and
  `serviceusage.apiKeysViewer` at project level, and `privateSyncWriter` on the private bucket. It
  **does** still hold private-bucket permission, because item 3 was never implemented. Nothing
  widened it; the split simply did not happen.
- **The private bucket's principal set.** Exactly two non-legacy principals, in exactly the asserted
  roles — `hub-gate@` → `privateObjectReader` (`storage.objects.get` only) and `hub-deploy@` →
  `privateSyncWriter`. Verified against the live policy. Nobody has "restored" the single-reader
  wording in code. The risk that they will is B-1: the ADR that would license it is still on the books.

The only thing in this wave that *looks* like a widening is the `X-Forwarded-Host` branch in B-3 —
and that is a widening of trust, accepted deliberately to avoid failing closed, then pinned by a test.

**2. Is every claim backed by evidence of the right kind?** Mostly yes, and the honesty level is high
— the Live Prober marked seven criteria "out of my scope" rather than backing them with local reads,
and the Boundary Tester declined to record a `kgis` probe that would have looked like a pass. The
gaps that matter: B-4 (guard over an empty set, on the wrong role, in a file nothing runs); B-5 (a
FAIL re-classified as resolved by a merge that cannot resolve it); S-4 (live criterion, config-only
check); N-3 and N-4 (guards that evaluate zero inputs or skip). One claim I checked because it was
load-bearing and locally-evidenced turned out **true** — N-2.

**3. Does any document now contradict a higher one?** Yes — B-1, and it is the same shape as Phase 3's
B-1 at a node that was missed. Plus the SEAM-1 self-contradiction, the design doc's `v0.5` header
against the delta's `v0.9`, its unchanged `Last updated`, the roadmap's Phase 3 "Blocked on §10 Q4
(open)" against its own §10 table recording Q4 answered twice, and Q6's promised ADR that does not
exist. The *direction* of this wave's amendments was right: the design doc was amended first and the
roadmap assumption retired downstream. That is the correct order and the opposite of B-1.

**4. Scope discipline.** Clean. See N-1. This is the first thing I have reviewed in this sprint with
no scope violation in it.

---

# On your dispositions

You asked me to assume you had missed more. Here is what I found.

**Wrong:** the check 4 disposition (B-5). Both halves.

**Incomplete, and blocking because of it:** there are **no dispositions at all** for the Security
Tester or the Skeptic Verifier in `STATE.md` §Wave 0 dispositions. The section's preamble says no
finding is closed by silence; ten handoffs are in and two are undispositioned, including the one that
returned `BLOCKED`.

**Not recorded:** issues **#56 and #57 appear nowhere in `STATE.md`, or anywhere under `llm/`.** #54
and #55 are both recorded, both against Red Team / Boundary findings. So of the four issues you filed
against the Security Tester's FAILs, two exist on GitHub and in no control-plane document. Also: #55's
record maps it to check 2 (a PASS), not to a FAIL — accurate, but it means the *mapping* from the
four FAILs to the four issues is not written down anywhere, which is what let B-5 pass unnoticed.

**A document the gate depends on does not exist.** Five Wave 0 contracts and one BLOCKED verdict bind
to "the run brief's §8". `STATE.md`'s only §8 heading is *merge sequencing*. The run brief itself is
not in the repository — the 2026-09-10 orchestration brief stops at §7. Every agent in this wave,
including me, has been enforcing a section none of us could read. I have applied the §8 rule as the
contracts state it (a single Security Tester FAIL blocks; an un-failable Skeptic guard blocks; an
undispositioned Red Team `succeeded` blocks). If that is not what the brief says, my §8 statement is
wrong in a way nobody can currently check. **Persist the run brief.**

**Right, and I checked:** the D-1 through D-6 acceptances; G-R1 and the resulting merge order (#48
before #47 — independently confirmed live: `/session/end` returns the *static site's* 404 through
Hosting, so the rewrite is genuinely absent from the deployed configuration); G-R5's rejection on its
premise; A-3 through A-11; the I-1 UBLA near-miss, which is correctly called the wave's most important
finding. Your five self-corrections are actually nine by my count, and A-3 — catching yourself having
narrowed a correct finding on partial evidence — is the one I would keep in the execution lessons.

**One reading I decline to overrule (§D).** The Skeptic Verifier asked to be overruled on U-1 and U-2
and I am not doing it. Both are unprovable *here* rather than unproven by omission; both streams
disclosed them; blocking merge would punish the disclosure and change nothing about the risk. U-1's
condition defaults to apply-enabled, so merging it reproduces today's behaviour exactly — the risk is
that it has never been *observed*, which merging does not worsen. Two conditions on that, though:
U-1's two-run proof must happen **before** Part C, not after, because Part C is unperformable without
it; and U-2's probes cannot run until #48 deploys, so the sign-out properties stay locally-proven
until then. Both block "done."

---

# Governance audit (L0), Wave 0 — verdict: DRIFTING

Foundations are strong: layout clean with zero two-plane violations and no `docs/superpowers/`
anywhere; `governance-checks` wired, required, and green 4/4; canon pin exact on both halves (CI
`851a50a` = `VERSION 0.9.0` = the `v0.9.0` commit); zero direct commits to `main` since adoption;
draft-first honored on all four PRs; L0 allowlist well-formed and proven by execution; Steward
correctly INACTIVE across delta, CODEOWNERS and PR history; full label taxonomy including all four
`gov-L*`.

| Item | Result |
|---|---|
| Delta freshness | **FAIL** (should-fix) — `Last updated: 2026-09-16`; §Related Repos still says `phd-milestones` is "to be created" when it exists, is private, and has published |
| Canon version pinning | **PASS** — note: canon is at v0.9.1; the v0.9.1 change (audit check 6) is already satisfied here, so the bump is routine |
| Repository layout / two-plane | **PASS** |
| ADR coverage | **PASS** — ADR-0012 is well-formed, correctly `Proposed`, index row matches |
| Orphan decisions | **FAIL** (see S-6) |
| Branch protection | **FAIL vs canon / PASS on delta honesty** — 3 canon rules unmet; the delta records each, with reasons, matching the live API in every particular |
| Label taxonomy | **PASS** |
| PR level declarations | **FAIL** (see S-5) |
| L0 allowlist format | **PASS** |
| Steward activation consistency | **PASS** |
| Governance checks wiring | **PASS** |
| Memory-bank currency | **FAIL** (see S-7) |
| Workflow compliance | **PASS** |
| Documentation standards | **FAIL** (note) — 8 files carry none of Status/Last-updated/Owner, including the orchestration brief and the ADR index; the delta itself lacks `Owner` |
| **Stale branches** | **PASS** |

**Stale branches, with both standing rules honored.** I ran `git fetch --all --prune` before judging —
it pruned one already-deleted ref — so nothing here is raised from memory. Remote state is eight live
refs. `delete_branch_on_merge` is `true` and working.

**`handoff/research-hub`: NOT flagged, and must never be.** Verified independently rather than taken
on trust: no PR ever existed with it as head; `git branch -r --contains` returns empty; exactly one
ref in the repository reaches its commit and that ref is local. Canon's own rule ("no PR at all →
never delete, because that destroys the only copy of work no review ever saw") agrees, so there is no
conflict to override. It holds the SHA an Incident A1 purge would need, and the owner declined the
purge — so it is the only remaining record of that SHA.

Six local branches are cleanup candidates (four merged with 0 commits ahead;
`fix/education-pool-count`'s extra commits are fully contained in `origin/fix/derive-education-assertion`,
which is open PR #5). Zero risk, zero urgency, owner's call. Two pre-adoption PRs (#3, #5, from
August) are open and untriaged.

**UNVERIFIABLE — recorded as such, not passed:**

| Item | What would verify it |
|---|---|
| Whether any past merge was made by an agent session or by the human owner | **Not verifiable in principle here.** All sessions authenticate as `djjay0131` with the owner's token; the platform cannot distinguish them. Needs a distinct machine identity. The delta records this and treats it as a substantive blocker to Steward activation — the right call. |
| Whether `governance-checks` passes against `main` specifically | I ran it against `admin/wave-0-preconditions` (the merge-gate state), because checkout is barred. `git worktree add` on a separate path, or CI's own run on `main`, would settle it. |
| Whether the `X-Forwarded-Host` branch is needed at all | Probe P6 against a deployed `/session/end`. Blocked until #48 deploys. |
| Whether `firebase_admin` needs `firebaseauth.configs.get` on first auth use | A live sign-in after apply. This is D-3's gate, and it is the reason B-5(a) matters. |
| Whether the destructive sync's bucket driver works | Its HTTP `list()` path has never executed. Part C, gated on U-1. |
| The run brief's actual §8 text | Persist the run brief. |

---

## Summary

Wave 0 did the hard part well. The narrowings are real, none of them was bought by widening something
else, and I confirmed the private bucket's principal set against the live policy rather than the
documents. Scope discipline was clean across four streams and 32 files — the first time this sprint.
The adversarial layer worked: three agents independently found the `roles/editor` exposure, the
Skeptic broke 44 of 46 guards and reported the two it could not, and the Dissenter was right five
times out of five.

What blocks is narrower than the volume of findings suggests. One ADR was left contradicted when
everything downstream of it was amended (B-1) — the same defect I raised in Phase 3, at a node nobody
checked. One guard asserts a string shape and goes red when the code improves (B-2). One security
check was widened to avoid failing closed, and then a test was written to keep it that way (B-3). One
new guard cannot fail (B-4). And one FAIL was marked resolved by a merge that cannot resolve it
(B-5) — which is the finding I would most want re-read, because it is the difference between a live
over-grant being tracked and being closed.

#48 I would merge today if anything could merge today. It is careful, its guard fails closed, it was
shown failing, and the one claim it could not verify I verified for it and it holds.

## Assumptions

1. The §8 rule is as the contracts state it, since the run brief is not in the repository.
2. Live probes describe the system at 2026-09-19, pre-merge; the serving SHA is `f98a928a` and no
   Wave 0 PR has deployed.
3. `gcloud` reads were made as the project owner, so they show the full policy; a lower-privileged
   reader would see less.
4. I read the four diffs in full, every Wave 0 contract and handoff, the design doc §5–§12, the
   roadmap, the delta and ADRs 0004–0012.
5. I did not run the gate or site suites; test *behaviour* claims rest on the Skeptic Verifier's
   break/restore transcripts, which are the strongest evidence in the wave. Where a claim was
   load-bearing I re-derived it directly instead (B-2, B-3, N-2, N-7).

## Recommendations

1. Amend ADR-0004 decision 4, list it in ADR-0010's Related Documents, fix the SEAM-1 diagram line,
   and correct the design doc's `v0.5` and `Last updated` lines. (#45)
2. Fix the alert-channel guard to assert the property, not the spelling, and **show it failing** —
   delete a `notification_channels` line, prove red, restore, prove green. (#47, before merge)
3. Decide the `X-Forwarded-Host` branch: narrow it, or keep it and mark its test as temporary with
   the retiring probe named in the test body. (#47)
4. Extend the private-bucket guard to `roles/editor` and `roles/owner`, **and** wire
   `check-private-bucket-iam.sh` into a job that runs. (#53, #55, #58)
5. Re-disposition Security check 4: record it as live, unresolved by merge, and gated on the D-3
   apply. Record #56 and #57 in `STATE.md`, and write the four-FAILs-to-four-issues mapping down.
6. Persist the run brief.
7. Write dispositions for the Security Tester and the Skeptic Verifier before #45 merges.
8. Label all four PRs `gov-L2`.
9. Write the five owed ADRs, or record an explicit owner deferral with a named milestone.
10. Sync the memory bank for #34–#43 plus Wave 0.
11. Record SD-4 as capability-delivered, defect-open, until something in `site/` calls `/session/end`.
12. Settle `private-sync` vs `hub-private-sync` before item 3 is built.

## Alternatives considered

- **Approving #53 and treating B-4 as should-fix.** Rejected. The wave's own most important finding
  (I-1) is that a check reporting success while demonstrating nothing is the defect class this sprint
  keeps paying for. Shipping a guard that cannot fail, in a file nothing runs, while the README
  describes it as the mitigation, is that defect with a fresh coat of paint.
- **Treating B-1 as should-fix.** Rejected for consistency: the identical finding was blocking in
  Phase 3, and the consequence — silently disabling withdrawal — has not got smaller.
- **Blocking on U-1/U-2.** Rejected; see §D. It would punish disclosure and change no risk.
- **Failing #48 on the per-tree exemption (N-3).** Rejected. The alternative was a red build on every
  pull request, the skip is loud and unsuppressible, and the deploy path always enforces.
- **Failing #47 outright on the missing sign-out UI.** Rejected. No contract assigned it; it is a
  seam failure, not a stream failure, and it belongs in the record rather than in a verdict against
  the stream that did its job.

## Risks

1. **The narrowing may never be applied.** D-3 gates it on a sign-in route proven to deliver; email
   delivery is suspect and Google sign-in is unconfigured (#31). `roles/firebaseauth.admin` on an
   `allUsers`-invoked service could sit indefinitely while #53 is marked merged.
2. **`roles/editor` activates silently.** The first Cloud Build, Cloud Function, or Cloud Run service
   created without an explicit identity runs as the default compute SA and inherits read/write/list
   on the private bucket. No guard would notice.
3. **Merging in the recorded order lands a red `main`** at step 3 (B-2).
4. **A red suite invites a deleted test.** B-3 sets that up deliberately-but-accidentally, and
   ADR-0011 names the consequence.
5. **The alerting chain still delivers nothing**, and #54 makes its metrics forgeable by anyone.
6. **`check:private-links` cannot see an off-origin `https://` link** (Skeptic F-1) — live now, and
   the satellite stream just spent Wave 0 removing exactly such a link.
7. **Branch protection does not bind the token.** With 0 required approvals and `enforce_admins:
   false`, this gate is procedural. It binds whoever chooses to be bound.

## Open questions

1. Where is the run brief, and does its §8 say what the contracts say it says?
2. Does the `X-Forwarded-Host` branch survive, and who runs P6 after #48 deploys?
3. Item 3: Wave 0b, or is the public deploy identity's private-bucket write accepted for longer?
4. Should the expected-source exemption be per-source rather than per-tree?
5. Who owns `firebase.json` in Wave 0b? SEAM-B8 omits it.
6. Does `agentic-kgis` get an ADR for the Q6 substitution the roadmap already promises?

## Related docs

`llm/sprints/2026-09-hub/handoffs/chief-reviewer-phase-3.md` (finding B-1, the precedent);
`llm/specs/2026-09-10-research-hub-design.md` §6, §12; `llm/governance/adr/0004`, `0005`, `0007`,
`0010`, `0011`, `0012`; `llm/master-roadmap.md` §phase-3-private-area; `llm/governance/governance-delta.md`;
`llm/sprints/2026-09-hub/contracts/phase-3-seams.md` SEAM-1; `private-by-default-seams.md` SEAM-B5, SEAM-B8;
`handoffs/site-wave-0.md` SEAM-10; `STATE.md` §Wave 0 dispositions, §8 merge sequencing;
issues #44, #49, #50, #54, #55, #56, #57.

## ADR candidates

1. **Predefined roles are narrowed to custom roles as a standing rule** — this is now the third
   (satellite, private bucket, gate auth). Consolidate rather than repeat the reasoning a fourth time.
2. **An automatic legacy bucket binding is part of the principal set** — "exactly two principals"
   means two *non-legacy*, and the ADR should say what the legacy four are and why they persist under
   UBLA, so the next reader does not rediscover it as a breach.
3. **The health path, as a decision** — `/_health`, not `/healthz`, with the interception recorded as
   **exact-path** (`/healthz/` reaches the container). It survived four revisions because nobody
   wrote it down, and the exact-path nuance would otherwise falsify the ADR on first test.
4. **The Origin-check rule for state-changing gate routes**, including what `SameSite=Lax` does not
   do and which header is authoritative once P6 settles it.
5. **Sign-out clears the cookie and does not revoke server-side** — an amendment to ADR-0004
   decision 2. It must never be described to the owner as "sign out everywhere."
6. **A guard asserts a property, never a spelling** — from B-2, with the rule that any guard which
   goes red on an improvement is itself the defect.
