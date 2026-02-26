# backend/ml/inference/__init__.py
"""
LumindAd Enterprise · backend/ml/inference
Unified ML prediction interface.

Public API
───────────
from ml.inference.predictor import warm_up           # pre-load all models
from ml.inference.predictor import model_status      # {name: loaded|unavailable}
from ml.inference.predictor import models_available  # bool — XGBoost ready
from ml.inference.predictor import predict_churn     # ensemble XGBoost+MLP+CNN+LSTM
from ml.inference.predictor import predict_churn_batch  # batch forward pass
from ml.inference.predictor import detect_anomaly    # Autoencoder MSE score
from ml.inference.predictor import detect_anomaly_batch  # σ-based time-series
from ml.inference.predictor import predict_clicks    # CTR + CPC (MLP)
from ml.inference.predictor import predict_roas      # ROAS prediction (XGBoost)
from ml.inference.predictor import explain_shap      # TreeSHAP / perturbation approx

Integration
────────────
app/services/ml_service.py delegates to this module when model
files are present (models_available() returns True).
Falls back to heuristic approximations otherwise.

Call warm_up() once at application startup (events.py lifespan)
to pre-load all 6 models and avoid cold-start latency.

Author : Elizabeth Díaz Familia
         AI Data Scientist · Sustainable Intelligence & BI
"""

from .predictor import (
    warm_up,
    model_status,
    models_available,
    predict_churn,
    predict_churn_batch,
    detect_anomaly,
    detect_anomaly_batch,
    predict_clicks,
    predict_roas,
    explain_shap,
    build_feature_vector,
    preprocess,
    FEATURE_NAMES,
    INPUT_DIM,
    SEQ_LEN,
)

__all__ = [
    "warm_up", "model_status", "models_available",
    "predict_churn", "predict_churn_batch",
    "detect_anomaly", "detect_anomaly_batch",
    "predict_clicks", "predict_roas",
    "explain_shap",
    "build_feature_vector", "preprocess",
    "FEATURE_NAMES", "INPUT_DIM", "SEQ_LEN",
]
