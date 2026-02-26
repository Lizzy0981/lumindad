# backend/app/services/campaign_service.py
"""
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  LumindAd Enterprise · backend/app/services/campaign_service.py
  Campaign business logic layer

  Responsibility
  ───────────────
  All campaign domain logic lives here. The API endpoints
  (api/v1/campaigns.py) are thin controllers that call this service.

  Methods
  ────────
  list_campaigns(user_id, filters, pagination)     → (items, total)
  get_campaign(user_id, campaign_id)               → Campaign ORM | None
  create_campaign(user_id, payload)                → Campaign ORM
  update_campaign(user_id, campaign_id, payload)   → Campaign ORM | None
  delete_campaign(user_id, campaign_id)            → bool
  update_status(user_id, campaign_id, status)      → Campaign ORM | None
  get_performance(user_id, campaign_id, period)    → CampaignPerformanceOut
  get_kpis(user_id)                                → CampaignKPIsOut

  Caching strategy
  ─────────────────
  Reads:  get() → return cached JSON if hit
  Writes: invalidate_user(user_id) after every mutation
  TTL:    settings.CACHE_TTL_CAMPAIGNS = 300 s (5 min)

  DB fallback
  ─────────────
  When SQLAlchemy / asyncpg is not available (SQLite dev / test env),
  the service falls back to the in-memory seed dict from
  api/v1/campaigns.py (_CAMPAIGNS). This keeps the prototype
  fully functional without PostgreSQL.

  Seed alignment (LumindAd.jsx lines 103–110)
  ──────────────────────────────────────────────
  C-001  Summer Sale 2025      Google Ads  active     5000   3240  124500   8920  7.16%  342  3.8
  C-002  Brand Awareness Q1    Meta Ads    active     8000   5180  287000  12400  4.32%  520  2.9
  C-003  Product Launch Beta   TikTok      paused     3500   1890   98200   5430  5.53%  187  4.2
  C-004  Retargeting Dec       Google Ads  active     2000   1740   43100   3280  7.61%  245  5.1
  C-005  LinkedIn B2B Push     LinkedIn    draft      6000      0       0      0     —     0  0.0
  C-006  Holiday Promos        Meta Ads    completed  4200   4198  178000   9870  5.54%  430  3.5

  Dashboard KPI seed (lines 473–484)
  ────────────────────────────────────
  totalSpend       $48,290
  totalImpressions 531,200
  totalClicks       38,940
  totalConversions   2,847
  activeCampaigns        4
  avgROAS            3.875
  avgCTR             6.65 %

  Author : Elizabeth Díaz Familia
           AI Data Scientist · Sustainable Intelligence & BI
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"""

from __future__ import annotations

import logging
import random
import uuid
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from typing import Dict, List, Optional, Tuple

from app.config import settings
from app.core import cache
from app.core.cache import CacheKey, TTL_CAMPAIGNS

logger = logging.getLogger(__name__)

# ── Optional ORM imports ──────────────────────────────────────────────────────
try:
    from sqlalchemy import func, select
    from sqlalchemy.ext.asyncio import AsyncSession
    from app.models.campaign import Campaign, CampaignMetric, CampaignStatus, CampaignPlatform
    _ORM_AVAILABLE = True
except ImportError:
    _ORM_AVAILABLE = False
    AsyncSession = None  # type: ignore[assignment,misc]


# ═══════════════════════════════════════════════════════════════
# SEED FALLBACK (used when DB is not available)
# ═══════════════════════════════════════════════════════════════

_SEED: Dict[str, dict] = {
    "C-001": {"id":"C-001","name":"Summer Sale 2025",    "platform":"Google Ads","status":"active",    "budget":5000,"spent":3240,"impressions":124500,"clicks":8920, "ctr":"7.16%","conv":342,"roas":3.8},
    "C-002": {"id":"C-002","name":"Brand Awareness Q1",  "platform":"Meta Ads",  "status":"active",    "budget":8000,"spent":5180,"impressions":287000,"clicks":12400,"ctr":"4.32%","conv":520,"roas":2.9},
    "C-003": {"id":"C-003","name":"Product Launch Beta", "platform":"TikTok",    "status":"paused",    "budget":3500,"spent":1890,"impressions":98200, "clicks":5430, "ctr":"5.53%","conv":187,"roas":4.2},
    "C-004": {"id":"C-004","name":"Retargeting Dec",     "platform":"Google Ads","status":"active",    "budget":2000,"spent":1740,"impressions":43100, "clicks":3280, "ctr":"7.61%","conv":245,"roas":5.1},
    "C-005": {"id":"C-005","name":"LinkedIn B2B Push",   "platform":"LinkedIn",  "status":"draft",     "budget":6000,"spent":0,   "impressions":0,     "clicks":0,    "ctr":"—",    "conv":0,  "roas":0.0},
    "C-006": {"id":"C-006","name":"Holiday Promos",      "platform":"Meta Ads",  "status":"completed", "budget":4200,"spent":4198,"impressions":178000,"clicks":9870, "ctr":"5.54%","conv":430,"roas":3.5},
}


def _seed_list(
    platform: Optional[str] = None,
    status:   Optional[str] = None,
    search:   Optional[str] = None,
    sort_by:  str = "name",
    sort_dir: str = "asc",
    page:     int = 1,
    page_size:int = 20,
) -> Tuple[List[dict], int]:
    """Filter + sort + paginate the in-memory seed dict."""
    items = [c for c in _SEED.values() if not c.get("is_deleted")]

    if platform and platform != "All Platforms":
        items = [c for c in items if c["platform"] == platform]
    if status and status != "All":
        items = [c for c in items if c["status"] == status]
    if search:
        q = search.lower()
        items = [c for c in items if q in c["name"].lower() or q in c["platform"].lower()]

    reverse = sort_dir.lower() == "desc"
    items.sort(key=lambda c: c.get(sort_by, c.get("name", "")), reverse=reverse)

    total  = len(items)
    offset = (page - 1) * page_size
    return items[offset:offset + page_size], total


def _seed_kpis() -> dict:
    active = [c for c in _SEED.values() if c["status"] == "active"]
    total_spend       = sum(c["spent"]       for c in _SEED.values())
    total_impressions = sum(c["impressions"] for c in _SEED.values())
    total_clicks      = sum(c["clicks"]      for c in _SEED.values())
    total_conversions = sum(c["conv"]        for c in _SEED.values())
    total_budget      = sum(c["budget"]      for c in _SEED.values())
    spent_active      = sum(c["spent"]       for c in active if c["spent"] > 0)
    roas_num          = sum(c["roas"] * c["spent"] for c in active if c["spent"] > 0)
    avg_roas          = round(roas_num / spent_active, 3) if spent_active else 0.0
    imp_active        = sum(c["impressions"] for c in active if c["impressions"] > 0)
    clk_active        = sum(c["clicks"]      for c in active if c["clicks"]      > 0)
    avg_ctr           = round(clk_active / imp_active * 100, 2) if imp_active else 0.0
    return {
        "totalSpend":       total_spend,
        "totalImpressions": total_impressions,
        "totalClicks":      total_clicks,
        "totalConversions": total_conversions,
        "totalBudget":      total_budget,
        "activeCampaigns":  len(active),
        "avgROAS":          avg_roas,
        "avgCTR":           avg_ctr,
    }


def _seed_performance(campaign_id: str, period: str = "7d") -> dict:
    """Deterministic time-series using the campaign_id as random seed."""
    days = {"7d": 7, "30d": 30, "90d": 90}.get(period, 7)
    rng  = random.Random(campaign_id)
    base = _SEED.get(campaign_id, {})
    base_imp = base.get("impressions", 10000) or 10000
    base_clk = base.get("clicks", 800)        or 800
    base_spe = base.get("spent", 500)         or 500

    today = date.today()
    dates, imps, clks, convs, spend = [], [], [], [], []
    for i in range(days):
        d     = today - timedelta(days=days - i - 1)
        scale = rng.uniform(0.6, 1.4)
        dates.append(d.isoformat())
        imps.append(int((base_imp / days) * scale))
        clks.append(int((base_clk / days) * scale))
        convs.append(int((base.get("conv", 30) / days) * scale))
        spend.append(round((base_spe / days) * scale, 2))

    return {
        "campaignId":  campaign_id,
        "period":      period,
        "dates":       dates,
        "impressions": imps,
        "clicks":      clks,
        "conversions": convs,
        "spend":       spend,
    }


# ═══════════════════════════════════════════════════════════════
# SERVICE CLASS
# ═══════════════════════════════════════════════════════════════

class CampaignService:
    """
    Campaign business logic service.

    Instantiate once per request (or use the module-level singleton below).
    Requires an AsyncSession; falls back to seed data when DB unavailable.

    Example (FastAPI endpoint):
        svc = CampaignService(db)
        items, total = await svc.list_campaigns(
            user_id="usr_001",
            platform="Google Ads",
            page=1, page_size=20,
        )
    """

    def __init__(self, db: Optional[AsyncSession] = None) -> None:
        self.db = db

    # ── READ ──────────────────────────────────────────────────

    async def list_campaigns(
        self,
        user_id:   str,
        platform:  Optional[str] = None,
        status:    Optional[str] = None,
        search:    Optional[str] = None,
        sort_by:   str = "name",
        sort_dir:  str = "asc",
        page:      int = 1,
        page_size: int = 20,
    ) -> Tuple[List[dict], int]:
        """
        Return (items, total) for the campaign list endpoint.

        Checks Redis cache first; falls back to DB query or seed data.
        Filters by platform/status/search when provided.
        """
        # Try cache
        cache_key = CacheKey.campaigns(
            user_id, platform=platform, status=status,
            search=search, sort_by=sort_by, sort_dir=sort_dir,
            page=str(page), page_size=str(page_size),
        )
        hit = await cache.get(cache_key)
        if hit:
            return hit["items"], hit["total"]

        # DB query (ORM)
        if self.db and _ORM_AVAILABLE:
            items, total = await self._db_list(
                user_id, platform, status, search, sort_by, sort_dir, page, page_size,
            )
        else:
            items, total = _seed_list(
                platform, status, search, sort_by, sort_dir, page, page_size,
            )

        await cache.set(cache_key, {"items": items, "total": total}, TTL_CAMPAIGNS)
        return items, total

    async def _db_list(
        self,
        user_id:   str,
        platform:  Optional[str],
        status:    Optional[str],
        search:    Optional[str],
        sort_by:   str,
        sort_dir:  str,
        page:      int,
        page_size: int,
    ) -> Tuple[List[dict], int]:
        """Execute the filtered campaign query against PostgreSQL."""
        stmt = (
            select(Campaign)
            .where(Campaign.user_id == uuid.UUID(user_id))
            .where(Campaign.is_deleted.is_(False))
        )
        if platform and platform != "All Platforms":
            stmt = stmt.where(Campaign.platform == platform)
        if status and status != "All":
            stmt = stmt.where(Campaign.status == status)
        if search:
            q = f"%{search.lower()}%"
            from sqlalchemy import or_
            stmt = stmt.where(
                or_(
                    func.lower(Campaign.name).like(q),
                    func.lower(Campaign.platform).like(q),
                )
            )

        # Count total
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = (await self.db.execute(count_stmt)).scalar_one()

        # Sort
        col = getattr(Campaign, sort_by, Campaign.name)
        stmt = stmt.order_by(col.desc() if sort_dir == "desc" else col)

        # Paginate
        stmt = stmt.offset((page - 1) * page_size).limit(page_size)
        rows = (await self.db.execute(stmt)).scalars().all()
        return [r.to_dict() for r in rows], total

    async def get_campaign(
        self,
        user_id:     str,
        campaign_id: str,
    ) -> Optional[dict]:
        """Return a single campaign dict, or None if not found / deleted."""
        cache_key = CacheKey.campaign(user_id, campaign_id)
        hit = await cache.get(cache_key)
        if hit:
            return hit

        if self.db and _ORM_AVAILABLE:
            try:
                uid = uuid.UUID(user_id)
                cid = uuid.UUID(campaign_id) if "-" in campaign_id else None
            except ValueError:
                cid = None

            if cid:
                row = await self.db.get(Campaign, cid)
                if row and str(row.user_id) == user_id and not row.is_deleted:
                    result = row.to_dict()
                    await cache.set(cache_key, result, TTL_CAMPAIGNS)
                    return result
            return None

        # Seed fallback (string IDs like "C-001")
        c = _SEED.get(campaign_id)
        if c and not c.get("is_deleted"):
            await cache.set(cache_key, c, TTL_CAMPAIGNS)
            return c
        return None

    async def get_kpis(self, user_id: str) -> dict:
        """Return aggregated campaign KPIs for the Dashboard KPI row."""
        cache_key = CacheKey.campaign_summary(user_id)
        hit = await cache.get(cache_key)
        if hit:
            return hit

        if self.db and _ORM_AVAILABLE:
            result = await self._db_kpis(user_id)
        else:
            result = _seed_kpis()

        await cache.set(cache_key, result, TTL_CAMPAIGNS)
        return result

    async def _db_kpis(self, user_id: str) -> dict:
        uid   = uuid.UUID(user_id)
        stmt  = select(Campaign).where(
            Campaign.user_id == uid,
            Campaign.is_deleted.is_(False),
        )
        rows  = (await self.db.execute(stmt)).scalars().all()
        active = [r for r in rows if r.status == CampaignStatus.ACTIVE]

        total_spend       = sum(float(r.spent)       for r in rows)
        total_impressions = sum(r.impressions         for r in rows)
        total_clicks      = sum(r.clicks              for r in rows)
        total_conversions = sum(r.conv                for r in rows)
        total_budget      = sum(float(r.budget)       for r in rows)

        spent_active = sum(float(r.spent) for r in active if r.spent > 0)
        roas_num     = sum(float(r.roas) * float(r.spent) for r in active if r.spent > 0)
        avg_roas     = round(roas_num / spent_active, 3) if spent_active else 0.0

        imp_active = sum(r.impressions for r in active if r.impressions > 0)
        clk_active = sum(r.clicks      for r in active if r.clicks      > 0)
        avg_ctr    = round(clk_active / imp_active * 100, 2) if imp_active else 0.0

        return {
            "totalSpend":       total_spend,
            "totalImpressions": total_impressions,
            "totalClicks":      total_clicks,
            "totalConversions": total_conversions,
            "totalBudget":      total_budget,
            "activeCampaigns":  len(active),
            "avgROAS":          avg_roas,
            "avgCTR":           avg_ctr,
        }

    async def get_performance(
        self,
        user_id:     str,
        campaign_id: str,
        period:      str = "7d",
    ) -> dict:
        """
        Return time-series performance arrays for the PerformanceChart.

        Checks cache; queries CampaignMetric rows; falls back to seed.
        period: '7d' | '30d' | '90d'
        """
        cache_key = CacheKey.campaign_performance(user_id, campaign_id, period)
        hit = await cache.get(cache_key)
        if hit:
            return hit

        if self.db and _ORM_AVAILABLE:
            result = await self._db_performance(user_id, campaign_id, period)
        else:
            result = _seed_performance(campaign_id, period)

        await cache.set(cache_key, result, TTL_CAMPAIGNS)
        return result

    async def _db_performance(
        self, user_id: str, campaign_id: str, period: str,
    ) -> dict:
        days = {"7d": 7, "30d": 30, "90d": 90}.get(period, 7)
        since = date.today() - timedelta(days=days)
        try:
            cid = uuid.UUID(campaign_id)
        except ValueError:
            return _seed_performance(campaign_id, period)

        stmt = (
            select(CampaignMetric)
            .where(
                CampaignMetric.campaign_id == cid,
                CampaignMetric.record_date >= since,
            )
            .order_by(CampaignMetric.record_date)
        )
        rows = (await self.db.execute(stmt)).scalars().all()

        if not rows:
            return _seed_performance(campaign_id, period)

        return {
            "campaignId":  campaign_id,
            "period":      period,
            "dates":       [r.record_date.isoformat() for r in rows],
            "impressions": [r.impressions              for r in rows],
            "clicks":      [r.clicks                   for r in rows],
            "conversions": [r.conversions               for r in rows],
            "spend":       [float(r.spend)              for r in rows],
        }

    # ── WRITE ─────────────────────────────────────────────────

    async def create_campaign(self, user_id: str, payload: dict) -> dict:
        """
        Create a new campaign.
        Invalidates the campaign list cache for the user.
        """
        if self.db and _ORM_AVAILABLE:
            row = Campaign(
                user_id   = uuid.UUID(user_id),
                name      = payload["name"],
                platform  = payload["platform"],
                status    = payload.get("status", "draft"),
                budget    = Decimal(str(payload["budget"])),
                objective = payload.get("objective"),
            )
            self.db.add(row)
            await self.db.flush()
            result = row.to_dict()
        else:
            # Seed fallback
            new_id = f"C-{uuid.uuid4().hex[:6].upper()}"
            result = {
                "id":          new_id,
                "name":        payload["name"],
                "platform":    payload["platform"],
                "status":      payload.get("status", "draft"),
                "budget":      float(payload["budget"]),
                "spent":       0.0,
                "impressions": 0,
                "clicks":      0,
                "ctr":         "—",
                "conv":        0,
                "roas":        0.0,
                "objective":   payload.get("objective"),
                "createdAt":   datetime.now(timezone.utc).isoformat(),
                "updatedAt":   datetime.now(timezone.utc).isoformat(),
            }
            _SEED[new_id] = result

        await cache.invalidate_user(user_id)
        logger.info("Campaign created: %s by user %s", result["id"], user_id)
        return result

    async def update_campaign(
        self, user_id: str, campaign_id: str, payload: dict,
    ) -> Optional[dict]:
        """Partial update — only fields present in payload are changed."""
        if self.db and _ORM_AVAILABLE:
            try:
                cid = uuid.UUID(campaign_id)
            except ValueError:
                return None
            row = await self.db.get(Campaign, cid)
            if not row or str(row.user_id) != user_id or row.is_deleted:
                return None
            for field in ("name", "platform", "status", "budget", "objective"):
                if field in payload and payload[field] is not None:
                    val = Decimal(str(payload[field])) if field == "budget" else payload[field]
                    setattr(row, field, val)
            if "budget" in payload:
                row.recompute_ctr()
            await self.db.flush()
            result = row.to_dict()
        else:
            c = _SEED.get(campaign_id)
            if not c or c.get("is_deleted"):
                return None
            c.update({k: v for k, v in payload.items() if v is not None})
            c["updatedAt"] = datetime.now(timezone.utc).isoformat()
            result = c

        await cache.invalidate_user(user_id)
        logger.info("Campaign updated: %s by user %s", campaign_id, user_id)
        return result

    async def delete_campaign(self, user_id: str, campaign_id: str) -> bool:
        """Soft-delete a campaign. Returns True on success."""
        if self.db and _ORM_AVAILABLE:
            try:
                cid = uuid.UUID(campaign_id)
            except ValueError:
                return False
            row = await self.db.get(Campaign, cid)
            if not row or str(row.user_id) != user_id:
                return False
            row.soft_delete()
            await self.db.flush()
        else:
            c = _SEED.get(campaign_id)
            if not c:
                return False
            c["is_deleted"] = True
            c["deletedAt"]  = datetime.now(timezone.utc).isoformat()

        await cache.invalidate_user(user_id)
        logger.info("Campaign soft-deleted: %s by user %s", campaign_id, user_id)
        return True

    async def update_status(
        self, user_id: str, campaign_id: str, status: str,
    ) -> Optional[dict]:
        """Update the status field only (PATCH /campaigns/{id}/status)."""
        return await self.update_campaign(user_id, campaign_id, {"status": status})
