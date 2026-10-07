# Wave 6 seams — Annotations (#107)

Status: Active
Issued: 2026-10-07
Owner: Lead Architect
Issue: #107
Branch: `feat/annotations`
Owner decision: **D17 (2026-10-07)** — build #107 now, run to completion under
the same rules as Waves 3–5; scope v1 tightly; export credential is a hard stop.

Design authority: issue #107; ADR-0016 (private by default); ADR-0017/0018
(shares — the endpoint and Firestore pattern to copy). These seams fix the
interfaces before any stream starts. A specialist who believes a seam is wrong
reports it and stops.

---

## AN-CAP — Capture

1. **Where.** A private-build React island (ADR-0003), mounted on the private
   **item frame page** `site/src-private/pages/[...itemPath].astro`. It exists
   only in `src-private/**`, so the public build's `srcDir` never resolves it
   and it cannot reach `dist-public` (ADR-0011 structural guarantee).

2. **Audience.** The private area is already owner+member only (the gate). The
   island does not decide membership; it is served only to a signed-in member.

3. **Selection source.** The item payload is rendered in the frame's
   `<iframe>` at `/p/_payload/<source>/<path>` — **same origin** as the frame
   (`https://<host>/p/...`). The island reads the selection from the iframe's
   `contentDocument`/`contentWindow` (same-origin DOM access). To make the
   iframe renderable, the gate serves **private payload documents**
   (`_payload/**`) with `X-Frame-Options: SAMEORIGIN` instead of `DENY`; every
   other `/p/**` response keeps `DENY`. This is a deliberate, security-reviewed
   header change (AN-GUARD-8) and the Security Tester's to pass or veto.
   - **v1 scope: `format: html` and `format: bundle` items only.** A `pdf`
     item has no DOM to select text in; it is out of v1 (recorded, not hidden).

4. **Interaction.** Select text → a floating toolbar offers **Highlight** and
   **Comment**; a comment reveals a comment box and the **intent chip**:
   `paper | experiment | brainstorm | question` (default `question`). Highlight
   stores a note with an empty comment. Keyboard-first: a shortcut
   (`Ctrl/Cmd+Shift+L`) highlights the current selection; the toolbar is
   reachable by keyboard; touch targets ≥44px and the toolbar works on phone.

5. **Selectors (W3C Web Annotation).** Every note stores a
   `TextQuoteSelector` (`exact`, `prefix`, `suffix`) as the durable anchor, plus
   a `TextPositionSelector` (`start`, `end`) as a fallback. Prefix/suffix are
   up to 32 characters of surrounding text. Anchoring resolves by `exact`, then
   disambiguates with `prefix`/`suffix`, then falls back to `start`/`end`.

6. **Re-anchor, never drop.** On load, a stored note whose `exact` no longer
   resolves in the current document is shown as **orphan** (still listed, still
   exportable) and is never deleted. v1 computes anchor state at read time; it
   does not write an `orphan` flag back (recorded).

## AN-STORE — Store

Firestore `annotations/{id}` (server-only; released rules stay deny-all):

```
{
  id:         string,     // server-minted: secrets.token_urlsafe(16)
  member:     string,     // normalised (lowercased) email of the note's author
  section:    string,     // item identity, validated as in shares
  source:     string,
  slug:       string,
  selector:   { type: "TextQuoteSelector", exact: string, prefix: string, suffix: string },
  position:   { type: "TextPositionSelector", start: int, end: int } | null,
  quote:      string,     // == selector.exact; stored for export/read convenience
  comment:    string,     // may be ""
  intent:     "paper" | "experiment" | "brainstorm" | "question",
  tags:       string[],
  created:    Timestamp,
  updated:    Timestamp
}
```

- **No item title is stored** (the private build already knows titles; storing
  it duplicates private material for no gain).
- Bounds enforced in the gate: `exact` 1–2000 chars, `prefix`/`suffix` 0–64,
  `comment` 0–5000, `tags` ≤ 10 each ≤ 40 chars, `intent` in the enum.
- Item identity is validated with the shares' segment allowlist: `section` and
  `source` single safe segments, `slug` one or more safe segments. As with
  shares, the gate cannot enumerate items, so a syntactically valid but
  non-existent item is accepted and simply never displays.

## AN-ROUTES — Gate endpoints

| Route | Auth | Behaviour |
|---|---|---|
| `POST /annotations` | member (owner or member), **origin-checked** | body `{section, source, slug, selector, position, quote, comment, intent, tags}` → `{id, created}`. 400 on bad input, 403 signed-out/non-member. Stores `member = principal.email`. |
| `GET /annotations` | member | default: the caller's **own** notes. `?scope=all` is **owner-only** and returns every note. Never returns another member's note to a non-owner. |
| `DELETE /annotations/{id}` | member or owner, **origin-checked** | a member deletes only their own; the owner deletes any. 404 unknown id; 403 a member deleting another's. |
| `GET /annotations?scope=all` | **owner only** | the data source for export: every note. `scope=all` is owner-only (a non-owner is refused, not downgraded). |

Export rendering and routing are the **site** stream's: `GET /annotations?scope=all`
provides the data; `site/scripts/export-notes.mjs` applies
`site/notes-routing.json` and renders Markdown. This keeps routing in exactly
one place (no gate env-var copy). The cross-repository PR is the AN-EXPORT hard
stop.

- State-changing routes use the existing `_refuse_cross_origin` guard.
- Logging: **never** the quote, comment, title, selector or path. Log
  `event=… scope=annotation action=… id=<short> by=<email>` only.
- Response shape for a list row never includes another member's email except
  to the owner.

## AN-GUARD — Guards (same shape as shares)

1. Signed-out and non-member refused on both transports (through Hosting and on
   `*.run.app`), identical status.
2. `Cache-Control: private, no-store` on every annotation response (the shared
   middleware already applies this).
3. Owner/member re-checked per request (not trusted from the session).
4. No quote or title in any log line (log-scrape test).
5. Members delete only their own; owner may delete any.
6. Cross-member read refused: a non-owner `GET /annotations` never returns
   another member's rows.

## AN-IAM — Firestore role

ADR-0018 already grants `hub-gate` project-wide `roles/datastore.user`, which
covers `annotations/` exactly as it covers `shares/`. **No new IAM binding is
required and none is added**; Firestore has no collection-scoped IAM spelling.
The `infra` stream records this in `infra/gate.tf` as a comment and shows a
plan of **0 to add, 0 to change, 0 to destroy**. (This satisfies D17's "same
shape as shares/" without a duplicate binding, which Terraform would reject as
an existing member/role pair.)

## AN-USE — My notes

- `/p/notes/` (private build only), linked from `PrivateBase`. A React island
  lists the caller's notes **grouped by item, filterable by intent and date**,
  with an orphan badge for notes that no longer anchor.
- The page fetches `GET /annotations`; the gate is the authority.

## AN-EXPORT — Export and routing (HARD STOP on the credential)

- **Routing** lives in `site/notes-routing.json` so the owner can change it:
  `paper → djjay0131/soa-agentic-se` under `notes/`;
  `experiment` and `brainstorm → djjay0131/agentic-kg-research` under `notes/`;
  `question → null` (stays in My notes only).
- **Markdown** per note: the item qualified id, a deep link
  (`https://<canonical origin>/p/<section>/<source>/<slug>/` for private items),
  and the quoted passage, plus the comment and the intent. Grouped by item.
- **Delivery is a PR, never a push**, into those two repos only.
- **Rendering/routing is the site stream's** (`site/scripts/export-notes.mjs`),
  fed by `GET /annotations?scope=all`; `question` notes are not rendered.
- **The credential is a §9 hard stop.** No credential, secret, GitHub App,
  PAT, or cross-repo IAM is created in this wave. The mechanism is proposed in
  **ADR-0022 (Proposed)** and put to the owner; only `POST
  /annotations/export` (credential-free rendering) ships in v1.

## AN-LEAK — Leak check

The public-output leak check gains annotation-specific needles so a regression
that carries annotation tooling or endpoints into `dist-public` goes red:
`/annotations`, `/p/notes`, `hub:annotation:`, `data-annotation-`. The Security
Tester plants one and shows the check fail (non-vacuously).

## AN-REWRITES — Hosting

`firebase.json` gains `/annotations` and `/annotations/**` rewrites to
`hub-gate` (site owns `firebase.json`). The bare `/annotations` rewrite is
required because `/annotations/**` does not match the bare path (the Wave 3
`/share` lesson).

## AN-ADVERSARIAL — Red Team targets (first)

1. **Read another member's notes** via `GET /annotations` (including `?scope=all`
   as a non-owner, and by guessing/ids).
2. **HTML/script injection through a comment or quote** — stored XSS when the
   note is rendered in My notes or in the capture panel; also injection into the
   exported Markdown.
3. Delete another member's note as a non-owner.
4. Forge a note as another member (client-supplied `member`).
5. Reach `/annotations` signed-out or as a non-member on both transports.
6. A note whose `exact`/`prefix`/`suffix`/`comment` carries the log grammar
   (`event=`), or huge/control-character fields.
7. Traversal or segment escape in `section`/`source`/`slug`.
8. `public`/`s-maxage` on any annotation response.

## AN-OUT-OF-V1 (explicitly not built)

PDF annotation; public annotations; sharing notes between members;
Hypothes.is integration; writing an `orphan` flag back to the store;
cross-repo export delivery (blocked on AN-EXPORT's credential).
