# backend/app/models/campaign.py
"""
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  LumindAd Enterprise · backend/app/models/campaign.py
  SQLAlchemy 2.0 Campaign + CampaignMetric ORM models

  Tables
  ───────
  campaigns       — one row per campaign (CRUD entity)
  campaign_metrics— daily time-series per campaign (append-only)

  campaigns columns (mirror store/campaignStore.ts Campaign exactly)
  ──────────────────────────────────────────────────────────────────
  id              UUID PK
  user_id         FK → users.id
  name            VARCHAR(200)
  platform        ENUM(CampaignPlatform)    mirrors CampaignPlatform TS type
  status          ENUM(CampaignStatus)      mirrors CampaignStatus TS type
  budget          NUMERIC(12,2)             total budget USD
  spent           NUMERIC(12,2)             amount spent USD
  impressions     BIGINT
  clicks          BIGINT
  ctr             VARCHAR(10)               formatted string e.g. "7.16%"
  conv            INTEGER                   conversions count
  roas            NUMERIC(6,3)              return on ad spend
  objective       VARCHAR(50)               Conversions | Awareness | Traffic …
  start_date      DATE
  end_date        DATE
  created_at      TIMESTAMPTZ  (TimestampMixin)
  updated_at      TIMESTAMPTZ  (TimestampMixin)
  deleted_at      TIMESTAMPTZ  (SoftDeleteMixin)
  is_deleted      BOOLEAN      (SoftDeleteMixin)

  campaign_metrics columns
  ──────────────────────────
  id              UUID PK
  campaign_id     FK → campaigns.id (cascade delete)
  record_date     DATE        — one row per calendar day
  impressions     BIGINT
  clicks          BIGINT
  conversions     INTEGER
  spend           NUMERIC(12,2)
  created_at      TIMESTAMPTZ

  Seed data alignment (LumindAd.jsx lines 103–110)
  ──────────────────────────────────────────────────
  C-001  Summer Sale 2025      Google Ads  active     5000   3240  124500   8920  7.16%  342  3.8
  C-002  Brand Awareness Q1    Meta Ads    active     8000   5180  287000  12400  4.32%  520  2.9
  C-003  Product Launch Beta   TikTok      paused     3500   1890   98200   5430  5.53%  187  4.2
  C-004  Retargeting Dec       Google Ads  active     2000   1740   43100   3280  7.61%  245  5.1
  C-005  LinkedIn B2B Push     LinkedIn    draft      6000      0       0      0     —     0  0.0
  C-006  Holiday Promos        Meta Ads    completed  4200   4198  178000   9870  5.54%  430  3.5

  Author : Elizabeth Díaz Familia
           AI Data Scientist · Sustainable Intelligence & BI
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"""

from __future__ import annotations

import enum
import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import (
    BigInteger, Date, Enum, ForeignKey,
    Index, Integer, Numeric, String, UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models import Base, SoftDeleteMixin, TimestampMixin

if TYPE_CHECKING:
    from app.models.user import User


# ═══════════════════════════════════════════════════════════════
# ENUMS — match TypeScript union types in store/campaignStore.ts
# ═══════════════════════════════════════════════════════════════

class CampaignStatus(str, enum.Enum):
    """
    Campaign lifecycle status.
    Mirrors TypeScript: type CampaignStatus = 'active' | 'paused' | 'draft' | 'completed'
    """
    ACTIVE    = "active"
    PAUSED    = "paused"
    DRAFT     = "draft"
    COMPLETED = "completed"


class CampaignPlatform(str, enum.Enum):
    """
    Ad platform identifier.
    Mirrors TypeScript: type CampaignPlatform = 'Google Ads' | 'Meta Ads' | 'TikTok' | ...
    Values preserved exactly (with spaces) so they round-trip to the frontend without mapping.
    """
    GOOGLE_ADS = "Google Ads"
    META_ADS   = "Meta Ads"
    TIKTOK     = "TikTok"
    LINKEDIN   = "LinkedIn"
    TWITTER_X  = "Twitter/X"


class CampaignObjective(str, enum.Enum):
    """
    Campaign objective — drives bid strategy.
    Mirrors TypeScript: type AdObjective in types/campaign.ts
    LumindAd.jsx CreateAdPage opts: lines 914–915
    """
    CONVERSIONS  = "Conversions"
    AWARENESS    = "Awareness"
    TRAFFIC      = "Traffic"
    LEADS        = "Leads"
    APP_INSTALLS = "App Installs"


# ═══════════════════════════════════════════════════════════════
# CAMPAIGN MODEL
# ═══════════════════════════════════════════════════════════════

class Campaign(Base, TimestampMixin, SoftDeleteMixin):
    """
    Main campaign entity — maps 1-to-1 to the Campaign interface in
    store/campaignStore.ts and to the Campaign response schema.

    KPI columns (budget, spent, impressions, clicks, conv, roas) are
    refreshed by background Celery tasks that aggregate campaign_metrics.
    The ctr column is a formatted string stored denormalised for fast
    reads — it is recomputed whenever clicks or impressions change.

    Example:
        campaign = Campaign(
            user_id=user.id,
            name="Summer Sale 2025",
            platform=CampaignPlatform.GOOGLE_ADS,
            status=CampaignStatus.ACTIVE,
            budget=Decimal("5000.00"),
            objective=CampaignObjective.CONVERSIONS,
        )
        db.add(campaign)
        await db.commit()
    """

    __tablename__ = "campaigns"
    __table_args__ = (
        # Searches and list endpoint filters
        Index("idx_campaigns_user_status",    "user_id", "status"),
        Index("idx_campaigns_user_platform",  "user_id", "platform"),
        Index("idx_campaigns_user_deleted",   "user_id", "is_deleted"),
        Index("idx_campaigns_status_deleted", "status",  "is_deleted"),
        Index("idx_campaigns_created_at",     "created_at"),
        # Prevent duplicate campaign names per user
        UniqueConstraint(
            "user_id", "name", "is_deleted",
            name="uq_campaigns_user_name_active",
        ),
    )

    # ── Identity ───────────────────────────────────────────────
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    # ── Ownership ──────────────────────────────────────────────
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # ── Core fields (mirror Campaign TS interface) ─────────────
    name: Mapped[str] = mapped_column(
        String(200),
        nullable=False,
        comment="Human-readable campaign name e.g. 'Summer Sale 2025'",
    )
    platform: Mapped[CampaignPlatform] = mapped_column(
        Enum(CampaignPlatform, name="campaign_platform"),
        nullable=False,
        index=True,
    )
    status: Mapped[CampaignStatus] = mapped_column(
        Enum(CampaignStatus, name="campaign_status"),
        nullable=False,
        default=CampaignStatus.DRAFT,
        index=True,
    )
    objective: Mapped[Optional[str]] = mapped_column(
        Enum(CampaignObjective, name="campaign_objective"),
        nullable=True,
        comment="Campaign objective: Conversions | Awareness | Traffic | …",
    )

    # ── Financial ─────────────────────────────────────────────
    budget: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        nullable=False,
        default=Decimal("0.00"),
        comment="Total campaign budget USD",
    )
    spent: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        nullable=False,
        default=Decimal("0.00"),
        comment="Amount spent so far USD — refreshed by Celery task",
    )

    # ── Performance KPIs (denormalised for fast reads) ─────────
    impressions: Mapped[int] = mapped_column(
        BigInteger, nullable=False, default=0,
    )
    clicks: Mapped[int] = mapped_column(
        BigInteger, nullable=False, default=0,
    )
    ctr: Mapped[str] = mapped_column(
        String(10),
        nullable=False,
        default="—",
        comment="Click-through rate string e.g. '7.16%' or '—' when no data",
    )
    conv: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0,
        comment="Total conversions count",
    )
    roas: Mapped[Decimal] = mapped_column(
        Numeric(6, 3),
        nullable=False,
        default=Decimal("0.000"),
        comment="Return on ad spend e.g. 3.800",
    )

    # ── Schedule ───────────────────────────────────────────────
    start_date: Mapped[Optional[date]] = mapped_column(
        Date, nullable=True,
    )
    end_date: Mapped[Optional[date]] = mapped_column(
        Date, nullable=True,
    )

    # ── Relationships ──────────────────────────────────────────
    user: Mapped["User"] = relationship(
        "User",
        back_populates="campaigns",
        lazy="select",
    )
    metrics: Mapped[List["CampaignMetric"]] = relationship(
        "CampaignMetric",
        back_populates="campaign",
        cascade="all, delete-orphan",
        order_by="CampaignMetric.record_date",
        lazy="select",
    )

    def __repr__(self) -> str:
        return (
            f"<Campaign id={self.id!s:.8} name={self.name!r} "
            f"platform={self.platform.value!r} status={self.status.value!r}>"
        )

    # ── Computed helpers ───────────────────────────────────────

    def recompute_ctr(self) -> None:
        """Recompute and store the formatted CTR string."""
        if self.impressions and self.impressions > 0:
            pct = (self.clicks / self.impressions) * 100
            self.ctr = f"{pct:.2f}%"
        else:
            self.ctr = "—"

    @property
    def budget_utilisation_pct(self) -> float:
        """Percentage of budget spent (0–100)."""
        if not self.budget or float(self.budget) == 0:
            return 0.0
        return round(float(self.spent) / float(self.budget) * 100, 1)

    @property
    def remaining_budget(self) -> Decimal:
        """Unspent budget amount."""
        return self.budget - self.spent

    def to_dict(self) -> dict:
        """
        Serialize to dict — matches Campaign TS interface exactly.
        Used by API response schemas for fast serialisation.
        """
        return {
            "id":          str(self.id),
            "name":        self.name,
            "platform":    self.platform.value,
            "status":      self.status.value,
            "budget":      float(self.budget),
            "spent":       float(self.spent),
            "impressions": self.impressions,
            "clicks":      self.clicks,
            "ctr":         self.ctr,
            "conv":        self.conv,
            "roas":        float(self.roas),
            "objective":   self.objective,
            "startDate":   self.start_date.isoformat() if self.start_date else None,
            "endDate":     self.end_date.isoformat()   if self.end_date   else None,
            "createdAt":   self.created_at.isoformat() if self.created_at else None,
            "updatedAt":   self.updated_at.isoformat() if self.updated_at else None,
        }


# ═══════════════════════════════════════════════════════════════
# CAMPAIGN METRIC — daily time-series (append-only)
# ═══════════════════════════════════════════════════════════════

class CampaignMetric(Base, TimestampMixin):
    """
    Daily performance snapshot for a single campaign.

    One row per (campaign_id, record_date) — append-only; never updated.
    Aggregated by Celery nightly tasks from the ad-platform API response.

    Used by:
      GET /campaigns/{id}/performance  → series of 7 / 30 / 90 days
      GET /analytics/series            → aggregated across all campaigns

    Mirrors services/campaignService.ts CampaignPerformance shape:
        impressions[], clicks[], conversions[], spend[], dates[]
    """

    __tablename__ = "campaign_metrics"
    __table_args__ = (
        # Prevent duplicate daily records
        UniqueConstraint(
            "campaign_id", "record_date",
            name="uq_campaign_metrics_campaign_date",
        ),
        Index("idx_campaign_metrics_campaign_date", "campaign_id", "record_date"),
        Index("idx_campaign_metrics_date",           "record_date"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    campaign_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("campaigns.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    record_date: Mapped[date] = mapped_column(
        Date,
        nullable=False,
        comment="Calendar date this metric row represents",
    )

    # ── Daily KPIs ─────────────────────────────────────────────
    impressions: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    clicks:      Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    conversions: Mapped[int] = mapped_column(Integer,    nullable=False, default=0)
    spend:       Mapped[Decimal] = mapped_column(
        Numeric(12, 2), nullable=False, default=Decimal("0.00"),
    )

    # ── Relationship ───────────────────────────────────────────
    campaign: Mapped["Campaign"] = relationship(
        "Campaign",
        back_populates="metrics",
        lazy="select",
    )

    def __repr__(self) -> str:
        return (
            f"<CampaignMetric campaign={self.campaign_id!s:.8} "
            f"date={self.record_date} impressions={self.impressions}>"
        )

    def to_dict(self) -> dict:
        return {
            "date":        self.record_date.isoformat(),
            "impressions": self.impressions,
            "clicks":      self.clicks,
            "conversions": self.conversions,
            "spend":       float(self.spend),
        }
