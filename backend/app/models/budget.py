# backend/app/models/budget.py
"""
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  LumindAd Enterprise · backend/app/models/budget.py
  SQLAlchemy 2.0 Budget ORM models (4 tables)

  Tables
  ───────
  budget_records          — monthly budget summary per user
  daily_budget_records    — Mon→Sun daily spend vs budget
  platform_allocations    — % share per ad platform per budget record
  ai_budget_recommendations — XGBoost reallocations (applied or not)

  Table: budget_records
  ──────────────────────
  One row per (user_id, period_year, period_month).
  Seed: $28,500 total / $18,347 spent / 64% used (LumindAd.jsx lines 505–510)

  Table: daily_budget_records
  ────────────────────────────
  7 rows per budget_record_id (Mon → Sun).
  Seed: budget=1500 each day (LumindAd.jsx lines 119–123)
  spend: 1240 | 1820 | 1470 | 2250 | 2480 | 1840 | 1350

  Table: platform_allocations
  ────────────────────────────
  5 rows per budget_record_id.
  Seed: Google 38% · Meta 29% · TikTok 18% · LinkedIn 10% · Twitter/X 5%
  (LumindAd.jsx platformData lines 95–101)

  Table: ai_budget_recommendations
  ──────────────────────────────────
  XGBoost-generated reallocation suggestions.
  Seed: "Reallocate $1,200 from Meta → Google Ads (+23% ROAS)"
  (LumindAd.jsx lines 550–558)

  Author : Elizabeth Díaz Familia
           AI Data Scientist · Sustainable Intelligence & BI
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"""

from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import (
    Boolean, ForeignKey, Index, Integer,
    Numeric, SmallInteger, String, Text, UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.user import User


# ═══════════════════════════════════════════════════════════════
# BUDGET RECORD — monthly summary
# ═══════════════════════════════════════════════════════════════

class BudgetRecord(Base, TimestampMixin):
    """
    Monthly budget summary per user.

    One row per (user_id, period_year, period_month).
    All daily records and platform allocations hang off this record.

    Seed values (LumindAd.jsx BudgetPage KPI cards, lines 505–510):
        total_budget = 28500.00
        total_spent  = 18347.00
        remaining    = 10153.00  (computed: total_budget - total_spent)
        used_pct     = 64.0      (computed: total_spent / total_budget * 100)
        change_pct   = +18.2     (vs prior period)
        period_label = "November 2025"

    Example:
        record = BudgetRecord(
            user_id=user.id,
            period_year=2025,
            period_month=11,
            total_budget=Decimal("28500.00"),
            total_spent=Decimal("18347.00"),
            change_pct=Decimal("18.2"),
        )
    """

    __tablename__ = "budget_records"
    __table_args__ = (
        # One budget record per user per month
        UniqueConstraint(
            "user_id", "period_year", "period_month",
            name="uq_budget_records_user_period",
        ),
        Index("idx_budget_records_user_period", "user_id", "period_year", "period_month"),
        Index("idx_budget_records_user",         "user_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # ── Period ─────────────────────────────────────────────────
    period_year: Mapped[int] = mapped_column(
        SmallInteger,
        nullable=False,
        comment="Calendar year e.g. 2025",
    )
    period_month: Mapped[int] = mapped_column(
        SmallInteger,
        nullable=False,
        comment="Calendar month 1–12",
    )
    period_label: Mapped[Optional[str]] = mapped_column(
        String(50),
        nullable=True,
        comment="Display label e.g. 'November 2025'",
    )

    # ── Financials ────────────────────────────────────────────
    total_budget: Mapped[Decimal] = mapped_column(
        Numeric(14, 2),
        nullable=False,
        default=Decimal("0.00"),
        comment="Total monthly budget cap USD — seed: 28500.00",
    )
    total_spent: Mapped[Decimal] = mapped_column(
        Numeric(14, 2),
        nullable=False,
        default=Decimal("0.00"),
        comment="Total amount spent USD — seed: 18347.00",
    )
    change_pct: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(6, 2),
        nullable=True,
        comment="% change vs prior period — seed: +18.2",
    )

    # ── Relationships ─────────────────────────────────────────
    user: Mapped["User"] = relationship(
        "User",
        lazy="select",
    )
    daily_records: Mapped[List["DailyBudgetRecord"]] = relationship(
        "DailyBudgetRecord",
        back_populates="budget_record",
        cascade="all, delete-orphan",
        order_by="DailyBudgetRecord.day_order",
        lazy="select",
    )
    platform_allocations: Mapped[List["PlatformAllocationRecord"]] = relationship(
        "PlatformAllocationRecord",
        back_populates="budget_record",
        cascade="all, delete-orphan",
        order_by="PlatformAllocationRecord.pct.desc()",
        lazy="select",
    )
    recommendations: Mapped[List["AIBudgetRecommendation"]] = relationship(
        "AIBudgetRecommendation",
        back_populates="budget_record",
        cascade="all, delete-orphan",
        lazy="select",
    )

    def __repr__(self) -> str:
        return (
            f"<BudgetRecord user={self.user_id!s:.8} "
            f"period={self.period_year}-{self.period_month:02d} "
            f"budget={self.total_budget}>"
        )

    # ── Computed properties ────────────────────────────────────

    @property
    def remaining(self) -> Decimal:
        """Unspent budget amount."""
        return self.total_budget - self.total_spent

    @property
    def used_pct(self) -> float:
        """Percentage of budget consumed (0–100)."""
        if not self.total_budget or float(self.total_budget) == 0:
            return 0.0
        return round(float(self.total_spent) / float(self.total_budget) * 100, 1)

    def to_dict(self) -> dict:
        """Serialize — matches services/budgetService.ts BudgetSummary."""
        return {
            "id":           str(self.id),
            "totalBudget":  float(self.total_budget),
            "totalSpent":   float(self.total_spent),
            "remaining":    float(self.remaining),
            "usedPercent":  self.used_pct,
            "period":       self.period_label or f"{self.period_year}-{self.period_month:02d}",
            "changePercent": float(self.change_pct) if self.change_pct else 0.0,
            "createdAt":    self.created_at.isoformat() if self.created_at else None,
        }


# ═══════════════════════════════════════════════════════════════
# DAILY BUDGET RECORD — Mon → Sun
# ═══════════════════════════════════════════════════════════════

class DailyBudgetRecord(Base, TimestampMixin):
    """
    One row per day of the week (Mon=0 … Sun=6) per budget record.

    Seed (LumindAd.jsx lines 119–123, store/budgetStore.ts SEED_DAILY_ENTRIES):
        Mon: budget=1500, spend=1240
        Tue: budget=1500, spend=1820
        Wed: budget=1500, spend=1470
        Thu: budget=1500, spend=2250
        Fri: budget=1500, spend=2480
        Sat: budget=1500, spend=1840
        Sun: budget=1500, spend=1350

    Used by GET /budget/daily → List[DailyBudgetEntry].
    BudgetPage BudgetChart (BarChart component).
    """

    __tablename__ = "daily_budget_records"
    __table_args__ = (
        UniqueConstraint(
            "budget_record_id", "day_order",
            name="uq_daily_budget_record_day",
        ),
        Index("idx_daily_budget_budget_record", "budget_record_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    budget_record_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("budget_records.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # ── Day descriptor ─────────────────────────────────────────
    day_label: Mapped[str] = mapped_column(
        String(3),
        nullable=False,
        comment="3-char label exactly as frontend expects: Mon | Tue | … | Sun",
    )
    day_order: Mapped[int] = mapped_column(
        SmallInteger,
        nullable=False,
        comment="Sort order: Mon=0, Tue=1, … Sun=6",
    )

    # ── Financials ────────────────────────────────────────────
    budget: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        nullable=False,
        comment="Daily budget cap USD — seed: 1500.00",
    )
    spend: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        nullable=False,
        default=Decimal("0.00"),
        comment="Actual daily spend USD",
    )

    # ── Relationship ──────────────────────────────────────────
    budget_record: Mapped["BudgetRecord"] = relationship(
        "BudgetRecord",
        back_populates="daily_records",
        lazy="select",
    )

    def __repr__(self) -> str:
        return (
            f"<DailyBudgetRecord day={self.day_label} "
            f"budget={self.budget} spend={self.spend}>"
        )

    def to_dict(self) -> dict:
        """Matches store/budgetStore.ts DailyBudgetEntry exactly."""
        return {
            "day":    self.day_label,
            "budget": float(self.budget),
            "spend":  float(self.spend),
        }


# ═══════════════════════════════════════════════════════════════
# PLATFORM ALLOCATION RECORD
# ═══════════════════════════════════════════════════════════════

class PlatformAllocationRecord(Base, TimestampMixin):
    """
    Platform budget allocation — % share per ad platform.

    One row per platform per budget_record.
    5 platforms total (mirrors platformData in LumindAd.jsx lines 95–101).

    Seed (store/budgetStore.ts SEED_ALLOCATIONS):
        Google Ads  38%  #4285f4  → $6,971.86
        Meta Ads    29%  #1877f2  → $5,320.63
        TikTok      18%  #ff0050  → $3,302.46
        LinkedIn    10%  #0077b5  → $1,834.70
        Twitter/X    5%  #1da1f2  →   $917.35

    Used by GET /budget/allocations and the PlatformSplit pie chart.
    """

    __tablename__ = "platform_allocations"
    __table_args__ = (
        UniqueConstraint(
            "budget_record_id", "platform_name",
            name="uq_platform_allocations_record_platform",
        ),
        Index("idx_platform_allocations_budget_record", "budget_record_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    budget_record_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("budget_records.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    platform_name: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        comment="Platform label exactly as frontend: 'Google Ads' | 'Meta Ads' | …",
    )
    pct: Mapped[Decimal] = mapped_column(
        Numeric(5, 2),
        nullable=False,
        comment="Percentage share 0–100 e.g. 38.00",
    )
    color: Mapped[str] = mapped_column(
        String(7),
        nullable=False,
        comment="Brand hex colour e.g. '#4285f4' — used by pie chart",
    )
    amount_usd: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        nullable=False,
        default=Decimal("0.00"),
        comment="Computed dollar amount: total_spent × pct / 100",
    )

    # ── Relationship ──────────────────────────────────────────
    budget_record: Mapped["BudgetRecord"] = relationship(
        "BudgetRecord",
        back_populates="platform_allocations",
        lazy="select",
    )

    def __repr__(self) -> str:
        return (
            f"<PlatformAllocation platform={self.platform_name!r} "
            f"pct={self.pct}% amount=${self.amount_usd}>"
        )

    def recompute_amount(self, total_spent: Decimal) -> None:
        """Recompute amount_usd from total_spent × pct / 100."""
        self.amount_usd = (total_spent * self.pct / Decimal("100")).quantize(Decimal("0.01"))

    def to_dict(self) -> dict:
        """Matches store/budgetStore.ts PlatformAllocation."""
        return {
            "platform":  self.platform_name,
            "pct":       float(self.pct),
            "color":     self.color,
            "amountUSD": float(self.amount_usd),
        }


# ═══════════════════════════════════════════════════════════════
# AI BUDGET RECOMMENDATION
# ═══════════════════════════════════════════════════════════════

class AIBudgetRecommendation(Base, TimestampMixin):
    """
    XGBoost-generated budget reallocation recommendation.

    Seed (LumindAd.jsx lines 550–558, store/budgetStore.ts AIRecommendation):
        from_platform = "Meta Ads"
        to_platform   = "Google Ads"
        amount_usd    = 1200.00
        roas_gain_pct = 23.0   → +23% predicted ROAS improvement
        applied       = False

    Rationale stored in `rationale` column (full XGBoost explanation).

    Lifecycle:
        applied=False → show in UI as pending recommendation
        applied=True  → user clicked "Apply"; allocation rows updated
    """

    __tablename__ = "ai_budget_recommendations"
    __table_args__ = (
        Index("idx_ai_recs_budget_record", "budget_record_id"),
        Index("idx_ai_recs_applied",       "applied"),
        Index("idx_ai_recs_created_at",    "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    budget_record_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("budget_records.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # ── Recommendation payload ────────────────────────────────
    from_platform: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        comment="Source platform losing budget — seed: 'Meta Ads'",
    )
    to_platform: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        comment="Destination platform gaining budget — seed: 'Google Ads'",
    )
    amount_usd: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        nullable=False,
        comment="Dollar amount to reallocate — seed: 1200.00",
    )
    roas_gain_pct: Mapped[Decimal] = mapped_column(
        Numeric(6, 2),
        nullable=False,
        comment="Predicted ROAS improvement % — seed: 23.00 (+23%)",
    )
    rationale: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        comment="Full XGBoost explanation text shown in UI",
    )
    model_version: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="xgboost-v2.3.1",
        comment="ML model version that generated this recommendation",
    )

    # ── Status ────────────────────────────────────────────────
    applied: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        index=True,
        comment="True after user clicks Apply in BudgetPage",
    )
    applied_at: Mapped[Optional[datetime]] = mapped_column(
        __import__("sqlalchemy").DateTime(timezone=True),
        nullable=True,
        comment="Timestamp when user applied the recommendation",
    )

    # ── Relationship ──────────────────────────────────────────
    budget_record: Mapped["BudgetRecord"] = relationship(
        "BudgetRecord",
        back_populates="recommendations",
        lazy="select",
    )

    def __repr__(self) -> str:
        return (
            f"<AIBudgetRecommendation from={self.from_platform!r} "
            f"to={self.to_platform!r} amount=${self.amount_usd} "
            f"roas_gain={self.roas_gain_pct}% applied={self.applied}>"
        )

    def apply(self) -> None:
        """Mark recommendation as applied."""
        from datetime import timezone
        self.applied    = True
        self.applied_at = datetime.now(timezone.utc)

    def to_dict(self) -> dict:
        """Matches api/v1/budget.py AIRecommendation schema."""
        return {
            "id":           str(self.id),
            "fromPlatform": self.from_platform,
            "toPlatform":   self.to_platform,
            "amountUSD":    float(self.amount_usd),
            "roasGain":     float(self.roas_gain_pct) / 100,  # pct → fraction
            "rationale":    self.rationale or "",
            "applied":      self.applied,
            "appliedAt":    self.applied_at.isoformat() if self.applied_at else None,
        }
