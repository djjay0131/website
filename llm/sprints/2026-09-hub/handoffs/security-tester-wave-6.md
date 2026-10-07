# Handoff — Security Tester, Wave 6 (annotations) — VETO

Status: **COMPLETE — 8/8 checks PASS, no veto.**
Date: 2026-10-07
Stream: Security Tester (gate for `feat/annotations`, issue #107)
Contract: `llm/sprints/2026-09-hub/contracts/security-tester-wave-6.md`
Seams: `llm/sprints/2026-09-hub/contracts/wave-6-annotations-seams.md` (AN-CAP, AN-STORE, AN-ROUTES, AN-GUARD, AN-IAM, AN-LEAK, AN-REWRITES, AN-ADVERSARIAL)
Method: tests and probes, not prose review. Every result below is an executed
command or a driven request, not a rendered-page or code-read inference.

## Verdict

| # | Check | Verdict |
|---|---|---|
| 1 | Cross-member isolation (both transports; owner may) | **PASS** |
| 2 | Auth refusal (both transports) + missing/foreign Origin | **PASS** |
| 3 | Stored injection in My notes / capture / export Markdown | **PASS** |
| 4 | Every annotation response `private, no-store` | **PASS** |
| 5 | Logging: no note text; DELETE id cannot forge `event=`/newline | **PASS** |
| 6 | `_payload/**` SAMEORIGIN, every other response DENY | **PASS** |
| 7 | Public boundary + non-vacuous RED leak check + deny-all rules | **PASS** |
| 8 | IAM unchanged; no new binding/role/key/export credential | **PASS** |

No FAIL. **No veto.**

Constraints observed: no build into `site/dist-public`/`dist-private` (both
reused as-is); no tracked file modified except this handoff; no credential. One
read-only git command was run — `git diff main...feat/annotations -- infra/` —
after the operator explicitly authorised that single read-only diff for check 8;
no other `git`/`gh` command was run.

## Suite context

```
cd gate && .venv/bin/python -m pytest -o addopts= -q
626 passed, 2 warnings in 5.77s
```

(`addopts` already carries `-q`, so a second `-q` suppresses pytest's summary
line in the default invocation; `-o addopts=` is used only to reveal the count.)

## Check 1 — Cross-member isolation — PASS

Three-member world driven through `create_app` with the `StaticAnnotationStore`
and the `gate/tests/conftest.py` fakes: owner `owner@vt.edu`, non-owner members
`alice@vt.edu` and `bob@vt.edu` (a third non-member `mallory@example.com`). Both
transports (`hosting` header set and `direct`/`*.run.app` header set).

Probe: `cd gate && .venv/bin/python /tmp/opencode/sec_probe.py` → **21/21 PASS**
(checks 1, 2, 4, 5 in one script); the check-1 assertions, both transports:

```
PASS 1.<t> A default list hides B        status=200 b_leak=False   (A's own row present)
PASS 1.<t> A scope=all refused           status=403               (no "annotations" key, no B marker)
PASS 1.<t> A cannot delete B note        status=403 survives=True
PASS 1.<t> owner scope=all sees B        status=200               (B's member + quote present)
PASS 1.<t> owner deletes B note          status=200 gone=True
```

Exercised, not read: `GET /annotations` (A sees only A), `GET /annotations?scope=all`
(A refused, not downgraded), `DELETE /annotations/{B-id}` (A refused, row
survives), and the owner's read-all / delete-any. There is no GET-by-id route;
read isolation is therefore the list route on both scopes, plus the capture/My-
notes islands' fetches (`GET /annotations` default scope), which are own-rows
only.

Extra (target 7): `POST` with `section`/`source` `a/b` or `../secrets`, `slug`
`../secrets`/`a//b`/`.` → 400; `?source=`/`?slug=` traversal and `?intent=bogus`
→ 400; a body-supplied `member=evil@example.com` is accepted but stored as the
session identity and never echoed. Probe:
`cd gate && .venv/bin/python /tmp/opencode/sec_probe_traversal.py` → 6/6 PASS.

## Check 2 — Auth and Origin — PASS

Same probe. Both transports:

```
signed-out:  GET/POST/DELETE = 403/403/403
non-member:  GET/POST/DELETE = 403/403/403
missing Origin (POST/DELETE) = 403/403 ; foreign Origin (POST/DELETE) = 403/403
PASS 2.both signed-out refusals identical  hosting=403 direct=403 sameBody=True
```

The signed-out refusal is not merely the same status on both transports: the
response body is byte-identical (`sameBody=True`). State-changing routes
(`POST /annotations`, `DELETE /annotations/{id}`) refuse both a missing and a
foreign `Origin` before identity is even read.

## Check 3 — Stored injection — PASS

**Render-path inspection.** `grep -rn "dangerouslySetInnerHTML" site/src
site/src-private` finds the string only inside a comment in
`AnnotationsIsland.tsx`; there is no HTML-injection sink in any render path.
`NotesIsland.tsx` and `AnnotationsIsland.tsx` interpolate quote/comment as React
text children — `{String(note.quote ?? note.selector?.exact ?? "")}` inside
`<blockquote>`, `{String(note.comment)}` inside `<p>` (NotesIsland.tsx:102-103,
AnnotationsIsland.tsx:303-304). The compiled island chunks contain **zero**
`dangerouslySetInnerHTML`/`innerHTML`/`outerHTML`/`insertAdjacentHTML`/
`document.write` tokens:

```
for f in dist-private/_astro/AnnotationsIsland.*.js NotesIsland.*.js annotations.*.js; do
  grep -o "dangerouslySetInnerHTML|innerHTML|outerHTML|insertAdjacentHTML|document.write" "$f" | uniq -c
done   # → no output for all three
```

(The only `dangerouslySetInnerHTML` under `dist-private` is in React's own
`client.*.js` runtime, not in any island chunk and never called with note data.)

**Export probe.** Crafted a bundle with `<script>`, `<img onerror>`,
`[x](javascript:…)`, `![beacon](https://…)`, heading/list/fence and
`</textarea><script>` payloads plus a traversal slug and a `../`-id:

```
node scripts/export-notes.mjs --notes /tmp/opencode/notes-bundle.json --out <tmp>
→ wrote 2 Markdown file(s); skipped 4 (1 question, unsafe item identity x3)
```

Observed output (verbatim excerpt):

```
> &lt;script&gt;alert('xss-quote')&lt;/script&gt;
**Comment**
> \[click me\](javascript:alert('xss-comment')) and &lt;img src=x onerror=alert('onerr')&gt;
> \!\[beacon\](https://evil.example/p.png)
> \# heading injected
> \`\`\` fence \`\`\`
```

`grep -rnI "<script|<img|!\[" <out>` → none. `](javascript`/`](https` occur only
after an escaped `\]`, and `onerror=` only inside `&lt;img … &gt;`; every user
line is `> `-quoted so it cannot open a heading/list/fence. The `question` note
and the traversal slug/`../`-id were **skipped**, and no file landed outside
`--out`. Escaping is proven, not assumed.

## Check 4 — Cache — PASS

Same probe. For each transport, eight response classes — create, create
malformed, list, `scope=all` refused, list signed-out, delete, delete unknown,
delete cross-origin — all:

```
PASS 4.<t> all annotation responses private,no-store :: clean
```

Each `Cache-Control` is exactly `private, no-store`; none contains `public` or
`s-maxage`. (The `security_headers` middleware overwrites the header on every
response, success, refusal and error alike.)

## Check 5 — Logging — PASS

Same probe, writing through the gate's **own** log handler (the conftest
`through_the_gates_own_handler` device, not `caplog`). Planted quote
`zzz-planted-quote-zzz`, comment `zzz-planted-comment-zzz`, tag `tagmarker`,
then create + list + delete. Both transports:

```
PASS 5.<t> no planted quote/comment/tag in gate log; layer alive
           alive=True clean=True forged_line=False statuses=404/404
PASS 5.<t> forged id cannot inject event=/newline
           raw_forged=False statuses=404/404
```

`event=` is present (the layer is demonstrably alive) while none of the planted
strings appears. `DELETE /annotations/event=deny` and `DELETE
/annotations/%0aevent=deny` both return 404 and produce only the fixed
`reason=invalid_id` line: no client value reaches a log line, no forged
`event=deny` line, no newline.

## Check 6 — `X-Frame-Options` — PASS

`_payload/**` is a runtime gate decision (the header is set by the gate's
middleware on the name actually served), so it was driven through `create_app`
against the same object set the private build emits; `dist` was reused, not
rebuilt.

Probe: `cd gate && .venv/bin/python /tmp/opencode/sec_probe6.py` → **52/52 PASS**,
both transports, with `private_prefix=""` and `private_prefix="private"`:

```
payload served 200              → SAMEORIGIN
payload root exact (`_payload`) → SAMEORIGIN
payload signed-out              → 404  DENY
payload non-member              → 404  DENY
payload miss                    → 404  DENY
payload traversal               → 404  DENY
non-payload html (200)          → DENY
non-payload _doc doc (200)      → DENY
`_payloadx/` namespace (200)    → DENY   (only the exact `_payload/` namespace is framed)
/annotations (non-member 403)   → DENY
/annotations POST (400)         → DENY
unknown route (404)             → DENY
/_health (200)                  → DENY
```

No non-payload, refused or miss response is SAMEORIGIN.

## Check 7 — Public boundary — PASS

**Static.** `find dist-public -iname "*note*" -o -iname "*annotation*"` → no
paths. `grep -roE "/annotations|/p/notes|hub:annotation:|data-annotation-[A-Za-z-]*"
dist-public` → only `data-annotation-survey` at
`research/…/consensus/index.html` and `…/sources/index.html`, i.e. the research
citation key `tan-2024-llm-data-annotation-survey`, preceded by a hyphen. That is
exactly the documented Wave-6 leak-check false positive; the check's
left-boundary rule (`ANNOTATION_LEFT_BOUNDARY`) excludes it and catches every
real attribute/string. No capture/Notes chunk exists in `dist-public`.

**Green.** `cd site && npm run check:no-private-in-public`:

```
check:no-private-in-public: PASS — … none of the annotation needles
(/annotations, /p/notes, hub:annotation:, data-annotation-) appears
(173 file(s) scanned in dist-public, 48 in dist-redirects).   exit 0
```

**Non-vacuous RED.** Copied `dist-public` to `/tmp/opencode/…`, planted one
occurrence of each needle (one in a path, three in content) and ran the CLI
against the copy:

```
node scripts/check-no-private-in-public.mjs --dist <copy>
→ 4 LEAK(S) …  path: "/annotations"; contents: "data-annotation-",
  "hub:annotation:", "/p/notes"          exit 1
```

The copy is a faithful duplicate (same 173 files + 4 plants): the clean run is
green and the planted run is red, so the guard is non-vacuous. Adding two
HTML-entity-encoded plants (`&#47;annotations`, `/p&#47;notes/`) raised it to
**6 LEAK(S)** — entity decoding is covered too (RT6-11).

**Deny-all rules.** `infra/firestore.tf` still releases
`match /{document=**} { allow read, write: if false; }` to `cloud.firestore`,
which covers `annotations/{id}` as it covers `members/{email}`; the gate's Admin
SDK bypasses rules by design.

## Check 8 — IAM / credential — PASS

```
git diff main...feat/annotations -- infra/
  infra/README.md | 2 +-
  infra/gate.tf   | 15 +++++++++++++++
  2 files changed, 16 insertions(+), 1 deletion(-)
```

`infra/gate.tf`'s entire delta is 15 added comment lines at
`google_project_iam_member.hub_gate_firestore`; `infra/README.md`'s delta is one
prose table row. No resource, variable, output, role, permission or logic line is
added, changed or removed.

Direct inspection of `infra/`:

- `gate.tf` has **exactly two** `google_project_iam_member` for `hub-gate`:
  `hub_gate_firestore` = `roles/datastore.user` and `hub_gate_session_minter` =
  `google_project_iam_custom_role.gate_session_minter` (gate-auth-role.tf). No
  third binding, no collection-scoped duplicate.
- No `google_service_account_key`, no `google_kms_*`, no new service account, no
  export/GitHub-App/PAT/WIF-provider resource: `grep -rniE "resource
  .*(export|github|pat|service_account_key)" infra/*.tf` finds only the
  pre-existing `wif.tf` website provider and `satellites.tf` provider.
- Repo-wide high-signal secret grep (`ghp_…`, `github_pat_…`,
  `-----BEGIN … PRIVATE KEY`, `xox…`, `sk-…` across `*.tf/*.py/*.mjs/*.ts/*.tsx/
  *.js/*.json/*.yml/*.yaml`, excluding `node_modules/.venv/.git`) → the only hit
  is `contract/examples/invalid/unknown-top-level-field.json`'s fake
  `ghp_notARealTokenButThisFieldMustNeverBeAccepted` test fixture (a validation
  example, not a credential). `site/scripts/fetch-data.sh` mentions the hub's own
  `GITHUB_TOKEN` in a comment for satellite sync — not the annotation export.
- `site/scripts/export-notes.mjs` opens no remote: no `process.env`, no network,
  no `child_process`; it reads only the local `--notes` file and
  `notes-routing.json` and prints the ADR-0022 stop. v1 is credential-free.

## Observations (no security impact, no veto)

1. **Multi-segment `slug` notes are dropped by the export renderer.** The gate
   accepts a multi-segment `slug` (AN-STORE: "slug one or more safe segments"),
   but `export-notes.mjs`'s `noteOutputPath` pushes `note.slug` as a single array
   element and `isSafeSegment("a/b")` is false, so the note is skipped as
   "unsafe item identity" (observed for `slug: "kg/notes"`). This is
   **fail-closed** and therefore not a security finding, but it is a functional
   gap between the gate's accepted identity and the export's accepted identity
   worth a ticket so a legitimate multi-segment item's notes are not silently
   unexported.
2. The gate's `_payload` framing exception keys on the **served object name**, so
   a request whose path merely *looks* like a payload but 404s keeps `DENY`
   (check 6, both prefixes). No further widening was found.

## Reproduction

- Gate probes (ephemeral, under `/tmp/opencode/`): `sec_probe.py` (checks
  1/2/4/5), `sec_probe6.py` (check 6), `sec_probe_traversal.py` (target 7).
  Run from `gate/` with `.venv/bin/python`; they import `gate/app` and
  `gate/tests/conftest.py` and drive `create_app` with the in-memory fakes (no
  credential).
- Export: `cd site && node scripts/export-notes.mjs --notes /tmp/opencode/notes-bundle.json --out <tmp>`.
- Leak check: `cd site && npm run check:no-private-in-public`; RED proof with
  `node scripts/check-no-private-in-public.mjs --dist <planted copy>`.
- IAM: `git diff main...feat/annotations -- infra/` (read-only; one command,
  explicitly authorised by the operator for this check).

## Related docs

- `llm/sprints/2026-09-hub/contracts/security-tester-wave-6.md`
- `llm/sprints/2026-09-hub/contracts/wave-6-annotations-seams.md`
- `llm/sprints/2026-09-hub/handoffs/gate-wave-6.md`, `site-wave-6.md`, `infra-wave-6.md`
- `infra/gate.tf`, `infra/firestore.tf`, `site/scripts/export-notes.mjs`,
  `site/scripts/check-no-private-in-public.mjs`
