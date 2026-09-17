"""Serving private objects: path safety, then streaming from the private bucket.

The private bucket's namespace is FLAT. There is no filesystem to escape and no
parent directory to reach, so a crafted path is simply a literal object name --
which is exactly why normalising is not enough on its own. The policy below is
an allowlist: a path is rejected unless every segment is a plain name built
from characters the site build actually emits. That refuses `..`, encoded and
double-encoded `..`, absolute paths, backslashes, NUL and control characters as
a side effect of being an allowlist, rather than as a list of blocked spellings
someone has to keep complete.
"""

from __future__ import annotations

import mimetypes
import re
from collections.abc import Iterator
from dataclasses import dataclass
from typing import Any, Protocol

# dist-private is a rendered static site: HTML, CSS, JS, fonts, images, PDFs.
# Nothing it emits needs a character outside this set.
_SEGMENT = re.compile(r"^[A-Za-z0-9._-]+$")

MAX_PATH_LENGTH = 512
MAX_SEGMENTS = 24
INDEX_DOCUMENT = "index.html"


class UnsafePath(Exception):
    """A requested path is not a servable object name.

    The reason is for logging only. The caller is told nothing beyond the same
    static not-found body every other miss produces.
    """

    def __init__(self, reason: str) -> None:
        super().__init__(reason)
        self.reason = reason


def safe_object_path(raw: str, prefix: str = "") -> str:
    """Map a /p/** path to a private-bucket object name, or raise UnsafePath.

    `raw` is already percent-decoded by the ASGI server, so `%2e%2e%2f` arrives
    here as `../` and is caught by the `..` check. A double-encoded `%252e`
    arrives as the literal `%2e`, whose `%` is not in the segment allowlist, so
    it is refused too.
    """
    path = raw

    # A directory-style request serves that directory's index document. Done
    # before validation so the empty path ("/p/") has something to validate.
    if path == "" or path.endswith("/"):
        path = path + INDEX_DOCUMENT

    if len(path) > MAX_PATH_LENGTH:
        raise UnsafePath("too_long")
    if "\x00" in path:
        raise UnsafePath("nul_byte")
    if any(ord(ch) < 0x20 or ord(ch) == 0x7F for ch in path):
        raise UnsafePath("control_character")
    if "\\" in path:
        raise UnsafePath("backslash")
    if path.startswith("/"):
        raise UnsafePath("absolute_path")
    if "//" in path:
        raise UnsafePath("empty_segment")

    segments = path.split("/")
    if len(segments) > MAX_SEGMENTS:
        raise UnsafePath("too_many_segments")

    for segment in segments:
        if segment in ("", ".", ".."):
            raise UnsafePath("dot_segment")
        if not _SEGMENT.match(segment):
            raise UnsafePath("illegal_character")

    name = "/".join(segments)

    if prefix:
        cleaned = prefix.strip("/")
        name = f"{cleaned}/{name}"
        # Belt and braces: the allowlist above already makes escaping the
        # prefix impossible, so this can only fail if that changes.
        if not name.startswith(f"{cleaned}/"):
            raise UnsafePath("escaped_prefix")

    return name


def guess_content_type(name: str, fallback: str | None = None) -> str:
    """Content-Type for an object, preferring its extension.

    The extension is authoritative because the bytes are this project's own
    build output; the object's stored metadata is used only when the extension
    says nothing. Responses also carry X-Content-Type-Options: nosniff, so a
    wrong guess cannot become a sniffed script.
    """
    guessed, _ = mimetypes.guess_type(name)
    content_type = guessed or fallback or "application/octet-stream"
    if content_type.startswith("text/") and "charset=" not in content_type:
        content_type = f"{content_type}; charset=utf-8"
    return content_type


@dataclass
class StoredObject:
    """One object from the private bucket, ready to stream."""

    name: str
    size: int | None
    content_type: str
    chunks: Any  # callable returning Iterator[bytes]


class ObjectStore(Protocol):
    """The one operation the gate needs from the private bucket."""

    def fetch(self, name: str) -> StoredObject | None: ...


class GcsObjectStore:
    """ObjectStore backed by the private Cloud Storage bucket.

    The gate's service account is the bucket's ONLY reader (ADR-0004 decision 4,
    SEAM-1). It reads objects; it never lists, writes or deletes them -- see the
    handoff's IAM section for why that matters.
    """

    CHUNK_SIZE = 256 * 1024

    def __init__(self, bucket_name: str, client: Any | None = None) -> None:
        self._bucket_name = bucket_name
        self._client = client
        self._bucket: Any | None = None

    def _ensure_bucket(self) -> Any:
        # Lazy import: keeps the module importable without cloud credentials.
        from google.cloud import storage

        if self._bucket is None:
            client = self._client or storage.Client()
            # bucket() constructs a reference without a metadata read, so the
            # identity needs no storage.buckets.get.
            self._bucket = client.bucket(self._bucket_name)
        return self._bucket

    def fetch(self, name: str) -> StoredObject | None:
        blob = self._ensure_bucket().get_blob(name)
        if blob is None:
            return None

        def chunks() -> Iterator[bytes]:
            with blob.open("rb") as handle:
                while True:
                    data = handle.read(self.CHUNK_SIZE)
                    if not data:
                        break
                    yield data

        return StoredObject(
            name=name,
            size=blob.size,
            content_type=guess_content_type(name, blob.content_type),
            chunks=chunks,
        )
