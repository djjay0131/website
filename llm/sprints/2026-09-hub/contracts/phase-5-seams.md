# Wave 4 seams — Phase 5 satellites (`construction-ai-proposal`)

Status: Active
Issued: 2026-10-03
Owner: Lead Architect
Issue: `hub-005`
Branch: `feat/construction-ai`

Design authority: design doc §2 and §11 Phase 5; owner decisions D4/D10 (satellite
order) and D8 (private by default). The roadmap's `phase-5-satellites` acceptance
criteria are authoritative.

## SEAM-C1 — The source key is `construction-ai`, not the repo name

The roster variable validates `length(source) <= 22` because the service-account
id is `publish-<key>` and a GCP service-account id is at most 30 characters
(`infra/variables.tf`). `construction-ai-proposal` is 24, so
`publish-construction-ai-proposal` is 32 — invalid, and there is no truncation
fallback. The key is therefore **`construction-ai`** (15): provider
`github-construction-ai`, SA `publish-construction-ai`, prefix
`sources/construction-ai/`. Precedent: the source key is independent of the repo
name (`kgis` for repo `agentic-kgis`). The repo stays
`djjay0131/construction-ai-proposal`; `default_branch` is **`master`**.

## SEAM-C2 — The satellite dist and manifest

The satellite publishes a `dist/` containing `manifest.json` at its root and:

- **`main.pdf`** — the committed proposal PDF at the repo root, copied into the
  dist. One `pdf` item, `slug: construction-ai-proposal`, `section: projects`,
  `visibility: private`.
- **`index.html`** — a generated, self-contained landing page (built in the
  publish workflow from the repo README and listing the PDF). One `html` item,
  `slug: construction-ai-site`, `section: projects`, `visibility: private`. The
  `html` item is what makes the project clickable in the index; a `pdf` item is
  listed without a link (`site/src/pages/projects/index.astro`).

`source: construction-ai`, `manifest_version: "1"`. `pdf`/`html` items carry no
`schema_version`. Paths are relative to the dist root, no `..`, no backslash.

> The completion brief's "`format: pdf` + `html` from its README" presupposes a
> README→HTML rendering that does not exist (the README is two lines). The
> generated landing page satisfies the `html` item; recorded as the conservative
> reading rather than inventing content.

## SEAM-C3 — Publish through the contract, at `@v1`, SHA-pinned tooling

A new `.github/workflows/publish-hub.yml` in the satellite, modelled on
`agentic-kg-research/.github/workflows/publish.yml`: build the dist, stage
`manifest.json`, fetch `validate-manifest.mjs` + `manifest.schema.json` from
`raw.githubusercontent.com/djjay0131/website/v1/…`, validate with
`--source construction-ai`, then
`uses: djjay0131/website/contract/publish@v1` with the four `vars.GCP_*` inputs.
Every `uses:` is SHA-pinned except the hub's own `@v1` (ADR-0014). Publish is
gated `if: github.event_name != 'pull_request'`; the PR run validates with the
publish skipped.

## SEAM-C4 — Private until allowlisted

Both items declare `visibility: private` and are **not** added to
`site/publish-allowlist.json` in this wave. They render in the private build only;
the public index/leak check carry no trace. Turning them public is a later,
owner-driven L0 allowlist edit (ADR-0016).

## SEAM-C5 — The hub needs no template change

`site/src/pages/projects/index.astro` already lists `section: projects` items from
manifests via `collectPublicItems`, with no hand entry. A synced
`sources/construction-ai/manifest.json` appears automatically once public. No
site-code change is required for Wave 4; add `construction-ai` to
`EXPECTED_SOURCES` with `required: true` only **after** its first publish, on the
pattern `kgis` used.

## SEAM-C6 — Boundary proof

The new `publish-construction-ai` identity must be proven, under a temporary
impersonation grant removed and verified removed: create/overwrite/read/delete
inside `sources/construction-ai/`; refuse `sources/cv/`, `sources/kgis/`,
`sources/agentic-kg-research/`, a `sources/construction-ai-evil/` sibling and the
bucket root; no `list`; and the reverse leg — `cv` refused read and write against
`sources/construction-ai/`.
