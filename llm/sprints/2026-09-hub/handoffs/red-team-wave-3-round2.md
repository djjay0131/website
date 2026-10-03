# Handoff — `Red Team`, Wave 3 · round 2 (re-attack after the D1 fix)

Agent: Red Team (independent; report only, authored nothing in this wave)
Seam: `llm/sprints/2026-09-hub/contracts/phase-4-seams.md` SEAM-S1/S2/S3/S4/S8
Repo: `/home/djjay/code/website` · branch `feat/sharing` · HEAD `fcecfd8`
Prior round: `llm/sprints/2026-09-hub/handoffs/red-team-wave-3.md` (HEAD `c605c72`)
Working tree: I changed **no tracked file**. This file is new and untracked; the four peer
handoffs (`dissenter-*`, `regression-tester-*`, `security-tester-*`, `red-team-wave-3.md`) are the
rest of the untracked set.

## Summary

**6 attack groups, 0 BYPASS.** Every one of the four surfaces the D1 fix touched is a clean
refusal: a token reaches neither the member frame, `_payload/**`, `_astro/**`, nor a sibling
item's `_doc/`; every `entry` escape is 400 at mint or refused at serve; `_doc`-suffix prefix
confusion does not open a path; a `.pdf` is `application/pdf`; and entropy, expiry/revocation,
non-owner/anonymous, cross-origin and `private, no-store` are unchanged-good.

Two things are recorded as **considered and dismissed**, not bypasses: (a) the availability
rewrite fix is present in `firebase.json` in the right shape but **cannot be confirmed live until
deploy**, and Hosting's `trailingSlash: true` is a residual to check at SEAM-S7; (b) the private
build's `_doc` reservation is **exact-match only**, so a slug of the form `foo/_doc` would stage a
document nested inside item `foo`'s `_doc/` tree — but both content-model slug patterns forbid
`_` (and therefore `_doc`) entirely, so no real build can produce one.

Baseline: `gate/` suite **447 passed** (`gate/.venv/bin/python -m pytest`, was 419). Site:
`vitest run` on `private-content`/`private-build`/`check-private-links`/`private-structure`
**76 passed**. All route work used a throwaway ASGI harness in `/tmp/opencode/redteam/harness2.py`
(real `create_app`, in-memory `StaticShareStore`/`StaticMemberDirectory`/`FakeStore`/`FakeVerifier`)
on `127.0.0.1:8124`, driven with `curl --path-as-is`.

> **Live note.** `fcecfd8` is not deployed, so no route-level result below is a live observation.
> The first round established the `*.run.app` invoker is `allUsers` and the gate answers there
> (origin in the allowlist); this round is in-memory only.

## Attack table

| # | Attack | Observed | Verdict | Code path |
|---|--------|----------|---------|-----------|
| 1 | Token → member frame `index.html`, `_payload/**`, `_astro/**`, sibling `_doc/` | 11 traversal spellings (`../`, `%2e%2e`, `..%2f`, `_doc/../`, 4× `%2e%2e%2f`, `%252e`) all 404 with **`store.fetches == []`**; direct in-prefix spellings miss but fetch only *inside* `_doc/` | **REFUSED** | `main.py:655-659`, `serve.py:42-74`; tests `test_shares.py:548-603` |
| 2 | `entry` escapes (absolute, `..`, `%2e%2e`, empty, `a//b`, `/etc/passwd`, `index.html/../../<sibling>`, trailing `/`, NUL, backslash); token root serves only `_doc/<entry>` | 13/13 hostile entries **400** `invalid_request`; legal `site/index.html`, `.hidden`, `*.pdf` 200; a corrupt stored `entry=../../../secrets` serves 404 with **0 fetches**; root request fetched exactly `…/_doc/index.html` | **REFUSED** | `main.py:923-940` (`safe_prefix`), `main.py:652-656`, `serve.py:42-102` |
| 3 | Slug/section escape and `_doc`-suffix prefix confusion (`section ..`, `a/_doc`; `slug _doc`, `foo/_doc`, `foo_doc`, `../`, `/etc`; `_doc-evil`) | illegal shapes **400**; slugs the gate accepts (`_doc`, `foo/_doc`, `foo_doc`) only build a nested `…/_doc/_doc` prefix, reachable bytes are misses; every `../` refused 0-fetch; `committee-dossier_doc-evil` resolves *in-prefix* and misses | **REFUSED** | `main.py:958-983`, `serve.py:68-72`; `test_shares.py:500-524` |
| 4 | Content-type: a `.pdf` entry | token root and `…/anthropic-fellow.pdf` both **`application/pdf`** + `nosniff`; `.css`→`text/css`, `.html`→`text/html`; `anthropic-fellow.pdf/index.html` misses (404) | **REFUSED** | `serve.py:121-133`, `main.py:668-673`; tests `test_shares.py:161-176` |
| 5 | Entropy · expiry/revocation · non-owner/anonymous · cross-origin · `private,no-store` | 200 000 mints → 256-bit, 200 000 distinct; unknown/expired/revoked/corrupt/traversal/missing all byte-identical 329 B/`0ddd881d…`; 13 authz cases correct (owner 200, everyone else 403); **0** `public`/`s-maxage` across 16 outcomes; no `Set-Cookie`/ACAO on `/s/**` | **REFUSED** | `shares.py:43-45`, `main.py:108,292-300,867-885,943-955` |
| 6 | Site build: is `_doc/` item-scoped? sibling doc under another item's `_doc/`? | `dist-private` `_doc/` trees each hold **only their own** basename doc + shared assets (`committee-dossier/_doc/committee.html`, `milestones/_doc/index.html`, `internal-notes/_doc/internal.html`); prefix-root sibling exclusion proven by `docStagingPlanFor` tests | **REFUSED** | `frame-content.mjs:241-306`, `private-build.mjs:99-128`; `private-content.test.ts:206-292` |

Counts: **6 attack groups, 6 REFUSED, 0 BYPASS**, plus 2 dismissed observations (below).

---

## Transcripts

### 1 — reach-out attempt, all zero-fetch (`/tmp/opencode/redteam/round2-att1.txt`)

Token `ACTIVE…` for `phd/phd-milestones/committee-dossier`, created by the current code with
`entry`: the only objects under reach are `…/committee-dossier/_doc/**`.

```
raw ../index.html            HTTP 404 fetches=[]      # member frame refused pre-bucket
enc %2e%2e%2findex.html      HTTP 404 fetches=[]
_doc/../index.html           HTTP 404 fetches=[]
enc ../../_payload           HTTP 404 fetches=[]      # item's _payload sibling
enc 4x top payload           HTTP 404 fetches=[]      # /_payload/<source>/…
enc 4x _astro                HTTP 404 fetches=[]      # /_astro/…
enc ../milestones/_doc       HTTP 404 fetches=[]      # sibling item's _doc
raw ../milestones/_doc       HTTP 404 fetches=[]
enc ../committee-dossier-evil HTTP 404 fetches=[]     # segment-prefix sibling
enc 4x projects/internal     HTTP 404 fetches=[]      # sibling section, same source
DIRECT own index.html        HTTP 200 fetches=["phd/phd-milestones/committee-dossier/_doc/index.html"]
DIRECT in-prefix _payload    HTTP 404 fetches=["phd/phd-milestones/committee-dossier/_doc/_payload/hidden.html"]
DIRECT sibling milestones/_doc HTTP 404 fetches=["phd/phd-milestones/committee-dossier/_doc/milestones/_doc/index.html"]
```

Every path that could leave the item is refused by the segment allowlist **before** the store; the
only non-empty fetch traces are the direct in-prefix miss, which is *inside* `_doc/` by
construction (`name.startswith(prefix + "/")`, `serve.py:77-102`). Corroborated by
`gate/tests/test_shares.py:548-603`, which assert `store.fetches == []`.

### 2 — `entry` battery (`round2-att2.txt`)

```
mint entry="/etc/passwd"                                  HTTP 400
mint entry="../secrets"                                   HTTP 400
mint entry="%2e%2e%2fsecrets"                             HTTP 400
mint entry=""                                             HTTP 400
mint entry="a/b/../c"                                     HTTP 400
mint entry="index.html/../../milestones/_doc/index.html"  HTTP 400
mint entry="."/".."/"a//b"/"a\b"/"/index.html"            HTTP 400 (each)
mint entry="site/index.html"                              HTTP 200   # legal multi-seg (ruling 7)
mint entry=".hidden" / "anthropic-fellow.pdf"             HTTP 200
corrupt stored entry="../../../secrets"  root   HTTP 404 fetches=[]
corrupt stored entry + subpath                 HTTP 404 fetches=["…/_doc/anything"]
token root (entry=index.html)                  HTTP 200 fetches=["…/_doc/index.html"]
```

The mint route validates with `safe_prefix`; the serve route re-validates the stored value with
`safe_object_path(path, prefix)` where `prefix` ends `_doc`, so even a corrupt row cannot name an
object outside `_doc/`.

### 3 — prefix confusion (`round2-att3.txt`)

```
mint section .. / section a/_doc / source a/b / slug ../milestones / slug /etc   HTTP 400
mint section _doc / slug _doc / slug foo/_doc / slug foo_doc / source …_doc      HTTP 200  # gate allows
EVILDOCTOKEN (slug evil_doc):  /  → 404 (…/evil_doc/_doc/index.html miss)
                               /%2e%2e/index.html → 404 fetches=[]
                               /_doc/index.html → 404 (…/evil_doc/_doc/_doc/index.html miss)
ACTIVE in-prefix committee-dossier_doc-evil/_doc/index.html → 404 (fetched in-prefix, miss)
```

The gate's `_share_item_prefix` has no `_`-reservation, but a slug can only nest its tree deeper
(`…/<slug>/_doc`), never reach a sibling's `_doc`, without a `_doc` segment *inside the slug* —
which the build patterns forbid (dismissed observation B).

### 4 — content type (`round2-att4.txt`)

```
pdf at token root    HTTP 200 content-type: application/pdf   nosniff
pdf by name          HTTP 200 content-type: application/pdf   nosniff
html entry root      HTTP 200 content-type: text/html; charset=utf-8
css                  HTTP 200 content-type: text/css; charset=utf-8
pdf/index.html       HTTP 404
```

### 5 — authz / lifetime / caching (`round2-att5a.txt`, `round2-cache.txt`)

```
mint:   owner 200 | non-owner 403 | anonymous 403 | owner+evil 403 | no-Origin 403
        | Origin:null 403 | userinfo 403 | suffix-domain 403
list:   owner 200 | non-owner 403 | anonymous 403
revoke: owner 200 | non-owner 403 | anonymous 403 | owner+evil 403
unknown/expired/revoked/corrupt/traversal/missing  404  329 B  sha=0ddd881d3b0e7076  (identical)
cache:  GET /s served|unknown|traversal|missing|corrupt, GET/POST/PUT/OPTIONS/DELETE /share,
        HEAD /s, GET /s no-token  → all `private, no-store`; `public|s-maxage` count = 0
tokens: TOKEN_BYTES=32 (256 bits), 200000/200000 distinct, len 43, no consecutive repeat
```

Extra spellings (all 404, zero fetch): `%2f` in token segment, token `%2e%2e`, double-encoded
`%252e`, `//etc/passwd`, `%2f%2f`, `;index.html`, trailing `.`, UTF-8 fullwidth dots, `%5c..`.
`PUT`/`OPTIONS` on `/s/**` → 405. No `Set-Cookie` and no `Access-Control-Allow-Origin` on `/s/**`.

### 6 — built `site/dist-private` (`round2-att6`)

```
$ find site/dist-private -path '*_doc*' -type f | sort
cv/cv/anthropic-fellow/_doc/anthropic-fellow.pdf
phd/phd-milestones/committee-dossier/_doc/{committee.html, assets/style.css}
phd/phd-milestones/milestones/_doc/{index.html, assets/style.css}
projects/phd-milestones/internal-notes/_doc/{internal.html, assets/style.css}
```

Fixture manifest: `milestones → site/index.html`, `committee-dossier → site/committee.html`,
`internal-notes → site/internal.html` (source `phd-milestones`; sections `phd`, `phd`, `projects`).
Each `_doc/` carries **its own basename document only**; no sibling's `.html`. `docStagingPlanFor`
tests assert the named-directory and prefix-root exclusions (`private-content.test.ts:206-292`).

---

## Considered and dismissed (not bypasses)

**A. Rewrite set / availability fix — present; live unverifiable.**
`firebase.json` now has the exact `/share` rewrite ahead of `/share/**`, plus `/s/**`. There is no
bare `/s` rewrite, which is correct: `/s/{token}/{path}` always carries a token, so `/s` alone has
no route in the gate either. The first round's fail-closed availability bypass (bare `POST/GET
/share` served by Hosting's static 404) is addressed **in config**, but binding cannot be confirmed
until a deployed revision — flag for SEAM-S7. One residual to check live: `trailingSlash: true`
can redirect a bare `/share` to `/share/`; if Hosting applies that to a `POST` the XHR mint could
still fail. Good news: the gate 404 and the rewrite both fail closed either way.

**B. `_doc` reservation is exact-match only — latent, unreachable.**
`docStagingPlanFor` skips an item only when `source === "_doc"` or `slug === "_doc"`
(`frame-content.mjs:258`). A slug of `foo/_doc` would stage `…/foo/_doc/_doc/<entry>` — nested
*inside* item `foo`'s `_doc/` tree — and a `foo` token could read it. Demonstrated directly against
the function:

```
plan for [slug "foo", slug "foo/_doc"] → s/src/foo/_doc/a.html  (foo owns)
                                          s/src/foo/_doc/_doc/b.html  (foo/_doc doc, INSIDE foo's tree)
```

The same is true at the gate, which does not constrain the slug charset. **No real build can reach
it:** satellite manifests validate `slug` against `^[a-z0-9]+(?:-[a-z0-9]+)*$`
(`content.config.ts:66`) and the allowlist validates hub slugs against
`^[a-z0-9]+(?:-[a-z0-9]+)*(\/…)*$` (`hub-content.mjs:356-358`) — both reject `_` outright, so
neither `_doc` nor `foo/_doc` is expressible. Recorded as defence-in-depth, not a bypass; a
segment-aware reservation in `docStagingPlanFor` would close it if the slug charset ever loosens.

## What I examined and dismissed (routine)

- **Direct in-prefix miss vs. leak:** `/s/T/_payload/hidden.html` and `/s/T/milestones/_doc/…` do
  fetch, but the fetched name is `…/_doc/_payload/…` / `…/_doc/milestones/_doc/…` — inside the
  token's own tree. No sibling bytes, no frame bytes.
- **Corrupt stored row:** `section="a/b"`, `entry="../../../secrets"` both 404; the prefix builder
  rejects the section and the serve path re-validates the entry.
- **`entry` whitespace/`%`:** `" index.html"`, `"index.html "`, `"..%2f"` all 400 (`_SEGMENT`
  allowlist); the client `isSafeEntry` trims but the gate is the authority.
- **Multi-segment `entry`:** allowed by design (ruling 7, `test_shares.py:179-186`); containment is
  on the prefix regardless, so `site/index.html` still lands under `_doc/`.
- **`Origin` tricks:** userinfo, suffix domain, `null`, downgrade, no-Origin all 403; host case is
  insensitive (same origin, not a bypass).
- **`/s/**` cross-origin read:** no ACAO and `SameSite=Lax` withholds the cookie; not a CSRF hole.
- **Logging (D5):** mint logs `id=<12-char> by=<email>` only; with `GATE_LOG_OBJECT_PATHS` off the
  serve allow/miss lines carry no object name (`main.py:562-566,663-666`); traversal logs reason
  only. Captured against the gate's own handler.
- **`Vary: Cookie`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`,
  `X-Frame-Options: DENY`** present on every response.

## Related docs

- `llm/sprints/2026-09-hub/handoffs/red-team-wave-3.md` (round 1)
- `llm/sprints/2026-09-hub/contracts/phase-4-seams.md` (SEAM-S1..S8, 2026-10-03 amendments)
- `llm/governance/adr/0017-shares-serve-the-item-document.md`
- `gate/app/{main,serve,shares}.py`, `gate/tests/test_shares.py`
- `site/src/lib/frame-content.mjs`, `site/src/content.config.ts`, `site/scripts/private-build.mjs`
