"""Tests for the notes-export subsystem (ADR-0022/D18).

Everything runs against the in-memory fakes: no network, no key, no Cloud
credentials. The properties that matter are the debounce, the retry/dead-letter
lifetime, the branch/commit discipline (never `main`), the deterministic render
(with tombstones), and that no credential can reach a log line.
"""

from __future__ import annotations

import re
from dataclasses import replace
from datetime import UTC, datetime, timedelta

import pytest

from app.notes_sync import (
    DEAD_LETTER_AFTER,
    MAX_ATTEMPTS,
    MAX_ENTRIES_PER_ITEM,
    NOTES_BRANCH,
    ExportEntry,
    NotesSync,
    Route,
    StaticExportQueue,
    StaticGitHubAppClient,
    _job_from_document,
    _short_error,
    backoff_seconds,
    commit_message,
    debounce_seconds,
    destinations,
    job_id,
    notes_path,
    one_line,
    parse_routing,
    render_item_markdown,
)

ROUTING_JSON = {
    "version": 1,
    "routes": {
        "paper": {"repo": "djjay0131/soa-agentic-se", "dir": "notes"},
        "experiment": {"repo": "djjay0131/agentic-kg-research", "dir": "notes"},
        "brainstorm": {"repo": "djjay0131/agentic-kg-research", "dir": "notes"},
        "question": None,
    },
}
ROUTING = parse_routing(ROUTING_JSON)

SOA = "djjay0131/soa-agentic-se"
RESEARCH = "djjay0131/agentic-kg-research"

BASE = datetime(2026, 10, 7, 12, 0, 0, tzinfo=UTC)
ITEM = ("phd", "phd-milestones", "committee-dossier")


def entry(
    intent: str,
    quote: str,
    *,
    comment: str = "",
    member: str = "djjay@vt.edu",
    created: datetime | None = None,
    deleted: bool = False,
    deleted_at: datetime | None = None,
) -> ExportEntry:
    return ExportEntry(
        intent=intent,
        quote=quote,
        comment=comment,
        member=member,
        created=created or BASE,
        deleted=deleted,
        deleted_at=deleted_at,
    )


def make_sync(
    entries: list[ExportEntry],
    *,
    github: StaticGitHubAppClient | None = None,
    queue: StaticExportQueue | None = None,
    enabled: bool = True,
) -> tuple[NotesSync, StaticExportQueue, StaticGitHubAppClient]:
    queue = queue or StaticExportQueue()
    github = github or StaticGitHubAppClient({SOA: "main", RESEARCH: "main"})
    for repo in (SOA, RESEARCH):
        if github.branch_sha(repo, "main") is None:
            github._branches[(repo, "main")] = "base-sha"  # seed the default, no creation recorded
    sync = NotesSync(
        queue=queue,
        github=github,
        routing=ROUTING,
        entries_for_item=lambda section, source, slug: entries,
        canonical_origin="https://jason.cusati.us",
        enabled=enabled,
    )
    return sync, queue, github


# --- pure functions --------------------------------------------------------


def test_debounce_and_backoff_are_bounded_and_deterministic():
    assert debounce_seconds(None) == 45
    assert debounce_seconds("nonsense") == 45
    assert debounce_seconds(10) == 30
    assert debounce_seconds(999) == 60
    assert backoff_seconds(1) == 60
    assert backoff_seconds(2) == 120
    assert backoff_seconds(3) == 240
    assert backoff_seconds(10) == 3600
    assert backoff_seconds(10_000) == 3600


def test_job_id_is_stable_safe_and_content_free():
    first = job_id(*ITEM)
    assert re.fullmatch(r"[0-9a-f]{64}", first)
    assert job_id(*ITEM) == first
    assert job_id("phd", "phd-milestones", "other") != first
    # No part of the item address is recoverable from the id.
    assert "committee" not in first


def test_notes_path_is_nested_and_refuses_traversal():
    assert notes_path("construction-ai", "cost-model") == "notes/construction-ai/cost-model.md"
    assert notes_path("hub", "research/soa-agentic-se") == "notes/hub/research/soa-agentic-se.md"
    for bad in ("../x", "/abs", "a//b", ".", "..", "a\\b", ""):
        assert notes_path("source", bad) is None, bad
    assert notes_path("../source", "x") is None


def test_render_is_chronological_deterministic_and_escaped():
    later = entry("paper", "second", created=BASE + timedelta(minutes=5))
    earlier = entry("paper", "first", created=BASE)
    text = render_item_markdown(
        [later, earlier],
        section="phd",
        source="phd-milestones",
        slug="committee-dossier",
        origin="https://jason.cusati.us",
    )
    assert text.index("first") < text.index("second")
    assert "# phd/phd-milestones/committee-dossier" in text
    assert text == render_item_markdown(
        [later, earlier],
        section="phd",
        source="phd-milestones",
        slug="committee-dossier",
        origin="https://jason.cusati.us",
    )


def test_render_neutralises_link_and_block_injection():
    text = render_item_markdown(
        [entry("paper", "[x](javascript:alert(1))", comment="# not a heading\n![b](https://evil)")],
        section="phd",
        source="s",
        slug="y",
        origin="https://jason.cusati.us",
    )
    assert "[x](" not in text
    assert "![b](" not in text
    assert re.search(r"^# not a heading", text, re.M) is None
    assert "> # not a heading" in text


def test_render_records_a_tombstone_instead_of_dropping_the_entry():
    deleted = entry("paper", "gone", deleted=True, deleted_at=BASE + timedelta(days=1))
    text = render_item_markdown(
        [deleted], section="phd", source="s", slug="y", origin="https://jason.cusati.us"
    )
    assert "## tombstone" in text
    assert "_(deleted" in text
    assert "gone" in text


def test_destinations_group_by_intent_and_include_tombstones_but_not_question():
    entries = [
        entry("paper", "a"),
        entry("experiment", "b"),
        entry("brainstorm", "c"),
        entry("question", "d"),
        entry("paper", "e", deleted=True, deleted_at=BASE),
    ]
    by_repo = destinations(entries, ROUTING)
    assert set(by_repo) == {SOA, RESEARCH}
    assert len(by_repo[SOA]) == 2  # the live paper entry AND its tombstone
    assert len(by_repo[RESEARCH]) == 2
    assert any(e.deleted for e in by_repo[SOA])


def test_parse_routing_rejects_missing_intent_and_bad_repo():
    with pytest.raises(ValueError):
        parse_routing({"routes": {"paper": {"repo": "a/b", "dir": "notes"}}})
    with pytest.raises(ValueError):
        parse_routing({"routes": {**ROUTING_JSON["routes"], "paper": {"repo": "nope"}}})
    parsed = parse_routing(ROUTING_JSON)
    assert parsed["question"] is None
    assert parsed["paper"] == Route(repo=SOA, dir="notes")


def test_commit_message_and_error_text_carry_no_content_or_credential():
    assert commit_message(*ITEM) == "notes: update phd/phd-milestones/committee-dossier"
    # A dangerous identity never reaches the message.
    assert commit_message("phd", "s", "../evil") == "notes: update item"
    redacted = _short_error("boom\nghs_abc123xyz eyJhbGci.abc.def ghp_secret")
    assert "\n" not in redacted
    assert "ghs_abc123xyz" not in redacted
    assert "ghp_secret" not in redacted
    assert "eyJhbGci.abc.def" not in redacted
    assert "[redacted]" in redacted


# --- queue -----------------------------------------------------------------


def test_queue_debounce_coalesces_and_success_removes():
    queue = StaticExportQueue()
    queue.enqueue(*ITEM, now=BASE, debounce=45)
    assert queue.due(BASE) == []  # not_before is in the future
    assert len(queue.due(BASE + timedelta(seconds=45))) == 1
    # A second edit inside the window coalesces to one job and pushes the time.
    queue.enqueue(*ITEM, now=BASE + timedelta(seconds=10), debounce=45)
    assert len(queue.due(BASE + timedelta(seconds=45))) == 0
    due = queue.due(BASE + timedelta(seconds=55))
    assert len(due) == 1
    queue.success(due[0])
    assert queue.due(BASE + timedelta(hours=1)) == []


def test_queue_retries_with_backoff_then_dead_letters_after_24h():
    queue = StaticExportQueue()
    queue.enqueue(*ITEM, now=BASE, debounce=30)
    job = queue.due(BASE + timedelta(seconds=30))[0]

    t = BASE + timedelta(seconds=30)
    queue.failure(job, now=t, error="boom")
    retried = queue.due(t + timedelta(seconds=59))
    assert retried == []  # backoff(1) = 60s
    retried = queue.due(t + timedelta(seconds=60))
    assert len(retried) == 1 and retried[0].attempts == 1

    # Fail repeatedly until the 24h window is crossed; the job is dead-lettered.
    job = retried[0]
    queue.failure(job, now=BASE + DEAD_LETTER_AFTER + timedelta(seconds=1), error="still down")
    assert queue.due(BASE + timedelta(days=2)) == []
    assert queue.state_for(*ITEM) == {"state": "dead_letter", "error": "still down"}


# --- orchestrator ----------------------------------------------------------


def test_drain_creates_notes_branch_from_default_once_and_commits():
    sync, _queue, github = make_sync([entry("paper", "the quote")])
    sync.enqueue(*ITEM, now=BASE)
    assert sync.drain(now=BASE + timedelta(seconds=45)) == 1

    assert github.branches_created == [(SOA, NOTES_BRANCH)]
    assert len(github.commits) == 1
    repo, branch, path, message = github.commits[0]
    assert repo == SOA
    assert branch == NOTES_BRANCH
    assert path == "notes/phd-milestones/committee-dossier.md"
    assert message == "notes: update phd/phd-milestones/committee-dossier"
    assert branch != "main"


def test_drain_is_idempotent_when_content_is_unchanged():
    sync, _queue, github = make_sync([entry("paper", "same")])
    sync.enqueue(*ITEM, now=BASE)
    sync.drain(now=BASE + timedelta(seconds=45))
    sync.enqueue(*ITEM, now=BASE + timedelta(minutes=5))
    sync.drain(now=BASE + timedelta(minutes=6))
    # No second commit: the regenerated file equals what is already on the branch.
    assert len(github.commits) == 1


def test_mixed_intents_write_one_file_per_destination_repo():
    entries = [entry("paper", "p"), entry("experiment", "e"), entry("question", "q")]
    sync, _queue, github = make_sync(entries)
    sync.enqueue(*ITEM, now=BASE)
    sync.drain(now=BASE + timedelta(seconds=45))
    repos = {c[0] for c in github.commits}
    assert repos == {SOA, RESEARCH}
    soa_text = github.get_file(SOA, "notes/phd-milestones/committee-dossier.md", NOTES_BRANCH)[0]
    research_text = github.get_file(RESEARCH, "notes/phd-milestones/committee-dossier.md", NOTES_BRANCH)[0]
    assert "## paper" in soa_text and "## experiment" not in soa_text
    assert "## experiment" in research_text and "## paper" not in research_text


def test_no_repo_write_for_question_only_items():
    sync, _queue, github = make_sync([entry("question", "just a question")])
    sync.enqueue(*ITEM, now=BASE)
    sync.drain(now=BASE + timedelta(seconds=45))
    assert github.commits == []
    assert github.branches_created == []


def test_disabled_sync_is_a_noop():
    sync, queue, github = make_sync([entry("paper", "x")], enabled=False)
    sync.enqueue(*ITEM, now=BASE)
    assert queue.due(BASE + timedelta(days=1)) == []
    assert sync.drain(now=BASE + timedelta(days=1)) == 0
    assert github.commits == []


def test_a_write_failure_retries_and_stays_visible():
    github = StaticGitHubAppClient({SOA: "main", RESEARCH: "main"})
    github.create_branch(SOA, "main", "base")
    github.raise_on = {"put_file"}
    sync, queue, github = make_sync([entry("paper", "x")], github=github)
    sync.enqueue(*ITEM, now=BASE)
    assert sync.drain(now=BASE + timedelta(seconds=45)) == 0
    state = queue.state_for(*ITEM)
    assert state["state"] == "pending"
    assert queue.due(BASE + timedelta(seconds=105))[0].attempts == 1

    # A later, healthy drain delivers it.
    github.raise_on = set()
    assert sync.drain(now=BASE + timedelta(seconds=105)) == 1
    assert queue.state_for(*ITEM) is None


# --- round-1 fixes and coverage -------------------------------------------


def test_a_deleted_only_item_still_writes_a_tombstone():
    """RT6NS-01 / Dissenter B1: deleting the last note must reach the repo."""
    sync, _queue, github = make_sync(
        [entry("paper", "gone", deleted=True, deleted_at=BASE + timedelta(days=1))]
    )
    sync.enqueue(*ITEM, now=BASE)
    assert sync.drain(now=BASE + timedelta(seconds=45)) == 1
    assert len(github.commits) == 1
    text = github.get_file(SOA, "notes/phd-milestones/committee-dossier.md", NOTES_BRANCH)[0]
    assert "## tombstone" in text
    assert "gone" in text


def test_notes_branch_is_created_only_once():
    """Skeptic g-1: the branch-once early return must be fail-able."""
    entries = [entry("paper", "one")]
    sync, _queue, github = make_sync(entries)
    sync.enqueue(*ITEM, now=BASE)
    sync.drain(now=BASE + timedelta(seconds=45))
    entries.append(entry("paper", "two", created=BASE + timedelta(minutes=1)))
    sync.enqueue(*ITEM, now=BASE + timedelta(minutes=5))
    sync.drain(now=BASE + timedelta(minutes=6))
    assert github.branches_created == [(SOA, NOTES_BRANCH)]
    assert len(github.commits) == 2


def test_job_document_with_a_tampered_id_is_refused():
    data = {
        "section": "phd",
        "source": "s",
        "slug": "y",
        "first_attempt": BASE,
        "next_attempt": BASE,
        "not_before": BASE,
    }
    assert _job_from_document("wrong-id", data) is None
    assert _job_from_document(job_id("phd", "s", "y"), data) is not None


def test_one_line_collapses_control_characters():
    assert one_line("a\nb\tc\x00d") == "a b c d"


def test_renderer_strips_control_characters_from_a_comment():
    text = render_item_markdown(
        [entry("paper", "q", comment="hi\x00\x1b[31mred")],
        section="s",
        source="s",
        slug="y",
        origin="https://jason.cusati.us",
    )
    assert "\x00" not in text
    assert "\x1b" not in text
    assert "red" in text


def test_queue_dead_letters_at_the_attempt_cap():
    queue = StaticExportQueue()
    queue.enqueue(*ITEM, now=BASE, debounce=30)
    job = queue.due(BASE + timedelta(seconds=30))[0]
    queue.failure(replace(job, attempts=MAX_ATTEMPTS - 1), now=BASE + timedelta(seconds=31), error="x")
    assert queue.state_for(*ITEM) == {"state": "dead_letter", "error": "x"}


def test_renderer_caps_the_number_of_entries_per_item():
    many = [
        entry("paper", f"q{i}", created=BASE + timedelta(seconds=i)) for i in range(MAX_ENTRIES_PER_ITEM + 3)
    ]
    text = render_item_markdown(many, section="s", source="s", slug="y", origin="https://jason.cusati.us")
    assert "earlier entries omitted" in text
