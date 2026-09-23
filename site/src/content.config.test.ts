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
import {
  CLAIMED_DATA_ITEMS,
  CONTENT_PROVENANCE_FILE,
  DEFAULT_MANIFEST_VERSION,
  EXPECTED_SOURCES,
  KNOWN_MANIFEST_VERSIONS,
  expectedSourcesEnforcement,
  findMissingExpectedSources,
  isKnownManifestVersion,
  manifestVersionOf,
} from "./lib/hub-content.mjs";

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

/**
 * The provenance marker a tree that CANNOT carry every declared source writes
 * (scripts/fetch-data.sh, scripts/sync-local-data.sh). Spread into a tree that
 * is deliberately single-source and is not about the expected-source set, so
 * those tests keep testing what they were written to test rather than tripping
 * over a required source they never meant to declare.
 */
const PARTIAL_TREE = {
  [CONTENT_PROVENANCE_FILE]: JSON.stringify({ provenance: "test-partial", complete: false }),
};

/** A manifest withdrawing everything, for whichever source needs to be present. */
const emptyManifest = (source: string, published = "2026-09-17T00:00:00Z") =>
  JSON.stringify({ source, published, items: [] });

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
    // ADR-0009. Mirrored from the schema's own string, like every other pattern,
    // so a change on the contract side fails this build rather than drifting.
    expect(PATTERNS.manifest_version).toBe(schema.properties.manifest_version.pattern);
  });

  it("mirrors manifest_version as a DISTINCT pattern from schema_version", () => {
    // They look similar and mean different things. manifest_version is integers
    // only, because the hub matches it exactly against a known list; a dotted
    // form would invite compatibility reasoning nothing implements (ADR-0009).
    expect(PATTERNS.manifest_version).toBe("^[0-9]+$");
    expect(PATTERNS.manifest_version).not.toBe(PATTERNS.schema_version);
    expect(new RegExp(PATTERNS.manifest_version).test("1")).toBe(true);
    expect(new RegExp(PATTERNS.manifest_version).test("1.2")).toBe(false);
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
    // And the same at the ROOT, which is where manifest_version lives. Without
    // this, a new top-level field could land in the schema and be silently
    // rejected here as "unknown" rather than mirrored.
    const mirroredRoot = Object.keys(manifestSchema.def.shape ?? {});
    expect(mirroredRoot.sort()).toEqual(Object.keys(schema.properties).sort());
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
// manifest_version — the ENVELOPE version (ADR-0009)
// ---------------------------------------------------------------------------
describe("manifest_version is accepted, defaulted and vetted", () => {
  const manifest = (over: Record<string, unknown> = {}) => ({
    source: "phd-milestones",
    published: "2026-09-17T00:00:00Z",
    items: [],
    ...over,
  });

  it("is OPTIONAL, exactly as in the schema (decision 1)", () => {
    expect(schema.required).not.toContain("manifest_version");
    expect(() => check(manifest())).not.toThrow();
  });

  it("ABSENT MEANS \"1\" (decision 2), so every pre-ADR-0009 manifest stays valid", () => {
    expect(DEFAULT_MANIFEST_VERSION).toBe("1");
    expect(manifestVersionOf({})).toBe("1");
    expect(manifestVersionOf({ manifest_version: undefined })).toBe("1");
    expect(manifestVersionOf({ manifest_version: "1" })).toBe("1");
    // The contract's own example carries no manifest_version and must still pass.
    expect(readJson(EXAMPLE_PATH).manifest_version).toBeUndefined();
    expect(() => check(readJson(EXAMPLE_PATH))).not.toThrow();
  });

  it("accepts a known version explicitly declared", () => {
    expect(KNOWN_MANIFEST_VERSIONS).toEqual(["1"]);
    expect(isKnownManifestVersion("1")).toBe(true);
    expect(() => check(manifest({ manifest_version: "1" }))).not.toThrow();
  });

  it("FAILS THE BUILD on a version the hub does not know (decision 3)", () => {
    // The same shape as the existing schema_version check, because it is the
    // same kind of mistake: reading a document written to rules you have never
    // seen and assuming they are the rules you know.
    expect(isKnownManifestVersion("2")).toBe(false);
    expect(() => check(manifest({ manifest_version: "2" }))).toThrow(HubContentError);
    expect(() => check(manifest({ manifest_version: "2" }))).toThrow(
      /manifest_version: "2" is not an envelope version this hub understands/,
    );
  });

  it("rejects a DOTTED version for the right reason — the pattern, not strictness", () => {
    // Before this change the Zod mirror rejected contract/examples/invalid/
    // manifest-version-not-an-integer.json because manifest_version was an
    // UNKNOWN FIELD, which is an accident that would have disappeared the moment
    // the field was mirrored. Now it must be rejected by the pattern itself.
    const dotted = readJson(path.join(INVALID_DIR, "manifest-version-not-an-integer.json"));
    expect(dotted.manifest_version).toBe("1.2");
    const parsed = manifestSchema.safeParse(dotted);
    expect(parsed.success).toBe(false);
    expect(JSON.stringify(parsed.error?.issues)).toMatch(/manifest_version/);
  });
});

// ---------------------------------------------------------------------------
// The expected-source set (ADR-0010 decision 4, closing C27)
// ---------------------------------------------------------------------------
describe("a declared source whose prefix has entirely vanished is a fault", () => {
  it("declares both satellites, and BOTH are required since 2026-09-18", () => {
    expect(EXPECTED_SOURCES.map((e) => e.source)).toEqual(["cv", "phd-milestones"]);
    expect(EXPECTED_SOURCES.find((e) => e.source === "cv")?.required).toBe(true);
    // Flipped on 2026-09-18, after the first successful publish at Checkpoint 4
    // (2026-09-17). Left at false, a vanished prefix goes undetected for the one
    // source C27 was written about -- the private one, whose silent
    // disappearance empties the private area while every check reports success.
    expect(EXPECTED_SOURCES.find((e) => e.source === "phd-milestones")?.required).toBe(true);
  });

  it("reports EVERY required source whose prefix is absent", () => {
    const problems = findMissingExpectedSources([]);
    expect(problems).toHaveLength(2);
    expect(problems.join("\n")).toMatch(/"cv" has no prefix at all/);
    expect(problems.join("\n")).toMatch(/"phd-milestones" has no prefix at all/);
    expect(problems[0]).toMatch(/FAULT, not a withdrawal/);
  });

  it("THE CONSEQUENCE OF THE FLIP: a tree with cv alone is now a fault", () => {
    // This assertion is the whole point of required: true. Before 2026-09-18 it
    // returned [], and a private prefix that vanished from the bucket produced a
    // green build with an empty private area.
    const problems = findMissingExpectedSources(["cv"]);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/"phd-milestones" has no prefix at all/);
    expect(problems[0]).toMatch(/FAULT, not a withdrawal/);
    expect(problems[0]).toMatch(/Found: cv\./);
  });

  it("says nothing when every required source is present", () => {
    expect(findMissingExpectedSources(["cv", "phd-milestones"])).toEqual([]);
  });

  it("does NOT confuse a vanished prefix with a withdrawal (decision 2 vs 4)", () => {
    // Withdrawing everything still means publishing a manifest with an empty
    // items array. That is legitimate and must keep passing -- so this tree
    // carries BOTH required sources, and every item of each is withdrawn.
    const root = writeTree({
      "cv/manifest.json": emptyManifest("cv", "2026-09-16T09:15:00Z"),
      "phd-milestones/manifest.json": emptyManifest("phd-milestones"),
    });
    expect(() => loadSources(root)).not.toThrow();
    expect(loadSources(root).map((l) => l.source)).toEqual(["cv", "phd-milestones"]);
    expect(loadSources(root)[0].manifest.items).toEqual([]);
  });

  it("FAILS loadSources when a required source's whole prefix is gone (cv)", () => {
    const root = writeTree({
      "phd-milestones/manifest.json": emptyManifest("phd-milestones"),
    });
    expect(() => loadSources(root)).toThrow(/expected published sources are missing/);
    expect(() => loadSources(root)).toThrow(/"cv" has no prefix at all/);
  });

  it("FAILS loadSources when the PRIVATE source's whole prefix is gone", () => {
    // The build-level half of the flip, and the case C27 was written for: the
    // tree is otherwise perfectly valid, so nothing else in the pipeline
    // notices. It must stop the build before the private sync can prune the
    // private area down to nothing (ADR-0010 decisions 3 and 5).
    const root = writeTree({
      "cv/manifest.json": emptyManifest("cv", "2026-09-16T09:15:00Z"),
    });
    expect(() => loadSources(root)).toThrow(HubContentError);
    expect(() => loadSources(root)).toThrow(/expected published sources are missing/);
    expect(() => loadSources(root)).toThrow(/"phd-milestones" has no prefix at all/);
  });
});

// ---------------------------------------------------------------------------
// WHICH TREES THE CHECK APPLIES TO (the provenance marker)
// ---------------------------------------------------------------------------
describe("the expected-source check applies to trees that could be complete", () => {
  it("ENFORCES when the tree carries no marker at all — fail-closed", () => {
    const { enforce, reason } = expectedSourcesEnforcement(null);
    expect(enforce).toBe(true);
    expect(reason).toMatch(/absent or unrecognised marker enforces/);
  });

  it("ENFORCES on a marker that does not say complete: false", () => {
    expect(expectedSourcesEnforcement({}).enforce).toBe(true);
    expect(expectedSourcesEnforcement({ provenance: "bucket", complete: true }).enforce).toBe(true);
    // Not a boolean false, so not an exemption. Only the explicit value exempts.
    expect(expectedSourcesEnforcement({ complete: undefined }).enforce).toBe(true);
    expect(expectedSourcesEnforcement(undefined).enforce).toBe(true);
  });

  it("does NOT enforce when the producer declared the tree incomplete", () => {
    const { enforce, reason } = expectedSourcesEnforcement({
      provenance: "cv-release",
      complete: false,
    });
    expect(enforce).toBe(false);
    expect(reason).toMatch(/cv-release/);
  });

  it("lets the cv-release fallback tree build, and fails the same tree without it", () => {
    // The two halves together. Identical trees -- cv alone, no phd-milestones --
    // and the ONLY difference is the marker the producer wrote. Every
    // pull-request build reads the fallback path (a PR cannot authenticate to
    // the content bucket), so without this the flip would fail every PR.
    const files = { "cv/manifest.json": emptyManifest("cv", "2026-09-16T09:15:00Z") };
    expect(() => loadSources(writeTree(files))).toThrow(/"phd-milestones" has no prefix at all/);
    expect(() =>
      loadSources(
        writeTree({
          ...files,
          [CONTENT_PROVENANCE_FILE]: JSON.stringify({
            provenance: "cv-release",
            complete: false,
            syncedAt: "2026-09-18T00:00:00.000Z",
            objectCount: 14,
          }),
        }),
      ),
    ).not.toThrow();
  });

  it("enforces again on a bucket-provenance tree, which CAN be complete", () => {
    const root = writeTree({
      "cv/manifest.json": emptyManifest("cv", "2026-09-16T09:15:00Z"),
      [CONTENT_PROVENANCE_FILE]: JSON.stringify({ provenance: "bucket", complete: true }),
    });
    expect(() => loadSources(root)).toThrow(/"phd-milestones" has no prefix at all/);
  });

  it("enforces on an unreadable marker, rather than treating it as an exemption", () => {
    const root = writeTree({
      "cv/manifest.json": emptyManifest("cv", "2026-09-16T09:15:00Z"),
      [CONTENT_PROVENANCE_FILE]: "{not json",
    });
    expect(() => loadSources(root)).toThrow(/"phd-milestones" has no prefix at all/);
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
      ...PARTIAL_TREE,
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
      const root = writeTree({
        ...PARTIAL_TREE,
        [`${raw.source ?? "cv"}/manifest.json`]: JSON.stringify(raw),
      });
      expect(() => loadSources(root), name).toThrow(HubContentError);
    }
  });

  it("FAILS on a manifest whose source is not the prefix it was published under", () => {
    const root = writeTree({
      ...PARTIAL_TREE,
      "cv/manifest.json": JSON.stringify({
        source: "phd-milestones",
        published: "2026-09-16T09:15:00Z",
        items: [],
      }),
    });
    expect(() => loadSources(root)).toThrow(/published under the prefix sources\/cv\//);
  });

  it("FAILS on a source directory with no manifest", () => {
    const root = writeTree({ ...PARTIAL_TREE, "cv/academic.pdf": "%PDF-1.4" });
    expect(() => loadSources(root)).toThrow(/has no manifest\.json/);
  });

  it("FAILS on a manifest that is not valid JSON", () => {
    const root = writeTree({ ...PARTIAL_TREE, "cv/manifest.json": "{not json" });
    expect(() => loadSources(root)).toThrow(/is not valid JSON/);
  });

  it("accepts an empty items array — the only way a source withdraws everything", () => {
    const root = writeTree({
      ...PARTIAL_TREE,
      "cv/manifest.json": JSON.stringify({ source: "cv", published: "2026-09-16T09:15:00Z", items: [] }),
    });
    expect(loadSources(root)[0].manifest.items).toEqual([]);
  });
});
