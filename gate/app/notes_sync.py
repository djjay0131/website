"""The gate commits annotations to a long-lived `notes` branch (ADR-0022, D18).

On a successful create or soft-delete, the gate enqueues an export job for the
item. A debounce (30-60s) coalesces rapid edits into one commit; a Firestore
queue retries with exponential backoff for at least 24h and then dead-letters the
job (a flag the members' My notes page surfaces). Firestore is the source of
truth; the repository is a projection that catches up after any GitHub outage.

The credential is a GitHub App private key held in Secret Manager in the project.
The gate mints a short-lived installation token server-side; the browser never
sees a GitHub credential and no GitHub Actions secret is used.

Everything with a decision in it is a pure function or a Protocol with a static
fake, so the whole module is testable with no network, no key and no Cloud
credentials. The real clients are lazy-imported.
"""

from __future__ import annotations

import base64
import hashlib
import logging
import re
import time
from collections.abc import Callable
from dataclasses import dataclass, replace
from datetime import UTC, datetime, timedelta
from typing import Any, Protocol

logger = logging.getLogger("gate")

# --- constants -------------------------------------------------------------

DEFAULT_DEBOUNCE_SECONDS = 45
MIN_DEBOUNCE_SECONDS = 30
MAX_DEBOUNCE_SECONDS = 60

BASE_BACKOFF_SECONDS = 60
MAX_BACKOFF_SECONDS = 3600
DEAD_LETTER_AFTER = timedelta(hours=24)
MAX_ATTEMPTS = 200

DEFAULT_SECRET_NAME = "notes-export-app-key"  # noqa: S105 - a secret NAME, not a value
NOTES_BRANCH = "notes"
DEFAULT_ROUTING_DIR = "notes"

# Bound what the renderer will emit even if a stored row is somehow larger than
# the create-time caps, so a corrupt row cannot make a huge commit.
MAX_QUOTE_CHARS = 2000
MAX_COMMENT_CHARS = 5000
MAX_ENTRY_MEMBER_CHARS = 320
# A single item's file is bounded: a member cannot make one commit arbitrarily
# large. Entries beyond this are omitted from the REPOSITORY projection with a
# visible note; Firestore keeps them all (it is the source of truth).
MAX_ENTRIES_PER_ITEM = 2000

# C0 controls except TAB (0x09) and LF (0x0A). CR (0x0D) IS stripped.
_CONTROL = re.compile(r"[\x00-\x08\x0b-\x1f\x7f]")

QUOTE_SELECTOR_TYPE = "TextQuoteSelector"
POSITION_SELECTOR_TYPE = "TextPositionSelector"

_INTENTS = ("paper", "experiment", "brainstorm", "question")

# One safe path segment, matching the gate's object-path allowlist. An item
# identity is validated with this before it can become a repo path.
_SEGMENT = re.compile(r"\A[A-Za-z0-9._-]+\Z")


def _clamp(value: object, *, low: int, high: int, default: int) -> int:
    try:
        number = int(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return default
    return max(low, min(high, number))


def debounce_seconds(raw: object) -> int:
    """The debounce window, clamped to the D18 range [30, 60] seconds."""
    return _clamp(raw, low=MIN_DEBOUNCE_SECONDS, high=MAX_DEBOUNCE_SECONDS, default=DEFAULT_DEBOUNCE_SECONDS)


def backoff_seconds(attempts: int) -> int:
    """Exponential backoff, `min(60 * 2**(n-1), 3600)`, for attempt n (1-based)."""
    if attempts < 1:
        attempts = 1
    # Cap the exponent so a very large attempt count cannot build a huge int.
    exponent = min(attempts - 1, 20)
    return min(BASE_BACKOFF_SECONDS * (2**exponent), MAX_BACKOFF_SECONDS)


def job_id(section: str, source: str, slug: str) -> str:
    """A stable, safe Firestore document id for one item's export job."""
    return hashlib.sha256(f"{section}/{source}/{slug}".encode()).hexdigest()


def is_safe_segment(segment: object) -> bool:
    return isinstance(segment, str) and bool(_SEGMENT.match(segment)) and segment not in (".", "..")


def item_is_safe(section: object, source: object, slug: object) -> bool:
    if not is_safe_segment(section) or not is_safe_segment(source) or not isinstance(slug, str):
        return False
    parts = slug.split("/")
    return bool(parts) and all(is_safe_segment(part) for part in parts)


def notes_path(source: str, slug: str) -> str | None:
    """`notes/<source>/<slug>.md`, or None when the identity is unsafe."""
    if not is_safe_segment(source) or not isinstance(slug, str):
        return None
    parts = slug.split("/")
    if not parts or not all(is_safe_segment(part) for part in parts):
        return None
    return "/".join(["notes", source, *parts]) + ".md"


def escape_markdown(value: object) -> str:
    """HTML + Markdown escaping, matching the site export renderer (RT6-06).

    Control characters (NUL, ESC, CR, …) are removed first, so a comment or quote
    cannot carry them into a committed file. LF is preserved for the comment
    blockquote.
    """
    return (
        _CONTROL.sub("", str(value if value is not None else ""))
        .replace("\\", "\\\\")
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace("`", "\\`")
        .replace("*", "\\*")
        .replace("_", "\\_")
        .replace("[", "\\[")
        .replace("]", "\\]")
        .replace("!", "\\!")
    )


def one_line(value: object) -> str:
    """Collapse a metadata value to one line so it cannot open a block."""
    return re.sub(r"[\r\n\u0000-\u001f\u007f]+", " ", str(value if value is not None else ""))


# --- rendering (pure) ------------------------------------------------------


@dataclass(frozen=True)
class ExportEntry:
    """The subset of an annotation the renderer needs (including tombstones)."""

    intent: str
    quote: str
    comment: str
    member: str
    created: datetime
    deleted: bool
    deleted_at: datetime | None


def _deep_link(section: str, source: str, slug: str, origin: str) -> str:
    base = (origin or "").rstrip("/")
    return f"{base}/p/{section}/{source}/{slug}/"


def _entry_block(entry: ExportEntry, *, section: str, source: str, slug: str, origin: str) -> str:
    quote = escape_markdown(one_line(entry.quote))[:MAX_QUOTE_CHARS]
    comment = escape_markdown(entry.comment)[:MAX_COMMENT_CHARS]
    lines = [
        f"## {entry.intent} — {one_line(entry.created.isoformat())}",
        "",
        f"> {quote}",
        "",
    ]
    if comment.strip():
        lines += ["**Comment**", "", *[f"> {line}" for line in comment.split("\n")], ""]
    lines += [
        f"- **Item:** {escape_markdown(one_line(f'{section}/{source}/{slug}'))}",
        f"- **Member:** {escape_markdown(one_line(entry.member))[:MAX_ENTRY_MEMBER_CHARS]}",
        f"- **Link:** {escape_markdown(_deep_link(section, source, slug, origin))}",
        "",
    ]
    return "\n".join(lines)


def _tombstone_block(entry: ExportEntry, *, section: str, source: str, slug: str) -> str:
    when = (entry.deleted_at or entry.created).isoformat()
    quote = escape_markdown(one_line(entry.quote))[:MAX_QUOTE_CHARS]
    return "\n".join(
        [
            f"## tombstone — {one_line(when)}",
            "",
            f"~~{quote}~~ _(deleted {one_line(when)})_",
            "",
            f"- **Item:** {escape_markdown(one_line(f'{section}/{source}/{slug}'))}",
            "",
        ]
    )


def render_item_markdown(
    entries: list[ExportEntry], *, section: str, source: str, slug: str, origin: str
) -> str:
    """The whole `notes/<source>/<slug>.md` for one item.

    Entries are emitted in chronological order; a deleted entry is a tombstone,
    never dropped. The result is deterministic, so an unchanged item produces
    byte-identical content and the writer commits nothing.
    """
    ordered = sorted(entries, key=lambda entry: entry.created)
    omitted = 0
    if len(ordered) > MAX_ENTRIES_PER_ITEM:
        omitted = len(ordered) - MAX_ENTRIES_PER_ITEM
        ordered = ordered[-MAX_ENTRIES_PER_ITEM:]
    blocks = [
        _tombstone_block(entry, section=section, source=source, slug=slug)
        if entry.deleted
        else _entry_block(entry, section=section, source=source, slug=slug, origin=origin)
        for entry in ordered
    ]
    header = f"# {section}/{source}/{slug}\n\n"
    if omitted:
        header += (
            f"_({omitted} earlier entr{'y' if omitted == 1 else 'ies'} omitted here; see My notes.)_\n\n"
        )
    return header + "\n".join(blocks)


def commit_message(section: str, source: str, slug: str) -> str:
    """A commit message built ONLY from the validated item identity.

    Note content never reaches the message, so it cannot inject a line the owner
    or a tooling hook would act on.
    """
    safe = f"{section}/{source}/{slug}" if item_is_safe(section, source, slug) else "item"
    return f"notes: update {one_line(safe)}"


# --- routing (pure) --------------------------------------------------------


@dataclass(frozen=True)
class Route:
    repo: str
    dir: str


def parse_routing(raw: object) -> dict[str, Route | None]:
    """Parse `site/notes-routing.json`-shaped routing into intent -> Route|None.

    Every intent is present; `question` (or an explicit `null`) maps to None and
    is never exported. A malformed file is an error rather than a silent default.
    """
    if isinstance(raw, str):
        import json

        raw = json.loads(raw or "{}")
    if not isinstance(raw, dict):
        raise ValueError("routing must be a JSON object")
    routes = raw.get("routes")
    if not isinstance(routes, dict):
        raise ValueError("routing must carry a routes object")
    parsed: dict[str, Route | None] = {}
    for intent in _INTENTS:
        if intent not in routes:
            raise ValueError(f"routing is missing intent {intent!r}")
        value = routes[intent]
        if value is None:
            parsed[intent] = None
            continue
        repo = value.get("repo")
        directory = value.get("dir", DEFAULT_ROUTING_DIR)
        if not isinstance(repo, str) or repo.count("/") != 1:
            raise ValueError(f"route for {intent!r} must name an owner/name repo")
        if not isinstance(directory, str) or not all(is_safe_segment(p) for p in directory.split("/")):
            raise ValueError(f"route for {intent!r} has an unsafe dir")
        parsed[intent] = Route(repo=repo, dir=directory)
    return parsed


def destinations(
    entries: list[ExportEntry], routing: dict[str, Route | None]
) -> dict[str, list[ExportEntry]]:
    """Group an item's non-`question` entries by destination repo.

    DELETED entries ARE included: a tombstone must reach the repo that carried
    the live entry, otherwise deleting the last routed note would leave the old
    content published forever (Red Team RT6NS-01 / Dissenter B1). `question`
    entries are excluded and never exported.
    """
    out: dict[str, list[ExportEntry]] = {}
    for entry in entries:
        route = routing.get(entry.intent)
        if route is None:
            continue
        out.setdefault(route.repo, []).append(entry)
    return out


# --- queue -----------------------------------------------------------------


@dataclass(frozen=True)
class ExportJob:
    section: str
    source: str
    slug: str
    attempts: int
    first_attempt: datetime
    next_attempt: datetime
    not_before: datetime
    last_error: str | None
    dead_lettered: bool
    dead_lettered_at: datetime | None

    @property
    def doc_id(self) -> str:
        return job_id(self.section, self.source, self.slug)


class ExportQueue(Protocol):
    def enqueue(self, section: str, source: str, slug: str, *, now: datetime, debounce: int) -> None: ...

    def due(self, now: datetime) -> list[ExportJob]: ...

    def success(self, job: ExportJob) -> None: ...

    def failure(self, job: ExportJob, *, now: datetime, error: str) -> None: ...

    def state_for(self, section: str, source: str, slug: str) -> dict[str, Any] | None: ...


def _short_error(value: object) -> str:
    """A log-safe error string: one line, bounded, and never a credential.

    A GitHub installation token (`ghs_…`), any classic/fine-grained PAT
    (`ghp_`, `gho_`, `ghu_`, `github_pat_…`) or a JWT (`eyJ….….…`) is redacted
    before the text can reach a log line, so a client exception that happens to
    echo a header cannot leak one.
    """
    text = re.sub(r"[\r\n]+", " ", str(value if value is not None else ""))
    text = _TOKEN_PATTERN.sub("[redacted]", text)
    return text[:200]


_TOKEN_PATTERN = re.compile(
    r"(gh[sphour]_[A-Za-z0-9_]+|github_pat_[A-Za-z0-9_]+"
    r"|ya29\.[A-Za-z0-9_\-.]+"
    r"|eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+"
    r"|-----BEGIN [A-Z ]*PRIVATE KEY-----.*?-----END [A-Z ]*PRIVATE KEY-----)"
)


def sanitize_error(value: object) -> str:
    """Public name for the log-safe error text (see `_short_error`)."""
    return _short_error(value)


def _job_from_document(doc_id: str, data: dict[str, Any]) -> ExportJob | None:
    section = data.get("section")
    source = data.get("source")
    slug = data.get("slug")
    if not all(isinstance(v, str) and v for v in (section, source, slug)):
        return None
    if job_id(section, source, slug) != doc_id:
        return None
    first = data.get("first_attempt")
    next_at = data.get("next_attempt")
    not_before = data.get("not_before")
    if not all(isinstance(v, datetime) for v in (first, next_at, not_before)):
        return None
    dead = bool(data.get("dead_lettered", False))
    dead_at = data.get("dead_lettered_at")
    if dead and not isinstance(dead_at, datetime):
        return None
    return ExportJob(
        section=section,
        source=source,
        slug=slug,
        attempts=int(data.get("attempts", 0)),
        first_attempt=first,
        next_attempt=next_at,
        not_before=not_before,
        last_error=_short_error(data.get("last_error")) if data.get("last_error") else None,
        dead_lettered=dead,
        dead_lettered_at=dead_at,
    )


class FirestoreExportQueue:
    """ExportQueue backed by Firestore `notes_export/{job_id}`."""

    def __init__(self, collection: str = "notes_export", project_id: str | None = None) -> None:
        self._collection = collection
        self._project_id = project_id
        self._client: Any | None = None

    def _ensure_client(self) -> Any:
        from google.cloud import firestore

        if self._client is None:
            self._client = (
                firestore.Client(project=self._project_id) if self._project_id else firestore.Client()
            )
        return self._client

    def enqueue(self, section: str, source: str, slug: str, *, now: datetime, debounce: int) -> None:
        if not item_is_safe(section, source, slug):
            return
        when = now + timedelta(seconds=debounce)
        self._ensure_client().collection(self._collection).document(job_id(section, source, slug)).set(
            {
                "section": section,
                "source": source,
                "slug": slug,
                "attempts": 0,
                "first_attempt": now,
                "next_attempt": when,
                "not_before": when,
                "last_error": None,
                "dead_lettered": False,
                "dead_lettered_at": None,
            }
        )

    def due(self, now: datetime) -> list[ExportJob]:
        query = self._ensure_client().collection(self._collection).where("dead_lettered", "==", False)
        jobs = [
            job
            for doc in query.stream()
            if (job := _job_from_document(doc.id, doc.to_dict() or {})) and job.next_attempt <= now
        ]
        jobs.sort(key=lambda job: job.next_attempt)
        return jobs

    def success(self, job: ExportJob) -> None:
        self._ensure_client().collection(self._collection).document(job.doc_id).delete()

    def failure(self, job: ExportJob, *, now: datetime, error: str) -> None:
        attempts = job.attempts + 1
        reference = self._ensure_client().collection(self._collection).document(job.doc_id)
        if now - job.first_attempt >= DEAD_LETTER_AFTER or attempts >= MAX_ATTEMPTS:
            reference.update(
                {
                    "attempts": attempts,
                    "last_error": _short_error(error),
                    "dead_lettered": True,
                    "dead_lettered_at": now,
                }
            )
            return
        reference.update(
            {
                "attempts": attempts,
                "last_error": _short_error(error),
                "next_attempt": now + timedelta(seconds=backoff_seconds(attempts)),
            }
        )

    def state_for(self, section: str, source: str, slug: str) -> dict[str, Any] | None:
        snapshot = (
            self._ensure_client().collection(self._collection).document(job_id(section, source, slug)).get()
        )
        if not snapshot.exists:
            return None
        job = _job_from_document(snapshot.id, snapshot.to_dict() or {})
        if job is None:
            return None
        if job.dead_lettered:
            return {"state": "dead_letter", "error": job.last_error or "export failed"}
        return {"state": "pending"}


class StaticExportQueue:
    """In-memory ExportQueue. Used by the tests; never wired in production."""

    def __init__(self) -> None:
        self._jobs: dict[str, ExportJob] = {}

    def enqueue(self, section: str, source: str, slug: str, *, now: datetime, debounce: int) -> None:
        if not item_is_safe(section, source, slug):
            return
        when = now + timedelta(seconds=debounce)
        self._jobs[job_id(section, source, slug)] = ExportJob(
            section=section,
            source=source,
            slug=slug,
            attempts=0,
            first_attempt=now,
            next_attempt=when,
            not_before=when,
            last_error=None,
            dead_lettered=False,
            dead_lettered_at=None,
        )

    def due(self, now: datetime) -> list[ExportJob]:
        jobs = [job for job in self._jobs.values() if not job.dead_lettered and job.next_attempt <= now]
        jobs.sort(key=lambda job: job.next_attempt)
        return jobs

    def success(self, job: ExportJob) -> None:
        self._jobs.pop(job.doc_id, None)

    def failure(self, job: ExportJob, *, now: datetime, error: str) -> None:
        attempts = job.attempts + 1
        if now - job.first_attempt >= DEAD_LETTER_AFTER or attempts >= MAX_ATTEMPTS:
            self._jobs[job.doc_id] = replace(
                job,
                attempts=attempts,
                last_error=_short_error(error),
                dead_lettered=True,
                dead_lettered_at=now,
            )
            return
        self._jobs[job.doc_id] = replace(
            job,
            attempts=attempts,
            last_error=_short_error(error),
            next_attempt=now + timedelta(seconds=backoff_seconds(attempts)),
        )

    def state_for(self, section: str, source: str, slug: str) -> dict[str, Any] | None:
        job = self._jobs.get(job_id(section, source, slug))
        if job is None:
            return None
        if job.dead_lettered:
            return {"state": "dead_letter", "error": job.last_error or "export failed"}
        return {"state": "pending"}


# --- secret + GitHub clients ----------------------------------------------


class SecretProvider(Protocol):
    def get(self, name: str) -> str: ...


class StaticSecretProvider:
    def __init__(self, secrets: dict[str, str] | None = None) -> None:
        self._secrets = dict(secrets or {})

    def get(self, name: str) -> str:
        if name not in self._secrets:
            raise KeyError(name)
        return self._secrets[name]


class SecretManagerRestProvider:
    """Reads a secret version via the Secret Manager REST API using ADC.

    No new dependency: `google.auth` + `requests` are already present. The token
    is short-lived and held only in memory.
    """

    def __init__(self, project_id: str) -> None:
        self._project_id = project_id

    def get(self, name: str) -> str:
        import requests
        from google.auth import default
        from google.auth.transport.requests import Request as GoogleRequest

        credentials, _ = default(scopes=["https://www.googleapis.com/auth/cloud-platform"])
        credentials.refresh(GoogleRequest())
        url = (
            f"https://secretmanager.googleapis.com/v1/projects/{self._project_id}"
            f"/secrets/{name}/versions/latest:access"
        )
        response = requests.get(url, headers={"Authorization": f"Bearer {credentials.token}"}, timeout=10)
        response.raise_for_status()
        payload = response.json().get("payload", {}).get("data", "")
        return base64.b64decode(payload).decode("utf-8")


class GitHubAppClient(Protocol):
    def default_branch(self, repo: str) -> str: ...

    def branch_sha(self, repo: str, branch: str) -> str | None: ...

    def create_branch(self, repo: str, branch: str, sha: str) -> None: ...

    def get_file(self, repo: str, path: str, ref: str) -> tuple[str, str] | None: ...

    def put_file(
        self, repo: str, path: str, ref: str, content: str, message: str, sha: str | None
    ) -> None: ...


class RealGitHubAppClient:
    """GitHub App installation-token client (lazy imports; no key in tests).

    The App private key is read from Secret Manager on first use and a fresh
    installation token is minted per call (<=1h). Neither the key nor the token
    is ever logged or returned.
    """

    def __init__(
        self,
        *,
        app_id: str,
        installation_id: str,
        secret_provider: SecretProvider,
        secret_name: str = DEFAULT_SECRET_NAME,
    ) -> None:
        self._app_id = app_id
        self._installation_id = installation_id
        self._secrets = secret_provider
        self._secret_name = secret_name

    def _token(self) -> str:
        import jwt
        import requests

        private_key = self._secrets.get(self._secret_name)
        now = int(time.time())
        assertion = jwt.encode(
            {"iat": now - 60, "exp": now + 540, "iss": self._app_id}, private_key, algorithm="RS256"
        )
        response = requests.post(
            f"https://api.github.com/app/installations/{self._installation_id}/access_tokens",
            headers={
                "Authorization": f"Bearer {assertion}",
                "Accept": "application/vnd.github+json",
            },
            timeout=10,
        )
        response.raise_for_status()
        return response.json()["token"]

    def _headers(self) -> dict[str, str]:
        return {
            "Authorization": f"token {self._token()}",
            "Accept": "application/vnd.github+json",
        }

    def _get(self, url: str) -> Any:
        import requests

        return requests.get(url, headers=self._headers(), timeout=10)

    def _put(self, url: str, body: dict[str, Any]) -> Any:
        import requests

        return requests.put(url, headers=self._headers(), json=body, timeout=10)

    def default_branch(self, repo: str) -> str:
        response = self._get(f"https://api.github.com/repos/{repo}")
        response.raise_for_status()
        return response.json()["default_branch"]

    def branch_sha(self, repo: str, branch: str) -> str | None:
        import requests

        response = self._get(f"https://api.github.com/repos/{repo}/git/ref/heads/{branch}")
        if response.status_code == requests.codes.not_found:
            return None
        response.raise_for_status()
        return response.json()["object"]["sha"]

    def create_branch(self, repo: str, branch: str, sha: str) -> None:
        import requests

        response = self._put(
            f"https://api.github.com/repos/{repo}/git/refs",
            {"ref": f"refs/heads/{branch}", "sha": sha},
        )
        if response.status_code == requests.codes.unprocessable_entity:
            # Already exists (a race): treat as success.
            return
        response.raise_for_status()

    def get_file(self, repo: str, path: str, ref: str) -> tuple[str, str] | None:
        import requests

        response = self._get(f"https://api.github.com/repos/{repo}/contents/{path}?ref={ref}")
        if response.status_code == requests.codes.not_found:
            return None
        response.raise_for_status()
        data = response.json()
        return base64.b64decode(data["content"]).decode("utf-8"), data["sha"]

    def put_file(self, repo: str, path: str, ref: str, content: str, message: str, sha: str | None) -> None:
        body: dict[str, Any] = {
            "message": message,
            "content": base64.b64encode(content.encode("utf-8")).decode("ascii"),
            "branch": ref,
        }
        if sha:
            body["sha"] = sha
        response = self._put(f"https://api.github.com/repos/{repo}/contents/{path}", body)
        response.raise_for_status()


class StaticGitHubAppClient:
    """In-memory GitHubAppClient. Records branches, files and commits."""

    def __init__(self, repos: dict[str, str] | None = None) -> None:
        # repo -> default branch
        self._defaults = dict(repos or {})
        self._branches: dict[tuple[str, str], str] = {}
        # (repo, branch, path) -> content
        self._files: dict[tuple[str, str, str], str] = {}
        self.commits: list[tuple[str, str, str, str]] = []  # (repo, branch, path, message)
        self.branches_created: list[tuple[str, str]] = []
        self.fail_next: int = 0
        self.raise_on: set[str] = set()

    def default_branch(self, repo: str) -> str:
        if repo not in self._defaults:
            raise KeyError(repo)
        return self._defaults[repo]

    def branch_sha(self, repo: str, branch: str) -> str | None:
        return self._branches.get((repo, branch))

    def create_branch(self, repo: str, branch: str, sha: str) -> None:
        self.branches_created.append((repo, branch))
        self._branches[(repo, branch)] = sha

    def get_file(self, repo: str, path: str, ref: str) -> tuple[str, str] | None:
        key = (repo, ref, path)
        if self.raise_on and "get_file" in self.raise_on:
            raise RuntimeError("simulated read failure")
        if key not in self._files:
            return None
        return self._files[key], f"sha-{hashlib.sha256(self._files[key].encode()).hexdigest()[:12]}"

    def put_file(self, repo: str, path: str, ref: str, content: str, message: str, sha: str | None) -> None:
        if self.raise_on and "put_file" in self.raise_on:
            raise RuntimeError("simulated write failure")
        if self.fail_next > 0:
            self.fail_next -= 1
            raise RuntimeError("simulated transient failure")
        self._files[(repo, ref, path)] = content
        self.commits.append((repo, ref, path, message))


# --- orchestrator ----------------------------------------------------------


def install_notes_branch(github: GitHubAppClient, repo: str) -> None:
    """Ensure the `notes` branch exists, created once from the default branch."""
    if github.branch_sha(repo, NOTES_BRANCH) is not None:
        return
    default = github.default_branch(repo)
    head = github.branch_sha(repo, default)
    if head is None:
        raise RuntimeError(f"{repo} default branch {default!r} not found")
    github.create_branch(repo, NOTES_BRANCH, head)


class NotesSync:
    """Coordinates the queue and the writer. Disabled unless configured."""

    def __init__(
        self,
        *,
        queue: ExportQueue,
        github: GitHubAppClient,
        routing: dict[str, Route | None],
        entries_for_item: Callable[[str, str, str], list[ExportEntry]],
        canonical_origin: str,
        enabled: bool,
        debounce: int = DEFAULT_DEBOUNCE_SECONDS,
    ) -> None:
        self._queue = queue
        self._github = github
        self._routing = routing
        self._entries_for_item = entries_for_item
        self._origin = canonical_origin
        self._enabled = enabled
        self._debounce = debounce

    @property
    def enabled(self) -> bool:
        return self._enabled

    def enqueue(self, section: str, source: str, slug: str, *, now: datetime | None = None) -> None:
        if not self._enabled:
            return
        self._queue.enqueue(section, source, slug, now=now or datetime.now(UTC), debounce=self._debounce)

    def state_for(self, section: str, source: str, slug: str) -> dict[str, Any] | None:
        return self._queue.state_for(section, source, slug)

    def drain(self, *, now: datetime | None = None) -> int:
        if not self._enabled:
            return 0
        moment = now or datetime.now(UTC)
        try:
            jobs = self._queue.due(moment)
        except Exception as exc:  # a queue read failure is not a per-job failure
            logger.warning("event=error scope=notes_sync action=due error=%s", _short_error(exc))
            return 0
        delivered = 0
        for job in jobs:
            try:
                wrote = self._write_job(job)
                self._queue.success(job)
                delivered += 1 if wrote else 0
                if wrote:
                    logger.info(
                        "event=allow scope=notes_sync action=commit repos=%d item_hash=%s",
                        wrote,
                        job.doc_id[:12],
                    )
                else:
                    # A question-only item: queued, coalesced, and honestly a no-op.
                    logger.info("event=allow scope=notes_sync action=noop item_hash=%s", job.doc_id[:12])
            except Exception as exc:  # any failure is a retry, by design
                self._queue.failure(job, now=moment, error=_short_error(exc))
                logger.warning(
                    "event=retry scope=notes_sync item_hash=%s attempts=%d error=%s",
                    job.doc_id[:12],
                    job.attempts + 1,
                    _short_error(exc),
                )
        return delivered

    def _write_job(self, job: ExportJob) -> int:
        """Write the item's file(s); return how many repositories were written."""
        entries = self._entries_for_item(job.section, job.source, job.slug)
        by_repo = destinations(entries, self._routing)
        if not by_repo:
            # Every entry is a question (never exported): nothing to publish.
            return 0
        path = notes_path(job.source, job.slug)
        if path is None:
            raise RuntimeError("unsafe item identity")
        commits = 0
        for repo in sorted(by_repo):
            install_notes_branch(self._github, repo)
            # The file for a repo carries exactly the entries (and their
            # tombstones) whose intent routes to that repo, in chronological
            # order. A tombstone belongs where its live entry would have gone.
            repo_entries = [
                entry
                for entry in entries
                if (route := self._routing.get(entry.intent)) is not None and route.repo == repo
            ]
            text = render_item_markdown(
                repo_entries, section=job.section, source=job.source, slug=job.slug, origin=self._origin
            )
            existing = self._github.get_file(repo, path, NOTES_BRANCH)
            if existing is not None and existing[0] == text:
                continue
            self._github.put_file(
                repo,
                path,
                NOTES_BRANCH,
                text,
                commit_message(job.section, job.source, job.slug),
                existing[1] if existing else None,
            )
            commits += 1
        return commits
