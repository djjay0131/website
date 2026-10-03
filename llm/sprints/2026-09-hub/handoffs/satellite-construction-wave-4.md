# Handoff — `satellite-construction`, Wave 4 (Phase 5)

Stream: `satellite-construction`
Wave: 4 — Phase 5 satellite (`construction-ai-proposal`)
Repository: `djjay0131/construction-ai-proposal` (checkout `/home/djjay/code/construction-ai-proposal`)
Branch: `feat/hub-publish` (no commits made — the Lead Architect commits and pushes)
Date: 2026-10-03
Contract: `llm/sprints/2026-09-hub/contracts/satellite-construction-wave-4.md`
Seams: `llm/sprints/2026-09-hub/contracts/phase-5-seams.md`

**Nothing was committed, branched, pushed or published. No cloud call was made.**

---

## Summary

The repo is now a hub satellite. `manifest.json` declares source `construction-ai`
with two `section: projects`, `visibility: private` items (`pdf` →
`main.pdf`/`construction-ai-proposal`, `html` → `index.html`/`construction-ai-site`).
`.github/workflows/publish-hub.yml` builds a dist (copy `main.pdf`, generate a
self-contained `index.html` from `README.md`, copy `manifest.json`), fetches the
hub validator + schema at the `v1` ref, validates
`--dist dist --source construction-ai`, and publishes through
`djjay0131/website/contract/publish@v1` with the four `vars.GCP_*` inputs, gated to
non-PR events. The existing `build-and-publish-pdf.yml` is untouched. The local hub
validator passes all three checks (`schema`, `paths`, `source`) on a dist staged
exactly as the workflow stages it.

---

## Files added

| File | Purpose |
|---|---|
| `manifest.json` | The hub contract manifest (2 items, both private, `section: projects`). |
| `.github/workflows/publish-hub.yml` | Build → validate → publish; push to `master`, `workflow_dispatch`, `pull_request` (build/validate only). |
| `tools/build-site.mjs` | Tiny dependency-free README→HTML generator for the self-contained `index.html`. |

Not touched: `.github/workflows/build-and-publish-pdf.yml`, `main.pdf`, all existing
content. No `sources/…` allowlist entry (SEAM-C4), no hub checkout change.

---

## Validator output

Staged exactly as the workflow does:

```
mkdir -p /tmp/ca-dist
cp main.pdf /tmp/ca-dist/
node tools/build-site.mjs /tmp/ca-dist
cp manifest.json /tmp/ca-dist/
node /home/djjay/code/website/contract/validate-manifest.mjs \
  --dist /tmp/ca-dist --source construction-ai
```

Exact output:

```
Manifest check "schema" passed (/tmp/ca-dist/manifest.json).
Manifest check "paths" passed (/tmp/ca-dist/manifest.json).
Manifest check "source" passed (/tmp/ca-dist/manifest.json).
```

Exit 0. The three checks were also run individually (`--check schema`,
`--check paths`, `--check source --source construction-ai`) and each passed. Dist
listing (this is exactly what the workflow publishes):

```
/tmp/ca-dist/index.html     HTML document, ASCII text
/tmp/ca-dist/main.pdf       PDF document, version 1.7
/tmp/ca-dist/manifest.json  JSON text data
```

`actionlint`: **NOT TESTED** — not installed anywhere on this machine
(`command -v actionlint` empty; no binary under `/usr/local/bin`, `/usr/bin`,
`~/go/bin`). A YAML parse (`python3 -c "yaml.safe_load(...)"`) is clean. The
workflow is otherwise modelled line-for-line on
`agentic-kg-research/.github/workflows/publish.yml` and
`agentic-kgis/.github/workflows/docs-publish.yml`, both of which are actionlint-clean.

---

## Exact generated `index.html` approach

- `tools/build-site.mjs` reads `README.md` and writes `dist/index.html`.
- It is **dependency-free and offline** (no `npm install`, no CDN, no network).
- Minimal block parser: ATX headings (`#`..`######`) and blank-line-separated
  paragraphs. All text is HTML-escaped, so README content cannot inject markup.
- The page uses an **inline `<style>`** only — no `<link>`, no `<script>`, no
  `@import`, no `url(…)`, no remote fonts. Grep audit over the generated file:
  `no external resources / scripts / links`.
- The PDF is linked **relatively**: `<a class="download" href="main.pdf">…</a>`,
  so it resolves from whatever prefix the hub serves the dist under
  (`sources/construction-ai/index.html` → `sources/construction-ai/main.pdf`).
- Generated page (verbatim body): the README `<h1>` `construction-ai-proposal`, the
  README paragraph, then the relative PDF download link.

---

## Assumptions

1. **`published` and item `date` are `2026-10-03`** (today), `published` as
   `2026-10-03T00:00:00Z`. The contract gives no document date; the Phase-2
   reference manifest (`agentic-kg-research`) uses the publish timestamp/date for
   both envelope and item. `published` is appended per publish by convention, but
   this repo has no generator, so a static value is committed and the workflow does
   not rewrite it. If the hub expects a fresh timestamp each publish, that is a
   follow-up (see open questions).
2. **Titles/summaries paraphrase existing content only** — README (`README.md`) and
   the proposal abstract (`proposal/main.tex`) — no new claims. Tags are from the
   domain vocabulary already present in those files.
3. **Dist root holds only the three manifest-described files.** `main.pdf` is the
   committed root PDF; it is copied, never rebuilt (contract item 3).
4. **`v1`, not a 40-hex SHA, in the two fetch URLs** — see deviation below.

---

## Risks

- **No `actionlint` run here.** YAML parses and the pattern is copied from two
  actionlint-clean satellites, but this workflow has not been through actionlint.
  Low risk; the Lead Architect's CI gate should still see it.
- **`main.pdf` drift.** The `publish-hub.yml` path filter triggers on `main.pdf` but
  the PDF is produced by the separate `build-and-publish-pdf.yml`, which does not
  commit the rebuilt root PDF. If the root `main.pdf` is ever stale, the hub
  publishes the stale file. Pre-existing condition, not introduced here.
- **`published` is static.** The envelope timestamp does not advance per publish.
  If the hub keys ordering or change-detection off `published`, publishes after the
  first may look identical. Item `date` is likewise static.
- **Private items are invisible in the public build** by design (SEAM-C4); nothing
  appears in the public index until an owner-driven allowlist edit.

---

## Open questions

1. Should `published` be regenerated on each publish (e.g. a workflow step that
   rewrites it before upload), as a generated-manifest satellite would? The brief
   said not to invent content, so I left a static value.
2. The brief/contract phrase "*SHA-pinned fetch as the template does*" sits against
   the same sentence's explicit `raw.githubusercontent.com/djjay0131/website/v1/…`
   URL and against **ADR-0014 decision 4**, which requires the fetched contract
   files to carry `v1` (not a commit SHA) so contract fixes reach satellites. I
   followed `v1` + the template. Flagging in case the Lead Architect intended a
   SHA and wants an ADR override.

---

## Deviation from the brief

- **`html` item is a generated landing page, not a literal README markdown
  render.** `README.md` is two lines (a heading and one sentence), so there is no
  README→HTML rendering to reuse and nothing to invent. The page *is* generated
  from `README.md` (heading + paragraph, escaped) plus a relative link to
  `main.pdf`. This is the conservative reading recorded in **SEAM-C2**: a `pdf`
  item alone is listed without a link, so the `html` item is what makes the project
  clickable, and this satisfies it.
- **Fetch ref is `v1`, not a 40-hex SHA** (see open question 2). Everything else
  (`actions/checkout`, `actions/setup-node`) is SHA-pinned with a `# vN` comment;
  `djjay0131/website/contract/publish@v1` is the deliberate ADR-0014 carve-out.
- **Path filters added** to `push`/`pull_request` (README, `main.pdf`,
  `manifest.json`, the generator, the workflow), following the reference template's
  `paths:` block. The brief named the triggers but not filters.
