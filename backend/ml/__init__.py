# backend/ml/__init__.py
"""
LumindAd Enterprise · backend/ml
ML model artefacts + unified inference interface.

Structure
──────────
ml/
├── models/          Trained model binaries (Keras + pkl)
│   ├── LumindAd_MLP.keras          Dense 128→64→32→1   (13,825 params)
│   ├── LumindAd_LSTM.keras         LSTM 64→32→1        (34,721 params)
│   ├── LumindAd_CNN1D.keras        Conv1D 64→32→1      (11,169 params)
│   ├── LumindAd_Autoencoder.keras  AE 20→4→20          ( 1,032 params)
│   ├── best_ml_XGBoost.pkl         XGB n=200 d=6 lr=0.05
│   └── scaler_robust.pkl           RobustScaler 20 features
└── inference/
    └── predictor.py    Unified prediction interface

Usage
──────
from ml.inference.predictor import (
    warm_up, predict_churn, detect_anomaly,
    predict_clicks, predict_roas, explain_shap,
)

Author : Elizabeth Díaz Familia
         AI Data Scientist · Sustainable Intelligence & BI
"""
