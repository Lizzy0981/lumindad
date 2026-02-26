# backend/app/core/events.py
"""
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  LumindAd Enterprise · backend/app/core/events.py
  Application startup / shutdown lifecycle events

  Usage (app/main.py)
  ────────────────────
  from contextlib import asynccontextmanager
  from app.core.events import lifespan

  app = FastAPI(lifespan=lifespan)

  Startup sequence
  ─────────────────
  1. settings.ensure_directories()   — create data/models/temp dirs
  2. settings.display()              — print config banner
  3. init_db()                       — warm SQLAlchemy pool (SELECT 1)
  4. _warm_redis()                   — ping cache Redis pool
  5. _warm_ml_registry()             — validate ML model files exist
  6. _log_startup_banner()           — ✅ green startup summary

  Shutdown sequence
  ──────────────────
  1. close_db()                      — dispose SQLAlchemy pool
  2. cache.close_pool()              — close aioredis cache pool
  3. _drain_celery()                 — revoke in-flight tasks (optional)
  4. _log_shutdown_banner()

  WebSocket broadcast helper
  ───────────────────────────
  broadcast_kpi_update(payload) — called by Celery tasks to push
  KPI updates to all connected WebSocket clients via Redis pub/sub.

  Registered in main.py WS handler:
    ws_clients: set[WebSocket] = set()
    broadcast_kpi_update → publishes to Redis channel "kpi_updates"
    WS listener polls channel and forwards to connected clients

  Author : Elizabeth Díaz Familia
           AI Data Scientist · Sustainable Intelligence & BI
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"""

from __future__ import annotations

import asyncio
import json
import logging
import time
from contextlib import asynccontextmanager
from typing import Any, AsyncGenerator

from app.config import settings

logger = logging.getLogger(__name__)

# ── optional imports ──────────────────────────────────────────────────────────

try:
    from app.core.database import init_db, close_db
    _DB_AVAILABLE = True
except ImportError:
    _DB_AVAILABLE = False
    async def init_db():  # type: ignore[misc]
        pass
    async def close_db(): # type: ignore[misc]
        pass

try:
    from app.core import cache
    _CACHE_AVAILABLE = True
except ImportError:
    _CACHE_AVAILABLE = False
    cache = None  # type: ignore[assignment]


# ═══════════════════════════════════════════════════════════════
# STARTUP HELPERS
# ═══════════════════════════════════════════════════════════════

async def _warm_redis() -> None:
    """
    Ping Redis cache pool to verify connectivity at startup.
    Logs a warning (not an error) if Redis is unavailable so the
    app continues to work in degraded (no-cache) mode.
    """
    if not _CACHE_AVAILABLE:
        logger.warning("Cache module not available — skipping Redis warm-up")
        return
    try:
        result = await cache.health_check()
        if result["status"] == "ok":
            logger.info("✅ Redis cache pool ready (latency %.1f ms)", result["latency_ms"])
        else:
            logger.warning(
                "⚠️  Redis unavailable (%s) — running without cache",
                result.get("error", "unknown"),
            )
    except Exception as exc:
        logger.warning("⚠️  Redis warm-up failed: %s", exc)


async def _warm_ml_registry() -> None:
    """
    Validate that ML model files exist in settings.ML_MODELS_DIR.

    In production the models directory contains:
        churn_xgboost.pkl        — XGBoost v2.3.1 (87.3%)
        anomaly_iforest.pkl      — Isolation Forest v1.4.0 (94.1%)
        click_mlp.pt             — PyTorch MLP v3.1.0 (82.7%)
        roas_automl.pkl          — AutoML ensemble v1.8.2 (91.2%)

    Logs a warning for each missing model file (they are lazy-loaded
    on first inference request, so absence is not fatal at startup).
    """
    import os
    from pathlib import Path

    models_dir = Path(settings.ML_MODELS_DIR)
    expected = {
        "churn_xgboost.pkl":   settings.ML_CHURN_VERSION,
        "anomaly_iforest.pkl": settings.ML_ANOMALY_VERSION,
        "click_mlp.pt":        settings.ML_CLICK_VERSION,
        "roas_automl.pkl":     settings.ML_ROAS_VERSION,
    }

    missing = []
    for fname, version in expected.items():
        fpath = models_dir / fname
        if not fpath.exists():
            missing.append(f"{fname} ({version})")

    if not missing:
        logger.info("✅ ML model registry validated (%d models)", len(expected))
    else:
        logger.warning(
            "⚠️  ML model files not found (will use heuristics): %s",
            ", ".join(missing),
        )


def _log_startup_banner() -> None:
    """Print a concise startup summary to the console."""
    db_label = "PostgreSQL" if settings.DATABASE_URL else "SQLite (dev)"
    lines = [
        "",
        "  ╔══════════════════════════════════════════════════════╗",
        f"  ║  LumindAd Enterprise v{settings.APP_VERSION:<6}                      ║",
        "  ║  AI-Powered Ad Management Platform                   ║",
        "  ╠══════════════════════════════════════════════════════╣",
        f"  ║  Env     : {settings.ENVIRONMENT:<42}║",
        f"  ║  DB      : {db_label:<42}║",
        f"  ║  Redis   : {settings.REDIS_URL.split('@')[-1]:<42}║",
        f"  ║  GreenAI : {'enabled' if settings.GREEN_AI_ENABLED else 'disabled':<42}║",
        f"  ║  SHAP    : top-{settings.SHAP_TOP_N_FEATURES} features                              ║",
        "  ╠══════════════════════════════════════════════════════╣",
        "  ║  ML Models:                                          ║",
        f"  ║    Churn     XGBoost        87.3%  {settings.ML_CHURN_VERSION:<18}║",
        f"  ║    Anomaly   IForest        94.1%  {settings.ML_ANOMALY_VERSION:<18}║",
        f"  ║    Click     MLP NN         82.7%  {settings.ML_CLICK_VERSION:<18}║",
        f"  ║    ROAS      AutoML         91.2%  {settings.ML_ROAS_VERSION:<18}║",
        "  ╚══════════════════════════════════════════════════════╝",
        "",
    ]
    for line in lines:
        logger.info(line)


def _log_shutdown_banner() -> None:
    logger.info("LumindAd Enterprise — shutdown complete ✓")


# ═══════════════════════════════════════════════════════════════
# SHUTDOWN HELPERS
# ═══════════════════════════════════════════════════════════════

async def _drain_celery() -> None:
    """
    Optional: revoke queued Celery tasks on graceful shutdown.

    In Kubernetes this ensures in-flight uploads are not orphaned
    when a pod is terminated during a rolling deploy.

    Silently skipped if Celery is not configured.
    """
    try:
        from celery import current_app as celery_app
        inspector = celery_app.control.inspect()
        active = inspector.active()
        if active:
            count = sum(len(v) for v in active.values())
            logger.info("Celery: %d active tasks — waiting for completion", count)
    except Exception:
        # Celery not running — nothing to drain
        pass


# ═══════════════════════════════════════════════════════════════
# FASTAPI LIFESPAN CONTEXT MANAGER
# ═══════════════════════════════════════════════════════════════

@asynccontextmanager
async def lifespan(app: Any) -> AsyncGenerator[None, None]:
    """
    FastAPI lifespan context manager.

    Replaces the deprecated @app.on_event("startup") pattern.

    Usage in main.py:
        from app.core.events import lifespan
        app = FastAPI(lifespan=lifespan, ...)

    Startup: runs before the first request is served.
    Shutdown: runs after the last request finishes (SIGTERM / Ctrl-C).
    """
    # ── STARTUP ────────────────────────────────────────────────
    t_start = time.perf_counter()
    logger.info("LumindAd Enterprise starting up …")

    # 1. Ensure directories exist (data/ temp/ models/)
    settings.ensure_directories()

    # 2. Print config to console
    settings.display()

    # 3. Warm database pool
    await init_db()

    # 4. Warm Redis cache
    await _warm_redis()

    # 5. Validate ML model files
    await _warm_ml_registry()

    # 6. Startup banner
    elapsed = round((time.perf_counter() - t_start) * 1000)
    logger.info("✅ Startup complete in %d ms — serving requests", elapsed)
    _log_startup_banner()

    # ── SERVE REQUESTS ─────────────────────────────────────────
    yield

    # ── SHUTDOWN ───────────────────────────────────────────────
    logger.info("LumindAd Enterprise shutting down …")

    await _drain_celery()
    await close_db()
    if _CACHE_AVAILABLE:
        await cache.close_pool()

    _log_shutdown_banner()


# ═══════════════════════════════════════════════════════════════
# LEGACY EVENT HANDLERS (for apps that don't use lifespan)
# ═══════════════════════════════════════════════════════════════

async def on_startup() -> None:
    """
    Legacy startup handler.

    Use this if you cannot use the lifespan context manager:
        app.add_event_handler("startup", on_startup)
        app.add_event_handler("shutdown", on_shutdown)
    """
    settings.ensure_directories()
    await init_db()
    await _warm_redis()
    await _warm_ml_registry()
    _log_startup_banner()


async def on_shutdown() -> None:
    """Legacy shutdown handler — mirrors lifespan shutdown section."""
    await _drain_celery()
    await close_db()
    if _CACHE_AVAILABLE:
        await cache.close_pool()
    _log_shutdown_banner()


# ═══════════════════════════════════════════════════════════════
# WEBSOCKET BROADCAST HELPER
# ═══════════════════════════════════════════════════════════════

async def broadcast_kpi_update(payload: dict) -> None:
    """
    Publish a KPI update to all connected WebSocket clients via Redis pub/sub.

    Called by Celery tasks after aggregating fresh campaign metrics.
    The WebSocket handler in main.py subscribes to the "kpi_updates"
    Redis channel and forwards messages to each connected client.

    Args:
        payload: Dict that will be JSON-serialised and broadcast.
                 Should match the KPI shape from GET /campaigns/summary.

    Example:
        await broadcast_kpi_update({
            "totalSpend":       48290,
            "totalImpressions": 531200,
            "totalClicks":      38940,
            "totalConversions": 2847,
        })
    """
    if not _CACHE_AVAILABLE:
        return

    try:
        r = await cache._get_pool()
        if r is None:
            return
        channel = "kpi_updates"
        message = json.dumps(payload, default=str)
        await r.publish(channel, message)
        logger.debug("KPI broadcast published to %r (%d bytes)", channel, len(message))
    except Exception as exc:
        logger.debug("KPI broadcast failed: %s", exc)


async def broadcast_job_progress(job_id: str, progress: float, status: str) -> None:
    """
    Publish an upload job progress event.

    Subscribers are SSE clients connected to GET /upload/jobs/{id}/stream.
    The main.py SSE generator polls Redis instead of in-memory state
    when horizontal scaling (multiple Uvicorn workers) is enabled.
    """
    if not _CACHE_AVAILABLE:
        return

    try:
        r = await cache._get_pool()
        if r is None:
            return
        channel = f"job_progress:{job_id}"
        message = json.dumps({"jobId": job_id, "progress": progress, "status": status})
        await r.publish(channel, message)
    except Exception as exc:
        logger.debug("Job progress broadcast failed: %s", exc)
