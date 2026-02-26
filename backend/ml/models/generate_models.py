"""
generate_models.py — Script único para crear todos los binarios de ML.
Ejecutar desde: backend/  →  python ml/models/generate_models.py

Arquitecturas (input_dim = 20 features procesadas Telecom X)
──────────────────────────────────────────────────────────────
LumindAd_MLP.keras
  Dense(128, relu) → BN → Dropout(0.3)
  Dense(64,  relu) → BN → Dropout(0.2)
  Dense(32,  relu) → Dense(1, sigmoid)
  Params ~12K  ·  binary_crossentropy  ·  Adam lr=1e-3

LumindAd_LSTM.keras
  Input shape (10, 20) — 10 timesteps, 20 features
  LSTM(64, return_sequences=True) → Dropout(0.2)
  LSTM(32) → Dropout(0.2)
  Dense(16, relu) → Dense(1, sigmoid)
  Params ~23K  ·  binary_crossentropy  ·  Adam lr=5e-4

LumindAd_CNN1D.keras
  Input shape (10, 20)
  Conv1D(64, kernel=3, relu) → MaxPool1D(2)
  Conv1D(32, kernel=3, relu) → GlobalMaxPool1D
  Dense(32, relu) → Dropout(0.2) → Dense(1, sigmoid)
  Params ~8K  ·  binary_crossentropy  ·  Adam lr=1e-3

LumindAd_Autoencoder.keras
  Encoder: Dense(16, relu) → Dense(8, relu) → Dense(4, relu) [bottleneck]
  Decoder: Dense(8, relu) → Dense(16, relu) → Dense(20, linear)
  MSE loss  ·  Adam lr=1e-3  (anomaly score = reconstruction error)

best_ml_XGBoost.pkl
  XGBClassifier n_estimators=200 max_depth=6 learning_rate=0.05
  subsample=0.8 colsample_bytree=0.8 gamma=0.1 use_label_encoder=False
  Fitted on 1000 synthetic Telecom X samples (seed=42)

scaler_robust.pkl
  RobustScaler() fitted on the same 1000 synthetic samples
  Clips outliers at IQR [Q25, Q75] — robust to extreme charges

Features (20 after encoding)
──────────────────────────────
numerical (8) : tenure, monthlyCharges, totalCharges,
                numSupportCalls, numAddonServices,
                avgCallDuration, dataUsageGB, roamingCalls
binary    (7) : onlineSecurity, techSupport, streamingTV,
                paperlessBilling, seniorCitizen,
                hasPartner, hasDependents
encoded   (5) : contract_one_year, contract_two_year,
                internet_fiber, internet_dsl,
                payment_credit_card
"""

import sys
import numpy as np
import pickle
from pathlib import Path

# ── Output directory (same folder as this script) ─────────────────────────────
OUT_DIR = Path(__file__).parent
OUT_DIR.mkdir(parents=True, exist_ok=True)

RNG = np.random.default_rng(42)

INPUT_DIM  = 20   # features after encoding
SEQ_LEN    = 10   # timesteps for LSTM / CNN1D
N_SAMPLES  = 1000

print("━" * 60)
print("  LumindAd · ML Model Generator")
print(f"  Output: {OUT_DIR}")
print("━" * 60)


# ═══════════════════════════════════════════════════════════════
# SYNTHETIC TELECOM X DATASET
# ═══════════════════════════════════════════════════════════════

def make_dataset(n: int = N_SAMPLES):
    """
    Synthetic Telecom X dataset — 20 engineered features + churn label.
    Label rule mirrors the heuristic in ml_service.py so the fitted
    models approximate the same decision boundary.
    """
    tenure           = RNG.integers(1, 72,  n).astype(float)
    monthly_charges  = RNG.uniform(20, 120, n)
    total_charges    = tenure * monthly_charges + RNG.uniform(-50, 50, n)
    total_charges    = np.clip(total_charges, 0, None)
    support_calls    = RNG.integers(0, 10, n).astype(float)
    addon_services   = RNG.integers(0, 5,  n).astype(float)
    avg_call_dur     = RNG.uniform(1, 30, n)
    data_usage       = RNG.uniform(0, 50, n)
    roaming_calls    = RNG.integers(0, 20, n).astype(float)

    online_security  = RNG.integers(0, 2, n).astype(float)
    tech_support     = RNG.integers(0, 2, n).astype(float)
    streaming_tv     = RNG.integers(0, 2, n).astype(float)
    paperless_bill   = RNG.integers(0, 2, n).astype(float)
    senior           = RNG.integers(0, 2, n).astype(float)
    has_partner      = RNG.integers(0, 2, n).astype(float)
    has_dependents   = RNG.integers(0, 2, n).astype(float)

    contract_type    = RNG.integers(0, 3, n)   # 0=M2M, 1=1yr, 2=2yr
    internet_type    = RNG.integers(0, 3, n)   # 0=None, 1=DSL, 2=Fiber
    payment_type     = RNG.integers(0, 4, n)   # 0=EC, 1=MCheck, 2=BT, 3=CCard

    contract_one_year = (contract_type == 1).astype(float)
    contract_two_year = (contract_type == 2).astype(float)
    internet_fiber    = (internet_type == 2).astype(float)
    internet_dsl      = (internet_type == 1).astype(float)
    payment_cc        = (payment_type  == 3).astype(float)

    X = np.stack([
        tenure, monthly_charges, total_charges,
        support_calls, addon_services, avg_call_dur, data_usage, roaming_calls,
        online_security, tech_support, streaming_tv, paperless_bill,
        senior, has_partner, has_dependents,
        contract_one_year, contract_two_year, internet_fiber, internet_dsl, payment_cc,
    ], axis=1)  # (N, 20)

    # Label: mirrors ml_service.py heuristic
    score = (
        0.10
        + (monthly_charges / 120.0) * 0.30
        + (1.0 / (tenure + 1.0))    * 0.40
        + (1 - contract_one_year - contract_two_year) * 0.20
        + internet_fiber * 0.10
        - online_security * 0.05
        - tech_support    * 0.05
        + support_calls   * 0.03
    )
    score = np.clip(score, 0.05, 0.95)
    y     = (score > 0.50).astype(int)

    return X, y


X_raw, y = make_dataset()
print(f"  Dataset: {X_raw.shape}  churn_rate={y.mean():.1%}")


# ═══════════════════════════════════════════════════════════════
# 1. ROBUST SCALER
# ═══════════════════════════════════════════════════════════════

from sklearn.preprocessing import RobustScaler

scaler = RobustScaler()
X_scaled = scaler.fit_transform(X_raw)

scaler_path = OUT_DIR / "scaler_robust.pkl"
with open(scaler_path, "wb") as f:
    pickle.dump(scaler, f, protocol=5)

print(f"✅ scaler_robust.pkl  ({scaler_path.stat().st_size:,} B)")


# ═══════════════════════════════════════════════════════════════
# 2. XGBOOST
# ═══════════════════════════════════════════════════════════════

from xgboost import XGBClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import roc_auc_score

X_tr, X_te, y_tr, y_te = train_test_split(X_scaled, y, test_size=0.2,
                                            random_state=42, stratify=y)

xgb = XGBClassifier(
    n_estimators=200,
    max_depth=6,
    learning_rate=0.05,
    subsample=0.8,
    colsample_bytree=0.8,
    gamma=0.1,
    random_state=42,
    eval_metric="logloss",
    verbosity=0,
)
xgb.fit(X_tr, y_tr, eval_set=[(X_te, y_te)], verbose=False)
auc = roc_auc_score(y_te, xgb.predict_proba(X_te)[:, 1])

xgb_path = OUT_DIR / "best_ml_XGBoost.pkl"
with open(xgb_path, "wb") as f:
    pickle.dump(xgb, f, protocol=5)

print(f"✅ best_ml_XGBoost.pkl  AUC={auc:.4f}  ({xgb_path.stat().st_size:,} B)")


# ═══════════════════════════════════════════════════════════════
# 3. KERAS MODELS
# ═══════════════════════════════════════════════════════════════

import os
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "3"

import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers

tf.random.set_seed(42)
EPOCHS = 10
BATCH  = 64

# ── 3a. MLP ───────────────────────────────────────────────────
mlp = keras.Sequential([
    keras.Input(shape=(INPUT_DIM,), name="mlp_input"),
    layers.Dense(128, activation="relu", name="dense_1"),
    layers.BatchNormalization(name="bn_1"),
    layers.Dropout(0.30, name="drop_1"),
    layers.Dense(64,  activation="relu", name="dense_2"),
    layers.BatchNormalization(name="bn_2"),
    layers.Dropout(0.20, name="drop_2"),
    layers.Dense(32,  activation="relu", name="dense_3"),
    layers.Dense(1,   activation="sigmoid", name="output"),
], name="LumindAd_MLP")

mlp.compile(
    optimizer=keras.optimizers.Adam(learning_rate=1e-3),
    loss="binary_crossentropy",
    metrics=["accuracy", keras.metrics.AUC(name="auc")],
)
mlp.fit(X_scaled, y, epochs=EPOCHS, batch_size=BATCH,
        validation_split=0.15, verbose=0)

mlp_path = OUT_DIR / "LumindAd_MLP.keras"
mlp.save(mlp_path)
_, acc, auc_mlp = mlp.evaluate(X_scaled, y, verbose=0)
print(f"✅ LumindAd_MLP.keras   acc={acc:.4f} auc={auc_mlp:.4f}  ({mlp_path.stat().st_size:,} B)")


# ── 3b. LSTM ──────────────────────────────────────────────────
# Reshape X → (N, SEQ_LEN, INPUT_DIM) by tiling the feature vector
X_seq = np.tile(X_scaled[:, np.newaxis, :], (1, SEQ_LEN, 1))  # (N, 10, 20)

lstm = keras.Sequential([
    keras.Input(shape=(SEQ_LEN, INPUT_DIM), name="lstm_input"),
    layers.LSTM(64, return_sequences=True, name="lstm_1"),
    layers.Dropout(0.20, name="drop_lstm_1"),
    layers.LSTM(32, return_sequences=False, name="lstm_2"),
    layers.Dropout(0.20, name="drop_lstm_2"),
    layers.Dense(16, activation="relu",    name="dense_lstm"),
    layers.Dense(1,  activation="sigmoid", name="output"),
], name="LumindAd_LSTM")

lstm.compile(
    optimizer=keras.optimizers.Adam(learning_rate=5e-4),
    loss="binary_crossentropy",
    metrics=["accuracy", keras.metrics.AUC(name="auc")],
)
lstm.fit(X_seq, y, epochs=EPOCHS, batch_size=BATCH,
         validation_split=0.15, verbose=0)

lstm_path = OUT_DIR / "LumindAd_LSTM.keras"
lstm.save(lstm_path)
_, acc, auc_lstm = lstm.evaluate(X_seq, y, verbose=0)
print(f"✅ LumindAd_LSTM.keras  acc={acc:.4f} auc={auc_lstm:.4f}  ({lstm_path.stat().st_size:,} B)")


# ── 3c. CNN-1D ────────────────────────────────────────────────
cnn = keras.Sequential([
    keras.Input(shape=(SEQ_LEN, INPUT_DIM), name="cnn_input"),
    layers.Conv1D(64, kernel_size=3, activation="relu", padding="same", name="conv_1"),
    layers.MaxPooling1D(pool_size=2, name="pool_1"),
    layers.Conv1D(32, kernel_size=3, activation="relu", padding="same", name="conv_2"),
    layers.GlobalMaxPooling1D(name="global_pool"),
    layers.Dense(32,  activation="relu",    name="dense_cnn"),
    layers.Dropout(0.20, name="drop_cnn"),
    layers.Dense(1,   activation="sigmoid", name="output"),
], name="LumindAd_CNN1D")

cnn.compile(
    optimizer=keras.optimizers.Adam(learning_rate=1e-3),
    loss="binary_crossentropy",
    metrics=["accuracy", keras.metrics.AUC(name="auc")],
)
cnn.fit(X_seq, y, epochs=EPOCHS, batch_size=BATCH,
        validation_split=0.15, verbose=0)

cnn_path = OUT_DIR / "LumindAd_CNN1D.keras"
cnn.save(cnn_path)
_, acc, auc_cnn = cnn.evaluate(X_seq, y, verbose=0)
print(f"✅ LumindAd_CNN1D.keras acc={acc:.4f} auc={auc_cnn:.4f}  ({cnn_path.stat().st_size:,} B)")


# ── 3d. AUTOENCODER ───────────────────────────────────────────
ae_input = keras.Input(shape=(INPUT_DIM,), name="ae_input")
encoded  = layers.Dense(16, activation="relu",    name="enc_1")(ae_input)
encoded  = layers.Dense(8,  activation="relu",    name="enc_2")(encoded)
bottleneck = layers.Dense(4, activation="relu",   name="bottleneck")(encoded)
decoded  = layers.Dense(8,  activation="relu",    name="dec_1")(bottleneck)
decoded  = layers.Dense(16, activation="relu",    name="dec_2")(decoded)
ae_out   = layers.Dense(INPUT_DIM, activation="linear", name="ae_output")(decoded)

autoencoder = keras.Model(inputs=ae_input, outputs=ae_out,
                           name="LumindAd_Autoencoder")
autoencoder.compile(
    optimizer=keras.optimizers.Adam(learning_rate=1e-3),
    loss="mse",
    metrics=["mae"],
)
autoencoder.fit(X_scaled, X_scaled, epochs=EPOCHS, batch_size=BATCH,
                validation_split=0.15, verbose=0)

ae_path = OUT_DIR / "LumindAd_Autoencoder.keras"
autoencoder.save(ae_path)
mse, mae = autoencoder.evaluate(X_scaled, X_scaled, verbose=0)
print(f"✅ LumindAd_Autoencoder.keras  mse={mse:.6f} mae={mae:.6f}  ({ae_path.stat().st_size:,} B)")


# ─── Summary ──────────────────────────────────────────────────
print()
print("━" * 60)
print(f"  Generated 6 model files in {OUT_DIR}")
for f in sorted(OUT_DIR.glob("*.keras")) + sorted(OUT_DIR.glob("*.pkl")):
    print(f"  • {f.name:<35} {f.stat().st_size:>8,} B")
print("━" * 60)
