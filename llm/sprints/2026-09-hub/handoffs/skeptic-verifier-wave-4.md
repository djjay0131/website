# Handoff — Skeptic Verifier, Wave 4 (Phase 5 satellite)

Agent: Skeptic Verifier (independent; authored nothing in this wave)
Contract: `llm/sprints/2026-09-hub/contracts/skeptic-verifier-wave-4.md`
Seams: `llm/sprints/2026-09-hub/contracts/phase-5-seams.md`
Repos: `/home/djjay/code/website` · branch `feat/construction-ai` · HEAD `834465f`;
satellite `/home/djjay/code/construction-ai-proposal` · branch `feat/hub-publish` · HEAD `5201b47`
Issue: `hub-005`

## Headline

**4 fail-able. 0 un-failable. 2 coverage gaps.** (Guard items, per the contract's
list of 7; the inline satellite guard's four assertions and the other multi-check
guards are broken out as rows below.) Wave 3's `_doc`/entry share guards are
regression-clean (`gate` 455 passed; Wave 4 touched no share code).

| Count | Meaning |
|---|---|
| 4 | guards whose violation produced a red check (named below) |
| 0 | tests that stayed green under their own break |
| 2 | guards with **no committed test / CI check**: the roster variable validations, and the satellite publish gate |
| 3 | guards whose **removal** no test would catch (roster validations, both inline CI guard steps) — distinct from fail-ability |

The most important findings: (1) the roster `validation` blocks are exercised by
**nothing in CI** — `terraform validate` returns 0 even with a 30-character source
key, so only a manual `terraform plan` catches a bad roster; and (2) **no test in
either repository reads the satellite's `publish-hub.yml`**, so its
`if: github.event_name != 'pull_request'` publish gate is entirely unguarded.

## Method

Every mutation was applied in place to a tracked file with a `grep -c`-verified
unique anchor, the covering check run, then reverted:

```
git checkout -- <file> && git diff --exit-code -- <file>   # prints nothing = clean
```

The inline satellite guard was **extracted from `.github/workflows/build.yml` by
YAML parse and executed as the exact shell step CI runs** (Wave 0 method);
`/tmp/opencode/skeptic4/satellite-guard.sh`. `terraform plan` used
`-refresh=false -lock=false` (read-only; wrote no state). Final per-repo state:
`git diff --exit-code` clean in both checkouts.

## Guard results — one row per guard

| # | Guard (file) | Break applied | Exact failing check (name) | Verdict |
|---|---|---|---|---|
| 1 | Roster validations `infra/variables.tf:228-266` | key `construction-ai` → `construction-ai-proposal-badkey` (30 chars); then `repository_id` → non-numeric; then `default_branch` → `refs/heads/master` | **none** — but `terraform plan` exits 1 naming `variables.tf:235,3-13` ("at most 22 characters"), the numeric-ID message, and the bare-branch message. `terraform validate` exits **0** on the same tree | **coverage gap** (fires only under `plan`; see R-1) |
| 2 | Inline satellite guard `.github/workflows/build.yml:529` | (a) `storage.objects.list` added to `infra/satellite-role.tf` | `Check the satellite boundary invariants are declared` — "must grant exactly [...] -- got [..., 'storage.objects.list']" | **fail-able** |
| 3 | Inline satellite guard (custom role) | binding role → `"roles/storage.objectViewer"` in `infra/satellites.tf` | same step — "grants a satellite the role ... may hold ONLY ... satellite_publisher" | **fail-able** |
| 4 | Inline satellite guard (`startsWith`) | `resource.name.startsWith(` → `.contains(` in `infra/satellites.tf` | same step — "has no prefix condition using startsWith" | **fail-able** |
| 5 | Inline satellite guard (project-level) | new `google_project_iam_member` on the satellite SA in `infra/satellites.tf` | same step — "grants a satellite a PROJECT-level role" | **fail-able** |
| 6 | `infra/scripts/check_private_bucket_config.py` | `public_access_prevention = "inherited"` in `infra/private-bucket.tf` | script exit 1 — "must set public_access_prevention = \"enforced\"" | **fail-able** |
| 7 | `check_private_bucket_config.py` (role perms) | `private_object_reader` gains `storage.objects.list` | script exit 1 — "must grant exactly ['storage.objects.get'] -- got [...]" | **fail-able** |
| 8 | `check_private_bucket_config.py` (anonymous) | gate binding `member` → `"allUsers"` | script exit 1 — "allUsers must never appear in private-bucket.tf" | **fail-able** |
| 9 | Manifest validator path `contract/validate-manifest.mjs:361` | `if (raw.split(...).includes('..'))` → `if (false)` | `contract` `npm test`: **`not ok 13 - a ".." segment is rejected`** | **fail-able** |
| 10 | Manifest validator path (symlink) `validate-manifest.mjs:379` | containment `if` → `if (false)` | **`not ok 14 - a symlink that leaves dist/ is rejected`** | **fail-able** |
| 11 | Manifest validator source `validate-manifest.mjs:398` | `if (manifest?.source !== expectedSource)` → `if (false)` | **`not ok 16 - a manifest whose source differs from the action input is rejected`** | **fail-able** |
| 12 | Satellite publish gate `construction-ai-proposal/.github/workflows/publish-hub.yml:86` | (not breakable to red — see below) | **none** — no test in either repo references `publish-hub.yml` or `!= 'pull_request'`; the satellite has no test framework | **coverage gap** |
| 13 | `check:no-private-in-public` `site/scripts/check-no-private-in-public.mjs:337` | content matcher `if (!occurs(...))` → `if (true)` | `site` vitest: **`the leak check fails on a private item in the public output > CONTENTS: a private title rendered into a public index page`** (+ route/sitemap/summary/escaped-title, and `the CLI > exits 1 and names the file and the needle on a leak`) | **fail-able** (generic) |

All 6 `check:no-private-in-public` failures under break #13:
`CONTENTS: a private title rendered into a public index page`,
`CONTENTS: a private route in a navigation menu`,
`CONTENTS: a private slug in the sitemap`,
`CONTENTS: a private summary quoted into a public page`,
`CONTENTS: an HTML-escaped private title still matches`,
`the CLI > exits 1 and names the file and the needle on a leak`.

### Regression (contract item 7 — report only if newly weak)

`gate` suite: **455 passed**. Wave 4 changed no `gate/` file (the `_doc`/entry
guards are byte-identical to the Wave 3 hardened state, HEAD `fcecfd8`). Not newly
weak; no break was applied to share code, per the task.

## Coverage gaps

**R-1 — the roster `validation` blocks are unexercised by CI, and `terraform
validate` does not evaluate them.** Injecting a 30-char source key
(`construction-ai-proposal-badkey`) leaves `terraform validate` at exit 0; only
`terraform plan` fails, on both `length <= 22` and `length <= 25`. No workflow in
`.github/workflows/` runs `terraform validate` or `terraform plan` (the only
Terraform-touching CI is the two Python guard scripts). A wrong `repository_id`,
a non-numeric ID, or a `refs/heads/`-prefixed branch would ship green through CI
and surface only at the Lead Architect's manual plan.

**R-2 — the satellite publish gate has no test at all.** `grep` over
`site/`, `contract/`, `gate/`, `.github/` finds no reference to `publish-hub.yml`;
the satellite checkout contains no `*.test.*`/`test_*.py`. Removing or inverting
`if: ${{ github.event_name != 'pull_request' }}` (line 86) would publish from
`pull_request` runs with nothing to notice. `actionlint` remains **NOT TESTED**
(not installed; the Wave 4 handoff records the same).

**R-3 (minor, by design) — no construction-ai-specific leak fixture.**
`check:no-private-in-public` is fail-able on its generic mechanism, but its
`fixtures/content/sources` carries no `construction-ai` item, so the check is not
exercised with the new source's actual titles. SEAM-C4/C5 keep the new source
private and unsynced, so the hub has no `construction-ai` content to leak; noted,
not counted as a defect.

## Removal would go undetected (distinct from fail-ability)

These guards fire when violated, but **nothing would fail if the guard were
deleted or weakened in place**:

| Guard | Why removal is silent |
|---|---|
| Roster validations `infra/variables.tf:228-266` | no test parses `variables.tf`; `terraform validate` does not evaluate `validation` rules |
| Inline satellite guard step `build.yml:529` | the hub's only wiring guard (`Check the live bucket IAM check is wired to a job that runs`, `build.yml:647`) asserts only `infra/scripts/check-private-bucket-iam.sh`; deleting the satellite step (or gutting its Python) leaves every test green |
| `check_private_bucket_config.py` step `build.yml:494` | same wiring guard does not name this script or this step |

The manifest validator (#9–11) and the leak checker (#13) are the two guards whose
**removal is caught**: their committed unit tests fail when the check logic is
removed.

## Restore proof

Every mutation reverted with `git checkout -- <file>` followed by
`git diff --exit-code -- <file>` (clean each time). Final whole-repo state:

```
/home/djjay/code/website            git diff --exit-code  -> clean
/home/djjay/code/construction-ai-proposal  git diff --exit-code  -> clean
```

Post-restore green baselines re-confirmed: `terraform validate` success;
`check_private_bucket_config.py` exit 0; inline satellite guard exit 0;
`contract` 57 passed; `site/scripts/check-no-private-in-public.test.ts` 24 passed;
`gate` 455 passed; satellite staged-dist validator: `schema`, `paths`, `source`
all passed.

Other untracked `handoffs/*wave-4*` files from parallel streams are not mine and
were not touched.

## Related docs

- `llm/sprints/2026-09-hub/contracts/skeptic-verifier-wave-4.md`
- `llm/sprints/2026-09-hub/contracts/phase-5-seams.md`
- `llm/sprints/2026-09-hub/handoffs/{infra-wave-4,satellite-construction-wave-4}.md`
- `llm/sprints/2026-09-hub/handoffs/skeptic-verifier-wave-3.md` (method)
