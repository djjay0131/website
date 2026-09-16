# Phase 2 seams — binding interfaces between the four streams

Status: Active
Last updated: 2026-09-16
Owner: Chief Architect (Lead Architect)

## Purpose

Phase 2 runs four implementation streams in parallel across two repositories. This
document fixes the interfaces between them **before** any stream starts, so each can
be written and verified independently. Every specialist contract cites this file.

A seam is binding. A specialist that believes a seam is wrong **reports it and
stops** at that seam; it never renegotiates one unilaterally, and never edits a file
outside its own scope to make one fit.

## Scope

The four streams:

| Stream | Repository | Owns |
|---|---|---|
| `contract` | `website` | `contract/**` — the JSON Schema, the publish action, `contract/README.md` |
| `infra` | `website` | `infra/**` — content bucket, satellite identities, WIF pool |
| `site` | `website` | `site/**` — content collection, CV rendering from the payload, build wiring, `.github/workflows/build.yml` |
| `satellite-cv` | `cv` | the `cv` repository's publish workflow and manifest |

## SEAM-1 — The manifest is the only interface

`contract/manifest.schema.json` is the single definition of a manifest. The Astro
collection schema in `site/src/content.config.ts` mirrors it field for field, and
both ends validate against it (design doc §4).

- The **`contract`** stream owns the JSON Schema and is the sole author of it.
- The **`site`** stream mirrors it in Zod and **must not** add, rename, widen or
  narrow a field. A mismatch is a seam defect: report it, do not paper over it.
- A shared test fixture, `contract/examples/manifest.example.json`, is the design
  doc §4 example verbatim. Both ends validate it in their own test suites. Both
  ends must also reject each of `contract/examples/invalid/*.json`.

Fixed sets, from design doc §4 as amended by ADR-0008:

```
section    ∈ { research, projects, writing, cv, phd }
format     ∈ { md, mdx, html, pdf, bundle, data }
visibility ∈ { public, private }
```

Required per item: `slug`, `title`, `section`, `format`, `path`, `visibility`,
`date`. Optional: `summary`, `tags`. Required on the manifest: `source`,
`published`, `items`. A `data` item — and **only** a `data` item — additionally
carries `schema_version`, a **string** matching `^[0-9]+(\.[0-9]+){0,2}$`
(`cv-data` uses `"1"`).

`manifest.json` sits at the **root of `dist/`**, and every `path` is relative to
that same `dist/`.

**Amended 2026-09-16, on the contract stream's finding.** SEAM-1 previously stated
slug uniqueness as a property of the schema. **JSON Schema draft 2020-12 cannot
express it** — there is no "unique by property" keyword, and a non-standard one
would be silently ignored by conformant validators, including the site's mirror.
So enforcement is split, and each end must implement its half deliberately:

| Rule | Enforced by |
|---|---|
| Field presence, types, fixed sets, no unknown fields | the JSON Schema — **both** ends, from `contract/manifest.schema.json` |
| `slug` unique within a manifest | **named code beside the schema**, at both ends. A conformant validator *accepts* a duplicate slug; the `site` stream must implement this check explicitly rather than assume its Zod mirror covers it |
| `path` does not escape `dist/` — no absolute path, no `..` segment | the schema's `path` pattern, **and** the publish action's own filesystem check, which additionally catches a **symlink** leading outside `dist/` that the pattern cannot see (ADR-0002) |
| manifest `source` equals the `source` input | the publish action |

The §4 shared fixture is a `private`/`phd` item, so the site's mirror must
**accept** `visibility: private` in Phase 2 even though nothing private is
published until Phase 3. Accepting it is not publishing it.

## SEAM-2 — Bucket layout

```
gs://<content-bucket>/sources/<source>/manifest.json
gs://<content-bucket>/sources/<source>/<path…>      # exactly the satellite's dist/
```

- `<source>` matches `^[a-z][a-z0-9-]{0,38}$` and equals the manifest's `source`.
- The prefix is literally `sources/<source>/`. IAM conditions match this literal
  string (STATE K5); no stream may vary it.
- The bucket name is a Terraform **output** of the `infra` stream
  (`content_bucket_name`) and a GitHub Actions **variable** `GCP_CONTENT_BUCKET`
  consumed by the `site` and `satellite-cv` streams. No stream hardcodes it.

## SEAM-3 — Satellite identity and its deliberate limits

Per satellite, the `infra` stream creates: one service account, one WIF provider in
the **`satellites`** pool (separate from the hub's `github-actions` pool), and one
conditional binding on the content bucket (ADR-0007).

The grant is a project **custom role** containing exactly:

```
storage.objects.create      storage.objects.delete      storage.objects.get
```

bound with:

```
resource.type == 'storage.googleapis.com/Object' &&
resource.name.startsWith('projects/_/buckets/<bucket>/objects/sources/<source>/')
```

**`storage.objects.list` is never granted to a satellite.** It cannot be restricted
by prefix, so it would let any satellite enumerate every other source's object names
— in Phase 3, private ones. This is the binding constraint of the whole phase.

Consequences every stream must respect:

- The publish step **must not require `list`**. `gcloud storage cp --recursive`
  requires `storage.objects.list` and is therefore forbidden as the publish
  primitive. Use `google-github-actions/upload-cloud-storage` (pinned by SHA), which
  globs locally and uploads per file.
- `delete` is granted because replacing an object needs `create` **and** `delete`;
  `roles/storage.objectCreator` cannot overwrite, so a republish would fail without it.
- The `cv` provider condition admits `refs/heads/master` — `cv`'s default branch is
  `master`, not `main` (ADR-0008).

## SEAM-4 — How the hub learns of a publish

Polling, not dispatch (ADR-0007). The `site` stream owns this in `build.yml`:

- The existing `check` job is extended to fingerprint the **bucket**, replacing the
  `cv` GitHub-release fingerprint. The fingerprint must cover the whole object set,
  **including deletions** — a withdrawn item must change it.
- It compares against `.content_fingerprint` in the deployed `build-info.json`, the
  same mechanism Phase 1 uses for `cv_fingerprint`.
- The poll job authenticates through WIF. Scheduled runs carry
  `ref: refs/heads/main`, so the existing `refs/heads/main` binding admits them; no
  new binding is needed.
- `repository_dispatch: [cv-updated]` is **removed** from `build.yml`, and
  `site/scripts/fetch-data.sh` is **deleted**.
- The hub's deploy identity gains read access to the content bucket
  (`roles/storage.objectViewer`, unconditioned — the hub owns the bucket).

## SEAM-5 — The `data` payload and CV rendering

The `cv` satellite publishes (ADR-0008):

| Item | format | path |
|---|---|---|
| `academic`, `research-professional`, `anthropic-fellow`, `sde-long` | `pdf` | `<variant>.pdf` |
| `cv-data` | `data` | `cv-data/` |

The `cv-data` payload contains exactly today's `cv-data.zip` contents, unzipped:
`data/content/*.yaml`, `data/variants/*.yaml`, `own-bib.bib`, `photo_jason_1.jpeg`.

- The `site` stream keeps `site/src/lib/cv-data.ts` and every CV page **unchanged in
  output**, repointing only where the files are read from. Every route in
  `SMOKE_ROUTES` must still resolve, and `/cv/<variant>`, `/resumes/`, `/projects/`
  and `/` must render as they do today.
- The hub claims exactly one `data` item: `("cv", "cv-data")`. Any other `data` item
  **fails the build**, as does an unrecognised `schema_version`.
- PDFs land at `/pdfs/<variant>.pdf`, the path Phase 1 serves.

## SEAM-6 — Who owns which file

No two streams write the same file. If a stream needs a change in another's file, it
**reports** it.

| Path | Owner |
|---|---|
| `contract/**` | `contract` |
| `infra/**` | `infra` |
| `site/**`, `.github/workflows/build.yml`, `.gitignore` | `site` |
| `docs/satellites.md` | Lead Architect (already written; it is a derived view of ADR-0007/0008). The `contract` stream **reports** needed changes rather than editing it, so the file has one writer |
| everything in the `cv` repository | `satellite-cv` |
| `llm/**` | Lead Architect only |
| `.github/workflows/ci.yml`, `firebase.json` | nobody this phase |

## SEAM-7 — Validation each stream owes

- `contract`: the action's inputs match the ones `docs/satellites.md` documents (`dist`, `source`, `project_id`, `workload_identity_provider`, `service_account`, `bucket`); a mismatch is a seam defect to report, not to fix by editing that page. The schema accepts the §4 example and rejects every
  `examples/invalid/*.json`; `actionlint` clean on `contract/publish/action.yml`;
  the path-escape rejection is unit-tested.
- `infra`: `terraform fmt -check -recursive`, `init -backend=false`, `validate`.
  **Never** `plan` or `apply` — no cloud credential is available to a specialist.
- `site`: `npm test`, `npm run build`, `npm run check:smoke-routes`, `actionlint`.
- `satellite-cv`: the workflow parses as YAML and `actionlint` is clean; the manifest
  it emits validates against the schema.

## Assumptions

- The content bucket does not exist yet. No stream may assume a live bucket, and no
  specialist has credentials to create or read one; all cloud verification happens at
  Checkpoint 3, run by the Lead Architect or the owner.
- `cv` work happens in an isolated git worktree on branch `feat/publish-contract`, so
  the owner's own `cv` checkout (on `add-mit-to-all-variants`) is never touched.

## Open Questions

- None blocking. Latency of the poll interval is accepted (ADR-0007 Risks).

## Cross-References

- `llm/governance/adr/0007-hub-polls-content-bucket-no-satellite-github-credential.md`
- `llm/governance/adr/0008-manifest-data-format-hub-renders-cv.md`
- `llm/governance/adr/0002-satellite-publishing-via-content-bucket-and-dispatch.md`
- `llm/specs/2026-09-10-research-hub-design.md` §3, §4, §8, §9, §12
- `llm/master-roadmap.md` §phase-2-contract
- `llm/sprints/2026-09-hub/contracts/phase-1-seams.md` — the Phase 1 precedent
