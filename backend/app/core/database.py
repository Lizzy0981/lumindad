# backend/app/core/database.py
"""
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  LumindAd Enterprise · backend/app/core/database.py
  SQLAlchemy 2.0 async engine + session factory

  Architecture
  ─────────────
  Uses SQLAlchemy 2.0 AsyncEngine + AsyncSession via asyncpg
  (PostgreSQL) or aiosqlite (SQLite fallback for local dev).

  Engine configuration (mirrors config.py pool settings):
    pool_size    = 5
    max_overflow = 10
    pool_timeout = 30  s
    pool_recycle = 3600 s (1 h)

  Session lifecycle (FastAPI dependency injection):
    async with get_db() as db:
        result = await db.execute(stmt)
    # auto-commit or rollback on exit

  Alembic integration
  ────────────────────
  env.py imports:
      from app.core.database import sync_engine, Base
      target_metadata = Base.metadata

  Health check
  ─────────────
  GET /health calls health_check() → { status: "ok", latency_ms }

  Singleton pattern
  ──────────────────
  Engine and session factory are module-level singletons.
  Initialised lazily on first get_db() call (or on app startup).
  Call init_db() during lifespan startup to warm the pool.

  Author : Elizabeth Díaz Familia
           AI Data Scientist · Sustainable Intelligence & BI
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"""

from __future__ import annotations

import logging
import time
from contextlib import asynccontextmanager
from typing import AsyncGenerator, Optional

from app.config import settings

logger = logging.getLogger(__name__)

# ═══════════════════════════════════════════════════════════════
# OPTIONAL HEAVY IMPORTS — graceful fallback for minimal envs
# ═══════════════════════════════════════════════════════════════

try:
    from sqlalchemy.ext.asyncio import (
        AsyncEngine,
        AsyncSession,
        async_sessionmaker,
        create_async_engine,
    )
    from sqlalchemy import text
    _SA_AVAILABLE = True
except ImportError:
    _SA_AVAILABLE = False
    AsyncEngine = None        # type: ignore[assignment,misc]
    AsyncSession = None       # type: ignore[assignment,misc]
    async_sessionmaker = None # type: ignore[assignment]

# ── Module-level singletons ────────────────────────────────────
_engine:          Optional[AsyncEngine]       = None
_session_factory: Optional[async_sessionmaker] = None


# ═══════════════════════════════════════════════════════════════
# ENGINE FACTORY
# ═══════════════════════════════════════════════════════════════

def _build_engine() -> AsyncEngine:
    """
    Build the async SQLAlchemy engine from settings.

    Chooses PostgreSQL (asyncpg) or SQLite (aiosqlite) automatically
    based on settings.effective_database_url.

    Pool config:
        pool_size    = settings.DB_POOL_SIZE    (default 5)
        max_overflow = settings.DB_MAX_OVERFLOW (default 10)
        pool_timeout = settings.DB_POOL_TIMEOUT (default 30 s)
        pool_recycle = settings.DB_POOL_RECYCLE (default 3600 s)

    echo=True is enabled only in development for SQL debugging.
    """
    if not _SA_AVAILABLE:
        raise RuntimeError(
            "sqlalchemy[asyncio] is not installed. "
            "Run: pip install sqlalchemy[asyncio] asyncpg aiosqlite"
        )

    url = settings.effective_database_url
    is_sqlite = "sqlite" in url

    kwargs: dict = {
        "echo": settings.db_echo_effective,
        "future": True,
    }

    if not is_sqlite:
        # PostgreSQL — full pool config
        kwargs.update({
            "pool_size":    settings.DB_POOL_SIZE,
            "max_overflow": settings.DB_MAX_OVERFLOW,
            "pool_timeout": settings.DB_POOL_TIMEOUT,
            "pool_recycle": settings.DB_POOL_RECYCLE,
            "pool_pre_ping": True,   # detect stale connections
        })
    else:
        # SQLite — single connection (no pool for dev)
        kwargs["connect_args"] = {"check_same_thread": False}

    engine = create_async_engine(url, **kwargs)
    logger.info(
        "Database engine created: %s (echo=%s)",
        url.split("@")[-1] if "@" in url else url,
        kwargs["echo"],
    )
    return engine


def _get_engine() -> AsyncEngine:
    """Return (or lazily create) the module-level async engine."""
    global _engine
    if _engine is None:
        _engine = _build_engine()
    return _engine


def _get_session_factory() -> async_sessionmaker:
    """Return (or lazily create) the async session factory."""
    global _session_factory
    if _session_factory is None:
        if not _SA_AVAILABLE:
            raise RuntimeError("sqlalchemy[asyncio] not installed")
        _session_factory = async_sessionmaker(
            bind=_get_engine(),
            class_=AsyncSession,
            expire_on_commit=False,   # avoid lazy-load after commit
            autoflush=False,
            autocommit=False,
        )
    return _session_factory


# ═══════════════════════════════════════════════════════════════
# PUBLIC ACCESSORS (used by app/main.py lifespan)
# ═══════════════════════════════════════════════════════════════

def get_engine() -> AsyncEngine:
    """
    Return the singleton async engine.

    Used in:
    - app/main.py lifespan startup → warm pool
    - app/main.py lifespan shutdown → engine.dispose()
    - Alembic env.py → sync_engine (via run_sync)
    """
    return _get_engine()


# ═══════════════════════════════════════════════════════════════
# FASTAPI DEPENDENCY — get_db()
# ═══════════════════════════════════════════════════════════════

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    FastAPI dependency: yield an AsyncSession per request.

    Auto-commits on success, rolls back on any exception.
    Session is closed (returned to pool) on generator exit.

    Usage in endpoint:
        @router.get("/campaigns")
        async def list_campaigns(db: AsyncSession = Depends(get_db)):
            result = await db.execute(select(Campaign))
            return result.scalars().all()

    Mirrors app/dependencies.py get_db() — this module is the
    canonical implementation; dependencies.py re-exports it.
    """
    if not _SA_AVAILABLE:
        # Development fallback — endpoints handle missing DB gracefully
        yield None  # type: ignore[misc]
        return

    factory = _get_session_factory()
    async with factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


# ═══════════════════════════════════════════════════════════════
# CONTEXT MANAGER VARIANT (for non-FastAPI code, e.g. Celery tasks)
# ═══════════════════════════════════════════════════════════════

@asynccontextmanager
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    """
    Async context manager for database sessions outside FastAPI.

    Used by Celery tasks and background jobs that don't have
    access to FastAPI's dependency injection system.

    Usage:
        async with db_session() as db:
            campaign = await db.get(Campaign, campaign_id)
            campaign.status = "active"
            await db.commit()
    """
    if not _SA_AVAILABLE:
        yield None  # type: ignore[misc]
        return

    factory = _get_session_factory()
    async with factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


# ═══════════════════════════════════════════════════════════════
# LIFECYCLE HELPERS (called from app/main.py lifespan)
# ═══════════════════════════════════════════════════════════════

async def init_db() -> None:
    """
    Warm the connection pool on application startup.

    Called from:
        app/main.py → lifespan startup section

    Executes SELECT 1 to verify connectivity and pre-warm
    the minimum pool connections.
    """
    if not _SA_AVAILABLE:
        logger.warning("SQLAlchemy not available — skipping DB init")
        return

    engine = _get_engine()
    try:
        async with engine.begin() as conn:
            await conn.execute(text("SELECT 1"))
        logger.info("✅ Database connection pool initialised")
    except Exception as exc:
        logger.warning("⚠️  Database pool warm-up failed: %s", exc)


async def close_db() -> None:
    """
    Dispose the connection pool on application shutdown.

    Called from:
        app/main.py → lifespan shutdown section
    """
    global _engine, _session_factory
    if _engine is not None:
        await _engine.dispose()
        _engine = None
        _session_factory = None
        logger.info("Database connection pool disposed")


async def create_all_tables() -> None:
    """
    Create all tables from Base.metadata (development helper).

    NOT for production — use Alembic migrations instead.
    Useful for running integration tests or initial dev setup.

    Usage:
        import asyncio
        from app.core.database import create_all_tables
        asyncio.run(create_all_tables())
    """
    if not _SA_AVAILABLE:
        return

    from app.models import Base   # import here to avoid circular

    engine = _get_engine()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("All tables created from Base.metadata")


# ═══════════════════════════════════════════════════════════════
# HEALTH CHECK
# ═══════════════════════════════════════════════════════════════

async def health_check() -> dict:
    """
    Database health check — used by GET /health endpoint.

    Returns:
        { "status": "ok" | "degraded" | "error",
          "latency_ms": float,
          "driver": str }
    """
    if not _SA_AVAILABLE:
        return {"status": "unavailable", "latency_ms": 0, "driver": "none"}

    t0 = time.perf_counter()
    try:
        engine = _get_engine()
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        latency = round((time.perf_counter() - t0) * 1000, 2)
        url = settings.effective_database_url
        driver = "postgresql/asyncpg" if "postgresql" in url else "sqlite/aiosqlite"
        return {"status": "ok", "latency_ms": latency, "driver": driver}
    except Exception as exc:
        latency = round((time.perf_counter() - t0) * 1000, 2)
        logger.error("Database health check failed: %s", exc)
        return {
            "status": "error",
            "latency_ms": latency,
            "driver": "unknown",
            "error": str(exc),
        }
