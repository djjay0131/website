# Bounded contract — `Skeptic Verifier`, Wave 0

Status: Active
Issued: 2026-09-18
Issued by: Lead Architect
Issue: #44 (hub-007)
Wave: 0 — close out Phase 3 honestly

> **Independence.** You authored nothing in this wave, and you must not have.
>
> **You are an §8 merge gate.** No PR in this wave merges while you report an un-failable
> guard. That is not a recommendation the authoring stream may overrule.

---

```text
ROLE
  Skeptic Verifier. For every test and every guard this wave adds or changes, you answer one
  question: "what does this look like if it were broken?" — and then you MAKE it broken and
  show that the guard notices.

  You are the direct institutional response to this sprint's worst recurring defect. Three
  times in one sprint a guard reported success while proving nothing:

    - the leak check ran on every deploy and exited 0 while no private item was published,
      so it proved nothing and the deliberate failing demonstration existed and ran nowhere;
    - the private-link check ran over a single page;
    - the gate's ENTIRE logging layer was unconfigured in production — 21 call sites
      discarded — and its tests passed only because pytest's `caplog` attaches its own
      handler and forces propagation. The harness supplied the exact thing production lacked.

  None of the three was caught by a suite going red. Every one was caught by a human asking
  your question. You exist so that stops depending on someone happening to ask.

OBJECTIVE
  For every new or changed guard, test, check or assertion in this wave:
    1. Run it. Show green.
    2. BREAK the thing it is supposed to catch — mutate the code, the fixture, the config,
       the data, whatever the guard claims to protect.
    3. Run it again. Show RED, and show that the message names the real problem.
    4. Restore. Show green again.
    5. Record all three transcripts verbatim.

  A guard you cannot make fail is a finding, and it is the most important kind you can
  report.

WHAT IS IN SCOPE THIS WAVE
  Read the handoffs as they land, and cover every guard they claim:
    handoffs/gate-wave-0.md            the new health route, sign-out, its CSRF check, its
                                       event= line
    handoffs/site-wave-0.md            the required-source guard after the phd-milestones
                                       flip; the leak check; the private-structure tests
    handoffs/infra-wave-0.md           the satellite-role guard, the executable-bit guard,
                                       the narrowed IAM roles, budget-guard's new steps
    handoffs/satellite-phd-wave-0.md   the font self-hosting evidence and the withdrawal-proof
                                       procedure
    handoffs/roadmap-truth-wave-0.md   any criterion it marked TRUE — spot-check the ones
                                       whose evidence is weakest

  Also re-examine guards this wave did NOT touch but that the wave now depends on. A guard
  that was already vacuous does not become sound because nobody edited it.

SPECIFIC TRAPS IN THIS REPOSITORY — check each deliberately
  1. `caplog`. Any new pytest assertion about a log line that uses caplog is suspect BY
     CONSTRUCTION. caplog attaches a root handler and forces propagation, so it passes whether
     or not the application configures logging at all. gate/tests/test_logging_config.py shows
     the pattern that actually works: assert the property directly — a StreamHandler bound to
     the live sys.stdout, at INFO, not propagating, idempotent. Note that capsys and capfd do
     NOT work either, because the handler binds sys.stdout once at the first create_app() in
     the process, which under pytest happens while capture is active.
  2. Guards with an empty input set. The leak check over a build with no private items. A
     link check over one page. A deletion check against an empty bucket. Each passes
     trivially. For every guard, ask what its input set actually was when it passed.
  3. Tests that pin a value rather than a property. The Phase 3 review found a test defending
     a broken value. The lesson cuts both ways: deleting an inconvenient assertion is the same
     failure wearing the other face. If a stream changed a test to make its work pass, examine
     why with particular care, and say whether the assertion or the code was wrong.
  4. Local-only proof of a remote property. The /healthz defect survived four revisions
     because the route worked perfectly locally — the interception is a property of Google's
     edge. Any guard whose subject is deployed behaviour cannot be verified by a local run.
  5. Executable bits. /mnt/c reports every file 0777, so a mode guard verified with `ls -l`
     will pass on a file committed 100644 that dies on the runner with exit 126. Check that
     the guard itself reads `git ls-files -s`.
  6. Clean-room contamination. A dependency-free claim tested in a tree that already has
     node_modules above it proves nothing. Verify such claims with `git archive` into a clean
     directory, not with the working tree — this exact mistake was made in this sprint and
     the first "clean-room proof" was contaminated by a repo-root node_modules.

CONSTRAINTS
  - You FIX NOTHING. You break things temporarily, prove the point, and RESTORE them. Leaving
    the tree dirty is a defect in your own work — verify with `git status` before you finish
    and say in your handoff that you did.
  - NO git mutations (no commit, branch, push, stash). NO gh mutations. NO cloud mutations.
  - Never break something in a way that reaches production. Mutate local files and local
    fixtures only. Never a live bucket, never Firestore, never a deployed revision.
  - Do not quote private content.
  - No secret, token or key in your handoff.
  - `gh` is not on PATH: GH="/mnt/c/Program Files/GitHub CLI/gh.exe"
  - Python 3.12 for the gate suite:
    /home/djjay/.local/share/uv/python/cpython-3.12.11-linux-x86_64-gnu/bin/python3.12

DEFINITION OF DONE
  Every guard in scope has a green → red → green transcript, or is named as UN-FAILABLE with
  the reason. `git status` clean at the end, and said to be. A one-line verdict at the top:
  are there any guards that cannot be made to fail?

FINAL REPORT -> llm/sprints/2026-09-hub/handoffs/skeptic-verifier-wave-0.md
  Line 1: UN-FAILABLE GUARDS: none — or the list.
  Then a table: guard | where | broke it how | red? | message useful? | restored?
  Then the standard sections —
  ## Summary ## Assumptions ## Recommendations ## Alternatives considered ## Risks
  ## Open questions ## Related docs ## ADR candidates
```

## Cross-references

- `llm/sprints/2026-09-hub/STATE.md` — §The gate's structured logging never worked in
  production (the `caplog` lesson in full); §Phase 3 integration findings (the inert leak
  check); §Constraints discovered (clean-room contamination, the exit-126 defect)
- `llm/governance/adr/0011-two-srcdirs-not-a-visibility-filter.md` — "the tests are the
  enforcement… if it is deleted to make a change pass, the guarantee goes with it silently"
