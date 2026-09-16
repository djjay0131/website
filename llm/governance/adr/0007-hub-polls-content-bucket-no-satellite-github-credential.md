# ADR-0007: The hub polls the content bucket; no satellite holds a GitHub credential

Status: Accepted
Date: 2026-09-16

## Context

ADR-0002 decided that satellites publish a finished `dist/` plus a `manifest.json`
to a content bucket and notify the hub by `repository_dispatch`. It then recorded,
in its own Risks, that those two halves contradict each other:

> **Decision 1's dispatch step contradicts Decision 2 as written.** GitHub's
> "Create a repository dispatch event" endpoint requires a token with
> **Contents: write** on the target repository … Any credential a satellite holds
> to fire the dispatch can therefore write to `website`, which breaks Decision 2
> and principle 3.

It marked the dispatch step **conditional** and deferred the mechanism to a
follow-up ADR under one binding constraint: **no satellite holds any GitHub
credential for `website`.** `STATE.md` carries this as conflict K13 and ADR
candidate C1, and the roadmap made it a Phase 2 blocker: "The credential
satellites use for `repository_dispatch` is decided in an accepted ADR before
implementation merges."

This is not hypothetical. `cv`'s `build-cv.yml` already carries the step, disabled:

```yaml
# Cross-repo trigger to the website repo. Disabled until a PAT and the
# target repo exist (M2 sets this up). Set the secret WEBSITE_DISPATCH_PAT
# to a PAT with "repo" scope on the website repo to enable.
- name: Notify website repo
```

A classic PAT with `repo` scope on `website` is both a long-lived secret held by a
satellite (design doc §12.2, domain review question 2) and write access from a
satellite to the hub (§12.3, principle 3). Enabling that step was the default path
into Phase 2, and it was the wrong one.

The owner decided the mechanism on 2026-09-15: **option A — the hub polls the
content bucket; satellites hold no GitHub credential.** This ADR records that
decision, and the credential boundary that makes it hold on the bucket side.

## Decision

1. **Notification is by polling, not by event.** The hub's scheduled workflow
   fingerprints the content bucket and compares it against the fingerprint recorded
   in the currently deployed build (`build-info.json`). When they differ, the hub
   syncs the bucket, builds and deploys. This generalizes the mechanism `build.yml`
   already uses for the `cv` GitHub release, so the hub gains no new moving part.

2. **No satellite holds any GitHub credential for `website`.** `cv`'s "Notify
   website repo" step and its `WEBSITE_DISPATCH_PAT` secret are **deleted, not
   enabled**, and the `repository_dispatch: [cv-updated]` trigger is removed from
   `build.yml` with it. No satellite is granted any token, App installation, or
   other credential naming this repository.

3. **A satellite's only credential is a short-lived GCP identity** obtained through
   Workload Identity Federation at run time, scoped to its own bucket prefix. No key
   file, no long-lived secret (§12.2).

4. **The satellite write grant is a custom role containing exactly
   `storage.objects.create`, `storage.objects.delete` and `storage.objects.get` —
   and deliberately not `storage.objects.list`** — bound on the content bucket with
   an IAM condition on that satellite's own prefix:

   ```
   resource.type == 'storage.googleapis.com/Object' &&
   resource.name.startsWith('projects/_/buckets/<bucket>/objects/sources/<source>/')
   ```

   `list` is excluded because it **cannot be restricted by prefix at all**: "Since
   the storage.objects.list permission is granted at the bucket level, you cannot
   use the resource.name condition attribute to restrict object listing access to a
   subset of objects in the bucket" (Cloud Storage, IAM Conditions). A satellite
   holding `list` could enumerate every other source's object names — including, in
   Phase 3, the names of private `phd-milestones` items. `delete` is required
   because replacing an object needs both `storage.objects.create` and
   `storage.objects.delete`, and `roles/storage.objectCreator` "does not give
   permission to view, delete, or overwrite objects" — so a satellite holding only
   `objectCreator` would succeed on its first publish and fail on every republish.
   All three permissions are GA and custom-role eligible, verified against this
   project's live `iam list-testable-permissions`.

5. **Satellites authenticate through their own Workload Identity pool**
   (`satellites`), separate from the hub's `github-actions` pool. `infra/wif.tf`
   records why: a `principalSet` is scoped to the *pool*, so the hub's deploy
   binding stays safe only while every provider in its pool maps
   `attribute.repository_id_ref` identically. Terraform cannot enforce that
   invariant. A separate pool makes the trust boundary structural instead of a
   review obligation. Each satellite gets its own provider in that pool, admitted by
   immutable `repository_id` and `repository_owner_id` as well as name, refusing
   `pull_request_target`, and bound to that satellite's own default branch.

6. **The publish action uploads with `google-github-actions/upload-cloud-storage`,
   pinned by commit SHA.** It is the primitive that fits decision 4: its source
   expands the file list locally with `fast-glob` (`src/util.ts` `expandGlob`) and
   calls `storageBucket.upload(source, opts)` per file (`src/client.ts`); it makes
   no `getFiles()` call, so it needs no `list`. `gcloud storage cp --recursive` is
   **rejected** as the publish primitive: "If you use the `--recursive` flag, you
   must have storage.objects.list permission for the relevant bucket" — the one
   permission decision 4 cannot grant.

   **Strengthened 2026-09-16, by measurement at Checkpoint 3.** `gcloud storage cp`
   requires `storage.objects.list` **at all**, not only with `--recursive`. Copying a
   single file into the satellite's *own* allowed prefix was refused with
   `Permission 'storage.objects.list' denied on ... buckets/cusati-hub-content`. So no
   `gcloud storage` command can serve as the publish primitive for an identity scoped
   this way — the exclusion is broader than this decision first recorded, and it made
   our own Checkpoint 3 runbook unrunnable until it was rewritten to use the JSON API.
   The chosen primitive is unaffected: the same identity completed create, overwrite,
   read and delete through the API, and was refused every write outside its prefix and
   every list.

7. **The poll job authenticates through WIF on the scheduled run.** Scheduled
   workflows "run on the latest commit on the default branch", so the OIDC `ref`
   claim is `refs/heads/main` and the existing `refs/heads/main` deploy binding
   admits the poll without a new binding or a new branch condition.

8. **The content bucket is never public**: uniform bucket-level access (required
   before any IAM condition applies), `public_access_prevention = "enforced"`, and
   object versioning on.

## Rationale

Option A is the only candidate that satisfies ADR-0002's binding constraint without
introducing a second long-lived secret somewhere else. Every event-driven
alternative moves the GitHub credential rather than removing it — into the
satellite, or into a hub-owned service that must then hold and rotate it.

Polling costs latency, and that is the honest price. For this system the price is
small: content is published a few times a month, and nothing about the hub is
time-critical. The hub already polls hourly for `cv` releases and has done so
throughout Phase 1.

The bucket-side decisions (4, 5, 6) belong in this ADR rather than an implementation
note because they are the other half of the same question. "No GitHub credential"
is worth little if the GCP credential a satellite *does* hold can read or overwrite
another source's content. Three of the four constraints behind those decisions were
discovered only by reading the primary sources, and each of them would have produced
a plausible, working implementation that quietly violated principle 3.

## Alternatives Considered

### A hub-owned notifier: Cloud Storage → Pub/Sub → Cloud Run, holding the GitHub credential

An object-finalize notification wakes a small hub-owned service, which alone holds a
GitHub credential and fires the dispatch. Near-real-time, and no satellite holds a
GitHub credential — it satisfies ADR-0002's constraint literally.

Rejected. It keeps a long-lived GitHub token, merely relocating it to Secret Manager,
where it must be rotated and audited; that is the condition domain review question 2
exists to catch. It also adds a Pub/Sub topic, a Cloud Run service and its image to a
project guarded by a $5 budget, and Cloud Run is Phase 3's to introduce, with its own
ADR (ADR-0004). Real-time publishing is not a requirement anywhere in the design
document.

### Satellites fire the dispatch with a fine-grained PAT scoped to `website`

A fine-grained PAT limited to Contents: write on `website` only, held by each
satellite.

Rejected. "Contents: write on `website`" *is* write access to the hub: it can push to
branches and alter hub code. That is exactly what ADR-0002 Decision 2 and principle 3
forbid, and scoping it more tightly is not possible — the dispatch endpoint requires
that permission. It is also a long-lived secret in a satellite.

### A GitHub App installation token

A GitHub App installed on `website`, its private key held by the satellite, minting
short-lived installation tokens.

Rejected. The token is short-lived but the App private key is not, and the satellite
holds it. The satellite still ends up with a credential that can write to `website`.
Same violation, more machinery.

### Keep polling the `cv` GitHub release

The status quo: `build.yml` downloads `cv`'s latest release and polls hourly.

Rejected as the general mechanism. It requires the hub to know each satellite's build
and release shape, which design doc §3 forbids, and it needs read credentials for
private satellites in later phases. It is what Phase 2 exists to replace.

## Consequences

### Positive

- ADR-0002's internal contradiction is resolved, and conflict K13 / ADR candidate C1
  are closed.
- No credential anywhere in the system outlives a workflow run.
- A satellite's blast radius ends at its own prefix, and it cannot even enumerate
  what else the bucket holds.
- The hub gains no new runtime component, and no new cost line against the $5 budget.
- The mechanism generalizes unchanged to `phd-milestones` in Phase 3, where the
  consequences of a leaky prefix would be materially worse.

### Negative / Tradeoffs

- **Publish latency is bounded by the poll interval, not by the publish.** A `cv`
  push appears on the site within one poll period rather than within a minute.
- The poll runs whether or not anything changed. The fingerprint comparison keeps a
  no-op poll cheap, but it is not free.
- The satellite can delete and overwrite its own objects. Bucket versioning limits
  the damage to recoverable, and the blast radius is one prefix.

### Risks

- **The publish tool must never begin requiring `list`.** The design depends on
  `upload-cloud-storage`'s local-glob behaviour, which is a property of its source,
  not a documented guarantee — its README states no permission requirements at all.
  Mitigation: the action is pinned by commit SHA, and any bump must re-verify that
  `src/` still makes no `getFiles()` call and that a publish succeeds without `list`.
- **A fingerprint that misses deletions** would leave withdrawn content on the site.
  The fingerprint must cover the object set, not just the newest object.
- **Poll latency may become unacceptable** if a satellite ever needs prompt
  publishing. The escape hatch is `workflow_dispatch` on the hub, run by the owner —
  which needs no satellite credential — and, failing that, revisiting the hub-owned
  notifier above in its own ADR.
- **A satellite could exhaust its own prefix** with large or many objects. The budget
  alert is the backstop; a bucket lifecycle rule is the follow-up if it ever matters.

## Impacted Areas

- [ ] Product
- [ ] Domain model
- [x] Data architecture
- [ ] AI architecture
- [ ] Domain-specific systems (see governance delta)
- [x] Integrations
- [ ] UX
- [x] Security/privacy
- [x] Implementation
- [x] Documentation

## Related Documents

- `llm/governance/adr/0002-satellite-publishing-via-content-bucket-and-dispatch.md` —
  the decision this one completes; its Risks section states the constraint
- `llm/specs/2026-09-10-research-hub-design.md` §3, §4, §8, §12.2, §12.3
- `llm/sprints/2026-09-hub/STATE.md` — conflict K13, ADR candidate C1
- `infra/wif.tf` — the shared-pool invariant that decision 5 makes structural
- Cloud Storage, "Use IAM Conditions" (prefix condition form; the
  `storage.objects.list` limitation; uniform bucket-level access requirement)
- Cloud Storage, "IAM permissions for gcloud storage commands" (`--recursive`
  requires `storage.objects.list`)
- Cloud Storage, "IAM roles for Cloud Storage" (`roles/storage.objectCreator`
  cannot overwrite); "IAM permissions" (replacing an object needs create + delete)
- `google-github-actions/upload-cloud-storage` v3.0.0 `src/util.ts`, `src/client.ts`
- GitHub Docs, "Events that trigger workflows" (`schedule` runs on the default
  branch) and "OpenID Connect reference" (the `ref` claim)

## Related Issues / PRs

- #16 — hub-002: Phase 2 — Publishing contract
- The owner's decision, recorded in `STATE.md` §Checkpoint 2 decisions (2026-09-15)

## Supersedes

None. It completes ADR-0002, whose dispatch step was explicitly conditional; the
`repository_dispatch` mechanism named in ADR-0002 Decision 1 is not built.

## Superseded By

None.
