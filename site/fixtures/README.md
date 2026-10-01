# Offline content fixture

A tree shaped exactly like the content bucket (`sources/<source>/…`, SEAM-2),
holding **invented** content for three sources: `cv` (public), `phd-milestones`
(three **private** items) and `kgis` (one public framed `html` item).

The `phd-milestones` entries exist so the leak check can be exercised against private
content that does not exist in the bucket yet — `npm run demo:leak-check` needs a private
slug to inject, and `leak-check-self-test` in CI runs exactly that on every push. One of
them, `internal-notes`, is deliberately in the `projects` section: it is the private item
the public `/projects/` index must leave out, and the leak check must catch if it does not.
Their prose is invented and their titles are marked `(fixture)`, but their **slugs and
source name are the real ones**, deliberately: a guard proves nothing unless it is
exercised against the needle values it will really search for.

The `kgis` entry is the Wave 1 satellite-3 fixture: a root `index.html` plus a sibling
`assets/style.css`, so the public framed-item path (staging the whole prefix, iframing it
from `/_payload/kgis/`) is exercised end to end with no bucket.

```sh
./scripts/sync-content.sh --from fixtures/content
```

It is the credential-free way to exercise the whole Phase 2 content path —
manifest validation, the data-item claim check, public-asset staging, the CV
pages — with no cloud access, no `cv` checkout and no network. `npm test` uses
it to test `scripts/sync-content.sh`, which cannot be run against a real bucket
by anyone who does not hold the hub's deploy identity.

**No CI job builds from this fixture.** Every trigger has a real CV data source:

| Trigger | CV data source |
|---|---|
| `push`, `schedule`, `workflow_dispatch`, once `vars.GCP_CONTENT_BUCKET` is set | `scripts/sync-content.sh --bucket` — the content bucket |
| `pull_request` (cannot authenticate: the deploy binding admits only `refs/heads/main`) | `scripts/fetch-data.sh` — the `cv` GitHub release |
| any trigger before Checkpoint 3, while `GCP_CONTENT_BUCKET` is unset | `scripts/fetch-data.sh` |

Every name, value, publication and date here is invented. The four variant
slugs are the real ones (`academic`, `research-professional`,
`anthropic-fellow`, `sde-long`) for one reason only: `SMOKE_ROUTES` names
`/cv/research-professional` and `/pdfs/academic.pdf`, so a fixture with other
slugs could not be used to check that path end to end.

The PDFs are minimal one-page placeholders and the photo is a 1×1 JPEG. Nothing
parses them; only their presence is checked.
