# Handoff — Red Team, Wave 0b (private by default)

Stream: Red Team (adversary; authored no source, fixed nothing)
Wave: 0b — private by default (D8)
Branch: `feat/private-by-default` (PR #86)
Date: 2026-10-02
Contract: `llm/sprints/2026-09-hub/contracts/red-team-wave-0b.md`
Seams: `llm/sprints/2026-09-hub/contracts/private-by-default-seams.md`
ADR: `llm/governance/adr/0016-private-by-default-publish-allowlist.md`

## Summary

Attacked `site/publish-allowlist.json` and the code that computes effective
visibility (D8) with **8 attacks / 10 cases** covering every target in the
contract: slug casing, Unicode normalisation/homoglyph, path-dot/traversal,
`(source, slug)` collision, manifest rename / content substitution onto a public
slug, the `cv-data` residue, and historical URLs (including the GitHub Pages
spelling). The allowlist guard's own conditions A and B were also exercised.

**Result: 1 BYPASS (target 5), 9 REFUSED.** The bypass publishes the private
`anthropic-fellow` PDF bytes at `/pdfs/academic.pdf`
(sha256 `ef280af84fc389f5f4a03cb9f98880325050fa323814ed94f99e2f406079df4c`,
bytes `%PDF-1.4`), while `npm run build:public`,
`npm run check:publish-allowlist` and `npm run check:no-private-in-public` all
pass and no `anthropic` byte appears in `dist-public`. Everything else the brief
named is refused by the schema mirror, the allowlist parser, the loader, the
staging containment check or the render-time CV filter, each cited below.

Attacks were run against the synced local fixture tree
(`site/src/content/sources/`, `HUB_OUTPUT=public`/`private`, `npm run build:*`).
Hostile edits were made only to that gitignored tree and it was restored
byte-identical before finishing (fixture aggregate sha256
`60791247e5b38f89894eeb13ea527d01f37091639ae5a9e558ad2e3a87c62bf0`, matching
the pre-attack backup). `git status --short` shows no tracked change from this
stream; `npm test` is 23 files / 291 passed / 1 skipped on the restored tree.

## Attacks

### A1 — Slug casing · REFUSED

Hostile `cv` manifest renamed the allowlisted item `academic` → `Academic`.

```
$ cat /tmp/.../allowlist-upper.json   # hub-owned file, for the parser test
{"version":1,"items":[{"source":"cv","slug":"Academic"}]}
$ node scripts/check-publish-allowlist.mjs --allowlist /tmp/.../allowlist-upper.json
check:publish-allowlist: ... items[0].slug "Academic" is not valid for source "cv"
  (it must match /^[a-z0-9]+(?:-[a-z0-9]+)*$/).        exit=1

$ node scripts/stage-public-assets.mjs
stage-public-assets: public/pdfs/research-professional.pdf ... (no academic)
$ npm run build:public
sources/cv/manifest.json does not match contract/manifest.schema.json:
  items.0.slug: Invalid string: must match pattern /^[a-z0-9]+(?:-[a-z0-9]+)*$/
build exit=1
```

Refusing code: the allowlist's `SLUG_PATTERN` (`site/src/lib/hub-content.mjs:354`,
enforced at `:415-421`) and the manifest mirror's slug regex
(`site/src/content.config.ts:102`, pattern at `:66`). Matching is exact and
case-sensitive (`effectiveVisibility()` at `hub-content.mjs:477-480`), so a
cased-different slug is never allowlisted; it fails closed even before the
schema rejects it.

### A2 — Unicode normalisation / homoglyph · REFUSED

NFD (`acade\u0301mic`) and Cyrillic-і (`academ\u0456c`) slugs, both in the
allowlist and in the hostile manifest.

```
$ node scripts/check-publish-allowlist.mjs --allowlist /tmp/.../allowlist-unicode.json
... items[0].slug "académic" is not valid for source "cv" ...        exit=1

# raw consumer FAILS CLOSED, then the loader rejects:
collectPublicItems cv slugs: ["research-professional","sde-long","cv-data"]
$ npm run build:public
  items.0.slug: Invalid string: must match pattern /^[a-z0-9]+(?:-[a-z0-9]+)*$/
build exit=1
```

Refusing code: same ASCII-only patterns (`hub-content.mjs:354`,
`content.config.ts:66,102`). There is **no Unicode normalisation step anywhere**,
and none is needed: the pattern admits only `[a-z0-9-]`, so confusables cannot
equal an allowlist key. The raw consumers also do not fold (they compare exact
strings), so the homoglyph failed closed before validation.

### A3 — Path-dot / traversal · REFUSED

```
# 3a: path escapes the prefix
$ node ... cv/academic.path = "../phd-milestones/site/internal.html"
$ npm run build:public
  items.0.path: Invalid string: must match pattern
  /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[^\\\u0000-\u001f]+$/
build exit=1

# 3b: defence in depth — stage an UNVALIDATED traversal path directly
$ node -e 'import("./src/lib/frame-content.mjs").then(m=>console.log(
    m.stagingPlanFor("src/content/sources", [
      {source:"cv",slug:"academic",path:"../phd-milestones/site/internal.html",format:"pdf"},
      {source:"cv",slug:"academic",path:"/etc/passwd",format:"pdf"},
      {source:"..",slug:"x",path:"cv/academic.pdf",format:"pdf"}])))'
stagingPlanFor returned 0 entries: []

# 3c: single-dot "./" IS permitted by the pattern — see A5 for what it enables
$ node -e '...path:"./anthropic-fellow.pdf"...'
single-dot plan: [{"from":".../cv/anthropic-fellow.pdf","to":"_payload/cv/anthropic-fellow.pdf","source":"cv"}]
```

Refusing code: `PATTERNS.path` (`site/src/content.config.ts:67`, applied at
`:106`) rejects `..` segments and leading `/`; `addFile()`'s containment check
(`site/src/lib/frame-content.mjs:184-192`) independently resolves `from` and
skips anything outside the source prefix, and rejects a `.`/`..` source. Encoded
dots (`%2e%2e%2f`) are never decoded by `path.join`, so they are inert
filenames. **Notable:** a *single* `.` is permitted by the pattern, and
`path.join` normalises `./x` to `x`. This is not an escape (it stays in the
prefix) but it does let an allowlisted item name any *other* file in its own
prefix — the mechanism A5 exploits.

### A4 — `(source, slug)` collision · REFUSED (one raw-consumer gap, see Findings)

```
# 4a duplicate slug in one manifest (cv: research-professional -> academic)
sources/cv/manifest.json breaks the publishing contract:
  items[1].slug: duplicate slug "academic" — items 0, 1 all use it ... (SEAM-1)
build exit=1

# 4b manifest.source != prefix (sources/cv2 with source: cv)
sources/cv2/manifest.json breaks the publishing contract:
  source: the manifest says "cv" but it was published under the prefix sources/cv2/. ...
build exit=1

# 4c satellite source named "hub" with the slash-slug of a real allowlist entry
$ node -e '... collectPublicItems(...).filter(i=>i.source==="hub")'
[{"source":"hub","slug":"research/soa-agentic-se","title":"Fake hub page (fixture)", ...}]
$ npm run build:public
  items.0.slug: Invalid string: must match pattern /^[a-z0-9]+(?:-[a-z0-9]+)*$/
build exit=1

# 4d key ambiguity in the abstract
allowlistKey(a/b,c) = a/b/c ; allowlistKey(a,b/c) = a/b/c ; equal: true
```

Refusing code: `findDuplicateSlugs()` (`content.config.ts:178-187`, applied
`:277-283`); the prefix/source identity check (`:270-275`); and the item slug
pattern (`:102`). The `allowlistKey()` ambiguity (`hub-content.mjs:370-372`) is
real in the abstract but unreachable through validation: `source` cannot contain
`/` (`SOURCE_PATTERN` `:352`) and only `hub` slugs may contain `/`; a non-hub
item needs a slash-slug to collide, which `content.config.ts:102` rejects.
**However**, 4c shows the raw consumers do not validate, so
`collectPublicItems`/staging/leak-check treated the forged `hub` item as
allowlisted-public; only the Zod loader stopped the build. Recorded as Fix later.

### A5 — Manifest renaming / content substitution onto a public slug · **BYPASS**

The satellite drops the genuine `academic` item and renames `anthropic-fellow`
to the allowlisted slug `academic`, keeping `path: anthropic-fellow.pdf` and the
fellowship title.

```
$ node -e '... m.items = m.items.filter(i=>i.slug!=="academic");
            m.items.find(i=>i.slug==="anthropic-fellow").slug="academic"; ...'
research-professional <- research-professional.pdf
academic <- anthropic-fellow.pdf
sde-long <- sde-long.pdf
cv-data <- cv-data/

$ node scripts/stage-public-assets.mjs && npm run build:public
stage-public-assets: public/pdfs/academic.pdf
[build] Complete!                                    build exit=0

$ npm run check:publish-allowlist
check:publish-allowlist: PASS (mode pr) — 14 entries, 0 conflicts, 0 stale.

$ npm run check:no-private-in-public
check:no-private-in-public: 3 private item(s) ... (only phd-milestones; the
    renamed cv item is gone from the private set)
check:no-private-in-public: PASS — ... (161 files scanned).

$ sha256sum dist-public/pdfs/academic.pdf src/content/sources/cv/anthropic-fellow.pdf
ef280af84fc389f5f4a03cb9f98880325050fa323814ed94f99e2f406079df4c  dist-public/pdfs/academic.pdf
ef280af84fc389f5f4a03cb9f98880325050fa323814ed94f99e2f406079df4c  .../cv/anthropic-fellow.pdf
$ head -c 16 dist-public/pdfs/academic.pdf | xxd
00000000: 2550 4446 2d31 2e34 0a31 2030 206f 626a  %PDF-1.4.1 0 obj
$ grep -rc anthropic dist-public/sitemap-0.xml
0
```

Artifact: `dist-public/pdfs/academic.pdf` — the fellowship PDF byte-for-byte,
served 200 at a public URL.

**A5b strengthens it: the private item is still declared and the leak check
still misses.** Keeping both items (`academic → anthropic-fellow.pdf`;
`anthropic-fellow → academic.pdf`) leaves `cv/anthropic-fellow` in the private
set, yet:

```
check:no-private-in-public: 4 private item(s) ... cv/anthropic-fellow — needles:
  qualified-id, slug, route, payload-path, title
check:no-private-in-public: PASS ...
served /pdfs/academic.pdf hash == cv/anthropic-fellow.pdf hash
```

**Why it passes.** `publicAssetPathFor()` decides *whether* to stage by
`(source, slug)` (`hub-content.mjs:106-114`), and `stage-public-assets.mjs:75-82`
names the destination from the **slug** while copying the bytes from the
**satellite's `path`**. The allowlist therefore binds a *name*, never bytes. The
leak check cannot compensate: it matches binaries by path only
(`check-no-private-in-public.mjs:69`, path logic `:308-325`), the substituted
file sits at a different path, and the only textual trace (the item) was renamed
away in A5. This is precisely the "content-only leak with no matching path" class
SEAM-B3 names, and it defeats the purpose of making `anthropic-fellow` private.

Reproduction is deterministic from the commands above; the only prerequisite is
the hostile manifest.

### A6 — `cv-data` residue (SEAM-B3 canary) · REFUSED

Planted `FELLOWSHIP-ONLY-CANARY-7F3A9` in a summary referenced only by the
fellowship variant, plus `CANARY-7F3A9` in its label/description.

```
$ grep -n CANARY .../variants/anthropic-fellow.yaml .../content/summaries.yaml
  label: Fellowship CANARY-7F3A9
  description: FELLOWSHIP-VARIANT-CANARY-7F3A9
  text: FELLOWSHIP-ONLY-CANARY-7F3A9 ... referenced only by the fellowship variant
$ npm run build:public && npm run check:no-private-in-public
check:no-private-in-public: PASS ...
$ grep -rn CANARY dist-public        → (none)
$ grep -rn anthropic-fellow dist-public → (none)
$ find dist-public -name '*.yaml'    → (none)
# control: the code DOES read the canary payload, then filters it
loadVariantSummaries sees: ["Academic CV","Fellowship CANARY-7F3A9",
  "Research Professional","Software Engineering"]
```

Refusing code: the render-time filter — `site/src/pages/cv/index.astro:15-20`,
`site/src/pages/cv/[variant].astro:15-21`, `site/src/pages/resumes/index.astro:12-17`
— intersects `loadVariantSummaries()` with `collectPublicItems(...,{section:"cv"})`,
whose items come from `effectiveVisibility()`. The `cv-data` payload is never
staged (only `format: data` is read, not framed), so no YAML reaches
`dist-public`. Signed in, the variant is present (`privateItemCount: 4`, receipt
lists `cv/anthropic-fellow`).

### A7 — Historical URLs · REFUSED

```
$ npm run build:public                  # clean tree, exit 0
$ find dist-public -iname '*anthropic*' → (none)
dist-public/pdfs: academic.pdf research-professional.pdf sde-long.pdf
dist-public/cv:   academic index.html research-professional sde-long
$ grep -o 'anthropic[a-z-]*' dist-public/sitemap-0.xml → (none)
$ grep -rIl anthropic-fellow dist-public → (no text file contains it)
robots.txt: User-agent: * / Allow: / / Sitemap: https://jason.cusati.us/sitemap-index.xml
build-info.json: absent locally (CI-generated)

# 7b GitHub Pages variant (SITE_URL=https://djjay0131.github.io SITE_BASE=/website/)
$ SITE_URL=... SITE_BASE=/website/ HUB_OUTPUT=public npx astro build   exit 0
/website/pdfs/anthropic-fellow.pdf artifact → ABSENT
files (incl. redirect stubs) mentioning anthropic → (none)
Pages sitemap mentions anthropic → (none)

# Firebase historical redirects (firebase.json:40-56)
/pdfs/anthropic-fellow.pdf  → /signin/ (302)
/cv/anthropic-fellow          → /signin/ (302)
/cv/anthropic-fellow/**       → /signin/ (302)

$ npm run build:private
dist-private/cv/cv/anthropic-fellow
dist-private/_payload/cv/anthropic-fellow.pdf
receipt: { privateItemCount: 4, renderedItemCount: 8, items:[... "cv/anthropic-fellow" ...] }
```

Refusing code: `stage-public-assets.mjs:51-58` wipes and rebuilds
`public/pdfs/`, and only staged allowlisted PDFs are copied (`:75-82`); the
`/cv/anthropic-fellow` route is never emitted because `[variant].astro:19`
filters `listVariants` by effective visibility; the sitemap is public-build-only
(`astro.config.mjs:55-57`). No 200 artifact exists on either origin the build
governs. Firebase answers with a 302 to `/signin/` (not 200), which the seam's
exit criteria accept. The live mirrors (`jason.cusati.us`,
`cusati-hub.web.app`, the Pages mirror) could not be probed — see Not attempted.

### A8 — Allowlist guard, conditions A and B · REFUSED

```
# 8a condition A: entry names a manifest-private item
$ node scripts/check-publish-allowlist.mjs --mode deploy --allowlist conflict.json
check:publish-allowlist: CONFLICT the allowlist names ("phd-milestones","milestones"),
  but that item's manifest says visibility: private ... (SEAM-B5 condition A)
check:publish-allowlist: FAIL. ...
conditionA deploy exit=1 ; conditionA pr exit=1        # always fails, both modes

# 8b condition B: stale entry cv/does-not-exist
$ node scripts/check-publish-allowlist.mjs --mode pr --allowlist stale.json
  1 STALE entry ... fails the build ...     exit=1
$ node scripts/check-publish-allowlist.mjs --mode deploy --allowlist stale.json
  1 STALE entry ... the deploy build continues ... PASS (mode deploy)     exit=0
```

Refusing code: `findAllowlistConflicts()` (`hub-content.mjs:493-508`) also
enforced in the loader at `content.config.ts:415-420`; `findStaleAllowlistEntries()`
(`hub-content.mjs:525-543`) with the mode split in
`check-publish-allowlist.mjs:88-93,133-156`. Behaviour matches SEAM-B5 exactly.

## Findings

### Fix now

1. **BYPASS — the allowlist binds a name, not bytes: a hostile satellite can
   serve the private fellowship PDF at an allowlisted URL** (A5/A5b).
   `publicAssetPathFor()` gates on `(source, slug)` but `stage-public-assets.mjs`
   copies from the satellite's `path`, so `cv/academic` with
   `path: anthropic-fellow.pdf` publishes the fellowship PDF at
   `/pdfs/academic.pdf` with every guard green. This defeats D8/SEAM-B3 for the
   PDFs and is not detectable by the leak check (binary ⇒ path-only; and the
   item can be renamed away entirely, emptying the private set of that item).
   - **Recommended fix:** take SEAM-B3 **option 2** — the `cv` satellite splits
     the payload and never publishes the fellowship PDF (or publishes the public
     variants only). "Filter at render time" (ADR-0016 decision 7) protects the
     *pages* but leaves the private bytes in the bucket, which is exactly what
     the satellite then redirects.
   - **Alternative:** bind an allowlist entry to a content digest and have the
     hub verify the staged bytes' hash. Name-based allowlisting cannot express
     "this slug is public but only with the academic content".
   - Owner decision required: if the model accepts that an allowlisted slug's
     bytes are the satellite's to choose, record it explicitly as a residual; do
     not leave the impression that D8 protects the PDF interiors.

### Fix later

2. **Raw consumers trust unvalidated manifest JSON** (A4·4c). `collectPublicItems`
   (`frame-content.mjs:239-278`), `public-build.mjs`, `stage-public-assets.mjs`
   and `check-no-private-in-public.mjs` parse `manifest.json` directly and never
   check the slug pattern. A `hub`-named satellite with slug
   `research/soa-agentic-se` is treated as allowlisted-public by
   `effectiveVisibility()`; only the Zod loader (`content.config.ts`) fails the
   build. Not exploitable today because the loader runs in every build, but it is
   a single point of failure: a future consumer (Wave 3 RSS/search/OG) that
   forgets to route through validation would publish the forged item. Consider a
   shared `isSafeItem()`/pattern guard in the raw readers.

### Note

3. **First-party `hub` allowlist entries have no route-level enforcement.**
   The `site` handoff's Assumption 1 states this; I confirm it is unattacked by a
   satellite (first-party pages are committed, not published) but the claim
   "the allowlist is the only way to make something public" is not literally true
   for a new committed `src/pages` route — nothing checks it against the
   allowlist. Carry the proposed route guard forward.

4. **The leak check's binary limit is load-bearing for the BYPASS.** Its own
   `LIMITS` (`check-no-private-in-public.mjs:69`) say binaries are matched by
   path only, so a substituted PDF interior is invisible. Document this beside
   ADR-0005's "necessary, not sufficient" line.

5. **Historical URL is a 302 to `/signin/`, not a 410.** SEAM-B9/exit criteria
   accept "410 or sign-in, never 200", so this passes, but the owner may still
   want true 410 semantics (needs Hosting config the current deploy lacks —
   also flagged in the `site` handoff).

6. **GitHub Pages is a real, independent origin and was only checked statically.**
   The Pages-variant build (base `/website/`) has no artifact at the historical
   URL and no sitemap entry. The live Pages mirror remains a `main`-built,
   independent deployment until Phase 6; PR #86 is not merged, so I did not
   probe it (see Not attempted).

## Not attempted (with reasons)

- **Live HTTP probes** of `jason.cusati.us`, `cusati-hub.web.app`,
  `cusati-hub.firebaseapp.com` and `djjay0131.github.io/website` (status codes,
  `og:` tags, canonical URLs, `noindex`). Reason: no network deploy or mutation
  is permitted, and the Pages mirror tracks `main`, not this branch. Their
  *build inputs* were checked statically (A7/A7b) and the Firebase redirect
  rules were read from `firebase.json:40-56`.
- **Firebase Hosting redirect evaluation order** (302 vs static 404). Reason:
  cannot execute Firebase Hosting locally. Verified by reading the committed
  config; the 302-vs-410 semantics is the owner question in Finding 5.
- **RSS, search index and OG images.** Reason: none exist until Wave 3 (ADR-0005
  names them as derived outputs). If built, they consume `effective_visibility`
  from the collection, but that code is not present to attack.
- **The `hub/<path>` first-party route allowlist as an enforcement point.**
  Reason: no such guard exists (Finding 3); a satellite cannot author a
  first-party page, and attacking committed pages would require editing tracked
  source, which is out of scope.
- **The CI-generated `build-info.json`.** Reason: not produced locally; absent
  from `dist-public` here. The `site` handoff records the CI fix that removed the
  cv asset names from the fingerprint, so there is no name to search for.

## Related docs

- `llm/sprints/2026-09-hub/contracts/red-team-wave-0b.md`
- `llm/sprints/2026-09-hub/contracts/private-by-default-seams.md` (§SEAM-B3, B5, B6, B9)
- `llm/governance/adr/0016-private-by-default-publish-allowlist.md`
- `llm/governance/adr/0005-two-output-build-with-leak-check.md`
- `llm/sprints/2026-09-hub/handoffs/site-wave-0b.md`
