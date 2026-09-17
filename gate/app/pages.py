"""The only bodies the gate ever returns.

Every one of these is STATIC. None names a private item, echoes a requested
path, or varies with what exists in the private bucket: an unauthenticated
caller must learn nothing about what is behind the gate, including whether a
particular path is behind it (roadmap: "no private content and no hint that it
exists").
"""

from __future__ import annotations


def _page(title: str, heading: str, body: str, *, show_signin: bool) -> str:
    link = '\n    <p><a href="/signin">Sign in</a></p>' if show_signin else ""
    return f"""<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="noindex, nofollow">
    <title>{title}</title>
  </head>
  <body>
    <h1>{heading}</h1>
    <p>{body}</p>{link}
  </body>
</html>
"""


# A caller with no usable session. Identical for every path under /p/**,
# whether or not an object exists there.
SIGN_IN_REQUIRED = _page(
    "Sign in",
    "Sign in",
    "This page is available to signed-in members. If you have a link to it, sign in and try again.",
    show_signin=True,
)

# A verified sign-in that is not on the allowlist (SEAM-3). It is a different
# body from the one above because the person needs to know their sign-in
# worked -- and it is still identical for every path, so it reveals nothing
# about what exists.
NOT_SHARED_WITH_YOU = _page(
    "Not shared with you",
    "Not shared with you",
    "You are signed in, but this material has not been shared with your account.",
    show_signin=False,
)

# A member asking for something that is not there, and every rejected path.
# One body for both, so a member cannot use the difference to probe either.
NOT_FOUND = _page(
    "Not found",
    "Not found",
    "There is nothing at this address.",
    show_signin=False,
)

# Anything the gate did not expect. Deliberately free of detail: no exception
# text, no stack trace, no path.
SERVER_ERROR = _page(
    "Something went wrong",
    "Something went wrong",
    "The request could not be completed. Please try again.",
    show_signin=False,
)
