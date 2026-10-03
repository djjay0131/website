# Handoff — `site` hardening, Wave 5 (Phase 6)

Agent: site hardening stream (fixes only; no other wave-5 surface touched)
Branch: `feat/phase-6` · hub `/home/djjay/code/website` · base HEAD `1cecb35`
Scope: `site/scripts/**` + tests; `.github/workflows/**` deliberately untouched
Findings fixed: Red Team B5/B4/B1–B3, Skeptic G1/G0, Dissenter D2/D3
Not addressed (out of this stream's five items): Red Team B6 (short titles),
Dissenter D1 (`redirects:check` CI wiring), D4 (old-Pages premise), D5 (RSS item
set), D6 ("retired" wording) — see those handoffs.

## Summary

Five fixes land, each with a committed test shown red under a one-line mutation.
The traversal and escaping guards had **no test** (Skeptic G0/G1); the Pagefind
payloads were declared binary and never read (B1–B3); deleting the Pagefind entry
file switched the structural index guard off (B4); and file-shaped legacy URLs
were HTML stubs at extension paths Pages serves with the file's MIME (D2).

Pagefind format finding: `.pf_fragment`, `.pf_meta` and `.pf_index` are **gzip
streams that `node:zlib`'s `gunzipSync` decompresses**. There is no need for the
alternative structural-only fallback the task offered; the decompressed bytes are
scanned as UTF-8 with the same needles, and a `.pf_*` file that fails to gunzip
falls back to the existing PATH-only rule.

## Fix 1 — stub path traversal (Red Team B5, Skeptic G1)

`site/scripts/generate-redirect-stubs.mjs`

`stubRelativePath` now rejects a `from` not under `/website/`, containing a
backslash, or containing any `.` / `..` / interior-empty path segment (a single
trailing slash is still the directory marker). `generateRedirectStubs` **validates
and classifies every entry before touching the filesystem**, so one hostile entry
writes nothing at all — no `pwned.html` beside `outDir`, no overwrite of the
`dist-public` deploy artifact. `escapeHtml` is now exported.

Mutation → red (`npx vitest run scripts/generate-redirect-stubs.test.ts`):
`if (segment === "" || segment === "." || segment === "..")` → `if (false)` and
`raw.includes("\\")` check disabled:

```
× refuses `..`, `.`, empty segments and backslashes (fail closed)
× writes nothing outside outDir for the exact hostile entry
× cannot overwrite the deploy artifact via `from: /website/../dist-public/index.html`
Tests  3 failed | 16 passed
```

## Fix 2 — `checkSearchIndexScope` no longer no-ops (Red Team B4)

`site/scripts/check-no-private-in-public.mjs`

The guard now returns clean **only when there is no `pagefind/` directory at all**
(a fixture build without search). If `pagefind/` exists but
`pagefind/pagefind-entry.json` is missing or unreadable, it pushes a problem and
fails. The fragment/URL structural assertions are unchanged.

Mutation → red (`npx vitest run scripts/check-derived-outputs.test.ts`):
`if (!entryReadable)` → `if (false && !entryReadable)`:

```
× FAILS when pagefind/ exists but the entry file is missing
Tests  1 failed | 13 passed
```

## Fix 3 — HTML escaping is pinned (Skeptic G0 / un-failable)

`site/scripts/generate-redirect-stubs.test.ts` (+ `escapeHtml` exported)

New tests pin `escapeHtml` against `<script>`, `"`, `'`, `&`, pin that a
markup-bearing `to` cannot break out of `content="0; url=…"`, and pin that
`to: "javascript:alert(1)"` becomes `url=https://jason.cusati.us/javascript:alert(1)`
(canonicalTarget prefixes the scheme; escaping is not what neutralizes it).

Mutation → red: `escapeHtml` body → `return String(value);`:

```
× escapes <script>, double/single quotes and ampersands
× a markup-bearing `to` cannot break out of the refresh attribute
Tests  2 failed | 17 passed
```

(The `javascript:` test stays green under this mutation by design: it pins the
`canonicalTarget` origin prefix, a separate guard.)

## Fix 4 — Pagefind gzip payloads are contents-scanned (Red Team B1–B3, Dissenter D3)

`site/scripts/check-no-private-in-public.mjs`, `site/scripts/demo-leak-check.mjs`

`decompressPagefind()` gunzips `.pf_fragment` / `.pf_meta` / `.pf_index` and the
contents pass scans the UTF-8 bytes with the same needles; a failed gunzip keeps
the PATH-only rule. `demo:leak-check` now plants the private title into a valid
gzip `.pf_fragment` plus a `.pf_meta` and a `.pf_index` (and still into
`pagefind-entry.json`), so the deliberate failing run exercises the search-index
payloads, not just the entry JSON.

Mutation → red (`npx vitest run scripts/check-derived-outputs.test.ts`):
`let text = decompressPagefind(...)` → `let text = null;`:

```
× finds a private title decompressed from a .pf_fragment
× finds a private title decompressed from a .pf_meta and a .pf_index
Tests  2 failed | 12 passed
```

`demo:leak-check` names all three payload paths (`…/en_demo_plant.pf_fragment`,
`…/pagefind.en_demo.pf_meta`, `…/index/en_demo.pf_index`).

## Fix 5 — file-shaped legacy URLs forward via `404.html` (Dissenter D2)

`site/scripts/generate-redirect-stubs.mjs`

`isHtmlNavigable(rel)` splits the map: directory routes / `.html` still get a
per-path meta-refresh stub; every other entry (`.pdf`, `.json`, `.xml`, `.png`,
`.svg`, `.ico`, `.jpeg`, `robots.txt`) gets **no per-path file** and is listed in
a single `404.html` inline script that maps `location.pathname` from
`/website/<path>` to `https://jason.cusati.us/<path>`, preserving search and hash
(plus the generic `/website/**` fallback). Every injected value is JSON/`\u`-escaped
for the script context and HTML-escaped for the body.

Important collateral found and handled: the previous code wrote the **same**
`404.html` into `dist-public`, and embedding the legacy file paths there tripped
the leak check on `/website/pdfs/anthropic-fellow.pdf` (bounded slug in a public
build). The Firebase mirror is now written with `render404()` (empty file-route
list); the list lives only in the Pages stubs artifact, where ADR-0020 accepts a
path.

Mutations → red (`npx vitest run scripts/generate-redirect-stubs.test.ts`):

- `isHtmlNavigable` → `return true`:

```
× writes a per-path stub for HTML-navigable entries and 404.html for the rest
× a `.pdf` entry produces no per-path stub and is listed in the 404 mapping
Tests  2 failed | 17 passed
```

- `escapeScriptString` body → `String(value)`:

```
× lists file-shaped entries and escapes every injected value (Dissenter D2)
Tests  1 failed | 18 passed
```

## Verification (exact counts, this working tree)

Run in order from `site/`:

| Command | Result |
|---|---|
| `npm test` | **30 files, 403 passed \| 1 skipped (404)** — baseline 30 / 392 \| 1 (393); +11 tests |
| `npm run build:public` | 27 page(s) built |
| `npm run redirects:stubs` | **41 meta-refresh stubs + 404.html for 16 file-shaped routes** (57 map entries); `dist-redirects` **42 files** (was 58); `dist-redirects/pdfs/academic.pdf` **absent**; Pages `404.html` lists 16 entries, `dist-public/404.html` lists 0 |
| `npm run search:index` | 29 pages, 29 `.pf_fragment`, 5633 words |
| `npm run check:no-private-in-public` | **PASS, exit 0** — 210 dist-public + 42 dist-redirects files, 4 private items, 0 leaks, 0 scope problems |
| `npm run demo:leak-check` | **exit 0** — inner check exit 1 with 18 leaks; all **10** planted outputs named, including the three `.pf_*` payloads |
| `npm run build:private` | 6 page(s); `search`, `pagefind`, `rss.xml`, `404.html` all **absent** |

Final `git diff --exit-code` mutations scan: no `if (false)` / debug leftovers.

## Files changed

- `site/scripts/generate-redirect-stubs.mjs`
- `site/scripts/check-no-private-in-public.mjs`
- `site/scripts/demo-leak-check.mjs`
- `site/scripts/generate-redirect-stubs.test.ts`
- `site/scripts/check-derived-outputs.test.ts`

Not committed. `.github/workflows/**` untouched.
