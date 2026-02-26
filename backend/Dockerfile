# ═══════════════════════════════════════════════════════════════
#  LumindAd Enterprise · backend/Dockerfile
#  Multi-stage build — Python 3.12 · FastAPI · TensorFlow · Celery
#
#  Stages
#  ───────
#  base      System packages + virtualenv
#  builder   pip install all Python dependencies
#  final     Lean production image — no build tools
#
#  Usage
#  ──────
#  # API server
#  docker build -t lumindad-backend .
#  docker run -p 8000:8000 --env-file .env lumindad-backend
#
#  # Celery worker (override CMD)
#  docker run --env-file .env lumindad-backend \
#    celery -A app.workers.celery_app worker -l info -Q upload,ml,reports,default -c 4
#
#  # Celery Beat scheduler
#  docker run --env-file .env lumindad-backend \
#    celery -A app.workers.celery_app beat -l info
#
#  # Run DB migrations before starting the API
#  docker run --env-file .env lumindad-backend \
#    alembic upgrade head
#
#  Required env vars (see app/config.py for full list)
#  ──────────────────────────────────────────────────────
#    DATABASE_URL        postgresql+asyncpg://user:pass@host:5432/lumindad
#    REDIS_URL           redis://redis:6379/0
#    JWT_SECRET_KEY      <random 64-char hex>
#    ENVIRONMENT         production
# ═══════════════════════════════════════════════════════════════


# ───────────────────────────────────────────────────────────────
# STAGE 1 — base
# Minimal OS packages + non-root user + virtualenv
# ───────────────────────────────────────────────────────────────
FROM python:3.12-slim AS base

# Prevent .pyc files and enable unbuffered stdout/stderr
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    # virtualenv location
    VIRTUAL_ENV=/opt/venv \
    PATH="/opt/venv/bin:$PATH" \
    # TensorFlow: suppress C-level log noise
    TF_CPP_MIN_LOG_LEVEL=2 \
    TF_ENABLE_ONEDNN_OPTS=0 \
    # Celery: safer for Docker (no fork)
    FORKED_BY_MULTIPROCESSING=1

# System libraries required by TensorFlow, psycopg2, asyncpg, reportlab
RUN apt-get update && apt-get install -y --no-install-recommends \
        # C runtime & build helpers (needed at runtime by some .so libs)
        libgomp1 \
        libpq5 \
        # font support for ReportLab PDF generation
        fontconfig \
        fonts-liberation \
        # curl for health checks
        curl \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN groupadd --gid 1001 lumindad && \
    useradd  --uid 1001 --gid lumindad --no-create-home --shell /bin/false lumindad

# Virtualenv owned by app user
RUN python -m venv "$VIRTUAL_ENV" && \
    chown -R lumindad:lumindad "$VIRTUAL_ENV"


# ───────────────────────────────────────────────────────────────
# STAGE 2 — builder
# Install all Python dependencies inside the virtualenv
# (runs as root for pip speed; final stage drops back to lumindad)
# ───────────────────────────────────────────────────────────────
FROM base AS builder

# Upgrade pip + wheel for faster builds
RUN pip install --upgrade pip wheel setuptools --quiet

# Copy only the requirements file first — layer cache reuse
COPY requirements.txt /tmp/requirements.txt

# Install all dependencies
# --no-cache-dir  keeps the image smaller
# Split into two layers so the heavy ML stack (TF ~1 GB) only rebuilds
# when tensorflow/numpy/xgboost actually change in requirements.txt
RUN pip install --no-cache-dir \
        # API + DB + Auth + Cache + Workers + BI/Export
        fastapi==0.133.1 \
        starlette==0.52.1 \
        "uvicorn[standard]==0.41.0" \
        gunicorn==23.0.0 \
        python-multipart==0.0.22 \
        pydantic==2.12.5 \
        pydantic-settings==2.13.1 \
        email-validator==2.3.0 \
        python-dotenv==1.2.1 \
        SQLAlchemy==2.0.47 \
        alembic==1.18.4 \
        asyncpg==0.30.0 \
        psycopg2-binary==2.9.10 \
        aiosqlite==0.21.0 \
        "python-jose[cryptography]==3.5.0" \
        "passlib[bcrypt]==1.7.4" \
        bcrypt==4.0.1 \
        "redis[hiredis]==5.2.1" \
        "celery[redis]==5.4.0" \
        kombu==5.4.2 \
        flower==2.0.1 \
        httpx==0.28.1 \
        anyio==4.12.1 \
        openpyxl==3.1.5 \
        reportlab==4.4.1 \
        pandas==3.0.1

# ML stack — separate layer (largest, changes least often)
RUN pip install --no-cache-dir \
        numpy==2.4.2 \
        scikit-learn==1.8.0 \
        xgboost==3.2.0 \
        tensorflow==2.20.0


# ───────────────────────────────────────────────────────────────
# STAGE 3 — final (production image)
# Copy virtualenv + app code; drop to non-root user
# ───────────────────────────────────────────────────────────────
FROM base AS final

# ── Copy virtualenv from builder ─────────────────────────────
COPY --from=builder --chown=lumindad:lumindad /opt/venv /opt/venv

# ── App working directory ────────────────────────────────────
WORKDIR /app

# ── Copy application source ──────────────────────────────────
# Copy the entire backend directory structure
COPY --chown=lumindad:lumindad app/        ./app/
COPY --chown=lumindad:lumindad ml/         ./ml/
COPY --chown=lumindad:lumindad migrations/ ./migrations/
COPY --chown=lumindad:lumindad alembic.ini ./alembic.ini
COPY --chown=lumindad:lumindad requirements.txt ./requirements.txt

# ML model binaries (pre-trained — checked into repo under ml/models/)
# Already included in ml/ copy above

# ── Drop to non-root ─────────────────────────────────────────
USER lumindad

# ── Exposed port ─────────────────────────────────────────────
EXPOSE 8000

# ── Health check ─────────────────────────────────────────────
# Hits the lightweight /health endpoint (no DB/Redis required)
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# ── Default: run API server ──────────────────────────────────
# Production: gunicorn manages 4 uvicorn workers
# Override CMD in docker-compose to run celery workers or beat
CMD ["gunicorn", "app.main:app", \
     "--worker-class", "uvicorn.workers.UvicornWorker", \
     "--workers", "4", \
     "--bind", "0.0.0.0:8000", \
     "--timeout", "120", \
     "--graceful-timeout", "30", \
     "--max-requests", "1000", \
     "--max-requests-jitter", "100", \
     "--access-logfile", "-", \
     "--error-logfile", "-", \
     "--log-level", "info"]
