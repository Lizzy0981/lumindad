# backend/app/api/v1/upload.py
"""
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  LumindAd Enterprise · api/v1/upload.py
  Chunked file upload + SSE progress endpoints

  Endpoints (mirrors services/uploadService.ts exactly)
  ───────────────────────────────────────────────────────
  POST /api/v1/upload/init                  → UploadSession
  POST /api/v1/upload/chunk                 → ChunkAck
  POST /api/v1/upload/finalize              → ProcessingJob
  GET  /api/v1/upload/jobs/{job_id}         → JobPollResult
  GET  /api/v1/upload/jobs/{job_id}/result  → UploadResult
  DELETE /api/v1/upload/jobs/{job_id}       → 204
  POST /api/v1/upload/jobs/{job_id}/export-ml → MLPipelineExport
  GET  /api/v1/upload/jobs/{job_id}/stream  → SSE progress stream

  Upload flow (docs section 9)
  ─────────────────────────────
  1. POST /init        — register session, get chunkSize + sessionId
  2. POST /chunk (×N)  — upload binary chunks (5 MB each, gzip optional)
  3. POST /finalize    — trigger Celery worker, get jobId
  4. GET  /jobs/{id}   — poll progress (0–100%) every ~300ms
  5. GET  /jobs/{id}/result — fetch final schema + preview rows

  Chunked strategy mirrors frontend
  ────────────────────────────────
  chunkSize = 5 MB  (UPLOAD_CHUNK_SIZE in config.py)
  chunks    = ceil(fileSize / chunkSize)
  Each POST /chunk body: FormData { sessionId, chunkIdx, chunk:Blob }
  Optional gzip: Content-Encoding: gzip header

  Processing (Celery task, async)
  ────────────────────────────────
  chunkSize_rows = 50_000    (matches frontend CHUNK_ROWS)
  Reads file in 50K-row chunks → clean → INSERT → broadcast SSE progress
  Supports: CSV, XLSX, XLS, JSON, JSONL, PDF, XML, TSV, TXT, Parquet, Avro

  Formats (mirrors frontend fileValidation.ts ACCEPTED_FORMATS)
  ─────────────────────────────────────────────────────────────
  .csv .xlsx .xls .json .pdf .xml .tsv .txt .parquet .avro .jsonl

  Rate limiting
  ─────────────
  10 requests/minute on /init (slowapi)
  No limit on /chunk (already behind a session)

  Author : Elizabeth Díaz Familia
           AI Data Scientist · Sustainable Intelligence & BI
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"""

from __future__ import annotations

import asyncio
import io
import json
import logging
import math
import os
import shutil
import tempfile
import time
import uuid
from pathlib import Path
from typing import AsyncGenerator, List, Literal, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Response, UploadFile, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.config import settings
from app.dependencies import AuthUser, get_current_user

logger = logging.getLogger(__name__)
router = APIRouter()

# ─── Constants (mirror frontend exactly) ─────────────────────────────────────

CHUNK_SIZE_BYTES: int = settings.UPLOAD_CHUNK_SIZE       # 5 MB
MAX_FILE_SIZE:    int = settings.MAX_FILE_SIZE_BYTES      # 2 GB
MAX_FILES:        int = settings.MAX_UPLOAD_FILES         # 10
CHUNK_ROWS:       int = settings.CHUNK_SIZE_ROWS          # 50_000

_ACCEPTED_EXT = set(settings.ACCEPTED_EXTENSIONS)

# ═══════════════════════════════════════════════════════════════
# PYDANTIC SCHEMAS — mirror services/uploadService.ts exactly
# ═══════════════════════════════════════════════════════════════

class UploadInitRequest(BaseModel):
    """POST /upload/init body."""
    fileName:   str   = Field(..., description="Original file name including extension")
    fileSize:   int   = Field(..., gt=0, le=MAX_FILE_SIZE, description="File size in bytes")
    mimeType:   str   = Field(..., description="MIME type from browser File.type")
    totalFiles: int   = Field(default=1, ge=1, le=MAX_FILES)


class UploadSession(BaseModel):
    """
    Upload session descriptor returned by /init.
    Mirrors services/uploadService.ts UploadSession.
    """
    sessionId:   str
    chunkSize:   int  = Field(..., description="Bytes per chunk (5 MB)")
    totalChunks: int  = Field(..., description="ceil(fileSize / chunkSize)")
    expiresAt:   int  = Field(..., description="Unix ms timestamp when session expires")


class ChunkAck(BaseModel):
    """
    Acknowledgement for a single uploaded chunk.
    Mirrors services/uploadService.ts ChunkAck.
    """
    sessionId: str
    chunkIdx:  int
    received:  int   = Field(..., description="Bytes received in this chunk")
    offset:    int   = Field(..., description="Total bytes received so far")


JobStatus = Literal["queued", "processing", "done", "error", "cancelled"]


class ProcessingJob(BaseModel):
    """
    Celery job handle returned by /finalize.
    Mirrors services/uploadService.ts ProcessingJob.
    """
    jobId:     str
    sessionId: str
    status:    JobStatus = "queued"
    queuePos:  Optional[int] = None


class JobPollResult(BaseModel):
    """
    Job poll response — mirrors services/uploadService.ts JobPollResult.
    Frontend polls this every ~300ms during processing.
    """
    jobId:         str
    status:        JobStatus
    progress:      float = Field(..., ge=0, le=100, description="0–100 percent")
    rowsProcessed: int   = Field(default=0)
    totalRows:     int   = Field(default=0)
    currentFile:   Optional[str] = None
    errors:        List[str]     = Field(default_factory=list)
    startedAt:     Optional[str] = None
    updatedAt:     Optional[str] = None


class ColumnSchema(BaseModel):
    """Inferred column schema from parsed file."""
    name:     str
    type:     Literal["string", "number", "boolean", "date", "null"]
    nullable: bool
    sample:   Optional[str] = None


class UploadResult(BaseModel):
    """
    Final result after successful processing.
    Mirrors services/uploadService.ts UploadResult.
    """
    jobId:      str
    totalRows:  int
    columns:    List[ColumnSchema]
    preview:    List[dict]  = Field(default_factory=list, description="First 5 rows")
    fileName:   str
    fileSize:   int
    format:     str
    processedAt: str


class MLPipelineExport(BaseModel):
    """
    Telecom X ML pipeline export result.
    Mirrors services/uploadService.ts MLPipelineExport.
    BenchmarkTable footer: '📡 Compatible: Telecom X ML Pipeline'
    """
    jobId:         str
    pipelineId:    str
    rowsForwarded: int
    status:        Literal["accepted", "queued", "error"] = "accepted"
    endpoint:      str = "https://telecomx.pipeline/ingest"


# ═══════════════════════════════════════════════════════════════
# IN-MEMORY SESSION + JOB REGISTRY
# Production: use Redis (settings.UPLOAD_SESSION_TTL_SECONDS = 24h)
# ═══════════════════════════════════════════════════════════════

_sessions: dict[str, dict] = {}   # sessionId → session state
_jobs:     dict[str, dict] = {}   # jobId     → job state


def _new_session_id() -> str:
    return f"sess_{uuid.uuid4().hex[:16]}"


def _new_job_id() -> str:
    return f"job_{uuid.uuid4().hex[:12]}"


def _now_iso() -> str:
    from datetime import datetime, timezone
    return datetime.now(timezone.utc).isoformat()


def _now_ms() -> int:
    return int(time.time() * 1000)


# ═══════════════════════════════════════════════════════════════
# FILE FORMAT DETECTION
# ═══════════════════════════════════════════════════════════════

def _detect_format(filename: str) -> str:
    """Return uppercase format string from file extension."""
    ext = Path(filename).suffix.lower()
    _MAP = {
        ".csv": "CSV", ".tsv": "TSV", ".txt": "TXT",
        ".xlsx": "XLSX", ".xls": "XLS",
        ".json": "JSON", ".jsonl": "JSONL",
        ".parquet": "PARQUET", ".avro": "AVRO",
        ".xml": "XML", ".pdf": "PDF",
    }
    return _MAP.get(ext, "UNKNOWN")


def _validate_extension(filename: str) -> None:
    ext = Path(filename).suffix.lower()
    if ext not in _ACCEPTED_EXT:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Unsupported file format '{ext}'. "
                f"Accepted: {', '.join(sorted(_ACCEPTED_EXT))}"
            ),
        )


# ═══════════════════════════════════════════════════════════════
# ASYNC PROCESSING SIMULATION
# In production: Celery task reads file from disk/S3,
# processes in 50K-row chunks, updates job state in Redis.
# ═══════════════════════════════════════════════════════════════

async def _simulate_processing(job_id: str, session: dict) -> None:
    """
    Simulate Celery async processing.
    Real implementation: celery task reads chunks → pandas → INSERT.
    """
    job = _jobs.get(job_id)
    if not job:
        return

    # Estimate rows from file size (rough: 100 bytes/row avg)
    file_size  = session.get("fileSize", 1_000_000)
    total_rows = min(settings.MAX_ROWS, max(1000, file_size // 100))
    chunk_size = CHUNK_ROWS

    job["status"]     = "processing"
    job["totalRows"]  = total_rows
    job["startedAt"]  = _now_iso()

    n_chunks = math.ceil(total_rows / chunk_size)
    for i in range(n_chunks):
        await asyncio.sleep(0.1)   # simulate chunk processing time
        rows_done = min((i + 1) * chunk_size, total_rows)
        job["rowsProcessed"] = rows_done
        job["progress"]      = round(rows_done / total_rows * 100, 1)
        job["updatedAt"]     = _now_iso()

    # Build synthetic column schema
    job["status"]   = "done"
    job["progress"] = 100.0
    job["columns"]  = [
        {"name": "customerID",      "type": "string",  "nullable": False, "sample": "CUST-0001"},
        {"name": "tenure",          "type": "number",  "nullable": False, "sample": "24"},
        {"name": "monthlyCharges",  "type": "number",  "nullable": False, "sample": "65.90"},
        {"name": "totalCharges",    "type": "number",  "nullable": True,  "sample": "1581.60"},
        {"name": "contract",        "type": "string",  "nullable": False, "sample": "Month-to-month"},
        {"name": "internetService", "type": "string",  "nullable": False, "sample": "Fiber optic"},
        {"name": "churnLabel",      "type": "string",  "nullable": True,  "sample": "Yes"},
    ]
    job["preview"]    = [
        {"customerID": f"CUST-{i:04d}", "tenure": 24 + i, "monthlyCharges": 65.9 + i * 1.1}
        for i in range(5)
    ]
    job["updatedAt"]  = _now_iso()
    logger.info("Job %s complete: %d rows processed", job_id, total_rows)


# ═══════════════════════════════════════════════════════════════
# ENDPOINTS
# ═══════════════════════════════════════════════════════════════

@router.post(
    "/init",
    response_model=UploadSession,
    status_code=201,
    summary="Initialise chunked upload session",
)
async def init_upload(
    body:         UploadInitRequest,
    current_user: AuthUser = Depends(get_current_user),
) -> UploadSession:
    """
    Register a new upload session.

    Returns a sessionId and the chunk size the client should use.
    The client then POSTs each chunk to /chunk with this sessionId.

    Validates:
    - File extension is in the 10-format whitelist
    - File size ≤ 2 GB
    - Queue size ≤ 10 files
    """
    _validate_extension(body.fileName)

    if body.fileSize > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File size {body.fileSize} bytes exceeds the 2 GB limit",
        )

    session_id   = _new_session_id()
    total_chunks = math.ceil(body.fileSize / CHUNK_SIZE_BYTES)
    expires_at   = _now_ms() + settings.UPLOAD_SESSION_TTL_SECONDS * 1000

    _sessions[session_id] = {
        "sessionId":   session_id,
        "fileName":    body.fileName,
        "fileSize":    body.fileSize,
        "mimeType":    body.mimeType,
        "totalChunks": total_chunks,
        "receivedChunks": set(),
        "totalBytesReceived": 0,
        "expiresAt":   expires_at,
        "userId":      current_user.id,
        "tmpPath":     None,
    }

    logger.info(
        "Upload session %s initialised: %s (%d bytes, %d chunks)",
        session_id, body.fileName, body.fileSize, total_chunks,
    )

    return UploadSession(
        sessionId   = session_id,
        chunkSize   = CHUNK_SIZE_BYTES,
        totalChunks = total_chunks,
        expiresAt   = expires_at,
    )


@router.post(
    "/chunk",
    response_model=ChunkAck,
    summary="Upload a single binary chunk",
)
async def upload_chunk(
    sessionId:    str        = Form(...),
    chunkIdx:     int        = Form(..., ge=0),
    chunk:        UploadFile = File(..., description="Binary chunk data (gzip optional)"),
    content_encoding: Optional[str] = None,
    current_user: AuthUser   = Depends(get_current_user),
) -> ChunkAck:
    """
    Accept a single binary chunk.

    The frontend compresses each chunk with gzip when CompressionStream
    is available (utils/offlineCache.ts gzipCompress).
    If Content-Encoding: gzip is present, decompress before writing.

    Max chunk size: 5 MB (UPLOAD_CHUNK_SIZE in config.py).
    """
    session = _sessions.get(sessionId)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Upload session '{sessionId}' not found or expired",
        )
    if session["userId"] != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Session belongs to another user")

    if _now_ms() > session["expiresAt"]:
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="Upload session has expired. Start a new session with POST /upload/init",
        )

    # Read chunk data
    data = await chunk.read()

    # Decompress gzip if indicated
    if content_encoding and "gzip" in content_encoding.lower():
        import gzip as _gzip
        try:
            data = _gzip.decompress(data)
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to decompress gzip chunk: {exc}",
            )

    # Write chunk to temp directory
    tmp_dir = Path(settings.TEMP_DIR) / sessionId
    tmp_dir.mkdir(parents=True, exist_ok=True)
    chunk_path = tmp_dir / f"chunk_{chunkIdx:06d}.bin"
    chunk_path.write_bytes(data)

    # Update session state
    session["receivedChunks"].add(chunkIdx)
    session["totalBytesReceived"] += len(data)

    offset = session["totalBytesReceived"]
    logger.debug("Chunk %d received for session %s (%d bytes)", chunkIdx, sessionId, len(data))

    return ChunkAck(
        sessionId = sessionId,
        chunkIdx  = chunkIdx,
        received  = len(data),
        offset    = offset,
    )


@router.post(
    "/finalize",
    response_model=ProcessingJob,
    status_code=202,
    summary="Finalise upload and start processing job",
)
async def finalize_upload(
    body:         dict,
    current_user: AuthUser = Depends(get_current_user),
) -> ProcessingJob:
    """
    Signal that all chunks have been received.
    Reassembles the file and enqueues a Celery processing task.

    Returns a jobId for polling via GET /jobs/{jobId}.

    In production: Celery task reads chunks → pandas (50K-row chunks)
    → clean → INSERT PostgreSQL → broadcast SSE progress.
    """
    session_id = body.get("sessionId")
    file_name  = body.get("fileName", "upload.csv")

    session = _sessions.get(session_id)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Upload session '{session_id}' not found",
        )

    job_id = _new_job_id()
    now    = _now_iso()

    _jobs[job_id] = {
        "jobId":         job_id,
        "sessionId":     session_id,
        "status":        "queued",
        "progress":      0.0,
        "rowsProcessed": 0,
        "totalRows":     0,
        "fileName":      file_name,
        "fileSize":      session["fileSize"],
        "format":        _detect_format(file_name),
        "errors":        [],
        "columns":       [],
        "preview":       [],
        "startedAt":     None,
        "updatedAt":     now,
        "userId":        current_user.id,
    }

    # Kick off background processing (asyncio task — replace with Celery)
    asyncio.create_task(_simulate_processing(job_id, session))

    logger.info("Processing job %s queued for session %s (%s)", job_id, session_id, file_name)

    return ProcessingJob(
        jobId     = job_id,
        sessionId = session_id,
        status    = "queued",
        queuePos  = 1,
    )


@router.get(
    "/jobs/{job_id}",
    response_model=JobPollResult,
    summary="Poll job progress",
)
async def poll_job(
    job_id:       str,
    current_user: AuthUser = Depends(get_current_user),
) -> JobPollResult:
    """
    Poll a processing job for current status and progress.

    Frontend polls this at interval = 200 + fileIndex × 120 ms
    (mirrors LumindAd.jsx processData stagger, line 694).

    Returns progress 0–100 and rowsProcessed / totalRows.
    """
    job = _jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Job '{job_id}' not found")
    if job["userId"] != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    return JobPollResult(
        jobId         = job_id,
        status        = job["status"],
        progress      = job["progress"],
        rowsProcessed = job["rowsProcessed"],
        totalRows     = job["totalRows"],
        currentFile   = job.get("fileName"),
        errors        = job.get("errors", []),
        startedAt     = job.get("startedAt"),
        updatedAt     = job.get("updatedAt"),
    )


@router.get(
    "/jobs/{job_id}/result",
    response_model=UploadResult,
    summary="Get final upload result",
)
async def get_job_result(
    job_id:       str,
    current_user: AuthUser = Depends(get_current_user),
) -> UploadResult:
    """
    Retrieve the full result of a completed processing job.

    Returns column schema (inferred types), row count, and a
    5-row preview for display in BenchmarkTable.

    Raises 409 if job is not yet complete.
    """
    job = _jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Job '{job_id}' not found")
    if job["userId"] != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    if job["status"] not in ("done",):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Job '{job_id}' is not complete yet (status: {job['status']})",
        )

    return UploadResult(
        jobId       = job_id,
        totalRows   = job["totalRows"],
        columns     = [ColumnSchema(**c) for c in job["columns"]],
        preview     = job.get("preview", []),
        fileName    = job["fileName"],
        fileSize    = job["fileSize"],
        format      = job["format"],
        processedAt = job.get("updatedAt", _now_iso()),
    )


@router.delete(
    "/jobs/{job_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
    summary="Cancel or delete a job",
)
async def delete_job(
    job_id:       str,
    current_user: AuthUser = Depends(get_current_user),
):
    """
    Cancel a queued/running job or delete a completed one.

    Cleans up temp files and removes job from registry.
    """
    job = _jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Job '{job_id}' not found")
    if job["userId"] != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    # Clean up temp files for the associated session
    session_id = job.get("sessionId")
    if session_id:
        tmp_dir = Path(settings.TEMP_DIR) / session_id
        if tmp_dir.exists():
            shutil.rmtree(tmp_dir, ignore_errors=True)
        _sessions.pop(session_id, None)

    _jobs.pop(job_id, None)
    logger.info("Job %s deleted by user %s", job_id, current_user.id)


@router.post(
    "/jobs/{job_id}/export-ml",
    response_model=MLPipelineExport,
    status_code=202,
    summary="Forward processed data to Telecom X ML pipeline",
)
async def export_to_ml_pipeline(
    job_id:       str,
    current_user: AuthUser = Depends(get_current_user),
) -> MLPipelineExport:
    """
    Forward the processed dataset to the Telecom X ML ingestion pipeline.

    BenchmarkTable footer: '📡 Compatible: Telecom X ML Pipeline'

    The pipeline endpoint is:
        https://telecomx.pipeline/ingest

    In production: streams the processed rows from PostgreSQL to the
    ML pipeline API in batches of 50K rows.
    """
    job = _jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Job '{job_id}' not found")
    if job["userId"] != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    if job["status"] != "done":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Job must be in 'done' state before ML export (current: {job['status']})",
        )

    pipeline_id   = f"pipe_{uuid.uuid4().hex[:12]}"
    rows_forwarded = job.get("totalRows", 0)

    logger.info(
        "ML pipeline export: job %s → %s (%d rows)",
        job_id, pipeline_id, rows_forwarded,
    )

    return MLPipelineExport(
        jobId         = job_id,
        pipelineId    = pipeline_id,
        rowsForwarded = rows_forwarded,
        status        = "accepted",
        endpoint      = "https://telecomx.pipeline/ingest",
    )


# ─── SSE progress stream ──────────────────────────────────────────────────────

async def _sse_generator(job_id: str, user_id: str) -> AsyncGenerator[str, None]:
    """
    Server-Sent Events generator for real-time upload progress.

    Emits progress events until job reaches terminal state.
    Frontend can use EventSource for this endpoint instead of polling.
    """
    last_progress = -1.0
    timeout       = 3600   # 1 hour max stream duration
    elapsed       = 0

    while elapsed < timeout:
        job = _jobs.get(job_id)
        if not job or job.get("userId") != user_id:
            yield "event: error\ndata: {\"message\": \"Job not found\"}\n\n"
            return

        progress = job.get("progress", 0.0)
        status_  = job.get("status", "queued")

        if progress != last_progress:
            payload = json.dumps({
                "jobId":         job_id,
                "status":        status_,
                "progress":      progress,
                "rowsProcessed": job.get("rowsProcessed", 0),
                "totalRows":     job.get("totalRows", 0),
            })
            yield f"event: progress\ndata: {payload}\n\n"
            last_progress = progress

        if status_ in ("done", "error", "cancelled"):
            yield f"event: complete\ndata: {{\"status\": \"{status_}\"}}\n\n"
            return

        await asyncio.sleep(0.3)
        elapsed += 0.3

    yield "event: timeout\ndata: {\"message\": \"Stream timeout\"}\n\n"


@router.get(
    "/jobs/{job_id}/stream",
    summary="SSE real-time progress stream",
    response_class=StreamingResponse,
)
async def stream_job_progress(
    job_id:       str,
    current_user: AuthUser = Depends(get_current_user),
):
    """
    Server-Sent Events (SSE) progress stream for a processing job.

    The frontend can use either this SSE stream or the polling endpoint
    GET /jobs/{job_id}. SSE is preferred for real-time UI updates.

    Content-Type: text/event-stream

    Events emitted:
        event: progress
        data: { jobId, status, progress, rowsProcessed, totalRows }

        event: complete
        data: { status: "done" | "error" | "cancelled" }
    """
    job = _jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Job '{job_id}' not found")
    if job["userId"] != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    return StreamingResponse(
        _sse_generator(job_id, current_user.id),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",   # disable nginx buffering
        },
    )
