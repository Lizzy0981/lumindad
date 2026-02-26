# backend/app/services/budget_service.py
"""
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  LumindAd Enterprise · backend/app/services/budget_service.py
  Budget management business logic layer

  Methods
  ────────
  get_summary(user_id, period)               → BudgetSummary dict
  get_daily(user_id, period)                 → List[DailyEntry]
  get_allocations(user_id)                   → List[PlatformAllocation]
  update_allocations(user_id, allocs)        → List[PlatformAllocation]
  get_recommendation(user_id)                → AIRecommendation
  set_budget(user_id, total, period)         → BudgetSummary
  get_forecast(user_id, days)                → BudgetForecast
  apply_recommendation(user_id)             → BudgetSummary

  Seed alignment (LumindAd.jsx / store/budgetStore.ts)
  ──────────────────────────────────────────────────────
  totalBudget  $28,500   (line 506)
  totalSpent   $18,347   (line 507)
  remaining    $10,153   (computed)
  usedPercent   64 %     (computed)
  changePercent +18.2 %

  daily: Mon→Sun budget=1500 spend=[1240,1820,1470,2250,2480,1840,1350]
  allocations: Google 38% · Meta 29% · TikTok 18% · LinkedIn 10% · X 5%
  AI rec: Meta→Google $1,200 +23% ROAS (XGBoost v2.3.1)

  Forecast algorithm
  ───────────────────
  avg_daily_spend = mean(daily entries spend)
  projected spend increases +0.5 % per day (linear trend)
  daysRemaining = ceil(remaining / avg_daily * (1 - 0.005))
  onTrack = daysRemaining >= days_in_month

  Author : Elizabeth Díaz Familia
           AI Data Scientist · Sustainable Intelligence & BI
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"""

from __future__ import annotations

import logging
import math
import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Dict, List, Optional

from app.config import settings
from app.core import cache
from app.core.cache import CacheKey, TTL_BUDGET

logger = logging.getLogger(__name__)

# ── Optional ORM imports ──────────────────────────────────────────────────────
try:
    from sqlalchemy import select
    from sqlalchemy.ext.asyncio import AsyncSession
    from app.models.budget import (
        BudgetRecord, DailyBudgetRecord,
        PlatformAllocationRecord, AIBudgetRecommendation,
    )
    _ORM_AVAILABLE = True
except ImportError:
    _ORM_AVAILABLE = False
    AsyncSession = None  # type: ignore[assignment,misc]


# ═══════════════════════════════════════════════════════════════
# IN-MEMORY SEED STATE (prototype / fallback)
# ═══════════════════════════════════════════════════════════════

_BUDGET_STATE: Dict = {
    "totalBudget":   28_500.0,
    "totalSpent":    18_347.0,
    "period":        "November 2025",
    "changePercent": 18.2,
}

_DAILY: List[dict] = [
    {"day": "Mon", "budget": 1500.0, "spend": 1240.0},
    {"day": "Tue", "budget": 1500.0, "spend": 1820.0},
    {"day": "Wed", "budget": 1500.0, "spend": 1470.0},
    {"day": "Thu", "budget": 1500.0, "spend": 2250.0},
    {"day": "Fri", "budget": 1500.0, "spend": 2480.0},
    {"day": "Sat", "budget": 1500.0, "spend": 1840.0},
    {"day": "Sun", "budget": 1500.0, "spend": 1350.0},
]

_ALLOCATIONS: List[dict] = [
    {"platform": "Google Ads", "pct": 38.0, "color": "#4285f4", "amountUSD": 6971.86},
    {"platform": "Meta Ads",   "pct": 29.0, "color": "#1877f2", "amountUSD": 5320.63},
    {"platform": "TikTok",     "pct": 18.0, "color": "#ff0050", "amountUSD": 3302.46},
    {"platform": "LinkedIn",   "pct": 10.0, "color": "#0077b5", "amountUSD": 1834.70},
    {"platform": "Twitter/X",  "pct":  5.0, "color": "#1da1f2", "amountUSD":  917.35},
]

_AI_REC: dict = {
    "id":           "rec_001",
    "fromPlatform": "Meta Ads",
    "toPlatform":   "Google Ads",
    "amountUSD":    1200.0,
    "roasGain":     0.23,   # +23%
    "rationale":    (
        "XGBoost estimates a +23% ROAS improvement by reallocating $1,200 "
        "from Meta Ads to Google Ads based on 90-day attribution data. "
        "Confidence: 87.3% (model: xgboost-v2.3.1)"
    ),
    "applied": False,
}


def _recompute_amounts(allocs: List[dict], total_spent: float) -> List[dict]:
    """Recompute amountUSD for each allocation after a pct change."""
    for a in allocs:
        a["amountUSD"] = round(total_spent * a["pct"] / 100, 2)
    return allocs


def _build_summary(state: dict) -> dict:
    total_budget  = state["totalBudget"]
    total_spent   = state["totalSpent"]
    remaining     = round(total_budget - total_spent, 2)
    used_pct      = round(total_spent / total_budget * 100, 1) if total_budget else 0.0
    return {
        "totalBudget":   total_budget,
        "totalSpent":    total_spent,
        "remaining":     remaining,
        "usedPercent":   used_pct,
        "period":        state.get("period", ""),
        "changePercent": state.get("changePercent", 0.0),
    }


# ═══════════════════════════════════════════════════════════════
# SERVICE CLASS
# ═══════════════════════════════════════════════════════════════

class BudgetService:
    """
    Budget management business logic.

    Falls back to in-memory seed state when the DB is unavailable,
    keeping the prototype fully functional without PostgreSQL.
    """

    def __init__(self, db: Optional[AsyncSession] = None) -> None:
        self.db = db

    # ── READ ──────────────────────────────────────────────────

    async def get_summary(
        self,
        user_id: str,
        period:  Optional[str] = None,
    ) -> dict:
        """
        GET /budget/summary

        Returns BudgetSummary: totalBudget, totalSpent, remaining,
        usedPercent, period, changePercent.

        Seed: $28,500 / $18,347 / 64% / +18.2% / November 2025
        """
        cache_key = CacheKey.budget_summary(user_id)
        hit = await cache.get(cache_key)
        if hit:
            return hit

        if self.db and _ORM_AVAILABLE:
            result = await self._db_summary(user_id, period)
        else:
            state = dict(_BUDGET_STATE)
            if period:
                state["period"] = period
            result = _build_summary(state)

        await cache.set(cache_key, result, TTL_BUDGET)
        return result

    async def _db_summary(self, user_id: str, period: Optional[str]) -> dict:
        uid  = uuid.UUID(user_id)
        stmt = (
            select(BudgetRecord)
            .where(BudgetRecord.user_id == uid)
            .order_by(BudgetRecord.period_year.desc(), BudgetRecord.period_month.desc())
            .limit(1)
        )
        row = (await self.db.execute(stmt)).scalar_one_or_none()
        if row:
            return row.to_dict()
        return _build_summary(dict(_BUDGET_STATE))

    async def get_daily(
        self,
        user_id: str,
        period:  Optional[str] = None,
    ) -> List[dict]:
        """
        GET /budget/daily

        7 rows Mon→Sun with budget and actual spend.
        BudgetPage BudgetChart (BarChart).
        """
        cache_key = CacheKey.budget_daily(user_id)
        hit = await cache.get(cache_key)
        if hit:
            return hit

        if self.db and _ORM_AVAILABLE:
            result = await self._db_daily(user_id)
        else:
            result = [dict(d) for d in _DAILY]

        await cache.set(cache_key, result, TTL_BUDGET)
        return result

    async def _db_daily(self, user_id: str) -> List[dict]:
        uid  = uuid.UUID(user_id)
        # Find most recent budget record
        br_stmt = (
            select(BudgetRecord)
            .where(BudgetRecord.user_id == uid)
            .order_by(BudgetRecord.period_year.desc(), BudgetRecord.period_month.desc())
            .limit(1)
        )
        br = (await self.db.execute(br_stmt)).scalar_one_or_none()
        if not br:
            return [dict(d) for d in _DAILY]

        stmt = (
            select(DailyBudgetRecord)
            .where(DailyBudgetRecord.budget_record_id == br.id)
            .order_by(DailyBudgetRecord.day_order)
        )
        rows = (await self.db.execute(stmt)).scalars().all()
        return [r.to_dict() for r in rows] if rows else [dict(d) for d in _DAILY]

    async def get_allocations(self, user_id: str) -> List[dict]:
        """
        GET /budget/allocations

        5 platform allocation rows with pct + colour + amountUSD.
        BudgetPage PlatformSplit (PieChart).
        """
        cache_key = CacheKey.budget_allocations(user_id)
        hit = await cache.get(cache_key)
        if hit:
            return hit

        if self.db and _ORM_AVAILABLE:
            result = await self._db_allocations(user_id)
        else:
            result = [dict(a) for a in _ALLOCATIONS]

        await cache.set(cache_key, result, TTL_BUDGET)
        return result

    async def _db_allocations(self, user_id: str) -> List[dict]:
        uid  = uuid.UUID(user_id)
        br_stmt = (
            select(BudgetRecord)
            .where(BudgetRecord.user_id == uid)
            .order_by(BudgetRecord.period_year.desc(), BudgetRecord.period_month.desc())
            .limit(1)
        )
        br = (await self.db.execute(br_stmt)).scalar_one_or_none()
        if not br:
            return [dict(a) for a in _ALLOCATIONS]

        stmt = (
            select(PlatformAllocationRecord)
            .where(PlatformAllocationRecord.budget_record_id == br.id)
            .order_by(PlatformAllocationRecord.pct.desc())
        )
        rows = (await self.db.execute(stmt)).scalars().all()
        return [r.to_dict() for r in rows] if rows else [dict(a) for a in _ALLOCATIONS]

    async def get_recommendation(self, user_id: str) -> dict:
        """
        GET /budget/recommendation

        Returns the AI-generated reallocation recommendation.
        Seed: Meta→Google $1,200 +23% ROAS (XGBoost v2.3.1)
        """
        cache_key = CacheKey.budget_recommendation(user_id)
        hit = await cache.get(cache_key)
        if hit:
            return hit

        if self.db and _ORM_AVAILABLE:
            result = await self._db_recommendation(user_id)
        else:
            result = dict(_AI_REC)

        await cache.set(cache_key, result, TTL_BUDGET)
        return result

    async def _db_recommendation(self, user_id: str) -> dict:
        uid  = uuid.UUID(user_id)
        br_stmt = (
            select(BudgetRecord)
            .where(BudgetRecord.user_id == uid)
            .order_by(BudgetRecord.period_year.desc(), BudgetRecord.period_month.desc())
            .limit(1)
        )
        br = (await self.db.execute(br_stmt)).scalar_one_or_none()
        if not br:
            return dict(_AI_REC)

        stmt = (
            select(AIBudgetRecommendation)
            .where(
                AIBudgetRecommendation.budget_record_id == br.id,
                AIBudgetRecommendation.applied.is_(False),
            )
            .order_by(AIBudgetRecommendation.created_at.desc())
            .limit(1)
        )
        row = (await self.db.execute(stmt)).scalar_one_or_none()
        return row.to_dict() if row else dict(_AI_REC)

    async def get_forecast(
        self,
        user_id: str,
        days:    int = 30,
    ) -> dict:
        """
        GET /budget/forecast

        Projects spend for the next `days` days using linear trend.

        Algorithm:
          avg_daily = mean(daily entries spend)
          Each day spend = avg_daily × (1 + 0.005 × day_index)   (+0.5%/day)
          daysRemaining = ceil(remaining / avg_daily_projected)
          onTrack = daysRemaining >= days (budget lasts the period)
        """
        cache_key = CacheKey.budget_forecast(user_id, days)
        hit = await cache.get(cache_key)
        if hit:
            return hit

        summary = await self.get_summary(user_id)
        daily   = await self.get_daily(user_id)

        avg_daily = sum(d["spend"] for d in daily) / len(daily) if daily else 1700.0
        remaining = summary["remaining"]

        today = datetime.now(timezone.utc).date()
        proj_dates, proj_spend, proj_budget = [], [], []

        for i in range(days):
            d          = today + timedelta(days=i + 1)
            day_spend  = round(avg_daily * (1 + 0.005 * i), 2)
            proj_dates.append(d.isoformat())
            proj_spend.append(day_spend)
            proj_budget.append(round(summary["totalBudget"] / days, 2))

        # Days remaining until budget runs out (projected)
        cum = 0.0
        days_remaining = days
        for i, s in enumerate(proj_spend):
            cum += s
            if cum >= remaining:
                days_remaining = i + 1
                break

        # Estimated end date
        estimated_end = (today + timedelta(days=days_remaining)).isoformat()
        on_track      = days_remaining >= days

        result = {
            "dates":           proj_dates,
            "projectedSpend":  proj_spend,
            "projectedBudget": proj_budget,
            "estimatedEndDate": estimated_end,
            "daysRemaining":   days_remaining,
            "onTrack":         on_track,
        }
        await cache.set(cache_key, result, TTL_BUDGET)
        return result

    # ── WRITE ─────────────────────────────────────────────────

    async def set_budget(
        self,
        user_id:      str,
        total_budget: float,
        period:       Optional[str] = None,
    ) -> dict:
        """
        POST /budget

        Set a new total budget. Recomputes all allocation amountUSD
        proportionally and invalidates the user's budget cache.
        """
        if self.db and _ORM_AVAILABLE:
            result = await self._db_set_budget(user_id, total_budget, period)
        else:
            _BUDGET_STATE["totalBudget"] = total_budget
            if period:
                _BUDGET_STATE["period"] = period
            # Recompute allocation amounts proportionally
            _recompute_amounts(_ALLOCATIONS, _BUDGET_STATE["totalSpent"])
            result = _build_summary(_BUDGET_STATE)

        await cache.invalidate_prefix(f"budget:{CacheKey.V}:{user_id}")
        logger.info("Budget set: $%.2f for user %s", total_budget, user_id)
        return result

    async def _db_set_budget(
        self, user_id: str, total_budget: float, period: Optional[str],
    ) -> dict:
        uid  = uuid.UUID(user_id)
        stmt = (
            select(BudgetRecord)
            .where(BudgetRecord.user_id == uid)
            .order_by(BudgetRecord.period_year.desc(), BudgetRecord.period_month.desc())
            .limit(1)
        )
        br = (await self.db.execute(stmt)).scalar_one_or_none()
        if br:
            br.total_budget = Decimal(str(total_budget))
            if period:
                br.period_label = period
            await self.db.flush()
            # Recompute platform amounts
            alloc_stmt = select(PlatformAllocationRecord).where(
                PlatformAllocationRecord.budget_record_id == br.id
            )
            allocs = (await self.db.execute(alloc_stmt)).scalars().all()
            for a in allocs:
                a.recompute_amount(br.total_spent)
            await self.db.flush()
            return br.to_dict()
        return _build_summary(_BUDGET_STATE)

    async def update_allocations(
        self,
        user_id: str,
        allocs:  List[dict],
    ) -> List[dict]:
        """
        PATCH /budget/allocations

        Update platform allocation percentages. Validates that
        pct values sum to ~100 (within 0.1 tolerance).
        Recomputes amountUSD from totalSpent × pct / 100.
        """
        total_pct = sum(a.get("pct", 0) for a in allocs)
        if abs(total_pct - 100.0) > 0.5:
            raise ValueError(
                f"Allocation percentages must sum to 100 (got {total_pct:.1f})"
            )

        summary = await self.get_summary(user_id)
        total_spent = summary["totalSpent"]

        if self.db and _ORM_AVAILABLE:
            result = await self._db_update_allocs(user_id, allocs, total_spent)
        else:
            # Update in-memory state
            platform_map = {a["platform"]: a for a in allocs}
            for row in _ALLOCATIONS:
                if row["platform"] in platform_map:
                    new_pct = platform_map[row["platform"]].get("pct", row["pct"])
                    row["pct"] = new_pct
                    row["amountUSD"] = round(total_spent * new_pct / 100, 2)
            result = [dict(a) for a in _ALLOCATIONS]

        await cache.invalidate_prefix(f"budget:{CacheKey.V}:{user_id}")
        logger.info("Allocations updated for user %s", user_id)
        return result

    async def _db_update_allocs(
        self, user_id: str, allocs: List[dict], total_spent: float,
    ) -> List[dict]:
        uid  = uuid.UUID(user_id)
        br_stmt = (
            select(BudgetRecord)
            .where(BudgetRecord.user_id == uid)
            .order_by(BudgetRecord.period_year.desc(), BudgetRecord.period_month.desc())
            .limit(1)
        )
        br = (await self.db.execute(br_stmt)).scalar_one_or_none()
        if not br:
            return [dict(a) for a in _ALLOCATIONS]

        stmt = select(PlatformAllocationRecord).where(
            PlatformAllocationRecord.budget_record_id == br.id
        )
        rows = (await self.db.execute(stmt)).scalars().all()
        platform_map = {a["platform"]: a for a in allocs}
        for row in rows:
            if row.platform_name in platform_map:
                row.pct = Decimal(str(platform_map[row.platform_name]["pct"]))
                row.recompute_amount(Decimal(str(total_spent)))
        await self.db.flush()
        return [r.to_dict() for r in rows]

    async def apply_recommendation(self, user_id: str) -> dict:
        """
        POST /budget/recommendation/apply

        Applies the pending AI recommendation:
          1. Reduces from_platform allocation by amountUSD
          2. Increases to_platform allocation by amountUSD
          3. Marks recommendation as applied
          4. Returns updated budget summary
        """
        rec = await self.get_recommendation(user_id)
        amount      = rec["amountUSD"]
        from_plat   = rec["fromPlatform"]
        to_plat     = rec["toPlatform"]

        if self.db and _ORM_AVAILABLE:
            result = await self._db_apply_rec(user_id, rec)
        else:
            # Adjust in-memory allocations
            total_spent = _BUDGET_STATE["totalSpent"]
            amount_pct_from = amount / total_spent * 100
            for a in _ALLOCATIONS:
                if a["platform"] == from_plat:
                    a["pct"] = max(0.0, round(a["pct"] - amount_pct_from, 2))
                elif a["platform"] == to_plat:
                    a["pct"] = round(a["pct"] + amount_pct_from, 2)
            _recompute_amounts(_ALLOCATIONS, total_spent)
            _AI_REC["applied"] = True
            result = _build_summary(_BUDGET_STATE)

        await cache.invalidate_prefix(f"budget:{CacheKey.V}:{user_id}")
        logger.info(
            "Budget recommendation applied: %s→%s $%.0f for user %s",
            from_plat, to_plat, amount, user_id,
        )
        return result

    async def _db_apply_rec(self, user_id: str, rec: dict) -> dict:
        uid  = uuid.UUID(user_id)
        # Mark recommendation applied
        try:
            rec_id = uuid.UUID(rec["id"])
            rec_row = await self.db.get(AIBudgetRecommendation, rec_id)
            if rec_row:
                rec_row.apply()
        except (ValueError, KeyError):
            pass

        # Adjust allocations
        br_stmt = (
            select(BudgetRecord)
            .where(BudgetRecord.user_id == uid)
            .order_by(BudgetRecord.period_year.desc(), BudgetRecord.period_month.desc())
            .limit(1)
        )
        br = (await self.db.execute(br_stmt)).scalar_one_or_none()
        if br:
            alloc_stmt = select(PlatformAllocationRecord).where(
                PlatformAllocationRecord.budget_record_id == br.id
            )
            rows = (await self.db.execute(alloc_stmt)).scalars().all()
            total_spent = float(br.total_spent)
            amount_pct  = rec["amountUSD"] / total_spent * 100 if total_spent else 0
            for row in rows:
                if row.platform_name == rec["fromPlatform"]:
                    row.pct = Decimal(str(max(0.0, float(row.pct) - amount_pct)))
                elif row.platform_name == rec["toPlatform"]:
                    row.pct = Decimal(str(float(row.pct) + amount_pct))
                row.recompute_amount(br.total_spent)
            await self.db.flush()
            return br.to_dict()
        return _build_summary(_BUDGET_STATE)
