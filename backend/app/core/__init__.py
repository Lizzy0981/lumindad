# backend/app/core/__init__.py
"""
LumindAd Enterprise · backend/app/core
Infrastructure layer: database, cache, security, events.

Exports
────────
from app.core.database import get_db, init_db, close_db, health_check as db_health
from app.core.cache    import get, set, delete, invalidate_prefix, CacheKey, cached
from app.core.security import hash_password, verify_password, create_access_token, decode_token
from app.core.events   import lifespan, broadcast_kpi_update

Author : Elizabeth Díaz Familia
         AI Data Scientist · Sustainable Intelligence & BI
"""
