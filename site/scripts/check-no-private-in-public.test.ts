import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  collectPrivateItems,
  containsBounded,
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
  it("finds both private items, and no public one", () => {
    const items = collectPrivateItems(FIXTURE_SOURCES);
    expect(items.map((i) => `${i.source}/${i.slug}`).sort()).toEqual([
      "phd-milestones/committee-dossier",
      "phd-milestones/milestones",
    ]);
    // cv publishes five PUBLIC items; none of them is private.
    expect(items.every((i) => i.source === "phd-milestones")).toBe(true);
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

describe("needles and their limits are declared, not implied", () => {
  it("builds the documented needle kinds for an item", () => {
    const kinds = needlesFor(PRIVATE_ITEM).map((n) => n.kind);
    expect(kinds).toEqual(
      expect.arrayContaining(["qualified-id", "slug", "route", "source", "payload-path", "title", "summary"]),
    );
  });

  it("matches the bare slug and source ONLY when delimiter-bounded", () => {
    const bounded = needlesFor(PRIVATE_ITEM).filter((n) => n.bounded).map((n) => n.kind);
    expect(bounded.sort()).toEqual(["slug", "source"]);
  });

  it("refuses a too-short title as a needle, and says so", () => {
    const item = { ...PRIVATE_ITEM, title: "PhD" };
    expect(needlesFor(item).some((n) => n.kind === "title")).toBe(false);
    expect(weakNeedleWarnings([item])[0]).toMatch(/shorter than 8 characters/);
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
    expect(run.stdout).toContain("2 private item(s) to look for");
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

  it("exits 2 when there is no build output", () => {
    const run = spawnSync(
      process.execPath,
      [SCRIPT, "--dist", path.join(dist, "absent"), "--sources", FIXTURE_SOURCES],
      { encoding: "utf8" },
    );
    expect(run.status).toBe(2);
  });

  it("says loudly that it proved NOTHING when no private item is published", () => {
    const emptySources = fs.mkdtempSync(path.join(os.tmpdir(), "no-private-"));
    try {
      const run = spawnSync(process.execPath, [SCRIPT, "--dist", dist, "--sources", emptySources], {
        encoding: "utf8",
      });
      expect(run.status).toBe(0);
      expect(run.stdout).toContain("proves nothing");
    } finally {
      fs.rmSync(emptySources, { recursive: true, force: true });
    }
  });
});
