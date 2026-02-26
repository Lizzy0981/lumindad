# backend/app/workers/celery_app.py
"""
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  LumindAd Enterprise · backend/app/workers/celery_app.py
  Celery application factory — broker · backend · routing

  Architecture
  ─────────────
  Broker  : Redis DB 1  (settings.CELERY_BROKER_URL)
  Backend : Redis DB 1  (settings.CELERY_RESULT_BACKEND)
  Workers : 3 task modules, each routed to a dedicated queue

  Queues
  ───────
  upload   — file processing tasks (CPU-bound I/O intensive)
             workers.upload_tasks.*
  ml       — model inference tasks (CPU/GPU compute)
             workers.ml_tasks.*
  reports  — export generation tasks (I/O + PDF/XLSX)
             workers.report_tasks.*
  default  — catch-all for unrouted tasks

  Time limits (config.py)
  ────────────────────────
  SOFT : 3,600 s (1 h)  — task receives SoftTimeLimitExceeded
  HARD : 7,200 s (2 h)  — worker killed unconditionally

  Beat schedule (Celery Beat)
  ─────────────────────────────
  Every 5 min  : aggregate_kpis_task        — refresh Dashboard KPIs
  Every 15 min : retrain_anomaly_model_task — re-score Isolation Forest
  Every 1 h    : cleanup_expired_uploads    — purge old tmp files

  Usage
  ──────
  # Start worker (all queues)
  celery -A app.workers.celery_app worker -l info -Q upload,ml,reports,default

  # Start worker (upload queue only)
  celery -A app.workers.celery_app worker -l info -Q upload -c 4

  # Start beat scheduler
  celery -A app.workers.celery_app beat -l info

  # Flower monitoring
  celery -A app.workers.celery_app flower --port=5555

  Author : Elizabeth Díaz Familia
           AI Data Scientist · Sustainable Intelligence & BI
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"""

from __future__ import annotations

import logging
import os

from app.config import settings

logger = logging.getLogger(__name__)

# ── Optional Celery import ─────────────────────────────────────────────────────
try:
    from celery import Celery
    from celery.signals import worker_ready, worker_shutdown
    _CELERY_AVAILABLE = True
except ImportError:
    _CELERY_AVAILABLE = False
    Celery = None  # type: ignore[assignment,misc]
    logger.warning(
        "Celery not installed — background task processing unavailable. "
        "Run: pip install celery[redis]"
    )


# ═══════════════════════════════════════════════════════════════
# CELERY APP FACTORY
# ═══════════════════════════════════════════════════════════════

def create_celery_app() -> "Celery":
    """
    Build and configure the Celery application.

    Called once at module load time (see `celery_app` singleton below).
    All configuration comes from settings to stay in sync with FastAPI.
    """
    if not _CELERY_AVAILABLE:
        raise ImportError(
            "Celery is not installed. Run: pip install celery[redis] redis"
        )

    app = Celery(
        "lumindad",
        broker=settings.CELERY_BROKER_URL,
        backend=settings.CELERY_RESULT_BACKEND,
    )

    # ── Serialisation ──────────────────────────────────────────
    app.conf.task_serializer          = settings.CELERY_TASK_SERIALIZER      # json
    app.conf.result_serializer        = settings.CELERY_RESULT_SERIALIZER    # json
    app.conf.accept_content           = settings.CELERY_ACCEPT_CONTENT       # [json]

    # ── Time limits ────────────────────────────────────────────
    app.conf.task_soft_time_limit     = settings.CELERY_TASK_SOFT_TIME_LIMIT # 3600 s
    app.conf.task_time_limit          = settings.CELERY_TASK_TIME_LIMIT      # 7200 s

    # ── Result TTL (keep results for 24 h then auto-expire) ────
    app.conf.result_expires           = 86_400   # 24 h

    # ── Worker behaviour ───────────────────────────────────────
    app.conf.worker_prefetch_multiplier = 1      # one task at a time (safe for I/O tasks)
    app.conf.task_acks_late             = True   # acknowledge AFTER task completes
    app.conf.task_reject_on_worker_lost = True   # re-queue on unexpected worker death
    app.conf.worker_max_tasks_per_child = 50     # restart worker every 50 tasks (memory safety)

    # ── Queue routing ──────────────────────────────────────────
    # Tasks are routed to dedicated queues by prefix.
    app.conf.task_routes = {
        "app.workers.upload_tasks.*":  {"queue": "upload"},
        "app.workers.ml_tasks.*":      {"queue": "ml"},
        "app.workers.report_tasks.*":  {"queue": "reports"},
    }

    app.conf.task_default_queue        = "default"
    app.conf.task_default_exchange     = "default"
    app.conf.task_default_routing_key  = "default"

    # ── Queue declarations (ensure queues exist) ───────────────
    from kombu import Queue
    app.conf.task_queues = (
        Queue("upload",  routing_key="upload"),
        Queue("ml",      routing_key="ml"),
        Queue("reports", routing_key="reports"),
        Queue("default", routing_key="default"),
    )

    # ── Beat schedule (periodic tasks) ────────────────────────
    from celery.schedules import crontab
    app.conf.beat_schedule = {
        # Refresh Dashboard KPI cache every 5 min
        "aggregate-kpis-every-5min": {
            "task":     "app.workers.ml_tasks.aggregate_kpis_task",
            "schedule": 300,   # 5 min
            "options":  {"queue": "ml"},
        },
        # Rescore Isolation Forest anomaly model every 15 min
        "retrain-anomaly-every-15min": {
            "task":     "app.workers.ml_tasks.retrain_anomaly_model_task",
            "schedule": 900,   # 15 min
            "options":  {"queue": "ml"},
        },
        # Clean up expired upload sessions & temp files every hour
        "cleanup-uploads-every-hour": {
            "task":     "app.workers.upload_tasks.cleanup_expired_uploads_task",
            "schedule": crontab(minute=0),   # top of every hour
            "options":  {"queue": "upload"},
        },
        # Scheduled report generation at 06:00 UTC daily
        "daily-report-06h": {
            "task":     "app.workers.report_tasks.scheduled_daily_report_task",
            "schedule": crontab(hour=6, minute=0),
            "options":  {"queue": "reports"},
        },
    }
    app.conf.timezone    = "UTC"
    app.conf.enable_utc  = True

    # ── Autodiscover task modules ──────────────────────────────
    app.autodiscover_tasks([
        "app.workers.upload_tasks",
        "app.workers.ml_tasks",
        "app.workers.report_tasks",
    ])

    # ── Retry policy defaults ──────────────────────────────────
    # Individual tasks can override via @celery_app.task(autoretry_for=…)
    app.conf.task_annotations = {
        "*": {
            "max_retries":    3,
            "default_retry_delay": 60,  # 60 s base, tasks use exponential backoff
        }
    }

    logger.info(
        "Celery app created — broker=%s queues=upload,ml,reports,default",
        settings.CELERY_BROKER_URL.split("@")[-1],
    )
    return app


# ═══════════════════════════════════════════════════════════════
# MODULE-LEVEL SINGLETON
# ═══════════════════════════════════════════════════════════════

if _CELERY_AVAILABLE:
    celery_app = create_celery_app()
else:
    celery_app = None  # type: ignore[assignment]


# ═══════════════════════════════════════════════════════════════
# WORKER SIGNALS
# ═══════════════════════════════════════════════════════════════

if _CELERY_AVAILABLE:

    @worker_ready.connect
    def on_worker_ready(sender, **kwargs) -> None:  # type: ignore[misc]
        """Log a banner when the worker process comes online."""
        logger.info(
            "\n"
            "  ╔══════════════════════════════════════════╗\n"
            "  ║  LumindAd · Celery Worker Ready          ║\n"
            "  ║  Queues : upload · ml · reports          ║\n"
            "  ║  Broker : Redis DB 1                     ║\n"
            "  ╚══════════════════════════════════════════╝"
        )

    @worker_shutdown.connect
    def on_worker_shutdown(sender, **kwargs) -> None:  # type: ignore[misc]
        logger.info("LumindAd Celery worker shutdown complete.")


# ═══════════════════════════════════════════════════════════════
# HEALTH CHECK HELPER
# ═══════════════════════════════════════════════════════════════

async def celery_health_check() -> dict:
    """
    Celery health check — used by GET /health endpoint.

    Pings the broker and counts active workers via inspect API.
    Returns in < 2 s (non-blocking timeout).
    """
    if not _CELERY_AVAILABLE or celery_app is None:
        return {"status": "unavailable", "workers": 0}

    try:
        import time
        t0 = time.perf_counter()
        inspect = celery_app.control.inspect(timeout=1.5)
        active  = inspect.active() or {}
        workers = len(active)
        latency = round((time.perf_counter() - t0) * 1000, 2)
        return {
            "status":     "ok" if workers > 0 else "idle",
            "workers":    workers,
            "latency_ms": latency,
            "queues":     ["upload", "ml", "reports", "default"],
        }
    except Exception as exc:
        return {"status": "error", "workers": 0, "error": str(exc)}
