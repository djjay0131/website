# Contract — Red Team, Wave 4 (Phase 5 satellite)

Status: Issued · Date: 2026-10-03 · Branch: `feat/construction-ai`
Handoff: `llm/sprints/2026-09-hub/handoffs/red-team-wave-4.md` only. Report, do not fix.

Targets (≥5 with transcripts):
1. **The new source cannot publish outside its prefix.** Attack the `construction-ai`
   IAM condition and the manifest `source`/`path` (a `path` with `..`, an absolute
   path, a symlink, a second source name) through `contract/validate-manifest.mjs`
   locally.
2. **Private-until-allowlisted.** The two items declare `visibility: private` and
   are absent from `site/publish-allowlist.json`. Prove no public trace (build
   `dist-public`, grep; run `check:no-private-in-public`).
3. **The project index** must not list a non-allowlisted item, and must list from
   the manifest with no hand entry.
4. **Source-key confusion.** A key/prefix `construction-ai` must not admit
   `construction-ai-evil` or a repo swap; check the Terraform condition and the
   WIF condition (repository id + owner id + name + ref).
5. **The satellite workflow** cannot be injected: the generated `index.html`
   escapes README content; no untrusted input becomes markup.
6. **Supply chain:** every `uses:` in the satellite workflow SHA-pinned except the
   hub's own `@v1`.
