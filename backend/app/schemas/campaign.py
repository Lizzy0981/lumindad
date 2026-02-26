# backend/app/schemas/campaign.py
"""
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  LumindAd Enterprise · backend/app/schemas/campaign.py
  Pydantic v2 Campaign request + response schemas

  Schema hierarchy
  ─────────────────
  Requests (client → API):
    CampaignCreate          POST /campaigns body
    CampaignUpdate          PATCH /campaigns/{id} body  (all Optional)
    StatusUpdateIn          PATCH /campaigns/{id}/status body

  Responses (API → client):
    CampaignOut             Single campaign (mirrors Campaign TS interface)
    CampaignListOut         GET /campaigns paginated list
    CampaignKPIsOut         GET /campaigns/summary  (Dashboard KPI cards)
    CampaignMetricOut       Single time-series data point
    CampaignPerformanceOut  GET /campaigns/{id}/performance

  TypeScript interface alignment (store/campaignStore.ts)
  ────────────────────────────────────────────────────────
  Campaign {
    id, name, platform, status, budget, spent, impressions,
    clicks, ctr, conv, roas, startDate?, endDate?, objective?
  }

  CampaignKPIs {
    totalSpend, totalImpressions, totalClicks, totalConversions, avgRoas
  }

  Seed values (LumindAd.jsx Dashboard KPI row, lines 473–484):
    totalSpend       $48,290
    totalImpressions 531,200
    totalClicks       38,940
    totalConversions   2,847
    activeCampaigns        4
    avgROAS            3.875  (weighted mean of active campaigns)
    avgCTR             6.65%  (weighted mean of active campaigns)

  ORM integration
  ────────────────
  All *Out schemas use ConfigDict(from_attributes=True).
  Usage:
      campaign_orm = await db.get(Campaign, campaign_id)
      return CampaignOut.model_validate(campaign_orm)

  Author : Elizabeth Díaz Familia
           AI Data Scientist · Sustainable Intelligence & BI
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"""

from __future__ import annotations

from typing import List, Literal, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


# ── Shared literals (mirror TypeScript union types exactly) ────────────────────

CampaignStatusLiteral = Literal["active", "paused", "draft", "completed"]
CampaignPlatformLiteral = Literal[
    "Google Ads", "Meta Ads", "TikTok", "LinkedIn", "Twitter/X"
]
CampaignObjectiveLiteral = Literal[
    "Conversions", "Awareness", "Traffic", "Leads", "App Installs"
]


# ═══════════════════════════════════════════════════════════════
# REQUEST SCHEMAS
# ═══════════════════════════════════════════════════════════════

class CampaignCreate(BaseModel):
    """
    POST /campaigns — create a new campaign.

    Mirrors services/campaignService.ts CreateCampaignPayload:
        { name, platform, status?, budget, objective? }
    """
    name:      str = Field(
        ...,
        min_length=2,
        max_length=200,
        description="Human-readable campaign name e.g. 'Summer Sale 2025'",
        examples=["Summer Sale 2025"],
    )
    platform:  CampaignPlatformLiteral = Field(
        ...,
        description="Ad platform — must be one of the 5 supported platforms",
    )
    status:    CampaignStatusLiteral = Field(
        default="draft",
        description="Initial status — defaults to draft",
    )
    budget:    float = Field(
        ...,
        gt=0,
        le=10_000_000,
        description="Total campaign budget in USD (> 0)",
        examples=[5000.00],
    )
    objective: Optional[CampaignObjectiveLiteral] = Field(
        default=None,
        description="Campaign objective: Conversions | Awareness | Traffic | Leads | App Installs",
    )
    start_date: Optional[str] = Field(
        default=None,
        description="ISO 8601 date string e.g. '2025-01-01'",
        pattern=r"^\d{4}-\d{2}-\d{2}$",
    )
    end_date: Optional[str] = Field(
        default=None,
        description="ISO 8601 date string e.g. '2025-03-31'",
        pattern=r"^\d{4}-\d{2}-\d{2}$",
    )

    @field_validator("name")
    @classmethod
    def strip_name(cls, v: str) -> str:
        """Trim whitespace and reject blank names."""
        v = v.strip()
        if not v:
            raise ValueError("Campaign name cannot be blank")
        return v

    @model_validator(mode="after")
    def validate_date_range(self) -> "CampaignCreate":
        """end_date must be after start_date when both are provided."""
        if self.start_date and self.end_date:
            if self.end_date < self.start_date:
                raise ValueError("end_date must be on or after start_date")
        return self

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "name":      "Summer Sale 2025",
                "platform":  "Google Ads",
                "status":    "draft",
                "budget":    5000.00,
                "objective": "Conversions",
                "start_date": "2025-06-01",
                "end_date":   "2025-08-31",
            }
        }
    )


class CampaignUpdate(BaseModel):
    """
    PATCH /campaigns/{id} — partial update.
    All fields are Optional — only provided fields are updated.

    Mirrors services/campaignService.ts UpdateCampaignPayload.
    """
    name:      Optional[str] = Field(
        default=None, min_length=2, max_length=200,
    )
    platform:  Optional[CampaignPlatformLiteral] = None
    status:    Optional[CampaignStatusLiteral]   = None
    budget:    Optional[float] = Field(default=None, gt=0, le=10_000_000)
    objective: Optional[CampaignObjectiveLiteral] = None
    start_date: Optional[str] = Field(
        default=None, pattern=r"^\d{4}-\d{2}-\d{2}$",
    )
    end_date: Optional[str] = Field(
        default=None, pattern=r"^\d{4}-\d{2}-\d{2}$",
    )

    @field_validator("name")
    @classmethod
    def strip_name(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            v = v.strip()
            if not v:
                raise ValueError("Campaign name cannot be blank")
        return v

    model_config = ConfigDict(
        json_schema_extra={
            "example": {"name": "Summer Sale 2025 (Extended)", "budget": 6000.00}
        }
    )


class StatusUpdateIn(BaseModel):
    """
    PATCH /campaigns/{id}/status — status-only update.
    Mirrors services/campaignService.ts StatusUpdatePayload.
    """
    status: CampaignStatusLiteral = Field(
        ...,
        description="New campaign status",
        examples=["paused"],
    )


# ═══════════════════════════════════════════════════════════════
# RESPONSE SCHEMAS
# ═══════════════════════════════════════════════════════════════

class CampaignOut(BaseModel):
    """
    Single campaign response — mirrors Campaign TS interface exactly.

    Maps from Campaign ORM model (from_attributes=True) or from
    the in-memory seed dict in api/v1/campaigns.py.

    All monetary values are float (not Decimal) for JSON compatibility.
    """

    model_config = ConfigDict(from_attributes=True)

    id:          str
    name:        str
    platform:    str   = Field(description="e.g. 'Google Ads'")
    status:      str   = Field(description="active | paused | draft | completed")
    budget:      float = Field(description="Total budget USD")
    spent:       float = Field(description="Amount spent USD")
    impressions: int
    clicks:      int
    ctr:         str   = Field(description="Formatted CTR: '7.16%' or '—'")
    conv:        int   = Field(description="Total conversions count")
    roas:        float = Field(description="Return on ad spend e.g. 3.8")
    objective:   Optional[str] = None
    startDate:   Optional[str] = Field(
        default=None, alias="start_date",
        description="ISO 8601 date string",
    )
    endDate:     Optional[str] = Field(
        default=None, alias="end_date",
        description="ISO 8601 date string",
    )
    createdAt:   Optional[str] = Field(default=None, alias="created_at")
    updatedAt:   Optional[str] = Field(default=None, alias="updated_at")

    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,    # accept both snake_case and camelCase
    )

    @classmethod
    def from_seed(cls, d: dict) -> "CampaignOut":
        """
        Build from in-memory seed dict (api/v1/campaigns.py _CAMPAIGNS).
        Handles the prototype data that has camelCase keys.
        """
        return cls.model_validate(d)


class CampaignListOut(BaseModel):
    """
    Paginated campaign list — GET /campaigns response.

    Mirrors services/campaignService.ts CampaignListResponse:
        { items, total, page, pageSize, totalPages }
    """

    model_config = ConfigDict(from_attributes=True)

    items:      List[CampaignOut]
    total:      int  = Field(description="Total matching records (before pagination)")
    page:       int  = Field(ge=1)
    pageSize:   int  = Field(ge=1, le=100)
    totalPages: int  = Field(ge=0)

    @model_validator(mode="after")
    def compute_total_pages(self) -> "CampaignListOut":
        """Auto-compute totalPages if not already set."""
        import math
        if self.pageSize > 0:
            self.totalPages = math.ceil(self.total / self.pageSize)
        return self


class CampaignKPIsOut(BaseModel):
    """
    Aggregated campaign KPIs for Dashboard KPI cards.

    GET /campaigns/summary → this schema.

    Seed values (LumindAd.jsx Dashboard lines 473–484):
        totalSpend       = 48290
        totalImpressions = 531200
        totalClicks      = 38940
        totalConversions = 2847
        totalBudget      = 28700
        activeCampaigns  = 4
        avgRoas          = 3.875  (C-001 × C-002 × C-004 weighted)
        avgCTR           = "6.65%"

    Mirrors services/campaignService.ts CampaignKPIs:
        { totalSpend, totalImpressions, totalClicks, totalConversions, avgRoas }
    And the extended Dashboard version:
        { totalBudget, activeCampaigns, avgCTR }
    """

    model_config = ConfigDict(from_attributes=True)

    totalSpend:       float = Field(description="Sum of spent across all campaigns")
    totalImpressions: int   = Field(description="Sum of impressions")
    totalClicks:      int   = Field(description="Sum of clicks")
    totalConversions: int   = Field(description="Sum of conversions")
    totalBudget:      float = Field(description="Sum of budget across all campaigns")
    activeCampaigns:  int   = Field(description="Count of status=active campaigns")
    avgROAS:          float = Field(description="Weighted average ROAS (active only)")
    avgCTR:           float = Field(description="Weighted average CTR (active, as pct e.g. 7.16)")


class CampaignMetricOut(BaseModel):
    """
    Single daily performance data point.

    Used inside CampaignPerformanceOut.
    Maps from CampaignMetric ORM model.
    """

    model_config = ConfigDict(from_attributes=True)

    date:        str   = Field(description="ISO date or display label e.g. 'Jan 1'")
    impressions: int
    clicks:      int
    conversions: int
    spend:       float


class CampaignPerformanceOut(BaseModel):
    """
    GET /campaigns/{id}/performance — time-series arrays.

    Mirrors services/campaignService.ts CampaignPerformance:
        { campaignId, period, impressions[], clicks[], conversions[], spend[], dates[] }
    """

    model_config = ConfigDict(from_attributes=True)

    campaignId:  str
    period:      str  = Field(
        default="7d",
        description="Time window: '7d' | '30d' | '90d'",
    )
    dates:       List[str]   = Field(description="ISO date strings for each data point")
    impressions: List[int]
    clicks:      List[int]
    conversions: List[int]
    spend:       List[float]
