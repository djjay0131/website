// SEAM-1 build interface: where the site is served from.
//
//   SITE_URL   absolute origin, no path and no trailing slash. Default
//              https://jason.cusati.us, the hub's canonical host (ADR-0006)
//   SITE_BASE  path base. Default /
//
// An unset or empty variable takes the default, so a CI step may pass an empty
// repository variable through. Aliases such as research.cusati.us redirect to
// the canonical host at the Hosting layer; the build knows only SITE_URL.
export const DEFAULT_SITE_URL = "https://jason.cusati.us";
export const DEFAULT_SITE_BASE = "/";

// The GitHub Pages variant, built until Phase 6 (SEAM-5).
export const PAGES_SITE_URL = "https://djjay0131.github.io";
export const PAGES_SITE_BASE = "/website/";

/** "/", "website", "/website" and "/website/" become "/" or "/website/". */
export function normalizeBase(raw) {
  const value = String(raw ?? "").trim();
  const inner = value.replace(/^\/+|\/+$/g, "");
  return inner === "" ? DEFAULT_SITE_BASE : `/${inner}/`;
}

/** An absolute http(s) origin with no path, query or fragment. */
export function normalizeSiteUrl(raw) {
  const value = String(raw ?? "").trim();
  if (value === "") return DEFAULT_SITE_URL;
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`SITE_URL must be an absolute origin such as ${DEFAULT_SITE_URL} (got "${value}")`);
  }
  if (!/^https?:$/.test(url.protocol) || url.pathname !== "/" || url.search || url.hash) {
    throw new Error(`SITE_URL must be an http(s) origin with no path (got "${value}"); put a path in SITE_BASE`);
  }
  return url.origin;
}

export function resolveSiteEnv(env = process.env) {
  return { site: normalizeSiteUrl(env.SITE_URL), base: normalizeBase(env.SITE_BASE) };
}

/** Join a base and a base-relative path: withBase("/website/", "cv/") === "/website/cv/". */
export function withBase(base, relativePath) {
  return normalizeBase(base) + String(relativePath).replace(/^\/+/, "");
}
