// Synthetic content and principals for the D25 visual check.
//
// No real source, item, group or member appears here: the repository is public.
// The shapes mirror the real private tree (two projects, one restricted to a
// project group) so the screenshots exercise the same code path.
import fs from "node:fs";
import path from "node:path";

const sourcesDir = path.resolve("src/content/sources");
const outDir = path.resolve(process.argv[2] ?? "/tmp/d25-visual");
fs.mkdirSync(outDir, { recursive: true });

function writeSource(source, items, deadlines = []) {
  const dir = path.join(sourcesDir, source, "site");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(sourcesDir, source, "manifest.json"),
    `${JSON.stringify(
      {
        source,
        ...(deadlines.length ? { manifest_version: "2", deadlines } : { manifest_version: "1" }),
        published: "2026-10-20T00:00:00.000Z",
        items,
      },
      null,
      2,
    )}\n`,
  );
  for (const item of items) {
    if (item.format === "pdf") {
      fs.copyFileSync(
        path.resolve("fixtures/content/sources/cv/one-page.pdf"),
        path.join(sourcesDir, source, item.path),
      );
      continue;
    }
    fs.writeFileSync(
      path.join(sourcesDir, source, item.path),
      `<!doctype html><html><head><style>:root{--fixture:red} body{font-family:serif}.bad{position:fixed;z-index:9999}</style></head><body>
<nav class="pages"><a href="other.html">Other</a></nav>
<h1>${item.title}</h1>
<p>This page is rendered inline inside the normal site layout.</p>
<script>window.__d25_injected = true;</script>
<iframe src="https://example.invalid/"></iframe>
<img src="missing.png" onerror="window.__d25_injected = true">
<footer>satellite footer</footer>
</body></html>\n`,
    );
  }
}

writeSource("visual-study", [
  {
    slug: "overview",
    title: "Visual Study: overview",
    section: "research",
    format: "html",
    path: "site/overview.html",
    visibility: "private",
    date: "2026-10-20",
    summary: "Overview page for the visual fixture.",
  },
  {
    slug: "design",
    title: "Visual Study: design",
    section: "research",
    format: "html",
    path: "site/design.html",
    visibility: "private",
    date: "2026-10-19",
    summary: "Design page for the visual fixture.",
  },
  {
    slug: "submission-paper",
    title: "Visual Study: submission paper",
    section: "research",
    format: "pdf",
    path: "site/paper.pdf",
    visibility: "private",
    date: "2026-10-23",
    summary: "A private PDF rendered with the inline viewer.",
  },
], [
  {
    id: "paper-submission",
    title: "Visual Study paper submission",
    kind: "submission",
    start: "2026-10-23",
    all_day: true,
    timezone: "AoE",
    conference: "VisualConf 2027",
  },
  {
    id: "review-meeting",
    title: "Visual Study review",
    kind: "work",
    start: "2026-11-05T15:00:00Z",
    timezone: "UTC",
  },
]);
writeSource("ebay-erupt", [
  {
    slug: "erupt-proposal",
    title: "eBay eRUPT proposal",
    section: "projects",
    format: "html",
    path: "site/index.html",
    visibility: "private",
    date: "2026-10-21",
    summary: "The pulled eBay proposal, visible only to the eBay group.",
  },
], [
  {
    id: "erupt-revision",
    title: "eBay eRUPT revision round",
    kind: "work",
    start: "2026-10-24",
    all_day: true,
    timezone: "UTC",
  },
]);
writeSource("visual-saner", [
  {
    slug: "overview",
    title: "Visual Saner: overview",
    section: "research",
    format: "html",
    path: "site/overview.html",
    visibility: "private",
    date: "2026-10-17",
    summary: "A project restricted to the SANER group.",
  },
], [
  {
    id: "saner-study",
    title: "Visual SANER study milestone",
    kind: "milestone",
    start: "2026-10-28",
    all_day: true,
    timezone: "UTC",
  },
]);
writeSource("visual-other", [
  {
    slug: "notes",
    title: "Visual Other: notes",
    section: "projects",
    format: "html",
    path: "site/notes.html",
    visibility: "private",
    date: "2026-10-18",
    summary: "A second project, open to the committee group.",
  },
], [
  {
    id: "abstract",
    title: "Visual Other abstract",
    kind: "abstract",
    start: "2026-10-30",
    all_day: true,
    timezone: "UTC",
    conference: "OtherConf",
  },
]);

fs.writeFileSync(
  path.join(outDir, "policy.json"),
  `${JSON.stringify(
    {
      version: 1,
      default: { groups: ["committee", "project-team"], roles: [] },
      sections: {},
      sources: {
        "visual-study": { groups: ["project-team"], roles: [] },
        "ebay-erupt": { groups: ["ebay-erupt"], roles: [] },
        "visual-saner": { groups: ["saner2027-team"], roles: [] },
      },
      items: {},
    },
    null,
    2,
  )}\n`,
);
fs.writeFileSync(
  path.join(outDir, "principals.json"),
  `${JSON.stringify(
    [
      {
        id: "owner",
        label: "Owner",
        role: "owner",
        groups: [],
        expectSource: "visual-study",
        expectSources: ["phd-milestones", "visual-other", "visual-study", "ebay-erupt", "visual-saner"],
      },
      {
        id: "committee",
        label: "Committee-only member",
        role: "member",
        groups: ["committee"],
        expectSource: "visual-other",
        expectSources: ["phd-milestones", "visual-other"],
        forbidSource: "visual-study",
      },
      {
        id: "project-team",
        label: "Project-team member",
        role: "member",
        groups: ["project-team"],
        expectSource: "visual-study",
        expectSources: ["phd-milestones", "visual-other", "visual-study"],
      },
      {
        id: "ebay-member",
        label: "eBay eRUPT member",
        role: "member",
        groups: ["ebay-erupt"],
        expectSources: ["ebay-erupt"],
        forbidSource: "visual-saner",
      },
      {
        id: "saner-only",
        label: "SANER-only member",
        role: "member",
        groups: ["saner2027-team"],
        expectSources: ["visual-saner"],
        forbidSource: "ebay-erupt",
      },
      { id: "signedout", label: "Signed out", signedOut: true },
    ],
    null,
    2,
  )}\n`,
);
console.log(`D25 visual fixtures written to ${sourcesDir} and ${outDir}`);
