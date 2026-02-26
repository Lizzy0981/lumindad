# backend/app/dependencies.py
"""
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  LumindAd Enterprise · backend/app/dependencies.py
  FastAPI Dependency Injection

  All reusable FastAPI dependencies live here.
  Endpoints import what they need via:
      from app.dependencies import get_current_user, get_db

  Dependency tree
  ─────────────────
  get_db()                   → AsyncSession (SQLAlchemy 2)
  get_redis()                → Redis (aioredis)
  get_current_user()         → AuthUser  (from JWT Bearer)
  require_active_user()      → AuthUser  (checks is_active)
  require_admin()            → AuthUser  (checks role == admin)
  PaginationParams           → page, page_size, sort, sort_dir
  get_pagination()           → PaginationParams instance
  validate_upload_files()    → List[UploadFile] validated
  get_rate_limit_key()       → str for slowapi

  JWT flow
  ─────────
  1. Client sends: Authorization: Bearer <access_token>
  2. HTTPBearer extracts the token string
  3. decode_access_token() verifies signature + expiry
  4. Payload sub field → user_id
  5. get_current_user returns AuthUser dict

  Database
  ─────────
  SQLAlchemy 2.0 async session via AsyncSession + asyncpg.
  Falls back to SQLite (aiosqlite) when DATABASE_URL is unset.
  Each request gets its own session; committed or rolled back on exit.

  Redis
  ──────
  aioredis connection pool — one pool per process.
  Used by: campaign cache, analytics cache, budget cache (5min TTL),
           upload session store (24h TTL), rate limiter.

  Author : Elizabeth Díaz Familia
           AI Data Scientist · Sustainable Intelligence & BI
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import AsyncGenerator, List, Optional

import jwt
from fastapi import Depends, Header, HTTPException, Query, UploadFile, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel

from app.config import settings

logger = logging.getLogger(__name__)

# ─── Optional heavy deps — graceful fallback if not installed ─────────────────

try:
    from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
    _SA_AVAILABLE = True
except ImportError:
    _SA_AVAILABLE = False
    AsyncSession = None  # type: ignore[assignment,misc]

try:
    import redis.asyncio as aioredis
    _REDIS_AVAILABLE = True
except ImportError:
    _REDIS_AVAILABLE = False
    aioredis = None  # type: ignore[assignment]

# ─── JWT security scheme ──────────────────────────────────────────────────────

_bearer = HTTPBearer(auto_error=True)

# ═══════════════════════════════════════════════════════════════
# DATABASE
# ═══════════════════════════════════════════════════════════════

# Lazy-initialised engine — created on first request, not at import time.
_engine = None
_async_session_factory = None


def _get_engine():
    """Return (or create) the SQLAlchemy async engine."""
    global _engine
    if _engine is None and _SA_AVAILABLE:
        url = settings.effective_database_url
        _engine = create_async_engine(
            url,
            echo        = settings.db_echo_effective,
            pool_size   = settings.DB_POOL_SIZE,
            max_overflow= settings.DB_MAX_OVERFLOW,
            pool_timeout= settings.DB_POOL_TIMEOUT,
            pool_recycle= settings.DB_POOL_RECYCLE,
        )
        logger.info("SQLAlchemy async engine created: %s", url.split("@")[-1])
    return _engine


def _get_session_factory():
    """Return (or create) the async session factory."""
    global _async_session_factory
    if _async_session_factory is None and _SA_AVAILABLE:
        engine = _get_engine()
        _async_session_factory = async_sessionmaker(
            bind          = engine,
            class_        = AsyncSession,
            expire_on_commit = False,
            autocommit    = False,
            autoflush     = False,
        )
    return _async_session_factory


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    FastAPI dependency: yield an async SQLAlchemy session.

    Each HTTP request gets its own session.
    Commits on success, rolls back on exception.

    Usage:
        @router.get('/campaigns')
        async def list_campaigns(db: AsyncSession = Depends(get_db)):
            result = await db.execute(select(Campaign))
            ...
    """
    if not _SA_AVAILABLE:
        # Development fallback — no real DB configured
        logger.warning("SQLAlchemy not available — returning None for db session")
        yield None  # type: ignore[misc]
        return

    factory = _get_session_factory()
    if factory is None:
        yield None  # type: ignore[misc]
        return

    async with factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


# ═══════════════════════════════════════════════════════════════
# REDIS
# ═══════════════════════════════════════════════════════════════

_redis_pool: Optional[object] = None


def _get_redis_pool():
    """Return (or create) the aioredis connection pool."""
    global _redis_pool
    if _redis_pool is None and _REDIS_AVAILABLE:
        _redis_pool = aioredis.from_url(
            settings.REDIS_URL,
            encoding     = "utf-8",
            decode_responses = True,
            max_connections  = 20,
        )
        logger.info("Redis pool created: %s", settings.REDIS_URL.split("@")[-1])
    return _redis_pool


async def get_redis():
    """
    FastAPI dependency: yield an aioredis client.

    Usage:
        @router.get('/campaigns')
        async def list_campaigns(redis = Depends(get_redis)):
            cached = await redis.get('campaigns:list')
    """
    pool = _get_redis_pool()
    if pool is None:
        logger.warning("Redis not available — returning None")
        yield None
        return
    yield pool


# ═══════════════════════════════════════════════════════════════
# JWT UTILITIES
# ═══════════════════════════════════════════════════════════════

def create_access_token(
    subject: str,
    extra:   dict | None = None,
    expires: timedelta | None = None,
) -> str:
    """
    Create a signed JWT access token.

    Args:
        subject: User ID (stored as 'sub' claim)
        extra:   Additional claims (e.g. email, role)
        expires: Custom expiry; defaults to ACCESS_TOKEN_EXPIRE_MINUTES

    Returns:
        Encoded JWT string

    Example:
        token = create_access_token("usr_001", extra={"role": "admin"})
    """
    exp_delta = expires or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    now = datetime.now(timezone.utc)
    payload = {
        "sub": subject,
        "iat": now,
        "exp": now + exp_delta,
        "type": "access",
    }
    if extra:
        payload.update(extra)

    return jwt.encode(
        payload,
        settings.JWT_SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM,
    )


def create_refresh_token(subject: str) -> str:
    """
    Create a signed JWT refresh token (longer-lived).

    Args:
        subject: User ID

    Returns:
        Encoded JWT string
    """
    return jwt.encode(
        {
            "sub": subject,
            "iat": datetime.now(timezone.utc),
            "exp": datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
            "type": "refresh",
        },
        settings.JWT_SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM,
    )


def decode_token(token: str, expected_type: str = "access") -> dict:
    """
    Decode and validate a JWT token.

    Args:
        token:         The JWT string from the Authorization header
        expected_type: 'access' or 'refresh'

    Returns:
        Decoded payload dict

    Raises:
        HTTPException 401 — expired, invalid signature, or wrong type
    """
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.InvalidTokenError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Could not validate credentials: {exc}",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if payload.get("type") != expected_type:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token type. Expected '{expected_type}'.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return payload


# ═══════════════════════════════════════════════════════════════
# AUTH USER MODEL
# ═══════════════════════════════════════════════════════════════

class AuthUser(BaseModel):
    """
    Authenticated user context — injected into protected endpoints.

    Fields mirror services/api.ts AuthUser interface and
    LumindAd.jsx sidebar user: 'Elizabeth D.F.' / 'Sustainable AI'.
    """
    id:       str
    email:    str
    name:     str
    role:     str          # 'admin' | 'analyst' | 'user'
    is_active: bool = True


# ─── In-memory user store (replace with DB in production) ────────────────────

_USERS: dict[str, dict] = {
    "usr_001": {
        "id":       "usr_001",
        "email":    "elizabeth@lumindad.ai",
        "name":     "Elizabeth Díaz Familia",
        "role":     "admin",
        "is_active": True,
        # bcrypt hash of "lumindad2025" — replace in production
        "password_hash": "$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewYpfFHDHqj2H4Pu",
    },
    "usr_002": {
        "id":       "usr_002",
        "email":    "demo@lumindad.ai",
        "name":     "Demo Analyst",
        "role":     "analyst",
        "is_active": True,
        "password_hash": "$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewYpfFHDHqj2H4Pu",
    },
}

_EMAIL_TO_ID: dict[str, str] = {
    u["email"]: u["id"] for u in _USERS.values()
}


def get_user_by_id(user_id: str) -> dict | None:
    return _USERS.get(user_id)


def get_user_by_email(email: str) -> dict | None:
    uid = _EMAIL_TO_ID.get(email)
    return _USERS.get(uid) if uid else None


# ═══════════════════════════════════════════════════════════════
# AUTH DEPENDENCIES
# ═══════════════════════════════════════════════════════════════

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer),
) -> AuthUser:
    """
    FastAPI dependency: extract and validate the JWT Bearer token.

    Returns the authenticated user for the current request.

    Usage:
        @router.get('/me')
        async def me(user: AuthUser = Depends(get_current_user)):
            return user

    Raises:
        HTTPException 401 — missing, expired, or invalid token
        HTTPException 404 — user_id from token not found in DB
    """
    payload = decode_token(credentials.credentials, expected_type="access")
    user_id: str | None = payload.get("sub")

    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token payload missing 'sub' claim",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Production: replace with `await db.get(User, user_id)`
    raw = get_user_by_id(user_id)
    if not raw:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return AuthUser(**{k: raw[k] for k in AuthUser.model_fields if k in raw})


async def require_active_user(
    current_user: AuthUser = Depends(get_current_user),
) -> AuthUser:
    """
    Dependency: require an active (non-suspended) user.

    Usage:
        @router.post('/campaigns')
        async def create(user: AuthUser = Depends(require_active_user)):
            ...
    """
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is suspended",
        )
    return current_user


async def require_admin(
    current_user: AuthUser = Depends(require_active_user),
) -> AuthUser:
    """
    Dependency: require admin role.

    Usage:
        @router.delete('/campaigns/{id}')
        async def delete(admin: AuthUser = Depends(require_admin)):
            ...
    """
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return current_user


# ═══════════════════════════════════════════════════════════════
# PAGINATION
# ═══════════════════════════════════════════════════════════════

class PaginationParams(BaseModel):
    """
    Standard pagination parameters for list endpoints.

    Query params:
        page:      1-based page number (default 1)
        page_size: Items per page, max 200 (default 20)
        sort_by:   Field name to sort by
        sort_dir:  'asc' or 'desc' (default 'desc')

    Example:
        GET /api/v1/campaigns?page=2&page_size=50&sort_by=roas&sort_dir=desc
    """
    page:      int = 1
    page_size: int = 20
    sort_by:   Optional[str] = None
    sort_dir:  str = "desc"

    @property
    def offset(self) -> int:
        return (self.page - 1) * self.page_size

    @property
    def limit(self) -> int:
        return self.page_size


def get_pagination(
    page:      int = Query(default=1,  ge=1, description="Page number (1-based)"),
    page_size: int = Query(default=20, ge=1, le=200, description="Items per page"),
    sort_by:   Optional[str] = Query(default=None, description="Field to sort by"),
    sort_dir:  str = Query(default="desc", pattern="^(asc|desc)$"),
) -> PaginationParams:
    """
    FastAPI dependency: extract pagination params from query string.

    Usage:
        @router.get('/campaigns')
        async def list_campaigns(
            pagination: PaginationParams = Depends(get_pagination),
        ):
            skip  = pagination.offset
            limit = pagination.limit
    """
    return PaginationParams(
        page      = page,
        page_size = page_size,
        sort_by   = sort_by,
        sort_dir  = sort_dir,
    )


# ═══════════════════════════════════════════════════════════════
# FILE UPLOAD VALIDATION
# ═══════════════════════════════════════════════════════════════

_ACCEPTED_EXT = set(settings.ACCEPTED_EXTENSIONS)


async def validate_upload_files(
    files: List[UploadFile],
) -> List[UploadFile]:
    """
    FastAPI dependency: validate a list of upload files.

    Checks:
    1. Queue count ≤ MAX_UPLOAD_FILES (10)
    2. Each file extension is in the whitelist (10 formats)
    3. Each file size ≤ MAX_FILE_SIZE_BYTES (2 GB)
    4. No empty files (size > 0)

    Mirrors frontend utils/fileValidation.ts validateFileList().

    Usage:
        @router.post('/upload')
        async def upload(
            files: List[UploadFile] = File(...),
            validated: List[UploadFile] = Depends(validate_upload_files),
        ):
            ...

    Raises:
        HTTPException 400 — any validation failure
        HTTPException 413 — file too large
    """
    if len(files) > settings.MAX_UPLOAD_FILES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Too many files. Maximum {settings.MAX_UPLOAD_FILES} files "
                f"per upload. Received {len(files)}."
            ),
        )

    for f in files:
        # Extension check
        fname  = (f.filename or "").lower()
        suffix = "." + fname.rsplit(".", 1)[-1] if "." in fname else ""
        if suffix not in _ACCEPTED_EXT:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"File '{f.filename}' has unsupported format '{suffix}'. "
                    f"Accepted: {', '.join(sorted(_ACCEPTED_EXT))}"
                ),
            )

        # Size check (read Content-Length header when available)
        if f.size is not None:
            if f.size == 0:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"File '{f.filename}' is empty.",
                )
            if f.size > settings.MAX_FILE_SIZE_BYTES:
                max_gb = settings.MAX_FILE_SIZE_BYTES / (1024 ** 3)
                raise HTTPException(
                    status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                    detail=(
                        f"File '{f.filename}' exceeds the {max_gb:.0f} GB limit."
                    ),
                )

    return files


# ═══════════════════════════════════════════════════════════════
# RATE LIMIT KEY
# ═══════════════════════════════════════════════════════════════

def get_rate_limit_key(
    request_id: Optional[str] = Header(None, alias="X-Request-ID"),
    current_user: Optional[AuthUser] = Depends(get_current_user),
) -> str:
    """
    Rate limit key — used by slowapi.

    Returns the authenticated user ID when available,
    falls back to the X-Request-ID header for unauthenticated routes.

    Usage:
        @router.post('/upload')
        @limiter.limit(settings.RATE_LIMIT_UPLOAD, key_func=get_rate_limit_key)
        async def upload(request: Request, ...):
            ...
    """
    if current_user:
        return f"user:{current_user.id}"
    return f"anon:{request_id or 'unknown'}"


# ═══════════════════════════════════════════════════════════════
# CONVENIENCE RE-EXPORTS
# ═══════════════════════════════════════════════════════════════

__all__ = [
    # Database
    "get_db",
    "AsyncSession",
    # Redis
    "get_redis",
    # JWT helpers
    "create_access_token",
    "create_refresh_token",
    "decode_token",
    # Auth users
    "AuthUser",
    "get_current_user",
    "require_active_user",
    "require_admin",
    "get_user_by_email",
    "get_user_by_id",
    # Pagination
    "PaginationParams",
    "get_pagination",
    # Upload
    "validate_upload_files",
    # Rate limit
    "get_rate_limit_key",
]
