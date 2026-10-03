# Wave 5 review contracts (Phase 6)

Status: Issued · Date: 2026-10-03 · Branch: `feat/phase-6` · Issue: `hub-006`
Seams: `contracts/phase-6-seams.md`; ADR-0020. Report, do not fix; handoff only.

## Red Team

≥5 attacks: plant a private slug/title in `dist-private` and in each derived
output (sitemap, `rss.xml`, a Pagefind text file, an OG path, a stub) and show
whether `check:no-private-in-public` catches each or fails to; attack the stub
generator (a `to` value that injects markup/`javascript:` into the meta-refresh;
a `from` with `..`); attack Pagefind indexing (is anything outside `dist-public`
reachable?); confirm the Pages artifact contains only stubs; confirm every
`uses:` SHA-pinned. Output `handoffs/red-team-wave-5.md`.

## Dissenter

≥3 objections with the evidence that would settle each. Angles: does the stubs
model actually satisfy "Pages retired" (the environment still exists); a stub
naming the private fellowship path; Pagefind's binary index being outside the
leak check's content scan; RSS scope (manifests only — first-party digests
absent); the `redirects:check` follow-up being deferred while the roadmap
acceptance depends on the map. Output `handoffs/dissenter-wave-5.md`.

## Skeptic Verifier

Break each NEW guard, show the named test red, restore, show green: the stub
generator's escaping and `from`/`to` validation; the leak check's derived-output
coverage (remove a needle/output and show `demo:leak-check` no longer names it);
the search/rss absence from `dist-private`; the CI steps (reason, since no local
run). Report un-failable guards and coverage gaps. Output
`handoffs/skeptic-verifier-wave-5.md`.

## Security Tester

Run the run-brief §6 subset Phase 6 can turn red — a single FAIL blocks:
1. No private content in any public output (build, leak check red→green, plus a
   private marker planted in `dist-private` and in each derived output).
2. The private build emits no search/rss/404/pagefind, and the Pages artifact
   contains only stubs + `404.html`.
3. Stubs/`404.html` contain no private title/summary and are safe (encoded
   targets, no script injection).
4. Supply chain: `pagefind`/`@astrojs/rss` pinned and registry-resolved; all
   actions SHA-pinned.
5. Static public site: `firebase.json` unchanged; no functions/SSR.
6. Firestore/budget unaffected.
Output `handoffs/security-tester-wave-5.md`, with the blocking count.

## Chief Reviewer

Review the Wave 5 hub PR. Check scope; the roadmap `phase-6-polish` criteria
(with `redirects:check` recorded as a deferred follow-up, not ticked); the design
authority (ADR-0005 public-only derived outputs, ADR-0020); §8 conditions;
records consistency; L-level. Output `handoffs/chief-reviewer-wave-5.md`.
