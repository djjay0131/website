# Contract — adversarial, tester and review round, Wave 6 notes-sync (D18)

Status: Issued
Date: 2026-10-07
Owner: Lead Architect
Issue: #107
Branch: `feat/annotations-sync`
Seams: `contracts/wave-6-notes-sync-seams.md` (AN-SYNC-7)

One contract for the round. Each agent reports separately under
`handoffs/<agent>-wave-6-notes-sync.md`. No fixing; report with transcripts.

## Red Team (≥8 attacks)

1. **Cross-repo reach.** Can a member cause a write to a repository the routing
   does not name for their note's intent (by content, by item identity, by
   `?scope`)? Routing is server-side; prove it cannot be steered.
2. **Token/key exfiltration.** Force errors (bad App id, bad key, HTTP 401/403,
   malformed response) and inspect every log line and response body for a token,
   the private key, or any credential.
3. **Commit-message / path injection.** `section`/`source`/`slug` and note
   content crafted to inject into the commit message or the file path
   (`../`, `..%2f`, newline, `notes/`, absolute, overlong).
4. **Payload abuse.** 1 MB quote, binary/NUL in content, a huge number of notes,
   rapid create/delete to force commits or retries.
5. **Retry storm / duplicate / wrong branch.** Make the writer fail repeatedly:
   bounded backoff, dead-letter at ≥24h, no unbounded queue, no duplicate commit
   when content is unchanged, and **never a commit to `main`**.
6. **Dormant mode.** With sync unconfigured, prove nothing changes for the
   existing routes and no network call is made.

## Dissenter (≥3 objections)

Design only: the queue-in-Firestore + warm-worker model vs a scheduler; the
`notes/` branch vs a PR; soft-delete/tombstone semantics; one-file-per-item with
mixed intents; the routing-config duplication risk; the gate holding a repo write
credential.

## Skeptic Verifier

Break each new guard (debounce, backoff, dead-letter, no-op-on-unchanged,
branch-from-default, path/message sanitisation, disabled mode) and show the test
fail by name; assert the anchor occurs exactly once. Report un-failable guards.

## Security Tester (VETO)

Own the gate. PASS/FAIL/NOT TESTED: token/key never logged or returned; routing
not steered by a client; path and commit-message injection refused; content caps;
no commit to `main`; the Secret Manager accessor is the only new IAM; no key
file; dormant mode makes no network call.

## Regression Tester

All existing suites green and unchanged in count (gate, site, contract);
`governance-checks` 4/4; the wave-1 annotation routes unchanged in behaviour.

## Chief Reviewer

Verdict Approve/Comment/Request changes. Verify the implementation against the
seams and ADR-0022 (amended); that the two owner hard stops are the only
credential steps and are clearly printed; and that records (STATE D18, ADR-0022,
memory bank) land in the same PR.
