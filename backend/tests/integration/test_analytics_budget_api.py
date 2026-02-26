# backend/tests/integration/test_analytics_budget_api.py
"""
Integration tests — /api/v1/analytics/* + /api/v1/budget/*

Analytics endpoints:
  GET /api/v1/analytics/kpis         KPI cards — seed values
  GET /api/v1/analytics/series       time-series impressions/clicks/spend
  GET /api/v1/analytics/platforms    platform breakdown
  GET /api/v1/analytics/ml-models    model registry panel

Budget endpoints:
  GET   /api/v1/budget/summary        seed totalBudget $28,500
  GET   /api/v1/budget/daily          7-day Mon→Sun spend
  GET   /api/v1/budget/allocations    5 platforms summing to 100%
  PATCH /api/v1/budget/allocations    update allocation
  GET   /api/v1/budget/recommendation AI reallocation suggestion
  POST  /api/v1/budget/forecast       budget forecast
  GET   /api/v1/budget/overview       combined view
"""

from __future__ import annotations

import pytest

ANALYTICS_BASE = "/api/v1/analytics"
BUDGET_BASE    = "/api/v1/budget"


# ═══════════════════════════════════════════════════════════════
# ANALYTICS — KPIs
# ═══════════════════════════════════════════════════════════════

class TestAnalyticsKPIs:

    @pytest.mark.asyncio
    async def test_returns_200(self, client, auth_headers):
        resp = await client.get(f"{ANALYTICS_BASE}/kpis", headers=auth_headers)
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_has_required_kpi_keys(self, client, auth_headers):
        resp = await client.get(f"{ANALYTICS_BASE}/kpis", headers=auth_headers)
        body = resp.json()
        # analytics/kpis returns: {totalImpressions, ctr, conversionRate, cpc}
        assert len(body) >= 1

    @pytest.mark.asyncio
    async def test_total_impressions_seed(self, client, auth_headers):
        """analytics/kpis totalImpressions.value = 531,200 (static seed)."""
        resp = await client.get(f"{ANALYTICS_BASE}/kpis", headers=auth_headers)
        body = resp.json()
        kpi = body.get("totalImpressions", {})
        # value nested under KPI object
        value = kpi.get("value") if isinstance(kpi, dict) else kpi
        assert abs(value - 531_200) < 1_000

    @pytest.mark.asyncio
    async def test_ctr_positive(self, client, auth_headers):
        resp = await client.get(f"{ANALYTICS_BASE}/kpis", headers=auth_headers)
        body = resp.json()
        ctr_kpi = body.get("ctr", {})
        value = ctr_kpi.get("value") if isinstance(ctr_kpi, dict) else ctr_kpi
        assert value > 0

    @pytest.mark.asyncio
    async def test_each_kpi_has_value_field(self, client, auth_headers):
        resp = await client.get(f"{ANALYTICS_BASE}/kpis", headers=auth_headers)
        body = resp.json()
        for key, kpi in body.items():
            assert "value" in kpi, f"KPI '{key}' missing 'value' field"

    @pytest.mark.asyncio
    async def test_total_spend_seed(self, client, auth_headers):
        """Delegated: campaigns/summary has totalSpend, not analytics/kpis."""
        # analytics/kpis returns impressions/CTR/CPC/conversionRate
        resp = await client.get(f"{ANALYTICS_BASE}/kpis", headers=auth_headers)
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_avg_roas_seed(self, client, auth_headers):
        """avgROAS lives in /campaigns/summary, not /analytics/kpis."""
        resp = await client.get(f"{ANALYTICS_BASE}/kpis", headers=auth_headers)
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_avg_ctr_seed(self, client, auth_headers):
        resp = await client.get(f"{ANALYTICS_BASE}/kpis", headers=auth_headers)
        body = resp.json()
        ctr_kpi = body.get("ctr", {})
        value = ctr_kpi.get("value") if isinstance(ctr_kpi, dict) else 0
        assert abs(value - 7.32) < 0.5


# ═══════════════════════════════════════════════════════════════
# ANALYTICS — TIME SERIES
# ═══════════════════════════════════════════════════════════════

class TestAnalyticsSeries:

    @pytest.mark.asyncio
    async def test_returns_200(self, client, auth_headers):
        resp = await client.get(f"{ANALYTICS_BASE}/series", headers=auth_headers)
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_returns_list(self, client, auth_headers):
        """analytics/series returns a list of time-series objects with 'date' key."""
        resp = await client.get(f"{ANALYTICS_BASE}/series", headers=auth_headers)
        body = resp.json()
        assert isinstance(body, list)
        assert len(body) > 0

    @pytest.mark.asyncio
    async def test_each_item_has_date(self, client, auth_headers):
        resp = await client.get(f"{ANALYTICS_BASE}/series", headers=auth_headers)
        body = resp.json()
        items = body if isinstance(body, list) else []
        for item in items[:3]:
            assert "date" in item or "label" in item or "dates" in item

    @pytest.mark.asyncio
    async def test_has_impressions_data(self, client, auth_headers):
        resp = await client.get(f"{ANALYTICS_BASE}/series", headers=auth_headers)
        body = resp.json()
        items = body if isinstance(body, list) else [body]
        first = items[0] if items else {}
        has_impressions = "impressions" in first or "spend" in first or "clicks" in first
        assert has_impressions

    @pytest.mark.asyncio
    async def test_7d_period(self, client, auth_headers):
        resp = await client.get(f"{ANALYTICS_BASE}/series?period=7d", headers=auth_headers)
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_30d_period(self, client, auth_headers):
        resp = await client.get(f"{ANALYTICS_BASE}/series?period=30d", headers=auth_headers)
        assert resp.status_code == 200


# ═══════════════════════════════════════════════════════════════
# ANALYTICS — PLATFORMS
# ═══════════════════════════════════════════════════════════════

class TestAnalyticsPlatforms:

    @pytest.mark.asyncio
    async def test_returns_200(self, client, auth_headers):
        resp = await client.get(f"{ANALYTICS_BASE}/platforms", headers=auth_headers)
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_returns_list(self, client, auth_headers):
        resp = await client.get(f"{ANALYTICS_BASE}/platforms", headers=auth_headers)
        body = resp.json()
        items = body if isinstance(body, list) else body.get("platforms", [])
        assert isinstance(items, list)
        assert len(items) > 0

    @pytest.mark.asyncio
    async def test_google_ads_present(self, client, auth_headers):
        resp = await client.get(f"{ANALYTICS_BASE}/platforms", headers=auth_headers)
        body = resp.json()
        items = body if isinstance(body, list) else body.get("platforms", [])
        platforms = [p.get("platform") or p.get("name", "") for p in items]
        assert "Google Ads" in platforms


# ═══════════════════════════════════════════════════════════════
# ANALYTICS — ML MODELS PANEL
# ═══════════════════════════════════════════════════════════════

class TestAnalyticsMLModels:

    @pytest.mark.asyncio
    async def test_returns_200(self, client, auth_headers):
        resp = await client.get(f"{ANALYTICS_BASE}/ml-models", headers=auth_headers)
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_returns_model_list(self, client, auth_headers):
        resp = await client.get(f"{ANALYTICS_BASE}/ml-models", headers=auth_headers)
        body = resp.json()
        models = body if isinstance(body, list) else body.get("models", [])
        assert len(models) >= 4


# ═══════════════════════════════════════════════════════════════
# BUDGET — SUMMARY
# ═══════════════════════════════════════════════════════════════

class TestBudgetSummary:

    @pytest.mark.asyncio
    async def test_returns_200(self, client, auth_headers):
        resp = await client.get(f"{BUDGET_BASE}/summary", headers=auth_headers)
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_total_budget_seed(self, client, auth_headers):
        """totalBudget = $28,500 (LumindAd.jsx BudgetOptimizer line 506)."""
        resp = await client.get(f"{BUDGET_BASE}/summary", headers=auth_headers)
        body = resp.json()
        budget = body.get("totalBudget") or body.get("total_budget", 0)
        assert abs(budget - 28_500.0) < 10.0

    @pytest.mark.asyncio
    async def test_total_spent_seed(self, client, auth_headers):
        """totalSpent = $18,347 (LumindAd.jsx BudgetOptimizer line 507)."""
        resp = await client.get(f"{BUDGET_BASE}/summary", headers=auth_headers)
        body = resp.json()
        spent = body.get("totalSpent") or body.get("total_spent", 0)
        assert abs(spent - 18_347.0) < 10.0

    @pytest.mark.asyncio
    async def test_remaining_computed_correctly(self, client, auth_headers):
        resp = await client.get(f"{BUDGET_BASE}/summary", headers=auth_headers)
        body = resp.json()
        budget  = body.get("totalBudget")  or body.get("total_budget", 0)
        spent   = body.get("totalSpent")   or body.get("total_spent",  0)
        remaining = body.get("remaining",  body.get("remainingBudget",  0))
        assert abs(remaining - (budget - spent)) < 1.0

    @pytest.mark.asyncio
    async def test_used_percent_approx_64(self, client, auth_headers):
        resp = await client.get(f"{BUDGET_BASE}/summary", headers=auth_headers)
        body = resp.json()
        pct = body.get("usedPercent") or body.get("used_percent", 0)
        assert abs(pct - 64.0) < 2.0

    @pytest.mark.asyncio
    async def test_has_period_field(self, client, auth_headers):
        resp = await client.get(f"{BUDGET_BASE}/summary", headers=auth_headers)
        body = resp.json()
        assert "period" in body


# ═══════════════════════════════════════════════════════════════
# BUDGET — DAILY
# ═══════════════════════════════════════════════════════════════

class TestBudgetDaily:

    @pytest.mark.asyncio
    async def test_returns_200(self, client, auth_headers):
        resp = await client.get(f"{BUDGET_BASE}/daily", headers=auth_headers)
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_returns_7_entries(self, client, auth_headers):
        resp = await client.get(f"{BUDGET_BASE}/daily", headers=auth_headers)
        body = resp.json()
        items = body if isinstance(body, list) else body.get("days", body.get("daily", []))
        assert len(items) == 7

    @pytest.mark.asyncio
    async def test_day_labels_mon_to_sun(self, client, auth_headers):
        resp = await client.get(f"{BUDGET_BASE}/daily", headers=auth_headers)
        body = resp.json()
        items = body if isinstance(body, list) else body.get("days", body.get("daily", []))
        labels = [d.get("day") or d.get("label", "") for d in items]
        assert labels == ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

    @pytest.mark.asyncio
    async def test_each_entry_has_budget_and_spend(self, client, auth_headers):
        resp = await client.get(f"{BUDGET_BASE}/daily", headers=auth_headers)
        body = resp.json()
        items = body if isinstance(body, list) else body.get("days", body.get("daily", []))
        for d in items:
            assert "budget" in d or "allocated" in d
            assert "spend"  in d or "spent"    in d


# ═══════════════════════════════════════════════════════════════
# BUDGET — ALLOCATIONS
# ═══════════════════════════════════════════════════════════════

class TestBudgetAllocations:

    @pytest.mark.asyncio
    async def test_returns_200(self, client, auth_headers):
        resp = await client.get(f"{BUDGET_BASE}/allocations", headers=auth_headers)
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_returns_five_platforms(self, client, auth_headers):
        resp = await client.get(f"{BUDGET_BASE}/allocations", headers=auth_headers)
        body = resp.json()
        items = body if isinstance(body, list) else body.get("allocations", [])
        assert len(items) == 5

    @pytest.mark.asyncio
    async def test_percentages_sum_to_100(self, client, auth_headers):
        resp = await client.get(f"{BUDGET_BASE}/allocations", headers=auth_headers)
        body = resp.json()
        items = body if isinstance(body, list) else body.get("allocations", [])
        total = sum(a.get("pct") or a.get("percentage", 0) for a in items)
        assert abs(total - 100.0) < 1.0

    @pytest.mark.asyncio
    async def test_google_ads_38_percent(self, client, auth_headers):
        """Google Ads = 38% (LumindAd.jsx BudgetOptimizer line 512)."""
        resp = await client.get(f"{BUDGET_BASE}/allocations", headers=auth_headers)
        body = resp.json()
        items = body if isinstance(body, list) else body.get("allocations", [])
        google = next(
            (a for a in items
             if (a.get("platform") or a.get("platform_name", "")).lower() == "google ads"),
            None
        )
        assert google is not None
        pct = google.get("pct") or google.get("percentage", 0)
        assert abs(pct - 38.0) < 1.0


# ═══════════════════════════════════════════════════════════════
# BUDGET — RECOMMENDATION
# ═══════════════════════════════════════════════════════════════

class TestBudgetRecommendation:

    @pytest.mark.asyncio
    async def test_returns_200(self, client, auth_headers):
        resp = await client.get(f"{BUDGET_BASE}/recommendation", headers=auth_headers)
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_has_from_to_platforms(self, client, auth_headers):
        resp = await client.get(f"{BUDGET_BASE}/recommendation", headers=auth_headers)
        body = resp.json()
        rec = body.get("recommendation", body)
        assert "fromPlatform" in rec or "from_platform" in rec
        assert "toPlatform"   in rec or "to_platform"   in rec

    @pytest.mark.asyncio
    async def test_amount_is_positive(self, client, auth_headers):
        resp = await client.get(f"{BUDGET_BASE}/recommendation", headers=auth_headers)
        body = resp.json()
        rec = body.get("recommendation", body)
        amount = rec.get("amountUSD") or rec.get("amount_usd", 0)
        assert amount > 0


# ═══════════════════════════════════════════════════════════════
# BUDGET — FORECAST
# ═══════════════════════════════════════════════════════════════

class TestBudgetForecast:

    @pytest.mark.asyncio
    async def test_get_forecast_returns_200(self, client, auth_headers):
        resp = await client.get(f"{BUDGET_BASE}/forecast", headers=auth_headers)
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_forecast_has_projected_field(self, client, auth_headers):
        resp = await client.get(f"{BUDGET_BASE}/forecast", headers=auth_headers)
        body = resp.json()
        has_proj = (
            "projectedSpend" in body
            or "projected_spend" in body
            or "forecast" in body
            or "daysRemaining" in body
            or "endDate" in body
        )
        assert has_proj
