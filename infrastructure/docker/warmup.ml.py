"""
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  LumindAd Enterprise · infrastructure/docker/warmup.ml.py
  ML Model Pre-Warm Script

  Loads all 8 models into memory at container startup so the
  first inference request is served instantly (no cold load).

  Models (4 Classical ML + 4 Deep Learning)
  ──────────────────────────────────────────
  Classical ML:
    · Logistic Regression  (.pkl)
    · Random Forest        (.pkl)
    · XGBoost              (.pkl) ← best model F1=0.6171
    · K-Nearest Neighbors  (.pkl)

  Deep Learning (TensorFlow/Keras):
    · MLP       (.keras / .h5)
    · LSTM      (.keras / .h5)
    · CNN-1D    (.keras / .h5)
    · Autoencoder (.keras / .h5)

  Invoked by:
    CMD uvicorn ml.inference.predictor:app ...
    (lifespan startup event calls warmup())

  Author : Elizabeth Díaz Familia
           AI Data Scientist · Sustainable Intelligence & BI
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"""

from __future__ import annotations

import logging
import os
import time
from pathlib import Path

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [warmup] %(levelname)s — %(message)s",
)
logger = logging.getLogger("lumindad.warmup")

MODEL_DIR = Path(os.environ.get("MODEL_DIR", "/app/models"))

# ─── Classical ML model filenames ────────────────────────────
CLASSICAL_MODELS = [
    "logistic_regression.pkl",
    "random_forest.pkl",
    "xgboost.pkl",
    "knn.pkl",
]

# ─── Deep Learning model filenames ───────────────────────────
DEEP_LEARNING_MODELS = [
    "mlp.keras",
    "lstm.keras",
    "cnn1d.keras",
    "autoencoder.keras",
    # Fallback to .h5 if .keras not present
    "mlp.h5",
    "lstm.h5",
    "cnn1d.h5",
    "autoencoder.h5",
]


def _warmup_classical() -> int:
    """Load classical ML models with joblib."""
    loaded = 0
    try:
        import joblib
    except ImportError:
        logger.warning("joblib not available — skipping classical ML warmup")
        return 0

    for filename in CLASSICAL_MODELS:
        model_path = MODEL_DIR / filename
        if model_path.exists():
            try:
                t0 = time.perf_counter()
                joblib.load(model_path)
                elapsed = (time.perf_counter() - t0) * 1000
                logger.info(f"  ✅ {filename:<35} loaded in {elapsed:6.1f}ms")
                loaded += 1
            except Exception as exc:
                logger.warning(f"  ⚠️  {filename} — failed to load: {exc}")
        else:
            logger.debug(f"  ⏭️  {filename} — not found (skipped)")

    return loaded


def _warmup_deep_learning() -> int:
    """Load TensorFlow/Keras models."""
    loaded = 0
    loaded_names: set[str] = set()

    try:
        # Suppress TF startup noise
        os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "3")
        import tensorflow as tf  # noqa: F401
        from tensorflow import keras
    except ImportError:
        logger.warning("TensorFlow not available — skipping deep learning warmup")
        return 0

    for filename in DEEP_LEARNING_MODELS:
        # Avoid loading both .keras and .h5 versions of same model
        stem = Path(filename).stem
        if stem in loaded_names:
            continue

        model_path = MODEL_DIR / filename
        if model_path.exists():
            try:
                t0 = time.perf_counter()
                keras.models.load_model(model_path, compile=False)
                elapsed = (time.perf_counter() - t0) * 1000
                logger.info(f"  ✅ {filename:<35} loaded in {elapsed:6.1f}ms")
                loaded_names.add(stem)
                loaded += 1
            except Exception as exc:
                logger.warning(f"  ⚠️  {filename} — failed to load: {exc}")
        else:
            logger.debug(f"  ⏭️  {filename} — not found (skipped)")

    return loaded


def warmup() -> None:
    """
    Pre-warm all LumindAd ML models into memory.
    Called at container startup via lifespan event in predictor.py.
    """
    logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    logger.info("🔥 LumindAd ML Warmup — loading models into memory")
    logger.info(f"   MODEL_DIR : {MODEL_DIR}")
    logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")

    if not MODEL_DIR.exists():
        logger.warning(
            f"MODEL_DIR '{MODEL_DIR}' does not exist — "
            "models will be cold-loaded on first inference request"
        )
        return

    t_start = time.perf_counter()

    logger.info("📦 Classical ML models (joblib):")
    classical = _warmup_classical()

    logger.info("🧠 Deep Learning models (TensorFlow/Keras):")
    deep = _warmup_deep_learning()

    elapsed_total = (time.perf_counter() - t_start)
    total = classical + deep

    logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    logger.info(
        f"🚀 Warmup complete — {total} model(s) loaded in {elapsed_total:.2f}s"
        f" ({classical} classical · {deep} deep learning)"
    )
    logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")


if __name__ == "__main__":
    warmup()
