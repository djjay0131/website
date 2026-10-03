# Contract — Security Tester, Wave 3 (Phase 4 sharing)

Status: Issued
Date: 2026-10-03
Owner: Lead Architect
Stream: Security Tester (read + write to `llm/sprints/2026-09-hub/handoffs/security-tester-wave-3.md` only)
Issue: `hub-004`
Branch: `feat/sharing`
Authority: run brief §6, subset Wave 3 can turn red

## Purpose

A **single FAIL blocks the Wave 3 merge**. Run every check below and give each a
verdict (PASS / FAIL / NOT TESTED with reason). Prove red, do not assert.

## Scoped checks

1. **No private content on the public path.** The Shares route/island must be
   absent from `dist-public` (build and inspect). Plant the private marker and
   show `check:no-private-in-public` goes red, restore.
2. **Caching.** Every `/s/**` and `/share/**` outcome carries `private, no-store`
   and never `public`/`s-maxage` — served, unknown token, expired, revoked,
   traversal, mint, mint-refused, list, revoke. This closes A7's `/s/**` half.
3. **Gate refusals.** `/s/**` unknown/expired/revoked all 404 with no existence
   oracle. Non-owner member 403 on mint/list/revoke; anonymous 403. Cross-origin
   mint/revoke 403.
4. **Traversal suite.** `--path-as-is`; `..`, encoded/double-encoded, absolute,
   backslash, NUL, second-slug, sibling-prefix. All refused; no bucket read.
5. **Identity / IAM.** The gate SA still holds the narrowed auth role; the new
   Firestore grant is exactly what the contract says and nothing broader; no key
   anywhere; numeric-id + ref pinning unchanged on every WIF binding; no satellite
   `list`; the public deploy identity holds no private-bucket permission.
6. **Firestore.** The deny-all rules stay released; `shares/` and `members/` are
   unreadable from the Web SDK (released rules); the plan does not replace the
   ruleset or its release.
7. **Supply chain.** `npm audit --omit=dev` and `pip-audit` clean of high/critical
   in CI; new React deps pinned; lockfile from the registry only.
8. **Static public site.** `firebase.json` has no functions/SSR and only the
   known rewrites (`/p/**`, `/session`, `/session/end`, `/client-events`,
   `/share/**`, `/s/**`); no unauthorised rewrite.
9. **Budget / logging.** `budget-guard` green; `event=` classes reach Cloud
   Logging; no token or secret in any log line (grep the gate's new log lines).

## Report

Table: check, verdict, evidence (exact command/output), and for a FAIL the
minimal reproduction. State clearly whether the merge is blocked. A check that
cannot run pre-merge is NOT TESTED, not PASS.
