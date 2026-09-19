# Bounded contract — `infra`, Wave 0

Status: Active
Issued: 2026-09-18
Issued by: Lead Architect
Issue: #44 (hub-007)
Wave: 0 — close out Phase 3 honestly

> **File ownership this wave.** `infra/**`, `.github/workflows/build.yml` and
> `.github/workflows/ci.yml` are yours. This differs from Phase 3's SEAM-8, which gave
> `build.yml` to the `site` stream; the run brief reassigns it, and one file has one owner.
> The `site` stream is writing a *specification* for the private-sync identity split that you
> implement — you are its consumer, not its author.

---

```text
ROLE
  Infrastructure specialist. You own Terraform and the two shared workflows. This is the
  largest Wave 0 scope and the only one that changes cloud IAM, so the bar is: nothing is
  widened, several things are narrowed, and every narrowing is proven not to break what it
  protects.

OBJECTIVE — seven items, in this order of risk

  1. satellite-role-guard CI check
  2. Executable-bit guard
  3. Dedicated private-sync identity (implements the site stream's seam)
  4. Narrow roles/firebaseauth.admin on the gate (N-1)
  5. Decide and record projectViewer's legacy read on the private bucket
  6. A second alert channel that does not depend on email, if one exists at zero cost
  7. dev-staging: write the ADR, then implement it if and only if the budget holds

REQUIRED READING
  infra/**                                               all of it; start with README.md,
                                                         gate.tf, buckets, wif.tf, monitoring.tf
  infra/scripts/check_private_bucket_config.py           the invariant you must not break
  .github/workflows/build.yml, ci.yml                    your files this wave
  llm/governance/adr/0007-hub-polls-content-bucket-no-satellite-github-credential.md
  llm/governance/adr/0010-withdrawal-semantics.md        decision 5 — why two principals
  llm/governance/adr/0004-private-area-cloud-run-gate-behind-hosting.md
  llm/sprints/2026-09-hub/STATE.md                       §Run-to-completion — preconditions,
                                                         §Checkpoint 3 and 4 execution records,
                                                         §Phase 3 review dispositions (N-1, S-2,
                                                         S-4, S-5), §Follow-ups, §Risks,
                                                         §Standing constraints
  llm/sprints/2026-09-hub/contracts/phase-3-seams.md     SEAM-1, SEAM-8, SEAM-9
  llm/specs/2026-09-10-research-hub-design.md            §8, §12
  llm/sprints/2026-09-hub/handoffs/site-wave-0.md        item 3's seam, IF it exists when you
                                                         start; if not, implement items 1, 2,
                                                         4-7 and report that 3 is waiting

FILE CONTRACT
  You may create and modify, and nothing else:
      infra/**
      .github/workflows/build.yml
      .github/workflows/ci.yml

  Do not modify, under any circumstance:
      site/**, gate/**, contract/**, firebase.json
      .github/workflows/gate.yml      — the gate stream owns it
      llm/**, docs/**                 — Lead Architect only
      any other repository

  Report anything you need outside that set. Do not reach into another stream's file.

THE ABSOLUTE RULE FOR THIS STREAM
  You may run:   terraform fmt -check -recursive,  init -backend=false,  validate
  You may NEVER run:  plan, apply, destroy, import, taint, state rm, or any gcloud/gh command
  that writes.

  The Lead Architect runs plan and apply, reviews the plan before applying, and applies from
  the saved plan file. Your job is to produce configuration that is correct when read.

ITEM 1 — satellite-role-guard CI CHECK

  Assert, in CI, the invariants whose breakage is INVISIBLE:
    - the satellitePublisher custom role holds exactly storage.objects.create, .delete, .get
      — and no list, ever (ADR-0007 decision 4);
    - uniform_bucket_level_access is true on BOTH buckets;
    - the private bucket carries exactly two non-legacy principals, in exactly the roles
      check_private_bucket_config.py asserts (SEAM-1, ADR-0010 decision 5).

  Why this specific list: UBLA is the one that fails OPEN. If it were false, every prefix
  IAM condition would be inapplicable and the whole satellite boundary would be inert with no
  error anywhere. That is the defect class this check exists for.

  Put it in the `budget-guard` job, which is ALREADY a required status check on main, rather
  than in a new job. S-5's precedent is explicit about why: a new job would sit unenforced
  until branch protection changed, and would look like a gate while gating nothing.

ITEM 2 — EXECUTABLE-BIT GUARD

  Assert every tracked *.sh, and every tracked file beginning with a shebang, is mode 100755.

  Use `git ls-files -s`. NEVER `ls -l`: /mnt/c is a DrvFs mount reporting every file 0777, so
  a script committed 100644 runs perfectly locally and dies on the runner with exit 126. That
  cost a red CI in Phase 2 after the specialist had run the script locally, repeatedly, and
  could not have caught it.

  Classify by HOW A FILE IS REACHED, not by how its path is spelled. Five *.mjs files carry a
  shebang while committed 100644 and that is NOT a defect — every one is reached through
  `import` or `node …`, never executed directly. A naive grep for `./name.mjs` flags all five,
  because an ES module import looks identical to a shell invocation. Get this wrong and the
  guard is pure noise, which is how guards get deleted.

ITEM 3 — DEDICATED PRIVATE-SYNC IDENTITY

  Today hub-deploy — the PUBLIC site's deploy identity — also holds create/delete/get/list on
  the private bucket, because it runs the destructive private sync. The owner has chosen the
  stronger form: a dedicated identity, so the public deploy identity holds NO private-bucket
  access at all.

  Implement the site stream's seam. Two halves, and BOTH must be proven:
    a. the private sync still works;
    b. the public deploy identity can no longer touch the private bucket.

  Half (b) is the point of the change and is the one easy to leave unproven. Write down the
  exact command that demonstrates the refusal, for the Lead Architect to run after apply.

  Name every cross-stream variable EXACTLY as the seam names it. Phase 3 cost a defect here:
  infra rendered PRIVATE_BUCKET while the gate read GATE_PRIVATE_BUCKET, no test pinned it,
  and the revision would have failed its health check pointing at the wrong component.

ITEM 4 — NARROW roles/firebaseauth.admin (N-1)

  The Chief Reviewer recorded this as the widest grant in Phase 3 and said it must not survive
  Checkpoint 4 quietly. Session-cookie minting needs firebaseauth.users.createSession; no
  narrower PREDEFINED role was confirmable from a primary source in this environment, so the
  answer is a custom role.

  Verify the permission set against a primary source — `gcloud iam list-testable-permissions`
  against this project — and record what you checked. Do not copy a permission list from
  documentation you have not verified against the live project; the Checkpoint 3 runbook was
  wrong in exactly that way and only running it found out.

  SIGN-IN MUST STILL WORK AFTERWARDS, and that is not something you can prove — you cannot
  apply. Write the precise live verification the Lead Architect runs after apply: an
  email-link sign-in as djjay@vt.edu, the session minted, and the matching gate log line. If
  the narrowed role is wrong, sign-in breaks for the only two members, so state the rollback
  explicitly.

ITEM 5 — projectViewer'S LEGACY READ ON THE PRIVATE BUCKET

  Cloud Storage's automatic legacy bindings (legacyBucketReader / legacyObjectReader for
  projectViewer, and the Editor/Owner pair) apply to the private bucket exactly as they do to
  the content bucket. They are not declared by this module. Consequence: any principal with
  project Viewer on cusati-hub can read every private object — today only the owner.

  That was accepted at Checkpoint 3 for PUBLIC content. On a bucket holding the committee
  dossier it needs an explicit decision.

  Default decision: disable legacy bucket bindings on the private bucket IF uniform
  bucket-level access permits it without breaking the two intended principals. If it does
  not, record the residual honestly, naming the owner as the only project Viewer.

  Establish which of those two worlds we are in from a primary source, and say how you
  established it. Do not assume either.

ITEM 6 — A SECOND ALERT CHANNEL

  The notification channel has no verificationStatus field at all, which means unverified:
  Google emailed djjay@vt.edu at 15:27:37Z on 2026-09-18 and until that link is clicked all
  three alert policies accept events and deliver nothing. The owner also reports Firebase
  sign-in emails never arriving. If the monitoring email also fails to land, that is a second
  independent symptom of ONE delivery problem, and the alerting design should stop depending
  on email.

  Find whether a non-email channel exists at zero cost. A webhook channel is free in Cloud
  Monitoring but is not free of a receiver, so it only counts if a receiver exists at no cost.
  If nothing qualifies, RECORD THAT and move on — do not invent a channel that needs a paid
  service, and do not silently leave the gap undocumented.

  Clicking the verification link is console work and a hard stop for the owner. Write the
  exact step.

ITEM 7 — dev-staging

  The owner asked for a way to review the private area before it ships. Phase 3 proved why:
  the gate needs Cloud Run, Identity Platform and a real session, so there is no way to review
  the members' area as a member without shipping it — and the owner, working over SSH with no
  local browser, could not view a local preview at all.

  Write the ADR FIRST. Default decision, to argue for or against on evidence:
    - a second Firebase Hosting site `hub-dev` in the same project;
    - a `hub-gate-dev` Cloud Run service, min 0;
    - a <project>-private-dev bucket with the SAME two-principal invariant;
    - fixture content only — never real private material;
    - its own members collection prefix;
    - deployed from a `dev` branch.

  THE BUDGET IS THE DECIDER. Compute the cost at zero traffic and show the arithmetic. Total
  project spend must stay under $5/month at zero traffic (§12.6). If it cannot, the ADR
  records the cut and the reason, and this item ends there — that is a legitimate outcome, not
  a failure. Do not implement first and cost it afterwards.

  The private-dev bucket must never hold real private content. A dev environment that mirrors
  production data is a second copy of the committee dossier with weaker controls.

ALSO REPORT (you cannot do these; they are gh mutations, and mine)
  - Promoting `contract-tests` and `leak-check-self-test` to REQUIRED status checks. Required
    contexts on main today are exactly governance-checks and budget-guard, so both currently
    run without gating a merge (#26, S-4). Give me the exact context names as they appear in
    the check runs — not the job names as written in YAML, which are not always the same
    string.

CONSTRAINTS
  - NO git mutations, NO gh mutations, NO cloud mutations, NO terraform plan or apply.
  - Secrets never touch the repo. WIF only. If you find yourself needing a key file, STOP and
    raise it — that is a hard stop, not a judgement call.
  - No new resource without a cost line in your handoff. The $5 budget alert is never removed
    and never weakened (§12.6).
  - Custom roles carry deletion_policy = "PREVENT": a destroyed custom role locks its ID for
    7-37 days, which would block all publishing with no way to apply out of it.
  - Nothing on the public path may execute at request time (§12.4). No functions, no SSR.
  - actionlint clean; terraform fmt -check -recursive and validate clean.
  - Do not quote private content.

DEFINITION OF DONE
  Items 1-6 implemented or explicitly recorded as not-possible with the reason; item 7's ADR
  written and implemented only if the budget holds. Every IAM narrowing carries the live
  verification command the Lead Architect will run after apply, AND its rollback. terraform
  fmt/validate and actionlint clean. Every new guard shown failing deliberately and then
  passing — transcripts in the handoff.

OPEN QUESTIONS
  Record anything unresolved with the evidence that would settle it.

ADR CANDIDATES
  Item 5 and item 7 are both ADR-class. Name any others.

GIT
  None. You make no commits, no branches, no pushes.

FINAL REPORT -> llm/sprints/2026-09-hub/handoffs/infra-wave-0.md
  ## Summary
  ## Assumptions
  ## Recommendations
  ## Alternatives considered
  ## Risks
  ## Open questions
  ## Related docs
  ## ADR candidates
  plus: Validation (verbatim output), a cost table for every new resource, the post-apply
  verification command AND rollback for each IAM change, and the exact required-check context
  names.
```

## Cross-references

- `llm/governance/adr/0007-hub-polls-content-bucket-no-satellite-github-credential.md` —
  the no-`list` rule and the UBLA prerequisite
- `llm/governance/adr/0010-withdrawal-semantics.md` — decision 5, the two-principal invariant
- `llm/sprints/2026-09-hub/contracts/phase-3-seams.md` — SEAM-1, SEAM-8, SEAM-9
- `infra/scripts/check_private_bucket_config.py` — the invariant item 1 must not break
- agentic-governance `llm/governance/patterns/prompt-patterns.md` — Universal
  Bounded-Contract Skeleton
