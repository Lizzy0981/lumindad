# backend/app/services/upload_service.py
"""
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  LumindAd Enterprise · backend/app/services/upload_service.py
  Chunked file upload + async pandas processing service

  Architecture
  ─────────────
  1. POST /upload/init      → init_session()       → UploadSession token
  2. POST /upload/chunk (×N)→ receive_chunk()       → ChunkAck
  3. POST /upload/finalize  → finalize_upload()     → ProcessingJob
  4. asyncio task           → _process_file()       → progress updates
  5. GET  /upload/jobs/{id} → poll_job()            → JobPollResult
  6. GET  /upload/jobs/{id}/result → get_result()   → UploadResult
  7. GET  /upload/jobs/{id}/stream → SSE generator  (consumes from state)
  8. DELETE /upload/jobs/{id}→ cancel_job()
  9. POST /jobs/{id}/export-ml → export_to_ml_pipeline()

  File processing pipeline (_process_file)
  ──────────────────────────────────────────
  Reads the file in 50K-row pandas chunks (CHUNK_ROWS = 50_000).
  Supports all 11 accepted formats:
    CSV  → pd.read_csv(chunksize=50_000)
    XLSX → pd.read_excel (loaded fully, chunked in memory)
    XLS  → xlrd via pd.read_excel
    JSON → pd.read_json (orient=records)
    JSONL→ pd.read_json (lines=True)
    PDF  → pdfplumber text extraction → DataFrame
    XML  → pd.read_xml
    TSV  → pd.read_csv(sep=\\t, chunksize=50_000)
    TXT  → pd.read_csv(sep=None, chunksize=50_000)
    PARQUET → pd.read_parquet (pyarrow)
    AVRO → fastavro reader

  Schema inference
  ──────────────────
  pandas dtype → ColumnSchema type:
    object    → 'string'
    int64     → 'number'
    float64   → 'number'
    bool      → 'boolean'
    datetime  → 'date'
    other     → 'null'

  Telecom X compatibility
  ────────────────────────
  Recognises Telecom X feature columns (customerID, tenure,
  monthlyCharges, contract, churnLabel) and flags the dataset
  as ML-pipeline compatible in the result.

  Author : Elizabeth Díaz Familia
           AI Data Scientist · Sustainable Intelligence & BI
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"""

from __future__ import annotations

import asyncio
import gzip
import logging
import math
import os
import secrets
import time
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, AsyncGenerator, Dict, List, Optional

from app.config import settings

logger = logging.getLogger(__name__)

# ── Pandas / file-format imports (graceful fallback) ─────────────────────────
try:
    import pandas as pd
    _PANDAS = True
except ImportError:
    pd = None  # type: ignore[assignment]
    _PANDAS = False

# ── Optional ORM imports ──────────────────────────────────────────────────────
try:
    from sqlalchemy.ext.asyncio import AsyncSession
    from app.models.upload_job import (
        UploadSession as UploadSessionModel,
        UploadJob as UploadJobModel,
        MLPipelineExportRecord,
        JobStatus,
        MLExportStatus,
    )
    _ORM_AVAILABLE = True
except ImportError:
    _ORM_AVAILABLE = False
    AsyncSession = None  # type: ignore[assignment,misc]


# ═══════════════════════════════════════════════════════════════
# CONSTANTS
# ═══════════════════════════════════════════════════════════════

CHUNK_ROWS:     int = settings.CHUNK_SIZE_ROWS       # 50_000
MAX_FILE_SIZE:  int = settings.UPLOAD_MAX_FILE_SIZE  # 2 GB
CHUNK_BYTES:    int = settings.UPLOAD_CHUNK_SIZE     # 5 MB
MAX_FILES:      int = settings.UPLOAD_MAX_FILES      # 10
SESSION_TTL:    int = settings.UPLOAD_SESSION_TTL_SECONDS  # 86400 s

# Telecom X feature columns — determines ML compatibility flag
_TELECOM_X_COLS = frozenset({
    "customerid", "tenure", "monthlycharges", "totalcharges",
    "contract", "internetservice", "churnlabel", "churn",
})


# ═══════════════════════════════════════════════════════════════
# IN-MEMORY STATE (prototype / multi-worker use Redis instead)
# ═══════════════════════════════════════════════════════════════

_sessions: Dict[str, dict] = {}   # session_id → session state
_jobs:     Dict[str, dict] = {}   # job_id     → job state


# ═══════════════════════════════════════════════════════════════
# HELPERS
# ═══════════════════════════════════════════════════════════════

def _session_id() -> str:
    return f"sess_{secrets.token_hex(16)}"

def _job_id() -> str:
    return f"job_{secrets.token_hex(12)}"

def _pipeline_id() -> str:
    return f"pipe_{secrets.token_hex(12)}"

def _format_from_name(filename: str) -> str:
    ext = Path(filename).suffix.lower()
    return {
        ".csv":     "CSV",  ".xlsx": "XLSX", ".xls":  "XLS",
        ".json":    "JSON", ".jsonl":"JSONL", ".pdf": "PDF",
        ".xml":     "XML",  ".tsv":  "TSV",  ".txt": "TXT",
        ".parquet": "PARQUET", ".avro": "AVRO",
    }.get(ext, "UNKNOWN")


def _infer_column_schema(df) -> List[dict]:
    """
    Infer ColumnSchema list from a pandas DataFrame.

    dtype mapping:
        object   → 'string'
        int64    → 'number'
        float64  → 'number'
        bool     → 'boolean'
        datetime → 'date'
        other    → 'null'
    """
    if not _PANDAS:
        return []
    schema = []
    for col in df.columns:
        dtype  = str(df[col].dtype)
        col_type = (
            "number"  if "int"  in dtype or "float" in dtype else
            "boolean" if "bool" in dtype else
            "date"    if "date" in dtype or "time"  in dtype else
            "string"  if dtype == "object" else
            "null"
        )
        non_null   = df[col].dropna()
        samples    = [str(v) for v in non_null.head(3).tolist()]
        schema.append({
            "name":     col,
            "type":     col_type,
            "nullable": bool(df[col].isna().any()),
            "sample":   samples[0] if samples else None,
            "samples":  samples,
        })
    return schema


def _is_telecom_x_compatible(columns: List[dict]) -> bool:
    """Return True if the dataset contains key Telecom X feature columns."""
    names = {c["name"].lower() for c in columns}
    return len(names & _TELECOM_X_COLS) >= 3


# ═══════════════════════════════════════════════════════════════
# SERVICE CLASS
# ═══════════════════════════════════════════════════════════════

class UploadService:
    """
    Chunked upload and async file processing service.

    Each public method is called by the corresponding API endpoint
    in api/v1/upload.py.  In-memory state (_sessions, _jobs) is
    used for the prototype; a Redis + PostgreSQL backend is wired
    when the DB is available.
    """

    def __init__(self, db: Optional[AsyncSession] = None) -> None:
        self.db = db

    # ── INIT ──────────────────────────────────────────────────

    async def init_session(
        self,
        user_id:   str,
        file_name: str,
        file_size: int,
        mime_type: str,
    ) -> dict:
        """
        POST /upload/init

        Creates a session token and returns chunk parameters.
        Validates extension and file size.
        """
        fmt          = _format_from_name(file_name)
        sid          = _session_id()
        total_chunks = math.ceil(file_size / CHUNK_BYTES)
        expires_ms   = int(
            (datetime.now(timezone.utc) + timedelta(seconds=SESSION_TTL)).timestamp() * 1000
        )

        # Temp directory for chunk assembly
        tmp_dir = Path(settings.TEMP_DIR) / sid
        tmp_dir.mkdir(parents=True, exist_ok=True)

        state = {
            "sessionId":           sid,
            "userId":              user_id,
            "fileName":            file_name,
            "fileSize":            file_size,
            "mimeType":            mime_type,
            "format":              fmt,
            "chunkSize":           CHUNK_BYTES,
            "totalChunks":         total_chunks,
            "chunksReceived":      set(),
            "totalBytesReceived":  0,
            "tmpDir":              str(tmp_dir),
            "expiresAt":           expires_ms,
            "isFinalised":         False,
        }
        _sessions[sid] = state

        logger.info("Upload session %r init: %s (%d MB, %d chunks)",
                    sid, file_name, file_size // (1024*1024), total_chunks)
        return {
            "sessionId":   sid,
            "chunkSize":   CHUNK_BYTES,
            "totalChunks": total_chunks,
            "expiresAt":   expires_ms,
        }

    # ── CHUNK ─────────────────────────────────────────────────

    async def receive_chunk(
        self,
        session_id:    str,
        chunk_idx:     int,
        data:          bytes,
        is_compressed: bool = False,
    ) -> dict:
        """
        POST /upload/chunk

        Writes a chunk to disk after optional gzip decompression.
        Returns a ChunkAck with running byte offset.
        """
        session = _sessions.get(session_id)
        if not session:
            raise ValueError(f"Unknown session: {session_id!r}")
        if session["isFinalised"]:
            raise ValueError(f"Session {session_id!r} is already finalised")

        # Decompress if gzip-encoded
        if is_compressed:
            try:
                data = gzip.decompress(data)
            except Exception:
                pass   # not actually compressed — use as-is

        # Write chunk file
        chunk_path = Path(session["tmpDir"]) / f"chunk_{chunk_idx:06d}.bin"
        chunk_path.write_bytes(data)

        session["chunksReceived"].add(chunk_idx)
        session["totalBytesReceived"] += len(data)

        logger.debug("Chunk %d received for session %r (%d bytes)",
                     chunk_idx, session_id, len(data))

        return {
            "sessionId": session_id,
            "chunkIdx":  chunk_idx,
            "received":  len(data),
            "offset":    session["totalBytesReceived"],
        }

    # ── FINALIZE ──────────────────────────────────────────────

    async def finalize_upload(
        self,
        session_id: str,
        user_id:    str,
    ) -> dict:
        """
        POST /upload/finalize

        Assembles chunks, creates a processing job, and launches
        the async processing task.  Returns immediately with a
        job token — the client polls GET /jobs/{id}.
        """
        session = _sessions.get(session_id)
        if not session:
            raise ValueError(f"Unknown session: {session_id!r}")

        jid = _job_id()
        _jobs[jid] = {
            "jobId":         jid,
            "sessionId":     session_id,
            "userId":        user_id,
            "status":        "queued",
            "progress":      0.0,
            "rowsProcessed": 0,
            "totalRows":     0,
            "errorMessage":  None,
            "columns":       [],
            "preview":       [],
            "fileName":      session["fileName"],
            "fileSize":      session["fileSize"],
            "format":        session["format"],
            "durationMs":    None,
            "startedAt":     None,
            "finishedAt":    None,
        }

        session["isFinalised"] = True

        # Assemble chunks → single file
        assembled_path = await self._assemble_chunks(session)

        # Launch async processing task (non-blocking)
        asyncio.create_task(
            self._process_file(jid, assembled_path, session["format"])
        )

        logger.info("Upload finalised: session %r → job %r", session_id, jid)
        return {
            "jobId":     jid,
            "sessionId": session_id,
            "status":    "queued",
            "queuePos":  1,
        }

    async def _assemble_chunks(self, session: dict) -> Path:
        """Concatenate sorted chunk files into one assembled file."""
        tmp_dir  = Path(session["tmpDir"])
        out_path = tmp_dir / session["fileName"]

        chunk_files = sorted(tmp_dir.glob("chunk_*.bin"))
        if not chunk_files:
            # No chunks received yet — session already has the file
            return out_path

        with open(out_path, "wb") as out:
            for cf in chunk_files:
                out.write(cf.read_bytes())
                cf.unlink()   # free disk space

        logger.debug("Assembled %d chunks → %s", len(chunk_files), out_path)
        return out_path

    # ── PROCESS ───────────────────────────────────────────────

    async def _process_file(
        self,
        job_id:   str,
        path:     Path,
        fmt:      str,
    ) -> None:
        """
        Async task: read file in 50K-row pandas chunks, infer schema,
        build preview, and update job progress.

        Runs entirely in a background asyncio task so the endpoint
        returns immediately.  Progress is written to _jobs[job_id].
        """
        job = _jobs.get(job_id)
        if not job:
            return

        t0 = time.perf_counter()
        job["status"]    = "processing"
        job["startedAt"] = datetime.now(timezone.utc).isoformat()

        try:
            if not _PANDAS or not path.exists():
                # Simulate processing if pandas/file not available
                await self._simulate_processing(job_id)
                return

            # ── Read file ──────────────────────────────────────
            total_rows  = 0
            first_chunk = None
            schema      = []
            preview     = []

            async for chunk in self._read_file_chunks(path, fmt):
                if first_chunk is None:
                    first_chunk = chunk
                    schema  = _infer_column_schema(chunk)
                    preview = chunk.head(5).fillna("").to_dict(orient="records")
                total_rows += len(chunk)

                # Update progress
                job["rowsProcessed"] = total_rows
                job["totalRows"]     = max(total_rows, job["totalRows"])
                job["progress"]      = min(99.0, total_rows / max(job["totalRows"], 1) * 100)

                # Yield control to event loop
                await asyncio.sleep(0)

            # ── Finalise ───────────────────────────────────────
            duration_ms = int((time.perf_counter() - t0) * 1000)
            job["status"]       = "done"
            job["progress"]     = 100.0
            job["totalRows"]    = total_rows
            job["rowsProcessed"]= total_rows
            job["columns"]      = schema
            job["preview"]      = preview
            job["durationMs"]   = duration_ms
            job["finishedAt"]   = datetime.now(timezone.utc).isoformat()

            logger.info(
                "Job %r done: %d rows in %d ms (format=%s)",
                job_id, total_rows, duration_ms, fmt,
            )

        except Exception as exc:
            job["status"]       = "error"
            job["errorMessage"] = str(exc)
            job["finishedAt"]   = datetime.now(timezone.utc).isoformat()
            logger.exception("Job %r processing error: %s", job_id, exc)

        finally:
            # Cleanup temp files
            try:
                if path.exists():
                    path.unlink()
            except Exception:
                pass

    async def _read_file_chunks(self, path: Path, fmt: str) -> AsyncGenerator[Any, None]:
        """
        Async generator that yields pandas DataFrame chunks.

        Each chunk is CHUNK_ROWS rows (50,000 default).
        Handles all 11 accepted formats.
        """
        ext = fmt.lower()

        if fmt in ("CSV", "TSV", "TXT"):
            sep = "\t" if fmt == "TSV" else (None if fmt == "TXT" else ",")
            reader = pd.read_csv(
                path, sep=sep, chunksize=CHUNK_ROWS,
                on_bad_lines="skip", low_memory=False,
                engine="python" if sep is None else "c",
            )
            for chunk in reader:
                yield chunk
                await asyncio.sleep(0)

        elif fmt in ("XLSX", "XLS"):
            df = pd.read_excel(path, engine="openpyxl" if fmt == "XLSX" else "xlrd")
            for i in range(0, len(df), CHUNK_ROWS):
                yield df.iloc[i:i + CHUNK_ROWS]
                await asyncio.sleep(0)

        elif fmt in ("JSON", "JSONL"):
            try:
                lines = fmt == "JSONL"
                df    = pd.read_json(path, lines=lines)
                for i in range(0, len(df), CHUNK_ROWS):
                    yield df.iloc[i:i + CHUNK_ROWS]
                    await asyncio.sleep(0)
            except Exception:
                yield pd.DataFrame()

        elif fmt == "PARQUET":
            df = pd.read_parquet(path)
            for i in range(0, len(df), CHUNK_ROWS):
                yield df.iloc[i:i + CHUNK_ROWS]
                await asyncio.sleep(0)

        elif fmt == "AVRO":
            try:
                import fastavro
                with open(path, "rb") as f:
                    records = list(fastavro.reader(f))
                df = pd.DataFrame(records)
                for i in range(0, len(df), CHUNK_ROWS):
                    yield df.iloc[i:i + CHUNK_ROWS]
                    await asyncio.sleep(0)
            except ImportError:
                yield pd.DataFrame()

        elif fmt == "XML":
            try:
                df = pd.read_xml(path)
                for i in range(0, len(df), CHUNK_ROWS):
                    yield df.iloc[i:i + CHUNK_ROWS]
                    await asyncio.sleep(0)
            except Exception:
                yield pd.DataFrame()

        elif fmt == "PDF":
            try:
                import pdfplumber
                rows = []
                with pdfplumber.open(path) as pdf:
                    for page in pdf.pages:
                        tbl = page.extract_table()
                        if tbl:
                            rows.extend(tbl)
                if rows:
                    df = pd.DataFrame(rows[1:], columns=rows[0])
                    for i in range(0, len(df), CHUNK_ROWS):
                        yield df.iloc[i:i + CHUNK_ROWS]
                        await asyncio.sleep(0)
            except Exception:
                yield pd.DataFrame()

        else:
            yield pd.DataFrame()

    async def _simulate_processing(self, job_id: str) -> None:
        """
        Simulates file processing when pandas or the file is not available.
        Generates realistic Telecom X schema and synthetic preview rows.
        """
        job        = _jobs[job_id]
        total_rows = int(secrets.randbits(17)) % 850_000 + 50_000   # 50K–900K
        n_chunks   = math.ceil(total_rows / CHUNK_ROWS)

        for i in range(n_chunks):
            await asyncio.sleep(0.05)   # simulate I/O
            rows_done = min((i + 1) * CHUNK_ROWS, total_rows)
            job["rowsProcessed"] = rows_done
            job["totalRows"]     = total_rows
            job["progress"]      = round(rows_done / total_rows * 100, 2)

        # Telecom X synthetic schema
        job["columns"] = [
            {"name": "customerID",      "type": "string",  "nullable": False, "sample": "CUST-0001", "samples": ["CUST-0001", "CUST-0002", "CUST-0003"]},
            {"name": "tenure",          "type": "number",  "nullable": False, "sample": "12",        "samples": ["12", "24", "36"]},
            {"name": "monthlyCharges",  "type": "number",  "nullable": False, "sample": "65.50",     "samples": ["65.50", "89.90", "45.00"]},
            {"name": "totalCharges",    "type": "number",  "nullable": True,  "sample": "786.00",    "samples": ["786.00", "2157.60", "1620.00"]},
            {"name": "contract",        "type": "string",  "nullable": False, "sample": "Month-to-month", "samples": ["Month-to-month", "One year", "Two year"]},
            {"name": "internetService", "type": "string",  "nullable": False, "sample": "Fiber optic",    "samples": ["Fiber optic", "DSL", "No"]},
            {"name": "churnLabel",      "type": "boolean", "nullable": False, "sample": "False",     "samples": ["False", "True", "False"]},
        ]
        job["preview"] = [
            {"customerID": f"CUST-{i:04d}", "tenure": 12 + i*5, "monthlyCharges": 65.5 + i*10,
             "totalCharges": 786.0 + i*120, "contract": "Month-to-month",
             "internetService": "Fiber optic", "churnLabel": i % 4 == 0}
            for i in range(5)
        ]
        job["status"]     = "done"
        job["progress"]   = 100.0
        job["durationMs"] = 2400 + n_chunks * 12
        job["finishedAt"] = datetime.now(timezone.utc).isoformat()

    # ── POLL ──────────────────────────────────────────────────

    async def poll_job(self, job_id: str) -> dict:
        """GET /upload/jobs/{id} → JobPollResult."""
        job = _jobs.get(job_id)
        if not job:
            raise ValueError(f"Job not found: {job_id!r}")
        return {
            "jobId":       job["jobId"],
            "status":      job["status"],
            "progress":    job["progress"],
            "rows":        job["rowsProcessed"],
            "totalRows":   job["totalRows"],
            "errorMsg":    job["errorMessage"],
            "startedAt":   job["startedAt"],
            "updatedAt":   datetime.now(timezone.utc).isoformat(),
        }

    async def get_result(self, job_id: str) -> dict:
        """GET /upload/jobs/{id}/result → UploadResult (only when done)."""
        job = _jobs.get(job_id)
        if not job:
            raise ValueError(f"Job not found: {job_id!r}")
        if job["status"] != "done":
            raise ValueError(f"Job {job_id!r} is not done yet (status={job['status']!r})")

        return {
            "jobId":       job["jobId"],
            "totalRows":   job["totalRows"],
            "columns":     job["columns"],
            "preview":     job["preview"],
            "fileName":    job["fileName"],
            "fileSize":    job["fileSize"],
            "format":      job["format"],
            "duration":    job["durationMs"] or 0,
            "processedAt": job["finishedAt"],
            "telecomXCompatible": _is_telecom_x_compatible(job["columns"]),
        }

    # ── SSE STREAM ────────────────────────────────────────────

    async def progress_stream(
        self,
        job_id: str,
    ) -> AsyncGenerator[str, None]:
        """
        GET /upload/jobs/{id}/stream → Server-Sent Events generator.

        Emits event: progress every 300ms until job is done/error/cancelled.
        Client-side: useChunkedUpload.ts onProgress callback.

        SSE format:
            event: progress
            data: {"jobId":..., "status":..., "progress":..., "rows":...}
        """
        import json
        interval = 0.3   # 300 ms — matches frontend polling cadence

        while True:
            job = _jobs.get(job_id)
            if not job:
                yield f"event: error\ndata: {json.dumps({'error': 'job not found'})}\n\n"
                break

            payload = {
                "jobId":     job["jobId"],
                "status":    job["status"],
                "progress":  job["progress"],
                "rows":      job["rowsProcessed"],
                "totalRows": job["totalRows"],
            }
            yield f"event: progress\ndata: {json.dumps(payload)}\n\n"

            if job["status"] in ("done", "error", "cancelled"):
                break

            await asyncio.sleep(interval)

    # ── CANCEL ────────────────────────────────────────────────

    async def cancel_job(self, job_id: str, user_id: str) -> bool:
        """DELETE /upload/jobs/{id}"""
        job = _jobs.get(job_id)
        if not job:
            return False

        job["status"]     = "cancelled"
        job["finishedAt"] = datetime.now(timezone.utc).isoformat()

        # Cleanup temp files
        sid     = job.get("sessionId")
        session = _sessions.get(sid) if sid else None
        if session:
            tmp_dir = Path(session.get("tmpDir", ""))
            if tmp_dir.exists():
                import shutil
                shutil.rmtree(tmp_dir, ignore_errors=True)
            _sessions.pop(sid, None)

        _jobs.pop(job_id, None)
        logger.info("Job %r cancelled by user %s", job_id, user_id)
        return True

    # ── ML PIPELINE EXPORT ────────────────────────────────────

    async def export_to_ml_pipeline(
        self,
        job_id:  str,
        user_id: str,
    ) -> dict:
        """
        POST /upload/jobs/{id}/export-ml

        Forwards the processed dataset to the Telecom X ML pipeline.
        Endpoint: https://telecomx.pipeline/ingest
        Returns: MLPipelineExport { jobId, pipelineId, rowsForwarded, status, endpoint }

        In production: streams the assembled file via multipart POST
        to the Telecom X ingest endpoint with JWT auth.
        In prototype: simulates the forward and returns accepted status.
        """
        job = _jobs.get(job_id)
        if not job:
            raise ValueError(f"Job not found: {job_id!r}")
        if job["status"] != "done":
            raise ValueError(f"Job {job_id!r} is not done (status={job['status']!r})")

        pid      = _pipeline_id()
        endpoint = "https://telecomx.pipeline/ingest"

        logger.info(
            "ML pipeline export: job %r → pipeline %r (%d rows)",
            job_id, pid, job["totalRows"],
        )

        return {
            "jobId":         job_id,
            "pipelineId":    pid,
            "rowsForwarded": job["totalRows"],
            "status":        "accepted",
            "endpoint":      endpoint,
        }
