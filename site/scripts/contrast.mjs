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
// The source explorer's flashed row (tr.flash) puts text, muted and link text
// on the caution tint.
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
  ["color-muted", "color-caution-bg"],
  ["color-link", "color-caution-bg"],
  ["color-on-accent", "color-accent"],
  ["color-on-accent", "color-accent-strong"],
];

// Site token → the tracker palette token it carries over (contract D2, amended).
// A site token either reads its source through var() or, where the source fails
// AA as text, holds the nearest compliant hex. tokens.test.ts enforces that.
/** @type {Record<string, string>} */
export const TOKEN_SOURCES = {
  "color-bg": "tracker-paper",
  "color-surface": "tracker-card",
  "color-border": "tracker-rule",
  "color-text": "tracker-ink",
  "color-muted": "tracker-ink-3",
  "color-accent": "tracker-petrol",
  "color-link": "tracker-petrol",
  "color-focus": "tracker-petrol",
  "color-caution": "tracker-brass",
  "color-caution-bg": "tracker-brass-soft",
  "color-risk": "tracker-clay",
  "color-risk-bg": "tracker-clay-soft",
};

const DARK_MEDIA = /@media\s*\(\s*prefers-color-scheme:\s*dark\s*\)/;
const VAR_REF = /^var\(\s*--([a-z0-9-]+)\s*\)$/;

/**
 * Colour declarations as written: a six-digit hex or a var() reference.
 * @param {string} css
 * @returns {Record<string, string>}
 */
function readColourDeclarations(css) {
  /** @type {Record<string, string>} */
  const decls = {};
  for (const m of css.matchAll(/--([a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{6}|var\(\s*--[a-z0-9-]+\s*\))\s*;/g)) {
    decls[m[1]] = m[2].toLowerCase().replace(/\s+/g, "");
  }
  return decls;
}

/**
 * Split tokens.css into the light and dark declarations, unresolved. Dark
 * inherits every declaration its block does not override.
 * @param {string} css
 * @returns {{ light: Record<string, string>, dark: Record<string, string> }}
 */
export function parseDeclarations(css) {
  const cleaned = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const split = cleaned.search(DARK_MEDIA);
  if (split < 0) throw new Error("tokens.css has no prefers-color-scheme: dark block");
  const light = readColourDeclarations(cleaned.slice(0, split));
  const dark = { ...light, ...readColourDeclarations(cleaned.slice(split)) };
  return { light, dark };
}

/**
 * Resolve var() references within one theme, as the browser does for custom
 * properties declared on the same element.
 * @param {Record<string, string>} decls
 * @returns {Record<string, string>}
 */
function resolveTheme(decls) {
  /** @type {Record<string, string>} */
  const out = {};
  for (const name of Object.keys(decls)) {
    let value = decls[name];
    const seen = new Set([name]);
    let m;
    while (value && (m = value.match(VAR_REF))) {
      if (seen.has(m[1])) throw new Error(`tokens.css: circular var() at --${name}`);
      seen.add(m[1]);
      value = decls[m[1]];
    }
    if (value) out[name] = value;
  }
  return out;
}

/**
 * The light and dark palettes, every token resolved to a hex value.
 * @param {string} css
 * @returns {{ light: Record<string, string>, dark: Record<string, string> }}
 */
export function parseThemes(css) {
  const { light, dark } = parseDeclarations(css);
  return { light: resolveTheme(light), dark: resolveTheme(dark) };
}

/** @param {number} v */
function channel(v) {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** @param {string} hex */
export function relativeLuminance(hex) {
  const n = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => channel(parseInt(n.slice(i, i + 2), 16)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * @param {string} a
 * @param {string} b
 */
export function contrastRatio(a, b) {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Every checked pair in both themes, with its ratio. Where the foreground is
 * an AA adjustment of a carried-over tracker colour, the row also carries that
 * colour and the ratio it would have had.
 * @param {string} css
 */
export function checkContrast(css) {
  const themes = parseThemes(css);
  const rows = [];
  for (const [theme, tokens] of Object.entries(themes)) {
    for (const [fg, bg] of TEXT_PAIRS) {
      const fgHex = tokens[fg];
      const bgHex = tokens[bg];
      if (!fgHex || !bgHex) {
        rows.push({ theme, fg, bg, fgHex, bgHex, ratio: 0, pass: false, sourceHex: undefined, sourceRatio: undefined });
        continue;
      }
      const ratio = contrastRatio(fgHex, bgHex);
      const source = TOKEN_SOURCES[fg];
      const sourceHex = source && tokens[source] !== fgHex ? tokens[source] : undefined;
      const sourceRatio = sourceHex ? contrastRatio(sourceHex, bgHex) : undefined;
      rows.push({ theme, fg, bg, fgHex, bgHex, ratio, pass: ratio >= AA_NORMAL_TEXT, sourceHex, sourceRatio });
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
    const carried =
      r.sourceHex && r.sourceRatio !== undefined
        ? `  (carried-over --${TOKEN_SOURCES[r.fg]} ${r.sourceHex}: ${r.sourceRatio.toFixed(2)}:1${r.sourceRatio < AA_NORMAL_TEXT ? " below AA" : ""})`
        : "";
    console.log(
      `${r.theme.padEnd(5)}  --${r.fg.padEnd(19)} ${String(r.fgHex).padEnd(7)} on --${r.bg.padEnd(18)} ${String(r.bgHex).padEnd(7)} ${r.ratio.toFixed(2).padStart(5)}:1 ${r.pass ? "AA" : "FAIL"}${carried}`,
    );
  }
  console.log(`${rows.length} pairs, ${rows.filter((r) => !r.pass).length} below AA`);
  if (rows.some((r) => !r.pass)) process.exit(1);
}
