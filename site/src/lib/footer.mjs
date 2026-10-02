// Footer and identity data (Amendment 3; spec §9).
//
// Everything the footer and the home identity block need that cv-data does not
// carry lives in site/src/data/footer.json: the role line, the department, the
// Elsewhere links' shape and the provenance line. The HANDLES are not in the
// file: they are read from cv-data's meta.contact, so no handle is ever
// hard-coded or invented here (the owner's draft wording).
//
// Public-safe by construction: nothing in this module knows what "private"
// means, so src/pages/** and both layouts may import it.

import fs from "node:fs";
import path from "node:path";

/**
 * site/src/data/footer.json.
 *
 * Resolved against the build's working directory (site/), NOT import.meta.url:
 * Astro bundles this module into dist-public/.prerender/, where import.meta.url
 * points inside the output and the data file is not there. This is the same
 * trap PUBLISH_ALLOWLIST_PATH in hub-content.mjs documents; every entry point
 * runs with site/ as the working directory.
 */
export const FOOTER_DATA_PATH = path.resolve(process.cwd(), "src/data/footer.json");

/** Read and parse footer.json. */
export function readFooterData(filePath = FOOTER_DATA_PATH) {
  const raw = JSON.parse(fs.readFileSync(filePath, "utf8"));
  return raw;
}

/**
 * Resolve the Elsewhere column from footer.json's templates and cv-data's
 * contact block. An entry whose handle is absent is dropped rather than
 * guessed: the site never invents a handle or an account that may not exist.
 *
 * @param {ReturnType<typeof readFooterData>} footer
 * @param {{github?: string, linkedin?: string}} [contact]
 * @returns {{id: string, label: string, icon: "github"|"linkedin", href: string}[]}
 */
export function resolveElsewhere(footer, contact = {}) {
  return (footer.elsewhere ?? [])
    .map((entry) => {
      const handle = contact?.[entry.contact];
      if (!handle) return null;
      return {
        id: entry.id,
        label: entry.label,
        icon: entry.icon,
        href: String(entry.url).replace("{handle}", handle),
      };
    })
    .filter(Boolean);
}

/**
 * The commit link for the build identifier, from the CI-provided
 * public/build-info.json. Absent locally (CI writes it), in which case the
 * footer shows no build line rather than a broken link. `repository` comes from
 * footer.json; the short SHA is the first seven characters, as git spells them.
 *
 * @param {string} siteRoot absolute path to site/
 * @param {string} repository the website repository URL
 * @returns {{short: string, href: string} | null}
 */
export function readBuildInfo(siteRoot, repository) {
  const file = path.join(siteRoot, "public", "build-info.json");
  if (!fs.existsSync(file)) return null;
  let info;
  try {
    info = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
  const sha = typeof info.built_from_sha === "string" ? info.built_from_sha : "";
  if (!sha) return null;
  const base = String(repository ?? "").replace(/\/+$/, "");
  return {
    short: sha.slice(0, 7),
    href: base ? `${base}/commit/${sha}` : "",
  };
}
