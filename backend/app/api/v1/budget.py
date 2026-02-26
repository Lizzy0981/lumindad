# backend/app/api/v1/budget.py
"""
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  LumindAd Enterprise · api/v1/budget.py
  Budget management endpoints

  Endpoints (mirrors services/budgetService.ts exactly)
  ───────────────────────────────────────────────────────
  GET   /api/v1/budget/summary           → BudgetSummary
  GET   /api/v1/budget/daily             → DailyBudgetEntry[]
  GET   /api/v1/budget/allocations       → PlatformAllocation[]
  PATCH /api/v1/budget/allocations       → PlatformAllocation[]
  GET   /api/v1/budget/recommendation    → AIRecommendation
  POST  /api/v1/budget                   → BudgetSummary (set budget)
  GET   /api/v1/budget/forecast          → BudgetForecast

  Seed data (LumindAd.jsx lines 119–123 + BudgetPage lines 505–558)
  ──────────────────────────────────────────────────────────────────
  KPI cards
    Total Budget  $28,500  #7c3aed
    Total Spent   $18,347  #10b981  +18.2%
    Remaining     $10,153  #06b6d4
    Budget Used      64%   #f59e0b

  Daily (Mon→Sun): budget=1500, spend=[1240,1820,1470,2250,2480,1840,1350]

  Platform allocations (from platformData lines 95–101, first 4):
    Google Ads  38%  #4285f4
    Meta Ads    29%  #1877f2
    TikTok      18%  #ff0050
    LinkedIn    10%  #0077b5

  AI Recommendation (LumindAd.jsx lines 550–558):
    "Reallocate $1,200 from Meta to Google Ads.
     XGBoost estimates +23% ROAS improvement."

  Author : Elizabeth Díaz Familia
           AI Data Scientist · Sustainable Intelligence & BI
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"""

from __future__ import annotations

from datetime import date, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field

from app.dependencies import AuthUser, get_current_user

router = APIRouter()

# ═══════════════════════════════════════════════════════════════
# PYDANTIC SCHEMAS — mirror services/budgetService.ts + store/budgetStore.ts
# ═══════════════════════════════════════════════════════════════

class BudgetSummary(BaseModel):
    """
    Mirrors services/budgetService.ts BudgetSummary.
    LumindAd.jsx BudgetPage KPI cards (lines 505–510).
    """
    totalBudget:   float = Field(..., description="Total monthly budget USD")
    totalSpent:    float = Field(..., description="Total spent USD")
    remaining:     float = Field(..., description="totalBudget - totalSpent")
    usedPercent:   float = Field(..., ge=0, le=100, description="% of budget used")
    period:        str   = Field(..., description="Display label e.g. 'November 2025'")
    changePercent: float = Field(..., description="% change vs prior period (+18.2%)")


class DailyBudgetEntry(BaseModel):
    """
    Mirrors store/budgetStore.ts DailyBudgetEntry.
    LumindAd.jsx budgetData (lines 119–123).
    """
    day:    str   = Field(..., description="Day label e.g. 'Mon'")
    budget: float = Field(..., description="Daily budget cap USD")
    spend:  float = Field(..., description="Actual spend USD")


class PlatformAllocation(BaseModel):
    """
    Mirrors store/budgetStore.ts PlatformAllocation.
    LumindAd.jsx platformData (lines 95–101).
    """
    platform:      str   = Field(..., description="Platform name")
    pct:           float = Field(..., ge=0, le=100, description="% of budget")
    color:         str   = Field(..., description="Brand hex colour")
    amountUSD:     float = Field(..., ge=0, description="Computed dollar amount")


class UpdateAllocationsPayload(BaseModel):
    """PATCH /budget/allocations body."""
    allocations: List[PlatformAllocation]


class AIRecommendation(BaseModel):
    """
    Mirrors store/budgetStore.ts AIRecommendation.
    LumindAd.jsx lines 550–558:
      "Reallocate $1,200 from Meta to Google Ads."
    """
    id:          str
    fromPlatform: str
    toPlatform:   str
    amountUSD:    float
    roasGain:     float   = Field(..., description="Predicted ROAS improvement e.g. 0.23")
    rationale:    str
    applied:      bool    = False


class SetBudgetPayload(BaseModel):
    """POST /budget body — set a new monthly total budget."""
    totalBudget:  float = Field(..., ge=0)
    period:       Optional[str] = None   # e.g. 'December 2025'


class BudgetForecast(BaseModel):
    """
    Mirrors services/budgetService.ts BudgetForecast.
    7-day forward projection.
    """
    dates:             List[str]
    projectedSpend:    List[float]
    projectedBudget:   List[float]
    estimatedEndDate:  str   = Field(..., description="ISO date when budget runs out")
    daysRemaining:     int
    onTrack:           bool  = Field(..., description="Will stay within budget?")


# ═══════════════════════════════════════════════════════════════
# IN-MEMORY STATE (replace with DB)
# ═══════════════════════════════════════════════════════════════

_BUDGET_STATE: dict = {
    "totalBudget": 28500.0,      # LumindAd.jsx line 505
    "totalSpent":  18347.0,      # LumindAd.jsx line 506
    "period":      "November 2025",
    "changePercent": 18.2,       # +18.2% vs prior period
}

# LumindAd.jsx budgetData lines 119–123
_DAILY_ENTRIES: List[dict] = [
    {"day": "Mon", "budget": 1500, "spend": 1240},
    {"day": "Tue", "budget": 1500, "spend": 1820},
    {"day": "Wed", "budget": 1500, "spend": 1470},
    {"day": "Thu", "budget": 1500, "spend": 2250},
    {"day": "Fri", "budget": 1500, "spend": 2480},
    {"day": "Sat", "budget": 1500, "spend": 1840},
    {"day": "Sun", "budget": 1500, "spend": 1350},
]

# LumindAd.jsx platformData lines 95–101
_ALLOCATIONS: List[dict] = [
    {"platform": "Google Ads", "pct": 38, "color": "#4285f4", "amountUSD": 6971.86},
    {"platform": "Meta Ads",   "pct": 29, "color": "#1877f2", "amountUSD": 5320.63},
    {"platform": "TikTok",     "pct": 18, "color": "#ff0050", "amountUSD": 3302.46},
    {"platform": "LinkedIn",   "pct": 10, "color": "#0077b5", "amountUSD": 1834.70},
    {"platform": "Twitter/X",  "pct":  5, "color": "#1da1f2", "amountUSD":  917.35},
]

# LumindAd.jsx AI Recommendation lines 550–558
_AI_RECOMMENDATION: dict = {
    "id":           "rec_001",
    "fromPlatform": "Meta Ads",
    "toPlatform":   "Google Ads",
    "amountUSD":    1200.0,
    "roasGain":     0.23,          # +23% ROAS improvement
    "rationale":    (
        "Reallocate $1,200 from Meta to Google Ads. "
        "Predictive model (XGBoost) estimates +23% ROAS improvement "
        "based on last 30 days of performance data."
    ),
    "applied": False,
}


# ═══════════════════════════════════════════════════════════════
# ENDPOINTS
# ═══════════════════════════════════════════════════════════════

@router.get(
    "/summary",
    response_model=BudgetSummary,
    summary="Monthly budget summary",
)
async def get_summary(
    period:       Optional[str] = Query(None, description="Period label e.g. 'November 2025'"),
    current_user: AuthUser      = Depends(get_current_user),
) -> BudgetSummary:
    """
    Current month budget summary.

    KPI values (LumindAd.jsx BudgetPage lines 505–510):
      Total Budget  $28,500
      Total Spent   $18,347 (+18.2%)
      Remaining     $10,153
      Budget Used    64%
    """
    s = _BUDGET_STATE
    return BudgetSummary(
        totalBudget   = s["totalBudget"],
        totalSpent    = s["totalSpent"],
        remaining     = round(s["totalBudget"] - s["totalSpent"], 2),
        usedPercent   = round(s["totalSpent"] / s["totalBudget"] * 100, 1),
        period        = period or s["period"],
        changePercent = s["changePercent"],
    )


@router.get(
    "/daily",
    response_model=List[DailyBudgetEntry],
    summary="Daily spend vs budget (7 days)",
)
async def get_daily(
    period:       Optional[str] = Query(None),
    current_user: AuthUser      = Depends(get_current_user),
) -> List[DailyBudgetEntry]:
    """
    7-day daily budget vs spend array.
    Used by BudgetPage BudgetChart (BarChart).
    Seed: LumindAd.jsx budgetData lines 119–123.
    """
    return [DailyBudgetEntry(**e) for e in _DAILY_ENTRIES]


@router.get(
    "/allocations",
    response_model=List[PlatformAllocation],
    summary="Platform budget allocations",
)
async def get_allocations(
    current_user: AuthUser = Depends(get_current_user),
) -> List[PlatformAllocation]:
    """
    Per-platform budget allocation percentages.
    Used by BudgetPage PlatformSplit pie chart + allocation bars.
    Seed: LumindAd.jsx platformData (lines 95–101, first 4).
    """
    return [PlatformAllocation(**a) for a in _ALLOCATIONS]


@router.patch(
    "/allocations",
    response_model=List[PlatformAllocation],
    summary="Update platform allocations",
)
async def update_allocations(
    body:         UpdateAllocationsPayload,
    current_user: AuthUser = Depends(get_current_user),
) -> List[PlatformAllocation]:
    """
    Update budget allocations across platforms.

    Total must sum to 100% (validated client-side in BudgetPage).
    Server recomputes amountUSD from totalSpent × pct / 100.
    """
    total_spent = _BUDGET_STATE["totalSpent"]
    updated     = []
    for alloc in body.allocations:
        alloc_dict              = alloc.model_dump()
        alloc_dict["amountUSD"] = round(total_spent * alloc.pct / 100, 2)
        updated.append(alloc_dict)

    _ALLOCATIONS.clear()
    _ALLOCATIONS.extend(updated)
    return [PlatformAllocation(**a) for a in _ALLOCATIONS]


@router.get(
    "/recommendation",
    response_model=AIRecommendation,
    summary="AI budget reallocation recommendation",
)
async def get_recommendation(
    current_user: AuthUser = Depends(get_current_user),
) -> AIRecommendation:
    """
    XGBoost-powered budget reallocation recommendation.

    LumindAd.jsx lines 550–558:
      "Reallocate $1,200 from Meta to Google Ads.
       XGBoost estimates +23% ROAS improvement."
    """
    return AIRecommendation(**_AI_RECOMMENDATION)


@router.post(
    "",
    response_model=BudgetSummary,
    status_code=201,
    summary="Set monthly budget",
)
async def set_budget(
    body:         SetBudgetPayload,
    current_user: AuthUser = Depends(get_current_user),
) -> BudgetSummary:
    """
    Set a new monthly total budget.

    Recomputes amountUSD for all platform allocations.
    Used by BudgetPage 'Set Monthly Budget' button.
    """
    _BUDGET_STATE["totalBudget"] = body.totalBudget
    if body.period:
        _BUDGET_STATE["period"] = body.period

    # Recompute allocation amountUSD
    total_spent = _BUDGET_STATE["totalSpent"]
    for alloc in _ALLOCATIONS:
        alloc["amountUSD"] = round(total_spent * alloc["pct"] / 100, 2)

    return BudgetSummary(
        totalBudget   = _BUDGET_STATE["totalBudget"],
        totalSpent    = _BUDGET_STATE["totalSpent"],
        remaining     = round(_BUDGET_STATE["totalBudget"] - _BUDGET_STATE["totalSpent"], 2),
        usedPercent   = round(_BUDGET_STATE["totalSpent"] / _BUDGET_STATE["totalBudget"] * 100, 1),
        period        = _BUDGET_STATE["period"],
        changePercent = _BUDGET_STATE["changePercent"],
    )


@router.get(
    "/forecast",
    response_model=BudgetForecast,
    summary="7-day budget forecast",
)
async def get_forecast(
    days:         int            = Query(7, ge=7, le=30, description="Forecast horizon"),
    current_user: AuthUser       = Depends(get_current_user),
) -> BudgetForecast:
    """
    Forward budget projection using linear regression on daily spend.

    Uses last 7 days actual spend to project the next `days` days.
    Returns whether the budget is on track (projectedTotal ≤ totalBudget).
    """
    # Compute average daily spend from seed data
    actual_spends = [e["spend"] for e in _DAILY_ENTRIES]
    avg_daily     = sum(actual_spends) / len(actual_spends)

    remaining_budget = _BUDGET_STATE["totalBudget"] - _BUDGET_STATE["totalSpent"]
    today            = date.today()

    projected_spend  = []
    projected_budget = []
    dates            = []
    cumulative        = 0.0

    for i in range(days):
        d = today + timedelta(days=i + 1)
        # Simple linear projection with slight upward trend (+0.5%)
        daily_proj = round(avg_daily * (1 + i * 0.005), 2)
        cumulative += daily_proj
        projected_spend.append(round(cumulative, 2))
        projected_budget.append(round(remaining_budget, 2))
        dates.append(d.isoformat())

    days_remaining  = max(0, int(remaining_budget / avg_daily)) if avg_daily > 0 else days
    estimated_end   = (today + timedelta(days=days_remaining)).isoformat()
    on_track        = cumulative <= remaining_budget

    return BudgetForecast(
        dates            = dates,
        projectedSpend   = projected_spend,
        projectedBudget  = projected_budget,
        estimatedEndDate = estimated_end,
        daysRemaining    = days_remaining,
        onTrack          = on_track,
    )
