# Handoff — Security Tester, Wave 8 (Rabbit Holes, D21)

- **Wave:** 8 · **Branch:** `feat/rabbit-holes` · **Design:** D21, ADR-0023
- **Run by:** the Lead Architect, acting as Security Tester for this wave (a solo
  run; there is no separate sub-agent session). Every check was executed against
  the working tree, not asserted.

## Verdict: 0 FAIL

| # | Check | Verdict | Evidence |
|---|---|---|---|
| 1 | **Draft leakage** — a `draft: true` post reaches no public surface | **PASS** | `node scripts/check-no-private-in-public.mjs --stubs dist-redirects` → PASS with 4 private items **and** 1 draft post, 180 files scanned. `grep -rl "why-a-blog-called-rabbit-holes\|Why a blog called Rabbit Holes" dist-public` → **0**. With the post temporarily set `draft: false`, the build emitted the post page, an OG PNG, the sitemap entry and full-content feed items; reverted to `draft: true`, every one is absent again. |
| 2 | **HTML injection via Markdown / frontmatter** | **PASS** | Astro escapes Markdown body text; `escapeXml` escapes `title`/`summary` in RSS/Atom and Astro escapes them in HTML. `src/lib/rabbit-holes.test.ts` plants `<script>alert(1)</script>` and `"><img onerror=...>` as title/summary and asserts the RSS/Atom contain `&lt;script&gt;` (not `<script>`) and still parse (`parsererror` null). The JSON Feed carries them as ordinary JSON string values. |
| 3 | **One external endpoint** — the Buttondown form | **PASS** | `src/components/RabbitHolesSubscribe.astro` has **no `<script>`** and exactly one off-origin endpoint: the form `action="https://buttondown.email/api/emails/embed-subscribe/<username>"` (POST). The only other URL is a plain `https://buttondown.email` hyperlink in the note text. No SDK, no iframe, no image/pixel. When `PUBLIC_BUTTONDOWN_USERNAME` is unset the form is not rendered at all. |
| 4 | **Feed and OG paths carry no private item or draft** | **PASS** | The feeds are built from `getPublishedPosts()` (drafts filtered) and the OG integration reads `publishedRabbitHoles(...)`; a draft produces neither a feed item nor an OG file. The OG files are written into the build **output** only (`<outDir>/rabbit-holes/og/`), never `public/` or a committed tree. Leak check covers the built feeds/sitemap/Pagefind/OG by walking all of `dist-public`. |
| 5 | **Boundary unchanged** — the private build is unaffected | **PASS** | `npm run build:private` → 7 pages, `find dist-private -path '*rabbit-holes*'` → **0**. The private build has no feed route (endpoints live under `src/pages/`). `check:private-links` unchanged. |
| 6 | **Lighthouse accessibility ≥ 95** on the index and a post (D21) | **PASS** | `lighthouse@12 --only-categories=accessibility` (headless Chrome) against a local server: `/rabbit-holes/` → **1.0**, `/rabbit-holes/why-a-blog-called-rabbit-holes/` (post temporarily published for the run, then reverted) → **1.0**. The one sub-1 audit found first (`link-in-text-block`) was fixed by underlining in-text links in the subscribe block. |

## Checks performed and their results

```
npm test                                 533 passed | 2 skipped (37 files)
node scripts/check-no-private-in-public  PASS (4 private + 1 draft; 180 files)
npm run build:public                     35 pages; /rabbit-holes/** emitted
npm run build:private                    7 pages; no rabbit-holes route
governance-checks.mjs --layout           4 of 4 PASS
```

## Residuals (recorded, not hidden)

- **Repo-external redirect stubs** are scanned for titles/summaries only, as for
  every private item (ADR-0020). A draft's route in a stub is not a leak of
  content; drafts are not in the redirect map at all.
- **The Buttondown username is a build-time value**; a typo renders a broken form.
  The security-relevant property (one external endpoint) holds regardless of the
  value.
- **`private-structure.test.ts`** still proves the one-way import arrow; the new
  public modules import nothing from `src-private/`.
