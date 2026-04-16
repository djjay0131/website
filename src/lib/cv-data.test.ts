import { describe, it, expect } from "vitest";
import path from "node:path";
import { loadContentPool, loadVariant, resolveVariant, loadCV, listVariants } from "./cv-data";

const DATA_DIR = path.resolve("data");
const CONTENT_DIR = path.join(DATA_DIR, "content");
const VARIANTS_DIR = path.join(DATA_DIR, "variants");

describe("loadContentPool", () => {
  it("loads all sections from real data", () => {
    const pool = loadContentPool(CONTENT_DIR);
    expect(pool.meta.name).toBe("Jason Cusati");
    expect(pool.meta.contact.email).toBe("djjay@vt.edu");
    expect(Object.keys(pool.summaries).length).toBeGreaterThan(0);
    expect(Object.keys(pool.employment).length).toBe(5);
    expect(Object.keys(pool.education).length).toBe(3);
    expect(Object.keys(pool.projects).length).toBe(4);
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
    expect(resolved.employment.length).toBe(5);
    expect(resolved.employment[0].id).toBe("yoh-adf-architect");
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
    expect(cv.employment.length).toBe(5);
  });
});

describe("listVariants", () => {
  it("lists available variants", () => {
    const variants = listVariants(VARIANTS_DIR);
    expect(variants).toContain("academic");
  });
});
