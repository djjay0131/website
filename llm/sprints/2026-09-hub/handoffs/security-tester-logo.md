# Handoff — Security Tester, L1 follow-up wave "logo" (D16)

Status: Delivered
Date: 2026-10-04
Branch: `feat/logo` (HEAD `e79f0d8`); `main` `9bd10ed`
Authority: contract `llm/sprints/2026-09-hub/contracts/logo-wave.md`
(amended design `llm/specs/2026-10-01-branding-design.md`, ADR-0015 amendment 2026-10-04)
Mode: read-only. No source written, no git/gh/cloud mutation. This report is the only file written.

## Summary

The wave honours the owner's security constraint in full: **no new served paths beyond
`/badges/`, and no change to the gate, `firebase.json` rewrites, or any other infra/build
workflow.** The only public assets added are the two badge PNGs; both are clean, palette
PNGs with no EXIF/ICC/IPTC/XMP/text chunks and no trailing or polyglot bytes. The
public/private boundary is green across all four required commands. Repointing `og:image`
to the pre-existing `/emblem/research-emblem.png` introduces no new exposure: the emblem
was already served and linked on `main`, is a vector-authored mark (not the portrait), and
carries no private content. The gate's own segment regex accepts both badge filenames; the
`-2x` suffix is used (no `@`).

**FAIL count: 0.** No blocking finding. Merge is not blocked by this tester.

## Checks

One row per §6-relevant check.

| # | Check | Evidence | Verdict |
|---|---|---|---|
| 1 | No gate / firebase / infra / workflow change | `git diff main...feat/logo -- gate infra contract .github firebase.json site/firebase.json` → **empty**. Full `--stat` shows only: 2 badge PNGs, `SiteBand.astro`, `Base.astro`, `index.astro`, `redirects/github-pages.json`, `ADR-0015`, spec, `STATE.md`, `contracts/logo-wave.md`. No `site/firebase.json` exists. | **PASS** |
| 2 | Only new public paths are the two badge PNGs | `git diff --name-only --diff-filter=A main...feat/logo -- site/public` → exactly `.../badges/vt-badge-hokiebird-laptop-tower-research-today.png` and `...-2x.png`. `git diff --name-status main...feat/logo -- site/public` shows `A` for those two and nothing else. `/emblem/` already tracked on `main`. No new page routes (`git diff --name-only … -- site/src/pages` → only existing `index.astro`). | **PASS** |
| 3 | New files are static-only, no private content / unexpected metadata | 1x: PNG, 200×200, palette (IHDR, PLTE, tRNS, pHYs, IDAT, IEND), 13,775 B. 2x: PNG, 400×400, 38,611 B. `sharp` reports `exif=false, icc=false, iptc=false, xmp=false, comment=undefined` for both; no `tEXt/zTXt/iTXt/eXIf` chunks; PNG signature intact, **0 trailing bytes after IEND**; `strings` finds no readable text, only compressed IDAT. Not the fixture portrait (1×1 JPEG, different format/hash). Both well under the 150 KB cap. | **PASS** |
| 4a | `npm run build` (public) | Completed; 27 pages; `/badges/` present in `dist-public/badges/`; `dist-public/index.html` `og:image` = `https://jason.cusati.us/emblem/research-emblem.png`. | **PASS** |
| 4b | `npm run demo:leak-check` | Exited **0**: "the guard failed on the injected leak in all 10 output(s) … real `dist-public`/`dist-redirects` never modified." Guard is demonstrably red→green. | **PASS** |
| 4c | `npm run build:private` (SD-7 gate-segment check) | Exited **0**: "checked **102** emitted path(s) against the gate's allowlist (SD-7)". Private items staged as expected. | **PASS** |
| 4d | `npm run check:no-private-in-public` | Exited **0**: "**PASS** — no private slug, route, payload path, title or summary appears in any path or file's contents under `dist-public` (166 files) and no private title/summary in any stub under `dist-redirects` (42 files)." | **PASS** |
| 5 | `og:image` → `/emblem/research-emblem.png` adds no security/privacy issue; not the portrait; no private content | Emblem is a 1200×1200, 190,461 B PNG that already existed on `main` (`git ls-tree main -- site/public/emblem`). Its SVG (`400×400`, vector, no `<image>`/`foreignObject`) is the rings mark, not a likeness; spec/ADR state the portrait is never served. `og:image` is an absolute `https://jason.cusati.us/…` URL to an existing public path — no new path, no private content. (See Finding F2 re: embedded provenance.) | **PASS** |
| 6 | Badge filename is gate-servable (`[A-Za-z0-9._-]`); `-2x` not `@2x` | Gate `gate/app/serve.py:23` `_SEGMENT = ^[A-Za-z0-9._-]+$`. Ran the compiled regex against both filenames + `badges` → all `True`. Filenames contain no `@`; multi-resolution suffix is `-2x`. | **PASS** |

**FAIL count: 0.**

## Findings

- **F1 — Constraint met exactly.** No tracked/emitted public path outside `/badges/` is
  added. `dist-public` gains only the two badge files; the home route `/` is an existing
  route whose markup changed.
- **F2 — Emblem PNG carries a C2PA Content Credentials manifest (`caBX` chunk, 5,758 B).**
  It declares `com.anthropic.claude.provided`, `name: Claude`, `claim_generator_info`
  `Anthropic Files 1.0.0`, and an Anthropic signing chain. The emblem SVG carries the same
  manifest in a `<c2pa:manifest>` element. This is **not new exposure** — the emblem, its
  manifest, and its public path all predate this wave and were already linked from the band
  on `main`. It is provenance/transparency metadata, not private user data. No action
  required for this wave; noting it because `og:image` causes preview crawlers to fetch the
  same bytes and redistribute them.
- **F3 — Redirect map additions are within scope.** `site/redirects/github-pages.json` gains
  two entries (`/website/badges/… → /badges/…`) for the GitHub Pages mirror. These are the
  mirror's routing mechanism for the same `/badges/` content, not a new gated or private
  surface; `firebase.json` is untouched, so the Firebase public surface is unchanged.
- **F4 — No private leak on any new surface.** Neither the emblem nor the badges appear in
  the private item set; `check:no-private-in-public` and the SD-7 allowlist check are green
  with them present.
- **F5 — Evidence basis for "not private content".** The badge's pixels could not be viewed
  by this agent (model has no image input). The determination rests on: clean chunk
  inventory, absent text metadata, palette-based illustration statistics, the contract's
  named provenance (owner AI-generated badge), and the descriptive `alt`. A visual pass
  remains with the a11y/reviewer agents.

## Risks

- **Low — C2PA provenance distribution (F2).** Link-preview crawlers fetching the OG emblem
  will now pull an image whose bytes assert "Claude provided/modified this file". This is
  already true of the in-band emblem on every page; the marginal delta is crawler caching.
  Acceptable; revisit only if the owner wants provenance-free public art.
- **Low — GitHub Pages redirect stubs (F3).** The mirror will serve `/website/badges/*`
  redirect stubs after its next build. They redirect to the same badge assets; no new data
  is exposed. Confirm the mirror's stub generation runs before the Pages deploy.
- **Low — trademark, not security.** The badge depicts the HokieBird (licensing declined);
  that is an owner-known, recorded caveat (D16), outside the security boundary.

## Open questions

1. Should the public emblem be re-encoded without the C2PA `caBX` chunk? It predates this
   wave, so it is out of scope here; flag if provenance metadata on public art is undesirable.
2. Does the GitHub Pages pipeline regenerate `dist-redirects` stubs from the amended map
   before the next mirror deploy (so `/website/badges/*` does not 404)?

## ADR candidates

- None new. The C2PA-in-public-art question (Open question 1) could become a one-line policy
  note in ADR-0015 if the owner wants provenance stripped from served assets, but it is not
  required by this wave and does not block merge.
