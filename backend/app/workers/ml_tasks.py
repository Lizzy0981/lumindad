# backend/app/workers/ml_tasks.py
"""
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  LumindAd Enterprise · backend/app/workers/ml_tasks.py
  Celery tasks — async ML inference + model maintenance

  Tasks
  ──────
  predict_churn_batch_task(customer_list, user_id)
    Bulk XGBoost churn scoring for a list of customers.
    Stores results to Redis (key: ml:churn:batch:{task_id}).
    Returns List[ChurnPrediction] with SHAP for top 10.

  detect_anomalies_batch_task(user_id)
    Runs Isolation Forest heuristic over the last 7 days
    of campaign metrics (CTR, spend, impressions).
    Publishes alert events to Redis pub/sub channel.
    Updates the anomaly feed cache.

  aggregate_kpis_task()
    Beat task — runs every 5 min.
    Reads active campaigns, recomputes aggregated KPIs,
    writes to Redis campaign summary cache, and broadcasts
    updated KPIs to all WebSocket clients.

  retrain_anomaly_model_task()
    Beat task — runs every 15 min.
    Simulates Isolation Forest refit on recent data.
    Updates model status in the registry.

  Green AI tracking
  ──────────────────
  Every inference call records CO₂ via GreenAIService.
  Batch tasks aggregate CO₂ across the full batch and
  include a totalCO2Grams field in the result.

  Retry policy
  ─────────────
  max_retries = 3  ·  countdown = 60 × 2^attempt (exponential backoff)
  NOT retried: SoftTimeLimitExceeded, ValueError

  Author : Elizabeth Díaz Familia
           AI Data Scientist · Sustainable Intelligence & BI
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"""

from __future__ import annotations

import asyncio
import json
import logging
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from app.config import settings

logger = logging.getLogger(__name__)

# ── Optional Celery ───────────────────────────────────────────────────────────
try:
    from celery.exceptions import SoftTimeLimitExceeded
    from app.workers.celery_app import celery_app
    _CELERY = True
except ImportError:
    _CELERY = False
    celery_app = None  # type: ignore[assignment]
    SoftTimeLimitExceeded = Exception  # type: ignore[assignment,misc]


# ═══════════════════════════════════════════════════════════════
# HELPERS
# ═══════════════════════════════════════════════════════════════

def _run_async(coro):
    """Run an async coroutine synchronously (for Celery sync context)."""
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


def _get_ml_service(user_id: str = "batch_worker"):
    """Lazy-import MLService to avoid circular imports at module load."""
    from app.services.ml_service import MLService
    return MLService(user_id=user_id)


def _get_green_ai():
    """Lazy-import green_ai singleton."""
    from app.services.green_ai_service import green_ai
    return green_ai


def _publish_alert(channel: str, payload: dict) -> None:
    """Synchronously publish an alert to Redis pub/sub."""
    try:
        import redis as _redis
        r = _redis.from_url(settings.REDIS_URL, db=settings.REDIS_CACHE_DB,
                            decode_responses=True, socket_timeout=2)
        r.publish(channel, json.dumps(payload, default=str))
    except Exception as exc:
        logger.debug("Alert publish failed: %s", exc)


# ═══════════════════════════════════════════════════════════════
# TASK: BATCH CHURN PREDICTION
# ═══════════════════════════════════════════════════════════════

if _CELERY and celery_app:

    @celery_app.task(
        name="app.workers.ml_tasks.predict_churn_batch_task",
        bind=True,
        queue="ml",
        max_retries=3,
        soft_time_limit=settings.CELERY_TASK_SOFT_TIME_LIMIT,
        time_limit=settings.CELERY_TASK_TIME_LIMIT,
    )
    def predict_churn_batch_task(
        self,
        customer_list: List[Dict[str, Any]],
        user_id:       str,
        include_shap:  bool = True,
    ) -> dict:
        """
        Bulk XGBoost churn prediction for a list of customers.

        Args:
            customer_list: List of CustomerFeatures dicts (Telecom X schema)
            user_id:       Owner user ID for Green AI tracking
            include_shap:  If True, generate SHAP for top-10 highest-risk

        Returns:
            {
              predictions: List[ChurnPrediction],
              shap:        { prediction_id: SHAPExplanation } (top-10),
              summary:     { total, critical, high, medium, low, totalCO2Grams },
              taskId:      str,
              completedAt: ISO str,
            }
        """
        t0       = time.perf_counter()
        svc      = _get_ml_service(user_id)
        green    = _get_green_ai()

        logger.info("🤖 Churn batch task: %d customers for user %s",
                    len(customer_list), user_id)

        try:
            predictions = []
            risk_counts = {"critical": 0, "high": 0, "medium": 0, "low": 0}

            for customer in customer_list:
                pred = svc.predict_churn(customer)
                predictions.append(pred)
                risk_counts[pred["riskLevel"]] += 1

            # SHAP for top-10 highest-risk (sorted by churnProbability desc)
            shap_map: Dict[str, dict] = {}
            if include_shap:
                top10 = sorted(
                    predictions, key=lambda p: p["churnProbability"], reverse=True
                )[:10]
                for pred in top10:
                    shap_map[pred["predictionId"]] = svc.explain_prediction(
                        pred["predictionId"]
                    )

            # Aggregate CO₂ for the whole batch
            session_report  = green.get_session_report(user_id)
            total_co2_grams = session_report["totalCO2Grams"]
            duration_ms     = int((time.perf_counter() - t0) * 1000)

            result = {
                "predictions": predictions,
                "shap":        shap_map,
                "summary": {
                    "total":          len(predictions),
                    "critical":       risk_counts["critical"],
                    "high":           risk_counts["high"],
                    "medium":         risk_counts["medium"],
                    "low":            risk_counts["low"],
                    "totalCO2Grams":  total_co2_grams,
                    "durationMs":     duration_ms,
                },
                "taskId":      self.request.id,
                "completedAt": datetime.now(timezone.utc).isoformat(),
            }

            # Cache result in Redis for 30 min
            try:
                import redis as _redis
                r = _redis.from_url(settings.REDIS_URL, db=settings.REDIS_CACHE_DB,
                                    decode_responses=True, socket_timeout=2)
                r.setex(
                    f"ml:churn:batch:{self.request.id}",
                    settings.CACHE_TTL_ML_MODELS,
                    json.dumps(result, default=str),
                )
            except Exception:
                pass   # non-fatal

            logger.info(
                "✅ Churn batch done: %d predictions in %d ms | "
                "critical=%d high=%d CO₂=%.8f g",
                len(predictions), duration_ms,
                risk_counts["critical"], risk_counts["high"],
                total_co2_grams,
            )
            return result

        except SoftTimeLimitExceeded:
            logger.error("Churn batch task exceeded soft time limit")
            return {"error": "Time limit exceeded", "taskId": self.request.id}
        except Exception as exc:
            countdown = 60 * (2 ** self.request.retries)
            logger.warning("Churn batch error (retry in %ds): %s", countdown, exc)
            raise self.retry(exc=exc, countdown=countdown)


# ═══════════════════════════════════════════════════════════════
# TASK: ANOMALY DETECTION BATCH
# ═══════════════════════════════════════════════════════════════

if _CELERY and celery_app:

    @celery_app.task(
        name="app.workers.ml_tasks.detect_anomalies_batch_task",
        bind=True,
        queue="ml",
        max_retries=2,
        soft_time_limit=1800,   # 30 min
        time_limit=3600,
    )
    def detect_anomalies_batch_task(
        self,
        user_id:     str,
        metric_data: Optional[Dict[str, List[float]]] = None,
    ) -> dict:
        """
        Run Isolation Forest anomaly detection over campaign metrics.

        Args:
            user_id:     Owner user ID
            metric_data: Optional {metric_name: [values…]} dict.
                         When None, uses seed campaign metrics from
                         the campaign service.

        Returns:
            {
              alerts:      List[AnomalyResult],
              totalAlerts: int,
              critical:    int,
              high:        int,
              totalCO2Grams: float,
              taskId:      str,
            }
        """
        t0   = time.perf_counter()
        svc  = _get_ml_service(user_id)
        green = _get_green_ai()

        logger.info("🔍 Anomaly batch task for user %s", user_id)

        try:
            # Default metric data if none provided (seed campaign daily spend)
            if not metric_data:
                metric_data = {
                    "spend":       [1240.0, 1820.0, 1470.0, 2250.0, 2480.0, 1840.0, 1350.0],
                    "clicks":      [1200, 1580, 1340, 1820, 1960, 1720, 1180],
                    "impressions": [18000, 21000, 19500, 24000, 26000, 22000, 17000],
                    "ctr":         [6.67, 7.52, 6.87, 7.58, 7.54, 7.82, 6.78],
                }

            timestamps = [f"day_{i}" for i in range(7)]
            all_alerts = []

            for metric_name, values in metric_data.items():
                results = svc.detect_anomalies(
                    metric=metric_name,
                    values=values,
                    timestamps=timestamps,
                    campaign_id=None,
                )
                for r in results:
                    if r["isAnomaly"]:
                        alert = {**r, "metric": metric_name}
                        all_alerts.append(alert)
                        # Publish to Redis for real-time anomaly feed
                        _publish_alert("anomaly_alerts", alert)

            session_report  = green.get_session_report(user_id)
            total_co2_grams = session_report["totalCO2Grams"]
            duration_ms     = int((time.perf_counter() - t0) * 1000)

            # Count by severity
            sev_counts = {"critical": 0, "high": 0, "medium": 0, "low": 0}
            for a in all_alerts:
                sev_counts[a.get("severity", "low")] += 1

            result = {
                "alerts":       all_alerts,
                "totalAlerts":  len(all_alerts),
                "critical":     sev_counts["critical"],
                "high":         sev_counts["high"],
                "medium":       sev_counts["medium"],
                "totalCO2Grams": total_co2_grams,
                "durationMs":   duration_ms,
                "taskId":       self.request.id,
                "completedAt":  datetime.now(timezone.utc).isoformat(),
            }

            # Cache anomaly feed
            try:
                import redis as _redis
                r = _redis.from_url(settings.REDIS_URL, db=settings.REDIS_CACHE_DB,
                                    decode_responses=True, socket_timeout=2)
                r.setex(
                    f"ml:anomaly:feed:{user_id}",
                    300,  # 5 min cache
                    json.dumps(result, default=str),
                )
            except Exception:
                pass

            logger.info(
                "✅ Anomaly batch done: %d alerts (%d critical) in %d ms",
                len(all_alerts), sev_counts["critical"], duration_ms,
            )
            return result

        except SoftTimeLimitExceeded:
            logger.error("Anomaly batch exceeded soft time limit")
            return {"error": "Time limit exceeded", "taskId": self.request.id}
        except Exception as exc:
            countdown = 60 * (2 ** self.request.retries)
            raise self.retry(exc=exc, countdown=countdown)


# ═══════════════════════════════════════════════════════════════
# TASK: AGGREGATE KPIs (beat — every 5 min)
# ═══════════════════════════════════════════════════════════════

if _CELERY and celery_app:

    @celery_app.task(
        name="app.workers.ml_tasks.aggregate_kpis_task",
        queue="ml",
        max_retries=1,
        soft_time_limit=120,   # 2 min max
        ignore_result=True,
    )
    def aggregate_kpis_task() -> None:
        """
        Beat task — runs every 5 minutes.

        Recomputes aggregated campaign KPIs for all active users,
        writes the result to Redis campaign summary cache, and
        broadcasts updated KPIs to all WebSocket clients via the
        "kpi_updates" Redis pub/sub channel.

        Seed KPIs (LumindAd.jsx Dashboard lines 473–484):
            totalSpend       $48,290
            totalImpressions 531,200
            totalClicks       38,940
            totalConversions   2,847
            activeCampaigns        4
            avgROAS            3.875
            avgCTR             6.65%
        """
        logger.info("⚡ KPI aggregation task running")
        t0 = time.perf_counter()

        # For prototype: use seed KPI data
        # Production: query DB via SQLAlchemy sync session
        kpi_payload = {
            "totalSpend":       48_290.0,
            "totalImpressions": 531_200,
            "totalClicks":       38_940,
            "totalConversions":   2_847,
            "activeCampaigns":        4,
            "avgROAS":            3.875,
            "avgCTR":             6.65,
            "updatedAt":          datetime.now(timezone.utc).isoformat(),
        }

        try:
            import redis as _redis
            r = _redis.from_url(
                settings.REDIS_URL,
                db=settings.REDIS_CACHE_DB,
                decode_responses=True,
                socket_timeout=2,
            )
            # Write to campaign summary cache (all users get the same aggregate)
            r.setex(
                "campaigns:v1:__global__:summary",
                settings.CACHE_TTL_CAMPAIGNS,  # 300 s
                json.dumps(kpi_payload),
            )
            # Broadcast to WebSocket clients
            r.publish("kpi_updates", json.dumps(kpi_payload))

        except Exception as exc:
            logger.warning("KPI aggregation Redis error: %s", exc)

        elapsed = int((time.perf_counter() - t0) * 1000)
        logger.info("✅ KPI aggregation complete in %d ms", elapsed)


# ═══════════════════════════════════════════════════════════════
# TASK: RETRAIN ANOMALY MODEL (beat — every 15 min)
# ═══════════════════════════════════════════════════════════════

if _CELERY and celery_app:

    @celery_app.task(
        name="app.workers.ml_tasks.retrain_anomaly_model_task",
        queue="ml",
        max_retries=1,
        soft_time_limit=900,    # 15 min
        ignore_result=True,
    )
    def retrain_anomaly_model_task() -> None:
        """
        Beat task — runs every 15 minutes.

        Simulates Isolation Forest re-fit on the most recent
        campaign metric data. In production this would:
          1. Query CampaignMetric for the last 7 days
          2. Re-fit sklearn IsolationForest(contamination=0.05)
          3. Serialise model to settings.ML_MODELS_DIR/anomaly_iforest.pkl
          4. Update _MODEL_REGISTRY status back to 'active'

        Green AI: records training CO₂ as a 60-second "inference".
        """
        from app.services.green_ai_service import green_ai, calculate_co2

        logger.info("🔄 Anomaly model refit task running")
        t0 = time.perf_counter()

        # Simulate training duration: ~12 s
        training_ms = 12_000.0
        co2_g       = calculate_co2("isolation_forest", training_ms)
        green_ai.record_inference(
            user_id         = "__system__",
            model_type      = "isolation_forest",
            duration_ms     = training_ms,
            model_name      = "Anomaly Detector (retrain)",
            prediction_type = "retrain",
        )

        elapsed = int((time.perf_counter() - t0) * 1000)
        logger.info(
            "✅ Anomaly model refit complete in %d ms | CO₂=%.8f gCO₂",
            elapsed, co2_g,
        )
