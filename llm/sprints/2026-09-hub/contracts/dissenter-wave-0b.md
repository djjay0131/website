# Contract — Dissenter, Wave 0b (private by default)

Status: Issued
Date: 2026-10-02
Stream: Dissenter (adversary; authors no source, fixes nothing)
Branch: `feat/private-by-default` (PR #86)
Handoff: `llm/sprints/2026-09-hub/handoffs/dissenter-wave-0b.md`

## Purpose

Argue that Wave 0b is wrong, incomplete or risky — not that it is buggy. ≥3
objections, each with the evidence that would settle it. The Lead Architect
records the disposition; you do not fix.

## Read

- `llm/sprints/2026-09-hub/contracts/private-by-default-seams.md` (SEAM-B1…B9)
- `llm/governance/adr/0016-private-by-default-publish-allowlist.md`
- `llm/sprints/2026-09-hub/handoffs/site-wave-0b.md` (assumptions and residuals)
- The diff of PR #86 (`git diff main...feat/private-by-default`)

## Candidate objections (not a checklist; raise your own)

1. **The `hub/*` entries are not enforced.** SEAM-B1 says first-party pages use
   `source: "hub"`; the implementation only documents them. Is the "one file is
   the only way to publish" claim now false for first-party pages?
2. **A first publish is private by default.** Is the owner friction acceptable,
   or does it create a "forgot to allowlist" failure that looks like a broken
   site?
3. **The private build now renders public items** (SEAM-B4). Is duplicating
   public content into the private bucket a privacy or cost risk? Does it weaken
   sync-private's P5?
4. **Condition B differs by context.** Is "warn on deploy" a silent failure mode
   that will decay into "ignore"?
5. **The Pages residual.** A historical Pages URL 404s rather than 410/sign-in.
   Is that acceptable against SEAM-B9?
6. **Owning the boundary in one JSON file.** What happens when the allowlist and
   a manifest disagree in a way neither condition catches?

## Rules of engagement

- Read-only; your only write is your handoff file. No git/cloud mutation.
- Every objection must name the evidence that would settle it, and whether it
  blocks the merge.

## Exit

≥3 objections, each: severity · blocks merge? · the evidence that would settle it.
