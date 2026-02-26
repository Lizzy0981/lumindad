# backend/tests/integration/test_ml_api.py
"""
Integration tests — /api/v1/ml/*

Endpoints covered:
  GET  /api/v1/ml/models                   list 4 models + metadata
  GET  /api/v1/ml/models/{name}/status     per-model status
  POST /api/v1/ml/predict/churn            ChurnPrediction response
  POST /api/v1/ml/predict/clicks           CTR + CPC
  POST /api/v1/ml/predict/roas             ROAS prediction
  POST /api/v1/ml/anomaly/detect           anomaly detection
  GET  /api/v1/ml/anomaly/feed             seed anomaly feed
  POST /api/v1/ml/shap                     SHAP explanation
  GET  /api/v1/ml/green-ai                 GreenAI session report
"""

from __future__ import annotations

import pytest

BASE = "/api/v1/ml"

# Shared valid CustomerFeatures payload — must match Pydantic schema exactly:
# customerId (str, required), tenure (int, required), monthlyCharges (float, required),
# totalCharges (float, required), contract (Literal, required), internetService (Literal, required),
# onlineSecurity/techSupport/streamingTV (bool, optional), numSupportCalls (int, optional)
VALID_CUSTOMER = {
    "customerId":      "CUST-TEST-001",
    "tenure":          12,
    "monthlyCharges":  85.50,
    "totalCharges":    1026.0,
    "contract":        "Month-to-month",
    "internetService": "Fiber optic",
    "onlineSecurity":  False,
    "techSupport":     False,
    "streamingTV":     False,
    "numSupportCalls": 3,
}


# ═══════════════════════════════════════════════════════════════
# MODEL LIST
# ═══════════════════════════════════════════════════════════════

class TestListModels:

    @pytest.mark.asyncio
    async def test_returns_200(self, client, auth_headers):
        resp = await client.get(f"{BASE}/models", headers=auth_headers)
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_returns_exactly_four_models(self, client, auth_headers):
        resp = await client.get(f"{BASE}/models", headers=auth_headers)
        body = resp.json()
        models = body if isinstance(body, list) else body.get("models", [])
        assert len(models) == 4

    @pytest.mark.asyncio
    async def test_model_names_match_seed(self, client, auth_headers):
        resp = await client.get(f"{BASE}/models", headers=auth_headers)
        body = resp.json()
        models = body if isinstance(body, list) else body.get("models", [])
        names = {m["name"] for m in models}
        assert "Churn Predictor"  in names
        assert "Anomaly Detector" in names
        assert "Click Predictor"  in names
        assert "ROAS Optimizer"   in names

    @pytest.mark.asyncio
    async def test_models_have_accuracy_field(self, client, auth_headers):
        resp = await client.get(f"{BASE}/models", headers=auth_headers)
        body = resp.json()
        models = body if isinstance(body, list) else body.get("models", [])
        for m in models:
            assert "accuracy" in m
            assert 0 < m["accuracy"] <= 100

    @pytest.mark.asyncio
    async def test_churn_predictor_accuracy_87(self, client, auth_headers):
        """Churn Predictor accuracy must be 87.3% (LumindAd.jsx AnalyticsPage)."""
        resp = await client.get(f"{BASE}/models", headers=auth_headers)
        body = resp.json()
        models = body if isinstance(body, list) else body.get("models", [])
        churn = next(m for m in models if m["name"] == "Churn Predictor")
        assert abs(churn["accuracy"] - 87.3) < 0.1

    @pytest.mark.asyncio
    async def test_anomaly_detector_accuracy_94(self, client, auth_headers):
        resp = await client.get(f"{BASE}/models", headers=auth_headers)
        body = resp.json()
        models = body if isinstance(body, list) else body.get("models", [])
        anomaly = next(m for m in models if m["name"] == "Anomaly Detector")
        assert abs(anomaly["accuracy"] - 94.1) < 0.1


class TestModelStatus:

    @pytest.mark.asyncio
    async def test_churn_predictor_status(self, client, auth_headers):
        resp = await client.get(
            f"{BASE}/models/churn-predictor/status",
            headers=auth_headers,
        )
        assert resp.status_code == 200
        body = resp.json()
        assert "status" in body

    @pytest.mark.asyncio
    async def test_unknown_model_returns_404(self, client, auth_headers):
        resp = await client.get(
            f"{BASE}/models/does-not-exist/status",
            headers=auth_headers,
        )
        assert resp.status_code == 404


# ═══════════════════════════════════════════════════════════════
# CHURN PREDICTION
# ═══════════════════════════════════════════════════════════════

class TestPredictChurn:

    @pytest.mark.asyncio
    async def test_returns_200(self, client, auth_headers):
        resp = await client.post(
            f"{BASE}/predict/churn",
            json=VALID_CUSTOMER,
            headers=auth_headers,
        )
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_response_has_churn_probability(self, client, auth_headers):
        resp = await client.post(
            f"{BASE}/predict/churn",
            json=VALID_CUSTOMER,
            headers=auth_headers,
        )
        body = resp.json()
        assert "churnProbability" in body

    @pytest.mark.asyncio
    async def test_probability_in_valid_range(self, client, auth_headers):
        resp = await client.post(
            f"{BASE}/predict/churn",
            json=VALID_CUSTOMER,
            headers=auth_headers,
        )
        body = resp.json()
        prob = body["churnProbability"]
        assert 0.0 <= prob <= 1.0

    @pytest.mark.asyncio
    async def test_response_has_risk_level(self, client, auth_headers):
        resp = await client.post(
            f"{BASE}/predict/churn",
            json=VALID_CUSTOMER,
            headers=auth_headers,
        )
        body = resp.json()
        assert body["riskLevel"] in ("critical", "high", "medium", "low")

    @pytest.mark.asyncio
    async def test_response_has_model_version(self, client, auth_headers):
        resp = await client.post(
            f"{BASE}/predict/churn",
            json=VALID_CUSTOMER,
            headers=auth_headers,
        )
        body = resp.json()
        assert "modelVersion" in body

    @pytest.mark.asyncio
    async def test_response_has_co2_grams(self, client, auth_headers):
        resp = await client.post(
            f"{BASE}/predict/churn",
            json=VALID_CUSTOMER,
            headers=auth_headers,
        )
        body = resp.json()
        assert "co2Grams" in body
        assert body["co2Grams"] >= 0.0

    @pytest.mark.asyncio
    async def test_missing_tenure_returns_422(self, client, auth_headers):
        payload = {k: v for k, v in VALID_CUSTOMER.items() if k != "tenure"}
        resp = await client.post(
            f"{BASE}/predict/churn",
            json=payload,
            headers=auth_headers,
        )
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_invalid_contract_returns_422(self, client, auth_headers):
        payload = {**VALID_CUSTOMER, "contract": "Weekly"}
        resp = await client.post(
            f"{BASE}/predict/churn",
            json=payload,
            headers=auth_headers,
        )
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_negative_tenure_returns_422(self, client, auth_headers):
        payload = {**VALID_CUSTOMER, "tenure": -5}
        resp = await client.post(
            f"{BASE}/predict/churn",
            json=payload,
            headers=auth_headers,
        )
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_two_year_contract_lower_risk(self, client, auth_headers):
        """Two-year contract should produce lower churn than month-to-month."""
        high_risk = await client.post(
            f"{BASE}/predict/churn",
            json={**VALID_CUSTOMER, "contract": "Month-to-month", "tenure": 2},
            headers=auth_headers,
        )
        low_risk = await client.post(
            f"{BASE}/predict/churn",
            json={**VALID_CUSTOMER, "contract": "Two year", "tenure": 48},
            headers=auth_headers,
        )
        p_high = high_risk.json()["churnProbability"]
        p_low  = low_risk.json()["churnProbability"]
        assert p_high > p_low


# ═══════════════════════════════════════════════════════════════
# CLICK PREDICTION
# ═══════════════════════════════════════════════════════════════

# AdFeatures schema: campaignId*, platform*, objective*, dailyBudget*, bidStrategy*, audienceSize*, creativeScore*
VALID_AD_FEATURES = {
    "campaignId":    "C-001",
    "platform":      "Google Ads",
    "objective":     "sales",
    "dailyBudget":   150.0,
    "bidStrategy":   "target_cpa",
    "audienceSize":  50000,
    "creativeScore": 70.0,
}

class TestPredictClicks:

    @pytest.mark.asyncio
    async def test_returns_200(self, client, auth_headers):
        resp = await client.post(
            f"{BASE}/predict/clicks",
            json=VALID_AD_FEATURES,
            headers=auth_headers,
        )
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_response_has_ctr_and_cpc(self, client, auth_headers):
        resp = await client.post(
            f"{BASE}/predict/clicks",
            json=VALID_AD_FEATURES,
            headers=auth_headers,
        )
        body = resp.json()
        assert "predictedCTR" in body or "ctr" in body
        assert "predictedCPC" in body or "cpc" in body

    @pytest.mark.asyncio
    async def test_ctr_positive(self, client, auth_headers):
        resp = await client.post(
            f"{BASE}/predict/clicks",
            json={**VALID_AD_FEATURES, "platform": "Meta Ads", "creativeScore": 60},
            headers=auth_headers,
        )
        body = resp.json()
        ctr = body.get("predictedCTR") or body.get("ctr", 0)
        assert ctr >= 0.0


# ═══════════════════════════════════════════════════════════════
# ROAS PREDICTION
# ═══════════════════════════════════════════════════════════════

class TestPredictROAS:

    @pytest.mark.asyncio
    async def test_returns_200(self, client, auth_headers):
        resp = await client.post(
            f"{BASE}/predict/roas",
            json=VALID_AD_FEATURES,
            headers=auth_headers,
        )
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_response_has_roas(self, client, auth_headers):
        resp = await client.post(
            f"{BASE}/predict/roas",
            json=VALID_AD_FEATURES,
            headers=auth_headers,
        )
        body = resp.json()
        assert "predictedROAS" in body or "roas" in body

    @pytest.mark.asyncio
    async def test_roas_positive(self, client, auth_headers):
        resp = await client.post(
            f"{BASE}/predict/roas",
            json={**VALID_AD_FEATURES, "platform": "LinkedIn"},
            headers=auth_headers,
        )
        body = resp.json()
        roas = body.get("predictedROAS") or body.get("roas", 0)
        assert roas > 0


# ═══════════════════════════════════════════════════════════════
# ANOMALY DETECTION
# ═══════════════════════════════════════════════════════════════

class TestAnomalyDetect:

    @pytest.mark.asyncio
    async def test_returns_200(self, client, auth_headers):
        # anomaly/detect expects List[AnomalyInput], not a single dict
        resp = await client.post(
            f"{BASE}/anomaly/detect",
            json=[{
                "metric": "spend",
                "values": [1000, 1000, 1000, 9999, 1000, 1000, 1000],
                "timestamps": ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"],
            }],
            headers=auth_headers,
        )
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_returns_list_of_results(self, client, auth_headers):
        resp = await client.post(
            f"{BASE}/anomaly/detect",
            json=[{
                "metric": "spend",
                "values": [1000] * 9 + [50000],
                "timestamps": [f"d{i}" for i in range(10)],
            }],
            headers=auth_headers,
        )
        body = resp.json()
        assert isinstance(body, list)
        assert len(body) >= 1

    @pytest.mark.asyncio
    async def test_spike_flagged_as_anomaly(self, client, auth_headers):
        """n=10 → max_z=sqrt(9)=3.0 > 2.5 threshold → spike detected."""
        resp = await client.post(
            f"{BASE}/anomaly/detect",
            json=[{
                "metric": "spend",
                "values": [1000.0] * 9 + [50000.0],
                "timestamps": [f"d{i}" for i in range(10)],
            }],
            headers=auth_headers,
        )
        body = resp.json()
        assert isinstance(body, list)
        any_anomaly = any(r.get("isAnomaly", False) for r in body)
        assert any_anomaly

    @pytest.mark.asyncio
    async def test_empty_list_returns_empty(self, client, auth_headers):
        resp = await client.post(
            f"{BASE}/anomaly/detect",
            json=[],
            headers=auth_headers,
        )
        assert resp.status_code == 200
        assert resp.json() == []


class TestAnomalyFeed:

    @pytest.mark.asyncio
    async def test_returns_200(self, client, auth_headers):
        resp = await client.get(f"{BASE}/anomaly/feed", headers=auth_headers)
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_returns_list(self, client, auth_headers):
        resp = await client.get(f"{BASE}/anomaly/feed", headers=auth_headers)
        body = resp.json()
        feed = body if isinstance(body, list) else body.get("alerts", body.get("feed", []))
        assert isinstance(feed, list)


# ═══════════════════════════════════════════════════════════════
# SHAP EXPLANATION
# ═══════════════════════════════════════════════════════════════

class TestSHAP:

    @pytest.fixture
    async def prediction_id(self, client, auth_headers):
        """Get a real predictionId from a churn prediction."""
        resp = await client.post(
            f"{BASE}/predict/churn",
            json=VALID_CUSTOMER,
            headers=auth_headers,
        )
        return resp.json().get("predictionId", "pred_test_001")

    @pytest.mark.asyncio
    async def test_returns_200(self, client, auth_headers, prediction_id):
        resp = await client.post(
            f"{BASE}/shap",
            json={"predictionId": prediction_id},
            headers=auth_headers,
        )
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_response_has_features_list(self, client, auth_headers, prediction_id):
        resp = await client.post(
            f"{BASE}/shap",
            json={"predictionId": prediction_id},
            headers=auth_headers,
        )
        body = resp.json()
        assert "features" in body
        assert isinstance(body["features"], list)

    @pytest.mark.asyncio
    async def test_features_have_shap_value(self, client, auth_headers, prediction_id):
        resp = await client.post(
            f"{BASE}/shap",
            json={"predictionId": prediction_id},
            headers=auth_headers,
        )
        body = resp.json()
        for f in body["features"]:
            assert "shapValue" in f or "shap_value" in f


# ═══════════════════════════════════════════════════════════════
# GREEN AI
# ═══════════════════════════════════════════════════════════════

class TestGreenAI:

    @pytest.mark.asyncio
    async def test_returns_200(self, client, auth_headers):
        resp = await client.get(f"{BASE}/green-ai", headers=auth_headers)
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_response_has_co2_field(self, client, auth_headers):
        resp = await client.get(f"{BASE}/green-ai", headers=auth_headers)
        body = resp.json()
        has_co2 = "totalCO2Grams" in body or "co2Grams" in body or "total_co2_grams" in body
        assert has_co2

    @pytest.mark.asyncio
    async def test_response_has_badge(self, client, auth_headers):
        resp = await client.get(f"{BASE}/green-ai", headers=auth_headers)
        body = resp.json()
        assert "badge" in body or "rating" in body
