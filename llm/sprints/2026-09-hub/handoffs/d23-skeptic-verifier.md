# D23 — Skeptic Verifier

Date: 2026-10-16 · Scope: the new guard in PR #124 (`SOURCE_IDENTITY_NEEDLES` / `findSourceIdentityLeaks`).

Question: is the new needle class a guard that reports success while proving
nothing?

## Break → red → restore → green

| Step | Result |
|---|---|
| Plant `saner2027-governed-agents` in a tree; call `findSourceIdentityLeaks` with the committed list | **2 leaks** (path and contents) |
| Same tree, list emptied (`[]`) | **0 leaks** — the list, not code elsewhere, is what fires |
| Restore | red again |

The needle list is load-bearing. The class is not hard-wired to the real
strings: with a synthetic value (`zz-synthetic-needle-99`) the same function
fires, and with `nothing-matches-this` it does not.

## Coverage

- Paths and contents, case-insensitive and after HTML-entity decoding.
- The gzip Pagefind `.pf_*` payloads are decompressed and scanned (same as the
  annotation and item needles).
- Wired into the CLI on every run (both the Pages and Firebase build jobs) and
  into the `demo:leak-check` self-test, so it is exercised on every CI run, not
  only when a private item exists.
- The full site suite is green: 553 passed, 2 skipped; the leak-check file alone
  is 47 passed.

## Verdict

**No un-failable guard.** One stated limit, carried from ADR-0005 and unchanged:
an opaque binary is matched by path only, and titles are covered by the
manifest-derived needles rather than a committed literal (D23-B). Both are
recorded, not hidden.
