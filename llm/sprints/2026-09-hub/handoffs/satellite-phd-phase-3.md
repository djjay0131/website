# Handoff: Satellite Implementation Engineer (`phd-milestones`) — Phase 3

Status: Complete
Last updated: 2026-09-17
Author: Satellite Implementation Engineer (Specialist 4), sprint 2026-09-hub
Repository worked in: `phd-milestones` (private), checkout on branch `feat/publish-contract`
Issue: #24 — hub-003: Phase 3 — Private area

## A note on what this page may say

`phd-milestones` contains a milestone tracker and a committee dossier that name and
assess real people; it is the material of Incident A1, and this handoff is committed to
a **public** repository. Nothing from either document is reproduced here. Items are
referred to by slug and path. The two derived titles are quoted because neither names a
person nor carries an assessment — see *Titles* below, which states what was trimmed and
why.

## Summary

A push to `phd-milestones`' `main` now stages a `dist/` and hands it to
`djjay0131/website/contract/publish@main`, publishing two items under
`sources/phd-milestones/`, **both `visibility: private`**:

| slug | path | section | format | visibility | date |
|---|---|---|---|---|---|
| `milestones` | `site/index.html` | `phd` | `html` | `private` | 2026-09-10 |
| `committee-dossier` | `site/committee.html` | `phd` | `html` | `private` | 2026-08-31 |

Exactly SEAM-7, through the same contract `cv` uses, with no new mechanism. The manifest
emits `manifest_version: "1"` — the first satellite to send it (ADR-0009).

The repository holds **no GitHub credential for the hub**, no service-account key, and no
ability to list the bucket. The publish job's only permission beyond `contents: read` is
`id-token: write`.

`private` is not a per-item setting there: it is a module constant, asserted on the way
out by the generator and asserted again by the test suite, so a public item from this
repository fails in its own CI before any upload. That was D3's point and it is the one
thing in this stream worth checking first.

### Files delivered — all in `phd-milestones` except this handoff

| File | Status | What it is |
|---|---|---|
| `tools/generate-manifest.mjs` | new | D1. Stages `dist/` and writes `dist/manifest.json`. Zero dependencies. |
| `tools/generate-manifest.test.mjs` | new | D3. 14 tests, run in CI. |
| `.github/workflows/publish.yml` | new | D2. Push to `main`, non-PR, `id-token: write`. |
| `.github/workflows/ci.yml` | new | Runs the same suite on branches and PRs — see *Assumptions* 5. |
| `docs/hub-publishing.md` | new | D4. What is published, that it is private, that no hub credential exists. |
| `.gitignore` | modified | One line: `dist/`. |
| `llm/sprints/2026-09-hub/handoffs/satellite-phd-phase-3.md` | new | **This file — the only file written in `website`.** |

No seed content was altered: `README.md`, `site/*.html`, `site/assets/style.css`,
`docs/*.md` and `.gitlab-ci.yml` are untouched. Nothing from `phd-milestones` was copied
into `website`. `/mnt/c/code/cv` was never touched. No `git` or `gh` mutation was run in
either repository.

## Required owner actions

### 1. Four GitHub Actions variables, in the `phd-milestones` repository

Settings → Secrets and variables → Actions → **Variables** (not secrets — none is secret,
and making them secrets only makes failures harder to read):

| Variable | What it is |
|---|---|
| `GCP_PROJECT_ID` | The hub's Google Cloud project id |
| `GCP_WIF_PROVIDER` | `phd-milestones`' Workload Identity provider, in the hub's `satellites` pool |
| `GCP_PUBLISH_SA` | `phd-milestones`' publishing service account |
| `GCP_CONTENT_BUCKET` | The hub's content bucket name |

Exactly these four. `dist: ./dist` and `source: phd-milestones` are literals written in
the workflow, not variables.

### 2. Confirm the repository is private on GitHub before the first push to `main`

Definition of done for this phase. The publish path works the same either way, which is
exactly why it should be confirmed rather than assumed.

### 3. File modes on commit — read this before `git add`

`core.filemode` is `true` and the checkout is on `/mnt/c`, which reports every file as
`0777`. All nine seed files already show as ` M` with a zero-content diff:
`git diff --summary` lists nine `mode change 100644 => 100755` entries, and every new file
would likewise be committed `100755`. **No `*.sh` was added and no new file carries a
shebang** (verified: zero shebangs across `tools/*.mjs` and `.github/workflows/*.yml`), so
the SEAM-9 rule is not violated in the direction it guards — the risk here is the
inverse, a commit that silently flips the seed's modes. Suggested: commit with
`git -c core.fileMode=false add …`, or `git update-index --chmod=-x <file>` afterwards,
then verify with `git ls-files -s` (never `ls -l`).

## Validation — verbatim

All commands run in the checkout at `/mnt/c/code/phd-milestones`, Node v24.18.0.

### The generator, and the hub's own validator

```
$ node tools/generate-manifest.mjs --dist dist
wrote dist/manifest.json (2 items, manifest_version 1)
  milestones  private  site/index.html  2026-09-10
  committee-dossier  private  site/committee.html  2026-08-31
generator exit: 0

$ node /mnt/c/code/website/contract/validate-manifest.mjs --dist dist --check schema
Manifest check "schema" passed (dist/manifest.json).
exit: 0

$ node /mnt/c/code/website/contract/validate-manifest.mjs --dist dist --check paths
Manifest check "paths" passed (dist/manifest.json).
exit: 0

$ node /mnt/c/code/website/contract/validate-manifest.mjs --dist dist --source phd-milestones --check source
Manifest check "source" passed (dist/manifest.json).
exit: 0
```

The generator deliberately prints slug, visibility, path and date and **never a title or
any page text**: a CI log is the easiest place to leak this repository.

#### The manifest, titles withheld from this public page

```json
{
  "source": "phd-milestones",
  "manifest_version": "1",
  "published": "2026-09-17T04:29:16Z",
  "items": [
    {
      "slug": "milestones",
      "section": "phd",
      "format": "html",
      "path": "site/index.html",
      "visibility": "private",
      "date": "2026-09-10"
    },
    {
      "slug": "committee-dossier",
      "section": "phd",
      "format": "html",
      "path": "site/committee.html",
      "visibility": "private",
      "date": "2026-08-31"
    }
  ]
}
```

The staged tree is exactly four files:

```
dist/manifest.json
dist/site/assets/style.css
dist/site/committee.html
dist/site/index.html
```

#### Titles

Both titles are **derived from each page's own `<title>`**, taking the segment before the
trailing site name. The results are `PhD Milestones` and `External Committee Dossier`.

Neither names a third party and neither carries an assessment, so both are reproduced
here. One trim is deliberate and worth recording: the tracker's raw `<title>` carries the
candidate's own name as its suffix, and the generator drops it, so the hub's navigation
shows the document rather than the person. `External Committee Dossier` is already the
worked example in the hub's public `docs/satellites.md` and `contract/README.md` — see
defect **H-4**, which is about that fact rather than about the title.

### The generator's tests

```
$ node --test tools/*.test.mjs
✔ every generated item is visibility: private (18.851754ms)
✔ visibility is a constant, not a per-item choice (0.231414ms)
✔ assertPrivate refuses a manifest carrying a public item (0.491231ms)
✔ the manifest describes exactly the two items SEAM-7 fixes (14.871009ms)
✔ the manifest carries no field the hub's closed schema would reject (12.708577ms)
✔ manifest.json is written at the root of dist/, and the pages are staged with their assets (27.336072ms)
✔ the title is the page's own title, without the trailing site name (0.356122ms)
✔ a page with no title fails the build rather than getting an invented one (0.253215ms)
✔ the date is the page's own stamp (0.346922ms)
✔ without a stamp the date falls back to git, then to the publish date (5.033108ms)
✔ each item's date comes from its own page (2.489853ms)
✔ local references are found, and external ones ignored (0.248315ms)
✔ a page whose stylesheet did not reach dist/ fails the build (2.264439ms)
✔ the real pages' local references all resolve inside dist/ (15.432144ms)
ℹ tests 14
ℹ suites 0
ℹ pass 14
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 198.740456
tests exit: 0
```

No fixture reproduces any page content: the synthetic fixtures are written for the test
and say nothing, and the tests that run against the real `site/` assert structure only —
slugs, visibility, paths, date shape — and never assert or print a title or any page text.

### `actionlint` and a YAML parse

```
$ docker run --rm -v "$PWD:/repo" -w /repo rhysd/actionlint:latest -color
actionlint exit: 0

$ python3 -c "yaml.safe_load(...)"
.github/workflows/publish.yml OK | job publish | perms {'contents': 'read', 'id-token': 'write'} | steps ['actions/checkout@fbc6f3992d24b796d5a048ff273f7fcc4a7b6c09', 'actions/setup-node@a0853c24544627f65ddf259abe73b1d18a591444', 'Test the manifest generator', 'Stage dist/ and generate the manifest', 'Publish to the research hub']
.github/workflows/ci.yml OK | job test | perms None | steps ['actions/checkout@fbc6f3992d24b796d5a048ff273f7fcc4a7b6c09', 'actions/setup-node@a0853c24544627f65ddf259abe73b1d18a591444', 'Test the manifest generator']
```

`actionlint` is **clean**, on a file with no pre-existing findings to excuse. Both
third-party actions are pinned by full commit SHA with the version in a comment, using
the same SHAs the hub itself pins (`actions/checkout` v5, `actions/setup-node` v5). The
hub's own action is referenced at `@main`, as `docs/satellites.md` documents and as `cv`
does.

A grep of `.github/`, `tools/` and `docs/hub-publishing.md` for `secrets.`, `PAT`,
`repository_dispatch`, key files and `credentials_json` returns only the prose in comments
saying those things must not exist. No cloud command was run, no workflow was triggered,
and no credential was created.

## Was `docs/satellites.md` sufficient?

**For the mechanics, yes. For a private, multi-file `html` satellite, no — and the gap is
exactly the subject of open question (a).**

What worked, as the second real reader: I could have produced a correct `dist/`, a valid
manifest and a correct publish step from that page alone. "What you never need" did the
same work for me it did for `cv` — it answered the credential question before I could ask
it. The four-variable table is now right (the `cv` stream's defect is fixed), the
`id-token: write` note is unmissable, "`manifest.json` at the **root** of `dist/`" is
stated where you need it, and the `manifest_version`/`schema_version` table made ADR-0009
a five-minute job rather than a research task. The "generate the manifest from your build,
don't hand-maintain it" sentence the `cv` stream asked for has landed and is doing its
job.

Three insufficiencies, all Phase-3-shaped:

**S-1 — the page never says what travels alongside an `html` item.** `format: html` is "a
self-contained page or folder", and `path` is "relative to `dist/`". Neither says whether
anything other than the file at `path` is uploaded, or served. I could not answer "will
the stylesheet my page loads reach the hub?" from `docs/satellites.md`; I had to read
`contract/publish/action.yml` (which uploads all of `dist/`, not the manifest's paths) and
then the hub's `site/scripts/sync-content.sh` and `site/src/lib/hub-content.mjs` to be
sure. **Per my contract, that is the defect to report rather than work around.** One
sentence would close it: *the publish action uploads everything in `dist/`, not only the
files the manifest names; an `html` page that loads sibling files must ship them in
`dist/` beside it.*

**S-2 — nothing tells a private satellite to enforce its own visibility.** The page says
the hub build fails if a private item appears in public output — a hub-side guarantee. The
advice a private satellite most needs is the satellite-side one: assert it yourself,
before the upload, in your own CI. My contract required it (D3); the published how-to does
not mention it, so the next private satellite will not do it.

**S-3 — "Private items are a Phase 3 capability. Until then, publish only public items."**
Correct when written, now ambiguous: Phase 3 is here, and a reader cannot tell from the
page whether "until then" has passed. It needs a one-line edit when this phase merges.

## Defects found

Hub-side. `contract/**` is nobody's this phase and `docs/**` is the Lead's, so these are
reported, not edited.

**H-1 — `format: html` does not define sibling-asset resolution.** The substance is in
open question (a). It is not a blocker for *publishing* — all of `dist/` is uploaded and
`sync-content.sh` mirrors the whole prefix — but it is undefined for *serving*.

**H-2 — the hub's existing per-item staging copies one file, and would silently drop the
stylesheet.** `site/src/lib/hub-content.mjs`'s `publicAssetPathFor()` returns a single
destination path per item and `site/scripts/stage-public-assets.mjs` does
`fs.copyFileSync(from, to)`. That is right for `cv`'s PDFs. If the Phase 3 `site` stream
extends the same shape to `html`, it will copy `site/index.html` and leave
`site/assets/style.css` behind, and the private page will render unstyled with no error
anywhere. **An `html` item must be staged by copying its containing directory, not its
file.** This is the most actionable thing in this handoff and it belongs to the `site`
stream.

**H-3 — nothing in the hub serves `format: html` yet.** No code branches on
`format === "html"`, there is no route for `/<section>/<source>/<slug>/`, and
`site/src/pages/phd/index.astro` is a deliberately empty, noindex section shell. Expected
— it is the `site` stream's Phase 3 work — but it means these two items will publish and
sync and still not render until that lands. Named so it is not discovered at Checkpoint 4.

H-2 and H-3 were **re-checked against the `site` stream's in-progress work** at the time
of writing, not only against `main`: its new `site/scripts/site-output.mjs` is the
`HUB_OUTPUT` selector alone and carries no per-item copy logic, and no file in the hub yet
branches on `format === "html"`. Both findings stand.

**H-4 — the public how-to uses this private source as its worked example.** The manifest
examples in `docs/satellites.md` and `contract/README.md` are
`"source": "phd-milestones"` with `slug: "committee-dossier"`, a title, and a one-line
summary describing the dossier's contents. Two separate problems: a **public** page
advertises a private source's item names and a description of what is in it, which sits
oddly beside an Incident A1 remediation; and the example's `path`
(`committee/index.html`) is not the path SEAM-7 fixes (`site/committee.html`), so a reader
copying the example gets a path shape this repository does not use. Recommend a neutral
placeholder source in both files.

The contrast worth drawing: the `site` stream's new fixture tree at
`site/fixtures/content/sources/phd-milestones/` gets this **right**. Its pages are
invented placeholders that say so in their own body text, its manifest titles are marked
`(fixture)`, and a grep for real identifiers returns nothing — 1,897 bytes of stand-in
against 52,294 bytes of real material that stayed in the private repository. The
published how-to is the one place where a private source's real item names and a
description of its contents appear in a public file.

**H-5 — private pages make a third-party request.** Both pages load webfonts from a public
CDN. Behind the gate, a signed-in member viewing private content still causes a request to
that CDN, carrying the usual referrer and IP. Not fixed: fixing it means editing seed
content, which my file contract forbids. Recorded in `docs/hub-publishing.md` so the
choice is deliberate rather than accidental.

Seam: **no SEAM-7 defect.** It is implementable exactly as written, and the two rows
match what is published field for field. The friction is entirely in what `format: html`
leaves unsaid, which is the contract's text, not the seam's.

## Cross-stream confirmations

Checked against the hub checkout as this was written, because being the first satellite to
emit `manifest_version` only works if the hub already accepts it:

1. **The hub accepts `manifest_version: "1"`.** `site/src/lib/hub-content.mjs` now carries
   `KNOWN_MANIFEST_VERSIONS = ["1"]`, `DEFAULT_MANIFEST_VERSION = "1"` and
   `manifestVersionOf()` applying the absent-means-`"1"` default. So ADR-0009's required
   ordering — the hub accepts the field strictly before any satellite sends it — **holds**,
   and this satellite can emit it safely. This was the one way being first could have gone
   wrong, and it does not.
2. **`phd-milestones` is already declared in `EXPECTED_SOURCES`**, deliberately with
   `required: false` until it has actually published, so ADR-0010 decision 4 does not fail
   every build in the meantime. That file carries an explicit **Checkpoint 4 action: flip
   `required` to `true` once this satellite has published successfully.** This stream's
   first green publish is that trigger; nothing here can flip it, and it should not be
   missed, because after that point the prefix's absence is exactly the fault decision 4
   exists to catch.
3. The hub checkout also contains uncommitted work from the `gate`, `infra` and `site`
   streams. **None of it is mine** — the only file this stream wrote under
   `/mnt/c/code/website` is this handoff.

## Open questions — answered

### (a) Which files do the manifest's `path` values imply must be uploaded, and is `format: html` satisfied by a page that loads a sibling stylesheet?

**The manifest's paths imply two files. Correct publication takes three. That difference
is the defect.**

The manifest names `site/index.html` and `site/committee.html`, and those are the only
paths `checkPaths()` resolves. But what is uploaded is not driven by the manifest at all:
`contract/publish/action.yml` passes `path: ${{ inputs.dist }}` to
`upload-cloud-storage` with `parent: false`, so **the whole of `dist/` is uploaded**
whether or not the manifest mentions a file. Both pages load `assets/style.css` relative
to themselves, so the set of files that must be in `dist/` for these items to be usable is:

```
site/index.html        named by the manifest
site/committee.html    named by the manifest
site/assets/style.css  named by nothing — required by both pages
```

So the pages reach the bucket intact, and `sync-content.sh` mirrors the entire prefix into
the build tree, preserving the relative layout. Nothing is lost up to that point. It works
by a property of the upload step, not by anything the manifest says.

**Is the format's definition satisfied? No.** "A self-contained page or folder" does not
describe this case in either of its two readings:

- As a **page**: `site/index.html` is not self-contained. It loads a sibling stylesheet,
  and it links to the other item by a sibling relative path.
- As a **folder**: the contract never says a file-valued `path` implies its containing
  directory, and here that reading collapses anyway — **both items share one directory**
  (`dist/site/`), so "one folder per item" is not true of this satellite. A hub that
  served each item's containing directory would serve each item the other one too.

Two further consequences worth naming: the pages' relative cross-links
(`href="index.html"` / `href="committee.html"`) cannot resolve if each item is served at
its own `/<section>/<source>/<slug>/` URL, and **H-2** above means a file-by-file staging
step drops the stylesheet silently.

**What should change.** SEAM-7 fixes file-valued paths, so the satellite cannot fix this
by restructuring. The contract should say, in `manifest.schema.json`'s `format`
description and in `docs/satellites.md`:

1. For a file-valued `html` path, the hub serves the file's **containing directory** as
   the item's root, and the satellite must ship every file the page references inside
   `dist/`; and
2. what happens when two items share a directory — either permit it and define the served
   root accordingly, or require one directory per `html` item, which would mean amending
   SEAM-7.

Until that is decided, I have made the dependency explicit and enforced on this side
rather than assumed: the generator stages the whole `site/` tree and **fails the build if
any staged page references a local file that is not in `dist/`**, which is the
`a page whose stylesheet did not reach dist/ fails the build` test above. That protects
the upload. It cannot protect the hub's staging step — only **H-2** can.

### (b) Is a per-item `date` derivable from this repository, or must it be the publish date?

**Derivable, genuinely per-item, and it must not be the publish date.**

Each page carries its own dated masthead stamp — a labelled date saying when its content
was last established — and the two differ: the tracker's is 2026-09-10 and the dossier's
is 2026-08-31. The publish date would collapse two real, different dates into one wrong
one, and would move every time an unrelated push rebuilt the page.

The generator uses, in order:

1. **The page's own stamp** (`Updated` / `Compiled` / `Revised` + `D Mon YYYY`). It is the
   document's own statement of currency and survives a commit that only reformats the file.
2. **`git log -1 --format=%cs -- <file>`**, the committer date of the last commit touching
   that file. Works at `actions/checkout`'s default depth of 1.
3. **The publish date**, only if both fail.

Each leg is tested. Note why the order matters here specifically: the seed is a **single
commit** (STATE A23), so every file's git date is that one commit's date — the git leg
alone would give both items 2026-09-10 and lose the dossier's real date. The stamp is the
only thing in the repository that distinguishes them.

The cost is that the date now depends on a markup shape in the page. If a stamp is
reworded to a label the generator does not know, the item quietly falls back to the git
date rather than failing. I chose a silent fallback over a hard failure because the
fallback is still a true date; a title, by contrast, has no truthful fallback and does
fail the build.

## ADR candidates

1. **Whether `format: html` must state how sibling assets are resolved** (the contract's
   own candidate). Recommend yes, and note that this satellite sharpens it: two items
   share one directory, so "the folder is the item" is not merely unstated but untrue
   here. Answer (a) proposes the two rules it should contain.
2. **Whether a private satellite should publish on any branch but `main`** (the contract's
   own candidate). Recommend no. It is currently enforced twice by accident of
   construction — `on: push: branches: [main]` plus a job-level
   `if: github.event_name != 'pull_request'`, and the WIF provider admits only the default
   branch — and an ADR would make that a rule rather than a coincidence two streams
   happen to agree on.
3. **Satellite-side enforcement of `visibility`.** My D3 required this repository to fail
   its own CI on a public item. Nothing in the contract requires that of the next private
   satellite, and the hub's leak check is the only other line of defence. See S-2.
4. **The public how-to's worked example naming a private source** (H-4). Small, but it is
   a disclosure decision and it lives in two files with two owners.

## Assumptions

1. **Titles are derived, never invented**, as the first dash-segment of each page's own
   `<title>`; the tracker's personal-name suffix is trimmed deliberately. A page with no
   `<title>` fails the build.
2. **Both items are private, unconditionally.** `VISIBILITY` is a module constant, item
   definitions cannot override it, and a test asserts they cannot. No item was ever
   generated, staged or validated as `public`, at any point, including during testing.
3. **`dist/` is the whole `site/` tree under `dist/site/`**, so item paths carry the
   `site/` prefix exactly as SEAM-7 fixes them, and the relative `assets/style.css` link
   resolves unchanged.
4. **Node, zero dependencies, no `package.json`.** The repository's README says "plain
   static HTML with no build step and no dependencies", and the hub's own validator is
   zero-dependency Node for the same reason. `node --test` is built in. Nothing is
   installed at publish time beyond `actions/setup-node`.
5. **`ci.yml` is beyond the named deliverables.** D3 asks for the test to run in CI, and
   `publish.yml` runs only on `main`; without `ci.yml` a branch or PR that broke the
   private-visibility guarantee would go unchecked until it merged. Flagged for reversal
   if unwanted.
6. **`node --test tools/` is not used.** On Node 24 a bare directory argument is treated
   as a module to run, not a directory to search, and fails with `Cannot find module`.
   Both workflows use the shell-expanded glob `tools/*.test.mjs`, which was verified here
   and still picks up test files added later.
7. **`.gitlab-ci.yml` is left in place and flagged** (A24), in `docs/hub-publishing.md`,
   which also states plainly that the GitLab visibility settings it describes are not what
   protects this content any more.
8. **`dist/` is left staged in the checkout** (gitignored) so it can be inspected. It
   contains private bytes; delete it if that is unwanted.

## Risks

1. **The four variables do not exist yet.** Until `infra` applies and the owner sets them,
   every push to `main` shows a red `publish` job failing at the WIF exchange. I did not
   gate the step on `vars.GCP_CONTENT_BUCKET != ''`: a silently skipped publish is a worse
   failure mode than a loud one, and this is the same call the `cv` stream made.
2. **Withdrawal leaves the bytes behind (ADR-0010 decision 6).** Dropping an item from
   `items` stops the hub serving it, but the object stays under
   `sources/phd-milestones/`, readable by the hub's identity, until someone deletes it.
   That consequence is documented for `cv` and is materially more serious here: for this
   material, a withdrawal that leaves the dossier in the bucket is not a withdrawal. The
   satellite can delete an object it knows the name of, and the two names are fixed, so
   this is doable by hand — it is just not automatic, and nothing prompts for it.
3. **The publish cannot verify itself.** No `storage.objects.list`, by design. A green job
   means the uploads returned success, not that the prefix holds what you expect.
4. **`@main` on the hub's action.** Any push to the hub's `main` immediately changes what
   runs inside this private repository's workflow. Documented and deliberate, and the
   stakes are now higher than in Phase 2 because the job it runs in handles private bytes.
5. **File modes on commit.** See *Required owner actions* 3.
6. **A content edit can block a publish.** The generator reads the pages at build time, so
   removing a page's `<title>`, or a page gaining a reference to a file outside `site/`,
   fails the build. That is the intended direction — it fails rather than publishing
   something wrong — but it will surprise whoever edits the page rather than the tooling.

## Related documents

- `llm/sprints/2026-09-hub/contracts/satellite-phd-phase-3.md` — this contract
- `llm/sprints/2026-09-hub/contracts/phase-3-seams.md` — SEAM-7, SEAM-9
- `llm/governance/adr/0007-…` — the credential boundary and the `list` prohibition
- `llm/governance/adr/0009-manifest-version-lands-optional-first.md` — `manifest_version: "1"`
- `llm/governance/adr/0010-withdrawal-semantics.md` — risk 2 above
- `docs/satellites.md` — the how-to this work is the second real reader of; S-1, S-2, S-3
- `contract/README.md`, `contract/manifest.schema.json`, `contract/publish/action.yml`,
  `contract/validate-manifest.mjs`
- `llm/sprints/2026-09-hub/handoffs/satellite-cv-phase-2.md` — the precedent
- In `phd-milestones`: `docs/hub-publishing.md`, `tools/generate-manifest.mjs`,
  `tools/generate-manifest.test.mjs`, `.github/workflows/publish.yml`,
  `.github/workflows/ci.yml`
