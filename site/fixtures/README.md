# Offline content fixture

A tree shaped exactly like the content bucket (`sources/<source>/…`, SEAM-2),
holding **invented** content for one source, `cv`.

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
