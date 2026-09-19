UN-FAILABLE GUARDS: 2 — `PRIVATE_SYNC_PLAN_ONLY` (`.github/workflows/build.yml`), and `gate.yml`'s three sign-out smoke assertions.

# Handoff — `Skeptic Verifier`, Wave 0

Both are un-failable **here**, not vacuous: their subject is deployed behaviour, `vars.*`
and Cloud Run are server-side, and no local run can exercise either. Neither stream claimed
otherwise. **Every other guard in this wave was made to go red.**

Stream: `skeptic-verifier` · Wave 0 · Issue #44 (hub-007) · 2026-09-19
Contract: `llm/sprints/2026-09-hub/contracts/skeptic-verifier-wave-0.md`

> **§8 merge gate.** My reading: the two above do not block merge, because they are
> unprovable-by-construction rather than unproven-by-omission, and both streams said so in
> their own handoffs. They block **calling Wave 0 done**. The live probes must run.
>
> I found **no guard that reports success while proving nothing.** I did find one guard
> with a real coverage gap (F-1) and one class of test that goes quiet instead of red
> (F-2). Details below.

---

## Verdict table

| Guard | Where | Broke it how | Red? | Message useful? | Restored? |
|---|---|---|---|---|---|
| CSRF: `_same_origin` on `/session/end` | `gate/app/main.py` | `if not _same_origin(request):` → `if False:` | **YES** 20/43 failed | yes — names each spoofed origin | yes, 43 passed |
| CSRF, subtle half: absent `Origin` | same | `if not origin: return False` → `return True` | **YES** 4 failed | yes — the two `no_origin`/`empty` cases | yes |
| Cookie clear/mint parity | same | clear at `path="/p"` | **YES** 2 failed | yes — attribute-by-attribute diff | yes |
| No existence oracle | same | sign-out verifies the cookie | **YES** 2 failed | yes — "sign-out inspected the session" | yes |
| Sign-out touches no bucket | same | `deps.store.fetch("index.html")` | **YES** 2 failed | yes | yes |
| `event=allow scope=signout` | same | line deleted | **YES** 2 failed | yes | yes |
| `event=deny … reason=cross_origin` | same | rewritten in a second grammar | **YES** 2 failed | yes — pins the grammar | yes |
| `Cache-Control: private, no-store` | same | `/session/end` exempted from middleware | **YES** 4 failed | yes | yes |
| `X-Forwarded-Host` accepted | same | branch deleted | **YES** 1 failed | yes | yes |
| POST-only sign-out | same | `@app.get("/session/end")` added | **YES** 2 failed | yes | yes |
| Health path is `/_health`, not `/healthz` | `test_monitoring_contract.py`, `test_scope.py` | route moved to `/healthz` | **YES** 4 failed (full suite) | yes — names Google's frontend | yes, 269 passed |
| Uptime check probes the served path | `test_monitoring_contract.py` | `monitoring.tf` → `/_healthz` | **YES** 1 failed | yes | yes |
| Smoke test probes the served path | same | `gate.yml` → `/healthz` | **YES** 1 failed | yes — "the defect that survived four revisions" | yes |
| Gate logging actually configured | `test_logging_config.py` + this wave's `event=` guards | `logger.addHandler()` removed | **YES** 9 failed | yes | yes |
| — the same break, seen by `caplog` | `test_client_events.py` | identical break | **NO — 8 passed** | **F-2** | n/a |
| Required-source: `phd-milestones` required | `content.config.ts` build | prefix moved away | **YES** build exit 1 | yes — "FAULT, not a withdrawal … Found: cv" | yes |
| — the private build too | `npm run build:private` | same tree | **YES** | yes — blocks before the receipt is written | yes |
| `required: true` is pinned by test | `content.config.test.ts` | flipped back to `false` | **YES** 7 failed | yes | yes, 56 passed |
| Provenance marker fails **closed** | `hub-content.mjs` | absent marker → exempt | **YES** 6 failed | yes — "fail-closed" named | yes |
| Marker rewritten every sync | `sync-content.test.ts` | marker written with stale values | **YES** 2 failed | yes | yes, 15 passed |
| Destination rebuilt from scratch | same | `rm -rf "$DEST"` disabled | **YES** 1 failed | yes | yes |
| Leak check — file **contents** | `check:no-private-in-public` | private qualified-id planted in `dist-public/index.html` | **YES** exit 1, 9 findings | yes — quotes the offending span | yes |
| Leak check — **paths** | same | `dist-public/phd/phd-milestones/milestones/` created | **YES** exit 1 | yes | yes |
| Private links resolve | `check:private-links` | linked payload file deleted | **YES** exit 1 | yes — "points at nothing" | yes |
| Private links start with `/p/` | same | one `/p/` → `/phd/` | **YES** exit 1 | yes — cites issue #27 | yes |
| — off-origin `https://` link | same | `href="https://evil.invalid/x"` | **NO — PASS** | **F-1** | yes |
| Exec-bit guard reads the **index** | `build.yml` | index mode `-x`, filesystem left 0755 | **YES** exit 1 | yes — exact `git update-index` fix | yes |
| — and *not* the filesystem | same | filesystem 0644, index left 100755 | **stays green (correct)** | n/a | yes |
| Exec-bit rule A (`*.sh` shebang) | same | `seed-members.sh` → 100644 | **YES** | yes | yes |
| Exec-bit rule B (direct invocation) | same | `fetch-data.sh` → 100644 | **YES** | yes — names the call site | yes |
| Exec-bit rule C (interpreted module) | same | `sync-private.mjs` → 100755 | **YES** | yes — "an executable bit here is a false signal" | yes |
| Satellite: UBLA on content bucket | `build.yml` | `storage.tf:87` → `false` | **YES** exit 1 | yes — "fails OPEN with no error anywhere" | yes |
| Satellite: UBLA on private bucket | same | `private-bucket.tf:79` → `false` | **YES** both guards fire | yes | yes |
| — the infra stream's own near-miss | same | **comment** at `storage.tf:15` → `false` | **stays green (correct)** | n/a — guard strips comments | yes |
| Satellite: no predefined role | same | bound to `roles/storage.objectViewer` | **YES** | yes — ADR-0007 decision 4 | yes |
| Satellite: role holds exactly 3 perms | same | `storage.objects.list` added | **YES** | yes — prints got vs want | yes |
| Satellite: prefix `condition` present | same | condition block removed | **YES** | yes | yes |
| Satellite: the binding still exists | same | service account renamed away | **YES** | yes — "this guard is now asserting nothing" | yes |
| Gate role = exactly 2 permissions | `check_private_bucket_config.py` | `users.delete` added | **YES** | yes | yes |
| No predefined auth role for the gate | same | `roles/firebaseauth.admin` re-added | **YES** | yes | yes |
| Gate custom role is declared | same | resource renamed | **YES** | yes | yes |
| No `allUsers` on the private bucket | same | `allUsers` binding added | **YES** | yes | yes |
| `public_access_prevention = enforced` | same | → `inherited` | **YES** | yes | yes |
| `roles/viewer` on the project | `check-private-bucket-iam.sh` | stubbed `gcloud` returns one Viewer | **YES** exit 1 | yes — "READ EVERY PRIVATE OBJECT" | yes |
| `PRIVATE_SYNC_PLAN_ONLY` kill switch | `build.yml` | — | **CANNOT — see U-1** | n/a | n/a |
| `gate.yml` sign-out smoke assertions | `gate.yml` | — | **CANNOT — see U-2** | n/a | n/a |

Method: never a checkout. Each branch was `git archive`'d into the scratchpad; the exec-bit
and satellite guards were **extracted from `build.yml` by YAML parse and executed**, so the
bytes I ran are the bytes CI runs. Mode tests ran in a throwaway `git init` repo in `/tmp`,
where modes are real. The project index was never touched.

---

## The two un-failable guards

### U-1 — `PRIVATE_SYNC_PLAN_ONLY`, the kill switch on the destructive private sync

`.github/workflows/build.yml:1215` — `if: vars.PRIVATE_SYNC_PLAN_ONLY != 'true'` on
`Sync the private output, pruning what this build did not produce`.

GitHub evaluates `vars.*` server-side. There is no local runner here, `act` is unavailable,
and `actionlint` validates the expression's **syntax**, not its behaviour. I could not make
it fail, and **nothing in the repository would notice if that line were deleted or
inverted.** A deleted line silently restores the pre-Wave-0 behaviour (plan and apply
consecutive, delete list readable only after the delete); an inverted line silently stops
the private area updating while withdrawn content keeps being served.

The infra stream recorded this honestly — "this one cannot be done locally" — and supplied
the exact `gh` commands. I am not contradicting it; I am recording that **the guard has
never been observed to work**, which is the same epistemic position the leak check was in
before Checkpoint 4. It guards the one mechanism ADR-0010's own Risks call "the one place in
this system where a build defect can remove data."

The two-run proof in the infra handoff (§Kill switch) is the only evidence that will settle
it. Run it before Part C, not after.

### U-2 — `gate.yml`'s three sign-out smoke assertions

`.github/workflows/gate.yml:+218–246` — the `Set-Cookie … max-age=0` check, the
`403` on a cross-origin POST, and the health-path curl. Every one is a property of a
deployed revision behind Google's frontend. B8-equivalents pass locally and prove nothing
about it: that is the `/healthz` defect's whole shape, and it survived four revisions
precisely because the local run was green.

The gate handoff's probes P1–P7 are correct and sufficient. **P2, the `/healthz` control,
is the one that must not be skipped** — without it P1's result is not discriminating.

Neither U-1 nor U-2 is a vacuous guard. Both are guards whose subject is remote. I report
them because the contract asks me to say so plainly rather than treat absence of proof as a
pass.

---

## Findings

### F-1 — `check:private-links` cannot see an off-origin link, and the wave now leans on it

Not this wave's code, but this wave's fixture is what gives it anything to inspect, and the
roadmap counts it. Its regex is `/(?:href|src)="(\/[^"]*)"/g` — **it only matches links
beginning with `/`.** Tested one shape at a time, against a real private build of 5 pages:

```
Shape 1: <img src="//evil.invalid/y.png">        -> RED, exit 1   (starts with "/", caught)
Shape 2: <a href="https://evil.invalid/x">       -> GREEN, exit 0  <-- INVISIBLE
Shape 3: <a href="../../elsewhere/">             -> GREEN, exit 0  <-- INVISIBLE
```

The guard's own error text says "a link outside `/p/` reaches the PUBLIC origin and 404s for
a signed-in member." An absolute off-origin URL is the *strongest* form of that, and it
passes. Its real subject — issue #27's uniformly-unprefixed root-absolute links — **is**
caught, so this is a coverage gap, not a vacuous guard. It matters now because the private
pages are authored in another repository and the satellite stream has just spent Wave 0
removing an off-origin `<link>` from exactly these pages (H-5). The guard that would have
caught that regression does not look at that shape.

One-line fix: match `(?:href|src)="([^"]*)"` and treat any value that is not relative and
does not start with `BASE` as bad. Not mine to make.

### F-2 — `caplog` blindness confirmed, and it is confined to `test_client_events.py`

The contract asked me to confirm the gate stream's B7 independently and to check whether any
*other* test has the same blindness. I removed `logger.addHandler(handler)` from
`_configure_logging()` — 21 call sites discarded, production's real state for four
revisions — and ran the whole suite:

```
GREEN — logger correctly configured
  tests/test_client_events.py  : 8 passed, 2 warnings in 0.29s
  tests/test_logging_config.py : 7 passed, 2 warnings in 0.27s
  tests/test_signout.py        : 43 passed, 2 warnings in 0.56s
  FULL SUITE                   : 269 passed, 2 warnings in 1.86s

RED-EXPECTED — logger.addHandler(handler) removed
  tests/test_client_events.py  : 8 passed, 2 warnings in 0.28s        <-- BLIND
  tests/test_logging_config.py : 4 failed, 3 passed, 2 warnings in 0.32s
  tests/test_signout.py        : 6 failed, 37 passed, 2 warnings in 0.58s
  FULL SUITE                   : 9 failed, 260 passed, 2 warnings in 2.01s

  the four caplog assertions, one at a time:
    test_redacts_secrets_by_key                    1 passed
    test_cannot_forge_log_lines_with_newlines      1 passed
    test_emits_the_string_the_metric_filters_on    1 passed
    test_caps_the_number_of_events_it_will_log     1 passed

RESTORED
  FULL SUITE                   : 269 passed, 2 warnings in 1.84s
```

**Scope of the blindness, which is the part that was not yet established.** `caplog` appears
in three files. `test_signout.py` mentions it only in prose explaining why it is not used.
`test_logging_config.py` asserts the property directly and catches the break. **Only
`test_client_events.py` is blind, and exactly its four `caplog` assertions are.** Two of
them —`test_emits_the_string_the_metric_filters_on` and `test_redacts_secrets_by_key` —
defend `infra/monitoring.tf`'s log-based metric and the redaction of an unauthenticated
endpoint's input. Both would have reported success throughout the 48 hours in which neither
could possibly have worked.

This wave did not introduce it and did not make it worse. The gate stream's new guards are
built the right way. It is four assertions, and the fix is the pattern already sitting in
`test_signout.py::_through_the_gates_own_handler`.

### F-3 — four contract assertions **skip** instead of failing when their input disappears

`test_monitoring_contract.py`'s file-reading tests are `@pytest.mark.skipif(not
MONITORING.exists(), …)`. Remove the files and the suite stays green:

```
$ pytest tests/test_monitoring_contract.py        # infra/monitoring.tf and gate.yml absent
SKIPPED [2] tests/test_monitoring_contract.py:52: infra/monitoring.tf not present
SKIPPED [1] tests/test_monitoring_contract.py:82: infra/monitoring.tf not present
SKIPPED [1] tests/test_monitoring_contract.py:92: .github/workflows/gate.yml not present
SKIPPED [1] tests/test_monitoring_contract.py:102: infra/monitoring.tf not present
3 passed, 4 skipped, 2 warnings in 0.28s
$ pytest                                           # the whole suite
265 passed, 4 skipped, 2 warnings in 2.29s        <-- exit 0
```

Both files are always present in a CI checkout, so this is latent, not active — I checked,
and the gate job does a full checkout. But the failure mode is the sprint's signature one:
the *deletion* of `infra/monitoring.tf`, which is the loudest possible version of this
cross-stream contract breaking, turns the guard off rather than red. The idiom was inherited,
not invented this wave. `assert MONITORING.exists()` is the fix.

### F-4 — guards whose input set is empty, and what each actually saw

The contract's trap 2. For every guard, what was in front of it when it passed:

| Guard | Input set when it passed | Verdict |
|---|---|---|
| `check:no-private-in-public` | **2 private items, 157 files scanned** | real. Was inert at Checkpoint 3; is not now |
| `check:private-links` | **5 pages** with real routes and payload URLs | real. Was 1 page before the fixture; is not now |
| exec-bit guard | 13 shebang files; **rule B finds 3 genuine direct invocations** | real, in both directions |
| satellite guard | 1 satellite binding, 2 buckets, 1 custom role | real |
| `check_private_bucket_config.py` | 2 declared bindings + the new gate role | real |
| `roles/viewer` guard | **EMPTY — `cusati-hub` has no `roles/viewer` binding** | passes trivially today |
| `PRIVATE_SYNC_PLAN_ONLY` | — never executed anywhere | U-1 |

The `roles/viewer` guard is the honest one to flag, and the infra handoff already does:
today it asserts over the empty set. I stubbed `gcloud` locally and confirmed it does fire
when the set is non-empty, so it is not vacuous — it is correct and currently unexercised:

```
GREEN: OK: no principal holds roles/viewer on cusati-hub, so projectViewer expands to
           the empty set and the legacy reader bindings grant nobody anything          rc=0
RED:   FAIL: the following principals hold roles/viewer on cusati-hub and can therefore
           READ EVERY PRIVATE OBJECT in gs://cusati-hub-private through the automatic
           legacyObjectReader binding:
               user:colleague@example.com                                               rc=1
```

### F-5 — I reproduced the infra stream's own near-miss, and then nearly repeated it

Two results in this report were **green when I expected red**, and both were my test's fault,
not the guard's. Recording them because that is the lesson of the wave.

**(a) The comment at `storage.tf:15`.** Setting the *comment* line to `false` leaves the
satellite guard green — correctly, because the guard strips comments before matching, and
the real resource line is at `:87`. I confirmed the real line goes red on both buckets. The
infra stream's account of its near-miss is accurate.

**(b) My own, on the most important gate assertion.** My first attempt at the existence
oracle anchored on `response = JSONResponse({"status": "ok"}, status_code=200)` — which
occurs **twice** in `main.py` (line 296, the mint path; line 339, sign-out). `.replace(…, 1)`
patched the mint path. Result: `43 passed`. I was one step from reporting the oracle guard
un-failable. Re-anchored uniquely on the sign-out clear:

```
$ grep -c 'response = JSONResponse({"status": "ok"}, status_code=200)' app/main.py
2
--- RED (anchored uniquely on the sign-out path)
test_signout.py: 2 failed, 41 passed, 2 warnings in 0.54s
FAILED tests/test_signout.py::test_the_answer_is_identical_whether_or_not_a_session_existed[hosting]
FAILED tests/test_signout.py::test_the_answer_is_identical_whether_or_not_a_session_existed[direct]
--- RESTORED
43 passed, 2 warnings in 0.50s
```

**Every green in this report was re-tested with a uniqueness assertion on the anchor.** That
is now `assert s.count(old) == 1` in each driver. The general rule: a verification that
mutates source must prove the mutation landed where it meant to, or its green means nothing —
which is the fourth instance this sprint of that exact failure and the second in this document.

---

## Claims I was asked to verify rather than accept

**"11 tests added, none weakened" (site).** Verified by name, not by count. Main and branch
test-name sets diffed:

```
main: 200   branch: 211
PRESENT ON main, ABSENT ON BRANCH (3):
  - … FAILS loadSources when a required source's whole prefix is gone
  - … declares both satellites, with phd-milestones not yet required
  - … reports a required source whose prefix is absent
ADDED ON BRANCH (14): [5 in the expected-source describe, 3 in sync-content, 6 in the
                       new "applies to trees that could be complete" describe]
```

All three removals are **renamed supersets** of themselves — `… gone` became `… gone (cv)`
plus a new `… when the PRIVATE source's whole prefix is gone`; `reports a required source`
became `reports EVERY required source`. Net +11, as claimed. No assertion was deleted to
make work pass.

The one real edit to an existing test is `PARTIAL_TREE` spread into six `loadSources` cases,
which exempts those trees from the expected-source check. That could have hollowed them out,
so I checked directly: disabling `manifestSchema.safeParse` turns **12** of those tests red.
They still fail for their own reason. Claim upheld.

**"223 before, 269 after" (gate).** Confirmed: 223 collected on `main`, 269 on the branch,
`test_signout.py` contributing exactly 43. `main` has no `test_signout.py` and its
`test_monitoring_contract.py` does not mention `_health` at all.

**"210 passed | 1 skipped" (site).** Confirmed — *but only after `npm run content:fixture`*.
On a bare checkout the same suite reports **202 passed | 9 skipped**: `cv-data.test.ts`,
`bib.test.ts` and `route-inventory.test.ts` skip themselves when no content tree exists. I
checked the CI ordering and both `build` and `build-firebase` sync content before `npm test`,
so the skips do not happen there. Worth knowing that the number is environment-dependent.

**Exec-bit guard and the eight `.mjs` shebang files.** Confirmed exactly eight, none flagged:
`contract/validate-manifest.mjs`, `check-no-private-in-public.mjs`, `check-smoke-routes.mjs`,
`contrast.mjs`, `demo-leak-check.mjs`, `generate-redirect-map.mjs`, `stage-public-assets.mjs`,
`sync-private.mjs`. The guard classifies `tool.mjs`-style direct invocation and
`module.mjs`-style import oppositely, as designed.

**Roadmap-truth spot-checks (credential-free only).** S2 (269 passed) ✓. S9
(`check:no-private-in-public` in both deploy variants — `build.yml:833` and `:953`) ✓. S8
(`build:private` = `HUB_OUTPUT=private SITE_BASE=/p/`) ✓. S11 (four literal rewrites, now
including `/session/end`) ✓. **S10's "qualified" is understated**: no workflow references
`check-private-bucket-iam.sh` at all — `build.yml` names it only in a comment at `:512`. The
live half of the bucket-IAM criterion runs nowhere automatically, exactly as the roadmap-truth
handoff says. Every remaining criterion is a live-probe claim I hold no credential to check,
and I did not substitute anything for one.

---

## Summary

Every guard this wave adds or changes, except the two remote-subject ones, was run green,
broken, shown red with a message that named the real problem, restored, and shown green
again — more than forty break/restore cycles across three branches, every one of them
followed by a diff against the pristine original.

The specific worry that created this role — a guard that reports success while proving
nothing — **I did not find in this wave's new work.** The leak check now has 2 private items
and 157 files in front of it and fails on both contents and paths; the private-link check now
has 5 real pages; the gate's new `event=` guards assert through the gate's own handler and go
red the moment the handler is gone; the exec-bit guard demonstrably reads the index and not
the filesystem; the satellite guard fires on all five widenings including the two the old
guard could not see.

What I did find is one guard with a coverage gap (F-1), one pre-existing set of four blind
`caplog` assertions (F-2), four assertions that skip instead of failing (F-3), one guard
asserting over an empty set (F-4), and two guards that cannot be exercised anywhere but
production (U-1, U-2). None of the last three is this wave's doing; all five are now written
down with a reproduction.

## Assumptions

1. Every branch was read via `git archive` into the scratchpad. No branch was checked out; the
   shared worktree was read-only to me throughout.
2. `gate/.venv` belongs to the shared worktree and was briefly missing `pytest` mid-session
   while another agent worked. Results here are from runs where it was intact, and the two
   independent full-suite greens (269) bracket every break.
3. The gate suite's `pyproject.toml` sets `addopts = "-q"`; passing `-q` again makes `-qq`,
   which **suppresses the summary line entirely**. Transcripts here use
   `-o addopts="--strict-markers"` to restore it. Anyone reading a pytest transcript from this
   repo that has no `N passed` line is reading a `-qq` run, not a broken one.
4. `/mnt/c/code/phd-milestones` was read only. Its one untracked file
   (`withdrawal-proof.patch`) is the satellite stream's deliverable, not mine.
5. `check-private-bucket-iam.sh` was exercised against a local `gcloud` stub emitting canned
   policies. That proves the script's logic, not the live policy.

## Recommendations

1. **Run U-1's two-run proof before Part C**, not after. The withdrawal proof depends on the
   kill switch working, and the kill switch has never been observed to work.
2. **Run the gate's P1–P7 including P2**, the `/healthz` control. Without the control, P1
   proves nothing.
3. **Fix F-1 with one regex.** The guard that should have caught the satellite's off-origin
   `<link>` cannot see that shape, in the same wave that removed one.
4. **Rewrite the four `caplog` assertions** in `test_client_events.py` using
   `_through_the_gates_own_handler`. Small, and it closes the sprint's signature defect
   completely rather than nearly.
5. **Turn F-3's four `skipif`s into `assert …exists()`.** A missing cross-stream file should
   be the loudest possible failure, not a skip.
6. **Promote `leak-check-self-test` to required** (STATE S-4). It now has 2 private items to
   prove something about and still gates nothing.
7. **Record F-5's rule** in the execution-lessons file: a verification that mutates source
   must assert its anchor is unique. Three agents have now hit this in one sprint.

## Alternatives considered

- **Running the guards in the shared worktree.** Rejected: six agents are reading it, and
  mode tests would have mutated a shared index. `git archive` + a throwaway `git init` in
  `/tmp` gives real modes and no blast radius.
- **Paraphrasing the CI guards into standalone scripts.** Rejected — a paraphrase is not the
  guard. Both were extracted from `build.yml` by YAML parse and executed verbatim.
- **Reporting `roles/viewer` as un-failable because its live input set is empty.** Rejected:
  a stub proved it fires. "Correct and currently unexercised" is the accurate description.
- **Treating U-1 and U-2 as merge blockers.** Considered seriously, and set out above so the
  Lead Architect can overrule me. They are unprovable by construction and both streams
  disclosed them; blocking merge would punish honesty and change nothing about the risk.
- **Using `act` for U-1.** Not available in this environment, and it would not evaluate
  `vars.*` the way GitHub does anyway.

## Risks

1. **U-1 is the highest-consequence unverified thing in the wave.** It guards the only
   mechanism that can delete data.
2. **F-1 is live now.** The private pages moved their fonts on-origin this wave; nothing
   automated would catch them moving back.
3. **F-2's two metric-facing assertions** still report success independently of whether the
   gate can log. `infra/monitoring.tf`'s sign-in alert depends on the string one of them
   defends.
4. **F-3 means deleting `infra/monitoring.tf` is a quiet change**, and SEAM-10 is about to
   move things around in `infra/**`.
5. **My own coverage is bounded by what the handoffs claim.** I tested the guards they name.
   A guard nobody mentioned is a guard I did not break.
6. **Nothing here is evidence about production.** Every transcript is local. That is the
   entire point of U-1 and U-2.

## Open questions

1. **Does the Lead Architect accept U-1 and U-2 as non-blocking?** My §8 reading is above and
   is the one thing in this report I would most like overruled if I have it wrong.
2. **Is F-1 in scope for Wave 0 or the next one?** It is a one-line regex change to a file no
   stream owns this wave.
3. **Should the `roles/viewer` guard run anywhere automatically?** Today it lives only in a
   script nothing invokes (see S10). Its value is entirely in being run at the moment someone
   grants Viewer — which is exactly when nobody will think to run it.
4. **Should `check:private-links` also assert a minimum page count?** It silently inspected
   one page for an entire phase. A floor would have caught that.

## Related docs

- `llm/sprints/2026-09-hub/contracts/skeptic-verifier-wave-0.md` — this contract
- `llm/sprints/2026-09-hub/handoffs/gate-wave-0.md` §Validation B7 — independently confirmed
- `llm/sprints/2026-09-hub/handoffs/site-wave-0.md` §Validation — the +11 claim, upheld
- `llm/sprints/2026-09-hub/handoffs/infra-wave-0.md` §Kill switch, §Guard transcripts — the
  near-miss, reproduced
- `llm/sprints/2026-09-hub/handoffs/roadmap-truth-wave-0.md` — S10, which understates itself
- `llm/sprints/2026-09-hub/STATE.md` §The gate's structured logging never worked in production
- `llm/governance/adr/0005-…`, `0007-…` d4/d8, `0010-…` d2/d3/d4/d5, `0011-…`

## ADR candidates

1. **"A guard is not accepted until it has been observed failing."** This role exists because
   four guards reported success while proving nothing. The rule that would have caught all
   four is one sentence, and it belongs in governance rather than in a fifth agent's contract.
2. **"A verification that mutates source must assert its anchor is unique."** F-5, hit by two
   agents in two days. Cheap, mechanical, and the direct cause of a near-miss on this wave's
   most important assertion.
3. **"Assert, do not skip, on a missing cross-stream file."** F-3. The `skipif` idiom is
   spreading through `test_monitoring_contract.py`, and it converts the loudest failure into
   silence.
4. **"A guard whose subject is deployed behaviour is not evidence until it has run there."**
   U-1 and U-2, and the `/healthz` defect that survived four green local suites.

---

## Repository hygiene

**The project worktree is clean, and I verified it.**

```
$ cd /mnt/c/code/website
$ git status --porcelain
(empty)
$ git -c core.fileMode=false diff --cached --name-only
(empty)
$ git branch --show-current
admin/wave-0-preconditions
```

No branch was checked out. No commit, branch, push, stash, tag or `gh` mutation. No cloud
call of any kind — the only `gcloud` invoked was a local stub in the scratchpad that emits
canned JSON and has no network path. No live bucket, Firestore document or deployed revision
was touched. Every file I broke was a scratchpad copy; each was diffed against its pristine
original after restore, and all matched.

No private slug, title, summary or byte is quoted here: every site transcript was produced
against `site/fixtures/content`, whose two private items are committed fixture values. No
secret, token or key appears in this document.
