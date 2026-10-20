// DOM rendering for the Projects landing and a project's sub-navigation (D25).
//
// Every string from `/private/items` is written with textContent, never
// innerHTML. The gate has already filtered the list, so a page the viewer cannot
// open never reaches these functions.
import {
  buildProjects,
  neighbours,
  pageLabel,
  projectPageHref,
  projectPages,
  projectTitle,
} from "./projects.mjs";

function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null || value === false) continue;
    if (key === "class") node.className = String(value);
    else if (key === "text") node.textContent = String(value);
    else node.setAttribute(key, String(value));
  }
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    node.append(typeof child === "string" ? document.createTextNode(child) : child);
  }
  return node;
}

/** Render one card per project into `root`. */
export function mountProjectLanding(root, items, base = "/p/") {
  const projects = buildProjects(items);
  root.replaceChildren();

  if (projects.length === 0) {
    root.append(el("p", { class: "projects-empty", text: "No projects are available for this account yet." }));
    return projects;
  }

  const list = el("ul", { class: "project-cards" });
  for (const project of projects) {
    const card = el("li", { class: "project-card" });
    const heading = el("h2", { class: "project-card-title" });
    heading.append(el("a", { href: project.href, text: project.title }));
    const description = el("p", {
      class: "project-card-description",
      text: project.description || "Private project.",
    });
    const meta = el("dl", { class: "project-card-meta" });
    meta.append(
      el("div", {}, el("dt", { text: "Pages" }), el("dd", { text: String(project.itemCount) })),
      el("div", {}, el("dt", { text: "Updated" }), el("dd", { text: project.lastUpdated ?? "—" })),
    );
    card.append(heading, description, meta);
    list.append(card);
  }
  root.append(list);
  return projects;
}

/** Render a project hub page's clickable page cards. */
export function mountProjectPages(root, items, source, base = "/p/", title) {
  const pages = projectPages(items, source);
  root.replaceChildren();
  if (pages.length === 0) {
    root.append(el("p", { class: "projects-empty", text: "No pages are available for this project yet." }));
    return pages;
  }
  const projectName = title || projectTitle(pages, source);
  const list = el("ul", { class: "project-pages" });
  for (const item of pages) {
    const card = el("li", { class: "project-page-card" });
    const heading = el("h2", { class: "project-page-title" });
    heading.append(el("a", { href: projectPageHref(item, base), text: pageLabel(item, projectName) }));
    const meta = el("p", {
      class: "project-page-meta",
      text: [item.date, item.summary].filter(Boolean).join(" · "),
    });
    card.append(heading, meta);
    list.append(card);
  }
  root.append(list);
  return pages;
}

/** Render a project's sub-navigation and previous/next links. */
export function mountProjectNavigation({ navRoot, prevRoot, items, source, slug, base = "/p/", title }) {
  const around = neighbours(items, source, slug);
  const pages = around.pages;
  const projectName = title || projectTitle(pages, source);

  if (navRoot) {
    navRoot.replaceChildren();
    if (pages.length === 0) {
      navRoot.append(el("p", { class: "project-nav-note", text: "No project pages are available." }));
    } else {
      const list = el("ul", { class: "project-subnav-list" });
      for (const item of pages) {
        const link = el("a", {
          href: projectPageHref(item, base),
          text: pageLabel(item, projectName),
        });
        if (item.slug === slug) link.setAttribute("aria-current", "page");
        list.append(el("li", {}, link));
      }
      navRoot.append(list);
    }
  }

  if (prevRoot) {
    prevRoot.replaceChildren();
    if (around.previous) {
      prevRoot.append(
        el(
          "a",
          { class: "project-prev", href: projectPageHref(around.previous, base), rel: "prev" },
          el("span", { class: "project-prev-label", text: "Previous" }),
          el("span", { text: pageLabel(around.previous, projectName) }),
        ),
      );
    }
    if (around.next) {
      prevRoot.append(
        el(
          "a",
          { class: "project-next", href: projectPageHref(around.next, base), rel: "next" },
          el("span", { class: "project-prev-label", text: "Next" }),
          el("span", { text: pageLabel(around.next, projectName) }),
        ),
      );
    }
  }

  return around;
}

/** A small failure message that does not pretend the project is empty. */
export function showProjectError(root, message) {
  root.replaceChildren(el("p", { class: "project-nav-note", role: "alert", text: message }));
}

/** The pages of one source, for a project hub page. */
export function pagesForProject(items, source) {
  return projectPages(items, source);
}
