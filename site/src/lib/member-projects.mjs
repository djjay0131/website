// D34: the public Projects page becomes dynamic for a signed-in viewer.
//
// The public build is static and must not know what private projects exist
// (ADR-0016, ADR-0026). This island asks the gate who is calling
// (`/private/me`); only for a member does it fetch that viewer's OWN items
// (`/private/items`, already filtered and relationship-pruned by the gate,
// ADR-0030) and draw them as cards above the public list, grouped exactly as
// the private index groups them. A signed-out visitor, or any failure, leaves
// the section hidden and the page exactly as built. Every string is written
// with textContent and every link must stay under /p/.

import { buildProjects } from "./projects-model.mjs";
import { MEMBER_NAV_ENDPOINT, memberNavFromResponse } from "./member-nav.mjs";

export const MEMBER_ITEMS_ENDPOINT = "/private/items";
const PRIVATE_PREFIX = "/p/";

// Links come from the gate (projects_href) and from the viewer's own items; the
// public bundle hard-codes no private path (ADR-0029). Anything that is not a
// same-site /p/ path is dropped.
function safeHref(href) {
  return typeof href === "string" && href.startsWith(PRIVATE_PREFIX) && !href.includes("..") ? href : "";
}

function link(href, text, attrs = {}) {
  const safe = safeHref(href);
  return safe ? el("a", { ...attrs, href: safe, text }) : el("span", { ...attrs, text });
}

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === "text") node.textContent = value;
    else node.setAttribute(key, value);
  }
  node.append(...children);
  return node;
}

function card(project) {
  const article = el("article", { class: "member-project" });
  const heading = el("h3", { class: "member-project-title" }, link(project.href, project.title));
  article.append(heading);
  if (project.description) article.append(el("p", { class: "member-project-description", text: project.description }));
  if (project.children?.length) {
    const list = el("ul", { class: "member-project-children", "aria-label": `Projects in ${project.title}` });
    for (const child of project.children) {
      list.append(el("li", {}, link(child.href, child.title)));
    }
    article.append(list);
  }
  return article;
}

/**
 * Draw the viewer's projects into `root`. Returns the top-level titles drawn.
 * @param {HTMLElement} root
 * @param {object[]} items
 * @param {string} [projectsHref]
 */
export function renderMemberProjects(root, items, projectsHref = "") {
  const projects = buildProjects(Array.isArray(items) ? items : []);
  root.replaceChildren();
  if (projects.length === 0) {
    root.hidden = true;
    return [];
  }
  const header = el("div", { class: "member-projects-header" });
  header.append(el("h2", { text: "Your private projects" }));
  if (safeHref(projectsHref)) {
    header.append(el("a", { class: "member-projects-all", href: safeHref(projectsHref), text: "Open all private projects →" }));
  }
  const grid = el("div", { class: "member-projects-grid" });
  for (const project of projects) grid.append(card(project));
  root.append(header, grid);
  root.hidden = false;
  return projects.map((project) => project.title);
}

async function getJson(fetchImpl, url) {
  const response = await fetchImpl(url, { method: "GET", credentials: "same-origin" });
  if (!response?.ok) return null;
  return response.json();
}

/**
 * Ask the gate, then draw. Silent on any failure.
 * @param {{fetch?: typeof globalThis.fetch, root?: HTMLElement | null}} [deps]
 */
export async function installMemberProjects(deps = {}) {
  const fetchImpl = deps.fetch ?? globalThis.fetch;
  const root = deps.root ?? document.querySelector("[data-member-projects]");
  if (!root) return [];
  try {
    const nav = memberNavFromResponse(await getJson(fetchImpl, MEMBER_NAV_ENDPOINT));
    if (!nav.member) return [];
    const body = await getJson(fetchImpl, MEMBER_ITEMS_ENDPOINT);
    const items = body && Array.isArray(body.items) ? body.items : [];
    return renderMemberProjects(root, items, nav.projectsHref);
  } catch {
    root.hidden = true;
    return [];
  }
}
