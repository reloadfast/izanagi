# ── Stage 1: dependency builder ──────────────────────────────────
FROM python:3.12-slim AS builder

WORKDIR /build
COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt


# ── Stage 2: runtime image ────────────────────────────────────────
FROM python:3.12-slim

ARG VERSION=0.1.0
ARG BUILD_SHA=dev

LABEL org.opencontainers.image.title="Izanagi" \
      org.opencontainers.image.description="Self-hosted Unraid template deployment service" \
      org.opencontainers.image.version="${VERSION}" \
      org.opencontainers.image.revision="${BUILD_SHA}" \
      org.opencontainers.image.source="https://github.com/reloadfast/izanagi"

ENV APP_VERSION=${VERSION} \
    BUILD_SHA=${BUILD_SHA} \
    IZANAGI_PORT=9731 \
    IZANAGI_TEMPLATES_PATH=/templates \
    IZANAGI_DB_PATH=/data/izanagi.db \
    DOCKER_SOCKET=/var/run/docker.sock \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

# Copy installed packages from builder
COPY --from=builder /install /usr/local

# Create non-root user and required directories
RUN useradd -m -u 1000 -s /sbin/nologin izanagi && \
    mkdir -p /data /templates && \
    chown -R izanagi:izanagi /data /templates

WORKDIR /app
COPY --chown=izanagi:izanagi app/ ./app/

USER izanagi

EXPOSE ${IZANAGI_PORT}

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD python3 -c "import urllib.request; urllib.request.urlopen('http://localhost:9731/api/version')" || exit 1

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${IZANAGI_PORT}"]
