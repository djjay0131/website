#!/usr/bin/env node
// WCAG contrast check for the colour tokens in src/styles/tokens.css.
//
//   node scripts/contrast.mjs        prints every checked pair and its ratio
//
// src/styles/tokens.test.ts runs the same check and fails below 4.5:1 (AA).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const AA_NORMAL_TEXT = 4.5;

// [foreground token, background token]. Every token used as text colour is
// checked against both page grounds, and each status colour against its tint.
export const TEXT_PAIRS = [
  ...["text", "muted", "accent", "link", "link-hover", "caution", "risk", "ok"].flatMap((fg) =>
    ["bg", "surface"].map((bg) => [`color-${fg}`, `color-${bg}`]),
  ),
  ["color-caution", "color-caution-bg"],
  ["color-risk", "color-risk-bg"],
  ["color-ok", "color-ok-bg"],
  ["color-text", "color-caution-bg"],
  ["color-text", "color-risk-bg"],
  ["color-text", "color-ok-bg"],
  ["color-on-accent", "color-accent"],
  ["color-on-accent", "color-accent-strong"],
];

const DARK_MEDIA = /@media\s*\(\s*prefers-color-scheme:\s*dark\s*\)/;

/**
 * @param {string} css
 * @returns {Record<string, string>}
 */
function readHexTokens(css) {
  /** @type {Record<string, string>} */
  const tokens = {};
  for (const m of css.matchAll(/--([a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{6})\s*;/g)) {
    tokens[m[1]] = m[2].toLowerCase();
  }
  return tokens;
}

/**
 * Split tokens.css into the light palette and the dark palette (dark inherits unset tokens).
 * @param {string} css
 * @returns {{ light: Record<string, string>, dark: Record<string, string> }}
 */
export function parseThemes(css) {
  const cleaned = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const split = cleaned.search(DARK_MEDIA);
  if (split < 0) throw new Error("tokens.css has no prefers-color-scheme: dark block");
  const light = readHexTokens(cleaned.slice(0, split));
  const dark = { ...light, ...readHexTokens(cleaned.slice(split)) };
  return { light, dark };
}

function channel(v) {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hex) {
  const n = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => channel(parseInt(n.slice(i, i + 2), 16)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a, b) {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Every checked pair in both themes, with its ratio. */
export function checkContrast(css) {
  const themes = parseThemes(css);
  const rows = [];
  for (const [theme, tokens] of Object.entries(themes)) {
    for (const [fg, bg] of TEXT_PAIRS) {
      if (!tokens[fg] || !tokens[bg]) {
        rows.push({ theme, fg, bg, fgHex: tokens[fg], bgHex: tokens[bg], ratio: 0, pass: false });
        continue;
      }
      const ratio = contrastRatio(tokens[fg], tokens[bg]);
      rows.push({ theme, fg, bg, fgHex: tokens[fg], bgHex: tokens[bg], ratio, pass: ratio >= AA_NORMAL_TEXT });
    }
  }
  return rows;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const siteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const css = fs.readFileSync(path.join(siteRoot, "src/styles/tokens.css"), "utf8");
  const rows = checkContrast(css);
  for (const r of rows) {
    console.log(
      `${r.theme.padEnd(5)}  --${r.fg.padEnd(19)} ${String(r.fgHex).padEnd(7)} on --${r.bg.padEnd(18)} ${String(r.bgHex).padEnd(7)} ${r.ratio.toFixed(2).padStart(5)}:1 ${r.pass ? "AA" : "FAIL"}`,
    );
  }
  if (rows.some((r) => !r.pass)) process.exit(1);
}
