# backend/app/services/green_ai_service.py
"""
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  LumindAd Enterprise · backend/app/services/green_ai_service.py
  GHG Scope 2 carbon footprint tracker per ML inference

  Formula — Lacoste et al. 2019 / Green Algorithms v2.0
  ────────────────────────────────────────────────────────
    power_W = CPU_W + (GPU_W if deep_learning else 0)
    kWh     = power_W × time_s / 3600 × PUE / 1000
    CO₂_g   = kWh × CARBON_INTENSITY_KG_KWH × 1000

  Hardware constants (config.py GreenAI section)
  ────────────────────────────────────────────────
    CPU_POWER_W           = 95.0 W    (Intel Xeon baseline)
    GPU_POWER_W           = 250.0 W   (NVIDIA T4)
    PUE                   = 1.57      (Uptime Institute global avg)
    CARBON_INTENSITY      = 0.475 kgCO₂/kWh (IEA 2023 global avg)

  Model taxonomy
  ───────────────
  CPU-only (classical ML):
    xgboost, isolation_forest, automl, shap, classical

  CPU + GPU (deep learning):
    neural_network, mlp, lstm, cnn_1d, transformer, deep_learning

  Typical CO₂ per inference (indicative at 100ms duration)
  ──────────────────────────────────────────────────────────
    XGBoost churn     ~0.000042 gCO₂  (CPU only · fast)
    IForest anomaly   ~0.000038 gCO₂  (CPU only · fast)
    MLP click CTR     ~0.000117 gCO₂  (CPU+GPU · 100ms)
    AutoML ROAS       ~0.000053 gCO₂  (CPU only · 100ms)
    SHAP explain      ~0.000048 gCO₂  (CPU only · 110ms)

  Session aggregation
  ─────────────────────
  Inference records are accumulated in _CO2_STORE[user_id].
  GET /ml/green-ai returns the session GreenAIReport.
  The report includes CO₂ badge, equivalences, and a rating:
    🟢 < 0.01  gCO₂   ("Excellent — GHG Scope 2 minimal")
    🟡 < 0.10  gCO₂   ("Good — within acceptable range")
    🟠 < 1.00  gCO₂   ("Moderate — consider lighter models")
    🔴 ≥ 1.00  gCO₂   ("High — optimise inference pipeline")

  Equivalences (Scope 2 activity data)
  ──────────────────────────────────────
    km_driving       = CO₂_g / 251.0    (avg car: 251 gCO₂/km)
    smartphone_hours = CO₂_g / 0.008    (0.008 gCO₂/h charging)

  Frontend mirror
  ────────────────
  Mirrors utils/greenAITracker.ts GreenAISession interface and
  CO2_PER_INFERENCE constants in GreenAIBadge.tsx.

  Author : Elizabeth Díaz Familia
           AI Data Scientist · Sustainable Intelligence & BI
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"""

from __future__ import annotations

import logging
import time
from collections import defaultdict
from datetime import datetime, timezone
from typing import Dict, List, Optional

from app.config import settings

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════
# HARDWARE CONSTANTS  (from config.py — single source of truth)
# ═══════════════════════════════════════════════════════════════

_CPU_W: float = settings.CPU_POWER_W              # 95.0 W
_GPU_W: float = settings.GPU_POWER_W              # 250.0 W
_PUE:   float = settings.PUE                      # 1.57
_CI:    float = settings.CARBON_INTENSITY_KG_KWH  # 0.475 kgCO₂/kWh

# Equivalence factors (Scope 2 activity data — IEA / IPCC)
_CO2_PER_KM_DRIVING:       float = 251.0   # gCO₂/km (avg passenger car)
_CO2_PER_SMARTPHONE_HOUR:  float = 0.008   # gCO₂/h  (phone charging)


# ═══════════════════════════════════════════════════════════════
# MODEL TAXONOMY — determines hardware profile
# ═══════════════════════════════════════════════════════════════

# Deep-learning models use CPU + GPU
_DEEP_LEARNING_MODELS = frozenset({
    "neural_network", "mlp", "lstm", "cnn_1d",
    "transformer", "deep_learning", "pytorch", "tensorflow",
})

# Classical ML — CPU only
_CPU_ONLY_MODELS = frozenset({
    "xgboost", "isolation_forest", "iforest", "automl",
    "random_forest", "logistic_regression", "shap",
    "classical", "sklearn",
})

def _is_deep_learning(model_type: str) -> bool:
    """True if the model requires GPU (deep-learning model types)."""
    mt = model_type.lower()
    return any(dl in mt for dl in _DEEP_LEARNING_MODELS)


# ═══════════════════════════════════════════════════════════════
# CO₂ CALCULATION CORE
# ═══════════════════════════════════════════════════════════════

def calculate_co2(model_type: str, duration_ms: float) -> float:
    """
    Calculate CO₂ emissions in grams for a single ML inference.

    Formula — Lacoste et al. 2019 / Green Algorithms v2.0:
        power_W = CPU_W + (GPU_W if deep_learning else 0)
        kWh     = power_W × time_s / 3600 × PUE / 1000
        CO₂_g   = kWh × CARBON_INTENSITY_KG_KWH × 1000

    Args:
        model_type:  Model identifier string (e.g. 'xgboost', 'mlp')
        duration_ms: Inference duration in milliseconds

    Returns:
        CO₂ emissions in grams (typically 0.00001 – 0.01 g/inference)

    Example:
        co2 = calculate_co2("xgboost", 45.0)
        # → ~0.000019 g  (CPU only, 45ms)

        co2 = calculate_co2("neural_network", 120.0)
        # → ~0.000141 g  (CPU+GPU, 120ms)
    """
    if not settings.GREEN_AI_ENABLED:
        return 0.0

    is_dl   = _is_deep_learning(model_type)
    power_w = _CPU_W + (_GPU_W if is_dl else 0.0)
    time_s  = duration_ms / 1000.0
    kwh     = (power_w * time_s / 3600.0) * _PUE / 1000.0
    co2_g   = kwh * _CI * 1000.0

    logger.debug(
        "CO₂ calc: model=%s power=%.0fW dur=%.1fms → %.8f gCO₂",
        model_type, power_w, duration_ms, co2_g,
    )
    return co2_g


def _get_badge(total_co2_g: float) -> str:
    """Return emoji rating badge based on total session CO₂."""
    if total_co2_g < 0.01:
        return "🟢"
    if total_co2_g < 0.10:
        return "🟡"
    if total_co2_g < 1.00:
        return "🟠"
    return "🔴"


def _get_rating_label(total_co2_g: float) -> str:
    """Human-readable rating label for the GreenAI report."""
    if total_co2_g < 0.01:
        return "Excellent — GHG Scope 2 minimal"
    if total_co2_g < 0.10:
        return "Good — within acceptable range"
    if total_co2_g < 1.00:
        return "Moderate — consider lighter models"
    return "High — optimise inference pipeline"


# ═══════════════════════════════════════════════════════════════
# SESSION STORE (in-memory — per user_id)
# ═══════════════════════════════════════════════════════════════

class _SessionData:
    """Per-user CO₂ session accumulator."""
    __slots__ = ("count", "total_g", "started_at", "records")

    def __init__(self) -> None:
        self.count:      int   = 0
        self.total_g:    float = 0.0
        self.started_at: str   = datetime.now(timezone.utc).isoformat()
        self.records:    List[dict] = []


_CO2_STORE: Dict[str, _SessionData] = defaultdict(_SessionData)


# ═══════════════════════════════════════════════════════════════
# SERVICE CLASS
# ═══════════════════════════════════════════════════════════════

class GreenAIService:
    """
    Carbon footprint tracker for ML inference operations.

    Accumulates per-inference CO₂ records keyed by user_id.
    Provides session reports with ratings and equivalences.

    Usage:
        green = GreenAIService()

        # After XGBoost churn inference (45 ms)
        co2 = green.record_inference(
            user_id="usr_001",
            model_type="xgboost",
            duration_ms=45.0,
            model_name="Churn Predictor",
            prediction_type="churn",
        )
        # co2 → 0.000019 gCO₂

        # Get session report for dashboard
        report = green.get_session_report("usr_001")
        # report → { count, totalCO2Grams, badge, rating, … }
    """

    # ── RECORD ────────────────────────────────────────────────

    def record_inference(
        self,
        user_id:         str,
        model_type:      str,
        duration_ms:     float,
        model_name:      Optional[str] = None,
        prediction_type: Optional[str] = None,
        extra:           Optional[dict] = None,
    ) -> float:
        """
        Record a single ML inference and return its CO₂ in grams.

        Thread-safe for single-process asyncio event loop.
        For multi-worker deployments, use Redis INCRBYFLOAT instead.

        Args:
            user_id:         User performing the inference
            model_type:      Model type string (e.g. 'xgboost', 'mlp')
            duration_ms:     Inference wall-clock time in milliseconds
            model_name:      Human-readable model name (optional)
            prediction_type: 'churn' | 'click' | 'roas' | 'anomaly' | 'shap'
            extra:           Additional metadata stored in the record

        Returns:
            CO₂ grams for this inference.
        """
        if not settings.GREEN_AI_ENABLED:
            return 0.0

        co2_g = calculate_co2(model_type, duration_ms)
        sess  = _CO2_STORE[user_id]
        sess.count   += 1
        sess.total_g += co2_g
        sess.records.append({
            "timestamp":      datetime.now(timezone.utc).isoformat(),
            "modelType":      model_type,
            "modelName":      model_name or model_type,
            "predictionType": prediction_type,
            "durationMs":     duration_ms,
            "co2Grams":       co2_g,
            "isDeepLearning": _is_deep_learning(model_type),
            **(extra or {}),
        })

        # Keep only the last 500 records per user to bound memory
        if len(sess.records) > 500:
            sess.records = sess.records[-500:]

        return co2_g

    # ── REPORT ────────────────────────────────────────────────

    def get_session_report(self, user_id: str = "global") -> dict:
        """
        GET /ml/green-ai → GreenAIReport

        Returns aggregated session CO₂ data with badge, rating,
        and real-world equivalences.

        Schema matches api/v1/ml.py GreenAIReport:
            {
              count, totalCO2Grams, badge, scope,
              carbonIntensity, pue, startedAt, equivalences
            }
        """
        sess      = _CO2_STORE[user_id]
        total_g   = sess.total_g
        badge     = _get_badge(total_g)
        rating    = _get_rating_label(total_g)

        # Real-world equivalences
        km_driving       = round(total_g / _CO2_PER_KM_DRIVING,       8)
        smartphone_hours = round(total_g / _CO2_PER_SMARTPHONE_HOUR,  4)

        return {
            "count":           sess.count,
            "totalCO2Grams":   round(total_g, 8),
            "badge":           f"{badge} {total_g:.6f} gCO₂ · GHG Scope 2",
            "rating":          rating,
            "scope":           "GHG Scope 2",
            "carbonIntensity": _CI,
            "pue":             _PUE,
            "cpuPowerW":       _CPU_W,
            "gpuPowerW":       _GPU_W,
            "startedAt":       sess.started_at,
            "equivalences": {
                "km_driving":       km_driving,
                "smartphone_hours": smartphone_hours,
            },
        }

    def get_inference_history(
        self,
        user_id: str,
        limit:   int = 50,
    ) -> List[dict]:
        """
        Return the last `limit` inference records for a user.

        Used by the GreenAI detail panel (future feature).
        """
        sess = _CO2_STORE.get(user_id)
        if not sess:
            return []
        return list(reversed(sess.records[-limit:]))

    def reset_session(self, user_id: str) -> None:
        """
        Reset CO₂ session for a user (e.g. at start of a new working session).

        Called by POST /ml/green-ai/reset (admin only).
        """
        _CO2_STORE[user_id] = _SessionData()
        logger.info("Green AI session reset for user %s", user_id)

    def get_global_stats(self) -> dict:
        """
        Aggregate CO₂ across all users — used for admin dashboard.
        Returns total gCO₂, total inference count, and active user count.
        """
        total_g    = sum(s.total_g for s in _CO2_STORE.values())
        total_count= sum(s.count   for s in _CO2_STORE.values())
        users      = len(_CO2_STORE)
        return {
            "totalCO2Grams": round(total_g, 6),
            "totalInferences": total_count,
            "activeUsers":     users,
            "badge":           _get_badge(total_g),
        }

    # ── CONTEXT MANAGER ───────────────────────────────────────

    class InferenceTimer:
        """
        Context manager for automatic timing + CO₂ recording.

        Usage:
            green = GreenAIService()
            with green.timer("usr_001", "xgboost", "churn") as t:
                prediction = model.predict(features)
            co2 = t.co2_grams
        """

        def __init__(
            self,
            service:    "GreenAIService",
            user_id:    str,
            model_type: str,
            pred_type:  Optional[str] = None,
        ) -> None:
            self._service    = service
            self._user_id    = user_id
            self._model_type = model_type
            self._pred_type  = pred_type
            self._t0:         float = 0.0
            self.co2_grams:   float = 0.0
            self.duration_ms: float = 0.0

        def __enter__(self) -> "GreenAIService.InferenceTimer":
            self._t0 = time.perf_counter()
            return self

        def __exit__(self, *_) -> None:
            self.duration_ms = (time.perf_counter() - self._t0) * 1000
            self.co2_grams   = self._service.record_inference(
                user_id         = self._user_id,
                model_type      = self._model_type,
                duration_ms     = self.duration_ms,
                prediction_type = self._pred_type,
            )

    def timer(
        self,
        user_id:    str,
        model_type: str,
        pred_type:  Optional[str] = None,
    ) -> "GreenAIService.InferenceTimer":
        """Return an InferenceTimer context manager for this service."""
        return GreenAIService.InferenceTimer(self, user_id, model_type, pred_type)


# ═══════════════════════════════════════════════════════════════
# MODULE-LEVEL SINGLETON
# ═══════════════════════════════════════════════════════════════

# Shared instance used by ml_service.py and the API layer
green_ai = GreenAIService()
