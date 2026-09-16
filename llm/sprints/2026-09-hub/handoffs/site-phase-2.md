# Handoff: Site Implementation Engineer — Phase 2

Status: Complete
Last updated: 2026-09-16
Owner: Site Implementation Engineer (Specialist 3)
Contract: `llm/sprints/2026-09-hub/contracts/site-phase-2.md`
Seams: `llm/sprints/2026-09-hub/contracts/phase-2-seams.md` — SEAM-1, SEAM-4, SEAM-5, SEAM-6, SEAM-7

---

## Summary

The hub now builds from content synced out of the content bucket, notices a publish
by polling rather than by being told, and serves every CV URL exactly as it did
before. **The rendered CV is byte-identical**: a build before the change and a build
after it, from the same payload, produce the same SHA-256 for every HTML file,
including `/cv/academic` and `/resumes/`.

What changed, in one line each:

| Deliverable | File | What it does |
|---|---|---|
| D1 | `site/src/content.config.ts` | Zod mirror of `contract/manifest.schema.json`, field for field, plus the two rules JSON Schema cannot carry |
| D2 | `site/scripts/sync-content.sh` | `gs://<bucket>/sources/**` → `site/src/content/sources/`, and the poll's fingerprint |
| D3 | `site/src/lib/hub-content.mjs` | `CLAIMED_DATA_ITEMS` — the one declaration of what the hub renders, and where the payload lives |
| D4 | seven pages, `site/scripts/stage-public-assets.mjs` | repointed at the synced payload; PDFs staged so `/pdfs/<variant>.pdf` is unmoved |
| D5 | `.github/workflows/build.yml` | polls the bucket, WIF, `content_fingerprint`, no `repository_dispatch` |
| D6 | `site/scripts/sync-local-data.sh` | a cv checkout, through the same contract path, with no credential |
| D7 | `site/src/content.config.test.ts`, `site/scripts/sync-content.test.ts` | 48 new tests over the contract stream's own fixtures |
| D8 | this file | |

### The one design idea

There is exactly **one shape of content** and **one validation path**. Four different
producers can fill `site/src/content/sources/`, and all four produce the same
bucket-shaped tree with the same manifest:

```
                                          ┌─ sync-content.sh --bucket   (the contract path)
gs://<bucket>/sources/<source>/ ──────────┤
                                          │
cv GitHub release ── fetch-data.sh ───────┤   all four write the same tree
local cv checkout ── sync-local-data.sh ──┤   and the same manifest.json
committed fixture ── sync-content.sh --from┘
                                          │
                                          ▼
                            site/src/content/sources/<source>/…
                                          │
                       src/content.config.ts validates ─── build FAILS on a bad manifest
                                          │
                       stage-public-assets.mjs ─── public/pdfs/<slug>.pdf
                                          │
                                    astro build
```

So the manifest validation, the claim check and the staging run identically however
the payload arrived. Only the transport differs. That is what makes the fallback in
§Risks safe rather than a second code path that can rot.

### D1 — the mirror, and the half the schema cannot carry

`site/src/content.config.ts` mirrors `contract/manifest.schema.json` with no field
added, renamed, widened or narrowed. The patterns are held as **strings** copied
verbatim from the schema, and a test asserts each one is still character-for-character
identical to the schema's own `pattern`, along with both fixed-set lists, every
`minLength`/`maxLength`/`maxItems`, both `required` lists, and
`additionalProperties: false` at both levels. **If the contract stream changes the
schema, this build fails rather than drifting.**

SEAM-1's amendment is implemented deliberately, not assumed:

- `manifestSchema` (the pure mirror) **accepts** `contract/examples/invalid/duplicate-slug.json`,
  exactly as ajv does, and there is a test that asserts it does — so nobody discovers
  it by accident.
- `findDuplicateSlugs()` is the named code beside the schema that enforces the rule,
  and `validateManifest()` calls it. Duplicate slugs fail the build.

`visibility: private` is **accepted**, because the §4 shared fixture is a
`private`/`phd` item. Accepting is not publishing: no private handling was added —
no two-output build, no leak check, no `HUB_OUTPUT`, no private bucket. That is
Phase 3.

`schema_version` is a **string** matching `^[0-9]+(?:\.[0-9]+){0,2}$`, required on a
`format: data` item and forbidden on every other format.

### D3 — claiming

`CLAIMED_DATA_ITEMS` in `site/src/lib/hub-content.mjs` is one table with one row:
`("cv", "cv-data")`, schema versions `["1"]`. Any other `data` item fails the build;
so does a `schema_version` outside that list. Both failures name the offending item,
what the hub does claim, and what to do about it.

### D4 — where the PDFs land, and why

`/pdfs/<variant>.pdf` is the path Phase 1 serves (SEAM-5), and Phase 1 served it out
of `site/public/pdfs/`, where `fetch-data.sh` put it. Phase 2 changes where the bytes
come from, **not where they are served**: `stage-public-assets.mjs` copies each
published `format: pdf` item of source `cv` to `public/pdfs/<slug>.pdf`, and the
photo to `public/photo_jason_1.jpeg`, after every sync.

Two reasons for this over the alternatives:

1. **No URL moves and no redirect is needed.** The roadmap's URL-preservation
   criterion is met by construction (ADR-0008 decision 4), not by a redirect map.
2. **Withdrawal works.** The staging step is driven by the manifest, never by
   globbing the tree, and it rebuilds `public/pdfs/` from scratch each run. An item
   dropped from `items` stops being served even though its bytes remain in the bucket
   — which is the only behaviour consistent with "the manifest is the authority", and
   it matters because a satellite cannot list and therefore cannot prune (STATE C23).

`cv-data.ts` was not restructured and its resolver logic was not touched. It takes
directories as arguments; only the arguments changed. The seven pages each changed by
one import and one path constant.

### D5 — the poll

- The `check` job fingerprints the **bucket**. The `cv` GitHub-release fingerprint
  survives only as the fallback source's fingerprint (see §Risks).
- **Deletions are covered, and this is the point of the design.** The fingerprint is
  a SHA-256 over the sorted listing of *every* object under `sources/` — one line per
  object, `<name> <generation> <size>`. Deleting an object removes its line, so the
  hash changes just as surely as adding or replacing one. A fingerprint built from
  "the newest object" or "the latest `published` timestamp" would not change on a
  withdrawal, and ADR-0007's Risks section names that exact failure. There are five
  tests on this, including one that deletes an object and asserts the fingerprint
  changed.
- WIF via `google-github-actions/auth` pinned at `7c6bc770dae815cd3e89ee6cdf493a5fab2cc093`
  (v3.0.0), `id-token: write` on the jobs that read the bucket. Scheduled runs carry
  `refs/heads/main`, so the existing binding admits them and no new binding is needed
  (ADR-0007 decision 7).
- `build-info.json` gains `content_fingerprint` and `content_source`, and keeps
  `cv_fingerprint`, `built_from_sha` and `run_id` — the Phase 1 comparison shape.
- `repository_dispatch: [cv-updated]` is **removed**.
- `workflow_dispatch` is kept, and a manual run still builds unconditionally: only
  `schedule` is eligible to skip. That is the owner's "publish this now" escape
  hatch, and it needs no satellite credential.
- Everything else Phase 1 established is kept: both host builds, the Pages deploy,
  `budget-guard`, `deploy-tools`, both smoke tests, both notification jobs,
  least-privilege per-job permissions, every action pinned by SHA.

### Only two cloud operations, both on objects

The hub's grant is `roles/storage.objectViewer` on the bucket, unconditioned, which
carries `storage.objects.list` and `storage.objects.get` and **not**
`storage.buckets.get`. `sync-content.sh` therefore uses exactly two calls:

```
objects.list   GET /storage/v1/b/<bucket>/o?prefix=sources%2F
objects.get    GET /storage/v1/b/<bucket>/o/<object>?alt=media
```

It never calls `GET /storage/v1/b/<bucket>`, never asks whether the bucket exists,
and never stats it before reading. A helper that did would pass every local test and
403 against the real bucket. It uses `curl` and `node` only — no `gcloud`, no
`gsutil`, no `jq` — so it runs anywhere the site builds, and so nothing can smuggle
in a bucket-metadata call on our behalf.

The "never list" rule of ADR-0007 is a **satellite** constraint, not a hub one: the
hub owns the bucket and must list it. Nothing here weakens that rule on the publish
side.

---

## Route-by-route: which URLs Phase 1 served, and whether each still resolves

Method: a full build **before** any change, then a full build **after**, from the
identical payload, comparing SHA-256 of every file. 155 files before, 159 after.

**Every route Phase 1 served still resolves, and every HTML file is byte-identical.**
The only difference in the whole tree is four **added** files.

| Route (Phase 1) | Still resolves | Evidence |
|---|---|---|
| `/` | yes | `index.html` SHA-256 identical |
| `/cv/` | yes | identical |
| `/cv/academic` | yes | **identical** — the contract's named check |
| `/cv/research-professional` | yes | identical |
| `/cv/anthropic-fellow` | yes | identical |
| `/cv/sde-long` | yes | identical |
| `/resumes/` | yes | **identical** — the contract's named check |
| `/papers/` | yes | identical |
| `/projects/` | yes | identical |
| `/projects/<slug>` × 12 | yes | all identical (agentic-kg, construction-ai, insurance-schema-framework, llm-coding-assistant, llm-data-importer, mrs-cloud-architecture, nfl-ml, remote-robotics-control, security-classifier, sentiment-yelp, vttsi, vvuq-beam-solver) |
| `/research/`, `/research/soa-agentic-se/**` (9 pages) | yes | all identical |
| `/research/agentic-harnesses*` (4 legacy redirect pages) | yes | all identical |
| `/writing/` | yes | identical |
| `/phd/` | yes | identical (still `noindex`, still out of the sitemap) |
| `/email/`, `/privacy/` | yes | identical |
| `/robots.txt`, `/sitemap-index.xml`, `/sitemap-0.xml` | yes | identical |
| `/favicon.ico`, `/favicon.svg` | yes | identical |
| `/_astro/**` (1 CSS + 118 font files) | yes | all identical |
| `/pdfs/<variant>.pdf` × 4 | yes | **added** by the build that has the payload staged |
| `/photo_jason_1.jpeg` | yes | staged from the payload when the source publishes one |
| `/build-info.json` | yes | written by CI, now with `content_fingerprint` |

The four added `pdfs/*.pdf` files are not a change in behaviour. Phase 1's CI also
placed them there (`fetch-data.sh` wrote `public/pdfs/`); they were absent from the
*local* baseline only because no PDFs had been fetched on this machine. `npm run
check:smoke-routes` went from **1 of 7 missing** to **7 of 7 present** as a result.

`npm run redirects:check` was not re-run and the committed redirect map is unchanged,
correctly: no route was added, removed or moved, and the map's own test covers every
static page, public file, redirect source and smoke route.

---

## Validation

Run from `site/` unless stated. Results verbatim in the final report; summary here:

| Check | Result |
|---|---|
| `npm test` | **9 files, 102 passed, 1 skipped** (was 7 files, 54 passed, 1 skipped) |
| `npm run build` | exit 0, 35 pages |
| `npm run check:smoke-routes` | `all 7 smoke routes present in dist-public` |
| `actionlint` (container) | clean, exit 0, whole `.github/workflows/` tree |
| YAML parse of `build.yml` | parses; 11 jobs; triggers `push, pull_request, schedule, workflow_dispatch` — no `repository_dispatch` |
| `bash -n` on all three shell scripts | clean |
| CV HTML before/after | **byte-identical**, every page |
| `npx astro check` | 11 errors, **all pre-existing**, all in `src/components/SourceExplorer.astro`, a file this work does not touch |

`actionlint` is not installed natively on this machine; it was run through
`docker run --rm -v "$PWD:/repo" -w /repo rhysd/actionlint:latest -color`. Docker was
available.

**A manifest the JSON Schema rejects fails the build — demonstrated, not asserted.**
Four real `astro build` runs against a corrupted manifest, each exiting **1**:

1. `section` outside the fixed set → `items.0.section: Invalid option: expected one of "research"|"projects"|"writing"|"cv"|"phd"`
2. an unclaimed `data` item → `the hub does not claim the data item ("cv", "rogue-payload"), so it has no renderer`
3. an unknown `schema_version` → `schema_version "2" is not one this hub understands for ("cv", "cv-data"). Known: "1"`
4. a duplicate slug — which the schema *accepts* → `duplicate slug "academic" — items 0, 5 all use it`

This mattered: Astro **logs and skips** a content-config error at module scope
(`content-layer.js`: `case "error": … Skipping sync. return;`) but **propagates** a
rejection from `loader.load()`. Validating at module scope would have produced a
green build with no content. All validation is therefore inside `load()`.

### The sync was not exercised against a real bucket

There are no cloud credentials, none may be created, and the bucket does not exist
until Checkpoint 3. The bucket transport was tested against **local trees shaped
exactly like the bucket** — the committed `site/fixtures/content/`, and a tree built
from the real CV payload. What that does *not* prove is listed under §Risks.

`sync-local-data.sh` **was** executed end to end against the real `../../cv` checkout
(read-only; `git status` in that repository is clean afterwards).

---

## Assumptions

- **A1** — The synced tree is `site/src/content/sources/` per design doc §9, and was
  already gitignored. `manifest.json` sits at the root of `dist/`, so it lands at
  `sources/<source>/manifest.json`.
- **A2** — A source directory is keyed by the bucket prefix, and the manifest's
  `source` must equal it. A mismatch fails the build: the prefix *is* the source name
  (SEAM-2).
- **A3** — An absent `src/content/sources/` is not an error (an unconfigured
  repository, or a fresh checkout). A tree that is present and wrong **is** an error.
- **A4** — The `cv-data` payload shape is exactly SEAM-5's: `data/content/*.yaml`,
  `data/variants/*.yaml`, `own-bib.bib`, `photo_jason_1.jpeg`. The hub reads them at
  the same relative paths it used under `site/data/`.
- **A5** — `site/data/` is left on disk (it is gitignored and untracked) rather than
  deleted. It is no longer read by anything. Deleting a developer's local files is
  not this contract's business.
- **A6** — The roadmap scope line *"Section pages render from collections"* is **not**
  in deliverables D1–D8 and was **not** implemented. Doing it would change rendered
  output, which D4 forbids. See §Seam and roadmap defects.

---

## Recommendations

1. **Give the hub a bucket read grant it can use from a pull-request ref**, then
   delete `fetch-data.sh` in Phase 3. This is the change that closes the gap
   described in §Risks R1. It is `infra/`'s file, not this stream's. Either bind
   `roles/storage.objectViewer` on the content bucket to the repository's pool-level
   `principalSet` (any ref of `djjay0131/website`), or add a second, read-only
   service account impersonable from any ref of this repository. The write path is
   unaffected either way, and no satellite gains anything.
2. **Keep the poll hourly.** See Open question (a).
3. **Record the expected source set** so a source whose prefix vanishes entirely is
   detected. See Open question (b).
4. **Re-verify `upload-cloud-storage` makes no listing call on any version bump** —
   already `contract/README.md`'s rule, repeated here because the hub's own
   `objects.list` usage may make it tempting to relax it. It must not be relaxed: the
   permission is deniable on the hub side and undeniable on the satellite side.
5. **At Checkpoint 3, watch the first bucket-mode run specifically for a 403
   mentioning `storage.buckets.get`.** If one appears, the fix is in `infra/`, not
   here — see R2.

---

## Alternatives considered

- **Validate the manifest at content-config module scope.** Rejected on evidence:
  Astro logs the error and skips the sync, producing a green build with no content.
  Validation lives in `loader.load()`, where a rejection fails the build.
- **Generate the Zod schema from the JSON Schema at build time.** Rejected: it would
  make the hub build depend on a file outside `site/` at runtime and hide the mirror
  from review. Instead the mirror is written out and a test proves it identical,
  which fails loudly on drift and stays readable.
- **`gcloud storage rsync` / `cp --recursive` for the sync.** Rejected: both risk
  bucket-metadata calls that `roles/storage.objectViewer` does not cover, and they
  would pass every local test before failing at Checkpoint 3. Two explicit REST calls
  make the permission surface auditable by reading twenty lines.
- **Serve PDFs from the synced tree instead of staging them into `public/`.**
  Rejected: it would move `/pdfs/<variant>.pdf`, which Phase 1 serves and the smoke
  tests request.
- **A fixture payload as the pull-request CV source.** Rejected as the *primary*
  answer on the Lead Architect's instruction: it would mean pull requests no longer
  validate against real CV data, and the fixture would drift. It is kept only as the
  credential-free local/offline path and **no CI job builds from it**.
- **Requiring the bucket on every trigger.** Rejected: it breaks pull-request builds
  and leaves an unsafe ordering window before Checkpoint 3.

---

## Risks

- **R1 — Pull-request builds cannot read the content bucket.** The deploy binding
  admits only `<repository_id>/refs/heads/main` (`infra/wif.tf`, `infra/deploy.tf`);
  a pull-request run carries `refs/pull/<n>/merge`. Mitigated by keeping
  `fetch-data.sh` as the fallback producer. Closed properly by Recommendation 1.
- **R2 — The bucket path is unverified against a real bucket.** No credential exists.
  Specifically unproven: that `objects.list` with `prefix=sources/` and
  `objects.get …?alt=media` both succeed under `roles/storage.objectViewer` with no
  `storage.buckets.get`; and that the JSON listing pages as expected past 1,000
  objects. The code paths are exercised against local trees, and the REST endpoints
  were chosen precisely because they are object-scoped. First real exercise is
  Checkpoint 3.
- **R3 — The fallback can mask a broken bucket path.** If `GCP_CONTENT_BUCKET` is
  ever unset by accident, the build silently reverts to the `cv` release and looks
  healthy. Mitigated: every run prints a `::notice::` naming its source and why, and
  `build-info.json` records `content_source`, so the deployed site says which path
  produced it. Checkpoint 3 should confirm it reads `bucket`.
- **R4 — Schema drift between `cv` and the hub.** Bounded by `schema_version` and a
  build failure on an unknown value, but the version must actually be bumped in `cv`
  when the payload shape changes. The hub cannot enforce that (ADR-0008 Risks).
- **R5 — A withdrawal that removes a whole source's prefix is undetectable.** See
  Open question (b).
- **R6 — Re-uploading identical bytes changes the fingerprint**, because the object
  generation changes. This over-triggers a rebuild; it never under-triggers. Accepted
  deliberately: the failure that matters is missing a change, not rebuilding twice.

---

## Open questions — answered

### (a) What is the right poll interval, now that the poll authenticates and lists a bucket?

**Recommendation: keep it hourly.** Do not change the cadence.

The poll is one Class A operation (an object listing). Against Cloud Storage's Always
Free allowance of **5,000 Class A operations per month** in `us-east1` (figures from
the infra stream):

| Cadence | Listings/month | Cost |
|---|---|---|
| **Hourly (current)** | ~720 | $0 — comfortably inside the free allowance |
| 15-minute | ~2,880 | $0 — still inside |
| 5-minute | ~8,640 | past the allowance, ~**$0.02/month** |

Everything else in the Phase 2 cost model is negligible: expected total run rate
$0.00/month, about $0.01 if the free allowance disappeared (≈60 MB stored, ~210
writes/month, ~50 MB egress). The $5 budget would need roughly 250 GB or about 1M
Class A operations before it alerts.

So the trade-off is purely **latency against staying inside the free tier**, and
hourly already sits well within it. Hourly buys a worst-case publish latency of 60
minutes, and 15-minute polling would cut that to 15 for ~2,880 operations — still
free. It is not worth taking, for one reason: the poll is the only line in the whole
Phase 2 cost model that scales with *time* rather than with content, so it is the one
line that grows if the project is neglected. Content is published a few times a
month and nothing about the hub is time-critical (ADR-0007 accepts the latency
explicitly).

**The latency has an escape hatch that costs nothing**: `workflow_dispatch` on the
hub. It is retained, a manual run always builds unconditionally, and it needs no
satellite credential at all — which is exactly the property ADR-0007 was written to
protect. Revisit the cadence only if the owner finds themselves using that hatch
routinely; that would be evidence, and evidence is a better reason than a guess.

### (b) Should a sync that finds NO manifest for a previously published source fail the build, or publish an empty section?

**Fail the build. This is implemented.** A source directory with no `manifest.json`
raises `HubContentError` and stops the build.

Failing is safer, for three reasons:

1. **Absence is never how withdrawal is expressed.** The contract's only retraction
   mechanism is an **empty `items` array** (`contract/README.md`; STATE C23), because
   a satellite cannot list and therefore cannot prune. A satellite that wants to
   withdraw everything publishes `"items": []` — which this build accepts happily,
   and there is a test for it. So a *missing* manifest is not a withdrawal; it is
   something having gone wrong.
2. **The failure modes that produce a missing manifest are all bad ones**: a partial
   upload (ADR-0007/STATE C21 — the publish action cannot verify what it uploaded,
   because verifying means listing, which satellites are denied), a botched delete, a
   truncated sync, a wrong prefix. Publishing an empty section in those cases would
   turn a transient fault into a silent content deletion on the live site — and from
   Phase 3, the same code path handles private items, where silently emptying a
   section is worse still.
3. **A build failure is loud, reversible and cheap.** The pipeline already opens a
   tracking issue on failure, the previous deploy stays live, and nothing is lost.
   An empty section is silent and looks deliberate.

**The honest limitation**: this only catches a source whose *directory* survives with
the manifest gone. A source whose entire prefix disappears is indistinguishable from
a source that never existed, because nothing records what *was* published. Closing
that needs an expected-source list the build checks against — Recommendation 3, and
part of the withdrawal-semantics ADR below. It is a real gap, not a theoretical one:
it is exactly the shape of R5.

---

## Seam and roadmap defects found — reported, not fixed

Per SEAM-6 and the contract, these are in files this stream does not own.

1. **SEAM-4 and the roadmap require deleting `site/scripts/fetch-data.sh`; doing so
   breaks every pull-request build.** The hub reads the bucket as its deploy service
   account, which `infra/wif.tf` admits only from `refs/heads/main`. A pull-request
   run cannot authenticate, so with `fetch-data.sh` gone it would build a CV-less
   site and fail `check:smoke-routes` on `/cv/academic`. There is also an ordering
   trap: between merging Phase 2 and the owner setting `GCP_CONTENT_BUCKET` at
   Checkpoint 3, `main` would have no CV data source at all — and GitHub Pages is
   authoritative until Phase 6 and carries live CV links. **On the Lead Architect's
   instruction, the script is kept as a fallback producer**; the roadmap line and
   SEAM-4's "`fetch-data.sh` is deleted" are the things that need amending. The
   proper fix is Recommendation 1, after which the script can go.
2. **ADR-0008 §Consequences states "`fetch-data.sh`, the `cv`-specific release
   download, leaves the hub build."** That is now inaccurate for Phase 2 for the
   reason above. No numbered decision of ADR-0007 or ADR-0008 is contradicted — the
   deletion appears only in the Consequences prose, SEAM-4 and the roadmap — but the
   ADR text should be reconciled so the record is not misleading.
3. **Roadmap scope line "Section pages render from collections (brief §4)" is
   unassigned in this contract.** It is not among D1–D8, and implementing it would
   change rendered output, which D4 forbids. Nothing renders from the new collection
   yet. Either assign it explicitly with a statement about which pages may change, or
   move it to Phase 5 with the other satellites.
4. **`npx astro check` reports 11 pre-existing errors**, all `ts(7006)` implicit-any
   in `site/src/components/SourceExplorer.astro`. They pre-date this work, are
   unrelated to Phase 2, and are not in this contract's validation list, so they were
   left alone. `astro check` is not run in CI; if it ever is, this file blocks it.

Nothing was found wrong with `contract/**`. Nothing under `contract/`, `infra/`,
`docs/`, `ci.yml`, `firebase.json`, `CLAUDE.md`, `AGENTS.md` or `.claude/` was
modified, and no file in `llm/` other than this handoff.

---

## Decisions taken within scope

1. **Patterns held as strings, compared to the schema by a test.** Makes "mirrors
   field for field" a checked property rather than a claim.
2. **Validation inside `loader.load()`**, on the evidence about Astro's error
   handling above.
3. **Two REST calls instead of `gcloud`**, to keep the permission surface auditable
   and avoid any bucket-metadata call.
4. **Fingerprint = SHA-256 over the sorted object listing** (`name`, `generation`,
   `size`), so deletions change it.
5. **PDFs staged into `public/pdfs/`**, keeping Phase 1's URL, driven by the manifest
   so withdrawal works.
6. **One bucket-shaped tree, four producers**, so the fallback cannot become a second
   code path.
7. **A committed offline fixture** (`site/fixtures/content/`) for credential-free
   work and for testing the sync, used by no CI job.
8. **`CLAIMED_DATA_ITEMS` and the payload paths in one module**, imported by the
   content config, the staging script, the pages and the tests.
9. **Bug fixed during validation**: the local-checkout path produced a tree of
   symlinked *directories*, and the sync's listing used `find` without `-L`, so only
   `manifest.json` synced and the build failed. `find -L` fixes it; the fixture and
   release paths use real files, which is why they passed. Caught only by actually
   running `npm run data:link` against the real checkout.
10. **A second bug fixed**: `stage-public-assets.mjs` resolved the photo against the
    site root rather than the synced tree. The two coincide in a normal build, so it
    worked by accident; a unit test with a different destination caught it.

---

## ADR candidates

1. **Poll interval and the manual escape hatch.** Hourly, with the arithmetic in
   Open question (a) and `workflow_dispatch` as the stated low-latency path. Worth an
   ADR because the number will be re-litigated otherwise, and because the reason to
   keep it is about the *shape* of the cost (time-scaling) rather than its size.
2. **How withdrawal of a published item behaves end to end.** An empty `items` array
   is the only retraction mechanism; a missing manifest is a build failure; a
   vanished prefix is currently undetectable. This spans the publish action, the
   bucket, the fingerprint, the staging step and Phase 3's private items, and no
   single document states it. Extends STATE C23. Should include the expected-source
   list of Recommendation 3.
3. **How the hub reads its own bucket from a non-`main` ref.** Recommendation 1 — the
   decision that lets `fetch-data.sh` be deleted, and the one that decides whether
   pull requests validate against real published content.

---

## Related docs

- `llm/sprints/2026-09-hub/contracts/site-phase-2.md` — this contract
- `llm/sprints/2026-09-hub/contracts/phase-2-seams.md` — SEAM-1, SEAM-4, SEAM-5, SEAM-6, SEAM-7
- `llm/governance/adr/0007-hub-polls-content-bucket-no-satellite-github-credential.md`
- `llm/governance/adr/0008-manifest-data-format-hub-renders-cv.md`
- `llm/specs/2026-09-10-research-hub-design.md` §3, §4, §5, §9, §11, §12
- `llm/master-roadmap.md` §phase-2-contract
- `contract/manifest.schema.json`, `contract/README.md`, `contract/validate-manifest.mjs`
- `site/README.md` §Published content, `site/fixtures/README.md`
