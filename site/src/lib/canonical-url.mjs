// THE CANONICAL ORIGIN, IN ONE PLACE (SEAM-P7; ADR-0006).
//
// Every derived output that names a URL — the RSS feed's item links, the OG
// announcements, the redirect stubs — must use the canonical host
// https://jason.cusati.us with trailing slashes, NOT whatever SITE_URL the
// GitHub Pages variant happened to be built with. After Wave 5 the Pages
// deployment serves stubs only (ADR-0020), so a derived URL that pointed at
// djjay0131.github.io/website/ would be a dead end.
//
// It reads DEFAULT_SITE_URL from scripts/site-env.mjs rather than repeating the
// literal: that file is already the single declaration of the default origin
// (imported by astro.config.mjs and the tests), and a second copy is how the two
// drift apart. This is the same cross-directory import the content config
// already makes (src/content.config.ts imports ../scripts/site-output.mjs).
import { DEFAULT_SITE_URL } from "../../scripts/site-env.mjs";

/** "https://jason.cusati.us" — no trailing slash. */
export const CANONICAL_ORIGIN = DEFAULT_SITE_URL;

/**
 * An absolute canonical URL for a site-relative path.
 *
 * @param {string} relPath e.g. "cv/academic/" or "/rss.xml"
 * @returns {string} e.g. "https://jason.cusati.us/cv/academic/"
 */
export function canonicalUrl(relPath) {
  return new URL(String(relPath).replace(/^\/+/, ""), `${CANONICAL_ORIGIN}/`).href;
}
