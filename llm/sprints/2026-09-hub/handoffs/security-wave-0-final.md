BLOCKED

# Security Tester — Wave 0, final run

Issued: 2026-09-18 · Final run: 2026-09-21 · Contract: `contracts/security-tester-wave-0.md` (with its two dated
corrections) · Issue #44 (hub-007)

Branches under review, each confirmed in sync with its remote:

| Branch | Head | vs. previous verdict |
|---|---|---|
| `feat/site-wave-0` (#48) | `1fb0bc2` | **`astro` 6.4.8 → 7.3.3** |
| `feat/gate-signout` (#47) | `3f1a58a` | unchanged |
| `feat/infra-wave-0` (#53) | `e776df3` | unchanged |
| `admin/wave-0-preconditions` (#45) | `e8f6a25` | design doc §8 rewrite list amended |

Method: `git diff main...<branch>`, `git show <branch>:<path>`, `git archive <branch> | tar -x` into scratch.
**No branch was checked out. No git, `gh` or cloud mutation was made.** The worktree stayed on
`admin/wave-0-preconditions`; `git status --short` is empty. `terraform plan` only, on a scratch copy, `-lock=false`,
**never applied**.

**Independence.** I authored nothing under review. The only file I wrote in the repository is this handoff.

---

## Verdict table

| # | Check | Run 1 | Run 2 | **Final** |
|---|---|---|---|---|
| 1 | Private content never on the public path | PASS | PASS | **PASS** — re-proved red on the astro 7.3.3 build |
| 2 | Private bucket | PASS | PASS | **PASS** (S-1 still a live red) |
| 3 | The gate | FAIL | PASS | **PASS** — with a new finding, S-5 |
| 4 | Identity | FAIL | FAIL | **FAIL** — `roles/firebaseauth.admin` still bound live |
| 5 | Firestore | PASS + NOT TESTED | PASS + NOT TESTED | **PASS** (ruleset) + **NOT TESTED** (signed-in stranger) |
| 6 | Supply chain | FAIL | FAIL | **FAIL** — advisories now clean; satellite SHA pinning unchanged |
| 7 | Static public site | FAIL | FAIL | **FAIL** — ADR-0013 still `Proposed` and still on no merging branch |
| 8 | Cost | PASS | PASS | **PASS** |
| 9 | Logging | PASS | PASS | **PASS** (S-4 unchanged) |
| 10 | Repos | PASS | PASS | **PASS** |

**Three FAILs (4, 6, 7). Under the run brief §8 this blocks every merge in Wave 0.**

Nothing regressed. Check 6's dependency half genuinely cleared. Checks 6 and 7 are now each a *single* remaining
cause, both cheap. Check 4 is unchanged and is the only substantive one.

---

## The three open FAILs, re-judged

### 6. Supply chain — **FAIL** (the advisory half is now clean; the pinning half is not)

#### npm audit: verified by GHSA ID, not by a falling total — **this half PASSES**

The upgraded lockfile, extracted from `feat/site-wave-0` (`sha256 5be64abf…`):

```
$ npm audit --package-lock-only --omit=dev --json     (feat/site-wave-0 lockfile)
EXIT=0
metadata.vulnerabilities: {"info": 0, "low": 0, "moderate": 0, "high": 0, "critical": 0, "total": 0}
metadata.dependencies:   {"prod": 375, "dev": 0, "optional": 103, "total": 477}
vulnerabilities keys: []

--- without --omit=dev ---
{"info": 0, "low": 0, "moderate": 0, "high": 0, "critical": 0, "total": 0}
```

`--omit=dev` is still confirmed a no-op — identical both ways, and `dev: 0`. Everything is production.

**A zero is exactly what a lockfile that failed to parse would also print, so I did not accept it.** Four
independent confirmations:

**(a) Control, same tool, same minute, `main`'s lockfile** — it reports when it should:

```
$ npm audit --package-lock-only --omit=dev --json     (main's lockfile)
EXIT=1
metadata.vulnerabilities: {"info": 0, "low": 1, "moderate": 6, "high": 9, "critical": 1, "total": 17}
  astro critical direct=True range=<=7.2.7      js-yaml high direct=True   range=4.0.0 - 4.3.1
  sharp high  direct=False range=<=0.35.4-rc.0  vite   high direct=False  range=7.0.0 - 7.3.3
  devalue, fast-uri, nanoid, postcss, smol-toml, svgo (high) + 6 moderate + esbuild (low)
```

**(b) Plant — I made the upgraded lockfile's *own* audit go red** (anchor asserted unique first):

```
anchor count (astro 7.3.3 entries in lock): 1
mutated 1 astro package entry 7.3.3 -> 6.4.8
PLANTED EXIT=1
metadata.vulnerabilities: {"critical": 1, "total": 1}
   astro critical range=<=7.2.7
```

So the zero is being computed from *this file*, and this file is what makes it zero.

**(c) The named GHSA IDs, resolved against the installed versions** — the check my brief asked for:

```
GHSA-26w7-cxv4-gfx2  critical  Astro: Remote code execution through AVIF image optimization
      pkg=astro  vulnerable_range='< 7.2.8'           first_patched='7.2.8'      installed 7.3.3  -> NOT VULNERABLE
GHSA-376h-93r7-7g6f  medium    Astro: Authorization bypass from missing path-segment boundary check
                               when stripping the configured base
      pkg=astro  vulnerable_range='<= 7.2.3'          first_patched='7.2.4'      installed 7.3.3  -> NOT VULNERABLE
GHSA-f88m-g3jw-g9cj  high      sharp inherited vulnerabilities in libvips (CVE-2026-33327/33328/35590/35591)
      pkg=sharp  vulnerable_range='< 0.35.0'          first_patched='0.35.0'     installed 0.35.4 -> NOT VULNERABLE
GHSA-rgj7-g3m4-5g8c  high      sharp: Vulnerabilities in libheif (GHSA-g89c-p67h-r497, GHSA-2jg2-4ch7-h545)
      pkg=sharp  vulnerable_range='< 0.35.4'          first_patched='0.35.4'     installed 0.35.4 -> NOT VULNERABLE
```

The two `sharp` advisories named in my brief (`GHSA-g89c-p67h-r497`, `GHSA-2jg2-4ch7-h545`) are the **upstream
libheif** identifiers; `https://api.github.com/advisories/` returns no record for either, because the npm-level
advisory that carries them is `GHSA-rgj7-g3m4-5g8c`. That is the one I checked, and it is cleared by 0.35.4 exactly.
The remaining three astro advisories (`GHSA-f48w`, `GHSA-7pw4`, `GHSA-4g3v`) are all patched at or below 7.1.0.

**(d) The registry's bulk advisory endpoint, queried directly for the installed versions, with the old versions as
a control:**

```
$ POST registry.npmjs.org/-/npm/v1/security/advisories/bulk
    {"astro":["7.3.3"],"sharp":["0.35.4"],"vite":["8.3.0"],"esbuild":["0.28.2"]}
{}                                       <- no advisory for any installed version

$ same endpoint, {"astro":["6.4.8"],"sharp":["0.34.5"]}     (control)
--- astro 5 advisories: GHSA-f48w-9m4c-m7f5, GHSA-7pw4-f3q4-r2p2, GHSA-4g3v-8h47-v7g6,
                        GHSA-26w7-cxv4-gfx2 (critical), GHSA-376h-93r7-7g6f
--- sharp 2 advisories: GHSA-f88m-g3jw-g9cj, GHSA-rgj7-g3m4-5g8c
```

The endpoint is live and reports all seven for the old versions; it returns nothing for the new ones. **3 → 0 is
real, and both named advisories are absent by ID, not by arithmetic.**

`pip-audit` — **PASS**, and I proved it reports:

```
$ uvx pip-audit -r gate/requirements.txt     (1285 lines, from feat/gate-signout)
EXIT=0   No known vulnerabilities found

CONTROL  $ uvx pip-audit -r <jinja2==2.11.2>
EXIT=1   Found 10 known vulnerabilities in 1 package
```

`actionlint` — **PASS**, and **my first invocation did not run**: I passed `-color=never`, which is not a valid
flag, and got `EXIT=2` with 2200 bytes of *usage text* — a transcript that scrolls past as though a tool had spoken.
Re-run correctly, with a control:

```
$ actionlint -no-color -oneline build.yml gate.yml ci.yml     (composed wave tree)
ACTIONLINT EXIT=0  output_bytes=0
$ actionlint -version -> 1.7.12

CONTROL, a deliberately broken workflow, same invocation:
.github/workflows/bad.yml:7:24: undefined variable "nonexistent". ... [expression]
CONTROL EXIT=1  output_bytes=205
```

#### Action SHA pinning — **unchanged, and this is why check 6 still fails**

This half was a separate count and has not been touched. Read live from the GitHub API, every workflow file in every
one of the four repos the contract names:

| Repo | Workflows | Status |
|---|---|---|
| `website` (wave branches) | `build.yml` 28 `uses:`, `ci.yml` 5, `gate.yml` 5 | **0 not SHA-pinned** |
| `phd-milestones` | `ci.yml`, `publish.yml` | SHA-pinned **except** `djjay0131/website/contract/publish@main` |
| `agentic-kgis` | `ci.yml` (6), `docs-publish.yml` (5) | **nothing pinned** — incl. `djjay0131/website/contract/publish@main` |
| `construction-ai-proposal` | `build-and-publish-pdf.yml` (10) | **nothing pinned** — `xu-cheng/latex-action@v3` ×6, `softprops/action-gh-release@v2`, … |

My first sweep listed only one workflow per repo because a `while read` subshell consumed the file list; re-run per
file, `phd-milestones/publish.yml` and `agentic-kgis/docs-publish.yml` both appeared, and both carry the mutable
`@main` reusable-workflow reference. Per the coordinator the latter two repos are not yet hub satellites and hold no
cloud identity, so a compromise there cannot reach the bucket today — but the contract names all four repos and the
finding is factual and unchanged.

**Smallest change that closes check 6:** pin every `uses:` by SHA in `agentic-kgis` and `construction-ai-proposal`,
and pin `djjay0131/website/contract/publish` to a SHA in both satellites that consume it. The dependency half is
already closed.

---

### 7. Static public site — **FAIL**, on one remaining cause of the three

`firebase.json` on `feat/site-wave-0` declares **no functions and no SSR**, asserted structurally rather than by eye:

```
top-level keys: ['hosting']          has "functions" key: False
hosting keys:  ['public','ignore','cleanUrls','trailingSlash','rewrites','headers']
rewrites:      ['/p/**', '/session', '/session/end', '/client-events']
any rewrite with "function": []      public: site/dist-public
```

And the site itself emits nothing that runs at request time — `output: 'static'`, no adapter, and **zero** server
artifacts in either build output (see check 1).

**Your decision 2 is done.** §8 on `admin/wave-0-preconditions` now lists both routes, with a dated note:

```
$ git show admin/wave-0-preconditions:llm/specs/2026-09-10-research-hub-design.md
> **Amended 2026-09-21.** The rewrite list above gained `/session/end` and
> `/client-events`, and this note records why it was wrong for four days.
...
      { "source": "/p/**", ... }, { "source": "/s/**", ... }, { "source": "/session", ... },
      { "source": "/session/end", ... }, { "source": "/client-events", ... }, { "source": "/share/**", ... }
```

That is reason 3 closed, and the note is a better record than the amendment alone would have been.

**Reason 2 is closed by your merge-order inversion — reason 1 is not.** Checked on every branch:

```
$ for b in main feat/site-wave-0 feat/gate-signout feat/infra-wave-0 admin/wave-0-preconditions; do
    git show $b:llm/governance/adr/0013-unauthenticated-client-telemetry-endpoint.md | head -3; done
main:                       fatal: ... exists on disk, but not in 'main'.
feat/site-wave-0:           fatal: ... not in 'feat/site-wave-0'.
feat/gate-signout:          fatal: ... not in 'feat/gate-signout'.
feat/infra-wave-0:          fatal: ... not in 'feat/infra-wave-0'.
admin/wave-0-preconditions: # ADR-0013: The gate exposes an unauthenticated client-telemetry endpoint
                            Status: Proposed
                            Date: 2026-09-19
```

The §8 amendment rides the same branch. `git show main:…design.md` still lists four rewrites.

**Answering your question directly: the inverted merge order is necessary, and it is not sufficient.**

- It closes reason 2. If #45 lands first or simultaneously, then at the instant #48 ships the rewrite, `main`
  carries a §8 that names `/client-events` and `/session/end`, and carries ADR-0013. The route stops being
  authorised by nothing on the default branch. That was the substantive objection and it is answered.
- It does not touch reason 1. ADR-0013 would arrive on `main` reading `Status: Proposed` while the decision it
  proposes has already been implemented in code *and* written into design authority by its own decision 2. That is
  a record that contradicts itself, and the check-7 line turns on whether the shipped rewrite set is authorised.
  An ADR that still says "Proposed" is a proposal, not an authorisation.

**Smallest change that closes check 7:** flip ADR-0013 to `Status: Accepted` on `admin/wave-0-preconditions` — one
line, on a branch that is already merging first — and land #45 before or with #48 as you have now sequenced it.
With both, I would mark this line PASS. I am not marking it PASS today on the strength of a merge order that has
not happened: a plan is not a state, and the whole discipline of this sprint is that an intention recorded in a
document has not been carried out until the edit exists.

---

### 4. Identity — **FAIL** (unchanged), with one premise now genuinely changed

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
invoker is `allUsers` — is still bound in production, and the narrowed custom role still does not exist.

**Terraform is still applied by hand.** I re-checked rather than inheriting it: across `build.yml`, `ci.yml` and
`gate.yml` on all four branches, the string `terraform` appears only inside two `::error::` messages instructing a
human to run `terraform output`. There is no `terraform apply` in CI. **Merging #53 moves no IAM binding.**

**Proposed state is correct, and I re-ran the plan rather than citing the previous run.** My first attempt
**failed** — `Error: No value for required variable` for `project_id` and `billing_account`, exit 1, no plan at all.
That is a plan that did not run, and it would have read as "no changes" to anyone skimming. Re-run with the var
file:

```
$ terraform plan -input=false -lock=false -no-color     (#53's infra/, live state, scratch copy, NEVER applied)
  # google_project_iam_custom_role.gate_session_minter will be created
      + permissions = ["firebaseauth.users.createSession", "firebaseauth.users.get"]
      + role_id     = "gateSessionMinter"
  # google_project_iam_member.hub_gate_auth_admin will be destroyed
      - role = "roles/firebaseauth.admin" -> null
      - id   = "cusati-hub/roles/firebaseauth.admin/serviceAccount:hub-gate@cusati-hub..." -> null
  # google_project_iam_member.hub_gate_session_minter will be created
  # google_project_iam_custom_role.private_bucket_auditor will be created
  # google_service_account.hub_auditor will be created
  # google_service_account_iam_member.hub_auditor_wif_main will be created
  # google_project_iam_member.hub_auditor_policy_reader will be created
  # google_logging_metric.gate_misconfigured will be created
  # google_monitoring_alert_policy.gate_misconfigured will be created
  # google_cloud_run_v2_service.gate will be updated in-place
Plan: 8 to add, 1 to change, 1 to destroy.
```

It touches **neither** the Firestore ruleset/release nor the budget (0 change lines for each; both merely refreshed).

#### The one thing that changed — and the distinction I am not eliding

Google sign-in **is now configured**, so the gate I placed on the apply is lifted:

```
$ curl -H "x-goog-user-project: cusati-hub" .../admin/v2/projects/cusati-hub/defaultSupportedIdpConfigs
{"defaultSupportedIdpConfigs":[{"name":"projects/410552878319/defaultSupportedIdpConfigs/google.com",
                                "enabled": true, "clientId": "...", "clientSecret": "<redacted>"}]}

$ same request WITHOUT the x-goog-user-project header   -> http=403
```

(The header matters exactly as the brief warns: without it the call 403s, and a naive parser would read that as an
empty provider list and conclude Google sign-in is *not* configured. The response also carries an OAuth client
secret, which is why no response body is quoted in full anywhere in this handoff.)

**What that does and does not mean.** It removes my objection to *performing* the apply: narrowing
`roles/firebaseauth.admin` to `gateSessionMinter` can no longer strand the project without a configured sign-in
provider, because one is configured and enabled. It does **not** make the narrowing verified. The binding is still
`roles/firebaseauth.admin` in production; `gateSessionMinter` still returns `NOT_FOUND`; the two permissions in the
plan have never existed as a role, let alone been exercised by the gate against a real sign-in. Those are different
claims and I am recording them separately: **the blocker on the apply is lifted; the apply has not happened; the
check remains false.**

#### What does pass on this check, re-verified live

- **No JSON key anywhere.** User-managed keys on `hub-deploy`, `gate-deploy`, `publish-cv`,
  `publish-phd-milestones`, `hub-gate`: **0 each**. `google_service_account_key` count in state: **0**;
  `private_key_id` / `BEGIN PRIVATE KEY` in `infra/terraform.tfstate`: **0 matches**. Actions secrets:
  `website` 0, `phd-milestones` 0, `agentic-kgis` 0, `construction-ai-proposal` 0.
  `git log --all -S'"type": "service_account"'` → 5 commits, all prose (this contract, the two prior handoffs, a
  governance report, a reviewer report).
- **WIF ref pins, per the contract's 2026-09-18 correction** — read from each service account's own
  `workloadIdentityUser` binding, **not** from the provider:

```
hub-deploy              roles/iam.workloadIdentityUser <- .../github-actions/attribute.repository_id_ref/1212933399/refs/heads/main
gate-deploy             roles/iam.workloadIdentityUser <- .../github-actions/attribute.repository_id_ref/1212933399/refs/heads/main
publish-cv              roles/iam.workloadIdentityUser <- .../satellites/attribute.repository_id_ref/1211056144/refs/heads/master
publish-phd-milestones  roles/iam.workloadIdentityUser <- .../satellites/attribute.repository_id_ref/1373915518/refs/heads/main
```

  Two separate pools; the branches genuinely differ (`cv` is `master`); each numeric id matches the GitHub API
  (`website` 1212933399, `cv` 1211056144, `phd-milestones` 1373915518). I record **no** PASS for "the provider pins
  the ref" — it does not — and raise **no** FAIL from the provider's silence.
- **No satellite role holds `storage.objects.list`**, read live from the role, not from Terraform:

```
satellitePublisher  : storage.objects.create;storage.objects.delete;storage.objects.get
privateObjectReader : storage.objects.get
privateSyncWriter   : storage.objects.create;storage.objects.delete;storage.objects.get;storage.objects.list
```

**Still not satisfied, and still untestable by attempt.** Item 3 (the dedicated private-sync identity) remains
unimplemented: `hub-deploy` still holds `privateSyncWriter` on the private bucket, live and in the plan. The
contract's "test it by attempting the access and being refused" still cannot run — impersonation fails at the
impersonation step (`iam.serviceAccounts.getAccessToken` denied), which proves nothing about bucket access either
way. **That sub-test is NOT TESTED**, unchanged.

**Sequencing preconditions for #53 are still absent** (unchanged, and they ride the same apply):
`hub-auditor` is not in `gcloud iam service-accounts list`; `privateBucketAuditor` → `NOT_FOUND`; the
`GCP_AUDITOR_SA` repository variable → **ABSENT**.

---

## The astro upgrade: nothing regressed, and the boundary claim is narrower than reported

I built `feat/site-wave-0` from a clean `npm ci` in scratch — **astro 7.3.3 installed and confirmed at the
binary**, not just pinned in `package.json`:

```
installed astro: 7.3.3
NPM CI EXIT=0 · FIXTURE EXIT=0 · BUILD:PUBLIC EXIT=0 · BUILD:PRIVATE EXIT=0
dist-public: 157 files · dist-private: 84 files
[hub-private-build] checked 83 emitted path(s) against the gate's allowlist (SD-7)
```

### 1. Private content never on the public path — **PASS**, re-proved red on the upgraded build

```
$ npm run check:no-private-in-public          (astro 7.3.3 dist-public)
check:no-private-in-public: 2 private item(s) to look for in dist-public:
  phd-milestones/milestones — needles: qualified-id, slug, route, source, payload-path, title, summary
  phd-milestones/committee-dossier — needles: qualified-id, slug, route, source, payload-path, title, summary

check:no-private-in-public: PASS — no private slug, source, route, payload path, title or summary appears
in any path or any file's contents under dist-public (157 files scanned).
CONTROL EXIT=0
```

The needles are real (two published private items), so this is not the empty-set condition that made the guard
prove nothing for a whole phase. **I planted and observed red twice, each against a copy; the real `dist-public`
was never modified**, and in each case I verified the plant was actually written before believing the result — the
failure mode the rerun recorded hitting.

```
PLANT A — a private TITLE only, no slug, path or route anywhere near it:
  file written? size=38 bytes
  x-payload.json
    contents: title of phd-milestones/committee-dossier — "Committee Dossier (fixture)"
  PLANT-A EXIT=1

PLANT B — a private route <loc> in the sitemap (anchor asserted unique first):
  anchor count('</urlset>') = 1
  sitemap size before=2011 after=2094
  sitemap-0.xml  contents: qualified-id / slug / route / source of phd-milestones/committee-dossier
  PLANT-B EXIT=1
```

Plant A is the one that matters: it exercises the **contents** half independently of the path half (K11, the clause
ADR-0005 overruled the brief on). And the declared failure mode still announces itself rather than printing a
reassuring pass:

```
$ node scripts/check-no-private-in-public.mjs --dist <copy> --sources <empty dir>
check:no-private-in-public: NO PRIVATE ITEMS are published, so there was nothing to look for and this run
proves nothing about <copy>. ...
EMPTY-SOURCES EXIT=0
```

Wave 3 clauses (Pagefind, RSS, OG images) are not applicable this wave. The carried-forward limit stands: OG images
are binary and matched by path only.

### 3. The gate — **PASS**, with a new finding (S-5)

**`/p/**` signed-out, both transports, live, attributed by the container log line per the 2026-09-18 correction —
not by byte count:**

```
                                jason.cusati.us          hub-gate-…run.app
  /p/                        -> 404  426 bytes           404  426 bytes
  /p/index.html              -> 404  426 bytes           404  426 bytes
  /p/nonexistent-xyz/        -> 404  426 bytes           404  426 bytes
  cache-control              -> private, no-store        private, no-store
```

and one matching container line per probe, twelve in all:

```
2026-09-21T19:29:44.904381Z  INFO gate event=deny scope=private stage=session reason=no_session_cookie
```

**No existence oracle**, both transports, signed-out — a real published slug and an absent one:

```
  /p/phd/phd-milestones/milestones/  -> 404 426     /p/phd/phd-milestones/zzz-absent/ -> 404 426
  cmp: IDENTICAL (no existence oracle)              body marker: <html lang="en">   (quoted -> the gate's own)
```

**Traversal**, all twelve hostile spellings, `--path-as-is`, both transports — every one refused, none returning
private bytes, each with a matching `event=deny` line proving it reached the gate:

```
/p/../index.html  /p/..%2findex.html  /p/..%252findex.html  /p/%2e%2e%2f…  /p/a%00.html
/p/%c0%ae%c0%ae/… /p/PHD/MILESTONES/INDEX.HTML  /p//phd/…  /p/phd//…  /p/phd/./…
/p/../../../etc/passwd  /p/back\slash.html
```

**dist-private filename allowlist (SD-7) — made to fail**, on the upgraded build:

```
planted: src-private/pages/bad dir/index.astro (36 bytes)
BUILD:PRIVATE (planted) EXIT=1
  [ERROR] [hub-private-build] ... bad dir/index.html   offending segment: "bad dir"
  The gate validates /p/{path} with an ALLOWLIST -- every segment must match [A-Za-z0-9._-] ...
reverted -> BUILD:PRIVATE EXIT=0 ; checked 83 emitted path(s) against the gate's allowlist (SD-7)
```

The build throws before the receipt is written, so an unservable tree cannot sync.

**The gate's own suite executes and is green.** Counted from `--junitxml`, because `pytest -q` emits no summary
under this repo's `addopts = "-q --strict-markers"`:

```
junit totals: {'tests': '295', 'failures': '0', 'errors': '0', 'skipped': '0'}
  test_cookie_attributes_match_the_adr[hosting] / [direct]              passed
  test_overlong_path_is_rejected                                        passed
  test_an_unaccepted_origin_is_refused_however_it_spells_its_host_headers[forged-x-forwarded-host,
      x-forwarded-host-comma-list, forged-host, no-host-games]          passed
  test_sign_out_refuses_every_request_when_no_origin_is_configured      passed
```

**I hit the "it did not actually run" trap twice more here and recorded it rather than shipping the number.** My
first suite run reported **5 skipped**, all `test_monitoring_contract::*` — because I had extracted `gate/` without
`infra/`, exactly the mistake the rerun documented. Adding `infra/` left **1 skipped**; adding `.github/` too left
**0**. Only the last run is evidence.

**#57 is resolved and the test genuinely executes in both compositions** (not skipped):

| Tree | Result | `test_every_alert_policy_has_a_notification_channel` |
|---|---|---|
| #47 gate tests + `main`'s `infra/` | 295 tests, 0 failures | **passed** |
| #47 gate tests + #53's `infra/` | 295 tests, 0 failures | **passed** |

#### S-5 (new) — Firebase Hosting answers a null byte under `/p/` with a **500**, and the request never reaches the gate

```
                                   jason.cusati.us            hub-gate-…run.app
  /p/a%00.html                  -> 500  14 bytes "Internal Error"   404  426 bytes (the gate)
```

Reproduced three times. It is **specific to the rewrite prefix**, not a site-wide behaviour:

```
  jason.cusati.us /a%00.html        -> 404 21376   (the static site's own 404)
  jason.cusati.us /nonexistent%00   -> 404 21376
  jason.cusati.us /index%00.html    -> 404 21376
  jason.cusati.us /p/a%01.html      -> 404   426   (reaches the gate normally)
```

And it **never reaches the container** — a single Hosting-only probe at `19:37:10.123Z`, then the log:

```
$ gcloud logging read '… timestamp>="2026-09-21T19:36:50Z" AND timestamp<="2026-09-21T19:38:30Z"'
(no output)
```

That is precisely the diagnostic the contract gives for `/healthz`: a response with no container log line never
reached the service. So the 500 is produced by Hosting's Cloud Run rewrite proxy, above the gate.

**Why this is a finding and not the FAIL.** It discloses nothing: a 14-byte `Internal Error`, no private bytes, and
**no existence hint** — a real slug and an absent slug with the same null byte return byte-identical 500s:

```
  /p/phd/phd-milestones/milestones/a%00.html  -> 500 14 body=[Internal Error]
  /p/phd/phd-milestones/zzz-absent/a%00.html  -> 500 14 body=[Internal Error]
```

It is also not caused by anything in this wave — the `/p/**` rewrite is byte-identical on `main` and #48, and
neither the gate nor Hosting changed. Both prior runs recorded `/p/a%00.html` as `404 329`, but those were measured
against branch code over uvicorn, never through Hosting; this is newly *observed*, not newly *broken*.

**Where it strains the contract, stated plainly rather than smoothed over.** Check 3 asks for refusal on both
transports "with an IDENTICAL status". 500 ≠ 404. I am not failing the line on it, for the same reason run 1
declined to fail on the 302/307 divergence and run 2 marked the check PASS: the divergence appears only on
malformed spellings no legitimate client emits, the refusal holds, no bytes escape, and there is no oracle. On every
well-formed path the two transports are byte-identical. **You may reasonably read the clause more strictly than I
have; if you do, check 3 becomes a fourth FAIL, and the disposition should be recorded either way rather than left
to the next run to rediscover.** A 500 is also a worse signal than a 404 — it says "unhandled" where the design
says "refused" — and it is the one spelling in the set that makes the edge, not the gate, the thing answering.

### The base-path claim — tested, and it does not hold as reported

The upgrade stream reports that the base change *strengthens* the boundary: segment-boundary stripping means
`/p-archive/…` is no longer treated as under `/p/`. I tested it rather than accepting it, by executing **both**
versions' actual base-stripping code — astro 6.4.8 installed side by side in scratch, astro 7.3.3 from the branch's
own `npm ci`:

```
=== astro 6.4.8 (pre-upgrade), removeBase() verbatim from dist/core/app/base.js ===
  base="/p/"  /p/ok/index.html               -> "ok/index.html"
  base="/p/"  /p-archive/secret/index.html   -> "/p-archive/secret/index.html"     <- NOT stripped
  base="/p/"  /parchive/x                    -> "/parchive/x"                      <- NOT stripped
  base="/p"   /p-archive/secret/index.html   -> "archive/secret/index.html"        <- BYPASS
  base="/p"   /parchive/x                    -> "rchive/x"                         <- BYPASS

=== astro 7.3.3 (post-upgrade), stripRequestBase() ===
  base="/p/"  /p-archive/secret/index.html   -> "/p-archive/secret/index.html"     <- not stripped
  base="/p"   /p-archive/secret/index.html   -> "/p-archive/secret/index.html"     <- not stripped
  base="/p"   /parchive/x                    -> "/parchive/x"                      <- not stripped
```

The fix is real and it is where the diff says it is (`dist/core/app/base.js` DIFFERS between the versions;
`routing/router.js` and `preview/util.js` are byte-identical, so the hunt for it by grepping `stripBase` finds the
wrong function). But **two corrections to the claim**:

1. **The strengthening only applies to a base spelled without a trailing slash.** At this site's actual configured
   base — `SITE_BASE=/p/`, and `dist-private` emits `href="/p/…"` throughout — astro **6.4.8 already refused** to
   treat `/p-archive/` as under `/p/`. The upgrade did not close a hole this site had open.
2. **Neither version runs at request time here, so it strengthens nothing in production.** The site is
   `output: 'static'` with no adapter; both build outputs contain **0** `.mjs`/`.cjs` files and **0**
   `astro:middleware` markers; `firebase.json` declares no functions. Astro answers no request on the live path.

**What actually enforces the boundary, probed live:**

```
                                   jason.cusati.us                     hub-gate-…run.app
  /p-archive/                   -> 404 21376  max-age=3600             404 329  private, no-store
  /p-archive/secret/index.html  -> 404 21376  max-age=3600             404 329  private, no-store
  /parchive/x                   -> 404 21376  max-age=3600             404 329  private, no-store
```

Through Hosting, `/p-archive/…` does not match the `/p/**` glob at all and falls through to the static 404 — it is
never proxied to the gate, and no container log line exists for those probes. Directly, the gate answers its own
generic 404. **The boundary is correct, and it is held by the Hosting glob and the gate, not by Astro.** No file in
either build output has `p-archive` anywhere in its path.

The upgrade is still worth having — it clears a critical RCE by ID — but the security *rationale* offered for it in
the stream's report is not one I could reproduce, and it should not be recorded as a boundary improvement.

---

## The remaining checks

### 2. Private bucket — **PASS**, with S-1 still a live red

Read from the live bucket, from explicit fields rather than a blank-prone summary:

```
uniform_bucket_level_access: True        public_access_prevention: enforced
```

UBLA — the one that fails open — is true in production. Exactly **two** non-legacy principals (ADR-0010 decision 5):

```
projects/cusati-hub/roles/privateObjectReader -> serviceAccount:hub-gate@cusati-hub.iam.gserviceaccount.com
projects/cusati-hub/roles/privateSyncWriter   -> serviceAccount:hub-deploy@cusati-hub.iam.gserviceaccount.com
roles/storage.legacyBucketOwner  -> projectEditor:cusati-hub, projectOwner:cusati-hub
roles/storage.legacyBucketReader -> projectViewer:cusati-hub
roles/storage.legacyObjectOwner  -> projectEditor:cusati-hub, projectOwner:cusati-hub
roles/storage.legacyObjectReader -> projectViewer:cusati-hub
```

Anonymous access refused three ways: object via XML API **403**, via JSON API **401**, bucket listing **401**.

All five clauses of the line hold, so it passes — and **S-1 remains a live red**, unchanged from the rerun:
`roles/editor` on `cusati-hub` is non-empty (the default compute SA), and through the automatic legacy owner
bindings that is create/delete/get/**list**/update/setIamPolicy on every object in the private bucket. #55's guard
now sees it and fails on it. I keep it out of the verdict for the reason both prior runs did — the line's five
clauses hold and the legacy path is explicitly carved out — and flag the merge consequence under Risks.

### 5. Firestore — **PASS** (ruleset) + **NOT TESTED** (signed-in stranger)

```
$ GET firebaserules.googleapis.com/v1/projects/cusati-hub/rulesets
total rulesets in project: 1
   405d371b-01d1-475e-bfed-1763bd8de94c 2026-09-17T20:58:34.677471Z
$ GET .../releases
   release cloud.firestore -> 405d371b-01d1-475e-bfed-1763bd8de94c
```

Exactly one ruleset exists; had it been replaced per apply (the pre-#35 behaviour) there would be many. The released
source, read from the live API rather than from Terraform, is deny-all for every client SDK caller. **#53 does not
regress it** — the plan refreshes both `google_firebaserules_ruleset.firestore_deny_all` and
`google_firebaserules_release.firestore` and lists **0** change lines for either.

```
$ GET firestore.googleapis.com/v1/projects/cusati-hub/databases/(default)/documents/members   -> 403
    {"code": 403, "message": "Missing or insufficient permissions.", "status": "PERMISSION_DENIED"}
$ ... /documents/shares                                                                       -> 403
```

Run with the project's **real** public web API key from repo variables, and sanity-checked first — a rejected key
returns a 403 that is indistinguishable from rules enforcement, which is how the rerun nearly recorded a false PASS.
The key validates (`accounts:signUp` → `400 ADMIN_ONLY_OPERATION`, the service answering, not refusing the key).

I still could not obtain a real signed-in-stranger token: anonymous sign-in remains disabled and I hold no
non-allowlisted Google account. The deny-all ruleset makes the signed-in case follow a fortiori, but the contract
says "prove it with a real token". **NOT TESTED**, unchanged. What would test it: a real non-member Google account
signs in at `/signin`, then its `idToken` is used against the same two endpoints.

### 8. Cost — **PASS**

```
google_billing_budget.hub
  id: billingAccounts/011A3C-D3061E-8B0DB7/budgets/a9c301a5-6f2e-44bc-b9e3-c56f220bb3da
  amount: specified_amount USD units "5"        threshold_rules: 4
budget.tf: prevent_destroy = true ; thresholds 0.5 / 0.9 / 1.0 / 1.0(forecast)
google_service_account_key count in state: 0
```

The plan refreshes the budget and lists **0** change lines for it, so #53 does not touch it.

### 9. Logging — **PASS**, S-4 unchanged

```
$ gcloud logging read '… textPayload:"event="' --freshness=10d --limit 400
    151 event=deny          71 event=allow        11 event=client_signin_failed
      2 event=reject         1 event=client_xevent  1 event=client_probe   1 event=boot

2026-09-18T15:48:18.338158Z  INFO gate event=boot logging=StreamHandler(stdout)
```

`event=boot` is present at the current revision's start, so the 2026-09-18 handler fix is real in production.
`event=deny` and `event=client_signin_failed` are the two strings `infra/monitoring.tf` filters on, and both are
live. `event=allow scope=signout` cannot exist live yet — `/session/end` is still not deployed; the live revision is
`hub-gate-00005-n4g` and its env block carries only `GOOGLE_CLOUD_PROJECT` and `GATE_PRIVATE_BUCKET`, with
`GATE_ALLOWED_ORIGINS` absent. It is evidenced on the branch instead (295 tests, the named sign-out tests above).

**No secret or token in any log line.** Eleven patterns, zero hits across 593 lines covering all of my probes:

```
  eyJ 0 · ya29 0 · gho_ 0 · ghp_ 0 · github_pat 0 · AIza 0 · X-Goog-Signature 0
  token= 0 · secret= 0 · password= 0 · GOCSPX 0
```

**S-4 unchanged** and visible in my own evidence above: uvicorn's access lines carry full request paths into Cloud
Logging regardless of `GATE_LOG_OBJECT_PATHS` (`INFO: … - "GET /p/nonexistent-xyz/ HTTP/1.1" 404 Not Found`). Once
real private content is served, `/p/<private-slug>` will be in the logs. Not a secret or token, so not a FAIL of
this line's wording — but the control remains partial and the config comment still overstates it.

### 10. Repos — **PASS**

```
djjay0131/phd-milestones           private=true  visibility=private id=1373915518 default_branch=main
djjay0131/agentic-kgis             private=false visibility=public  id=1295802912 default_branch=main
djjay0131/construction-ai-proposal private=false visibility=public  id=1134376420 default_branch=master
djjay0131/website                  private=false visibility=public  id=1212933399 default_branch=main
```

`phd-milestones` is **PRIVATE**, checked via the API, and its id matches the WIF pin exactly. The other two are
still not hub satellites (no `publish-kgis` service account exists; the `satellites` pool holds exactly two
providers), so there is nothing publishing to the hub from either to assess for `visibility: public`.

---

## Summary

Wave 0 is **BLOCKED** on three checks — the same three as the re-run, but two of them are now a single remaining
cause each, and both are cheap.

**Check 6's dependency half genuinely cleared, and I verified it the way the brief demanded.** The upgrade takes
`npm audit` from 17 findings on `main` to **0**, and I confirmed that by GHSA ID against the advisory database
rather than by watching a total fall: `GHSA-26w7-cxv4-gfx2` (critical AVIF RCE) is patched at 7.2.8 and the
lockfile carries 7.3.3; `GHSA-376h-93r7-7g6f` (base-path boundary) is patched at 7.2.4; both `sharp` advisories are
patched at 0.35.0 and 0.35.4 against an installed 0.35.4. The registry's bulk endpoint returns nothing for the
installed versions and all seven advisories for the old ones. And I made the upgraded lockfile's own audit go red by
downgrading `astro` inside it, so the zero is being computed from that file. What still fails is the **other half**,
untouched: `agentic-kgis` and `construction-ai-proposal` pin no action by SHA at all, and
`djjay0131/website/contract/publish@main` is a mutable reference in both satellites that consume it.

**Check 7 is down to one cause, and your merge-order inversion is necessary but not sufficient.** Decision 2 has
been carried out — §8 now lists `/client-events` and `/session/end`, with a dated note that is a better record than
the bare amendment would have been. Landing #45 first or simultaneously closes the second reason, which was the
substantive one: the route stops being authorised by nothing on `main` at the moment the rewrite ships. What remains
is that ADR-0013 still reads `Status: Proposed` while the decision it proposes is already implemented in code and
already written into design authority by its own decision 2. Flip that one line on #45 and I would mark this line
PASS. I will not mark it PASS today on a merge order that has not happened: the recurring failure this sprint is a
document asserting a change that was never made, and "it will be authorised once we merge" is the same shape.

**Check 4 is unchanged and is the only substantive FAIL.** `roles/firebaseauth.admin` is still bound to `hub-gate`
in production and `gateSessionMinter` does not exist. Merging #53 changes none of it — I re-confirmed there is no
`terraform apply` anywhere in CI. The plan is correct and pending (8 add, 1 change, 1 destroy, destroying the
`firebaseauth.admin` binding and creating a role with exactly two permissions). **One thing did change: Google
sign-in is now configured and enabled, so my objection to performing the apply is lifted.** That is a different
statement from "the narrowing is verified", and I am keeping them apart: the blocker on the apply is gone, the apply
has not run, and until it does, a service whose invoker is `allUsers` can delete users and rewrite the sign-in
configuration.

**On the upgrade itself: nothing regressed, and one claim did not survive testing.** Built from a clean `npm ci` at
astro 7.3.3, the leak check still has real needles and still goes red on a title-only plant and on a sitemap-route
plant; `/p/**` refusals are byte-identical on both transports with a matching `event=deny` per probe and no
existence oracle; `dist-public` is free of private slugs across 157 files; `firebase.json` declares no functions and
no SSR, and both build outputs contain zero server artifacts. The SD-7 filename guard still fails the build on a
planted bad segment. But the stream's claim that the base change *strengthens* the `/p/` boundary is not
reproducible as stated: executing both versions' real code shows 6.4.8 was **already** boundary-correct at this
site's configured base (`/p/`, with the trailing slash), the fix only matters for a base spelled without one, and
neither version runs at request time here at all. The live `/p-archive/` boundary is held by the Hosting glob and
the gate, which I probed directly. The upgrade is worth having for the RCE; it should not be recorded as a boundary
improvement.

**One new finding, S-5.** Firebase Hosting answers `/p/a%00.html` with a **500 "Internal Error"** while the direct
`*.run.app` transport returns the gate's ordinary 404 — and a Hosting-only probe produced **no container log line**,
so the request never reached the service. It is specific to the rewrite prefix (`/a%00.html` and `/nonexistent%00`
get the ordinary static 404), it leaks no bytes, and it is not an oracle (a real slug and an absent slug both return
byte-identical 500s). It predates this wave. I have not failed check 3 on it, consistent with how both prior runs
dispositioned transport divergence on malformed spellings — but it does strain the contract's "IDENTICAL status"
clause, and I would rather you overrule me explicitly than have the next run rediscover it.

**Three measurement failures of my own, caught and recorded, because the brief asks for exactly this.**

1. **`actionlint` did not run the first time.** I passed `-color=never`, an invalid flag; it exited **2** having
   checked nothing, printing 2200 bytes of usage text that scrolls like output. Re-run with `-no-color`, plus a
   deliberately broken workflow as a control that exits 1.
2. **`terraform plan` did not run the first time.** Missing `project_id` and `billing_account` → exit 1, no plan
   body at all. My grep for "firebaseauth" over that log returned nothing, which is precisely the empty verdict that
   reads as "no problems found". Re-run with the var file; only the second run is evidence.
3. **The gate suite skipped tests I would have counted as passing — twice.** First run: 5 skipped, all
   `test_monitoring_contract::*`, because I extracted `gate/` without `infra/` — the same trap the re-run
   documented. Adding `infra/` left 1 skipped; adding `.github/` left **0**. Only the 295/0/0/0 run is quoted above,
   and the #57 result uses both infra compositions with the test confirmed executing by name in each.

Separately, my first sweep of satellite workflows listed one file per repo because a `while read` subshell ate the
list — `phd-milestones/publish.yml` and `agentic-kgis/docs-publish.yml` were invisible, and both carry the mutable
`@main` reference that is part of the check 6 finding.

## Assumptions

- The live project is `cusati-hub`; `jason.cusati.us` and `hub-gate-ywkmredngq-ue.a.run.app` are the two transports.
- The astro 7.3.3 evidence comes from a **clean `npm ci`** of `feat/site-wave-0`'s own lockfile in scratch, with the
  installed version read from `node_modules/astro/package.json`, not from `package.json`'s range. The repository
  worktree's `site/` was never built or modified.
- `terraform init`/`plan` ran on a scratch copy of #53's `infra/` with a copy of the local state and the worktree's
  `terraform.tfvars`, read-only, `-lock=false`, in `hashicorp/terraform:1.14.0`. **`apply` was never invoked** and
  `infra/` in the worktree was never modified.
- #47's runtime behaviour is evidenced by its **own test suite** (295 tests, 0 failures, 0 skipped, counted from
  `--junitxml`), not by a deployed revision: `/session/end` is still not deployed. Every claim sourced that way is
  labelled.
- `npm audit` ran with `--package-lock-only` against lockfiles extracted from the branches, with `main`'s as a
  same-moment control.
- I treat the contract's two dated corrections as authoritative: the ref pin was checked on each service account's
  `workloadIdentityUser` binding rather than on the provider, and 404s were attributed by container log line rather
  than by body size.
- The Identity Platform response contains an OAuth client secret. I recorded only that `google.com` is enabled; no
  token, secret or signed URL appears anywhere in this handoff.

## Recommendations

1. **Apply #53 — the blocker is gone, so do it.** Google sign-in is configured and enabled, which was the condition
   I placed on the apply. Merging is not applying. Verify afterwards with
   `gcloud iam roles describe gateSessionMinter --project cusati-hub` and the `hub-gate` role filter, both of which
   currently return the failing state quoted above.
2. **Flip ADR-0013 to `Status: Accepted` on #45**, and land #45 before or with #48 as you have now sequenced it.
   That is the whole of what check 7 still needs.
3. **Pin every `uses:` by SHA** in `agentic-kgis` (11) and `construction-ai-proposal` (10), and pin
   `djjay0131/website/contract/publish` to a SHA in both satellites. That is the whole of what check 6 still needs.
4. **Record a disposition for S-5** — the Hosting 500 on a null byte under `/p/` — either as accepted (with the
   reasoning that it leaks nothing and is not an oracle) or as a defect to raise with Firebase. Do not leave it for
   the next run to rediscover.
5. **Correct the record on the astro base claim.** The upgrade clears a critical RCE; it does not strengthen the
   `/p/` boundary at this site's configured base, and nothing in the built output runs at request time. Anyone
   relying on it as a boundary improvement is relying on something I could not reproduce.
6. **Sequence the live-IAM job** before or with the #53 merge: apply Terraform (creating `hub-auditor` and
   `privateBucketAuditor`), set `GCP_AUDITOR_SA`, and remove `roles/editor` from the default compute service
   account. All three are still absent, and `main` goes red on merge without them.
7. **Merge #48 before or with #47** (G-R1), and **deploy #47 and #53 together** so `GATE_ALLOWED_ORIGINS` exists
   when the code that requires it starts — the live revision's env block still lacks it.
8. **Re-probe `/session/end`, `/client-events` and the `event=allow scope=signout` class in production after the
   deploy.** All three are branch evidence today.
9. **Land item 3** and update `EXPECTED_PRIVATE_BUCKET_BINDINGS`, so the public deploy identity stops holding write
   access to the private bucket.
10. **Give the Checkpoint runner `roles/iam.serviceAccountTokenCreator`** on the target SAs, so check 4's "attempt
    the access and be refused" clause can run instead of being skipped a third time; and settle whether a non-member
    Google account is available, so check 5 stops being half NOT TESTED every wave.

## Alternatives considered

- **Passing check 6 because the advisories are clear.** Rejected. The line has two halves and names all four repos;
  the pinning half is factual, unchanged, and includes a mutable reusable-workflow reference that both satellites
  execute. Passing on the improved half would be grading on movement rather than on the stated bar.
- **Passing check 7 because the merge order is now inverted.** Rejected, and this was the closest call of the run.
  The inversion genuinely answers the substantive objection. But it has not happened, and ADR-0013 would still
  arrive on `main` saying "Proposed" about a decision already implemented and already written into design authority.
  I have said exactly what closes it, and it is one line.
- **Failing check 3 on S-5.** Rejected, consistent with both prior runs' treatment of transport divergence on
  malformed spellings: the refusal holds, no bytes escape, there is no oracle, and every well-formed path is
  byte-identical across transports. Flagged prominently rather than buried, and explicitly offered for overrule.
- **Failing check 2 on the live `roles/editor` red.** Rejected, consistent with both prior runs. All five clauses of
  the line hold and the legacy path is explicitly carved out of the two-principal invariant.
- **Failing check 9 on S-4.** Rejected again. The line asks that no secret or token appear, and none does.
- **Treating the astro upgrade's base claim as an additional PASS for check 7's static half.** Rejected — testing it
  showed the opposite of what was reported, and a security claim that cannot be reproduced should not be counted as
  evidence in either direction.
- **Re-running the #54 forgery against production.** Rejected again: it would write attacker-shaped data into the
  live metrics, which is the attack. The live revision's identity and env block are sufficient evidence the fix is
  not deployed.

## Risks

- **Check 4 stays false after every merge in this wave.** The only action that closes it is `terraform apply`, and
  nothing in CI performs it. This has now failed for the same reason three runs running. There is a real risk of the
  wave being recorded as closed while the `allUsers`-invoked gate still holds `roles/firebaseauth.admin`.
- **`main` goes red the moment #53 merges**, for two independent and legitimate reasons — `hub-auditor`,
  `privateBucketAuditor` and `GCP_AUDITOR_SA` do not exist, and the live check correctly fails on the unremediated
  `roles/editor` grant. That is the guard working, but it will look like a broken pipeline to anyone who has not
  read this.
- **`GATE_ALLOWED_ORIGINS` spans two branches.** #47 reads it, #53 renders it; the live revision has neither.
  Deploying #47 alone takes sign-out down entirely — loudly, at the deploy smoke test, which is the right direction.
- **Production metrics remain forgeable until #47 deploys.** #54 is fixed in code only.
- **`projectEditor` on the private bucket is live, not hypothetical**, bounded only by nothing running as the
  default compute service account and the Compute API staying disabled. Neither is enforced.
- **S-5 puts the edge, not the gate, in the answering position for one input class.** Today it refuses safely. If
  Hosting's handling of malformed paths under a Cloud Run rewrite ever changes, nothing in this repository would
  notice, because no test and no guard probes that layer.
- **The astro major bump is now in the wave.** It builds clean, the suite is green and the leak check still goes red
  on plants — but it is a framework major landing alongside three other PRs, and the security rationale offered for
  it was partly wrong, which is a reason to read its behavioural changes rather than its release notes.
- **This verdict covers the branches as they stand on 2026-09-21.** Checks 6 and 7 close without redesign; check 4
  closes only with an apply.

## Open questions

1. Who runs `terraform apply`, and when, relative to the #53 merge? The sign-in precondition I set is now met, so
   this is the last thing standing between check 4 and PASS.
2. Is S-5 (Hosting's 500 on a null byte under `/p/`) accepted, or raised with Firebase? And do you read the
   "IDENTICAL status" clause strictly enough to make it a FAIL?
3. Will `roles/editor` be removed from the default compute service account in this wave, or is the red on `main`
   accepted for a period — and recorded where?
4. Who owns pinning `djjay0131/website/contract/publish` to a SHA, given the two consuming repos are outside this
   wave? That single reference is executed by a repo that *is* a satellite.
5. Should the astro upgrade's report be corrected in STATE, given its boundary claim did not reproduce?
6. Is a non-member Google account available for Checkpoint use, so check 5's signed-in-stranger half stops being
   NOT TESTED every wave?

## Related docs

- `llm/specs/2026-09-10-research-hub-design.md` §8 (amended 2026-09-21 on `admin/wave-0-preconditions`), §12 and
  §12.4
- `llm/governance/adr/0004`, `0005`, `0007`, `0010`, and **`0013-unauthenticated-client-telemetry-endpoint.md`**
  (`Status: Proposed`, on `admin/wave-0-preconditions` only)
- `llm/sprints/2026-09-hub/contracts/security-tester-wave-0.md` — including its two dated corrections
- `llm/sprints/2026-09-hub/handoffs/security-wave-0.md` and `security-wave-0-rerun.md` — the verdicts this supersedes
- `llm/sprints/2026-09-hub/handoffs/infra-wave-0.md`, `gate-wave-0.md`, `site-wave-0.md`, `red-team-wave-0.md`,
  `boundary-tester-wave-0.md`
- `llm/sprints/2026-09-hub/STATE.md` §Wave 0 dispositions — RT-1, RT-12, G-R1, A-1
- Issues #54, #55, #57, #58 and PRs #45, #47, #48, #53 — all **open** at the time of this run

## ADR candidates

1. **Who applies Terraform, and how a merged-but-unapplied change is tracked.** Check 4 has now failed three times
   for the same reason, and the gap between "merged" and "true in production" is written down nowhere.
2. **Dependency-advisory policy.** What "no high or critical" means, that clearance is verified by advisory ID
   rather than by a falling total, and who may grant a time-boxed exception when the only fix is a major bump.
3. **Action pinning across the satellite estate.** Which repos are in scope, that a reusable workflow referenced by
   a mutable ref is an unpinned dependency, and who owns repos outside the hub's waves.
4. **Legacy bucket bindings and project-role expansion.** That `projectEditor`/`projectViewer` are a standing
   path into the private bucket unless the bucket's whole IAM policy is replaced, and which project roles may
   therefore ever be granted.
5. **Request-path logging.** That uvicorn's access lines place `/p/**` paths into Cloud Logging regardless of
   `GATE_LOG_OBJECT_PATHS`, and whether the access logger is reconfigured or the setting's claim narrowed (S-4).
6. **What the two transports must agree on.** The contract says "IDENTICAL status"; three runs have now found
   spellings where Hosting and `*.run.app` differ (302/307, and now 500). The invariant worth asserting is probably
   "no private bytes, no existence hint, and a refusal" rather than byte-equal statuses on malformed input — but
   that is a decision, not a test result.
