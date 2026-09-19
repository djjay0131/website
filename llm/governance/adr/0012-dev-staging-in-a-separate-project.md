# ADR-0012: Dev-staging lives in a separate GCP project

Status: Proposed
Date: 2026-09-18

## Context

The private area cannot be reviewed before it ships. The gate needs Cloud Run, Identity
Platform and a real session, so there is no way to see the members' area as a member without
either deploying it or hand-rolling a local mount. Phase 3 proved the cost of that: the owner,
working over SSH with no local browser, could not view a local preview at all, and the only
reviewable artifact was a text render. Phase 4 adds share links, which multiply the number of
states that exist only live.

The owner asked for a dev site and recorded the open question precisely (`STATE.md`
§Follow-ups): *"whether dev is a separate GCP project or a second Hosting target in the same
project, and how its budget is bounded."*

The Wave 0 `infra` contract carried a default answer — a second Hosting site `hub-dev` in
`cusati-hub` — and asked for it to be costed before implementation. The cost is not the
constraint. Something else is.

## Decision

**Dev-staging lives in a separate GCP project**, not as a second Hosting target in
`cusati-hub`.

It is **not implemented by this ADR**. The decision is recorded first because implementing the
contract's default would have shipped a privilege escalation, and implementing a silently
different design would have been deciding an ADR-class question by writing Terraform.

## Rationale

### Firebase Hosting has no per-site IAM

Established from the provider's own schema rather than from documentation:

```
$ terraform providers schema -json | jq '…resource_schemas | keys'
google_firebase_hosting_channel        google_firebase_hosting_release
google_firebase_hosting_custom_domain  google_firebase_hosting_site
google_firebase_hosting_version        (+ 5 App Hosting resources)

resources matching *hosting* AND *iam*:  NONE
```

There is **no Hosting IAM resource of any kind** in provider 8.2.0, and
`roles/firebasehosting.admin` is granted project-wide (`infra/deploy.tf`). Therefore:

> Any identity that can deploy the `hub-dev` Hosting site can also deploy the **production**
> Hosting site.

The contract's default says dev is "deployed from a `dev` branch". A `dev` branch is by
construction less reviewed than `main`. Giving a `dev`-branch WIF binding an identity holding
`firebasehosting.admin` means **a commit to `dev` can overwrite production** — a privilege
escalation originating from the least-reviewed branch in the repository, introduced by the very
mechanism intended to make review safer.

That is strictly worse than the problem dev-staging solves.

### The cost is not the constraint

All figures are per-project free tiers at zero traffic, and free tiers are **per project**, so a
second project gets its own.

| Line | dev usage | Cost |
|---|---|---|
| Firebase Hosting (2nd site) | a few MB of fixture output, ~0 transfer | $0.00 |
| Cloud Run `hub-gate-dev`, `min_instance_count = 0` | scales to zero; nothing runs at rest | $0.00 |
| Cloud Storage private-dev bucket | a few MB of fixtures | $0.00 |
| Firestore | own collection prefix, same free tier | $0.00 |
| Identity Platform | 1–2 test users against a 50,000 MAU tier | $0.00 |
| Cloud Logging | negligible against 50 GiB/project/month | $0.00 |
| Cloud Monitoring | **no dev uptime checks** — dev being down is not an incident, and a paging dev alert trains the owner to ignore alerts | $0.00 |
| **Artifact Registry** | the only sensitivity line: `hub-gate` is **182.37 MB** measured today; a dev image shares base layers, worst case ~362 MB against a 512 MB free tier | $0.00 |

**Total incremental: $0.00/month.** Worst realistic overage, if Artifact Registry ever crossed
0.5 GB, is about **$0.05/month**. Roughly 99% headroom against the $5 budget.

The second project needs **its own $5 budget alert**: §12.6 binds per project, and a guardrail
that exists only in the first project does not protect the second.

## Alternatives Considered

### A second Hosting site in `cusati-hub` — the contract's default

One project, one bootstrap, one billing link, and the owner's existing access unchanged.

**Rejected.** It cannot be secured. The three ways out are each worse than the problem:

- **Deploy dev from `main` only.** This discards pre-merge review, which is the entire point of
  having a dev environment at all.
- **Accept dev-branch credentials that can write production.** This is the escalation stated
  plainly rather than avoided.
- **Restrict by Hosting IAM.** There is none. Verified above.

### No dev environment at all

Cheapest, and the status quo.

Rejected, but honestly: it is not absurd. The cost is that every private-area change is
reviewed only after it is live, which is how Phase 3 ran. That is tolerable for one gated
section and becomes untenable as Phase 4 adds share states. If the owner declines the second
project, this is the fallback, and it should be chosen deliberately rather than by default.

### A local emulator mount

The Firebase emulator suite can run Auth and Firestore locally.

Rejected for this owner's working conditions. The review loop that failed in Phase 3 failed
because there was no local browser over SSH, and an emulator does not change that. It also
would not exercise Cloud Run, the Hosting rewrite, or the `__session` cookie constraint —
which are precisely the parts that only break in production.

## Consequences

### Positive

- A `dev` branch cannot touch production. The same-project design cannot offer this at any
  price, because the IAM primitive does not exist.
- A real blast-radius boundary: separate IAM, separate WIF pools, separate buckets, separate
  Firestore, stopping at the project edge.
- Free tiers reset per project, so the incremental cost stays $0.00 at zero traffic.

### Negative / Tradeoffs

- More Terraform, and a second project to bootstrap.
- **The owner must link billing once more** — a console step, and a §10 hard stop.
- A second budget alert to create and never remove.
- Two projects to keep in step; configuration drift between them becomes possible in a way it
  was not before.

### Risks

- **Fixture content only, never real private material.** A dev environment mirroring production
  data is a second copy of the committee dossier with weaker controls and less scrutiny. This is
  the single rule that must not erode, and the first time someone copies real content in to
  reproduce a bug is the moment the boundary stops meaning anything.
- The private-dev bucket inherits the same invariants unchanged: exactly two principals, UBLA
  `true`, `public_access_prevention = "enforced"`, and `check_private_bucket_config.py`
  extended to assert them there too. A dev bucket held to a weaker standard would teach the
  wrong habit and would eventually be pointed at real data.
- Its own members collection needs no gate change: `GATE_MEMBERS_COLLECTION` and
  `GATE_PRIVATE_PREFIX` already exist in `gate/app/config.py`.

## Impacted Areas

- [ ] Product
- [ ] Domain model
- [ ] Data architecture
- [ ] AI architecture
- [ ] Domain-specific systems (see governance delta)
- [ ] Integrations
- [ ] UX
- [x] Security/privacy
- [x] Implementation
- [x] Documentation

## Related Documents

- `llm/sprints/2026-09-hub/STATE.md` §Follow-ups — the owner's recorded open question this
  answers, and §Wave 0 dispositions
- `llm/sprints/2026-09-hub/handoffs/infra-wave-0.md` item 7 — the provider-schema evidence and
  the full cost table
- `llm/specs/2026-09-10-research-hub-design.md` §8, §12.6
- `llm/governance/adr/0004-private-area-cloud-run-gate-behind-hosting.md` — the gate this
  would duplicate
- `infra/deploy.tf` — where `roles/firebasehosting.admin` is granted project-wide

## Related Issues / PRs

- #44 — hub-007: Wave 0
- PR #53 — the infra PR that establishes the finding and deliberately does not implement this

## Supersedes

None.

## Superseded By

None.
