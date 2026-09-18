"""The gate application: three responsibilities and nothing else.

  1. POST /session   -- verify a Firebase ID token, mint a `__session` cookie.
  2. The allowlist   -- Firestore members/{email}, id lowercased.
  3. GET /p/{path}   -- verify the session, then stream from the private bucket.

Share links (design doc §6 responsibility 4, /s/** and /share/**) are Phase 4.
They are absent, not stubbed, so that nothing half-built can serve anything.

Two properties are worth stating up front, because both are easy to break
without any test going red (ADR-0004):

  * The session cookie is named `__session`. Firebase Hosting strips every
    other cookie on a Cloud Run rewrite, so any other name produces a gate that
    passes direct tests and fails only through Hosting.
  * The Cloud Run invoker is `allUsers`, deliberately: authorisation is
    application-level. Nothing below reads a header, hostname or path shape
    that only Hosting adds, so every check holds on a direct *.run.app request
    exactly as it does through the CDN.
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from datetime import timedelta

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import HTMLResponse, JSONResponse, Response, StreamingResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from . import pages
from .auth import FirebaseTokenVerifier, Principal, TokenRejected, TokenVerifier
from .config import SESSION_COOKIE_NAME, Settings, load_settings
from .members import FirestoreMemberDirectory, MemberDirectory
from .serve import GcsObjectStore, ObjectStore, UnsafePath, safe_object_path

logger = logging.getLogger("gate")

# The exact value §6 and the roadmap require. Firebase Hosting marks rewrite
# responses private by default and its CDN caches a gate response only if the
# gate itself sends `public` or `s-maxage` (ADR-0004), so this string -- and the
# middleware that applies it unconditionally -- is the whole defence.
PRIVATE_CACHE_CONTROL = "private, no-store"

# An ID token is a JWT of a few kilobytes. Anything larger is not a sign-in
# attempt, and reading it would be work done on behalf of an anonymous caller.
MAX_SESSION_BODY_BYTES = 8192

# Client event ingestion. Smaller than a session body on purpose: this endpoint
# is UNAUTHENTICATED, because the failures worth capturing happen before a
# session exists, so these caps are the only thing standing between it and
# anyone who finds it.
MAX_CLIENT_EVENT_BODY_BYTES = 4096
MAX_CLIENT_EVENTS_PER_BATCH = 20
# Field values are truncated, not rejected: a too-long value should cost the
# detail, not the whole event.
MAX_CLIENT_FIELD_CHARS = 200
# Allowlist, matched case-insensitively as a substring. The browser scrubs too;
# this is the copy that cannot be bypassed by editing the page.
CLIENT_EVENT_REDACT = ("password", "token", "secret", "email", "code", "cookie", "auth")


@dataclass
class Dependencies:
    """Everything the request handlers need, injectable for testing.

    The three collaborators are Protocols (see auth, members, serve) so the
    whole suite runs against in-memory fakes. There are no cloud credentials in
    the development environment and none may be created.
    """

    settings: Settings
    verifier: TokenVerifier
    members: MemberDirectory
    store: ObjectStore


def build_dependencies(settings: Settings | None = None) -> Dependencies:
    """Production wiring: Firebase Admin, Firestore, the private bucket."""
    resolved = settings or load_settings()
    return Dependencies(
        settings=resolved,
        verifier=FirebaseTokenVerifier(project_id=resolved.project_id),
        members=FirestoreMemberDirectory(
            collection=resolved.members_collection, project_id=resolved.project_id
        ),
        store=GcsObjectStore(resolved.private_bucket),
    )


def _html(body: str, status_code: int) -> HTMLResponse:
    return HTMLResponse(content=body, status_code=status_code)


def _clean_client_value(value: object) -> str:
    """Flatten an untrusted client value into something safe to put in a log line.

    Anything a browser sends can contain newlines, control characters or a
    megabyte of text. A log line is a single line, and a caller that can inject
    newlines can forge log entries -- so this strips them rather than escaping
    them, and truncates.
    """
    text = value if isinstance(value, str) else repr(value)
    text = "".join(ch for ch in text if ch.isprintable())
    text = text.replace(" ", "_")
    return text[:MAX_CLIENT_FIELD_CHARS]


def _log_path(name: str, settings: Settings) -> str:
    """Render an object path for a log line, or nothing.

    An object path under /p/** IS a private slug. Cloud Logging is readable by
    anyone holding project-level log access, which is a wider audience than the
    allowlist, so paths stay out of logs unless someone deliberately turns them
    on (GATE_LOG_OBJECT_PATHS).
    """
    return f" object={name}" if settings.log_object_paths else ""


def create_app(dependencies: Dependencies | None = None) -> FastAPI:
    deps = dependencies or build_dependencies()

    # No /docs, /redoc or /openapi.json. The service is reachable by anyone at
    # its *.run.app URL, and a schema document would publish the shape of the
    # private routes to callers who are refused everything else.
    app = FastAPI(
        title="hub-gate",
        version="0.1.0",
        docs_url=None,
        redoc_url=None,
        openapi_url=None,
    )
    app.state.dependencies = deps

    # ---------------------------------------------------------------------
    # Headers. Applied to EVERY response -- success, refusal and error alike,
    # and after the route has run, so a framework or file-serving default
    # cannot leave a cacheable header behind (ADR-0004's stated risk).
    # ---------------------------------------------------------------------
    @app.middleware("http")
    async def security_headers(request: Request, call_next):  # type: ignore[no-untyped-def]
        response = await call_next(request)
        response.headers["Cache-Control"] = PRIVATE_CACHE_CONTROL
        response.headers["Vary"] = "Cookie"
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "no-referrer"
        response.headers["X-Frame-Options"] = "DENY"
        return response

    # ---------------------------------------------------------------------
    # Error handling. Every body below is static. None echoes the request
    # path, the request body or an exception message: a private slug must not
    # appear in anything the gate returns to a caller it has just refused.
    # ---------------------------------------------------------------------
    @app.exception_handler(StarletteHTTPException)
    async def http_exception(request: Request, exc: StarletteHTTPException) -> Response:
        # Unknown routes and wrong methods land here. They are told the same
        # thing a member is told about a missing object.
        return _html(pages.NOT_FOUND, exc.status_code if exc.status_code >= 400 else 404)

    @app.exception_handler(RequestValidationError)
    async def validation_exception(request: Request, exc: RequestValidationError) -> Response:
        # FastAPI's default 422 body includes the offending input, which for
        # POST /session would be an ID token. Replaced wholesale.
        logger.info("event=reject reason=malformed_request")
        return JSONResponse({"status": "invalid_request"}, status_code=400)

    @app.exception_handler(Exception)
    async def unhandled_exception(request: Request, exc: Exception) -> Response:
        # Logged server-side with its traceback; the caller gets none of it.
        logger.exception("event=error reason=unhandled")
        return _html(pages.SERVER_ERROR, 500)

    # ---------------------------------------------------------------------
    # Responsibility 1: sessions.
    # ---------------------------------------------------------------------
    @app.post("/session")
    async def create_session(request: Request) -> Response:
        declared = request.headers.get("content-length")
        if declared is not None and declared.isdigit() and int(declared) > MAX_SESSION_BODY_BYTES:
            logger.info("event=reject reason=body_too_large")
            return JSONResponse({"status": "invalid_request"}, status_code=413)

        raw = await request.body()
        if len(raw) > MAX_SESSION_BODY_BYTES:
            logger.info("event=reject reason=body_too_large")
            return JSONResponse({"status": "invalid_request"}, status_code=413)

        # Parsed by hand rather than through a Pydantic model so that no part
        # of the submitted token can reach an error body.
        try:
            payload = json.loads(raw)
        except (ValueError, UnicodeDecodeError):
            logger.info("event=reject reason=malformed_json")
            return JSONResponse({"status": "invalid_request"}, status_code=400)

        id_token = payload.get("idToken") if isinstance(payload, dict) else None
        if not isinstance(id_token, str) or not id_token.strip():
            logger.info("event=reject reason=missing_id_token")
            return JSONResponse({"status": "invalid_request"}, status_code=400)

        try:
            principal = deps.verifier.verify_id_token(id_token.strip())
        except TokenRejected as exc:
            logger.info("event=deny scope=session reason=%s", exc.reason)
            return JSONResponse({"status": "invalid_token"}, status_code=401)

        # An unverified address is never a member: sign-up with an unverified
        # email would otherwise be a way to claim an allowlisted identity.
        if not principal.email_verified:
            logger.info("event=deny scope=session reason=email_not_verified")
            return JSONResponse({"status": "not_a_member"}, status_code=200)

        if not deps.members.is_member(principal.email):
            # SEAM-3: a verified sign-in that is not on the allowlist gets the
            # "not shared with you" answer and no cookie -- not a 403 body, not
            # a redirect loop.
            logger.info("event=deny scope=session reason=not_a_member member=%s", principal.email)
            return JSONResponse({"status": "not_a_member"}, status_code=200)

        try:
            cookie = deps.verifier.create_session_cookie(
                id_token.strip(), timedelta(days=deps.settings.session_days)
            )
        except TokenRejected as exc:
            logger.info("event=deny scope=session reason=%s", exc.reason)
            return JSONResponse({"status": "invalid_token"}, status_code=401)

        response = JSONResponse({"status": "ok"}, status_code=200)
        response.set_cookie(
            key=SESSION_COOKIE_NAME,
            value=cookie,
            max_age=deps.settings.session_max_age_seconds,
            path="/",
            httponly=True,
            secure=True,
            samesite="lax",
        )
        logger.info("event=allow scope=session member=%s", principal.email)
        return response

    # ---------------------------------------------------------------------
    # Responsibilities 2 and 3: the allowlist, and serving the private bucket.
    # ---------------------------------------------------------------------
    @app.get("/p/{path:path}")
    async def serve_private(path: str, request: Request) -> Response:
        # Order matters. Identity, then membership, then the path, then the
        # bucket: an unauthenticated caller never reaches the path validator
        # and never causes a bucket lookup, so nothing about what exists can be
        # inferred from how the gate behaves.
        principal, reason = _authenticate(request, deps)
        if principal is None:
            logger.info("event=deny scope=private stage=session reason=%s", reason)
            return _html(pages.SIGN_IN_REQUIRED, 404)

        if not principal.email_verified:
            logger.info("event=deny scope=private stage=verify reason=email_not_verified")
            return _html(pages.NOT_SHARED_WITH_YOU, 404)

        if not deps.members.is_member(principal.email):
            logger.info("event=deny scope=private stage=allowlist member=%s", principal.email)
            return _html(pages.NOT_SHARED_WITH_YOU, 404)

        try:
            name = safe_object_path(path, deps.settings.private_prefix)
        except UnsafePath as exc:
            logger.warning(
                "event=deny scope=private stage=path reason=%s member=%s", exc.reason, principal.email
            )
            return _html(pages.NOT_FOUND, 404)

        obj = deps.store.fetch(name)
        if obj is None:
            logger.info(
                "event=miss scope=private member=%s%s",
                principal.email,
                _log_path(name, deps.settings),
            )
            return _html(pages.NOT_FOUND, 404)

        logger.info("event=allow scope=private member=%s%s", principal.email, _log_path(name, deps.settings))
        headers = {} if obj.size is None else {"content-length": str(obj.size)}
        return StreamingResponse(
            obj.chunks(),
            status_code=200,
            media_type=obj.content_type,
            headers=headers,
        )

    # NOT /healthz. That path never reaches this container on Cloud Run: Google's
    # frontend answers it with its own 1568-byte error page, while the gate's own
    # 404 is 329 bytes, and no such request ever appears in the container log.
    # Verified at Checkpoint 4 -- /_health and /nope both reach the app, /healthz
    # alone does not, and the same image returns {"status":"ok"} for /healthz when
    # run locally. Renaming the route is the fix; the handler is unchanged.
    # Browser errors, which previously went nowhere at all.
    #
    # WHY UNAUTHENTICATED. Every other route here refuses anonymous callers.
    # This one cannot: it exists to capture sign-in failures, and a sign-in
    # failure by definition has no session. The protections are therefore caps
    # and scrubbing rather than identity -- a caller can write log lines, and
    # nothing else. It reads nothing, serves nothing, and touches no bucket.
    #
    # It answers 204 to everything, including malformed input. A telemetry
    # endpoint that returns errors invites a retry storm from the very page that
    # is already broken, and the browser is told never to care about the reply.
    @app.post("/client-events")
    async def client_events(request: Request) -> Response:
        declared = request.headers.get("content-length")
        if declared is not None and declared.isdigit() and int(declared) > MAX_CLIENT_EVENT_BODY_BYTES:
            logger.info("event=reject reason=client_events_too_large")
            return Response(status_code=204)

        raw = await request.body()
        if len(raw) > MAX_CLIENT_EVENT_BODY_BYTES:
            logger.info("event=reject reason=client_events_too_large")
            return Response(status_code=204)

        try:
            payload = json.loads(raw or b"{}")
        except ValueError:
            logger.info("event=reject reason=client_events_malformed")
            return Response(status_code=204)

        if not isinstance(payload, dict):
            return Response(status_code=204)

        trace = _clean_client_value(payload.get("trace_id"))
        events = payload.get("events")
        if not isinstance(events, list):
            return Response(status_code=204)

        for item in events[:MAX_CLIENT_EVENTS_PER_BATCH]:
            if not isinstance(item, dict):
                continue
            name = _clean_client_value(item.get("event")) or "unnamed"
            fields = item.get("fields")
            pairs = []
            if isinstance(fields, dict):
                for key, value in list(fields.items())[:10]:
                    k = _clean_client_value(key)
                    if not k:
                        continue
                    if any(r in k.lower() for r in CLIENT_EVENT_REDACT):
                        continue
                    pairs.append(f"{k}={_clean_client_value(value)}")

            # "client_signin_failed" is the string the log-based metric in
            # infra/monitoring.tf filters on. Changing it here without changing
            # it there silently empties the metric, so they are named together.
            prefix = "client_signin_failed" if name == "signin_failed" else f"client_{name}"
            logger.info("event=%s trace=%s %s", prefix, trace or "none", " ".join(pairs))

        return Response(status_code=204)

    @app.get("/_health")
    async def healthz() -> Response:
        # Deploy verification only. Says nothing about configuration, identity
        # or content, because it answers anyone.
        return JSONResponse({"status": "ok"}, status_code=200)

    return app


def _authenticate(request: Request, deps: Dependencies) -> tuple[Principal | None, str | None]:
    """Resolve the caller from the `__session` cookie.

    The cookie is the ONLY accepted credential: no Authorization header, no
    query parameter, no header that a proxy might add. That is what makes the
    check identical through Hosting and on the direct *.run.app URL.
    """
    raw = request.cookies.get(SESSION_COOKIE_NAME)
    if not raw:
        return None, "no_session_cookie"
    try:
        principal = deps.verifier.verify_session_cookie(raw, check_revoked=deps.settings.check_revoked)
    except TokenRejected as exc:
        return None, exc.reason
    return principal, None
