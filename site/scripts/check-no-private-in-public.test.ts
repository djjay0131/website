import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";
import {
  ANNOTATION_ALLOWED_IN_PUBLIC,
  ANNOTATION_NEEDLES,
  collectDraftRabbitHoles,
  collectPrivateItems,
  containsAnnotationNeedle,
  containsBounded,
  findAnnotationLeaks,
  findLeaks,
  htmlEscape,
  needlesFor,
  weakNeedleWarnings,
} from "./check-no-private-in-public.mjs";

const SCRIPT = path.resolve("scripts/check-no-private-in-public.mjs");
const FIXTURE_SOURCES = path.resolve("fixtures/content/sources");

function tree(files: Record<string, string>) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "leak-"));
  for (const [rel, body] of Object.entries(files)) {
    const file = path.join(root, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, body);
  }
  return root;
}

const PRIVATE_ITEM = {
  source: "phd-milestones",
  slug: "milestones",
  section: "phd",
  path: "site/index.html",
  title: "Programme Milestone Tracker (fixture)",
  summary: "Invented fixture standing in for the private milestone tracker.",
};

describe("collectPrivateItems reads the committed fixture", () => {
  it("finds every EFFECTIVELY private item — manifest-private OR not allowlisted (D8)", () => {
    const items = collectPrivateItems(FIXTURE_SOURCES);
    expect(items.map((i) => `${i.source}/${i.slug}`).sort()).toEqual([
      // D8 / SEAM-B3 / SEAM-B6: cv/anthropic-fellow's manifest says PUBLIC, but
      // the committed allowlist deliberately omits it, so it is private. This is
      // the content-only leak (a variant defined inside the shared cv-data
      // payload) that the old manifest-only filter could not see.
      "cv/anthropic-fellow",
      // A PRIVATE `projects` item, planted so the public /projects/ index has a
      // private item in its own section to leave out.
      "phd-milestones/committee-dossier",
      "phd-milestones/internal-notes",
      "phd-milestones/milestones",
    ]);
    // The allowlisted cv items and kgis' one item stay public.
    const keys = items.map((i) => `${i.source}/${i.slug}`);
    expect(keys).not.toContain("cv/academic");
    expect(keys).not.toContain("cv/cv-data");
    expect(keys).not.toContain("kgis/kgis-docs");
  });

  it("returns nothing when no content has been synced", () => {
    expect(collectPrivateItems(path.join(os.tmpdir(), "absent-sources-xyz"))).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// THE REGRESSION THAT DECIDED THE MATCHING RULES
// ---------------------------------------------------------------------------
describe("a private slug in ordinary prose is NOT a leak", () => {
  // This exact sentence is in the CLEAN public build, at
  // /research/soa-agentic-se/agentic-memory/sources/. The private slug is
  // `milestones`. A naive substring search fails a correct build on it, and a
  // guard that cries wolf on a correct build is switched off within a week.
  const REAL_SENTENCE =
    '"3.3x more unique items, 2.3x longer distances, tech-tree milestones up to 15.3x faster than prior SOTA"';

  it("does not fire on the sentence that is really in the public build", () => {
    const dist = tree({ "research/index.html": `<p>${REAL_SENTENCE}</p>` });
    try {
      expect(findLeaks(dist, [PRIVATE_ITEM])).toEqual([]);
    } finally {
      fs.rmSync(dist, { recursive: true, force: true });
    }
  });

  it("containsBounded distinguishes prose from markup, URLs and quoted strings", () => {
    expect(containsBounded("tech-tree milestones up to 15.3x", "milestones")).toBe(false);
    expect(containsBounded("the milestones, and then", "milestones")).toBe(false);
    expect(containsBounded("many milestones.", "milestones")).toBe(false);

    expect(containsBounded('href="/phd/phd-milestones/milestones/"', "milestones")).toBe(true);
    expect(containsBounded('{"slug":"milestones"}', "milestones")).toBe(true);
    expect(containsBounded("<li>milestones</li>", "milestones")).toBe(true);
    expect(containsBounded('src="milestones.html"', "milestones")).toBe(true);
    expect(containsBounded("/milestones.html", "milestones")).toBe(true);
  });

  it("a filename mentioned in bare prose is NOT matched, and that is covered elsewhere", () => {
    // "see milestones.html" has a space on the left, so it reads as prose and is
    // deliberately not a content match. It is not a gap: if such a FILE exists in
    // the output, the path check catches it (a segment equal to the slug, or
    // starting "<slug>."), and that is asserted in the PATH tests below.
    expect(containsBounded("see milestones.html", "milestones")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// THE LEAKS IT MUST CATCH
// ---------------------------------------------------------------------------
describe("the leak check fails on a private item in the public output", () => {
  it("CONTENTS: a private title rendered into a public index page", () => {
    // The case a PATH-ONLY check cannot see. This is K11, and the reason
    // ADR-0005 overruled the orchestration brief's §4 formulation.
    const dist = tree({
      "index.html": `<ul><li><a href="/somewhere/">${PRIVATE_ITEM.title}</a></li></ul>`,
    });
    try {
      const leaks = findLeaks(dist, [PRIVATE_ITEM]);
      expect(leaks.length).toBeGreaterThan(0);
      expect(leaks.some((l) => l.where === "contents" && l.kind === "title")).toBe(true);
      // and it has NO matching path anywhere
      expect(leaks.some((l) => l.where === "path")).toBe(false);
    } finally {
      fs.rmSync(dist, { recursive: true, force: true });
    }
  });

  it("CONTENTS: a private route in a navigation menu", () => {
    const dist = tree({
      "index.html": '<nav><a href="/phd/phd-milestones/milestones/">Tracker</a></nav>',
    });
    try {
      const kinds = findLeaks(dist, [PRIVATE_ITEM]).map((l) => l.kind);
      expect(kinds).toContain("route");
    } finally {
      fs.rmSync(dist, { recursive: true, force: true });
    }
  });

  it("CONTENTS: a private slug in the sitemap", () => {
    const dist = tree({
      "sitemap-0.xml":
        "<urlset><url><loc>https://jason.cusati.us/phd/phd-milestones/milestones/</loc></url></urlset>",
    });
    try {
      expect(findLeaks(dist, [PRIVATE_ITEM]).length).toBeGreaterThan(0);
    } finally {
      fs.rmSync(dist, { recursive: true, force: true });
    }
  });

  it("CONTENTS: a private summary quoted into a public page", () => {
    const dist = tree({ "papers/index.html": `<p>${PRIVATE_ITEM.summary}</p>` });
    try {
      expect(findLeaks(dist, [PRIVATE_ITEM]).map((l) => l.kind)).toContain("summary");
    } finally {
      fs.rmSync(dist, { recursive: true, force: true });
    }
  });

  it("CONTENTS: an HTML-escaped private title still matches", () => {
    const item = { ...PRIVATE_ITEM, title: 'Jason & the "Committee" Dossier' };
    const dist = tree({ "index.html": `<h2>${htmlEscape(item.title)}</h2>` });
    try {
      expect(findLeaks(dist, [item]).map((l) => l.kind)).toContain("title-escaped");
    } finally {
      fs.rmSync(dist, { recursive: true, force: true });
    }
  });

  it("PATH: a page emitted at the private item's own route", () => {
    const dist = tree({ "phd/phd-milestones/milestones/index.html": "<p>hi</p>" });
    try {
      const leaks = findLeaks(dist, [PRIVATE_ITEM]);
      expect(leaks.some((l) => l.where === "path")).toBe(true);
    } finally {
      fs.rmSync(dist, { recursive: true, force: true });
    }
  });

  it("PATH: a private payload copied in under its own name", () => {
    const dist = tree({ "assets/milestones.html": "<p>hi</p>" });
    try {
      expect(findLeaks(dist, [PRIVATE_ITEM]).some((l) => l.where === "path")).toBe(true);
    } finally {
      fs.rmSync(dist, { recursive: true, force: true });
    }
  });

  it("passes a genuinely clean output", () => {
    const dist = tree({
      "index.html": "<h1>Jason Cusati</h1><p>Software engineer and researcher.</p>",
      "cv/academic/index.html": "<h1>Academic CV</h1>",
      "favicon.svg": "<svg></svg>",
    });
    try {
      expect(findLeaks(dist, [PRIVATE_ITEM])).toEqual([]);
    } finally {
      fs.rmSync(dist, { recursive: true, force: true });
    }
  });

  it("finds nothing when there are no private items at all", () => {
    const dist = tree({ "index.html": "<p>milestones everywhere</p>" });
    try {
      expect(findLeaks(dist, [])).toEqual([]);
    } finally {
      fs.rmSync(dist, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// WAVE 4 FP-2 — a source name that equals public first-party content
// ---------------------------------------------------------------------------
describe("Wave 4 FP-2: the `construction-ai` source key collides with a public CV project", () => {
  // The real Wave 4 satellite publishes under source key `construction-ai` (the
  // repo is `construction-ai-proposal`; the key is shortened for the GCP SA-id
  // limit, ADR-0019). The owner's CV legitimately has a public first-party
  // project with id `construction-ai`, rendered at /projects/construction-ai/.
  // The html item's slug is `construction-ai-site`; the pdf item's is
  // `construction-ai-proposal`.
  const CONSTRUCTION_AI_ITEM = {
    source: "construction-ai",
    slug: "construction-ai-site",
    section: "projects",
    path: "index.html",
    title: "Construction.AI — Project Overview",
    summary: "Self-contained overview page for the Construction.AI material takeoff project.",
  };

  // A CLEAN public build containing the CV's public project page. Its PATH
  // segment is `construction-ai` and its text contains `construction-ai` — the
  // exact bytes a bare `source` needle used to match.
  const CLEAN_CV_PROJECT = {
    "projects/construction-ai/index.html": [
      "<h1>Construction-AI: LLM- and KG-backed Material Takeoff</h1>",
      '<p>Phase 1 MVP deployed on Cloud Run.</p>',
      '<a href="/projects/construction-ai/">Back to projects</a>',
    ].join("\n"),
    "projects/index.html":
      '<li><a href="/projects/construction-ai/">Construction-AI: LLM- and KG-backed Material Takeoff</a></li>',
    "sitemap-0.xml": "<loc>https://jason.cusati.us/projects/construction-ai/</loc>",
  };

  it("REGRESSION: a clean build containing /projects/construction-ai/ is NOT a leak", () => {
    const dist = tree(CLEAN_CV_PROJECT);
    try {
      expect(findLeaks(dist, [CONSTRUCTION_AI_ITEM])).toEqual([]);
    } finally {
      fs.rmSync(dist, { recursive: true, force: true });
    }
  });

  // Each shape below plants ONE distinctive trace of the SAME private item in a
  // public file. Each assertion names the specific needle kind, so deleting that
  // needle from `needlesFor` turns the corresponding row red: the route row pins
  // the `route` needle, the qualified-id row the `qualified-id` needle, and so
  // on. That is how the guard is shown to still work after the source needle is
  // removed.
  const SHAPES = [
    {
      name: "route",
      file: "nav.html",
      body: '<nav><a href="/projects/construction-ai/construction-ai-site/">Overview</a></nav>',
      kind: "route",
    },
    {
      name: "qualified-id",
      file: "manifest.json",
      body: '{"id":"construction-ai/construction-ai-site"}',
      kind: "qualified-id",
    },
    {
      name: "payload-path",
      file: "frame.html",
      body: '<iframe src="/_payload/construction-ai/index.html"></iframe>',
      kind: "payload-path",
    },
    {
      name: "title",
      file: "index.html",
      body: `<a>${CONSTRUCTION_AI_ITEM.title}</a>`,
      kind: "title",
    },
    {
      name: "slug",
      file: "index.html",
      body: "<li>construction-ai-site</li>",
      kind: "slug",
    },
  ];

  it.each(SHAPES)(
    "still reports the private $name needle planted in a public file",
    ({ file, body, kind }) => {
      const dist = tree({ [file]: body });
      try {
        const kinds = findLeaks(dist, [CONSTRUCTION_AI_ITEM]).map((l) => l.kind);
        expect(kinds).toContain(kind);
      } finally {
        fs.rmSync(dist, { recursive: true, force: true });
      }
    },
  );

  it("the `construction-ai` source name alone is NOT a content needle", () => {
    // A stated LIMIT, not a gap: the qualified-id/route/payload-path/title
    // needles are what bind the item. This pins that the bare source is gone.
    const dist = tree({
      "cv/research-professional/index.html":
        '<a href="/projects/construction-ai/">Construction-AI (public CV project)</a>',
    });
    try {
      expect(findLeaks(dist, [CONSTRUCTION_AI_ITEM])).toEqual([]);
    } finally {
      fs.rmSync(dist, { recursive: true, force: true });
    }
  });
});

describe("needles and their limits are declared, not implied", () => {
  it("builds the documented needle kinds for an item, and NO bare `source` needle", () => {
    const kinds = needlesFor(PRIVATE_ITEM).map((n) => n.kind);
    expect(kinds).toEqual(
      expect.arrayContaining(["qualified-id", "slug", "route", "payload-path", "title", "summary"]),
    );
    // Wave 4 FP-2: a source name is not a bare needle. It is carried by the
    // qualified-id/route/payload-path/title/summary needles instead.
    expect(kinds).not.toContain("source");
  });

  it("matches the bare slug ONLY when delimiter-bounded", () => {
    const bounded = needlesFor(PRIVATE_ITEM).filter((n) => n.bounded).map((n) => n.kind);
    expect(bounded.sort()).toEqual(["slug"]);
  });

  it("refuses a too-short title as a needle, and says so", () => {
    const item = { ...PRIVATE_ITEM, title: "PhD" };
    expect(needlesFor(item).some((n) => n.kind === "title")).toBe(false);
    expect(weakNeedleWarnings([item])[0]).toMatch(/shorter than 8 characters/);
  });

  it("does NOT treat a bare `index.html` payload path as a needle", () => {
    // Found by the hub's own leak check on the first multi-source run (CI,
    // 2026-10-01): agentic-kg-research's item has path `index.html`, and the
    // public KGIS payload links to its own `index.html`, which a bare path
    // needle reported as a leak. The payload path is qualified by source now.
    const item = {
      source: "agentic-kg-research",
      slug: "research-store",
      section: "research",
      path: "index.html",
      title: "A private research store",
      summary: "Private research synthesis on LLMs and knowledge graphs.",
    };
    const dist = tree({ "_payload/kgis/index.html": '<a href="index.html">Home</a>' });
    try {
      expect(findLeaks(dist, [item]).filter((l) => l.kind === "payload-path")).toEqual([]);
    } finally {
      fs.rmSync(dist, { recursive: true, force: true });
    }
  });

  it("does NOT treat a bare source name as a path segment (Wave 4 FP-2)", () => {
    // The Wave 4 source key `construction-ai` is also the id of the owner's
    // public CV project, rendered at /projects/construction-ai/. A file under
    // that directory must not be reported as a leak of the private item.
    const item = {
      source: "construction-ai",
      slug: "construction-ai-site",
      section: "projects",
      path: "index.html",
      title: "Construction.AI — Project Overview",
      summary: "Self-contained overview page for the Construction.AI project.",
    };
    const dist = tree({ "projects/construction-ai/index.html": "<h1>Construction-AI</h1>" });
    try {
      expect(findLeaks(dist, [item]).some((l) => l.where === "path")).toBe(false);
    } finally {
      fs.rmSync(dist, { recursive: true, force: true });
    }
  });

  it("matches a binary file by PATH only, which is a stated limit", () => {
    const dist = fs.mkdtempSync(path.join(os.tmpdir(), "leak-bin-"));
    try {
      // A private title inside a binary blob is NOT found: ADR-0005's "necessary,
      // not sufficient". Asserted so the limit is visible rather than assumed.
      fs.writeFileSync(
        path.join(dist, "og.png"),
        Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00]), Buffer.from(PRIVATE_ITEM.title)]),
      );
      expect(findLeaks(dist, [PRIVATE_ITEM])).toEqual([]);
    } finally {
      fs.rmSync(dist, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// AN-LEAK — the PRIVATE annotation surface never reaches dist-public (D20)
// ---------------------------------------------------------------------------
// Wave 6 forbade all annotation strings. D20 puts the capture ISLAND in the
// public bundle (members annotate public items too), so `/annotations` and
// `data-annotation-*` are now allowed public tooling; only the private My notes
// route and the private-data namespace remain needles.
describe("the PRIVATE annotation surface never reaches the public output (D20)", () => {
  it("declares exactly the two private-surface needles, and the allowed island strings", () => {
    expect(ANNOTATION_NEEDLES).toEqual(["/p/notes", "hub:annotation:"]);
    expect(ANNOTATION_ALLOWED_IN_PUBLIC).toEqual(["/annotations", "data-annotation-"]);
    for (const allowed of ANNOTATION_ALLOWED_IN_PUBLIC) {
      // An allowed string must not itself be a needle.
      expect(ANNOTATION_NEEDLES.some((needle) => allowed.includes(needle))).toBe(false);
    }
  });

  it("passes a clean public output", () => {
    const dist = tree({
      "index.html": "<h1>Jason Cusati</h1><p>Software engineer and researcher.</p>",
      "cv/academic/index.html": "<h1>Academic CV</h1>",
    });
    try {
      expect(findAnnotationLeaks(dist)).toEqual([]);
    } finally {
      fs.rmSync(dist, { recursive: true, force: true });
    }
  });

  it("PASSES a public output that carries the island's allowed tooling (D20)", () => {
    // This is the whole point of the D20 change: the capture island is bundled
    // into dist-public, so `/annotations`, `data-annotation-frame`,
    // `data-annotation-island` and the local intent key MUST NOT fail the build.
    const dist = tree({
      "index.html":
        '<iframe data-annotation-frame src="/_payload/kgis/kgis-docs/index.html"></iframe>' +
        '<div data-annotation-island data-item-section="projects"></div>',
      "_astro/annotations-island.abc123.js":
        'const E="/annotations";const K="hub:annotation-intent";document.querySelectorAll("[data-annotation-island]")',
    });
    try {
      expect(findAnnotationLeaks(dist)).toEqual([]);
    } finally {
      fs.rmSync(dist, { recursive: true, force: true });
    }
  });

  it("flags the private route and the private-data namespace in CONTENTS and in a PATH", () => {
    const dist = tree({
      "index.html": '<a href="/p/notes/">My notes</a><p>hub:annotation:abc</p>',
      "p/notes/index.html": "<p>My notes</p>",
    });
    try {
      const leaks = findAnnotationLeaks(dist);
      const needles = leaks.map((l) => l.needle);
      expect(needles).toContain("/p/notes");
      expect(needles).toContain("hub:annotation:");
      expect(leaks.some((l) => l.where === "path")).toBe(true);
      // The allowed strings are NOT needles, even in the same file.
      expect(needles).not.toContain("/annotations");
      expect(needles).not.toContain("data-annotation-");
    } finally {
      fs.rmSync(dist, { recursive: true, force: true });
    }
  });

  it("containsAnnotationNeedle catches case and HTML-entity spellings (RT6-11)", () => {
    expect(containsAnnotationNeedle("HUB:ANNOTATION:x", "hub:annotation:")).toBe(true);
    expect(containsAnnotationNeedle("see /P/NOTES/ now", "/p/notes")).toBe(true);
    expect(containsAnnotationNeedle("&#47;p&#47;notes&#47;", "/p/notes")).toBe(true);
    expect(containsAnnotationNeedle("&#x2f;p&#x2f;notes&#x2f;", "/p/notes")).toBe(true);
    // The allowed island strings are not needles.
    expect(containsAnnotationNeedle("href=/Annotations", "/p/notes")).toBe(false);
    expect(containsAnnotationNeedle('"iframe[data-annotation-frame]"', "/p/notes")).toBe(false);
  });

  it("the local intent key does NOT trip the private-data namespace needle", () => {
    // `hub:annotation-intent` is one enum word and is safe publicly; only the
    // namespaced `hub:annotation:` form (which would hold note content) is a leak.
    expect(containsAnnotationNeedle("hub:annotation-intent", "hub:annotation:")).toBe(false);
    expect(containsAnnotationNeedle("hub:annotation:quote=secret", "hub:annotation:")).toBe(true);
  });

  it("scans gzip Pagefind payloads, so a private needle inside one is caught", () => {
    const dist = tree({ "index.html": "<h1>clean</h1>" });
    try {
      fs.mkdirSync(path.join(dist, "pagefind", "fragment"), { recursive: true });
      fs.writeFileSync(
        path.join(dist, "pagefind", "fragment", "en_x.pf_fragment"),
        zlib.gzipSync(Buffer.from("pagefind_dcd/notes/ - /p/notes/")),
      );
      expect(findAnnotationLeaks(dist).some((l) => l.needle === "/p/notes")).toBe(true);
    } finally {
      fs.rmSync(dist, { recursive: true, force: true });
    }
  });
});

describe("the CLI", () => {
  let dist: string;
  beforeEach(() => {
    dist = tree({ "index.html": "<h1>clean</h1>" });
  });
  afterEach(() => fs.rmSync(dist, { recursive: true, force: true }));

  it("exits 0 and reports the private items it looked for", () => {
    const run = spawnSync(process.execPath, [SCRIPT, "--dist", dist, "--sources", FIXTURE_SOURCES], {
      encoding: "utf8",
    });
    expect(run.status, run.stderr).toBe(0);
    expect(run.stdout).toContain("4 private item(s) to look for");
    expect(run.stdout).toContain("PASS");
  });

  it("exits 1 and names the file and the needle on a leak", () => {
    fs.writeFileSync(
      path.join(dist, "index.html"),
      '<a href="/phd/phd-milestones/milestones/">Programme Milestone Tracker (fixture)</a>',
    );
    const run = spawnSync(process.execPath, [SCRIPT, "--dist", dist, "--sources", FIXTURE_SOURCES], {
      encoding: "utf8",
    });
    expect(run.status).toBe(1);
    expect(run.stderr).toContain("LEAK(S)");
    expect(run.stderr).toContain("index.html");
  });

  it("exits 1 when a PRIVATE annotation needle is planted, but 0 on allowed island tooling (D20)", () => {
    fs.writeFileSync(path.join(dist, "index.html"), '<a href="/p/notes/">My notes</a>');
    const leaked = spawnSync(process.execPath, [SCRIPT, "--dist", dist, "--sources", FIXTURE_SOURCES], {
      encoding: "utf8",
    });
    expect(leaked.status).toBe(1);
    expect(leaked.stderr).toContain("/p/notes");

    // The island's allowed tooling is NOT a leak (D20).
    fs.writeFileSync(
      path.join(dist, "index.html"),
      '<script src="/annotations"></script><div data-annotation-island></div>',
    );
    const allowed = spawnSync(process.execPath, [SCRIPT, "--dist", dist, "--sources", FIXTURE_SOURCES], {
      encoding: "utf8",
    });
    expect(allowed.status, allowed.stderr).toBe(0);
  });

  it("exits 2 when there is no build output", () => {
    const run = spawnSync(
      process.execPath,
      [SCRIPT, "--dist", path.join(dist, "absent"), "--sources", FIXTURE_SOURCES],
      { encoding: "utf8" },
    );
    expect(run.status).toBe(2);
  });

  // D21 (Wave 8): the draft Rabbit Holes needles make the check non-vacuous even
  // with no satellite private item. It no longer claims "proves nothing" while a
  // draft exists; it names the draft needles instead.
  it("reports the draft Rabbit Holes needles when no private item is published (D21)", () => {
    const emptySources = fs.mkdtempSync(path.join(os.tmpdir(), "no-private-"));
    try {
      const run = spawnSync(process.execPath, [SCRIPT, "--dist", dist, "--sources", emptySources], {
        encoding: "utf8",
      });
      expect(run.status).toBe(0);
      expect(run.stdout).toContain("draft Rabbit Holes post");
      expect(run.stdout).toContain("why-a-blog-called-rabbit-holes");
      expect(run.stdout).not.toContain("proves nothing");
    } finally {
      fs.rmSync(emptySources, { recursive: true, force: true });
    }
  });

  it("exits 1 when a DRAFT post's slug reaches a feed (D21 leak check)", () => {
    // A draft that leaked into a feed is exactly what the guard must catch: the
    // slug is planted into rss.xml, a derived output the byte walk covers.
    const drafts = collectDraftRabbitHoles(path.resolve("."));
    expect(drafts.length).toBeGreaterThan(0);
    const victim = drafts[0];
    fs.writeFileSync(
      path.join(dist, "rss.xml"),
      `<item><title>${victim.title}</title><link>/rabbit-holes/${victim.slug}/</link></item>`,
    );
    const run = spawnSync(process.execPath, [SCRIPT, "--dist", dist, "--sources", FIXTURE_SOURCES], {
      encoding: "utf8",
    });
    expect(run.status).toBe(1);
    expect(run.stderr).toContain(`rabbit-holes/${victim.slug}`);
  });
});
