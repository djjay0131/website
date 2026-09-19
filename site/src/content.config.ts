/**
 * The hub's mirror of `contract/manifest.schema.json` (SEAM-1; design doc §4 as
 * amended by ADR-0008).
 *
 * The JSON Schema is the single definition of a manifest and the `contract`
 * stream is its sole author. This file MIRRORS it: it adds no field, renames no
 * field, widens no field and narrows no field. Every pattern below is the
 * schema's `pattern` string copied verbatim, and `content.config.test.ts`
 * asserts that each one is still character-for-character identical to the
 * schema — so a change on the contract side fails this build rather than
 * drifting silently. A mismatch is a seam defect: report it, do not paper over it.
 *
 * TWO CONTRACT RULES ARE NOT IN THE SCHEMA, because JSON Schema draft 2020-12
 * cannot express them. SEAM-1 splits their enforcement and requires each end to
 * implement its half deliberately:
 *
 *   1. `slug` is unique within a manifest. There is no "unique by property"
 *      keyword, and a non-standard one would be silently ignored by every
 *      conformant validator — including the Zod mirror below, which ACCEPTS a
 *      duplicate slug exactly as ajv does. `findDuplicateSlugs()` is that half,
 *      written as named code beside the schema and asserted by its own test.
 *   2. `path` resolves inside `dist/` on disk, symlinks included. Only the
 *      publish action can check that, because only it has the satellite's
 *      filesystem. The hub enforces the textual half through the `path` pattern.
 *
 * `visibility: private` is ACCEPTED here. The §4 shared fixture is a
 * `private`/`phd` item, so the mirror must take it. Accepting a value is not
 * publishing it: nothing private is published until Phase 3, and this phase adds
 * no private handling at all.
 */
import { defineCollection } from "astro/content/config";
import { z } from "astro/zod";
import fs from "node:fs";
import path from "node:path";
import {
  CLAIMED_DATA_ITEMS,
  KNOWN_MANIFEST_VERSIONS,
  SOURCES_DIR,
  claimFor,
  CONTENT_PROVENANCE_FILE,
  expectedSourcesEnforcement,
  findMissingExpectedSources,
  isKnownManifestVersion,
  manifestVersionOf,
} from "./lib/hub-content.mjs";

// --- Fixed sets (schema `enum`; SEAM-1) -------------------------------------

export const SECTIONS = ["research", "projects", "writing", "cv", "phd"] as const;
export const FORMATS = ["md", "mdx", "html", "pdf", "bundle", "data"] as const;
export const VISIBILITY = ["public", "private"] as const;

// --- Patterns (schema `pattern`, copied verbatim) ---------------------------
//
// Kept as strings, not regex literals, so content.config.test.ts can compare
// them with the schema's own strings. Do not "tidy" one: an equivalent regex
// written differently is still a mismatch, and the test will say so.
export const PATTERNS = {
  source: "^[a-z][a-z0-9-]{0,38}$",
  published:
    "^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\\.[0-9]+)?(Z|[+-][0-9]{2}:[0-9]{2})$",
  slug: "^[a-z0-9]+(?:-[a-z0-9]+)*$",
  path: "^(?!/)(?!.*(?:^|/)\\.\\.(?:/|$))[^\\\\\\u0000-\\u001f]+$",
  date: "^[0-9]{4}-[0-9]{2}-[0-9]{2}$",
  tag: "^[a-z0-9]+(?:-[a-z0-9]+)*$",
  schema_version: "^[0-9]+(?:\\.[0-9]+){0,2}$",
  // ADR-0009. Note it is NOT the same pattern as schema_version: integers only,
  // no dotted form, because the hub matches it exactly against a known list and
  // a dotted version invites compatibility reasoning nothing implements.
  manifest_version: "^[0-9]+$",
} as const;

// --- Lengths and counts (schema minLength/maxLength/maxItems) ---------------
export const LIMITS = {
  slugMaxLength: 64,
  titleMinLength: 1,
  titleMaxLength: 200,
  pathMinLength: 1,
  pathMaxLength: 512,
  summaryMinLength: 1,
  summaryMaxLength: 500,
  tagsMaxItems: 20,
  tagMaxLength: 32,
} as const;

const re = (pattern: string) => new RegExp(pattern);

/**
 * One published item — `$defs/item` in the schema.
 *
 * `strictObject` is `additionalProperties: false`: an unknown field is an
 * error, not something quietly ignored. That is deliberate on both ends. A
 * satellite that misspells a field must find out, and a field the hub does not
 * understand must never travel silently.
 */
export const itemSchema = z
  .strictObject({
    slug: z.string().regex(re(PATTERNS.slug)).max(LIMITS.slugMaxLength),
    title: z.string().min(LIMITS.titleMinLength).max(LIMITS.titleMaxLength),
    section: z.enum(SECTIONS),
    format: z.enum(FORMATS),
    path: z.string().min(LIMITS.pathMinLength).max(LIMITS.pathMaxLength).regex(re(PATTERNS.path)),
    visibility: z.enum(VISIBILITY),
    date: z.string().regex(re(PATTERNS.date)),
    summary: z.string().min(LIMITS.summaryMinLength).max(LIMITS.summaryMaxLength).optional(),
    tags: z
      .array(z.string().regex(re(PATTERNS.tag)).max(LIMITS.tagMaxLength))
      .max(LIMITS.tagsMaxItems)
      .refine((tags) => new Set(tags).size === tags.length, {
        message: 'the "tags" array must not repeat a value',
      })
      .optional(),
    schema_version: z.string().regex(re(PATTERNS.schema_version)).optional(),
  })
  // ADR-0008 decision 5, the schema's allOf/if/then/else: a `data` item carries
  // schema_version; no other format may carry one.
  .superRefine((item, ctx) => {
    if (item.format === "data" && item.schema_version === undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["schema_version"],
        message:
          'missing required field "schema_version" — a format: data item must carry one (ADR-0008 decision 5)',
      });
    }
    if (item.format !== "data" && item.schema_version !== undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["schema_version"],
        message: `must not carry the field "schema_version" — only a format: data item may (ADR-0008 decision 5), and this item is format: ${item.format}`,
      });
    }
  });

/**
 * The whole manifest — the schema's root object.
 *
 * `manifest_version` is OPTIONAL here and in the schema (ADR-0009 decision 1),
 * and absent means "1" (decision 2), so every manifest published before ADR-0009
 * stays valid unchanged. The pattern is mirrored character for character, and
 * whether the VALUE is one this hub understands is a separate question answered
 * in validateManifest() — the schema's job is the shape, not the vocabulary.
 */
export const manifestSchema = z.strictObject({
  source: z.string().regex(re(PATTERNS.source)),
  manifest_version: z.string().regex(re(PATTERNS.manifest_version)).optional(),
  published: z.string().regex(re(PATTERNS.published)),
  items: z.array(itemSchema),
});

export type ManifestItem = z.infer<typeof itemSchema>;
export type Manifest = z.infer<typeof manifestSchema>;

/** A build-stopping problem with published content. */
export class HubContentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HubContentError";
  }
}

// --- Contract rule 1: slug uniqueness (SEAM-1) ------------------------------

/**
 * Slugs used by more than one item, with the indexes that use them.
 *
 * THIS IS NOT REDUNDANT WITH THE SCHEMA. JSON Schema draft 2020-12 has no
 * "unique by property" keyword — `uniqueItems` compares whole items, and two
 * items sharing a slug differ elsewhere — so `manifestSchema.parse()` above
 * ACCEPTS `contract/examples/invalid/duplicate-slug.json`, exactly as a
 * conformant validator must. `contract/validate-manifest.mjs` enforces this
 * rule on the publish side; this function is the hub's half (SEAM-1).
 */
export function findDuplicateSlugs(items: readonly { slug?: unknown }[]): Map<string, number[]> {
  const seen = new Map<string, number[]>();
  items.forEach((item, index) => {
    if (typeof item?.slug !== "string") return;
    const at = seen.get(item.slug);
    if (at) at.push(index);
    else seen.set(item.slug, [index]);
  });
  return new Map([...seen].filter(([, indexes]) => indexes.length > 1));
}

// --- Contract rule 2: the hub renders only the data items it claims ---------

/**
 * Problems with the `format: data` items of one manifest (ADR-0008 decision 3).
 *
 * A `data` item is a structured payload the hub renders with first-party code,
 * so an unclaimed one has no renderer at all. It FAILS THE BUILD rather than
 * being ignored, so the contract cannot silently accumulate payloads nothing
 * renders. So does a `schema_version` the claimed renderer does not understand:
 * `cv` renaming a YAML key would otherwise surface as a malformed CV page
 * rather than a failed build (ADR-0008 decision 5).
 */
export function findUnclaimedDataItems(
  source: string,
  items: readonly ManifestItem[],
): string[] {
  const problems: string[] = [];
  items.forEach((item, index) => {
    if (item.format !== "data") return;
    const claim = claimFor(source, item.slug);
    if (!claim) {
      problems.push(
        `items[${index}]: the hub does not claim the data item ("${source}", "${item.slug}"), so it has no renderer. ` +
          `A format: data item couples one satellite to first-party hub code, so the hub renders only the (source, slug) pairs ` +
          `declared in site/src/lib/hub-content.mjs — currently ${CLAIMED_DATA_ITEMS.map((c) => `("${c.source}", "${c.slug}")`).join(", ")}. ` +
          `Publish it in another format, or teach the hub to render it and claim it (ADR-0008 decision 3).`,
      );
      return;
    }
    if (!claim.schemaVersions.includes(item.schema_version as string)) {
      problems.push(
        `items[${index}]: schema_version ${JSON.stringify(item.schema_version)} is not one this hub understands for ` +
          `("${source}", "${item.slug}"). Known: ${claim.schemaVersions.map((v) => JSON.stringify(v)).join(", ")}. ` +
          `The payload's shape changed, so ${claim.renderer} must be updated and the new version claimed (ADR-0008 decision 5).`,
      );
    }
  });
  return problems;
}

// --- The one validation entry point -----------------------------------------

/**
 * Validate one source's manifest: the schema mirror first, then the two
 * contract rules the schema cannot carry, then the claim rules.
 *
 * Throws `HubContentError` naming every problem. A manifest the JSON Schema
 * rejects is therefore a build failure, which is the property SEAM-1 and the
 * roadmap's acceptance criterion require of both ends.
 */
export function validateManifest(raw: unknown, expectedSource: string): Manifest {
  const parsed = manifestSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  ${issue.path.join(".") || "(manifest root)"}: ${issue.message}`)
      .join("\n");
    throw new HubContentError(
      `sources/${expectedSource}/manifest.json does not match contract/manifest.schema.json:\n${issues}`,
    );
  }
  const manifest = parsed.data;

  const problems: string[] = [];

  // ADR-0009 decision 3: an envelope version this hub does not know FAILS THE
  // BUILD, exactly as an unknown schema_version does (ADR-0008 decision 5). The
  // two checks are deliberately the same shape, because they are the same kind
  // of mistake: reading a document written to rules you have never seen and
  // assuming they are the rules you know.
  const envelope = manifestVersionOf(manifest);
  if (!isKnownManifestVersion(envelope)) {
    problems.push(
      `  manifest_version: ${JSON.stringify(envelope)} is not an envelope version this hub ` +
        `understands. Known: ${KNOWN_MANIFEST_VERSIONS.map((v) => JSON.stringify(v)).join(", ")}. ` +
        `manifest_version versions the manifest ENVELOPE — the field set, the fixed enums, the ` +
        `rules every source obeys — and is bumped by the hub when the contract changes, not by a ` +
        `satellite (ADR-0009). An absent manifest_version means "1". Teach the hub this version ` +
        `before a satellite publishes it.`,
    );
  }

  if (manifest.source !== expectedSource) {
    problems.push(
      `  source: the manifest says ${JSON.stringify(manifest.source)} but it was published under the prefix ` +
        `sources/${expectedSource}/. The prefix IS the source name (SEAM-2), so the two must be identical.`,
    );
  }

  for (const [slug, indexes] of findDuplicateSlugs(manifest.items)) {
    problems.push(
      `  items[${indexes[indexes.length - 1]}].slug: duplicate slug ${JSON.stringify(slug)} — items ` +
        `${indexes.join(", ")} all use it, and slug must be unique within a manifest. JSON Schema cannot ` +
        `express this rule, so it is checked here in named code (SEAM-1).`,
    );
  }

  for (const problem of findUnclaimedDataItems(manifest.source, manifest.items)) {
    problems.push(`  ${problem}`);
  }

  if (problems.length > 0) {
    throw new HubContentError(
      `sources/${expectedSource}/manifest.json breaks the publishing contract:\n${problems.join("\n")}`,
    );
  }
  return manifest;
}

// --- Reading the synced tree ------------------------------------------------

export interface LoadedSource {
  source: string;
  manifest: Manifest;
}

/**
 * Every source under the synced tree, validated.
 *
 * An absent tree is not an error: an unconfigured repository, or a checkout
 * that has not run scripts/sync-content.sh, simply has no published content
 * yet. A tree that is present and wrong IS an error, and stops the build.
 */
export function readContentProvenance(
  sourcesDir: string,
): { provenance?: string; complete?: boolean } | null {
  const markerPath = path.join(sourcesDir, CONTENT_PROVENANCE_FILE);
  if (!fs.existsSync(markerPath)) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(markerPath, "utf8"));
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    // Unreadable is not exempt: expectedSourcesEnforcement fails closed on null.
    return null;
  }
}

export function loadSources(sourcesDir: string): LoadedSource[] {
  if (!fs.existsSync(sourcesDir)) return [];
  const loaded: LoadedSource[] = [];
  for (const source of fs.readdirSync(sourcesDir).sort()) {
    const dir = path.join(sourcesDir, source);
    if (!fs.statSync(dir).isDirectory()) continue;
    const manifestPath = path.join(dir, "manifest.json");
    if (!fs.existsSync(manifestPath)) {
      throw new HubContentError(
        `sources/${source}/ has no manifest.json. Every source publishes a dist/ whose ROOT holds manifest.json ` +
          `(SEAM-1), so it lands at sources/${source}/manifest.json in the bucket. Found: ` +
          `${fs.readdirSync(dir).join(", ") || "(empty)"}.`,
      );
    }
    let raw: unknown;
    try {
      raw = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    } catch (error) {
      throw new HubContentError(
        `sources/${source}/manifest.json is not valid JSON: ${(error as Error).message}`,
      );
    }
    loaded.push({ source, manifest: validateManifest(raw, source) });
  }

  // ADR-0010 decision 4, closing C27. A source whose entire prefix has vanished
  // is otherwise invisible: the loop above simply finds no directory and reports
  // nothing wrong. That is benign for `cv` and is not benign for the private
  // source, whose silent disappearance would empty the private area while every
  // check reported success.
  //
  // This is deliberately NOT the same thing as an empty `items` array, which is
  // a legitimate withdrawal (decision 2) and is accepted. Withdrawing everything
  // still means publishing a manifest.
  //
  // It applies only to a tree whose producer could have carried every declared
  // source. The cv-release fallback cannot (every pull-request build takes it),
  // and says so in its provenance marker; anything else enforces, including a
  // tree with no marker at all. hub-content.mjs holds the rule and the reasoning.
  const { enforce, reason } = expectedSourcesEnforcement(readContentProvenance(sourcesDir));
  if (!enforce) {
    console.warn(
      `[hub-content] the expected-source check (ADR-0010 decision 4) did NOT run: ${reason}`,
    );
    return loaded;
  }

  const missing = findMissingExpectedSources(loaded.map((l) => l.source));
  if (missing.length > 0) {
    throw new HubContentError(
      `expected published sources are missing from the synced tree:\n${missing.map((m) => `  ${m}`).join("\n")}`,
    );
  }

  return loaded;
}

// --- The collection ---------------------------------------------------------

/**
 * Entry data: the item, plus the two manifest-level facts an entry needs to
 * stand on its own. `source` is not an item field in the schema — it is the
 * manifest's, and it is added here rather than mirrored into the item.
 */
export const entrySchema = itemSchema.safeExtend({
  source: z.string().regex(re(PATTERNS.source)),
  published: z.string().regex(re(PATTERNS.published)),
});

const sources = defineCollection({
  loader: {
    name: "hub-content-sources",
    // Validation lives HERE, inside load(), and not at module scope: Astro
    // logs a content-config error and skips the sync, whereas a rejection from
    // load() fails the build. "A manifest the JSON Schema rejects also fails
    // the hub build" is a roadmap acceptance criterion, so it must be the
    // second one. content.config.test.ts asserts it against the real fixtures.
    load: async ({ store, parseData }) => {
      store.clear();
      for (const { source, manifest } of loadSources(path.resolve(SOURCES_DIR))) {
        for (const item of manifest.items) {
          const id = `${source}/${item.slug}`;
          const data = await parseData({
            id,
            data: { ...item, source, published: manifest.published },
          });
          store.set({ id, data });
        }
      }
    },
  },
  schema: entrySchema,
});

export const collections = { sources };
