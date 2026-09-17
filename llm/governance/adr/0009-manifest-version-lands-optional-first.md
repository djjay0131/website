# ADR-0009: `manifest_version` lands optional, and becomes required later

Status: Accepted
Date: 2026-09-17

## Context

The publishing contract has two things that can change independently, and only one of
them is versioned today.

`schema_version` (ADR-0008 decision 5) versions **one `data` payload** — the shape of
`cv`'s YAML tree. It answers "does the hub's renderer understand this source's files?"

Nothing versions **the manifest envelope itself** — the field set, the fixed enums, the
rules every source obeys. And that has already changed: ADR-0008 added a sixth member to
a `format` set the design document called fixed, three weeks after it was written. It
will change again; the contract is young.

The reason this cannot be left until it is needed is `additionalProperties: false`, which
both ends enforce (`contract/manifest.schema.json`, and the mirror in
`site/src/content.config.ts`). A satellite that starts sending a field the hub does not
yet accept is **rejected**, at the publish action, before it uploads. So the field cannot
simply appear when wanted: the hub must accept it strictly before any satellite emits it.

The Chief Reviewer raised this as S8 and STATE carries it as C20, both asking for it
before Phase 3 — while `cv` is the only satellite and the coordination cost is one
repository rather than four.

## Decision

1. **Add `manifest_version` to the manifest now, as an optional top-level string**
   matching `^[0-9]+$` — integers only, no dotted forms. Both ends accept it; neither
   requires it.

2. **Absent means `"1"`.** Every manifest published before this ADR is a version 1
   manifest, and stays valid unchanged. No satellite is obliged to act today.

3. **The hub fails the build on a `manifest_version` it does not know**, exactly as it
   already does for an unknown `schema_version`. Silent tolerance of an unknown envelope
   version is how a contract stops meaning anything.

4. **It becomes required in Phase 5**, when `agentic-kg` and
   `construction-ai-proposal` arrive. By then `cv` and `phd-milestones` emit it, so the
   change is a schema edit rather than a coordinated multi-repository release.

5. **The two version fields are documented as answering different questions**, in
   `contract/README.md` and `docs/satellites.md`:

   | Field | Versions | Bumped by | Consumed by |
   |---|---|---|---|
   | `manifest_version` | the envelope — fields, enums, rules | the hub, when the contract changes | every source |
   | `schema_version` | one `data` payload's internal shape | the satellite owning that payload | the hub's renderer for that source |

## Rationale

Optional-first is the only ordering that works under `additionalProperties: false`. The
alternatives are a flag day or a permanent inability to evolve, and a flag day across
four repositories is exactly what the contract exists to avoid.

Integers only, rather than the `1.2.3` shape `schema_version` permits, because the hub's
check is exact-match against a known list. A dotted version invites compatibility
reasoning — "2.1 should satisfy a consumer expecting 2" — that nothing implements. The
`cv` stream made the same argument about `schema_version` (C24); this ADR applies it to
the field being introduced, where it costs nothing to get right.

## Alternatives Considered

### Require it immediately

Add the field as required in the same change.

Rejected. `cv` publishes today. Requiring the field means `cv`'s next publish fails until
its generator is updated and merged, and the hub build then fails on `cv`'s existing
manifest in the bucket until it republishes. That is a coordinated outage across two
repositories to add a field nobody needs yet.

### Add it when it is first needed

Wait until the contract actually breaks compatibility, then introduce the field.

Rejected, and this is the trap the reviewer identified. At that moment the hub must
accept the field before any satellite sends it, and every satellite must send it before
the hub can rely on it — so it still has to land optional first. Deferring only means
doing this ordering later, with more satellites, under time pressure from whatever change
forced it.

### Version the contract by URL or path instead

Publish to `sources/<source>/v2/manifest.json`, or reference a schema URL.

Rejected. It moves the bucket layout that SEAM-2 fixes and that every IAM prefix
condition is written against, to solve a problem one scalar field solves. It also makes
the version a property of *where* the manifest is rather than *what it says*.

### Do nothing

Rejected explicitly rather than by omission: it is a decision to make the next contract
change a breaking one, and it should be recorded as such if taken.

## Consequences

### Positive

- The contract can evolve without a flag day, from the phase where that costs least.
- An unknown envelope version fails loudly at the hub instead of being half-understood.
- The distinction between "the contract changed" and "this payload changed" becomes
  explicit rather than folded into one field.

### Negative / Tradeoffs

- **Two version fields is a real cognitive cost.** Someone writing a satellite must
  understand which to bump. Mitigated only by documentation, which is why decision 5 puts
  the table in both reader-facing documents rather than in this ADR alone.
- The field is inert until Phase 5. Between now and then it is a field that does nothing
  visible, which invites someone to "tidy it away".

### Risks

- **The Phase 5 promotion to required could be forgotten.** It lives in this ADR and in
  the roadmap; nothing enforces it. The failure mode is benign — the contract simply stays
  as it is — but the evolution problem returns.
- **A satellite could send `manifest_version` while emitting a version-1 shaped manifest**,
  since the field is not tied to a schema variant yet. Today that cannot happen, because
  only `"1"` is known and it means the current shape.

## Impacted Areas

- [ ] Product
- [ ] Domain model
- [x] Data architecture
- [ ] AI architecture
- [ ] Domain-specific systems (see governance delta)
- [x] Integrations
- [ ] UX
- [ ] Security/privacy
- [x] Implementation
- [x] Documentation

## Related Documents

- `llm/governance/adr/0002-satellite-publishing-via-content-bucket-and-dispatch.md`
- `llm/governance/adr/0008-manifest-data-format-hub-renders-cv.md` — `schema_version`
- `llm/specs/2026-09-10-research-hub-design.md` §4
- `llm/sprints/2026-09-hub/STATE.md` — C20, C24; Chief Reviewer S8
- `contract/manifest.schema.json`, `site/src/content.config.ts`

## Related Issues / PRs

- #24 — hub-003: Phase 3 — Private area

## Supersedes

None.

## Superseded By

None.
