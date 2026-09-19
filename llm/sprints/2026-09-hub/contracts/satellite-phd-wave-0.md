# Bounded contract — `satellite-phd`, Wave 0

Status: Active
Issued: 2026-09-18
Issued by: Lead Architect
Issue: #44 (hub-007)
Wave: 0 — close out Phase 3 honestly

---

```text
ROLE
  Satellite specialist for djjay0131/phd-milestones. You work in ONE repository and it is not
  the hub. It is private, it holds a milestone tracker and a committee dossier that name and
  assess real people, and it is the repository whose accidental exposure is Incident A1 in
  this sprint's record. Treat it accordingly.

OBJECTIVE
  1. Self-host the webfonts the private pages currently load from a third-party CDN (H-5).
  2. Prepare — do not execute — the withdrawal proof the Chief Reviewer asked for (Part C).

WORKING CHECKOUT
  /mnt/c/code/phd-milestones   (verify it exists and report its branch before doing anything)

REQUIRED READING
  the repository's own tree                              its workflow, manifest, site/ pages
  /mnt/c/code/website/llm/sprints/2026-09-hub/STATE.md   §Follow-ups (H-5, and Part C, which is
                                                         quoted below in full), §Checkpoint 4
                                                         execution record, §Standing constraints
  /mnt/c/code/website/llm/governance/adr/0010-withdrawal-semantics.md   all of it
  /mnt/c/code/website/llm/sprints/2026-09-hub/contracts/phase-3-seams.md   SEAM-5, SEAM-7
  /mnt/c/code/website/contract/README.md                 the publishing contract you obey

FILE CONTRACT
  You may create and modify files ONLY inside /mnt/c/code/phd-milestones.

  Do not modify, under any circumstance:
      anything in /mnt/c/code/website          — read it, never write it
      anything in any other repository
  You are read-only in the hub.

ITEM 1 — SELF-HOST THE WEBFONTS (H-5)

  The private pages load webfonts from a third-party CDN. So a signed-in member reading
  private material makes a request to that CDN, which learns the reader's IP and the referring
  page. The referring page is a private URL. That is a real privacy property of the private
  area, not a style preference.

  The hub already self-hosts its own fonts via @fontsource; follow that precedent where it
  fits, but this repository's build is its own and may differ.

  Deliverable: the private pages load every font from the same origin. No request leaves the
  origin when a member opens either page.

  PROVE IT, and prove it the way that cannot be faked: enumerate every external URL the built
  pages reference — fonts, stylesheets, scripts, images, anything — before and after. The
  acceptance evidence is the "after" list, showing the CDN gone. Grep the built output, do not
  reason from the source. A @font-face rule can be unreferenced and still fetched, and an
  @import inside a stylesheet is easy to miss by reading.

  Change the seed content as little as possible. Phase 3's contract forbade editing it at all,
  which is why this was deferred rather than done. You may now edit it, but confine yourself
  to what the font change requires, and list every file touched with a one-line reason.

ITEM 2 — PREPARE THE WITHDRAWAL PROOF (do not execute it)

  The Chief Reviewer's Part C, verbatim from STATE:

    "Prove the private sync's bucket driver on its first run, in this order: after the first
     successful private-sync, confirm the dry run's delete list is empty against an empty
     bucket; then withdraw one item deliberately and confirm the next dry run names exactly
     that item's objects and no others BEFORE the apply step runs. Cheap while the bucket is
     nearly empty; do not skip to trusting it on a full one."

  This is the single most dangerous mechanism in the system. ADR-0010 decision 5 makes the
  private sync DESTRUCTIVE — it deletes destination objects the current build did not produce
  — and the ADR's own Risks section says so plainly: "It is the one place in this system where
  a build defect can remove data."

  Your deliverable is a BRANCH, ready to push, that withdraws exactly one item, plus the
  procedure to verify and revert it. You do not push it. You do not publish. You make no cloud
  call.

  It must specify:
    - which item to withdraw, and why that one is the safest choice;
    - the exact manifest diff (an item removed from `items` — NOT a deleted manifest, which
      ADR-0010 decision 3 makes a build FAULT precisely so that a transient failure cannot be
      mistaken for an intentional retraction);
    - the exact objects that withdrawal should cause the dry run to name — enumerate them by
      name, so "exactly that item's objects and no others" is a checkable claim rather than an
      impression;
    - the restore procedure, and how to confirm the restore actually worked;
    - what result would mean the driver is WRONG, and what the Lead Architect should do then.

  That last point is the one that matters. A proof that can only come out one way proves
  nothing. State the failure signature as concretely as the success signature.

CONSTRAINTS
  - NO git mutations. NO gh mutations. NO cloud mutations. No push, no publish, no workflow
    dispatch, no bucket write. You write files and report; the Lead Architect commits and
    pushes in this repository, exactly as in cv and website.
  - DO NOT QUOTE PRIVATE CONTENT ANYWHERE. Not in your handoff, not in a commit message you
    draft, not in a code comment, not as an example. You may name a file and its size. You may
    not reproduce a sentence of the tracker or the dossier. This repository's contents are the
    subject of Incident A1; the owner has accepted the residual exposure from that incident and
    will not accept a second.
  - The repository is PRIVATE and stays private.
  - No secret, token or key in any file you write. It holds no GitHub credential for the hub
    and must never acquire one (ADR-0007 decision 2).
  - Its publish identity holds no storage.objects.list and must never be granted it
    (ADR-0007 decision 4).
  - actionlint clean on any workflow you touch.
  - Every tracked *.sh beginning with a shebang must be 100755; verify with `git ls-files -s`,
    never `ls -l` — /mnt/c reports every file 0777.
  - Note: this repository was committed with core.fileMode=false (Chief Reviewer N-7). Check
    modes explicitly rather than trusting git to have noticed them.

DEFINITION OF DONE
  Item 1 implemented, with the before/after external-URL enumeration from the BUILT output.
  Item 2 prepared as a ready-to-push branch plus its procedure, with the failure signature
  stated as concretely as the success signature. Nothing pushed. Nothing published.

OPEN QUESTIONS
  Record anything unresolved with the evidence that would settle it.

ADR CANDIDATES
  Name any durable decision implied by your work but written down nowhere.

GIT
  None. You make no commits, no branches, no pushes — including in phd-milestones. Prepare the
  withdrawal change as working-tree edits or a patch file and describe it; the Lead Architect
  creates the branch.

FINAL REPORT -> /mnt/c/code/website/llm/sprints/2026-09-hub/handoffs/satellite-phd-wave-0.md
  (the handoff lives in the HUB, because that is where this sprint's record lives; it is the
   one file you may write outside phd-milestones)
  ## Summary
  ## Assumptions
  ## Recommendations
  ## Alternatives considered
  ## Risks
  ## Open questions
  ## Related docs
  ## ADR candidates
  plus: the before/after external-URL lists, every file touched with its reason, and the
  full withdrawal-proof procedure including its failure signature.
```

## Cross-references

- `llm/governance/adr/0010-withdrawal-semantics.md` — decisions 2, 3 and 5; the destructive
  sync and why a missing manifest is a fault rather than a withdrawal
- `llm/sprints/2026-09-hub/contracts/phase-3-seams.md` — SEAM-5, SEAM-7
- `llm/sprints/2026-09-hub/STATE.md` — §Follow-ups (H-5, Part C), §Incident A1
- agentic-governance `llm/governance/patterns/prompt-patterns.md` — Universal
  Bounded-Contract Skeleton
