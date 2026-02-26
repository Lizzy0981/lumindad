# ══════════════════════════════════════════════════════════════════════════════
# Dockerfile.ml
# LumindAd · Ad Performance Intelligence Platform v1.0
# Stack : Python 3.11 · TensorFlow 2.x · XGBoost · SHAP · scikit-learn
#         MLP · LSTM · CNN-1D · Autoencoder · GHG Green AI reporting
# Author: Elizabeth Díaz Familia · AI Data Scientist · Sustainable Intelligence & BI
#
# Builds a standalone ML inference microservice.
# Models loaded once at startup; predictions served via FastAPI on :8001.
# Green AI telemetry tracks CO₂ per inference (GHG Protocol Scope 2).
# ══════════════════════════════════════════════════════════════════════════════

# ─────────────────────────────────────────────────────────────────────────────
# STAGE 1 — base
# TensorFlow slim base (CPU-only for inference; GPU variant uses tf-gpu tag)
# ─────────────────────────────────────────────────────────────────────────────
FROM python:3.11-slim-bookworm AS base

LABEL maintainer="Elizabeth Díaz Familia <elizabeth@lumindad.ai>" \
      version="1.0.0" \
      description="LumindAd ML Inference Service — TF · XGBoost · SHAP · Green AI"

# System libs required by TensorFlow, SHAP, pandas
RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential \
        libgomp1 \
        libhdf5-dev \
        curl \
        wget \
    && rm -rf /var/lib/apt/lists/*

# Non-root user
RUN groupadd -g 1002 mluser && \
    useradd  -u 1002 -g mluser -m -s /bin/bash mluser

WORKDIR /app

# ─────────────────────────────────────────────────────────────────────────────
# STAGE 2 — deps
# Heavy ML packages installed separately to maximize Docker layer cache.
# Order: numpy/pandas first (shared deps), then TF, then XGBoost, then SHAP.
# ─────────────────────────────────────────────────────────────────────────────
FROM base AS deps

# Core scientific stack
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install --upgrade pip && \
    pip install \
        numpy==1.26.4 \
        pandas==2.2.1 \
        scipy==1.13.0 \
        scikit-learn==1.4.2

# TensorFlow CPU-only (smaller image; swap tag for GPU deployment)
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install tensorflow-cpu==2.16.1

# XGBoost + imbalanced-learn (SMOTE for preprocessing)
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install \
        xgboost==2.0.3 \
        imbalanced-learn==0.12.2

# Explainability + inference API
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install \
        shap==0.45.0 \
        fastapi==0.111.0 \
        uvicorn[standard]==0.29.0 \
        pydantic==2.7.1 \
        httpx==0.27.0

# ─────────────────────────────────────────────────────────────────────────────
# STAGE 3 — runner
# ─────────────────────────────────────────────────────────────────────────────
FROM base AS runner

# Copy installed packages
COPY --from=deps /usr/local/lib/python3.11 /usr/local/lib/python3.11
COPY --from=deps /usr/local/bin            /usr/local/bin

# ML inference service source
COPY --chown=mluser:mluser backend/ml             ./ml
COPY --chown=mluser:mluser ml/data/processed      ./data/processed

# Model binaries — mounted via k8s PersistentVolumeClaim in production
# At build time, bake in for standalone / local dev
COPY --chown=mluser:mluser ml/models ./models

# Feature metadata (label encoders, feature names, thresholds)
COPY --chown=mluser:mluser ml/models/lumindad_model_meta.json ./models/lumindad_model_meta.json

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONPATH=/app \
    ML_PORT=8001 \
    MODEL_DIR=/app/models \
    DATA_DIR=/app/data \
    LOG_LEVEL=info \
    # Green AI — GHG Protocol Scope 2
    GREEN_AI_ENABLED=true \
    GREEN_AI_CPU_W=95 \
    GREEN_AI_PUE=1.57 \
    GREEN_AI_CARBON_INTENSITY=0.475 \
    # Inference settings
    DEFAULT_MODEL=XGBoost \
    BATCH_SIZE_MAX=10000 \
    SHAP_SAMPLE_SIZE=200 \
    # TF performance
    TF_CPP_MIN_LOG_LEVEL=3 \
    TF_ENABLE_ONEDNN_OPTS=0

# Pre-warm models at startup — loaded into memory, not cold-loaded per request
COPY --chown=mluser:mluser infrastructure/docker/warmup.ml.py ./warmup.py

# Health check — /health returns model status + last inference latency
HEALTHCHECK --interval=30s --timeout=15s --start-period=45s --retries=3 \
    CMD curl -fs http://localhost:${ML_PORT}/health || exit 1

EXPOSE 8001

USER mluser

# Start inference API; models warm on first request via lifespan event
CMD ["uvicorn", "ml.inference.predictor:app", \
     "--host", "0.0.0.0", \
     "--port", "8001", \
     "--workers", "2", \
     "--log-level", "info", \
     "--no-access-log"]
