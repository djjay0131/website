// Route facts shared by astro.config.mjs, the route inventory and the tests.
// Every path here is relative to the configured base (no leading slash) unless
// it says otherwise.

// Research tracks moved under research/soa-agentic-se/ (PR #8). Astro writes a
// redirect page at each `from`; astro.config.mjs prefixes each `to` with the base.
export const LEGACY_REDIRECTS = [
  { from: "research/agentic-harnesses", to: "research/soa-agentic-se/agentic-harnesses/" },
  { from: "research/agentic-harnesses/synthesis", to: "research/soa-agentic-se/agentic-harnesses/synthesis/" },
  { from: "research/agentic-harnesses/sources", to: "research/soa-agentic-se/agentic-harnesses/sources/" },
  { from: "research/agentic-harnesses/consensus", to: "research/soa-agentic-se/agentic-harnesses/consensus/" },
];

// Sections that carry <meta name="robots" content="noindex">, stay out of the
// sitemap and are never linked from the public navigation.
export const NOINDEX_SECTIONS = ["phd"];

// The routes .github/workflows/build.yml's smoke test requests, as base-relative
// URL paths with a leading slash. Keep in step with that workflow.
export const SMOKE_ROUTES = [
  "/",
  "/resumes/",
  "/cv/academic",
  "/cv/research-professional",
  "/papers/",
  "/pdfs/academic.pdf",
  "/projects/",
];

// Files CI places in public/ before building, so a local build lacks them.
// The CV PDFs (public/pdfs/<variant>.pdf) are inferred from the CV pages.
export const CI_PUBLIC_FILES = ["build-info.json", "photo_jason_1.jpeg"];

/** The base-relative path of an absolute page URL, e.g. "phd/". */
export function baseRelativePath(pageUrl, base) {
  const pathname = new URL(pageUrl).pathname;
  return pathname.startsWith(base) ? pathname.slice(base.length) : pathname.replace(/^\/+/, "");
}

/** True for a page the sitemap must leave out. */
export function isExcludedFromSitemap(pageUrl, base) {
  const rel = baseRelativePath(pageUrl, base);
  const section = rel.split("/")[0];
  return NOINDEX_SECTIONS.includes(section);
}
