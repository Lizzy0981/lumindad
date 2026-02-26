# backend/app/models/upload_job.py
"""
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  LumindAd Enterprise · backend/app/models/upload_job.py
  SQLAlchemy 2.0 Upload + Processing Job ORM models (3 tables)

  Tables
  ───────
  upload_sessions          — chunk-upload lifecycle (init → chunks → finalize)
  upload_jobs              — Celery async processing job per session
  ml_pipeline_export_records — Telecom X ML pipeline forward history

  Table: upload_sessions
  ───────────────────────
  Created by POST /upload/init.
  Tracks chunked-upload metadata and assembly state.

  Fields:
    session_id        VARCHAR(32)  "sess_<hex16>" — opaque token returned to client
    user_id           UUID FK
    file_name         VARCHAR(500)
    file_size         BIGINT       bytes, ≤ 2 GB
    mime_type         VARCHAR(100)
    total_chunks      INTEGER      ceil(file_size / 5 MB)
    chunks_received   INTEGER      counter
    total_bytes_received BIGINT
    format            VARCHAR(20)  CSV | XLSX | JSON | PARQUET | AVRO | …
    tmp_path          VARCHAR(512) temp directory on disk
    expires_at        TIMESTAMPTZ  +24h from created_at
    is_finalised      BOOLEAN      True after POST /finalize

  Table: upload_jobs
  ───────────────────
  Created by POST /upload/finalize — one job per upload session.
  Polled by GET /upload/jobs/{id}.

  Fields:
    job_id            VARCHAR(32)  "job_<hex12>"
    session_id        VARCHAR(32)  FK → upload_sessions.session_id
    user_id           UUID FK
    status            ENUM         queued|processing|done|error|cancelled
    progress          NUMERIC(5,2) 0.00–100.00
    rows_processed    BIGINT       running count during processing
    total_rows        BIGINT       final total when done
    error_message     TEXT         set on status=error
    columns_json      TEXT/JSONB   inferred column schema (JSON array)
    preview_json      TEXT/JSONB   first 5 rows (JSON array)
    file_name         VARCHAR(500)
    file_size         BIGINT
    format            VARCHAR(20)
    duration_ms       INTEGER      total processing wall time
    started_at        TIMESTAMPTZ
    finished_at       TIMESTAMPTZ

  Table: ml_pipeline_export_records
  ────────────────────────────────────
  Audit log of every POST /jobs/{id}/export-ml call.
  "📡 Compatible: Telecom X ML Pipeline" (BenchmarkTable footer)

  Fields:
    job_id            VARCHAR(32)  source upload job
    pipeline_id       VARCHAR(32)  "pipe_<hex12>"
    rows_forwarded    BIGINT
    status            ENUM         accepted|queued|error
    endpoint          VARCHAR(512) https://telecomx.pipeline/ingest

  Author : Elizabeth Díaz Familia
           AI Data Scientist · Sustainable Intelligence & BI
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"""

from __future__ import annotations

import enum
import uuid
from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING, Any, Dict, List, Optional

from sqlalchemy import (
    BigInteger, Boolean, DateTime, Enum, ForeignKey,
    Index, Integer, Numeric, String, Text, UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.user import User


# ═══════════════════════════════════════════════════════════════
# ENUMS
# ═══════════════════════════════════════════════════════════════

class JobStatus(str, enum.Enum):
    """
    Processing job lifecycle status.
    Mirrors TypeScript: type JobStatus = 'queued' | 'processing' | 'done' | 'error' | 'cancelled'
    Used by GET /upload/jobs/{id} JobPollResult.status.
    """
    QUEUED     = "queued"
    PROCESSING = "processing"
    DONE       = "done"
    ERROR      = "error"
    CANCELLED  = "cancelled"


class MLExportStatus(str, enum.Enum):
    """
    Telecom X ML pipeline export status.
    Mirrors TypeScript: type MLPipelineExport.status = 'accepted' | 'queued' | 'error'
    """
    ACCEPTED = "accepted"
    QUEUED   = "queued"
    ERROR    = "error"


class UploadFormat(str, enum.Enum):
    """
    Accepted file formats.
    Mirrors config.py ACCEPTED_EXTENSIONS and frontend fileValidation.ts ACCEPTED_FORMATS.
    """
    CSV     = "CSV"
    XLSX    = "XLSX"
    XLS     = "XLS"
    JSON    = "JSON"
    JSONL   = "JSONL"
    PDF     = "PDF"
    XML     = "XML"
    TSV     = "TSV"
    TXT     = "TXT"
    PARQUET = "PARQUET"
    AVRO    = "AVRO"
    UNKNOWN = "UNKNOWN"


# ═══════════════════════════════════════════════════════════════
# UPLOAD SESSION
# ═══════════════════════════════════════════════════════════════

class UploadSession(Base, TimestampMixin):
    """
    Chunk-upload session — created by POST /upload/init.

    Lifecycle:
        1. POST /init       → UploadSession created (is_finalised=False)
        2. POST /chunk (×N) → chunks_received increments on each ack
        3. POST /finalize   → is_finalised=True → UploadJob created

    Session expires after 24 h (config.py UPLOAD_SESSION_TTL_SECONDS).
    Temp file parts stored under tmp_path/{session_id}/chunk_*.bin.

    Mirrors services/uploadService.ts UploadSession interface:
        { sessionId, chunkSize, totalChunks, expiresAt }
    """

    __tablename__ = "upload_sessions"
    __table_args__ = (
        UniqueConstraint("session_id", name="uq_upload_sessions_session_id"),
        Index("idx_upload_sessions_user",       "user_id"),
        Index("idx_upload_sessions_expires_at", "expires_at"),
        Index("idx_upload_sessions_finalised",  "is_finalised"),
    )

    # ── Identity ───────────────────────────────────────────────
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    session_id: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        unique=True,
        index=True,
        comment="Opaque token returned to client: 'sess_<hex16>'",
    )

    # ── Ownership ──────────────────────────────────────────────
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # ── File metadata ──────────────────────────────────────────
    file_name: Mapped[str] = mapped_column(
        String(500),
        nullable=False,
        comment="Original filename including extension",
    )
    file_size: Mapped[int] = mapped_column(
        BigInteger,
        nullable=False,
        comment="Total file size in bytes (≤ 2 GB = 2,147,483,648)",
    )
    mime_type: Mapped[Optional[str]] = mapped_column(
        String(100),
        nullable=True,
        comment="Browser-reported MIME type e.g. 'text/csv'",
    )
    format: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="UNKNOWN",
        comment="Uppercase format from extension: CSV | XLSX | PARQUET | …",
    )

    # ── Chunking state ─────────────────────────────────────────
    chunk_size: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=5 * 1024 * 1024,   # 5 MB — config.py UPLOAD_CHUNK_SIZE
        comment="Chunk size in bytes; returned to client in /init response",
    )
    total_chunks: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        comment="ceil(file_size / chunk_size)",
    )
    chunks_received: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        comment="Incrementing counter of acknowledged chunks",
    )
    total_bytes_received: Mapped[int] = mapped_column(
        BigInteger,
        nullable=False,
        default=0,
    )

    # ── Storage ────────────────────────────────────────────────
    tmp_path: Mapped[Optional[str]] = mapped_column(
        String(512),
        nullable=True,
        comment="Absolute path to temp chunk directory on disk",
    )

    # ── TTL ────────────────────────────────────────────────────
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        comment="Session expiry: created_at + 24 h",
    )

    # ── Status ─────────────────────────────────────────────────
    is_finalised: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        index=True,
        comment="True after POST /finalize — UploadJob created",
    )

    # ── Relationships ──────────────────────────────────────────
    user: Mapped["User"] = relationship("User", lazy="select")
    job:  Mapped[Optional["UploadJob"]] = relationship(
        "UploadJob",
        back_populates="session",
        uselist=False,
        cascade="all, delete-orphan",
        lazy="select",
    )

    def __repr__(self) -> str:
        return (
            f"<UploadSession session_id={self.session_id!r} "
            f"file={self.file_name!r} chunks={self.chunks_received}/{self.total_chunks} "
            f"finalised={self.is_finalised}>"
        )

    @property
    def upload_progress_pct(self) -> float:
        """Chunk upload progress 0–100 (not processing progress)."""
        if not self.total_chunks:
            return 0.0
        return round(self.chunks_received / self.total_chunks * 100, 1)

    @property
    def is_expired(self) -> bool:
        """True if session has passed its expiry time."""
        from datetime import timezone
        return datetime.now(timezone.utc) > self.expires_at

    def to_dict(self) -> dict:
        """Matches services/uploadService.ts UploadSession."""
        return {
            "sessionId":   self.session_id,
            "chunkSize":   self.chunk_size,
            "totalChunks": self.total_chunks,
            "expiresAt":   int(self.expires_at.timestamp() * 1000),
        }


# ═══════════════════════════════════════════════════════════════
# UPLOAD JOB — Celery async processing
# ═══════════════════════════════════════════════════════════════

class UploadJob(Base, TimestampMixin):
    """
    Async processing job — created by POST /upload/finalize.

    Polled by GET /upload/jobs/{id} → JobPollResult.
    Final result retrieved from GET /upload/jobs/{id}/result → UploadResult.

    Celery task reads the assembled file in 50K-row chunks
    (config.py CHUNK_SIZE_ROWS = 50_000), cleans data, inserts to PG,
    and updates this record's progress fields in Redis.

    Mirrors services/uploadService.ts:
        ProcessingJob  { jobId, sessionId, status, queuePos }
        JobPollResult  { jobId, status, progress, rows, totalRows, errorMsg }
        UploadResult   { jobId, totalRows, columns, preview, fileSize, duration, format }

    columns_json and preview_json are stored as TEXT (JSON strings)
    for SQLite compat. In PostgreSQL production migrations,
    these should be cast to JSONB for query performance.
    """

    __tablename__ = "upload_jobs"
    __table_args__ = (
        UniqueConstraint("job_id",     name="uq_upload_jobs_job_id"),
        UniqueConstraint("session_id", name="uq_upload_jobs_session_id"),
        Index("idx_upload_jobs_user",       "user_id"),
        Index("idx_upload_jobs_status",     "status"),
        Index("idx_upload_jobs_started_at", "started_at"),
        Index("idx_upload_jobs_created_at", "created_at"),
    )

    # ── Identity ───────────────────────────────────────────────
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    job_id: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        unique=True,
        index=True,
        comment="Opaque token: 'job_<hex12>'",
    )

    # ── Relations ──────────────────────────────────────────────
    session_id: Mapped[str] = mapped_column(
        String(32),
        ForeignKey("upload_sessions.session_id", ondelete="SET NULL"),
        nullable=True,
        unique=True,
        index=True,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # ── Status ─────────────────────────────────────────────────
    status: Mapped[JobStatus] = mapped_column(
        Enum(JobStatus, name="job_status"),
        nullable=False,
        default=JobStatus.QUEUED,
        index=True,
    )
    progress: Mapped[Decimal] = mapped_column(
        Numeric(5, 2),
        nullable=False,
        default=Decimal("0.00"),
        comment="0.00–100.00 percent complete",
    )

    # ── Progress counters ─────────────────────────────────────
    rows_processed: Mapped[int] = mapped_column(
        BigInteger, nullable=False, default=0,
        comment="Running row count during processing",
    )
    total_rows: Mapped[int] = mapped_column(
        BigInteger, nullable=False, default=0,
        comment="Final total rows when done",
    )

    # ── Error ─────────────────────────────────────────────────
    error_message: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True,
        comment="Error detail when status=error",
    )

    # ── Result payload (stored as JSON string) ─────────────────
    columns_json: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True,
        comment=(
            "JSON array of ColumnSchema objects inferred from file. "
            "e.g. [{name, type, nullable, sample}, …] "
            "Upgrade to JSONB in PostgreSQL migration."
        ),
    )
    preview_json: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True,
        comment=(
            "JSON array of first 5 rows as dicts. "
            "Displayed in BenchmarkTable after processing. "
            "Upgrade to JSONB in PostgreSQL migration."
        ),
    )

    # ── File metadata ─────────────────────────────────────────
    file_name: Mapped[str] = mapped_column(
        String(500), nullable=False,
    )
    file_size: Mapped[int] = mapped_column(
        BigInteger, nullable=False, default=0,
    )
    format: Mapped[str] = mapped_column(
        String(20), nullable=False, default="UNKNOWN",
        comment="CSV | XLSX | JSON | PARQUET | AVRO | …",
    )

    # ── Timing ────────────────────────────────────────────────
    duration_ms: Mapped[Optional[int]] = mapped_column(
        Integer, nullable=True,
        comment="Total processing wall-clock time in milliseconds",
    )
    started_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True,
        comment="Set when Celery worker picks up the job",
    )
    finished_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True,
        comment="Set when status transitions to done | error | cancelled",
    )

    # ── Relationships ──────────────────────────────────────────
    user: Mapped["User"] = relationship(
        "User",
        back_populates="upload_jobs",
        lazy="select",
    )
    session: Mapped[Optional["UploadSession"]] = relationship(
        "UploadSession",
        back_populates="job",
        lazy="select",
    )
    ml_exports: Mapped[List["MLPipelineExportRecord"]] = relationship(
        "MLPipelineExportRecord",
        back_populates="job",
        cascade="all, delete-orphan",
        lazy="select",
    )

    def __repr__(self) -> str:
        return (
            f"<UploadJob job_id={self.job_id!r} "
            f"file={self.file_name!r} status={self.status.value!r} "
            f"progress={self.progress}%>"
        )

    # ── JSON helpers ──────────────────────────────────────────

    def get_columns(self) -> List[Dict[str, Any]]:
        """Deserialise columns_json → list of ColumnSchema dicts."""
        if not self.columns_json:
            return []
        import json
        return json.loads(self.columns_json)

    def set_columns(self, columns: List[Dict[str, Any]]) -> None:
        """Serialise column schema list → columns_json."""
        import json
        self.columns_json = json.dumps(columns, ensure_ascii=False)

    def get_preview(self) -> List[Dict[str, Any]]:
        """Deserialise preview_json → list of row dicts."""
        if not self.preview_json:
            return []
        import json
        return json.loads(self.preview_json)

    def set_preview(self, rows: List[Dict[str, Any]]) -> None:
        """Serialise first-5-rows preview → preview_json."""
        import json
        self.preview_json = json.dumps(rows, ensure_ascii=False, default=str)

    # ── Lifecycle methods ──────────────────────────────────────

    def mark_started(self) -> None:
        """Transition queued → processing."""
        from datetime import timezone
        self.status     = JobStatus.PROCESSING
        self.started_at = datetime.now(timezone.utc)

    def update_progress(self, rows_done: int, total: int) -> None:
        """Update running progress counters."""
        self.rows_processed = rows_done
        self.total_rows     = total
        self.progress       = Decimal(
            str(round(rows_done / total * 100, 2) if total else 0)
        )

    def mark_done(
        self,
        total_rows: int,
        columns:    List[Dict[str, Any]],
        preview:    List[Dict[str, Any]],
        duration_ms: Optional[int] = None,
    ) -> None:
        """Transition processing → done with final payload."""
        from datetime import timezone
        self.status      = JobStatus.DONE
        self.progress    = Decimal("100.00")
        self.total_rows  = total_rows
        self.rows_processed = total_rows
        self.finished_at = datetime.now(timezone.utc)
        self.duration_ms = duration_ms
        self.set_columns(columns)
        self.set_preview(preview)

    def mark_error(self, message: str) -> None:
        """Transition any state → error."""
        from datetime import timezone
        self.status        = JobStatus.ERROR
        self.error_message = message
        self.finished_at   = datetime.now(timezone.utc)

    def mark_cancelled(self) -> None:
        """Transition queued|processing → cancelled."""
        from datetime import timezone
        self.status      = JobStatus.CANCELLED
        self.finished_at = datetime.now(timezone.utc)

    # ── Serialisation ──────────────────────────────────────────

    def to_poll_dict(self) -> dict:
        """Matches services/uploadService.ts JobPollResult."""
        return {
            "jobId":         self.job_id,
            "status":        self.status.value,
            "progress":      float(self.progress),
            "rows":          self.rows_processed,
            "totalRows":     self.total_rows,
            "errorMsg":      self.error_message,
        }

    def to_result_dict(self) -> dict:
        """Matches services/uploadService.ts UploadResult."""
        return {
            "jobId":       self.job_id,
            "totalRows":   self.total_rows,
            "columns":     self.get_columns(),
            "preview":     self.get_preview(),
            "fileSize":    self.file_size,
            "duration":    self.duration_ms or 0,
            "format":      self.format,
            "fileName":    self.file_name,
            "processedAt": self.finished_at.isoformat() if self.finished_at else None,
        }


# ═══════════════════════════════════════════════════════════════
# ML PIPELINE EXPORT RECORD
# ═══════════════════════════════════════════════════════════════

class MLPipelineExportRecord(Base, TimestampMixin):
    """
    Audit log entry for POST /jobs/{id}/export-ml.

    Every time a user forwards a processed dataset to the
    Telecom X ML ingestion pipeline, a record is created here.

    BenchmarkTable footer: "📡 Compatible: Telecom X ML Pipeline"
    Endpoint: https://telecomx.pipeline/ingest

    Mirrors services/uploadService.ts MLPipelineExport:
        { jobId, pipelineId, rowsForwarded, status, endpoint }
    """

    __tablename__ = "ml_pipeline_export_records"
    __table_args__ = (
        Index("idx_ml_exports_job",        "job_id"),
        Index("idx_ml_exports_pipeline",   "pipeline_id"),
        Index("idx_ml_exports_status",     "status"),
        Index("idx_ml_exports_created_at", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    # ── References ────────────────────────────────────────────
    job_id: Mapped[str] = mapped_column(
        String(32),
        ForeignKey("upload_jobs.job_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="Source upload job identifier",
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # ── Pipeline result ────────────────────────────────────────
    pipeline_id: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        comment="Pipeline run identifier: 'pipe_<hex12>'",
    )
    rows_forwarded: Mapped[int] = mapped_column(
        BigInteger,
        nullable=False,
        default=0,
        comment="Number of rows streamed to the Telecom X endpoint",
    )
    status: Mapped[MLExportStatus] = mapped_column(
        Enum(MLExportStatus, name="ml_export_status"),
        nullable=False,
        default=MLExportStatus.ACCEPTED,
    )
    endpoint: Mapped[str] = mapped_column(
        String(512),
        nullable=False,
        default="https://telecomx.pipeline/ingest",
    )
    error_message: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True,
    )

    # ── Relationships ──────────────────────────────────────────
    job: Mapped["UploadJob"] = relationship(
        "UploadJob",
        back_populates="ml_exports",
        lazy="select",
    )
    user: Mapped["User"] = relationship("User", lazy="select")

    def __repr__(self) -> str:
        return (
            f"<MLPipelineExportRecord job={self.job_id!r} "
            f"pipeline={self.pipeline_id!r} rows={self.rows_forwarded} "
            f"status={self.status.value!r}>"
        )

    def to_dict(self) -> dict:
        """Matches services/uploadService.ts MLPipelineExport."""
        return {
            "jobId":         self.job_id,
            "pipelineId":    self.pipeline_id,
            "rowsForwarded": self.rows_forwarded,
            "status":        self.status.value,
            "endpoint":      self.endpoint,
        }
