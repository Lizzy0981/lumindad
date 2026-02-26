# backend/app/core/cache.py
"""
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  LumindAd Enterprise · backend/app/core/cache.py
  Redis async cache layer with TTL presets and @cached decorator

  Architecture
  ─────────────
  Uses the same aioredis pool initialised in app/dependencies.py.
  Cache is keyed by domain prefix + resource identifiers.

  TTL presets (from config.py — mirror frontend offlineCache.ts)
  ──────────────────────────────────────────────────────────────
  campaigns           5 min   (CACHE_TTL_CAMPAIGNS  = 300 s)
  analytics           10 min  (CACHE_TTL_ANALYTICS  = 600 s)
  budget              5 min   (CACHE_TTL_BUDGET     = 300 s)
  ml_models           30 min  (CACHE_TTL_ML_MODELS  = 1800 s)
  upload sessions     24 h    (CACHE_TTL_UPLOAD     = 86400 s)
  BI exports          6 h     (CACHE_TTL_SIX_HOURS  = 21600 s)

  Key naming convention
  ──────────────────────
  {domain}:{version}:{user_id}:{resource_id}

  Examples:
    campaigns:v1:usr_001:list              → campaign list for user
    campaigns:v1:usr_001:C-001             → single campaign
    analytics:v1:usr_001:series:Google Ads → filtered series
    budget:v1:usr_001:summary              → budget summary
    ml:v1:global:models                    → ML model list (global)

  Graceful degradation
  ─────────────────────
  All cache operations silently catch exceptions and return None
  (cache miss) when Redis is unavailable. The application
  continues to work without caching in degraded mode.

  @cached decorator
  ──────────────────
  Wraps async functions with transparent read-through caching.
  Cache is keyed by the function's positional + keyword args.

  Usage:
    @cached("campaigns:v1", ttl=settings.CACHE_TTL_CAMPAIGNS)
    async def get_campaigns(user_id: str, platform: str) -> list:
        ...

  Cache invalidation
  ───────────────────
  invalidate(key)             — delete single key
  invalidate_prefix(prefix)   — delete all keys matching prefix*
  invalidate_user(user_id)    — delete all keys for a user

  Invalidation is called by write endpoints (POST/PATCH/DELETE)
  so reads always return fresh data after mutations.

  Author : Elizabeth Díaz Familia
           AI Data Scientist · Sustainable Intelligence & BI
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"""

from __future__ import annotations

import functools
import hashlib
import json
import logging
from typing import Any, Callable, Optional, TypeVar

from app.config import settings

logger = logging.getLogger(__name__)

# ── Optional aioredis ─────────────────────────────────────────────────────────
try:
    import redis.asyncio as aioredis
    _REDIS_AVAILABLE = True
except ImportError:
    aioredis = None  # type: ignore[assignment]
    _REDIS_AVAILABLE = False

F = TypeVar("F", bound=Callable[..., Any])

# ─── Module-level pool (shared with dependencies.py) ──────────────────────────
_pool: Any = None


async def _get_pool():
    """Return (or lazily create) the aioredis pool for cache DB."""
    global _pool
    if _pool is not None:
        return _pool
    if not _REDIS_AVAILABLE:
        return None
    try:
        _pool = aioredis.from_url(
            settings.REDIS_URL,
            db=settings.REDIS_CACHE_DB,
            decode_responses=True,
            max_connections=20,
            socket_connect_timeout=2,
            socket_timeout=2,
        )
        await _pool.ping()
        logger.debug("Cache Redis pool initialised (DB %d)", settings.REDIS_CACHE_DB)
    except Exception as exc:
        logger.warning("Cache Redis unavailable: %s — running without cache", exc)
        _pool = None
    return _pool


async def close_pool() -> None:
    """Close the cache Redis pool (called from app lifespan shutdown)."""
    global _pool
    if _pool is not None:
        await _pool.aclose()
        _pool = None


# ═══════════════════════════════════════════════════════════════
# KEY BUILDER
# ═══════════════════════════════════════════════════════════════

class CacheKey:
    """
    Key builder for consistent naming across all domains.

    All keys follow: {domain}:v1:{user_id}:{...parts}

    Examples:
        CacheKey.campaigns("usr_001")          → "campaigns:v1:usr_001:list"
        CacheKey.campaign("usr_001", "C-001")  → "campaigns:v1:usr_001:C-001"
        CacheKey.analytics("usr_001", "series:Google Ads")
                                                → "analytics:v1:usr_001:series:Google Ads"
        CacheKey.budget_summary("usr_001")     → "budget:v1:usr_001:summary"
        CacheKey.ml_models()                   → "ml:v1:global:models"
    """

    V = "v1"   # schema version — bump when payload shape changes

    @staticmethod
    def campaigns(user_id: str, **kwargs) -> str:
        parts = ":".join(f"{k}={v}" for k, v in sorted(kwargs.items()) if v)
        return f"campaigns:{CacheKey.V}:{user_id}:list{'|' + parts if parts else ''}"

    @staticmethod
    def campaign(user_id: str, campaign_id: str) -> str:
        return f"campaigns:{CacheKey.V}:{user_id}:{campaign_id}"

    @staticmethod
    def campaign_summary(user_id: str) -> str:
        return f"campaigns:{CacheKey.V}:{user_id}:summary"

    @staticmethod
    def campaign_performance(user_id: str, campaign_id: str, period: str = "7d") -> str:
        return f"campaigns:{CacheKey.V}:{user_id}:{campaign_id}:perf:{period}"

    @staticmethod
    def analytics(user_id: str, *parts: str) -> str:
        suffix = ":".join(str(p) for p in parts) if parts else "all"
        return f"analytics:{CacheKey.V}:{user_id}:{suffix}"

    @staticmethod
    def analytics_kpis(user_id: str) -> str:
        return f"analytics:{CacheKey.V}:{user_id}:kpis"

    @staticmethod
    def analytics_series(user_id: str, platform: Optional[str] = None) -> str:
        plat = platform or "all"
        return f"analytics:{CacheKey.V}:{user_id}:series:{plat}"

    @staticmethod
    def budget_summary(user_id: str) -> str:
        return f"budget:{CacheKey.V}:{user_id}:summary"

    @staticmethod
    def budget_daily(user_id: str) -> str:
        return f"budget:{CacheKey.V}:{user_id}:daily"

    @staticmethod
    def budget_allocations(user_id: str) -> str:
        return f"budget:{CacheKey.V}:{user_id}:allocations"

    @staticmethod
    def budget_recommendation(user_id: str) -> str:
        return f"budget:{CacheKey.V}:{user_id}:recommendation"

    @staticmethod
    def budget_forecast(user_id: str, days: int = 30) -> str:
        return f"budget:{CacheKey.V}:{user_id}:forecast:{days}"

    @staticmethod
    def ml_models() -> str:
        return f"ml:{CacheKey.V}:global:models"

    @staticmethod
    def ml_metrics(model_name: str) -> str:
        safe = model_name.lower().replace(" ", "_")
        return f"ml:{CacheKey.V}:global:metrics:{safe}"

    @staticmethod
    def user_prefix(user_id: str) -> str:
        """Prefix for all keys belonging to a user — used in invalidate_user."""
        return f"campaigns:{CacheKey.V}:{user_id}:"

    @staticmethod
    def from_args(prefix: str, *args, **kwargs) -> str:
        """
        Generic key from arbitrary arguments — used by @cached decorator.
        Stable hash of args/kwargs is appended to the prefix.
        """
        raw = json.dumps({"a": args, "k": sorted(kwargs.items())}, default=str)
        h   = hashlib.sha256(raw.encode()).hexdigest()[:12]
        return f"{prefix}:{h}"


# ═══════════════════════════════════════════════════════════════
# PRIMITIVE OPS
# ═══════════════════════════════════════════════════════════════

async def get(key: str) -> Optional[Any]:
    """
    Read a value from Redis cache.

    Returns:
        Deserialised value on hit, None on miss or error.
    """
    r = await _get_pool()
    if r is None:
        return None
    try:
        raw = await r.get(key)
        if raw is None:
            return None
        return json.loads(raw)
    except Exception as exc:
        logger.debug("Cache GET %r failed: %s", key, exc)
        return None


async def set(key: str, value: Any, ttl: int) -> bool:
    """
    Write a value to Redis cache with a TTL in seconds.

    Args:
        key:   Cache key (use CacheKey.* builders)
        value: JSON-serialisable value
        ttl:   Time-to-live in seconds (use settings.CACHE_TTL_*)

    Returns:
        True on success, False on error or unavailability.
    """
    r = await _get_pool()
    if r is None:
        return False
    try:
        raw = json.dumps(value, default=str)
        await r.setex(key, ttl, raw)
        logger.debug("Cache SET %r ttl=%d", key, ttl)
        return True
    except Exception as exc:
        logger.debug("Cache SET %r failed: %s", key, exc)
        return False


async def delete(key: str) -> bool:
    """Delete a single key from cache."""
    r = await _get_pool()
    if r is None:
        return False
    try:
        await r.delete(key)
        logger.debug("Cache DEL %r", key)
        return True
    except Exception as exc:
        logger.debug("Cache DEL %r failed: %s", key, exc)
        return False


async def invalidate(key: str) -> bool:
    """Alias for delete() — used by write endpoints."""
    return await delete(key)


async def invalidate_prefix(prefix: str) -> int:
    """
    Delete all keys matching prefix* using Redis SCAN + DEL.

    Returns:
        Number of deleted keys (0 if Redis unavailable).

    Used to invalidate an entire domain when bulk writes occur,
    e.g. after importing a new budget period.
    """
    r = await _get_pool()
    if r is None:
        return 0
    deleted = 0
    try:
        async for key in r.scan_iter(match=f"{prefix}*", count=100):
            await r.delete(key)
            deleted += 1
        logger.debug("Cache invalidate_prefix %r → %d keys deleted", prefix, deleted)
    except Exception as exc:
        logger.debug("Cache invalidate_prefix %r failed: %s", prefix, exc)
    return deleted


async def invalidate_user(user_id: str) -> int:
    """
    Invalidate all cached data for a specific user.

    Called after:
      - User updates their campaign list
      - Budget period is changed
      - User account is modified by admin
    """
    count = 0
    prefixes = [
        f"campaigns:{CacheKey.V}:{user_id}",
        f"analytics:{CacheKey.V}:{user_id}",
        f"budget:{CacheKey.V}:{user_id}",
    ]
    for prefix in prefixes:
        count += await invalidate_prefix(prefix)
    logger.debug("Cache invalidate_user %r → %d keys deleted", user_id, count)
    return count


async def ttl(key: str) -> int:
    """
    Return remaining TTL for a key in seconds.
    Returns -2 if the key does not exist, -1 if it has no TTL.
    """
    r = await _get_pool()
    if r is None:
        return -2
    try:
        return await r.ttl(key)
    except Exception:
        return -2


async def health_check() -> dict:
    """
    Cache health check — called by GET /health.

    Returns:
        { "status": "ok" | "error", "latency_ms": float }
    """
    import time
    t0 = time.perf_counter()
    r = await _get_pool()
    if r is None:
        return {"status": "unavailable", "latency_ms": 0}
    try:
        await r.ping()
        return {
            "status":     "ok",
            "latency_ms": round((time.perf_counter() - t0) * 1000, 2),
            "db":         settings.REDIS_CACHE_DB,
        }
    except Exception as exc:
        return {
            "status":     "error",
            "latency_ms": round((time.perf_counter() - t0) * 1000, 2),
            "error":      str(exc),
        }


# ═══════════════════════════════════════════════════════════════
# @cached DECORATOR
# ═══════════════════════════════════════════════════════════════

def cached(
    prefix: str,
    ttl:    int,
    key_fn: Optional[Callable[..., str]] = None,
) -> Callable[[F], F]:
    """
    Async function decorator for transparent read-through caching.

    Args:
        prefix:  Key prefix string (e.g. "campaigns:v1")
        ttl:     TTL in seconds (use settings.CACHE_TTL_*)
        key_fn:  Optional function(args, kwargs) → str for custom keys.
                 Defaults to CacheKey.from_args(prefix, *args, **kwargs).

    Usage:
        @cached("analytics:v1", ttl=settings.CACHE_TTL_ANALYTICS)
        async def get_series(user_id: str, platform: str = "all") -> list:
            # expensive DB query here
            return rows

    Cache hit:  returns cached JSON-deserialised value
    Cache miss: calls the wrapped function, caches the result, returns it

    The cache is completely transparent — the function signature
    and return type are preserved via functools.wraps.
    """
    def decorator(func: F) -> F:
        @functools.wraps(func)
        async def wrapper(*args: Any, **kwargs: Any) -> Any:
            # Build cache key
            if key_fn is not None:
                cache_key = key_fn(*args, **kwargs)
            else:
                cache_key = CacheKey.from_args(prefix, *args, **kwargs)

            # Try cache hit
            hit = await get(cache_key)
            if hit is not None:
                logger.debug("Cache HIT %r", cache_key)
                return hit

            # Cache miss — call function
            result = await func(*args, **kwargs)

            # Store result (non-blocking failure)
            if result is not None:
                await set(cache_key, result, ttl)

            return result

        return wrapper  # type: ignore[return-value]
    return decorator


# ═══════════════════════════════════════════════════════════════
# TTL CONSTANTS (convenience re-exports from settings)
# ═══════════════════════════════════════════════════════════════

TTL_CAMPAIGNS  = settings.CACHE_TTL_CAMPAIGNS   # 300 s  (5 min)
TTL_ANALYTICS  = settings.CACHE_TTL_ANALYTICS   # 600 s  (10 min)
TTL_BUDGET     = settings.CACHE_TTL_BUDGET      # 300 s  (5 min)
TTL_ML         = settings.CACHE_TTL_ML_MODELS   # 1800 s (30 min)
TTL_UPLOAD     = settings.CACHE_TTL_UPLOAD      # 86400 s (24 h)
TTL_SIX_HOURS  = settings.CACHE_TTL_SIX_HOURS   # 21600 s (6 h)
