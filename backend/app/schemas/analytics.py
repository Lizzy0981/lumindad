# backend/app/schemas/analytics.py
"""
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  LumindAd Enterprise · backend/app/schemas/analytics.py
  Pydantic v2 Analytics response schemas

  All schemas are response-only (GET endpoints).
  No request schemas needed — analytics are read-only aggregates.

  Schema hierarchy
  ─────────────────
  AnalyticsPointOut      → single time-series row
  AnalyticsKPICardOut    → single KPI card with value + change
  AnalyticsKPIsOut       → all 4 KPI cards (totalImpressions, ctr, convRate, cpc)
  MLModelOut             → single ML model card
  PlatformShareOut       → single platform pie slice
  AnalyticsOut           → combined top-level response (kpis + series + mlModels + platforms)

  TypeScript interface alignment
  ────────────────────────────────
  store/analyticsStore.ts:
      AnalyticsPoint { date, impressions, clicks, conversions }
      AnalyticsKPIs  { totalImpressions, impressionsChange,
                       ctr, ctrChange, conversionRate, conversionChange,
                       costPerClick, cpcChange }
      MLModel        { name, type(algorithm), acc(accuracy%), status, color }

  api/v1/analytics.py seed values (LumindAd.jsx lines 576–581):
      totalImpressions  531,200  +24.5%  #06b6d4
      ctr               7.32%   +12.3%  #a855f7
      conversionRate    4.18%    +8.7%  #10b981
      cpc               $1.24    -5.2%  #f59e0b

  api/v1/analytics.py ML models (LumindAd.jsx lines 630–635):
      Churn Predictor    XGBoost          87.3%  active   #7c3aed
      Anomaly Detector   Isolation Forest 94.1%  active   #06b6d4
      Click Predictor    Neural Network   82.7%  active   #10b981
      ROAS Optimizer     AutoML           91.2%  training #f59e0b

  ORM integration
  ────────────────
  from_attributes=True on all Out schemas.
  MLModelOut maps from api/v1/ml.py in-memory dicts (no ORM model for ML state).

  Author : Elizabeth Díaz Familia
           AI Data Scientist · Sustainable Intelligence & BI
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"""

from __future__ import annotations

from typing import List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field


# ── Shared literals ────────────────────────────────────────────────────────────

MLModelStatusLiteral = Literal["active", "training", "offline", "error", "idle"]


# ═══════════════════════════════════════════════════════════════
# TIME-SERIES POINT
# ═══════════════════════════════════════════════════════════════

class AnalyticsPointOut(BaseModel):
    """
    Single weekly performance snapshot.

    Mirrors store/analyticsStore.ts AnalyticsPoint:
        { date, impressions, clicks, conversions }

    Used by the PerformanceChart (LineChart) in AnalyticsPage.

    Seed (LumindAd.jsx lines 112–118):
        Jan 1  → impressions 11000 clicks  780 conversions  38
        Jan 8  → impressions 15200 clicks 1120 conversions  67
        Jan 15 → impressions 18700 clicks 1480 conversions  89
        Jan 22 → impressions 22100 clicks 1830 conversions 118
        Jan 29 → impressions 24800 clicks 2150 conversions 142
        Feb 5  → impressions 27300 clicks 2480 conversions 168
        Feb 12 → impressions 30100 clicks 2820 conversions 198
    """

    model_config = ConfigDict(from_attributes=True)

    date:        str = Field(description="Display date label e.g. 'Jan 1' or ISO '2025-01-01'")
    impressions: int = Field(ge=0)
    clicks:      int = Field(ge=0)
    conversions: int = Field(ge=0)


# ═══════════════════════════════════════════════════════════════
# KPI CARDS
# ═══════════════════════════════════════════════════════════════

class AnalyticsKPICardOut(BaseModel):
    """
    Single KPI card with value, period-over-period change, and display metadata.

    Extended from api/v1/analytics.py AnalyticsKPICard.
    Adds `trend` field so the frontend can render ↑ ↓ arrows.

    Seed values (LumindAd.jsx lines 576–581):
        key=totalImpressions  value=531200  formatted='531.2K'  change=+24.5  color='#06b6d4'
        key=ctr               value=7.32    formatted='7.32%'   change=+12.3  color='#a855f7'
        key=conversionRate    value=4.18    formatted='4.18%'   change= +8.7  color='#10b981'
        key=cpc               value=1.24    formatted='$1.24'   change= -5.2  color='#f59e0b'
    """

    model_config = ConfigDict(from_attributes=True)

    key:       str   = Field(description="Identifier: totalImpressions | ctr | conversionRate | cpc")
    label:     str   = Field(description="Human label e.g. 'Total Impressions'")
    value:     float = Field(description="Raw numeric value e.g. 531200 or 7.32")
    formatted: str   = Field(description="Display string e.g. '531.2K' or '7.32%' or '$1.24'")
    change:    float = Field(
        description="% change vs prior period: positive = improvement. "
                    "Negative change for cpc means cost reduction (good).",
    )
    color:     str   = Field(description="Brand hex colour for the KPI icon/bar")
    icon:      Optional[str] = Field(default=None, description="Emoji icon for the card")

    @property
    def trend(self) -> Literal["up", "down", "neutral"]:
        """
        Semantic trend direction — accounts for cost metrics where
        a negative change is actually an improvement.
        """
        if abs(self.change) < 0.01:
            return "neutral"
        return "up" if self.change > 0 else "down"

    @property
    def is_positive_trend(self) -> bool:
        """
        True when the trend is beneficial.
        For cpc, a negative change is positive (costs went down).
        """
        if self.key == "cpc":
            return self.change <= 0
        return self.change >= 0


class AnalyticsKPIsOut(BaseModel):
    """
    All 4 analytics KPI cards bundled in one response.

    GET /analytics/kpis → this schema.
    Used by AnalyticsPage KPI row (LumindAd.jsx lines 574–582).

    Mirrors store/analyticsStore.ts AnalyticsKPIs structure
    but uses strongly-typed sub-objects instead of raw numbers
    for richer client-side rendering.
    """

    model_config = ConfigDict(from_attributes=True)

    totalImpressions: AnalyticsKPICardOut = Field(
        description="Total ad impressions with change % — seed: 531,200 +24.5%",
    )
    ctr:              AnalyticsKPICardOut = Field(
        description="Click-through rate — seed: 7.32% +12.3%",
    )
    conversionRate:   AnalyticsKPICardOut = Field(
        description="Conversion rate — seed: 4.18% +8.7%",
    )
    cpc:              AnalyticsKPICardOut = Field(
        description="Cost per click USD — seed: $1.24 -5.2% (cost reduction = good)",
    )


# ═══════════════════════════════════════════════════════════════
# ML MODEL CARD
# ═══════════════════════════════════════════════════════════════

class MLModelOut(BaseModel):
    """
    ML model card — used by AnalyticsPage MLModelsPanel.

    Mirrors store/analyticsStore.ts MLModel:
        { name, type(algorithm), acc(accuracy%), status, color }
    Extended with `version` for model registry traceability.

    Seed (LumindAd.jsx lines 630–635):
        Churn Predictor    XGBoost          87.3%  active   #7c3aed  xgboost-v2.3.1
        Anomaly Detector   Isolation Forest 94.1%  active   #06b6d4  iforest-v1.4.0
        Click Predictor    Neural Network   82.7%  active   #10b981  mlp-v3.1.0
        ROAS Optimizer     AutoML           91.2%  training #f59e0b  automl-v1.8.2
    """

    model_config = ConfigDict(from_attributes=True)

    name:      str              = Field(description="Display name e.g. 'Churn Predictor'")
    algorithm: str              = Field(
        description="Algorithm label e.g. 'XGBoost'. "
                    "Stored as 'type' in analyticsStore.ts — renamed here for clarity.",
    )
    accuracy:  float            = Field(
        ge=0, le=100,
        description="Model accuracy in percent e.g. 87.3. "
                    "Displayed as '87.3%' in the UI (analyticsStore acc field).",
    )
    status:    MLModelStatusLiteral = Field(
        description="Lifecycle state: active | training | offline | error | idle",
    )
    color:     str              = Field(
        description="Brand hex colour for the model card accent e.g. '#7c3aed'",
    )
    version:   Optional[str]   = Field(
        default=None,
        description="Model version string e.g. 'xgboost-v2.3.1'",
    )

    @property
    def accuracy_display(self) -> str:
        """Formatted accuracy string: '87.3%'."""
        return f"{self.accuracy:.1f}%"


# ═══════════════════════════════════════════════════════════════
# PLATFORM SHARE
# ═══════════════════════════════════════════════════════════════

class PlatformShareOut(BaseModel):
    """
    Single platform slice for the PlatformSplit pie chart.

    GET /analytics/platforms → List[PlatformShareOut]

    Mirrors store/budgetStore.ts PlatformAllocation shape.
    Seed (LumindAd.jsx lines 95–101):
        Google Ads  38%  #4285f4
        Meta Ads    29%  #1877f2
        TikTok      18%  #ff0050
        LinkedIn    10%  #0077b5
        Twitter/X    5%  #1da1f2
    """

    model_config = ConfigDict(from_attributes=True)

    name:  str   = Field(description="Platform name: 'Google Ads' | 'Meta Ads' | …")
    value: float = Field(
        ge=0, le=100,
        description="Percentage share of total traffic (0–100)",
    )
    color: str   = Field(description="Hex colour for pie slice e.g. '#4285f4'")


# ═══════════════════════════════════════════════════════════════
# COMBINED ANALYTICS RESPONSE
# ═══════════════════════════════════════════════════════════════

class AnalyticsOut(BaseModel):
    """
    Top-level analytics response — GET /analytics returns this schema.

    Bundles everything AnalyticsPage needs in a single request:
        kpis       → 4 KPI cards
        series     → 7-point time-series
        mlModels   → 4 ML model cards
        platforms  → 5 platform share slices

    Used by analyticsStore.ts fetchAnalytics() → stores entire payload.
    """

    model_config = ConfigDict(from_attributes=True)

    kpis:      AnalyticsKPIsOut          = Field(description="4 KPI cards")
    series:    List[AnalyticsPointOut]   = Field(description="Weekly time-series (7 points)")
    mlModels:  List[MLModelOut]          = Field(description="4 ML model cards")
    platforms: List[PlatformShareOut]    = Field(description="5 platform share slices")
