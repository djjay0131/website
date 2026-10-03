# Handoff — Security Tester, Wave 3 (Phase 4 sharing) — **round 2**

Status: Delivered
Date: 2026-10-03
Stream: Security Tester (write to this file only)
Issue: `hub-004`
Branch: `feat/sharing` @ `fcecfd8` (round 1 reviewed `c605c72`)
Contract: `llm/sprints/2026-09-hub/contracts/security-tester-wave-3.md`
Seams: `llm/sprints/2026-09-hub/contracts/phase-4-seams.md` SEAM-S1 (all four
amendments), S2, S3, S4, S5, S8
Authority: run brief §6; round-2 brief (D1 fix re-test)
Artifacts: `/tmp/opencode/st2/probe.py`, `/tmp/opencode/st2/harness.py`,
`/tmp/opencode/st2/plan.txt`, `/tmp/opencode/lock-main.json`,
`/tmp/opencode/signin.html`

## Verdict — blocking statement

**The Wave 3 merge is NOT blocked. 0 FAILs; 0 regressions introduced by this
branch.** All ten scoped checks were re-run against the D1-fixed surface
(`fcecfd8`). Nine are **PASS**. One sub-clause of Check 6 (“the public deploy
identity holds no private-bucket permission”) is **unmet in the live config**,
but it is the **pre-existing Wave 0 standing finding** the round-2 brief
explicitly names as *not this wave's* (`hub-deploy`/`privateSyncWriter`); it is
not introduced or touchable by this branch. Check 10's live Cloud Logging reach
is **NOT TESTED** (cannot be reached pre-merge). No tracked file was modified.

The D1 fix does what SEAM-S1's 2026-10-03 amendment says: a token reaches
`<section>/<source>/<slug>/_doc/` only; the member frame, `_payload/**`,
`_astro/**` and every sibling's `_doc/` are unreachable, and the staged `_doc/`
document is self-contained (relative assets, no `/p/` or `_payload` link).

## Check table

| # | Check | Verdict | Evidence (exact) |
|---|---|---|---|
| 1 | No private content on the public path | **PASS** | `build:public` 26 pages; no Shares/React/`_doc`/private bytes in `dist-public`; `demo:leak-check` red; `dist-public` hash unchanged |
| 2 | `private, no-store` on every `/s/**`, `/share/**` outcome | **PASS** | gate suite `test_every_share_response_is_private_no_store` + 25-outcome HTTP matrix; 0 `public`/`s-maxage` |
| 3 | Gate refusals (404 uniform; 403 on non-owner/anonymous/cross-origin) | **PASS** | unknown==expired==revoked sha `0ddd881d3b0e` len 329; all 403 body `676248f128dc` |
| 4 | **New** `_doc/` prefix; frame/`_payload`/`_astro`/sibling unreachable; `entry` traversal; `.pdf` | **PASS** | fetch trace `…/committee-dossier/_doc/index.html`; 18-spelling traversal 0 reads; `application/pdf`; corrupt entry 404 |
| 5 | Traversal suite `--path-as-is`; zero bucket reads on refusal | **PASS** | `probe.py` curl battery: 18 hostile spellings → 404, **0 fetches**; in-prefix miss separately confined |
| 6 | Identity / IAM | **PASS** (Wave 3 delta); 1 pre-existing sub-item unmet | live `terraform plan`: only the `datastore.viewer→user` member; no keys; numeric-id+ref WIF; satellite role has no `list`; `hub-deploy` still `privateSyncWriter` (Wave 0, noted) |
| 7 | Firestore deny-all; Web SDK unreadable; plan does not replace ruleset/release | **PASS** | live `GET members/`,`shares/` → 403 `PERMISSION_DENIED`; plan action set **0** `firebaserules_*` |
| 8 | Supply chain | **PASS** (Wave 3 delta); pyjwt medium noted | `npm audit --omit=dev`: 0 critical, 6 high (3 unique advisories; 1 new vs baseline, 0 new vs `main`); React lock-resolved; 485/485 registry URLs; `pip-audit` pyjwt 2.14.0 medium only |
| 9 | `firebase.json` exact rewrites, no functions/SSR | **PASS** | 7 rewrites exactly, `functions: null` |
| 10 | Budget / logging | **PASS**; live Cloud Logging **NOT TESTED** | budget guard exit 0; mint logs `id=<12> by=<email>`, no item triple/entry; live reach not testable |

---

## Check 1 — No private content on the public path. PASS

```text
$ cd site && npm run build:public
[hub-public-build] staged 3 payload file(s) for 1 public framed item(s)
[build] 26 page(s) built in 1.49s                                  EXIT=0

$ find dist-public -path '*share*' -o -iname '*shares*'            # (empty)
$ ls dist-public/_astro | grep -iE 'react|Shares'                  # (empty)
$ grep -rl "SharesIsland|react-dom|react/jsx-runtime|astro-island" dist-public   # (empty)
$ find dist-public -name _doc                                      # (empty)
$ find dist-public -type f | wc -l                                 # 162

# contrast: private build DOES carry them
$ find dist-private -path '*share*'      -> dist-private/shares/index.html
$ ls dist-private/_astro | grep -iE 'react|Shares'
                                          -> react.DJY1zw8Z.js  SharesIsland.Dk64hHBZ.js
```

`dist-public/_payload/kgis/**` is the **public** `kgis/kgis-docs` item (in
`site/publish-allowlist.json`), not private bytes; `check:no-private-in-public`
scans all 162 files including it.

```text
$ npm run check:no-private-in-public
check:no-private-in-public: PASS — no private slug, source, route, payload path,
  title or summary appears … under dist-public (162 files scanned).        EXIT=0

$ find dist-public -type f | sort | xargs sha256sum | sha256sum   -> c7e1a421fb49…
$ npm run demo:leak-check
  check:no-private-in-public: 5 LEAK(S) of private content into /tmp/hub-leak-demo-…/dist-public
  demo:leak-check: the check exited 1 (1 means it caught the leak).
  demo:leak-check: PASS — the guard failed on the injected leak … The real
    dist-public was never modified.                                        EXIT=0
$ find dist-public … | xargs sha256sum | sha256sum   -> c7e1a421fb49…   # UNCHANGED
```

The guard is proven red on an injected leak in an isolated copy; the plant is
removed by the script and the real `dist-public` hash is identical before/after.

## Check 2 — Caching. PASS

`gate/tests/test_shares.py::test_every_share_response_is_private_no_store` is
parametrised over both transports and asserts `Cache-Control == "private,
no-store"` and that `public`/`s-maxage` are absent for served, unknown, expired,
traversal, missing, mint, mint-refused, list, list-refused, revoke and
revoke-refused. Independently, over real HTTP through uvicorn with
`curl --path-as-is` (`/tmp/opencode/st2/probe.py`), every one of the 25 outcomes
below returned `cc='private, no-store'` (200, 307, 403 and 404 alike):

```text
/s/{active}/   /s/{active}/index.html   /s/{active}   /s/{pdf}/   /s/{pdf}/anthropic-fellow.pdf
/s/{multiseg}/   /s/{unknown}/   /s/{expired}/   /s/{revoked}/
/s/{corrupt-dot}/ /s/{corrupt-abs}/ /s/{corrupt-empty}/ /s/{corrupt-enc}/ /s/{corrupt-back}/
POST /share owner/non-owner/anonymous/cross-origin
GET  /share owner/non-owner/anonymous
DELETE /share/{token} owner/non-owner/cross-origin
all 18 traversal spellings
grep -c 'public|s-maxage'  -> 0
```

The header is set unconditionally by `security_headers` middleware
(`gate/app/main.py:292-300`) after every route; no framework default can leave a
cacheable header. A7's `/s/**` half stays closed.

## Check 3 — Refusals. PASS

```text
unknown 404 len=329 sha=0ddd881d3b0e
expired 404 len=329 sha=0ddd881d3b0e
revoked 404 len=329 sha=0ddd881d3b0e     -> byte-identical: no existence oracle

POST /share   non-owner 403 / anonymous 403 / owner cross-origin 403
GET  /share   non-owner 403 / anonymous 403
DELETE /share/{token} non-owner 403 / cross-origin 403
all 403 bodies sha=676248f128dc len=22   {"status":"forbidden"}
```

Unknown/expired/revoked are indistinguishable (same body, same length,
including a corrupt stored row: `corrupt-enc`/`corrupt-back` are the same
`0ddd881d3b0e`). Non-owner members and anonymous callers are refused on
mint/list/revoke; cross-origin state changes are refused by `_refuse_cross_origin`
before the body is read.

## Check 4 — New `_doc/` surface. PASS

**Served prefix is `<section>/<source>/<slug>/_doc`.** `GET /s/{active}/` and
`GET /s/{active}/index.html` both fetch exactly
`phd/phd-milestones/committee-dossier/_doc/index.html` (the staged document),
never the member frame at `…/committee-dossier/index.html`.

**Member frame unreachable.** `/s/{active}/../index.html` and
`%2e%2e%2findex.html` and `..%2findex.html` → 404, `stage=path reason=dot_segment`,
**0 fetches**; the conftest canary `"<h1>Member frame (must not serve)</h1>"` is
never returned.

**`_payload/**` and `_astro/**` unreachable.** `%2e%2e%2f…_payload…` and
`%2e%2e%2f_astro%2fapp.js` → 404, **0 fetches**. A well-formed in-prefix
`/s/{active}/_payload/hidden.html` resolves to the token's **own**
`…/_doc/_payload/hidden.html`, a miss (not the real `_payload/…`).

**Sibling item’s `_doc/` unreachable.** Same-source sibling slug (`../milestones/_doc/…`),
different-section sibling (`../projects/…/internal-notes/_doc/…`) and
prefix-extended slug (`../committee-dossier-evil/_doc/…`) → 404, **0 fetches**;
canaries `"Milestone tracker"`, `"Internal notes"`, `"Evil sibling"` never served.

**`entry` traversal refused or confined.**
- Mint: `_share_entry` reuses `safe_prefix`; `entry` `""`, `None`, `"../secrets"`,
  `"/etc/passwd"`, `"a//b"`, `"a/b/../c"` → `None` → HTTP 400. `"site/index.html"`
  and `"anthropic-fellow.pdf"` accepted.
- Production read path: `_share_from_document` rejects a stored row whose `entry`
  is empty/None (returns `None` → 404). A stored row with `entry="../index.html"`,
  `"/etc/passwd"`, `"%2e%2e"` or `"..\\index.html"` is refused at serve by
  `safe_object_path` (404, `reason=dot_segment`/`absolute_path`/`illegal_character`/
  `backslash`).
- Multi-segment `entry="site/index.html"` is confined: it fetches
  `…/_doc/site/index.html` (inside the prefix; miss, 404).

**`.pdf` entry is `application/pdf`.** `GET /s/{pdf}/` and
`/s/{pdf}/anthropic-fellow.pdf` → 200, `content-type: application/pdf` (the
`entry` bug the second amendment fixes; the object keeps its own basename so the
extension wins in `guess_content_type`).

The site side stages a self-contained `_doc/` tree (`npm run build:private`,
7 `_doc` files / 4 items); inspected `dist-private`:

```text
…/committee-dossier/_doc/committee.html   -> <link rel="stylesheet" href="assets/style.css">
…/committee-dossier/_doc/assets/style.css
…/milestones/_doc/index.html + assets/style.css
…/projects/…/internal-notes/_doc/internal.html + assets/style.css
…/cv/cv/anthropic-fellow/_doc/anthropic-fellow.pdf
grep -rn '_payload/\|_astro/\|/p/\|href="/p' dist-private/**/_doc   -> (none)
```

No `_doc` document references the frame, `_payload/` or `_astro/`; no sibling
document is copied into another item's tree. `check:private-links` PASS
(12 pages, 0 off-origin sub-resource).

## Check 5 — Traversal suite, `--path-as-is`. PASS

`curl -sS --path-as-is` against the real ASGI app on `127.0.0.1:8142`, with every
bucket lookup appended to a fetch log. **18 hostile spellings** (raw and encoded
`..`, double-encoded, deep `a/../../b`, absolute `//` and `%2f`, backslash, NUL,
sibling section/slug/`_doc`, `_payload`, `_astro`, full second-item path):

```text
member frame ../index.html           404  reason=dot_segment        fetches=0
member frame %2e%2e%2findex.html      404  reason=dot_segment        fetches=0
member frame ..%2findex.html          404  reason=dot_segment        fetches=0
double-encoded %252e…                404  reason=illegal_character  fetches=0
deep ../ a/../../b                    404  reason=dot_segment        fetches=0
absolute //etc/passwd                 404  reason=absolute_path      fetches=0
absolute %2fetc%2fpasswd             404  reason=absolute_path      fetches=0
backslash ..%5csecrets               404  reason=backslash          fetches=0
backslash %5cwindows…                404  reason=backslash          fetches=0
NUL %00                              404  reason=nul_byte           fetches=0
sibling _doc ../milestones/…         404  reason=dot_segment        fetches=0
sibling section projects/…           404  reason=dot_segment        fetches=0
sibling slug -evil/…                 404  reason=dot_segment        fetches=0
_payload traversal                    404  reason=dot_segment        fetches=0
_payload deep traversal               404  reason=dot_segment        fetches=0
_astro traversal                      404  reason=dot_segment        fetches=0
full second-item path                 404  reason=dot_segment        fetches=0
second-slug -evil direct              404  reason=dot_segment        fetches=0
TRAVERSAL: all refusals zero bucket reads? True
```

One battery row is **not** a traversal refusal and is recorded separately to be
precise: a well-formed in-prefix `_payload/hidden.html` (no dots) returns 404
after exactly **one** fetch — of `…/_doc/_payload/hidden.html`, inside the
token's own prefix. That is the same confined single-read miss the contract's
`test_a_share_path_is_confined_to_the_token_prefix` asserts; it never reads the
real `_payload`. The traversal refusals above are zero-read. This is correct,
not a failure.

## Check 6 — Identity / IAM. PASS for the Wave 3 delta; 1 pre-existing sub-item unmet.

I ran the plan myself — read-only, `-input=false -lock=false -no-color`, no
`-out` (ADC present; no state mutation):

```text
$ cd infra && terraform plan -input=false -lock=false -no-color
  # google_project_iam_member.hub_gate_firestore must be replaced
-/+ resource "google_project_iam_member" "hub_gate_firestore" {
      ~ id   = "cusati-hub/roles/datastore.viewer/serviceAccount:hub-gate@…" -> (known after apply)
      ~ role = "roles/datastore.viewer" -> "roles/datastore.user" # forces replacement
    }
Plan: 1 to add, 0 to change, 1 to destroy.
```

- **New Firestore grant is exactly `datastore.user` and nothing broader.** The
  only project Firestore role anywhere is `infra/gate.tf:170`
  `roles/datastore.user`; no `datastore.owner`, no other `datastore.*`. The
  action set is only the one IAM member; no bucket, SA, WIF, database, service,
  budget or ruleset resource is added/changed/replaced/destroyed.
- **No key anywhere.** `git grep -n "service_account_key|google_service_account_key"`
  over `infra/` → empty.
- **WIF numeric-id + ref pinning unchanged.** Provider mapping
  `attribute.repository_id_ref = assertion.repository_id + '/' + assertion.ref`;
  `var.github_repository_id`/`owner_id` are forced numeric by validation
  (`infra/variables.tf:81,92`). Live plan ids:
  `.../attribute.repository_id_ref/1212933399/refs/heads/main` (hub deploy),
  `/1211056144/refs/heads/master` (cv), etc. Satellites use a **separate pool**
  (`infra/satellites.tf:41`).
- **No satellite `list`.** `infra/satellite-role.tf` grants exactly
  `storage.objects.create`, `.delete`, `.get`; `storage.objects.list` is absent
  by design; the only `list` in the module is `privateSyncWriter`, on the private
  bucket alone.
- **Public deploy identity holds no private-bucket permission — UNMET
  (pre-existing, out of Wave 3 scope).** The live plan refreshes
  `google_storage_bucket_iam_member.hub_deploy_private_sync: … [id=b/cusati-hub-private/…/roles/privateSyncWriter/serviceAccount:hub-deploy@…]`
  and `infra/private-bucket.tf:210-214` declares it. `hub-deploy` is both the
  public-site deploy identity and the private-sync writer. This is Wave 0 item 3
  (STATE 2101–2104, deferred 2026-09-17); the Wave 3 `infra` contract forbids any
  binding/SA change beyond the datastore role. Named in the round-2 brief as a
  standing finding, not this wave's.

## Check 7 — Firestore. PASS

- `git diff --stat main...HEAD -- infra/firestore.tf` → empty; the deny-all
  ruleset (`match /{document=**} { allow read, write: if false; }`) and the
  release are unchanged, `ignore_changes = [source[0].language]` intact.
- Live plan **refreshes** the ruleset/release but the action set contains
  **0** `firebaserules_*` resources; no replacement:

```text
google_firebaserules_ruleset.firestore_deny_all: Refreshing state… [405d371b-…]
google_firebaserules_release.firestore:           Refreshing state… [cloud.firestore]
sed -n '/will perform/,/^Plan:/p' | grep -c firebaserules   -> 0
```

- **Live Web-SDK-equivalent read refused.** Using the public web API key from the
  live sign-in page, Firestore REST:

```text
GET  …/documents/members/djjay@vt.edu?key=…  -> HTTP 403 PERMISSION_DENIED
GET  …/documents/shares/anything?key=…       -> HTTP 403 PERMISSION_DENIED
LIST …/documents/members?key=…               -> HTTP 403 PERMISSION_DENIED
LIST …/documents/shares?key=…                -> HTTP 403 PERMISSION_DENIED
```

`members/` and `shares/` are unreadable from the Web SDK by the released rules
(which bind every client SDK; the Admin SDK the gate uses bypasses them).

## Check 8 — Supply chain. PASS for the Wave 3 delta; pyjwt medium noted.

```text
$ cd site && npm audit --omit=dev --json
{ "critical":0, "high":6, "moderate":0, "low":0, "info":0, "total":6 }

$ npm run check:npm-audit
check-npm-audit: npm audit --omit=dev reports 0 critical, 6 high, 0 moderate, 0 low.
check-npm-audit: 2 accepted advisory(ies) in the baseline, 1 NEW.
  NEW  high GHSA-ch52-4w7c-c8xp  http-cache-semantics
check-npm-audit: 3 unique advisory(ies) total.        EXIT=1 (local; CI runs --report)
```

**Raw counts:** 0 critical, **6 high** (5 packages), **3 unique advisories**
(2 accepted `@grpc/grpc-js`, 1 new `http-cache-semantics`). **New vs `main`:
none.** The resolved versions are byte-identical on `main` and HEAD —
`http-cache-semantics 4.2.0`, `astro 7.3.3`, `@grpc/grpc-js 1.9.16`,
`firebase 12.19.0`, `@firebase/firestore 4.17.2` — so the new advisory is the
“world changed after the 2026-10-01 baseline” case the baseline comment
describes, not a Wave 3 regression. CI runs `--report` (non-blocking).

- **New React deps:** `@astrojs/react ^7.0.0`, `react ^19.3.0`,
  `react-dom ^19.3.0`; devDeps `@types/react ^19.3.0`, `@types/react-dom ^19.3.0`.
  Lockfile resolves `react 19.3.0`, `react-dom 19.3.0`, `@astrojs/react 7.0.0`.
  The repo convention is caret ranges in `package.json` + exact versions in the
  lockfile; there is no exact-pin manifest style to match.
- **Lockfile from the registry only:** 485/485 `"resolved"` URLs are
  `https://registry.npmjs.org/`; 0 non-registry.
- **`pip-audit` (gate):** 1 finding, **medium** — `pyjwt 2.14.0`,
  `PYSEC-2026-4141` / `GHSA-42vr-xj54-vc7v` / `CVE-2026-101918`, CVSS 3.1 **5.3
  (Medium)**, fix `2.15.0`. **No high/critical.** It is an unauthenticated
  request-level `RecursionError` on the `verify_signature=False` /
  `get_signing_key_from_jwt` pre-verification path; the gate verifies signatures
  before payload parse, and `pyjwt` is hash-pinned (`requirements.txt:856`).

## Check 9 — Static public site. PASS

```text
$ node -e "…firebase.json…"
rewrites: ["/p/**","/session","/session/end","/client-events","/share","/share/**","/s/**"]
rewrite count: 7     functions: null
```

Exactly the seven known rewrites, all to `hub-gate`; `git diff main...HEAD --
firebase.json` adds only `/share` (the bare path Red Team finding B), `/share/**`
and `/s/**`. No `functions`, no SSR, no unauthorised rewrite. The gate route
table is exactly `/_health`, `/session`, `/session/end`, `/client-events`,
`/p/{path}`, `/share` (GET/POST), `/share/{token}` (DELETE), `/s/{token}/{path}`
— nothing broader.

## Check 10 — Budget / logging. PASS; live Cloud Logging NOT TESTED.

```text
$ python3 infra/scripts/check_private_bucket_config.py               EXIT=0
OK: private bucket declares UBLA and enforced public access prevention, names no
anonymous principal, and carries exactly two bindings …
$ git ls-files -- infra | grep -i override                            # (none)
infra/budget.tf: google_billing_budget.hub with prevent_destroy = true
```

**No token, item triple or entry in any `event=` line.** `infra`-side grep of
`gate/app/main.py` shows mint logs `id=%s by=%s` (`_short_share_id`, 12 chars),
list logs `count=%d by=%s`, revoke logs `id=%s by=%s`; the removed D5
`item=<section>/<source>/<slug>` is gone. Observed live in the HTTP run:

```text
INFO gate event=allow scope=share action=mint id=R79rGGwLa9A6 by=djjay@vt.edu
INFO gate event=allow scope=share action=list count=10 by=djjay@vt.edu
INFO gate event=allow scope=share action=revoke id=ACTIVE by=djjay@vt.edu
```

`/s/**` passes the object name through `_log_path`, which emits nothing unless
`GATE_LOG_OBJECT_PATHS` is set (`config.py:148` default `False`); the full token
is returned once in the mint response body and never logged. `entry` is never
interpolated into a log line. **Whether these lines surface in Cloud Logging is
live behaviour not reachable pre-merge → NOT TESTED.**

---

## FAIL reproduction (minimal)

**No Wave 3-introduced FAIL.** For the one unmet pre-existing clause (Check 6):

```bash
cd infra
terraform plan -input=false -lock=false -no-color | grep hub_deploy_private_sync
#   google_storage_bucket_iam_member.hub_deploy_private_sync: Refreshing state...
#   [id=b/cusati-hub-private/…/roles/privateSyncWriter/serviceAccount:hub-deploy@…]
python3 scripts/check_private_bucket_config.py    # asserts that binding exists
```

`hub-deploy` is the public-site deploy identity **and** the private-sync writer,
so it holds `storage.objects.get/list/create/delete` on the private bucket.
Closing it requires the Wave 0 item 3 split (a dedicated private-sync SA and a
second auth step in `build.yml`), which the Wave 3 `infra` contract forbids.
Already recorded and deferred (STATE.md 2101–2104).

## Assumptions / limits

- Round 2 reviewed `fcecfd8` (the D1 fix); round 1 reviewed `c605c72`. The
  comparison against `main` for Check 8 uses the branch lockfile and
  `git show main:site/package-lock.json`.
- The Check 2/3/4/5 HTTP runs use `uvicorn` + the gate's **own** in-memory
  doubles from `gate/tests/conftest.py` (no cloud credentials created), driven
  by `curl --path-as-is` so the server sees literal dots. The `_doc` objects and
  the canaries (`"Member frame (must not serve)"`, `"Item payload (must not
  serve)"`, `"Evil sibling"`) are the ones conftest already defines.
- Check 6/7’s plan was run read-only (`-input=false -lock=false -no-color`, no
  `-out`); ADC was already present in the environment. No `apply`.
- The Check 7 Web-SDK read is a read-only REST GET with the public API key from
  the live sign-in page; no session, no write.
- “Public deploy identity” = `hub-deploy` (`deploy.tf`), the identity that
  deploys the public site (`GCP_DEPLOY_SA`); it is also the private sync identity
  today. The split is unresolved and is the standing finding.
- `pip-audit`’s `pyjwt` medium is reported, not reachable pre-auth in this gate
  (signature verified before payload parse) and not high/critical.
- No tracked file was modified; `/tmp/opencode/st2/**` holds the throwaway
  harness, transcripts and plan output.

## Related docs

- `llm/sprints/2026-09-hub/contracts/security-tester-wave-3.md`
- `llm/sprints/2026-09-hub/contracts/phase-4-seams.md` (SEAM-S1..S8)
- `llm/sprints/2026-09-hub/handoffs/{gate-wave-3,gate-wave-3-section,gate-wave-3-entry,site-wave-3-entry,site-wave-3-d1,infra-wave-3,red-team-wave-3,dissenter-wave-3}.md`
- `gate/app/{main,serve,shares,config}.py`, `gate/tests/{conftest,test_shares}.py`
- `site/src/lib/frame-content.mjs`, `site/scripts/private-build.mjs`,
  `site/dist-private/`
- `infra/{gate,firestore,private-bucket,wif,satellites,satellite-role,budget}.tf`,
  `firebase.json`
- `llm/sprints/2026-09-hub/STATE.md` (item 3, 2101–2104)
