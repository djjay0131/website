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

/** The path under public/ a published item is served from, or null to leave it alone. */
export function publicAssetPathFor(item, source) {
  if (source === CV_SOURCE && item.format === "pdf" && item.section === "cv") {
    return `${PUBLIC_PDF_DIR}/${item.slug}.pdf`;
  }
  return null;
}
