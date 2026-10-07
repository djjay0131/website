# Handoff — `Red Team`, Wave 6 (annotations, #107)

Agent: Red Team (independent; authored nothing in this wave — report only, **no fixes**)
Contract: `llm/sprints/2026-09-hub/contracts/red-team-wave-6.md`
Seams: `llm/sprints/2026-09-hub/contracts/wave-6-annotations-seams.md` (AN-ADVERSARIAL)
Branch: `feat/annotations` HEAD `e44a7b7` — hub `/home/djjay/code/website`
Working tree: I changed **no tracked file** and ran **no git/gh mutation**. All scratch is under
`/tmp/opencode/` (`probe_common.py`, `probe_gate.py`, `probe_frame.py`, `probe_export.mjs`,
`probe_leak.mjs`, `notes.json`, `notes-out/*`). No credential was created; no production system was
contacted (all probes ran against `create_app` + the in-memory fakes, or Node against the checked-in
modules). `gate/.venv/bin/python -m pytest` is green (608 passed) as context, not as evidence.

## Summary

**13 attacks: 8 REFUSED, 4 BYPASS, 1 NOT APPLICABLE (documented limit).** The authorisation core is
solid — cross-member read, cross-member delete, forged author, auth on both transports, Origin
checking, path traversal and cache headers all refused exactly as the seams require, and stored
`<script>` stays inert in both islands.

The four bypasses are:

1. **Log-grammar forgery (`RT6-08a`).** `DELETE /annotations/{id}` logs the **client-supplied** path
   segment via `_short_annotation_id()` with **no `_neutralise_grammar()`**, unlike `/client-events`.
   A member requests `DELETE /annotations/event=deny`; the miss line
   `event=miss scope=annotation action=delete id=event=deny by=…` contains the literal substring
   `event=deny`, so the `hub-gate-denials` metric (`textPayload:"event=deny"`, `infra/monitoring.tf:175`)
   counts a denial that never happened. The same trick forges `event=client_signin_failed` (truncated)
   and any other `textPayload:` metric whose trigger fits in 12 chars. An authenticated member can
   inflate the denials metric at will.
2. **Log-line injection (`RT6-08b`).** The same id is not control-character-stripped, so
   `DELETE /annotations/%0aevent=deny` emits **two** physical log lines, the second being a
   standalone `event=deny by=…`. This forges an entire log entry, not merely a substring.
3. **Markdown link/image/block injection (`RT6-06`).** `escapeMarkdownText()` HTML-escapes only
   `& < >`. It does **not** neutralise Markdown. A quote/comment keeps `[x](javascript:…)`,
   `![beacon](https://evil…)` and `data:` image URIs, and the **comment is emitted unquoted**, so a
   newline injects top-level headings, lists and code fences. Raw `<script>`/`<img onerror>` *are*
   inert (escaped); the seam's "stays inert text" claim does not cover Markdown URL/structure
   injection. Downstream renderers that do not sanitise URLs (many `marked`/`markdown-it` defaults)
   turn this into stored XSS or a tracking beacon in the two export target repos.
4. **Leak-needle bypass (`RT6-11`).** `findAnnotationLeaks()` matches the four needles
   case-sensitively as plain substrings. `DATA-ANNOTATION-FRAME` (a live HTML attribute — attribute
   names are case-insensitive), `/Annotations`, `/P/NOTES`, `HUB:ANNOTATION:`, and the HTML-entity
   forms `&#47;annotations` / `data&#45;annotation&#45;frame` (decoded by the browser) all pass the
   check green. A note's own content with none of the tool strings also passes — that last part is
   the documented ADR-0005 limit, recorded as NOT APPLICABLE (`RT6-12`).

The **most serious** is `RT6-08a/08b`: directly reachable by any allowlisted member against
production logging (no owner action, no downstream renderer), it forges the alerting metric and can
inject arbitrary Cloud Logging lines.

## Attack table

| # | Target (AN-ADVERSARIAL) | Exact setup | Observed | Verdict | Code path |
|---|---|---|---|---|---|
| RT6-01 | Cross-member read | A(owner)+B(member) each create; B `GET /annotations`, `?scope=all`, `?scope=All/ALL`, `%20all`, `own&scope=all`, `all&intent=`, `?SCOPE=all`, `?member=…`, both transports | B default: 200, **own only**, owner quote absent; B `scope=all`: 403; case/space variants: 400 or own-200, never a leak; owner `scope=all`: 2 rows with both members | **REFUSED** | `main.py:776-814`, `annotations.py:301-311` |
| RT6-02 | Delete escalation | B deletes A's id; signed-out/non-member delete; unknown id as member and owner | B→A: 403, row intact; unknown: 404 (no existence oracle, identical to member/owner); signed-out/non-member: 403 | **REFUSED** | `main.py:816-854` |
| RT6-03 | Forged author | POST body with `member`, `created_by`, `id`, `created`, `updated` all attacker-chosen | stored `member` = session email, stored `id` = server-minted; forgeries dropped | **REFUSED** | `main.py:758-774`, `_annotation_fields:1254` |
| RT6-04 | Auth bypass | GET/POST/DELETE signed-out and non-member, hosting + direct; POST/DELETE with **no** Origin; Origins `null`, `http://`, trailing `/`, `host.evil.com`, `evil.example`, `#x` | every case 403 on both transports; member POST/DELETE with no Origin 403 | **REFUSED** | `main.py:737-854`, `_same_origin:976`, `_refuse_cross_origin:1048` |
| RT6-05 | Stored XSS (islands) | `<img src=x onerror=…>`, `</textarea><script>`, `<script>` in quote+comment through `validateNoteInput`/`resolveNote`; grep every `src-private/**` render path for HTML sinks | values pass through **unchanged as strings**; **zero** `dangerouslySetInnerHTML`/`innerHTML`/`set:html`/`document.write` in `src-private/**`; islands render `{String(note.quote)}`, `{String(note.comment)}` as React text nodes | **REFUSED** | `AnnotationsIsland.tsx:297-311`, `NotesIsland.tsx:98-105` |
| RT6-06 | Stored XSS via **export Markdown** | `renderNoteMarkdown()` + the CLI on a crafted bundle: `<img onerror>`, `</blockquote><script>`, `[x](javascript:)`, `![beacon](https://evil)`, `data:` image, newline block/fence injection | raw `<…>` escaped to `&lt;…&gt;` (**inert**); Markdown link/image/`javascript:`/`data:`/heading/list/fence survive verbatim in the written `.md` | **BYPASS** | `export-notes.mjs:47-95` |
| RT6-07 | `X-Frame-Options: SAMEORIGIN` exception | `_is_payload_object()` variants; served headers for payload vs normal vs miss vs non-`/p`; traversal attempts `%2e%2e` | payload exists → SAMEORIGIN; normal page, directory index, payload **miss**, `/annotations`, `/share` → DENY; traversal → 404 DENY (never reaches the name) | **REFUSED** | `main.py:337-342`, `_is_payload_object:1151`, `serve_private:520-533` |
| RT6-08a | Log grammar forgery | member `DELETE /annotations/event=deny`, `/annotations/event=client_signin_failed`; capture the gate's own handler | `… id=event=deny by=cbrown@vt.edu` — substring `event=deny` present; `event=client` (truncated) | **BYPASS** | `main.py:829-834`, `_short_annotation_id:1391` |
| RT6-08b | Log **line** injection | member `DELETE /annotations/%0aevent=deny` (`\n` in the path segment) | two physical lines; second is `event=deny by=djjay@vt.edu` (matches `textPayload:"event=deny"`) | **BYPASS** | same |
| RT6-09 | Path/segment escape | create with `../secrets`, `..%2f`, `%2e%2e`, `/abs`, `a\b`, `a//b`, `.`, `..`, ``, 600-char, `%00` in `section`/`source`/`slug`; filter variants | all 400 **except** `source="_payload"` accepted (a syntactically safe segment; not an escape, see observation O1) | **REFUSED** | `_annotation_fields:1254-1276`, `_annotation_filters:1323`, `serve.py:42-118` |
| RT6-10 | Cache | every create/list/refused/signed-out/delete/unknown response | all `Cache-Control: private, no-store`; `public` and `s-maxage` absent | **REFUSED** | `main.py:324-342` |
| RT6-11 | Leak needles bypass | `findAnnotationLeaks()` on a temp dist with plain, case, entity and partial needles | plain caught; `case.html`, `entity.html`, `partial.html`, `upper_attr.html` all **green** | **BYPASS** | `check-no-private-in-public.mjs:293-328,338-379` |
| RT6-12 | Real annotation into `dist-public` | temp dist file `<blockquote>the private passage …</blockquote>` (no tool string) | green | **NOT APPLICABLE** — the four needles guard the *tool*, not note content; documented ADR-0005 limit | same |
| RT6-13 | Caps (target 6 tail) | comment 5001, exact 2001, body >16384 | 400 / 400 / 413; quote+comment never logged; full id never logged | **REFUSED** | `main.py:154-161,743-746,1294` |

Counts: **13 attacks — 8 REFUSED, 4 BYPASS, 1 NOT APPLICABLE.**

---

## Bypass reproductions

### RT6-08a / RT6-08b — a member forges the denial metric and injects log lines

`_short_annotation_id()` returns `annotation_id[:12]` (`main.py:1391-1393`) and is the value logged
for the client-supplied `DELETE` path segment (`main.py:829-834`). `_neutralise_grammar()` exists
(`main.py:252-269`) and is applied on `/client-events` — it is **not** applied here, and the value is
not passed through `_clean_client_value()` either.

```
$ .venv/bin/python /tmp/opencode/probe_gate.py        # A8 section, gate's own handler captured
INFO gate event=miss scope=annotation action=delete id=event=deny by=djjay@vt.edu
  contains substring 'event=deny' beyond the real event field? True

PAYLOAD %0aevent=deny
    'INFO gate event=miss scope=annotation action=delete id='
    'event=deny by=djjay@vt.edu'
   standalone event=deny line: True

PAYLOAD %0aevent=client_signin_failed
    'INFO gate event=miss scope=annotation action=delete id='
    'event=clien by=djjay@vt.edu'        # 12-char truncation bites this one only
```

`infra/monitoring.tf:169-176` matches `textPayload:"event=deny"` and `:185-196` matches
`textPayload:"event=client_signin_failed"`; the first is forged verbatim, the second partially. Any
future metric whose trigger is ≤12 chars is forgeable. The member must be authenticated (the route
refuses before logging the id otherwise) — but every member can do this, repeatedly, with one line
each. Production side effect: none performed; this was reproduced only against the local gate.

### RT6-06 — export Markdown keeps link/image/structure injection

`escapeMarkdownText()` (`export-notes.mjs:47-52`) escapes only `& < >`. The quote is prefixed `> `
per line (contained as a blockquote **block**), but the comment is emitted on its own line with no
prefix (`:92`). End-to-end artifact from the CLI:

```
$ OUT=$(mktemp -d /tmp/opencode/out.XXXXXX)
$ node scripts/export-notes.mjs --notes /tmp/opencode/notes.json --out "$OUT"
export-notes: wrote 1 Markdown file(s) … (djjay0131/soa-agentic-se: 1)
export-notes: skipped note2 (…): question stays in My notes
$ cat "$OUT/djjay0131/soa-agentic-se/notes/phd/phd-milestones/committee-dossier/note1.md"
# phd/phd-milestones/committee-dossier
…
> &lt;img src=x onerror=alert(1)&gt;      <-- raw HTML inert (good)

safe

# Not a note heading                       <-- top-level block injected by the comment
[click me](javascript:alert(document.cookie))   <-- javascript: URL preserved
![beacon](https://evil.example/p?u=1)           <-- remote image/beacon preserved
```

A quote of `[click](javascript:alert(1))` and of
`![x](data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==)` similarly pass through unchanged
(`probe_export.mjs`). On GitHub the `javascript:` anchor is stripped and the image is proxied, but the
export's own contract is to those two repos' tooling, and a Markdown→HTML step without URL
sanitisation yields stored XSS. The seam's claim — "every field is escaped and the passage is a
blockquote, so a `<script>` in a note stays inert text" — is true only of **raw HTML**, not of
Markdown.

### RT6-11 — case and HTML-entity spellings evade the needles

`containsAnnotationNeedle()` (`check-no-private-in-public.mjs:318-328`) does a case-sensitive
`indexOf`; only `data-annotation-` has a (case-sensitive) left-boundary rule. Probe:

```
$ node /tmp/opencode/probe_leak.mjs
needles: [ '/annotations', '/p/notes', 'hub:annotation:', 'data-annotation-' ]
findAnnotationLeaks() results:
   LEAK plain.txt contents "/annotations"
   LEAK plain.txt contents "/p/notes"
   LEAK plain.txt contents "hub:annotation:"
   LEAK plain.txt contents "data-annotation-"
per-case predicate check:
   plain.txt        needles=[4 hits] -> check_exits_nonzero=true
   case.html        needles=[]        -> check_exits_nonzero=false   # <div DATA-ANNOTATION-FRAME> /Annotations /P/NOTES HUB:ANNOTATION:
   entity.html      needles=[]        -> check_exits_nonzero=false   # &#47;annotations &#47;p&#47;notes data&#45;annotation&#45;frame
   partial.html     needles=[]        -> check_exits_nonzero=false
   upper_attr.html  needles=[]        -> check_exits_nonzero=false
   real_note.html   needles=[]        -> check_exits_nonzero=false
```

HTML attribute names are ASCII case-insensitive, so `DATA-ANNOTATION-FRAME` is a functional capture
frame; `&#47;annotations` in an `href` is decoded by the browser to `/annotations`. Either would leak
the tooling and stay green. The existing tests only pin lowercase/plain needles
(`check-no-private-in-public.test.ts:408,425,457-462`).

---

## Refused reproductions (highlights)

```
A1  [hosting/direct] memberB default: status=200 leaks_owner=False rows=1
    [hosting/direct] memberB scope=all: status=403
    non-owner '?scope=All': 400   '?scope=%20all': 400   '?SCOPE=all': 200 (own, no leak)
A2  memberB deletes memberA note: 403; still present: True
    unknown id as member: 404; as owner: 404  (identical -> no existence oracle)
A3  stored.member = cbrown@vt.edu | stored.id = Z6421oKgDnCC81RJmuYV4g   (body forgeries ignored)
A4  all signed-out/non-member GET/POST/DELETE on both transports = 403
    member POST/DELETE with no Origin, null, http://, trailing '/', host.evil.com = 403
A7  _payload/<…>.html -> (200,'SAMEORIGIN');  /p/phd/milestones/index.html -> (200,'DENY');
    /p/_payload/does-not-exist -> (404,'DENY'); /annotations,/share -> DENY
    /p/_payload/%2e%2e/… -> (404,'DENY')  (dot_segment before the header decision)
A9  every traversal/absolute/backslash/empty/over-long/NUL segment -> 400 (only source="_payload" accepted)
A10 all six response classes: 'private, no-store', public=False s-maxage=False
```

Note on `_is_payload_object()` in isolation: it returns `True` for `'_payload/../phd/milestones/index.html'`
because it only tests the string prefix after stripping the private prefix (`main.py:1151-1165`). It is
not reachable as a **served** name — `serve_private` sets `request.state.served_object_name` only on a
200 from `safe_object_path`, which rejects `..` — so no framing bypass was found; the predicate is
correct only because its only caller feeds it canonical names.

## Observations (not verdicts)

- **O1 — `_payload` is not reserved as an item segment.** `source="_payload"` (and `section`)
  is accepted as a syntactically safe segment (`serve.py:23,68-72` has no `_payload` reservation).
  No traversal and no served overlap was found (identity is `section/source/slug`, disjoint from the
  payload namespace's leading segment); recorded, benign.
- **O2 — quote/comment are never logged**, so the target-6 log-scrape half of the grammar attack is
  clean; the hole is the delete **id**, not the note body.
- **O3 — `notes-routing.json` `question → null`** is honoured end-to-end: the CLI reported
  `skipped note2 … question stays in My notes`.

## Disclosures / side effects

None. No credential, secret, App, PAT or cross-repo IAM was created. No `git`/`gh` mutation; no
tracked file changed; `git status --porcelain` shows only pre-existing untracked handoff files. No
production endpoint was contacted: the gate probes drove `create_app()` with the in-memory fakes, and
the site probes ran the checked-in Node modules against `/tmp` copies. The export CLI wrote only under
`/tmp/opencode/`.

## Reproduction index

| Pointer | Command |
|---|---|
| T1–T4, T8–T10, T13 | `cd gate && .venv/bin/python /tmp/opencode/probe_gate.py` |
| T7 | `cd gate && .venv/bin/python /tmp/opencode/probe_frame.py` |
| T5, T6 (unit) | `cd site && node /tmp/opencode/probe_export.mjs` |
| T6 (CLI + disk artifact) | `cd site && node scripts/export-notes.mjs --notes /tmp/opencode/notes.json --out <tmp>` |
| T11, T12 | `cd site && node /tmp/opencode/probe_leak.mjs` |
| Context | `cd gate && .venv/bin/python -m pytest -q` → 608 passed |
