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

function writeSource(source, items) {
  const dir = path.join(sourcesDir, source, "site");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(sourcesDir, source, "manifest.json"),
    `${JSON.stringify(
      {
        source,
        manifest_version: "1",
        published: "2026-10-20T00:00:00.000Z",
        items,
      },
      null,
      2,
    )}\n`,
  );
  for (const item of items) {
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
]);

fs.writeFileSync(
  path.join(outDir, "policy.json"),
  `${JSON.stringify(
    {
      version: 1,
      default: { groups: ["committee", "project-team"], roles: [] },
      sections: {},
      sources: { "visual-study": { groups: ["project-team"], roles: [] } },
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
        expectSources: ["phd-milestones", "visual-other", "visual-study"],
      },
      {
        id: "committee",
        label: "Committee-only member",
        role: "member",
        groups: ["committee"],
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
      { id: "signedout", label: "Signed out", signedOut: true },
    ],
    null,
    2,
  )}\n`,
);
console.log(`D25 visual fixtures written to ${sourcesDir} and ${outDir}`);
