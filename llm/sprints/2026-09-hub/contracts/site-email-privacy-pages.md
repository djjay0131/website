# Contract: Site Implementation Engineer — Email and Privacy pages

Status: Active
Last updated: 2026-09-15
Owner: Chief Architect (Lead Architect)

Instance of the Universal Bounded-Contract Skeleton (agentic-governance
`llm/governance/patterns/prompt-patterns.md`, Pattern 2 Implementation). Issue #13.
Workflow mode: Mode 1 (single agent). Governance level: L3 (a public privacy policy).

```text
ROLE: You are the Site Implementation Engineer for issue #13 in djjay0131/website, branch
  feat/email-privacy-pages.

OBJECTIVE: Two public static pages exist on the hub — https://jason.cusati.us/email/ and
  https://jason.cusati.us/privacy/ — carrying exactly the owner's wording below and nothing
  else.

REQUIRED READING:
  1. Issue #13 and its comments (`gh issue view 13 --comments`): the owner requires the wording
     used as supplied, no additions, and no "OpenClaw" name.
  2. site/src/layouts/ (Base, SectionIndex, ItemPage) and an existing simple page, for structure.
  3. llm/sprints/2026-09-hub/contracts/phase-1-seams.md (SEAM-1, SEAM-6, SEAM-7).

FILE CONTRACT:
  - You may create/edit ONLY:
      site/src/pages/email/index.astro
      site/src/pages/privacy/index.astro
      site/redirects/github-pages.json   (regenerate only, with the existing generator)
      llm/sprints/2026-09-hub/handoffs/site-email-privacy-pages.md
  - Do not modify anything else — layouts, navigation, tokens, tests, scripts, firebase.json,
    build.yml, llm/** apart from your handoff. Report defects elsewhere; never fix them.

DELIVERABLES:
  D1 site/src/pages/email/index.astro — rendered inside the existing Base layout.
     Page title: "Email". Heading: "Email". Body, exactly this one paragraph:

       A personal email-triage assistant run by Jason Cusati for his own Google accounts, not offered to the public.

     Below it, one link to /privacy/ (through the configured base) whose text is exactly
     "Privacy". Nothing else: no date, no intro, no extra sentence, no image.

  D2 site/src/pages/privacy/index.astro — rendered inside the existing Base layout.
     Page title: "Privacy". Heading: "Privacy". Body, exactly these six statements, in this
     order, each its own paragraph or list item:

       The app accesses Gmail, Google Tasks, Calendar, and Contacts data only for the account owner's own mailboxes.
       Data is processed on a machine the owner controls and is not shared with, sold to, or stored by any third party.
       The only external service that sees message content is Anthropic's API for classification, under Anthropic's API terms (which don't train on API data).
       Access can be revoked at any time at myaccount.google.com/permissions.
       Contact: djjay0131@gmail.com
       Use of information received from Google APIs adheres to the Google API Services User Data Policy, including Limited Use requirements.

     "myaccount.google.com/permissions" may be a link to https://myaccount.google.com/permissions
     and "djjay0131@gmail.com" a mailto link — the visible text stays exactly as written. No
     other text: no "Last updated", no intro, no extra headings, no qualifiers.

  D3 Neither page is added to the site navigation. Do not add noindex or change the sitemap
     rules; the pages are ordinary public pages.

  D4 Regenerate site/redirects/github-pages.json with the existing generator so the redirect-map
     check still covers every route, then run its --check.

  D5 Handoff: Summary · Assumptions · Recommendations · Alternatives considered · Risks · Open
     questions · Related docs · ADR candidates, plus the validation results.

VALIDATION (from site/, report verbatim):
  - npm test
  - npm run build (defaults); then confirm each exact sentence above appears in
    dist-public/email/index.html and dist-public/privacy/index.html (grep -F each line), and that
    neither file contains "OpenClaw" (any case).
  - SITE_URL=https://djjay0131.github.io SITE_BASE=/website/ npm run build; the /privacy/ link on
    the email page resolves under the base.
  - node scripts/generate-redirect-map.mjs --check (or the npm script the site defines)
  - npm run check:smoke-routes (a local miss on /pdfs/academic.pdf only is the known local gap)
  - npx astro check: no new errors beyond the 11 baseline errors
  - end on a default build

DEFINITION OF DONE: canon definition-of-done §Implementation Work; the owner reviews the wording
  on the PR before merge.

CONSTRAINTS: Use the owner's wording exactly — capitalisation and final punctuation as written
  above are already applied; change nothing else. If anything about the wording seems wrong,
  report it in the handoff; never alter it.

GIT: no git or gh mutations; read-only is fine. The Lead Architect commits.

FINAL REPORT: files changed; each validation result verbatim; the exact rendered text of both
  pages as extracted from the built HTML.
```
