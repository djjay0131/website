"""The only bodies the gate ever returns.

Every one of these is STATIC. None names a private item, echoes a requested
path, or varies with what exists in the private bucket: an unauthenticated
caller must learn nothing about what is behind the gate, including whether a
particular path is behind it (roadmap: "no private content and no hint that it
exists").

The chrome deliberately mirrors the public site's band, main column and footer.
A signed-out caller gets the same not-found page an unknown public URL gets; a
signed-in member who is not allowed an item gets a generic page with the same
404 status. Neither page is a white screen, and neither is an existence oracle.
"""

from __future__ import annotations

import html as _html
import re
from datetime import datetime as _datetime

DEFAULT_SITE_ORIGIN = "https://jason.cusati.us"

# Mirrors the public site's design tokens closely enough that the gate's error
# pages do not look like a different property. Kept inline because the gate does
# not serve the site's content-hashed stylesheet and must not depend on it.
_STYLE = """
  :root {
    color-scheme: light dark;
    --font-display: "Spectral", "Iowan Old Style", Georgia, "Times New Roman", serif;
    --font-body: "IBM Plex Sans", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    --font-mono: "IBM Plex Mono", ui-monospace, Menlo, Consolas, monospace;
    --max-width: 800px;
    --color-bg: #f4f5f1;
    --color-surface: #fbfbf8;
    --color-border: #d7d9d1;
    --color-text: #14181b;
    --color-muted: #636a68;
    --color-link: #861f41;
    --color-band: #861f41;
    --color-on-band: #ffffff;
    --rule-orange: #e5751f;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --color-bg: #111413;
      --color-surface: #1a1f1e;
      --color-border: #2b312f;
      --color-text: #edeee9;
      --color-muted: #8a918c;
      --color-link: #f0913f;
    }
  }
  *, *::before, *::after { box-sizing: border-box; margin: 0; }
  html { background: var(--color-bg); }
  body {
    font-family: var(--font-body);
    color: var(--color-text);
    background: var(--color-bg);
    line-height: 1.6;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }
  a { color: var(--color-link); text-decoration: none; }
  a:hover { text-decoration: underline; }
  .site-band {
    background: var(--color-band);
    color: var(--color-on-band);
    border-bottom: 4px solid var(--rule-orange);
  }
  .band-inner {
    max-width: var(--max-width);
    margin: 0 auto;
    padding: 0.85rem 1.5rem 0.75rem;
    display: flex;
    align-items: flex-end;
    gap: 0.5rem 1.5rem;
    flex-wrap: wrap;
  }
  .band-brand {
    display: flex;
    flex-direction: column;
    line-height: 1.15;
    color: var(--color-on-band);
    margin-right: auto;
  }
  .band-brand:hover { color: var(--color-on-band); text-decoration: none; }
  .band-wordmark { font-family: var(--font-display); font-weight: 600; font-size: 1.4rem; }
  .band-affiliation { font-family: var(--font-body); font-size: 0.8rem; opacity: 0.9; }
  .band-nav ul {
    display: flex; gap: 0.75rem 1.25rem; list-style: none;
    padding: 0; margin: 0; flex-wrap: wrap;
  }
  .band-nav a { color: var(--color-on-band); font-family: var(--font-body); font-size: 0.9rem; }
  main {
    flex: 1;
    max-width: var(--max-width);
    margin: 0 auto;
    padding: 2rem 1.5rem;
    width: 100%;
  }
  h1 {
    font-family: var(--font-display); font-weight: 600;
    line-height: 1.25; font-size: 2rem; margin-bottom: 1rem;
  }
  p { color: var(--color-muted); max-width: 65ch; }
  .site-footer {
    border-top: 1px solid var(--color-border);
    background: var(--color-surface);
  }
  .footer-inner {
    max-width: var(--max-width);
    margin: 0 auto;
    padding: 1rem 1.5rem;
    display: flex;
    gap: 0.75rem 1.25rem;
    flex-wrap: wrap;
    font-size: 0.85rem;
    color: var(--color-muted);
  }
  .footer-inner a { color: var(--color-link); }
  @media print {
    .site-band, .site-footer { display: none; }
    main { max-width: 100%; padding: 0; }
  }
"""

_NAV = (
    ("Research", "research/"),
    ("Projects", "projects/"),
    ("Rabbit Holes", "rabbit-holes/"),
    ("CV", "cv/"),
    ("Papers", "papers/"),
)


def _page(
    title: str,
    heading: str,
    body: str,
    *,
    site_origin: str = DEFAULT_SITE_ORIGIN,
) -> str:
    origin = site_origin.rstrip("/")
    nav = "\n".join(f'          <li><a href="{origin}/{href}">{label}</a></li>' for label, href in _NAV)
    return f"""<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="noindex, nofollow">
    <title>{title}</title>
    <style>{_STYLE}</style>
  </head>
  <body>
    <a class="skip-link" href="#main-content">Skip to main content</a>
    <header class="site-band">
      <div class="band-inner">
        <a class="band-brand" href="{origin}/">
          <span class="band-wordmark">Jason Cusati</span>
          <span class="band-affiliation">Virginia Tech</span>
        </a>
        <nav class="band-nav" aria-label="Main navigation">
          <ul>
{nav}
          </ul>
        </nav>
      </div>
    </header>
    <main id="main-content">
      <h1>{heading}</h1>
      <p>{body}</p>
    </main>
    <footer class="site-footer">
      <div class="footer-inner">
        <span>Jason Cusati — Research hub</span>
        <a href="{origin}/signin/">Sign in</a>
        <a href="{origin}/privacy/">Privacy</a>
      </div>
    </footer>
  </body>
</html>
"""


def not_found(site_origin: str = DEFAULT_SITE_ORIGIN) -> str:
    """The site's ordinary not-found page.

    One body for every signed-out `/p/**` request and every missing object an
    allowed caller asks for. It names no private item and carries no sign-in
    prompt; the ordinary site footer still links the sign-in page.
    """
    return _page(
        "Page not found",
        "Page not found",
        "There is nothing at this address.",
        site_origin=site_origin,
    )


def no_access(site_origin: str = DEFAULT_SITE_ORIGIN) -> str:
    """A signed-in member who may not open this item.

    The wording is deliberately generic: the same body is returned whether the
    item exists and is restricted or does not exist at all, so the response is
    not an existence oracle. The status is still 404.
    """
    return _page(
        "Not available",
        "This page isn't available",
        "This page isn't available to your account. If you think it should be, contact Jason.",
        site_origin=site_origin,
    )


def server_error(site_origin: str = DEFAULT_SITE_ORIGIN) -> str:
    """Anything the gate did not expect.

    Deliberately free of detail: no exception text, no stack trace, no path.
    """
    return _page(
        "Something went wrong",
        "Something went wrong",
        "The request could not be completed. Please try again.",
        site_origin=site_origin,
    )


# Constants kept for callers and tests that need a body without settings. They
# are the documented default origin, not a second policy.
NOT_FOUND = not_found()
NO_ACCESS = no_access()
SERVER_ERROR = server_error()


# --- D32 / ADR-0029: the share-recipient banner -----------------------------

# The ONLY place this phrase is allowed. The owner asked that "Shared with you"
# appear on a share link and nowhere else, so it is defined once here and the
# leak/route tests assert it is absent from the rest of the site.
SHARE_BANNER_PREFIX = "Shared with you"
SHARE_BANNER_BY = "Jason"


def share_banner_html(expires_at: _datetime) -> str:
    """A fixed, server-generated banner. No document value is interpolated."""
    expires = expires_at.strftime("%Y-%m-%d")
    return (
        '<div role="note" class="share-banner">'
        f"<strong>{_html.escape(SHARE_BANNER_PREFIX)}</strong>"
        f" &middot; Shared by {_html.escape(SHARE_BANNER_BY)}"
        f' &middot; expires <time datetime="{_html.escape(expires)}">{_html.escape(expires)}</time>'
        "</div>"
        "<style>"
        ".share-banner{position:sticky;top:0;z-index:1000;margin:0;padding:.55rem 1rem;"
        "background:#861f41;color:#fff;font:500 .9rem/1.4 system-ui,-apple-system,'Segoe UI',sans-serif;"
        "text-align:center;box-shadow:0 1px 4px rgba(0,0,0,.25)}"
        ".share-banner strong{color:#fff}"
        "@media (prefers-color-scheme:dark){.share-banner{background:#a3284f}}"
        "</style>"
    )


_BODY_TAG = re.compile(rb"<body\b[^>]*>", re.IGNORECASE)


def inject_share_banner(body: bytes, banner: str) -> bytes:
    """Insert the banner immediately after the document's `<body>` tag.

    A fragment with no `<body>` tag gets the banner prepended: attribution is
    required, and prepending markup to an HTML fragment is safe. A non-HTML
    content type never reaches this function.
    """
    match = _BODY_TAG.search(body)
    if match is None:
        return banner.encode("utf-8") + body
    return body[: match.end()] + banner.encode("utf-8") + body[match.end() :]


def share_document_page(title: str, payload_url: str, banner: str) -> str:
    """A banner page around a PDF that the browser renders inline."""
    safe_payload = _html.escape(payload_url)
    return (
        '<!doctype html><html lang="en"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width, initial-scale=1">'
        '<meta name="robots" content="noindex, nofollow, noarchive">'
        f"<title>{_html.escape(title)}</title>"
        "<style>html,body{margin:0;height:100%;background:#f4f5f1;color:#14181b;font-family:system-ui,sans-serif}"
        ".share-doc{width:100%;height:calc(100vh - 42px);border:0}"
        "@media (prefers-color-scheme:dark){body{background:#111413;color:#edeee9}}</style>"
        "</head><body>"
        f"{banner}"
        f'<iframe class="share-doc" src="{safe_payload}" title="{_html.escape(title)}"></iframe>'
        "</body></html>"
    )
