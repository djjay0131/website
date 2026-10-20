// THE VIEWER'S ITEM LIST (D24 / ADR-0025).
//
// The landing page, the Shares page and My notes must not ship the whole private
// catalogue in static HTML: a signed-in member with one group would see every
// title before any access check ran. They ask the gate instead, which returns
// only the items the viewer may open.

/** The gate route that returns the viewer's items. */
export const PRIVATE_ITEMS_ENDPOINT = "/private/items";

/**
 * Normalise the gate's response into a plain array.
 * @param {unknown} body
 */
export function itemsFromResponse(body) {
  const items = body && typeof body === "object" ? body.items : null;
  return Array.isArray(items) ? items.filter((item) => item && typeof item === "object") : [];
}

/**
 * The items the owner may mint a share for. A share is a private item's
 * document; public items are already public and `data` items are not documents.
 * `entry` is the basename the gate stores so a token serves the real file.
 */
export function shareableItems(items) {
  return items.filter(
    (item) =>
      item.visibility === "private" &&
      item.source !== "hub" &&
      typeof item.entry === "string" &&
      item.entry !== "",
  );
}

/**
 * Load the viewer's items. A failure is an empty list, never a fallback to a
 * static catalogue.
 *
 * @param {{fetch?: typeof globalThis.fetch}} [deps]
 * @returns {Promise<{ok: true, items: object[]} | {ok: false, reason: string, items: []}>}
 */
export async function loadPrivateItems(deps = {}) {
  const fetchImpl = deps.fetch ?? globalThis.fetch;
  try {
    const response = await fetchImpl(PRIVATE_ITEMS_ENDPOINT, {
      method: "GET",
      credentials: "same-origin",
    });
    if (!response?.ok) return { ok: false, reason: "refused", items: [] };
    return { ok: true, items: itemsFromResponse(await response.json()) };
  } catch {
    return { ok: false, reason: "unreachable", items: [] };
  }
}
