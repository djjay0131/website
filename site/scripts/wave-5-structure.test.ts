import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { routesFromPagesDir } from "./route-inventory.mjs";

// "SEARCH PAGE PRESENCE/ABSENCE PER BUILD" (SEAM-P2, SEAM-P3), tested at the
// routing level rather than by building both outputs: Astro routes exactly one
// pages directory (src/pages for public, src-private/pages for private, selected
// by srcDir in astro.config.mjs). A route that is not in a pages tree cannot be
// emitted by that build, so this is the structural guarantee, not a convention.
const PUBLIC_PAGES = path.resolve("src/pages");
const PRIVATE_PAGES = path.resolve("src-private/pages");

describe("the public build can emit the search page and the feed", () => {
  const routes = routesFromPagesDir(PUBLIC_PAGES);
  it("routes /search/ and /rss.xml", () => {
    expect(routes).toContain("/search/");
    expect(routes).toContain("/rss.xml");
  });
});

describe("the private build cannot emit the search page or the feed", () => {
  const routes = routesFromPagesDir(PRIVATE_PAGES);
  it("has no /search/ and no /rss.xml route", () => {
    expect(routes).not.toContain("/search/");
    expect(routes).not.toContain("/rss.xml");
  });
  it("has no search.astro or rss.xml.ts source file", () => {
    expect(fs.existsSync(path.join(PRIVATE_PAGES, "search.astro"))).toBe(false);
    expect(fs.existsSync(path.join(PRIVATE_PAGES, "rss.xml.ts"))).toBe(false);
  });
});

// After a real `npm run build:private`, these must hold. They are conditional
// because CI runs `npm test` BEFORE the builds, so the outputs may not exist yet;
// the wave-5 verification runs them explicitly against the built outputs, and
// this pins the property as soon as a build is present.
const PRIVATE_DIST = path.resolve("dist-private");
const PUBLIC_DIST = path.resolve("dist-public");
const privateBuilt = fs.existsSync(path.join(PRIVATE_DIST, "index.html"));

describe.runIf(privateBuilt)("built private output carries no public-only derived artifact", () => {
  it("has no search page, no pagefind index, no rss.xml and no 404.html", () => {
    expect(fs.existsSync(path.join(PRIVATE_DIST, "search"))).toBe(false);
    expect(fs.existsSync(path.join(PRIVATE_DIST, "search", "index.html"))).toBe(false);
    expect(fs.existsSync(path.join(PRIVATE_DIST, "pagefind"))).toBe(false);
    expect(fs.existsSync(path.join(PRIVATE_DIST, "rss.xml"))).toBe(false);
    expect(fs.existsSync(path.join(PRIVATE_DIST, "404.html"))).toBe(false);
  });
});

describe.runIf(fs.existsSync(path.join(PUBLIC_DIST, "pagefind", "pagefind-entry.json")))(
  "built public output carries the search index and feed",
  () => {
    it("has a pagefind index built from dist-public and an rss.xml", () => {
      expect(fs.existsSync(path.join(PUBLIC_DIST, "pagefind", "pagefind-entry.json"))).toBe(true);
      expect(fs.existsSync(path.join(PUBLIC_DIST, "rss.xml"))).toBe(true);
    });
  },
);
