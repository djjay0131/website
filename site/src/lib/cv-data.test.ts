import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  loadContentPool,
  loadVariant,
  resolveVariant,
  loadCV,
  listVariants,
  loadVariantSummaries,
} from "./cv-data";

// Exact-value assertions run against a small committed fixture, so they do not
// depend on which cv release scripts/fetch-data.sh fetched (SEAM-1).
const FIXTURE_DIR = path.resolve("src/lib/__fixtures__/cv");
const FIXTURE_CONTENT = path.join(FIXTURE_DIR, "content");
const FIXTURE_VARIANTS = path.join(FIXTURE_DIR, "variants");

// The data the build renders (SEAM-2). Only structural assertions run on it.
const DATA_DIR = path.resolve("data");
const CONTENT_DIR = path.join(DATA_DIR, "content");
const VARIANTS_DIR = path.join(DATA_DIR, "variants");

describe("loadContentPool", () => {
  it("loads and indexes every section of the fixture", () => {
    const pool = loadContentPool(FIXTURE_CONTENT);
    expect(pool.meta.name).toBe("Ada Example");
    expect(pool.meta.contact.email).toBe("ada@example.org");
    expect(Object.keys(pool.summaries)).toEqual(["academic", "industry"]);
    expect(Object.keys(pool.employment)).toEqual(["lab-researcher", "acme-engineer", "early-job"]);
    expect(Object.keys(pool.education)).toEqual(["phd", "bs"]);
    expect(Object.keys(pool.projects)).toEqual(["alpha", "beta", "gamma"]);
    expect(Object.keys(pool.skills)).toEqual(["languages", "tools"]);
    expect(pool.misc.awards.map((a) => a.id)).toEqual(["fixture-award"]);
    expect(pool.misc.certifications.map((c) => c.id)).toEqual(["fixture-cert"]);
    expect(pool.referees.available.text).toBe("Available on Request");
  });
});

describe("resolveVariant", () => {
  it("resolves the fixture academic variant with correct section order", () => {
    const pool = loadContentPool(FIXTURE_CONTENT);
    const variant = loadVariant(path.join(FIXTURE_VARIANTS, "academic.yaml"));
    const resolved = resolveVariant(pool, variant);

    expect(resolved.meta.name).toBe("Ada Example");
    expect(resolved.summary?.id).toBe("academic");
    expect(resolved.sectionOrder).toEqual([
      "summary",
      "employment",
      "education",
      "projects",
      "publications",
      "skills",
      "misc",
      "referee",
    ]);
    expect(resolved.employment.map((e) => e.role.id)).toEqual([
      "lab-researcher",
      "acme-engineer",
      "early-job",
    ]);
    expect(resolved.education.map((e) => e.id)).toEqual(["phd", "bs"]);
    expect(resolved.projects.map((p) => p.id)).toEqual(["beta", "alpha"]);
    expect(resolved.skills.map((s) => s.id)).toEqual(["languages", "tools"]);
    expect(resolved.misc.awards.length).toBe(1);
    expect(resolved.referee?.text).toBe("Available on Request");
  });

  it("filters and reorders bullets, collapses roles, and subsets skill items", () => {
    const pool = loadContentPool(FIXTURE_CONTENT);
    const variant = loadVariant(path.join(FIXTURE_VARIANTS, "academic.yaml"));
    const resolved = resolveVariant(pool, variant);

    const [lab, acme, early] = resolved.employment;
    expect(lab.role.bullets.map((b) => b.id)).toEqual(["lab-c", "lab-a"]);
    expect(lab.collapse).toBe(false);
    expect(acme.role.bullets.map((b) => b.id)).toEqual(["acme-a"]);
    expect(acme.collapse).toBe(false);
    expect(early.collapse).toBe(true);
    expect(resolved.skills[0].items).toEqual(["Python", "Rust"]);
    expect(resolved.skills[1].items).toEqual(["Git", "Docker"]);
    // The pool itself is not mutated by selectors.
    expect(pool.employment["lab-researcher"].bullets.length).toBe(3);
    expect(pool.skills.languages.items.length).toBe(3);
  });

  it("throws on unknown content id", () => {
    const pool = loadContentPool(FIXTURE_CONTENT);
    const bad = {
      variant: "bad",
      sections: [{ type: "summary", content_id: "nonexistent" }],
    };
    expect(() => resolveVariant(pool, bad)).toThrow("nonexistent");
  });

  it("throws on unknown bullet id", () => {
    const pool = loadContentPool(FIXTURE_CONTENT);
    const bad = {
      variant: "bad",
      sections: [{ type: "employment", include: [{ id: "acme-engineer", bullets: ["nope"] }] }],
    };
    expect(() => resolveVariant(pool, bad)).toThrow("nope");
  });

  it("throws on unknown section type", () => {
    const pool = loadContentPool(FIXTURE_CONTENT);
    const bad = { variant: "bad", sections: [{ type: "unknown-type" }] };
    expect(() => resolveVariant(pool, bad)).toThrow("unknown-type");
  });
});

describe("loadCV", () => {
  it("loads and resolves in one call", () => {
    const cv = loadCV(FIXTURE_DIR, "short-industry");
    expect(cv.meta.name).toBe("Ada Example");
    expect(cv.sectionOrder).toEqual(["summary", "skills", "employment"]);
    expect(cv.summary?.id).toBe("industry");
    expect(cv.employment.map((e) => e.role.id)).toEqual(["acme-engineer"]);
    expect(cv.education).toEqual([]);
    expect(cv.referee).toBeUndefined();
  });
});

describe("listVariants", () => {
  it("lists available variants", () => {
    expect(listVariants(FIXTURE_VARIANTS).sort()).toEqual(["academic", "short-industry"]);
  });
});

describe("loadVariantSummaries", () => {
  it("returns label + description for each variant", () => {
    const summaries = loadVariantSummaries(FIXTURE_VARIANTS);
    const academic = summaries.find((s) => s.slug === "academic");
    expect(academic?.label).toBe("Academic CV");
    expect(academic?.description).toContain("publications");
    const industry = summaries.find((s) => s.slug === "short-industry");
    expect(industry?.label).toBe("Short Industry");
    expect(industry?.description).toBe("");
  });

  it("falls back to titleized slug when label is absent", async () => {
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

// The data fetched by scripts/fetch-data.sh (or linked by sync-local-data.sh).
// These checks hold for any well-formed cv release: they never pin counts, ids
// or names, so a new release cannot fail CI's `npm test` step on content alone.
describe("fetched CV data (structure only)", () => {
  it("loads a content pool with a name and contact email", () => {
    const pool = loadContentPool(CONTENT_DIR);
    expect(pool.meta.name).toBeTruthy();
    expect(pool.meta.contact.email).toContain("@");
    expect(Object.keys(pool.summaries).length).toBeGreaterThan(0);
    expect(Object.keys(pool.employment).length).toBeGreaterThan(0);
  });

  it("has at least one variant, each with a label", () => {
    const summaries = loadVariantSummaries(VARIANTS_DIR);
    expect(summaries.length).toBeGreaterThan(0);
    for (const s of summaries) expect(s.label).toBeTruthy();
  });

  it("resolves every variant, keeping its section order and include lists", () => {
    const pool = loadContentPool(CONTENT_DIR);
    for (const slug of listVariants(VARIANTS_DIR)) {
      const variant = loadVariant(path.join(VARIANTS_DIR, `${slug}.yaml`));
      const resolved = resolveVariant(pool, variant);
      expect(resolved.sectionOrder, slug).toEqual(variant.sections.map((s) => s.type));

      const included = (type: string) =>
        variant.sections.find((s) => s.type === type)?.include?.length ?? 0;
      expect(resolved.employment.length, `${slug} employment`).toBe(included("employment"));
      expect(resolved.education.length, `${slug} education`).toBe(included("education"));
      expect(resolved.projects.length, `${slug} projects`).toBe(included("projects"));
      expect(resolved.skills.length, `${slug} skills`).toBe(included("skills"));
      if (variant.sections.some((s) => s.type === "summary")) {
        expect(resolved.summary?.text, `${slug} summary`).toBeTruthy();
      }
    }
  });
});
