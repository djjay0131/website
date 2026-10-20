"""Per-item access policy for the private area (ADR-0025, D24-B).

Two inputs are joined at request time:

  * `access_policy/current` in Firestore -- the owner's access decision, read
    through `FirestoreAccessPolicyStore`, cached for at most 30 seconds and
    failed closed when absent or malformed. It carries groups and roles only;
    it never names a member, an item or a source in this repository.
  * `_hub/catalog.json` in the private bucket -- written by the private build.
    It carries the item metadata the listing needs and the object -> item map
    the gate uses for `_payload/**`, `_doc/**` and annotations. It carries NO
    groups or roles, so a stale catalog can only change what exists, never who
    may read it.

The gate resolves `item -> source -> section -> default` from the Firestore
policy for every request. A policy or member-group change takes effect within
the cache window with no PR, rebuild or redeploy.

The document shapes:

    access_policy/current
    {
      "version": 1,
      "default": {"groups": [...], "roles": [...]},
      "sections": {"<section>": {...}},
      "sources": {"<source>": {...}},
      "items": {"<section>/<source>/<slug>": {...}}
    }

    _hub/catalog.json
    {
      "version": 2,
      "items": {
        "<section>/<source>/<slug>": {
          "section", "source", "slug", "title", "format", "visibility",
          "href", "entry"
        }
      },
      "objects": {"<_payload/... | <item>/_doc/...>": ["<item key>", ...]}
    }

`_hub/**` is never served through `/p/**`. An object absent from `objects`
fails closed, so a restricted item and a nonexistent one are indistinguishable.
"""

from __future__ import annotations

import json
import logging
import re
import time
from dataclasses import dataclass
from typing import Any, Protocol

from .members import MemberProfile

logger = logging.getLogger("gate")

# Hub-owned private pages that carry no item catalogue and are readable by any
# signed-in member. The item routes are resolved through `objects`; `_astro/**`
# is the build's shared asset tree and is handled by prefix.
MEMBER_PAGES = frozenset({"index.html", "shares/index.html", "notes/index.html"})
ASTRO_PREFIX = "_astro/"
RESERVED_PREFIX = "_hub/"

# The maximum the brief allows. A stale policy can only be stale for this long.
DEFAULT_CACHE_SECONDS = 30
MAX_CACHE_SECONDS = 30

# Group and role names are lower-case tokens, matching members.normalise_group.
# A typo is a denial, never a widening.
_NAME_PATTERN = re.compile(r"^[a-z0-9][a-z0-9-]{0,63}$")


@dataclass(frozen=True)
class AccessRule:
    """Who may read one item or served object."""

    groups: frozenset[str] = frozenset()
    roles: frozenset[str] = frozenset()
    member: bool = False

    def allows(self, profile: MemberProfile) -> bool:
        # The owner is always allowed, whatever the rule says. This is the one
        # unconditional grant in the system, and it lives here so no route can
        # forget it.
        if profile.is_owner:
            return True
        if self.member:
            return True
        if profile.role in self.roles:
            return True
        return bool(self.groups.intersection(profile.groups))


# Fail closed: a rule that allows nobody except the owner.
DENY = AccessRule()
# Any signed-in member. Used for public items, hub pages and `_astro/**`.
ANY_MEMBER = AccessRule(member=True)

DEFAULT_POLICY_COLLECTION = "access_policy"
DEFAULT_POLICY_DOCUMENT = "current"
DEFAULT_CATALOG_OBJECT = "_hub/catalog.json"


@dataclass(frozen=True)
class AccessPolicy:
    """The owner's Firestore policy, already validated."""

    default: AccessRule
    sections: dict[str, AccessRule]
    sources: dict[str, AccessRule]
    items: dict[str, AccessRule]

    def rule_for(self, section: str, source: str, slug: str) -> AccessRule:
        return (
            self.items.get(f"{section}/{source}/{slug}")
            or self.sources.get(source)
            or self.sections.get(section)
            or self.default
        )


@dataclass(frozen=True)
class AccessItem:
    section: str
    source: str
    slug: str
    title: str
    format: str
    visibility: str
    href: str | None
    entry: str | None

    @property
    def key(self) -> str:
        return f"{self.section}/{self.source}/{self.slug}"

    def as_listing(self) -> dict[str, Any]:
        return {
            "section": self.section,
            "source": self.source,
            "slug": self.slug,
            "title": self.title,
            "format": self.format,
            "visibility": self.visibility,
            "href": self.href,
            "entry": self.entry,
        }


@dataclass(frozen=True)
class ItemCatalog:
    """Item metadata plus the object -> item map, from the private bucket."""

    items: dict[str, AccessItem]
    objects: dict[str, tuple[str, ...]]

    def item(self, section: str, source: str, slug: str) -> AccessItem | None:
        return self.items.get(f"{section}/{source}/{slug}")

    def item_for_object(self, relative: str) -> AccessItem | None:
        keys = self.objects.get(relative)
        if not keys:
            return None
        # Shared payload files are mapped to every item that stages them.
        return next((self.items[key] for key in keys if key in self.items), None)

    def items_for_object(self, relative: str) -> list[AccessItem]:
        keys = self.objects.get(relative, ())
        return [self.items[key] for key in keys if key in self.items]


class PolicySource(Protocol):
    def policy(self) -> AccessPolicy | None: ...


class CatalogSource(Protocol):
    def catalog(self) -> ItemCatalog | None: ...


class AccessMap(Protocol):
    """What the routes need from the joined policy and catalog."""

    def allows_object(self, profile: MemberProfile, name: str, private_prefix: str = "") -> bool: ...

    def allows_item(self, profile: MemberProfile, section: str, source: str, slug: str) -> bool: ...

    def listings(self, profile: MemberProfile, *, include_all: bool = False) -> list[AccessItem]: ...


def _strip_prefix(name: str, private_prefix: str) -> str:
    cleaned = private_prefix.strip("/")
    if cleaned:
        if not name.startswith(f"{cleaned}/"):
            return ""
        return name[len(cleaned) + 1 :]
    return name


def _parse_names(value: object, field: str) -> frozenset[str]:
    if not isinstance(value, list):
        raise ValueError(f"{field} must be an array of group/role names")
    names: set[str] = set()
    for name in value:
        if not isinstance(name, str) or not _NAME_PATTERN.fullmatch(name):
            raise ValueError(f"{field} contains an invalid group/role name")
        names.add(name)
    return frozenset(names)


def _parse_policy_rule(raw: object, field: str) -> AccessRule:
    if not isinstance(raw, dict):
        raise ValueError(f"{field} must be an object with groups and/or roles")
    unknown = set(raw) - {"groups", "roles"}
    if unknown:
        raise ValueError(f"{field} has unknown key(s): {sorted(unknown)}")
    return AccessRule(
        groups=_parse_names(raw.get("groups", []), f"{field}.groups"),
        roles=_parse_names(raw.get("roles", []), f"{field}.roles"),
    )


def _parse_rule_map(raw: object, field: str) -> dict[str, AccessRule]:
    if raw is None:
        return {}
    if not isinstance(raw, dict):
        raise ValueError(f"{field} must be an object keyed by name")
    out: dict[str, AccessRule] = {}
    for key, value in raw.items():
        if not isinstance(key, str) or not key:
            raise ValueError(f"{field} has an invalid key")
        out[key] = _parse_policy_rule(value, f"{field}[{key!r}]")
    return out


def parse_access_policy(raw: object) -> AccessPolicy:
    """Parse `access_policy/current`, refusing anything malformed.

    A malformed policy raises rather than being read as "allow everything" or
    "allow nothing inconsistently". The store turns that into a fail-closed
    `None`.
    """
    if not isinstance(raw, dict):
        raise ValueError("access policy must be an object")
    if raw.get("version") != 1:
        raise ValueError("access policy must declare version 1")
    if "default" not in raw:
        raise ValueError("access policy must carry a default rule")
    unknown = set(raw) - {"version", "default", "sections", "sources", "items", "updated_at", "updated_by"}
    if unknown:
        raise ValueError(f"access policy has unknown top-level key(s): {sorted(unknown)}")
    return AccessPolicy(
        default=_parse_policy_rule(raw["default"], "default"),
        sections=_parse_rule_map(raw.get("sections"), "sections"),
        sources=_parse_rule_map(raw.get("sources"), "sources"),
        items=_parse_rule_map(raw.get("items"), "items"),
    )


def _parse_item(key: str, raw: object) -> AccessItem | None:
    if not isinstance(raw, dict):
        return None
    section = raw.get("section")
    source = raw.get("source")
    slug = raw.get("slug")
    title = raw.get("title")
    fmt = raw.get("format")
    visibility = raw.get("visibility")
    href = raw.get("href")
    entry = raw.get("entry")
    if not all(isinstance(v, str) and v for v in (section, source, slug, title, fmt, visibility)):
        return None
    if f"{section}/{source}/{slug}" != key:
        return None
    if visibility not in ("public", "private"):
        return None
    if href is not None and not isinstance(href, str):
        return None
    if entry is not None and not isinstance(entry, str):
        return None
    # The catalog must never carry an access decision (D24-B).
    if "access" in raw or "groups" in raw or "roles" in raw:
        return None
    return AccessItem(
        section=section,
        source=source,
        slug=slug,
        title=title,
        format=fmt,
        visibility=visibility,
        href=href,
        entry=entry,
    )


def parse_catalog_document(raw: object) -> ItemCatalog:
    """Parse the private build's `_hub/catalog.json`, refusing anything malformed.

    It carries item metadata and an object -> item-key map. It must not carry
    groups or roles: a stale or tampered catalog cannot widen access because
    every rule is joined from Firestore.
    """
    if not isinstance(raw, dict) or raw.get("version") != 2:
        raise ValueError("catalog document must be an object with version 2")
    raw_items = raw.get("items")
    raw_objects = raw.get("objects")
    if not isinstance(raw_items, dict) or not isinstance(raw_objects, dict):
        raise ValueError("catalog document must carry items and objects objects")

    items: dict[str, AccessItem] = {}
    for key, value in raw_items.items():
        if not isinstance(key, str):
            raise ValueError("catalog item keys must be strings")
        item = _parse_item(key, value)
        if item is None:
            raise ValueError(f"catalog item {key!r} is malformed")
        items[key] = item

    objects: dict[str, tuple[str, ...]] = {}
    for key, value in raw_objects.items():
        if not isinstance(key, str) or not key:
            raise ValueError("catalog object keys must be non-empty strings")
        if key.startswith(RESERVED_PREFIX):
            raise ValueError("catalog objects must never map a _hub/ object")
        keys = value if isinstance(value, list) else [value]
        if not keys or any(not isinstance(item_key, str) or not item_key for item_key in keys):
            raise ValueError(f"catalog object {key!r} must map to item key(s)")
        if any(item_key not in items for item_key in keys):
            raise ValueError(f"catalog object {key!r} names an unknown item")
        objects[key] = tuple(dict.fromkeys(keys))

    return ItemCatalog(items=items, objects=objects)


class StaticAccessMap:
    """In-memory AccessMap for tests; never wired in production."""

    def __init__(
        self,
        catalog: ItemCatalog | None = None,
        policy: AccessPolicy | None = None,
    ) -> None:
        self._catalog = catalog
        self._policy = policy

    def allows_object(self, profile: MemberProfile, name: str, private_prefix: str = "") -> bool:
        return _allows_object(self._catalog, self._policy, profile, name, private_prefix)

    def allows_item(self, profile: MemberProfile, section: str, source: str, slug: str) -> bool:
        return _allows_item(self._catalog, self._policy, profile, section, source, slug)

    def listings(self, profile: MemberProfile, *, include_all: bool = False) -> list[AccessItem]:
        return _listings(self._catalog, self._policy, profile, include_all=include_all)


class RuntimeAccessMap:
    """The production AccessMap: Firestore policy joined with bucket catalog."""

    def __init__(self, policy_source: PolicySource, catalog_source: CatalogSource) -> None:
        self._policy_source = policy_source
        self._catalog_source = catalog_source

    def allows_object(self, profile: MemberProfile, name: str, private_prefix: str = "") -> bool:
        return _allows_object(
            self._catalog_source.catalog(),
            self._policy_source.policy(),
            profile,
            name,
            private_prefix,
        )

    def allows_item(self, profile: MemberProfile, section: str, source: str, slug: str) -> bool:
        return _allows_item(
            self._catalog_source.catalog(),
            self._policy_source.policy(),
            profile,
            section,
            source,
            slug,
        )

    def listings(self, profile: MemberProfile, *, include_all: bool = False) -> list[AccessItem]:
        return _listings(
            self._catalog_source.catalog(),
            self._policy_source.policy(),
            profile,
            include_all=include_all,
        )


def _allows_item(
    catalog: ItemCatalog | None,
    policy: AccessPolicy | None,
    profile: MemberProfile,
    section: str,
    source: str,
    slug: str,
) -> bool:
    if profile.is_owner:
        return True
    # First-party hub pages (source "hub") are public pages with a member
    # annotation surface. They are not in a manifest, so the gate allows any
    # member to annotate them, exactly as before D24.
    if source == "hub":
        return True
    # Fail closed: a missing/malformed policy or catalog allows no member read.
    if policy is None or catalog is None:
        return False
    item = catalog.item(section, source, slug)
    if item is None:
        return False
    if item.visibility == "public":
        return ANY_MEMBER.allows(profile)
    return policy.rule_for(section, source, slug).allows(profile)


def _allows_object(
    catalog: ItemCatalog | None,
    policy: AccessPolicy | None,
    profile: MemberProfile,
    name: str,
    private_prefix: str,
) -> bool:
    relative = _strip_prefix(name, private_prefix)
    if relative == "" or relative.startswith(RESERVED_PREFIX):
        return False
    if profile.is_owner:
        return True
    # Fail closed: a missing/malformed policy or catalog allows no member read,
    # including the hub's own member pages.
    if policy is None or catalog is None:
        return False
    if relative in MEMBER_PAGES or relative.startswith(ASTRO_PREFIX):
        return True
    items = catalog.items_for_object(relative)
    if not items:
        # An unmapped object fails closed, so "restricted" and "does not exist"
        # produce the same answer.
        return False
    for item in items:
        if item.visibility == "public" or policy.rule_for(item.section, item.source, item.slug).allows(
            profile
        ):
            return True
    return False


def _listings(
    catalog: ItemCatalog | None,
    policy: AccessPolicy | None,
    profile: MemberProfile,
    *,
    include_all: bool,
) -> list[AccessItem]:
    if catalog is None:
        return []
    if include_all or profile.is_owner:
        return sorted(catalog.items.values(), key=lambda item: (item.title.lower(), item.key))
    if policy is None:
        return []
    allowed = [
        item
        for item in catalog.items.values()
        if item.visibility == "public"
        or policy.rule_for(item.section, item.source, item.slug).allows(profile)
    ]
    return sorted(allowed, key=lambda item: (item.title.lower(), item.key))


class FirestoreAccessPolicyStore:
    """PolicySource backed by `access_policy/current` in Firestore.

    Reads at most once per cache window. The window is capped at
    MAX_CACHE_SECONDS so a policy change takes effect without a deploy. Failure
    is cached too: a malformed or missing document keeps failing closed instead
    of hammering Firestore on every request.
    """

    def __init__(
        self,
        collection: str = DEFAULT_POLICY_COLLECTION,
        document: str = DEFAULT_POLICY_DOCUMENT,
        project_id: str | None = None,
        *,
        cache_seconds: int = DEFAULT_CACHE_SECONDS,
        clock: Any = time.monotonic,
        client: Any | None = None,
    ) -> None:
        if not 1 <= cache_seconds <= MAX_CACHE_SECONDS:
            raise ValueError(f"cache_seconds must be between 1 and {MAX_CACHE_SECONDS}")
        self._collection = collection
        self._document = document
        self._project_id = project_id
        self._cache_seconds = cache_seconds
        self._clock = clock
        self._client = client
        self._loaded: AccessPolicy | None = None
        self._loaded_at: float | None = None
        self._failed = False

    def _ensure_client(self) -> Any:
        # Lazy import: keeps the module importable without cloud credentials.
        from google.cloud import firestore

        if self._client is None:
            self._client = (
                firestore.Client(project=self._project_id) if self._project_id else firestore.Client()
            )
        return self._client

    def policy(self) -> AccessPolicy | None:
        now = self._clock()
        if self._loaded_at is not None and now - self._loaded_at < self._cache_seconds:
            return self._loaded
        self._loaded_at = now
        self._loaded = None
        self._failed = False
        try:
            snapshot = self._ensure_client().collection(self._collection).document(self._document).get()
            if not snapshot.exists:
                raise ValueError("missing access policy document")
            self._loaded = parse_access_policy(snapshot.to_dict() or {})
            return self._loaded
        except Exception as exc:
            self._failed = True
            logger.error(
                "event=misconfigured setting=access_policy document=%s/%s error=%s",
                self._collection,
                self._document,
                type(exc).__name__,
            )
            return None


class BucketCatalogStore:
    """CatalogSource backed by `_hub/catalog.json` in the private bucket."""

    def __init__(
        self,
        store: Any,
        object_name: str = DEFAULT_CATALOG_OBJECT,
        *,
        cache_seconds: int = DEFAULT_CACHE_SECONDS,
        clock: Any = time.monotonic,
    ) -> None:
        if not 1 <= cache_seconds <= MAX_CACHE_SECONDS:
            raise ValueError(f"cache_seconds must be between 1 and {MAX_CACHE_SECONDS}")
        self._store = store
        self._object_name = object_name
        self._cache_seconds = cache_seconds
        self._clock = clock
        self._loaded: ItemCatalog | None = None
        self._loaded_at: float | None = None
        self._failed = False

    def catalog(self) -> ItemCatalog | None:
        now = self._clock()
        if self._loaded_at is not None and now - self._loaded_at < self._cache_seconds:
            return self._loaded
        self._loaded_at = now
        self._loaded = None
        self._failed = False
        try:
            stored = self._store.fetch(self._object_name)
            if stored is None:
                raise ValueError(f"missing {self._object_name}")
            payload = b"".join(stored.chunks())
            self._loaded = parse_catalog_document(json.loads(payload))
            return self._loaded
        except Exception as exc:
            self._failed = True
            logger.error(
                "event=misconfigured setting=catalog object=%s error=%s",
                self._object_name,
                type(exc).__name__,
            )
            return None
