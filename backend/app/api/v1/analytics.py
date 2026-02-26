# backend/app/api/v1/analytics.py
"""
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  LumindAd Enterprise · api/v1/analytics.py
  Performance analytics endpoints

  Endpoints
  ──────────
  GET /api/v1/analytics           → AnalyticsResponse (KPIs + series)
  GET /api/v1/analytics/kpis      → AnalyticsKPIs
  GET /api/v1/analytics/series    → AnalyticsPoint[] (time-series)
  GET /api/v1/analytics/platforms → PlatformShare[]
  GET /api/v1/analytics/ml-models → MLModel[]

  Seed data (LumindAd.jsx)
  ──────────────────────────
  KPI cards (lines 576–581):
    Total Impressions  531,200  +24.5%  #06b6d4
    Click-Through Rate   7.32%  +12.3%  #a855f7
    Conversion Rate      4.18%   +8.7%  #10b981
    Cost Per Click       $1.24   -5.2%  #f59e0b

  Time-series (lines 112–118):
    7 weekly snapshots Jan 1 → Feb 12
    { date, impressions, clicks, conversions }

  ML Models panel (lines 630–635):
    Churn Predictor    XGBoost          87.3%  active
    Anomaly Detector   Isolation Forest 94.1%  active
    Click Predictor    Neural Network   82.7%  active
    ROAS Optimizer     AutoML           91.2%  training

  Author : Elizabeth Díaz Familia
           AI Data Scientist · Sustainable Intelligence & BI
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"""

from __future__ import annotations

from typing import List, Literal, Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field

from app.dependencies import AuthUser, get_current_user

router = APIRouter()

# ═══════════════════════════════════════════════════════════════
# SCHEMAS — mirror store/analyticsStore.ts + services/mlService.ts
# ═══════════════════════════════════════════════════════════════

class AnalyticsPoint(BaseModel):
    """
    Single time-series data point.
    Mirrors store/analyticsStore.ts AnalyticsPoint.
    LumindAd.jsx analyticsData (lines 112–118).
    """
    date:        str
    impressions: int
    clicks:      int
    conversions: int


class AnalyticsKPICard(BaseModel):
    """Single KPI card with value, change, and display metadata."""
    key:       str
    label:     str
    value:     float
    formatted: str    = Field(..., description="Display string e.g. '531.2K' or '7.32%'")
    change:    float  = Field(..., description="% change vs prior period")
    color:     str
    icon:      str


class AnalyticsKPIs(BaseModel):
    """
    Analytics page KPI row.
    LumindAd.jsx lines 576–581 — 4 metrics.
    """
    totalImpressions: AnalyticsKPICard
    ctr:              AnalyticsKPICard
    conversionRate:   AnalyticsKPICard
    cpc:              AnalyticsKPICard


class PlatformShare(BaseModel):
    """
    Platform traffic share.
    LumindAd.jsx platformData lines 95–101.
    """
    name:  str
    value: float    = Field(..., description="Percentage share 0–100")
    color: str


class MLModel(BaseModel):
    """
    ML model card data.
    Mirrors store/analyticsStore.ts MLModel.
    LumindAd.jsx lines 630–635.
    """
    name:      str
    algorithm: str
    accuracy:  float   = Field(..., ge=0, le=100, description="Accuracy % e.g. 87.3")
    status:    Literal["active", "training", "offline"]
    color:     str


class AnalyticsResponse(BaseModel):
    """Full analytics page response — combines KPIs + series + ML models."""
    kpis:      AnalyticsKPIs
    series:    List[AnalyticsPoint]
    mlModels:  List[MLModel]
    platforms: List[PlatformShare]


# ═══════════════════════════════════════════════════════════════
# SEED DATA — exact values from LumindAd.jsx
# ═══════════════════════════════════════════════════════════════

# KPIs (LumindAd.jsx lines 576–581)
_KPI_SEED = AnalyticsKPIs(
    totalImpressions=AnalyticsKPICard(
        key="totalImpressions", label="Total Impressions",
        value=531200, formatted="531.2K",
        change=24.5, color="#06b6d4", icon="👁",
    ),
    ctr=AnalyticsKPICard(
        key="ctr", label="Click-Through Rate",
        value=7.32, formatted="7.32%",
        change=12.3, color="#a855f7", icon="🎯",
    ),
    conversionRate=AnalyticsKPICard(
        key="conversionRate", label="Conversion Rate",
        value=4.18, formatted="4.18%",
        change=8.7, color="#10b981", icon="✅",
    ),
    cpc=AnalyticsKPICard(
        key="cpc", label="Cost Per Click",
        value=1.24, formatted="$1.24",
        change=-5.2, color="#f59e0b", icon="💲",
    ),
)

# Time-series (LumindAd.jsx lines 112–118)
_SERIES_SEED: List[AnalyticsPoint] = [
    AnalyticsPoint(date="Jan 1",  impressions=11000, clicks=780,  conversions=38),
    AnalyticsPoint(date="Jan 8",  impressions=15200, clicks=1120, conversions=67),
    AnalyticsPoint(date="Jan 15", impressions=18700, clicks=1480, conversions=89),
    AnalyticsPoint(date="Jan 22", impressions=22100, clicks=1830, conversions=118),
    AnalyticsPoint(date="Jan 29", impressions=24800, clicks=2150, conversions=142),
    AnalyticsPoint(date="Feb 5",  impressions=27300, clicks=2480, conversions=168),
    AnalyticsPoint(date="Feb 12", impressions=30100, clicks=2820, conversions=198),
]

# ML Models (LumindAd.jsx lines 630–635)
_ML_MODELS_SEED: List[MLModel] = [
    MLModel(name="Churn Predictor",   algorithm="XGBoost",          accuracy=87.3, status="active",   color="#7c3aed"),
    MLModel(name="Anomaly Detector",  algorithm="Isolation Forest",  accuracy=94.1, status="active",   color="#06b6d4"),
    MLModel(name="Click Predictor",   algorithm="Neural Network",    accuracy=82.7, status="active",   color="#10b981"),
    MLModel(name="ROAS Optimizer",    algorithm="AutoML",            accuracy=91.2, status="training", color="#f59e0b"),
]

# Platforms (LumindAd.jsx lines 95–101)
_PLATFORMS_SEED: List[PlatformShare] = [
    PlatformShare(name="Google Ads", value=38, color="#4285f4"),
    PlatformShare(name="Meta Ads",   value=29, color="#1877f2"),
    PlatformShare(name="TikTok",     value=18, color="#ff0050"),
    PlatformShare(name="LinkedIn",   value=10, color="#0077b5"),
    PlatformShare(name="Twitter/X",  value=5,  color="#1da1f2"),
]


def _filter_series_by_platform(
    series: List[AnalyticsPoint],
    platform: Optional[str],
) -> List[AnalyticsPoint]:
    """
    Platform filtering for time-series.
    In the prototype all platforms share the same data.
    Production: query campaign_metrics WHERE platform = ?
    """
    if not platform or platform == "All Platforms":
        return series
    # Simulate platform-specific scaling factors
    _scale = {
        "Google Ads": 0.38,
        "Meta Ads":   0.29,
        "TikTok":     0.18,
        "LinkedIn":   0.10,
        "Twitter/X":  0.05,
    }
    scale = _scale.get(platform, 1.0)
    return [
        AnalyticsPoint(
            date        = p.date,
            impressions = int(p.impressions * scale),
            clicks      = int(p.clicks * scale),
            conversions = int(p.conversions * scale),
        )
        for p in series
    ]


# ═══════════════════════════════════════════════════════════════
# ENDPOINTS
# ═══════════════════════════════════════════════════════════════

@router.get(
    "",
    response_model=AnalyticsResponse,
    summary="Full analytics response (KPIs + series + ML models)",
)
async def get_analytics(
    platform:     Optional[str] = Query(None, description="Filter: 'Google Ads' | 'Meta Ads' | 'TikTok' | 'LinkedIn' | 'Twitter/X' | 'All Platforms'"),
    date_from:    Optional[str] = Query(None, description="ISO date filter start"),
    date_to:      Optional[str] = Query(None, description="ISO date filter end"),
    current_user: AuthUser      = Depends(get_current_user),
) -> AnalyticsResponse:
    """
    Combined analytics endpoint — returns everything AnalyticsPage needs
    in a single request.

    Platform filter: passes through to time-series data only.
    ML models are unaffected by the platform filter.

    LumindAd.jsx AnalyticsPage subtitle: "SHAP · Anomaly Detection"
    """
    filtered_series = _filter_series_by_platform(_SERIES_SEED, platform)

    return AnalyticsResponse(
        kpis      = _KPI_SEED,
        series    = filtered_series,
        mlModels  = _ML_MODELS_SEED,
        platforms = _PLATFORMS_SEED,
    )


@router.get(
    "/kpis",
    response_model=AnalyticsKPIs,
    summary="Analytics KPI cards only",
)
async def get_kpis(
    current_user: AuthUser = Depends(get_current_user),
) -> AnalyticsKPIs:
    """
    Return the 4 Analytics KPI cards.
    Values from LumindAd.jsx lines 576–581.
    """
    return _KPI_SEED


@router.get(
    "/series",
    response_model=List[AnalyticsPoint],
    summary="Time-series performance data",
)
async def get_series(
    platform:     Optional[str] = Query(None),
    date_from:    Optional[str] = Query(None),
    date_to:      Optional[str] = Query(None),
    current_user: AuthUser      = Depends(get_current_user),
) -> List[AnalyticsPoint]:
    """
    Weekly impression/click/conversion time series.
    Filtered by platform when provided.
    """
    return _filter_series_by_platform(_SERIES_SEED, platform)


@router.get(
    "/platforms",
    response_model=List[PlatformShare],
    summary="Platform traffic share breakdown",
)
async def get_platforms(
    current_user: AuthUser = Depends(get_current_user),
) -> List[PlatformShare]:
    """
    Platform percentage split used by PlatformSplit pie chart.
    LumindAd.jsx platformData lines 95–101.
    """
    return _PLATFORMS_SEED


@router.get(
    "/ml-models",
    response_model=List[MLModel],
    summary="ML models panel data",
)
async def get_ml_models(
    current_user: AuthUser = Depends(get_current_user),
) -> List[MLModel]:
    """
    4 ML model cards shown in AnalyticsPage.
    LumindAd.jsx lines 630–635.
    """
    return _ML_MODELS_SEED
