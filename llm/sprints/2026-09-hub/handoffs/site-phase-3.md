# Handoff: Site Implementation Engineer — Phase 3

Status: Complete
Last updated: 2026-09-17
Owner: Site Implementation Engineer (Specialist 3)
Contract: `llm/sprints/2026-09-hub/contracts/site-phase-3.md`
Seams: `llm/sprints/2026-09-hub/contracts/phase-3-seams.md` — SEAM-2, SEAM-4, SEAM-5, SEAM-6, SEAM-8, SEAM-9

---

## Summary

One source tree now produces two outputs. The public one provably contains no private
item; the private one contains the private items, the navigation that reaches them, and
the payload bytes the gate serves. A member can sign in at `/signin`.

| Deliverable | File | What it does |
|---|---|---|
| D1 | `site/astro.config.mjs`, `site/scripts/site-output.mjs` | `HUB_OUTPUT=public\|private`; unset stays public |
| D2 | `site/scripts/check-no-private-in-public.mjs` | the leak check — paths **and** file contents |
| D3 | `site/scripts/demo-leak-check.mjs` | `npm run demo:leak-check` — the guard, shown failing |
| D4 | `site/scripts/sync-private.mjs` | the destructive private sync, behind six preconditions |
| D5 | `site/src/lib/hub-content.mjs` | `EXPECTED_SOURCES`, closing C27 |
| D6 | `site/src/pages/signin/index.astro` | public sign-in page, posts the ID token to `POST /session` |
| D7 | `site/src/content.config.ts` | `manifest_version` mirrored field for field (ADR-0009) |
| D8 | `.github/workflows/build.yml` | both builds, leak check between build and deploy, private sync |
| D9 | this file | |

**The public build's behaviour did not change.** Every HTML, XML, CSS, JS and text file
that existed before is byte-identical; `/signin/` and its code-split bundle are the only
additions. Evidence in §Validation.

### The one design idea

The two outputs use **different `srcDir`s**. Astro routes exactly one directory —
`<srcDir>/pages` — so the public build (`./src`) is never shown the private routes and
*cannot* emit them, and the private build (`./src-private`) never routes the public pages.

```
                          src/content/sources/**  (synced, validated once)
                                     │
                 ┌───────────────────┴───────────────────┐
      HUB_OUTPUT=public                          HUB_OUTPUT=private
      srcDir ./src                               srcDir ./src-private
             │                                              │
      site/dist-public                            site/dist-private
             │                                              │
      leak check  ──fails the build on any trace──▶  (blocks deploy AND sync)
             │                                              │
   Hosting + GitHub Pages                    destructive sync ▶ private bucket ▶ gate /p/**
```

There is still **one** content collection and **one** Zod mirror of the manifest schema:
`src-private/content.config.ts` re-exports `src/content.config.ts`.

---

## Which routes exist in which output

**`dist-public`** — deployed to Firebase Hosting and GitHub Pages. 164 files.

| Route | Note |
|---|---|
| `/`, `/cv/`, `/cv/<variant>/` ×4, `/papers/`, `/projects/`, `/projects/<slug>/` ×12 | unchanged from Phase 2 |
| `/research/…` (9 pages), `/resumes/`, `/writing/`, `/email/`, `/privacy/` | unchanged from Phase 2 |
| `/phd/` | still the empty shell: noindex, unlinked, out of the sitemap |
| `/robots.txt`, `/sitemap-index.xml`, `/sitemap-0.xml`, `/pdfs/<variant>.pdf` ×4 | unchanged |
| 4 legacy redirect pages | unchanged |
| **`/signin/`** | **the only added route.** noindex, excluded from the sitemap |

**No public route names, links or lists a private item.** `/phd/` remains empty; private
items are not in the sitemap, not in the navigation, and not in any index.

**`dist-private`** — synced to the private bucket, served by the gate under `/p/**`. 81
files. Exactly:

| Path in `dist-private` | Served as | What it is |
|---|---|---|
| `index.html` | `/p/` | the private navigation — the only page that lists private items |
| `phd/phd-milestones/milestones/index.html` | `/p/phd/phd-milestones/milestones/` | item frame + back link |
| `phd/phd-milestones/committee-dossier/index.html` | `/p/phd/phd-milestones/committee-dossier/` | item frame + back link |
| `_payload/phd-milestones/site/index.html` | `/p/_payload/…` | the tracker's own bytes, verbatim |
| `_payload/phd-milestones/site/committee.html` | `/p/_payload/…` | the dossier's own bytes, verbatim |
| `_payload/phd-milestones/site/assets/style.css` | `/p/_payload/…` | the sibling stylesheet both pages load |
| `_astro/**` (68 font/CSS files), `favicon.*`, `pdfs/**`, `photo_jason_1.jpeg` | `/p/…` | chrome, from `publicDir` |
| `.hub-private-build.json` | not served | the build receipt the sync requires |

Routes and payload paths above are **from the committed offline fixture**, which uses the
real slugs from SEAM-7 and invented titles. The real titles arrive from `phd-milestones`
at Checkpoint 4; the shape does not change.

**Gate compatibility (SD-7).** Every one of the 80 emitted path segments matches the
gate's allowlist `[A-Za-z0-9._-]`, verified mechanically. The private build now **fails**
if any emitted segment falls outside it — see §Recommendations.

---

## Validation

Run from `site/` unless stated. Verbatim output is in the final report; results here.

| Check | Result |
|---|---|
| `npm test` | **14 files, 177 passed, 1 skipped** (was 9 files / 103 passed) |
| `npm run build:public` | exit 0 — 36 pages (35 + `/signin/`) |
| `npm run build:private` | exit 0 — 3 pages, 3 payload files, receipt written |
| `npm run check:smoke-routes` | exit 0 — all 7 present, list unchanged |
| `npm run redirects:check` | exit 0 — 51 routes, 51 entries |
| `npm run check:no-private-in-public` (clean, private items present) | **PASS**, 155 files scanned, 2 private items |
| `npm run demo:leak-check` | **the check failed with 9 leaks, as intended** |
| `actionlint` on `build.yml` (container) | exit 0 |
| YAML parse of `build.yml` | parsed; 12 jobs |
| `git ls-files -s` on every `*.sh` | all three pre-existing, all `100755`. **I added no `*.sh`** |

### The public build is unchanged

A full SHA-256 inventory of `dist-public` was taken **before any edit** and compared after.

- **Changed:** nothing. Every pre-existing HTML, XML, CSS, JS and text file is
  byte-identical, `sitemap-0.xml` and `robots.txt` included.
- **Added:** `signin/index.html` and four `_astro/*.js` chunks — the Firebase Auth bundle,
  code-split so only `/signin/` loads it.
- The four `pdfs/*.pdf` and `photo_jason_1.jpeg` differ, and **this is pre-existing local
  drift, not a code change**: they are staged verbatim from the synced `cv` payload by
  Phase 2's `stage-public-assets.mjs`. The checkout's `public/` had gone stale relative to
  `src/content/sources/cv/`; re-running the staging step made them match the payload again,
  which is what CI does on every run. No code I touched affects their bytes.

### The leak check, shown failing (D3)

`npm run demo:leak-check` copies the real `dist-public` to a scratch directory, injects a
private item two ways, runs the real check against the copy, and removes the copy. It
never touches the real output, and it exits 0 only when the check **failed**.

Injected: a title+link into `index.html` (contents), and a page at the item's own route
(path). The check found **9 leaks** and exited 1. Five were in `index.html` **with no
matching path at all** — `qualified-id`, `slug`, `route`, `source` and `title`. That is
precisely the class the orchestration brief's path-only formulation would have missed, and
why ADR-0005 overruled it (K11).

**To reproduce both runs, with no credentials and no cloud access** (from `site/`):

```sh
npm run content:fixture          # publishes the two committed PRIVATE fixture items
npm run build:public
npm run check:no-private-in-public   # PASS  — exit 0, 2 private items, 155 files scanned
npm run demo:leak-check              # FAILS — exit 0 only because the check exited 1
npm run build:private                # 3 routes, 3 payload files, receipt, SD-7 check
```

`npm run content:fixture` is required first: without it no private item is published, the
needle set is empty, and both the check and the demo say so rather than passing quietly.
The demo works on a throwaway copy and never modifies `dist-public`.

---

## Assumptions

1. **No cloud resource was touched.** The private bucket does not exist and no credential
   exists. The sync's destructive behaviour is exercised against a **local fixture
   destination**; the bucket driver shares every decision but its HTTP is unexercised.
2. `phd-milestones` publishes the two items SEAM-7 names, at those slugs and paths, both
   `visibility: private`. The committed fixture models that.
3. The gate serves `dist-private` under `/p/**` preserving path structure, so `/p/` is the
   private index and `/p/<section>/<source>/<slug>/` an item.
4. `vars.GCP_PRIVATE_BUCKET` is the variable name for the private bucket. **It does not
   exist yet** — see §Open questions for the infra stream.
5. Firebase Web config arrives as `PUBLIC_FIREBASE_*` build variables at Checkpoint 4.
   Unset, `/signin` renders a plain "not available yet" state and posts nothing.

---

## Recommendations

1. **Flip `phd-milestones` to `required: true`** in `EXPECTED_SOURCES`
   (`site/src/lib/hub-content.mjs`) once it has published successfully. It is declared but
   not yet required, because it cannot publish until Checkpoint 4 and a guard that fails
   every build until then would simply be deleted. The line is marked
   `>>> CHECKPOINT 4 ACTION`.
2. **Set `vars.GCP_PRIVATE_BUCKET`** alongside the existing variables. Until it is set,
   `private-sync` is skipped and everything else behaves exactly as today.
3. **Land the `/p/**` and `/session` rewrites in the follow-up PR**, after the gate is
   deployed. They are deliberately absent here (SEAM-6). `/signin` is inert until then.
4. **Keep the deletion ceiling.** It will eventually block a legitimate mass withdrawal and
   require `--allow-prune-ratio`. That is the intended cost.
5. **Re-run `npm run demo:leak-check` whenever the leak check changes.** A guard never seen
   to fail is not known to work.

---

## Alternatives considered

**One `pages` tree with `HUB_OUTPUT` guards inside each page.** Rejected. It keeps the
private page modules inside the public build and makes the guarantee depend on every guard
being right forever. The contract asked for a structural guarantee, not a convention.

**`injectRoute` from an integration.** Workable, and it keeps one `srcDir`. Rejected
because the public pages would then also be built into `dist-private`, putting a second
copy of the whole public site in the private bucket and inflating the deletion ceiling's
denominator. Different `srcDir`s solve both directions at once.

**Matching bare slugs anywhere in file contents.** Rejected, and this one matters: the
clean public build already contains the sentence *"…tech-tree milestones up to 15.3x faster
than prior SOTA"*, and the private slug is `milestones`. A naive substring search **fails a
correct build**, and a guard that cries wolf is switched off within a week. Slugs are
matched only when delimiter-bounded on both sides; titles and summaries are matched exactly.
The real sentence is pinned as a regression test.

**Loading the Firebase SDK from `gstatic`.** Rejected. This site self-hosts everything it
loads (`Base.astro`: "nothing loads from a CDN"), and a sign-in page is the last place to
add a third-party origin. It is an npm dependency, bundled and code-split.

**Copying only the file named in an item's `path`.** Rejected — see §Risks.

---

## Risks

1. **The destructive sync is the sharpest tool here.** Mitigated by six preconditions, a
   deletion ceiling, dry-run-by-default, upload-before-delete, and a build receipt written
   only after a fully successful build. Its bucket driver has never been run.
2. **The leak check is necessary, not sufficient** (ADR-0005 Risks). Binary files are
   matched by path only, so a private title baked into an OG image would pass. Private text
   quoted without its slug, title or summary would pass. A slug in prose is deliberately not
   a match. The bucket IAM test is the other half and neither is sufficient alone.
3. **The clean-build pass proves nothing until `phd-milestones` publishes.** With no private
   items the needle set is empty. The check says so loudly rather than printing a reassuring
   "passed", and the committed fixture is what makes the local run meaningful.
4. **`dist-private` carries `publicDir`** — favicons, fonts and the four public CV PDFs.
   Harmless (they are public bytes in a private bucket) and it keeps the private pages
   styled, but it is ~70 files of noise. Deliberate; noted as an ADR candidate.
5. **A withdrawn item's non-document assets may still be staged.** The staging plan takes an
   `html` item's containing directory minus any `.html` no surviving item declares, so a
   withdrawn *page* never travels — but an image only it used is indistinguishable from a
   shared one. It carries no item prose.
6. **`/signin` ships the Firebase Auth bundle** — four JS chunks on one public route. No
   other public page loads them.

---

## Open questions — answered

### (a) Where should the private build's navigation live?

**In a separate source root, `site/src-private/`, selected by `srcDir` in
`astro.config.mjs`.** Astro routes exactly one directory, `<srcDir>/pages`. The public
build's `srcDir` is `./src`, so the private routes are never shown to its router: it cannot
emit them, however badly someone edits a page. This is a property of the build's inputs, not
of a filter someone has to remember.

Three things make it a guarantee rather than a gesture:

1. **The router never sees the files.** Not "does not render them" — is never given them.
2. **The import direction is one-way and asserted.**
   `site/scripts/private-structure.test.ts` fails if any file under `src/` imports
   `src-private/`, `private-content`, `private-build` or `PrivateBase`. Without it a public
   page could pull private titles in through the module graph rather than the router. Every
   private module lives under `src-private/`, including the one that decides an item's URL.
3. **The derived outputs follow.** The sitemap and the legacy redirects are public-only in
   the config, so no private URL can reach a sitemap.

The residual is one line of config. That is the smallest reviewable surface I could reduce
it to, and it is pinned by a test.

**ADR candidate:** "Private routes live in a separate source root" — the decision, the
one-way import rule, and why a guard inside a shared page tree was rejected.

### (b) What further precondition before the sync deletes anything?

Beyond a successful build, I require **four**, and the two that matter most are:

**A build receipt, written last.** `.hub-private-build.json` is written at the very end of
`astro:build:done`, after the payload staging and the SD-7 path check. The sync refuses to
run without it. This converts ADR-0010 decision 3 from an assumption into evidence: a build
that threw part way leaves files but no receipt, and an artifact assembled by anything other
than a real private build has no receipt either. The receipt also records the file count,
and the sync refuses if the output no longer matches it — catching a truncated artifact
download between build and sync.

**A deletion ceiling — the answer I would insist on.** The sync refuses if it would delete
more than **34%** of the objects currently at the destination, unless a human passes
`--allow-prune-ratio`. This is the only precondition that distinguishes the two failure
modes by their *shape* rather than by trusting an upstream step:

> Withdrawing one dossier deletes a handful of objects. A build defect deletes nearly all of
> them. Every other check asks "did the build succeed?", and a build that renders zero items
> because a manifest silently became empty **succeeds**. Proportion is the only signal that
> separates a withdrawal from a catastrophe, and it is cheap.

The other two: the receipt must say `output: "private"` (a public build can never authorise
a delete against the private bucket), and the build must have rendered at least one private
item unless `--allow-empty` is passed explicitly — an empty private area is legitimate
(ADR-0010 decision 2) but indistinguishable from a defect, so a human says so.

Two further properties, not preconditions but part of the same argument: the sync is
**dry-run by default**, and it **uploads before deleting**, so an interrupted run leaves the
destination a superset of the truth rather than a subset. A stale extra object is a bug; a
missing one is an outage.

**ADR candidate:** "The private sync's preconditions and deletion ceiling", including the
34% figure and whether `dist-private` should be content-addressed so a withdrawal is
provable.

---

## Defects reported, not fixed

1. **`contract/manifest.schema.json` is correct and needs no change** — ADR-0009 landed
   before I started. The Zod mirror now matches it field for field, and a test asserts the
   `manifest_version` pattern is character-identical. **No seam defect.** One note: before
   this change the mirror rejected `contract/examples/invalid/manifest-version-not-an-integer.json`
   only because `manifest_version` was an *unknown field* — an accident that would have
   vanished the moment the field was mirrored. It is now rejected by the pattern, and that
   distinction is asserted.
2. **ADR-0010 decision 4 is unimplementable as literally written** (see §Recommendations 1).
   Requiring `phd-milestones` immediately would fail every build from the day it lands.
   Resolved with a `required` flag; the ADR text may want a sentence.
3. **`docs/satellites.md` does not state ADR-0010's satellite-owner obligation** — that
   withdrawal removes an item from the site but not from the content bucket, and genuinely
   sensitive material must also be deleted by the satellite. ADR-0010's Consequences says it
   is "stated in `docs/satellites.md` rather than assumed"; it is not there. `docs/` is not
   mine.
4. **SD-7 was undocumented** — the gate's `/p/` path allowlist appears in no contract, seam
   or ADR. Reported by the gate stream mid-task and now enforced at build time. Worth a line
   in SEAM-1 or SEAM-4.
5. **`stage-public-assets.mjs` was safe only by accident.** `publicAssetPathFor()` returned
   non-null only for `source === "cv" && format === "pdf"`, so a private item could not be
   staged into `public/` — but nothing asked about *visibility*. That made a privacy
   guarantee depend on which satellites happened to exist. It now checks
   `visibility === "public"` first. This is in my scope and is **fixed**, not just reported.

---

## Related documents

- `llm/governance/adr/0004` (the `__session` constraint), `0005` (two outputs + leak check),
  `0009` (`manifest_version`), `0010` (withdrawal semantics)
- `llm/sprints/2026-09-hub/contracts/phase-3-seams.md` — SEAM-1 (as amended 2026-09-17,
  which makes `hub-deploy` a second principal on the private bucket and so makes the
  destructive sync implementable), SEAM-2, SEAM-4, SEAM-5, SEAM-6
- `llm/specs/2026-09-10-research-hub-design.md` §5, §6, §9, §12.1
- `llm/master-roadmap.md` §phase-3-private-area
- `llm/sprints/2026-09-hub/handoffs/site-phase-2.md` — the machinery this extends

## ADR candidates

1. **Private routes live in a separate source root** (open question (a)).
2. **The private sync's preconditions and deletion ceiling** (open question (b)), including
   whether `dist-private` should be content-addressed so a withdrawal is provable.
3. **The leak check's matching rules** — ADR-0005 Risks explicitly defers this to Phase 3.
   The needle set, bounded-vs-exact matching, the prose exclusion and the stated limits are
   implemented and documented in the script; they deserve the ADR.
4. **`format: html` should declare its asset set.** Nothing in the manifest names the sibling
   stylesheet; it arrives only because the publish action uploads all of `dist/`. Staging
   currently infers it from the containing directory. The satellite stream raises the same
   ambiguity.
5. **Whether `dist-private` should carry `publicDir`** (§Risks 4).
