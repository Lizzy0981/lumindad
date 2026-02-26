# backend/app/models/__init__.py
"""
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  LumindAd Enterprise · backend/app/models/__init__.py
  SQLAlchemy 2.0 ORM — package initialisation

  Architecture
  ─────────────
  Uses SQLAlchemy 2.0 Declarative with typed mapped_column().
  All models inherit from Base (DeclarativeBase subclass).

  Shared mixins defined here (imported by each model):
  ┌──────────────────┬──────────────────────────────────────────┐
  │ TimestampMixin   │ created_at, updated_at — auto-managed    │
  │ SoftDeleteMixin  │ deleted_at, is_deleted — logical delete  │
  └──────────────────┴──────────────────────────────────────────┘

  Import order matters for Alembic autogenerate:
  All model classes must be imported here so that Alembic's
  env.py sees them when it calls `target_metadata = Base.metadata`.

  Usage
  ──────
  from app.models import Base               # for create_all / Alembic
  from app.models.user import User
  from app.models.campaign import Campaign, CampaignMetric
  from app.models.budget import (
      BudgetRecord, DailyBudgetRecord,
      PlatformAllocationRecord, AIBudgetRecommendation,
  )
  from app.models.upload_job import UploadSession, UploadJob

  Author : Elizabeth Díaz Familia
           AI Data Scientist · Sustainable Intelligence & BI
  Version: 1.0.0
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import DateTime, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


# ═══════════════════════════════════════════════════════════════
# BASE CLASS
# ═══════════════════════════════════════════════════════════════

class Base(DeclarativeBase):
    """
    SQLAlchemy 2.0 declarative base.
    All ORM model classes must inherit from this Base.
    Alembic env.py imports Base.metadata to auto-detect migrations.
    """
    pass


# ═══════════════════════════════════════════════════════════════
# SHARED MIXINS
# ═══════════════════════════════════════════════════════════════

class TimestampMixin:
    """
    created_at + updated_at columns — auto-managed by SQLAlchemy.

    created_at → server_default=func.now() (set once at INSERT)
    updated_at → onupdate=func.now()       (refreshed on every UPDATE)

    Usage:
        class Campaign(Base, TimestampMixin):
            __tablename__ = "campaigns"
    """
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class SoftDeleteMixin:
    """
    Logical delete via deleted_at + is_deleted.

    Never physically removes rows.
    All list queries should filter: WHERE is_deleted = FALSE.

    Usage:
        campaign.soft_delete()
        await db.commit()

        # Active-only query
        stmt = select(Campaign).where(Campaign.is_deleted.is_(False))
    """
    deleted_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        default=None,
    )
    is_deleted: Mapped[bool] = mapped_column(
        default=False,
        nullable=False,
        index=True,
    )

    def soft_delete(self) -> None:
        """Mark record as deleted (non-destructive)."""
        self.is_deleted = True
        self.deleted_at = datetime.now(timezone.utc)

    def restore(self) -> None:
        """Undo a soft delete."""
        self.is_deleted = False
        self.deleted_at = None


# ═══════════════════════════════════════════════════════════════
# MODEL IMPORTS — required for Alembic metadata discovery
# ═══════════════════════════════════════════════════════════════

# fmt: off
from app.models.user       import User                                              # noqa: E402, F401
from app.models.campaign   import Campaign, CampaignMetric                          # noqa: E402, F401
from app.models.budget     import (                                                 # noqa: E402, F401
    BudgetRecord,
    DailyBudgetRecord,
    PlatformAllocationRecord,
    AIBudgetRecommendation,
)
from app.models.upload_job import UploadSession, UploadJob, MLPipelineExportRecord  # noqa: E402, F401
# fmt: on


__all__ = [
    "Base", "TimestampMixin", "SoftDeleteMixin",
    "User",
    "Campaign", "CampaignMetric",
    "BudgetRecord", "DailyBudgetRecord", "PlatformAllocationRecord", "AIBudgetRecommendation",
    "UploadSession", "UploadJob", "MLPipelineExportRecord",
]
