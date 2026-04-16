/**
 * Markdown inline → HTML converter.
 * Mirrors cv/tools/converters.py:md_to_html exactly.
 * Supports: **bold**, *italic*, `code`. HTML-escapes specials.
 */

const BOLD = /\*\*([^*]+?)\*\*/g;
const ITALIC = /\*([^*]+?)\*/g;
const CODE = /`([^`]+?)`/g;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Sentinels for emphasis spans during HTML escaping.
const B_OPEN = "\x01B\x01";
const B_CLOSE = "\x01b\x01";
const I_OPEN = "\x01I\x01";
const I_CLOSE = "\x01i\x01";
const C_OPEN = "\x01C\x01";
const C_CLOSE = "\x01c\x01";

export function mdToHtml(s: string): string {
  if (!s) return s;

  // Stage 1: emphasis → sentinels (bold first so ** isn't eaten by *).
  s = s.replace(BOLD, (_, g) => `${B_OPEN}${g}${B_CLOSE}`);
  s = s.replace(ITALIC, (_, g) => `${I_OPEN}${g}${I_CLOSE}`);
  s = s.replace(CODE, (_, g) => `${C_OPEN}${g}${C_CLOSE}`);

  // Stage 2: HTML-escape.
  s = escapeHtml(s);

  // Stage 3: sentinels → HTML tags.
  s = s.replace(/\x01B\x01/g, "<strong>").replace(/\x01b\x01/g, "</strong>");
  s = s.replace(/\x01I\x01/g, "<em>").replace(/\x01i\x01/g, "</em>");
  s = s.replace(/\x01C\x01/g, "<code>").replace(/\x01c\x01/g, "</code>");
  return s;
}
