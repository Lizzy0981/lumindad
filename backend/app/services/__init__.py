# backend/app/services/__init__.py
"""
LumindAd Enterprise · backend/app/services
Business logic layer — 5 service modules.

Services
─────────
CampaignService  — CRUD + KPIs + performance time-series
BudgetService    — summary · daily · allocations · forecast · recommendations
UploadService    — chunked upload · pandas processing · SSE progress · ML export
MLService        — XGBoost churn · IForest anomaly · MLP clicks · AutoML ROAS · SHAP
GreenAIService   — GHG Scope 2 CO₂ tracking per inference (Lacoste et al. 2019)

Quick imports
──────────────
from app.services.campaign_service  import CampaignService
from app.services.budget_service    import BudgetService
from app.services.upload_service    import UploadService
from app.services.ml_service        import MLService
from app.services.green_ai_service  import GreenAIService, green_ai

All services accept an optional AsyncSession for DB operations and
fall back to in-memory seed data when the DB is unavailable,
keeping the prototype fully functional without PostgreSQL.

Author : Elizabeth Díaz Familia
         AI Data Scientist · Sustainable Intelligence & BI
"""
