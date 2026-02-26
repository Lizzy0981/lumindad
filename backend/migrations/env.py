# backend/migrations/env.py
"""
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  LumindAd Enterprise · backend/migrations/env.py
  Alembic async environment — SQLAlchemy 2.0

  Features
  ─────────
  • Reads DATABASE_URL_SYNC from settings (psycopg2 for migrations)
    Falls back to alembic.ini sqlalchemy.url when running without
    the full app environment (e.g. CI/CD).

  • Imports all ORM models so that autogenerate (--autogenerate)
    detects every table, index, and constraint correctly.

  • compare_type=True — detects column type changes.

  • render_as_batch=True — SQLite-compatible ALTER TABLE emulation
    (useful for local development with SQLite).

  • Naming conventions — enforces consistent constraint names
    across all dialects (PostgreSQL + SQLite).

  Tables tracked (10 tables)
  ───────────────────────────
  users · campaigns · campaign_metrics
  budget_records · daily_budget_records · platform_allocations
  ai_budget_recommendations · upload_sessions · upload_jobs
  ml_pipeline_export_records

  Usage
  ──────
  # From backend/ directory
  alembic upgrade head
  alembic downgrade base
  alembic revision --autogenerate -m "add_new_column"
  alembic history --verbose
  alembic current
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"""

from __future__ import annotations

import asyncio
import os
import sys
from logging.config import fileConfig
from pathlib import Path

from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

from alembic import context

# ── Ensure backend/ is on sys.path so `app.*` imports work ───────────────────
_BACKEND_DIR = Path(__file__).parent.parent
if str(_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(_BACKEND_DIR))

# ── Alembic config object ─────────────────────────────────────────────────────
config = context.config

# ── Logging ───────────────────────────────────────────────────────────────────
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# ── Import Base + all models (required for autogenerate) ─────────────────────
#    Each import registers the model's Table with Base.metadata.
from app.models import Base          # noqa: E402 — must come after sys.path fix

# Explicit imports ensure all models are registered even if __init__.py
# uses lazy imports.  Order does not matter for metadata — only for clarity.
from app.models.user     import User                                 # noqa: F401
from app.models.campaign import Campaign, CampaignMetric             # noqa: F401
from app.models.budget   import (                                    # noqa: F401
    BudgetRecord, DailyBudgetRecord,
    PlatformAllocationRecord, AIBudgetRecommendation,
)
from app.models.upload_job import (                                  # noqa: F401
    UploadSession, UploadJob, MLPipelineExportRecord,
)

target_metadata = Base.metadata

# ── Override sqlalchemy.url from settings when available ─────────────────────
#    Priority: DATABASE_URL_SYNC env var → settings.DATABASE_URL_SYNC → alembic.ini
def _get_database_url() -> str:
    """
    Return the synchronous database URL for Alembic.

    Alembic cannot use asyncpg (async driver); it requires psycopg2 (sync).
    settings.DATABASE_URL_SYNC uses the identical credentials with psycopg2.
    """
    # 1. Explicit env var (CI/CD override)
    env_url = os.environ.get("DATABASE_URL_SYNC") or os.environ.get("DATABASE_URL")
    if env_url:
        # Convert asyncpg URL to psycopg2 if necessary
        if "+asyncpg" in env_url:
            env_url = env_url.replace("+asyncpg", "")
        if "+aiosqlite" in env_url:
            env_url = env_url.replace("+aiosqlite", "")
        return env_url

    # 2. Application settings
    try:
        from app.config import settings
        url = settings.DATABASE_URL_SYNC
        if url:
            return url
    except Exception:
        pass

    # 3. Fallback: alembic.ini value
    return config.get_main_option("sqlalchemy.url", "")


# ── Naming convention (consistent across PostgreSQL + SQLite) ─────────────────
#    Applied via SQLAlchemy MetaData — ensures autogenerate picks up
#    any constraint that was created without an explicit name.
from sqlalchemy import MetaData  # noqa: E402

NAMING_CONVENTION = {
    "ix":  "ix_%(column_0_label)s",
    "uq":  "uq_%(table_name)s_%(column_0_name)s",
    "ck":  "ck_%(table_name)s_%(constraint_name)s",
    "fk":  "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk":  "pk_%(table_name)s",
}

# Apply naming convention to the existing metadata (non-destructive)
if not target_metadata.naming_convention:
    target_metadata.naming_convention = NAMING_CONVENTION


# ═══════════════════════════════════════════════════════════════
# OFFLINE MODE  (generate SQL without a live DB connection)
# ═══════════════════════════════════════════════════════════════

def run_migrations_offline() -> None:
    """
    Run migrations in 'offline' mode.

    Generates SQL statements without connecting to the database.
    Useful for:
      • Reviewing SQL before applying (alembic upgrade head --sql)
      • Generating migration scripts for DBAs
      • CI/CD pipelines without DB access

    Usage:
        alembic upgrade head --sql > migration.sql
    """
    url = _get_database_url()
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
        compare_server_default=True,
        render_as_batch=True,   # SQLite ALTER TABLE support
        include_schemas=True,
    )
    with context.begin_transaction():
        context.run_migrations()


# ═══════════════════════════════════════════════════════════════
# ONLINE MODE  (live async connection)
# ═══════════════════════════════════════════════════════════════

def do_run_migrations(connection: Connection) -> None:
    """Apply migrations on a live synchronous connection handle."""
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        compare_type=True,
        compare_server_default=True,
        render_as_batch=True,
        include_schemas=True,
    )
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    """
    Create an async engine and run migrations via connection.run_sync().

    Uses NullPool so the connection is not reused — safe for one-shot
    migration execution in a standalone process.
    """
    url = _get_database_url()

    # Build config section for async_engine_from_config
    config_section = config.get_section(config.config_ini_section, {})
    config_section["sqlalchemy.url"] = url

    connectable = async_engine_from_config(
        config_section,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()


def run_migrations_online() -> None:
    """Entry point for online mode — called by Alembic CLI."""
    asyncio.run(run_async_migrations())


# ── Dispatch ─────────────────────────────────────────────────────────────────
if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
