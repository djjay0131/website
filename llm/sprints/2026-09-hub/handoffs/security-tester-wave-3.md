# Handoff — Security Tester, Wave 3 (Phase 4 sharing)

Status: Delivered
Date: 2026-10-03
Stream: Security Tester (read + write to this file only)
Issue: `hub-004`
Branch: `feat/sharing` @ `c605c72`
Contract: `llm/sprints/2026-09-hub/contracts/security-tester-wave-3.md`
Seams: `phase-4-seams.md` SEAM-S3, S5, S8
Authority: run-brief §6 security gate
Artifacts: `/tmp/opencode/plan.txt`, `/tmp/opencode/cache_matrix.py`,
`/tmp/opencode/http_checks.sh`, `/tmp/opencode/gate_server.py`,
`/tmp/opencode/npm-audit.json`, `/tmp/opencode/pipaudit.json`

## Verdict

**The Wave 3 merge is not blocked: 0 FAILs introduced by this branch.**

Nine contract checks were run. Eight are **PASS**. One sub-item of Check 5
("the public deploy identity holds no private-bucket permission") is **unmet in
config**, but it is a **pre-existing, out-of-scope condition** that the Wave 3
`infra` contract expressly forbids this branch from touching, already recorded
and deferred by the design authority (STATE.md 2101–2104, dated 2026-09-17). It
is a standing finding, not a Wave 3 regression. Check 7's *CI* `pip-audit` clause
is **NOT TESTED** (pip-audit is not wired into CI); the local run found no
high/critical. No tracked file was modified by this run.

## Check table

| # | Check | Verdict | Evidence |
|---|---|---|---|
| 1 | No private content on the public path | **PASS** | build + isolated plant, below |
| 2 | `private, no-store` on every `/s/**`, `/share/**` outcome | **PASS** | 14 outcomes × 2 transports |
| 3 | Gate refusals (404 / 403, no oracle) | **PASS** | identical-body proofs |
| 4 | Traversal suite, no bucket read | **PASS** | `--path-as-is`, 13 spellings, 0 fetches |
| 5 | Identity / IAM | **PASS** (Wave 3 delta); 1 pre-existing sub-item unmet | plan + config |
| 6 | Firestore deny-all / SDK unreadable | **PASS** | live 403 on `members/`, `shares/` |
| 7 | Supply chain | **PASS** (Wave 3 delta); CI `pip-audit` **NOT TESTED** | raw counts below |
| 8 | Static public site (`firebase.json`) | **PASS** | exactly 6 rewrites, no functions |
| 9 | Budget / logging | **PASS**; live Cloud Logging **NOT TESTED** | guard green, no secret |

---

## Check 1 — No private content on the public path. PASS

```text
$ cd site && npm run build:public
[build] 26 page(s) built in 1.74s
[hub-public-build] staged 3 payload file(s) for 1 public framed item(s)
EXIT=0

$ find dist-public -path '*share*' -o -iname '*shares*'
(none)

$ grep -rl "SharesIsland\|react-dom\|react/jsx-runtime\|astro-island" dist-public
(none)

# contrast: the island IS in the private output
$ find dist-private -path '*share*'
dist-private/shares
dist-private/shares/index.html
$ grep -rl "SharesIsland\|astro-island" dist-private
dist-private/_astro/SharesIsland.BMhcWC-r.js   # (found; glob shows page)
```

`srcDir` switches `./src` → `./src-private` and the React integration is mounted
only in the private branch (`site/astro.config.mjs:51,66`), so the public router
is never shown the page. Absence is structural, and the two builds above prove
it: 162 files in `dist-public`, none a Shares trace; the island and React runtime
exist only in `dist-private`.

Isolated plant (the real `dist-public` is never touched):

```text
$ npm run check:no-private-in-public
check:no-private-in-public: 4 private item(s) to look for in dist-public: ...
check:no-private-in-public: PASS — no private slug, source, route, payload path,
  title or summary appears in any path or any file's contents under dist-public
  (162 files scanned).                       EXIT=0

$ npm run demo:leak-check
demo:leak-check: injected two deliberate leaks into a COPY of the public build
check:no-private-in-public: 5 LEAK(S) of private content into /tmp/hub-leak-demo-*/dist-public:
  cv/cv/anthropic-fellow/index.html    path: slug ...
  index.html    contents: qualified-id / slug / route / title ...
demo:leak-check: the check exited 1 (1 means it caught the leak).
demo:leak-check: PASS — the guard failed on the injected leak ...
             The real dist-public was never modified.        EXIT=0
```

The guard is proven red (exit 1) on an injected leak in an isolated copy, and the
plant is removed by the script's `finally`. Post-run: `find dist-public` shows no
`anthropic-fellow` / `committee-dossier` / `internal-notes` residue.

## Check 2 — Caching. PASS

`tests/test_shares.py::test_every_share_response_is_private_no_store` is
parametrised over both transports. I additionally ran an explicit matrix with the
in-memory doubles covering **every** contract outcome including a **revoked**
token (`/tmp/opencode/cache_matrix.py`):

```text
  [hosting] served/unknown_token/expired_token/revoked_token/traversal/
            missing_file/mint/mint_refused/mint_cross_origin/list/
            list_refused/revoke/revoke_refused/revoke_cross_origin
  [direct]  (same 14)
  all: status ∈ {200,403,404}, cache-control='private, no-store'  OK
CACHING MATRIX: ALL private, no-store (PASS)     EXIT=0
```

The header is applied unconditionally by `security_headers` middleware
(`gate/app/main.py:285–293`), after the route runs, so no framework default can
leave a cacheable header. No outcome carries `public` or `s-maxage`. This closes
A7's `/s/**` half.

## Check 3 — Gate refusals. PASS

Over real HTTP (`curl --path-as-is`), through the app with the doubles
(`/tmp/opencode/http_checks.sh`):

```text
== /s/** token outcomes (identical 404 body, no oracle) ==
served          status=200 body_md5=b2613a7f... cache-control=private, no-store
unknown(token)  status=404 body_md5=1c2465fa...
expired(token)  status=404 body_md5=1c2465fa...
revoked(token)  status=404 body_md5=1c2465fa...

== management refusals (all identical bodies) ==
anonymous mint / list / revoke              status=403 body_md5=fa3ebefe...
nonowner  mint / list / revoke              status=403 body_md5=fa3ebefe...
cross-origin mint / revoke                  status=403 body_md5=fa3ebefe...
```

Unknown, expired and revoked are byte-identical 404s — no existence oracle (the
gate never echoes the path, the token or the exception; `gate/app/main.py:300–317`,
`611–642`). Non-owner members and anonymous callers are refused on mint, list and
revoke; cross-origin state changes are refused by `_refuse_cross_origin`
(`main.py:845–863`). Backed by `tests/test_shares.py` (249 tests across
`test_shares.py`+`test_headers.py`+`test_paths.py`; 419 in the full suite, all
passing).

## Check 4 — Traversal suite, no bucket read. PASS

`/s/{token}/<path>` with `--path-as-is`, 9 spellings, `%2e%2e%2f`, `..%2f`,
double-encoded, absolute, backslash, NUL, and a full sibling-item path:

```text
s/%2e%2e%2fsecrets           404   s/%252e%252e%252fsecrets  404
s/..%2fsecrets               404   s/%2fetc%2fpasswd         404
s/phd%2f..%2f..%2fsecrets    404   s/..%5csecrets            404
s/phd%5c..%5c..%5csecrets    404   s/%00                     404
s/phd/phd-milestones/../../cv/cv/academic/index.html  404
bucket fetches during the traversal suite: 0 (must be 0)
```

`/p/**` with `--path-as-is`, 4 spellings → all 404, **0 bucket fetches**.

Confinement (a *different* property, deliberately separated): a sibling-item path
inside the prefix produces exactly one fetch, always under the token's own
prefix and always a miss:

```text
s/second-slug         404  fetched: phd/phd-milestones/committee-dossier/second-slug
s/sibling-second-item 404  fetched: phd/phd-milestones/committee-dossier/phd/.../committee-dossier-evil/index.html
```

The prefix can be extended but never escaped, so a token can never address a
second item. `safe_object_path`/`safe_prefix` (`gate/app/serve.py:42–118`,
`main.py:916–935`) are an **allowlist**, not a blocklist: `..`, encoded/double-
encoded dots, absolute paths, backslashes, NUL and control characters are refused
as a side effect. Unit proof: `tests/test_paths.py` (25 `HOSTILE_PATHS`, 17
`HOSTILE_REQUESTS`) and `tests/test_shares.py` traversal/confinement cases — all
assert `store.fetches == []`.

## Check 5 — Identity / IAM. PASS for the Wave 3 delta; 1 pre-existing sub-item unmet.

Read-only plan (no state mutation, no `-out`): `terraform plan -lock=false
-input=false -no-color`:

```text
  # google_project_iam_member.hub_gate_firestore must be replaced
-/+ resource "google_project_iam_member" "hub_gate_firestore" {
      ~ role = "roles/datastore.viewer" -> "roles/datastore.user" # forces replacement
    }
Plan: 1 to add, 0 to change, 1 to destroy.
```

- **New Firestore grant is exactly the contract's and nothing broader.** The one
  gate project role change is `datastore.viewer → datastore.user`
  (`infra/gate.tf:168–172`). No other `datastore.*`/Firestore IAM anywhere;
  not `datastore.owner`. The gate's project roles are exactly
  `datastore.user` + the custom `gateSessionMinter`; the bucket role is
  `privateObjectReader` (`storage.objects.get` only). No stateful
  destroy/replace: the ruleset, release, database, buckets, SAs, WIF, budget and
  the four live `kgis` resources are absent from the plan's action set.
- **No key anywhere.** `grep -rn "google_service_account_key|service_account_key"
  infra/*.tf` → empty.
- **WIF numeric-id + ref pinning unchanged.** `git diff main...HEAD -- infra/wif.tf
  infra/satellites.tf` → empty. Both providers still map
  `attribute.repository_id_ref = assertion.repository_id + '/' + assertion.ref`
  and the bindings pin `…/attribute.repository_id_ref/<id>/refs/heads/main`; the
  satellites trust boundary remains a **separate pool** (`satellites.tf`).
- **No satellite `list`.** `satellite-role.tf` (unchanged) grants exactly
  `storage.objects.create/delete/get`. The only `storage.objects.list` in the
  module is `privateSyncWriter`, bound on the private bucket alone.
- **Public deploy identity holds no private-bucket permission — UNMET
  (pre-existing, out of Wave 3 scope).** `hub-deploy` (deploy.tf) is the public
  site's deploy identity and still holds `privateSyncWriter` on the private
  bucket; the plan's refresh shows the live binding:

```text
google_storage_bucket_iam_member.hub_deploy_private_sync: Refreshing state...
  [id=b/cusati-hub-private/.../roles/privateSyncWriter/serviceAccount:hub-deploy@...]
```

  `infra/scripts/check_private_bucket_config.py` **asserts this binding exists**
  (`EXPECTED_PRIVATE_BUCKET_BINDINGS`), and the same SA is used for both the
  Hosting deploy and the private sync (`build.yml`, `GCP_DEPLOY_SA`). This is
  Wave 0 item 3 ("dedicated private-sync identity"), recorded as **not taken**
  (STATE.md 2101–2104) because it needs a second auth step in `build.yml`. The
  Wave 3 `infra` contract (requirement 2) forbids any binding/SA change beyond
  the datastore role, so this branch neither introduces nor may fix it.

  **Live policy not queried** (`gcloud` read-only IAM not run); the config and
  the plan refresh are the evidence, and both say the clause is currently unmet.

## Check 6 — Firestore. PASS

- `infra/firestore.tf` is **not in the branch diff** (`git diff --stat
  main...HEAD -- infra/` → only `README.md`, `gate.tf`). The deny-all ruleset
  (`match /{document=**} { allow read, write: if false; }`) and the release are
  unchanged, `ignore_changes = [source[0].language]` intact.
- The plan **refreshes** the ruleset and release but has them in **no action
  set**: `google_firebaserules_ruleset.firestore_deny_all: Refreshing state…
  [405d371b-…]`, `google_firebaserules_release.firestore: Refreshing state…
  [cloud.firestore]`. No replacement.
- **Live Web-SDK-equivalent read refused.** Using the public web API key from the
  live sign-in page (`https://jason.cusati.us/signin/`), Firestore REST:

```text
GET  …/documents/members/djjay@vt.edu?key=… → HTTP 403 PERMISSION_DENIED
GET  …/documents/shares/anything?key=…      → HTTP 403 PERMISSION_DENIED
LIST …/documents/members?key=…              → HTTP 403 PERMISSION_DENIED
```

`members/` and `shares/` are unreadable from the Web SDK by the released rules.

## Check 7 — Supply chain. PASS for the Wave 3 delta; CI `pip-audit` NOT TESTED.

```text
$ npm audit --omit=dev --json
{ "info":0, "low":0, "moderate":0, "high":6, "critical":0, "total":6 }
```

Raw counts: **0 critical, 6 high**. The repo's own guard:

```text
$ npm run check:npm-audit            # local, non --report
check-npm-audit: npm audit --omit=dev reports 0 critical, 6 high, 0 moderate, 0 low.
check-npm-audit: 2 accepted advisory(ies) in the baseline, 1 NEW.
  NEW  high GHSA-ch52-4w7c-c8xp  http-cache-semantics
check-npm-audit: ... EXIT=1
$ npm run check:npm-audit -- --report → EXIT=0   # this is what CI runs
```

The new advisory is **not a Wave 3 regression**: `astro 7.3.3` and
`http-cache-semantics 4.2.0` are byte-identical on `main` and `HEAD`
(`git show main:site/package-lock.json`), i.e. the advisory was published after
the 2026-10-01 baseline — the "world changed, not the code" case the baseline
comment describes. CI runs it `--report` (non-blocking, `build.yml:1009–1014`).

- **New React deps present and lock-resolved:** `@astrojs/react ^7.0.0`,
  `react ^19.3.0`, `react-dom ^19.3.0` (deps); `@types/react ^19.3.0`,
  `@types/react-dom ^19.3.0` (devDeps, new `devDependencies` block). Lockfile
  resolves `react 19.3.0`, `react-dom 19.3.0`, `@astrojs/react 7.0.0`. The repo
  convention is caret ranges + an exact lockfile; I report that rather than
  claim exact pins.
- **Lockfile from the registry only:** 485/485 `"resolved"` URLs are
  `registry.npmjs.org`; zero non-registry URLs.
- **`pip-audit` (gate):** `uvx --from pip-audit pip-audit --path
  .venv/lib/python3.12/site-packages` → **1 finding, medium**:
  `pyjwt 2.14.0`, `PYSEC-2026-4141` / `CVE-2026-101918`, CVSS 3.1 **5.3
  (Medium)**, fix `2.15.0`. **No high/critical.** `pyjwt` is transitive via
  `firebase-admin`; its requirements are exactly hash-pinned (1,129
  `--hash=sha256` lines; Dockerfile installs `--require-hashes --no-deps`).
- **CI clause NOT TESTED:** `grep -rn "pip-audit" .github/` → **not wired into
  CI at all**. The brief's "`pip-audit` clean of high/critical in CI" cannot be
  true or false until it runs there.

## Check 8 — Static public site. PASS

```text
$ node -e "…firebase.json…"
rewrites: /p/**, /session, /session/end, /client-events, /share/**, /s/**
functions: null
has SSR/rewrite to function: false
```

Exactly the six known rewrites; no functions, no SSR, no unauthorised rewrite.
`git diff main...HEAD -- firebase.json` adds only `/share/**` and `/s/**`, both
to `hub-gate`.

## Check 9 — Budget / logging. PASS; live Cloud Logging NOT TESTED.

- **Budget guard green.** The credential-free `budget-guard` step reproduced:

```text
$ python3 infra/scripts/check_private_bucket_config.py
OK: private bucket declares UBLA and enforced public access prevention, names no
anonymous principal, and carries exactly two bindings … EXIT=0
```

  `infra/budget.tf` declares `google_billing_budget.hub` with
  `prevent_destroy = true`; `git ls-files -- infra` shows no tracked
  `override.tf*` / `_override.tf*`.
- **`event=` classes reach the configured log sink.** `_configure_logging()`
  installs a stdout `StreamHandler` (`main.py:57–94`); observed live in the HTTP
  run (`INFO gate event=allow scope=share action=mint …`,
  `event=deny scope=share …`). `tests/test_logging_config.py` asserts against
  stdout, not caplog. Whether those lines surface in **Cloud Logging** is live
  behaviour I cannot reach pre-merge → **NOT TESTED**.
- **No token or secret in any `event=` line.** Grepping the gate for
  `event=.*(token|secret|cookie|idToken|password)` finds only static reasons
  (`event=reject reason=missing_id_token`, `event=deny scope=share
  stage=token reason=unknown|inactive` — the token itself is never interpolated).
  Share logs emit `item=<section>/<source>/<slug> by=<email>` (mint), `count` +
  email (list), and `_short_share_id(token)` — the first 12 chars only — on
  revoke; the full token is returned once, in the mint response body, and never
  logged. `/s/**` logs a path only when `GATE_LOG_OBJECT_PATHS` is on
  (`_log_path`), which it is not in production.

---

## FAIL reproduction (minimal)

There is **no Wave 3-introduced FAIL**. For the one unmet pre-existing clause:

```bash
cd infra
terraform plan -lock=false -input=false -no-color | grep hub_deploy_private_sync
#   google_storage_bucket_iam_member.hub_deploy_private_sync: Refreshing state...
#   [id=b/cusati-hub-private/.../roles/privateSyncWriter/serviceAccount:hub-deploy@...]
python3 scripts/check_private_bucket_config.py   # asserts that binding exists
```

`hub-deploy` is both the public-site deploy identity and the private sync
identity, so it holds `storage.objects.get/list/create/delete` on the private
bucket. Closing it requires the Wave 0 item 3 split (a dedicated `private-sync`
SA and a second auth step in `build.yml`), which the Wave 3 `infra` contract
forbids. Already recorded and deferred: STATE.md 2101–2104.

## Assumptions

- "Prove red" for Check 1 is the isolated `demo:leak-check` plant (the contract
  prefers it); the real `dist-public` was never written to.
- The Check 2/3/4 HTTP runs use `uvicorn` + the gate's **own** in-memory doubles
  from `gate/tests/conftest.py` (there are no cloud credentials here and none
  were created); they exercise the real ASGI stack and `curl --path-as-is`, not
  `TestClient` path-normalisation.
- "Public deploy identity" = `hub-deploy` (`deploy.tf`), the identity that
  deploys the public site (`GCP_DEPLOY_SA`). It is also the private sync
  identity today; the split is unresolved.
- The pre-existing `http-cache-semantics` high is "not a Wave 3 regression"
  because the resolved `astro`/`http-cache-semantics` versions are identical on
  `main` and `HEAD`.
- `pip-audit`'s medium pyjwt finding is reported but not reachable pre-auth in
  this gate: `firebase-admin` verifies the JWT signature before payload parsing,
  and the advisory is limited to `verify_signature=False` /
  `get_signing_key_from_jwt`.

## Recommendations

1. **Land Wave 0 item 3** (dedicated `private-sync` identity) so the public
   deploy identity holds no private-bucket permission; it is the one §6 clause
   still unmet, and it is a standing finding in every wave until done.
2. **Wire `pip-audit` into CI** (the brief's §6 clause is otherwise untestable),
   report-only first, mirroring the `npm audit --report` graduation in #59.
3. **Update `site/audit-baseline.json`** with `GHSA-ch52-4w7c-c8xp` and its
   reachability reason, or bump `http-cache-semantics` once `astro` allows it,
   so the site's own audit guard returns green for the world-change.
4. Consider bumping `pyjwt` to `2.15.0` in the next gate dependency compile.

## Related docs

- `llm/sprints/2026-09-hub/contracts/security-tester-wave-3.md`
- `llm/sprints/2026-09-hub/contracts/phase-4-seams.md` (SEAM-S3/S5/S8)
- `llm/sprints/2026-09-hub/contracts/infra-wave-3.md`
- `llm/sprints/2026-09-hub/handoffs/gate-wave-3.md`, `site-wave-3.md`,
  `infra-wave-3.md`
- `llm/sprints/2026-09-hub/STATE.md` (item 3, 2101–2104)
- `llm/plans/2026-10-01-completion-brief.md` §6
