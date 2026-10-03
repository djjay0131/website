// THE DEFAULT og:image IS A GENERATED CARD (ADR-0015 decision 1; spec §6/§9).
//
// Before Wave 0c the default link preview was the portrait; the spec replaces
// it with a generated card: the name, the site title, a maroon band and an
// orange rule, and NO portrait. It is written into public/ from an Astro
// integration at config:setup, so both `npm run build` and `npm run build:public`
// produce it without a separate prebuild step, and Astro then copies it into the
// output like any committed public file.
//
// The card is an SVG (the editable source, also written) rasterised to PNG with
// sharp, which Astro already depends on. Nothing leaves the origin: the card is
// drawn from rectangles and the self-hosted font stack, not fetched.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";

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
        logger.info(`generated the default og:image (no portrait): public/og-card.png`);
      },
    },
  };
}
