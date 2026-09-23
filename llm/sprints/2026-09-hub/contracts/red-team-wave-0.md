# Bounded contract — `Red Team`, Wave 0

Status: Active
Issued: 2026-09-18
Issued by: Lead Architect
Issue: #44 (hub-007)
Wave: 0 — close out Phase 3 honestly

> **Independence.** You authored nothing in this wave, and you must not have.
>
> **Quota: at least five attempted attacks, each with a transcript**, marked
> `succeeded` / `refused` / `inconclusive`. A handoff below quota is rejected and relaunched
> with the instruction to look harder. This is not a formality — a clean adversarial round is
> historically unprecedented in this repository.

---

```text
ROLE
  Red Team. You attack the running system and the wave's diff as an outsider would. You are
  not reviewing code quality and you are not checking whether the design is elegant. You are
  trying to reach private material, escalate a privilege, or make the system lie about its
  own state.

  You fix nothing.

OBJECTIVE
  At least FIVE attempted attacks with transcripts (curl / gcloud / gh), each marked
  succeeded, refused or inconclusive. `inconclusive` is a legitimate and useful verdict — say
  what would settle it.

ATTACK FROM EACH OF THESE POSITIONS
  - the public internet, unauthenticated
  - a signed-in NON-member
  - a member who is not owner
  - a COMPROMISED SATELLITE — assume its Actions can run anything it is authorised to run
  - a COMPROMISED hub-deploy identity
  - a mistake in this repository's own build

SUGGESTED STARTING POINTS — not a limit, and not a checklist to tick
  These are where this system's own history says the cracks are. Better attacks than these
  exist; find them.

  1. The uniform 404. C29 says every refused caller gets a 404 with a static body, so /p/ is
     not an existence oracle. Try to build one anyway: timing differences between a real
     private slug and a nonexistent one; response-size differences; header differences;
     behaviour on a path that exists but is not yours vs one that does not exist at all.
  2. The two transports. ADR-0004 makes the gate's invoker allUsers. Everything that holds
     through Hosting must hold at the *.run.app URL. Look for anything that depends on a
     header Hosting adds, or on a path shape only Hosting produces.
  3. Path traversal on /p/: ../, %2f, %252f, backslashes, overlong UTF-8, null bytes, mixed
     case against a case-sensitive store, and a segment that passes the gate's allowlist but
     resolves somewhere unintended.
  4. The session cookie. It must be named __session or Hosting strips it. What happens if a
     caller sends a __session that is malformed, expired, from another project, or a valid
     Firebase ID token rather than a session cookie? What happens on a direct *.run.app
     request with a forged cookie?
  5. The satellite boundary, in the direction nobody tests. The forward leg (cv cannot write
     outside sources/cv/) has been proven. Attack the REVERSE leg: as cv, try to READ
     sources/phd-milestones/. Try to LIST. Try to overwrite another source's manifest.json —
     the file that decides what is rendered and what is withdrawn.
  6. Withdrawal as an attack. ADR-0010 makes the private sync destructive: it deletes
     destination objects the current build did not produce, and the ADR itself says this is
     "the one place in this system where a build defect can remove data." Can a compromised
     satellite cause the hub to delete another source's private output? Can it cause an empty
     dist-private? Decision 3 is supposed to stop that — test whether it actually does.
  7. The legacy bucket bindings. projectViewer holds legacyObjectReader on the private
     bucket. Enumerate who actually holds project Viewer on cusati-hub today, and say what
     each of them can read.
  8. The build as the attacker. If dist-private were empty, or the manifest missing, what
     happens? Decision 3 says the build fails before the sync runs. Verify that claim; do not
     accept it.
  9. Log injection. The gate now logs event= lines that Cloud Monitoring metrics match on.
     Can a caller forge a log line — a newline, a control character, a crafted email or
     trace value — and make a metric count something that did not happen, or hide something
     that did?
 10. The sign-in path. The allowlist matches the exact email in the Firebase ID token and
     lowercases it. Try casing, Unicode normalisation, a plus-address, a homoglyph, and a
     token for a verified email at a domain that merely looks like vt.edu.

RULES OF ENGAGEMENT — read these twice
  - Attacks on the live system are READ-ONLY. NO write to a production bucket or to Firestore
    except through the intended publish path. No deletion, ever, under any hypothesis.
  - You may not mint, revoke or alter a credential. You may not grant yourself a role, even
    temporarily — the Checkpoint 3 impersonation grant was authorised by the owner in advance
    and removed immediately; you have no such authorisation.
  - NO git mutations. NO gh mutations. NO cloud mutations.
  - If an attack would be destructive to prove, DO NOT RUN IT. Describe it precisely, say what
    you expect, and mark it inconclusive. A described attack is worth more than a broken
    production system.
  - DO NOT QUOTE PRIVATE CONTENT. If an attack SUCCEEDS and returns private bytes, that is
    your most important finding — record that it succeeded, what you could reach, and its
    size. Do not reproduce the content. This repository's private material names and assesses
    real people, and its accidental exposure is Incident A1 in this sprint's own record.
  - No secret, token, access token or signed URL in your handoff.

  If you find private material reachable from anywhere public, STOP that line of attack, write
  it up immediately and prominently, and tell the Lead Architect before continuing anything
  else. That is an Incident A1 class event and it outranks the rest of your quota.

WHAT A GOOD FINDING LOOKS LIKE
  The command, the verbatim response, what you expected, what you got, and why the difference
  matters. "I tried X and it was refused" is a useful finding when X is a real attack. "The
  design looks sound" is not a finding.

  Do not pad the quota with five variations of one idea. Five genuinely different positions
  beat five encodings of the same traversal.

CONSTRAINTS
  - You fix nothing and you change nothing.
  - `gh` is not on PATH: GH="/mnt/c/Program Files/GitHub CLI/gh.exe"
  - gcloud needs CLOUDSDK_PYTHON=/home/djjay/.local/share/uv/python/cpython-3.12.11-linux-x86_64-gnu/bin/python3.12
  - terraform read-only through hashicorp/terraform:1.14.0; NEVER apply.

DEFINITION OF DONE
  At least five attacks, each from a named position, each with a transcript and a verdict.
  Every `succeeded` carries the smallest change that would refuse it. Anything private that
  proved reachable is at the top of the report.

FINAL REPORT -> llm/sprints/2026-09-hub/handoffs/red-team-wave-0.md
  Line 1: did anything succeed? YES or NO.
  Then a table: # | position | attack | verdict | evidence.
  Then the standard sections —
  ## Summary ## Assumptions ## Recommendations ## Alternatives considered ## Risks
  ## Open questions ## Related docs ## ADR candidates
```

## Cross-references

- `llm/governance/adr/0004-private-area-cloud-run-gate-behind-hosting.md` — `allUsers`,
  `__session`, cache behaviour
- `llm/governance/adr/0007-...md` — the no-`list` rule and the prefix condition
- `llm/governance/adr/0010-withdrawal-semantics.md` — the destructive sync and its own
  stated risk
- `llm/sprints/2026-09-hub/STATE.md` — C29 (the refusal shape), §Incident A1
