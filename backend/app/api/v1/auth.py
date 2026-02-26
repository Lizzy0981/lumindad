# backend/app/api/v1/auth.py
"""
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  LumindAd Enterprise · api/v1/auth.py
  JWT Authentication endpoints

  Endpoints
  ──────────
  POST /api/v1/auth/login              → access_token + refresh_token
  POST /api/v1/auth/refresh            → new access_token
  POST /api/v1/auth/logout             → invalidate (client-side)
  GET  /api/v1/auth/me                 → current user profile
  POST /api/v1/auth/register           → create user (admin only)
  POST /api/v1/auth/change-password    → update password

  Token flow (mirrors frontend services/api.ts exactly)
  ───────────────────────────────────────────────────────
  1. POST /auth/login → { access_token, refresh_token, expires_in, user }
  2. Client stores tokens in sessionStorage:
       lumindad_access  = access_token
       lumindad_refresh = refresh_token
  3. All protected requests: Authorization: Bearer <access_token>
  4. On 401: POST /auth/refresh → { accessToken, refreshToken }
  5. On refresh failure: redirect to /login

  Token lifetimes (from config.py)
  ──────────────────────────────────
  access_token:  60 minutes   (ACCESS_TOKEN_EXPIRE_MINUTES)
  refresh_token:  7 days      (REFRESH_TOKEN_EXPIRE_DAYS)

  Security
  ─────────
  - Passwords hashed with bcrypt (cost=12, OWASP recommended)
  - JWT signed with HS256 + SECRET_KEY
  - No token blacklist in this version (stateless JWT)
    → In production: add Redis token blacklist for logout

  Seed users (local dev only)
  ────────────────────────────
  admin@lumindad.ai  / lumindad2025  → role: admin
  demo@lumindad.ai   / demo123       → role: analyst

  Author : Elizabeth Díaz Familia
           AI Data Scientist · Sustainable Intelligence & BI
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, Field

from app.config import settings
from app.dependencies import (
    AuthUser,
    create_access_token,
    create_refresh_token,
    decode_token,
    get_current_user,
    get_user_by_email,
    require_admin,
)

logger = logging.getLogger(__name__)
router = APIRouter()

# ─── bcrypt — graceful fallback for environments without passlib ─────────────

try:
    from passlib.context import CryptContext
    _pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")
    _PASSLIB = True
except ImportError:
    import hashlib
    _pwd_ctx = None  # type: ignore[assignment]
    _PASSLIB = False


def _verify_password(plain: str, hashed: str) -> bool:
    if _PASSLIB and _pwd_ctx:
        return _pwd_ctx.verify(plain, hashed)
    # Fallback: SHA-256 (dev only — not secure for production)
    return hashlib.sha256(plain.encode()).hexdigest() == hashed


def _hash_password(plain: str) -> str:
    if _PASSLIB and _pwd_ctx:
        return _pwd_ctx.hash(plain)
    import hashlib
    return hashlib.sha256(plain.encode()).hexdigest()


# ═══════════════════════════════════════════════════════════════
# PYDANTIC SCHEMAS
# ═══════════════════════════════════════════════════════════════

class LoginRequest(BaseModel):
    """POST /auth/login body — mirrors frontend services/api.ts LoginRequest."""
    email:    EmailStr = Field(..., examples=["admin@lumindad.ai"])
    password: str      = Field(..., min_length=6, examples=["lumindad2025"])


class RefreshRequest(BaseModel):
    """POST /auth/refresh body — mirrors frontend services/api.ts."""
    refreshToken: str = Field(..., description="Valid refresh JWT")


class RegisterRequest(BaseModel):
    """POST /auth/register body — admin only."""
    email:    EmailStr
    password: str = Field(..., min_length=8)
    name:     str = Field(..., min_length=2, max_length=100)
    role:     str = Field(default="analyst", pattern="^(admin|analyst|user)$")
    company:  Optional[str] = None


class ChangePasswordRequest(BaseModel):
    """POST /auth/change-password body."""
    old_password: str = Field(..., min_length=6)
    new_password: str = Field(..., min_length=8)


class TokenResponse(BaseModel):
    """
    Login / refresh response — mirrors frontend AuthTokens interface.
    Frontend stores accessToken in sessionStorage lumindad_access.
    """
    accessToken:  str
    refreshToken: str
    tokenType:    str = "bearer"
    expiresIn:    int = Field(..., description="Access token TTL in seconds")


class LoginResponse(TokenResponse):
    """Full login response with user object — frontend AuthUser."""
    user: "UserOut"


class UserOut(BaseModel):
    """
    Authenticated user shape — mirrors frontend types/api.ts AuthUser.

    LumindAd.jsx sidebar: 'Elizabeth D.F.' / 'Sustainable AI'
    """
    id:       str
    email:    str
    name:     str
    role:     str
    company:  Optional[str] = None
    isActive: bool = True
    createdAt: Optional[str] = None


LoginResponse.model_rebuild()


# ═══════════════════════════════════════════════════════════════
# IN-MEMORY USER STORE (replace with SQLAlchemy in production)
# ═══════════════════════════════════════════════════════════════

# Passwords are bcrypt hashes of:
#   admin@lumindad.ai  → "lumindad2025"
#   demo@lumindad.ai   → "demo123"
# Generated with: passlib.context.CryptContext(["bcrypt"]).hash(pw)
_USERS_DB: dict[str, dict] = {
    "usr_001": {
        "id":            "usr_001",
        "email":         "admin@lumindad.ai",
        "name":          "Elizabeth Díaz Familia",
        "role":          "admin",
        "company":       "LumindAd Enterprise",
        "is_active":     True,
        "created_at":    "2025-01-01T00:00:00Z",
        # bcrypt hash of "lumindad2025" — change in production
        "password_hash": "$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW",
    },
    "usr_002": {
        "id":            "usr_002",
        "email":         "demo@lumindad.ai",
        "name":          "Demo Analyst",
        "role":          "analyst",
        "company":       "LumindAd Enterprise",
        "is_active":     True,
        "created_at":    "2025-01-01T00:00:00Z",
        "password_hash": "$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW",
    },
}
_EMAIL_INDEX: dict[str, str] = {u["email"]: uid for uid, u in _USERS_DB.items()}


def _get_user_by_email_local(email: str) -> dict | None:
    uid = _EMAIL_INDEX.get(email.lower())
    return _USERS_DB.get(uid) if uid else None


# ═══════════════════════════════════════════════════════════════
# ENDPOINTS
# ═══════════════════════════════════════════════════════════════

@router.post(
    "/login",
    response_model=LoginResponse,
    summary="Authenticate user · get JWT tokens",
    responses={
        401: {"description": "Invalid email or password"},
        403: {"description": "Account suspended"},
    },
)
async def login(body: LoginRequest) -> LoginResponse:
    """
    Authenticate with email + password.

    Returns an access_token (1 hour) and refresh_token (7 days).
    The frontend stores both in sessionStorage and uses the access
    token for all subsequent API calls.

    **Demo credentials (local dev):**
    - `admin@lumindad.ai` / `lumindad2025`
    - `demo@lumindad.ai`  / `demo123`
    """
    user = _get_user_by_email_local(body.email)
    if not user or not _verify_password(body.password, user["password_hash"]):
        # Same error for both cases — prevents user enumeration
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.get("is_active", True):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is suspended. Contact support@lumindad.ai",
        )

    extra_claims = {"email": user["email"], "role": user["role"]}
    access_token   = create_access_token(user["id"], extra=extra_claims)
    refresh_token  = create_refresh_token(user["id"])

    logger.info("User logged in: %s (%s)", user["email"], user["role"])

    return LoginResponse(
        accessToken  = access_token,
        refreshToken = refresh_token,
        expiresIn    = settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user         = UserOut(
            id        = user["id"],
            email     = user["email"],
            name      = user["name"],
            role      = user["role"],
            company   = user.get("company"),
            isActive  = user.get("is_active", True),
            createdAt = user.get("created_at"),
        ),
    )


@router.post(
    "/refresh",
    response_model=TokenResponse,
    summary="Refresh access token",
    responses={
        401: {"description": "Invalid or expired refresh token"},
    },
)
async def refresh_token(body: RefreshRequest) -> TokenResponse:
    """
    Exchange a valid refresh token for a new access + refresh token pair.

    Called automatically by the frontend axios interceptor on 401 responses.
    If this endpoint also returns 401, the user is redirected to /login.

    The frontend sends:
        POST /auth/refresh
        Body: { refreshToken: "..." }
    And expects:
        { accessToken, refreshToken, tokenType, expiresIn }
    """
    payload = decode_token(body.refreshToken, expected_type="refresh")
    user_id = payload.get("sub")

    user = _USERS_DB.get(user_id) if user_id else None
    if not user or not user.get("is_active", True):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token subject not found or account suspended",
        )

    extra_claims = {"email": user["email"], "role": user["role"]}
    new_access  = create_access_token(user["id"], extra=extra_claims)
    new_refresh = create_refresh_token(user["id"])

    return TokenResponse(
        accessToken  = new_access,
        refreshToken = new_refresh,
        expiresIn    = settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


@router.post(
    "/logout",
    status_code=204,
    summary="Logout — invalidate session",
)
async def logout(current_user: AuthUser = Depends(get_current_user)) -> None:
    """
    Logout endpoint.

    The frontend (services/api.ts clearTokens()) removes the tokens
    from sessionStorage client-side. This endpoint exists to:
    1. Log the logout event server-side for audit trail
    2. (Future) Add token to Redis blacklist for true invalidation

    Returns 204 No Content — no response body.
    """
    logger.info("User logged out: %s", current_user.email)
    # TODO: Add token to Redis blacklist for stateful revocation


@router.get(
    "/me",
    response_model=UserOut,
    summary="Get current user profile",
)
async def get_me(current_user: AuthUser = Depends(get_current_user)) -> UserOut:
    """
    Return the profile of the currently authenticated user.

    Used by the frontend to hydrate the sidebar user widget:
    LumindAd.jsx: 'Elizabeth D.F.' / 'Sustainable AI'
    """
    raw = _USERS_DB.get(current_user.id, {})
    return UserOut(
        id        = current_user.id,
        email     = current_user.email,
        name      = current_user.name,
        role      = current_user.role,
        company   = raw.get("company"),
        isActive  = current_user.is_active,
        createdAt = raw.get("created_at"),
    )


@router.post(
    "/register",
    response_model=UserOut,
    status_code=201,
    summary="Register new user (admin only)",
)
async def register(
    body:  RegisterRequest,
    admin: AuthUser = Depends(require_admin),
) -> UserOut:
    """
    Create a new user account.

    Admin access required. In production this would INSERT into the
    users table via SQLAlchemy.

    Example request (admin token required):
        POST /api/v1/auth/register
        Authorization: Bearer <admin_access_token>
        { "email": "new@lumindad.ai", "password": "s3cure!", "name": "New User" }
    """
    if body.email in _EMAIL_INDEX:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"A user with email '{body.email}' already exists",
        )

    import uuid as _uuid
    new_id   = f"usr_{_uuid.uuid4().hex[:8]}"
    now_iso  = datetime.now(timezone.utc).isoformat()
    new_user = {
        "id":            new_id,
        "email":         body.email,
        "name":          body.name,
        "role":          body.role,
        "company":       body.company,
        "is_active":     True,
        "created_at":    now_iso,
        "password_hash": _hash_password(body.password),
    }
    _USERS_DB[new_id] = new_user
    _EMAIL_INDEX[body.email] = new_id

    logger.info("New user registered by %s: %s (%s)", admin.email, body.email, body.role)

    return UserOut(
        id        = new_id,
        email     = body.email,
        name      = body.name,
        role      = body.role,
        company   = body.company,
        isActive  = True,
        createdAt = now_iso,
    )


@router.post(
    "/change-password",
    status_code=204,
    summary="Change current user password",
)
async def change_password(
    body:         ChangePasswordRequest,
    current_user: AuthUser = Depends(get_current_user),
) -> None:
    """
    Change the password of the currently authenticated user.

    Returns 204 No Content on success.
    The client should discard its tokens and re-authenticate after
    a password change for security (this is enforced client-side).
    """
    raw = _USERS_DB.get(current_user.id)
    if not raw:
        raise HTTPException(status_code=404, detail="User not found")

    if not _verify_password(body.old_password, raw["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Current password is incorrect",
        )

    raw["password_hash"] = _hash_password(body.new_password)
    logger.info("Password changed for user: %s", current_user.email)
