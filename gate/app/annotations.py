"""Annotations: a member's durable note anchored to a quote in one private item.

Design authority: issue #107, `wave-6-annotations-seams.md` AN-STORE, and the
shares pattern (`shares.py`, ADR-0017/0018) this deliberately mirrors. A note is
stored at Firestore `annotations/{id}`:

    {
      id, member,
      section, source, slug,
      selector: { type: "TextQuoteSelector", exact, prefix, suffix },
      position: { type: "TextPositionSelector", start, end } | null,
      quote, comment, intent, tags, created, updated
    }

`quote` is stored beside `selector.exact` for read/export convenience; the two
are kept equal by the parser, and a row where they disagree is refused rather
than served under either value.

The store is server-only. Firestore has no collection-scoped IAM spelling, so
the runtime service account's project-wide `roles/datastore.user` grant (already
held for `shares/` per ADR-0018) covers `annotations/` as well; no new binding
is created (AN-IAM). The collection discipline is this class plus the deny-all
released rules.

The shape mirrors `members.py` and `shares.py`: a Protocol, a Firestore
implementation for production, and a static implementation that is the test
double. There are no cloud credentials in the development environment and none
may be created.
"""

from __future__ import annotations

import secrets
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Protocol

# 16 bytes -> 22 URL-safe base64 characters. Minted with `secrets`, never
# `random`: the id is the row's address and must not be guessable from another.
ANNOTATION_ID_BYTES = 16

# The intent enum (AN-STORE). `question` is the island's default and the safe
# one: a `question` note is kept in My notes and is not rendered by the export
# routing (`notes-routing.json` maps it to null).
ANNOTATION_INTENTS = frozenset({"paper", "experiment", "brainstorm", "question"})
DEFAULT_INTENT = "question"

# Bounds enforced in the gate (AN-STORE). The route enforces the same values;
# they live here so a future route cannot mint an out-of-bounds row by
# bypassing the route validator.
MAX_EXACT_CHARS = 2000
MAX_CONTEXT_CHARS = 64
MAX_COMMENT_CHARS = 5000
MAX_TAGS = 10
MAX_TAG_CHARS = 40

QUOTE_SELECTOR_TYPE = "TextQuoteSelector"
POSITION_SELECTOR_TYPE = "TextPositionSelector"

# Distinguishes "no position" (valid) from "a malformed position" (refuse) in
# the parser below. A sentinel rather than None because None is a valid value.
_MALFORMED = object()


def new_annotation_id() -> str:
    """A fresh annotation id. Never log the full value; return it once, on create."""
    return secrets.token_urlsafe(ANNOTATION_ID_BYTES)


@dataclass(frozen=True)
class TextQuoteSelector:
    """The durable anchor (W3C Web Annotation): the quoted text and its context."""

    exact: str
    prefix: str = ""
    suffix: str = ""


@dataclass(frozen=True)
class TextPositionSelector:
    """The fallback anchor: character offsets into the rendered document."""

    start: int
    end: int


@dataclass(frozen=True)
class Annotation:
    """One row of `annotations/{id}`."""

    id: str
    member: str
    section: str
    source: str
    slug: str
    selector: TextQuoteSelector
    position: TextPositionSelector | None
    quote: str
    comment: str
    intent: str
    tags: tuple[str, ...]
    created: datetime
    updated: datetime


class AnnotationStore(Protocol):
    """The operations the gate needs from the annotation store."""

    def create(self, annotation: Annotation) -> None: ...

    def get(self, annotation_id: str) -> Annotation | None: ...

    def list_all(self) -> list[Annotation]: ...

    def list_for(self, member: str) -> list[Annotation]: ...

    def delete(self, annotation_id: str) -> None: ...


def _quote_from_document(value: object) -> TextQuoteSelector | None:
    """A stored `selector`, or None when the row is malformed.

    A missing or unknown `type` is refused rather than assumed: the selector is
    the durable anchor, and guessing which selector a row meant is how a note
    ends up anchored to the wrong passage.
    """
    if not isinstance(value, dict) or value.get("type") != QUOTE_SELECTOR_TYPE:
        return None
    exact = value.get("exact")
    prefix = value.get("prefix", "")
    suffix = value.get("suffix", "")
    if not isinstance(exact, str) or not exact:
        return None
    if not isinstance(prefix, str) or not isinstance(suffix, str):
        return None
    return TextQuoteSelector(exact=exact, prefix=prefix, suffix=suffix)


def _position_from_document(value: object) -> object:
    """A stored `position`, None, or the malformed sentinel.

    `None` is a valid absent position; a present value that is not a
    `TextPositionSelector` with ordered integer bounds is malformed.
    """
    if value is None:
        return None
    if not isinstance(value, dict) or value.get("type") != POSITION_SELECTOR_TYPE:
        return _MALFORMED
    start = value.get("start")
    end = value.get("end")
    if isinstance(start, bool) or isinstance(end, bool):
        return _MALFORMED
    if not isinstance(start, int) or not isinstance(end, int):
        return _MALFORMED
    if start < 0 or start > end:
        return _MALFORMED
    return TextPositionSelector(start=start, end=end)


def _annotation_from_document(annotation_id: str, data: dict[str, Any]) -> Annotation | None:
    """Build an Annotation from a Firestore document, or None if it is malformed.

    A document missing a field is refused rather than defaulted: an annotation
    whose quote or selector is unknown cannot be rendered, and defaulting one
    would anchor a note to text the member never selected.
    """
    member = data.get("member")
    section = data.get("section")
    source = data.get("source")
    slug = data.get("slug")
    quote = data.get("quote")
    comment = data.get("comment")
    intent = data.get("intent")
    created = data.get("created")
    updated = data.get("updated")

    if not isinstance(annotation_id, str) or not annotation_id:
        return None
    if not all(isinstance(value, str) and value for value in (member, section, source, slug, quote)):
        return None
    if not isinstance(comment, str):
        return None
    if not isinstance(intent, str) or intent not in ANNOTATION_INTENTS:
        return None
    if not isinstance(created, datetime) or not isinstance(updated, datetime):
        return None

    selector = _quote_from_document(data.get("selector"))
    if selector is None:
        return None
    # `quote` is a convenience copy of `selector.exact` (AN-STORE). A row where
    # they disagree is corrupt and is refused, not served under either value.
    if quote != selector.exact:
        return None

    position = _position_from_document(data.get("position"))
    if position is _MALFORMED:
        return None

    tags = data.get("tags", [])
    if not isinstance(tags, (list, tuple)) or not all(isinstance(tag, str) for tag in tags):
        return None

    return Annotation(
        id=annotation_id,
        member=member,
        section=section,
        source=source,
        slug=slug,
        selector=selector,
        position=position,  # type: ignore[arg-type]
        quote=quote,
        comment=comment,
        intent=intent,
        tags=tuple(tags),
        created=created,
        updated=updated,
    )


def _document_from_annotation(annotation: Annotation) -> dict[str, Any]:
    """The Firestore document for an annotation, in the AN-STORE shape."""
    position = annotation.position
    return {
        "id": annotation.id,
        "member": annotation.member,
        "section": annotation.section,
        "source": annotation.source,
        "slug": annotation.slug,
        "selector": {
            "type": QUOTE_SELECTOR_TYPE,
            "exact": annotation.selector.exact,
            "prefix": annotation.selector.prefix,
            "suffix": annotation.selector.suffix,
        },
        "position": None
        if position is None
        else {
            "type": POSITION_SELECTOR_TYPE,
            "start": position.start,
            "end": position.end,
        },
        "quote": annotation.quote,
        "comment": annotation.comment,
        "intent": annotation.intent,
        "tags": list(annotation.tags),
        "created": annotation.created,
        "updated": annotation.updated,
    }


def _newest_first(annotations: list[Annotation]) -> list[Annotation]:
    annotations.sort(key=lambda annotation: annotation.created, reverse=True)
    return annotations


class FirestoreAnnotationStore:
    """AnnotationStore backed by Firestore Native mode.

    Reads and writes `annotations/{id}` only. Firestore cannot restrict an IAM
    grant to a collection, so the runtime service account's `datastore.user`
    grant is project-wide; the collection discipline is this class and the
    deny-all released rules that keep the Web SDK out (AN-IAM).
    """

    def __init__(self, collection: str = "annotations", project_id: str | None = None) -> None:
        self._collection = collection
        self._project_id = project_id
        self._client: Any | None = None

    def _ensure_client(self) -> Any:
        # Lazy import: keeps the module importable without cloud credentials.
        from google.cloud import firestore

        if self._client is None:
            self._client = (
                firestore.Client(project=self._project_id) if self._project_id else firestore.Client()
            )
        return self._client

    def create(self, annotation: Annotation) -> None:
        self._ensure_client().collection(self._collection).document(annotation.id).set(
            _document_from_annotation(annotation)
        )

    def get(self, annotation_id: str) -> Annotation | None:
        snapshot = self._ensure_client().collection(self._collection).document(annotation_id).get()
        if not snapshot.exists:
            return None
        return _annotation_from_document(annotation_id, snapshot.to_dict() or {})

    def list_all(self) -> list[Annotation]:
        stream = self._ensure_client().collection(self._collection).stream()
        annotations = [
            annotation
            for doc in stream
            if (annotation := _annotation_from_document(doc.id, doc.to_dict() or {}))
        ]
        return _newest_first(annotations)

    def list_for(self, member: str) -> list[Annotation]:
        # An equality filter on `member` uses Firestore's automatic single-field
        # index; the intent/source/slug filters are applied in Python at the
        # route, exactly as `ShareStore.list_active` applies its expiry filter.
        query = self._ensure_client().collection(self._collection).where("member", "==", member)
        annotations = [
            annotation
            for doc in query.stream()
            if (annotation := _annotation_from_document(doc.id, doc.to_dict() or {}))
        ]
        return _newest_first(annotations)

    def delete(self, annotation_id: str) -> None:
        # The route has already read the row and decided the caller may delete
        # it; this is non-creating, so a repeat delete is already done as far as
        # a caller can observe.
        self._ensure_client().collection(self._collection).document(annotation_id).delete()


class StaticAnnotationStore:
    """In-memory AnnotationStore. Used by the tests; never wired in production."""

    def __init__(self, annotations: object = ()) -> None:
        self._annotations: dict[str, Annotation] = {
            annotation.id: annotation
            for annotation in annotations  # type: ignore[union-attr]
        }

    def create(self, annotation: Annotation) -> None:
        self._annotations[annotation.id] = annotation

    def get(self, annotation_id: str) -> Annotation | None:
        return self._annotations.get(annotation_id)

    def list_all(self) -> list[Annotation]:
        return _newest_first(list(self._annotations.values()))

    def list_for(self, member: str) -> list[Annotation]:
        return _newest_first(
            [annotation for annotation in self._annotations.values() if annotation.member == member]
        )

    def delete(self, annotation_id: str) -> None:
        self._annotations.pop(annotation_id, None)
