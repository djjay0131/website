import { describe, it, expect } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  PAYLOAD_ROOT,
  collectPublicItems,
  payloadUrlFor,
  routeFor,
  stagingPlanFor,
} from "./frame-content.mjs";

const FIXTURE_SOURCES = path.resolve("fixtures/content/sources");

const KGIS = {
  source: "kgis",
  slug: "kgis-docs",
  section: "projects",
  format: "html",
  path: "index.html",
};

describe("where a framed item is served", () => {
  it("routes at /<section>/<source>/<slug>/", () => {
    expect(routeFor(KGIS)).toBe("/projects/kgis/kgis-docs/");
  });

  it("serves its payload under the payload root", () => {
    expect(payloadUrlFor(KGIS)).toBe(`/${PAYLOAD_ROOT}/kgis/index.html`);
  });
});

describe("a framed item whose path is at the PREFIX ROOT is a built site", () => {
  // Wave 1: satellite 3 publishes a MkDocs folder whose entry point is a
  // root-level index.html. The containing directory IS the prefix root, so the
  // whole subtree must travel -- the sibling stylesheet and every page the site
  // links to. Staging only the named file would render an unstyled page with no
  // error anywhere.
  const to = stagingPlanFor(FIXTURE_SOURCES, [KGIS]).map((p) => p.to);

  it("stages the entry document at the payload root", () => {
    expect(to).toContain(`${PAYLOAD_ROOT}/kgis/index.html`);
  });

  it("stages the sibling stylesheet the manifest never names", () => {
    expect(to).toContain(`${PAYLOAD_ROOT}/kgis/assets/style.css`);
  });

  it("every planned file exists", () => {
    for (const { from } of stagingPlanFor(FIXTURE_SOURCES, [KGIS])) {
      expect(fs.existsSync(from), from).toBe(true);
    }
  });
});

describe("collectPublicItems builds a section index from manifests (D7)", () => {
  it("lists kgis-docs under projects, from its manifest alone", () => {
    const items = collectPublicItems(FIXTURE_SOURCES, {
      section: "projects",
      excludeSources: ["cv"],
    });
    expect(items.map((i) => `${i.source}/${i.slug}`)).toEqual(["kgis/kgis-docs"]);
    expect(items[0].title).toBe("KGIS Documentation (fixture)");
  });

  it("leaves a PRIVATE item in the same section out", () => {
    // phd-milestones/internal-notes is `section: projects`, `visibility: private`.
    // It must never reach a public index; the leak check is the backstop, this is
    // the filter.
    const items = collectPublicItems(FIXTURE_SOURCES, { section: "projects" });
    expect(items.some((i) => i.slug === "internal-notes")).toBe(false);
  });

  it("returns nothing for an absent tree", () => {
    expect(collectPublicItems(path.join(os.tmpdir(), "absent-frame-sources"))).toEqual([]);
  });
});
