import { describe, it, expect } from "vitest";
import path from "node:path";
import {
  loadContentPool,
  loadVariant,
  resolveVariant,
  loadCV,
  listVariants,
  loadVariantSummaries,
} from "./cv-data";

const DATA_DIR = path.resolve("data");
const CONTENT_DIR = path.join(DATA_DIR, "content");
const VARIANTS_DIR = path.join(DATA_DIR, "variants");

describe("loadContentPool", () => {
  it("loads all sections from real data", () => {
    const pool = loadContentPool(CONTENT_DIR);
    expect(pool.meta.name).toBe("Jason Cusati");
    expect(pool.meta.contact.email).toBe("djjay@vt.edu");
    expect(Object.keys(pool.summaries).length).toBeGreaterThan(0);
    expect(Object.keys(pool.employment).length).toBeGreaterThanOrEqual(5);
    expect(Object.keys(pool.education).length).toBe(3);
    expect(Object.keys(pool.projects).length).toBeGreaterThanOrEqual(7);
    expect(Object.keys(pool.skills).length).toBe(4);
    expect(pool.misc.awards.length).toBeGreaterThan(0);
    expect(pool.misc.certifications.length).toBeGreaterThan(0);
    expect(Object.keys(pool.referees).length).toBeGreaterThan(0);
  });
});

describe("resolveVariant", () => {
  it("resolves academic variant with correct section order", () => {
    const pool = loadContentPool(CONTENT_DIR);
    const variant = loadVariant(path.join(VARIANTS_DIR, "academic.yaml"));
    const resolved = resolveVariant(pool, variant);

    expect(resolved.meta.name).toBe("Jason Cusati");
    expect(resolved.summary?.text).toContain("Results-oriented");
    expect(resolved.employment.length).toBe(6);
    expect(resolved.employment[0].role.id).toBe("vt-gra-mrs");
    expect(resolved.employment[0].collapse).toBe(false);
    expect(resolved.education.length).toBe(3);
    expect(resolved.projects.length).toBe(4);
    expect(resolved.skills.length).toBe(4);
    expect(resolved.referee?.text).toBe("Available on Request");
    expect(resolved.sectionOrder).toContain("summary");
    expect(resolved.sectionOrder).toContain("employment");
  });

  it("throws on unknown content id", () => {
    const pool = loadContentPool(CONTENT_DIR);
    const bad = {
      variant: "bad",
      sections: [{ type: "summary", content_id: "nonexistent" }],
    };
    expect(() => resolveVariant(pool, bad)).toThrow("nonexistent");
  });

  it("throws on unknown section type", () => {
    const pool = loadContentPool(CONTENT_DIR);
    const bad = { variant: "bad", sections: [{ type: "unknown-type" }] };
    expect(() => resolveVariant(pool, bad)).toThrow("unknown-type");
  });
});

describe("loadCV", () => {
  it("loads and resolves in one call", () => {
    const cv = loadCV(DATA_DIR, "academic");
    expect(cv.meta.name).toBe("Jason Cusati");
    expect(cv.employment.length).toBe(6);
  });
});

describe("listVariants", () => {
  it("lists available variants", () => {
    const variants = listVariants(VARIANTS_DIR);
    expect(variants).toContain("academic");
  });
});

describe("loadVariantSummaries", () => {
  it("returns label + description for each variant", () => {
    const summaries = loadVariantSummaries(VARIANTS_DIR);
    const slugs = summaries.map((s) => s.slug);
    expect(slugs).toContain("academic");
    expect(slugs).toContain("research-professional");
    const academic = summaries.find((s) => s.slug === "academic");
    expect(academic?.label).toBe("Academic CV");
    expect(academic?.description).toContain("publications");
  });

  it("falls back to titleized slug when label is absent", async () => {
    const fs = await import("node:fs");
    const os = await import("node:os");
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "variant-"));
    fs.writeFileSync(
      path.join(tmp, "no-label-variant.yaml"),
      "variant: no-label-variant\nsections:\n  - type: summary\n    content_id: x\n",
    );
    const summaries = loadVariantSummaries(tmp);
    expect(summaries[0].label).toBe("No Label Variant");
    expect(summaries[0].description).toBe("");
  });
});
