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

---

# Round 2 — re-attack the four fixes (annotations, #107)

Agent: Red Team (independent; report only, **no fixes**). Round 1 found 4 BYPASSes; the author landed
four fixes; this round re-runs each original attack and then attacks the fix code itself.
Branch `feat/annotations`, hub `/home/djjay/code/website`. I changed **no tracked file** except this
handoff, ran **no git/gh mutation**, created **no credential**, contacted **no production system**.
All scratch is under `/tmp/opencode/` (`r2-notes.json`, `r2out.*/`, and the probes below).
Focused tests are green as context, not as evidence: gate `tests/test_annotations.py` (157 passed),
site `vitest run scripts/check-no-private-in-public.test.ts scripts/export-notes.test.ts
scripts/private-structure.test.ts` (66 passed).

## Fix verification table

| Fix (code) | Original attack | Re-run result | New attack in the fix code | Verdict |
|---|---|---|---|---|
| **1** `_valid_annotation_id` (`main.py:840,1416`) | RT6-08a grammar, RT6-08b newline | `event=deny`, `event=client_signin_failed`, `%0aevent=deny`, `%65vent%3Ddeny`, double-encoded, `%00`, `%2e%2e`, `abc%20def`, `abc%2Fdef`, overlong 70, all hit the fixed `reason=invalid_id` line; `event=` never appears, one physical line | Python `$` matches **before a single trailing `\n`**, so `abc%0a` / `A%0a` pass validation and emit **two** physical lines (`id=abc` then ` by=<email>`) | **PARTIAL — R2-01** |
| **2** `escapeMarkdownText` + blockquoted comment (`export-notes.mjs:57-113`) | RT6-06 link/image/data:/ref/autolink/fence/block/entity/newline in quote+comment | all neutralised: `\[x\]\(javascript:…\)`, `\!\[beacon\]\(…\)`, `&lt;http://…&gt;`, fences escaped, every line `> `-prefixed, entities `&amp;`-escaped | `created` is escaped with the same function (no newline/`#` neutralisation) and is **not** blockquoted or segment-checked; a crafted `created` injects a **top-level `#` heading** end-to-end | **PARTIAL — R2-02** |
| **3** lowercase + decode needles (`check-no-private-in-public.mjs:326-360`) | RT6-11 case / entity / upper-attribute | `DATA-ANNOTATION-FRAME`, `/Annotations`, `/P/NOTES`, `HUB:ANNOTATION:`, `&#47;annotations`, `&#x2f;annotations`, `&#X2F;`, `data&#45;annotation&#45;frame`, `&sol;`/`&colon;` all caught; citation-key FP still green | the `data-annotation-` left boundary lacks `. / # ? ; : & | -`, so realistic `.data-annotation-frame{}` (CSS) and `"./data-annotation-frame.js"` (import) stay green | **PARTIAL — R2-03** |
| **4** Dissenter D1/D2 documented, no code change | — | no code to re-attack | none in code; only the **R2-04** existence oracle is adjacent to D1 | **ACKNOWLEDGED (docs)** |

**Bottom line: 3 of 4 fixes are closed for exactly the round-1 bypass they targeted; all three carry a
new, narrower bypass in the surrounding code. Fix 4 is documentation and holds. No round-1 bypass
survives in its original form.** The most serious new finding is **R2-02** (top-level block injection
via `created`), but it needs a hand-crafted `--notes` bundle; **R2-01** is reachable by any member but
can only add a server-authored ` by=` line, so it is not a metric forgery.

## Round 2 attack table

| # | Target | Exact setup | Observed | Verdict | Code path |
|---|---|---|---|---|---|
| R2-01 | DELETE id trailing newline | member `DELETE /annotations/abc%0a`, `/A%0a`, `/AAAAAAAAAAAAA%0a` | `abc%0a` and `A%0a` → 2 physical lines: `… id=abc` + ` by=djjay@vt.edu`; 13-char form truncated to 12 so single line; `%0D%0A`, mid-string `%0a`, `\r` all refused | **BYPASS (new, low)** | `main.py:170,840,849-853,1416` |
| R2-02 | Export `created` top-level block | offline bundle with `created:"2026-01-01\n# FINAL REPORT (injected heading)\n[click](javascript:…)"` | CLI wrote real `.md` with an unquoted **`# FINAL REPORT`** top-level heading; the link is `\[click\]\(…\)` (inert) | **BYPASS (new, needs crafted bundle)** | `export-notes.mjs:105` |
| R2-03 | Leak needle left boundary | temp dist contents `.data-annotation-frame{color:red}`, `import x from "./data-annotation-frame.js"`, `#data-annotation-frame`, `?data-annotation-frame`, `;…`, `:…`, `&…=`, `\|…\|` | all seven green; only real-attribute neighbours (space, `<`, quote, `[`, `(`, `{`, `,`, backtick, `=`) match | **BYPASS (new, partial)** | `check-no-private-in-public.mjs:312,349-360` |
| R2-04 | Id existence oracle | member B deletes (a) owner's real id, (b) a random 22-char id, (c) own id | (a) `403` (exists, not mine), (b) `404` (unknown), (c) `200` | **INFORMATION LEAK (theoretical)** — 22-char `token_urlsafe(16)` = 128 bits, brute force infeasible. Adjacent to D1, not a code defect | `main.py:847-866` |
| R2-05 | Forge `member` = owner in body | member POST with `member:"djjay@vt.edu"`, `member_email:"djjay@vt.edu"` | stored `member=cbrown@vt.edu`; row only in owner `scope=all` under B's address | **REFUSED** | `main.py:775-776` |
| R2-06 | `scope=all` + filters as non-owner | B: `?scope=all`, `+source`, `+slug`, `+intent`, `+section` | every case `403` before filters; owner quote never in body | **REFUSED** | `main.py:793-796` |
| R2-07 | `section=section` filter gap | own list `?section=phd`, `?section=../secrets` | `section` is not a filter: all own rows returned, `../secrets` ignored, `200` | **OBSERVED (benign)** — no client value reaches SQL/Firestore; functionality gap only | `main.py:1343-1372` |
| R2-08 | Export path traversal | `noteOutputPath`/`parseRouting` with `repo:"owner/.."`, `repo:"a/../../etc"`, `dir:"../x"`, `dir:"a/../../b"`, `slug:"../evil"`, `slug:"a/../../b"`, `slug:"/abs"`, `id:"../evil"`, `id:"..%2fevil"`, `section:"../../etc"` | every `noteOutputPath` → `null`; `parseRouting` refuses all hostile `dir`; `repo:"owner/.."` is accepted by `parseRouting` but `noteOutputPath` nulls it (`isSafeSegment("..")=false`) | **REFUSED** | `export-notes.mjs:123-130`, `annotations.mjs:671-677` |
| R2-09 | Multi-segment hub slug export | `slug:"hub/research/soa-agentic-se"` | `noteOutputPath` → `null` (`segments.every(isSafeSegment)` rejects the `/`), note skipped "unsafe item identity" | **OBSERVED (functionality regression, not security)** — real nested hub slugs cannot export | `export-notes.mjs:126-128` |

Counts: **9 attacks — 4 REFUSED, 3 BYPASS (new), 1 INFORMATION LEAK (theoretical), 1 OBSERVED-benign,
plus R2-09 functionality.**

## New bypass reproductions

### R2-01 — `_valid_annotation_id` accepts a trailing `\n` (Python `$`), injecting a second log line

The fix comment (`main.py:163-170`) promises the id charset stops "a `%0a` newline". Python's `$`
matches at the end of the string **or just before a newline at the end**, and `_valid_annotation_id`
uses `_ANNOTATION_ID_PATTERN.match(...)` with no control-character pre-strip — so a value ending in one
`\n` passes, reaches the *valid-id* miss branch, and is logged *with* the newline.

```
$ cd gate && .venv/bin/python -c "
import re; p=re.compile(r'^[A-Za-z0-9_-]{1,64}$')
for v in ['abc\n','abc\n\n','abc\nevent=deny','x\r\n']: print(repr(v), bool(p.match(v)))"
'abc\n' True
'abc\n\n' False
'abc\nevent=deny' False
'x\r\n' False

$ .venv/bin/python /tmp/opencode/probe_r2_gate.py    # R2-F1
'event=deny'                 status=404 lines=1 forged_metric=False
'%0aevent=deny' is refused as invalid_id (fixed): one value-free line
'abc%0a'                     status=404 lines=2 forged_metric=False
     'INFO gate event=miss scope=annotation action=delete id=abc'
     ' by=djjay@vt.edu'                      <-- second physical line
'A%0a'                       status=404 lines=2 forged_metric=False
     'INFO gate event=miss scope=annotation action=delete id=A'
     ' by=djjay@vt.edu'
'AAAAAAAAAAAAA%0a'           status=404 lines=1  (12-char truncation drops it)
```

Why it is not a metric forgery: the only attacker-controlled byte is the trailing `\n`; the second
line is the server's own ` by=<email>`, so no `event=` substring and no metric filter matches. Impact
is log-integrity (one request can produce two lines) and the fix's "value-free" claim. The existing
test `test_delete_id_cannot_forge_the_log_grammar_or_inject_a_line` (`test_annotations.py:552-577`)
probes only `%0aevent=deny`, which the fix does refuse, so it misses this. `_valid_annotation_id` and
the sibling `_SEGMENT`/`safe_prefix` differ in the right way: `_checked_segments` strips control
characters *before* the regex (`serve.py:55-56`), which is why `safe_prefix` is not exposed.

### R2-02 — export `created` is not neutralised for newlines, so a top-level block survives

`escapeMarkdownText()` now escapes backslash, `& < >`, and `` ` * _ [ ] ! ``; the quote and the comment
are each blockquoted. But `created` is emitted as `- **Created:** ${escapeMarkdownText(created)}`
(`export-notes.mjs:105`), which does **not** escape `\n` or `#`, and `created` is neither blockquoted
nor validated by `noteOutputPath` (only the item identity and `id` are). A crafted offline bundle
therefore injects an unquoted top-level heading:

```
$ cd site && OUT=$(mktemp -d /tmp/opencode/r2out.XXXXXX)
$ node scripts/export-notes.mjs --notes /tmp/opencode/r2-notes.json --out "$OUT"
export-notes: wrote 1 Markdown file(s) … (djjay0131/soa-agentic-se: 1)
$ cat "$OUT/…/abc123.md"
- **Created:** 2026-01-01
# FINAL REPORT (injected heading)          <-- top-level block, not in a blockquote
\[click\](javascript:alert(document.cookie))   <-- escaped brackets: link inert
- **Note id:** abc123
…
**Comment**
> safe
> # Not a heading                          <-- quote/comment side is correctly contained
> \[click\](javascript:alert(document.cookie))
> \!\[beacon\](https://evil.example/p?u=1)
> \`\`\`
```

All RT6-06 payloads in `quote` and `comment` are now correctly neutralised (re-verified:
`[x](javascript:)`, `![beacon]`, `data:` image, reference-style, autolink, fence, `#`/`-`/`1.`/`>`
starts, entities, embedded newline). The residual is only the fields that bypass the escaping
contract: `created` (reachable through `--notes`, the supported offline path), and `id`/`route.repo`/
`route.dir` in `renderNoteMarkdown` isolation — those three are gated by `noteOutputPath`'s
`isSafeSegment` check, `created` is not. Via the **live gate** `created` is a server `datetime`
(`main.py:772`, `isoformat()` never contains `\n`), so a note created by a member cannot reach this;
severity is limited to a hand-crafted bundle.

### R2-03 — `data-annotation-` still has left-boundary blind spots

`containsAnnotationNeedle` (`check-no-private-in-public.mjs:349-360`) now lowercases and decodes, which
closes every round-1 spelling. But the `data-annotation-` left-boundary set
(`ANNOTATION_LEFT_BOUNDARY`, line 312) omits `. / # ? ; : & |` (and `-`, deliberately, for the
citation-key FP). Those are exactly the neighbours in CSS selectors and module paths:

```
$ cd site && node /tmp/opencode/probe_r2_leak.mjs
   CAUGHT  case.html / entity.html / upper_attr.html / mix.html / hexupper.html / nosemi.html / named.html
   green   real_note.html   green hsla.json (citation-key FP)   green partial.html
   green   css_selector.css      ".data-annotation-frame{color:red}"
   green   import_ref.js         "import x from \"./data-annotation-frame.js\""
   green   fragment.html         '<a href="#data-annotation-frame">'
   green   query.html            '<a href="?data-annotation-frame">'
   green   semicolon.js / colon.js / amp_ref.html / pipe.txt
   green   double.html           "&amp;#47;annotations"   (single-decode limit, correct)
```

The other three needles are boundary-free and unaffected. The `.` CSS-selector and `/` module-path
forms are plausible regressions that a public build could carry while staying green; the `/` form's
*path* is caught by the path check only if the file itself is named that way — an in-file import
reference is not. The citation-key FP remains green, so the fix did not trade the FP for this gap.

## Refused / observed reproductions (highlights)

```
R2-05 member body member="djjay@vt.edu": stored.member = cbrown@vt.edu  (forgery dropped)
R2-06 non-owner ?scope=all[&source|&slug|&intent|&section]: every case 403, owner quote absent
R2-07 own ?section=../secrets -> 200, section not a filter (all own rows)
R2-08 every noteOutputPath traversal (repo/dir/slug/id/section) -> null; parseRouting refuses hostile dir
R2-09 slug "hub/research/soa-agentic-se" -> null (multi-segment slug is skipped, not traversed)
R2-F1b list ?scope=EVENT=DENY / ?intent=event=3Ddeny / ?slug=%0aevent=deny -> fixed
        event=reject reason=invalid_scope|invalid_filter, no client value in any event= line
```

## Fix 4 — Dissenter D1/D2

No code changed for D1 (owner reads every member's notes) or D2 (`X-Frame-Options: SAMEORIGIN`); they
are recorded as policy/documentation. No residual **code** concern arises from either. The only
adjacent code observation is **R2-04**, the `403`-vs-`404` delete oracle that lets a member confirm
whether a *guessed* id exists; with 128-bit server-minted ids this is unreachable in practice and is
not a defect in the D1/D2 decisions.

## Round 2 reproduction index

| Pointer | Command |
|---|---|
| R2-F1, R2-F1b, R2-N1..N4 | `cd gate && .venv/bin/python /tmp/opencode/probe_r2_gate.py` |
| R2-F2, R2-N5..R2-N9 | `cd site && node /tmp/opencode/probe_r2_export.mjs` |
| R2-F3, R2-03 | `cd site && node /tmp/opencode/probe_r2_leak.mjs` |
| R2-02 (CLI + disk artifact) | `cd site && node scripts/export-notes.mjs --notes /tmp/opencode/r2-notes.json --out <tmp>` |
| Context (gate) | `cd gate && .venv/bin/python -m pytest tests/test_annotations.py -q` → 157 passed |
| Context (site) | `cd site && npx vitest run scripts/check-no-private-in-public.test.ts scripts/export-notes.test.ts scripts/private-structure.test.ts` → 66 passed |
