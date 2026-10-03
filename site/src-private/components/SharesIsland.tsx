// THE SHARES ISLAND (SEAM-S6; ADR-0003; contract site-wave-3 requirement 3).
//
// Deliberately thin. Everything with a security or lifecycle decision -- the
// endpoints, the request shapes, the status->UI branch, validation and token
// retention -- lives in ../lib/shares.mjs and is unit-tested there. This file
// only renders that state and forwards user intent to those functions.
//
// It is owner UI. A 403 from GET /share means the signed-in member is not the
// owner, and then NO mint or revoke control is drawn. The gate is the authority;
// this is the visible half.
//
// The mint form SELECTS a real item from the list the page passes in, rather
// than taking a free-text (section, source, slug) triple. The page supplies it
// from the private build's own item list, so the owner cannot mistype an
// address and the mint body can carry `entry` -- the item document's filename
// under the token's `_doc/` prefix, which the gate needs to serve the real file
// instead of assuming `index.html`.
import { useEffect, useState } from "react";
import {
  MAX_SHARE_DAYS,
  MIN_SHARE_DAYS,
  canRevokeRow,
  listShares,
  mintShare,
  revokeFromText,
  revokeSavedShare,
  sharesView,
} from "../lib/shares.mjs";

type AnyRecord = Record<string, any>;

type ShareableItem = {
  section: string;
  source: string;
  slug: string;
  entry: string;
  title: string;
};

const DEFAULT_DAYS = 7;

function sessionStore(): any {
  try {
    return globalThis.sessionStorage;
  } catch {
    return undefined;
  }
}

export default function SharesIsland({ items = [] }: { items?: ShareableItem[] }) {
  const [status, setStatus] = useState<AnyRecord | null>(null);
  const [selected, setSelected] = useState(0);
  const [days, setDays] = useState(DEFAULT_DAYS);
  const [minted, setMinted] = useState<AnyRecord | null>(null);
  const [paste, setPaste] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function refresh() {
    setStatus(await listShares());
  }

  useEffect(() => {
    void refresh();
  }, []);

  const view = sharesView(status ?? { ok: false });
  const chosen = items[selected] ?? null;

  async function onMint(event: { preventDefault: () => void }) {
    event.preventDefault();
    if (!chosen) {
      setMessage("Choose an item to share.");
      return;
    }
    setBusy(true);
    setMessage("");
    const outcome = await mintShare(
      {
        section: chosen.section,
        source: chosen.source,
        slug: chosen.slug,
        entry: chosen.entry,
        expires_in_days: days,
      },
      { sessionStorage: sessionStore() },
    );
    setBusy(false);
    if (!outcome.ok) {
      setMessage(outcome.errors ? outcome.errors.join("; ") : `Could not create the link (${outcome.reason}).`);
      return;
    }
    setMinted({ url: outcome.url, id: outcome.id });
    await refresh();
  }

  async function onRevokeRow(id: string) {
    setBusy(true);
    setMessage("");
    const outcome = await revokeSavedShare(id, { sessionStorage: sessionStore() });
    setBusy(false);
    if (!outcome.ok) {
      setMessage(outcome.reason === "no-token" ? "That link was not saved in this browser." : "Could not revoke that link.");
      return;
    }
    setMinted(null);
    await refresh();
  }

  async function onRevokePasted(event: { preventDefault: () => void }) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const outcome = await revokeFromText(paste, { sessionStorage: sessionStore() });
    setBusy(false);
    if (!outcome.ok) {
      setMessage(
        outcome.reason === "unparseable"
          ? "Paste a share link or token first."
          : outcome.reason === "no-token"
            ? "No token found in that text."
            : "Could not revoke that link.",
      );
      return;
    }
    setPaste("");
    setMinted(null);
    await refresh();
  }

  async function onCopy() {
    if (!minted?.url) return;
    try {
      await navigator.clipboard.writeText(minted.url);
      setMessage("Link copied.");
    } catch {
      setMessage("Copy the link from the field above.");
    }
  }

  if (status === null) return <p className="shares-note">Loading shares…</p>;

  if (view.kind === "error") {
    return <p className="shares-note" role="alert">Could not load shares. Try again shortly.</p>;
  }

  if (view.kind === "forbidden") {
    return <p className="shares-note">Only the owner manages shares.</p>;
  }

  return (
    <div className="shares-island">
      {minted && (
        <section className="minted" aria-live="polite">
          <h2>New share link</h2>
          <input className="link" type="text" readOnly value={minted.url} aria-label="New share link" />
          <button type="button" onClick={onCopy}>Copy link</button>
        </section>
      )}

      {message && <p className="shares-note" role="alert">{message}</p>}

      <section>
        <h2>Active shares</h2>
        {view.rows.length === 0 ? (
          <p className="shares-note">No active shares.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Section</th>
                <th>Source</th>
                <th>Slug</th>
                <th>Created by</th>
                <th>Expires</th>
                <th><span className="visually-hidden">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {view.rows.map((row: AnyRecord) => (
                <tr key={String(row.id)}>
                  <td>{row.section ?? "—"}</td>
                  <td>{row.source}</td>
                  <td>{row.slug}</td>
                  <td>{row.created_by}</td>
                  <td>{row.expires_at}</td>
                  <td>
                    {canRevokeRow(row, sessionStore()) ? (
                      <button type="button" disabled={busy} onClick={() => void onRevokeRow(String(row.id))}>
                        Revoke
                      </button>
                    ) : (
                      <span className="shares-note">paste link to revoke</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section>
        <h2>Create a share</h2>
        {items.length === 0 ? (
          <p className="shares-note">No shareable items were found in this build.</p>
        ) : (
          <form onSubmit={onMint}>
            <label>
              Item
              <select value={selected} onChange={(e) => setSelected(Number(e.target.value))}>
                {items.map((item, index) => (
                  <option key={`${item.source}/${item.slug}`} value={index}>
                    {item.title} — {item.section}/{item.source}/{item.slug}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Expires in days
              <input
                type="number"
                min={MIN_SHARE_DAYS}
                max={MAX_SHARE_DAYS}
                value={days}
                onChange={(e) => setDays(Number(e.target.value))}
              />
            </label>
            <button type="submit" disabled={busy || !chosen}>Create link</button>
          </form>
        )}
      </section>

      <section>
        <h2>Revoke a saved link</h2>
        <p className="shares-note">
          A share minted in another browser is not saved here. Paste its link or token to revoke it.
        </p>
        <form onSubmit={onRevokePasted}>
          <label>
            Link or token
            <input value={paste} onChange={(e) => setPaste(e.target.value)} />
          </label>
          <button type="submit" disabled={busy}>Revoke</button>
        </form>
      </section>
    </div>
  );
}
