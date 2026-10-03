# Contract — `satellite-construction`, Wave 4 (Phase 5)

Status: Issued
Date: 2026-10-03
Owner: Lead Architect
Stream: `satellite-construction` — the `djjay0131/construction-ai-proposal`
checkout at `/home/djjay/code/construction-ai-proposal` (that repo only)
Issue: `hub-005`
Branch: `feat/hub-publish` (created by the Lead Architect from `master`)
Seams: `llm/sprints/2026-09-hub/contracts/phase-5-seams.md`

## Purpose

Make the repo a hub satellite: a contract-valid manifest and a publish workflow
that renders a small dist and publishes it through `contract/publish@v1`.

## Scope

That repo only: `manifest.json`, `.github/workflows/publish-hub.yml`, and any
small build helper the workflow needs. Do not rename existing content, do not
alter `main.pdf`, do not touch the hub checkout.

## Requirements

1. **`manifest.json`** at the repo root, per SEAM-C2:
   `source: "construction-ai"`, `manifest_version: "1"`, `published`, and two
   items — a `pdf` (`slug: construction-ai-proposal`, `path: main.pdf`) and an
   `html` (`slug: construction-ai-site`, `path: index.html`), both
   `section: projects`, `visibility: private`, with `title`, `date`, `summary`.
   Validate it against the hub schema if you can fetch it
   (`raw.githubusercontent.com/djjay0131/website/contract/manifest.schema.json`
   or the local checkout's `contract/validate-manifest.mjs`).
2. **`.github/workflows/publish-hub.yml`**, modelled on
   `agentic-kg-research/.github/workflows/publish.yml`:
   - triggers `push` to `master`, `workflow_dispatch`, and `pull_request`
     (build/validate only);
   - `permissions: contents: read, id-token: write`;
   - builds a `dist/` containing `main.pdf` (copy the committed root PDF) and a
     self-contained `index.html` generated from the repo README (a small node or
     shell step; no network dependency), plus `manifest.json`;
   - fetches `validate-manifest.mjs` and `manifest.schema.json` from
     `raw.githubusercontent.com/djjay0131/website/v1/…` by SHA-pinned fetch, and
     runs `node validate-manifest.mjs --dist dist --source construction-ai`;
   - publishes with `uses: djjay0131/website/contract/publish@v1` (`dist: dist`,
     `source: construction-ai`, `project_id: ${{ vars.GCP_PROJECT_ID }}`,
     `workload_identity_provider: ${{ vars.GCP_WIF_PROVIDER }}`,
     `service_account: ${{ vars.GCP_PUBLISH_SA }}`,
     `bucket: ${{ vars.GCP_CONTENT_BUCKET }}`), gated `if: github.event_name != 'pull_request'`;
   - every other `uses:` SHA-pinned with a `# vN` comment.
3. **No secret, key or machine path.** No content rename. Record any deviation
   from the brief ("`html` from its README") in the handoff.

## Evidence

- `node validate-manifest.mjs --dist <staged> --source construction-ai` green
  (use the local hub checkout's validator on a staged copy).
- `actionlint` clean if available; otherwise say NOT TESTED.
- A YAML parse and a dry listing of the dist contents.

The Lead Architect commits and pushes; you do not.
