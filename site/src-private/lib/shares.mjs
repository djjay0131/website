// THE SHARES ISLAND'S PURE LOGIC (SEAM-S6; contract site-wave-3 requirement 3).
//
// The Shares page is owner UI in the PRIVATE build only. This module holds
// everything about it that is not React -- endpoints, request shapes, the
// status->UI branch, validation and token retention -- so each can be asserted
// by a test without a DOM, exactly as signout.mjs pins the sign-out call.
//
// THE FIVE PROPERTIES THAT MATTER, AND WHY THEY ARE HERE RATHER THAN IN JSX:
//
//   1. Every management call is SAME-ORIGIN (a bare path, never an absolute
//      *.run.app URL) and carries `credentials: "same-origin"`. Firebase
//      Hosting rewrites /share/** to the gate, so a path reaches the same
//      service an absolute URL would while keeping the Origin the gate accepts.
//   2. GET /share drives the owner check. A 403 means the caller is a member but
//      not the owner, so NO mint/revoke control is rendered. The gate enforces
//      it regardless of what the browser draws; hiding the controls is UX, not
//      security.
//   3. The full token is returned only by the mint that created it, and is
//      retained in sessionStorage keyed by the row's short id. GET /share
//      deliberately never returns a token (gate ruling 2), so a row saved in a
//      previous session, or on another device, can only be revoked by pasting
//      its token or link.
//   4. A token is never logged and is sent nowhere but DELETE /share/{token}.
//   5. Revocation is idempotent from the caller's side: the retained token is
//      forgotten after a successful DELETE.

/** The one management endpoint. Hosting rewrites it to the gate (SEAM-S4). */
export const SHARE_ENDPOINT = "/share";

/** sessionStorage key prefix for a retained full token. */
export const SHARE_TOKEN_STORAGE_PREFIX = "hub:share-token:";

/** SEAM-S1: expires_in_days is bounded to [1, 30] on the server and here. */
export const MIN_SHARE_DAYS = 1;
export const MAX_SHARE_DAYS = 30;

/**
 * How many leading token characters form the row's display id.
 *
 * Mirrors the gate's `SHARE_ID_CHARS = 12` (`gate/app/main.py`). The mint
 * response carries the full token but not the id, so the island derives the id
 * from the token to key sessionStorage by the same value GET /share returns.
 */
export const SHARE_ID_CHARS = 12;

/** @returns {{method: "GET", credentials: "same-origin"}} */
export function shareListRequestInit() {
  return { method: "GET", credentials: "same-origin" };
}

/**
 * The mint request. EXACTLY the SEAM-S1 body: `{section, source, slug,
 * expires_in_days}`. Same-origin, so the JSON content-type costs no preflight.
 *
 * @param {{section: string, source: string, slug: string, expires_in_days: number}} input
 * @returns {{method: "POST", credentials: "same-origin", headers: Record<string,string>, body: string}}
 */
export function shareMintRequestInit(input) {
  return {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      section: input.section,
      source: input.source,
      slug: input.slug,
      expires_in_days: input.expires_in_days,
    }),
  };
}

/** @returns {{method: "DELETE", credentials: "same-origin"}} */
export function shareRevokeRequestInit() {
  return { method: "DELETE", credentials: "same-origin" };
}

/**
 * The same-origin revoke path for a token.
 *
 * @param {string} token
 * @returns {string}
 */
export function shareRevokeEndpoint(token) {
  return `${SHARE_ENDPOINT}/${encodeURIComponent(token)}`;
}

/** The short display id the gate returns for a token. @param {string} token */
export function idFromToken(token) {
  return String(token ?? "").slice(0, SHARE_ID_CHARS);
}

/** @param {string} id */
export function tokenStorageKey(id) {
  return `${SHARE_TOKEN_STORAGE_PREFIX}${id}`;
}

/**
 * Validate the mint form before it reaches the network.
 *
 * @param {{section?: unknown, source?: unknown, slug?: unknown, expires_in_days?: unknown}} input
 * @returns {{ok: true, value: {section: string, source: string, slug: string, expires_in_days: number}} | {ok: false, errors: string[]}}
 */
export function validateMintInput(input) {
  const errors = [];
  const section = typeof input?.section === "string" ? input.section.trim() : "";
  const source = typeof input?.source === "string" ? input.source.trim() : "";
  const slug = typeof input?.slug === "string" ? input.slug.trim() : "";
  const days = input?.expires_in_days;
  if (!section) errors.push("section is required");
  if (!source) errors.push("source is required");
  if (!slug) errors.push("slug is required");
  if (
    typeof days !== "number" ||
    !Number.isInteger(days) ||
    days < MIN_SHARE_DAYS ||
    days > MAX_SHARE_DAYS
  ) {
    errors.push(`expires_in_days must be a whole number from ${MIN_SHARE_DAYS} to ${MAX_SHARE_DAYS}`);
  }
  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, value: { section, source, slug, expires_in_days: days } };
}

/**
 * Pull a token out of a pasted share URL, a pasted `/s/<token>/...` path, or a
 * bare token. Returns null when nothing token-shaped is present.
 *
 * @param {string} text
 * @returns {string | null}
 */
export function tokenFromShareUrl(text) {
  const raw = String(text ?? "").trim();
  if (raw === "") return null;
  const fromPath = raw.match(/\/s\/([A-Za-z0-9_-]+)/);
  if (fromPath) return fromPath[1];
  if (/^[A-Za-z0-9_-]+$/.test(raw)) return raw;
  return null;
}

/**
 * Map a list outcome to the capabilities the island may render.
 *
 * On 403 (`forbidden`) NO mint/revoke control is offered. This is the
 * status->UI branch the contract asks to be testable without a DOM.
 *
 * @param {{ok: boolean, forbidden?: boolean, shares?: unknown[]}} result
 * @returns {{kind: "error"|"forbidden"|"ready", rows: unknown[], canMint: boolean, canRevoke: boolean}}
 */
export function sharesView(result) {
  if (!result?.ok) return { kind: "error", rows: [], canMint: false, canRevoke: false };
  if (result.forbidden) return { kind: "forbidden", rows: [], canMint: false, canRevoke: false };
  return { kind: "ready", rows: result.shares ?? [], canMint: true, canRevoke: true };
}

/**
 * Retain a full token under its row id. sessionStorage may be absent or throw
 * (private mode); a failure to remember the token must not fail the mint.
 *
 * @param {string} id
 * @param {string} token
 * @param {Storage} storage
 */
export function retainToken(id, token, storage) {
  try {
    storage?.setItem(tokenStorageKey(id), token);
  } catch {
    /* remembering is best-effort; the mint already succeeded */
  }
}

/** @param {string} id @param {Storage} storage @returns {string | null} */
export function retainedToken(id, storage) {
  try {
    return storage?.getItem(tokenStorageKey(id)) ?? null;
  } catch {
    return null;
  }
}

/** @param {string} id @param {Storage} storage */
export function forgetToken(id, storage) {
  try {
    storage?.removeItem(tokenStorageKey(id));
  } catch {
    /* nothing to do */
  }
}

/** True when the retained token for this row is still in session storage. */
export function canRevokeRow(row, storage) {
  return Boolean(retainedToken(row?.id, storage));
}

/**
 * Load the active shares. A 403 is a SUCCESSFUL read that reports "not owner":
 * the caller is authenticated as some member, so it is not an error state.
 *
 * @param {{fetch?: typeof globalThis.fetch}} [deps]
 * @returns {Promise<{ok: true, forbidden: boolean, shares: unknown[]} | {ok: false, reason: string, status?: number, error?: unknown}>}
 */
export async function listShares(deps = {}) {
  const fetchImpl = deps.fetch ?? globalThis.fetch;
  let response;
  try {
    response = await fetchImpl(SHARE_ENDPOINT, shareListRequestInit());
  } catch (error) {
    return { ok: false, reason: "unreachable", error };
  }
  if (response?.status === 403) return { ok: true, forbidden: true, shares: [] };
  if (!response?.ok) return { ok: false, reason: "refused", status: response?.status ?? 0 };
  let data;
  try {
    data = await response.json();
  } catch {
    return { ok: false, reason: "malformed" };
  }
  return { ok: true, forbidden: false, shares: Array.isArray(data?.shares) ? data.shares : [] };
}

/**
 * Mint a share. The returned token is retained and deliberately NOT returned:
 * the caller gets the copyable URL, never the credential.
 *
 * @param {{section: string, source: string, slug: string, expires_in_days: number}} input
 * @param {{fetch?: typeof globalThis.fetch, sessionStorage?: Storage}} [deps]
 * @returns {Promise<{ok: true, id: string, url: string, expiresAt: string} | {ok: false, reason: string, errors?: string[], status?: number, error?: unknown}>}
 */
export async function mintShare(input, deps = {}) {
  const valid = validateMintInput(input);
  if (!valid.ok) return { ok: false, reason: "invalid", errors: valid.errors };
  const fetchImpl = deps.fetch ?? globalThis.fetch;
  const storage = deps.sessionStorage ?? globalThis.sessionStorage;

  let response;
  try {
    response = await fetchImpl(SHARE_ENDPOINT, shareMintRequestInit(valid.value));
  } catch (error) {
    return { ok: false, reason: "unreachable", error };
  }
  if (!response?.ok) return { ok: false, reason: "refused", status: response?.status ?? 0 };
  let data;
  try {
    data = await response.json();
  } catch {
    return { ok: false, reason: "malformed" };
  }
  const token = typeof data?.token === "string" ? data.token : "";
  if (token === "") return { ok: false, reason: "malformed" };
  const id = idFromToken(token);
  retainToken(id, token, storage);
  return {
    ok: true,
    id,
    url: typeof data.url === "string" ? data.url : "",
    expiresAt: typeof data.expires_at === "string" ? data.expires_at : "",
  };
}

/**
 * Revoke by full token. The only place a token is sent, and only to
 * DELETE /share/{token}. On success the retained copy is forgotten.
 *
 * @param {string} token
 * @param {{fetch?: typeof globalThis.fetch, sessionStorage?: Storage}} [deps]
 * @returns {Promise<{ok: true} | {ok: false, reason: string, status?: number, error?: unknown}>}
 */
export async function revokeShare(token, deps = {}) {
  const clean = String(token ?? "").trim();
  if (clean === "") return { ok: false, reason: "no-token" };
  const fetchImpl = deps.fetch ?? globalThis.fetch;
  const storage = deps.sessionStorage ?? globalThis.sessionStorage;

  let response;
  try {
    response = await fetchImpl(shareRevokeEndpoint(clean), shareRevokeRequestInit());
  } catch (error) {
    return { ok: false, reason: "unreachable", error };
  }
  if (!response?.ok) return { ok: false, reason: "refused", status: response?.status ?? 0 };
  forgetToken(idFromToken(clean), storage);
  return { ok: true };
}

/**
 * Revoke a listed row using the token retained for it.
 *
 * @param {string} id
 * @param {{fetch?: typeof globalThis.fetch, sessionStorage?: Storage}} [deps]
 * @returns {Promise<ReturnType<typeof revokeShare>>}
 */
export async function revokeSavedShare(id, deps = {}) {
  const storage = deps.sessionStorage ?? globalThis.sessionStorage;
  const token = retainedToken(id, storage);
  if (!token) return { ok: false, reason: "no-token" };
  return revokeShare(token, deps);
}

/**
 * Revoke from pasted text (a saved link, a `/s/<token>/` path, or a bare token).
 *
 * @param {string} text
 * @param {{fetch?: typeof globalThis.fetch, sessionStorage?: Storage}} [deps]
 * @returns {Promise<ReturnType<typeof revokeShare> | {ok: false, reason: "unparseable"}>}
 */
export async function revokeFromText(text, deps = {}) {
  const token = tokenFromShareUrl(text);
  if (!token) return { ok: false, reason: "unparseable" };
  return revokeShare(token, deps);
}
