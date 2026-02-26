# backend/app/schemas/upload.py
"""
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  LumindAd Enterprise · backend/app/schemas/upload.py
  Pydantic v2 Upload request + response schemas

  Schema hierarchy
  ─────────────────
  Requests (client → API):
    UploadInitIn        POST /upload/init body
    FinalizeIn          POST /upload/finalize body

  Responses (API → client):
    UploadSessionOut    POST /upload/init → { sessionId, chunkSize, totalChunks, expiresAt }
    ChunkAckOut         POST /upload/chunk → { sessionId, chunkIdx, received, offset }
    ProcessingJobOut    POST /upload/finalize → { jobId, sessionId, status, queuePos }
    JobPollOut          GET /upload/jobs/{id} → { jobId, status, progress, rows, totalRows }
    ColumnSchemaOut     nested in UploadResultOut
    UploadResultOut     GET /upload/jobs/{id}/result → { totalRows, columns, preview, … }
    MLPipelineExportOut POST /upload/jobs/{id}/export-ml → { jobId, pipelineId, … }

  TypeScript interface alignment (services/uploadService.ts)
  ────────────────────────────────────────────────────────────
  UploadInitRequest { fileName, fileSize, mimeType, fileIndex }
  UploadSession     { sessionId, chunkSize, totalChunks, expiresAt }
  ChunkAck          { sessionId, chunkIdx, received, offset }
  ProcessingJob     { jobId, sessionId, status, queuePos? }
  JobPollResult     { jobId, status, progress, rows, totalRows, errorMsg? }
  ColumnSchema      { name, type, nullable, samples }
  UploadResult      { jobId, totalRows, columns, preview, fileSize, duration, format }
  MLPipelineExport  { jobId, pipelineId, rowsForwarded, status, endpoint }

  ORM integration
  ────────────────
  UploadSessionOut  → from UploadSession ORM (from_attributes=True)
  ProcessingJobOut  → from UploadJob.to_poll_dict()
  UploadResultOut   → from UploadJob.to_result_dict()

  Validation constants (mirror config.py)
  ────────────────────────────────────────
  MAX_FILE_SIZE   = 2 GB  = 2,147,483,648 bytes
  CHUNK_SIZE      = 5 MB  = 5,242,880 bytes
  ACCEPTED_EXT    = {.csv, .xlsx, .xls, .json, .pdf, .xml,
                     .tsv, .txt, .parquet, .avro, .jsonl}

  Author : Elizabeth Díaz Familia
           AI Data Scientist · Sustainable Intelligence & BI
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"""

from __future__ import annotations

import math
from pathlib import Path
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


# ── Constants (mirror config.py + fileValidation.ts) ──────────────────────────

_MAX_FILE_SIZE_BYTES: int = 2 * 1024 * 1024 * 1024        # 2 GB
_CHUNK_SIZE_BYTES:    int = 5 * 1024 * 1024                # 5 MB
_MAX_FILES:           int = 10

_ACCEPTED_EXT = frozenset({
    ".csv", ".xlsx", ".xls", ".json", ".jsonl",
    ".pdf", ".xml", ".tsv", ".txt",
    ".parquet", ".avro",
})

# ── Literals ──────────────────────────────────────────────────────────────────

JobStatusLiteral = Literal["queued", "processing", "done", "error", "cancelled"]

ColumnTypeLiteral = Literal["string", "number", "boolean", "date", "null"]

MLExportStatusLiteral = Literal["accepted", "queued", "error"]


# ═══════════════════════════════════════════════════════════════
# REQUEST SCHEMAS
# ═══════════════════════════════════════════════════════════════

class UploadInitIn(BaseModel):
    """
    POST /upload/init request body.

    Mirrors services/uploadService.ts UploadInitRequest:
        { fileName, fileSize, mimeType, fileIndex }

    Validation:
      - Extension must be in the 11-format whitelist
      - File size must be ≤ 2 GB
      - fileSize must be > 0 (empty files rejected)
    """

    fileName:  str = Field(
        ...,
        min_length=1,
        max_length=500,
        description="Original filename including extension e.g. 'customers.csv'",
        examples=["telecom_customers_Q1_2025.csv"],
    )
    fileSize:  int = Field(
        ...,
        gt=0,
        le=_MAX_FILE_SIZE_BYTES,
        description="File size in bytes (must be > 0 and ≤ 2 GB)",
        examples=[15_728_640],  # 15 MB
    )
    mimeType:  str = Field(
        ...,
        max_length=100,
        description="Browser-reported MIME type e.g. 'text/csv'",
        examples=["text/csv"],
    )
    fileIndex: int = Field(
        default=0,
        ge=0,
        lt=_MAX_FILES,
        description=(
            "0-based index when uploading multiple files simultaneously. "
            "Used for progress stagger: 200 + fileIndex × 120 ms "
            "(mirrors LumindAd.jsx line 694)."
        ),
    )

    @field_validator("fileName")
    @classmethod
    def validate_extension(cls, v: str) -> str:
        """Reject files with unsupported extensions."""
        ext = Path(v).suffix.lower()
        if ext not in _ACCEPTED_EXT:
            raise ValueError(
                f"Unsupported file format '{ext}'. "
                f"Accepted: {', '.join(sorted(_ACCEPTED_EXT))}"
            )
        return v

    @field_validator("fileSize")
    @classmethod
    def validate_size(cls, v: int) -> int:
        """Explicit size check with human-readable error message."""
        if v > _MAX_FILE_SIZE_BYTES:
            gb = v / (1024 ** 3)
            raise ValueError(
                f"File size {gb:.2f} GB exceeds the 2 GB limit. "
                "Please split the file or use the Parquet format."
            )
        return v

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "fileName":  "telecom_customers_Q1_2025.csv",
                "fileSize":  15_728_640,
                "mimeType":  "text/csv",
                "fileIndex": 0,
            }
        }
    )


class FinalizeIn(BaseModel):
    """
    POST /upload/finalize request body.

    Signals that all chunks have been uploaded and triggers
    the Celery processing task.
    """

    sessionId: str = Field(
        ...,
        description="Session token from POST /upload/init response",
        min_length=8,
        max_length=64,
        examples=["sess_a3f9b2c4e1d07812"],
    )
    fileName: Optional[str] = Field(
        default=None,
        description="Override filename — optional, falls back to session fileName",
    )

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "sessionId": "sess_a3f9b2c4e1d07812",
                "fileName":  "telecom_customers_Q1_2025.csv",
            }
        }
    )


# ═══════════════════════════════════════════════════════════════
# RESPONSE SCHEMAS
# ═══════════════════════════════════════════════════════════════

class UploadSessionOut(BaseModel):
    """
    POST /upload/init response.

    Mirrors services/uploadService.ts UploadSession:
        { sessionId, chunkSize, totalChunks, expiresAt }

    From ORM: UploadSession.to_dict()
    """

    model_config = ConfigDict(from_attributes=True)

    sessionId:   str = Field(description="Opaque session token: 'sess_<hex16>'")
    chunkSize:   int = Field(
        description=f"Bytes per chunk — always {_CHUNK_SIZE_BYTES:,} (5 MB)",
        examples=[5_242_880],
    )
    totalChunks: int = Field(
        description="ceil(fileSize / chunkSize) — total chunks client must upload",
        ge=1,
    )
    expiresAt:   int = Field(
        description="Unix timestamp in milliseconds when session expires (+24 h)",
    )

    @classmethod
    def from_init(cls, session_id: str, file_size: int, expires_ms: int) -> "UploadSessionOut":
        """Convenience factory — computes totalChunks from file_size."""
        return cls(
            sessionId   = session_id,
            chunkSize   = _CHUNK_SIZE_BYTES,
            totalChunks = math.ceil(file_size / _CHUNK_SIZE_BYTES),
            expiresAt   = expires_ms,
        )


class ChunkAckOut(BaseModel):
    """
    POST /upload/chunk response.

    Mirrors services/uploadService.ts ChunkAck:
        { sessionId, chunkIdx, received, offset }

    received = bytes in this chunk
    offset   = cumulative bytes received so far across all chunks
    """

    model_config = ConfigDict(from_attributes=True)

    sessionId: str = Field(description="Session token — echoed back for correlation")
    chunkIdx:  int = Field(ge=0, description="0-based chunk index just received")
    received:  int = Field(gt=0, description="Bytes received in this chunk")
    offset:    int = Field(ge=0, description="Total bytes received across all chunks so far")


class ProcessingJobOut(BaseModel):
    """
    POST /upload/finalize response.

    Mirrors services/uploadService.ts ProcessingJob:
        { jobId, sessionId, status, queuePos? }

    HTTP 202 Accepted — Celery job has been enqueued.
    """

    model_config = ConfigDict(from_attributes=True)

    jobId:     str              = Field(description="Processing job token: 'job_<hex12>'")
    sessionId: str              = Field(description="Source upload session token")
    status:    JobStatusLiteral = Field(
        default="queued",
        description="Always 'queued' immediately after /finalize",
    )
    queuePos:  Optional[int]   = Field(
        default=None,
        ge=1,
        description="Position in the Celery queue (1 = next to process)",
    )


class JobPollOut(BaseModel):
    """
    GET /upload/jobs/{id} response.

    Mirrors services/uploadService.ts JobPollResult:
        { jobId, status, progress, rows, totalRows, errorMsg? }

    Frontend polls this at interval = 200 + fileIndex × 120 ms
    (mirrors LumindAd.jsx processData stagger, line 694).
    """

    model_config = ConfigDict(from_attributes=True)

    jobId:         str              = Field(description="Job identifier")
    status:        JobStatusLiteral
    progress:      float            = Field(
        ge=0, le=100,
        description="Processing progress 0.00–100.00 percent",
    )
    rows:          int              = Field(
        ge=0,
        alias="rows_processed",
        description="Rows successfully processed so far",
    )
    totalRows:     int              = Field(
        ge=0,
        alias="total_rows",
        description="Estimated total rows in file",
    )
    currentFile:   Optional[str]   = Field(
        default=None,
        description="Filename currently being processed (multi-file sessions)",
    )
    errorMsg:      Optional[str]   = Field(
        default=None,
        alias="error_message",
        description="Error detail when status='error'",
    )
    startedAt:     Optional[str]   = Field(
        default=None,
        description="ISO timestamp when Celery worker started processing",
    )
    updatedAt:     Optional[str]   = Field(
        default=None,
        description="ISO timestamp of the most recent progress update",
    )

    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,   # accept both snake_case aliases and camelCase
    )


class ColumnSchemaOut(BaseModel):
    """
    Inferred column schema entry within UploadResultOut.

    Mirrors services/uploadService.ts ColumnSchema:
        { name, type, nullable, samples }

    type values (match exactly):
        'string' | 'number' | 'boolean' | 'date' | 'null'
    """

    model_config = ConfigDict(from_attributes=True)

    name:     str               = Field(description="Column name from file header")
    type:     ColumnTypeLiteral = Field(
        description="Inferred pandas dtype mapped to TS type: "
                    "object→string, int64/float64→number, bool→boolean, datetime→date",
    )
    nullable: bool              = Field(
        description="True if the column contains any NaN/null values",
    )
    sample:   Optional[str]     = Field(
        default=None,
        description="First non-null value as string for UI preview",
    )
    samples:  Optional[List[Any]] = Field(
        default=None,
        description="Up to 3 sample values — matches uploadService.ts ColumnSchema.samples",
    )

    model_config = ConfigDict(
        from_attributes=True,
        json_schema_extra={
            "example": {
                "name":     "customerID",
                "type":     "string",
                "nullable": False,
                "sample":   "CUST-0001",
                "samples":  ["CUST-0001", "CUST-0002", "CUST-0003"],
            }
        }
    )


class UploadResultOut(BaseModel):
    """
    GET /upload/jobs/{id}/result response — final processing result.

    Mirrors services/uploadService.ts UploadResult:
        { jobId, totalRows, columns, preview, fileSize, duration, format }

    Only available when job.status == 'done'.
    HTTP 409 Conflict if polled while still processing.

    BenchmarkTable in UploadPage renders columns + preview rows.
    """

    model_config = ConfigDict(from_attributes=True)

    jobId:      str                  = Field(description="Source job identifier")
    totalRows:  int                  = Field(ge=0, description="Total rows in processed file")
    columns:    List[ColumnSchemaOut] = Field(
        description="Inferred column schema — Telecom X compatible fields shown first",
    )
    preview:    List[Dict[str, Any]] = Field(
        description="First 5 rows as list of dicts — displayed in BenchmarkTable",
    )
    fileName:   str                  = Field(description="Original filename")
    fileSize:   int                  = Field(ge=0, description="File size in bytes")
    format:     str                  = Field(
        description="Uppercase format string: CSV | XLSX | JSON | PARQUET | AVRO | …",
    )
    duration:   Optional[int]        = Field(
        default=None,
        description="Total processing wall-clock time in milliseconds",
    )
    processedAt: Optional[str]       = Field(
        default=None,
        description="ISO timestamp when processing completed",
    )


class MLPipelineExportOut(BaseModel):
    """
    POST /upload/jobs/{id}/export-ml response.

    Mirrors services/uploadService.ts MLPipelineExport:
        { jobId, pipelineId, rowsForwarded, status, endpoint }

    BenchmarkTable footer: '📡 Compatible: Telecom X ML Pipeline'
    Endpoint: https://telecomx.pipeline/ingest
    """

    model_config = ConfigDict(from_attributes=True)

    jobId:         str                  = Field(description="Source upload job identifier")
    pipelineId:    str                  = Field(
        description="Telecom X pipeline run identifier: 'pipe_<hex12>'",
    )
    rowsForwarded: int                  = Field(
        ge=0,
        description="Number of rows streamed to the Telecom X ML endpoint",
    )
    status:        MLExportStatusLiteral = Field(
        description="accepted | queued | error",
    )
    endpoint:      str                  = Field(
        default="https://telecomx.pipeline/ingest",
        description="Telecom X ML pipeline ingestion endpoint",
    )
