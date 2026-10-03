# Handoff — `site`, Wave 4 FP-2 (leak check source-key collision)

Status: Delivered
Date: 2026-10-03
Stream: `site`
Issue: `hub-005` (Wave 4)
Branch: `fix/leak-check-source-collision`
Scope: `site/scripts/check-no-private-in-public.mjs` and its test only
Related: ADR-0005 (leak check), ADR-0016 (private by default), ADR-0019 (`construction-ai` source key); Wave 2 FP-1 (bare `index.html` payload-path needle)

## Summary

The Wave 4 satellite publishes under source key `construction-ai`, which is also
the id of the owner's own public first-party CV project rendered at
`/projects/construction-ai/`. The leak check's bare `source` needle matched that
legitimate public page in both PATH and CONTENTS, so a CLEAN `main` + Wave 4
build failed with **exactly 8 false leaks** (reproduced on real data below).

The bare `source` needle is removed — a source name is not, by itself, a safe
needle when it can equal public first-party content. The private item remains
bound by its `qualified-id`, `route`, `payload-path` and `title`/`summary`
needles, which are distinctive. The path check now treats only the bare `slug`
as a path segment. This is Wave 4 **FP-2**, the same over-broad-needle class as
Wave 2's FP-1 (a bare `index.html` payload-path needle).

## Change

`site/scripts/check-no-private-in-public.mjs` (+26 / -21):

- `needlesFor`: deleted the `source` branch (`add("source", item.source, true)`).
  No `kind: "source"` entry exists anywhere. The item's needles for the Wave 4
  html item are now `qualified-id, slug, route, payload-path, title, summary`.
- Deleted the now-unused `export const SOURCE_MIN_LENGTH = 4` and its JSDoc.
- `findLeaks` PATH loop: `if (needle.kind !== "slug") continue;` (was
  `!== "slug" && !== "source"`). A source name is no longer a path segment.
- Header: NEEDLES list drops the `source` row and adds the Wave 4 FP-2
  explanation; LIMITS gains the source-name limit. The PASS line no longer
  claims `source` is checked.

Not changed: `payload-path` is still only matched QUALIFIED by source, so
`construction-ai/index.html` in CONTENTS still fires, but a file merely under
`projects/construction-ai/` does not.

## Tests

`site/scripts/check-no-private-in-public.test.ts` (+112 / -9). Per the contract's
"break, red, restore, green" rule, each new guard was shown failing before
passing (mutation evidence below).

1. **Regression** (must be green): a clean output containing
   `/projects/construction-ai/` in PATH and CONTENTS plus the private item
   `{source: "construction-ai", slug: "construction-ai-site", section:
   "projects", title: "Construction.AI — Project Overview", path: "index.html"}`
   reports **no leak** (`findLeaks(...) === []`).
2. **Guard still works** (parametrized, one row per shape, onto the SAME private
   item): route `/projects/construction-ai/construction-ai-site/`, qualified-id
   `construction-ai/construction-ai-site`, payload-path
   `construction-ai/index.html`, title, and bare slug — each planted in a public
   file is still reported, and the assertion names the specific needle `kind`.
   A sixth test pins that the source name alone is **not** a CONTENTS needle.
3. Updated the two existing tests that asserted the bare `source` needle
   (`needlesFor` kinds, bounded-needle list) and replaced "still catches a
   source-qualified payload path" (which asserted the source as a path segment)
   with "does NOT treat a bare source name as a path segment".

## Verification (verbatim counts)

Targeted:

```
$ cd site && npx vitest run scripts/check-no-private-in-public.test.ts
 Test Files  1 passed (1)
      Tests  31 passed (31)
```

Full suite:

```
$ npm test
 Test Files  26 passed (26)
      Tests  360 passed | 1 skipped (361)
```

Fixture public build + check (the local `sources/` tree is the committed
fixture; it has no `construction-ai` source):

```
$ npm run build:public
[build] 26 page(s) built in 1.48s · [hub-public-build] staged 3 payload file(s) …

$ npm run check:no-private-in-public
check:no-private-in-public: 4 private item(s) to look for in dist-public:
check:no-private-in-public: PASS — no private slug, route, payload path, title or
summary appears in any path or any file's contents under dist-public (162 files scanned).
```

Deliberate failing run (still fails as designed; the demo wrapper exits 0 when
the check exits 1):

```
$ npm run demo:leak-check
check:no-private-in-public: … LEAK(S) …
demo:leak-check: the check exited 1 (1 means it caught the leak).
demo:leak-check: PASS — the guard failed on the injected leak …
exit: 0
```

### Real-data evidence (temporary, not committed)

`site/src/content/sources` is gitignored. To reproduce the reported bug on real
data I temporarily copied `~/code/cv/data/{content,variants}` into the fixture
location and the real `~/code/construction-ai-proposal/manifest.json` to
`src/content/sources/construction-ai/` (2 private items), built, and ran both the
pre-fix and post-fix check. Restored with `npm run content:fixture`; `git status`
shows only the two intended files.

```
PRE-FIX (git show HEAD:…mjs, run in site/scripts/):
check:no-private-in-public: 8 LEAK(S) of private content into dist-public:
  projects/construction-ai/index.html   path: source … "construction-ai"   (×2 items)
  projects/construction-ai/index.html   contents: source … "construction-ai"
  <projects index/sitemap>              contents: source … "construction-ai"
exit 1

POST-FIX (current):
check:no-private-in-public: 6 private item(s) to look for in dist-public:
  construction-ai/construction-ai-proposal — needles: qualified-id, slug, route, payload-path, title, summary
  construction-ai/construction-ai-site     — needles: qualified-id, slug, route, payload-path, title, summary
  …
check:no-private-in-public: PASS … (172 files scanned).
exit 0
```

Every one of the 8 pre-fix leaks is `source of construction-ai/…` on the
legitimate public `/projects/construction-ai/` page/path/sitemap. The fix removes
all 8 and keeps the check green with the real private items present.

### Mutation evidence ("each goes red if the needle is removed")

Restored after each run. `Tests 3 failed`, `2 failed`, `2 failed`, `4 failed`,
`5 failed` for the route, qualified-id, payload-path, title and slug removals
respectively; in every case the corresponding new proof row was red. The
regression row stayed green throughout (it asserts absence).

## Does the `slug` needle have the same collision risk?

**Not today; yes as a latent FP-3.** The CV project entry is:

```yaml
- id: construction-ai
  url: "https://djjay0131.github.io/construction-ai-proposal/"
  ...
```

The pdf item's bare slug is exactly `construction-ai-proposal`, so if that URL
were rendered it would match delimiter-bounded (`/…/`) and fail a clean build.

It is not rendered. `site/src/pages/projects/[slug].astro` and
`projects/index.astro` gate their external link on `project.github`, but the CV
data field is `url` (the loader spreads it through, the schema type says
`github?`), so the link is dropped; the project sections of
`cv/[variant].astro` render only `name` + `summary`, and the `p.url` at
`cv/[variant].astro:162` is in the **publications** loop. Confirmed against the
real-data build above: `grep -rl construction-ai-proposal dist-public` → `(none)`,
while `projects/construction-ai/` exists. The html item's slug
`construction-ai-site` appears nowhere public.

Proposed same-class fix if/when the URL is wired to render (e.g. mapping `url`
into the project link): a bare slug that equals a public first-party slug is not
a safe needle either, so either (a) exclude the CV's public project ids from the
bare-`slug` needle and rely on qualified-id/route/payload-path for those items,
or (b) in the same edit that renders `project.url`, add a regression fixture
pinning `construction-ai-proposal` in public output as CLEAN and qualify the
slug accordingly. **Not implemented** — there is no current false positive, and
the change is kept minimal and evidence-based. The `github`/`url` mismatch is a
separate, pre-existing latent bug worth its own issue.

## Risks / limits (restated, not hidden)

- A leak that preserves only the source name and none of the
  qualified-id/route/payload-path/title/summary needles now passes. That is a
  stated LIMIT in the module header, not an oversight: the other needles are what
  bind the item.
- Binary files remain PATH-only matches; a slug in prose remains deliberately
  unmatched. Unchanged.

## Files

- `site/scripts/check-no-private-in-public.mjs` (modified)
- `site/scripts/check-no-private-in-public.test.ts` (modified)
- `llm/sprints/2026-09-hub/handoffs/site-leakcheck-fp2.md` (this file)

No commit made.
