import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  checkContrast,
  contrastRatio,
  parseDeclarations,
  parseThemes,
  AA_NORMAL_TEXT,
  TEXT_PAIRS,
  TOKEN_SOURCES,
} from "../../scripts/contrast.mjs";

const css = fs.readFileSync(path.resolve("src/styles/tokens.css"), "utf8");

// The tracker and dossier palette, as contract site-phase-1 D2 (amended
// 2026-09-15) states it.
const TRACKER_PALETTE: Record<"light" | "dark", Record<string, string>> = {
  light: {
    paper: "#F4F5F1", "paper-2": "#EAEBE5", card: "#FBFBF8",
    ink: "#14181B", "ink-2": "#3C4448", "ink-3": "#6B7370",
    rule: "#D7D9D1", "rule-2": "#C3C6BC",
    petrol: "#0F5C5A", "petrol-soft": "#DDE9E7",
    brass: "#8A6512", "brass-soft": "#F0E7D2",
    clay: "#9C3B2E", "clay-soft": "#F3E0DC",
  },
  dark: {
    paper: "#111413", "paper-2": "#181C1B", card: "#1A1F1E",
    ink: "#EDEEE9", "ink-2": "#C0C5C0", "ink-3": "#8A918C",
    rule: "#2B312F", "rule-2": "#3A423F",
    petrol: "#6FC4BE", "petrol-soft": "#16302E",
    brass: "#D8AC5A", "brass-soft": "#2E2718",
    clay: "#E08A79", "clay-soft": "#33201C",
  },
};

// The only tokens allowed to leave the tracker palette for a reason other than
// AA. They are the brand accent family, and they point at the --vt-* ramp instead
// (tokens.css). Everything else in TOKEN_SOURCES -- surfaces, text, muted, and the
// status colours -- stays governed by the mapping rule below, so this carve-out is
// three tokens wide and no wider. The test after it proves these three really do
// resolve to the VT ramp, so exempting them from one rule does not leave them
// unguarded.
const BRAND_ACCENT_TOKENS = new Set(["color-accent", "color-link", "color-focus"]);

describe("design tokens", () => {
  it("computes WCAG contrast correctly", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrastRatio("#777777", "#ffffff")).toBeCloseTo(4.48, 2);
  });

  // The accent family is Virginia Tech's, not the tracker's. Maroon leads in the
  // light theme and burnt orange in the dark one, because Chicago Maroon at
  // #861f41 is very nearly black against the dark ground -- it fails AA as text.
  // Both are VT primaries; which one leads is a legibility decision.
  //
  // This test is pinned deliberately. It replaced one that pinned the petrol
  // accent, and it exists for the same reason that one did: so the brand cannot
  // drift a shade at a time without someone saying so.
  it("uses the VT accent: Chicago Maroon in light, Burnt Orange in dark", () => {
    const themes = parseThemes(css);
    expect(themes.light["color-accent"]).toBe("#861f41");
    expect(themes.dark["color-accent"]).toBe("#f0913f");
  });

  it("carries over the tracker palette verbatim in both themes", () => {
    const themes = parseThemes(css);
    for (const theme of ["light", "dark"] as const) {
      for (const [name, hex] of Object.entries(TRACKER_PALETTE[theme])) {
        expect(themes[theme][`tracker-${name}`], `${theme} --tracker-${name}`).toBe(hex.toLowerCase());
      }
    }
  });

  it("maps each site token onto its tracker colour, departing only for AA", () => {
    const declarations = parseDeclarations(css);
    const themes = parseThemes(css);
    for (const theme of ["light", "dark"] as const) {
      for (const [token, source] of Object.entries(TOKEN_SOURCES)) {
        if (BRAND_ACCENT_TOKENS.has(token)) continue;
        if (declarations[theme][token] === `var(--${source})`) continue;
        // A literal value is allowed only where the carried-over colour fails
        // a checked text pair for this token, and the replacement passes.
        const tokens = themes[theme];
        const pairs = TEXT_PAIRS.filter(([fg]) => fg === token);
        const sourceFails = pairs.some(([, bg]) => contrastRatio(tokens[source], tokens[bg]) < AA_NORMAL_TEXT);
        expect(sourceFails, `${theme} --${token} departs from --${source} without an AA failure`).toBe(true);
      }
    }
  });

  it("points every brand accent token at the VT ramp, in both themes", () => {
    const declarations = parseDeclarations(css);
    const themes = parseThemes(css);
    const vt = { light: "#861f41", dark: "#f0913f" };
    for (const theme of ["light", "dark"] as const) {
      for (const token of BRAND_ACCENT_TOKENS) {
        expect(declarations[theme][token], `${theme} --${token}`).toMatch(/^var\(--vt-/);
        expect(themes[theme][token], `${theme} --${token} resolves`).toBe(vt[theme]);
      }
    }
  });

  it("defines a dark palette that differs from the light one", () => {
    const { light, dark } = parseThemes(css);
    expect(dark["color-bg"]).not.toBe(light["color-bg"]);
    expect(dark["color-text"]).not.toBe(light["color-text"]);
  });

  it("switches theme with prefers-color-scheme, not JavaScript", () => {
    expect(css).toMatch(/@media\s*\(\s*prefers-color-scheme:\s*dark\s*\)/);
    expect(css).not.toMatch(/\[data-theme/);
  });

  it("names the three §5 typefaces", () => {
    expect(css).toMatch(/--font-display:\s*"Spectral"/);
    expect(css).toMatch(/--font-body:\s*"IBM Plex Sans"/);
    expect(css).toMatch(/--font-mono:\s*"IBM Plex Mono"/);
  });

  it("keeps every text pair at WCAG AA in both themes", () => {
    const failing = checkContrast(css)
      .filter((r) => !r.pass)
      .map((r) => `${r.theme}: --${r.fg} on --${r.bg} = ${r.ratio.toFixed(2)}`);
    expect(failing, `below ${AA_NORMAL_TEXT}:1`).toEqual([]);
  });
});
