# Contract — Red Team, Wave 6 (annotations)

Status: Issued
Date: 2026-10-07
Owner: Lead Architect
Issue: #107
Branch: `feat/annotations`
Seams: `contracts/wave-6-annotations-seams.md` (AN-ADVERSARIAL)
Targets: the `gate` and `site` streams as merged on `feat/annotations`

## Mandate

Attack the annotations feature. **No fixing** — reproduce, record a transcript
(request/response or code path), and report. Quota: **≥8 attacks**, at least one
per AN-ADVERSARIAL target. Every claim needs a reproducible transcript; a
"likely" is not a finding. If a target cannot be reached, say so as
NOT APPLICABLE with the reason.

## Required targets

1. **Cross-member read.** `GET /annotations` as member A returning member B's
   rows; `?scope=all` as a non-owner; guessing/enumerating ids; a member reading
   the owner's rows.
2. **Stored XSS.** A `comment` or `quote` containing `<script>`, an `onerror=`
   attribute, a `javascript:` URL, a `</textarea>` break-out, an SVG payload, an
   HTML entity — then observe how My notes and the capture panel render it, and
   how `export-notes.mjs` renders it into Markdown.
3. **Delete escalation.** A non-owner deleting another member's note; a
   signed-out delete; deleting a non-existent id (must not confirm existence).
4. **Forged author.** A POST body carrying `member`/`created_by` for another
   user; confirm the server ignores it.
5. **Auth bypass.** `/annotations` signed-out and as a non-member, on both
   transports (Hosting and `*.run.app`), and without an Origin on the
   state-changing routes.
6. **Log injection / grammar forgery.** A quote/comment containing `event=`,
   newlines, control characters, an enormous value; confirm no private material
   and no forged `event=` reach a log line, and that caps are enforced.
7. **Path/segment escape.** `section`/`source`/`slug` with `../`, `%2e%2e`,
   absolute, backslash, empty segments, over-long slugs.
8. **Cache.** Any annotation response carrying `public`/`s-maxage`, or missing
   `private, no-store`.
9. **Public leak.** The capture island, `/p/notes/`, `/annotations` or an
   annotation chunk appearing in `dist-public`; the leak-check needles bypassed
   (case, entity, partial).

## Rules of engagement

Live probes only against the owner's test data or local/fixture builds; do not
mint as the owner; do not create a credential; do not modify tracked files.
Disclose any production side effect. Report as `handoffs/red-team-wave-6.md`.
