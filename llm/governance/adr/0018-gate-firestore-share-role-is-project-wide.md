# ADR-0018: The gate's share store uses a project-wide Firestore role

Status: Accepted
Date: 2026-10-03

## Context

The share store (`gate/app/shares.py`) reads and writes `shares/{token}`. The
gate runtime service account (`hub-gate`) held only `roles/datastore.viewer`, a
deliberate Phase 3 narrowing (SD-3) recorded with "Phase 4 changes this line when
Phase 4 needs it, reviewed at that time." SEAM-S5 anticipated the change.

## Decision

1. **`hub-gate` holds `roles/datastore.user`** on the project, replacing
   `roles/datastore.viewer`. It is a single `google_project_iam_member`
   replacement; no stateful resource is touched.

2. **The collection discipline is code plus released rules, not IAM.** Firestore
   data roles are project-level; IAM has no "`shares/` only" spelling. The one
   share writer is `FirestoreShareStore`, which targets `shares/{token}`; the
   released Firestore rules stay deny-all so no client SDK can read `shares/` or
   `members/`.

3. **`datastore.user` includes delete, and that is named, not implied.** The
   store needs create/get/update/list; `DELETE /share/{token}` sets
   `revoked: true` and never deletes a document. No predefined role holds only
   those four verbs, and a bespoke custom role risks being too narrow to connect
   the Admin SDK — the same reason the read-only custom role was rejected at
   Phase 3. The collection discipline, not the role, bounds the writer.

## Rationale

The alternative — a custom role with an uncertain permission set — would fail
closed by breaking the private area, and Firestore custom roles are project-wide
anyway. The pragmatic grant matches the stream that wrote the store and the seam
that specifies it, and the change is reviewable and reversible with one binding.

## Alternatives Considered

### A custom role limited to the share entities

Rejected. No primary source established the exact permission set the Python
Admin SDK needs to connect, and a role too narrow to connect fails the private
area closed. Recorded as the same judgement as the Phase 3 read-only narrowing.

### Keep `datastore.viewer` and have the station write through a separate service

Rejected. A second service is a larger surface and another credential; the seam
already places the store in the gate.

## Consequences

### Positive

- The share store works without a schema or architecture change.
- One binding, one plan line, trivially reversible.

### Negative / Tradeoffs

- **Blast radius.** A compromised gate image can now write `members/` as well as
  `shares/`, and the Admin SDK bypasses the released rules. It could persist a
  `role: owner` backdoor. This is accepted: the gate is first-party code, the
  role is the narrowest predefined option that works, and the gate already reads
  the private bucket. The widening is recorded here and in the Wave 3 security
  review rather than left implicit.

### Risks

- If a second Firestore database is ever created in this project, the
  project-level grant reaches it. The gate's own `gate.tf` comment names this.

## Impacted Areas

- [ ] Product
- [ ] Domain model
- [ ] Data architecture
- [ ] AI architecture
- [ ] Domain-specific systems (see governance delta)
- [x] Integrations
- [ ] UX
- [x] Security/privacy
- [x] Implementation
- [x] Documentation

## Related Documents

- `llm/sprints/2026-09-hub/contracts/phase-4-seams.md` — SEAM-S5
- `llm/sprints/2026-09-hub/contracts/gate-wave-3.md`
- `infra/gate.tf` — the grant and its rationale comment
- `infra/firestore.tf` — the deny-all ruleset and release

## Related Issues / PRs

- `hub-004` — Wave 3, Phase 4 sharing

## Supersedes

None.

## Superseded By

None.
