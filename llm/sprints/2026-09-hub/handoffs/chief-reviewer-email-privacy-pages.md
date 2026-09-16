# Chief Reviewer: Email and Privacy pages — PR #15 (issue #13)

**Reviewed:** `origin/main...ee58be4` on `feat/email-privacy-pages` (11 files, +406/−49). Contract of record: `llm/sprints/2026-09-hub/contracts/chief-reviewer-email-privacy-pages.md`. I authored none of this work. The working tree was clean at `ee58be4` before and after the review; head unchanged; no file was created or edited and no git/gh mutation was made.

**Launch condition: verified met.** Check runs on `ee58be4a0b4ba5716e2e8734e41351e909af91fd`: `governance-checks`, `budget-guard`, `check`, `build`, `build-firebase`, `deploy-tools` all `success`; deploy/smoke/notify jobs `skipped`, as expected on a PR.

---

## Part A — Wording fidelity

**Result: exact match. No difference of any kind.**

I built the site with defaults and extracted the rendered `<main>` of each page from `dist-public`, then compared each block element against the text in `llm/sprints/2026-09-hub/contracts/site-email-privacy-pages.md` by Python string equality (not `grep`), with codepoint dumps ready for any mismatch.

| Page | `<title>` | Blocks in `<main>` | Result |
|---|---|---|---|
| `/email/` | `Email` | `<h1>Email`, the one contract paragraph, `<p><a>Privacy</a>` | 3/3 MATCH, 0 extra blocks, **0 characters of residual text** outside those blocks |
| `/privacy/` | `Privacy` | `<h1>Privacy` + the six contract statements as `<p>`, in contract order | 7/7 MATCH, 0 extra blocks, **0 residual text** |

- No date, no "Last updated", no intro, no extra heading, no qualifier, no image.
- Link text is exactly `Privacy`; `href="/privacy/"` in the default build.
- Apostrophes are U+0027 in both contract and rendered output — no smart-quote substitution.
- **"OpenClaw" (any case): 0 hits** in `dist-public/email/index.html`, `dist-public/privacy/index.html`, and both `.astro` sources. Case-insensitive search of the whole build finds it only in two pre-existing research pages (`research/soa-agentic-se/agentic-{harnesses,memory}/sources/index.html`), which this PR does not touch — confirmed from `git diff --name-status`.

**Finding A1 (should-fix, needs the owner's word — not a wording proposal).** The pages match the *contract* character for character, but the contract's own constraint is "capitalisation and final punctuation as written above are already applied; change nothing else." Two phrases in the contract go beyond that when compared with the only recorded statements of the owner's words:

| Recorded source | Contract / page | Difference |
|---|---|---|
| Issue #13 body: "Gmail, Google Tasks, Calendar and Contacts" | "Gmail, Google Tasks, Calendar, and Contacts" | serial comma added (internal punctuation) |
| Issue #13 body: "(no training on API data)" | "(which don't train on API data)" | rephrased; not quoted in any owner comment |

The other four statements and the email paragraph are traceable: the "not shared with, sold to, or stored by any third party" phrase is quoted verbatim in issue #13's Decisions block, and the Limited Use sentence is quoted verbatim in the owner's final decision comment (2026-09-15T21:06Z), matching the page to the character.

The root cause is that the owner's supplied wording was given in session and is recorded only as "owner's words, **condensed**" (issue #13 body). Canon `architecture-governance.md` §No Orphan Decisions applies: the source text of an L3 privacy policy currently has no verbatim artifact. The PR body's claim "Wording is the owner's, used as supplied… Only capitalisation and final punctuation were applied" is therefore stronger than the evidence supports for those two phrases. The existing DoD item "Owner reviews the policy wording before merge" resolves this if the owner confirms those two specifically; I recommend recording the confirmation (or the verbatim original) on issue #13 so a future reader can trace it. **I propose no change to the wording itself.**

---

## Part B — Scope and behaviour

**Changed paths (11).** Nine are allowed: the two page sources, the regenerated redirect map, the site handoff (implementation contract's file list), plus `STATE.md`, both memory-bank files, and the two new contract files (the Lead Architect's records).

**Finding B1 (should-fix, non-blocking).** Two paths fall outside both the implementation contract's allowlist and this review contract's Part B allowance: `llm/governance/governance-delta.md` and `llm/master-roadmap.md`. Both carry unrelated Phase 1 bookkeeping — the `budget-guard` required-context note and the fingerprint roadmap tick — on an L3 pages PR. Canon `governance-levels.md` §Mixed-Level Changes: "Authors should split administrative housekeeping out of semantic PRs." Both edits are factually correct, verified independently:
- `GET /repos/…/branches/main/protection` → required contexts `["governance-checks","budget-guard"]`, `strict:false`, approvals `0`, `enforce_admins:false`. The delta's sentence is accurate.
- Scheduled run `35032163362` (event `schedule`, head `6dad273`, success) logs `reading deployed build info from https://jason.cusati.us/build-info.json`, identical release and deployed fingerprints, and `::notice::cv release unchanged since the deployed build; skipping build and deploy.` The roadmap tick is earned. Phase 1 now has no unchecked criteria; the only unchecked box before Phase 2 is Phase 0's "no agent merged it" (A11), correctly left for the owner.

**Finding B2 (should-fix — missing decision record).** The hub gains two top-level routes, `/email/` and `/privacy/`, for a project unrelated to the research hub. The delta's Mission says the hub is "not… a place where content is authored. Content is authored in satellites; the hub renders it." The handoff records "ADR candidates: None required." Two concrete consequences are undocumented: (a) whether the hub may carry hand-authored first-party pages for the owner's other projects, and (b) that the root namespace is now shared between site routes and Phase 2 satellite `section` values (ADR-0002 Decision 4 makes `section` a fixed set declared in the hub) — a future section named `email` would collide with a live OAuth homepage URL that Google has on file. One line in `STATE.md` §ADR candidates would close this; it does not need an ADR today.

**Everything else in Part B passes.** Evidence, run locally from `site/`:

| Check | Result |
|---|---|
| `npm test` | `Test Files 7 passed (7)` · `Tests 54 passed \| 1 skipped (55)` |
| `npm run build` (defaults) | `35 page(s) built`, `Complete!` |
| Pages build (`SITE_URL`/`SITE_BASE`) | `35 page(s) built`; email link resolves to `href="/website/privacy/"`; privacy page present |
| Final default build | `35 page(s) built`; email link back to `href="/privacy/"`; zero `/website/` references in the build |
| `generate-redirect-map.mjs --check` | `inventory: 50 routes; committed map: 50 entries` · `every inventoried route is covered`, exit 0 (main: 48 entries; the diff adds exactly `/website/email/` and `/website/privacy/`) |
| `npm run check:smoke-routes` | exit 1, sole miss `/pdfs/academic.pdf` — the known local gap; CI's `build` job is green on `ee58be4` |
| `npx astro check` | `46 files: 11 errors, 0 warnings, 3 hints`; all 11 are the baseline `ts(7006)` errors in `SourceExplorer.astro` — no new error |
| Governance checks (`--layout`, canon) | `4 of 4 checks passed, 0 failed` |
| Navigation | `dist-public/index.html` links to the new pages: **0**. The only page linking to either is the email page itself |
| noindex / sitemap | `name="robots"`: 0 in both pages; `robots.txt` unchanged (`Allow: /`); both URLs present in `sitemap-0.xml` — ordinary public pages, as D3 requires |

I did **not** regenerate the redirect map (that writes a tracked file); `--check` plus the two-entry diff is the evidence, and the generator's `--check` also reports entries with no route in the build (none reported).

---

## Part C — Records

The eight Checkpoint 2 decisions in `STATE.md` §Checkpoint 2 decisions — resolved map one-to-one onto the items removed from the old §Decisions for the owner at Checkpoint 2 block, plus the billing row explicitly marked "verified, not a decision". **No decision appears that the owner did not make**, and none was dropped. Phase 2 option A is recorded consistently in three places (STATE §Decisions on the record, STATE C1, `activeContext.md`), and Incident A1's closure is recorded with the owner's own words.

**Finding C1 (should-fix).** Recording option A leaves the merged roadmap self-contradictory. `llm/master-roadmap.md` Phase 2 still requires `repository_dispatch` in four places (deliverables at lines 197 and 200; criteria at 210 and 215, the last demanding "the credential satellites use for `repository_dispatch` is decided in an accepted ADR"), while the memory bank — rank 1 of the Design Authority Hierarchy — now says the hub polls and satellites hold no GitHub credential. Deferring the ADR to Phase 2 start is reasonable; leaving the roadmap silent is not, because the roadmap is what the Phase 2 contracts will be written from. Failure scenario: a Phase 2 implementation agent reads the roadmap, builds the dispatch path, and re-creates exactly the credential C1/K13 exists to prevent. One annotation on those criteria would close it.

**Finding C2 (should-fix).** `STATE.md` §Next now contradicts the same file. Item 3 still lists "Remaining Checkpoint 2 decisions… notably whether `budget-guard` becomes a required status check" — resolved and applied two sections below. Item 2 and the Lead Architect line still say "the OpenClaw Email wording" and "OpenClaw pages (#13) on their own branch", a name the owner rejected and work that is done. (The historical §Done entry at lines 134–135 keeping the original `/openclaw-email/` request is correct as history and should stay.)

**Finding C3 (note).** `progress.md` deletes the Incident A1 known-issue line outright. The owner closed the *action*, but `STATE.md` §Residual still records that the tarball remains retrievable through the commit. An accepted residual exposure is still a known issue; removing it from the memory bank loses it from the highest-authority artifact. One line ("accepted by the owner; residual exposure remains") preserves the record.

Otherwise the memory bank is accurate: `budget-guard` as a required check matches the API; the pages are described as in progress, not merged; nothing claims the owner approved the wording.

---

## Part D — Level and verdict

**L3 is correct.** Canon `governance-levels.md` §L3 names "privacy/consent policy" explicitly, and §Mixed-Level Changes classifies a mixed PR at its highest level (this one also carries L2 page code and L1 delta/roadmap edits). The `gov-L3` label is present and the PR template box is ticked. Merge authority is the owner alone (§Level-Aware Merge Authority) — no agent may merge this.

### Verdict: **Comment** — may proceed; nothing in the pages must change.

One pre-merge gate, already in issue #13's DoD, is genuinely outstanding: **the owner's wording review**, which should explicitly cover the two phrases in Finding A1. Also note that the PR says "Closes #13" while all four of issue #13's DoD boxes are unticked, including "Privacy-policy text verified against Google's and Anthropic's published policies" — which the handoff's Recommendation 3 confirms is still to do before the OAuth submission. Merging closes the issue with that item open unless the owner resolves it; and issue #13's *body* still describes the OpenClaw name and the `/openclaw-email/` URLs, superseded only by its comments.

Findings B1, B2, C1, C2, C3 are all non-blocking and can be actioned in the next bookkeeping PR.

---

## Notes for the owner — not findings, and not requests to change your wording

Your wording is fixed and I am not proposing edits. These are things worth knowing before the OAuth submission. Items 1–6 restate what the site engineer already flagged; 7–9 are mine.

1. "not shared with, sold to, or stored by any third party" sits next to the sentence saying Anthropic's API sees message content, and Anthropic may retain API data briefly. You chose this knowingly (recorded in issue #13 and STATE A17).
2. "(which don't train on API data)" reads as the *terms* not training rather than Anthropic — and that phrasing was introduced in the contract, not quoted from you (Finding A1).
3. Google's published sentence is "including **the** Limited Use requirements"; yours omits "the". Reviewers sometimes compare that sentence closely.
4. The Workspace-scope compliance sentence is absent at your instruction, though Gmail, Tasks, Calendar and Contacts are Workspace scopes.
5. The app is never named on either page, and Google compares the consent-screen app name against the homepage. The homepage's title and heading are "Email".
6. "mailboxes" also covers Tasks, Calendar and Contacts data.
7. `myaccount.google.com/permissions` and your email address render as plain text, not links. The contract permitted links with identical visible text; the engineer chose plain text deliberately. Adding them later changes nothing a reader sees.
8. Your personal address appears unlinked in the page body, so it is machine-harvestable; both pages are in the sitemap and `robots.txt` allows all crawlers. That is what "ordinary public pages" means here, and it is what Google's verification wants.
9. Both pages inherit Base's generic meta description ("Jason Cusati — Software Engineer, Researcher") and your photo as the OpenGraph image, so that is what appears in search snippets and link previews for your privacy policy. Changing it would mean adding wording, which is why it was left alone.
10. "OpenClaw" still appears on two pre-existing research pages, where it names a third-party agent harness in your literature review, not this app. Untouched by this PR; your call whether the rule reaches that far.

---

Paths in this report are repository-relative by design: the review contract forbids writing machine-specific paths into any artifact, and this report is persisted and posted to PR #15. The artifacts I reviewed are `llm/sprints/2026-09-hub/contracts/chief-reviewer-email-privacy-pages.md` (my contract), `llm/sprints/2026-09-hub/contracts/site-email-privacy-pages.md` (the authoritative text), `llm/sprints/2026-09-hub/handoffs/site-email-privacy-pages.md`, `llm/sprints/2026-09-hub/STATE.md`, `llm/memory_bank/activeContext.md`, `llm/memory_bank/progress.md`, `llm/governance/governance-delta.md`, `llm/master-roadmap.md`, `site/src/pages/email/index.astro`, `site/src/pages/privacy/index.astro` and `site/redirects/github-pages.json`.
