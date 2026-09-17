# Publishing to the research hub

How a repository publishes content to <https://jason.cusati.us>.

This is a derived view for satellite owners. The decisions it describes live in the
control plane and win wherever this page disagrees with them:
`llm/specs/2026-09-10-research-hub-design.md` §3–§4,
`llm/governance/adr/0002-satellite-publishing-via-content-bucket-and-dispatch.md`,
`llm/governance/adr/0007-hub-polls-content-bucket-no-satellite-github-credential.md`
and `llm/governance/adr/0008-manifest-data-format-hub-renders-cv.md`.

## The idea

You build your content however you like. You publish a finished folder and a
`manifest.json` describing what is in it. That is the whole interface.

The hub owns the chrome, the navigation, the design system and the deploy. It never
needs to know how you built your output.

```
your repo ──▶ build dist/ (manifest.json at its root) ──▶ GCS content bucket ──▶ hub polls, builds, deploys
```

## What you never need

- **No GitHub token, and no access to the `website` repository.** Earlier drafts had
  satellites fire a `repository_dispatch` at the hub. That needs a credential with
  write access to `website`, which would defeat the point, so the hub polls the
  bucket instead (ADR-0007). If someone asks you to add a PAT for the website repo,
  that is a mistake — say no.
- **No service-account key file.** Authentication is Workload Identity Federation:
  your workflow exchanges its GitHub OIDC token for a short-lived credential at run
  time. A JSON key anywhere is a review failure.
- **No access to anything but your own prefix.** Your identity can write, replace and
  read objects under `sources/<your-source>/` and nothing else. It deliberately
  cannot *list* the bucket, so you cannot see what other sources have published.

## Adding a satellite

1. Ask the hub owner to add you. Someone with access to the hub's Terraform adds your
   repository to `infra/` — a service account, a Workload Identity provider entry
   admitting only your repository and your default branch, and a binding scoped to
   your prefix. You will be given a `source` name and the values your workflow needs.
2. Produce a `dist/` folder whose **root contains `manifest.json`**, alongside the files
   that manifest describes. Every item's `path` is relative to that same `dist/`.
   **Generate the manifest from your build, don't hand-maintain it** — if your outputs are
   discovered dynamically (a variant list, a glob), a static file drifts out of step
   silently. `cv` generates its manifest with a small tested tool and validates it in CI.
3. Add the publish step to your workflow.

## The manifest

```json
{
  "source": "example-notes",
  "manifest_version": "1",
  "published": "2026-09-10T14:02:11Z",
  "items": [
    {
      "slug": "quarterly-review",
      "title": "Quarterly Review",
      "section": "phd",
      "format": "html",
      "path": "review/index.html",
      "visibility": "private",
      "date": "2026-08-31",
      "summary": "A placeholder item. Private, so it never reaches the public site.",
      "tags": ["example"]
    }
  ]
}
```

The schema is `contract/manifest.schema.json` in the hub repository, and it is
enforced twice: the publish action validates your manifest before uploading, and the
hub build validates it again. A manifest that fails either one does not publish.

| Field | Rule |
|---|---|
| `source` | Your assigned source name. Must match the prefix you upload to. |
| `manifest_version` | Optional, for now. A plain integer as a string. Absent means `"1"`. See below. |
| `published` | ISO 8601 timestamp. |
| `slug` | Unique within your source. |
| `title` | Shown in the hub's navigation and indexes. |
| `section` | One of `research`, `projects`, `writing`, `cv`, `phd`. |
| `format` | One of `md`, `mdx`, `html`, `pdf`, `bundle`, `data`. |
| `path` | Relative to `dist/`. Must not escape it — no absolute paths, no `..`. |
| `visibility` | `public` or `private`. |
| `date` | ISO date. |
| `summary`, `tags` | Optional. |

### `manifest_version` — and how it differs from `schema_version`

Two different things can change, so they are versioned separately. Confusing them is the
likeliest way to publish something the hub then refuses.

| Field | Versions | Who bumps it |
|---|---|---|
| `manifest_version` | the **envelope** — the fields, the fixed sets, the rules every source obeys | the **hub**, when the contract changes |
| `schema_version` | one **`data` payload's** internal shape | **you**, when your payload's shape changes |

If you publish `md`, `html`, `pdf` or `bundle` items, `schema_version` never concerns you —
only `data` items carry it.

`manifest_version` is a string of digits: `"1"`, `"2"`. Not `"1.2"`. The hub compares it
exactly against the versions it understands, so a dotted form would suggest a compatibility
rule that does not exist.

**Today it is optional and absent means `"1"`**, so you need do nothing. It becomes required
in a later phase, and you will be told before that happens. Sending a version the hub does not
recognise fails the hub's build rather than publishing something half-understood.

### Formats

| Format | You ship | The hub does |
|---|---|---|
| `md` / `mdx` | Markdown with frontmatter | Renders it in site chrome; indexes it for search |
| `html` | A self-contained page or folder | Serves it verbatim at `/<section>/<source>/<slug>/` in a thin frame with a back link |
| `pdf` | The file | Serves it, with a download card and an inline viewer |
| `bundle` | A built app folder | Serves the folder as-is under the slug |
| `data` | A structured payload, **not** a document | Renders it with hub code written specifically for your source |

**`data` is a special case, and it is deliberately hard to use.** Every other format
lets the hub stay ignorant of how you built your output. `data` does not: the hub
must understand your payload's shape, which couples your repository to hub code. It
exists because the CV is genuinely data — the hub renders four CV variants from the
same YAML source (ADR-0008).

If you want to publish a `data` item, the hub must first be taught to render your
specific `(source, slug)` pair, and your item must carry a `schema_version` that the
hub recognises. An unclaimed `data` item, or an unknown `schema_version`, **fails the
hub build** rather than being ignored.

**When to bump `schema_version`.** This rule binds both repositories, so it is written
here rather than only in yours:

- **Bump it** when the payload's *shape* changes: a key renamed, removed or re-typed, a
  file moved, the directory layout changed.
- **Do not bump it** for content changes, or for adding another instance of something
  the shape already describes.
- **Bump the hub first.** Teach the hub the new version, then publish it. A bump
  published before the hub understands it takes the hub build down.
- Forgetting to bump is silent and produces a wrong page; bumping unnecessarily is loud
  and safe. When unsure, bump.

Prefer any other format if one fits.

### Private items

`visibility: private` items never reach the public site. They go bucket → build →
private bucket, and are served only behind the hub's sign-in gate. The hub build
fails if a private item appears in public output.

**Enforce your own visibility.** The hub runs a leak check that fails its build if a private
item reaches the public output — but that is the hub's backstop, not your permission to be
careless. Assert in your own build that items you intend to be private are marked `private`,
so a mistake fails in your repository, at the moment you make it, rather than at the hub.
`phd-milestones` does this in its generator's tests.

**What travels with an `html` item.** A `format: html` page usually needs more than the one
file its `path` names — a stylesheet, images, pages it links to. Everything under `dist/` is
uploaded, so those files do reach the bucket, but nothing in the manifest names them. Make
your build fail if a page references a local file that is not staged, rather than discovering
it as an unstyled page later.

## The publish step

```yaml
permissions:
  contents: read
  id-token: write        # required: the OIDC token exchanged through WIF

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

### Why `@main` and not a pinned commit

You call the action at `djjay0131/website/contract/publish@main`, a moving reference, from a
job holding `id-token: write`. That is deliberate: it means contract fixes reach every
satellite without a pull request in each one, which matters when the fix is a security fix.
The trade is real and worth stating plainly — **any push to the hub's `main` immediately
changes what runs inside your workflow.** It is acceptable here because the hub and its
satellites have one owner; it would not be acceptable for a third-party action, and it is the
one place where the hub holds power over a satellite's runtime. If that ever stops being
true, the answer is a moving `v1` tag the hub advances deliberately, not a commit SHA that
would freeze every satellite on a stale contract.

The action validates your manifest, then uploads `dist/` to
`gs://<bucket>/sources/<source>/`. It uploads file by file rather than recursively,
because a recursive upload would require permission to list the whole bucket — which
is exactly the permission satellites are not given.

Set these four as GitHub Actions **variables**, not secrets — `dist` and `source` are
literals you write in the workflow, not variables:

| Variable | What it is |
|---|---|
| `GCP_PROJECT_ID` | The hub's Google Cloud project id |
| `GCP_WIF_PROVIDER` | Your repository's Workload Identity provider, in the hub's `satellites` pool |
| `GCP_PUBLISH_SA` | Your repository's publishing service account |
| `GCP_CONTENT_BUCKET` | The hub's content bucket name |

None of them is secret, and treating them as secrets makes failures harder to read.

## When your content appears

The hub polls the bucket on a schedule. A publish appears at the next poll, not
immediately. If you need it sooner, ask the hub owner to run the hub's build
manually — that needs no credential of yours.

## If a publish fails

| Symptom | Likely cause |
|---|---|
| The action fails validating the manifest | A field is missing, or `section`/`format`/`visibility` is outside its fixed set. The error names the field and the item. |
| `manifest.json not found` | It must sit at the **root of `dist/`**, not beside it. |
| Two items share a `slug` | Slugs must be unique within your manifest. JSON Schema cannot express that, so the publish action checks it separately — the error names both items. |
| `403` on upload | Your identity is not bound to that prefix, or `source` does not match the prefix. Check `source` first. |
| `403` on a *second* publish, having succeeded once | Your binding grants create but not delete. Replacing an object needs both. Ask the hub owner. |
| A `404` or permission error mentioning `list` | Something in your workflow is trying to list the bucket. Satellites cannot. Use the publish action rather than `gcloud storage cp --recursive`. |
| It published, but nothing changed on the site | Wait for the next poll. If it still has not appeared, the hub build may be failing — check the hub's Actions tab. |

## Contact

Open an issue on <https://github.com/djjay0131/website>.
