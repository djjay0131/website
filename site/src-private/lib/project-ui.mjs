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
  projectRelations,
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
    if (project.children?.length) {
      meta.append(
        el("div", {}, el("dt", { text: "Projects" }), el("dd", { text: String(project.children.length) })),
      );
    }
    card.append(heading, description);
    // ADR-0030: a parent's card lists the child projects the viewer can open.
    if (project.children?.length) {
      card.classList.add("project-card-parent");
      const children = el("ul", { class: "project-card-children", "aria-label": `Projects in ${project.title}` });
      for (const child of project.children) {
        children.append(el("li", {}, el("a", { href: child.href, text: child.title })));
      }
      card.append(children);
    }
    card.append(meta);
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

/**
 * Render previous/next links.
 *
 * D32 / ADR-0029 removed the duplicate in-project sub-navigation: the
 * breadcrumb is the depth navigation and the project home page lists the
 * project's pages. `navRoot` is accepted and ignored so older callers cannot
 * bring the duplicate list back by accident.
 */
export function mountProjectNavigation({ prevRoot, items, source, slug, base = "/p/", title }) {
  const around = neighbours(items, source, slug);
  const pages = around.pages;
  const projectName = title || projectTitle(pages, source);

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

/**
 * ADR-0030: a project page's relationships -- the child projects of a parent,
 * and related projects -- limited to projects the viewer can open. Renders
 * nothing (and hides `root`) when there are none.
 */
export function mountProjectRelations(root, items, source) {
  const { children, related } = projectRelations(items, source);
  root.replaceChildren();
  const groups = [
    ["Projects in this space", "project-children", children],
    ["Related projects", "project-related", related],
  ];
  let shown = 0;
  for (const [label, cls, links] of groups) {
    if (!links.length) continue;
    shown += 1;
    const section = el("section", { class: `project-relations ${cls}` });
    section.append(el("h2", { text: label }));
    const list = el("ul", { class: "project-relations-list" });
    for (const project of links) {
      list.append(el("li", {}, el("a", { href: project.href, text: project.title })));
    }
    section.append(list);
    root.append(section);
  }
  root.hidden = shown === 0;
  return { children, related };
}

/**
 * ADR-0030: fill a breadcrumb slot with the parent project, when the viewer can
 * open it. The slot stays hidden otherwise, so no parent name is ever in the
 * static page.
 */
export function mountParentCrumb(slot, items, source) {
  const { parent } = projectRelations(items, source);
  slot.replaceChildren();
  if (!parent) {
    slot.hidden = true;
    return null;
  }
  slot.append(el("a", { href: parent.href, text: parent.title }));
  slot.hidden = false;
  return parent;
}

/** A small failure message that does not pretend the project is empty. */
export function showProjectError(root, message) {
  root.replaceChildren(el("p", { class: "project-nav-note", role: "alert", text: message }));
}

/** The pages of one source, for a project hub page. */
export function pagesForProject(items, source) {
  return projectPages(items, source);
}
