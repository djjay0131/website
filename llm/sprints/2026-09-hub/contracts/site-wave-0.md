# Bounded contract — `site`, Wave 0

Status: Active
Issued: 2026-09-18
Issued by: Lead Architect
Issue: #44 (hub-007)
Wave: 0 — close out Phase 3 honestly

> **File-ownership note, recorded rather than silently resolved.** The run brief's §5 roster
> gives `.github/workflows/build.yml` to the **infra** stream, while listing the private-sync
> second auth step — a `build.yml` change — under **site**. One file has one owner. `build.yml`
> is infra's this wave; this contract therefore specifies the *requirement* and infra
> implements it. The same rule that produced this note is the one that keeps two streams from
> each being green while disagreeing (STATE: "A cross-stream environment variable is a
> contract, and nothing checks it").

---

```text
ROLE
  Site implementation specialist. You own the Astro application and the Hosting
  configuration. Wave 0 gives you three small, independent items. None of them is cosmetic
  except the one that is, and that one is the owner's explicit instruction.

OBJECTIVE
  1. Flip phd-milestones to `required: true` in EXPECTED_SOURCES.
  2. Fix the Projects page title.
  3. Specify (do not implement) the private-sync identity split for build.yml.

REQUIRED READING
  site/src/lib/hub-content.mjs                           EXPECTED_SOURCES and its consumers
  site/scripts/check-no-private-in-public.mjs            the leak check
  site/scripts/                                          the sync scripts, to see how
                                                         EXPECTED_SOURCES is actually used
  .github/workflows/build.yml                            READ ONLY — infra owns it
  llm/governance/adr/0010-withdrawal-semantics.md        decision 4 and its 2026-09-17
                                                         amendment — the whole reason the
                                                         `required` flag exists
  llm/sprints/2026-09-hub/STATE.md                       §Checkpoint 4 execution record,
                                                         §Follow-ups, §Standing constraints
  llm/master-roadmap.md                                  §phase-3-private-area
  llm/sprints/2026-09-hub/contracts/phase-3-seams.md     SEAM-4, SEAM-5, SEAM-8, SEAM-9

FILE CONTRACT
  You may create and modify, and nothing else:
      site/**
      firebase.json

  Do not modify, under any circumstance:
      .github/workflows/build.yml     — infra owns it this wave (see the note above)
      .github/workflows/ci.yml, .github/workflows/gate.yml
      gate/**, infra/**, contract/**
      llm/**, docs/**                 — Lead Architect only
      any other repository

ITEM 1 — FLIP phd-milestones TO required: true

  Today:  { source: "phd-milestones", required: false, since: "Checkpoint 4", ... }

  It was correct to ship `false`. ADR-0010 decision 4's amendment says exactly why: a source
  must be declared before it can publish, and a guard that fails every build in the meantime
  would simply be deleted. But phd-milestones HAS now published — Checkpoint 4 put
  manifest.json, site/index.html, site/committee.html and site/assets/style.css under
  sources/phd-milestones/ — so `false` is now the wrong value, and C27 remains open for the
  one source it was written for. A vanished prefix currently goes undetected.

  Deliverable: flip it, update the `note` to say it has published and when, and make sure a
  test covers the consequence — that a REQUIRED source whose prefix is entirely absent fails
  the build.

  PROVE THE GUARD FIRES. Construct the absent-prefix case and show the build failing, then
  restore and show it passing. Both transcripts go in the handoff. A flip with no failing
  demonstration is precisely the shape of guard this sprint has produced three times while it
  proved nothing.

ITEM 2 — THE PROJECTS PAGE TITLE

  The owner's instruction, 2026-09-18, verbatim: the Projects page title currently reads
  "Selected Projects & Research"; it is "Projects". Research keeps the digests, and the two
  sections stay separate — the owner considered merging them and declined, so the section
  enum is unchanged.

  Change the title and nothing else. Check whether that string appears anywhere besides the
  page — nav, OG metadata, tests, the sitemap, a layout prop — and change every occurrence
  that names the page, leaving any that names something else. List every occurrence you found
  and what you did with each.

ITEM 3 — SPECIFY THE PRIVATE-SYNC IDENTITY SPLIT (do not implement)

  Today the PUBLIC site's deploy identity, hub-deploy, also holds create/delete/get/list on
  the private bucket, because it runs the destructive private sync (ADR-0010 decision 5,
  SEAM-1). The infra stream flagged the stronger form for the owner: a dedicated private-sync
  identity, so the public deploy identity holds no private-bucket access at all. The owner
  has now chosen it. It needs a second auth step in build.yml, which is infra's file.

  Your deliverable is the SPECIFICATION infra implements:
    - which build.yml step needs which identity, in order;
    - the exact environment-variable and secret-less WIF inputs each step needs, named
      precisely — not described in prose. A cross-stream variable is a contract and nothing
      checks it; Phase 3 cost one defect exactly here, where infra rendered PRIVATE_BUCKET
      and the gate read GATE_PRIVATE_BUCKET, and nothing would have caught it;
    - what must be true after the change: the public deploy identity has no permission on
      the private bucket, and the private sync still works;
    - how to prove BOTH halves live.

  Write it as a seam, in the style of phase-3-seams.md. Do not edit build.yml.

CONSTRAINTS
  - NO git mutations, NO gh mutations, NO cloud mutations. You write files and report.
  - `gh` is not on PATH. Prefer reading the repository. If genuinely needed:
    GH="/mnt/c/Program Files/GitHub CLI/gh.exe".
  - Node 24 / npm 11 are available. `npm test` must pass.
  - Every tracked *.sh beginning with a shebang must be committed 100755. /mnt/c reports
    every file as 0777 — verify with `git ls-files -s`, NEVER `ls -l`.
  - Do not weaken or delete a test to make a change pass. ADR-0011's stated risk is exactly
    this: "if private-structure.test.ts is deleted to make a change pass, the guarantee goes
    with it silently." If a test blocks you and you believe it is wrong, report it and stop
    at that point.
  - Do not quote private content. No private slug, title or byte in any file you write.
  - No secret, token or key in any file you write.

  WHAT YOU MUST NOT TOUCH, because Wave 0b owns it: the publish allowlist and
  private-by-default. Do not begin it, do not stub it, do not restructure hub-content.mjs in
  anticipation of it. It has its own branch, its own seams and its own contract, and it
  depends on decisions not yet recorded.

DEFINITION OF DONE
  Items 1 and 2 implemented; item 3 specified. `npm test` green, both builds green, the leak
  check still shown failing on a planted slug. The required-source guard shown failing and
  then passing. Every occurrence of the old page title accounted for.

OPEN QUESTIONS
  Record anything unresolved, with the evidence that would settle it.

ADR CANDIDATES
  Name any durable decision implied by your work but written down nowhere.

GIT
  None. You make no commits, no branches, no pushes.

FINAL REPORT -> llm/sprints/2026-09-hub/handoffs/site-wave-0.md
  ## Summary
  ## Assumptions
  ## Recommendations
  ## Alternatives considered
  ## Risks
  ## Open questions
  ## Related docs
  ## ADR candidates
  plus: a Validation section with verbatim output, the break-it/restore-it transcripts for
  the required-source guard, the full list of title occurrences, and the item-3 seam.
```

## Cross-references

- `llm/governance/adr/0010-withdrawal-semantics.md` — decision 4 and the `required` flag
- `llm/governance/adr/0011-two-srcdirs-not-a-visibility-filter.md` — why the structure is
  the guarantee, and what deleting its test would cost
- `llm/sprints/2026-09-hub/contracts/phase-3-seams.md` — SEAM-1, SEAM-4, SEAM-5, SEAM-8
- agentic-governance `llm/governance/patterns/prompt-patterns.md` — Universal
  Bounded-Contract Skeleton
