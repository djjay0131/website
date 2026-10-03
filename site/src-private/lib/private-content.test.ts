import { describe, it, expect } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  GATE_SEGMENT_PATTERN,
  PAYLOAD_ROOT,
  SHARE_DOC_ROOT,
  docStagingPlanFor,
  findUnservablePaths,
  payloadUrlFor,
  routeFor,
  stagingPlanFor,
} from "./private-content.mjs";

const FIXTURE_SOURCES = path.resolve("fixtures/content/sources");

const MILESTONES = {
  source: "phd-milestones",
  slug: "milestones",
  section: "phd",
  format: "html",
  path: "site/index.html",
};
const DOSSIER = {
  source: "phd-milestones",
  slug: "committee-dossier",
  section: "phd",
  format: "html",
  path: "site/committee.html",
};

describe("where a private item is served", () => {
  it("routes at /<section>/<source>/<slug>/", () => {
    expect(routeFor(MILESTONES)).toBe("/phd/phd-milestones/milestones/");
  });

  it("serves its payload under the payload root, keeping the satellite's own layout", () => {
    expect(payloadUrlFor(MILESTONES)).toBe(`/${PAYLOAD_ROOT}/phd-milestones/site/index.html`);
  });

  // ISSUE #27. These build RAW strings, so Astro's `base` never reaches them. The
  // private build passes import.meta.env.BASE_URL, which is /p/ -- the path the gate
  // serves under and strips to form the object name. Before this, every route and
  // payload URL pointed at the PUBLIC origin and 404'd for a signed-in member, while
  // the build, the sync and the gate were each individually correct.
  it("prefixes the gate's base, which is what the private build passes", () => {
    expect(routeFor(MILESTONES, "/p/")).toBe("/p/phd/phd-milestones/milestones/");
    expect(payloadUrlFor(MILESTONES, "/p/")).toBe(
      `/p/${PAYLOAD_ROOT}/phd-milestones/site/index.html`,
    );
  });
});

describe("staging an html item takes its DIRECTORY, not just its file", () => {
  // Phase 2 staged one file per item, which is right for a pdf and wrong for
  // html: both fixture pages load site/assets/style.css and cross-link to each
  // other. Copying only the named file renders them broken with no error at all.
  const plan = stagingPlanFor(FIXTURE_SOURCES, [MILESTONES, DOSSIER]);
  const to = plan.map((p) => p.to);

  it("stages the sibling stylesheet the manifest never mentions", () => {
    expect(to).toContain(`${PAYLOAD_ROOT}/phd-milestones/site/assets/style.css`);
  });

  it("stages both declared pages", () => {
    expect(to).toContain(`${PAYLOAD_ROOT}/phd-milestones/site/index.html`);
    expect(to).toContain(`${PAYLOAD_ROOT}/phd-milestones/site/committee.html`);
  });

  it("emits each file exactly once, though both items share one directory", () => {
    expect(new Set(to).size).toBe(to.length);
  });

  it("every planned source file actually exists", () => {
    for (const { from } of plan) expect(fs.existsSync(from), from).toBe(true);
  });
});

describe("a WITHDRAWN document's leftover bytes are not staged (ADR-0010 decision 1)", () => {
  it("skips an .html file no surviving item declares", () => {
    // A satellite cannot prune (ADR-0007), so a withdrawn page's bytes are still
    // sitting in the directory. A plain directory copy would re-publish exactly
    // the document someone withdrew.
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "stage-"));
    try {
      const dir = path.join(root, "phd-milestones", "site");
      fs.mkdirSync(path.join(dir, "assets"), { recursive: true });
      fs.writeFileSync(path.join(dir, "index.html"), "live");
      fs.writeFileSync(path.join(dir, "committee.html"), "live");
      fs.writeFileSync(path.join(dir, "withdrawn.html"), "SHOULD NOT TRAVEL");
      fs.writeFileSync(path.join(dir, "assets", "style.css"), "body{}");

      const to = stagingPlanFor(root, [MILESTONES, DOSSIER]).map((p) => p.to);

      expect(to).toContain(`${PAYLOAD_ROOT}/phd-milestones/site/index.html`);
      expect(to).toContain(`${PAYLOAD_ROOT}/phd-milestones/site/assets/style.css`);
      expect(to).not.toContain(`${PAYLOAD_ROOT}/phd-milestones/site/withdrawn.html`);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it("stages only the named file for a non-document format", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "stage-pdf-"));
    try {
      fs.mkdirSync(path.join(root, "cv"), { recursive: true });
      fs.writeFileSync(path.join(root, "cv", "academic.pdf"), "%PDF");
      fs.writeFileSync(path.join(root, "cv", "unrelated.pdf"), "%PDF");

      const to = stagingPlanFor(root, [
        { source: "cv", slug: "academic", section: "cv", format: "pdf", path: "academic.pdf" },
      ]).map((p) => p.to);

      expect(to).toEqual([`${PAYLOAD_ROOT}/cv/academic.pdf`]);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it("stages nothing when there are no private items", () => {
    expect(stagingPlanFor(FIXTURE_SOURCES, [])).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// SD-7: every emitted path must be one the gate can actually serve
// ---------------------------------------------------------------------------
describe("paths the gate could never serve fail the build, not the member", () => {
  // The gate validates /p/{path} with an ALLOWLIST -- each segment must match
  // [A-Za-z0-9._-] -- and 404s anything else before reading the bucket. A file
  // outside that set syncs perfectly and is then permanently unreachable, with
  // nothing failing anywhere. Only the members it exists for ever see it.

  it("accepts everything the two fixture items actually produce", () => {
    const emitted = [
      "index.html",
      "phd/phd-milestones/milestones/index.html",
      "phd/phd-milestones/committee-dossier/index.html",
      `${PAYLOAD_ROOT}/phd-milestones/site/index.html`,
      `${PAYLOAD_ROOT}/phd-milestones/site/committee.html`,
      `${PAYLOAD_ROOT}/phd-milestones/site/assets/style.css`,
      "_astro/index.BrYAj1_h.css",
      ".hub-private-build.json",
    ];
    expect(findUnservablePaths(emitted)).toEqual([]);
  });

  it("names the offending path AND the offending segment", () => {
    const bad = findUnservablePaths(["phd/phd milestones/index.html"]);
    expect(bad).toEqual([{ path: "phd/phd milestones/index.html", segment: "phd milestones" }]);
  });

  it("catches each character class that plausibly gets here", () => {
    for (const segment of ["a b", "a~b", "a+b", "a@b", "a%20b", "a:b", "a(b)", "café", "a#b"]) {
      expect(findUnservablePaths([`ok/${segment}/index.html`]), segment).toHaveLength(1);
    }
  });

  it("allows the separators Astro and the payload root really use", () => {
    for (const segment of ["_astro", "_payload", "committee-dossier", "style.css", "a_b", "A1"]) {
      expect(GATE_SEGMENT_PATTERN.test(segment), segment).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// THE ITEM-SCOPED SHARE DOCUMENT (SEAM-S1, amended 2026-10-03)
// ---------------------------------------------------------------------------
// A share is served from `<section>/<source>/<slug>/_doc/`. The copy must be
// self-contained and item-scoped: the item's own document under its own
// basename, its non-document assets, and NOT the documents of sibling items,
// which would let one token reach another item.
describe("docStagingPlanFor stages a self-contained, one-token-one-item copy", () => {
  function fixtureItems(source: string) {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(FIXTURE_SOURCES, source, "manifest.json"), "utf8"),
    );
    return (manifest.items as Record<string, unknown>[]).map((item) => ({
      ...item,
      source: manifest.source,
    }));
  }

  const items = fixtureItems("phd-milestones");
  const plan = docStagingPlanFor(FIXTURE_SOURCES, items as never);
  const dossierRoot = `phd/phd-milestones/committee-dossier/${SHARE_DOC_ROOT}`;
  const dossierTo = plan.filter((p) => p.to.startsWith(`${dossierRoot}/`)).map((p) => p.to);

  it("copies the item's own document under its own basename at the _doc/ root", () => {
    expect(dossierTo).toContain(`${dossierRoot}/committee.html`);
    const entry = plan.find((p) => p.to === `${dossierRoot}/committee.html`);
    expect(entry?.from.endsWith(`site/committee.html`)).toBe(true);
  });

  it("keeps the entry's real extension, so the gate serves the right content type", () => {
    // The D1 follow-up: renaming a pdf to index.html would make the gate serve
    // text/html over PDF bytes. The entry is the basename, extension and all.
    expect(dossierTo).not.toContain(`${dossierRoot}/index.html`);
  });

  it("carries the non-document asset from the containing directory", () => {
    expect(dossierTo).toContain(`${dossierRoot}/assets/style.css`);
  });

  it("EXCLUDES the documents declared by sibling items of the same source", () => {
    // site/index.html is `milestones`; site/internal.html is `internal-notes`.
    // Neither may reach committee-dossier's share tree. The item's own document
    // travels under its own basename, never as a renamed index.html.
    expect(dossierTo).not.toContain(`${dossierRoot}/internal.html`);
    expect(dossierTo).not.toContain(`${dossierRoot}/index.html`);
    const entry = plan.find((p) => p.to === `${dossierRoot}/committee.html`);
    expect(entry?.from.endsWith(`committee.html`)).toBe(true);
    expect(entry?.from).not.toContain(`site/index.html`);
  });

  it("stages every file it plans", () => {
    for (const { from } of plan) expect(fs.existsSync(from), from).toBe(true);
  });

  it("keeps a PREFIX-ROOT single item's whole site", () => {
    // A built site whose entry point is index.html at the source prefix root:
    // the containing directory IS the prefix, so sibling pages AND assets travel
    // (only documents declared by OTHER items are excluded).
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "share-root-"));
    try {
      const dir = path.join(root, "site");
      fs.mkdirSync(path.join(dir, "assets"), { recursive: true });
      fs.writeFileSync(path.join(dir, "index.html"), "entry");
      fs.writeFileSync(path.join(dir, "about.html"), "a sibling page of the site");
      fs.writeFileSync(path.join(dir, "assets", "style.css"), "body{}");

      const to = docStagingPlanFor(root, [
        { source: "site", slug: "site-docs", section: "projects", format: "html", path: "index.html" },
      ] as never).map((p) => p.to);

      expect(to).toContain(`projects/site/site-docs/${SHARE_DOC_ROOT}/index.html`);
      expect(to).toContain(`projects/site/site-docs/${SHARE_DOC_ROOT}/about.html`);
      expect(to).toContain(`projects/site/site-docs/${SHARE_DOC_ROOT}/assets/style.css`);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it("stages no OTHER document from a named directory (a withdrawn page stays behind)", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "share-named-"));
    try {
      const dir = path.join(root, "src", "site");
      fs.mkdirSync(path.join(dir, "assets"), { recursive: true });
      fs.writeFileSync(path.join(dir, "a.html"), "entry A");
      fs.writeFileSync(path.join(dir, "b.html"), "entry B");
      fs.writeFileSync(path.join(dir, "withdrawn.html"), "SHOULD NOT TRAVEL");
      fs.writeFileSync(path.join(dir, "assets", "x.css"), "body{}");

      const to = docStagingPlanFor(root, [
        { source: "src", slug: "a", section: "s", format: "html", path: "site/a.html" },
        { source: "src", slug: "b", section: "s", format: "html", path: "site/b.html" },
      ] as never).map((p) => p.to);

      expect(to).toContain(`s/src/a/${SHARE_DOC_ROOT}/a.html`);
      expect(to).toContain(`s/src/a/${SHARE_DOC_ROOT}/assets/x.css`);
      expect(to).not.toContain(`s/src/a/${SHARE_DOC_ROOT}/b.html`);
      // Not declared by any surviving item: a withdrawn page's bytes must not
      // be re-published inside a share tree.
      expect(to).not.toContain(`s/src/a/${SHARE_DOC_ROOT}/withdrawn.html`);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it("at the PREFIX ROOT keeps the site's undeclared pages but excludes a sibling item's", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "share-prefixroot-"));
    try {
      const dir = path.join(root, "docs");
      fs.mkdirSync(path.join(dir, "assets"), { recursive: true });
      fs.writeFileSync(path.join(dir, "index.html"), "site entry");
      fs.writeFileSync(path.join(dir, "about.html"), "the site's own page");
      fs.writeFileSync(path.join(dir, "sib.html"), "a sibling ITEM'S page");
      fs.writeFileSync(path.join(dir, "assets", "x.css"), "body{}");

      const to = docStagingPlanFor(root, [
        { source: "docs", slug: "site", section: "projects", format: "html", path: "index.html" },
        { source: "docs", slug: "sib", section: "projects", format: "html", path: "sib.html" },
      ] as never).map((p) => p.to);

      expect(to).toContain(`projects/docs/site/${SHARE_DOC_ROOT}/index.html`);
      expect(to).toContain(`projects/docs/site/${SHARE_DOC_ROOT}/about.html`);
      expect(to).not.toContain(`projects/docs/site/${SHARE_DOC_ROOT}/sib.html`);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it("refuses a source or slug of _doc (the reserved namespace)", () => {
    const to = docStagingPlanFor(FIXTURE_SOURCES, [
      { ...(items[1] as object), slug: SHARE_DOC_ROOT },
      { ...(items[1] as object), source: SHARE_DOC_ROOT },
      items[1],
    ] as never).map((p) => p.to);
    // Only the valid dossier item survives; neither _doc-named item contributes.
    expect(to.some((t) => t.startsWith(`phd/${SHARE_DOC_ROOT}/`))).toBe(false);
    expect(to).toContain(`${dossierRoot}/committee.html`);
    for (const t of to) expect(t.split("/")).not.toContain(`${SHARE_DOC_ROOT}/${SHARE_DOC_ROOT}`);
  });

  it("does NOT walk a non-framed item's whole prefix (the cv over-staging trap)", () => {
    // A pdf's containing directory may be the source prefix root, which holds
    // every CV. Only its own entry travels; a sibling pdf must not.
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "share-pdf-"));
    try {
      fs.mkdirSync(path.join(root, "cv"), { recursive: true });
      fs.writeFileSync(path.join(root, "cv", "academic.pdf"), "%PDF-a");
      fs.writeFileSync(path.join(root, "cv", "sde-long.pdf"), "%PDF-b");

      const planPdf = docStagingPlanFor(root, [
        { source: "cv", slug: "academic", section: "cv", format: "pdf", path: "academic.pdf" },
      ] as never);

      expect(planPdf.map((p) => p.to)).toEqual([`cv/cv/academic/${SHARE_DOC_ROOT}/academic.pdf`]);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
