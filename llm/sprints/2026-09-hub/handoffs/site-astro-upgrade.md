# Handoff — `site`, Astro 6 → 7 supply-chain upgrade

Stream: `site` (Wave 0, supply-chain blocker)
Issue: #44 (hub-007); closes the `astro`/`sharp` half of #56 and Security check 6
Date: 2026-09-21
Base commit: `ab70dde` on `feat/site-wave-0`
Files changed: `site/package.json`, `site/package-lock.json` — and this handoff

---

## Verdict

**`astro` `^6.4.8` → `^7.3.3`. `npm audit` goes 3 → 0. Every check that was green is still
green, every guard that must go red still goes red, and both outputs build.**

The critical AVIF RCE (`GHSA-26w7-cxv4-gfx2`) and the base-path authorization bypass
(`GHSA-376h-93r7-7g6f`) are **fixed, not accepted**. So is the `sharp` high. Nothing is left
to accept, so there is no acceptance table in this handoff — which is the outcome the earlier
deferral was explicitly trading against.

Astro 7 is a major, and I read its changelog against the four behaviours this repo depends on.
**One of them genuinely changed: `base` path handling — and the change *is* the advisory fix.**
That is reported in full in §5 rather than waved through, because it is the behaviour ADR-0011's
privacy boundary is built on.

---

## 0. Read this first — the worktree's `site/` is NOT the branch's `site/`

The worktree is on `admin/wave-0-preconditions`, and **its `site/` tree is at the pre-`ab70dde`
state**: `astro ^6.1.7`, `js-yaml ^4.1.1`, `vitest ^4.1.4`, and `npm audit` there reports the
old **17** findings. `site/scripts/check-private-links.test.ts`, `site/src-private/lib/signout.mjs`
and `signout.test.ts` do not exist in it at all.

```
$ git diff --stat feat/site-wave-0 -- site/
 15 files changed, 384 insertions(+), 1589 deletions(-)
$ npm audit            # worktree site/, before I touched anything
 17 vulnerabilities (1 low, 6 moderate, 9 high, 1 critical)
```

So **all work was done against a materialized copy of `ab70dde`**, not against the worktree:

```
$ git archive feat/site-wave-0 | tar -x -C <scratch>/base     # whole repo, so contract/ is a real sibling
$ git rev-parse feat/site-wave-0
ab70ddeb7424eb20ceb089a9797c684251488ef8
```

Extracting the **whole repo** rather than `site/` alone is what makes `src/content.config.test.ts`
runnable — it reads `../contract/manifest.schema.json`. That is the single test the previous
stream's scratch trial could not run, and it is the seam a framework major is most likely to
disturb. It ran here, all 56 cases (§6, §7).

**No branch was checked out. No git, `gh` or cloud mutation was made.** `git rev-parse --abbrev-ref HEAD`
is still `admin/wave-0-preconditions`.

> **Where the two changed files belong.** `site/package.json` and `site/package-lock.json` in the
> worktree now hold the **`ab70dde`-based** upgraded versions — i.e. `ab70dde`'s dependency set
> (`js-yaml ^4.3.2`, `vitest ^4.1.11`) **plus** `astro ^7.3.3`. They are the artefact of this work
> and they belong on **`feat/site-wave-0`**, not on `admin/wave-0-preconditions`. I could not commit
> them anywhere (no git mutations), so they are applied in place and flagged here. The rest of the
> worktree's `site/` tree is still the older state and was not touched.

---

## 1. The upgrade

```diff
--- a/site/package.json
+++ b/site/package.json
-    "astro": "^6.4.8",
+    "astro": "^7.3.3",
```

One line. `7.3.3` is not assumed — it is what the registry and `npm audit` both point at:

```
$ npm view astro dist-tags        latest: 7.3.3
$ npm view astro versions         highest overall: 7.3.3 ;  8.x present: false
$ npm audit  (at astro 6.4.8)     astro ... range=<=7.2.7 ... fix: astro@7.3.3 major=true
```

Lockfile movement (`lockfileVersion 3`, 69 packages moved, 65 added, 108 removed):

| Package | 6.4.8 tree | 7.3.3 tree | Note |
|---|---|---|---|
| `astro` | 6.4.8 | **7.3.3** | direct; the only `package.json` edit |
| `sharp` | 0.34.5 | **0.35.4** | transitive — see §3 |
| `vite` | 7.3.6 | **8.3.0** | Astro 7 ships Vite 8 |
| `esbuild` | 0.27.7 | **0.28.2** | clears the `low` |
| `zod` | 4.3.6 | **4.6.5** | bundled behind `astro/zod` — see §6 |
| `svgo`, `postcss`, `nanoid`, `smol-toml`, `devalue`, `fast-uri` | — | unchanged | already clean at `ab70dde` |

No `npm audit fix --force` was used; the bump is an explicit `npm install astro@7.3.3`.

---

## 2. `npm audit` — counts, not "clean"

**`--omit=dev` is confirmed a no-op here, again, from the metadata rather than from the claim.**
`site/package.json` has 13 `dependencies` and **no `devDependencies` key**:

```
devDependencies key: false      dependencies count: 13
deps (6.4.8): {"prod":442,"dev":0,"optional":79,"peer":0,"peerOptional":0,"total":520}
deps (7.3.3): {"prod":375,"dev":0,"optional":103,"peer":0,"peerOptional":0,"total":477}
```

`dev: 0` in both. **Every finding below is a production finding.**

| | critical | high | moderate | low | **total** |
|---|---|---|---|---|---|
| `main` (for reference) | 1 | 9 | 6 | 1 | **17** |
| `ab70dde` — astro 6.4.8 | 1 | 1 | 0 | 1 | **3** |
| **this change — astro 7.3.3** | **0** | **0** | **0** | **0** | **0** |

```
$ npm audit              # astro 7.3.3
found 0 vulnerabilities           AUDIT_EXIT=0
$ npm audit --omit=dev   # identical, as expected
found 0 vulnerabilities
$ node -e '...audit.vulnerabilities'
{}
```

**Nothing is accepted. There is no "accepted at version" row to carry forward**, which retires
the three rows the previous handoff recorded (`astro 6.4.8`, `sharp 0.34.5`, `esbuild 0.27.7`).

The two advisories the Wave 0 re-run named by ID, and the two `sharp` ones, checked **by ID**
against the post-upgrade audit JSON rather than inferred from the total:

```
GHSA-26w7-cxv4-gfx2   Astro: RCE through AVIF image optimization          absent
GHSA-376h-93r7-7g6f   Astro: authz bypass, base path-segment boundary     absent
GHSA-f88m-g3jw-g9cj   sharp: libvips CVE-2026-33327/33328/35590/35591     absent
GHSA-rgj7-g3m4-5g8c   sharp: libheif GHSA-g89c-p67h-r497 / 2jg2-4ch7-h545 absent
```

Also cleared in the same move, though not named in the brief: the two moderate Astro XSS
advisories (`GHSA-f48w-9m4c-m7f5` spread-attribute names, `GHSA-4g3v-8h47-v7g6` View Transition
animation properties), the low transition-directive XSS (`GHSA-7pw4-f3q4-r2p2`), and the
`esbuild` dev-server file-read low (`GHSA-g7r4-m6w7-qqqr`).

---

## 3. `sharp` — it does **not** clear independently

Asked directly, and answered from the dependency graph rather than from the version number:

```
$ npm ls sharp      (astro 6.4.8)          $ npm ls sharp      (astro 7.3.3)
website@0.0.1                              website@0.0.1
└─┬ astro@6.4.8                            └─┬ astro@7.3.3
  └── sharp@0.34.5                           └── sharp@0.35.4
```

**`sharp` is not a direct dependency** — it appears nowhere in `site/package.json`, and there is
exactly **one** path to it, through `astro`. It therefore clears **only via astro's transitive
tree**, which is what the brief asked me to state explicitly if it turned out that way. It did.

The mechanism, from the Astro changelog: **7.2.8 — "Updates the minimum supported version of
Sharp to 0.35.4"**. The advisory range is `<=0.35.4-rc.0`, so 0.35.4 is the first clean release,
and `astro@7.3.3` pulls exactly it.

Bumping `sharp` independently would mean either adding a direct dependency on a package this repo
does not use directly, or pinning an `overrides` entry against the framework's own floor. Both
are worse than taking astro's tree, and neither is needed now that the tree is clean. **No `sharp`
entry was added to `package.json`.**

---

## 4. Astro 7 breaking changes, each checked against this repo

Sources: the v7 upgrade guide (`docs.astro.build/en/guides/upgrade-to/v7/`), the `astro`
package CHANGELOG, and the v7 release post. The guide's breaking/deprecated/removed headings
are, verbatim and in order: *Dependency Upgrades (Vite 8)*, *Experimental Flags*, *Rust compiler*,
*Reserved file name: `src/fetch.ts`*, *New default Markdown processor: Sätteri*, *New default
whitespace handling: `compressHTML: 'jsx'`*; *Deprecated: `getContainerRenderer()` from integration
package roots*; *Removed: `@astrojs/db`*, *Removed: exposed `astro:transitions` internals*.

| Breaking change | Does it touch this repo? | Evidence |
|---|---|---|
| **Vite 8** | No | `astro.config.mjs` declares no `vite` block and no Vite plugin. Both builds green. |
| **Experimental flags removed** (`logger`, `queuedRendering`, `rustCompiler`, `advancedRouting`, `cache`/`routeRules`) | No | `grep "experimental\|compressHTML\|logger\|routeRules\|cache" astro.config.mjs` → **no match**. The config declares none of them. |
| **Rust compiler** — unclosed tags are now errors; invalid HTML is no longer auto-corrected | **Compiles clean** | All **30** `.astro` files compile in both builds, exit 0. This repo *does* use self-closing non-void elements (`<p set:html={…} />` in `projects/[slug].astro`), which is precisely the shape this change could have altered — and the rendered text is byte-identical (§5). |
| **Sätteri replaces remark/rehype** | **No — unreachable** | See below; this one needed proof, not assumption. |
| **`compressHTML: 'jsx'` is the new default** | **No visible change** | The headline silent risk. Measured, §5. |
| **`src/fetch.ts` reserved** | No | Absent from **both** srcDirs (`src/`, `src-private/`). |
| **`@astrojs/db` removed** | No | Not a dependency. |
| **`getContainerRenderer()` deprecated** | No | Not used. |
| **`astro:transitions` internals removed** | No | No view transitions; `output: 'static'`, no islands. |

### Why the Markdown-processor change is unreachable — proven, not assumed

My first grep for markdown handling returned **empty output on a 1998-byte file**, which is the
"parser matched nothing and returned an empty verdict" failure this sprint keeps hitting. I
re-read the actual bytes instead. The real answer:

- **`format: html`** — the payload is staged **byte-for-byte** under `_payload/**` by
  `scripts/private-build.mjs` and displayed in an `<iframe>`. Astro never parses it.
- **`format: pdf`** — a link.
- **`format: data`** — first-party renderer (`src/lib/cv-data.ts`).
- **The committed fixtures publish `pdf`, `data` and `html` only** — there is no `md` item:
  `cv` → 4×`pdf` + 1×`data`; `phd-milestones` → 2×`html` (both `private`).
- **Nothing calls Astro's content rendering path.** `getCollection` is used in the two private
  pages for *metadata only*; there is no `render()`, no `<Content />`, no `astro:content` render
  import, no `markdown:` config, and **no `remark`/`rehype`/`mdx` dependency**.
- The only Markdown in the repo is `src/lib/md.ts` — a **hand-written** inline converter mirroring
  `cv/tools/converters.py:md_to_html`, used through `set:html`, with its own 9 tests (all passing).

Astro's Markdown pipeline is not on any code path here, so replacing it changes nothing.

---

## 5. The four behaviours the brief named — including the one that really changed

### `base` path handling — **CHANGED, and the change is the fix.** Reported, not papered over.

This is the one to read carefully, because this site's privacy boundary *is* a base path.

Astro 7.3.3 (also backported to 7.2.4) contains:

> "Fixes base path stripping to respect path-segment boundaries. With a configured `base` such
> as `/docs`, a request like `/docs-archive/page` is no longer treated as being under the base"

and 7.0.9 fixed the dev server stripping `base` from prefix-only matches. **That is
`GHSA-376h-93r7-7g6f` itself** — the advisory is a behaviour change, so "the advisory is fixed"
and "base handling changed" are the same sentence. The direction is the safe one: strictly fewer
paths are considered inside the base. A prefix-only sibling (`/p-archive/...` against base `/p/`)
is no longer treated as being under `/p/`.

**Why this is the right direction for this repo, and not merely harmless:** the gate serves the
private area under `/p/**` and strips `/p/` to form the object name. The old loose stripping is
the shape that lets something spelled `/p-something` be mistaken for the gated area. ADR-0011's
guarantee does not *depend* on Astro's stripping — the guarantee is that the public router is
never shown `src-private/pages/**` — but the base is what makes the private output *addressable*,
and tightening it strengthens the same boundary.

Measured on the real builds rather than reasoned about:

```
GitHub Pages variant, SITE_BASE=/website/, astro 6.4.8 vs astro 7.3.3
$ diff <(based hrefs, astro6) <(based hrefs, astro7)
2c2
< href="/website/_astro/Base.6AOyW9bj.css"
> href="/website/_astro/Base.X6jh-tOO.css"
```

The **only** difference across every emitted page is one content-hashed asset filename. Every
other based href is identical. And the check that would catch the failure mode — a root-absolute
href that forgot the base:

```
$ grep -oh 'href="/[^w"][^"]*"' $(find dist-public -name '*.html')     # /website/ build
(no output — no unbased root-absolute href anywhere)
```

Private side, base `/p/`: `check:private-links` passes on all 5 pages under Astro 7, and still
catches all three escape shapes (§7).

### Content collections — **unchanged**

The v7 guide says nothing about content collections, `content.config.ts`, `defineCollection`,
loaders or `astro/zod`; the CHANGELOG's only 7.x collection entries are *additive* (`deferRender`
on the `glob()` loader in 7.1.0; an optional `digest` property on entries). Checked empirically
against the installed package, because "the guide doesn't mention it" is not evidence:

```
astro@7.3.3 exports  "./content/config" -> "./dist/content/config.js"      (still present)
astro@7.3.3 exports  "./zod"            -> "./dist/zod.js"                 (still present)
```

Both import paths `src/content.config.ts` uses still resolve. The custom loader API this repo
relies on — `load({ store, parseData })`, `store.clear()`, `store.set()` — is unchanged, and
`entrySchema = itemSchema.safeExtend({...})` still works across `zod` 4.3.6 → 4.6.5.
**`src/content.config.test.ts`: 56 passed, 0 failed** — the suite the previous trial could not
run, and it is proven load-bearing by name in §7.

### `srcDir` (ADR-0011) — **unchanged**

Neither the guide nor the CHANGELOG mentions `srcDir` in any 7.x entry. Behaviourally: the public
build routes `./src`, the private build routes `./src-private`, both produce their own output, and
`scripts/private-structure.test.ts` passes 6/6 — including the module-graph half, proven
load-bearing by name in §7. ADR-0011's structural guarantee is intact.

### The static build — **unchanged**

`output: 'static'`, no adapter. **26 pages built** in the public build under both 6.4.8 and 7.3.3.
`astro:build:done` — which `scripts/private-build.mjs` depends on for payload staging, the SD-7
allowlist check and the sync receipt — has no documented 7.x change and behaves identically:

```
[hub-private-build] staged 3 payload file(s) for 2 private item(s)
[hub-private-build] checked 83 emitted path(s) against the gate's allowlist (SD-7)
[hub-private-build] wrote .hub-private-build.json: 2 private item(s), 83 file(s).
```

Identical text under both versions, including counts.

### And the change most likely to break things silently: `compressHTML: 'jsx'`

Astro 7 changes the `compressHTML` default from `true` to `'jsx'`, applying JSX whitespace rules.
The documented hazard is that **newlines between inline elements stop producing a visible space** —
a rendering change with no error and no failing test. I measured it directly: strip tags, collapse
whitespace, compare the visible text of every page between the two builds.

```
dist-public : astro6=155 files  astro7=155 files  only-in-6=0  only-in-7=0
dist-private: astro6=84  files  astro7=84  files  only-in-6=0  only-in-7=0
visible-text identical: 35 page(s); differing: 0 page(s)
```

**Zero pages changed visible text, and the emitted path sets are identical.** No `compressHTML`
override was added — the default is safe for this repo, and pinning `compressHTML: true` to be
cautious would have hidden the fact that it is.

---

## 6. Proof the site still works

Everything below was run against the materialized `ab70dde` tree, **twice: once on Node
v24.18.0 and once on Node v22.23.2**. The second run matters — CI pins `node-version: 22`, which
resolves to exactly 22.23.2, and my whole first pass was on Node 24. A green run on the wrong
runtime is not evidence about CI. **Both runs produced identical results.**

| Check | astro 6.4.8 (baseline) | **astro 7.3.3** | CI-enforced? |
|---|---|---|---|
| `npm test` | 18 files, 241 passed, 1 skipped | **18 files, 241 passed, 1 skipped** | yes |
| `build:public` (`HUB_OUTPUT=public`) | exit 0, 26 pages, 30 html, 155 files | **exit 0, 26 pages, 30 html, 155 files** | yes |
| `build:private` (`HUB_OUTPUT=private`) | exit 0, 3 pages, 84 files | **exit 0, 3 pages, 84 files** | yes |
| `check:no-private-in-public` | PASS, 157 files scanned | **PASS, 157 files scanned** | yes |
| `check:private-links` | PASS, 5 pages | **PASS, 5 pages** | yes |
| `demo:leak-check` | check exited **1** | **check exited 1** | yes |
| `scripts/contrast.mjs` | 52 pairs, **0 below AA** | **52 pairs, 0 below AA** | no |
| `check:smoke-routes` | all 7 present | **all 7 present** | yes |
| `redirects:check` | **exit 1** | **exit 1** | no — see §8 |

Test counts are per-file from the JSON reporter, not from the summary line, so the numbers are
counted rather than read:

```
 22p  scripts/check-no-private-in-public.test.ts     56p  src/content.config.test.ts
 18p  scripts/check-private-links.test.ts            13p  src/lib/auth-errors.test.ts
  7p  scripts/check-smoke-routes.test.ts              5p  src/lib/bib.test.ts
  6p  scripts/private-structure.test.ts               7p  src/lib/client-events.test.ts
  6p 1s scripts/route-inventory.test.ts              13p  src/lib/cv-data.test.ts
  6p  scripts/site-env.test.ts                        9p  src/lib/md.test.ts
  5p  scripts/site-output.test.ts                     9p  src/styles/tokens.test.ts
 15p  scripts/sync-content.test.ts                   14p  src-private/lib/private-content.test.ts
 17p  scripts/sync-private.test.ts                   13p  src-private/lib/signout.test.ts
TOTAL files=18 passed=241 skipped=1 failed=0
```

> **The brief's baseline of "230 passed / 1 skipped" does not reproduce at `ab70dde`, and cannot.**
> The suite contains **242 cases**, so `230 + 1 = 231` cannot be produced by any skip configuration
> of it. I confirmed the total is stable across two different skip configurations:
> with content synced → `241 passed | 1 skipped (242)`; without → `233 passed | 9 skipped (242)`.
> The 8-case swing is `src/lib/cv-data.ts`'s `describe.skipIf(!SYNCED)` block. **The correct
> baseline, and the correct precondition, is: `npm run content:fixture` first, then
> 18 files / 241 passed / 1 skipped / 242 total.** The 1 permanent skip is in
> `scripts/route-inventory.test.ts`. This is a bookkeeping correction, not a regression —
> **the count is identical before and after the upgrade**, which is the comparison that matters.

Two builds, both outputs, explicitly:

```
$ HUB_OUTPUT=public  astro build   ->  BUILD_PUBLIC_EXIT=0   26 page(s) built
$ HUB_OUTPUT=private SITE_BASE=/p/ astro build  ->  BUILD_PRIVATE_EXIT=0   3 page(s) built
```

---

## 7. The guards were shown *running*, not just reported

A guard that did not run is not a guard that passed, so each of these was made to go red on
purpose, on the **Astro 7** output, with the plant verified on disk before the check ran.

### `demo:leak-check` — still red on a planted private slug

`demo:leak-check` exits 0 **when the check it runs exits 1**, so the meaningful line is the inner
one:

```
demo:leak-check: the check exited 1 (1 means it caught the leak).
demo:leak-check: PASS — the guard failed on the injected leak, which is what it is for.
```

Because a plant that silently fails to write its file has already happened once this sprint, I
also ran an **independent** plant that asserts the write landed before invoking the check:

```
planted slug: phd-milestones/milestones
PLANT ON DISK: true
LEAK_PLANT_CHECK_EXIT=1
check:no-private-in-public: 5 LEAK(S) of private content into <copy>
    contents: qualified-id of phd-milestones/milestones — "phd-milestones/milestones"
    contents: slug ... route ... source ...
```

Injected into a **copy**; the real `dist-public` was never modified.

### `check:private-links` — all three shapes, each with a control

Anchor uniqueness asserted before every plant (`</body>` count == 1), and the plant re-verified on
disk after writing:

```
CONTROL (clean copy)          EXIT=0   PASS — every link in 5 page(s) resolves under /p/
path-escape     <a href="/elsewhere/secret/">   EXIT=1   outside-base: resolves to /elsewhere/secret/, outside /p/
off-origin      <a href="https://evil.invalid/x"> EXIT=1   off-origin: points at another origin (https://evil.invalid)
relative-escape <a href="../../elsewhere/">     EXIT=1   outside-base: resolves to /elsewhere/, outside /p/
```

All three caught, each classified with the **right** `kind`, and the clean control still green —
so the exit-1s are the plants, not a checker that fails on everything.

### Break-red-restore-green, with the failing test confirmed **by name**

Both breaks asserted `count(anchor) == 1` before editing, and asserted the edit landed on disk.

**Break 1 — the manifest-mirror seam** (`src/content.config.ts`), the suite the previous trial
could not run. Anchor `source: "^[a-z][a-z0-9-]{0,38}$"`, count = 1. Changed `{0,38}` → `{0,39}`:

```
BROKEN:   passed=240 failed=1
  FAILED: src/content.config.test.ts :: the Zod collection mirrors contract/manifest.schema.json
          carries the same patterns, character for character
RESTORED: passed=241 failed=0
```

Exactly one test, and it is the one that pins the Zod mirror character-for-character against
`contract/manifest.schema.json`. **The contract seam is genuinely enforced under Astro 7.**

**Break 2 — ADR-0011's module-graph half** (`scripts/private-structure.test.ts`). Anchor
`export const BUCKET_PREFIX = "sources/";` in `src/lib/hub-content.mjs`, count = 1. Added an
import of `src-private/lib/private-content.mjs` into a module the public build compiles:

```
BROKEN:   passed=240 failed=1
  FAILED: scripts/private-structure.test.ts :: nothing the public build compiles imports anything
          private no file under src/ imports src-private/, private-content or the private build
RESTORED: passed=241 failed=0
```

Exactly one test, and it is ADR-0011's "Risks" clause made executable. **No test was weakened,
skipped or deleted anywhere in this change** — ADR-0011 names that risk in terms, and the two
breaks above are the evidence that the guarantee still has teeth rather than a green suite.

---

## 8. Three things that are true and are not caused by this change

**1. `redirects:check` exits 1 — and did so *before* the upgrade too.**

```
astro 6.4.8 (baseline):  BASE_REDIRECTS_EXIT=1
astro 7.3.3:             REDIRECTS_EXIT=1
routes missing from redirects/github-pages.json:
  /projects/fixture-one/
  /projects/fixture-two/
```

Identical output on both sides. It is the committed **fixture** projects not appearing in the
GitHub Pages redirect map — an artefact of building from `content:fixture`. **Not an Astro 7
regression, and not in CI** (`redirects:check` appears in zero workflow files). Left alone
deliberately: "fixing" it would mean writing fixture slugs into a production redirect map.

**2. `site/package.json`'s `engines.node` is now understated.** The upgraded tree contains a
**non-optional** production dependency needing a newer Node than the repo declares:

```
site/package.json declares   engines.node  >=22.12.0
undici@8.10.2                engines.node  >=22.19.0     (astro -> unifont -> undici; optional=false)
@napi-rs/wasm-runtime@1.2.4  engines.node  ^20.19.0 || ^22.13.0 || >=23.5.0   (via @astrojs/check)
```

`astro@7.3.3` itself still declares `>=22.12.0`, same as 6.4.8 — so the floor moved underneath
the framework, not in it. **CI is unaffected**: `node-version: 22` resolves to 22.23.2, which
satisfies everything, and I verified the full suite on exactly that version. The exposure is a
developer on Node 22.12–22.18, who would satisfy `package.json` and then hit a transitive floor.

**I did not change `engines`** — narrowing the repo's declared Node support is a decision with
reach beyond this task's brief, and it is not a blocker. Recommended follow-up, one line:
`"node": ">=22.19.0"`.

**3. A concurrent stream is editing this shared worktree.** At the start of this task
`git status` showed `llm/specs/2026-09-10-research-hub-design.md` modified; by the end that file
was clean and `HEAD` had moved to `421f601` ("hub-007: D-3 is LIFTED — Google sign-in is
configured"). Not mine — I never touched `llm/` except to write this handoff. Recorded so the
final `git status` below is legible.

---

## 9. Scope

```
$ git status --short
 M site/package-lock.json
 M site/package.json
$ git rev-parse --abbrev-ref HEAD
admin/wave-0-preconditions
```

Only `site/**` (plus this handoff, which the task directs to `llm/sprints/2026-09-hub/handoffs/`).
**Nothing under `gate/**`, `infra/**`, `contract/**`, `firebase.json`, `.github/workflows/**`
or `llm/**` was modified.** No branch checkout; no git, `gh` or cloud mutation. Transcripts above
come from the committed fixtures (`npm run content:fixture`) — the two private items are the
fixture's own `phd-milestones` entries, and **no private content is quoted** beyond the fixture
slugs the leak check prints by design.

## 10. What the next audit should see

A comparison, not a re-litigation:

- **Expected: `npm audit` → 0 findings**, `deps.dev === 0` (so `--omit=dev` remains a no-op).
- If `astro` appears again, the remedy is a 7.x patch, **not** a major — 8.x does not exist yet.
- `sharp` has no independent lever: it moves when `astro` moves. Check `npm ls sharp` shows a
  single path before concluding otherwise.
- Baseline for `npm test` is **18 files / 241 passed / 1 skipped / 242 total**, after
  `npm run content:fixture`. Without that sync it is 233 passed / 9 skipped — same 242 total.
