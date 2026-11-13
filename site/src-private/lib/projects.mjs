// THE MEMBERS' PROJECTS MODEL (D25).
//
// D24 served private items as one flat list under "Shared with you". D25 turns
// the private area into project sections inside the normal site: one card per
// project on the landing page, a project section with its own sub-navigation,
// and each item inline in the site layout.
//
// Everything here is derived from the viewer's own `/private/items` response,
// which the gate has already filtered by access. Nothing in this module may be
// used to build a static catalogue: a page that a viewer cannot open must not
// appear in their cards or sub-navigation.
//
// This module is deliberately plain JS with no Astro imports so it can be used
// from both a client script and a vitest file.

/** Sections that are document collections rather than project sections. */
export const NON_PROJECT_SECTIONS = new Set(["cv"]);

/** The landing page route, below the private base. */
export const PROJECTS_ROOT = "projects";

/** True when this item belongs in a project section. */
export function isProjectItem(item) {
  if (!item || typeof item !== "object") return false;
  if (NON_PROJECT_SECTIONS.has(item.section)) return false;
  if (item.source === "hub") return false;
  return item.visibility === "private";
}

/** The project key: one section per satellite source. */
export function projectKey(item) {
  return String(item?.source ?? "");
}

/** A project's route. */
export function projectHref(item, base = "/p/") {
  const prefix = String(base ?? "/").replace(/\/+$/, "");
  return `${prefix}/${PROJECTS_ROOT}/${projectKey(item)}/`;
}

/** A project page's route. */
export function projectPageHref(item, base = "/p/") {
  const prefix = String(base ?? "/").replace(/\/+$/, "");
  return `${prefix}/${PROJECTS_ROOT}/${projectKey(item)}/${item.slug}/`;
}

/** The pre-D25 item route, kept working. */
export function legacyItemHref(item, base = "/p/") {
  const prefix = String(base ?? "/").replace(/\/+$/, "");
  return `${prefix}/${item.section}/${item.source}/${item.slug}/`;
}

function words(value) {
  return String(value ?? "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** A readable fallback when a title cannot be derived from the items. */
export function titleFromSource(source) {
  const text = words(source);
  if (!text) return "Project";
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function commonPrefix(values) {
  if (values.length === 0) return "";
  let prefix = values[0];
  for (const value of values.slice(1)) {
    let at = 0;
    while (at < prefix.length && at < value.length && prefix[at] === value[at]) at += 1;
    prefix = prefix.slice(0, at);
    if (!prefix) break;
  }
  return prefix;
}

/** The project name shown on cards and breadcrumbs. */
export function projectTitle(items, source = "") {
  const titles = (items ?? []).map((item) => String(item.title ?? "")).filter(Boolean);
  if (titles.length === 0) return titleFromSource(source);
  if (titles.length === 1) {
    const split = titles[0].split(/\s+[—–]\s+|:\s+/);
    if (split.length > 1 && split[0].trim().length >= 3) return split[0].trim();
  }
  const prefix = commonPrefix(titles).trim();
  const cleaned = prefix.replace(/[\s:—–-]+$/, "").trim();
  if (cleaned.length >= 3) return cleaned;
  const first = titles[0].split(/\s+[—–]\s+|:\s+/)[0].trim();
  if (first.length >= 3 && first.length < titles[0].length) return first;
  return titleFromSource(source);
}

/** The short description for a project card. */
export function projectDescription(items) {
  const first = (items ?? []).find((item) => typeof item.summary === "string" && item.summary);
  if (!first) return "";
  const text = String(first.summary).replace(/\s+/g, " ").trim();
  return text.length > 180 ? `${text.slice(0, 177).trimEnd()}…` : text;
}

/** The sub-page label inside a project. */
export function pageLabel(item, title = projectTitle([item], item.source)) {
  let text = String(item?.title ?? item?.slug ?? "Page").trim();
  const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (escaped) {
    text = text.replace(new RegExp(`^${escaped}\\s*(?:[:—–-]\\s*)?`, "i"), "").trim();
  }
  if (!text) text = words(item?.slug ?? "Page") || "Page";
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Manifest order, then date descending, then title. */
export function compareProjectItems(a, b) {
  const ao = Number.isInteger(a?.order) ? a.order : Number.MAX_SAFE_INTEGER;
  const bo = Number.isInteger(b?.order) ? b.order : Number.MAX_SAFE_INTEGER;
  if (ao !== bo) return ao - bo;
  const ad = String(a?.date ?? "");
  const bd = String(b?.date ?? "");
  if (ad !== bd) return ad < bd ? 1 : -1;
  return String(a?.title ?? "").localeCompare(String(b?.title ?? ""));
}

/** The pages of one project, in manifest order. */
export function projectPages(items, source) {
  return (items ?? [])
    .filter((item) => isProjectItem(item) && item.source === source)
    .sort(compareProjectItems);
}

/** Cards for every project the viewer can open, before grouping (D25). */
export function buildProjects(items) {
  return groupProjects(buildFlatProjects(items));
}

// --- Project relationships (ADR-0030) --------------------------------------
//
// A satellite may name a parent project and related projects in its manifest.
// They reach this module ONLY on items the gate already let the viewer open, so
// a relationship is shown only when the viewer can open BOTH projects: a child
// whose parent the viewer cannot see stays a top-level card, and a related key
// the viewer cannot open is silently dropped. Nesting is one level deep: a
// project that itself names a visible parent is never treated as a parent.

/** The parent key a project's items declare, or null. */
function declaredParent(pages) {
  for (const item of pages) {
    if (typeof item?.parent === "string" && item.parent) return item.parent;
  }
  return null;
}

/** The related keys a project's items declare, de-duplicated. */
function declaredRelated(pages) {
  const keys = [];
  for (const item of pages) {
    for (const key of Array.isArray(item?.related) ? item.related : []) {
      if (typeof key === "string" && key && !keys.includes(key)) keys.push(key);
    }
  }
  return keys;
}

function link(project) {
  return { source: project.source, title: project.title, href: project.href };
}

/**
 * Nest children under visible parents and resolve related links.
 * Returns the top-level projects; each carries `children`, `related` and
 * (for a child) `parent`, all limited to projects in the same list.
 */
export function groupProjects(flat) {
  const bySource = new Map(flat.map((project) => [project.source, project]));
  const declared = new Map(flat.map((project) => [project.source, declaredParent(project.pages)]));

  const parentOf = (source) => {
    const key = declared.get(source);
    if (!key || key === source || !bySource.has(key)) return null;
    // One level: a parent that itself sits under a visible parent is not one.
    const grand = declared.get(key);
    if (grand && grand !== key && bySource.has(grand)) return null;
    return key;
  };

  const enriched = flat.map((project) => ({
    ...project,
    parent: null,
    children: [],
    related: [],
  }));
  const byKey = new Map(enriched.map((project) => [project.source, project]));

  for (const project of enriched) {
    const key = parentOf(project.source);
    if (key) {
      const parent = byKey.get(key);
      project.parent = link(parent);
      parent.children.push(project);
    }
  }
  for (const project of enriched) {
    project.children.sort((a, b) => a.title.localeCompare(b.title));
    const own = new Set([project.source, project.parent?.source, ...project.children.map((c) => c.source)]);
    project.related = declaredRelated(project.pages)
      .filter((key) => !own.has(key) && byKey.has(key))
      .map((key) => link(byKey.get(key)));
  }
  return enriched.filter((project) => !project.parent);
}

/** One project's resolved relationships, for its hub page and breadcrumbs. */
export function projectRelations(items, source) {
  const flat = buildFlatProjects(items);
  const top = groupProjects(flat);
  const all = top.flatMap((project) => [project, ...project.children]);
  const found = all.find((project) => project.source === source);
  if (!found) return { parent: null, children: [], related: [] };
  return {
    parent: found.parent,
    children: found.children.map(link),
    related: found.related,
  };
}

/** Cards for the landing page, newest project first, ungrouped. */
export function buildFlatProjects(items) {
  const bySource = new Map();
  for (const item of items ?? []) {
    if (!isProjectItem(item)) continue;
    const key = projectKey(item);
    if (!bySource.has(key)) bySource.set(key, []);
    bySource.get(key).push(item);
  }

  return [...bySource.entries()]
    .map(([source, projectItems]) => {
      const pages = projectItems.slice().sort(compareProjectItems);
      const lastUpdated = pages
        .map((item) => String(item.date ?? ""))
        .filter(Boolean)
        .sort()
        .at(-1);
      return {
        source,
        title: projectTitle(pages, source),
        description: projectDescription(pages),
        itemCount: pages.length,
        lastUpdated: lastUpdated || null,
        href: projectHref(pages[0]),
        pages,
      };
    })
    .sort((a, b) => {
      const ad = a.lastUpdated ?? "";
      const bd = b.lastUpdated ?? "";
      if (ad !== bd) return ad < bd ? 1 : -1;
      return a.title.localeCompare(b.title);
    });
}

/** Breadcrumb data: Projects › project › page. */
export function breadcrumb(item, title, base = "/p/") {
  return [
    { label: "Projects", href: String(base ?? "/") },
    { label: title, href: projectHref(item, base) },
    { label: pageLabel(item, title), href: projectPageHref(item, base) },
  ];
}

/** Previous and next pages among the viewer's own pages. */
export function neighbours(items, source, slug) {
  const pages = projectPages(items, source);
  const at = pages.findIndex((item) => item.slug === slug);
  if (at < 0) return { previous: null, next: null, pages };
  return {
    previous: at > 0 ? pages[at - 1] : null,
    next: at + 1 < pages.length ? pages[at + 1] : null,
    pages,
  };
}
