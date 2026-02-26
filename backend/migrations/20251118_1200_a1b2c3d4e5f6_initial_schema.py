"""Initial schema — all 10 tables

Revision ID: a1b2c3d4e5f6
Revises:     None
Create Date: 2025-11-18 12:00:00.000000

Description
────────────
Creates the complete LumindAd database schema from scratch.

Tables (in dependency order):
  1.  users                        Authentication, roles, API keys
  2.  campaigns                    Ad campaigns (soft-delete enabled)
  3.  campaign_metrics             Daily performance metrics per campaign
  4.  budget_records               Monthly budget records per user
  5.  daily_budget_records         Mon→Sun daily spend entries
  6.  platform_allocations         Budget split across 5 platforms
  7.  ai_budget_recommendations    XGBoost reallocation suggestions
  8.  upload_sessions              Chunked upload session tokens
  9.  upload_jobs                  Async file processing job tracking
  10. ml_pipeline_export_records   Telecom X ML pipeline export log

PostgreSQL enums created:
  user_role · account_status · campaign_status · campaign_platform
  campaign_objective · upload_format · job_status · ml_export_status

Rollback safety
────────────────
downgrade() drops all tables and enum types.
No data loss concern — this is the initial schema only.
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from alembic import op

# revision identifiers
revision:      str                             = "a1b2c3d4e5f6"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on:    Union[str, Sequence[str], None] = None


# ── PostgreSQL ENUM helpers ───────────────────────────────────────────────────

def _pg_enum(name: str, *values: str, **kw):
    """Create a PostgreSQL ENUM type (no-op on SQLite — uses VARCHAR)."""
    return sa.Enum(*values, name=name, **kw)


def _create_enum(name: str, *values: str) -> None:
    """Create a standalone ENUM type in PostgreSQL."""
    enum = postgresql.ENUM(*values, name=name)
    enum.create(op.get_bind(), checkfirst=True)


def _drop_enum(name: str) -> None:
    """Drop a standalone ENUM type in PostgreSQL."""
    enum = postgresql.ENUM(name=name)
    enum.drop(op.get_bind(), checkfirst=True)


# ═══════════════════════════════════════════════════════════════
# UPGRADE
# ═══════════════════════════════════════════════════════════════

def upgrade() -> None:
    """Create all 10 tables and 8 enum types."""

    bind = op.get_bind()
    is_pg = bind.dialect.name == "postgresql"

    # ── ENUM TYPES (PostgreSQL only) ──────────────────────────
    if is_pg:
        _create_enum("user_role",         "admin", "analyst", "viewer", "manager")
        _create_enum("account_status",    "active", "suspended", "pending_verification", "deactivated")
        _create_enum("campaign_status",   "active", "paused", "draft", "completed", "archived")
        _create_enum("campaign_platform", "google_ads", "meta_ads", "tiktok", "linkedin", "twitter_x", "youtube", "pinterest")
        _create_enum("campaign_objective","awareness", "traffic", "engagement", "leads", "sales", "app_installs", "video_views", "store_visits")
        _create_enum("upload_format",     "CSV", "XLSX", "XLS", "JSON", "JSONL", "PDF", "XML", "TSV", "TXT", "PARQUET", "AVRO")
        _create_enum("job_status",        "queued", "processing", "done", "error", "cancelled")
        _create_enum("ml_export_status",  "accepted", "queued", "error")

    # ── 1. users ──────────────────────────────────────────────
    op.create_table(
        "users",
        sa.Column("id",
            postgresql.UUID(as_uuid=True) if is_pg else sa.String(36),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()") if is_pg else sa.text("(lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6))))"),
            nullable=False,
        ),
        # Auth
        sa.Column("email",          sa.String(320),  nullable=False),
        sa.Column("hashed_password",sa.String(255),  nullable=False),
        sa.Column("full_name",      sa.String(200),  nullable=False),
        sa.Column("company",        sa.String(200),  nullable=True),
        sa.Column("avatar_url",     sa.Text,         nullable=True),
        # Role / status
        sa.Column("role",
            _pg_enum("user_role", "admin", "analyst", "viewer", "manager")
            if is_pg else sa.String(20),
            nullable=False,
            server_default="analyst",
        ),
        sa.Column("status",
            _pg_enum("account_status", "active", "suspended", "pending_verification", "deactivated")
            if is_pg else sa.String(30),
            nullable=False,
            server_default="pending_verification",
        ),
        sa.Column("is_active",            sa.Boolean,  nullable=False, server_default=sa.text("true")),
        # Email verification
        sa.Column("is_email_verified",    sa.Boolean,  nullable=False, server_default=sa.text("false")),
        sa.Column("email_verified_at",    sa.DateTime(timezone=True), nullable=True),
        sa.Column("verification_token",   sa.String(128), nullable=True),
        # Login tracking
        sa.Column("last_login_at",        sa.DateTime(timezone=True), nullable=True),
        sa.Column("failed_login_attempts",sa.Integer,  nullable=False, server_default="0"),
        # Password reset
        sa.Column("password_reset_token",     sa.String(128), nullable=True),
        sa.Column("password_reset_expires_at",sa.DateTime(timezone=True), nullable=True),
        # API key
        sa.Column("api_key",     sa.String(100), nullable=True),
        # Preferences (JSON stored as TEXT)
        sa.Column("preferences", sa.Text, nullable=True),
        # Soft-delete
        sa.Column("is_deleted",  sa.Boolean,  nullable=False, server_default=sa.text("false")),
        sa.Column("deleted_at",  sa.DateTime(timezone=True), nullable=True),
        # Timestamps
        sa.Column("created_at",  sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()" if is_pg else "CURRENT_TIMESTAMP")),
        sa.Column("updated_at",  sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()" if is_pg else "CURRENT_TIMESTAMP")),
    )
    op.create_unique_constraint("uq_users_email",   "users", ["email"])
    op.create_unique_constraint("uq_users_api_key", "users", ["api_key"])
    op.create_index("idx_users_email_active",  "users", ["email", "is_active"])
    op.create_index("idx_users_role_active",   "users", ["role", "is_active"])
    op.create_index("idx_users_created_at",    "users", ["created_at"])

    # ── 2. campaigns ─────────────────────────────────────────
    op.create_table(
        "campaigns",
        sa.Column("id",
            postgresql.UUID(as_uuid=True) if is_pg else sa.String(36),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()") if is_pg else sa.text("(lower(hex(randomblob(16))))"),
            nullable=False,
        ),
        sa.Column("user_id",
            postgresql.UUID(as_uuid=True) if is_pg else sa.String(36),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("campaign_ref",  sa.String(20),   nullable=False),   # "C-001" …
        sa.Column("name",          sa.String(255),  nullable=False),
        sa.Column("platform",
            _pg_enum("campaign_platform",
                "google_ads","meta_ads","tiktok","linkedin","twitter_x","youtube","pinterest")
            if is_pg else sa.String(20),
            nullable=False,
        ),
        sa.Column("status",
            _pg_enum("campaign_status", "active","paused","draft","completed","archived")
            if is_pg else sa.String(15),
            nullable=False,
            server_default="draft",
        ),
        sa.Column("objective",
            _pg_enum("campaign_objective",
                "awareness","traffic","engagement","leads","sales","app_installs","video_views","store_visits")
            if is_pg else sa.String(20),
            nullable=True,
        ),
        sa.Column("budget",       sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("spent",        sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("impressions",  sa.BigInteger,     nullable=False, server_default="0"),
        sa.Column("clicks",       sa.BigInteger,     nullable=False, server_default="0"),
        sa.Column("conversions",  sa.Integer,        nullable=False, server_default="0"),
        sa.Column("ctr",          sa.String(10),     nullable=True),   # "7.16%"
        sa.Column("cpc",          sa.Numeric(10, 4), nullable=True),
        sa.Column("roas",         sa.Numeric(8, 3),  nullable=False, server_default="0"),
        sa.Column("start_date",   sa.Date,           nullable=True),
        sa.Column("end_date",     sa.Date,           nullable=True),
        sa.Column("description",  sa.Text,           nullable=True),
        sa.Column("tags",         sa.Text,           nullable=True),   # JSON array as TEXT
        # Soft-delete
        sa.Column("is_deleted",   sa.Boolean,        nullable=False, server_default=sa.text("false")),
        sa.Column("deleted_at",   sa.DateTime(timezone=True), nullable=True),
        # Timestamps
        sa.Column("created_at",   sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()" if is_pg else "CURRENT_TIMESTAMP")),
        sa.Column("updated_at",   sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()" if is_pg else "CURRENT_TIMESTAMP")),
    )
    op.create_unique_constraint("uq_campaigns_user_ref",  "campaigns", ["user_id", "campaign_ref"])
    op.create_index("idx_campaigns_user_status",   "campaigns", ["user_id", "status"])
    op.create_index("idx_campaigns_user_platform", "campaigns", ["user_id", "platform"])
    op.create_index("idx_campaigns_user_deleted",  "campaigns", ["user_id", "is_deleted"])
    op.create_index("idx_campaigns_status_deleted","campaigns", ["status",  "is_deleted"])
    op.create_index("idx_campaigns_created_at",    "campaigns", ["created_at"])

    # ── 3. campaign_metrics ───────────────────────────────────
    op.create_table(
        "campaign_metrics",
        sa.Column("id",
            postgresql.UUID(as_uuid=True) if is_pg else sa.String(36),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()") if is_pg else sa.text("(lower(hex(randomblob(16))))"),
            nullable=False,
        ),
        sa.Column("campaign_id",
            postgresql.UUID(as_uuid=True) if is_pg else sa.String(36),
            sa.ForeignKey("campaigns.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("record_date",  sa.Date,           nullable=False),
        sa.Column("impressions",  sa.BigInteger,     nullable=False, server_default="0"),
        sa.Column("clicks",       sa.BigInteger,     nullable=False, server_default="0"),
        sa.Column("conversions",  sa.Integer,        nullable=False, server_default="0"),
        sa.Column("spend",        sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("ctr",          sa.Numeric(8, 4),  nullable=True),
        sa.Column("cpc",          sa.Numeric(10, 4), nullable=True),
        sa.Column("roas",         sa.Numeric(8, 3),  nullable=True),
        # Timestamps
        sa.Column("created_at",   sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()" if is_pg else "CURRENT_TIMESTAMP")),
        sa.Column("updated_at",   sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()" if is_pg else "CURRENT_TIMESTAMP")),
    )
    op.create_unique_constraint(
        "uq_campaign_metrics_campaign_date", "campaign_metrics",
        ["campaign_id", "record_date"],
    )
    op.create_index("idx_campaign_metrics_campaign_date", "campaign_metrics", ["campaign_id", "record_date"])
    op.create_index("idx_campaign_metrics_date",          "campaign_metrics", ["record_date"])

    # ── 4. budget_records ─────────────────────────────────────
    op.create_table(
        "budget_records",
        sa.Column("id",
            postgresql.UUID(as_uuid=True) if is_pg else sa.String(36),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()") if is_pg else sa.text("(lower(hex(randomblob(16))))"),
            nullable=False,
        ),
        sa.Column("user_id",
            postgresql.UUID(as_uuid=True) if is_pg else sa.String(36),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("period_year",  sa.SmallInteger,   nullable=False),
        sa.Column("period_month", sa.SmallInteger,   nullable=False),
        sa.Column("period_label", sa.String(50),     nullable=True),
        sa.Column("total_budget", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("total_spent",  sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("change_pct",   sa.Numeric(8, 2),  nullable=True),
        # Timestamps
        sa.Column("created_at",   sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()" if is_pg else "CURRENT_TIMESTAMP")),
        sa.Column("updated_at",   sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()" if is_pg else "CURRENT_TIMESTAMP")),
    )
    op.create_unique_constraint(
        "uq_budget_records_user_period", "budget_records",
        ["user_id", "period_year", "period_month"],
    )
    op.create_index("idx_budget_records_user_period", "budget_records", ["user_id", "period_year", "period_month"])
    op.create_index("idx_budget_records_user",        "budget_records", ["user_id"])

    # ── 5. daily_budget_records ───────────────────────────────
    op.create_table(
        "daily_budget_records",
        sa.Column("id",
            postgresql.UUID(as_uuid=True) if is_pg else sa.String(36),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()") if is_pg else sa.text("(lower(hex(randomblob(16))))"),
            nullable=False,
        ),
        sa.Column("budget_record_id",
            postgresql.UUID(as_uuid=True) if is_pg else sa.String(36),
            sa.ForeignKey("budget_records.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("day_label",  sa.String(10),     nullable=False),  # Mon/Tue/…
        sa.Column("day_order",  sa.SmallInteger,   nullable=False),  # 0-6
        sa.Column("budget",     sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("spend",      sa.Numeric(14, 2), nullable=False, server_default="0"),
        # Timestamps
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()" if is_pg else "CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()" if is_pg else "CURRENT_TIMESTAMP")),
    )
    op.create_unique_constraint(
        "uq_daily_budget_records_record_day", "daily_budget_records",
        ["budget_record_id", "day_order"],
    )
    op.create_index("idx_daily_budget_budget_record", "daily_budget_records", ["budget_record_id"])

    # ── 6. platform_allocations ───────────────────────────────
    op.create_table(
        "platform_allocations",
        sa.Column("id",
            postgresql.UUID(as_uuid=True) if is_pg else sa.String(36),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()") if is_pg else sa.text("(lower(hex(randomblob(16))))"),
            nullable=False,
        ),
        sa.Column("budget_record_id",
            postgresql.UUID(as_uuid=True) if is_pg else sa.String(36),
            sa.ForeignKey("budget_records.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("platform_name", sa.String(50),     nullable=False),
        sa.Column("pct",           sa.Numeric(5, 2),  nullable=False),
        sa.Column("color",         sa.String(10),     nullable=False, server_default="#6D28D9"),
        sa.Column("amount_usd",    sa.Numeric(14, 2), nullable=False, server_default="0"),
        # Timestamps
        sa.Column("created_at",    sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()" if is_pg else "CURRENT_TIMESTAMP")),
        sa.Column("updated_at",    sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()" if is_pg else "CURRENT_TIMESTAMP")),
    )
    op.create_unique_constraint(
        "uq_platform_allocations_record_platform", "platform_allocations",
        ["budget_record_id", "platform_name"],
    )
    op.create_index("idx_platform_allocations_budget_record", "platform_allocations", ["budget_record_id"])

    # ── 7. ai_budget_recommendations ──────────────────────────
    op.create_table(
        "ai_budget_recommendations",
        sa.Column("id",
            postgresql.UUID(as_uuid=True) if is_pg else sa.String(36),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()") if is_pg else sa.text("(lower(hex(randomblob(16))))"),
            nullable=False,
        ),
        sa.Column("budget_record_id",
            postgresql.UUID(as_uuid=True) if is_pg else sa.String(36),
            sa.ForeignKey("budget_records.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("from_platform",  sa.String(50),     nullable=False),
        sa.Column("to_platform",    sa.String(50),     nullable=False),
        sa.Column("amount_usd",     sa.Numeric(14, 2), nullable=False),
        sa.Column("roas_gain_pct",  sa.Numeric(8, 2),  nullable=False),
        sa.Column("rationale",      sa.Text,           nullable=True),
        sa.Column("model_version",  sa.String(50),     nullable=False, server_default="xgboost-v2.3.1"),
        sa.Column("applied",        sa.Boolean,        nullable=False, server_default=sa.text("false")),
        sa.Column("applied_at",     sa.DateTime(timezone=True), nullable=True),
        # Timestamps
        sa.Column("created_at",     sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()" if is_pg else "CURRENT_TIMESTAMP")),
        sa.Column("updated_at",     sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()" if is_pg else "CURRENT_TIMESTAMP")),
    )
    op.create_index("idx_ai_recs_budget_record", "ai_budget_recommendations", ["budget_record_id"])
    op.create_index("idx_ai_recs_applied",       "ai_budget_recommendations", ["applied"])
    op.create_index("idx_ai_recs_created_at",    "ai_budget_recommendations", ["created_at"])

    # ── 8. upload_sessions ────────────────────────────────────
    op.create_table(
        "upload_sessions",
        sa.Column("id",
            postgresql.UUID(as_uuid=True) if is_pg else sa.String(36),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()") if is_pg else sa.text("(lower(hex(randomblob(16))))"),
            nullable=False,
        ),
        sa.Column("session_id",  sa.String(64),  nullable=False),   # "sess_<hex16>"
        sa.Column("user_id",
            postgresql.UUID(as_uuid=True) if is_pg else sa.String(36),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("file_name",     sa.String(512),  nullable=False),
        sa.Column("file_size",     sa.BigInteger,   nullable=False),
        sa.Column("mime_type",     sa.String(127),  nullable=True),
        sa.Column("format",
            _pg_enum("upload_format",
                "CSV","XLSX","XLS","JSON","JSONL","PDF","XML","TSV","TXT","PARQUET","AVRO")
            if is_pg else sa.String(10),
            nullable=True,
        ),
        sa.Column("chunk_size",         sa.Integer,   nullable=False, server_default="5242880"),
        sa.Column("total_chunks",       sa.Integer,   nullable=False, server_default="0"),
        sa.Column("chunks_received",    sa.Integer,   nullable=False, server_default="0"),
        sa.Column("total_bytes_received",sa.BigInteger,nullable=False, server_default="0"),
        sa.Column("tmp_path",           sa.Text,      nullable=True),
        sa.Column("expires_at",         sa.DateTime(timezone=True), nullable=False),
        sa.Column("is_finalised",       sa.Boolean,   nullable=False, server_default=sa.text("false")),
        # Timestamps
        sa.Column("created_at",  sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()" if is_pg else "CURRENT_TIMESTAMP")),
        sa.Column("updated_at",  sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()" if is_pg else "CURRENT_TIMESTAMP")),
    )
    op.create_unique_constraint("uq_upload_sessions_session_id", "upload_sessions", ["session_id"])
    op.create_index("idx_upload_sessions_user",       "upload_sessions", ["user_id"])
    op.create_index("idx_upload_sessions_expires_at", "upload_sessions", ["expires_at"])
    op.create_index("idx_upload_sessions_finalised",  "upload_sessions", ["is_finalised"])

    # ── 9. upload_jobs ────────────────────────────────────────
    op.create_table(
        "upload_jobs",
        sa.Column("id",
            postgresql.UUID(as_uuid=True) if is_pg else sa.String(36),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()") if is_pg else sa.text("(lower(hex(randomblob(16))))"),
            nullable=False,
        ),
        sa.Column("job_id",   sa.String(64),  nullable=False),   # "job_<hex12>"
        sa.Column("session_id", sa.String(64),
            sa.ForeignKey("upload_sessions.session_id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("user_id",
            postgresql.UUID(as_uuid=True) if is_pg else sa.String(36),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("status",
            _pg_enum("job_status", "queued","processing","done","error","cancelled")
            if is_pg else sa.String(15),
            nullable=False,
            server_default="queued",
        ),
        sa.Column("file_name",      sa.String(512),  nullable=False),
        sa.Column("file_size",      sa.BigInteger,   nullable=False, server_default="0"),
        sa.Column("format",
            _pg_enum("upload_format",
                "CSV","XLSX","XLS","JSON","JSONL","PDF","XML","TSV","TXT","PARQUET","AVRO")
            if is_pg else sa.String(10),
            nullable=True,
        ),
        sa.Column("total_rows",      sa.BigInteger, nullable=False, server_default="0"),
        sa.Column("rows_processed",  sa.BigInteger, nullable=False, server_default="0"),
        sa.Column("progress_pct",    sa.Numeric(5, 2), nullable=False, server_default="0"),
        sa.Column("error_message",   sa.Text,       nullable=True),
        sa.Column("columns_schema",  sa.Text,       nullable=True),   # JSON
        sa.Column("preview_rows",    sa.Text,       nullable=True),   # JSON
        sa.Column("duration_ms",     sa.Integer,    nullable=True),
        sa.Column("celery_task_id",  sa.String(64), nullable=True),
        sa.Column("started_at",      sa.DateTime(timezone=True), nullable=True),
        sa.Column("finished_at",     sa.DateTime(timezone=True), nullable=True),
        # Timestamps
        sa.Column("created_at",  sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()" if is_pg else "CURRENT_TIMESTAMP")),
        sa.Column("updated_at",  sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()" if is_pg else "CURRENT_TIMESTAMP")),
    )
    op.create_unique_constraint("uq_upload_jobs_job_id",     "upload_jobs", ["job_id"])
    op.create_unique_constraint("uq_upload_jobs_session_id", "upload_jobs", ["session_id"])
    op.create_index("idx_upload_jobs_user",       "upload_jobs", ["user_id"])
    op.create_index("idx_upload_jobs_status",     "upload_jobs", ["status"])
    op.create_index("idx_upload_jobs_started_at", "upload_jobs", ["started_at"])
    op.create_index("idx_upload_jobs_created_at", "upload_jobs", ["created_at"])

    # ── 10. ml_pipeline_export_records ───────────────────────
    op.create_table(
        "ml_pipeline_export_records",
        sa.Column("id",
            postgresql.UUID(as_uuid=True) if is_pg else sa.String(36),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()") if is_pg else sa.text("(lower(hex(randomblob(16))))"),
            nullable=False,
        ),
        sa.Column("job_id",  sa.String(64),
            sa.ForeignKey("upload_jobs.job_id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("user_id",
            postgresql.UUID(as_uuid=True) if is_pg else sa.String(36),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("pipeline_id",    sa.String(64),  nullable=False),
        sa.Column("rows_forwarded", sa.BigInteger,  nullable=False, server_default="0"),
        sa.Column("status",
            _pg_enum("ml_export_status", "accepted","queued","error")
            if is_pg else sa.String(15),
            nullable=False,
            server_default="accepted",
        ),
        sa.Column("endpoint",       sa.Text,        nullable=True),
        sa.Column("error_message",  sa.Text,        nullable=True),
        # Timestamps
        sa.Column("created_at",  sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()" if is_pg else "CURRENT_TIMESTAMP")),
        sa.Column("updated_at",  sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()" if is_pg else "CURRENT_TIMESTAMP")),
    )
    op.create_index("idx_ml_exports_job",        "ml_pipeline_export_records", ["job_id"])
    op.create_index("idx_ml_exports_pipeline",   "ml_pipeline_export_records", ["pipeline_id"])
    op.create_index("idx_ml_exports_status",     "ml_pipeline_export_records", ["status"])
    op.create_index("idx_ml_exports_created_at", "ml_pipeline_export_records", ["created_at"])


# ═══════════════════════════════════════════════════════════════
# DOWNGRADE
# ═══════════════════════════════════════════════════════════════

def downgrade() -> None:
    """Drop all 10 tables and 8 enum types (reverse dependency order)."""

    bind = op.get_bind()
    is_pg = bind.dialect.name == "postgresql"

    # Drop tables (reverse FK order)
    op.drop_table("ml_pipeline_export_records")
    op.drop_table("upload_jobs")
    op.drop_table("upload_sessions")
    op.drop_table("ai_budget_recommendations")
    op.drop_table("platform_allocations")
    op.drop_table("daily_budget_records")
    op.drop_table("budget_records")
    op.drop_table("campaign_metrics")
    op.drop_table("campaigns")
    op.drop_table("users")

    # Drop PostgreSQL ENUM types
    if is_pg:
        for enum_name in (
            "ml_export_status", "job_status", "upload_format",
            "campaign_objective", "campaign_platform", "campaign_status",
            "account_status", "user_role",
        ):
            _drop_enum(enum_name)
