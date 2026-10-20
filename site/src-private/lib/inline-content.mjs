// INLINE PROJECT CONTENT (D25).
//
// A private project page renders the satellite's document BODY inside the normal
// hub layout. It is not an iframe and not a link-out. Satellite documents are
// treated as untrusted input:
//
//   * scripts, frames, objects, forms and event-handler attributes are removed;
//   * `javascript:` and `data:` navigation is removed (images keep `data:` only
//     when the scheme is an image);
//   * document ids are prefixed and local `#fragment` links follow them, so a
//     satellite cannot collide with the hub's own ids (for example `sign-out`);
//   * linked stylesheets are read at build time and every rule is wrapped in a
//     CSS `@scope` block rooted at the document wrapper. A browser that does not
//     understand `@scope` ignores the rules, which fails safe: the satellite
//     cannot restyle the site chrome;
//   * CSS `position: fixed`, `z-index` and `@import` are neutralised, and
//     relative asset URLs are rewritten to the item's gated payload directory.
//
// The module runs only in the private build (Node), and is unit-tested against
// synthetic hostile HTML.
import fs from "node:fs";
import path from "node:path";
import { JSDOM } from "jsdom";

const REMOVED_ELEMENTS = [
  "script",
  "iframe",
  "frame",
  "frameset",
  "object",
  "embed",
  "applet",
  "base",
  "meta",
  "link",
  "noscript",
];

const URL_ATTRIBUTES = new Set([
  "href",
  "src",
  "poster",
  "action",
  "formaction",
  "xlink:href",
  "data",
]);

const DANGEROUS_STYLE = [
  [/position\s*:\s*fixed/gi, "position:static"],
  [/position\s*:\s*sticky/gi, "position:relative"],
  [/z-index\s*:\s*-?\d+/gi, "z-index:auto"],
  [/behavior\s*:[^;]+;?/gi, ""],
  [/-moz-binding\s*:[^;]+;?/gi, ""],
  [/expression\s*\(/gi, "none("],
];

function posixDir(value) {
  const dir = path.posix.dirname(String(value ?? ""));
  return dir === "." ? "" : dir;
}

function isExternal(value) {
  return /^(?:[a-z][a-z0-9+.-]*:|\/\/|\/|#)/i.test(value);
}

function joinUrl(base, relative) {
  const clean = String(relative ?? "").replace(/^\.\//, "");
  const joined = `${String(base).replace(/\/+$/, "")}/${clean}`;
  const normalised = path.posix.normalize(joined);
  return normalised.startsWith("/") ? normalised : `/${normalised}`;
}

/** Read one file, refusing to leave the source directory. */
export function readSourceFile(sourceDir, relative) {
  const root = path.resolve(sourceDir);
  const abs = path.resolve(root, relative);
  if (abs !== root && !abs.startsWith(`${root}${path.sep}`)) return null;
  try {
    return fs.readFileSync(abs, "utf8");
  } catch {
    return null;
  }
}

/** Rewrite every relative `url(...)` in CSS to an absolute gated payload URL. */
export function rewriteCssUrls(css, assetBase) {
  return String(css ?? "").replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi, (whole, quote, url) => {
    const value = url.trim();
    if (!value || isExternal(value) || /^data:/i.test(value)) return whole;
    return `url(${quote}${joinUrl(assetBase, value)}${quote})`;
  });
}

/**
 * Scope satellite CSS so it can only affect descendants of the document
 * wrapper. The `@scope` at-rule is the isolation mechanism: unsupported browsers
 * drop the block instead of applying unscoped global rules.
 */
export function scopeCss(css, scopeSelector = "[data-project-document]") {
  let scoped = String(css ?? "")
    .replace(/@import[^;]+;/gi, "")
    .replace(/url\(\s*(['"]?)javascript:[^)]*\1\s*\)/gi, "none")
    .replace(/:root\b/gi, ":scope")
    .replace(/(^|[},])\s*(?:html|body)(?=[\s,.#:[{])/gi, "$1 :scope");
  for (const [pattern, replacement] of DANGEROUS_STYLE) scoped = scoped.replace(pattern, replacement);
  return `@scope (${scopeSelector}) {\n${scoped}\n}`;
}

function sanitiseStyleAttribute(value) {
  let style = String(value ?? "");
  for (const [pattern, replacement] of DANGEROUS_STYLE) style = style.replace(pattern, replacement);
  style = style.replace(/url\(\s*(['"]?)javascript:[^)]*\1\s*\)/gi, "none");
  return style;
}

function rewriteAsset(value, payloadBase) {
  const text = String(value ?? "").trim();
  if (!text || isExternal(text) || /^data:image\//i.test(text)) return value;
  if (/^data:/i.test(text)) return "";
  const [url, suffix = ""] = text.split(/(?=[?#])/);
  return `${joinUrl(payloadBase, url)}${suffix}`;
}

function rewriteSrcset(value, payloadBase) {
  return String(value ?? "")
    .split(",")
    .map((part) => {
      const [url, ...descriptor] = part.trim().split(/\s+/);
      const rewritten = rewriteAsset(url, payloadBase);
      return [rewritten, ...descriptor].filter(Boolean).join(" ");
    })
    .filter(Boolean)
    .join(", ");
}

function prefixIds(document) {
  const map = new Map();
  let n = 0;
  for (const element of document.querySelectorAll("[id]")) {
    const old = element.getAttribute("id");
    if (!old) continue;
    let next = `doc-${old.replace(/[^A-Za-z0-9_-]/g, "-")}`;
    while (document.getElementById(next)) next = `doc-${n++}-${old}`;
    map.set(old, next);
    element.setAttribute("id", next);
  }
  for (const element of document.querySelectorAll("[for], [aria-labelledby], [aria-describedby], [aria-controls]")) {
    for (const attribute of ["for", "aria-labelledby", "aria-describedby", "aria-controls"]) {
      const value = element.getAttribute(attribute);
      if (!value) continue;
      element.setAttribute(
        attribute,
        value
          .split(/\s+/)
          .map((id) => map.get(id) ?? id)
          .join(" "),
      );
    }
  }
  return map;
}

/**
 * Prepare one satellite document for inline rendering.
 *
 * @param {{
 *   html: string,
 *   itemPath: string,
 *   sourceDir: string,
 *   payloadBase: string,
 *   pageForPath?: (relativePath: string) => string | null
 * }} options
 * @returns {{ html: string, css: string }}
 */
export function prepareInlineDocument(options) {
  const { html, itemPath, sourceDir, payloadBase, pageForPath = () => null } = options;
  const dom = new JSDOM(html, { runScripts: "outside-only" });
  const { document } = dom.window;
  const itemDir = posixDir(itemPath);
  const cssParts = [];

  for (const style of [...document.querySelectorAll("style")]) {
    cssParts.push({ css: style.textContent ?? "", urlBase: payloadBase });
    style.remove();
  }

  for (const link of [...document.querySelectorAll('link[rel~="stylesheet"][href]')]) {
    const href = link.getAttribute("href") ?? "";
    if (!href || isExternal(href)) {
      link.remove();
      continue;
    }
    const clean = href.split(/[?#]/)[0];
    const relative = path.posix.normalize(path.posix.join(itemDir, clean));
    if (relative.startsWith("..")) {
      link.remove();
      continue;
    }
    const css = readSourceFile(sourceDir, relative);
    if (css !== null) {
      const cssDir = posixDir(relative);
      cssParts.push({ css, urlBase: cssDir ? joinUrl(payloadBase, cssDir) : payloadBase });
    }
    link.remove();
  }

  for (const selector of REMOVED_ELEMENTS) {
    for (const element of [...document.querySelectorAll(selector)]) element.remove();
  }
  for (const selector of ["nav.pages", "footer"]) {
    for (const element of [...document.querySelectorAll(selector)]) element.remove();
  }

  const idMap = prefixIds(document);

  for (const element of [...document.querySelectorAll("*")]) {
    for (const attribute of [...element.attributes]) {
      const name = attribute.name.toLowerCase();
      const value = attribute.value;

      if (name.startsWith("on") || name === "srcdoc" || name === "ping") {
        element.removeAttribute(attribute.name);
        continue;
      }

      if (name === "style") {
        const safe = sanitiseStyleAttribute(value);
        if (safe.trim()) element.setAttribute("style", safe);
        else element.removeAttribute("style");
        continue;
      }

      if (/^(?:href|src|poster|action|formaction|data)$/i.test(name) || name === "xlink:href") {
        if (/^\s*javascript:/i.test(value)) {
          element.removeAttribute(attribute.name);
          continue;
        }
        let next = value;
        if (name === "href") {
          if (value.startsWith("#")) {
            const target = idMap.get(value.slice(1));
            next = target ? `#${target}` : value;
          } else if (!isExternal(value)) {
            const clean = value.split(/[?#]/)[0];
            const relative = path.posix.normalize(path.posix.join(itemDir, clean));
            const page = pageForPath(relative);
            next = page ?? rewriteAsset(value, payloadBase);
          }
        } else {
          next = rewriteAsset(value, payloadBase);
        }
        if (next) element.setAttribute(attribute.name, next);
        else element.removeAttribute(attribute.name);
        continue;
      }

      if (name === "srcset") {
        element.setAttribute("srcset", rewriteSrcset(value, payloadBase));
        continue;
      }
    }

    if (element.tagName === "A") {
      const href = element.getAttribute("href") ?? "";
      if (/^https?:/i.test(href)) {
        element.setAttribute("rel", "noopener noreferrer");
        if (!element.hasAttribute("target")) element.setAttribute("target", "_blank");
      }
    }
    if (["FORM", "INPUT", "BUTTON", "SELECT", "TEXTAREA"].includes(element.tagName)) {
      if (element.tagName === "FORM") {
        element.removeAttribute("action");
        element.setAttribute("onsubmit", "return false");
      } else {
        element.setAttribute("disabled", "");
      }
    }
  }

  for (const form of [...document.querySelectorAll("form")]) {
    form.replaceWith(...form.childNodes);
  }

  const css = cssParts
    .map((part) => scopeCss(rewriteCssUrls(part.css, part.urlBase)))
    .join("\n");

  return { html: document.body.innerHTML, css };
}
