BLOCKED

# Security Tester — Wave 0

Issued: 2026-09-18 · Run: 2026-09-18/19 · Contract: `contracts/security-tester-wave-0.md` · Issue #44 (hub-007)
Branches under review: **#47** `feat/gate-signout`, **#48** `feat/site-wave-0`, **#53** `feat/infra-wave-0`.
Method: `git diff main...<branch>` / `git show <branch>:<path>` only. **No branch was checked out. No git, `gh` or cloud
mutation was made. The worktree is clean (`git status --short` empty).**

**Independence.** I authored nothing under review. Every file I touched outside `/tmp` is this handoff.

---

## Verdict table

| # | Check | Verdict |
|---|---|---|
| 1 | Private content never on the public path | **PASS** |
| 2 | Private bucket | **PASS** (with finding S-1) |
| 3 | The gate | **FAIL** — `/session/end` CSRF check bypassed over real HTTP (S-2) |
| 4 | Identity | **FAIL** — gate SA still holds `roles/firebaseauth.admin`; item 3 not landed (S-3) |
| 5 | Firestore | **PASS** (ruleset half) + **NOT TESTED** (signed-in-stranger half) |
| 6 | Supply chain | **FAIL** — two satellite repos pin no action by SHA; 1 critical + 9 high in `npm audit --omit=dev` |
| 7 | Static public site | **FAIL** — `/client-events` is a rewrite in neither the contract's nor §8's authorised set |
| 8 | Cost | **PASS** |
| 9 | Logging | **PASS** (with finding S-4) |
| 10 | Repos | **PASS** |

**Four FAILs. Under the run brief §8 this blocks every merge in Wave 0.**

---

## 1. Private content never on the public path — PASS

The Phase 3 condition that made this guard prove nothing **no longer holds**: two private items are now published, so
the check has real needles.

```
$ node scripts/check-no-private-in-public.mjs
check:no-private-in-public: 2 private item(s) to look for in dist-public:
  phd-milestones/milestones — needles: qualified-id, slug, route, source, payload-path, title, summary
  phd-milestones/committee-dossier — needles: qualified-id, slug, route, source, payload-path, title, summary

check:no-private-in-public: PASS — no private slug, source, route, payload path, title or
summary appears in any path or any file's contents under dist-public (157 files scanned).
EXIT=0
```

**I planted and observed red three ways**, each against a *copy*; the real `dist-public` was never modified.

| Plant | Where | Exit |
|---|---|---|
| `demo:leak-check` (contents link + emitted route) | `index.html` + `phd/phd-milestones/milestones/index.html` | **1**, 9 leaks |
| `<loc>` for the dossier route | `sitemap-0.xml` | **1** |
| title only, no slug/path/route anywhere near it | a new `x-payload.json` | **1** |
| control: unmodified copy | — | 0 |

The third plant matters most: it proves the **contents** half independently of the path half, which is the clause
ADR-0005 overruled the brief on (K11).

```
  sitemap-0.xml
    contents: route of phd-milestones/committee-dossier — "/phd/phd-milestones/committee-dossier/"
  x-payload.json
    contents: title of phd-milestones/committee-dossier — "Committee Dossier (fixture)"
```

Control for the failure mode named in my brief — an empty private set:

```
$ node scripts/check-no-private-in-public.mjs --dist <copy> --sources <empty dir>
check:no-private-in-public: NO PRIVATE ITEMS are published, so there was nothing to look for
and this run proves nothing about <copy>. …
EXIT=0
```

It exits 0, but it **says so loudly** rather than printing a reassuring pass. The failure mode is declared, not hidden.

Wave 3 clauses (Pagefind index, RSS, OG images) are **not applicable this wave**. Recorded limit carried forward: OG
images are binary and are matched **by path only**, so a private title baked into an image would pass.

## 2. Private bucket — PASS, with finding S-1

Read from the **live bucket**, not from Terraform:

```
$ gcloud storage buckets describe gs://cusati-hub-private --format=json
  "public_access_prevention": "enforced",
  "uniform_bucket_level_access": true,
```

UBLA — the one that fails open — is **true in production**.

Exactly **two** non-legacy principals (ADR-0010 decision 5 — two, not one):

```
projects/cusati-hub/roles/privateObjectReader -> serviceAccount:hub-gate@cusati-hub.iam.gserviceaccount.com
projects/cusati-hub/roles/privateSyncWriter   -> serviceAccount:hub-deploy@cusati-hub.iam.gserviceaccount.com
```

**Both halves of the legacy question verified.** Legacy bindings *are* present and UBLA did *not* remove them:

```
roles/storage.legacyBucketOwner  -> projectEditor:cusati-hub, projectOwner:cusati-hub
roles/storage.legacyBucketReader -> projectViewer:cusati-hub
roles/storage.legacyObjectOwner  -> projectEditor:cusati-hub, projectOwner:cusati-hub
roles/storage.legacyObjectReader -> projectViewer:cusati-hub
```

…and no `roles/viewer` binding exists on the project, so `projectViewer` expands to the empty set and those two reader
bindings grant nobody anything today. The live script agrees:

```
OK: no principal holds roles/viewer on cusati-hub, so projectViewer expands to the empty set
OK: anonymous GET of build-info.json returned 401 -- refused
Private bucket IAM test passed.   LIVE CHECK EXIT=0
```

Anonymous access, three ways: object via XML API **403**, via JSON API **401**, bucket listing **401**.

### Making the guards fail

`check_private_bucket_config.py`, broken six ways, each red — and for the UBLA mutation I **verified the edit hit the
real assignment, not the comment**, which is the exact defect my brief flagged:

```
[before] 18:#   uniform_bucket_level_access = true. REQUIRED, and the single most dangerous
         79:  uniform_bucket_level_access = true
mutated 1 real assignment line(s)
[after]  79:  uniform_bucket_level_access = false
::error file=infra/private-bucket.tf::…must set uniform_bucket_level_access = true…   EXIT=1
```

| Mutation | Exit |
|---|---|
| `uniform_bucket_level_access = false` (real line 79) | 1 |
| `public_access_prevention = "inherited"` | 1 |
| `storage.objects.list` added to `private_object_reader` | 1 |
| `roles/firebaseauth.admin` re-added to `gate.tf` under a new resource name | 1 |
| a third principal bound to the private bucket | 1 |
| `firebaseauth.users.delete` added to `gate_session_minter` | 1 |
| restored | **0** |

`check-private-bucket-iam.sh` also made to fail: wrong expected gate SA → `FAIL: the bucket's non-legacy bindings are
not exactly the two expected` + `::error::Private bucket IAM test FAILED. Do not deploy.` (exit 1); nonexistent bucket
→ stops at exit 1 rather than passing.

### S-1 — the live check expands only `roles/viewer`, and the populated role is `roles/editor`

Section 2b reads `roles/viewer` only. But `projectEditor` carries **both** legacy owner bindings above, whose union is
get, **list**, create, delete, update and setIamPolicy on every object in the private bucket — and `roles/editor` is
**not** empty:

```
  "members": ["serviceAccount:410552878319-compute@developer.gserviceaccount.com"],
  "role": "roles/editor"
```

So the guard passes while the populated role goes unexamined. The Boundary Tester reached this independently and it is
filed as **issue #55**; the coordinator confirms it is **latent, not live** (no keys, no impersonation bindings, nothing
runs as that SA, Compute API disabled). I am not failing check 2 on it — the two-principal invariant and UBLA both hold
— but the guard's coverage is narrower than its wording implies. Smallest fix: expand `roles/editor` and `roles/owner`
in 2b alongside `roles/viewer`.

## 3. The gate — FAIL

### What passes

`/p/**` signed-out, **both transports, identical**:

| | Hosting `jason.cusati.us` | Direct `hub-gate-…run.app` |
|---|---|---|
| `/p/` | 404, **426 bytes** | 404, **426 bytes** |
| `/p/index.html` | 404, 426 bytes | 404, 426 bytes |
| `Cache-Control` | `private, no-store` | `private, no-store` |

The 404 is **provably the gate's**, per C29's test: 426 bytes with `<html lang="en">` **quoted**, versus Google's
frontend 404 at 1568 bytes with `<html lang=en>` unquoted — and `/healthz` is genuinely intercepted that way:

```
/healthz  -> status=404 size=1568  <html lang=en>      (Google's frontend)
/_health  -> status=200 size=15                         (the gate)
/nope     -> status=404 size=329   <html lang="en">     (the gate)
/p/…      -> status=404 size=426   <html lang="en">     (the gate)
```

…and a matching `event=deny` in Cloud Logging at the moment of the probe:

```
2026-09-19T03:52:41.552078Z  INFO gate event=deny scope=private stage=session reason=no_session_cookie
```

**Traversal.** Every probe used `--path-as-is`; I first confirmed why that is mandatory here:

```
plain curl /p/../index.html -> status=404 size=329 effective=https://…run.app/index.html
```

Plain `curl` rewrote the URL client-side — the false-200 class recorded as RT-12. With `--path-as-is`, against **PR
#47's code over real HTTP as a signed-in member** (so the *path validator* answers, not the session check):

```
/p/phd/milestones/index.html            status=200 size=26     <- valid path serves
/p/../index.html                        status=404 size=329
/p/..%2findex.html                      status=404 size=329
/p/..%252findex.html                    status=404 size=329
/p/%2e%2e%2fphd/milestones/index.html   status=404 size=329
/p/a%00.html                            status=404 size=329
/p/%c0%ae%c0%ae/index.html              status=404 size=329
/p/PHD/MILESTONES/INDEX.HTML            status=404 size=329
/p//phd/milestones/index.html           status=404 size=329
/p/phd//milestones/index.html           status=404 size=329
/p/phd/./milestones/index.html          status=404 size=329
/p/../../../etc/passwd                  status=404 size=329
```

All refused; the allowlist is what refuses them (`reason=dot_segment`, `illegal_character`, `nul_byte`,
`absolute_path`, `empty_segment` in the log). **No existence oracle**: signed-out, a real path and a nonexistent path
return byte-identical 426-byte bodies (`cmp` → YES).

**Cookie attributes**, over real HTTP on the mint path:

```
set-cookie: __session=session-for-member-token; HttpOnly; Max-Age=1209600; Path=/; SameSite=lax; Secure
```

`1209600 = 14 × 24 × 60 × 60`. HttpOnly, Secure, SameSite=Lax, 14 days — all four confirmed.

`Cache-Control: private, no-store` on **every** response class, never `public`, never `s-maxage`:
`/p/<served>`, `/p/<miss>`, `/session`, `/session/end`, `/_health`, `/totally-unknown`.

**dist-private filename allowlist (SD-7)** — made to fail:

```
servable   "index.html"              servable   "ok/fine-1.2_x.html"
UNSERVABLE "a b/index.html"          <- segment "a b"
UNSERVABLE "café/index.html"         <- segment "café"
UNSERVABLE "a%2fb.html"  "dir/sub dir/x.html"  "back\slash.html"  "semi;colon.html"
```

The build throws before the receipt is written, so an unservable tree cannot sync.

### S-2 — the `/session/end` CSRF check is bypassable (the FAIL)

`/session/end` is **not deployed** — the live revision `hub-gate-00005-n4g` (2026-09-18T15:48) predates #47, and
`POST /session/end` returns the gate's generic 404 (329 bytes) on `*.run.app`. So I ran PR #47's code over real HTTP
with the suite's in-memory fakes. The honest cases all hold:

```
no Origin              -> 403 {"status":"forbidden"}, NO Set-Cookie
Origin: https://jason.cusati.us  -> 200, set-cookie: __session=""; HttpOnly; Max-Age=0; Path=/; SameSite=lax; Secure
Origin: https://evil.example     -> 403, NO Set-Cookie
Origin: null / http:// / …/path / https://jason.cusati.us.evil.com -> 403 403 403 403
GET/PUT/DELETE/HEAD    -> 405
with vs without a valid session cookie: responses byte-identical (no oracle)
```

The clearing header carries **every attribute** the mint path set. Good.

**But the check is bypassed by a header the gate chooses to trust:**

```
POST /session/end
  Host: jason.cusati.us
  Origin: https://evil.example
  X-Forwarded-Host: evil.example
-> HTTP/1.1 200 OK
   set-cookie: __session=""; HttpOnly; Max-Age=0; Path=/; SameSite=lax; Secure
```

Three spellings work; the control still refuses:

| Request | Status |
|---|---|
| evil Origin + `X-Forwarded-Host: evil.example` | **200** |
| evil Origin + `X-Forwarded-Host: jason.cusati.us, evil.example` (the code splits on comma) | **200** |
| evil Origin + `Host: evil.example` | **200** |
| evil Origin, no XFH, honest Host — control | 403 |

`main.py` asserts this is safe: *"a cross-site form POST cannot set that header, and setting it from fetch() makes the
request preflighted — and the gate answers no preflight and sends no Access-Control-Allow-\* header."* I verified the
preflight half is true today:

```
OPTIONS /session/end  (Origin: https://evil.example, Access-Control-Request-Headers: x-forwarded-host)
-> HTTP/1.1 405 Method Not Allowed     (no access-control-allow-* => a browser blocks the fetch)
```

**So browser-driven CSRF is blocked today, and the practical impact of a forged sign-out is low** — a non-browser caller
has no victim cookie, so it gains nothing. I am nonetheless recording this as the FAIL, for three reasons:

1. The wave asserts a property — "it refuses a cross-origin POST" — that I **falsified over real HTTP**. The check
   provides no protection against any non-browser caller; all of its value rests on browser preflight behaviour.
2. The safety of trusting `X-Forwarded-Host` depends on whether Firebase Hosting **overwrites** or **appends** it, and
   the code comment itself says that is **not settled** ("the handoff carries the probe that settles it"). If Hosting
   appends a client-supplied value, the bypass becomes reachable through the CDN. That probe cannot be run until
   `/session/end` is deployed, so the premise is currently unverified in the one configuration that matters.
3. The same `_same_origin` is stated to guard **Phase 4's mint and revoke**, where a bypass does have consequence. The
   comment's own words: *"The check is written here, once, where getting it wrong costs nothing."*

**Smallest change that fixes it:** stop deriving `addressed_to` from `X-Forwarded-Host` — compare `Origin` against a
single configured expected host (or against `Host` alone), and settle the Hosting header question with a probe against
a deployed `/session/end` before Phase 4 reuses this function.

### Also recorded (not the FAIL)

- **Transport divergence on traversal spellings.** `/p/..%2findex.html` → **404** direct but **302** through Hosting;
  `/p/../index.html` → 302 on both, to *different* targets. Following every redirect ends in a 404 and **no private
  bytes** are returned anywhere. Consistent with the disposition already in STATE ("harmless now, load-bearing in
  Phase 4"); it does contradict the contract's "IDENTICAL status" for those spellings.
- **`/session/end` through Hosting today returns the static-site 404 with `cache-control: max-age=3600`** — a publicly
  cacheable response on a `/session` path — because `main`'s `firebase.json` has no such rewrite. #48 adds it. This is
  the G-R1 merge-order constraint, confirmed live: **#48 must merge before or with #47.**

## 4. Identity — FAIL

**Contract premise corrected mid-run.** My contract said "Every WIF binding pins numeric `repository_id`, `owner_id`
AND the default-branch ref." The coordinator corrected this during the run, and my own live reading agrees: **no
provider `attributeCondition` mentions `ref` at all.** The ref pin is real but lives on the **service-account binding**.
I record what I verified, not what the contract asked for.

Provider conditions (live):

```
github-actions/providers/website
  assertion.repository_id == '1212933399' && assertion.repository_owner_id == '5666389'
  && assertion.repository == 'djjay0131/website' && assertion.event_name != 'pull_request_target'
satellites/providers/github-cv              … repository_id == '1211056144' … (same shape)
satellites/providers/github-phd-milestones  … repository_id == '1373915518' … (same shape)
```

Ref pins, from each SA's own IAM policy (live):

```
hub-deploy             <- principalSet://…/github-actions/attribute.repository_id_ref/1212933399/refs/heads/main
gate-deploy            <- principalSet://…/github-actions/attribute.repository_id_ref/1212933399/refs/heads/main
publish-cv             <- principalSet://…/satellites/attribute.repository_id_ref/1211056144/refs/heads/master
publish-phd-milestones <- principalSet://…/satellites/attribute.repository_id_ref/1373915518/refs/heads/main
```

Numeric ids match the GitHub API exactly, and the branches genuinely differ (`cv` is `master`) — a copy-paste error
there would be invisible, and there is none. **Two separate pools**, `github-actions` and `satellites`, both ACTIVE.
**PASS as corrected.**

**No JSON key anywhere — PASS.**

- `git log --all -S'"type": "service_account"'` → only this contract's own text and prose in an earlier handoff.
- `infra/terraform.tfstate`: `google_service_account_key` count **0**; no `private_key_id`, no `BEGIN PRIVATE KEY`.
- User-managed keys on all five service accounts: **none**.
- **Actions secrets in all four repos: none at all.** (Repo *variables* are public config only — `PUBLIC_FIREBASE_API_KEY`, bucket names, SA emails.)

**No satellite role holds `storage.objects.list` — PASS**, read live, not from Terraform:

```
$ gcloud iam roles describe satellitePublisher --project cusati-hub
storage.objects.create;storage.objects.delete;storage.objects.get
```

Both content-bucket satellite bindings carry a `startsWith` prefix condition scoped to their own
`sources/<source>/` prefix (verified live).

### Why this check fails

**The gate runtime SA does not yet hold only the narrowed role. Testing current state:**

```
$ gcloud projects get-iam-policy cusati-hub
  "members": ["serviceAccount:hub-gate@cusati-hub.iam.gserviceaccount.com"], "role": "roles/datastore.viewer"
  "members": ["serviceAccount:hub-gate@cusati-hub.iam.gserviceaccount.com"], "role": "roles/firebaseauth.admin"

$ gcloud iam roles describe gateSessionMinter --project cusati-hub
ERROR: NOT_FOUND: The role named projects/cusati-hub/roles/gateSessionMinter was not found.
```

`roles/firebaseauth.admin` — the widest grant in Phase 3, carrying user deletion and sign-in-configuration rewrite —
**is still bound in production**, and the custom role does not exist. The gate holds `storage.objects.get` (via
`privateObjectReader`) and `datastore.viewer` correctly.

**Testing proposed state:** #53 is correct and does exactly what is required. `terraform plan` with #53's configuration
against the live state (read-only, `-lock=false`, never applied):

```
  # google_project_iam_custom_role.gate_session_minter will be created
      + permissions = ["firebaseauth.users.createSession", "firebaseauth.users.get"]
  # google_project_iam_member.hub_gate_auth_admin will be destroyed
      - role = "roles/firebaseauth.admin"
  # google_project_iam_member.hub_gate_session_minter will be created
Plan: 2 to add, 0 to change, 1 to destroy.
```

**So: proposed state PASS, current state FAIL.** The line is false until #53 is merged *and applied*.

**The last clause is not satisfied and its by-attempt test could not be run.** The contract says "After Wave 0's item 3,
the PUBLIC deploy identity holds NO private-bucket permission. Test that last one by attempting the access and being
refused." Item 3 is **not implemented** — the infra handoff says so in its own heading ("Item 3 — dedicated private-sync
identity: **WAITING, nothing implemented**"), and `hub-deploy` still holds `privateSyncWriter` on the private bucket in
both the live policy and the plan. I attempted the probe as instructed and it **could not run**:

```
$ gcloud storage cat gs://cusati-hub-private/build-info.json \
    --impersonate-service-account=hub-deploy@cusati-hub.iam.gserviceaccount.com
ERROR: PERMISSION_DENIED: Failed to impersonate [hub-deploy@…]. …
  Permission 'iam.serviceAccounts.getAccessToken' denied on resource
```

All four impersonations (`hub-deploy`, `gate-deploy`, `publish-cv`) failed at the **impersonation** step, not at the
bucket, so they prove nothing about bucket access either way. **That sub-test is NOT TESTED** — what would test it is
granting the auditing principal `roles/iam.serviceAccountTokenCreator` on the target SA for the duration of a
Checkpoint, or running the probe from within a workflow already authenticated as that identity.

## 5. Firestore — PASS (ruleset) + NOT TESTED (signed-in stranger)

**The deny-all ruleset stays RELEASED across applies — PASS.** Three independent lines of evidence:

```
$ terraform plan          (current configuration, live state)
No changes. Your infrastructure matches the configuration.

$ terraform plan          (PR #53's configuration, same live state)
Plan: 2 to add, 0 to change, 1 to destroy.   <- only the three gate-auth resources; the
                                                 ruleset and the release are untouched

$ GET firebaserules.googleapis.com/v1/projects/cusati-hub/rulesets
total rulesets in project: 1
   405d371b-01d1-475e-bfed-1763bd8de94c 2026-09-17T20:58:34Z
```

**Exactly one ruleset exists in the project.** Had it been replaced on every apply — the behaviour before PR #35 —
there would be many. Its id matches both the state and the live release. The #30 fix holds, and **#53 does not
regress it.**

The released source, read from the live API rather than from Terraform:

```
rules_version = '2';
service cloud.firestore { match /databases/{database}/documents {
    match /{document=**} { allow read, write: if false; } } }
```

**`members/` and `shares/` from the Web SDK — half tested.** With the real public API key, unauthenticated:

```
members-list status=403  {"error":{"code":403,"message":"Missing or insufficient permissions."}}
shares-list  status=403  {"error":{"code":403,"message":"Missing or insufficient permissions."}}
```

I could **not** obtain a real signed-in-stranger token: anonymous sign-in is disabled
(`accounts:signUp` → `400 ADMIN_ONLY_OPERATION`) and I hold no non-allowlisted Google account. The deny-all ruleset
makes the signed-in case follow a fortiori, but my contract is explicit — *"Prove it with a real token, not by reading
rules."* **NOT TESTED.** What would test it: a real non-member Google account signs in at `/signin`, then its `idToken`
is used for `GET firestore.googleapis.com/v1/projects/cusati-hub/databases/(default)/documents/members`.

## 6. Supply chain — FAIL

**Action pinning — FAIL.** `website` is fully SHA-pinned across `build.yml`, `ci.yml`, `gate.yml`. The other three are not:

| Repo | Status |
|---|---|
| `website` | all SHA-pinned |
| `phd-milestones` | SHA-pinned **except** `djjay0131/website/contract/publish@main` (mutable ref) |
| `agentic-kgis` | **nothing pinned** — `actions/checkout@v4`, `actions/setup-python@v5`, `astral-sh/setup-uv@v5`, `actions/setup-node@v4`, `djjay0131/website/contract/publish@main` |
| `construction-ai-proposal` | **nothing pinned** — `actions/checkout@v4`, `xu-cheng/latex-action@v3` (×6), `actions/upload-pages-artifact@v3`, `softprops/action-gh-release@v2`, `actions/deploy-pages@v4` |

`softprops/action-gh-release@v2` and `xu-cheng/latex-action@v3` are third-party mutable tags. Per the coordinator these
two repos are not yet hub satellites (Phase 5) and hold no cloud identity — so a compromise there cannot reach the
bucket today — but the contract names all four repos, and the finding is factual.

**`npm audit --omit=dev` — FAIL.**

```
{"info":0,"low":1,"moderate":6,"high":9,"critical":1,"total":17}

critical  astro          direct=True   9 advisories, incl. 'Astro: Remote code execution through AVIF image
                                       optimization' and 'Authorization bypass from missing path-segment
                                       boundary check when stripping the configured base'
high      js-yaml        direct=True   high  postcss / sharp / svgo / vite / nanoid / devalue / fast-uri / smol-toml
```

`--omit=dev` excludes nothing here: `site/package.json` declares **no `devDependencies` at all** — `astro`, `vitest`,
`typescript` and `@astrojs/check` are all under `dependencies`. The Astro base-path authorization-bypass advisory is
worth naming specifically given what this site's base path protects.

**actionlint — PASS.** Clean (exit 0) on the composed wave tree (`#47`'s `gate.yml` + `#53`'s `build.yml` + `ci.yml`)
and on the current repo.

**pip-audit — PASS.** `uvx pip-audit -r gate/requirements.txt` → `No known vulnerabilities found.`

## 7. Static public site — FAIL

`firebase.json` declares **no functions and no SSR** — correct.

| Source | Rewrites |
|---|---|
| Contract's authorised set | `/p/**`, `/session`, `/session/end`, `/s/**`, `/share/**` |
| Design doc §8 | `/p/**`, `/s/**`, `/session`, `/share/**` |
| `main` today | `/p/**`, `/session`, **`/client-events`** |
| with #48 | `/p/**`, `/session`, `/session/end`, **`/client-events`** |

`/s/**` and `/share/**` are correctly **absent** (Wave 1). `/session/end` is correctly added by #48.

**`/client-events` appears in neither authorised list.** It is an **unauthenticated** Cloud Run rewrite on the public
domain, and I found no ADR or spec section authorising it (`grep -rn "client-events" llm/specs/ llm/governance/adr/` →
no hits; the only records are handoffs and STATE). It is not harmless: the Red Team demonstrated **against live
production** that it forges both log-based metrics, and I corroborated the residue in Cloud Logging (see S-4).

This is the **lowest-severity of my four FAILs** and most likely wants the disposition "authorise it in an ADR" rather
than "remove it" — the sign-in page genuinely needs somewhere to report pre-session failures. But as written, "the only
rewrites are …" is false.

## 8. Cost — PASS

The `$5` budget resource is present in state with its guard:

```
google_billing_budget.hub  ['billingAccounts/011A3C-D3061E-8B0DB7/budgets/a9c301a5-6f2e-44bc-b9e3-c56f220bb3da']
```

`terraform plan` shows it refreshed and unchanged. `budget.tf` declares `USD 5`, four threshold rules (50/90/100/100
forecast), and `lifecycle { prevent_destroy = true }`.

**budget-guard made to fail:**

| Mutation | perl exit |
|---|---|
| real `budget.tf` | **0** (OK) |
| `prevent_destroy = false` (real line, verified 1 substitution) | **3** |
| whole `google_billing_budget` block commented out | **2** |

The guard strips comments first, so a commented-out block does not pass. One note: the perl alone exits 0 on a
**missing** file, but the step's preceding `if [ ! -f "${FILE}" ]` check exits 1 first — so there is no hole. The
override-file check (`override.tf*`, `*_override.tf*`) is present and correct.

## 9. Logging — PASS, with finding S-4

**The `event=` classes reach Cloud Logging.** Live, `hub-gate`, last 2h, 300 lines:

```
     65 event=deny
      3 event=client_signin_failed
      2 event=reject
2026-09-18T15:48:18.338158Z  INFO gate event=boot logging=StreamHandler(stdout)
```

`event=boot` is present at the current revision's start, so the 2026-09-18 handler fix is **real in production** — the
class that was silently discarded for four revisions now arrives. `event=deny` and `event=client_signin_failed` are the
two strings `infra/monitoring.tf` filters on, and both are live.

**`event=allow scope=signout` — cannot exist live**, because `/session/end` is not deployed (0 hits, as expected). On
PR #47's code, driven over real HTTP through the **production logging path** (`StreamHandler(stdout)`, which is what
Cloud Run ships):

```
INFO gate event=allow scope=signout          (×6)
INFO gate event=deny scope=signout reason=cross_origin   (×7)
```

The class will arrive once deployed. I mark this **branch evidence, not production evidence**, and it should be
re-checked after the deploy.

**No secret or token in any log line — PASS.** Grepped the last 2h of production logs after all my probes:

```
eyJ (JWT) 0 · ya29 0 · gho_/ghp_/github_pat 0 · AIza 0 · X-Goog-Signature 0
token= / secret= / cookie= / password=  — no matches
```

### S-4 — uvicorn's access lines put request paths in Cloud Logging unconditionally

`config.py` says object paths stay out of logs unless `GATE_LOG_OBJECT_PATHS` is deliberately set, *"because an object
path under /p/** IS a private slug"*. The gate's own lines honour that — `object=` appears **0** times. But uvicorn
writes its own access line for every request, and those carry the full path:

```
INFO:     169.254.169.126:7842 - "POST /client-events HTTP/1.1" 204 No Content
```

My traversal probe paths (`index.html`, `..`, `etc/passwd`) appear in the 30-minute window **only** in uvicorn access
lines, never in a `gate event=` line. The consequence: once real private content is served, `/p/<private-slug>` will be
in Cloud Logging via uvicorn regardless of `GATE_LOG_OBJECT_PATHS`, defeating the setting's stated purpose. Not a
secret or token, so not a FAIL of this check's wording — but the control is partial and the comment overstates it.

**Corroborating the Red Team's attack 1.** This line is in production Cloud Logging, written by an unauthenticated
caller:

```
INFO gate event=client_xevent=allow_scope=session_member=djjay@vt.edu trace=rtprobe1789789925
```

`_clean_client_value` strips newlines and maps spaces to `_`, so a *clean* forged line cannot be produced — but
attacker-controlled text reaches the log, and an email address is now in it. Both metric filters match substrings, so
counts remain forgeable by anyone who finds the endpoint.

## 10. Repos — PASS

Checked via the API, not from memory:

```
phd-milestones           {"private":true,  "visibility":"private", "id":1373915518, "default_branch":"main"}
agentic-kgis             {"private":false, "visibility":"public",   "id":1295802912}
construction-ai-proposal {"private":false, "visibility":"public",   "id":1134376420, "default_branch":"master"}
website                  {"private":false, "visibility":"public",   "id":1212933399}
```

**`phd-milestones` is PRIVATE.** Its id matches the WIF pin exactly. Its `publish.yml` states both published items are
private and that the generator refuses to emit a non-private item.

**`agentic-kgis` and `construction-ai-proposal` are not yet hub satellites** — reported as not-yet-existing rather than
as a gap, per the coordinator's correction, and verified independently three ways: `var.satellites` contains exactly
`cv` and `phd-milestones`; the `satellites` pool holds exactly two providers (`github-cv`, `github-phd-milestones`);
and there is no `publish-kgis` or equivalent service account. `construction-ai-proposal` publishes only to GitHub
Pages. There is therefore nothing publishing to the hub from either repo to assess for `visibility: public`.

---

## Summary

Wave 0 is **BLOCKED** on four checks. Two are substantive, two are narrower.

The substantive ones are **check 4** and **check 6**. Check 4 fails on current state, not on design: `#53` is correct,
and the plan I ran proves it destroys the `roles/firebaseauth.admin` binding and creates a custom role holding exactly
two permissions. Until it is applied, the gate — a service whose invoker is `allUsers` — can delete users and rewrite
the sign-in configuration. Item 3 (the dedicated private-sync identity) is openly unimplemented, so the public deploy
identity still holds write access to the private bucket. Check 6 fails on two independent counts: two satellite repos
pin no action by SHA at all, and the site carries a critical advisory in a **direct production** dependency.

Check 3 fails on one finding, S-2, and I want the Lead Architect to weigh it with full information rather than have me
soften it. Everything else about the gate is genuinely strong — the traversal allowlist refused all eleven hostile
spellings, the 404 is provably the gate's own, the cookie carries all four required attributes, `private, no-store` is
on every response class, and there is no existence oracle. But the wave's new route asserts "it refuses a cross-origin
POST", and I produced a 200 with a clearing `Set-Cookie` from `https://evil.example`. The impact **today** is low
(browser preflight blocks the reachable path, and a non-browser attacker has no victim cookie). It is a FAIL because
the property was asserted and is false, because the header-provenance question the code defers is unresolved in the one
configuration that matters, and because the same function is slated to guard Phase 4's mint and revoke.

Check 7 is the narrowest: `/client-events` is a real, unauthenticated, request-time rewrite on the public domain that
appears in no authorised list and in no ADR — and the Red Team has already shown it forges both log-based metrics.

What is genuinely reassuring this wave: the leak check now has real needles and I made it go red three ways, including
a title-only plant that exercises the contents half independently. The private bucket's two-principal invariant holds
live, and I broke its guard six ways. The Firestore ruleset churn from #30 is fixed and `#53` does not regress it —
exactly one ruleset exists in the project. And the logging layer that was discarding all 21 call sites is demonstrably
alive: `event=boot` is in production.

One process note: **check 4's premise was corrected mid-run.** The contract asked me to verify that every WIF binding
pins the default-branch ref *on the provider*. No provider condition mentions `ref`. The pin is real but lives on each
service account's `workloadIdentityUser` binding. Had I checked only what the contract said, I would have reported a
FAIL that was not real and blocked this wave on a drafting error. The record above shows what I actually verified.

## Assumptions

- The live project is `cusati-hub`; `jason.cusati.us` and `hub-gate-ywkmredngq-ue.a.run.app` are the two transports.
- `terraform plan` was run on a **scratch copy** of `infra/` with a copy of the local state, read-only and
  `-lock=false`. `infra/` in the worktree was never touched and `apply` was never invoked.
- PR #47's runtime behaviour was exercised with the suite's own in-memory fakes, so `/session/end` and the traversal
  results reflect the branch's **code**, not a deployed revision. Every claim sourced that way is labelled.
- `npm audit` reflects the lockfile in `site/` as it stands on the current worktree branch, not per-PR.
- I treat the coordinator's two corrections (WIF ref location; satellite set is two) as verified — I confirmed both
  against live state independently before relying on them.

## Recommendations

1. **Apply #53 before, or as part of, closing Wave 0.** The plan is clean (2 add, 0 change, 1 destroy) and touches
   nothing else. Re-verify afterwards with the command #53's own output already provides:
   `gcloud iam roles describe gateSessionMinter` and the `hub-gate` role filter.
2. **Fix S-2 before #47 merges.** Drop `X-Forwarded-Host` from `addressed_to`; compare `Origin` against a configured
   expected host. Then, once `/session/end` is deployed, run the deferred probe that settles whether Hosting overwrites
   or appends the header, and record the answer as a decision rather than a comment.
3. **Merge #48 before or with #47** (G-R1), confirmed live: without the rewrite, sign-out fails through the CDN only.
4. **Pin every action by SHA in `agentic-kgis` and `construction-ai-proposal`**, and pin
   `djjay0131/website/contract/publish` to a SHA in both satellites that consume it.
5. **Upgrade `astro`** to clear the critical advisory; the base-path authorization-bypass item deserves a look on its
   own merits given what this site's paths protect.
6. **Extend `check-private-bucket-iam.sh` §2b to expand `roles/editor` and `roles/owner`,** not just `roles/viewer`
   (issue #55). As written the guard is green while the populated role goes unexamined.
7. **Authorise `/client-events` in an ADR or remove the rewrite.** If it stays, note in the ADR that its metric counts
   are forgeable by anyone, so the two log-based metrics are availability signals and not security signals.
8. **Land item 3**, and update `EXPECTED_PRIVATE_BUCKET_BINDINGS` with it, so the public deploy identity stops holding
   write access to the private bucket.
9. **Give the Checkpoint runner `roles/iam.serviceAccountTokenCreator`** on the target SAs for the duration, so the
   "attempt the access and be refused" test in check 4 can actually be run rather than skipped.
10. **Reconcile #47's `test_every_alert_policy_has_a_notification_channel` with #53's `monitoring.tf`** — see Risks.

## Alternatives considered

- **Passing check 3 and logging S-2 as a note.** Rejected. The impact today is low, but the standard I was given is
  that a check I can make fail is the only kind that counts — and I made this one fail. Softening it to keep the wave
  moving is precisely what my contract forbids.
- **Failing check 2 on the `roles/editor` → `projectEditor` path.** Rejected. The line asks for UBLA, PAP, exactly two
  non-legacy principals, an anonymous refusal and the `projectViewer` decision recorded. All five hold. The `editor`
  expansion is a gap in a *guard's coverage*, is latent, and is already tracked as #55 — so it belongs in the record,
  not in the verdict.
- **Failing check 9 on S-4 (uvicorn access lines).** Rejected. The line asks that no **secret or token** appear, and
  none does. A path is neither, though the design intent is defeated.
- **Failing check 5 outright for the untested half.** Rejected in favour of splitting the verdict: the ruleset half is
  strongly evidenced and the stranger half is honestly marked NOT TESTED, which is more useful than a blanket FAIL.
- **Treating checks 6 and 10's satellite findings as out of scope** because those repos are Phase 5. Rejected for
  check 6 (the contract names all four repos and the finding is factual), accepted for check 10 (there is genuinely
  nothing publishing to assess).

## Risks

- **Merging #47 and #53 together turns the gate suite red.** Verified by composing the two branches:

  | Tree | Result |
  |---|---|
  | #47 + `main`'s `infra/` | all tests pass |
  | #47 + #53's `infra/` | **1 failed** — `test_every_alert_policy_has_a_notification_channel` |

  ```
  AssertionError: 3 alert policies but only 0 notification_channels assignments.
  assert 0 >= 3
  ```

  The substance is fine — #53 refactors to `notification_channels = local.alert_notification_channels`, and the local
  concatenates the email channel with an optional SMS one, so every policy **is** wired. The test counts the literal
  string `notification_channels = [`, which #53 no longer uses. This is loud rather than silent, so it will not slip
  through, but it is a merge blocker neither branch's own CI would have caught.
- **`/session/end` is split across two branches.** Merging #47 alone leaves the route matched by no rewrite: direct
  `*.run.app` tests pass and sign-out fails through the CDN only — the same class of failure `main.py` warns about for
  the cookie name.
- **The `X-Forwarded-Host` question is unresolved and compounds.** Phase 4 adds mint and revoke behind the same check.
  If Hosting appends rather than overwrites, S-2 becomes browser-reachable through the CDN.
- **`projectEditor` on the private bucket is latent, not impossible.** It is empty of danger only as long as nothing
  runs as the default compute SA and the Compute API stays disabled. Neither is enforced by anything.
- **Metric counts are forgeable.** `hub-gate-denials` and `hub-signin-failures` both match substrings an unauthenticated
  caller can write. Any alerting built on them can be both triggered and drowned.
- **This verdict covers the branches as they stand.** Re-running after the S-2 fix and the #53 apply is required; three
  of the four FAILs are expected to clear on re-test without redesign.

## Open questions

1. Does Firebase Hosting **overwrite** or **append** `X-Forwarded-Host` on a Cloud Run rewrite? Unanswerable until
   `/session/end` is deployed, and it decides whether S-2 is browser-reachable.
2. Is `/client-events` an authorised rewrite? If yes it needs an ADR; if no it needs removing from `firebase.json`.
3. Who owns the `#47`/`#53` monitoring-test collision — does the test change to match the refactor, or does
   `monitoring.tf` keep a literal form the test can see?
4. Should `site/package.json` split real `devDependencies` out, so `npm audit --omit=dev` means something? Today it
   excludes nothing.
5. Will item 3 land in Wave 0b, or is the public deploy identity's private-bucket write access accepted for longer?
6. Is a non-member Google account available for Checkpoint use, so check 5's signed-in-stranger half stops being
   NOT TESTED every wave?

## Related docs

- `llm/specs/2026-09-10-research-hub-design.md` §8 (the `firebase.json` block), §12 (the six non-negotiables)
- `llm/governance/adr/0004`, `0005`, `0007`, `0010`
- `llm/sprints/2026-09-hub/contracts/phase-3-seams.md` — SEAM-1, SEAM-2, SEAM-4; SEAM-10 (private-sync identity split)
- `llm/sprints/2026-09-hub/STATE.md` §Wave 0 dispositions — RT-1, RT-12, G-R1; §Checkpoint 4
- `llm/sprints/2026-09-hub/handoffs/infra-wave-0.md` — item 3 status; `gate-wave-0.md`; `red-team-wave-0.md` attack 1;
  `boundary-tester-wave-0.md` (issue #55, WIF ref location)
- Issue #55 — `projectEditor` legacy bindings on the private bucket

## ADR candidates

1. **`Origin` verification for state-changing routes.** What is compared against what, whether any forwarded header is
   ever trusted, and how the rule survives having two legitimate hosts (`allUsers` invoker, ADR-0004). Phase 4's mint
   and revoke depend on the answer.
2. **`/client-events` as an authorised public rewrite.** Its unauthenticated design, its caps and scrubbing, and the
   explicit consequence that any metric built on it is forgeable.
3. **Legacy bucket bindings and the project-role expansion.** That `projectEditor`/`projectViewer` are a standing,
   un-removable read (and write) path into the private bucket unless the bucket's whole IAM policy is replaced, and
   which project roles may therefore ever be granted.
4. **Request-path logging.** That uvicorn's access lines place `/p/**` paths in Cloud Logging regardless of
   `GATE_LOG_OBJECT_PATHS`, and whether the access logger is reconfigured or the setting's claim is narrowed.
5. **What "the live half runs nowhere" means for the bucket IAM test.** Options (a)/(b)/(c) in
   `check-private-bucket-iam.sh` remain undecided, and the impersonation gap above makes (c) the de-facto answer.
