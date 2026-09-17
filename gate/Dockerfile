# The gate image. Python 3.12, non-root, nothing in it that is not pinned.
#
# The base is pinned by DIGEST as well as tag: a retagged upstream image must
# not change what this repository ships without a visible commit here, which is
# the same rule ci.yml applies to actions and to canon.
# python:3.12-slim, Python 3.12.14, resolved 2026-09-17.
ARG PYTHON_IMAGE=python:3.12-slim@sha256:78387bc3881b8273120a12ebe6c1ab22b018ccc2c9adf565ae1ac9b536e184ea

# ---------------------------------------------------------------------------
# Build stage: resolve the dependency closure into a virtualenv.
# ---------------------------------------------------------------------------
FROM ${PYTHON_IMAGE} AS builder

ENV PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_ROOT_USER_ACTION=ignore

WORKDIR /build
COPY requirements.txt ./

# --require-hashes refuses anything whose checksum is not in the lock file, and
# --no-deps refuses anything the lock file does not name at all.
RUN python -m venv /opt/venv \
 && /opt/venv/bin/pip install --require-hashes --no-deps -r requirements.txt

# ---------------------------------------------------------------------------
# Runtime stage: the venv, the application, and no build tooling.
# ---------------------------------------------------------------------------
FROM ${PYTHON_IMAGE}

# A fixed, unprivileged uid/gid. Numeric in USER below so the identity holds
# even if /etc/passwd is not readable.
RUN groupadd --gid 10001 gate \
 && useradd --uid 10001 --gid 10001 --no-create-home --shell /usr/sbin/nologin gate

COPY --from=builder /opt/venv /opt/venv

WORKDIR /srv
COPY app/ /srv/app/

ENV PATH="/opt/venv/bin:${PATH}" \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8080

USER 10001:10001
EXPOSE 8080

# create_app() is a factory, so the application is constructed after the
# environment exists rather than at import time.
#
# Deliberately NO --proxy-headers: the invoker is `allUsers` (ADR-0004), so
# X-Forwarded-* arrives from anyone and is trusted for nothing here.
CMD ["sh", "-c", "exec uvicorn app.main:create_app --factory --host 0.0.0.0 --port ${PORT:-8080} --workers 1 --no-server-header --timeout-graceful-shutdown 10"]
