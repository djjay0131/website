# Handoff: Site Implementation Engineer — Email and Privacy pages

Status: Complete (awaiting Lead Architect commit and owner wording review on the PR)
Last updated: 2026-09-15
Owner: Site Implementation Engineer
Contract: `llm/sprints/2026-09-hub/contracts/site-email-privacy-pages.md` (commit `9fbc662`)
Issue: #13 · Branch: `feat/email-privacy-pages` · Governance level: L3 · No git or gh mutations were run.

## Summary

Two public static pages now build on the hub. Both render inside the existing
`Base` layout and carry the owner's wording from the contract exactly.

- **D1 `site/src/pages/email/index.astro`** → `/email/`. The document `<title>`
  is `Email` and the `h1` is `Email`. The body is the one contract paragraph,
  then one paragraph holding a single link whose text is `Privacy`. The link's
  `href` is `${import.meta.env.BASE_URL}privacy/`: `/privacy/` in the default
  build and `/website/privacy/` in the Pages build.
- **D2 `site/src/pages/privacy/index.astro`** → `/privacy/`. The `<title>` is
  `Privacy` and the `h1` is `Privacy`. The body is the six contract statements,
  in order, each its own `<p>`, as plain text with no links.
- **D3.** Neither page is in the navigation, and there is no `noindex`. Both
  appear in the sitemap as ordinary pages (`https://jason.cusati.us/email/`,
  `https://jason.cusati.us/privacy/`). No layout, navigation or sitemap rule
  changed.
- **D4.** `site/redirects/github-pages.json` was regenerated with
  `node scripts/generate-redirect-map.mjs`: 48 → 50 entries. The only additions
  are `/website/email/` → `/email/` and `/website/privacy/` → `/privacy/`. The
  `--check` passes.
- **Nothing else changed.** The page chrome comes from `Base` unchanged: the
  site header and navigation, the footer (`© <year> Jason Cusati`), the skip
  link, and Base's default meta description and social tags.

Rendered text of each page's `<main>`, extracted from the final default build:

```text
/email/    <title>Email</title>
Email
A personal email-triage assistant run by Jason Cusati for his own Google accounts, not offered to the public.
Privacy

/privacy/  <title>Privacy</title>
Privacy
The app accesses Gmail, Google Tasks, Calendar, and Contacts data only for the account owner's own mailboxes.
Data is processed on a machine the owner controls and is not shared with, sold to, or stored by any third party.
The only external service that sees message content is Anthropic's API for classification, under Anthropic's API terms (which don't train on API data).
Access can be revoked at any time at myaccount.google.com/permissions.
Contact: djjay0131@gmail.com
Use of information received from Google APIs adheres to the Google API Services User Data Policy, including Limited Use requirements.
```

## Validation

All commands were run from `site/` with the owner's local CV data, in this order.

| # | Command | Result |
|---|---|---|
| E0 | `node scripts/generate-redirect-map.mjs` | `wrote 50 entries to redirects/github-pages.json`, exit 0. `git diff`: `+` `/website/email/` → `/email/` and `/website/privacy/` → `/privacy/` only (8 insertions, 0 deletions). |
| E1 | `npm test` | `Test Files 7 passed (7)` · `Tests 54 passed \| 1 skipped (55)`, exit 0 |
| E2 | `npm run build` (defaults) | `35 page(s) built`, `Complete!`, exit 0 (33 before, plus the 2 new pages) |
| E3 | `grep -F` of the Email paragraph in `dist-public/email/index.html`; `grep -F '>Privacy</a>'` | both exit 0 |
| E4 | `grep -F` of each of the six Privacy statements in `dist-public/privacy/index.html` | all six exit 0 |
| E5 | `grep -ic "<excluded name>"` on both built pages (a case-insensitive search for the name issue #13 withdraws; spelled out in the command, not in this record) | `dist-public/email/index.html:0`, `dist-public/privacy/index.html:0`. The page sources also have 0. See Risks for 2 pre-existing, unrelated hits elsewhere in the build. |
| E6 | `name="robots"` in both pages; `/email/` or `/privacy/` links on `/`; sitemap; the Email page's link | `0`, `0`; `0`; both URLs listed in `sitemap-0.xml`; `href="/privacy/"` |
| E7 | `<title>` and `<main>` text of both pages | as in the Summary block |
| E8 | `SITE_URL=https://djjay0131.github.io SITE_BASE=/website/ npm run build` | `35 page(s) built`, `Complete!`, exit 0 |
| E9 | The Email page's Privacy link in the Pages build | `href="/website/privacy/"`, and `dist-public/privacy/index.html` exists, so the link resolves under the base |
| E10 | `node scripts/generate-redirect-map.mjs --check` | `inventory: 50 routes; committed map: 50 entries` · `every inventoried route is covered`, exit 0 |
| E11 | `npm run check:smoke-routes` (after E8) | 6 `OK`; `MISSING /pdfs/academic.pdf → pdfs/academic.pdf`; `check:smoke-routes: 1 of 7 smoke routes missing from dist-public: /pdfs/academic.pdf`, exit 1. This is the known local gap: no fetched PDFs. |
| E12 | `npx astro check` | `Result (46 files): 11 errors, 0 warnings, 3 hints` (exit 1). All 11 are the baseline `ts(7006)` errors in `SourceExplorer.astro`, with 0 errors elsewhere. There are 46 files because of the two new pages. |
| E13 | `npm run build` (final, defaults) | `35 page(s) built`, `Complete!`, exit 0; `/website/` matches: `0`; the Email page's link is `href="/privacy/"`. **`site/dist-public` is the default build.** |

## Assumptions

- "Page title" means the document `<title>` exactly as given, so there is no
  `Jason Cusati —` prefix. The other pages use one, but the contract gives the
  title as `Email` and `Privacy`.
- "Rendered inside the existing Base layout" includes Base's chrome: header,
  navigation, footer, skip link and head metadata. "Nothing else" governs the
  page body. So the pages keep Base's default meta description ("Jason Cusati —
  Software Engineer, Researcher") and og image; writing a page-specific
  description would have added wording.
- The Privacy link sits in its own `<p>`, below the paragraph. It is not part
  of the paragraph's sentence.
- The six statements render as paragraphs rather than list items. The contract
  allows either, and paragraphs add no bullets or list semantics.

## Recommendations

1. **Owner wording review on the PR** (per the contract's Definition of Done),
   with the points under Open questions in hand.
2. **Match the OAuth consent screen to the homepage.** Google compares the
   consent screen's app name with the homepage (issue #13, final decision). The
   Email page's heading and title are "Email", and the Privacy page calls it
   "The app", so the consent screen's app name should correspond.
3. **Verify the two policy statements before submitting the OAuth app.** Issue
   #13 lists this as still to do: the Limited Use sentence, and Anthropic's
   no-training terms, against the current published policies.

## Alternatives considered

- **`SectionIndex` layout.** Rejected: it renders an empty-state box ("Nothing
  here yet") when it has no items, and prefixes the document title with
  "Jason Cusati —". Both are extra text.
- **`ItemPage` layout.** Rejected: it adds a back link and title suffix.
- **Linking `myaccount.google.com/permissions` and `mailto:` the address.** The
  contract allows it with unchanged visible text. Not done, for two reasons:
  - An inline `<a>` splits each sentence in the HTML, so the contract's
    `grep -F` of each exact line would no longer find it.
  - Plain text is the most literal reading of "use the wording as given".

  Adding the two links later is a two-line change. The visible text would stay
  identical, but the validation would then need a text-extraction check instead
  of `grep -F`.
- **A `<ul>` for the six statements.** It is equivalent under the contract;
  paragraphs were chosen (see Assumptions).

## Risks

- **Pre-existing mentions of the excluded name elsewhere in the build.** The
  owner's rule bans the app name in issue #13 (the name the owner withdrew)
  "anywhere". A case-insensitive search of all of `dist-public` finds it in
  2 files:
  - `research/soa-agentic-se/agentic-harnesses/sources/index.html`
  - `research/soa-agentic-se/agentic-memory/sources/index.html`

  Both come from `site/src/data/soa-agentic-se/*/sources.json`, which predates
  this work (carried over in the `site/` move, `5d37f82`). There it names a
  third-party open-source agent harness in the research literature review,
  alongside Claude Code, Hermes and OpenHands, not the owner's email assistant.
  Both new pages and their sources contain 0 hits. Those data files are outside
  this contract, so they were not changed. If the rule is meant to cover the
  whole site, including third-party names in research data, that is the owner's
  call.
- **Wording taken literally by a Google reviewer.** See Open questions. The
  text is the owner's, used as given.
- **Base's generic meta description** appears in search snippets and link
  previews for both pages.

## Open questions

Wording points reported, not changed (the contract forbids altering the text):

1. **"not shared with, sold to, or stored by any third party"** is followed by a
   statement that Anthropic's API sees message content. A reader may take
   sending content to Anthropic as sharing with a third party. Also, Anthropic
   may retain API inputs and outputs briefly under its retention policy, so
   "stored by" may be inaccurate. Issue #13 records that the owner chose this
   wording knowingly; it is noted again here because this is an L3 privacy
   policy.
2. **"under Anthropic's API terms (which don't train on API data)"**: strictly,
   Anthropic does not train on API data, not the terms themselves. The meaning
   is clear, but the subject is slightly off.
3. **"including Limited Use requirements"**: Google's published policy wording is
   "including the Limited Use requirements". The owner's phrasing omits "the".
   Google may compare the sentence closely.
4. **Only the Google API Services User Data Policy sentence is present.** The
   Workspace-scope sentence ("…Google Workspace scopes will adhere to the Google
   User Data Policy…") was withdrawn by the owner (issue #13), although Gmail,
   Tasks, Calendar and Contacts are Workspace scopes. Google's verification may
   ask for it.
5. **"The app" is never named** on either page, and the homepage is titled
   "Email". That may matter when Google compares the consent screen's app name
   with the homepage (Recommendation 2).
6. **"for the account owner's own mailboxes"** covers Tasks, Calendar and
   Contacts data too, which are not mailboxes. The meaning (the owner's own
   accounts) is clear.

## Related docs

- `llm/sprints/2026-09-hub/contracts/site-email-privacy-pages.md`
- Issue #13 and its comments (owner decisions, 2026-09-15)
- `llm/sprints/2026-09-hub/contracts/phase-1-seams.md` (SEAM-1, SEAM-6, SEAM-7)
- `llm/governance/adr/0006-hub-on-jason-cusati-us-subdomain.md` (canonical host)
- `site/README.md` (build interface, redirect map)

## ADR candidates

- None required. If the owner later wants per-page meta descriptions or a
  stricter "no chrome text" rule for policy pages, that would be a small layout
  decision (a `Base` prop), not an ADR.

## Files changed

Added:

- `site/src/pages/email/index.astro`
- `site/src/pages/privacy/index.astro`
- `llm/sprints/2026-09-hub/handoffs/site-email-privacy-pages.md`

Modified (regenerated):

- `site/redirects/github-pages.json` (+2 entries)

Untouched: layouts, navigation, tokens, tests, scripts, `firebase.json`,
`build.yml`, `site/data/`, and `llm/**` apart from this handoff.
