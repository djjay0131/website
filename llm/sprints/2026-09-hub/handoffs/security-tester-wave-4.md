# Handoff — Security Tester, Wave 4 (Phase 5: `construction-ai`)

Status: Delivered
Date: 2026-10-03
Stream: Security Tester (read only; wrote this file)
Issue: `hub-005`
Branch: `feat/construction-ai` @ `834465f`
Satellite repo: `djjay0131/construction-ai-proposal` @ `feat/hub-publish` `5201b47`
Contract: `llm/sprints/2026-09-hub/contracts/security-tester-wave-4.md`
Seams: `phase-5-seams.md` (SEAM-C1…C6)
Authority: run-brief §6 (`llm/plans/2026-10-01-completion-brief.md`), scoped by the wave-4 contract
Artifacts: `/tmp/opencode/wave4-plan.txt`, `/tmp/opencode/ca-sources.z8QkMv/`,
`/tmp/opencode/ca-leak.J5TC3s/`, `/tmp/opencode/ca-dist/`

## Verdict

**Not blocked: 0 FAIL.** The six scoped Wave 4 checks are all **PASS**. Nothing
this branch changes turns any §6 clause red. Two §6 clauses are outside this
wave's scope and **NOT TESTED** here (the live prefix proof — the Boundary
Tester's post-apply step — and the first satellite publish); standing pre-existing
findings from Wave 3 are restated, unchanged and not introduced by this branch.

## Check table

| # | Check | Verdict | Evidence |
|---|---|---|---|
| 1 | No private content on the public path (new source absent; guard red→green) | **PASS** | build + isolated plant, below |
| 2 | Identity: WIF pins id+owner+name+`refs/heads/master`; SA only `satellitePublisher` w/ prefix condition; no project role; no `list`; no key; 0 destroy/replace | **PASS** | plan + guards, below |
| 3 | Static public site: `firebase.json` unchanged (Wave 3's 7 rewrites) | **PASS** | byte-identical `main`↔`HEAD` |
| 4 | Supply chain: satellite workflow actions SHA-pinned; no new advisory | **PASS** (with ADR-0014 note) | `uses:` audit + npm/pip audit |
| 5 | Firestore deny-all released; ruleset/release not in plan action set | **PASS** | live 403 + plan |
| 6 | Budget green | **PASS** | budget-guard steps reproduced |

Blocking count: **0** (a single FAIL would block; there is none).

---

## Check 1 — No private content on the public path. PASS

The branch touches no `site/` file (`git diff --name-only main...HEAD -- site/`
→ empty), so the public output is unchanged by the wave. Built and checked:

```text
$ cd site && npm run build:public
[hub-public-build] staged 3 payload file(s) for 1 public framed item(s)
[build] 26 page(s) built in 2.08s          EXIT=0

$ npm run check:no-private-in-public
check:no-private-in-public: 4 private item(s) to look for in dist-public:
  cv/anthropic-fellow, phd-milestones/milestones,
  phd-milestones/committee-dossier, phd-milestones/internal-notes
check:no-private-in-public: PASS — no private slug, source, route, payload path,
  title or summary appears in any path or any file's contents under dist-public
  (162 files scanned).                      EXIT=0
```

**The new source's items, proved against the real `dist-public`.** The satellite
manifest (source `construction-ai`, both items `visibility: private`, not in
`site/publish-allowlist.json` per SEAM-C4) was staged into an *isolated* sources
dir (`--sources /tmp/opencode/ca-sources.*/`, no tracked file touched):

```text
$ node scripts/check-no-private-in-public.mjs --sources "$SRC" --dist dist-public
check:no-private-in-public: 2 private item(s) to look for in dist-public:
  construction-ai/construction-ai-proposal — needles: qualified-id, slug, route, source, payload-path, title, summary
  construction-ai/construction-ai-site     — needles: qualified-id, slug, route, source, payload-path, title, summary
check:no-private-in-public: PASS — … (162 files scanned).     EXIT=0

$ grep -rli "construction-ai" dist-public || echo "(none)"
(none)
```

**Red→green.** (a) The guard is proven red on a leak of the *new source's* item
planted into an isolated copy of the build:

```text
$ cp -r dist-public/. "$D" && printf '<a href="/projects/construction-ai/construction-ai-site/">Construction.AI — Project Overview</a>\n' >> "$D/index.html"
$ node scripts/check-no-private-in-public.mjs --sources "$SRC" --dist "$D"
check:no-private-in-public: 6 LEAK(S) …
  index.html  contents: source of construction-ai/construction-ai-proposal — "construction-ai"
  index.html  contents: qualified-id / slug / route / title of construction-ai/construction-ai-site
              EXIT=1
```

The real `dist-public` was never written to (re-grepped after: `(none)`).
(b) The repo's own isolated red→green also passes:

```text
$ npm run demo:leak-check
demo:leak-check: the check exited 1 (1 means it caught the leak).
demo:leak-check: PASS — the guard failed on the injected leak …  EXIT=0
```

The manifest is also contract-valid (`node contract/validate-manifest.mjs --dist
/tmp/opencode/ca-dist --source construction-ai`: schema/paths/source all passed;
dist = `index.html`, `main.pdf`, `manifest.json`).

## Check 2 — Identity. PASS

`infra/satellites.tf` and `infra/satellite-role.tf` are **unchanged** in the
branch (`git diff main...HEAD -- infra/satellites.tf infra/satellite-role.tf
infra/wif.tf infra/firestore.tf infra/budget.tf infra/private-bucket.tf
infra/gate.tf` → empty). The only code change is a roster entry appended to
`var.satellites`. Read-only plan (`terraform plan -lock=false -input=false
-no-color`, no `-out`):

```text
Plan: 4 to add, 0 to change, 0 to destroy.
```

The action set is exactly the four derived, all `["construction-ai"]`, all
`will be created`: the WIF provider, the SA, the impersonation binding, the
conditioned bucket binding. Every stateful resource is **refreshed only** —
`google_storage_bucket.content`/`private`, `google_firestore_database.hub`,
`google_identity_platform_config.hub`, `google_firebaserules_ruleset.firestore_deny_all`,
`google_firebaserules_release.firestore`, `google_billing_budget.hub`, `hub-gate`/
`hub-deploy`, the `kgis` satellite resources — and appears in **no** action set
(`grep "must be replaced|will be destroyed|will be updated|forces replacement"`
→ none).

Derived values, straight from the plan:

```text
provider  attribute_condition = "assertion.repository_id == '1134376420' &&
            assertion.repository_owner_id == '5666389' &&
            assertion.repository == 'djjay0131/construction-ai-proposal' &&
            assertion.event_name != 'pull_request_target'"
          provider id = "github-construction-ai"  (pool "satellites")
SA        account_id = "publish-construction-ai"  (no key field; none exists anywhere)
binding   role = "roles/iam.workloadIdentityUser"
          member = ".../attribute.repository_id_ref/1134376420/refs/heads/master"
bucket    role = "projects/cusati-hub/roles/satellitePublisher"
          condition.expression = "...resource.name.startsWith(
            'projects/_/buckets/cusati-hub-content/objects/sources/construction-ai/')"
```

No project-level role for the SA (none in `satellites.tf`; guard step 5 passes),
no `google_service_account_key` anywhere (`grep` → none), and the custom role
holds exactly `create/delete/get` with no `list`. Both credential-free guards
were run from the repo root, the second extracted verbatim from `build.yml`:

```text
$ python3 infra/scripts/check_private_bucket_config.py
OK: private bucket declares UBLA and enforced public access prevention …  EXIT=0

$ # .github/workflows/build.yml "Check the satellite boundary invariants…" step, run verbatim
OK: uniform bucket-level access is declared on BOTH buckets; satellite_publisher
holds exactly ['storage.objects.create', 'storage.objects.delete', 'storage.objects.get']
and never storage.objects.list; all 1 satellite binding(s) use that custom role
with a startsWith prefix condition; and no satellite holds a project-level role.  EXIT=0
```

`terraform fmt -check` (exit 0) and `terraform validate` (`Success! The
configuration is valid.`) are clean; `git status` after the run is empty, so no
tracked file was modified.

## Check 3 — Static public site. PASS

`firebase.json` is **not** in the branch diff and is byte-identical to `main`:

```text
$ git rev-parse main:firebase.json HEAD:firebase.json
b194674517c3a290c82b2982542ac19cdb627ac2
b194674517c3a290c82b2982542ac19cdb627ac2

$ node -e "…"
rewrites: 7
sources: /p/**, /session, /session/end, /client-events, /share, /share/**, /s/**
functions: null
redirects: 3   (the two anthropic-fellow 302s + their /**)
```

Wave 3's seven rewrites, no functions, no SSR — unchanged.

## Check 4 — Supply chain. PASS (one ADR-0014 note, not a FAIL)

The new satellite workflow's third-party actions are SHA-pinned with `# vN`
comments:

```text
.github/workflows/publish-hub.yml:
  uses: actions/checkout@fbc6f3992d24b796d5a048ff273f7fcc4a7b6c09   # v5
  uses: actions/setup-node@a0853c24544627f65ddf259abe73b1d18a591444 # v5
  uses: djjay0131/website/contract/publish@v1   # hub's own action
```

The existing `build-and-publish-pdf.yml` is also fully SHA-pinned. The hub's
`contract/publish/action.yml` pins its own inner actions
(`google-github-actions/auth@7c6bc7…`, `upload-cloud-storage@6397bd…`).

**ADR-0014 note (recorded, not a FAIL).** The two contract files are fetched at
the moving `v1` tag (`raw.githubusercontent.com/djjay0131/website/v1/…`,
`publish-hub.yml:72,75`) and the action is `contract/publish@v1`. The satellite
contract's phrase "by SHA-pinned fetch" reads against its own explicit `v1` URL;
**ADR-0014 decision 4 governs** — the hub's own contract action *and* the fetched
validator/schema must share the moving `v1` ref, and decision 5 exempts only the
hub's own contract from the third-party SHA rule. The new workflow matches the
reference satellite `agentic-kg-research/.github/workflows/publish.yml` exactly.
The satellite handoff (`satellite-construction-wave-4.md`, open question 2) flags
the same phrase. This is the approved carve-out, not an unpinned third party.

**No new advisory.** The branch changes no dependency manifest or lockfile
(`site/` and `gate/` diffs empty; the 13-file branch diff is `infra/*` + `docs/`):

```text
$ npm audit --omit=dev  (site/)
{"info":0,"low":0,"moderate":0,"high":6,"critical":0,"total":6}

$ npm run check:npm-audit
… 0 critical, 6 high … 2 accepted, 1 NEW
  NEW  high GHSA-ch52-4w7c-c8xp  http-cache-semantics
  (the Wave 3 "world changed, not the code" advisory; EXIT=1 local, EXIT=0 --report)

$ uv run --with pip-audit pip-audit --path .venv/lib/python3.12/site-packages  (gate/)
pyjwt 2.14.0  PYSEC-2026-4141  Fix 2.15.0   (medium only; no high/critical)
```

Zero critical and zero high/critical newly introduced. The one high "NEW vs
baseline" was already present on `main` and recorded in Wave 3; the branch does
not touch that lock.

## Check 5 — Firestore. PASS

`infra/firestore.tf` is unchanged on the branch. The ruleset is the deny-all
`match /{document=**} { allow read, write: if false; }`, released as
`cloud.firestore`, with `ignore_changes = [source[0].language]`. The plan
**refreshes** both and has them in **no** action set:

```text
google_firebaserules_ruleset.firestore_deny_all: Refreshing state… [405d371b-…]
google_firebaserules_release.firestore:          Refreshing state… [cloud.firestore]
# no "will be created/destroyed/updated/replaced" line for either
```

Live Web-SDK-equivalent read (public API key from the live `/signin/` page,
Firestore REST):

```text
GET  …/documents/members/djjay@vt.edu?key=…  → HTTP 403 PERMISSION_DENIED
GET  …/documents/shares/anything?key=…        → HTTP 403 PERMISSION_DENIED
LIST …/documents/members?key=…                → HTTP 403 PERMISSION_DENIED
```

`members/` and `shares/` are unreadable through the released deny-all rules.

## Check 6 — Budget green. PASS

Both credential-free steps of the `budget-guard` job reproduced from the repo
root; `infra/budget.tf` is unchanged on the branch and the plan does not touch
`google_billing_budget.hub`:

```text
# override-file guard
OK: no override.tf* or *_override.tf* file is tracked under infra/.   EXIT=0

# budget declaration guard (perl, comments stripped first)
OK: infra/budget.tf declares google_billing_budget.hub with prevent_destroy = true.  EXIT=0
```

---

## NOT TESTED (stated, not glossed)

1. **Live prefix boundary (SEAM-C6) — NOT TESTED.** The `publish-construction-ai`
   identity does not exist yet; the plan only *adds* it, and the stream does not
   apply. Create/overwrite/read/delete inside `sources/construction-ai/`, the
   refusals (`cv`, `kgis`, `agentic-kg-research`, `-evil/`, bucket root), no
   `list`, and the reverse `cv` leg are the **Boundary Tester's post-apply step**
   under a temporary impersonation grant. This contract's Check 2 verifies the
   *declared* boundary and the plan, not the live one.
2. **First satellite publish / `GCP_*` repo variables — NOT TESTED.** No
   `construction-ai` prefix exists in the content bucket; the satellite's
   `publish-hub.yml` has not run. `EXPECTED_SOURCES` is correctly *not* extended
   (SEAM-C5: after first publish).
3. **CI `pip-audit` — NOT TESTED (standing).** It is not wired into any workflow
   (Wave 3, unchanged); the local run found only the medium `pyjwt`. No
   high/critical.
4. **`hub-deploy` holds private-bucket permission — standing, pre-existing,
   out of scope.** §6's "public deploy identity holds no private-bucket
   permission" remains unmet in config (`hub-deploy` is both the public-site
   deploy identity and the private-sync identity); the Wave 4 `infra` contract
   forbids touching bindings/SAs and the plan adds none. Recorded in Wave 3 and
   STATE, not introduced or worsened by this branch.

## Recommendations

1. Run the SEAM-C6 boundary proof after the Lead Architect applies the four
   resources, before the satellite's first publish.
2. On first successful publish, add `construction-ai` to `EXPECTED_SOURCES`
   (`required: false` → `true`) on the `kgis` pattern, so the leak check and the
   missing-prefix check cover it (SEAM-C5).
3. The `v1` fetch/action is by design (ADR-0014); no change. If the intent was a
   commit SHA, that is an ADR override, not this wave's edit.

## Related docs

- `llm/sprints/2026-09-hub/contracts/security-tester-wave-4.md`
- `llm/sprints/2026-09-hub/contracts/phase-5-seams.md` (SEAM-C1…C6)
- `llm/sprints/2026-09-hub/contracts/infra-wave-4.md`,
  `contracts/satellite-construction-wave-4.md`
- `llm/sprints/2026-09-hub/handoffs/infra-wave-4.md`,
  `handoffs/satellite-construction-wave-4.md`
- `llm/governance/adr/0014-satellites-call-the-publish-contract-at-a-moving-v1-tag.md`
- `llm/plans/2026-10-01-completion-brief.md` §6
