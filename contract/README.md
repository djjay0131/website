# The publishing contract

This directory is the entire interface between a satellite repository and the
research hub at <https://jason.cusati.us>.

A satellite builds whatever it likes, however it likes. It publishes a finished
`dist/` folder and a `manifest.json` describing what is in it. The hub owns the
chrome, the navigation, the design system and the deploy, and never needs to know
how the satellite built its output (design doc §3).

```
your repo ──▶ dist/ + manifest.json ──▶ GCS content bucket ──▶ hub polls, builds, deploys
```

| File | What it is |
|---|---|
| `manifest.schema.json` | The single definition of a manifest. JSON Schema draft 2020-12. |
| `validate-manifest.mjs` | The validator the publish action runs. No runtime dependencies. |
| `publish/action.yml` | The composite action satellites call. |
| `examples/manifest.example.json` | The design doc §4 example, verbatim. A shared fixture. |
| `examples/invalid/*.json` | One fixture per rejection rule, named for what it violates. |
| `test/validate.test.mjs` | Proves the schema accepts the example and rejects every invalid fixture. |

**Satellite owners want [`docs/satellites.md`](../docs/satellites.md)**, which is
the friendly version. This page is the reference, and the control-plane documents
it cites win wherever the two disagree:
`llm/specs/2026-09-10-research-hub-design.md` §3–§4,
`llm/governance/adr/0002-satellite-publishing-via-content-bucket-and-dispatch.md`,
`llm/governance/adr/0007-hub-polls-content-bucket-no-satellite-github-credential.md`,
`llm/governance/adr/0008-manifest-data-format-hub-renders-cv.md`.

## The manifest

`manifest.json` lives at the **root of `dist/`**. The publish action takes one
`dist` input and looks for `dist/manifest.json`; because `dist/` is uploaded with
its contents at the prefix root, the manifest lands at
`gs://<bucket>/sources/<source>/manifest.json`, which is where the hub looks for
it (SEAM-2).

```json
{
  "source": "phd-milestones",
  "published": "2026-09-10T14:02:11Z",
  "items": [
    {
      "slug": "committee-dossier",
      "title": "External Committee Dossier",
      "section": "phd",
      "format": "html",
      "path": "committee/index.html",
      "visibility": "private",
      "date": "2026-08-31",
      "summary": "Twelve vetted external committee candidates, ranked.",
      "tags": ["committee", "phd"]
    }
  ]
}
```

### Manifest fields

| Field | Required | Rule |
|---|---|---|
| `source` | yes | Your assigned source name, `^[a-z][a-z0-9-]{0,38}$`. It must equal the `source` input to the action, and it is the literal bucket prefix you publish under. |
| `published` | yes | ISO 8601 timestamp with `Z` or a numeric offset, e.g. `2026-09-10T14:02:11Z`. |
| `items` | yes | Array of items. **May be empty** — an empty array withdraws everything this source publishes. |

### Item fields

| Field | Required | Rule |
|---|---|---|
| `slug` | yes | `^[a-z0-9]+(?:-[a-z0-9]+)*$`, at most 64 characters. **Unique within the manifest.** It becomes a URL segment. |
| `title` | yes | 1–200 characters. Shown in the hub's navigation and indexes. |
| `section` | yes | One of `research`, `projects`, `writing`, `cv`, `phd`. |
| `format` | yes | One of `md`, `mdx`, `html`, `pdf`, `bundle`, `data`. |
| `path` | yes | Relative to `dist/`. No absolute path, no `..` segment, no backslash, no control character, and nothing that leaves `dist/` through a symlink. |
| `visibility` | yes | `public` or `private`. `private` is a Phase 3 capability; until then publish only `public` items. |
| `date` | yes | `YYYY-MM-DD`. |
| `summary` | no | 1–500 characters. |
| `tags` | no | Up to 20 unique slug-shaped tags. |
| `schema_version` | **`data` only** | `^[0-9]+(\.[0-9]+){0,2}$`, e.g. `"1"`. **Required on a `format: data` item and forbidden on every other format.** |

Every object in the manifest is **closed**: `additionalProperties` is `false` at
every level, so an unknown field is an error, not something quietly ignored. That
is deliberate. A satellite that misspells a field must find out at publish time,
and a field the hub does not understand must never travel silently.

### Formats

| Format | You ship | The hub does |
|---|---|---|
| `md` / `mdx` | Markdown with frontmatter | Renders it in site chrome; indexes it |
| `html` | A self-contained page or folder | Serves it verbatim in a thin frame |
| `pdf` | The file | Serves it, with a download card and inline viewer |
| `bundle` | A built app folder | Serves the folder as-is under the slug |
| `data` | A structured payload, **not** a document | Renders it with hub code written for your source |

`data` is deliberately hard to use (ADR-0008). Every other format lets the hub
stay ignorant of your internals; `data` does not. The hub renders only the
`(source, slug)` pairs it explicitly claims — in Phase 2, exactly
`("cv", "cv-data")` — and **fails its build** on any other `data` item or on a
`schema_version` it does not recognise. Prefer any other format if one fits.

### Two rules JSON Schema cannot express

`manifest.schema.json` is strict, standard draft 2020-12 with no custom keywords,
so any conformant validator enforces exactly what it says. Two contract rules are
outside what JSON Schema can say, and `validate-manifest.mjs` enforces them
alongside the schema. **Every mirror of this schema must enforce them too**
(SEAM-1):

1. **`slug` is unique within a manifest.** Draft 2020-12 has no "unique by
   property" keyword; `uniqueItems` only compares whole items. A conformant
   validator will accept `examples/invalid/duplicate-slug.json` — the test suite
   asserts that it does, so nobody discovers it by accident.
2. **`path` resolves inside `dist/` on disk.** The schema's `pattern` rejects
   absolute paths and `..` segments from the text alone, but only the filesystem
   knows where a symlink points. The publish action resolves every path with
   `realpath` and rejects anything landing outside `dist/` (ADR-0002).

## Validating a manifest locally

The validator has **no runtime dependencies**. From any checkout of this
repository:

```bash
node contract/validate-manifest.mjs --dist path/to/dist --source your-source-name
```

That runs the same three checks the publish action runs, in the same order:
`schema`, then `paths`, then `source`. Run one at a time with
`--check schema|paths|source`, or point at a manifest outside a `dist/` tree with
`--manifest path/to/manifest.json --check schema`. It exits non-zero and names the
offending field and item:

```
Manifest check "schema" FAILED with 1 error(s):
  items[0].section: "section" must be one of "research", "projects", "writing", "cv", "phd" (got "notes")
```

### Running the contract's own checks

```bash
cd contract
npm ci          # installs ajv, a devDependency, from the committed lockfile
npm test
```

The suite validates the example and every invalid fixture **twice**: once with
ajv (a conformant JSON Schema 2020-12 implementation) and once with
`validate-manifest.mjs`, and asserts the two agree on every fixture. That is what
lets the publish action ship without ajv while still being bound by the schema.
ajv is never needed at publish time and is never installed in a satellite's
workflow.

It also unit-tests path containment against a real directory tree, including a
symlink that leaves `dist/` and one that does not.

## The publish step

```yaml
permissions:
  contents: read
  id-token: write        # REQUIRED - see below

steps:
  - uses: djjay0131/website/contract/publish@main
    with:
      dist: ./dist
      source: your-source-name
      project_id: ${{ vars.GCP_PROJECT_ID }}
      workload_identity_provider: ${{ vars.GCP_WIF_PROVIDER }}
      service_account: ${{ vars.GCP_PUBLISH_SA }}
      bucket: ${{ vars.GCP_CONTENT_BUCKET }}
```

**The calling job must grant `id-token: write`.** A composite action cannot
declare `permissions:` of its own — permissions belong to the job — so this action
cannot grant it for you. Without it, GitHub mints no OIDC token and the WIF
exchange in step (d) fails.

Set all five values as GitHub Actions **variables**, not secrets. None of them is
secret, and treating them as secrets only makes failures harder to read.

The action needs `node` on `PATH`. GitHub-hosted runners provide it; on a
self-hosted runner, add `actions/setup-node` before this step.

### What the action does, in order

| | Step | Why it is where it is |
|---|---|---|
| a | Validate the manifest against `manifest.schema.json` | Before anything else |
| b | Verify every `path` resolves inside `dist/` | Before anything else |
| c | Verify the manifest's `source` equals the `source` input | Before anything else |
| d | `google-github-actions/auth` (WIF) | Only now is a credential minted |
| e | `google-github-actions/upload-cloud-storage` | `gs://<bucket>/sources/<source>/` |

All three validations run **before** authentication, so a malformed or malicious
manifest is rejected before a credential exists and before a single byte is
uploaded.

Upload options and why they are not the defaults:

- `parent: false` — upload `dist/`'s **contents**, so files land at
  `sources/<source>/<path>` exactly as the manifest describes (SEAM-2). The
  default (`true`) would insert a spurious `dist/` segment.
- `gzip: false` — store published bytes unchanged. The hub fingerprints and
  re-serves them; a content encoding applied here would only obscure that.
- `process_gcloudignore: false` — `dist/` is published exactly as built. A stray
  `.gcloudignore` in a satellite must not silently drop a file the manifest
  promises.
- `predefinedAcl` is deliberately unset — the content bucket enforces uniform
  bucket-level access (ADR-0007 decision 8), which rejects per-object ACLs.

### What the action never does

- **It takes no GitHub token and fires no `repository_dispatch`.** Any credential
  able to dispatch at `website` would also be able to write to it, so the hub
  polls the bucket instead (ADR-0007 decisions 1 and 2). If anyone asks you to add
  a PAT for the website repository, that is a mistake.
- **It uses no service-account key.** WIF only, minted at run time (design doc
  §12.2). A JSON key anywhere is a review failure.
- **It never lists the bucket.** See below.
- **It never deletes.** A satellite cannot list, so it cannot know what is there
  to prune. The manifest — not the object set — is the authority on what a source
  publishes; an item dropped from `items` is withdrawn whether or not its bytes
  remain.

## Permissions a satellite identity needs

Granted by the hub's Terraform (`infra/`), as a project custom role bound on the
content bucket with an IAM condition on that satellite's own prefix
(ADR-0007 decisions 4 and 5; SEAM-3):

```
storage.objects.create      storage.objects.delete      storage.objects.get
```

```
resource.type == 'storage.googleapis.com/Object' &&
resource.name.startsWith('projects/_/buckets/<bucket>/objects/sources/<source>/')
```

- `create` — write new objects.
- `delete` — **required to overwrite.** Replacing an object needs `create` *and*
  `delete`; `roles/storage.objectCreator` alone "does not give permission to view,
  delete, or overwrite objects", so it would succeed on a satellite's first
  publish and fail on every republish.
- `get` — read back its own objects.

### The permission a satellite must never be given

> **`storage.objects.list`.**

It cannot be restricted to a prefix: "Since the `storage.objects.list` permission
is granted at the bucket level, you cannot use the `resource.name` condition
attribute to restrict object listing access to a subset of objects in the bucket."
A satellite holding it could enumerate **every other source's object names** —
including, from Phase 3, the private `phd-milestones` items. This is the binding
constraint of the whole design (ADR-0007 decision 4; SEAM-3).

Everything else follows from it:

- `gcloud storage cp --recursive` **requires** `storage.objects.list` and is
  therefore forbidden as the publish primitive. So is `gsutil rsync`, and anything
  else that enumerates the bucket.
- `google-github-actions/upload-cloud-storage` is used instead because it expands
  the file list **locally** and uploads per file.
- The publish step cannot verify afterwards which objects exist under its own
  prefix, because verifying would mean listing. It cannot, and it must not.

If you ever conclude that a change here needs `list`, that change is wrong. Stop
and raise it; do not widen the permission.

## Bumping the pinned action SHAs

Both third-party actions are pinned by full commit SHA with the version in a
comment. A tag can be moved; a SHA cannot.

| Action | Pin | Version |
|---|---|---|
| `google-github-actions/auth` | `7c6bc770dae815cd3e89ee6cdf493a5fab2cc093` | v3.0.0 |
| `google-github-actions/upload-cloud-storage` | `6397bd7208e18d13ba2619ee21b9873edc94427a` | v3.0.0 |

To bump either one:

1. Find the commit the new tag points at, and confirm it is the tag you think it
   is:

   ```bash
   gh api repos/google-github-actions/upload-cloud-storage/git/refs/tags \
     --jq '.[] | select(.ref=="refs/tags/v3.1.0") | .object.sha'
   ```

2. **For `upload-cloud-storage`, re-verify that it still makes no bucket listing
   call.** This is the step that must never be skipped. ADR-0007's own Risks
   section records why: the design depends on the action's local-glob behaviour,
   which is a property of its source, not a documented guarantee — its README
   states no permission requirements at all. At the new SHA:

   ```bash
   SHA=<new sha>
   for f in src/client.ts src/util.ts src/main.ts; do
     curl -sS "https://raw.githubusercontent.com/google-github-actions/upload-cloud-storage/$SHA/$f" \
       | grep -n 'getFiles\|listObjects\|\.list(' && echo "FAIL $f" || echo "clean $f"
   done
   ```

   Expected: no hit in any file. The upload path must still be
   `expandGlob` (local, `fast-glob`) in `src/util.ts` feeding
   `storageBucket.upload(source, opts)` per file in `src/client.ts`. **A single
   listing call means the new version cannot be used**, because the permission it
   would need is the one permission this design cannot grant. Record the finding
   in the PR.

3. Update the SHA and the version comment together in `publish/action.yml`.
4. At the next publish, confirm the satellite's identity still succeeds with no
   `list` grant. A `404` or permission error mentioning `list` means step 2 missed
   something.

The same applies to `ajv` in `package.json`: it is pinned exactly and locked by
`package-lock.json`. Bump through a reviewed lockfile change. It is a
devDependency — it never reaches a satellite's workflow.

## Cross-references

- `llm/sprints/2026-09-hub/contracts/phase-2-seams.md` — SEAM-1, SEAM-2, SEAM-3
- `llm/governance/adr/0002-…` — the path-escape rule
- `llm/governance/adr/0007-…` — the credential boundary, the `list` prohibition,
  and the choice of upload primitive
- `llm/governance/adr/0008-…` — the `data` format and `schema_version`
- `docs/satellites.md` — the satellite owner's how-to
- `infra/` — the bucket, the identities and the IAM conditions
