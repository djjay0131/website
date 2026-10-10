// THE GENERATED OG CARD — RETAINED, NO LONGER THE DEFAULT (D16, 2026-10-04).
//
// ADR-0015 decision 1 replaced the portrait with a generated card. D16 restored
// the research emblem as the default `og:image`, so this card is no longer
// referenced by `Base.astro`; the generator and its test remain, and the file is
// still emitted, pending a decision to retire it. It is written into public/
// from an Astro integration at config:setup, so both `npm run build` and
// `npm run build:public` produce it without a separate prebuild step, and Astro
// then copies it into the output like any committed public file.
//
// The card is an SVG (the editable source, also written) rasterised to PNG with
// sharp, which Astro already depends on. Nothing leaves the origin: the card is
// drawn from rectangles and the self-hosted font stack, not fetched.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";
import { publishedRabbitHoles, readRabbitHoles } from "../src/lib/rabbit-holes.mjs";

const SITE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Read the owner's name from the synced cv-data, or fall back to the known name. */
function ownerName() {
  const metaPath = path.join(
    SITE_ROOT,
    "src/content/sources/cv/cv-data/data/content/meta.yaml",
  );
  try {
    const meta = yaml.load(fs.readFileSync(metaPath, "utf8"));
    if (meta && typeof meta.name === "string" && meta.name.trim()) return meta.name.trim();
  } catch {
    // No synced CV yet: the card still generates, with the known name.
  }
  return "Jason Cusati";
}

/** The 1200×630 OpenGraph card as an SVG string. No portrait, no VT mark. */
export function renderOgCardSvg({ name, title, affiliation } = {}) {
  const safeName = escapeXml(name ?? "Jason Cusati");
  const safeTitle = escapeXml(title ?? "Research hub");
  const safeAffiliation = escapeXml(affiliation ?? "Virginia Tech");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" role="img" aria-label="${safeName} — ${safeTitle}">
  <rect width="1200" height="630" fill="#861f41"/>
  <rect y="596" width="1200" height="34" fill="#e5751f"/>
  <text x="80" y="300" fill="#ffffff" font-family="Georgia, 'Times New Roman', serif" font-size="96" font-weight="600">${safeName}</text>
  <text x="80" y="380" fill="#f3e4e8" font-family="Helvetica, Arial, sans-serif" font-size="40">${safeTitle}</text>
  <text x="80" y="440" fill="#f3e4e8" font-family="Helvetica, Arial, sans-serif" font-size="32">${safeAffiliation}</text>
</svg>
`;
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Astro integration: write public/og-card.svg and public/og-card.png before the
 * build copies public/ into the output.
 * @returns {import('astro').AstroIntegration}
 */
export function ogCard() {
  return {
    name: "hub-og-card",
    hooks: {
      "astro:config:setup": async ({ logger }) => {
        const name = ownerName();
        const svg = renderOgCardSvg({ name, title: "Research hub", affiliation: "Virginia Tech" });
        const svgPath = path.join(SITE_ROOT, "public", "og-card.svg");
        const pngPath = path.join(SITE_ROOT, "public", "og-card.png");
        fs.mkdirSync(path.dirname(svgPath), { recursive: true });
        fs.writeFileSync(svgPath, svg);
        const { default: sharp } = await import("sharp");
        await sharp(Buffer.from(svg)).png().toFile(pngPath);
        logger.info(`generated the retained og card (no longer the default; D16): public/og-card.png`);
      },
    },
  };
}

// --- Per-post OG images for Rabbit Holes (D21, Wave 8) ----------------------
//
// Reuses the Wave 5 generator's palette and rules (maroon band, orange rule, no
// portrait, no VT mark) to draw one 1200×630 card per published post: the title,
// the words "Rabbit Holes", and the date. A DRAFT gets no image, because the
// integration only sees published posts. Files land directly in the OUTPUT
// directory at build:done (not public/), so they never enter the route inventory
// or a committed tree; a draft slug can therefore never name an OG file.

/** A single line, trimmed to `max` characters so it fits the card. */
function truncateTitle(value, max = 64) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

/** The 1200×630 Rabbit Holes post card as an SVG string. */
export function renderRabbitHoleOgSvg({ title, dateText } = {}) {
  const safeTitle = escapeXml(truncateTitle(title));
  const safeDate = escapeXml(dateText ?? "");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" role="img" aria-label="Rabbit Holes — ${safeTitle}">
  <rect width="1200" height="630" fill="#861f41"/>
  <rect y="596" width="1200" height="34" fill="#e5751f"/>
  <text x="80" y="180" fill="#f3e4e8" font-family="Helvetica, Arial, sans-serif" font-size="40" letter-spacing="6">RABBIT HOLES</text>
  <text x="80" y="330" fill="#ffffff" font-family="Georgia, 'Times New Roman', serif" font-size="72" font-weight="600">${safeTitle}</text>
  <text x="80" y="420" fill="#f3e4e8" font-family="Helvetica, Arial, sans-serif" font-size="36">${safeDate}</text>
</svg>
`;
}

/**
 * Astro integration: write one OG PNG per published Rabbit Holes post into
 * `<outDir>/rabbit-holes/og/<slug>.png` at build:done. Public build only.
 * @returns {import('astro').AstroIntegration}
 */
export function rabbitHolesOg(options = {}) {
  const siteRoot = options.siteRoot ?? SITE_ROOT;
  return {
    name: "hub-rabbit-holes-og",
    hooks: {
      "astro:build:done": async ({ dir, logger }) => {
        const outDir = fileURLToPath(dir);
        const posts = publishedRabbitHoles(readRabbitHoles(siteRoot));
        if (posts.length === 0) {
          logger.info("no published rabbit holes yet, so no post OG images were written");
          return;
        }
        const { default: sharp } = await import("sharp");
        const dest = path.join(outDir, "rabbit-holes", "og");
        fs.mkdirSync(dest, { recursive: true });
        for (const post of posts) {
          const svg = renderRabbitHoleOgSvg({ title: post.title, dateText: post.dateText });
          await sharp(Buffer.from(svg)).png().toFile(path.join(dest, `${post.slug}.png`));
        }
        logger.info(`wrote ${posts.length} Rabbit Holes OG image(s) to rabbit-holes/og/`);
      },
    },
  };
}
