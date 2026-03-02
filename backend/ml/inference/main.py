"""
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  LumindAd Enterprise · backend/ml/inference/main.py
  FastAPI ML Inference Microservice — port 8001

  Endpoints
  ──────────
  GET  /health              Liveness + model status
  GET  /models/status       Per-model load status
  POST /predict/churn       Ensemble churn prediction
  POST /predict/clicks      CTR / CPC prediction (MLP)
  POST /predict/roas        ROAS prediction (XGBoost)
  POST /predict/anomaly     Anomaly detection (Autoencoder)
  POST /explain             SHAP feature explanations

  Startup
  ────────
  lifespan event calls predictor.warm_up() so all 6 model
  files are loaded into memory before the first request.

  Author : Elizabeth Díaz Familia
           AI Data Scientist · Sustainable Intelligence & BI
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"""

from __future__ import annotations

import logging
import os
import time
from contextlib import asynccontextmanager
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from ml.inference import predictor

logger = logging.getLogger(__name__)

# ═══════════════════════════════════════════════════════════════
# LIFESPAN — warm up all models at startup
# ═══════════════════════════════════════════════════════════════

@asynccontextmanager
async def lifespan(application: FastAPI):
    """Pre-load all ML models on startup to avoid cold-start latency."""
    logger.info("🤖 LumindAd ML Service starting — warming up models...")
    try:
        load_times = predictor.warm_up()
        for model_name, ms in load_times.items():
            logger.info("  ✓ %-20s loaded in %.0f ms", model_name, ms)
        logger.info("🟢 All models ready — inference service live on :8001")
    except Exception as exc:
        logger.warning("⚠️  Model warm-up failed (%s) — heuristic fallback active", exc)
    yield
    logger.info("ML service shutting down.")


# ═══════════════════════════════════════════════════════════════
# APP
# ═══════════════════════════════════════════════════════════════

app = FastAPI(
    title="LumindAd ML Inference Service",
    description=(
        "Ensemble ML inference: XGBoost · TensorFlow MLP · CNN-1D · LSTM · "
        "Autoencoder anomaly detection · SHAP explainability · Green AI telemetry"
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# CORS — allow backend service and dev origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8000",
        "http://backend:8000",
        "http://localhost:5173",
        os.getenv("VITE_API_URL", ""),
    ],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


# ═══════════════════════════════════════════════════════════════
# SCHEMAS
# ═══════════════════════════════════════════════════════════════

class CustomerFeatures(BaseModel):
    """Raw customer feature dict — supports both camelCase and snake_case keys."""
    # Numerical
    tenure:            Optional[float] = Field(None, description="Tenure in months")
    monthlyCharges:    Optional[float] = Field(None, alias="monthly_charges")
    totalCharges:      Optional[float] = Field(None, alias="total_charges")
    numSupportCalls:   Optional[float] = Field(None, alias="num_support_calls")
    numAddonServices:  Optional[float] = Field(None, alias="num_addon_services")
    avgCallDuration:   Optional[float] = Field(None, alias="avg_call_duration")
    dataUsageGB:       Optional[float] = Field(None, alias="data_usage_gb")
    roamingCalls:      Optional[float] = Field(None, alias="roaming_calls")
    # Binary
    onlineSecurity:    Optional[Any]   = Field(None, alias="online_security")
    techSupport:       Optional[Any]   = Field(None, alias="tech_support")
    streamingTV:       Optional[Any]   = Field(None, alias="streaming_tv")
    paperlessBilling:  Optional[Any]   = Field(None, alias="paperless_billing")
    seniorCitizen:     Optional[Any]   = Field(None, alias="senior_citizen")
    hasPartner:        Optional[Any]   = Field(None, alias="has_partner")
    hasDependents:     Optional[Any]   = Field(None, alias="has_dependents")
    # Categorical
    contract:          Optional[str]   = Field(None)
    internetService:   Optional[str]   = Field(None, alias="internet_service")
    paymentMethod:     Optional[str]   = Field(None, alias="payment_method")

    model_config = {"populate_by_name": True}

    def to_raw_dict(self) -> Dict[str, Any]:
        return {k: v for k, v in self.model_dump(by_alias=False).items() if v is not None}


class AdFeatures(BaseModel):
    """Ad / campaign feature dict for CTR and ROAS prediction."""
    platform:       Optional[str]   = "Google Ads"
    objective:      Optional[str]   = "Conversions"
    dailyBudget:    Optional[float] = Field(50.0,  alias="daily_budget")
    audienceSize:   Optional[float] = Field(1000.0, alias="audience_size")
    campaignAgeDays: Optional[float] = Field(30.0, alias="campaign_age_days")
    creativeScore:  Optional[float] = Field(50.0,  alias="creative_score")

    model_config = {"populate_by_name": True}

    def to_raw_dict(self) -> Dict[str, Any]:
        return {k: v for k, v in self.model_dump(by_alias=False).items() if v is not None}


class ExplainRequest(BaseModel):
    features:   CustomerFeatures
    n_features: int = Field(15, ge=1, le=20)


# ═══════════════════════════════════════════════════════════════
# HEALTH
# ═══════════════════════════════════════════════════════════════

@app.get("/health", tags=["System"])
async def health() -> Dict[str, Any]:
    """
    Liveness probe — returns model load status and service metadata.
    Docker HEALTHCHECK and Kubernetes readiness probe target this endpoint.
    """
    status = predictor.model_status()
    loaded = sum(1 for v in status.values() if v == "loaded")
    return {
        "status":        "healthy",
        "service":       "lumindad-ml",
        "version":       "1.0.0",
        "models_loaded": loaded,
        "models_total":  len(status),
        "model_status":  status,
        "green_ai":      os.getenv("GREEN_AI_ENABLED", "true") == "true",
    }


# ═══════════════════════════════════════════════════════════════
# MODEL STATUS
# ═══════════════════════════════════════════════════════════════

@app.get("/models/status", tags=["Models"])
async def models_status() -> Dict[str, Any]:
    """Return load status for all 6 model files."""
    status = predictor.model_status()
    return {
        "models": status,
        "available": predictor.models_available(),
    }


# ═══════════════════════════════════════════════════════════════
# CHURN PREDICTION
# ═══════════════════════════════════════════════════════════════

@app.post("/predict/churn", tags=["Inference"])
async def predict_churn(features: CustomerFeatures) -> Dict[str, Any]:
    """
    Ensemble churn prediction — XGBoost (0.40) + MLP (0.25) +
    CNN-1D (0.20) + LSTM (0.15).

    Returns probability, binary label, risk tier and per-model
    breakdown.
    """
    try:
        result = predictor.predict_churn(features.to_raw_dict())
        return result
    except Exception as exc:
        logger.exception("Churn prediction failed")
        raise HTTPException(status_code=500, detail=str(exc))


# ═══════════════════════════════════════════════════════════════
# ANOMALY DETECTION
# ═══════════════════════════════════════════════════════════════

@app.post("/predict/anomaly", tags=["Inference"])
async def predict_anomaly(features: CustomerFeatures) -> Dict[str, Any]:
    """
    Autoencoder anomaly detection.

    Returns anomaly_score (MSE reconstruction error), is_anomaly flag
    and severity level (critical / high / medium / low).
    """
    try:
        result = predictor.detect_anomaly(features.to_raw_dict())
        return result
    except Exception as exc:
        logger.exception("Anomaly detection failed")
        raise HTTPException(status_code=500, detail=str(exc))


# ═══════════════════════════════════════════════════════════════
# CTR / CPC PREDICTION
# ═══════════════════════════════════════════════════════════════

@app.post("/predict/clicks", tags=["Inference"])
async def predict_clicks(features: AdFeatures) -> Dict[str, Any]:
    """
    CTR and CPC prediction for an ad creative using MLP forward pass.

    Returns predictedCTR, predictedCPC, confidence and durationMs.
    """
    try:
        result = predictor.predict_clicks(features.to_raw_dict())
        return result
    except Exception as exc:
        logger.exception("Click prediction failed")
        raise HTTPException(status_code=500, detail=str(exc))


# ═══════════════════════════════════════════════════════════════
# ROAS PREDICTION
# ═══════════════════════════════════════════════════════════════

@app.post("/predict/roas", tags=["Inference"])
async def predict_roas(features: AdFeatures) -> Dict[str, Any]:
    """
    ROAS prediction using XGBoost decision tree.

    Returns predictedROAS, roasRange (low/high), confidence and durationMs.
    """
    try:
        result = predictor.predict_roas(features.to_raw_dict())
        return result
    except Exception as exc:
        logger.exception("ROAS prediction failed")
        raise HTTPException(status_code=500, detail=str(exc))


# ═══════════════════════════════════════════════════════════════
# SHAP EXPLANATIONS
# ═══════════════════════════════════════════════════════════════

@app.post("/explain", tags=["Explainability"])
async def explain(request: ExplainRequest) -> Dict[str, Any]:
    """
    TreeSHAP explanation using the XGBoost model.

    Returns baseValue, output probability and top-N feature
    contributions sorted by |shapValue| descending.
    """
    try:
        result = predictor.explain_shap(
            request.features.to_raw_dict(),
            n_features=request.n_features,
        )
        return result
    except Exception as exc:
        logger.exception("SHAP explanation failed")
        raise HTTPException(status_code=500, detail=str(exc))
