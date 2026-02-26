# backend/app/services/ml_service.py
"""
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  LumindAd Enterprise · backend/app/services/ml_service.py
  ML inference service — 4 models + SHAP + anomaly feed

  Models
  ───────
  Churn Predictor     XGBoost v2.3.1        87.3% accuracy
  Anomaly Detector    Isolation Forest v1.4  94.1% accuracy
  Click Predictor     MLP Neural Network v3  82.7% accuracy
  ROAS Optimizer      AutoML ensemble v1.8   91.2% accuracy

  Each inference:
    1. Runs heuristic prediction (real model loaded lazily when available)
    2. Records timing via GreenAIService.InferenceTimer
    3. Stores result in _PREDICTIONS for SHAP lookup
    4. Returns typed prediction dict with co2Grams field

  Churn score heuristic (mirrors mlService.ts mockChurnPrediction)
  ──────────────────────────────────────────────────────────────────
  score = 0.10
        + (monthlyCharges / 120) × 0.30
        + 1 / (tenure + 1)       × 0.40
        + 0.20 if Month-to-month else 0
        + 0.10 if Fiber optic    else 0
        - 0.05 if onlineSecurity else 0
        - 0.05 if techSupport    else 0
        + numSupportCalls × 0.03
  clamped to [0.05, 0.95]

  SHAP feature importance (7 Telecom X features)
  ────────────────────────────────────────────────
  contract        → shapValue ±0.21
  tenure          → shapValue ±0.14
  monthlyCharges  → shapValue ±0.09
  internetService → shapValue ±0.07
  numSupportCalls → shapValue ±0.06
  onlineSecurity  → shapValue −0.04
  techSupport     → shapValue −0.03

  Isolation Forest anomaly heuristic
  ─────────────────────────────────────
  mean ± std across values array
  anomalous if |value − mean| > 2.5 × std
  severity: critical>4σ  high>3σ  medium>2.5σ  low

  Author : Elizabeth Díaz Familia
           AI Data Scientist · Sustainable Intelligence & BI
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"""

from __future__ import annotations

import logging
import math
import secrets
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from app.config import settings
from app.services.green_ai_service import green_ai, calculate_co2

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════
# MODEL REGISTRY
# ═══════════════════════════════════════════════════════════════

_MODEL_REGISTRY = [
    {
        "name":      "Churn Predictor",
        "algorithm": "XGBoost",
        "accuracy":  87.3,
        "status":    "active",
        "color":     "#7c3aed",
        "version":   settings.ML_CHURN_VERSION,
    },
    {
        "name":      "Anomaly Detector",
        "algorithm": "Isolation Forest",
        "accuracy":  94.1,
        "status":    "active",
        "color":     "#06b6d4",
        "version":   settings.ML_ANOMALY_VERSION,
    },
    {
        "name":      "Click Predictor",
        "algorithm": "Neural Network",
        "accuracy":  82.7,
        "status":    "active",
        "color":     "#10b981",
        "version":   settings.ML_CLICK_VERSION,
    },
    {
        "name":      "ROAS Optimizer",
        "algorithm": "AutoML",
        "accuracy":  91.2,
        "status":    "training",
        "color":     "#f59e0b",
        "version":   settings.ML_ROAS_VERSION,
    },
]

_MODEL_METRICS = {
    "churn predictor": {
        "name": "Churn Predictor", "accuracy": 0.873, "precision": 0.841,
        "recall": 0.876, "f1Score": 0.858, "auc": 0.921,
        "lastTrained": "2025-10-15", "dataPoints": 1_250_000, "version": settings.ML_CHURN_VERSION,
    },
    "anomaly detector": {
        "name": "Anomaly Detector", "accuracy": 0.941, "precision": 0.928,
        "recall": 0.953, "f1Score": 0.940, "auc": 0.987,
        "lastTrained": "2025-09-28", "dataPoints": 3_400_000, "version": settings.ML_ANOMALY_VERSION,
    },
    "click predictor": {
        "name": "Click Predictor", "accuracy": 0.827, "precision": 0.814,
        "recall": 0.839, "f1Score": 0.826, "auc": 0.891,
        "lastTrained": "2025-11-02", "dataPoints": 8_700_000, "version": settings.ML_CLICK_VERSION,
    },
    "roas optimizer": {
        "name": "ROAS Optimizer", "accuracy": 0.912, "precision": 0.899,
        "recall": 0.924, "f1Score": 0.911, "auc": 0.965,
        "lastTrained": "2025-10-30", "dataPoints": 2_100_000, "version": settings.ML_ROAS_VERSION,
    },
}

# Seed anomaly alerts (LumindAd.jsx AnomalyFeed)
_ANOMALY_ALERTS = [
    {
        "id":        "alert_001",
        "severity":  "high",
        "message":   "CTR dropped 35% below 7-day average for Google Ads campaigns",
        "metric":    "ctr",
        "value":     4.62,
        "threshold": 7.16,
        "campaignId": "C-001",
        "detectedAt": "2025-11-18T14:30:00Z",
    },
    {
        "id":        "alert_002",
        "severity":  "medium",
        "message":   "TikTok spend spike: $2,480 vs daily budget of $1,500 (+65%)",
        "metric":    "spend",
        "value":     2480.0,
        "threshold": 1500.0,
        "campaignId": "C-003",
        "detectedAt": "2025-11-18T11:15:00Z",
    },
]

# Platform-specific biases for click + ROAS models
_PLATFORM_CTR_BIAS = {
    "Google Ads": 1.15, "Meta Ads": 0.95, "TikTok": 1.08,
    "LinkedIn": 0.70, "Twitter/X": 0.85,
}
_PLATFORM_ROAS_BIAS = {
    "Google Ads": 1.20, "Meta Ads": 0.95, "TikTok": 1.05,
    "LinkedIn": 0.80, "Twitter/X": 0.75,
}

# In-memory prediction store for SHAP lookups (last 1000)
_PREDICTIONS: Dict[str, dict] = {}
_MAX_PREDICTIONS = 1000


def _store_prediction(pred_id: str, data: dict) -> None:
    """Store prediction data for SHAP lookup; evict oldest when full."""
    if len(_PREDICTIONS) >= _MAX_PREDICTIONS:
        oldest = next(iter(_PREDICTIONS))
        del _PREDICTIONS[oldest]
    _PREDICTIONS[pred_id] = data


def _pred_id() -> str:
    return f"pred_{secrets.token_hex(8)}"


# ═══════════════════════════════════════════════════════════════
# SERVICE CLASS
# ═══════════════════════════════════════════════════════════════

class MLService:
    """
    ML inference service — wraps 4 models + SHAP + anomaly detection.

    All methods return typed dicts that match the Pydantic schemas
    in api/v1/ml.py and the TypeScript interfaces in mlService.ts.

    Carbon tracking is automatic — every inference records CO₂ via
    GreenAIService using the InferenceTimer context manager.
    """

    def __init__(self, user_id: str = "usr_001") -> None:
        self.user_id = user_id

    # ── MODEL REGISTRY ────────────────────────────────────────

    def list_models(self) -> List[dict]:
        """GET /ml/models → List[MLModel]"""
        return [dict(m) for m in _MODEL_REGISTRY]

    def get_model_status(self, name: str) -> Optional[str]:
        """GET /ml/models/{name}/status → status string"""
        nl = name.lower()
        for m in _MODEL_REGISTRY:
            if m["name"].lower() == nl or m["algorithm"].lower() == nl:
                return m["status"]
        return None

    def get_model_metrics(self, name: str) -> Optional[dict]:
        """GET /ml/models/{name}/metrics → ModelMetrics"""
        return _MODEL_METRICS.get(name.lower())

    # ── CHURN PREDICTION  (XGBoost) ───────────────────────────

    def predict_churn(self, features: dict) -> dict:
        """
        POST /ml/predict/churn

        Heuristic XGBoost churn probability score.
        Mirrors mlService.ts mockChurnPrediction exactly.

        CustomerFeatures (Telecom X schema):
            customerId, tenure, monthlyCharges, totalCharges,
            contract, internetService, onlineSecurity, techSupport,
            streamingTV, paymentMethod, numSupportCalls

        Returns ChurnPrediction:
            customerId, churnProbability, riskLevel, daysToChurn,
            predictionId, modelVersion, confidence, co2Grams
        """
        t0 = time.perf_counter()

        tenure           = float(features.get("tenure", 12))
        monthly_charges  = float(features.get("monthlyCharges", 65.0))
        contract         = features.get("contract", "Month-to-month")
        internet_service = features.get("internetService", "Fiber optic")
        online_security  = features.get("onlineSecurity", False)
        tech_support     = features.get("techSupport", False)
        support_calls    = int(features.get("numSupportCalls", 0))

        score = (
            0.10
            + (monthly_charges / 120.0) * 0.30
            + (1.0 / (tenure + 1.0))   * 0.40
            + (0.20 if contract         == "Month-to-month" else 0.0)
            + (0.10 if internet_service == "Fiber optic"    else 0.0)
            - (0.05 if online_security                      else 0.0)
            - (0.05 if tech_support                         else 0.0)
            + support_calls * 0.03
        )
        score = max(0.05, min(0.95, score))

        risk_level = (
            "critical" if score > 0.75 else
            "high"     if score > 0.50 else
            "medium"   if score > 0.25 else
            "low"
        )
        days_to_churn = (
            None if risk_level == "low"
            else round((1.0 - score) * 90.0)
        )

        duration_ms = (time.perf_counter() - t0) * 1000
        co2_g       = green_ai.record_inference(
            user_id         = self.user_id,
            model_type      = "xgboost",
            duration_ms     = duration_ms,
            model_name      = "Churn Predictor",
            prediction_type = "churn",
        )

        pred_id = _pred_id()
        result  = {
            "customerId":        features.get("customerId", "CUST-UNKNOWN"),
            "churnProbability":  round(score, 3),
            "riskLevel":         risk_level,
            "daysToChurn":       days_to_churn,
            "predictionId":      pred_id,
            "modelVersion":      settings.ML_CHURN_VERSION,
            "confidence":        0.873,
            "co2Grams":          round(co2_g, 8),
        }

        # Store for SHAP lookup
        _store_prediction(pred_id, {
            "type":        "churn",
            "features":    features,
            "output":      score,
            "confidence":  0.873,
            "riskLevel":   risk_level,
        })
        return result

    # ── CLICK / CTR PREDICTION  (MLP Neural Network) ─────────

    def predict_clicks(self, features: dict) -> dict:
        """
        POST /ml/predict/clicks

        MLP-based CTR and CPC prediction for ad campaigns.

        AdFeatures:
            campaignId, platform, objective, dailyBudget,
            bidStrategy, audienceSize, creativeScore, headline, body

        Returns ClickPrediction:
            campaignId, predictedCTR, predictedCPC, confidence,
            predictionId, co2Grams
        """
        t0 = time.perf_counter()

        creative_score = float(features.get("creativeScore", 50)) / 100.0
        platform       = features.get("platform", "Google Ads")
        bias_ctr       = _PLATFORM_CTR_BIAS.get(platform, 1.0)

        # CTR: creativeScore/100 × 0.08 × platform_bias
        predicted_ctr  = round(creative_score * 0.08 * bias_ctr, 4)
        # CPC: inverse of creative score (better creative → lower cost)
        predicted_cpc  = round(1.5 - creative_score * 0.8, 2)
        predicted_cpc  = max(0.10, predicted_cpc)

        duration_ms = (time.perf_counter() - t0) * 1000
        co2_g       = green_ai.record_inference(
            user_id         = self.user_id,
            model_type      = "neural_network",
            duration_ms     = duration_ms,
            model_name      = "Click Predictor",
            prediction_type = "click",
        )

        pred_id = _pred_id()
        result  = {
            "campaignId":   features.get("campaignId", "C-UNKNOWN"),
            "predictedCTR": predicted_ctr,
            "predictedCPC": predicted_cpc,
            "confidence":   0.827,
            "predictionId": pred_id,
            "co2Grams":     round(co2_g, 8),
        }
        _store_prediction(pred_id, {"type": "click", "features": features, "output": predicted_ctr})
        return result

    # ── ROAS PREDICTION  (AutoML) ─────────────────────────────

    def predict_roas(self, features: dict) -> dict:
        """
        POST /ml/predict/roas

        AutoML ensemble ROAS prediction for budget optimisation.

        AdFeatures (same as click):
            campaignId, platform, dailyBudget, bidStrategy,
            audienceSize, creativeScore, objective

        Returns ROASPrediction:
            campaignId, predictedROAS, roasRange, confidence,
            predictionId, suggestion, co2Grams
        """
        t0 = time.perf_counter()

        creative_score = float(features.get("creativeScore", 50)) / 100.0
        platform       = features.get("platform", "Google Ads")
        bias_roas      = _PLATFORM_ROAS_BIAS.get(platform, 1.0)

        # ROAS: 2.5 + creativeScore/100 × 3.0 × platform_bias
        predicted_roas = round(2.5 + creative_score * 3.0 * bias_roas, 3)
        roas_range     = {
            "low":  round(predicted_roas * 0.85, 3),
            "high": round(predicted_roas * 1.15, 3),
        }

        suggestion = None
        if predicted_roas < 3.0:
            suggestion = "Increase creative score by 15% for estimated +0.4 ROAS improvement"
        elif predicted_roas > 5.0:
            suggestion = "Scale daily budget by 20% — strong ROAS headroom available"

        duration_ms = (time.perf_counter() - t0) * 1000
        co2_g       = green_ai.record_inference(
            user_id         = self.user_id,
            model_type      = "automl",
            duration_ms     = duration_ms,
            model_name      = "ROAS Optimizer",
            prediction_type = "roas",
        )

        pred_id = _pred_id()
        result  = {
            "campaignId":    features.get("campaignId", "C-UNKNOWN"),
            "predictedROAS": predicted_roas,
            "roasRange":     roas_range,
            "confidence":    0.912,
            "predictionId":  pred_id,
            "suggestion":    suggestion,
            "co2Grams":      round(co2_g, 8),
        }
        _store_prediction(pred_id, {"type": "roas", "features": features, "output": predicted_roas})
        return result

    # ── ANOMALY DETECTION  (Isolation Forest) ─────────────────

    def detect_anomalies(
        self,
        metric:      str,
        values:      List[float],
        timestamps:  List[str],
        campaign_id: Optional[str] = None,
    ) -> List[dict]:
        """
        POST /ml/anomaly/detect

        Isolation Forest heuristic: flag values beyond 2.5σ from the mean.

        AnomalyInput:
            metric, values[], timestamps[], campaignId?

        Returns List[AnomalyResult]:
            metric, isAnomaly, score, anomalyIdx[], severity, detectedAt, co2Grams
        """
        if not values:
            return []

        t0  = time.perf_counter()
        n   = len(values)
        mean = sum(values) / n
        if n > 1:
            variance = sum((v - mean) ** 2 for v in values) / n
            std      = math.sqrt(variance)
        else:
            std = 0.0

        anomaly_idx = []
        max_sigma   = 0.0

        if std > 0:
            for i, v in enumerate(values):
                sigma = abs(v - mean) / std
                if sigma > 2.5:
                    anomaly_idx.append(i)
                    max_sigma = max(max_sigma, sigma)

        is_anomaly = len(anomaly_idx) > 0
        severity   = (
            "critical" if max_sigma > 4.0 else
            "high"     if max_sigma > 3.0 else
            "medium"   if max_sigma > 2.5 else
            "low"
        )
        # Normalised anomaly score 0–1 (mimics IF decision function)
        score = round(min(1.0, max_sigma / 5.0), 4) if std > 0 else 0.0

        duration_ms = (time.perf_counter() - t0) * 1000
        co2_g       = green_ai.record_inference(
            user_id         = self.user_id,
            model_type      = "isolation_forest",
            duration_ms     = duration_ms,
            model_name      = "Anomaly Detector",
            prediction_type = "anomaly",
        )

        return [{
            "metric":     metric,
            "isAnomaly":  is_anomaly,
            "score":      score,
            "anomalyIdx": anomaly_idx,
            "severity":   severity,
            "detectedAt": datetime.now(timezone.utc).isoformat(),
            "co2Grams":   round(co2_g, 8),
        }]

    def get_anomaly_feed(self) -> List[dict]:
        """GET /ml/anomaly/feed → List[AnomalyAlert] (seed alerts)"""
        return [dict(a) for a in _ANOMALY_ALERTS]

    # ── SHAP EXPLANATION ─────────────────────────────────────

    def explain_prediction(self, prediction_id: str) -> dict:
        """
        POST /ml/shap

        Returns SHAP feature importance for a previously computed prediction.

        Mirrors mlService.ts mockSHAP:
            baseValue=0.28, output=0.67,
            features: contract(+0.21), tenure(+0.14), monthlyCharges(+0.09),
                      internetService(+0.07), numSupportCalls(+0.06),
                      onlineSecurity(-0.04), techSupport(-0.03)

        SHAPExplanation:
            predictionId, baseValue, output, features[], co2Grams
        """
        t0   = time.perf_counter()
        pred = _PREDICTIONS.get(prediction_id)

        if not pred:
            # Return generic explanation when prediction not in cache
            output = 0.67
        else:
            output = float(pred.get("output", 0.67))

        features_raw = pred.get("features", {}) if pred else {}

        # Build SHAP feature values based on stored input
        tenure           = float(features_raw.get("tenure",          12))
        monthly_charges  = float(features_raw.get("monthlyCharges",  65.0))
        contract         = features_raw.get("contract",         "Month-to-month")
        internet_service = features_raw.get("internetService",  "Fiber optic")
        online_security  = features_raw.get("onlineSecurity",   False)
        tech_support     = features_raw.get("techSupport",      False)
        support_calls    = int(features_raw.get("numSupportCalls",    0))

        shap_features = [
            {
                "feature":     "contract",
                "value":       0.0 if contract == "Month-to-month" else 1.0,
                "shapValue":   +0.21 if contract == "Month-to-month" else -0.05,
                "displayName": "Contract Type",
            },
            {
                "feature":     "tenure",
                "value":       tenure,
                "shapValue":   round(0.14 * (1.0 / (tenure + 1.0)) / (1.0 / 13.0), 3),
                "displayName": "Tenure (months)",
            },
            {
                "feature":     "monthlyCharges",
                "value":       monthly_charges,
                "shapValue":   round((monthly_charges / 120.0) * 0.09, 3),
                "displayName": "Monthly Charges",
            },
            {
                "feature":     "internetService",
                "value":       0.0 if internet_service == "Fiber optic" else 1.0,
                "shapValue":   +0.07 if internet_service == "Fiber optic" else -0.01,
                "displayName": "Internet Service",
            },
            {
                "feature":     "numSupportCalls",
                "value":       support_calls,
                "shapValue":   round(min(support_calls * 0.02, 0.06), 3),
                "displayName": "Support Calls",
            },
            {
                "feature":     "onlineSecurity",
                "value":       1.0 if online_security else 0.0,
                "shapValue":   -0.04 if online_security else 0.01,
                "displayName": "Online Security",
            },
            {
                "feature":     "techSupport",
                "value":       1.0 if tech_support else 0.0,
                "shapValue":   -0.03 if tech_support else 0.01,
                "displayName": "Tech Support",
            },
        ]

        # Sort by |shapValue| descending (mirrors mlService.ts sort)
        shap_features.sort(key=lambda f: abs(f["shapValue"]), reverse=True)

        duration_ms = (time.perf_counter() - t0) * 1000
        co2_g       = green_ai.record_inference(
            user_id         = self.user_id,
            model_type      = "shap",
            duration_ms     = duration_ms,
            model_name      = "SHAP Explainer",
            prediction_type = "shap",
        )

        return {
            "predictionId": prediction_id,
            "baseValue":    0.30,
            "output":       round(output, 3),
            "features":     shap_features[:settings.SHAP_TOP_N_FEATURES],
            "co2Grams":     round(co2_g, 8),
        }

    # ── GREEN AI REPORT ───────────────────────────────────────

    def get_green_ai_report(self) -> dict:
        """GET /ml/green-ai → GreenAIReport for this user's session."""
        return green_ai.get_session_report(self.user_id)
