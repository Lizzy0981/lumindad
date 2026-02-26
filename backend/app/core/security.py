# backend/app/core/security.py
"""
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  LumindAd Enterprise · backend/app/core/security.py
  JWT · bcrypt · OAuth2 · rate-limit · input sanitisation

  Responsibility split
  ─────────────────────
  This module owns all *cryptographic primitives* and stateless
  token operations.  app/dependencies.py owns the *FastAPI
  dependency injection* layer (get_current_user, require_admin …).
  Keep the two layers separate so Celery tasks can use this
  module without importing FastAPI.

  Token design (mirrors services/api.ts JWT contract)
  ──────────────────────────────────────────────────────
  Access token:   HS256 · exp = now + 60 min  (ACCESS_TOKEN_EXPIRE)
  Refresh token:  HS256 · exp = now + 7 days  (REFRESH_TOKEN_EXPIRE)
  Claims: { sub, type, iat, exp, email?, role? }

  Token type discriminator ("type" claim)
  ─────────────────────────────────────────
  "access"  → used in Authorization: Bearer <token>
  "refresh" → used only in POST /auth/refresh

  decode_token validates "type" so a refresh token cannot be
  used as an access token and vice-versa.

  Password hashing
  ────────────────
  passlib CryptContext: bcrypt cost = settings.BCRYPT_ROUNDS (12)
  SHA-256 fallback when passlib is unavailable (dev only).

  Token blacklist (Redis)
  ────────────────────────
  POST /auth/logout calls blacklist_token(jti, ttl).
  is_blacklisted(jti) → bool is called in decode_token.
  Requires Redis; silently skips blacklist checks when unavailable.

  Input sanitisation
  ───────────────────
  sanitize_str() strips HTML/JS injection from user-supplied strings.
  Used in request validators before writing to the DB.

  Author : Elizabeth Díaz Familia
           AI Data Scientist · Sustainable Intelligence & BI
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"""

from __future__ import annotations

import hashlib
import logging
import re
import secrets
import time
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

from app.config import settings

logger = logging.getLogger(__name__)

# ── Optional heavy deps ────────────────────────────────────────────────────────

try:
    from passlib.context import CryptContext
    _pwd_context = CryptContext(
        schemes=["bcrypt"],
        deprecated="auto",
        bcrypt__rounds=settings.BCRYPT_ROUNDS,
    )
    _PASSLIB = True
except ImportError:
    _pwd_context = None   # type: ignore[assignment]
    _PASSLIB = False
    logger.warning("passlib not installed — using SHA-256 fallback (dev only!)")

try:
    from jose import JWTError, jwt as _jose_jwt
    _JOSE = True
except ImportError:
    _JOSE = False
    _jose_jwt = None  # type: ignore[assignment]
    logger.warning("python-jose not installed — JWT ops will raise ImportError")

# OAuth2 scheme (used by FastAPI dependency layer in dependencies.py)
try:
    from fastapi.security import OAuth2PasswordBearer
    oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_PREFIX}/auth/login")
except Exception:
    oauth2_scheme = None  # type: ignore[assignment]


# ═══════════════════════════════════════════════════════════════
# PASSWORD HASHING
# ═══════════════════════════════════════════════════════════════

def hash_password(plain: str) -> str:
    """
    Hash a plain-text password.

    Uses bcrypt with cost factor = settings.BCRYPT_ROUNDS (12).
    Falls back to SHA-256 when passlib is not installed (dev only).

    NEVER call this from a hot path — bcrypt is intentionally slow.
    Call it only on POST /auth/register and POST /auth/change-password.

    Example:
        stored = hash_password("lumindad2025")
        # → '$2b$12$...'
    """
    if _PASSLIB:
        return _pwd_context.hash(plain)
    # Fallback — NOT secure for production
    return hashlib.sha256(plain.encode("utf-8")).hexdigest()


def verify_password(plain: str, hashed: str) -> bool:
    """
    Verify a plain-text password against a bcrypt hash.

    Returns False (never raises) on mismatch or if hashed is None.

    Constant-time comparison is handled by passlib / bcrypt internally.

    Example:
        ok = verify_password("lumindad2025", stored_hash)
    """
    if not plain or not hashed:
        return False
    try:
        if _PASSLIB:
            return _pwd_context.verify(plain, hashed)
        # Fallback
        return hashlib.sha256(plain.encode("utf-8")).hexdigest() == hashed
    except Exception as exc:
        logger.debug("Password verification error: %s", exc)
        return False


def needs_rehash(hashed: str) -> bool:
    """
    True if the stored hash was created with an old cost factor
    and should be rehashed with the current settings.BCRYPT_ROUNDS.

    Usage:
        if security.needs_rehash(user.hashed_password):
            user.hashed_password = security.hash_password(plain)
            await db.commit()
    """
    if not _PASSLIB:
        return False
    return _pwd_context.needs_update(hashed)


# ═══════════════════════════════════════════════════════════════
# JWT TOKEN OPERATIONS
# ═══════════════════════════════════════════════════════════════

def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _build_payload(
    subject:    str,
    token_type: str,
    expires_in: timedelta,
    extra:      Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Build a JWT payload dict.

    Standard claims:
        sub  — subject (user id)
        type — 'access' | 'refresh'  (LumindAd discriminator)
        iat  — issued at (Unix timestamp)
        exp  — expiry   (Unix timestamp)
        jti  — JWT id   (random 16-byte hex, used for blacklisting)
    """
    now = _now_utc()
    payload: Dict[str, Any] = {
        "sub":  subject,
        "type": token_type,
        "iat":  int(now.timestamp()),
        "exp":  int((now + expires_in).timestamp()),
        "jti":  secrets.token_hex(16),
    }
    if extra:
        payload.update(extra)
    return payload


def create_access_token(
    subject: str,
    extra:   Optional[Dict[str, Any]] = None,
    expires: Optional[timedelta]      = None,
) -> str:
    """
    Create a signed JWT access token.

    Args:
        subject: User UUID string (stored in "sub" claim)
        extra:   Additional claims e.g. {"email": ..., "role": ...}
        expires: Override expiry; defaults to settings.ACCESS_TOKEN_EXPIRE_MINUTES

    Returns:
        Signed JWT string (Bearer token)

    Mirrors services/api.ts — access token used in Authorization header.
    """
    if not _JOSE:
        raise ImportError("python-jose is required for JWT operations")

    ttl = expires or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = _build_payload(subject, "access", ttl, extra)
    return _jose_jwt.encode(
        payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM,
    )


def create_refresh_token(
    subject: str,
    extra:   Optional[Dict[str, Any]] = None,
    expires: Optional[timedelta]      = None,
) -> str:
    """
    Create a signed JWT refresh token.

    Refresh tokens have a 7-day TTL and can only be used at
    POST /auth/refresh — they are rejected everywhere else because
    decode_token checks the "type" claim.

    Mirrors services/api.ts — refreshToken stored in httpOnly cookie
    or localStorage depending on client config.
    """
    if not _JOSE:
        raise ImportError("python-jose is required for JWT operations")

    ttl = expires or timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    payload = _build_payload(subject, "refresh", ttl, extra)
    return _jose_jwt.encode(
        payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM,
    )


def decode_token(
    token:         str,
    expected_type: str = "access",
) -> Dict[str, Any]:
    """
    Decode and validate a JWT token.

    Validates:
      1. Signature   — HS256 with settings.JWT_SECRET_KEY
      2. Expiry      — raises ValueError if exp is in the past
      3. Type claim  — raises ValueError if "type" != expected_type
      4. Blacklist   — raises ValueError if jti is blacklisted in Redis

    Args:
        token:         Raw JWT string (without "Bearer " prefix)
        expected_type: "access" or "refresh"

    Returns:
        Decoded payload dict

    Raises:
        ValueError: on any validation failure (type mismatch, expired, blacklisted)
        ImportError: if python-jose is not installed

    Used by:
        app/dependencies.py → get_current_user()
    """
    if not _JOSE:
        raise ImportError("python-jose is required")

    try:
        from jose import JWTError, ExpiredSignatureError
        payload = _jose_jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
        )
    except Exception as exc:
        raise ValueError(f"Invalid token: {exc}") from exc

    # Type discriminator check
    token_type = payload.get("type")
    if token_type != expected_type:
        raise ValueError(
            f"Token type mismatch: expected '{expected_type}', got '{token_type}'"
        )

    # Sub claim
    if not payload.get("sub"):
        raise ValueError("Token missing 'sub' claim")

    # Redis blacklist check (non-blocking — skip if Redis unavailable)
    jti = payload.get("jti")
    if jti and _is_blacklisted_sync(jti):
        raise ValueError(f"Token {jti!r} has been revoked")

    return payload


def verify_token(token: str, expected_type: str = "access") -> Optional[Dict[str, Any]]:
    """
    decode_token wrapper that returns None instead of raising.

    Useful in middleware where you want to degrade gracefully:
        payload = verify_token(token)
        if payload is None:
            return JSONResponse({"error": "Unauthorized"}, 401)
    """
    try:
        return decode_token(token, expected_type)
    except Exception:
        return None


# ═══════════════════════════════════════════════════════════════
# TOKEN BLACKLIST (Redis-backed)
# ═══════════════════════════════════════════════════════════════

# Module-level sync Redis client for blacklist (lightweight, sync)
_redis_sync: Any = None


def _get_redis_sync():
    """Lazily create a sync Redis client for blacklist operations."""
    global _redis_sync
    if _redis_sync is not None:
        return _redis_sync
    try:
        import redis
        _redis_sync = redis.from_url(
            settings.REDIS_URL,
            db=settings.REDIS_CACHE_DB,
            decode_responses=True,
            socket_connect_timeout=2,
            socket_timeout=2,
        )
        _redis_sync.ping()
        return _redis_sync
    except Exception:
        return None


def blacklist_token(jti: str, ttl_seconds: int = 86400) -> None:
    """
    Add a JWT's jti to the Redis blacklist.

    Called by POST /auth/logout.
    TTL defaults to 24 h — longer than any token's natural expiry
    ensures the blacklist entry outlives the token itself.

    Args:
        jti:         JWT "jti" claim (unique token ID)
        ttl_seconds: Blacklist entry TTL in seconds (default 24 h)
    """
    r = _get_redis_sync()
    if r is None:
        logger.debug("Redis unavailable — token %r not blacklisted", jti)
        return
    try:
        r.setex(f"bl:{jti}", ttl_seconds, "1")
        logger.debug("Token %r blacklisted for %d s", jti, ttl_seconds)
    except Exception as exc:
        logger.warning("Failed to blacklist token %r: %s", jti, exc)


def _is_blacklisted_sync(jti: str) -> bool:
    """
    Check if a token's jti is in the Redis blacklist.

    Returns False (not blacklisted) when Redis is unavailable —
    this is a conscious tradeoff: availability > strict revocation.
    """
    r = _get_redis_sync()
    if r is None:
        return False
    try:
        return r.exists(f"bl:{jti}") == 1
    except Exception:
        return False


# ═══════════════════════════════════════════════════════════════
# API KEY GENERATION
# ═══════════════════════════════════════════════════════════════

def generate_api_key(prefix: str = "lmnd") -> str:
    """
    Generate a secure API key for machine-to-machine access.

    Format: lmnd_<32-byte urlsafe base64>
    Entropy: 256 bits

    Example:
        key = generate_api_key()
        # → 'lmnd_4Xj9k2mNpR...'
    """
    return f"{prefix}_{secrets.token_urlsafe(32)}"


def generate_secure_token(n_bytes: int = 32) -> str:
    """
    Generate a cryptographically secure random token.

    Used for email verification and password reset tokens.
    Returns a hex string of 2×n_bytes characters.
    """
    return secrets.token_hex(n_bytes)


# ═══════════════════════════════════════════════════════════════
# INPUT SANITISATION
# ═══════════════════════════════════════════════════════════════

# Characters allowed in API string fields (whitelist approach)
_ALLOWED_CHARS_RE = re.compile(r"[^\w\s\-.,/:@()&%+#!?'\"áéíóúüñÁÉÍÓÚÜÑ]")

# HTML / script injection patterns
_HTML_RE = re.compile(r"<[^>]+>", re.IGNORECASE)
_SCRIPT_RE = re.compile(
    r"javascript\s*:|on\w+\s*=|<script|</script|eval\(|document\.|window\.",
    re.IGNORECASE,
)


def sanitize_str(value: str, max_length: int = 500) -> str:
    """
    Strip HTML tags and JS injection patterns from a user-supplied string.

    Used in Pydantic @field_validator before writing to the DB.
    Does NOT escape for HTML display — that is the frontend's job.

    Args:
        value:      Raw user input
        max_length: Hard truncation limit

    Returns:
        Sanitised string

    Example:
        sanitize_str('<script>alert(1)</script>foo')
        # → 'foo'
    """
    if not value:
        return value
    # Remove HTML tags
    v = _HTML_RE.sub("", value)
    # Remove common XSS patterns
    v = _SCRIPT_RE.sub("", v)
    # Strip leading/trailing whitespace
    v = v.strip()
    # Truncate
    return v[:max_length]


def sanitize_filename(filename: str) -> str:
    """
    Sanitise an uploaded filename.

    Removes path traversal sequences, null bytes, and non-ASCII
    characters that could cause issues on the filesystem.

    Example:
        sanitize_filename("../../etc/passwd.csv")
        # → "etc_passwd.csv"
    """
    import os
    # Remove null bytes
    filename = filename.replace("\x00", "")
    # Normalise path separators and take basename only
    filename = os.path.basename(filename.replace("\\", "/"))
    # Replace path traversal remnants
    filename = filename.replace("..", "_")
    # Keep only safe characters
    safe = re.sub(r"[^\w.\-]", "_", filename)
    return safe[:255] if safe else "upload"


# ═══════════════════════════════════════════════════════════════
# RATE LIMIT KEY HELPER
# ═══════════════════════════════════════════════════════════════

def rate_limit_key(user_id: Optional[str], request_id: str) -> str:
    """
    Build a slowapi rate-limit key.

    Authenticated requests are keyed by user_id ("user:{id}")
    so limits are per-account, not per-IP (avoids NAT issues).
    Anonymous requests fall back to request_id ("anon:{rid}").

    Used by app/dependencies.py → get_rate_limit_key().
    """
    if user_id:
        return f"user:{user_id}"
    return f"anon:{request_id}"
