# ADR-0014: Satellites call the publish contract at a moving `v1` tag

Status: Accepted
Date: 2026-09-21

## Context

Satellites call the hub's publishing contract as a composite action from a job
holding `id-token: write`:

```yaml
- uses: djjay0131/website/contract/publish@main
```

`docs/satellites.md` §"Why `@main` and not a pinned commit" chose that moving
reference deliberately, and stated the trade plainly: contract fixes reach
every satellite without a pull request in each one, **"which matters when the
fix is a security fix"**, at the cost that *any push to the hub's `main`
immediately changes what runs inside a satellite's workflow*. It named the
escape hatch if that ever became unacceptable: **"a moving `v1` tag the hub
advances deliberately, not a commit SHA that would freeze every satellite on a
stale contract."**

Wave 0's supply-chain check (check 6) required every `uses:` ref pinned by full
SHA. Closing it, the Lead Architect pinned `contract/publish` to
`f98a928a1b92b2248b130822ba5098fb926b8898` across `cv`, `phd-milestones` and
`agentic-kgis` — **the precise thing that sentence rules out** — and did so by
commit message, with no ADR. ADR-0007 does not authorise it: its SHA-pinning
language is decision 6, about `google-github-actions/upload-cloud-storage`, and
it never names `contract/publish`.

That override was found by an independent re-verification of check 6
(`llm/sprints/2026-09-hub/handoffs/check-6-reverify.md`, finding F-4), not by
the person who made it.

## Decision

Satellites call the contract at a **moving `v1` tag**, which the hub advances
deliberately:

```yaml
- uses: djjay0131/website/contract/publish@v1
```

1. `v1` is an annotated tag on the hub. It is created at `f98a928`, whose
   `contract/` tree is identical to the one the Wave 0 merge ships.
2. The hub advances `v1` as a deliberate act, never as a side effect of a push
   to `main`. Advancing it is what propagates a contract fix.
3. Breaking changes to the contract get `v2`; satellites migrate by choice.
4. **The same ref governs content fetched from the contract, not only the
   action.** `agentic-kgis` downloads `contract/validate-manifest.mjs` and
   `contract/manifest.schema.json` over HTTP and executes the first with
   `node`. Those URLs carry `v1` too — otherwise a contract fix reaches the
   action and not the validator shipped beside it.
5. Third-party actions remain pinned by full commit SHA. This decision is
   about the hub's own contract, where hub and satellites share one owner.

## Rationale

It is the answer `satellites.md` already gave, and it keeps both properties
that were in tension. Automatic propagation survives: a security fix to the
contract still reaches every satellite with no PR in any of them. The exposure
the SHA pin was closing also goes: an arbitrary push to `main` no longer
changes what runs inside a satellite, because only advancing the tag does.

A commit SHA bought supply-chain strength by severing the propagation path the
contract exists to provide, and severed it silently — nothing would have
reported that satellites had stopped receiving hub fixes until one was needed.

## Alternatives Considered

### Keep the commit SHA pins

Strongest supply-chain guarantee, and already live and proven: the pinned
action executed successfully on `cv`'s `master` and wrote five objects to
`gs://cusati-hub-content/sources/cv/`. Rejected because hub-side security fixes
would then require a pull request in each satellite — the cost
`satellites.md` was written to avoid — and because the failure mode is silent.

### Revert to `@main`

Restores the documented decision exactly and needs no ADR. Rejected: it keeps
the "any push to `main` changes what runs in your workflow" exposure, which is
real even with one owner, and it discards hardening that cost nothing to keep.

### A `v1` branch rather than a tag

Equivalent propagation. Rejected: a branch invites incidental pushes, which is
the property being removed. A tag moves only when moved.

## Consequences

### Positive

- Hub-side contract and security fixes propagate to every satellite with no PR
  in any of them, as originally designed.
- An arbitrary push to the hub's `main` no longer alters satellite runtime.
- The validator and schema travel with the action at the same ref.

### Negative / Tradeoffs

- The hub must remember to advance `v1`. A fix merged to `main` and not tagged
  reaches nobody, and nothing reports that.
- One more release step, and a tag that must never be deleted.

### Risks

- **A moved tag is invisible to satellites.** Advancing `v1` changes what runs
  in every satellite with no signal in those repositories. Mitigation: the tag
  is annotated, and advancing it is a deliberate hub action recorded in the
  annotation.
- **`v1` could be advanced past a breaking change.** Mitigation: breaking
  changes take `v2`; `contract/README.md` states what "breaking" means.
- Third-party actions must not drift back to tags under the impression this
  decision covers them. It does not; it is scoped to the hub's own contract.

## Impacted Areas

- [x] Product
- [ ] Domain model
- [x] Architecture
- [x] Security
- [x] Documentation

`llm/specs/2026-09-10-research-hub-design.md` §Satellite integration is amended
by this ADR. `docs/satellites.md` is a derived view and follows it. Sprint
contracts naming `@main` are historical records of issued work and are not
edited.
