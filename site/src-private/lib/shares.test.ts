import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  MAX_SHARE_DAYS,
  MIN_SHARE_DAYS,
  SHARE_ENDPOINT,
  SHARE_ID_CHARS,
  canRevokeRow,
  idFromToken,
  listShares,
  mintShare,
  retainedToken,
  revokeFromText,
  revokeSavedShare,
  revokeShare,
  shareListRequestInit,
  shareMintRequestInit,
  shareRevokeEndpoint,
  shareRevokeRequestInit,
  sharesView,
  tokenFromShareUrl,
  tokenStorageKey,
  validateMintInput,
} from "./shares.mjs";

// ===========================================================================
// The owner's Shares island (SEAM-S6; contract site-wave-3)
// ===========================================================================
// The island is owner UI in the private build. These tests pin the parts that
// would ship a plausible-looking but wrong share manager:
//
//   - a cross-origin call the gate refuses with 403
//   - controls rendered to a non-owner on GET /share 403
//   - a mint body that names the wrong item, omits the item document's `entry`,
//     or carries a day count the server rejects
//   - a revoke that cannot find the token the list deliberately withholds
//   - a token written to the console or sent anywhere but DELETE /share/{token}
//
// If someone deletes this file to make a change pass, that is the signal.

/** A fetch stand-in that records exactly what it was called with. */
function recordingFetch(result: unknown) {
  const calls: { url: unknown; init: unknown }[] = [];
  const impl = async (url: unknown, init: unknown) => {
    calls.push({ url, init });
    if (result instanceof Error) throw result;
    return result as Response;
  };
  return { calls, impl: impl as unknown as typeof globalThis.fetch };
}

function jsonResponse(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

/** A sessionStorage stand-in backed by a Map. */
function memoryStorage(seed: Record<string, string> = {}) {
  const store = new Map(Object.entries(seed));
  return {
    getItem: (key: string) => (store.has(key) ? (store.get(key) as string) : null),
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
    _dump: () => Object.fromEntries(store),
  };
}

describe("every management call is same-origin and shaped the way the gate expects", () => {
  it("GET /share is a same-origin read", () => {
    const { calls, impl } = recordingFetch(jsonResponse(200, { shares: [] }));

    return listShares({ fetch: impl }).then(() => {
      expect(calls).toHaveLength(1);
      expect(calls[0].url).toBe("/share");
      expect(calls[0].init).toEqual({ method: "GET", credentials: "same-origin" });
    });
  });

  it("POST /share sends EXACTLY the SEAM-S1 body", async () => {
    const { calls, impl } = recordingFetch(
      jsonResponse(200, { token: "tok_abcdefghijkl", expires_at: "2026-10-17T00:00:00Z", url: "/s/tok_abcdefghijkl/" }),
    );

    await mintShare(
      {
        section: "phd",
        source: "phd-milestones",
        slug: "committee-dossier",
        entry: "committee.html",
        expires_in_days: 14,
      },
      { fetch: impl, sessionStorage: memoryStorage() },
    );

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("/share");
    expect(calls[0].init).toEqual({
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        section: "phd",
        source: "phd-milestones",
        slug: "committee-dossier",
        entry: "committee.html",
        expires_in_days: 14,
      }),
    });
    // The body carries EXACTLY these five keys -- no more (a token must never
    // ride along) and no fewer (the gate cannot serve the real file without
    // `entry`). Assert the parsed keys, not just the serialised string.
    expect(Object.keys(JSON.parse(String((calls[0].init as { body: string }).body))).sort()).toEqual([
      "entry",
      "expires_in_days",
      "section",
      "slug",
      "source",
    ]);
  });

  it("DELETE goes to /share/<token>, and only there", async () => {
    const { calls, impl } = recordingFetch(jsonResponse(200, { status: "ok" }));
    const storage = memoryStorage();

    await revokeShare("AbC-123_xyz", { fetch: impl, sessionStorage: storage });

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("/share/AbC-123_xyz");
    expect(calls[0].init).toEqual({ method: "DELETE", credentials: "same-origin" });
  });

  it("names same-origin PATHS, never the gate's *.run.app host, and never a GET mutator", () => {
    expect(SHARE_ENDPOINT.startsWith("/")).toBe(true);
    expect(SHARE_ENDPOINT).not.toMatch(/^https?:/);
    expect(SHARE_ENDPOINT).not.toContain("run.app");
    expect(SHARE_ENDPOINT).not.toContain("//");
    expect(shareListRequestInit()).not.toHaveProperty("mode");
    expect(shareMintRequestInit({ section: "s", source: "x", slug: "y", entry: "index.html", expires_in_days: 1 }))
      .not.toHaveProperty("mode");
    expect(shareRevokeRequestInit()).not.toHaveProperty("mode");
    expect(shareRevokeEndpoint("t")).toBe("/share/t");
  });
});

describe("the mint input is validated before the network", () => {
  const VALID = {
    section: "phd",
    source: "phd-milestones",
    slug: "committee-dossier",
    entry: "committee.html",
    expires_in_days: 7,
  };

  it("accepts the closed interval [1, 30] and returns the five-key value", () => {
    for (const days of [MIN_SHARE_DAYS, 7, MAX_SHARE_DAYS]) {
      const result = validateMintInput({ ...VALID, expires_in_days: days });
      expect(result.ok).toBe(true);
      expect(result.ok && Object.keys(result.value).sort()).toEqual([
        "entry",
        "expires_in_days",
        "section",
        "slug",
        "source",
      ]);
    }
  });

  it("refuses 0, 31 and a non-integer", () => {
    for (const days of [0, 31, 3.5, "7", true]) {
      expect(validateMintInput({ ...VALID, expires_in_days: days }).ok).toBe(false);
    }
  });

  it("refuses an empty section, source or slug", () => {
    expect(validateMintInput({ ...VALID, section: "" }).ok).toBe(false);
    expect(validateMintInput({ ...VALID, source: "" }).ok).toBe(false);
    expect(validateMintInput({ ...VALID, slug: "" }).ok).toBe(false);
  });

  it("requires entry, and refuses an entry the gate could not serve", () => {
    expect(validateMintInput({ ...VALID, entry: undefined }).ok).toBe(false);
    expect(validateMintInput({ ...VALID, entry: "" }).ok).toBe(false);
    for (const bad of [
      "/committee.html", // absolute
      "../committee.html", // traverses out
      "site/../committee.html", // a `..` segment
      "site//committee.html", // empty segment
      "site\\committee.html", // backslash
      "committee.html/", // trailing slash
      "committee file.html", // a character outside the gate allowlist
      "committee%2e%2f.html", // an encoded escape the gate refuses
      ".", // not a file
      "..", // not a file
    ]) {
      const result = validateMintInput({ ...VALID, entry: bad });
      expect(result.ok, `entry ${JSON.stringify(bad)} must be refused`).toBe(false);
    }
  });

  it("accepts a multi-segment entry, as the hub's own slugs are", () => {
    expect(validateMintInput({ ...VALID, entry: "site/index.html" }).ok).toBe(true);
  });

  it("does not reach the network for an invalid form", async () => {
    const { calls, impl } = recordingFetch(jsonResponse(200, {}));
    const outcome = await mintShare(
      { section: "", source: "", slug: "", entry: "", expires_in_days: 99 },
      { fetch: impl },
    );
    expect(outcome.ok).toBe(false);
    expect(calls).toHaveLength(0);
  });
});

describe("403 means NON-OWNER: no mint or revoke control is offered", () => {
  it("treats 403 as a successful read that reports forbidden", async () => {
    const { calls, impl } = recordingFetch(jsonResponse(403, { status: "forbidden" }));
    const outcome = await listShares({ fetch: impl });

    expect(outcome).toEqual({ ok: true, forbidden: true, shares: [] });
    expect(calls[0].url).toBe("/share");
    expect(calls[0].init).toEqual({ method: "GET", credentials: "same-origin" });
  });

  it("maps a forbidden read to a view with NO controls", async () => {
    const { impl } = recordingFetch(jsonResponse(403, { status: "forbidden" }));
    const view = sharesView(await listShares({ fetch: impl }));

    expect(view.kind).toBe("forbidden");
    expect(view.canMint).toBe(false);
    expect(view.canRevoke).toBe(false);
    expect(view.rows).toEqual([]);
  });

  it("maps a 200 read to a view that CAN mint and revoke", () => {
    const view = sharesView({ ok: true, forbidden: false, shares: [{ id: "abc" }] });
    expect(view).toEqual({ kind: "ready", rows: [{ id: "abc" }], canMint: true, canRevoke: true });
  });

  it("maps an unreachable read to an error view", () => {
    expect(sharesView({ ok: false, reason: "unreachable" })).toEqual({
      kind: "error",
      rows: [],
      canMint: false,
      canRevoke: false,
    });
  });
});

describe("200 lists the active shares", () => {
  it("returns the rows GET /share reported", async () => {
    const rows = [
      { id: "aaaa11112222", section: "phd", source: "phd-milestones", slug: "dossier", created_by: "o@x", expires_at: "2026-10-17T00:00:00Z" },
    ];
    const { impl } = recordingFetch(jsonResponse(200, { shares: rows }));
    const outcome = await listShares({ fetch: impl });

    expect(outcome.ok).toBe(true);
    expect(outcome.forbidden).toBe(false);
    expect(outcome.shares).toEqual(rows);
  });

  it("never trusts a non-array shares field", async () => {
    const { impl } = recordingFetch(jsonResponse(200, { shares: "nope" }));
    const outcome = await listShares({ fetch: impl });
    expect(outcome.ok).toBe(true);
    expect(outcome.shares).toEqual([]);
  });
});

describe("the mint retains the token the list will never return, and never hands it back", () => {
  it("stores the full token under the row's short id and returns only the link", async () => {
    const token = "abcdefghijklmnopqrstuvwxyz_0123456789-ABCD";
    const { impl } = recordingFetch(
      jsonResponse(200, { token, expires_at: "2026-10-17T00:00:00Z", url: `/s/${token}/` }),
    );
    const storage = memoryStorage();

    const outcome = await mintShare(
      { section: "cv", source: "cv", slug: "academic", entry: "academic.pdf", expires_in_days: 30 },
      { fetch: impl, sessionStorage: storage },
    );

    expect(outcome.ok).toBe(true);
    expect(outcome).toHaveProperty("id");
    expect(outcome).toHaveProperty("url");
    expect(outcome).not.toHaveProperty("token");
    expect(outcome.id).toBe(token.slice(0, SHARE_ID_CHARS));
    expect(retainedToken(outcome.id, storage as unknown as Storage)).toBe(token);
    expect(storage._dump()).toEqual({ [tokenStorageKey(outcome.id)]: token });
  });

  it("still succeeds when sessionStorage cannot remember (private mode)", async () => {
    const throwing = {
      getItem: () => { throw new Error("denied"); },
      setItem: () => { throw new Error("denied"); },
      removeItem: () => { throw new Error("denied"); },
    };
    const { impl } = recordingFetch(jsonResponse(200, { token: "t0k3n", expires_at: "x", url: "/s/t0k3n/" }));

    const outcome = await mintShare(
      { section: "s", source: "x", slug: "y", entry: "index.html", expires_in_days: 1 },
      { fetch: impl, sessionStorage: throwing as unknown as Storage },
    );

    expect(outcome.ok).toBe(true);
    expect(outcome.url).toBe("/s/t0k3n/");
  });
});

describe("revoke finds the retained token, or a pasted one", () => {
  it("revokes a listed row with the token sessionStorage kept", async () => {
    const token = "savedtoken_abcdefghij";
    const id = idFromToken(token);
    const storage = memoryStorage({ [tokenStorageKey(id)]: token });
    const { calls, impl } = recordingFetch(jsonResponse(200, { status: "ok" }));

    const outcome = await revokeSavedShare(id, { fetch: impl, sessionStorage: storage as unknown as Storage });

    expect(outcome.ok).toBe(true);
    expect(calls[0].url).toBe(`/share/${token}`);
    // The retained copy is forgotten after a confirmed revoke.
    expect(storage._dump()).toEqual({});
  });

  it("refuses to revoke a row whose token was never saved here", async () => {
    const { calls, impl } = recordingFetch(jsonResponse(200, { status: "ok" }));
    const outcome = await revokeSavedShare("notsaved0000", { fetch: impl, sessionStorage: memoryStorage() as unknown as Storage });

    expect(outcome).toEqual({ ok: false, reason: "no-token" });
    expect(calls).toHaveLength(0);
  });

  it("revokes from a pasted link, path or bare token", async () => {
    for (const text of [
      "https://hub.invalid/s/AbC-123_token/",
      "/s/AbC-123_token/",
      "/s/AbC-123_token/deep/path.html",
      "AbC-123_token",
    ]) {
      const { calls, impl } = recordingFetch(jsonResponse(200, { status: "ok" }));
      const outcome = await revokeFromText(text, { fetch: impl, sessionStorage: memoryStorage() as unknown as Storage });
      expect(tokenFromShareUrl(text)).toBe("AbC-123_token");
      expect(outcome.ok).toBe(true);
      expect(calls[0].url).toBe("/share/AbC-123_token");
    }
  });

  it("reports unparseable text without a request, and canRevokeRow is storage-driven", async () => {
    const { calls, impl } = recordingFetch(jsonResponse(200, { status: "ok" }));
    const outcome = await revokeFromText("not a link", { fetch: impl });
    expect(outcome).toEqual({ ok: false, reason: "unparseable" });
    expect(calls).toHaveLength(0);

    expect(canRevokeRow({ id: "x" }, memoryStorage() as unknown as Storage)).toBe(false);
    expect(canRevokeRow({ id: idFromToken("tokenAAAAAAAAAAAA") }, memoryStorage({ [tokenStorageKey(idFromToken("tokenAAAAAAAAAAAA"))]: "tokenAAAAAAAAAAAA" }) as unknown as Storage)).toBe(true);
  });
});

describe("a token is never logged and is sent nowhere but DELETE /share/{token}", () => {
  const SRC = path.resolve("src-private/lib/shares.mjs");
  const lib = fs.readFileSync(SRC, "utf8");

  it("contains no console call at all", () => {
    expect(lib).not.toMatch(/\bconsole\./);
  });

  it("uses no no-cors and spells no absolute URL in code", () => {
    // Prose may name the failure mode (signout.mjs does); judge the CODE by
    // stripping line comments before looking for an absolute origin or no-cors.
    const code = lib
      .split("\n")
      .map((line) => line.replace(/\/\/.*$/, ""))
      .join("\n");
    expect(code).not.toContain("no-cors");
    expect(code).not.toMatch(/https?:\/\//);
    // The endpoint value checks above are the real guard against run.app.
  });
});

// ===========================================================================
// The page and island exist, are private, and hydrate only in the private build
// ===========================================================================
describe("the Shares page binds the island in the private srcDir", () => {
  const PAGE = path.resolve("src-private/pages/shares.astro");
  const page = fs.readFileSync(PAGE, "utf8");

  it("renders the island and hydrates it", () => {
    expect(fs.existsSync(PAGE)).toBe(true);
    expect(page).toMatch(/SharesIsland/);
    expect(page).toMatch(/client:load/);
    expect(page).toMatch(/PrivateBase/);
  });

  it("supplies the island the effectively-private items, each with its entry basename", () => {
    // The page, not the user, names the item: the mint form selects from this
    // list and the mint body carries the item document's `entry` (the basename
    // the private build stages under `_doc/`). See the addendum, requirement 8b.
    expect(page).toMatch(/effective_visibility === "private"/);
    expect(page).toMatch(/path\.posix\.basename\(item\.path\)/);
    expect(page).toMatch(/items=\{shareableItems\}/);
    expect(page).toMatch(/section: item\.section/);
    expect(page).toMatch(/source: item\.source/);
    expect(page).toMatch(/slug: item\.slug/);
    expect(page).toMatch(/entry:/);
  });

  it("is NOT reachable from the public srcDir", () => {
    expect(fs.existsSync(path.resolve("src/pages/shares.astro"))).toBe(false);
    expect(fs.existsSync(path.resolve("src/pages/shares"))).toBe(false);
    // No public source file may import the island or the shares lib.
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (/\.(astro|ts|tsx|mjs|js)$/.test(entry.name) && !/\.test\.[jt]sx?$/.test(entry.name)) {
          const text = fs.readFileSync(full, "utf8");
          if (/\b(import|require)\b[^\n]*(shares\.mjs|SharesIsland)/.test(text)) offenders.push(full);
        }
      }
    };
    walk(path.resolve("src"));
    expect(offenders).toEqual([]);
  });
});
