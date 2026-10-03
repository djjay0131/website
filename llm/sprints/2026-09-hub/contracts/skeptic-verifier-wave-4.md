# Contract — Skeptic Verifier, Wave 4 (Phase 5 satellite)

Status: Issued · Date: 2026-10-03 · Branch: `feat/construction-ai`
Handoff: `llm/sprints/2026-09-hub/handoffs/skeptic-verifier-wave-4.md`. Break each NEW guard, show the named test red, restore, show green; report un-failable guards and coverage gaps. Use unique anchors.

Guards: the roster variable validations (source-name length, numeric ids, bare
branch); the inline satellite guard (custom role, `startsWith` condition, no
project-level member, no `list`); `check_private_bucket_config.py`; the manifest
validator's source/path checks; the satellite workflow's publish gate
(`!= 'pull_request'`); `check:no-private-in-public` over the new source; the
`_doc`/entry share guards from Wave 3 (regression — report only if newly weak).
State clearly if no test would catch a guard's removal.
