// What the hub claims from the content bucket, and where the synced payload
// lives (SEAM-1, SEAM-2, SEAM-5; ADR-0008 decisions 2 and 3).
//
// Shared by src/content.config.ts, scripts/sync-content.sh's staging step,
// the CV pages and the tests, so there is exactly one declaration of each
// fact. Plain JavaScript on purpose: .ts modules and .mjs build scripts both
// import it (the scripts/site-env.mjs precedent).

/** Bucket prefix every source publishes under (SEAM-2). Never varied. */
export const BUCKET_PREFIX = "sources/";

/** Where sync-content.sh writes the bucket, relative to site/ (design doc §9). Gitignored. */
export const SOURCES_DIR = "src/content/sources";

/**
 * THE CLAIMED DATA ITEMS (ADR-0008 decision 3).
 *
 * A `format: data` item is a structured payload the hub renders with
 * first-party code, so the hub must understand its shape. It therefore renders
 * ONLY the (source, slug) pairs declared here, and FAILS THE BUILD on any
 * other `data` item, or on a schema_version this table does not list.
 *
 * Adding a row means writing a renderer and accepting a named coupling to that
 * satellite's internals. ADR-0008 sets that bar deliberately high: it should
 * take an ADR (STATE C19).
 *
 * In Phase 2 there is exactly one row.
 */
export const CLAIMED_DATA_ITEMS = [
  {
    source: "cv",
    slug: "cv-data",
    // schema_version values this hub's renderer understands. A value outside
    // this list fails the build rather than rendering a subtly wrong CV.
    schemaVersions: ["1"],
    renderer: "src/lib/cv-data.ts",
  },
];

/** True when (source, slug) is a data item this hub renders. */
export function isClaimedDataItem(source, slug) {
  return CLAIMED_DATA_ITEMS.some((c) => c.source === source && c.slug === slug);
}

/** The claim row for (source, slug), or undefined. */
export function claimFor(source, slug) {
  return CLAIMED_DATA_ITEMS.find((c) => c.source === source && c.slug === slug);
}

// --- The cv satellite's payload (SEAM-5) -----------------------------------
//
// cv publishes four `pdf` items (<variant>.pdf) and one `data` item, slug
// cv-data, at path cv-data/, whose contents are exactly today's cv-data.zip
// unzipped: data/content/*.yaml, data/variants/*.yaml, own-bib.bib and
// photo_jason_1.jpeg. The paths below are where those files land after the
// sync. They replace the former site/data/ tree file for file; nothing about
// how they are read or resolved changes (ADR-0008 decision 4).

export const CV_SOURCE = "cv";
export const CV_DATA_SLUG = "cv-data";

/** site/src/content/sources/cv */
export const CV_SOURCE_DIR = `${SOURCES_DIR}/${CV_SOURCE}`;
/** The cv-data payload root: the former site/data/ ... plus the photo. */
export const CV_DATA_DIR = `${CV_SOURCE_DIR}/${CV_DATA_SLUG}`;

/** Former site/data/content */
export const CV_CONTENT_DIR = `${CV_DATA_DIR}/data/content`;
/** Former site/data/variants */
export const CV_VARIANTS_DIR = `${CV_DATA_DIR}/data/variants`;
/** Former site/data (the directory loadCV() joins "content" and "variants" onto) */
export const CV_DATA_ROOT = `${CV_DATA_DIR}/data`;
/** Former site/data/own-bib.bib */
export const CV_BIB_PATH = `${CV_DATA_DIR}/own-bib.bib`;
/** The photo's path WITHIN the cv source's prefix, i.e. relative to sources/cv/. */
export const CV_PHOTO_REL = `${CV_DATA_SLUG}/photo_jason_1.jpeg`;
/** Former (fetched) site/public/photo_jason_1.jpeg, relative to site/. */
export const CV_PHOTO_PATH = `${CV_DATA_DIR}/photo_jason_1.jpeg`;

/**
 * Where the hub serves the synced CV assets from. Phase 1 served
 * /pdfs/<variant>.pdf and /photo_jason_1.jpeg out of public/, and it still
 * does: the staging step copies them there after the sync, so no URL moves
 * (ADR-0008 decision 4).
 */
export const PUBLIC_PDF_DIR = "public/pdfs";
export const PUBLIC_PHOTO_PATH = "public/photo_jason_1.jpeg";

/**
 * The path under public/ a published item is served from, or null to leave it
 * alone.
 *
 * THE VISIBILITY GUARD IS FIRST AND IS NOT REDUNDANT. Everything staged here
 * lands in site/public/, which Astro copies verbatim into dist-public and which
 * is therefore the public internet. Before Phase 3 a private item could not
 * reach this function's non-null branch, but only as a side effect of the
 * `source === "cv"` test -- the code never actually asked about visibility. That
 * made the safety of this function depend on a fact about which satellites
 * exist, which stopped being true the moment `phd-milestones` was added. The
 * check below asks the question directly, so the guarantee survives the next
 * satellite and the next format (ADR-0005; design doc §12.1).
 */
export function publicAssetPathFor(item, source) {
  if (item?.visibility !== "public") return null;
  if (source === CV_SOURCE && item.format === "pdf" && item.section === "cv") {
    return `${PUBLIC_PDF_DIR}/${item.slug}.pdf`;
  }
  return null;
}

// --- The manifest envelope version (ADR-0009) -------------------------------
//
// `manifest_version` versions the ENVELOPE -- the field set, the fixed enums,
// the rules every source obeys. It is distinct from an item's `schema_version`,
// which versions one `data` payload's internal shape (ADR-0008 decision 5). The
// two answer different questions and are bumped by different people; the table
// is in contract/README.md and docs/satellites.md.
//
// It is OPTIONAL today and ABSENT MEANS "1" (ADR-0009 decision 2), so every
// manifest published before ADR-0009 stays valid unchanged. It becomes required
// in Phase 5 (decision 4).

/** What an absent `manifest_version` means (ADR-0009 decision 2). */
export const DEFAULT_MANIFEST_VERSION = "1";

/**
 * Envelope versions this hub understands.
 *
 * A value outside this list FAILS THE BUILD (ADR-0009 decision 3), exactly as an
 * unrecognised `schema_version` does. Silent tolerance of an unknown envelope
 * version is how a contract stops meaning anything: the hub would be reading a
 * manifest written to rules it has never seen and guessing that they match.
 *
 * Add a version here only together with the code that understands it.
 */
export const KNOWN_MANIFEST_VERSIONS = ["1"];

/** The envelope version of a manifest, applying the "absent means 1" default. */
export function manifestVersionOf(manifest) {
  const declared = manifest?.manifest_version;
  return typeof declared === "string" && declared !== "" ? declared : DEFAULT_MANIFEST_VERSION;
}

/** True when this hub understands the manifest's envelope version. */
export function isKnownManifestVersion(version) {
  return KNOWN_MANIFEST_VERSIONS.includes(version);
}

// --- The expected sources (ADR-0010 decision 4, closing C27) -----------------
//
// A source whose entire bucket prefix has VANISHED is otherwise
// indistinguishable from a source that never existed: `loadSources()` simply
// finds no directory and reports nothing wrong. That is benign for `cv` and is
// not benign for `phd-milestones`, whose absence would silently empty the
// private area (C27).
//
// So the hub declares which sources it expects, here, beside CLAIMED_DATA_ITEMS.
//
// WHY `required` IS A FIELD AND NOT AN ASSUMPTION. ADR-0010 decision 4 says a
// declared source whose prefix is entirely absent fails the build. Taken
// literally at the moment this lands, that would fail EVERY build immediately:
// `phd-milestones` has not published yet and cannot until Checkpoint 4, and the
// pull-request and fallback content paths only ever produce `cv`. A guard that
// fails every build from the day it lands is removed within a day, which is the
// opposite of what decision 4 is for. So each entry carries the phase from which
// its absence is a fault, and `phd-milestones` starts declared-but-not-required.
//
// CHECKPOINT 4 ACTION, DONE 2026-09-18. `phd-milestones` published successfully
// at Checkpoint 4 (2026-09-17): its manifest and its payload files are under
// sources/phd-milestones/ in the content bucket. So its `required` is now true,
// and C27 is closed for the one source it was written for. Leaving it at `false`
// after the first publish is exactly the hole decision 4 exists to catch: a
// vanished prefix that nothing reports.
//
// WHICH TREES THE CHECK APPLIES TO is a separate question, answered by the
// provenance marker below. See that section: the cv-release fallback tree cannot
// carry this source at all, and enforcing there would fail every pull request.
export const EXPECTED_SOURCES = [
  {
    source: "cv",
    required: true,
    since: "Phase 2",
    note: "Satellite #1. Publishes the CV variants and the cv-data payload.",
  },
  {
    source: "phd-milestones",
    required: true,
    since: "Checkpoint 4",
    note:
      "Satellite #2, the private one (SEAM-7). HAS PUBLISHED: first successful publish at " +
      "Checkpoint 4, 2026-09-17, and flipped to required: true on 2026-09-18. Its absence " +
      "is now a FAULT rather than a bootstrap state -- the private area silently emptying " +
      "is the consequence C27 names (ADR-0010 decision 4 and its 2026-09-17 amendment).",
  },
];

/**
 * Declared sources that are REQUIRED but whose prefix is entirely absent.
 *
 * @param {readonly string[]} presentSources source names found under the synced tree
 * @param {{ expected?: readonly {source: string, required: boolean, since: string}[] }} [options]
 * @returns {string[]} human-readable problems, empty when every required source is present
 */
export function findMissingExpectedSources(presentSources, options = {}) {
  const expected = options.expected ?? EXPECTED_SOURCES;
  const present = new Set(presentSources);
  return expected
    .filter((entry) => entry.required && !present.has(entry.source))
    .map(
      (entry) =>
        `the expected source "${entry.source}" has no prefix at all under the synced tree. ` +
        `The hub has expected it since ${entry.since}, so its complete absence is a FAULT, not a ` +
        `withdrawal: a source that withdrew everything still publishes a manifest with an empty ` +
        `items array (ADR-0010 decisions 2 and 4). Either the sync did not complete, or the ` +
        `prefix was deleted. Found: ${[...present].sort().join(", ") || "(no sources at all)"}.`,
    );
}

// --- Where the synced tree came from (ADR-0010 decision 4, second half) ------
//
// The check above asks "has a declared source's whole prefix vanished?". That
// question only has a meaningful answer for a tree that COULD have carried every
// declared source. It cannot be asked of the cv-release fallback tree, which
// scripts/fetch-data.sh builds from a GitHub release and which carries `cv` and
// nothing else BY CONSTRUCTION -- there is no other source in that release, and
// there is no bucket in the picture.
//
// That path is not an edge case. A pull_request run carries refs/pull/<n>/merge
// and the deploy binding admits only refs/heads/main (infra/wif.tf), so a PR
// CANNOT authenticate to the content bucket and EVERY pull-request build takes
// the fallback. Enforcing the check there would have failed every pull request
// from the moment `phd-milestones` became required -- the same bootstrap
// pathology ADR-0010 decision 4's amendment exists to avoid ("a guard that fails
// every build from the day it lands is removed within a day"), one step further
// down the road. The fix is not to weaken the guard; it is to ask it only where
// its answer means something.
//
// So the PRODUCER of the tree records how the tree was produced, at the tree's
// root, and this module decides from that. The precedent is the private build
// receipt (scripts/private-build.mjs, .hub-private-build.json): a later step that
// must not guess is handed a fact by the step that knew it.
//
// It is a FILE and not an environment variable on purpose. It travels with the
// tree it describes, it is written and read entirely within site/**, and it is
// therefore not a cross-stream variable that nothing checks -- the defect shape
// Phase 3 already paid for once (infra rendered PRIVATE_BUCKET, the gate read
// GATE_PRIVATE_BUCKET). scripts/sync-content.sh rebuilds the destination from
// scratch before writing it, so a marker can never outlive the tree it describes.

/** Written by scripts/sync-content.sh at the root of the synced tree. */
export const CONTENT_PROVENANCE_FILE = ".hub-content-source.json";

/**
 * Does the required-source check apply to a tree with this provenance?
 *
 * FAIL-CLOSED. An absent, unreadable or unrecognised marker ENFORCES. A tree is
 * exempt only when its own producer said, in so many words, that it cannot be
 * complete. Silence never exempts anything: the failure mode of the opposite
 * default is a guard that quietly stops running and still reports success.
 *
 * @param {{provenance?: string, complete?: boolean} | null | undefined} provenance
 * @returns {{enforce: boolean, reason: string}}
 */
export function expectedSourcesEnforcement(provenance) {
  if (provenance && provenance.complete === false) {
    const name =
      typeof provenance.provenance === "string" && provenance.provenance !== ""
        ? provenance.provenance
        : "(unnamed)";
    return {
      enforce: false,
      reason:
        `the synced tree declares provenance "${name}" with complete: false, meaning its ` +
        `producer cannot supply every declared source (the cv-release fallback carries "cv" ` +
        `alone). The expected-source check would report a fault that is a property of the ` +
        `transport, not of the bucket, so it does not apply to this tree.`,
    };
  }
  const name =
    provenance && typeof provenance.provenance === "string" && provenance.provenance !== ""
      ? provenance.provenance
      : "(no marker)";
  return {
    enforce: true,
    reason:
      `the synced tree's provenance is ${name}, which is treated as able to carry every ` +
      `declared source. An absent or unrecognised marker enforces deliberately: only a ` +
      `producer's explicit "complete: false" exempts a tree.`,
  };
}
