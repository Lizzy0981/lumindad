# backend/tests/conftest.py
"""
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  LumindAd Enterprise · backend/tests/conftest.py
  Shared pytest fixtures — unit + integration

  Fixtures
  ─────────
  app               FastAPI app with overridden dependencies
  client            httpx.AsyncClient against the test app
  admin_user        AuthUser(role='admin')  Elizabeth D.F.
  analyst_user      AuthUser(role='analyst')
  admin_token       valid JWT for admin_user
  analyst_token     valid JWT for analyst_user
  auth_headers      {"Authorization": "Bearer <admin_token>"}

  mock_db           MagicMock replacing AsyncSession
  mock_campaign_svc MagicMock replacing CampaignService
  mock_budget_svc   MagicMock replacing BudgetService
  mock_ml_svc       MagicMock replacing MLService

  Seed constants (exact LumindAd.jsx values)
  ────────────────────────────────────────────
  SEED_CAMPAIGNS    List[dict] — C-001 through C-006
  SEED_KPIS         Dashboard KPI dict
  SEED_BUDGET       Budget summary dict
  SEED_CUSTOMER     Telecom X customer dict

  Settings
  ─────────
  Tests run against SQLite in-memory  (DATABASE_URL=None →
  effective_database_url() returns SQLITE_URL).
  Redis disabled: all cache ops are no-ops.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"""

from __future__ import annotations

import sys
import os
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch
from typing import AsyncGenerator

import pytest
import pytest_asyncio

# Ensure backend/ is on path
sys.path.insert(0, str(Path(__file__).parent.parent))

# ── CRITICAL: patch password hashes at import time ───────────────────────────
# Both app/api/v1/auth.py._USERS_DB and app/dependencies.py._USERS contain
# bcrypt hashes that don't match "lumindad2025" with the current bcrypt library.
# We must patch them before ANY session-scoped fixture is instantiated.
def _patch_password_hashes_at_import() -> None:
    try:
        from app.core.security import hash_password
        import app.dependencies as _deps
        import app.api.v1.auth as _auth

        _valid = hash_password("lumindad2025")
        for _u in _deps._USERS.values():
            _u["password_hash"] = _valid
        for _u in _auth._USERS_DB.values():
            _u["password_hash"] = _valid
    except Exception:
        pass  # silently skip if imports fail (e.g. during collection without deps)

_patch_password_hashes_at_import()
# ─────────────────────────────────────────────────────────────────────────────

# ── Silence TF noise before any import triggers it ───────────────────────────
os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "3")
os.environ.setdefault("PYTHONDONTWRITEBYTECODE", "1")

# ── Override DB + Redis to avoid requiring live services in tests ─────────────
os.environ["DATABASE_URL"]       = ""   # force SQLite
os.environ["REDIS_URL"]          = "redis://localhost:6379"


# ═══════════════════════════════════════════════════════════════
# SEED CONSTANTS  (exact values from LumindAd.jsx)
# ═══════════════════════════════════════════════════════════════

SEED_CAMPAIGNS = [
    {"id":"C-001","name":"Summer Sale 2025",    "platform":"Google Ads","status":"active",    "budget":5000,  "spent":3240,  "impressions":124500,"clicks":8920, "ctr":"7.16%","conv":342,"roas":3.8},
    {"id":"C-002","name":"Brand Awareness Q1",  "platform":"Meta Ads",  "status":"active",    "budget":8000,  "spent":5180,  "impressions":287000,"clicks":12400,"ctr":"4.32%","conv":520,"roas":2.9},
    {"id":"C-003","name":"Product Launch Beta", "platform":"TikTok",    "status":"paused",    "budget":3500,  "spent":1890,  "impressions":98200, "clicks":5430, "ctr":"5.53%","conv":187,"roas":4.2},
    {"id":"C-004","name":"Retargeting Dec",     "platform":"Google Ads","status":"active",    "budget":2000,  "spent":1740,  "impressions":43100, "clicks":3280, "ctr":"7.61%","conv":245,"roas":5.1},
    {"id":"C-005","name":"LinkedIn B2B Push",   "platform":"LinkedIn",  "status":"draft",     "budget":6000,  "spent":0,     "impressions":0,     "clicks":0,    "ctr":"—",    "conv":0,  "roas":0.0},
    {"id":"C-006","name":"Holiday Promos",      "platform":"Meta Ads",  "status":"completed", "budget":4200,  "spent":4198,  "impressions":178000,"clicks":9870, "ctr":"5.54%","conv":430,"roas":3.5},
]

SEED_KPIS = {
    "totalSpend":        48_290.0,
    "totalImpressions":  531_200,
    "totalClicks":        38_940,
    "totalConversions":    2_847,
    "totalBudget":        28_700.0,
    "activeCampaigns":         4,
    "avgROAS":             3.875,
    "avgCTR":              6.65,
}

SEED_BUDGET = {
    "totalBudget":  28_500.0,
    "totalSpent":   18_347.0,
    "remaining":    10_153.0,
    "usedPercent":  64.0,
    "period":       "November 2025",
}

SEED_CUSTOMER = {
    "customerId":       "CUST-TEST-001",
    "tenure":           12,
    "monthlyCharges":   85.50,
    "totalCharges":     1026.0,
    "contract":         "Month-to-month",
    "internetService":  "Fiber optic",
    "onlineSecurity":   False,
    "techSupport":      False,
    "numSupportCalls":  3,
    "paymentMethod":    "Electronic check",
}


# ═══════════════════════════════════════════════════════════════
# AUTH USER FIXTURES
# ═══════════════════════════════════════════════════════════════

@pytest.fixture(scope="session", autouse=True)
def patch_seed_password_hashes():
    """
    Patch ALL in-memory user stores with a valid bcrypt hash for 'lumindad2025'.

    Two separate dicts hold user data:
      - app.dependencies._USERS          (shared dependency store)
      - app.api.v1.auth._USERS_DB        (auth-router-local store)

    The hash baked in at import time was generated with a different bcrypt
    implementation and does not verify correctly with the current library.
    This fixture regenerates it at test startup so login integration tests pass.
    """
    from app.core.security import hash_password
    import app.dependencies as deps
    import app.api.v1.auth as auth_module

    valid_hash = hash_password("lumindad2025")

    for user in deps._USERS.values():
        user["password_hash"] = valid_hash

    for user in auth_module._USERS_DB.values():
        user["password_hash"] = valid_hash

    yield
    # No teardown needed — session-scoped, process ends afterward


@pytest.fixture(scope="session")
def admin_user():
    """AuthUser with admin role — mirrors seed user Elizabeth D.F."""
    from app.dependencies import AuthUser
    return AuthUser(
        id="usr_001",
        email="elizabeth@lumindad.ai",
        name="Elizabeth Díaz Familia",
        role="admin",
        is_active=True,
    )


@pytest.fixture(scope="session")
def analyst_user():
    """AuthUser with analyst role."""
    from app.dependencies import AuthUser
    return AuthUser(
        id="usr_002",
        email="demo@lumindad.ai",
        name="Demo Analyst",
        role="analyst",
        is_active=True,
    )


@pytest.fixture(scope="session")
def admin_token(admin_user) -> str:
    """Valid JWT access token for admin_user."""
    from app.core.security import create_access_token
    return create_access_token(admin_user.id)


@pytest.fixture(scope="session")
def analyst_token(analyst_user) -> str:
    """Valid JWT access token for analyst_user."""
    from app.core.security import create_access_token
    return create_access_token(analyst_user.id)


@pytest.fixture(scope="session")
def auth_headers(admin_token: str) -> dict:
    """Authorization headers for admin user — used with httpx client."""
    return {"Authorization": f"Bearer {admin_token}"}


# ═══════════════════════════════════════════════════════════════
# FASTAPI TEST APP
# ═══════════════════════════════════════════════════════════════

@pytest.fixture(scope="session")
def app(admin_user):
    """
    FastAPI app with dependency overrides for testing.

    Overrides:
      get_current_user → returns admin_user (no JWT validation)
      get_db           → returns an AsyncMock (no DB connection)

    Also patches the auth router's _USERS_DB with a valid bcrypt hash
    so integration login tests pass regardless of the stored hash version.
    """
    from app.main import app as _app
    from app.dependencies import get_current_user, get_db
    import app.api.v1.auth as auth_module
    from app.core.security import hash_password

    # Patch _USERS_DB BEFORE the client starts making requests
    valid_hash = hash_password("lumindad2025")
    for user in auth_module._USERS_DB.values():
        user["password_hash"] = valid_hash

    async def _override_current_user():
        return admin_user

    async def _override_get_db():
        yield AsyncMock()

    _app.dependency_overrides[get_current_user] = _override_current_user
    _app.dependency_overrides[get_db]           = _override_get_db
    yield _app
    _app.dependency_overrides.clear()


@pytest_asyncio.fixture(scope="session")
async def client(app) -> AsyncGenerator:
    """httpx.AsyncClient wired to the test FastAPI app."""
    import httpx
    from httpx import ASGITransport

    async with httpx.AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://testserver",
    ) as c:
        yield c


# ═══════════════════════════════════════════════════════════════
# SERVICE MOCKS
# ═══════════════════════════════════════════════════════════════

@pytest.fixture
def mock_db():
    """Async-safe SQLAlchemy session mock."""
    db = AsyncMock()
    db.get = AsyncMock(return_value=None)
    db.execute = AsyncMock()
    db.add = MagicMock()
    db.commit = AsyncMock()
    db.rollback = AsyncMock()
    db.refresh = AsyncMock()
    return db


@pytest.fixture
def mock_campaign_svc():
    """CampaignService mock pre-loaded with seed data."""
    svc = AsyncMock()
    svc.list_campaigns.return_value = (SEED_CAMPAIGNS, len(SEED_CAMPAIGNS))
    svc.get_campaign.return_value   = SEED_CAMPAIGNS[0]
    svc.get_kpis.return_value       = SEED_KPIS
    svc.get_performance.return_value = {
        "campaignId": "C-001",
        "period": "7d",
        "dates": ["2025-11-11","2025-11-12","2025-11-13","2025-11-14","2025-11-15","2025-11-16","2025-11-17"],
        "impressions": [17200,18500,16800,19200,21000,18700,13100],
        "clicks": [1180,1340,1220,1480,1620,1420,960],
        "conversions": [45,52,48,58,63,55,38],
        "spend": [425.0,490.0,445.0,540.0,590.0,515.0,350.0],
    }
    svc.create_campaign.return_value = SEED_CAMPAIGNS[0]
    svc.update_campaign.return_value = SEED_CAMPAIGNS[0]
    svc.delete_campaign.return_value = True
    return svc


@pytest.fixture
def mock_budget_svc():
    """BudgetService mock pre-loaded with seed data."""
    svc = AsyncMock()
    svc.get_summary.return_value = SEED_BUDGET
    svc.get_daily.return_value = [
        {"day": "Mon", "budget": 1500.0, "spend": 1240.0},
        {"day": "Tue", "budget": 1500.0, "spend": 1820.0},
        {"day": "Wed", "budget": 1500.0, "spend": 1470.0},
        {"day": "Thu", "budget": 1500.0, "spend": 2250.0},
        {"day": "Fri", "budget": 1500.0, "spend": 2480.0},
        {"day": "Sat", "budget": 1500.0, "spend": 1840.0},
        {"day": "Sun", "budget": 1500.0, "spend": 1350.0},
    ]
    svc.get_allocations.return_value = [
        {"platform":"Google Ads","pct":38.0,"color":"#4285f4","amountUSD":6971.86},
        {"platform":"Meta Ads",  "pct":29.0,"color":"#1877f2","amountUSD":5320.63},
        {"platform":"TikTok",    "pct":18.0,"color":"#ff0050","amountUSD":3302.46},
        {"platform":"LinkedIn",  "pct":10.0,"color":"#0077b5","amountUSD":1834.70},
        {"platform":"Twitter/X", "pct": 5.0,"color":"#1da1f2","amountUSD": 917.35},
    ]
    svc.get_recommendation.return_value = {
        "fromPlatform": "Meta Ads", "toPlatform": "Google Ads",
        "amountUSD": 1200.0, "roasGainPct": 23.0,
        "modelVersion": "xgboost-v2.3.1", "applied": False,
    }
    return svc


@pytest.fixture
def mock_ml_svc():
    """MLService mock returning realistic prediction responses."""
    svc = MagicMock()
    svc.predict_churn.return_value = {
        "customerId":       "CUST-TEST-001",
        "churnProbability": 0.742,
        "riskLevel":        "high",
        "daysToChurn":      23,
        "predictionId":     "pred_abc123",
        "modelVersion":     "xgboost-v2.3.1",
        "confidence":       0.873,
        "co2Grams":         0.00000112,
    }
    svc.detect_anomalies.return_value = [{
        "metric":       "spend",
        "isAnomaly":    True,
        "score":        0.82,
        "severity":     "high",
        "anomalyIdx":   [4],
        "detectedAt":   "2025-11-18T12:00:00Z",
        "co2Grams":     0.00000098,
    }]
    svc.list_models.return_value = [
        {"name":"Churn Predictor", "algorithm":"XGBoost",         "accuracy":87.3,"status":"active","version":"xgboost-v2.3.1"},
        {"name":"Anomaly Detector","algorithm":"Isolation Forest", "accuracy":94.1,"status":"active","version":"iforest-v1.4.0"},
        {"name":"Click Predictor", "algorithm":"Neural Network",   "accuracy":82.7,"status":"active","version":"mlp-v3.1.0"},
        {"name":"ROAS Optimizer",  "algorithm":"AutoML",           "accuracy":91.2,"status":"training","version":"automl-v1.8.2"},
    ]
    return svc
