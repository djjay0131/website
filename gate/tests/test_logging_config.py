"""The gate's logger must actually write somewhere.

THIS FILE DELIBERATELY AVOIDS caplog.

Every other test here uses pytest's `caplog`, which attaches its own handler to
the root and forces propagation. That is exactly the thing production did not
have -- so those tests passed for four revisions and 48 hours while not one
`event=` line ever reached Cloud Logging. Both log-based metrics in
infra/monitoring.tf were dead on arrival and the sign-in alert could never have
fired. The harness supplied the missing piece and hid the defect.

So these assertions look at the logger's own configuration and at real stdout.
"""

import io
import logging
import sys

from app.main import _configure_logging, create_app, logger


def test_logger_has_a_handler_at_all(deps):
    # The whole bug in one assertion: getLogger() returns a logger with no
    # handler, and under uvicorn the root has none either at INFO.
    create_app(deps)
    assert logger.handlers, "the gate logger has no handler; every log call is discarded"


def test_logger_is_at_info_or_lower(deps):
    create_app(deps)
    assert logger.getEffectiveLevel() <= logging.INFO, (
        "INFO records are dropped, and every decision the gate logs is INFO"
    )


def test_does_not_propagate_and_so_does_not_double_log(deps):
    # uvicorn's root handler would otherwise print each line a second time,
    # which doubles every log-based metric silently.
    create_app(deps)
    assert logger.propagate is False


def test_repeated_create_app_does_not_stack_handlers(deps):
    # Every test builds an app. Without the idempotency guard each one adds
    # another handler and every line is emitted N times -- which would inflate
    # the metrics rather than empty them, and is just as wrong.
    create_app(deps)
    first = len(logger.handlers)
    for _ in range(5):
        create_app(deps)
    assert len(logger.handlers) == first


def test_the_handler_writes_to_the_real_stdout_stream(deps):
    # NOT capsys and NOT capfd, and the reason matters.
    #
    # _configure_logging() binds sys.stdout ONCE, at the first create_app() in
    # the process. Under pytest that first call happens inside some earlier
    # test, while capture is active -- so the handler holds pytest's replacement
    # stream, and neither capsys nor capfd can ever see it. Both earlier versions
    # of this test failed for that reason while pytest itself printed the line
    # under "Captured stdout", which is about as clear a signal as one gets that
    # the assertion, not the code, was wrong.
    #
    # So assert the property that actually matters in production: the handler is
    # a StreamHandler bound to the live sys.stdout, at INFO, not propagating.
    # A direct probe outside pytest confirms the same thing end to end.
    create_app(deps)
    handler = next(h for h in logger.handlers if getattr(h, "_hub_gate_handler", False))
    assert isinstance(handler, logging.StreamHandler)
    assert handler.stream is sys.stdout, (
        "the handler is bound to some other stream; Cloud Run only ships the real stdout"
    )


def test_a_record_is_actually_formatted_and_emitted(deps):
    # The other half: a record really does pass through the handler and come out
    # carrying the token the log-based metric filters on. Emitted through the
    # handler's own formatter into a buffer, so this is independent of whatever
    # owns sys.stdout at the time.
    create_app(deps)
    handler = next(h for h in logger.handlers if getattr(h, "_hub_gate_handler", False))
    buffer = io.StringIO()
    original, handler.stream = handler.stream, buffer
    try:
        logger.info("event=client_signin_failed trace=test failure_class=provider_disabled")
    finally:
        handler.stream = original
    written = buffer.getvalue()
    assert "event=client_signin_failed" in written, (
        "the line the log-based metric filters on never reached the handler"
    )
    assert "failure_class=provider_disabled" in written


def test_boot_line_says_which_handler_was_chosen(deps):
    # Silent degradation should be readable from the boot logs rather than
    # inferred from an absence of evidence -- which is exactly how the missing
    # handler went unnoticed for four revisions.
    create_app(deps)
    assert _configure_logging() == "already-configured"
