# backend/app/workers/__init__.py
"""
LumindAd Enterprise · backend/app/workers
Celery async task queue — 3 task modules + app factory.

Task modules
─────────────
upload_tasks  → queue: upload  (file processing pipeline)
ml_tasks      → queue: ml      (inference + beat aggregation)
report_tasks  → queue: reports (Excel · PDF · email)

Singleton
──────────
from app.workers.celery_app import celery_app

Beat schedule (celery_app.py)
──────────────────────────────
Every  5 min : aggregate_kpis_task
Every 15 min : retrain_anomaly_model_task
Every  1 h   : cleanup_expired_uploads_task
Daily 06:00h : scheduled_daily_report_task

Usage
──────
# Start all queues
celery -A app.workers.celery_app worker -l info -Q upload,ml,reports,default -c 4

# Start beat scheduler
celery -A app.workers.celery_app beat -l info

Author : Elizabeth Díaz Familia
         AI Data Scientist · Sustainable Intelligence & BI
"""
