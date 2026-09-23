BLOCKED

# Security Tester — Wave 0, re-run

Issued: 2026-09-18 · Re-run: 2026-09-21 · Contract: `contracts/security-tester-wave-0.md` (with its two dated
corrections) · Issue #44 (hub-007)
Branches under review: **#47** `feat/gate-signout` (`3f1a58a`), **#48** `feat/site-wave-0` (`ab70dde`),
**#53** `feat/infra-wave-0` (`e776df3`).
Method: `git diff main...<branch>` / `git archive <branch> | tar -x` into scratch only. **No branch was checked out.
No git, `gh` or cloud mutation was made.** The worktree stayed on `admin/wave-0-preconditions`; `git status --short`
is empty.

**Independence.** I authored nothing under review. The only file I wrote in the repository is this handoff.

---

## Verdict table

| # | Check | Previous | Now |
|---|---|---|---|
| 1 | Private content never on the public path | PASS | **PASS** |
| 2 | Private bucket | PASS | **PASS** (finding S-1 is now a *live* red) |
| 3 | The gate | **FAIL** | **PASS** — all three bypass spellings closed, fails closed when unset |
| 4 | Identity | **FAIL** | **FAIL** — `roles/firebaseauth.admin` still bound live; merging changes nothing |
| 5 | Firestore | PASS + NOT TESTED | **PASS** (ruleset) + **NOT TESTED** (signed-in stranger) |
| 6 | Supply chain | **FAIL** | **FAIL** — 1 critical + 1 high remain; satellite SHA pinning unchanged |
| 7 | Static public site | **FAIL** | **FAIL** — ADR-0013 is Proposed, on an unmerged branch, and §8 is unamended |
| 8 | Cost | PASS | **PASS** |
| 9 | Logging | PASS | **PASS** (S-4 unchanged; #54 fix not yet in production) |
| 10 | Repos | PASS | **PASS** |

**Three FAILs remain (4, 6, 7). Check 3 is genuinely closed. Under the run brief §8 this still blocks every merge in
Wave 0.**

Of the four previous FAILs: **check 3 is closed**, checks **4, 6 and 7 are not**. Nothing regressed.

---

## 3. The gate — FAIL → **PASS**

### The accepted-origin set no longer comes from the request

`_same_origin()` now reads **one** header. Proof that it reads no host header at all — every `headers.get` call in
the branch's `main.py`:

```
$ git show feat/gate-signout:gate/app/main.py | grep -n "headers.get"
301:        declared = request.headers.get("content-length")
485:        declared = request.headers.get("content-length")
624:    origin = parse_origin(request.headers.get("origin", ""))
```

The only other appearances of `host` or `forwarded` anywhere in the file are inside comments (lines 13-18, 585-588,
636). The accepted set is built in `app/config.py` from `GATE_ALLOWED_ORIGINS` by the same `parse_origin()` that
parses the incoming header, so the two ends cannot disagree.

### All three spellings re-run over real HTTP

Against **#47's code served by uvicorn on a real socket** (not TestClient), with `GATE_ALLOWED_ORIGINS` carrying both
origins the gate answers on:

```
  evil Origin + forged X-Forwarded-Host         -> status=403 set-cookie-count=0
  evil Origin + X-Forwarded-Host comma list     -> status=403 set-cookie-count=0
  evil Origin + forged Host                     -> status=403 set-cookie-count=0
  CONTROL honest same-origin jason.cusati.us    -> status=200 set-cookie-count=1
  CONTROL honest same-origin run.app            -> status=200 set-cookie-count=1
  no Origin header at all                       -> status=403 set-cookie-count=0
```

All three previously-successful bypasses are refused, with **no `Set-Cookie` on any refusal**, and both honest
transports still work. The log agrees:

```
    INFO gate event=boot logging=StreamHandler(stdout) allowed_origins=https://hub-gate-abcdef1234-ue.a.run.app,https://jason.cusati.us
    INFO gate event=deny scope=signout reason=cross_origin   (x3)
    INFO gate event=allow scope=signout                      (x2)
```

### It fails closed when the variable is unset

Same harness, `allowed_origins` empty — including the honest same-origin control, which is the direction that matters:

```
  evil Origin + forged X-Forwarded-Host         -> status=403 set-cookie-count=0
  evil Origin + X-Forwarded-Host comma list     -> status=403 set-cookie-count=0
  evil Origin + forged Host                     -> status=403 set-cookie-count=0
  CONTROL honest same-origin jason.cusati.us    -> status=403 set-cookie-count=0
  CONTROL honest same-origin run.app            -> status=403 set-cookie-count=0
```

```
    INFO  gate event=boot logging=StreamHandler(stdout) allowed_origins=none
    ERROR gate event=misconfigured setting=GATE_ALLOWED_ORIGINS effect=signout_refuses_every_request
    ERROR gate event=deny scope=signout reason=no_allowed_origins_configured setting=GATE_ALLOWED_ORIGINS
```

**No fallback to header comparison.** It refuses everything, says so at ERROR twice (boot and per request), and
`gate.yml`'s deploy smoke test asserts a same-origin sign-out returns 200 — so an unset variable fails the deploy
rather than silently disarming the check.

### The bypass-asserting test was replaced, and I confirmed the replacement is load-bearing **by name**

The old test `test_the_site_domain_is_recognised_when_it_arrives_in_x_forwarded_host` (present at `d5b8d06`, which
*asserted* the bypass) is gone. In its place, a parametrised test over all three spellings plus a control.

I asserted the anchor was unique before breaking on it, reintroduced the header-derived bypass, and confirmed the
**specific** cases that went red:

```
anchor count = 1
REINTRODUCED the header-derived bypass (1 occurrence)

BROKEN TREE: {'errors':'0','failures':'3','skipped':'5','tests':'295'}
   FAILED: tests.test_signout :: test_an_unaccepted_origin_is_refused_however_it_spells_its_host_headers[forged-x-forwarded-host]
   FAILED: tests.test_signout :: test_an_unaccepted_origin_is_refused_however_it_spells_its_host_headers[x-forwarded-host-comma-list]
   FAILED: tests.test_signout :: test_an_unaccepted_origin_is_refused_however_it_spells_its_host_headers[forged-host]
```

Exactly the three cases, and nothing else. Clean tree: **295 tests, 0 failures**. The named tests genuinely exist and
execute (counted from the junit-xml, because `pytest -q` emits no summary line under this repo's `addopts` and my
first three attempts to measure with `grep`/`-k` reported nothing at all — see Assumptions):

```
  test_an_unaccepted_origin_is_refused_however_it_spells_its_host_headers: 4 case(s)
  test_an_accepted_origin_is_accepted_whatever_the_host_headers_say: 1 case
  test_sign_out_refuses_every_request_when_no_origin_is_configured: 2 case(s) [hosting, direct]
  test_the_boot_log_names_the_accepted_origins_and_shouts_when_there_are_none: 1 case
```

### Nothing else about the gate regressed

Traversal, `--path-as-is`, as a signed-in member so the path validator answers:

```
  /p/phd/milestones/index.html                  -> 200 26
  /p/../index.html                              -> 404 329
  /p/..%2findex.html                            -> 404 329
  /p/..%252findex.html                          -> 404 329
  /p/%2e%2e%2fphd/milestones/index.html         -> 404 329
  /p/a%00.html                                  -> 404 329
  /p/%c0%ae%c0%ae/index.html                    -> 404 329
  /p/PHD/MILESTONES/INDEX.HTML                  -> 404 329
  /p//phd/milestones/index.html                 -> 404 329
  /p/phd//milestones/index.html                 -> 404 329
  /p/phd/./milestones/index.html                -> 404 329
  /p/../../../etc/passwd                        -> 404 329
  /p/back\slash.html                            -> 404 329
```

…refused by the allowlist, not by accident (`reason=dot_segment` x5, `illegal_character` x2, `nul_byte`,
`absolute_path`, `empty_segment`, `backslash`). Cookie clear carries every attribute the mint path sets:

```
  set-cookie: __session=""; HttpOnly; Max-Age=0; Path=/; SameSite=lax; Secure
  cache-control: private, no-store
```

No existence oracle: signed-out, a real and an absent path return byte-identical bodies (`cmp` → identical, 426
bytes, `<html lang="en">` quoted).

**Live, both transports, per the corrected 426-byte guidance — attributed by the container log line, not by size:**

```
--- https://jason.cusati.us                  --- https://hub-gate-ywkmredngq-ue.a.run.app
  /p/                -> 404 426                /p/                -> 404 426
  /p/index.html      -> 404 426                /p/index.html      -> 404 426
  /p/nonexistent-xyz/-> 404 426                /p/nonexistent-xyz/-> 404 426
  cache-control: private, no-store             cache-control: private, no-store
```

and the matching container lines, 12 of them, one per probe:

```
INFO gate event=deny scope=private stage=session reason=no_session_cookie
```

**Caveat, labelled.** `/session/end` is still **not deployed** — the live revision is `hub-gate-00005-n4g`
(2026-09-18) and its env block carries only `GOOGLE_CLOUD_PROJECT` and `GATE_PRIVATE_BUCKET`. So the sign-out
evidence above is **#47's code over real HTTP**, not production. `GATE_ALLOWED_ORIGINS` is rendered by **#53's**
`gate.tf` (line 277), while the code that reads it is on **#47** — a cross-branch coupling: if #47 deploys without
#53, sign-out refuses every request. That fails loudly (gate.yml's smoke test), which is the correct direction, but
it is a merge-order constraint alongside G-R1.

## 4. Identity — **FAIL** (unchanged)

**Current live state, read from the project, not from Terraform:**

```
$ gcloud projects get-iam-policy cusati-hub --flatten="bindings[].members" \
    --filter="bindings.members:hub-gate@cusati-hub.iam.gserviceaccount.com" --format="value(bindings.role)"
roles/datastore.viewer
roles/firebaseauth.admin

$ gcloud iam roles describe gateSessionMinter --project cusati-hub
ERROR: NOT_FOUND: The role named projects/cusati-hub/roles/gateSessionMinter was not found.
```

`roles/firebaseauth.admin` — user deletion and sign-in-configuration rewrite, held by a service whose Cloud Run
invoker is `allUsers` — **is still bound in production**, and the narrowed custom role still does not exist.

**Saying it plainly: merging #53 does not change this.** Terraform in this project is applied by hand, not by CI —
`build.yml` contains no `terraform apply`, and the infra README says so. Merging the PR changes files in the
repository and nothing in the project. Only `terraform apply` moves the binding. `terraform plan` against the live
state (read-only, `-lock=false`, docker `hashicorp/terraform:1.14.0`, **never applied**) confirms the change is
correct and still pending:

```
  # google_project_iam_custom_role.gate_session_minter will be created
      + permissions = ["firebaseauth.users.createSession", "firebaseauth.users.get"]
      + role_id     = "gateSessionMinter"
  # google_project_iam_member.hub_gate_auth_admin will be destroyed
      - role = "roles/firebaseauth.admin" -> null
  # google_project_iam_member.hub_gate_session_minter will be created
  # google_service_account.hub_auditor will be created
  # google_project_iam_custom_role.private_bucket_auditor will be created
  # google_project_iam_member.hub_auditor_policy_reader will be created
  # google_service_account_iam_member.hub_auditor_wif_main will be created
  # google_logging_metric.gate_misconfigured will be created
  # google_monitoring_alert_policy.gate_misconfigured will be created
  # google_cloud_run_v2_service.gate will be updated in-place
Plan: 8 to add, 1 to change, 1 to destroy.
```

**So: proposed state correct, current state FAIL.** The line stays false until #53 is merged **and applied**.

**What does pass on this check, re-verified live:**

- **No JSON key anywhere.** User-managed keys on `hub-deploy`, `gate-deploy`, `publish-cv`,
  `publish-phd-milestones`, `hub-gate`: **0 each**. `google_service_account_key` count in state: **0**. Actions
  secrets: **0** in all four repos (`website`, `phd-milestones`, `agentic-kgis`, `construction-ai-proposal`).
  `git log --all -S'"type": "service_account"'` returns four commits, all of them prose — this contract, the previous
  handoff, a governance report and a reviewer report.
- **WIF ref pins, per the contract's 2026-09-18 correction** — checked on each service account's
  `workloadIdentityUser` binding, not on the provider:

```
  hub-deploy              attribute.repository_id_ref/1212933399/refs/heads/main
  gate-deploy             attribute.repository_id_ref/1212933399/refs/heads/main
  publish-cv              attribute.repository_id_ref/1211056144/refs/heads/master
  publish-phd-milestones  attribute.repository_id_ref/1373915518/refs/heads/main
```

  The branches genuinely differ (`cv` is `master`), and each numeric id matches the GitHub API. I record no PASS for
  "the provider pins the ref" and raise no FAIL from the provider's silence.
- **No satellite role holds `storage.objects.list`** — `satellitePublisher` is create/delete/get only.

**Still not satisfied, and still untestable by attempt.** Item 3 (the dedicated private-sync identity) remains
unimplemented: `hub-deploy` still holds `privateSyncWriter` on the private bucket, live and in the plan. The
contract's "test it by attempting the access and being refused" still cannot run — impersonation fails at the
impersonation step (`iam.serviceAccounts.getAccessToken` denied), which proves nothing about bucket access either
way. **That sub-test is NOT TESTED**, unchanged.

## 6. Supply chain — **FAIL** (improved, but the standard is not met)

### npm audit — 17 → 3, but a critical and a high remain

The contract's standard is **"no high or critical"**, not "fewer".

```
$ npm audit --package-lock-only   (feat/site-wave-0 lockfile)
{'info': 0, 'low': 1, 'moderate': 0, 'high': 1, 'critical': 1, 'total': 3}

astro   critical  direct=True   range=<=7.2.7   (installed 6.4.8)
   - critical | Astro: Remote code execution through AVIF image optimization
   - moderate | Astro: Authorization bypass from missing path-segment boundary check when stripping the configured base
   - moderate | Astro: XSS via unescaped spread attribute names in renderHTMLElement
   - moderate | Astro: Reflected XSS via unescaped View Transition animation properties
   - low      | Astro: XSS via unescaped transition:* directive values on hydrated islands
sharp   high      direct=False  range=<=0.35.4-rc.0   (installed 0.34.5)
   - high | sharp inherited vulnerabilities in libvips: CVE-2026-33327/33328/35590/35591
   - high | sharp: Vulnerabilities in libheif: GHSA-g89c-p67h-r497, GHSA-2jg2-4ch7-h545
esbuild low       direct=False
```

For comparison, `main`'s lockfile: `{'low':1,'moderate':6,'high':9,'critical':1,'total':17}`. Real progress — the six
moderates and eight of nine highs are gone — but `astro` is a **direct production dependency** and its critical is
unchanged, and the base-path authorization-bypass advisory still deserves naming given what this site's base path
protects. The fix is a major bump (`npm audit fix --force` proposes `astro@7.3.3`, a breaking change).

**`--omit=dev` is confirmed a no-op here**, as the brief states:

```
devDependencies key present: False        dependencies count: 13
--- with --omit=dev --- {'low':1,'moderate':0,'high':1,'critical':1,'total':3}
--- without ---        {'low':1,'moderate':0,'high':1,'critical':1,'total':3}
```

Identical. Everything is production.

### Action SHA pinning — unchanged, still failing

| Repo | Status |
|---|---|
| `website` (wave branches) | all SHA-pinned — `build.yml` 28, `gate.yml` 5, `ci.yml` 5; **zero** unpinned `uses:` |
| `phd-milestones` | SHA-pinned **except** `djjay0131/website/contract/publish@main` (mutable ref) |
| `agentic-kgis` | **nothing pinned** — `actions/checkout@v4`, `actions/setup-python@v5`, `astral-sh/setup-uv@v5`, `actions/setup-node@v4`, `djjay0131/website/contract/publish@main` |
| `construction-ai-proposal` | **nothing pinned** — `actions/checkout@v4`, `xu-cheng/latex-action@v3` (x6), `actions/upload-pages-artifact@v3`, `softprops/action-gh-release@v2`, `actions/deploy-pages@v4` |

The contract names all four repos. Per the coordinator the latter two are not yet hub satellites and hold no cloud
identity, so a compromise there cannot reach the bucket today — but the finding is factual and unchanged.

### actionlint — PASS, and I proved it actually ran

A silent tool is indistinguishable from a clean one, so I checked both halves:

```
$ docker run --rm rhysd/actionlint:latest -version
1.7.12
$ actionlint build.yml gate.yml ci.yml   (composed wave tree)
actionlint EXIT=0 ; output bytes=0

CONTROL, a deliberately broken workflow:
.github/workflows/bad.yml:7:23: undefined variable "nonexistent". ... [expression]
CONTROL EXIT=1
```

It runs, it is clean on the composed tree, and it can go red.

**pip-audit — PASS.** `uvx pip-audit -r gate/requirements.txt` → `No known vulnerabilities found`.

## 7. Static public site — **FAIL** (ADR-0013 does not close it)

`firebase.json` declares no functions and no SSR — correct. With #48 the rewrites are `/p/**`, `/session`,
`/session/end`, `/client-events`.

**ADR-0013 exists and is well argued.** It records the endpoint's unauthenticated design, its 4 KB / 20-event /
allowlist bounds, decision 4 (the `event=` grammar rejection) and decision 5 (rejected reports counted and
reclassified, never dropped). On substance I agree with it.

**It does not close the finding, for three reasons, each checked:**

1. **It is `Status: Proposed`**, not Accepted.
2. **It exists on only one branch — and not one of the three under review.**

```
$ for b in main feat/site-wave-0 feat/gate-signout feat/infra-wave-0 admin/wave-0-preconditions; do
    git show $b:llm/governance/adr/0013-...md | head -1; done
main:                       fatal: Path ... exists on disk, but not in 'main'
feat/site-wave-0:           fatal: ... not in 'feat/site-wave-0'
feat/gate-signout:          fatal: ... not in 'feat/gate-signout'
feat/infra-wave-0:          fatal: ... not in 'feat/infra-wave-0'
admin/wave-0-preconditions: # ADR-0013: The gate exposes an unauthenticated client-telemetry endpoint
```

   It rides on `admin/wave-0-preconditions` (**PR #45, open**). So #48 — the PR that ships the `/client-events`
   rewrite — can merge with the route still unauthorised by anything on `main`.

3. **Its own decision 2 has not been carried out.** The ADR says `/client-events` "**is added to the design doc §8
   rewrite list**". §8 is unamended on *every* branch, including the one carrying the ADR:

```
$ git show <branch>:llm/specs/2026-09-10-research-hub-design.md   (main, feat/site-wave-0, admin/wave-0-preconditions — identical)
    "rewrites": [
      { "source": "/p/**", ... }, { "source": "/s/**", ... },
      { "source": "/session", ... }, { "source": "/share/**", ... }
    ]
```

   No `/client-events`, and no `/session/end` either. So the list the contract calls authoritative still contradicts
   what ships, and the ADR asserts an amendment that was never made.

This remains the narrowest of the FAILs and the cheapest to fix: accept the ADR, actually amend §8 to include
`/client-events` **and** `/session/end`, and land it with the wave rather than behind it.

**Also confirmed live (G-R1, unchanged):** until #48 merges, `/session/end` through Hosting is answered by the static
site — `HTTP/2 404`, `cache-control: max-age=3600`, a **publicly cacheable** response on a `/session` path. Direct
`*.run.app` gives the gate's 329-byte 404. **#48 must merge before or with #47.**

## #54 — metric forgery: **closed in code, not yet in production**

Not previously tested by me; demonstrated in production by the Red Team. Re-run over real HTTP against #47's code:

```
  --- forgery: fields.note carries the denials-metric trigger
  POST /client-events -> 204
    INFO gate event=client_grammar_rejected trace=rerun-probe smuggled=1 reported=signin_failed note=event-deny_scope=private

  --- forgery: the event NAME itself carries the grammar, upper-cased
  POST /client-events -> 204
    INFO gate event=client_grammar_rejected trace=t2 smuggled=1 reported=event-deny a=b

  --- control: a clean report
  POST /client-events -> 204
    INFO gate event=client_signin_failed trace=t3 reason=popup_blocked
```

Every property the brief asked for holds:

- the client value **cannot carry the gate's `event=` grammar** — `event=deny` became `event-deny`, which matches
  neither metric filter (`textPayload:"event=deny"`, `textPayload:"event=client_signin_failed"`);
- case cannot evade it — `EVENT=deny` was neutralised too (`re.IGNORECASE`);
- the report is **not silently dropped**: it returns 204, is emitted under its own class
  `event=client_grammar_rejected`, and **carries a count** (`smuggled=1`);
- it is **reclassified** — a poisoned `signin_failed` is *not* counted as a sign-in failure; it lands in
  `client_grammar_rejected` with the original name preserved in `reported=`;
- an honest report is untouched and still reaches the metric.

Five named tests cover this and all pass: `test_a_field_value_cannot_smuggle_the_denials_metric_trigger`,
`test_a_field_value_cannot_smuggle_the_signin_failure_metric_trigger`,
`test_an_honest_report_is_untouched_and_still_reaches_the_metric`, `test_cannot_forge_log_lines_with_newlines`,
`test_emits_the_string_the_metric_filters_on`.

**Not yet true in production.** The live revision `hub-gate-00005-n4g` predates the fix, and
`POST /client-events` on the live service still answers `204`. Production metrics remain forgeable until #47
deploys. I did not send a forged value to production; the live revision's identity is sufficient evidence and
polluting the metrics would be the attack.

## #55 — `roles/editor`: guard **fixed**, exposure **live**

The guard now expands all three project roles. Run live, read-only, against the real project:

```
OK: uniform_bucket_level_access is True -- object ACLs are disabled and IAM is the only access path
OK: public_access_prevention is enforced
OK: no allUsers and no allAuthenticatedUsers in the bucket policy
OK: exactly two non-legacy bindings: the gate reads, the hub syncs
OK: no principal holds roles/viewer on cusati-hub, so projectViewer expands to the empty set ...
FAIL: roles/editor on cusati-hub is NOT empty. Through the automatic legacyBucketOwner/legacyObjectOwner
      bindings, each principal below holds create, delete, get, LIST, update and setIamPolicy on EVERY
      OBJECT in gs://cusati-hub-private ...
    serviceAccount:410552878319-compute@developer.gserviceaccount.com
NOTE: roles/owner on cusati-hub expands to the principals below. ... This is EXPECTED and is not failed on
    user:djjay0131@gmail.com
OK: anonymous GET of index.html returned 401 -- refused
::error::Private bucket IAM test FAILED. Do not deploy.
SCRIPT EXIT=1
```

Both requirements from the brief are met: **`roles/editor` is expanded and failed on**; **`roles/owner` is reported,
not failed**. Live IAM confirms the expansion is real — `roles/editor` → the default compute SA, `roles/viewer` →
empty, `roles/owner` → the project owner.

**The editor expansion is load-bearing, proved by breaking it** (anchor asserted unique first):

```
$ grep -c 'EDITORS="$(members_of roles/editor)"' ...   -> 1
mutated 1 occurrence -> editors forced empty
OK: no principal holds roles/editor on cusati-hub, so projectEditor expands to the empty set ...
Private bucket IAM test passed.
MUTATED EXIT=0
```

Reverting to the pre-#55 viewer-only behaviour turns the live red into a green — which is exactly the defect #55
describes, and it is now genuinely fixed.

**Consequence to plan for:** the exposure itself is unremediated. Once #53 merges, `private-bucket-live-iam` will
**fail on `main` and on every scheduled run** until `roles/editor` is removed from the default compute service
account. That is the guard working, not misbehaving — but it will turn `main` red.

## #58 — the live IAM check now runs somewhere real, and fails the job

`private-bucket-live-iam` is a real job in `build.yml`, parsed (not grepped) from the branch:

```
jobs: [..., 'private-bucket-live-iam', 'notify-failure', ...]
private-bucket-live-iam if: (github.event_name == 'schedule' || github.event_name == 'push'
                             || github.event_name == 'workflow_dispatch')
                            && vars.GCP_PROJECT_ID != '' && vars.GCP_PRIVATE_BUCKET != ''
triggers: ['pull_request', 'push', 'schedule', 'workflow_dispatch']
notify-failure needs= [..., 'private-bucket-live-iam']
```

It invokes the script at a command position (`bash infra/scripts/check-private-bucket-iam.sh`, line 858), sets no
`continue-on-error`, and the script exits 1 on any failure — so **it fails the job it runs in**, and `notify-failure`
pages. It is deliberately *not* conditioned on `vars.GCP_AUDITOR_SA`, so a missing variable fails loudly instead of
skipping.

The wiring guard that protects this parses YAML rather than grepping — which matters, because a comment does not
survive `yaml.safe_load`, and the state that produced #58 was a comment. Run standalone against the branch:

```
OK: infra/scripts/check-private-bucket-iam.sh is invoked by job(s) [private-bucket-live-iam], on triggers
['pull_request', 'push', 'schedule', 'workflow_dispatch'], with no continue-on-error, and a failure pages
through notify-failure.
GUARD EXIT=0
```

**And I proved the guard goes red** — anchor asserted unique, then the single invocation replaced by prose,
reproducing the exact #58 state:

```
$ grep -c "bash infra/scripts/check-private-bucket-iam.sh" build.yml  -> 1
replaced 1 occurrence
::error::no job runs infra/scripts/check-private-bucket-iam.sh
GUARD-AFTER-BREAK EXIT=1
```

**Two live preconditions are not yet met**, so the job will fail on merge until they are:

```
$ gcloud iam service-accounts list --project cusati-hub    -> no hub-auditor@cusati-hub...
$ gcloud iam roles describe privateBucketAuditor --project cusati-hub -> NOT_FOUND
$ gh api repos/djjay0131/website/actions/variables         -> GCP_AUDITOR_SA is absent
```

Both are created by the same `terraform apply` that check 4 is waiting on, plus one repository variable. Until then
the job fails at its first step — by design, and preferable to skipping, but it should be sequenced deliberately.

## 1. Private content never on the public path — PASS

The guard still has real needles (two published private items), and I made it go red again rather than trusting the
green:

```
CONTROL (unmodified copy):
check:no-private-in-public: PASS — no private slug, source, route, payload path, title or summary appears
in any path or any file's contents under <copy> (157 files scanned).
CONTROL EXIT=0

PLANT (a private TITLE only — no slug, no path, no route anywhere near it), verified written (38 bytes):
check:no-private-in-public: 1 LEAK(S) of private content into <copy>:
  x-payload.json
    contents: title of phd-milestones/committee-dossier — "Committee Dossier (fixture)"
PLANTED EXIT=1
```

The title-only plant is the one that matters: it exercises the **contents** half independently of the path half.
(My first attempt at this plant silently failed to write the file and returned EXIT=0 — see Assumptions.)

## 2. Private bucket — PASS, with S-1 now a live red

Read from the live bucket, explicitly, not from a blank-prone summary field:

```
public_access_prevention = "enforced"
uniform_bucket_level_access = true
```

UBLA — the setting that fails open — is **true in production**. Exactly two non-legacy principals, unchanged:

```
projects/cusati-hub/roles/privateObjectReader -> serviceAccount:hub-gate@cusati-hub...
projects/cusati-hub/roles/privateSyncWriter   -> serviceAccount:hub-deploy@cusati-hub...
roles/storage.legacyBucketOwner  -> projectEditor, projectOwner
roles/storage.legacyBucketReader -> projectViewer
roles/storage.legacyObjectOwner  -> projectEditor, projectOwner
roles/storage.legacyObjectReader -> projectViewer
```

Anonymous GET refused (401). The credential-free half also passes, and now asserts the new auditor role is harmless:

```
OK: private bucket declares uniform bucket-level access and enforced public access prevention, names no
anonymous principal, and carries exactly two bindings -- the gate (storage.objects.get) and the hub's sync
(create/delete/get/list). The CI auditor role holds exactly projects.getIamPolicy, buckets.get and
buckets.getIamPolicy, and no storage.objects.* permission of any kind.
EXIT=0
```

All five clauses of check 2 hold, so it passes — but **S-1 is no longer latent-and-unwatched**: the guard now sees
it and goes red live (#55 above). I keep it out of the verdict for the same reason the previous run did (the line's
five clauses all hold and the legacy path is explicitly carved out), and I flag the red-on-merge consequence instead.

## 5. Firestore — PASS (ruleset) + NOT TESTED (signed-in stranger)

**The deny-all ruleset stays RELEASED, and #53 does not regress it.** Three lines of evidence:

```
$ GET firebaserules.googleapis.com/v1/projects/cusati-hub/rulesets
total rulesets: 1
  405d371b-01d1-475e-bfed-1763bd8de94c 2026-09-17T20:58:34Z
$ GET .../releases
cloud.firestore -> 405d371b-01d1-475e-bfed-1763bd8de94c

terraform plan (#53's configuration, live state):
google_firebaserules_ruleset.firestore_deny_all: Refreshing state... [id=projects/cusati-hub/rulesets/405d371b-...]
google_firebaserules_release.firestore:          Refreshing state... [id=projects/cusati-hub/releases/cloud.firestore]
$ grep -c "firebaserules.*(must be replaced|will be destroyed|will be created)" plan.txt -> 0
```

Exactly one ruleset exists; had it been replaced per apply (the pre-#35 behaviour) there would be many. #53 touches
no firestore or rules file at all. The #30 fix holds.

**`members/` and `shares/` from the Web SDK — half tested.** Unauthenticated, using the project's real public web
API key (from repo variables):

```
members  status=403  {"error":{"code":403,"message":"Missing or insufficient permissions.","status":"PERMISSION_DENIED"}}
shares   status=403  {"error":{"code":403,"message":"Missing or insufficient permissions.","status":"PERMISSION_DENIED"}}
```

I still could not obtain a real signed-in-stranger token — anonymous sign-in remains disabled
(`accounts:signUp` → `400 ADMIN_ONLY_OPERATION`) and I hold no non-allowlisted Google account. The deny-all ruleset
makes the signed-in case follow a fortiori, but the contract says "prove it with a real token".
**NOT TESTED**, unchanged. What would test it: a real non-member Google account signs in at `/signin`, then its
`idToken` is used against `GET firestore.googleapis.com/v1/.../documents/members`.

## 8. Cost — PASS

```
google_billing_budget.hub ['billingAccounts/.../budgets/a9c301a5-6f2e-44bc-b9e3-c56f220bb3da']
```

Present in state; `terraform plan` refreshes it and lists it in **none** of the 8-add / 1-change / 1-destroy set, so
#53 does not touch it. `google_service_account_key` count in state: 0.

## 9. Logging — PASS, S-4 unchanged

```
$ gcloud logging read ... --freshness=10d
2026-09-18T15:48:18.338158Z  INFO gate event=boot logging=StreamHandler(stdout)
     12 event=deny                    (my /p/ probes, one per request)
      1 event=client_signin_failed    (my one clean /client-events probe)
```

`event=boot` is present at the current revision's start, so the handler fix is real in production. `event=deny` and
`event=client_signin_failed` are the two strings `infra/monitoring.tf` filters on and both are live.
`event=allow scope=signout` cannot exist live yet — `/session/end` is not deployed — and is evidenced on the branch
instead (§3), labelled as such.

**No secret or token in any log line.** All ten patterns, zero hits across the window after my probes:

```
  eyJ 0 · ya29 0 · gho_ 0 · ghp_ 0 · github_pat 0 · AIza 0 · X-Goog-Signature 0
  token= 0 · secret= 0 · password= 0
```

**S-4 unchanged:** uvicorn's own access lines still carry full request paths into Cloud Logging regardless of
`GATE_LOG_OBJECT_PATHS`, so once real private content is served `/p/<private-slug>` will be in the logs. Not a secret
or token, so not a FAIL of this line's wording — but the control remains partial and the config comment still
overstates it.

## 10. Repos — PASS

```
djjay0131/phd-milestones           private=true  visibility=private id=1373915518 default_branch=main
djjay0131/agentic-kgis             private=false visibility=public  id=1295802912 default_branch=main
djjay0131/construction-ai-proposal private=false visibility=public  id=1134376420 default_branch=master
djjay0131/website                  private=false visibility=public  id=1212933399 default_branch=main
```

**`phd-milestones` is PRIVATE**, and its id matches the WIF pin exactly. The other two are still not hub satellites,
so there is nothing publishing to the hub from either to assess for `visibility: public`.

## #57 — resolved, and it genuinely executes

The previous run's merge blocker (`#47` + `#53` turning
`test_every_alert_policy_has_a_notification_channel` red) is gone. Both compositions are green, and the test
**actually ran** in both rather than being skipped:

| Tree | Result | The #57 test |
|---|---|---|
| #47 gate tests + `main`'s `infra/` | 295 tests, **0 failures** | **passed** |
| #47 gate tests + #53's `infra/` | 295 tests, **0 failures** | **passed** |

---

## Summary

Wave 0 is still **BLOCKED**, on **three** checks rather than four. **Check 3 is properly closed** and the fix is a
good one.

**Check 3.** The property I falsified last time is now true. `_same_origin()` reads exactly one request header —
`origin` — and compares it against a set built from `GATE_ALLOWED_ORIGINS`; I confirmed by grep that the only other
`headers.get` calls in the file read `content-length`. All three bypass spellings that returned 200 with a clearing
`Set-Cookie` now return 403 with none, over real HTTP on a real socket, while both honest transports still return
200. Unset means refuse everything, including the honest caller, with an ERROR at boot and per request and no
fallback — the direction the previous handoff asked for. The test that *asserted* the bypass is gone, replaced by a
parametrised test over all three spellings; I asserted the anchor was unique, reintroduced the bug, and exactly
three cases went red, all of them that test, named.

**Check 4** is unchanged and is the substantive one. `roles/firebaseauth.admin` is still bound to `hub-gate` in
production and `gateSessionMinter` does not exist. To be plain about what the brief asked me to be plain about:
**merging #53 changes none of this.** Terraform here is applied by hand; the repository has no `terraform apply` in
CI. The plan is correct and clean — 8 add, 1 change, 1 destroy, destroying the `firebaseauth.admin` binding and
creating a custom role with exactly two permissions — and it remains pending. Until someone runs `apply`, a service
whose invoker is `allUsers` can delete users and rewrite the sign-in configuration. Item 3 is still unimplemented,
so the public deploy identity still holds write access to the private bucket, and the by-attempt test for it is still
NOT TESTED.

**Check 6** improved a great deal and still fails the standard. 17 findings became 3, but the standard is "no high or
critical" and there is one of each: a **critical RCE in `astro`**, a direct production dependency, plus the
base-path authorization-bypass advisory on the same package, and a high in `sharp`. `--omit=dev` is confirmed a
no-op — there is no `devDependencies` key at all. The satellite SHA-pinning half is untouched: two repos pin nothing.

**Check 7** is the narrowest and the cheapest to fix, and ADR-0013 does not yet close it. The ADR is good — it
authorises the endpoint on the merits and its decisions 4 and 5 are exactly what #54 needed. But it is
`Status: Proposed`; it exists only on `admin/wave-0-preconditions` (PR #45) and on none of the three branches under
review, so #48 can ship the rewrite with nothing on `main` authorising it; and its own decision 2 — "it is added to
the design doc §8 rewrite list" — has not been carried out on any branch, including the one carrying the ADR. §8
still lists four rewrites and names neither `/client-events` nor `/session/end`.

**The two new items I was asked to verify both check out.** #54 is closed in code and closed well: a client value
carrying `event=` is neutralised case-insensitively, the report is **counted** (`smuggled=N`) and **reclassified**
into `client_grammar_rejected` rather than dropped, a poisoned `signin_failed` is not counted as a sign-in failure,
and an honest report still reaches the metric untouched. It is **not yet true in production** — the live revision
predates the fix. #55's guard now expands `roles/editor` and fails on it while merely reporting `roles/owner`; I
proved the expansion is load-bearing by reverting it and watching a live red become green. #58 is wired to a real
job that fails the job it runs in and pages through `notify-failure`, protected by a guard that parses the workflow
rather than grepping it — and I proved that guard goes red by removing the single invocation.

**Two sequencing consequences the wave should decide on deliberately, not discover.** First, once #53 merges,
`private-bucket-live-iam` will fail on `main` and on every scheduled run — twice over: the `hub-auditor` service
account, the `privateBucketAuditor` role and the `GCP_AUDITOR_SA` variable do not exist yet, and even once they do,
the live check correctly fails on the unremediated `roles/editor` grant. That is the guard working. Second,
`GATE_ALLOWED_ORIGINS` is rendered by **#53**'s `gate.tf` while the code reading it is on **#47**; deploying #47
without #53 makes sign-out refuse every request. It fails loudly at the deploy smoke test, which is the right
direction, but it is a second merge-order constraint next to G-R1 (#48 before or with #47, re-confirmed live).

What is reassuring: nothing regressed. The leak check still goes red on a title-only plant, UBLA is still true live,
exactly one Firestore ruleset still exists and #53 does not touch it, `event=boot` is still in production, and the
#57 collision that would have blocked the #47/#53 merge is resolved with the test genuinely executing in both
compositions.

## Assumptions

- The live project is `cusati-hub`; `jason.cusati.us` and `hub-gate-ywkmredngq-ue.a.run.app` are the two transports.
- `terraform init`/`plan` ran on a **scratch copy** of #53's `infra/` with a copy of the local state, read-only,
  `-lock=false`, in `hashicorp/terraform:1.14.0`. `apply` was never invoked and `infra/` in the worktree was never
  modified.
- #47's runtime behaviour was exercised by serving its `create_app()` under **uvicorn on a real TCP socket** with the
  suite's in-memory fakes, so the sign-out, traversal and `/client-events` results reflect the branch's **code over
  real HTTP**, not a deployed revision. Every claim sourced that way is labelled.
- `npm audit` was run with `--package-lock-only` against the lockfile extracted from `feat/site-wave-0`, and
  separately against `main`'s for comparison.
- The live bucket IAM script was run as the project **owner**, not as the `hub-auditor` identity CI will use (that
  identity does not exist yet). It therefore verifies the script's *logic* and the *live policy*; it does not verify
  that the auditor's three permissions are sufficient. That is checked in CI once the role exists.
- I treat the contract's two dated corrections as authoritative: I checked the ref pin on each service account's
  `workloadIdentityUser` binding rather than on the provider, and I attributed 404s by the container log line rather
  than by body size.

**Three measurement failures of my own, caught and corrected — recorded because the brief asks for exactly this.**

1. **`pytest -q` emits no summary line** under this repo's `addopts`, and `pytest -k <name>` reported
   `collected=0` for tests that plainly exist. My first three attempts to count tests produced empty output that
   could have been read as "the suite did not run". It had: **295 tests**. I settled it with `--junitxml` and parsed
   the XML, which is what every count and every test name above comes from.
2. **My first Firestore probe used a placeholder API key** scraped by a loose grep
   (`AIzaSyDOCAbC123dEf456GhI789jKl012-MnO`, Google's documentation dummy). It returned `403` — which looks exactly
   like rules enforcement but was key rejection, and would have been a false PASS. Re-run with the project's real
   public key from repo variables; the 403s reported above are genuine, and a sanity probe confirms the key
   validates.
3. **My first leak-check plant silently failed to write the file** (`KeyError: 'S'` — an unexported shell variable),
   and the check then printed `EXIT=0`, which I could have recorded as "the guard passed". Re-run with the path
   written literally and the file's size verified before re-running; it then went red as reported.

Separately, my first `actionlint` invocation passed a **directory** where it wanted files and exited 0 having checked
nothing; and an early comparison of the #47 test suite lacked `infra/` entirely, so five monitoring tests were
skipped by `skipif(not MONITORING.exists())` and I briefly mistook that for a property of #47. Both were re-run
correctly, and the #57 result above uses `main`'s `infra/` as the true baseline.

## Recommendations

1. **Apply #53** — do not merge and assume. Merging moves no IAM binding. Afterwards verify with
   `gcloud iam roles describe gateSessionMinter --project cusati-hub` and the `hub-gate` role filter, both of which
   currently return the failing state quoted above.
2. **Sequence the live-IAM job.** Before or with the #53 merge: apply Terraform (creating `hub-auditor` and
   `privateBucketAuditor`), set the `GCP_AUDITOR_SA` repository variable, and **remove `roles/editor` from
   `410552878319-compute@developer.gserviceaccount.com`**. Otherwise `main` goes red on merge for two separate
   reasons, both legitimate.
3. **Upgrade `astro`** to clear the critical RCE. It is a major bump (`6.4.8` → `7.x`), so it needs its own change,
   but the contract's "no high or critical" is not met until it lands. `sharp` clears with it.
4. **Accept ADR-0013, carry out its own decision 2, and land it with the wave.** Amend design doc §8 to list
   `/client-events` **and** `/session/end`, flip the status to Accepted, and get it onto `main` no later than #48 —
   otherwise the rewrite ships unauthorised by anything on the default branch.
5. **Merge #48 before or with #47** (G-R1), re-confirmed live, and **deploy #47 and #53 together** so
   `GATE_ALLOWED_ORIGINS` exists when the code that requires it starts.
6. **Pin every action by SHA** in `agentic-kgis` and `construction-ai-proposal`, and pin
   `djjay0131/website/contract/publish` to a SHA in both satellites that consume it.
7. **Re-probe `/session/end` and `/client-events` in production after the deploy.** The sign-out and #54 evidence
   above is branch evidence; the Hosting header question and the forgery fix both want a live confirmation once the
   route exists.
8. **Land item 3** and update `EXPECTED_PRIVATE_BUCKET_BINDINGS`, so the public deploy identity stops holding write
   access to the private bucket.
9. **Give the Checkpoint runner `roles/iam.serviceAccountTokenCreator`** on the target SAs for the duration, so
   check 4's "attempt the access and be refused" clause can run instead of being skipped a second time.
10. **Split real `devDependencies` out of `site/package.json`**, so `npm audit --omit=dev` means something. Today it
    excludes nothing.

## Alternatives considered

- **Passing check 6 because 17 became 3.** Rejected. The standard in my contract is "no high or critical", and there
  is one of each in a direct production dependency. Grading on improvement rather than on the stated bar is the
  softening the contract forbids.
- **Passing check 7 because ADR-0013 exists.** Rejected, and this was the closest call. The ADR is substantively
  right and I say so. But it is Proposed, it is absent from all three branches under review, and the §8 amendment it
  claims to make has not been made — so on `main`, after this wave merges, the route would still be authorised by
  nothing. An ADR that has not landed does not authorise a route that has.
- **Failing check 2 on the live `roles/editor` red.** Rejected, consistent with the previous run. All five clauses of
  the line hold — UBLA, PAP, exactly two non-legacy principals, anonymous refusal, the `projectViewer` decision
  recorded — and the legacy path is explicitly carved out of the two-principal invariant. It is recorded prominently
  and as a merge consequence instead.
- **Failing check 3 because `/session/end` is still not deployed.** Rejected. The check asks whether the gate refuses
  these requests, and I falsified that property over real HTTP last time by the same method I now use to confirm it.
  Holding the fix hostage to a deploy it cannot have yet would be unfalsifiable. The limitation is labelled and
  Recommendation 7 closes it.
- **Failing check 9 on S-4.** Rejected again. The line asks that no secret or token appear, and none does.
- **Re-running the #54 forgery against production** to confirm it is still exploitable there. Rejected: it would
  write attacker-shaped data into the live metrics — the attack itself. The live revision's identity and its env
  block are sufficient evidence that the fix is not deployed.

## Risks

- **`main` goes red the moment #53 merges**, for two independent and legitimate reasons (the auditor identity does
  not exist / the variable is unset; and `roles/editor` is genuinely still granted). Loud, not silent — but it will
  look like a broken pipeline to anyone who has not read this.
- **Check 4 stays false after every merge in this wave.** The only action that closes it is `terraform apply`, and
  nothing in CI performs it. There is a real risk of the wave being recorded as closed while the `allUsers`-invoked
  gate still holds `roles/firebaseauth.admin`.
- **`GATE_ALLOWED_ORIGINS` spans two branches.** #47 reads it, #53 renders it. Deploying #47 alone takes sign-out
  down entirely. The deploy smoke test catches it, so the failure is loud and immediate.
- **Production metrics remain forgeable until #47 deploys.** #54 is fixed in code only; anyone who finds
  `/client-events` can still inflate both log-based metrics against the live service today.
- **`projectEditor` on the private bucket is live, not hypothetical.** It is bounded only by nothing currently
  running as the default compute service account and the Compute API staying disabled. Neither is enforced.
- **The `astro` critical is in a direct production dependency** and its fix is a major version bump, so it will not
  be a quick follow-up.
- **This verdict covers the branches as they stand on 2026-09-21.** Checks 4 and 7 should clear without redesign;
  check 6 needs a dependency bump and work in two repositories that are not part of this wave.

## Open questions

1. Who runs `terraform apply`, and when, relative to the #53 merge? Check 4 cannot clear without it, and the
   live-IAM job's preconditions ride on the same apply.
2. Will `roles/editor` be removed from the default compute service account in this wave, or is the red on `main`
   accepted for a period? If accepted, for how long and recorded where?
3. Is the `astro` major bump in scope for Wave 0, or does check 6 carry a time-boxed exception with an owner?
4. Should ADR-0013 move onto a branch that is actually merging this wave, rather than riding PR #45?
5. Does Firebase Hosting overwrite or append `X-Forwarded-Host` on a Cloud Run rewrite? Now **moot for the CSRF
   check** — no host header is read — but it still matters for anything else that might read one, and it remains
   unanswered.
6. Is a non-member Google account available for Checkpoint use, so check 5's signed-in-stranger half stops being
   NOT TESTED every wave?
7. Will `djjay0131/website/contract/publish` be pinned to a SHA in the satellites, and who owns that change given
   those repos are outside this wave?

## Related docs

- `llm/specs/2026-09-10-research-hub-design.md` §8 (the rewrite list, still unamended), §12 (the six non-negotiables)
- `llm/governance/adr/0004`, `0005`, `0007`, `0010`, and **`0013`** (Proposed, on `admin/wave-0-preconditions`)
- `llm/sprints/2026-09-hub/contracts/security-tester-wave-0.md` — including its two dated corrections
- `llm/sprints/2026-09-hub/handoffs/security-wave-0.md` — the verdict this re-run supersedes
- `llm/sprints/2026-09-hub/handoffs/infra-wave-0.md`, `gate-wave-0.md`, `site-wave-0.md`, `red-team-wave-0.md`,
  `boundary-tester-wave-0.md`
- `llm/sprints/2026-09-hub/STATE.md` §Wave 0 dispositions — RT-1, RT-12, G-R1, A-1
- Issues #53, #54, #55, #57, #58 — all still **open** at the time of this run

## ADR candidates

1. **`Origin` verification for state-changing routes** — largely *answered* by #47's implementation and worth
   promoting from code comment to decision before Phase 4's mint and revoke reuse `_same_origin()`: what is compared
   against what, that no forwarded header is ever trusted, and that unset fails closed.
2. **Legacy bucket bindings and project-role expansion.** That `projectEditor`/`projectViewer` are a standing,
   un-removable path into the private bucket unless the bucket's whole IAM policy is replaced, and which project
   roles may therefore ever be granted in this project.
3. **Request-path logging.** That uvicorn's access lines place `/p/**` paths into Cloud Logging regardless of
   `GATE_LOG_OBJECT_PATHS`, and whether the access logger is reconfigured or the setting's claim narrowed (S-4).
4. **Who applies Terraform, and how a merged-but-unapplied change is tracked.** Check 4 has now failed twice for the
   same reason, and the gap between "merged" and "true in production" is not written down anywhere.
5. **Dependency-advisory policy.** What "no high or critical" means when the only fix is a major version bump of a
   direct production dependency, and who may grant a time-boxed exception.
