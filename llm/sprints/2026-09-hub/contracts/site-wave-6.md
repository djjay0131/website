# Contract — `site`, Wave 6 (annotations)

Status: Issued
Date: 2026-10-07
Owner: Lead Architect
Stream: `site` (`site/**`, `firebase.json`)
Issue: #107
Branch: `feat/annotations`
Seams: `llm/sprints/2026-09-hub/contracts/wave-6-annotations-seams.md`
Design: ADR-0021; ADR-0003 (React islands); issue #107

## Purpose

Ship the capture island, the My notes page, the owner-editable routing file, and
the leak-check needles — all in the private build only except `firebase.json`
and the routing file.

## Scope

- `site/src-private/**` (island, pure logic, page, layout nav)
- `site/firebase.json` (rewrites)
- `site/notes-routing.json` (new)
- `site/scripts/check-no-private-in-public.mjs` (+ its test) — annotation needles
- tests under `site/**`

Do NOT touch `gate/**` or `infra/**`.

## Requirements

1. **Routing file (AN-EXPORT).** `site/notes-routing.json`:
   ```json
   {
     "version": 1,
     "routes": {
       "paper": { "repo": "djjay0131/soa-agentic-se", "dir": "notes" },
       "experiment": { "repo": "djjay0131/agentic-kg-research", "dir": "notes" },
       "brainstorm": { "repo": "djjay0131/agentic-kg-research", "dir": "notes" },
       "question": null
     }
   }
   ```
   A parser/validator with tests: every required intent present; a `null` route
   means "My notes only"; `repo` matches `owner/name`. This file is what the
   gate's export is configured from (the gate receives it as JSON; do not import
   node:fs into a browser bundle).

2. **Pure logic module** `site/src-private/lib/annotations.mjs`, unit-tested
   without a DOM (mirroring `shares.mjs`): endpoints (`/annotations`), request
   inits (`credentials: "same-origin"`), selector construction from a
   `Selection`-like object (`{anchorNode, focusNode, toString}` is NOT required;
   take `{exact, prefix, suffix, start, end}` and provide a helper that computes
   them from a `Range` + text), quote fallback resolution (exact → prefix/suffix
   → position), intent list/validation, field bounds matching the gate exactly,
   and list request switches. No `node:fs` import; safe for the browser bundle.

3. **Capture island** `site/src-private/components/AnnotationsIsland.tsx`
   (React, `client:load`), mounted on `[...itemPath].astro` for
   `format === "html"` / `"bundle"` items only:
   - reads the payload `<iframe>` (same origin), waits for load, attaches to
     `contentDocument`;
   - on a non-empty selection shows a floating toolbar: **Highlight** and
     **Comment**; Comment reveals a comment box, an **intent chip**
     (`paper | experiment | brainstorm | question`, default `question`) and Save;
   - Highlight stores `comment: ""`; Save stores the comment + intent;
   - a keyboard shortcut (Ctrl/Cmd+Shift+L) highlights the current selection;
     the toolbar is keyboard reachable; touch target ≥44px; works on phone;
   - renders existing highlights for the item and marks **orphan** notes without
     deleting them;
   - lists the item's notes in a panel and offers delete for the caller's own;
   - posts to `POST /annotations`/`GET /annotations`/`DELETE /annotations/{id}`;
     the item identity is passed from Astro props (`section`, `source`, `slug`),
     never typed by hand.
   - All 403s degrade to read-only UI (the gate is the authority).

4. **My notes page** `site/src-private/pages/notes.astro` at `/p/notes/`:
   a React island listing `GET /annotations`, **grouped by item, filterable by
   intent and date**, with an orphan badge, linking to each item's frame. Link
   `My notes` from `PrivateBase` nav beside Shares. Private build only.

5. **Hosting rewrites (AN-REWRITES).** `firebase.json` gains `/annotations` and
   `/annotations/**` rewrites to `hub-gate`, in the same shape as `/share`.
   The bare path is required.

6. **Leak check (AN-LEAK).** Add annotation needles to
   `check-no-private-in-public.mjs` (`/annotations`, `/p/notes`, `hub:annotation:`,
   `data-annotation-`) so any of them appearing under `dist-public` fails; add a
   test that plants one and shows red, and that a clean build is green. Update
   the header comment to name the new needles and why.

7. **Export renderer (AN-EXPORT).** `site/scripts/export-notes.mjs` (Node,
   run locally or in a future workflow): takes an owner-fetched notes bundle
   (`GET /annotations?scope=all`, or a `--notes <file.json>` for testing), reads
   `site/notes-routing.json`, and renders one Markdown file per note carrying
   the item qualified id, a deep link
   (`https://jason.cusati.us/p/<section>/<source>/<slug>/` for a private item),
   the quoted passage, the comment and the intent — grouped by item, assigned to
   each route's `repo`/`dir`. `question` notes are skipped and reported. In v1
   it writes to a `--out <dir>` (dry run) and **never touches a remote**: with no
   credential it prints the ADR-0022 stop and exits 0 after writing local files.
   Add unit tests over the renderer with a fixed notes fixture and the committed
   routing file; assert the deep link, the qualified id, the quote, the intent
   grouping, and the `question` skip. Do **not** add any GitHub credential, App,
   token or workflow secret.

8. **Structural tests.** `scripts/private-structure.test.ts` must still pass:
   nothing under `src-private/**` is reachable from `src/**`. Add a test that
   the capture island and My notes page exist only in the private build (build
   `dist-public` and assert neither `/notes/` nor the island chunk is emitted).

## Evidence

- `cd site && npm test` green (new tests named) with the run count recorded.
- `npm run build:public` green; `dist-public` has no `/notes/`, no
  `/annotations`, no annotation chunk.
- `npm run build:private` green; `/p/notes/` and the capture island emitted.
- `npm run check:no-private-in-public` green, and red with the planted needle.
- `npm run check:private-links` green; `check:publish-allowlist` green.

## Exit

Report as `handoffs/site-wave-6.md` with the run counts and the exact commands.

## Out of scope

The gate endpoints; any export credential; PDF annotation; public annotations;
sharing notes between members.
