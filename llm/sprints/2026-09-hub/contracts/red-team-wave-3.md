# Contract — Red Team, Wave 3 (Phase 4 sharing)

Status: Issued
Date: 2026-10-03
Owner: Lead Architect
Stream: Red Team (read + write to `llm/sprints/2026-09-hub/handoffs/red-team-wave-3.md` only)
Issue: `hub-004`
Branch: `feat/sharing`
Seams: `phase-4-seams.md` SEAM-S8

## Purpose

Attack the share surface. Report; do not fix. ≥5 attacks with transcripts.

## Targets (SEAM-S8), at minimum

1. **Token entropy / predictability** — the token is `secrets.token_urlsafe(32)`;
   show why a guess is infeasible or find a path that reduces entropy.
2. **Slug / item escape** — `..`, `%2e%2e`, double-encoding, a second slug, an
   absolute path, a symlink-ish segment. Prove the served name stays inside
   `<section>/<source>/<slug>/`. Use `--path-as-is`; plain `curl` normalises `..`.
3. **Prefix confusion** — a token for `<section>/<source>/<slug>` must not reach
   `<section>/<source>/<slug>-evil/` or a sibling source that shares a prefix.
4. **Non-owner mint/revoke/list** — a signed-in non-owner member must be 403 on
   all three; an anonymous caller must be 403/404, never a token.
5. **Expired / revoked serving** — both must 404, indistinguishable from unknown.
6. **Caching** — no `/s/**` or `/share/**` response carries `public` or
   `s-maxage`; every one carries `private, no-store`.
7. **Web SDK read of `shares/`** — the released deny-all rules must refuse it.
8. **Cross-origin mint/revoke** — the allowed-origin check must refuse, on both
   transports where reachable.
9. **Section smuggling** — a `section` that is multi-segment or illegal must be
   400/refused, not stored, not served.

Local unit-level attacks against `gate/` are in scope and cheap. Live attacks
against `jason.cusati.us` are allowed only through GETs and the rules of
engagement: no writes, no mints as anyone, no grants; disclose every side effect
(they will be `event=` log lines at most). If a route is not yet live, say so and
prove the unit-level equivalent.

## Report

`handoffs/red-team-wave-3.md`: one row per attack — target, exact command/setup,
observed result, verdict (REFUSED / BYPASS), and the code path cited. A BYPASS
must include a minimal reproduction. State what you examined and dismissed,
which is as useful as what you kept.
