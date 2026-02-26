# backend/app/api/v1/__init__.py
"""
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  LumindAd Enterprise · backend/app/api/v1/__init__.py
  API v1 router assembly

  Combines all endpoint routers into a single api_router_v1
  that is mounted in main.py at /api/v1.

  Final URL map
  ──────────────
  /api/v1/auth/*         → auth.py
  /api/v1/campaigns/*    → campaigns.py
  /api/v1/budget/*       → budget.py
  /api/v1/analytics/*    → analytics.py
  /api/v1/upload/*       → upload.py
  /api/v1/ml/*           → ml.py
  /api/v1/bi-export/*    → bi_export.py

  Author : Elizabeth Díaz Familia
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"""

from fastapi import APIRouter

from app.api.v1.auth       import router as auth_router
from app.api.v1.campaigns  import router as campaigns_router
from app.api.v1.budget     import router as budget_router
from app.api.v1.analytics  import router as analytics_router
from app.api.v1.upload     import router as upload_router
from app.api.v1.ml         import router as ml_router
from app.api.v1.bi_export  import router as bi_export_router

api_router_v1 = APIRouter()

api_router_v1.include_router(auth_router,      prefix="/auth",      tags=["auth"])
api_router_v1.include_router(campaigns_router, prefix="/campaigns", tags=["campaigns"])
api_router_v1.include_router(budget_router,    prefix="/budget",    tags=["budget"])
api_router_v1.include_router(analytics_router, prefix="/analytics", tags=["analytics"])
api_router_v1.include_router(upload_router,    prefix="/upload",    tags=["upload"])
api_router_v1.include_router(ml_router,        prefix="/ml",        tags=["ml"])
api_router_v1.include_router(bi_export_router, prefix="/bi-export", tags=["bi-export"])

__all__ = ["api_router_v1"]
