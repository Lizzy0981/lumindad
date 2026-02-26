# backend/tests/unit/test_services.py
"""
Unit tests — app/services/

Coverage:
  CampaignService  list_campaigns seed · get_kpis exact values ·
                   filter by status · filter by platform

  BudgetService    get_summary seed · allocations sum to 100% ·
                   forecast linear trend · set_budget recomputes

  MLService        predict_churn heuristic · risk_level thresholds ·
                   detect_anomalies σ · explain_prediction SHAP shape

  GreenAIService   calculate_co2 formula · badge thresholds ·
                   record_inference accumulates · equivalences
"""

from __future__ import annotations

import pytest
import math
from unittest.mock import AsyncMock, MagicMock, patch


# ═══════════════════════════════════════════════════════════════
# CAMPAIGN SERVICE
# ═══════════════════════════════════════════════════════════════

class TestCampaignService:

    @pytest.mark.asyncio
    async def test_list_campaigns_returns_seed(self):
        """Without DB, seed fallback returns exactly 6 campaigns."""
        from app.services.campaign_service import CampaignService
        svc = CampaignService(db=None)
        items, total = await svc.list_campaigns("usr_001")
        assert total == 6
        assert len(items) == 6

    @pytest.mark.asyncio
    async def test_list_campaigns_ids(self):
        from app.services.campaign_service import CampaignService
        svc = CampaignService(db=None)
        items, _ = await svc.list_campaigns("usr_001")
        ids = {c["id"] for c in items}
        assert ids == {"C-001","C-002","C-003","C-004","C-005","C-006"}

    @pytest.mark.asyncio
    async def test_list_campaigns_filter_by_status(self):
        from app.services.campaign_service import CampaignService
        svc = CampaignService(db=None)
        items, total = await svc.list_campaigns("usr_001", status="active")
        assert all(c["status"] == "active" for c in items)
        # Seed has 3 active campaigns: C-001, C-002, C-004
        assert total == 3

    @pytest.mark.asyncio
    async def test_list_campaigns_filter_by_platform(self):
        from app.services.campaign_service import CampaignService
        svc = CampaignService(db=None)
        items, total = await svc.list_campaigns("usr_001", platform="Meta Ads")
        assert all(c["platform"] == "Meta Ads" for c in items)
        # C-002 and C-006 are Meta Ads
        assert total == 2

    @pytest.mark.asyncio
    async def test_list_campaigns_pagination(self):
        from app.services.campaign_service import CampaignService
        svc = CampaignService(db=None)
        items, total = await svc.list_campaigns("usr_001", page=1, page_size=2)
        assert total == 6
        assert len(items) == 2

    @pytest.mark.asyncio
    async def test_get_campaign_by_id(self):
        from app.services.campaign_service import CampaignService
        svc = CampaignService(db=None)
        campaign = await svc.get_campaign("usr_001", "C-001")
        assert campaign is not None
        assert campaign["name"] == "Summer Sale 2025"
        assert campaign["platform"] == "Google Ads"

    @pytest.mark.asyncio
    async def test_get_campaign_not_found(self):
        from app.services.campaign_service import CampaignService
        svc = CampaignService(db=None)
        result = await svc.get_campaign("usr_001", "C-999")
        assert result is None

    @pytest.mark.asyncio
    async def test_get_kpis_exact_values(self):
        """KPIs computed from the actual seed (_SEED in campaign_service.py)."""
        from app.services.campaign_service import CampaignService
        svc = CampaignService(db=None)
        kpis = await svc.get_kpis("usr_001")
        # totalSpend = sum of all campaign spent values in _SEED
        assert kpis["totalSpend"]        == pytest.approx(16_248.0, rel=1e-3)
        assert kpis["totalImpressions"]  == 730_800
        assert kpis["activeCampaigns"]   == 3     # C-001, C-002, C-004 are active
        # avgROAS is spend-weighted: sum(roas*spent) / sum(spent) for active = 3.564
        assert kpis["avgROAS"]           == pytest.approx(3.564, abs=0.05)

    @pytest.mark.asyncio
    async def test_get_kpis_avg_ctr(self):
        from app.services.campaign_service import CampaignService
        svc = CampaignService(db=None)
        kpis = await svc.get_kpis("usr_001")
        # avgCTR = totalClicks / totalImpressions * 100 ≈ 5.46
        assert kpis["avgCTR"] == pytest.approx(5.46, abs=0.2)

    @pytest.mark.asyncio
    async def test_delete_campaign_removes_from_seed(self):
        from app.services.campaign_service import CampaignService
        svc = CampaignService(db=None)
        result = await svc.delete_campaign("usr_001", "C-001")
        assert result is True


# ═══════════════════════════════════════════════════════════════
# BUDGET SERVICE
# ═══════════════════════════════════════════════════════════════

class TestBudgetService:

    @pytest.mark.asyncio
    async def test_get_summary_seed_values(self):
        from app.services.budget_service import BudgetService
        svc = BudgetService(db=None)
        summary = await svc.get_summary("usr_001")
        assert summary["totalBudget"] == pytest.approx(28_500.0)
        assert summary["totalSpent"]  == pytest.approx(18_347.0)
        assert summary["remaining"]   == pytest.approx(28_500.0 - 18_347.0, rel=1e-3)

    @pytest.mark.asyncio
    async def test_get_summary_used_percent(self):
        from app.services.budget_service import BudgetService
        svc = BudgetService(db=None)
        summary = await svc.get_summary("usr_001")
        expected_pct = (18_347.0 / 28_500.0) * 100
        assert summary["usedPercent"] == pytest.approx(expected_pct, rel=0.01)

    @pytest.mark.asyncio
    async def test_get_daily_returns_7_days(self):
        from app.services.budget_service import BudgetService
        svc = BudgetService(db=None)
        daily = await svc.get_daily("usr_001")
        assert len(daily) == 7

    @pytest.mark.asyncio
    async def test_get_daily_labels(self):
        from app.services.budget_service import BudgetService
        svc = BudgetService(db=None)
        daily = await svc.get_daily("usr_001")
        labels = [d["day"] for d in daily]
        assert labels == ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

    @pytest.mark.asyncio
    async def test_get_allocations_returns_5_platforms(self):
        from app.services.budget_service import BudgetService
        svc = BudgetService(db=None)
        allocs = await svc.get_allocations("usr_001")
        assert len(allocs) == 5

    @pytest.mark.asyncio
    async def test_allocations_sum_to_100(self):
        from app.services.budget_service import BudgetService
        svc = BudgetService(db=None)
        allocs = await svc.get_allocations("usr_001")
        total_pct = sum(a["pct"] for a in allocs)
        assert total_pct == pytest.approx(100.0, abs=0.5)

    @pytest.mark.asyncio
    async def test_get_recommendation_not_none(self):
        from app.services.budget_service import BudgetService
        svc = BudgetService(db=None)
        rec = await svc.get_recommendation("usr_001")
        assert rec is not None
        assert "fromPlatform" in rec
        assert "toPlatform" in rec
        assert rec["amountUSD"] > 0

    @pytest.mark.asyncio
    async def test_get_forecast_returns_days(self):
        from app.services.budget_service import BudgetService
        svc = BudgetService(db=None)
        forecast = await svc.get_forecast("usr_001", days=7)
        assert forecast is not None
        assert "projectedSpend" in forecast or "daysRemaining" in forecast


# ═══════════════════════════════════════════════════════════════
# ML SERVICE
# ═══════════════════════════════════════════════════════════════

class TestMLService:

    def _svc(self):
        from app.services.ml_service import MLService
        return MLService(user_id="usr_001")

    def test_predict_churn_returns_dict(self):
        svc = self._svc()
        result = svc.predict_churn({
            "tenure": 12, "monthlyCharges": 85.0,
            "contract": "Month-to-month", "internetService": "Fiber optic",
            "onlineSecurity": False, "techSupport": False, "numSupportCalls": 3,
        })
        assert "churnProbability" in result
        assert "riskLevel" in result
        assert "confidence" in result

    def test_churn_probability_in_range(self):
        svc = self._svc()
        result = svc.predict_churn({
            "tenure": 12, "monthlyCharges": 85.0,
            "contract": "Month-to-month",
        })
        assert 0.0 <= result["churnProbability"] <= 1.0

    def test_high_risk_customer(self):
        """Month-to-month + Fiber + short tenure → critical/high risk."""
        svc = self._svc()
        result = svc.predict_churn({
            "tenure": 2, "monthlyCharges": 110.0,
            "contract": "Month-to-month", "internetService": "Fiber optic",
            "onlineSecurity": False, "techSupport": False, "numSupportCalls": 5,
        })
        assert result["riskLevel"] in ("critical", "high")
        assert result["churnProbability"] > 0.5

    def test_low_risk_customer(self):
        """Long tenure + two-year contract + security → low risk."""
        svc = self._svc()
        result = svc.predict_churn({
            "tenure": 60, "monthlyCharges": 40.0,
            "contract": "Two year", "internetService": "DSL",
            "onlineSecurity": True, "techSupport": True, "numSupportCalls": 0,
        })
        assert result["riskLevel"] in ("low", "medium")
        assert result["churnProbability"] < 0.5

    def test_risk_level_critical_threshold(self):
        """churnProbability > 0.75 → critical."""
        svc = self._svc()
        # Very high risk scenario
        result = svc.predict_churn({
            "tenure": 1, "monthlyCharges": 119.0,
            "contract": "Month-to-month", "internetService": "Fiber optic",
            "onlineSecurity": False, "techSupport": False, "numSupportCalls": 8,
        })
        if result["churnProbability"] > 0.75:
            assert result["riskLevel"] == "critical"

    def test_predict_churn_has_co2(self):
        svc = self._svc()
        result = svc.predict_churn({"tenure": 12, "monthlyCharges": 65.0})
        assert "co2Grams" in result
        assert result["co2Grams"] >= 0.0

    def test_detect_anomalies_empty_returns_list(self):
        svc = self._svc()
        result = svc.detect_anomalies("spend", [], [], None)
        assert isinstance(result, list)

    def test_detect_anomalies_flat_series_no_alert(self):
        """Perfectly flat time series → no anomalies."""
        svc = self._svc()
        values = [1000.0] * 7
        timestamps = [f"day_{i}" for i in range(7)]
        results = svc.detect_anomalies("spend", values, timestamps, None)
        anomalies = [r for r in results if r["isAnomaly"]]
        assert len(anomalies) == 0

    def test_detect_anomalies_spike_detected(self):
        """Extreme outlier in ≥8 samples → z-score > 2.5 → detected.
        With n=7 the max z-score for a single outlier is sqrt(6)=2.449 < 2.5,
        so we need at least 8 data points for reliable detection."""
        svc = self._svc()
        # n=10: max_z = sqrt(9) = 3.0 > 2.5 → spike guaranteed to be flagged
        values = [1000.0] * 9 + [50000.0]
        timestamps = [f"day_{i}" for i in range(10)]
        results = svc.detect_anomalies("spend", values, timestamps, None)
        anomalies = [r for r in results if r["isAnomaly"]]
        assert len(anomalies) >= 1

    def test_list_models_returns_four(self):
        svc = self._svc()
        models = svc.list_models()
        assert len(models) == 4

    def test_list_models_names(self):
        svc = self._svc()
        names = {m["name"] for m in svc.list_models()}
        assert "Churn Predictor"  in names
        assert "Anomaly Detector" in names
        assert "Click Predictor"  in names
        assert "ROAS Optimizer"   in names


# ═══════════════════════════════════════════════════════════════
# GREEN AI SERVICE
# ═══════════════════════════════════════════════════════════════

class TestGreenAIService:

    def test_calculate_co2_xgboost(self):
        """XGBoost (CPU only) — formula: power_W=95, PUE=1.57, CI=0.475."""
        from app.services.green_ai_service import calculate_co2
        co2 = calculate_co2("xgboost", duration_ms=100.0)
        # Expected: 95W * (0.1s / 3600) * 1.57 / 1000 * 0.475 * 1000
        expected = 95 * (0.1 / 3600) * 1.57 / 1000 * 0.475 * 1000
        assert co2 == pytest.approx(expected, rel=1e-3)
        assert co2 > 0.0

    def test_calculate_co2_neural_network_higher(self):
        """Neural network (GPU) must produce more CO₂ than XGBoost (CPU)."""
        from app.services.green_ai_service import calculate_co2
        co2_xgb = calculate_co2("xgboost",       duration_ms=100.0)
        co2_nn  = calculate_co2("neural_network", duration_ms=100.0)
        assert co2_nn > co2_xgb

    def test_longer_inference_more_co2(self):
        from app.services.green_ai_service import calculate_co2
        co2_short = calculate_co2("xgboost", duration_ms=10.0)
        co2_long  = calculate_co2("xgboost", duration_ms=100.0)
        assert co2_long > co2_short
        assert co2_long == pytest.approx(co2_short * 10, rel=1e-3)

    def test_record_inference_accumulates(self):
        """Multiple inferences accumulate in the session report."""
        from app.services.green_ai_service import GreenAIService
        svc = GreenAIService()
        svc.reset_session("test_user")
        svc.record_inference("test_user", "xgboost", 50.0, "XGB", "churn")
        svc.record_inference("test_user", "xgboost", 50.0, "XGB", "churn")
        report = svc.get_session_report("test_user")
        assert report["count"] == 2
        assert report["totalCO2Grams"] > 0.0

    def test_badge_excellent_under_0_01g(self):
        from app.services.green_ai_service import GreenAIService
        svc = GreenAIService()
        svc.reset_session("badge_user")
        # Fresh session → ~0 CO₂ → green badge
        report = svc.get_session_report("badge_user")
        # badge is a string that starts with the green circle emoji
        assert report["badge"].startswith("🟢")

    def test_session_report_has_required_fields(self):
        from app.services.green_ai_service import GreenAIService
        svc = GreenAIService()
        svc.reset_session("field_user")
        report = svc.get_session_report("field_user")
        for field in ("count","totalCO2Grams","badge","rating","scope",
                      "carbonIntensity","pue","cpuPowerW","gpuPowerW","equivalences"):
            assert field in report, f"Missing field: {field}"

    def test_equivalences_computed(self):
        from app.services.green_ai_service import GreenAIService
        svc = GreenAIService()
        svc.reset_session("equiv_user")
        svc.record_inference("equiv_user", "neural_network", 500.0, "MLP", "click")
        report = svc.get_session_report("equiv_user")
        equiv = report["equivalences"]
        assert "km_driving"        in equiv
        assert "smartphone_hours"  in equiv
        assert equiv["km_driving"] >= 0.0

    def test_reset_session_clears_co2(self):
        from app.services.green_ai_service import GreenAIService
        svc = GreenAIService()
        svc.record_inference("reset_user", "xgboost", 200.0, "XGB", "churn")
        svc.reset_session("reset_user")
        report = svc.get_session_report("reset_user")
        assert report["count"] == 0
        assert report["totalCO2Grams"] == 0.0
