# Bounded contract — `infra`, Wave 0 fixes

Status: Active
Issued: 2026-09-19
Issued by: Lead Architect
Issue: #44 (hub-007); fixes #55, #58, and part of #53's review findings
Wave: 0 — clearing the §8 blockers

> Two reviewers independently found that the guard shipping in PR #53 **watches an empty role
> and runs nowhere**, while the PR's own README presents it as the mitigation. That is the
> shape this sprint has now hit five times: a correct guard and a missing guard are
> indistinguishable from outside.

---

```text
ROLE
  Infrastructure specialist, repairing the guard PR #53 shipped and wiring the check that has
  never run.

OBJECTIVE
  1. Make the private-bucket guard watch the role that actually reaches the objects (#55).
  2. Wire the live half of the §12.1 bucket IAM test to something that runs (#58).
  3. Fix the UBLA shape-tolerance defect in check-private-bucket-iam.sh.
  4. Specify what the gate's Origin fix needs from Terraform.

REQUIRED READING
  infra/scripts/check-private-bucket-iam.sh      all of it, especially §2b
  infra/scripts/check_private_bucket_config.py   the static half, already wired
  .github/workflows/build.yml                    where budget-guard runs, and where it cannot
  infra/wif.tf                                   the refs/heads/main binding, which is the
                                                 reason item 2 is not trivial
  llm/sprints/2026-09-hub/handoffs/boundary-tester-wave-0.md
  llm/sprints/2026-09-hub/handoffs/chief-reviewer-wave-0.md   B-4
  llm/sprints/2026-09-hub/handoffs/skeptic-verifier-wave-0.md F-4
  llm/sprints/2026-09-hub/STATE.md               §Wave 0 dispositions A-2, A-4, A-11, RT-7

FILE CONTRACT
  You may modify, and nothing else:
      infra/**
      .github/workflows/build.yml
      .github/workflows/ci.yml
  Do not modify: gate/**, site/**, contract/**, firebase.json,
  .github/workflows/gate.yml, llm/**, or any other repository.

  YOU MAY NOT RUN terraform plan or apply. fmt -check, init -backend=false and validate only.
  The Lead Architect runs plan and apply, from a saved plan file.

ITEM 1 — THE GUARD WATCHES THE WRONG ROLE (#55)

  §2b of check-private-bucket-iam.sh expands `roles/viewer` and fails if anyone holds it. Its
  comment block reasons entirely about READERS.

  Verified live, and every framing in our own records was wrong about this:
    - roles/viewer is EMPTY. The check passes, correctly, and protects nothing.
    - roles/editor is POPULATED -- the default compute SA 410552878319-compute@.
    - The private bucket carries BOTH automatic legacy bindings naming projectEditor:
        legacyBucketOwner -> objects.create, objects.delete, objects.list, objects.restore
        legacyObjectOwner -> objects.get, objects.update, objects.setIamPolicy
      Union: create, delete, get, LIST, update, setIamPolicy on every object, plus
      buckets.setIamPolicy.

  objects.list is the sharpest part. SEAM-1 withholds exactly that from the GATE, on the
  stated grounds that object names in this bucket are themselves private material. An
  untracked identity has it.

  Extend the check to expand roles/editor as well as roles/viewer, and fail on either being
  non-empty. Say in the output WHICH role and WHAT it reaches, because the two have different
  consequences and a reader should not have to look it up.

  Do NOT attempt to remove the legacy bindings. That needs an authoritative bucket IAM policy
  which would also strip the OWNER's own object access, since roles/owner reaches objects
  through projectOwner by the same mechanism. That is a separate decision with the owner.

  Context for prioritisation, not dismissal: it is latent. Zero user-managed keys on that
  account, zero impersonation bindings, nothing runs as it, Compute API disabled. It becomes
  live the moment any of those changes -- none of which touches this bucket's policy or any
  file in this repository, which is exactly why item 2 matters.

ITEM 2 — THE LIVE CHECK RUNS NOWHERE (#58)

  check_private_bucket_config.py (static, reads Terraform) IS wired: build.yml:378 on main,
  :481 on your branch. §12.1 is half satisfied.

  check-private-bucket-iam.sh (live, reads the actual bucket policy) is referenced ONLY inside
  a comment at build.yml:511-512, calling it "a Checkpoint procedure". No workflow runs it.

  I previously dispositioned this as "folded into budget-guard" and that was wrong, for a
  reason that constrains your fix: budget-guard runs on pull requests, and wif.tf admits only
  refs/heads/main, so A PR BUILD CANNOT AUTHENTICATE to read the bucket policy. The same
  constraint that keeps fetch-data.sh alive as the PR content source (STATE C25).

  So "add it to budget-guard" does not work. Options, and you choose with reasons:
    (a) a main-only job after deploy, where the deploy identity is already authenticated --
        catches drift within one deploy cycle, does not gate the PR that caused it;
    (b) a SCHEDULED run, independent of deploys -- catches drift caused OUTSIDE this
        repository, which is exactly how #55 arises, since granting roles/editor touches no
        file here;
    (c) both.

  Option (b) is the minimum. A bucket exposure introduced by a console action is invisible to
  any check that only runs on a code change. State plainly what each option does and does not
  catch.

  It must fail the job it runs in. A check that reports and exits 0 is the fifth instance of
  this sprint's defining defect.

ITEM 3 — THE UBLA SHAPE DEFECT (A-11)

  check-private-bucket-iam.sh reads public_access_prevention shape-tolerantly but
  uniform_bucket_level_access in snake_case only. It fails CLOSED, so it is not dangerous --
  but it is the same cry-wolf failure Checkpoint 4 already paid for once, when a projection
  asked for a nested field this gcloud returns flat and the tab-separated values shifted by
  one, comparing UBLA against public access prevention's value.

  One `or` fixes it. Tolerate both shapes, as the PAP reader already does.

ITEM 4 — SPECIFY WHAT THE GATE'S ORIGIN FIX NEEDS

  The gate's CSRF check is being rewritten concurrently because it compares attacker-supplied
  headers against each other. Its replacement needs an accepted-origin set from a source the
  REQUEST CANNOT SET -- most likely a GATE_* environment variable rendered by Terraform, like
  every other gate setting.

  The gate stream will specify the exact variable name and value shape in its handoff. Read it
  if it has landed; if it has not, SPECIFY what infra can offer -- the site domain and the
  service's own *.run.app URI are both already known to Terraform -- and say which resource
  attribute each comes from. Do not invent a name unilaterally; a cross-stream variable is a
  contract, and Phase 3 cost a defect exactly here (PRIVATE_BUCKET vs GATE_PRIVATE_BUCKET).

TESTING — and the anchor rule this sprint earned three times
  Every guard change shown FAILING then passing. For the live checks, the Skeptic Verifier's
  technique is the cheap way: stub `gcloud` so the script reads a policy you control, and
  prove the guard reddens on a planted roles/editor member without touching real IAM.

  BEFORE breaking something on a string, assert that string is UNIQUE --
  `assert text.count(anchor) == 1`. Your own stream's first UBLA test silently passed because
  a sed hit a COMMENT at storage.tf:15 while the real assignment at :87 stayed true. Two other
  agents hit the same trap this sprint. After breaking, confirm the SPECIFIC check you
  expected to fail is the one that failed, by name.

CONSTRAINTS
  - NO git, gh or cloud mutations. NO terraform plan or apply.
  - Secrets never touch the repo. WIF only. A key file is a hard stop, not a judgement call.
  - No new resource without a cost line. The $5 budget and its guard are untouched (§12.6).
  - Custom roles keep deletion_policy = "PREVENT": a destroyed custom role locks its ID for
    7-37 days and would block all publishing.
  - actionlint clean; terraform fmt -check -recursive and validate clean.
  - Do not quote private content.

DEFINITION OF DONE
  The guard expands roles/editor and roles/viewer and fails on either. The live check runs
  somewhere real and fails its job. The UBLA reader tolerates both shapes. The Origin variable
  specified with its source attributes. Every change shown failing and then passing, anchors
  proven unique.

FINAL REPORT -> llm/sprints/2026-09-hub/handoffs/infra-wave-0-fixes.md
  ## Summary ## Assumptions ## Recommendations ## Alternatives considered ## Risks
  ## Open questions ## Related docs ## ADR candidates
  plus Validation with verbatim transcripts, and what each scheduling option does NOT catch.
```

## Cross-references

- `llm/sprints/2026-09-hub/handoffs/boundary-tester-wave-0.md` — the editor finding, verified live
- `llm/sprints/2026-09-hub/handoffs/chief-reviewer-wave-0.md` — B-4, the guard vacuous three ways
- `llm/governance/adr/0010-withdrawal-semantics.md` — decision 5, the two-principal invariant
- `llm/governance/patterns/execution-patterns.md` — the ambiguous-anchor anti-pattern
