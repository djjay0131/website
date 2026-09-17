# ADR-0010: Withdrawal semantics — the manifest is the authority, and a private withdrawal must actually stop serving

Status: Accepted
Date: 2026-09-17

## Context

A satellite cannot list its own prefix. That is deliberate and load-bearing:
`storage.objects.list` cannot be restricted by prefix, so granting it would let any
satellite enumerate every other source's object names (ADR-0007 decision 4). The
consequence is that **a satellite cannot prune**. It can create, overwrite and delete
objects it knows the names of, but it cannot discover what it left behind.

So "withdrawing" an item is not a delete operation. It is publishing a manifest that no
longer lists it. The bytes remain in the content bucket.

Through Phase 2 that was tolerable: every published item was public, and a withdrawn item
simply stopped appearing on a public site whose content was public anyway.

Phase 3 changes what is at stake. `phd-milestones` publishes the milestone tracker and the
committee dossier as `visibility: private`. If withdrawal only stops the hub *rendering* an
item while the file remains in the private bucket, the gate can still serve it at its old
path to any signed-in member — a withdrawal that withdraws nothing. And the reverse error
matters too: treating a **missing** manifest as "withdraw everything" would turn a
transient sync fault into silent deletion of the private area.

STATE carries this as C23 and C27; the Chief Reviewer raised it as S9, explicitly asking
for it before Phase 3, "when the withdrawn item may be private".

## Decision

1. **The manifest is the authority, not the bucket.** An item absent from a source's
   manifest is not rendered, not staged, and not served — regardless of whether its bytes
   are still present under that source's prefix.

2. **An empty `items` array is a valid manifest and means withdrawal**, not an error. It
   is the only way a satellite can retract everything, since it cannot prune. It is
   distinguishable from every fault below.

3. **A missing manifest is a fault and fails the build.** A source's prefix holding objects
   but no `manifest.json` is indistinguishable from a partial upload, a botched delete or a
   truncated sync. Publishing an empty section in that state would convert a transient
   fault into silent content deletion — the failure this decision exists to prevent.

4. **The hub declares its expected sources** (alongside the claimed `data` items in
   `site/src/lib/hub-content.mjs`), and a declared source whose prefix is **entirely
   absent** fails the build. Without this, a source whose whole prefix vanished is
   indistinguishable from a source that never existed — C27, which is benign for `cv` and
   is not benign for `phd-milestones`.

   **Amended 2026-09-17, on the site stream's finding.** Taken literally this fails *every*
   build during bootstrap: a source must be declared before it can publish, and
   `phd-milestones` cannot publish until Checkpoint 4. So each declaration carries a
   **`required` flag**. `required: true` means absence fails the build — the protection this
   decision exists for. `required: false` means the source is known but not yet expected, and
   is the only correct state between declaring a satellite and its first successful publish.
   Flipping a source to `required: true` after that first publish is a checkpoint action, not
   an optional tidy-up: left at `false`, a vanished prefix goes undetected, which is exactly
   C27. This is the same bootstrap shape as issue #19.

5. **Withdrawal must remove the artifact from the private output, not merely from the
   index.** The private sync deletes destination objects that the current build did not
   produce, so a withdrawn private item stops being readable by the gate rather than
   lingering at its old path. The public output already gets this for free, because
   `dist-public` is rebuilt and redeployed wholesale.

6. **The hub never deletes from the content bucket.** Withdrawal is expressed in the
   manifest; the bytes stay until the satellite removes them or the bucket's lifecycle
   rules do. Bucket versioning and the 7-day soft delete remain the recovery path
   (ADR-0007 decision 8).

## Rationale

Decisions 2 and 3 are the pair that matters, and they are only defensible together. Empty
`items` must be a legitimate withdrawal because it is the *only* retraction a
non-listing satellite can express. A missing manifest must be a fault because every way it
arises is a fault. Collapsing them — treating absence as withdrawal — would mean a failed
sync silently empties the private area, and the system would report success.

Decision 5 is the one Phase 3 adds. Until now "withdrawn" and "not rendered" were the same
thing because the public site is rebuilt whole. The private bucket is synced, and a sync
that only adds leaves withdrawn private files served at their old paths. That is a privacy
failure wearing the costume of a stale page.

Decision 6 keeps the hub out of the business of deleting a satellite's data. The hub
renders; the satellite owns its bytes. A hub that pruned the bucket would need delete
permission across every prefix — the blast radius ADR-0007 spent the whole phase bounding.

## Alternatives Considered

### Treat a missing manifest as "withdraw everything"

Simpler, and it makes withdrawal expressible by deleting one file.

Rejected. It makes every transient failure — a truncated sync, a partial upload, an
interrupted publish — indistinguishable from an intentional retraction, and the
consequence lands on private content. A system that cannot tell a fault from an intention
will eventually act on the wrong one, silently.

### Have the hub prune the content bucket to match the manifest

The hub holds `objectViewer` today; give it delete and let it reconcile.

Rejected. It would give the hub delete authority over every satellite's prefix to solve a
problem the manifest already solves, and it makes the hub responsible for data it does not
own. It also destroys the satellite's own history, which versioning exists to protect.

### Let satellites prune by granting `storage.objects.list`

The obvious fix for "cannot prune".

Rejected, and this is the trade the whole design turns on. `list` cannot be prefix-scoped,
so granting it to let `phd-milestones` tidy its own prefix would also let `cv` enumerate
`phd-milestones`' object names. Withdrawal is worth less than that boundary.

### Version the withdrawal — a tombstone item

An item with `withdrawn: true` rather than absence.

Rejected for now, though it is the tidier model. It adds a field and a state to the
contract to express something absence already expresses, and it does not solve decision 5,
which is where the actual risk is. Worth revisiting if withdrawal ever needs an audit trail.

## Consequences

### Positive

- A withdrawn private item actually stops being served, rather than stopping being linked.
- A sync fault fails loudly instead of quietly emptying the private area.
- A source whose prefix vanishes is detected (C27), which matters once one of them is private.
- The hub needs no delete permission anywhere.

### Negative / Tradeoffs

- **Withdrawn bytes remain in the content bucket**, readable by the hub's identity, until
  the satellite deletes them. Withdrawal removes the item from the site, not from storage.
  For genuinely sensitive material the satellite must delete the object as well, and that
  is on the satellite owner — stated in `docs/satellites.md` rather than assumed. *(That
  statement was missing from the page when this ADR claimed it; added 2026-09-17 after the
  site stream noticed the ADR asserting documentation that did not exist.)*
- The expected-source set is another declaration to keep current; a source added to the
  bucket but not to that list is invisible, and one removed from the bucket but left in the
  list fails the build until someone edits it.
- A destructive sync (decision 5) is a sharper tool than an additive one. It is scoped to
  the private output directory only.

### Risks

- **Decision 5 is a delete against a bucket.** A bug that produced an empty `dist-private`
  would delete the private area's contents. Mitigated by decision 3 (an empty or missing
  manifest fails the build before the sync runs), by bucket versioning, and by the sync
  being scoped to the private bucket alone. It is the one place in this system where a
  build defect can remove data, and it should be reviewed with that in mind.
- **An item withdrawn and later republished at the same path** reuses a path whose old
  bytes may still be recoverable from a noncurrent generation. Acceptable, and the same
  property that makes overwrite recoverable.

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

- `llm/governance/adr/0007-hub-polls-content-bucket-no-satellite-github-credential.md` —
  why a satellite cannot list, and therefore cannot prune
- `llm/governance/adr/0005-two-output-build-with-leak-check.md`
- `llm/governance/adr/0004-private-area-cloud-run-gate-behind-hosting.md`
- `llm/specs/2026-09-10-research-hub-design.md` §3, §4, §12.1
- `llm/specs/2026-09-10-research-hub-design.md` **§6 requirement 3 — amended by this
  ADR's decision 5.** It read "Gate service account is the bucket's only reader"; the
  destructive sync makes that unimplementable, so the private bucket carries exactly two
  principals. Recorded here because an ADR that amends design authority in substance must
  say so, as ADR-0008 did for §2 and §4.
- `llm/sprints/2026-09-hub/STATE.md` — C23, C27; Chief Reviewer S9

## Related Issues / PRs

- #24 — hub-003: Phase 3 — Private area

## Supersedes

None.

## Superseded By

None.
