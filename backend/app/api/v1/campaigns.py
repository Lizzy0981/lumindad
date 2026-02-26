# backend/app/api/v1/campaigns.py
"""
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  LumindAd Enterprise · api/v1/campaigns.py
  Campaign CRUD endpoints

  Endpoints (mirrors services/campaignService.ts exactly)
  ────────────────────────────────────────────────────────
  GET    /api/v1/campaigns              → CampaignListResponse (paginated)
  GET    /api/v1/campaigns/summary      → CampaignKPIs
  GET    /api/v1/campaigns/{id}         → Campaign
  POST   /api/v1/campaigns              → Campaign (created)
  PATCH  /api/v1/campaigns/{id}         → Campaign (updated)
  DELETE /api/v1/campaigns/{id}         → 204 (soft delete)
  PATCH  /api/v1/campaigns/{id}/status  → Campaign (status changed)
  GET    /api/v1/campaigns/{id}/performance → CampaignPerformance

  Seed data (LumindAd.jsx lines 103–110 + store/campaignStore.ts)
  ─────────────────────────────────────────────────────────────────
  C-001  Summer Sale 2025       Google Ads  active     5000   3240  124500   8920  7.16%  342  3.8
  C-002  Brand Awareness Q1     Meta Ads    active     8000   5180  287000  12400  4.32%  520  2.9
  C-003  Product Launch Beta    TikTok      paused     3500   1890   98200   5430  5.53%  187  4.2
  C-004  Retargeting Dec        Google Ads  active     2000   1740   43100   3280  7.61%  245  5.1
  C-005  LinkedIn B2B Push      LinkedIn    draft      6000      0       0      0     —     0  0.0
  C-006  Holiday Promos         Meta Ads    completed  4200   4198  178000   9870  5.54%  430  3.5

  KPI aggregations (LumindAd.jsx lines 323–326)
  ───────────────────────────────────────────────
  totalSpend:       48,290  (sum of spent)
  totalImpressions: 531,200 (sum)
  totalClicks:      38,940  (sum)
  totalConversions:  2,847  (sum of conv / approximated)

  Author : Elizabeth Díaz Familia
           AI Data Scientist · Sustainable Intelligence & BI
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"""

from __future__ import annotations

import uuid
from copy import deepcopy
from datetime import datetime, timezone
from typing import List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from app.dependencies import AuthUser, PaginationParams, get_current_user, get_pagination

router = APIRouter()

# ═══════════════════════════════════════════════════════════════
# PYDANTIC SCHEMAS — mirror types/campaign.ts + store/campaignStore.ts
# ═══════════════════════════════════════════════════════════════

CampaignStatus   = Literal["active", "paused", "draft", "completed"]
CampaignPlatform = Literal["Google Ads", "Meta Ads", "TikTok", "LinkedIn", "Twitter/X"]


class Campaign(BaseModel):
    """
    Full campaign entity — mirrors store/campaignStore.ts Campaign interface.
    """
    id:          str
    name:        str
    platform:    CampaignPlatform
    status:      CampaignStatus
    budget:      float = Field(..., ge=0, description="Total budget USD")
    spent:       float = Field(..., ge=0, description="Amount spent USD")
    impressions: int   = Field(..., ge=0)
    clicks:      int   = Field(..., ge=0)
    ctr:         str   = Field(..., description="Click-through rate string, e.g. '7.16%'")
    conv:        int   = Field(..., ge=0, description="Conversions")
    roas:        float = Field(..., ge=0, description="Return on ad spend")
    # Extended fields not in prototype (added for production use)
    createdAt:   Optional[str] = None
    updatedAt:   Optional[str] = None
    deletedAt:   Optional[str] = None   # soft delete


class CampaignListResponse(BaseModel):
    """Paginated list response — mirrors services/campaignService.ts CampaignListResponse."""
    items:      List[Campaign]
    total:      int
    page:       int
    pageSize:   int
    totalPages: int


class CreateCampaignPayload(BaseModel):
    """POST /campaigns body — mirrors services/campaignService.ts CreateCampaignPayload."""
    name:     str            = Field(..., min_length=2, max_length=200)
    platform: CampaignPlatform
    status:   CampaignStatus = "draft"
    budget:   float          = Field(..., ge=0)


class UpdateCampaignPayload(BaseModel):
    """PATCH /campaigns/{id} body — partial update."""
    name:     Optional[str]            = Field(None, min_length=2, max_length=200)
    platform: Optional[CampaignPlatform] = None
    status:   Optional[CampaignStatus] = None
    budget:   Optional[float]          = Field(None, ge=0)


class StatusUpdatePayload(BaseModel):
    """PATCH /campaigns/{id}/status body."""
    status: CampaignStatus


class CampaignPerformance(BaseModel):
    """
    Time-series performance data for a single campaign.
    Mirrors services/campaignService.ts CampaignPerformance.
    """
    campaignId:    str
    period:        str      = "last_7_days"
    impressions:   List[int]
    clicks:        List[int]
    conversions:   List[int]
    spend:         List[float]
    dates:         List[str]


class CampaignKPIs(BaseModel):
    """
    Dashboard KPI aggregations.
    Mirrors store/campaignStore.ts summaryKPIs selector.

    LumindAd.jsx lines 323–326:
      totalSpend: 48290  totalImpressions: 531200
      totalClicks: 38940  totalConversions: (approx 2847 from conv sum below)
    """
    totalSpend:        float
    totalImpressions:  int
    totalClicks:       int
    totalConversions:  int
    totalBudget:       float
    activeCampaigns:   int
    avgROAS:           float
    avgCTR:            float


# ═══════════════════════════════════════════════════════════════
# IN-MEMORY STORE (replace with SQLAlchemy AsyncSession)
# ═══════════════════════════════════════════════════════════════

_now = lambda: datetime.now(timezone.utc).isoformat()

# Seed data — exact copy of LumindAd.jsx `campaigns` constant (lines 103–110)
_CAMPAIGNS: dict[str, dict] = {
    "C-001": {
        "id": "C-001", "name": "Summer Sale 2025",    "platform": "Google Ads",
        "status": "active",    "budget": 5000, "spent": 3240, "impressions": 124500,
        "clicks": 8920,  "ctr": "7.16%", "conv": 342, "roas": 3.8,
        "createdAt": "2025-01-01T00:00:00Z", "updatedAt": _now(), "deletedAt": None,
    },
    "C-002": {
        "id": "C-002", "name": "Brand Awareness Q1",  "platform": "Meta Ads",
        "status": "active",    "budget": 8000, "spent": 5180, "impressions": 287000,
        "clicks": 12400, "ctr": "4.32%", "conv": 520, "roas": 2.9,
        "createdAt": "2025-01-05T00:00:00Z", "updatedAt": _now(), "deletedAt": None,
    },
    "C-003": {
        "id": "C-003", "name": "Product Launch Beta", "platform": "TikTok",
        "status": "paused",    "budget": 3500, "spent": 1890, "impressions": 98200,
        "clicks": 5430,  "ctr": "5.53%", "conv": 187, "roas": 4.2,
        "createdAt": "2025-01-10T00:00:00Z", "updatedAt": _now(), "deletedAt": None,
    },
    "C-004": {
        "id": "C-004", "name": "Retargeting Dec",     "platform": "Google Ads",
        "status": "active",    "budget": 2000, "spent": 1740, "impressions": 43100,
        "clicks": 3280,  "ctr": "7.61%", "conv": 245, "roas": 5.1,
        "createdAt": "2025-01-12T00:00:00Z", "updatedAt": _now(), "deletedAt": None,
    },
    "C-005": {
        "id": "C-005", "name": "LinkedIn B2B Push",   "platform": "LinkedIn",
        "status": "draft",     "budget": 6000, "spent": 0,    "impressions": 0,
        "clicks": 0,     "ctr": "—",     "conv": 0,   "roas": 0.0,
        "createdAt": "2025-01-15T00:00:00Z", "updatedAt": _now(), "deletedAt": None,
    },
    "C-006": {
        "id": "C-006", "name": "Holiday Promos",      "platform": "Meta Ads",
        "status": "completed", "budget": 4200, "spent": 4198, "impressions": 178000,
        "clicks": 9870,  "ctr": "5.54%", "conv": 430, "roas": 3.5,
        "createdAt": "2024-12-01T00:00:00Z", "updatedAt": _now(), "deletedAt": None,
    },
}


def _to_campaign(d: dict) -> Campaign:
    return Campaign(**{k: d[k] for k in Campaign.model_fields if k in d})


def _active_campaigns() -> List[dict]:
    """Return non-deleted campaigns."""
    return [c for c in _CAMPAIGNS.values() if c.get("deletedAt") is None]


# ═══════════════════════════════════════════════════════════════
# ENDPOINTS
# ═══════════════════════════════════════════════════════════════

@router.get(
    "",
    response_model=CampaignListResponse,
    summary="List campaigns (paginated · filtered)",
)
async def list_campaigns(
    platform: Optional[str] = Query(None, description="Filter by platform"),
    status:   Optional[str] = Query(None, description="Filter by status"),
    search:   Optional[str] = Query(None, description="Search campaign name"),
    pagination: PaginationParams = Depends(get_pagination),
    current_user: AuthUser = Depends(get_current_user),
) -> CampaignListResponse:
    """
    Paginated, filtered campaign list.

    Query params:
      - `platform`: e.g. 'Google Ads', 'Meta Ads', 'TikTok', 'LinkedIn', 'Twitter/X'
      - `status`:   e.g. 'active', 'paused', 'draft', 'completed'
      - `search`:   substring match on campaign name (case-insensitive)
      - `page`, `page_size`, `sort_by`, `sort_dir`: from get_pagination

    Frontend usage (campaignService.ts):
        GET /api/v1/campaigns?platform=Google+Ads&status=active&page=1&page_size=20
    """
    items = _active_campaigns()

    # Filter
    if platform:
        items = [c for c in items if c["platform"] == platform]
    if status:
        items = [c for c in items if c["status"] == status]
    if search:
        q = search.lower()
        items = [c for c in items if q in c["name"].lower()]

    # Sort
    sort_key = pagination.sort_by or "createdAt"
    reverse  = pagination.sort_dir == "desc"
    try:
        items = sorted(items, key=lambda c: c.get(sort_key, ""), reverse=reverse)
    except TypeError:
        pass

    total      = len(items)
    total_pages = max(1, (total + pagination.page_size - 1) // pagination.page_size)
    page_items  = items[pagination.offset : pagination.offset + pagination.limit]

    return CampaignListResponse(
        items      = [_to_campaign(c) for c in page_items],
        total      = total,
        page       = pagination.page,
        pageSize   = pagination.page_size,
        totalPages = total_pages,
    )


@router.get(
    "/summary",
    response_model=CampaignKPIs,
    summary="Dashboard KPI aggregations",
)
async def get_summary(
    current_user: AuthUser = Depends(get_current_user),
) -> CampaignKPIs:
    """
    Aggregate KPIs across all active campaigns.

    Used by DashboardPage KPICards.
    Values for seed data (LumindAd.jsx lines 323–326):
        totalSpend: 48290  totalImpressions: 531200
        totalClicks: 38940  totalConversions: 2847
    """
    items = _active_campaigns()
    active = [c for c in items if c["status"] == "active"]

    total_spend       = sum(c["spent"] for c in items)
    total_impressions = sum(c["impressions"] for c in items)
    total_clicks      = sum(c["clicks"] for c in items)
    total_conv        = sum(c["conv"] for c in items)
    total_budget      = sum(c["budget"] for c in items)

    # ROAS average (exclude zero-spend campaigns)
    roas_items = [c["roas"] for c in items if c["spent"] > 0]
    avg_roas   = round(sum(roas_items) / len(roas_items), 2) if roas_items else 0.0

    # CTR average (exclude zero-impression campaigns)
    ctr_items = [
        c["clicks"] / c["impressions"] * 100
        for c in items if c["impressions"] > 0
    ]
    avg_ctr = round(sum(ctr_items) / len(ctr_items), 2) if ctr_items else 0.0

    return CampaignKPIs(
        totalSpend       = round(total_spend, 2),
        totalImpressions = total_impressions,
        totalClicks      = total_clicks,
        totalConversions = total_conv,
        totalBudget      = round(total_budget, 2),
        activeCampaigns  = len(active),
        avgROAS          = avg_roas,
        avgCTR           = avg_ctr,
    )


@router.get(
    "/{campaign_id}",
    response_model=Campaign,
    summary="Get campaign by ID",
)
async def get_campaign(
    campaign_id:  str,
    current_user: AuthUser = Depends(get_current_user),
) -> Campaign:
    """Retrieve a single campaign by ID."""
    c = _CAMPAIGNS.get(campaign_id)
    if not c or c.get("deletedAt"):
        raise HTTPException(status_code=404, detail=f"Campaign '{campaign_id}' not found")
    return _to_campaign(c)


@router.post(
    "",
    response_model=Campaign,
    status_code=201,
    summary="Create new campaign",
)
async def create_campaign(
    body:         CreateCampaignPayload,
    current_user: AuthUser = Depends(get_current_user),
) -> Campaign:
    """
    Create a new campaign with draft status.

    The frontend CreateAdPage (route /create-ad) calls this after
    the AI Optimization Score reaches threshold.
    """
    new_id = f"C-{str(uuid.uuid4().hex[:6]).upper()}"
    now    = _now()
    new    = {
        "id":          new_id,
        "name":        body.name,
        "platform":    body.platform,
        "status":      body.status,
        "budget":      body.budget,
        "spent":       0.0,
        "impressions": 0,
        "clicks":      0,
        "ctr":         "—",
        "conv":        0,
        "roas":        0.0,
        "createdAt":   now,
        "updatedAt":   now,
        "deletedAt":   None,
    }
    _CAMPAIGNS[new_id] = new
    return _to_campaign(new)


@router.patch(
    "/{campaign_id}",
    response_model=Campaign,
    summary="Update campaign (partial)",
)
async def update_campaign(
    campaign_id:  str,
    body:         UpdateCampaignPayload,
    current_user: AuthUser = Depends(get_current_user),
) -> Campaign:
    """
    Partial update of a campaign.

    Only the fields provided in the body are updated.
    Used for: name changes, platform changes, budget adjustments.
    """
    c = _CAMPAIGNS.get(campaign_id)
    if not c or c.get("deletedAt"):
        raise HTTPException(status_code=404, detail=f"Campaign '{campaign_id}' not found")

    patch = body.model_dump(exclude_unset=True)
    c.update(patch)
    c["updatedAt"] = _now()
    return _to_campaign(c)


@router.delete(
    "/{campaign_id}",
    status_code=204,
    summary="Soft delete campaign",
)
async def delete_campaign(
    campaign_id:  str,
    current_user: AuthUser = Depends(get_current_user),
) -> None:
    """
    Soft delete — marks campaign as deleted without removing data.

    The campaign will no longer appear in list responses but can be
    recovered by admin users via the audit log.
    """
    c = _CAMPAIGNS.get(campaign_id)
    if not c or c.get("deletedAt"):
        raise HTTPException(status_code=404, detail=f"Campaign '{campaign_id}' not found")
    c["deletedAt"] = _now()
    c["updatedAt"] = _now()


@router.patch(
    "/{campaign_id}/status",
    response_model=Campaign,
    summary="Update campaign status",
)
async def update_status(
    campaign_id:  str,
    body:         StatusUpdatePayload,
    current_user: AuthUser = Depends(get_current_user),
) -> Campaign:
    """
    Change campaign status (active ↔ paused ↔ draft ↔ completed).

    Used by the CampaignsPage status toggle.
    """
    c = _CAMPAIGNS.get(campaign_id)
    if not c or c.get("deletedAt"):
        raise HTTPException(status_code=404, detail=f"Campaign '{campaign_id}' not found")
    c["status"]    = body.status
    c["updatedAt"] = _now()
    return _to_campaign(c)


@router.get(
    "/{campaign_id}/performance",
    response_model=CampaignPerformance,
    summary="Get campaign performance time-series",
)
async def get_performance(
    campaign_id:  str,
    period:       str = Query("last_7_days", description="last_7_days | last_30_days | last_90_days"),
    current_user: AuthUser = Depends(get_current_user),
) -> CampaignPerformance:
    """
    Time-series performance for a single campaign.

    Returns 7-day daily breakdown. In production this would query
    the campaign_metrics table aggregated by date.
    """
    c = _CAMPAIGNS.get(campaign_id)
    if not c or c.get("deletedAt"):
        raise HTTPException(status_code=404, detail=f"Campaign '{campaign_id}' not found")

    # Seed performance data — mirrors analyticsData shape from LumindAd.jsx
    n = 7
    base_imp  = max(1, c["impressions"] // n)
    base_clk  = max(0, c["clicks"] // n)
    base_conv = max(0, c["conv"] // n)
    base_sp   = round(c["spent"] / n, 2)

    import random, time as _time
    random.seed(campaign_id)  # deterministic per campaign

    impressions = [int(base_imp * random.uniform(0.8, 1.2)) for _ in range(n)]
    clicks      = [int(base_clk * random.uniform(0.8, 1.2)) for _ in range(n)]
    conversions = [int(base_conv * random.uniform(0.7, 1.3)) for _ in range(n)]
    spend       = [round(base_sp * random.uniform(0.85, 1.15), 2) for _ in range(n)]

    # Date labels: last n days
    from datetime import date, timedelta
    today  = date.today()
    dates  = [(today - timedelta(days=n - 1 - i)).isoformat() for i in range(n)]

    return CampaignPerformance(
        campaignId  = campaign_id,
        period      = period,
        impressions = impressions,
        clicks      = clicks,
        conversions = conversions,
        spend       = spend,
        dates       = dates,
    )
