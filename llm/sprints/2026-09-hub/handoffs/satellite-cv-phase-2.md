# Handoff: Satellite Implementation Engineer (`cv`) — Phase 2

Status: Complete
Last updated: 2026-09-15
Author: Satellite Implementation Engineer (Specialist 4), sprint 2026-09-hub
Repository worked in: `cv`, worktree on branch `feat/publish-contract`
Issue: #16 — hub-002: Phase 2 — Publishing contract

## Summary

A push to `cv`'s `master` branch now publishes the CV through the hub's contract:
four variant PDFs and one `cv-data` payload, described by a `manifest.json` at the
root of `dist/`, uploaded to `gs://<content-bucket>/sources/cv/` by the hub's own
composite action over Workload Identity Federation. `cv` holds no GitHub credential
for the `website` repository and no service-account key.

**The "Notify website repo" step is deleted**, along with every reference to
`WEBSITE_DISPATCH_PAT` and `vars.WEBSITE_REPO`. Not disabled, not commented out —
deleted. `grep` over `.github/workflows/build-cv.yml` returns zero matches for all
three. ADR-0007 decision 2.

### Files delivered — all in the `cv` repository except this handoff

| File | Status | What it is |
|---|---|---|
| `tools/manifest.py` | new | Generates `dist/manifest.json`. 111 statements, 98% covered. |
| `tools/tests/test_manifest.py` | new | 24 tests, including one against `cv`'s real variant files. |
| `llm/features/hub-publishing.md` | new | D4. The docs note: what is published, the `schema_version` rule, and that no website credential is involved. |
| `.github/workflows/build-cv.yml` | modified | D3. `publish` job only. |
| `.gitignore` | modified | `dist/` and `release/` added. |
| `llm/memory_bank/{activeContext,progress,techContext}.md` | modified | Removed live instructions to create the forbidden PAT — see *Beyond the contract* below. |
| `memory-bank/{activeContext,systemPatterns}.md` | modified | Same, in `cv`'s second memory bank. |
| `llm/sprints/2026-09-hub/handoffs/satellite-cv-phase-2.md` | new | **This file — the only file written in the `website` repository.** |

Nothing under `/mnt/c/code/website` was modified except this handoff. `/mnt/c/code/cv`,
the owner's own checkout, was never touched. No `git` or `gh` mutation was run in
either repository.

## Required owner actions

### 1. Set four GitHub Actions variables in the `cv` repository

Settings → Secrets and variables → Actions → **Variables** (not secrets — none of
these is secret, and making them secrets only makes failures harder to read):

| Variable | What it is |
|---|---|
| `GCP_PROJECT_ID` | The hub's Google Cloud project id |
| `GCP_WIF_PROVIDER` | `cv`'s Workload Identity provider, in the hub's `satellites` pool |
| `GCP_PUBLISH_SA` | `cv`'s publishing service account |
| `GCP_CONTENT_BUCKET` | The hub's content bucket name |

Exactly these four. `dist: ./dist` and `source: cv` are literals written in the
workflow, not variables.

### 2. Remove the dispatch credential — two halves, both irreversible, both the owner's

The coordinator confirmed that `WEBSITE_DISPATCH_PAT` **exists** in `cv` (created
2026-08-17, the repository's only secret), and `WEBSITE_REPO = djjay0131/website`
exists as a variable. By `build-cv.yml`'s own former comment it is "a PAT with `repo`
scope on the website repo" — a long-lived credential giving a satellite write access
to the hub. That is the exact condition ADR-0007 and design-doc principle 3 forbid,
and it is live right now.

1. **Delete the repository secret `WEBSITE_DISPATCH_PAT` and the repository variable
   `WEBSITE_REPO` from `cv`.**
2. **Separately revoke the token itself at <https://github.com/settings/tokens>.**

The second half is the one people miss. Deleting the repository secret does **not**
revoke the token: it stays valid in the owner's account and can be pasted anywhere
else. Deleting the workflow step, which this work does, removes the *use* but not the
credential — until the token is revoked, any future workflow added to `cv` could still
use it to write to the hub.

I did not attempt either deletion. Both are `gh` mutations and irreversible owner
decisions.

## Validation — run verbatim

All commands run in the worktree, against a Python 3.12.11 venv built from
`pyproject.toml`.

### The manifest, generated from `cv`'s real data and validated by the hub's own validator

`dist/` was staged exactly as the workflow stages it, except that the four PDFs are
placeholder bytes — LaTeX is not available here, and no workflow may be triggered. The
manifest's content is entirely real: every slug, title, summary and date comes from
`cv`'s actual `data/variants/*.yaml` and git history.

```
$ .venv/bin/python -m tools.manifest --dist dist
wrote dist/manifest.json (5 items)

$ node /mnt/c/code/website/contract/validate-manifest.mjs --dist dist --source cv
Manifest check "schema" passed (dist/manifest.json).
Manifest check "paths" passed (dist/manifest.json).
Manifest check "source" passed (dist/manifest.json).
validator exit: 0
```

All three checks — schema, path containment, source match — pass against the hub's
`contract/validate-manifest.mjs`, unmodified.

#### `dist/manifest.json` in full

```json
{
  "source": "cv",
  "published": "2026-09-16T03:30:00Z",
  "items": [
    {
      "slug": "academic",
      "title": "Academic CV",
      "section": "cv",
      "format": "pdf",
      "path": "academic.pdf",
      "visibility": "public",
      "date": "2026-07-26",
      "summary": "Full curriculum vitae with publications, research, and complete employment history."
    },
    {
      "slug": "anthropic-fellow",
      "title": "Anthropic Fellow application",
      "section": "cv",
      "format": "pdf",
      "path": "anthropic-fellow.pdf",
      "visibility": "public",
      "date": "2026-07-26",
      "summary": "Researcher CV targeting the Anthropic Fellows Program: alignment, mech-interp, and secure-software depth."
    },
    {
      "slug": "research-professional",
      "title": "Research Professional",
      "section": "cv",
      "format": "pdf",
      "path": "research-professional.pdf",
      "visibility": "public",
      "date": "2026-07-26",
      "summary": "Research-focused resume for industry R&D and applied-research roles."
    },
    {
      "slug": "sde-long",
      "title": "Software Engineer",
      "section": "cv",
      "format": "pdf",
      "path": "sde-long.pdf",
      "visibility": "public",
      "date": "2026-07-26",
      "summary": "Detailed software-engineering resume emphasizing platform architecture and delivery."
    },
    {
      "slug": "cv-data",
      "title": "CV source data",
      "section": "cv",
      "format": "data",
      "path": "cv-data/",
      "visibility": "public",
      "date": "2026-07-26",
      "summary": "Content pool, variant selectors, bibliography and photo: the data the hub renders the CV pages from.",
      "schema_version": "1"
    }
  ]
}
```

#### Where each field comes from

- `source` — the literal `"cv"`, a module constant. Equals the `source` input.
- `published` — the build's UTC instant, seconds precision, `Z` suffix.
- `slug` — the variant's own filename stem. All four already satisfy
  `^[a-z0-9]+(?:-[a-z0-9]+)*$`; a stem that does not fails the build rather than
  being silently rewritten.
- `title` — the variant's `label`. A variant with no `label` fails the build; the
  tool does not invent a title.
- `summary` — the variant's `description`, omitted when absent.
- `date` — **the committer date of `HEAD`** (`git log -1 --format=%cs`), falling back
  to the `published` date if git cannot answer. See *Assumptions* for why.
- `schema_version` — `"1"`, on the `cv-data` item only. The schema's `if/then/else`
  confirms no other item carries one.

### `cv`'s own suite, as `build-cv.yml` runs it

```
$ .venv/bin/ruff check .
All checks passed!

$ .venv/bin/python -m tools.lint_bib own-bib.bib
(exit 0, no output = clean)

$ .venv/bin/pytest
...
TOTAL                             1608      2    99%
============================= 183 passed in 2.20s ==============================
```

183 passed, up from 159 before this work — 24 new tests, none removed, coverage 99%.

**This required pinning `bibtexparser<2`. See the blocking defect below.**

### The workflow parses, and `actionlint`

```
$ python -c "yaml.safe_load(open('.github/workflows/build-cv.yml'))"
parsed OK; jobs: ['tests', 'configure', 'build', 'publish']
publish permissions: {'contents': 'write', 'id-token': 'write'}
publish if: github.ref == 'refs/heads/master' && github.event_name != 'pull_request'
publish steps: ['actions/checkout@v4', 'Download all variant artifacts',
 'Stage the variant PDFs', 'Stage the cv-data payload',
 'Pack cv-data.zip for the GitHub release', 'Generate the hub publishing manifest',
 'Upload combined workflow artifact', 'Update "latest" release',
 'Publish to the research hub']

$ docker run --rm -v "$PWD:/repo" -w /repo rhysd/actionlint:latest -color
.github/workflows/build-cv.yml:8:22: "branches-ignore" section should not be empty [syntax-check]
.github/workflows/build-cv.yml:54:9: shellcheck reported issue in this script: SC2011:warning:1:8: Use 'find .. -print0 | xargs -0 ..' or 'find .. -exec .. +' to allow non-alphanumeric filenames [shellcheck]
.github/workflows/build-cv.yml:94:9: shellcheck reported issue in this script: SC2231:info:12:25: Quote expansions in this for loop glob to prevent wordsplitting, e.g. "$dir"/*.txt [shellcheck]
actionlint exit: 1
```

**`actionlint` is not clean, and all three findings pre-date this work.** The `publish`
job — the only job touched — begins at line 139. All three findings are at lines 8, 54
and 94, in the `on:` block, the `configure` job and the `build` job's
visual-regression loop respectively. Not one is in code added here, and the file
carried all three before this branch. SEAM-7 asks `satellite-cv` for an `actionlint`-clean
workflow; it is clean for everything in scope and not clean for three pre-existing
lines I was not contracted to touch. Fixing them is a small, separate change —
recommended below, deliberately not bundled.

## BLOCKING DEFECT IN `cv`, PRE-EXISTING AND UNRELATED TO THIS WORK

**`cv`'s CI is red right now, and nothing in Phase 2 can run end to end until it is
fixed.**

`pyproject.toml` declares `bibtexparser>=1.4.1` with **no upper bound**. `bibtexparser`
2.x has since shipped and removes the v1 API. A fresh `pip install -e ".[dev]"` — which
is exactly what the `tests` job does on every run — now installs 2.0.1, and:

```
$ python -m tools.lint_bib own-bib.bib
AttributeError: module 'bibtexparser' has no attribute 'bparser'
$ pytest
======================== 36 failed, 147 passed in 2.64s ========================
```

All 36 failures are in `test_lint_bib.py`. `tools/lint_bib.py` uses
`bibtexparser.bparser.BibTexParser`, a v1 API.

This matters for Phase 2 specifically: `configure` needs `tests`, `build` needs
`configure`, and `publish` needs `build`. With `tests` failing, **the publish job never
runs**, so Checkpoint 3 cannot verify the satellite path for a reason that has nothing
to do with the satellite path.

With `bibtexparser==1.4.4` installed, everything above is green: 183 passed, ruff
clean, bib lint clean. So this work is proven not to have broken anything — the
breakage is the dependency range.

**I did not fix it.** It is outside my deliverables, and the remedy is a judgment call
the owner should make rather than something buried in a publishing PR:

- **Recommended, one line:** `"bibtexparser>=1.4.1,<2"` in `pyproject.toml`, plus
  the same pin on the `build` job's bare `pip install ... bibtexparser`. Restores the
  intended behaviour, costs nothing, defers the migration.
- **Or:** migrate `tools/lint_bib.py` to the v2 API. Larger, and it rewrites a
  100%-covered module for no functional gain today.

Either way it should land **before or with** this branch, or the merge will look like
this change turned CI red.

## Assumptions

1. **`date` is the committer date of the published commit**, not the build date. All
   five items ship from one commit, so one date is correct for all of them; using the
   commit date means re-running a build on an unchanged commit does not move the date,
   which the build date would. `cv` has no per-item date anywhere in its data — no
   front-matter, no `meta.yaml` field — so this is the only date in the repository that
   means anything. `git log -1 --format=%cs` is used, which needs no `fetch-depth: 0`
   (`actions/checkout`'s default depth of 1 is enough). If git cannot answer, the tool
   falls back to the `published` date; both paths are tested.
2. **`cv-data`'s `title` and `summary` are module constants**, not derived from data.
   There is nothing in `cv` to derive them from. They are the only two strings in the
   manifest this work authored, and they are declared at the top of `tools/manifest.py`
   where the hub can see them.
3. **The `cv-data` payload keeps the `data/` directory prefix.** Today's
   `cv-data.zip` is built as `zip -r ... data own-bib.bib photo_jason_1.jpeg`, so its
   entries are `data/content/*.yaml`, `data/variants/*.yaml`, `own-bib.bib`,
   `photo_jason_1.jpeg`. `dist/cv-data/` reproduces that tree exactly, because
   `site/src/lib/cv-data.ts` reads those paths.
4. **The hub action is referenced at `@main`, not by SHA.** `docs/satellites.md` and
   `contract/README.md` both document `@main`, and it is a first-party hub action, not
   a third party. The two third-party actions it wraps are SHA-pinned inside the hub.
   No new third-party action was added to `build-cv.yml` at all — see *Alternatives*.
5. `zip` behaviour is unchanged: `cv-data.zip` is now packed from `dist/cv-data/` with
   the same three explicit entry names, from a directory whose contents are identical.
   `zip` is not installed in this environment, so this is reasoned, not executed. The
   workflow prints `unzip -l` on the result, so a first CI run will show it plainly.

## What changed in `build-cv.yml`, and what deliberately did not

Unchanged: the `tests`, `configure` and `build` jobs in their entirety — the pytest
suite, ruff, the bib lint, the four-variant matrix, the `xu-cheng/latex-action` compile,
the visual-regression diff and its baselines, and the per-variant artifacts. The
`latest` GitHub release still publishes the same asset names, still `make_latest`,
still not a prerelease.

Changed, all inside `publish`:

- Job-level `permissions: contents: write` (the release, as before) and
  `id-token: write` (the OIDC token). The top-level `permissions` block is untouched.
- `dist/` now holds only what the manifest describes: four PDFs, `cv-data/`,
  `manifest.json`. **`cv-data.zip` moved to `release/cv-data.zip`** so that an
  undescribed 150 KB object is not uploaded to the bucket on every publish. The release
  asset's *name* is unchanged, because the asset name comes from the basename — only
  the staging path moved. It is packed from `dist/cv-data/`, so the release zip and
  what the hub reads provably cannot drift.
- The combined `cv-<sha>` convenience artifact now also carries `manifest.json`. Its
  internal layout changes as a side effect: because its paths now span `dist/` and
  `release/`, the files land under those two directories inside the artifact instead of
  flat. Nothing in either repository consumes that artifact — `fetch-data.sh` uses the
  *release* — so this is noted rather than guarded, but it is a real change and a
  reviewer should see it named.
- Publishing remains gated by `github.ref == 'refs/heads/master' && github.event_name
  != 'pull_request'`. With the WIF provider admitting only `refs/heads/master` on
  `cv`'s immutable repository id and refusing `pull_request_target`, a fork PR is
  stopped twice.
- No step tries to verify the upload by listing the bucket. `cv`'s identity holds no
  `storage.objects.list` and cannot enumerate even its own prefix; that is correct, and
  the publish action cannot confirm its own upload (ADR candidate C21).

## Beyond the contract — flagged for reversal if unwanted

`cv`'s memory banks carried **live instructions to create the forbidden credential**.
`llm/memory_bank/activeContext.md` listed "Optionally configure the PAT for cv →
website repository_dispatch" as *Immediate Next Step 1*, and `progress.md` listed
"PAT needed" under *Remaining To Build*. Deleting the workflow step while leaving a
future agent a standing instruction to re-create the PAT would have defeated the
change, so I corrected the five lines that instruct or describe enabling it, in both
memory banks, pointing at `llm/features/hub-publishing.md` instead.

I left `llm/features/cv-website.md` alone. Its ten `repository_dispatch` mentions are a
dated, VERIFIED historical feature spec describing what was designed in April; rewriting
history is not mine to do. It is stale, and a reader could mistake it for current.

**Finding: `cv` has two memory banks**, `memory-bank/` and `llm/memory_bank/`, with
overlapping and already-divergent content. I updated both rather than pick a winner.
Consolidating them is `cv`'s own governance work, not Phase 2's.

## Was `docs/satellites.md` sufficient to integrate against?

**Yes — with one real defect, now corrected mid-flight, and two gaps.**

I could have produced a working `dist/`, a valid manifest and a correct publish step
from `docs/satellites.md` alone. Its structure is right for the job: what you never
need, then the folder shape, then the manifest, then the step, then the failure table.
The failure table is the best thing on the page — "`manifest.json not found` → it must
sit at the root of `dist/`, not beside it" and the two distinct `403` rows are exactly
the errors a first integrator hits. The "What you never need" section did real work:
it told me to delete the dispatch step rather than wonder whether to wire it up.

**The defect (found and reported, corrected by the Lead during this work).** The page
said *"Set the five values as GitHub Actions variables"* while listing six inputs, of
which `dist` and `source` are literals. Five is wrong in both directions — it is
neither the number of inputs nor the number of variables. Following it literally, a
satellite owner would create a fifth variable and not know which. The corrected
wording — four, named in a table, with `dist` and `source` called out as literals — is
right. This is the defect the "first real reader" check existed to catch.

**Still stale, hub-side, and reported not fixed:** `contract/README.md:182` still reads
*"Set all five values as GitHub Actions variables"*. Only `docs/satellites.md` was
corrected. `contract/README.md` is the `contract` stream's file and `docs/satellites.md`
is the Lead's (SEAM-6), so the same error now lives in two files with two owners and
one of them is fixed. **This should be corrected before Phase 2 merges**, or the next
satellite owner reads the reference page and gets the original wrong answer.

**Gap 1 — nothing tells you to generate the manifest rather than write one.** The page
shows a hand-written JSON example and never says that a satellite whose item list is
discovered dynamically should generate it. My contract told me; the page does not. One
sentence under "The manifest" would carry it: *if your item list is derived from your
build, generate this file — do not commit one.*

**Gap 2 — the `data` format's `schema_version` has no bump rule.** The page says
"bump it" and "an unknown `schema_version` fails the hub build", but never says what
counts as a change requiring a bump. I had to decide that myself (see open question b),
and my answer now lives in `cv` where the hub cannot see it. That rule is a contract
between two repositories and belongs on the hub's page.

**Not a gap, worth stating:** I did not need to read `contract/publish/action.yml`,
`validate-manifest.mjs` or `manifest.schema.json` to integrate. I read them because my
contract required it. The page stands on its own.

## Recommendations

1. **Fix the `bibtexparser` range before or with this branch.** Blocking; see above.
2. **Correct `contract/README.md:182`** from "five" to four, matching
   `docs/satellites.md`. Hub-side, `contract` stream's file.
3. **Add the `schema_version` bump rule to `docs/satellites.md`**, so it is stated
   once, on the hub, rather than separately in each satellite.
4. **Add a "generate, do not hand-write, your manifest" sentence** to
   `docs/satellites.md`.
5. **Clean up the three pre-existing `actionlint` findings in `cv`** as a separate
   change: drop the empty `branches-ignore: []` (removing the key is behaviour-identical),
   and quiet SC2011 and SC2231 in `configure` and `build`.
6. **Consider SHA-pinning `cv`'s existing actions.** `actions/checkout@v4`,
   `actions/setup-python@v5`, `xu-cheng/latex-action@v3`, `actions/upload-artifact@v4`,
   `actions/download-artifact@v4` and `softprops/action-gh-release@v2` are pinned by
   tag, and a tag can be moved. My contract put this out of scope and told me to note
   it; I have changed none of them. `softprops/action-gh-release@v2` is the one I would
   pin first — it holds `contents: write` in the same job that now holds `id-token: write`.
7. **Consolidate `cv`'s two memory banks.**

## Alternatives considered

**`actions/setup-python` in the `publish` job, versus a venv.** The manifest tool needs
`pyyaml` and `pydantic`. The obvious move is `actions/setup-python@v5`, which the file
already uses twice. But my contract requires every third-party action I *add* to be
SHA-pinned, and `gh` is not installed here and I hold no credential to look up a tag's
commit — so I could not have pinned it honestly, and copying the existing `@v5` tag
would have violated the instruction. A `python3 -m venv` on the runner's own Python
needs no action at all, sidesteps PEP 668, and mirrors the `Makefile`'s existing `venv`
target. **No third-party action was added to this workflow.**

**Leaving `cv-data.zip` inside `dist/`.** Simplest, and it would have left the release
and artifact steps byte-identical. Rejected: the publish action uploads all of `dist/`,
so every publish would put a 150 KB zip in the bucket that no manifest item describes
and nothing reads. `contract/README.md` is explicit that `dist/` is published exactly
as built. A second staging directory is the smaller cost.

**Staging the hub payload in a separate `hub-dist/` and leaving `dist/` untouched.**
Even less invasive to the release path. Rejected because the contract's D3 says the
publish job stages `dist/`, SEAM-2 maps `dist/` onto the bucket prefix, and the paths
in the manifest are defined relative to `dist/`. Introducing a second name for the same
concept to avoid moving one zip is not worth the confusion.

**Hand-maintaining `manifest.json` in the repository.** Rejected by the contract, and
correctly: the variant list is discovered dynamically by the `configure` job, so a
static file would drift the first time a variant is added. The generator reads the same
`data/variants/*.yaml` glob the matrix does, so the manifest and the PDFs that were
built cannot disagree.

**Deriving `date` from file mtimes.** Rejected: `actions/checkout` sets every file's
mtime to checkout time, so it would have silently been the build date wearing a
disguise.

**Publishing to the hub before the GitHub release.** Rejected. The release is the
older, load-bearing path with consumers outside the hub; the hub publish is new and can
fail on four unset variables. Releasing first means a hub failure does not cost the
release. The cost is that a failed publish leaves the release ahead of the bucket for
one cycle, which the next push corrects.

## Risks

1. **`bibtexparser` (blocking, pre-existing).** Above. Highest-priority item here.
2. **The four variables do not exist yet.** Until the `infra` stream applies and the
   owner sets them, the publish step fails at the WIF exchange with empty inputs.
   Everything before it still succeeds, so the release keeps working and the failure is
   confined to the last step — but every `master` push will show a red job until the
   variables are set. If that is unacceptable between merge and Checkpoint 3, gate the
   step on `vars.GCP_CONTENT_BUCKET != ''`; I did not, because a silently skipped
   publish is a worse failure mode than a loud one.
3. **`cv-data.zip` is now packed from a different working directory.** Reasoned to be
   byte-equivalent, not executed — `zip` is not installed here. The workflow prints
   `unzip -l` so the first CI run shows the entry list. If the hub's `cv-data.ts` ever
   broke on it, the entry names are where to look first.
4. **The `cv-<sha>` artifact's internal layout changes.** Nothing consumes it. Named
   here so it is not discovered as a surprise.
5. **`schema_version` discipline.** The hub fails on a version it does not know, but
   nothing can force `cv` to bump on a shape change — the failure mode of forgetting is
   a subtly wrong CV page, not an error. The rule is written down in
   `llm/features/hub-publishing.md`; it is still a discipline, not an enforcement.
6. **The publish cannot verify itself.** No `list`, by design. A successful step means
   the uploads returned success, not that the prefix contains what you expect. The hub's
   next poll is the real confirmation (ADR candidate C21).
7. **`@main` on the hub action.** `cv` picks up hub contract changes the moment they
   merge, with no review on `cv`'s side. That is the hub's intent and the documented
   usage, and it is what lets the hub fix a validator bug for every satellite at once.
   It also means a bad hub commit breaks every satellite's publish simultaneously. If
   that trade is ever unwanted, the hub should start tagging the action and document a
   tag in `docs/satellites.md` — satellites should not each invent a pin.

## Open questions — answered

### (a) Should `cv` keep producing `cv-data.zip` once the hub no longer consumes it?

**Yes, keep it for now. Retire it deliberately, later, and not in Phase 2.**

Consumers I can find:

- **The hub** — `site/scripts/fetch-data.sh`, which the `site` stream deletes this
  phase (SEAM-4, ADR-0008). This one goes away.
- **The hub's local-dev path** — `scripts/sync-local-data.sh` symlinks from a local
  `cv` checkout rather than downloading, per `cv`'s `memory-bank/techContext.md`. It
  does not use the zip.
- **The owner, manually.** `cv`'s memory bank documents `gh release download` as the
  routine way to get artifacts out of CI, because the `refined-serif` variants cannot
  compile on the owner's machine (the Cochineal font fails locally). The `latest`
  release is a working habit, not just a machine interface.
- **Anything outside these two repositories** — unknowable from here. `latest` is a
  public release on a public repository with a stable URL and has existed since M2.

So after this phase the zip has no *automated* consumer I can name, but it has a human
one, and an unknown number of external ones. The cost of keeping it is one `zip` call
and ~150 KB per build; it is now packed from the same staged directory as the hub
payload, so it cannot drift. The cost of removing it is a silently broken bookmark for
anyone who has one.

Retire it when the bucket path has been observed working end to end for a few weeks —
Phase 3 or later — and preferably by publishing a release that *says* it is the last
one, rather than by one that quietly stops appearing. That is an ADR, not a Phase 2
line item.

### (b) What should `schema_version` be, and what rule should `cv` follow for bumping it?

**`"1"` now. Bump the integer when the payload's *shape* changes; never for content.**

The rule, as written into `tools/manifest.py` and `llm/features/hub-publishing.md`:

> **Bump** on a renamed, removed or re-typed YAML key; a moved or renamed file; a
> changed directory layout; a new field the hub must read.
> **Do not bump** for CV content — new employment bullets, a new publication, a
> reworded summary — or for adding a variant file, since the hub discovers variants
> from the payload rather than from the version.

Two further rules I recommend the hub adopt, because they belong to the contract rather
than to `cv`:

1. **Integers only, one at a time.** The schema permits `1.2.3`, and the hub compares
   against a claimed set. A minor component invites "surely a *minor* bump is
   compatible" reasoning that the hub's exact-match check does not implement. `"1"`,
   then `"2"`. If the hub ever wants compatible-change semantics, that deserves its own
   decision, not an accidental one.
2. **The bump and the hub's renderer change land together, hub first.** A bump
   published before `site/src/lib/cv-data.ts` understands it fails the hub build — which
   is the designed behaviour and is the *safe* direction, but it means the hub is down
   for CV content until the hub side merges. So: teach the hub the new version first,
   then publish from `cv`. Worth a sentence in `docs/satellites.md`, because every
   `data` satellite will meet it.

The asymmetry worth naming: forgetting to bump is silent and wrong; bumping early is
loud and safe. The rule should bias toward bumping.

## ADR candidates

1. **The `schema_version` bump rule** (contract's own candidate). What constitutes a
   shape change, integers-only, and the hub-first ordering in (b). It is a rule binding
   two repositories, currently written down only in `cv`.
2. **Retiring `cv`'s `latest` GitHub release in favour of the bucket** (contract's own
   candidate). See (a). Needs the "announce the last release" step, and should not be
   decided until the bucket path has real running time.
3. **Version pinning for the hub's publish action.** `@main` versus a tag, and whether
   satellites pin or the hub tags. Currently implicit in `docs/satellites.md`; it is a
   blast-radius decision across every satellite, and Phase 3's private satellite raises
   the stakes.
4. **A dependency-pinning policy for `cv`.** The `bibtexparser` breakage is the second
   unbounded-range failure this repository has had; `pyproject.toml` has no upper bound
   anywhere and the `build` job installs four packages entirely unpinned. Small, but
   it just cost Phase 2 a red pipeline.

## Related docs

- `llm/sprints/2026-09-hub/contracts/satellite-cv-phase-2.md` — this contract
- `llm/sprints/2026-09-hub/contracts/phase-2-seams.md` — SEAM-1, 2, 3, 5, 6, 7
- `llm/governance/adr/0007-hub-polls-content-bucket-no-satellite-github-credential.md`
  — decision 2, the deleted dispatch step
- `llm/governance/adr/0008-manifest-data-format-hub-renders-cv.md` — decisions 2 and 5
- `docs/satellites.md` — the how-to this work is the first real reader of
- `contract/README.md`, `contract/manifest.schema.json`,
  `contract/publish/action.yml`, `contract/validate-manifest.mjs`
- In `cv`: `llm/features/hub-publishing.md`, `tools/manifest.py`,
  `tools/tests/test_manifest.py`, `.github/workflows/build-cv.yml`
