# Handoff — `satellite-phd`, Wave 0

Stream: `satellite-phd`
Wave: 0 — close out Phase 3 honestly
Repository: `djjay0131/phd-milestones` (private)
Checkout: `/mnt/c/code/phd-milestones`, branch `feat/publish-contract` at `433057a`
Date: 2026-09-18
Contract: `llm/sprints/2026-09-hub/contracts/satellite-phd-wave-0.md`

**Nothing was committed, branched, pushed or published. No cloud call was made.**
Item 1 is working-tree edits; Item 2 is a patch file plus this procedure.

---

## Summary

**Item 1 — H-5, self-hosted webfonts. Done.** Both private pages loaded a webfont
stylesheet from `fonts.googleapis.com`, so every signed-in member reading private
material handed that CDN their IP address and, in the `Referer`, the private URL they
were reading. The fonts are now served from the pages' own origin. The built output
contains **zero** off-origin subresources; the enumeration is below, taken by grepping
`dist/`, not by reading the source.

The seed content changed by **two lines total** — one `<link>` in each page.
`site/assets/style.css` was not touched at all.

The property is now **enforced at build time** rather than documented. The generator
follows each page into its stylesheets and fails the build if anything the browser
fetches on its own comes from another origin — a `<link>`, a `<script>`, an image, or an
`@import` one level down inside a local stylesheet. That last case is the one the
contract warned about, and it is the one reading the source would miss. A `<a href>` a
reader may click is exempt and stays exempt; both pages legitimately cite public VT
policy pages.

**Item 2 — the withdrawal proof. Prepared, not executed.** A ready-to-apply patch
withdraws `committee-dossier` by removing one entry from `items`, with the manifest
still published. The procedure below names the exact two objects the hub's dry run must
then list, the restore, and — the part that matters — five distinct results that would
mean the driver is wrong, including two that look like success.

**One finding you need before you run Part C.** Part C asks you to confirm the delete
list *before the apply step runs*. **With `build.yml` as it stands you cannot.** The
`private-sync` job runs `Plan the private sync (dry run)` and `Sync the private output`
as consecutive steps of the same job with no gate between them. By the time the plan is
readable in the log, the delete has already happened. This is not a small procedural
nit: it converts the proof from a check into a post-mortem. Remedies in Recommendations;
one of them is a single line in `build.yml`.

---

## Before / after: every external URL the BUILT pages reference

Both lists come from `grep` over `dist/` after running
`node tools/generate-manifest.mjs --dist dist`. The classification that matters is
**what the browser fetches by itself** versus **what a reader has to click**, because
only the first discloses anything.

### BEFORE (build at `433057a`)

**Fetched automatically — the leak:**

| Where | Reference |
|---|---|
| `dist/site/index.html` | `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Spectral:ital,wght@0,400;0,600;0,700;1,400&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap">` |
| `dist/site/committee.html` | the identical `<link>` |
| both pages | `<link rel="stylesheet" href="assets/style.css">` — same origin |

That one CDN stylesheet is also a second-order leak: `fonts.googleapis.com` replies with
`@font-face` rules pointing at `fonts.gstatic.com`, so the actual font files come from a
second third-party host that the page never names.

**Reader-initiated (`<a href>`), unchanged by this work — 4 public VT policy pages:**

```
https://students.cs.vt.edu/Graduate/Degrees/Doctorate.html
https://students.cs.vt.edu/Graduate/Administrivia.html
https://graduateschool.vt.edu/academics/what-you-need-to-graduate/basics-zoom-graduate-exams.html
https://graduateschool.vt.edu/faculty-and-staff-resources.html
```

**CSS `@import` / `url()` in the built output:** none.
**Scripts:** one inline `<script>` in `index.html` (the date calculator). No `src`, and
no `fetch`/`XMLHttpRequest`/dynamic `import()` — checked.

### AFTER

**Fetched automatically — the acceptance evidence:**

```
$ grep -rl 'fonts.googleapis.com' dist/ | wc -l
0
$ grep -rl 'gstatic.com'          dist/ | wc -l
0

$ # every url-bearing attribute on a non-anchor element, in the built HTML:
href="assets/fonts.css"
href="assets/style.css"

$ # built CSS:
@import anywhere:            none
url() targets:               18
  of which off-origin:       0      (all are relative: fonts/<name>.woff2)
```

**Reader-initiated (`<a href>`):** the same four VT policy pages, byte-identical. No
anchor was added, removed or rewritten.

**One honest caveat about a naive grep.** A bare "every `https://` token in `dist/`"
sweep now also returns `http://scripts.sil.org/OFL` and
`https://github.com/productiontype/Spectral`. Both are **prose inside the three OFL
licence text files** that the SIL Open Font License requires to travel with the fonts.
They are plain text in `.txt` files, referenced by nothing, in no fetch position, and no
browser ever requests them. I am naming them rather than filtering them out, because an
"after" list that quietly drops its inconvenient rows is exactly the kind of evidence the
contract told me not to produce.

**Verified independently of my own code**, by the hub's own validator:

```
$ node /mnt/c/code/website/contract/validate-manifest.mjs --dist dist --source phd-milestones
Manifest check "schema" passed (dist/manifest.json).
Manifest check "paths"  passed (dist/manifest.json).
Manifest check "source" passed (dist/manifest.json).
```

And every staged path satisfies the gate's segment allowlist `[A-Za-z0-9._-]` (SD-7) —
checked over all 26 built files, zero violations. The font filenames were chosen with
that in mind.

`node --test tools/*.test.mjs`: **23 passed, 0 failed** (was 13 tests before).

---

## Every file touched, and why

### Modified — tracked files (6; 317 insertions, 21 deletions of real content)

| File | Lines | Reason |
|---|---|---|
| `site/index.html` | 1 | The CDN `<link>` replaced by `<link rel="stylesheet" href="assets/fonts.css">`. Seed content — this is one of the two lines. |
| `site/committee.html` | 1 | The identical one-line replacement. The other seed line. |
| `tools/generate-manifest.mjs` | +175/−10 | Follow a page into its stylesheets' own `url()`/`@import` targets, so a promised font file that did not travel fails the build; and refuse any off-origin subresource in a page or in a stylesheet it pulls in (H-5 enforced, not just documented). |
| `tools/generate-manifest.test.mjs` | +120/−5 | The synthetic fixture carried a CDN `<link>` — a faithful copy of the real pages, which the new guard now correctly refuses; it is behind an `externalFont` flag used by the test that asserts the refusal. Ten new tests. |
| `docs/hub-publishing.md` | +18/−4 | Its "Both pages also load webfonts from a third-party CDN … out of scope" paragraph became false the moment the fonts moved. Replaced with what is now true and what enforces it. |
| `README.md` | +2 | The layout tree listed `assets/style.css` as the only asset; it would now be wrong. |

**Deliberately not touched:** `site/assets/style.css` (zero changes — the seed stylesheet
is untouched), both workflows, `.gitlab-ci.yml`, `docs/milestones.md`,
`docs/vt-policy.md`, `docs/committee-search.md`.

Because **no workflow was touched, `actionlint` is not implicated by this work.** It is
also not on this machine's `PATH` (nor is `gh` or `jq` — consistent with the contract
defect recorded in STATE).

### New — untracked files (23)

| Path | Size | Reason |
|---|---|---|
| `site/assets/fonts.css` | 9,231 B | 18 `@font-face` rules plus provenance: package, exact version, the sha512 integrity of each tarball, and the licence. |
| `site/assets/fonts/*.woff2` | 18 files, 349,196 B | The font files themselves. |
| `site/assets/fonts/OFL-Spectral.txt`, `OFL-IBM-Plex-Sans.txt`, `OFL-IBM-Plex-Mono.txt` | 15,594 B | SIL OFL 1.1 requires the licence to accompany the fonts. |
| `withdrawal-proof.patch` | 4,580 B | **Item 2's deliverable. Must NOT be committed with Item 1.** See below. |

Total added to the repository: **374,533 bytes**, against a prior tracked size of ~54 KB.

**Provenance.** The woff2 files are copied verbatim from the `@fontsource` packages at
**the exact versions the hub itself pins** in `site/package-lock.json`, and I verified
each tarball's sha512 against that lockfile before extracting:

| Package | Integrity — matches the hub's lockfile |
|---|---|
| `@fontsource/spectral@5.3.0` | `sha512-2TL5WWGOZj4SIsBmPFEzKeA60tXXd1Qp1OqaaVEWkJL8IfSGLk6YmiusmC441iFkdJDIuFelu1r8lhCmQUU3mw==` |
| `@fontsource/ibm-plex-sans@5.3.0` | `sha512-CbE4CbbEEZJX860XyUiRpsksXIQR8Rp2XDva2VO53NJox9tVNtusrysd2x5YkUEY3ErQ66W1IiiQL8/wihhw5w==` |
| `@fontsource/ibm-plex-mono@5.3.0` | `sha512-eTgnZjZEGk1QtD3ZstF+Vclo2HLAni8YMy34/DxllwZvyz1lR/1RF/xTiAquOBO7MvqBx8D2Ig2WCPMVfdZu7Q==` |

The hub self-hosts the same three families, so this follows the `@fontsource` precedent
on provenance while keeping the satellite's own build what it is: a copy of `site/` with
no build step, no `package.json`, and no `node_modules`. Adding an npm dependency graph
to a repository that deliberately has none would have been the larger change.

**Faces: exactly the nine the CDN request asked for, and no more** — Spectral 400, 400
italic, 600, 700; IBM Plex Sans 400, 500, 600; IBM Plex Mono 400, 500. Two subsets each
(`latin`, `latin-ext`), with the upstream `unicode-range`, so a reader downloads
`latin-ext` only if a glyph actually needs it. See Open questions on whether you want
`latin-ext` at all.

---

## The working tree: the 14 modified files are a MODE delta

Recorded because the sprint record should carry the real cause rather than the first
guess. I verified it independently:

```
$ git diff --summary
 mode change 100644 => 100755 .github/workflows/ci.yml
 … 14 files, all the same
$ git diff --numstat      # only my 6 files have non-zero line counts
$ git ls-files -s | awk '{print $1}' | sort | uniq -c
     14 100644            # the index is clean and uniform
$ grep -c $'\r' README.md site/index.html
README.md:0
site/index.html:0         # so line endings cannot be the cause
```

It is **not** CRLF churn and a `.gitattributes` would do nothing about it. The cause is
`core.fileMode=true` in this checkout meeting `/mnt/c` (DrvFs), which reports every file
`0777`. STATE records (Chief Reviewer N-7) that the original commit was made with
`core.fileMode=false`.

**This matters for staging my work, not just for the 14.** The 23 new files were created
on the same mount and read `0777` too. With `core.fileMode=true` still set, `git add`
would record **every one of the 18 woff2 files and 3 licence files as `100755`**, and
flip the 14 existing files at the same time — including `README.md` and the four private
`docs/*.md`. This same wave has the `infra` stream building an executable-bit guard that
asserts every tracked shebang file is `100755`; a repository where every file is `100755`
would make that guard assert something true and meaningless.

**Intended mode for every file I added: `100644`.** None of them is a script; the
repository has no tracked `*.sh` at all (`git ls-files -s | grep '\.sh$'` → empty), so
the shebang rule has nothing to bite on here. The remedy is in Recommendations.

---

## The withdrawal proof (Item 2) — prepared, not executed

### The deliverable

`/mnt/c/code/phd-milestones/withdrawal-proof.patch` — untracked, 4,580 bytes, verified
with `git apply --check` (read-only) against the current working tree:

```
$ git apply --check --verbose withdrawal-proof.patch
Checking patch tools/generate-manifest.mjs...
Checking patch tools/generate-manifest.test.mjs...
→ applies cleanly
```

It touches **only** `tools/generate-manifest.mjs` and `tools/generate-manifest.test.mjs`.
It touches no page, no document and no workflow.

(`git apply --check -R` fails today, correctly: you cannot reverse a patch that has not
been applied. The reverse check succeeds once it is applied, which is the restore.)

I validated the withdrawn state end to end in an isolated copy of the repository under
the scratchpad — never in the real checkout:

```
$ node --test tools/*.test.mjs        → 23 passed, 0 failed
$ node tools/generate-manifest.mjs --dist dist
wrote dist/manifest.json (1 items, manifest_version 1)
  milestones  private  site/index.html  2026-09-10
$ ls dist/site/committee.html          → still there
$ node …/contract/validate-manifest.mjs --dist dist --source phd-milestones
  schema / paths / source: all passed
```

### 1. Which item, and why it is the safest choice

**Withdraw `committee-dossier`** (`site/committee.html`). Five reasons, in order of
weight:

1. **Its bytes are never at risk.** The destructive sync touches the *private bucket*
   only. `site/committee.html` stays in the content bucket under
   `sources/phd-milestones/` for the whole exercise, because a satellite cannot prune
   its own prefix (ADR-0007 decision 4) — the test suite asserts it is still staged into
   `dist/` after the withdrawal. So the only thing deleted anywhere is the hub's
   *rendered copy*, which the next build regenerates from a source that never moved. The
   worst realistic outcome is one document missing from the members' area for one build
   cycle. That is what makes this cheap enough to do deliberately.
2. **It keeps the proof on the default code path.** One of two items withdrawn leaves
   `privateItemCount: 1 > 0`, so P5 passes without `--allow-empty`. Withdrawing *both*
   would require that flag — and `--allow-empty` is precisely the flag that also
   suppresses the refusal a genuine build defect would trigger. A proof that has to
   disable a safety check to run is not proving the thing you care about.
3. **It is the item ADR-0010 decision 5 was actually written for.** The dossier assesses
   named people; a withdrawal that leaves it readable at its old path is "a privacy
   failure wearing the costume of a stale page". Proving the mechanism on the other item
   would prove the half nobody was worried about.
4. **`committee.html` is an unambiguous object name.** `milestones` maps to
   `site/index.html`, and `index.html` is a directory-index name: if the driver, the
   staging plan or the gate ever normalised `…/site/index.html` to `…/site/`, withdrawing
   `milestones` would give a confounded result you could argue about. With
   `committee.html` there is nothing to argue about — a surprising result is a defect.
5. **The failure stays legible.** The members' area keeps a landing item, so a correct
   run looks like "one document gone" and an over-deleting run looks like "the area is
   empty". Keeping those two visually distinct matters when the final check is a human
   opening a page.

### 2. The exact manifest diff

The manifest is **generated, never committed** (`dist/` is gitignored), so the withdrawal
is expressed in the generator's source. The substantive change is the removal of one
array entry:

```diff
 export const ITEMS = [
   { slug: "milestones", path: "site/index.html" },
-  { slug: "committee-dossier", path: "site/committee.html" },
+  // WITHDRAWN — committee-dossier (site/committee.html).
+  //  … (the patch carries the full rationale comment here) …
+  // { slug: "committee-dossier", path: "site/committee.html" },
 ];
```

Which produces, at `dist/manifest.json`:

```diff
   "source": "phd-milestones",
   "manifest_version": "1",
   "published": "…",
   "items": [
     { "slug": "milestones", … "visibility": "private" }
-    { "slug": "committee-dossier", "title": …, "section": "phd", "format": "html",
-      "path": "site/committee.html", "visibility": "private", "date": "2026-08-31" }
   ]
```

**An item removed from `items`. NOT a deleted manifest.** ADR-0010 decision 3 makes a
missing manifest a build **fault** precisely so a truncated upload can never be mistaken
for an intentional retraction, and `docs/satellites.md:160` tells satellite owners the
same thing. The manifest is still generated, still validated, still uploaded — it simply
lists one item.

The patch also updates three assertions in `tools/generate-manifest.test.mjs` (item count
2→1, the slug/path arrays, and the two-dates test). **This is not optional bookkeeping:**
`publish.yml` runs the test suite *before* it stages `dist/`, so a withdrawal that left
the tests asserting two items would fail CI, upload nothing, and the proof would never
reach the bucket at all. Both halves of the patch are load-bearing.

### 3. The exact objects the dry run must name

Object names in the private bucket are paths relative to `dist-private` (the gate strips
`/p/` to form the object name). Derived from `site/src-private/pages/[...itemPath].astro`
(`getStaticPaths`), `routeFor()`/`payloadUrlFor()`, and `stagingPlanFor()` in
`site/src-private/lib/private-content.mjs`.

**Withdrawing `committee-dossier` must cause the dry run to name exactly these two
objects, and no others:**

```
DELETE phd/phd-milestones/committee-dossier/index.html
DELETE _payload/phd-milestones/site/committee.html
```

- The first is the Astro route page. `getStaticPaths` builds its params from the private
  items in the collection; with the item gone from the manifest, the route is not
  emitted, so the sync finds it at the destination and not in the build.
- The second is the payload document, dropped by `stagingPlanFor()`'s document filter:
  *every file in the staged directory travels except an `.html`/`.htm` that no surviving
  item declares as its `path`*. That filter exists for exactly this case.

**And these must NOT appear in the delete list** — they are re-uploaded at the same names
(their contents change; their names do not):

```
index.html                                          the members' area index, one fewer entry
phd/phd-milestones/milestones/index.html            the surviving route, nav list changes
_payload/phd-milestones/site/index.html             still declared
_payload/phd-milestones/site/assets/style.css       shared, non-document
_payload/phd-milestones/site/assets/fonts.css       shared, non-document (new with H-5)
_payload/phd-milestones/site/assets/fonts/…         21 files: 18 woff2 + 3 OFL txt (new with H-5)
_astro/…                                            the hub's own private chrome
.hub-private-build.json                             the receipt; planSync() excludes it by name
```

**Expected destination inventory, for the P6 ratio.** Roughly 64 objects: 3 route pages,
25 payload files (2 documents + 23 assets after H-5), ~33 woff2 that the private chrome's
own six `@fontsource` imports emit into `_astro/`, plus a handful of `_astro` CSS/JS.
Deleting 2 of ~64 is **~3%**, comfortably under the 34% ceiling — the sync will not stop
on P6, and it *should* not. **Step 1 of the procedure records the exact count**, so you
do not have to trust my arithmetic.

### 4. The procedure

**Precondition — read this first.** The workflow runs the dry run and the apply as
consecutive steps of one job. Part C's "before the apply step runs" requires one of the
remedies in Recommendations first. Without one, do not expect to intervene; you will be
reading a record of a delete that already happened. (It is recoverable — versioning plus
7-day soft delete — but that is a different claim from the one you were asked to make.)

**Step 0 — flip `phd-milestones` to `required: true`** in `EXPECTED_SOURCES`
(`site/src/lib/hub-content.mjs`), already on the Checkpoint 4 list. Do it *before* the
proof: during the proof the prefix still exists (the manifest and every other file stay),
so `required: true` is safe, and it means a prefix that genuinely vanished mid-proof
would be caught instead of read as a withdrawal.

**Step 1 — the empty-bucket baseline.** After the first successful `private-sync`, open
that run's `Plan the private sync (dry run)` log and record:

- `sync-private: N object(s) to upload, 0 to DELETE` — **the delete list must be empty.**
  It ran against an empty bucket; there was nothing to prune.
- `N`, the full object count. This is your destination inventory, and the denominator for
  every ratio afterwards.
- The receipt line: `… 2 private item(s), … file(s)`.

Save the whole step log. **Step 1 on its own proves almost nothing** — a driver that can
*never* delete produces an identical empty list. That is exactly why the Chief Reviewer
ordered these two steps this way, and why step 2 is the one that carries the proof.

**Step 2 — the deliberate withdrawal.**

```bash
cd /mnt/c/code/phd-milestones
git checkout -b proof/withdraw-committee-dossier
git apply withdrawal-proof.patch
node --test tools/*.test.mjs                 # expect 23 passed
node tools/generate-manifest.mjs --dist dist # expect: 1 items, only `milestones`
git commit -am "withdraw committee-dossier — Part C withdrawal proof"
git push -u origin proof/withdraw-committee-dossier
```

Merge to `main` (publishing is on push to `main`). Then:

- `publish.yml` runs: the test suite passes, `dist/` is staged, the 1-item manifest is
  uploaded. **Confirm the log prints one item line, not two.** It prints slug,
  visibility, path and date only — never a title or any content.
- Wait for the hub's next build (hourly poll, or `workflow_dispatch` for "now").
- **Read `Plan the private sync (dry run)` before the apply.** It must print:

```
sync-private: 2 object(s) to DELETE
  DELETE _payload/phd-milestones/site/committee.html
  DELETE phd/phd-milestones/committee-dossier/index.html
```

Two lines. Those two names. Sorted as shown (`planSync` sorts). Anything else → §5.

**Step 3 — confirm the withdrawal is real, not merely unlinked.** Signed in as a member:

| URL | Expected |
|---|---|
| `/p/` | lists one item; the dossier is gone from the navigation |
| `/p/phd/phd-milestones/committee-dossier/` | **404** |
| `/p/_payload/phd-milestones/site/committee.html` | **404** ← the one that matters |
| `/p/phd/phd-milestones/milestones/` | 200, styled, fonts loading |

The third row is the whole of ADR-0010 decision 5. A 200 there with a 404 on the route
above it is "withdrawn from the index, still served at its old path" — the exact failure
the decision exists to prevent.

### 5. What result would mean the driver is WRONG

Stated as concretely as the success signature, because a proof that can only come out one
way proves nothing. **Two of these five look like success.**

**W1 — the delete list is EMPTY (`0 to DELETE`).**
The driver is not pruning. Either `bucketDriver.list()` returned nothing (the HTTP path
has never been run — `sync-private.mjs` says so in its own comments), or it returned
object names in a shape that does not match the build's relative paths, so
`planSync`'s set difference finds nothing to remove. Note the trap: `checkDeletionCeiling`
returns `{allowed: true, ratio: 0}` when the destination count is 0, so a driver whose
`list()` silently returns `[]` sails through every precondition and reports success.
**This is the failure that looks exactly like step 1's correct result.**
*Consequence:* the dossier stays readable at `/p/_payload/phd-milestones/site/committee.html`
to every member, indefinitely. *Do:* do not re-run hoping. Restore (§6), then fix
`list()` — compare the `upload` count in the log against the object count recorded in
step 1; if `list()` is broken they will not be consistent with a bucket that already
holds a build.

**W2 — the delete list has exactly 2 entries but they are the WRONG 2.**
Most plausible spelling: `_payload/phd-milestones/site/index.html` instead of
`committee.html`, which means `stagingPlanFor`'s document filter is inverted — it is
staging the withdrawn document and dropping the surviving one. **The count is right, so
a procedure that counted instead of reading names would pass this.** That is the entire
reason the expected objects are enumerated by name above.
*Consequence:* the withdrawn dossier keeps being served and the live tracker disappears —
the worst possible pair. *Do:* stop before apply if you can; otherwise restore
immediately and treat it as a `site`-stream defect in `private-content.mjs`.

**W3 — the delete list names anything beyond those two.** Classify it; do not wave it
through:

| Extra name | Meaning | Severity |
|---|---|---|
| `_payload/phd-milestones/site/assets/**` | shared assets being pruned with a withdrawn item — the staging plan is treating siblings as the item's own | real defect; the surviving page renders unstyled and fontless |
| `phd/phd-milestones/milestones/index.html` or `index.html` | the surviving item's route or the members' index being deleted | severe — the private area goes dark |
| `_payload/cv/**`, or any other source's prefix | cross-source deletion | **STOP. Nothing in this design should ever delete another source's objects.** |
| `.hub-private-build.json` | `planSync`'s explicit receipt exclusion has been changed | severe — the next sync loses its own gate |
| `_astro/<hash>.css` / `.js` / `.woff2` | hashed chrome assets churned | **benign only if** the same run's upload list contains a replacement `_astro/` file for each one. If a deletion has no matching new file, it is not churn. |

**W4 — the dry run THROWS P6** (`would delete N of M object(s) … exceeds the ceiling`).
Withdrawing one of two items should delete ~3% of the destination. A P6 refusal means the
build produced far less than it should have. **This is the ceiling doing its job — it is
the system working.** *Do:* **do not pass `--allow-prune-ratio`.** That flag exists for a
real mass withdrawal, and using it here would convert a caught defect into an executed
one. Restore, and find out why the build emitted so little.

**W5 — the apply step's delete count differs from the dry run's.**
The two steps run seconds apart in the same job against the same bucket, with no other
writer in the design. A difference means either the destination is being written by
something outside this pipeline, or the driver is not deterministic. *Do:* stop the
pipeline. Establish who else is writing to that bucket before running any further sync.

**Also treat as inconclusive, not as a pass:** a run that refuses at P1–P5. Those are
build-completeness gates, not driver verdicts. A P5 refusal in particular
(`the build produced 0 private item(s)`) is the shape STATE already recorded at
Checkpoint 4 and means the manifest never reached the hub — fix the publish, then start
the proof again at step 1.

**If any of W1–W5 occurs, what the Lead Architect should do:**

1. **Do not apply, and do not re-run the workflow to "see if it clears".** A second
   destructive run against a destination you no longer understand is how a recoverable
   problem becomes an unrecoverable one.
2. **Disable the apply** (the same one-line lever from Recommendations, or remove
   `vars.GCP_PRIVATE_BUCKET` to disable the whole job) so the hourly schedule does not
   run it again while you investigate.
3. **Restore the item (§6) first**, since that is a pure re-render and needs no
   understanding of the defect.
4. **Recover anything wrongly deleted from bucket versioning**, not from a rebuild —
   noncurrent generations are kept 30 days, and soft delete retains deleted generations
   7 days regardless of who deleted them (`infra/private-bucket.tf`). Recover *before*
   you re-run anything, because those windows are the only safety net ADR-0010's Risks
   section left you.
5. **Raise it against the `site` stream**, whose file `scripts/sync-private.mjs` is. W1
   and W5 are in the bucket driver's untested HTTP path; W2 and W3 are in
   `private-content.mjs`'s staging plan. The dangerous logic is shared with the local
   driver and is covered by `sync-private.test.ts`; the HTTP is what has never run.

### 6. Restore, and how to confirm the restore actually worked

```bash
git checkout proof/withdraw-committee-dossier
git apply -R withdrawal-proof.patch     # or: git revert the commit
node --test tools/*.test.mjs            # 23 passed, with the 2-item assertions back
node tools/generate-manifest.mjs --dist dist   # expect: 2 items
git commit -am "restore committee-dossier"
git push                                 # merge to main
```

**The restore is a re-render, not an undelete.** The dossier's bytes never left the
content bucket, which is why this item was the safe choice. Confirm all four:

1. **The satellite's publish log prints two item lines**, `milestones` and
   `committee-dossier`.
2. **The hub's next dry run prints `0 to DELETE`.** A restore only adds. If the restore
   run proposes *any* deletion, something is wrong with the restore, not with the
   withdrawal.
3. **The build receipt** (`.hub-private-build.json`, visible in the private build's log)
   records `privateItemCount: 2` and
   `items: ["phd-milestones/committee-dossier", "phd-milestones/milestones"]`.
4. **The member view, which is the only one that proves serving:**
   `/p/phd/phd-milestones/committee-dossier/` → 200, and
   `/p/_payload/phd-milestones/site/committee.html` → 200 and correctly styled. A 200 on
   the route with a 404 on the payload means the page is back in the index but its bytes
   did not re-stage — the mirror image of the withdrawal bug, and just as invisible from
   the index page alone.

Then **delete the proof branch** and confirm `withdrawal-proof.patch` was never committed.

---

## Assumptions

1. **The 14 modified tracked files are a mode delta, not content**, and are none of my
   doing. Verified three ways (§The working tree). Corrected from the initial
   line-endings diagnosis; a `.gitattributes` would not address it.
2. **`_astro/` asset hashes are stable across an item withdrawal.** Astro/Vite hash
   bundles from component source, and withdrawing an item changes page *content*, not
   component code. I could not verify by running the hub's private build — I am read-only
   in the hub and the build writes `site/dist-private`. If the assumption is wrong you
   will see `_astro/` names in the step-2 delete list; W3's last row tells you how to
   classify them, so the procedure is safe either way.
3. **The private bucket currently holds exactly one build's output and nothing else.**
   `infra/private-bucket.tf` states the sync owns the whole bucket with no prefixes and a
   single tenant.
4. **`site/index.html`'s inline script makes no network request.** Checked for `fetch`,
   `XMLHttpRequest`, dynamic `import()` and `src` — none. The new guard covers the static
   surface only; see Risks.
5. **`latin` and `latin-ext` are the only subsets these pages need.** The pages' actual
   non-ASCII inventory today is two characters, `·` (U+00B7) and `—` (U+2014), both in
   `latin`. `latin-ext` is insurance, not a current requirement — see Open questions.
6. The hub's `contract/validate-manifest.mjs`, which I ran read-only against the
   satellite's `dist/`, is the same validator `contract/publish` runs.

---

## Recommendations

1. **Before staging anything, set `git config core.fileMode false` in
   `/mnt/c/code/phd-milestones`.** Without it, `git add` records all 21 new font and
   licence files as `100755` and flips the 14 existing files at the same time, including
   `README.md` and the four private `docs/*.md`. Afterwards verify with
   `git ls-files -s | awk '{print $1}' | sort | uniq -c` — it should stay uniformly
   `100644` across every tracked file. Never use `ls -l` on this mount.
2. **Do not commit `withdrawal-proof.patch` with the H-5 change.** It is untracked and
   belongs to a separate, deliberate branch. Consider deleting it once the proof is done
   rather than leaving a withdrawal sitting in the tree.
3. **Make Part C's "before the apply" achievable before you run it.** Cheapest fix, one
   line in `build.yml`, on the apply step only:

   ```yaml
   - name: Sync the private output, pruning what this build did not produce
     if: vars.PRIVATE_SYNC_PLAN_ONLY != 'true'
   ```

   Set the variable for the withdrawal run, read the plan, unset it, re-run. The cleaner
   long-term shape is to split `private-sync` into a plan job and an apply job, with the
   apply bound to a GitHub Environment carrying a required reviewer — which is also how
   you would want a mass withdrawal to behave forever. `build.yml` is the `site` stream's
   file, so this is a recommendation, not something I changed.
4. **Add a `Content-Security-Policy` on `/p/**` from the gate.** My build-time guard is a
   static scanner; a CSP with `default-src 'self'` would make the no-third-party property
   hold against anything constructed at runtime, and would turn a future regression into
   a browser-side refusal rather than a silent request. The gate's file, not mine.
5. **Promote "a private item loads no off-origin subresource" into the publishing
   contract.** Nothing in `contract/` or `docs/satellites.md` says it today, so the next
   private satellite will reproduce H-5 exactly. The publish action already validates the
   manifest before minting a credential; this is the same shape of check.
6. **Add the missing sentence to `docs/satellites.md`** next to the existing withdrawal
   guidance: a private item's page must serve its own fonts, scripts and images, because
   behind the gate a third-party subresource discloses the reader's IP and the private URL.
7. **Flip `phd-milestones` to `required: true` before running the proof**, not after
   (Step 0 above).
8. **When you next touch `ci.yml`, implement review recommendation 5** (the secret and
   large-binary scan). This change adds 18 binaries; an allowlist for
   `site/assets/fonts/*.woff2` is the natural place to encode "these binaries are
   expected, anything else is not".

---

## Alternatives considered

**For H-5:**

- **Add `@fontsource` as an npm dependency and a build step.** Closest to the hub's
  precedent. Rejected: it gives a repository that deliberately has no `package.json`, no
  lockfile and no build a dependency graph, a `node_modules`, and a new failure mode —
  to solve a problem that copying 18 files solves. The contract said to follow the
  precedent *where it fits*; the provenance half fits and the toolchain half does not.
- **Drop webfonts entirely for a system font stack.** Zero bytes, zero requests, and it
  would have satisfied the privacy requirement completely. Rejected as exceeding
  "change the seed content as little as possible": it changes how both documents look,
  which is a design decision belonging to the owner, not a privacy fix.
- **Self-host only `latin`.** 9 files, ~183 KB, and sufficient for every glyph currently
  on either page. Rejected by a narrow margin — see Open questions; it is a one-command
  reversal if you prefer it.
- **Inline the `@font-face` rules into `site/assets/style.css`.** One fewer request and
  one fewer file. Rejected because it would have meant editing the seed stylesheet, which
  is now untouched; a separate `fonts.css` keeps the seed diff to two `<link>` lines.
- **`<link rel="preconnect">` or a self-hosted proxy.** Rejected: both still involve a
  third party learning something. The requirement was that no request leaves the origin.

**For the withdrawal proof:**

- **Withdraw `milestones` instead.** Rejected for reason 4 above — `index.html` is a
  directory-index name, and an ambiguous object name is the wrong thing to build a proof
  on.
- **Withdraw both items (empty `items`).** This is the ADR-0010 decision 2 case and it is
  legitimate, but it requires `--allow-empty`, which disables the P5 refusal that would
  otherwise catch a build defect. Rejected: a proof should not need a safety flag off.
- **Delete `dist/manifest.json` to withdraw.** Rejected — it is a build *fault* by
  ADR-0010 decision 3, and would prove the opposite of what is being tested.
- **Prove it against a scratch bucket first.** Attractive, and rejected: it is a cloud
  mutation I am forbidden to make, and a scratch bucket would not exercise the IAM
  binding, the WIF exchange or the real object names, which is where W1 lives.
- **Test the bucket driver with a local HTTP stub.** Genuinely useful and worth doing as
  a `site`-stream unit test, but it would not have proved the live thing either; the
  Chief Reviewer asked for the first real run precisely because the HTTP path has never
  executed.

---

## Risks

1. **The dry run and the apply are not separated** (finding above). Until they are,
   Part C's "before the apply" is unachievable and every proof is retrospective.
   Recoverable via versioning and 7-day soft delete, but that is a recovery story, not
   the assurance that was asked for.
2. **The bucket driver's HTTP path has still never executed.** `sync-private.mjs` says so
   in its own comments. Everything above is a plan for its first run; W1 is the specific
   way a never-run `list()` fails while reporting success.
3. **The new guard is a scanner, not a parser.** It will not catch a URL assembled at
   runtime by script, an unquoted attribute, or a `<meta http-equiv="refresh">` target. A
   CSP is the correct complement (Recommendation 4).
4. **374 KB of new binaries in a repository with no binary scan.** Not a leak — every
   file's provenance is pinned to a hash that matches the hub's lockfile — but it is a
   material change to what this repository contains, and the CI check that would notice
   an *unexpected* binary does not exist yet.
5. **`latin-ext` is currently unused.** If a reviewer measures the change by bytes, ~154 KB
   of it is insurance against content that does not exist yet.
6. **The mode delta could still be committed by accident**, which would poison the
   executable-bit guard the `infra` stream is building in this same wave (§The working
   tree).
7. **Both published pages still cross-link to each other.** After a withdrawal, the
   surviving page's link to the withdrawn one 404s inside the payload frame. That is
   correct behaviour — the withdrawn document must not be served — but it is a visible
   rough edge a member will see, and it is worth expecting rather than diagnosing.
8. **This work changes what the private sync uploads.** After H-5, the payload carries 22
   more files per build. That is why the expected destination inventory in §3 is ~64 and
   not ~42, and why step 1's recorded baseline matters more than my estimate.

---

## Open questions

1. **Keep `latin-ext`?** It is ~154 KB of the 374 KB and covers no glyph on either page
   today. It exists because these documents carry people's names, and a name with a
   Central or Eastern European diacritic would otherwise drop out of the typeface
   mid-word. *Evidence that settles it:* whether any name in the dossier, present or
   expected, needs a codepoint above U+00FF. I did not read the content to find out —
   I checked mechanically that the current non-ASCII inventory is `·` and `—`. Removing
   it is deleting 8 files and 8 `@font-face` blocks.
2. **Are `_astro/` asset hashes stable across a withdrawal?** (Assumption 2.) *Evidence:*
   step 1's baseline object list against step 2's delete list. One run settles it, and
   the procedure is safe whichever way it goes.
3. **Should `withdrawal-proof.patch` live in the repository at all?** It is untracked by
   design. A patch that withdraws private content is a slightly odd thing to leave lying
   in a working tree. *Settled by:* your preference — the alternative is that it lives
   only in this handoff, which is in the hub.
4. **Does the owner want the two pages' outbound VT policy links to stay?** They are
   reader-initiated and disclose nothing until clicked, and I left them untouched. But a
   click from a private page does send that page's URL as the `Referer` to a VT host
   unless the page sets a referrer policy. *Evidence:* whether the owner considers a VT
   host learning a `jason.cusati.us/p/...` URL a concern. A one-line
   `<meta name="referrer" content="no-referrer">` would close it, at the cost of a third
   seed-content line. I did not add it — it is beyond H-5 as scoped.
5. **Should the generator's off-origin guard fail on `<a href>` too, behind a flag?** For
   a public site, no. For a repository all of whose items are private, the answer is less
   obvious.

---

## Related docs

- `llm/governance/adr/0010-withdrawal-semantics.md` — decisions 1, 2, 3, 5; the Risks
  section naming the destructive sync as the one place a build defect can remove data
- `llm/governance/adr/0007-hub-polls-content-bucket-no-satellite-github-credential.md` —
  decisions 2 and 4: no GitHub credential, no `storage.objects.list`, and therefore
  "a satellite cannot prune"
- `llm/sprints/2026-09-hub/contracts/phase-3-seams.md` — SEAM-5 (destructive withdrawal),
  SEAM-7 (what `phd-milestones` publishes), SEAM-8, SEAM-9
- `llm/sprints/2026-09-hub/STATE.md` — §Follow-ups (H-5, Part C), §Checkpoint 4 execution
  record (the satellite's first successful publish; `private-sync`'s correct P5 refusal),
  §Incident A1, §Standing constraints
- `llm/sprints/2026-09-hub/handoffs/chief-reviewer-phase-3.md` — N-7 (`core.fileMode`),
  N-8 (H-5)
- `contract/README.md` — the publishing contract; the `list` prohibition; "It never
  deletes"
- `docs/satellites.md` §Withdrawing something you published — the owner-facing statement
  that withdrawal does not delete a satellite's bytes
- `site/scripts/sync-private.mjs`, `site/src-private/lib/private-content.mjs`,
  `.github/workflows/build.yml` §`private-sync` — the mechanism this proof tests
- In the satellite: `docs/hub-publishing.md`, `tools/generate-manifest.mjs`,
  `withdrawal-proof.patch`

---

## ADR candidates

1. **A private item serves every subresource from its own origin.** H-5 was found,
   documented, and left true for a phase because no rule made it a defect. Behind a gate,
   a third-party subresource discloses the reader's IP and the private URL in the
   `Referer` — a property of the *contract*, not of one satellite's taste. The decision
   worth recording is whether this becomes a contract rule enforced by
   `contract/publish` for `visibility: private` items, or stays a satellite-local habit
   that the next private satellite will not inherit. (Recommendations 5 and 6.)
2. **A destructive sync whose plan deletes anything requires a human acknowledgement
   before it applies.** Today the ceiling (P6) is the only thing between a build defect
   and a delete, and it is a *proportion*, which cannot distinguish a correct small
   withdrawal from an incorrect small one. The decision: does a non-empty delete list gate
   on a human, always, or only above some size — and is that a workflow-level environment
   gate or a flag in the script?
3. **`format: html` should declare its asset set.** The `site` stream already raised this
   as a residual: `stagingPlanFor` cannot tell a withdrawn item's private assets from
   shared ones, so it keeps everything. H-5 sharpens it — the payload now carries 21
   asset files that belong to both items jointly, and the only reason the withdrawal in
   §3 is cleanly enumerable is that the withdrawn item owns no asset of its own. The next
   item that does will make this ambiguity load-bearing.
4. **Where a satellite's vendored third-party binaries come from, and how that is
   verified.** This repository now carries 18 font binaries. Today their provenance lives
   in a comment in `fonts.css` (package, version, sha512 matching the hub's lockfile).
   That is a convention, not a decision, and nothing checks it on a future update.
