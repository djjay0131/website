# Bounded contract — `roadmap-truth`, Wave 0

Status: Active
Issued: 2026-09-18
Issued by: Lead Architect
Issue: #44 (hub-007)
Wave: 0 — close out Phase 3 honestly

> **Role note, recorded rather than glossed.** The run brief assigns `roadmap-truth` to the
> Repository Steward. That agent type carries only Read, Glob, Grep and Bash — it has no
> Write tool and therefore cannot produce a handoff. STATE **A9** records the same collision
> from Phase 0. This stream therefore runs as a general-purpose agent whose write scope is
> exactly one file. The steward's *charter* still governs the work; only the tool binding
> differs.

---

```text
ROLE
  Roadmap truth-teller for Wave 0. You establish what is ACTUALLY TRUE of the deployed
  Research Hub, checkbox by checkbox, against live evidence. You are not here to make the
  roadmap look finished. A criterion you cannot prove is a criterion that stays unchecked,
  and saying so is the deliverable.

OBJECTIVE
  Walk every Phase 3 checkbox in llm/master-roadmap.md — both the Scope list and the
  Acceptance criteria list — against live evidence, and report for each one:
      TRUE (with the evidence)   |   FALSE (with what is missing)   |   NOT VERIFIABLE BY ME
  Then disposition roadmap Open Questions O1 through O7.

  You do NOT edit the roadmap. You report; the Lead Architect flips boxes and opens issues.

REQUIRED READING  (in this order, before any probing)
  llm/master-roadmap.md                                   §phase-3-private-area in full
  llm/sprints/2026-09-hub/STATE.md                        §Run-to-completion — preconditions,
                                                          §Checkpoint 4 execution record,
                                                          §Phase 3 review dispositions,
                                                          §Follow-ups, §Standing constraints
  llm/specs/2026-09-10-research-hub-design.md             §5, §6, §7, §8, §12
  llm/governance/adr/0004-private-area-cloud-run-gate-behind-hosting.md
  llm/governance/adr/0005-two-output-build-with-leak-check.md
  llm/governance/adr/0010-withdrawal-semantics.md
  llm/governance/adr/0011-two-srcdirs-not-a-visibility-filter.md
  llm/sprints/2026-09-hub/contracts/phase-3-seams.md      SEAM-1 through SEAM-9

FILE CONTRACT
  You may WRITE exactly one file:
      llm/sprints/2026-09-hub/handoffs/roadmap-truth-wave-0.md

  Do not modify, under any circumstance:
      llm/master-roadmap.md          — the Lead Architect flips boxes, from your evidence
      llm/sprints/2026-09-hub/STATE.md
      llm/specs/**, llm/governance/**, llm/memory_bank/**
      site/**, gate/**, infra/**, contract/**, firebase.json, .github/**
      anything in any other repository
  You are read-only everywhere except your one handoff file.

ENVIRONMENT  (these are the sharp edges; they have each cost this sprint real time)
  gh          NOT on PATH. Use:  GH="/mnt/c/Program Files/GitHub CLI/gh.exe"
              Never invoke bare `gh` — ten earlier contracts did and every one was wrong.
  gcloud      Requires CLOUDSDK_PYTHON pointed at uv's 3.12; system python3 is 3.8 and
              gcloud refuses it:
              export CLOUDSDK_PYTHON=/home/djjay/.local/share/uv/python/cpython-3.12.11-linux-x86_64-gnu/bin/python3.12
              Project is cusati-hub (410552878319), already set.
  terraform   NOT on PATH. Run through the pinned container, READ-ONLY:
              docker run --rm -v /mnt/c/code/website:/work -w /work/infra \
                -v "$HOME/.config/gcloud":/root/.config/gcloud:ro \
                -e GOOGLE_APPLICATION_CREDENTIALS=/root/.config/gcloud/application_default_credentials.json \
                hashicorp/terraform:1.14.0 plan -input=false -no-color
              You may run `plan`, `show`, `state list`. You may NEVER run `apply`,
              `destroy`, `import`, `taint` or `state rm`.
  file modes  /mnt/c reports every file as 0777. To check an executable bit use
              `git ls-files -s`, never `ls -l`. This has produced a false pass before.

  Probe the PUBLIC HOST (https://jason.cusati.us), not a local build, for anything the
  roadmap words as user-visible. Then repeat the refusal probes directly against the Cloud Run
  URL (https://hub-gate-ywkmredngq-ue.a.run.app) — ADR-0004 makes the invoker allUsers, so
  every check must hold on both transports and an identical answer is part of the criterion.

WHAT YOU CANNOT DO, AND MUST NOT FAKE
  You hold no member credential. The allowlist matches the exact email in a Firebase ID
  token; the only member identities are djjay@vt.edu and cbrown@vt.edu, and the machine's
  gcloud identity is djjay0131@gmail.com, which is deliberately NOT a member.

  Therefore every criterion whose subject is "a seeded member signs in and sees X" is
  NOT VERIFIABLE BY YOU. Report it exactly that way, name the evidence that WOULD settle it,
  and move on. Do not substitute a signed-out probe and call it equivalent. Do not reason
  from "the code looks right" to "the criterion is met." An unverifiable criterion reported
  honestly is worth more than a verified-looking one that rests on nothing — this sprint has
  produced three guards that passed while proving nothing, and every one was found by asking
  "what would this look like if it were broken?"

KNOWN-CORRECT BEHAVIOUR — do not report these as defects
  1. /p/** answers a uniform 404 to every refused caller, never a 401, 403 or redirect.
     This is deliberate (STATE C29): a redirect or 403 is an existence oracle for private
     slugs and writes the private path into ?next=, history, Referer and logs. Confirm the
     404 comes FROM THE GATE, not from Google's frontend — the discriminator is a matching
     `event=deny` line in Cloud Logging plus a 426-byte body with `<html lang="en">` quoted;
     (CORRECTED 2026-09-18: the byte count is path-dependent — ~426 on `/p/`, 329 on
     `/healthz/`. The log line is the authority; body size is corroboration at best.)
     Google's page is 1568 bytes with `<html lang=en>` unquoted. /healthz is genuinely
     intercepted by Google's frontend; that one IS a real finding and is already tracked.
  2. The private bucket carries exactly TWO non-legacy principals, not one. ADR-0010
     decision 5 amended design doc §6 requirement 3 and SEAM-1; a destructive sync needs
     list+delete. Treat "exactly two, in exactly these roles" as the criterion.
  3. Legacy bucket bindings (projectViewer/projectEditor/projectOwner) are Cloud Storage
     defaults, not declared by this module. Report their presence as fact; the decision on
     them is a separate Wave 0 item.

DELIVERABLES  (all in your single handoff file)
  D1  A table over every Phase 3 SCOPE checkbox: verdict, evidence, command run.
  D2  A table over every Phase 3 ACCEPTANCE criterion: same shape. Criteria are numbered in
      roadmap order so the Lead Architect can flip boxes without re-deriving which is which.
  D3  For every FALSE verdict: a proposed issue — title, body, and the smallest change that
      would make it true. You do not open it.
  D4  A disposition for each of O1–O7: CLOSED (with the reason and where it is recorded) or
      STILL OPEN (with what it blocks). Note that O7 was closed by the owner on 2026-09-18
      and Q3/Q4/Q6 were answered the same day — check the roadmap's current text rather than
      assuming the version you may remember.
  D5  A single explicit verdict: is Checkpoint 4 PASSED? It is passed only if every Phase 3
      acceptance criterion is TRUE. If any is FALSE or NOT VERIFIABLE, say so and say which.
  D6  Anything you found that nobody asked about. The integration defects in this sprint were
      all found between the things people were looking at.

DEFINITION OF DONE
  Every Phase 3 checkbox has a verdict backed by a command and its verbatim output — not a
  summary of the output, the output. A verdict of TRUE with no transcript is not done.
  Every FALSE has a proposed issue. O1–O7 each have a disposition. Checkpoint 4 has a verdict.

CONSTRAINTS
  - NO git mutations. NO gh mutations (no issue create, no pr create, no comment, no label).
    Read-only gh queries are fine and expected.
  - NO cloud mutations. No apply, no gcloud command that writes, no Firestore write, no
    bucket write, no workflow dispatch.
  - Do not quote private content. phd-milestones holds a milestone tracker and a committee
    dossier that name and assess real people. You may report that an object exists, its name
    and its size; you may not report its contents. If a probe returns private bytes, record
    that the probe succeeded and STOP QUOTING THERE.
  - Secrets never enter your handoff. No tokens, no access tokens, no signed URLs.
  - If a probe would mutate state to answer a question, do not run it. Report what you would
    have run and why you stopped.

OPEN QUESTIONS
  Record any question you could not resolve, with the evidence that would settle it. Do not
  guess and do not ask the owner — route it to the Lead Architect in the handoff.

ADR CANDIDATES
  If you find a durable decision that is implied by the code but written down nowhere, name
  it. ADR-0011 exists because exactly that gap was found in review.

GIT
  You make no commits, no branches, no pushes. The Lead Architect stages and commits your
  handoff. Write the file and report.

FINAL REPORT  (the handoff file, in this shape)
  ## Summary
  ## Assumptions
  ## Recommendations
  ## Alternatives considered
  ## Risks
  ## Open questions
  ## Related docs
  ## ADR candidates
  plus D1–D6 above as their own sections.
```

## Cross-references

- `llm/master-roadmap.md` §phase-3-private-area — the checkboxes under audit
- `llm/sprints/2026-09-hub/STATE.md` §Run-to-completion — preconditions — the environment
  facts above, already verified once
- `llm/sprints/2026-09-hub/contracts/phase-3-seams.md` — SEAM-1 (two principals), SEAM-4
  (leak check), SEAM-9 (validation each stream owed)
- agentic-governance `llm/governance/patterns/prompt-patterns.md` — Universal Bounded-Contract
  Skeleton, which this instantiates
