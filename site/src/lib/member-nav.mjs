// D32 / ADR-0029: signing in AUGMENTS the one site navigation.
//
// The public build is static and cannot know whether the browser has a session.
// This module asks the gate (`GET /private/me`) for the caller's own navigation
// additions and appends them to the existing band. A signed-out caller gets a
// 403 and the menu stays exactly as shipped; no private path is baked into the
// public JavaScript, because the gate supplies the hrefs.
//
// The gate is the authority. This only draws the menu.

/** The one endpoint. Hosting rewrites it to the gate. */
export const MEMBER_NAV_ENDPOINT = "/private/me";

/**
 * Normalise the gate's response. Anything malformed becomes "no additions".
 * @param {unknown} body
 */
export function memberNavFromResponse(body) {
  if (!body || typeof body !== "object") return { member: false, owner: false, projectsHref: "", items: [] };
  const items = Array.isArray(body.nav)
    ? body.nav
        .filter(
          (item) =>
            item &&
            typeof item === "object" &&
            typeof item.label === "string" &&
            typeof item.href === "string" &&
            item.label.trim() !== "" &&
            item.href.startsWith("/p/"),
        )
        .map((item) => ({ label: item.label, href: item.href }))
    : [];
  return {
    member: body.member === true,
    owner: body.owner === true,
    projectsHref: typeof body.projects_href === "string" ? body.projects_href : "",
    items,
  };
}

/**
 * Append the additions to a `.band-primary` list, skipping labels already
 * present. Returns the labels actually added, for tests.
 *
 * @param {Element | null | undefined} list
 * @param {ReturnType<typeof memberNavFromResponse>} nav
 */
export function applyMemberNav(list, nav) {
  if (!list || !nav.member) return [];
  const links = () => [...list.querySelectorAll("a")];
  const hasLabel = (label) =>
    links().some((link) => (link.textContent ?? "").trim().toLowerCase() === label.toLowerCase());

  // Keep one Projects entry, and point it at the canonical private index.
  if (nav.projectsHref) {
    const projects = links().find((link) => (link.textContent ?? "").trim().toLowerCase() === "projects");
    if (projects) projects.setAttribute("href", nav.projectsHref);
  }

  const added = [];
  for (const item of nav.items) {
    // Defense in depth: the gate only returns Admin to an owner, and the client
    // refuses to draw it for anyone else even if that response were malformed.
    if (item.label.toLowerCase() === "admin" && !nav.owner) continue;
    if (hasLabel(item.label)) continue;
    const row = document.createElement("li");
    const link = document.createElement("a");
    link.setAttribute("href", item.href);
    link.textContent = item.label;
    row.append(link);
    list.append(row);
    added.push(item.label);
  }
  return added;
}

/**
 * Ask the gate, then decorate. A failure is silent: the base menu is complete
 * for a signed-out visitor and for any member whose session is not recognised.
 *
 * @param {{fetch?: typeof globalThis.fetch, root?: Element | null}} [deps]
 */
export async function installMemberNav(deps = {}) {
  const fetchImpl = deps.fetch ?? globalThis.fetch;
  const root = deps.root ?? document.querySelector(".band-primary");
  if (!root) return [];
  let response;
  try {
    response = await fetchImpl(MEMBER_NAV_ENDPOINT, {
      method: "GET",
      credentials: "same-origin",
    });
  } catch {
    return [];
  }
  if (!response?.ok) return [];
  let body;
  try {
    body = await response.json();
  } catch {
    return [];
  }
  return applyMemberNav(root, memberNavFromResponse(body));
}
