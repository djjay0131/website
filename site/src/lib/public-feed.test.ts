import { describe, it, expect } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { collectFeedItems, feedPathFor } from "./public-feed.mjs";
import { CANONICAL_ORIGIN } from "./canonical-url.mjs";

const FIXTURE_SOURCES = path.resolve("fixtures/content/sources");

describe("feedPathFor", () => {
  it("routes an html/bundle item to its frame and a cv pdf to its variant page", () => {
    expect(feedPathFor({ section: "projects", source: "kgis", slug: "kgis-docs", format: "html" })).toBe(
      "/projects/kgis/kgis-docs/",
    );
    expect(feedPathFor({ section: "cv", source: "cv", slug: "academic", format: "pdf" })).toBe(
      "/cv/academic/",
    );
    // A group folder item has no page of its own, so it is not feedable.
    expect(feedPathFor({ section: "cv", source: "cv", slug: "cv-data", format: "data" })).toBeNull();
  });
});

describe("collectFeedItems is public-only by construction (SEAM-P1, SEAM-P3)", () => {
  const { items, warnings } = collectFeedItems(FIXTURE_SOURCES);
  const links = items.map((i) => i.link);

  it("includes only effectively-public items that have a real page", () => {
    expect(links).toContain(`${CANONICAL_ORIGIN}/projects/kgis/kgis-docs/`);
    expect(links).toContain(`${CANONICAL_ORIGIN}/cv/academic/`);
    expect(links).toContain(`${CANONICAL_ORIGIN}/cv/research-professional/`);
    expect(links).toContain(`${CANONICAL_ORIGIN}/cv/sde-long/`);
    // cv-data is effectively public but has no page, so it is skipped.
    expect(links.some((l) => l.includes("cv-data"))).toBe(false);
  });

  it("contains no private slug, title or route", () => {
    const text = JSON.stringify(items);
    for (const needle of [
      "anthropic-fellow",
      "milestones",
      "committee-dossier",
      "internal-notes",
      "Fellowship CV (fixture)",
      "Programme Milestone Tracker (fixture)",
    ]) {
      expect(text).not.toContain(needle);
    }
  });

  it("uses absolute canonical URLs and sorts newest first", () => {
    for (const link of links) expect(link.startsWith(`${CANONICAL_ORIGIN}/`)).toBe(true);
    expect(items[0].link).toBe(`${CANONICAL_ORIGIN}/projects/kgis/kgis-docs/`); // 2026-10-01
    const pubDates = items.map((i) => i.pubDate);
    expect([...pubDates].sort().reverse()).toEqual(pubDates);
    expect(warnings).toEqual([]);
  });
});

describe("an item with no date is skipped, not invented (SEAM-P3)", () => {
  it("reports a warning and omits the item", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "feed-undated-"));
    try {
      fs.mkdirSync(path.join(root, "cv"));
      fs.writeFileSync(
        path.join(root, "cv", "manifest.json"),
        JSON.stringify({
          source: "cv",
          items: [
            {
              slug: "academic",
              title: "Undated CV",
              section: "cv",
              format: "pdf",
              path: "academic.pdf",
              visibility: "public",
            },
          ],
        }),
      );
      const { items, warnings } = collectFeedItems(root);
      expect(items).toEqual([]);
      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toMatch(/no date/);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
