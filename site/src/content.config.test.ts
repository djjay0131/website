import { describe, it, expect } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  FORMATS,
  HubContentError,
  LIMITS,
  PATTERNS,
  SECTIONS,
  VISIBILITY,
  findDuplicateSlugs,
  loadSources,
  manifestSchema,
  validateManifest,
} from "./content.config";
import { CLAIMED_DATA_ITEMS } from "./lib/hub-content.mjs";

// The contract stream's own artefacts. SEAM-1 requires both ends to validate
// THESE fixtures; inventing parallel ones would let the two ends drift.
const CONTRACT_DIR = path.resolve("../contract");
const SCHEMA_PATH = path.join(CONTRACT_DIR, "manifest.schema.json");
const EXAMPLE_PATH = path.join(CONTRACT_DIR, "examples", "manifest.example.json");
const INVALID_DIR = path.join(CONTRACT_DIR, "examples", "invalid");

const schema = JSON.parse(fs.readFileSync(SCHEMA_PATH, "utf8"));
const item = schema.$defs.item;
const readJson = (p: string) => JSON.parse(fs.readFileSync(p, "utf8"));
const invalidFixtures = fs.readdirSync(INVALID_DIR).filter((f) => f.endsWith(".json")).sort();

/** Validate a fixture as the source it says it is. */
const check = (raw: any) => validateManifest(raw, raw?.source ?? "unknown");

function writeTree(files: Record<string, string>) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "hub-sources-"));
  for (const [rel, body] of Object.entries(files)) {
    const file = path.join(root, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, body);
  }
  return root;
}

// ---------------------------------------------------------------------------
// The mirror is a mirror (SEAM-1)
// ---------------------------------------------------------------------------
describe("the Zod collection mirrors contract/manifest.schema.json", () => {
  it("has the contract stream's schema to mirror", () => {
    expect(fs.existsSync(SCHEMA_PATH), `${SCHEMA_PATH} is missing`).toBe(true);
  });

  it("carries the same fixed sets", () => {
    expect([...SECTIONS]).toEqual(item.properties.section.enum);
    expect([...FORMATS]).toEqual(item.properties.format.enum);
    expect([...VISIBILITY]).toEqual(item.properties.visibility.enum);
  });

  it("carries the same patterns, character for character", () => {
    expect(PATTERNS.source).toBe(schema.properties.source.pattern);
    expect(PATTERNS.published).toBe(schema.properties.published.pattern);
    expect(PATTERNS.slug).toBe(item.properties.slug.pattern);
    expect(PATTERNS.path).toBe(item.properties.path.pattern);
    expect(PATTERNS.date).toBe(item.properties.date.pattern);
    expect(PATTERNS.tag).toBe(item.properties.tags.items.pattern);
    expect(PATTERNS.schema_version).toBe(item.properties.schema_version.pattern);
  });

  it("carries the same lengths and counts", () => {
    expect(LIMITS.slugMaxLength).toBe(item.properties.slug.maxLength);
    expect(LIMITS.titleMinLength).toBe(item.properties.title.minLength);
    expect(LIMITS.titleMaxLength).toBe(item.properties.title.maxLength);
    expect(LIMITS.pathMinLength).toBe(item.properties.path.minLength);
    expect(LIMITS.pathMaxLength).toBe(item.properties.path.maxLength);
    expect(LIMITS.summaryMinLength).toBe(item.properties.summary.minLength);
    expect(LIMITS.summaryMaxLength).toBe(item.properties.summary.maxLength);
    expect(LIMITS.tagsMaxItems).toBe(item.properties.tags.maxItems);
    expect(LIMITS.tagMaxLength).toBe(item.properties.tags.items.maxLength);
  });

  it("has the same required/optional split and the same closed objects", () => {
    expect(schema.required.sort()).toEqual(["items", "published", "source"]);
    expect(item.required.sort()).toEqual(
      ["date", "format", "path", "section", "slug", "title", "visibility"].sort(),
    );
    expect(schema.additionalProperties).toBe(false);
    expect(item.additionalProperties).toBe(false);
    // Every declared item property is mirrored, and no extra one is invented.
    const mirrored = Object.keys(manifestSchema.shape.items.element.def.shape ?? {});
    expect(mirrored.sort()).toEqual(Object.keys(item.properties).sort());
  });
});

// ---------------------------------------------------------------------------
// The shared fixtures (SEAM-1)
// ---------------------------------------------------------------------------
describe("the shared contract fixtures", () => {
  it("accepts contract/examples/manifest.example.json", () => {
    expect(() => check(readJson(EXAMPLE_PATH))).not.toThrow();
  });

  it("accepts visibility: private in Phase 2 — accepting is not publishing", () => {
    const example = readJson(EXAMPLE_PATH);
    expect(example.items[0].visibility).toBe("private");
    expect(check(example).items[0].visibility).toBe("private");
  });

  it("found every invalid fixture", () => {
    expect(invalidFixtures.length).toBeGreaterThanOrEqual(12);
  });

  it.each(invalidFixtures)("rejects contract/examples/invalid/%s", (name) => {
    expect(() => check(readJson(path.join(INVALID_DIR, name)))).toThrow(HubContentError);
  });
});

// ---------------------------------------------------------------------------
// The rule JSON Schema cannot express (SEAM-1, amended 2026-09-16)
// ---------------------------------------------------------------------------
describe("slug uniqueness is enforced beside the schema, not by it", () => {
  const duplicate = readJson(path.join(INVALID_DIR, "duplicate-slug.json"));

  it("the schema mirror ACCEPTS a duplicate slug, exactly as a conformant validator must", () => {
    // Draft 2020-12 has no "unique by property" keyword, so ajv accepts this
    // fixture and so does this mirror. Asserted so nobody discovers it by
    // accident and assumes the mirror covers the rule.
    expect(manifestSchema.safeParse(duplicate).success).toBe(true);
  });

  it("findDuplicateSlugs names the offending slug and every index using it", () => {
    const dupes = findDuplicateSlugs(duplicate.items);
    expect([...dupes.keys()]).toEqual(["committee-dossier"]);
    expect(dupes.get("committee-dossier")).toEqual([0, 1]);
    expect(findDuplicateSlugs(readJson(EXAMPLE_PATH).items).size).toBe(0);
  });

  it("validateManifest rejects it", () => {
    expect(() => check(duplicate)).toThrow(/duplicate slug "committee-dossier"/);
  });
});

// ---------------------------------------------------------------------------
// Data-item claiming (ADR-0008 decisions 3 and 5)
// ---------------------------------------------------------------------------
describe("the hub renders only the data items it claims", () => {
  const dataManifest = (over: Record<string, unknown>) => ({
    source: "cv",
    published: "2026-09-16T09:15:00Z",
    items: [
      {
        slug: "cv-data",
        title: "CV source data",
        section: "cv",
        format: "data",
        path: "cv-data/",
        visibility: "public",
        date: "2026-09-16",
        schema_version: "1",
        ...over,
      },
    ],
  });

  it("claims exactly ('cv', 'cv-data') in Phase 2", () => {
    expect(CLAIMED_DATA_ITEMS.map((c) => [c.source, c.slug])).toEqual([["cv", "cv-data"]]);
    expect(CLAIMED_DATA_ITEMS[0].schemaVersions).toEqual(["1"]);
  });

  it("accepts the claimed item", () => {
    expect(() => check(dataManifest({}))).not.toThrow();
  });

  it("FAILS on a data item it does not claim", () => {
    expect(() => check(dataManifest({ slug: "some-other-payload" }))).toThrow(
      /does not claim the data item \("cv", "some-other-payload"\)/,
    );
  });

  it("FAILS on a data item from a source it does not claim", () => {
    const other = { ...dataManifest({}), source: "agentic-kg" };
    expect(() => validateManifest(other, "agentic-kg")).toThrow(/does not claim the data item/);
  });

  it("FAILS on an unrecognised schema_version", () => {
    expect(() => check(dataManifest({ schema_version: "2" }))).toThrow(
      /schema_version "2" is not one this hub understands/,
    );
  });

  it("leaves non-data items of unclaimed sources alone", () => {
    const pdfs = {
      source: "agentic-kg",
      published: "2026-09-16T09:15:00Z",
      items: [
        {
          slug: "overview",
          title: "Overview",
          section: "projects",
          format: "pdf",
          path: "overview.pdf",
          visibility: "public",
          date: "2026-09-16",
        },
      ],
    };
    expect(() => validateManifest(pdfs, "agentic-kg")).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// The build path: loadSources() is what the collection loader runs
// ---------------------------------------------------------------------------
describe("loadSources — the code path the build takes", () => {
  it("returns nothing when no content has been synced", () => {
    expect(loadSources(path.join(os.tmpdir(), "does-not-exist-hub-sources"))).toEqual([]);
  });

  it("loads a valid tree, keyed by the bucket prefix", () => {
    const root = writeTree({
      "cv/manifest.json": JSON.stringify({
        source: "cv",
        published: "2026-09-16T09:15:00Z",
        items: [
          {
            slug: "academic",
            title: "Academic CV",
            section: "cv",
            format: "pdf",
            path: "academic.pdf",
            visibility: "public",
            date: "2026-09-16",
          },
        ],
      }),
    });
    const loaded = loadSources(root);
    expect(loaded.map((l) => l.source)).toEqual(["cv"]);
    expect(loaded[0].manifest.items[0].slug).toBe("academic");
  });

  it("FAILS THE BUILD on a manifest the JSON Schema rejects", () => {
    for (const name of invalidFixtures) {
      const raw = readJson(path.join(INVALID_DIR, name));
      const root = writeTree({ [`${raw.source ?? "cv"}/manifest.json`]: JSON.stringify(raw) });
      expect(() => loadSources(root), name).toThrow(HubContentError);
    }
  });

  it("FAILS on a manifest whose source is not the prefix it was published under", () => {
    const root = writeTree({
      "cv/manifest.json": JSON.stringify({
        source: "phd-milestones",
        published: "2026-09-16T09:15:00Z",
        items: [],
      }),
    });
    expect(() => loadSources(root)).toThrow(/published under the prefix sources\/cv\//);
  });

  it("FAILS on a source directory with no manifest", () => {
    const root = writeTree({ "cv/academic.pdf": "%PDF-1.4" });
    expect(() => loadSources(root)).toThrow(/has no manifest\.json/);
  });

  it("FAILS on a manifest that is not valid JSON", () => {
    const root = writeTree({ "cv/manifest.json": "{not json" });
    expect(() => loadSources(root)).toThrow(/is not valid JSON/);
  });

  it("accepts an empty items array — the only way a source withdraws everything", () => {
    const root = writeTree({
      "cv/manifest.json": JSON.stringify({ source: "cv", published: "2026-09-16T09:15:00Z", items: [] }),
    });
    expect(loadSources(root)[0].manifest.items).toEqual([]);
  });
});
