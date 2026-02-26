# backend/app/models/user.py
"""
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  LumindAd Enterprise · backend/app/models/user.py
  SQLAlchemy 2.0 User ORM model

  Table: users
  ─────────────
  Primary key : UUID (PostgreSQL UUID type)
  Auth        : email + hashed_password (bcrypt cost=12)
  RBAC        : role enum → admin | analyst | viewer
  Status      : active | inactive | suspended | pending_verification
  Security    : failed_login_attempts + account lockout after 5 failures
  API access  : api_key (urlsafe token, unique)
  Soft delete : inherited from SoftDeleteMixin

  Relationships
  ──────────────
  campaigns   → Campaign[]   (one-to-many, cascade delete)
  upload_jobs → UploadJob[]  (one-to-many, cascade delete)

  RBAC permission matrix
  ───────────────────────
  Capability           admin  analyst  viewer
  ─────────────────────────────────────────────
  create_campaign        ✓       ✓        ✗
  delete_campaign        ✓       ✗        ✗
  upload_dataset         ✓       ✓        ✗
  run_ml_inference       ✓       ✓        ✗
  view_analytics         ✓       ✓        ✓
  export_bi              ✓       ✓        ✓
  manage_users           ✓       ✗        ✗

  LumindAd.jsx sidebar user: 'Elizabeth D.F.' / 'Sustainable AI'
  Seed admin → admin@lumindad.ai / lumindad2025

  Author : Elizabeth Díaz Familia
           AI Data Scientist · Sustainable Intelligence & BI
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"""

from __future__ import annotations

import enum
import secrets
import uuid
from datetime import datetime, timezone
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import (
    Boolean, DateTime, Enum, Index,
    Integer, String, Text, UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models import Base, SoftDeleteMixin, TimestampMixin

if TYPE_CHECKING:
    # Avoid circular imports — used only for type hints
    from app.models.campaign   import Campaign
    from app.models.upload_job import UploadJob


# ═══════════════════════════════════════════════════════════════
# ENUMS — Python + SQLAlchemy column enums
# ═══════════════════════════════════════════════════════════════

class UserRole(str, enum.Enum):
    """
    Role-based access control roles.

    Mirrors app/dependencies.py AuthUser.role field values.
    Used by require_admin() and require_active_user() DI dependencies.
    """
    ADMIN   = "admin"     # full access + user management
    ANALYST = "analyst"   # ML + upload + analytics (no user mgmt)
    VIEWER  = "viewer"    # read-only access to analytics + BI export


class AccountStatus(str, enum.Enum):
    """
    Account lifecycle states.

    PENDING_VERIFICATION → email sent, user hasn't confirmed yet
    ACTIVE              → normal operational state
    INACTIVE            → deactivated by admin (can be re-activated)
    SUSPENDED           → locked after failed_login_attempts >= 5
    """
    PENDING_VERIFICATION = "pending_verification"
    ACTIVE               = "active"
    INACTIVE             = "inactive"
    SUSPENDED            = "suspended"


# ═══════════════════════════════════════════════════════════════
# MODEL
# ═══════════════════════════════════════════════════════════════

class User(Base, TimestampMixin, SoftDeleteMixin):
    """
    User account — authentication, authorization, and profile.

    SQLAlchemy 2.0 mapped class using Mapped[] type annotations
    and mapped_column() for full type-checker support.

    Example:
        user = User.create(
            email="elizabeth@lumindad.ai",
            full_name="Elizabeth Díaz Familia",
            password="lumindad2025",
            role=UserRole.ADMIN,
        )
        db.add(user)
        await db.commit()
    """

    __tablename__ = "users"
    __table_args__ = (
        UniqueConstraint("email",   name="uq_users_email"),
        UniqueConstraint("api_key", name="uq_users_api_key"),
        # Composite index for active user lookups by role
        Index("idx_users_role_active", "role", "is_active"),
        # Index for email + active — used in login DI
        Index("idx_users_email_active", "email", "is_active"),
        Index("idx_users_created_at",   "created_at"),
    )

    # ── Identity ───────────────────────────────────────────────
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        comment="UUID primary key — no sequential IDs exposed in API",
    )

    # ── Authentication ─────────────────────────────────────────
    email: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        index=True,
        comment="Unique login email",
    )
    hashed_password: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        comment="bcrypt hash (cost=12) — never store plain text",
    )

    # ── Profile ────────────────────────────────────────────────
    full_name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        comment="Display name — LumindAd.jsx sidebar: 'Elizabeth D.F.'",
    )
    company: Mapped[Optional[str]] = mapped_column(
        String(200),
        nullable=True,
        comment="Organisation name e.g. 'LumindAd Enterprise'",
    )
    avatar_url: Mapped[Optional[str]] = mapped_column(
        String(512),
        nullable=True,
    )

    # ── Authorization ──────────────────────────────────────────
    role: Mapped[UserRole] = mapped_column(
        Enum(UserRole, name="user_role"),
        nullable=False,
        default=UserRole.VIEWER,
        index=True,
        comment="RBAC role: admin | analyst | viewer",
    )

    # ── Account status ─────────────────────────────────────────
    status: Mapped[AccountStatus] = mapped_column(
        Enum(AccountStatus, name="account_status"),
        nullable=False,
        default=AccountStatus.PENDING_VERIFICATION,
        index=True,
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        index=True,
        comment="Quick active check — separate from status enum",
    )

    # ── Email verification ─────────────────────────────────────
    is_email_verified: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False,
    )
    email_verified_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True,
    )
    verification_token: Mapped[Optional[str]] = mapped_column(
        String(255), nullable=True,
    )

    # ── Security ───────────────────────────────────────────────
    last_login_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True,
    )
    failed_login_attempts: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0,
        comment="Reset to 0 on successful login; suspends at >= 5",
    )
    password_reset_token: Mapped[Optional[str]] = mapped_column(
        String(255), nullable=True,
    )
    password_reset_expires_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True,
    )

    # ── API access ─────────────────────────────────────────────
    api_key: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
        unique=True,
        index=True,
        comment="Optional token for machine-to-machine access",
    )

    # ── Preferences ────────────────────────────────────────────
    # Stored as JSON string for SQLite compat (use JSONB in PG migration)
    preferences: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        comment="JSON blob: { theme, language, notifications, ... }",
    )

    # ── Relationships ──────────────────────────────────────────
    campaigns: Mapped[List["Campaign"]] = relationship(
        "Campaign",
        back_populates="user",
        cascade="all, delete-orphan",
        lazy="select",
    )
    upload_jobs: Mapped[List["UploadJob"]] = relationship(
        "UploadJob",
        back_populates="user",
        cascade="all, delete-orphan",
        lazy="select",
    )

    def __repr__(self) -> str:
        return f"<User id={self.id!s:.8} email={self.email!r} role={self.role.value!r}>"

    # ── Authentication methods ─────────────────────────────────

    def set_password(self, plain: str) -> None:
        """
        Hash and store password using bcrypt (cost=12).
        Never store plain text — always call this method.
        """
        try:
            from passlib.context import CryptContext
            ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")
            self.hashed_password = ctx.hash(plain)
        except ImportError:
            # Fallback for envs without passlib (dev only — not secure)
            import hashlib
            self.hashed_password = hashlib.sha256(plain.encode()).hexdigest()

    def verify_password(self, plain: str) -> bool:
        """
        Verify a plain password against the stored bcrypt hash.

        Returns False (not raises) when passlib is unavailable.
        """
        try:
            from passlib.context import CryptContext
            ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")
            return ctx.verify(plain, self.hashed_password)
        except ImportError:
            import hashlib
            return hashlib.sha256(plain.encode()).hexdigest() == self.hashed_password

    def generate_api_key(self) -> str:
        """Generate a new 32-byte urlsafe API key and store it."""
        self.api_key = secrets.token_urlsafe(32)
        return self.api_key

    def generate_verification_token(self) -> str:
        """Generate and store an email verification token."""
        self.verification_token = secrets.token_urlsafe(32)
        return self.verification_token

    def generate_password_reset_token(self, ttl_minutes: int = 60) -> str:
        """Generate and store a password reset token (expires in ttl_minutes)."""
        from datetime import timedelta
        self.password_reset_token = secrets.token_urlsafe(32)
        self.password_reset_expires_at = (
            datetime.now(timezone.utc) + timedelta(minutes=ttl_minutes)
        )
        return self.password_reset_token

    # ── Account lifecycle ──────────────────────────────────────

    def verify_email(self) -> None:
        """Mark email as verified and activate the account."""
        self.is_email_verified = True
        self.email_verified_at = datetime.now(timezone.utc)
        self.verification_token = None
        self.status = AccountStatus.ACTIVE
        self.is_active = True

    def record_login(self) -> None:
        """Record a successful login — reset failure counter."""
        self.last_login_at = datetime.now(timezone.utc)
        self.failed_login_attempts = 0

    def record_failed_login(self) -> None:
        """
        Increment failure counter.
        Suspends account automatically after 5 consecutive failures.
        """
        self.failed_login_attempts += 1
        if self.failed_login_attempts >= 5:
            self.suspend()

    def activate(self) -> None:
        self.is_active = True
        self.status = AccountStatus.ACTIVE

    def deactivate(self) -> None:
        self.is_active = False
        self.status = AccountStatus.INACTIVE

    def suspend(self) -> None:
        self.is_active = False
        self.status = AccountStatus.SUSPENDED

    # ── RBAC permission helpers ────────────────────────────────

    def is_admin(self) -> bool:
        return self.role == UserRole.ADMIN

    def is_analyst(self) -> bool:
        return self.role == UserRole.ANALYST

    def can_create_campaigns(self) -> bool:
        return self.role in (UserRole.ADMIN, UserRole.ANALYST)

    def can_delete_campaigns(self) -> bool:
        return self.role == UserRole.ADMIN

    def can_upload(self) -> bool:
        return self.role in (UserRole.ADMIN, UserRole.ANALYST)

    def can_run_ml(self) -> bool:
        return self.role in (UserRole.ADMIN, UserRole.ANALYST)

    def can_manage_users(self) -> bool:
        return self.role == UserRole.ADMIN

    def can_export_bi(self) -> bool:
        return self.role in (UserRole.ADMIN, UserRole.ANALYST, UserRole.VIEWER)

    # ── Serialisation ──────────────────────────────────────────

    def to_dict(self, include_sensitive: bool = False) -> dict:
        """
        Serialize to dict for API responses.
        Never includes hashed_password.
        include_sensitive=True adds api_key and failed_login_attempts.
        """
        data: dict = {
            "id":               str(self.id),
            "email":            self.email,
            "full_name":        self.full_name,
            "company":          self.company,
            "role":             self.role.value,
            "status":           self.status.value,
            "is_active":        self.is_active,
            "is_email_verified": self.is_email_verified,
            "created_at":       self.created_at.isoformat() if self.created_at else None,
            "last_login_at":    self.last_login_at.isoformat() if self.last_login_at else None,
        }
        if include_sensitive:
            data["api_key"]               = self.api_key
            data["failed_login_attempts"] = self.failed_login_attempts
        return data

    # ── Factory classmethod ────────────────────────────────────

    @classmethod
    def create(
        cls,
        email:     str,
        full_name: str,
        password:  str,
        role:      UserRole = UserRole.VIEWER,
        company:   Optional[str] = None,
    ) -> "User":
        """
        Convenience factory — creates a User, hashes the password,
        generates a verification token, and returns the unsaved instance.

        Example:
            user = User.create(
                email="elizabeth@lumindad.ai",
                full_name="Elizabeth Díaz Familia",
                password="lumindad2025",
                role=UserRole.ADMIN,
                company="LumindAd Enterprise",
            )
            db.add(user)
            await db.commit()
        """
        user = cls(
            email     = email,
            full_name = full_name,
            company   = company,
            role      = role,
            hashed_password = "",   # will be set below
        )
        user.set_password(password)
        user.generate_verification_token()
        return user
