# backend/tests/unit/test_predictor.py
"""
Unit tests — ml/inference/predictor.py

Coverage:
  build_feature_vector   shape · camelCase/snake_case · defaults
  preprocess             flat (1,20) · seq (1,10,20)
  predict_churn          ensemble output · probability range ·
                         individual scores · risk thresholds
  predict_churn_batch    batch shape matches input length
  detect_anomaly         MSE output structure
  detect_anomaly_batch   flat series + spike detection
  predict_clicks         CTR/CPC output shape
  predict_roas           ROAS range bracket
  explain_shap           top-N features · shapValue types
  model_status           dict with known keys
"""

from __future__ import annotations

import sys
import os
import pytest
import numpy as np
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent))
os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "3")

# ── Shared customer fixture ───────────────────────────────────────────────────
CUSTOMER = {
    "customerId":      "CUST-001",
    "tenure":          12,
    "monthlyCharges":  85.50,
    "totalCharges":    1026.0,
    "contract":        "Month-to-month",
    "internetService": "Fiber optic",
    "onlineSecurity":  False,
    "techSupport":     False,
    "numSupportCalls": 3,
    "paymentMethod":   "Electronic check",
}

LOW_RISK_CUSTOMER = {
    "customerId":      "CUST-LOW",
    "tenure":          60,
    "monthlyCharges":  35.0,
    "contract":        "Two year",
    "internetService": "DSL",
    "onlineSecurity":  True,
    "techSupport":     True,
    "numSupportCalls": 0,
}


# ═══════════════════════════════════════════════════════════════
# FEATURE ENGINEERING
# ═══════════════════════════════════════════════════════════════

class TestBuildFeatureVector:

    def test_output_shape(self):
        from ml.inference.predictor import build_feature_vector, INPUT_DIM
        vec = build_feature_vector(CUSTOMER)
        assert vec.shape == (INPUT_DIM,)

    def test_output_dtype_float32(self):
        from ml.inference.predictor import build_feature_vector
        vec = build_feature_vector(CUSTOMER)
        assert vec.dtype == np.float32

    def test_tenure_extracted_correctly(self):
        from ml.inference.predictor import build_feature_vector
        vec = build_feature_vector({"tenure": 24, "monthlyCharges": 50.0})
        assert vec[0] == pytest.approx(24.0)

    def test_contract_month_to_month_encoding(self):
        """Month-to-month → contract_one_year=0, contract_two_year=0."""
        from ml.inference.predictor import build_feature_vector
        vec = build_feature_vector({"contract": "Month-to-month"})
        assert vec[15] == 0.0   # contract_one_year
        assert vec[16] == 0.0   # contract_two_year

    def test_contract_two_year_encoding(self):
        from ml.inference.predictor import build_feature_vector
        vec = build_feature_vector({"contract": "Two year"})
        assert vec[15] == 0.0   # contract_one_year
        assert vec[16] == 1.0   # contract_two_year

    def test_fiber_internet_encoding(self):
        from ml.inference.predictor import build_feature_vector
        vec = build_feature_vector({"internetService": "Fiber optic"})
        assert vec[17] == 1.0   # internet_fiber
        assert vec[18] == 0.0   # internet_dsl

    def test_empty_dict_uses_defaults(self):
        from ml.inference.predictor import build_feature_vector, INPUT_DIM
        vec = build_feature_vector({})
        assert vec.shape == (INPUT_DIM,)
        assert not np.any(np.isnan(vec))

    def test_total_charges_fallback(self):
        """When totalCharges is absent, it's computed as tenure × monthlyCharges."""
        from ml.inference.predictor import build_feature_vector
        vec = build_feature_vector({"tenure": 10, "monthlyCharges": 50.0})
        # index 2 = totalCharges
        assert vec[2] == pytest.approx(10 * 50.0, abs=1.0)


class TestPreprocess:

    def test_flat_shape(self):
        from ml.inference.predictor import preprocess
        flat, seq = preprocess(CUSTOMER)
        assert flat.shape == (1, 20)

    def test_seq_shape(self):
        from ml.inference.predictor import preprocess, SEQ_LEN, INPUT_DIM
        flat, seq = preprocess(CUSTOMER)
        assert seq.shape == (1, SEQ_LEN, INPUT_DIM)

    def test_seq_is_tiled_flat(self):
        """Each timestep in seq must equal flat."""
        from ml.inference.predictor import preprocess
        flat, seq = preprocess(CUSTOMER)
        for t in range(seq.shape[1]):
            np.testing.assert_array_almost_equal(seq[0, t, :], flat[0, :])

    def test_scaled_values_finite(self):
        from ml.inference.predictor import preprocess
        flat, _ = preprocess(CUSTOMER)
        assert np.all(np.isfinite(flat))


# ═══════════════════════════════════════════════════════════════
# CHURN PREDICTION
# ═══════════════════════════════════════════════════════════════

class TestPredictChurn:

    def test_returns_dict(self):
        from ml.inference.predictor import predict_churn
        result = predict_churn(CUSTOMER)
        assert isinstance(result, dict)

    def test_probability_in_range(self):
        from ml.inference.predictor import predict_churn
        result = predict_churn(CUSTOMER)
        assert 0.0 <= result["churnProbability"] <= 1.0

    def test_risk_level_valid(self):
        from ml.inference.predictor import predict_churn
        result = predict_churn(CUSTOMER)
        assert result["riskLevel"] in ("critical", "high", "medium", "low")

    def test_confidence_in_range(self):
        from ml.inference.predictor import predict_churn
        result = predict_churn(CUSTOMER)
        assert 0.0 <= result["confidence"] <= 1.0

    def test_high_risk_profile_scores_high(self):
        from ml.inference.predictor import predict_churn
        result = predict_churn(CUSTOMER)  # tenure=12, M2M, fiber
        # This customer profile should score above medium
        assert result["churnProbability"] > 0.4

    def test_low_risk_profile_scores_low(self):
        from ml.inference.predictor import predict_churn
        result = predict_churn(LOW_RISK_CUSTOMER)
        assert result["churnProbability"] < 0.6

    def test_individual_scores_present(self):
        from ml.inference.predictor import predict_churn
        result = predict_churn(CUSTOMER)
        assert "individualScores" in result
        assert len(result["individualScores"]) >= 1

    def test_individual_scores_in_range(self):
        from ml.inference.predictor import predict_churn
        result = predict_churn(CUSTOMER)
        for model_name, score in result["individualScores"].items():
            assert 0.0 <= score <= 1.0, f"{model_name} score out of range: {score}"

    def test_duration_ms_present(self):
        from ml.inference.predictor import predict_churn
        result = predict_churn(CUSTOMER)
        assert "durationMs" in result
        assert result["durationMs"] >= 0.0


class TestPredictChurnBatch:

    def test_output_length_matches_input(self):
        from ml.inference.predictor import predict_churn_batch
        customers = [CUSTOMER, LOW_RISK_CUSTOMER, CUSTOMER]
        results = predict_churn_batch(customers)
        assert len(results) == 3

    def test_each_result_has_required_fields(self):
        from ml.inference.predictor import predict_churn_batch
        results = predict_churn_batch([CUSTOMER])
        r = results[0]
        for field in ("churnProbability", "riskLevel", "confidence"):
            assert field in r

    def test_batch_probabilities_in_range(self):
        from ml.inference.predictor import predict_churn_batch
        results = predict_churn_batch([CUSTOMER, LOW_RISK_CUSTOMER])
        for r in results:
            assert 0.0 <= r["churnProbability"] <= 1.0

    def test_empty_batch_returns_empty_list(self):
        from ml.inference.predictor import predict_churn_batch
        assert predict_churn_batch([]) == []


# ═══════════════════════════════════════════════════════════════
# ANOMALY DETECTION
# ═══════════════════════════════════════════════════════════════

class TestDetectAnomaly:

    def test_returns_dict(self):
        from ml.inference.predictor import detect_anomaly
        result = detect_anomaly(CUSTOMER)
        assert isinstance(result, dict)

    def test_has_required_fields(self):
        from ml.inference.predictor import detect_anomaly
        result = detect_anomaly(CUSTOMER)
        for field in ("isAnomaly", "score", "mse", "severity", "threshold"):
            assert field in result

    def test_score_in_range(self):
        from ml.inference.predictor import detect_anomaly
        result = detect_anomaly(CUSTOMER)
        assert 0.0 <= result["score"] <= 1.0

    def test_mse_non_negative(self):
        from ml.inference.predictor import detect_anomaly
        result = detect_anomaly(CUSTOMER)
        assert result["mse"] >= 0.0


class TestDetectAnomalyBatch:

    def test_flat_series_no_anomaly(self):
        from ml.inference.predictor import detect_anomaly_batch
        values = [1000.0] * 7
        result = detect_anomaly_batch(values, [f"d{i}" for i in range(7)], "spend")
        assert result["isAnomaly"] is False
        assert result["anomalyIdx"] == []

    def test_spike_detected(self):
        from ml.inference.predictor import detect_anomaly_batch
        # n=10 → max_z = sqrt(9) = 3.0 > 2.5 threshold → spike at index 9 guaranteed detected
        values = [1000.0] * 9 + [50000.0]
        result = detect_anomaly_batch(values, [f"d{i}" for i in range(10)], "spend")
        assert result["isAnomaly"] is True
        assert 9 in result["anomalyIdx"]

    def test_returns_severity(self):
        from ml.inference.predictor import detect_anomaly_batch
        values = [1000.0, 1000.0, 1000.0, 9999.0, 1000.0, 1000.0, 1000.0]
        result = detect_anomaly_batch(values, [f"d{i}" for i in range(7)], "spend")
        assert result["severity"] in ("critical", "high", "medium", "low")

    def test_empty_values_returns_no_anomaly(self):
        from ml.inference.predictor import detect_anomaly_batch
        result = detect_anomaly_batch([], [], "spend")
        assert result["isAnomaly"] is False


# ═══════════════════════════════════════════════════════════════
# CLICK + ROAS PREDICTION
# ═══════════════════════════════════════════════════════════════

class TestPredictClicks:

    def test_returns_ctr_and_cpc(self):
        from ml.inference.predictor import predict_clicks
        result = predict_clicks({"platform": "Google Ads", "creativeScore": 70})
        assert "predictedCTR" in result
        assert "predictedCPC" in result

    def test_ctr_positive(self):
        from ml.inference.predictor import predict_clicks
        result = predict_clicks({"platform": "Google Ads", "creativeScore": 70})
        assert result["predictedCTR"] > 0.0

    def test_cpc_positive(self):
        from ml.inference.predictor import predict_clicks
        result = predict_clicks({"platform": "Meta Ads", "creativeScore": 50})
        assert result["predictedCPC"] > 0.0

    def test_higher_score_higher_ctr(self):
        from ml.inference.predictor import predict_clicks
        low  = predict_clicks({"platform": "Google Ads", "creativeScore": 20})
        high = predict_clicks({"platform": "Google Ads", "creativeScore": 90})
        assert high["predictedCTR"] >= low["predictedCTR"]


class TestPredictROAS:

    def test_returns_dict_with_roas(self):
        from ml.inference.predictor import predict_roas
        result = predict_roas({"platform": "Google Ads", "creativeScore": 65})
        assert "predictedROAS" in result
        assert "roasRange" in result

    def test_roas_positive(self):
        from ml.inference.predictor import predict_roas
        result = predict_roas({"platform": "Google Ads", "creativeScore": 65})
        assert result["predictedROAS"] > 0.0

    def test_roas_range_brackets(self):
        from ml.inference.predictor import predict_roas
        result = predict_roas({"platform": "Meta Ads", "creativeScore": 60})
        low  = result["roasRange"]["low"]
        high = result["roasRange"]["high"]
        pred = result["predictedROAS"]
        assert low <= pred <= high


# ═══════════════════════════════════════════════════════════════
# SHAP EXPLANATION
# ═══════════════════════════════════════════════════════════════

class TestExplainSHAP:

    def test_returns_dict(self):
        from ml.inference.predictor import explain_shap
        result = explain_shap(CUSTOMER, n_features=7)
        assert isinstance(result, dict)

    def test_has_required_keys(self):
        from ml.inference.predictor import explain_shap
        result = explain_shap(CUSTOMER, n_features=7)
        for key in ("baseValue", "output", "features"):
            assert key in result

    def test_features_length_bounded_by_n(self):
        from ml.inference.predictor import explain_shap
        result = explain_shap(CUSTOMER, n_features=5)
        assert len(result["features"]) <= 5

    def test_each_feature_has_shap_value(self):
        from ml.inference.predictor import explain_shap
        result = explain_shap(CUSTOMER, n_features=5)
        for f in result["features"]:
            assert "shapValue" in f
            assert isinstance(f["shapValue"], float)

    def test_features_sorted_by_abs_shap(self):
        from ml.inference.predictor import explain_shap
        result = explain_shap(CUSTOMER, n_features=10)
        shap_vals = [abs(f["shapValue"]) for f in result["features"]]
        assert shap_vals == sorted(shap_vals, reverse=True)


# ═══════════════════════════════════════════════════════════════
# MODEL REGISTRY
# ═══════════════════════════════════════════════════════════════

class TestModelStatus:

    def test_returns_dict(self):
        from ml.inference.predictor import model_status
        status = model_status()
        assert isinstance(status, dict)

    def test_expected_keys_present(self):
        from ml.inference.predictor import model_status
        status = model_status()
        for key in ("xgboost", "mlp", "lstm", "cnn1d", "autoencoder", "scaler"):
            assert key in status

    def test_values_are_strings(self):
        from ml.inference.predictor import model_status
        for k, v in model_status().items():
            assert isinstance(v, str), f"{k} status is not a string"

    def test_models_available_after_warm_up(self):
        from ml.inference.predictor import warm_up, models_available
        warm_up()
        assert models_available() is True
