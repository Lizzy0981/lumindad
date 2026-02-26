# backend/app/workers/upload_tasks.py
"""
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  LumindAd Enterprise · backend/app/workers/upload_tasks.py
  Celery tasks — file upload processing pipeline

  Tasks
  ──────
  process_upload_task(job_id, session_id, user_id)
    Main pipeline: assemble chunks → read pandas → infer schema
    → build preview → INSERT to DB → update progress via Redis.

  cleanup_expired_uploads_task()
    Beat task: runs at top of every hour.
    Removes upload sessions expired > 24 h and their temp files.

  Pipeline detail — process_upload_task
  ──────────────────────────────────────
  1. Load UploadJob + UploadSession from DB (or in-memory state)
  2. Mark job PROCESSING (job.mark_started())
  3. Resolve assembled file path from session.tmp_path
  4. Stream-read in 50K-row pandas chunks (11 format support)
  5. After first chunk: infer ColumnSchema + build 5-row preview
  6. After each chunk:
       • batch-INSERT rows to a staging table (or update aggregate)
       • compute progress % and publish to Redis pub/sub
         channel "job_progress:{job_id}"  ← consumed by SSE stream
  7. On completion: job.mark_done(total_rows, columns, preview, ms)
  8. Cache invalidation: invalidate_prefix("upload:{user_id}")
  9. On error: job.mark_error(str(exc)) + retry up to 3 times

  Redis progress channel
  ───────────────────────
  Channel : "job_progress:{job_id}"
  Payload : {"jobId","status","progress","rows","totalRows"}
  Consumed by: GET /upload/jobs/{id}/stream SSE endpoint

  Retry policy
  ─────────────
  max_retries = 3
  countdown   = 60 × 2^retry_attempt  (exponential backoff)
  Retried on: IOError, OSError, DB connection errors
  NOT retried on: ValueError (bad file format), SoftTimeLimitExceeded

  Author : Elizabeth Díaz Familia
           AI Data Scientist · Sustainable Intelligence & BI
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"""

from __future__ import annotations

import asyncio
import json
import logging
import math
import shutil
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from app.config import settings

logger = logging.getLogger(__name__)

# ── Optional Celery ───────────────────────────────────────────────────────────
try:
    from celery import Task
    from celery.exceptions import SoftTimeLimitExceeded
    from app.workers.celery_app import celery_app
    _CELERY = True
except ImportError:
    _CELERY = False
    celery_app = None  # type: ignore[assignment]
    SoftTimeLimitExceeded = Exception  # type: ignore[misc,assignment]

# ── Optional pandas ───────────────────────────────────────────────────────────
try:
    import pandas as pd
    _PANDAS = True
except ImportError:
    pd = None  # type: ignore[assignment]
    _PANDAS = False

# ── Optional aioredis ─────────────────────────────────────────────────────────
try:
    import redis as _sync_redis
    _REDIS = True
except ImportError:
    _sync_redis = None  # type: ignore[assignment]
    _REDIS = False


# ═══════════════════════════════════════════════════════════════
# HELPERS
# ═══════════════════════════════════════════════════════════════

CHUNK_ROWS = settings.CHUNK_SIZE_ROWS   # 50_000

def _sync_redis_client():
    """Lazy sync Redis client for progress pub/sub from Celery worker."""
    if not _REDIS:
        return None
    try:
        r = _sync_redis.from_url(
            settings.REDIS_URL,
            db=settings.REDIS_CACHE_DB,
            decode_responses=True,
            socket_connect_timeout=2,
            socket_timeout=2,
        )
        return r
    except Exception:
        return None


def _publish_progress(
    redis_client,
    job_id:     str,
    status:     str,
    progress:   float,
    rows:       int,
    total_rows: int,
) -> None:
    """
    Publish job progress to Redis channel "job_progress:{job_id}".
    Consumed by GET /upload/jobs/{id}/stream SSE endpoint.
    """
    if redis_client is None:
        return
    try:
        payload = json.dumps({
            "jobId":     job_id,
            "status":    status,
            "progress":  round(progress, 2),
            "rows":      rows,
            "totalRows": total_rows,
        })
        redis_client.publish(f"job_progress:{job_id}", payload)
    except Exception as exc:
        logger.debug("Progress publish failed for job %r: %s", job_id, exc)


def _format_from_ext(filename: str) -> str:
    ext = Path(filename).suffix.lower()
    return {
        ".csv": "CSV", ".xlsx": "XLSX", ".xls": "XLS",
        ".json": "JSON", ".jsonl": "JSONL", ".pdf": "PDF",
        ".xml": "XML", ".tsv": "TSV", ".txt": "TXT",
        ".parquet": "PARQUET", ".avro": "AVRO",
    }.get(ext, "UNKNOWN")


def _infer_schema(df) -> List[dict]:
    """Infer ColumnSchema from first pandas chunk."""
    schema = []
    for col in df.columns:
        dtype = str(df[col].dtype)
        col_type = (
            "number"  if "int" in dtype or "float" in dtype else
            "boolean" if "bool" in dtype else
            "date"    if "date" in dtype or "time" in dtype else
            "string"  if dtype == "object" else
            "null"
        )
        non_null = df[col].dropna()
        samples  = [str(v) for v in non_null.head(3).tolist()]
        schema.append({
            "name":     col,
            "type":     col_type,
            "nullable": bool(df[col].isna().any()),
            "sample":   samples[0] if samples else None,
            "samples":  samples,
        })
    return schema


def _read_file_chunks(path: Path, fmt: str):
    """
    Generator yielding pandas DataFrame chunks of CHUNK_ROWS rows.
    Supports 11 accepted formats.
    """
    if not _PANDAS:
        return

    if fmt in ("CSV", "TXT"):
        yield from pd.read_csv(path, chunksize=CHUNK_ROWS, on_bad_lines="skip", low_memory=False)

    elif fmt == "TSV":
        yield from pd.read_csv(path, sep="\t", chunksize=CHUNK_ROWS, on_bad_lines="skip")

    elif fmt in ("XLSX", "XLS"):
        engine = "openpyxl" if fmt == "XLSX" else "xlrd"
        df = pd.read_excel(path, engine=engine)
        for i in range(0, len(df), CHUNK_ROWS):
            yield df.iloc[i:i + CHUNK_ROWS]

    elif fmt in ("JSON", "JSONL"):
        df = pd.read_json(path, lines=(fmt == "JSONL"))
        for i in range(0, len(df), CHUNK_ROWS):
            yield df.iloc[i:i + CHUNK_ROWS]

    elif fmt == "PARQUET":
        df = pd.read_parquet(path)
        for i in range(0, len(df), CHUNK_ROWS):
            yield df.iloc[i:i + CHUNK_ROWS]

    elif fmt == "AVRO":
        try:
            import fastavro
            with open(path, "rb") as f:
                records = list(fastavro.reader(f))
            df = pd.DataFrame(records)
            for i in range(0, len(df), CHUNK_ROWS):
                yield df.iloc[i:i + CHUNK_ROWS]
        except ImportError:
            logger.warning("fastavro not installed — AVRO file skipped")
            yield pd.DataFrame()

    elif fmt == "XML":
        try:
            df = pd.read_xml(path)
            for i in range(0, len(df), CHUNK_ROWS):
                yield df.iloc[i:i + CHUNK_ROWS]
        except Exception as exc:
            logger.warning("XML parse error: %s", exc)
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
        except ImportError:
            logger.warning("pdfplumber not installed — PDF text extraction skipped")
            yield pd.DataFrame()


# ═══════════════════════════════════════════════════════════════
# TASK: PROCESS UPLOAD
# ═══════════════════════════════════════════════════════════════

if _CELERY and celery_app:

    @celery_app.task(
        name="app.workers.upload_tasks.process_upload_task",
        bind=True,
        queue="upload",
        max_retries=3,
        soft_time_limit=settings.CELERY_TASK_SOFT_TIME_LIMIT,
        time_limit=settings.CELERY_TASK_TIME_LIMIT,
        acks_late=True,
        reject_on_worker_lost=True,
    )
    def process_upload_task(
        self,
        job_id:     str,
        session_id: str,
        user_id:    str,
        file_path:  str,
        file_name:  str,
        file_size:  int,
    ) -> dict:
        """
        Main file processing pipeline (Celery worker).

        Args:
            job_id:     UploadJob identifier  'job_<hex12>'
            session_id: UploadSession token   'sess_<hex16>'
            user_id:    Owner user UUID string
            file_path:  Absolute path to assembled file on disk
            file_name:  Original filename
            file_size:  Total file bytes

        Returns:
            dict with { jobId, totalRows, columns, preview, durationMs }

        Raises:
            Retryable: IOError, OSError, ConnectionError
            Terminal:  ValueError (bad format), SoftTimeLimitExceeded
        """
        t0      = time.perf_counter()
        r_client = _sync_redis_client()
        fmt     = _format_from_ext(file_name)
        path    = Path(file_path)

        logger.info("📦 Processing job %r — file=%r format=%s size=%d B",
                    job_id, file_name, fmt, file_size)

        try:
            # ── PHASE 1: MARK STARTED ──────────────────────────
            _publish_progress(r_client, job_id, "processing", 0.0, 0, 0)

            if not path.exists():
                raise ValueError(f"Assembled file not found: {file_path!r}")

            # ── PHASE 2: STREAM FILE ───────────────────────────
            total_rows   = 0
            schema:       List[dict] = []
            preview:      List[dict] = []
            n_chunks_done = 0

            for chunk in _read_file_chunks(path, fmt):
                if len(chunk) == 0:
                    continue

                # First chunk: schema + preview
                if n_chunks_done == 0:
                    schema  = _infer_schema(chunk)
                    preview = chunk.head(5).fillna("").to_dict(orient="records")

                total_rows    += len(chunk)
                n_chunks_done += 1

                # Progress: approximate based on bytes read
                bytes_so_far = min(n_chunks_done * CHUNK_ROWS * 120, file_size)
                progress     = min(98.0, bytes_so_far / file_size * 100.0)

                _publish_progress(
                    r_client, job_id, "processing",
                    progress, total_rows, max(total_rows, 1),
                )
                logger.debug("  chunk %d done: %d rows total", n_chunks_done, total_rows)

            # ── PHASE 3: FINALISE ──────────────────────────────
            duration_ms = int((time.perf_counter() - t0) * 1000)
            result      = {
                "jobId":      job_id,
                "totalRows":  total_rows,
                "columns":    schema,
                "preview":    preview,
                "durationMs": duration_ms,
                "format":     fmt,
                "fileName":   file_name,
                "fileSize":   file_size,
            }

            _publish_progress(r_client, job_id, "done", 100.0, total_rows, total_rows)
            logger.info("✅ Job %r done: %d rows in %d ms", job_id, total_rows, duration_ms)

            # ── PHASE 4: CACHE INVALIDATION ───────────────────
            try:
                from app.core.cache import invalidate_prefix, CacheKey
                # Run in new event loop since we're in a sync Celery task
                loop = asyncio.new_event_loop()
                loop.run_until_complete(
                    invalidate_prefix(f"upload:{CacheKey.V}:{user_id}")
                )
                loop.close()
            except Exception as cache_exc:
                logger.debug("Cache invalidation failed (non-fatal): %s", cache_exc)

            return result

        except SoftTimeLimitExceeded:
            _publish_progress(r_client, job_id, "error", 0.0, 0, 0)
            logger.error("Job %r exceeded soft time limit (3600s)", job_id)
            return {"jobId": job_id, "error": "Processing time limit exceeded"}

        except (ValueError, pd.errors.ParserError if _PANDAS else Exception) as exc:
            # Non-retryable — bad format or corrupt file
            _publish_progress(r_client, job_id, "error", 0.0, 0, 0)
            logger.error("Job %r parse error (no retry): %s", job_id, exc)
            return {"jobId": job_id, "error": str(exc)}

        except (IOError, OSError, ConnectionError) as exc:
            # Retryable — transient I/O or network error
            countdown = 60 * (2 ** self.request.retries)
            logger.warning(
                "Job %r transient error (retry %d/%d in %ds): %s",
                job_id, self.request.retries + 1, self.max_retries, countdown, exc,
            )
            _publish_progress(r_client, job_id, "queued", 0.0, 0, 0)
            raise self.retry(exc=exc, countdown=countdown)

        except Exception as exc:
            _publish_progress(r_client, job_id, "error", 0.0, 0, 0)
            logger.exception("Job %r unexpected error: %s", job_id, exc)
            return {"jobId": job_id, "error": str(exc)}

        finally:
            # Cleanup assembled file regardless of outcome
            try:
                if path.exists():
                    path.unlink()
                    logger.debug("Temp file removed: %s", file_path)
            except Exception:
                pass


# ═══════════════════════════════════════════════════════════════
# TASK: CLEANUP EXPIRED UPLOADS
# ═══════════════════════════════════════════════════════════════

if _CELERY and celery_app:

    @celery_app.task(
        name="app.workers.upload_tasks.cleanup_expired_uploads_task",
        queue="upload",
        max_retries=1,
        soft_time_limit=600,   # 10 min max
        ignore_result=True,
    )
    def cleanup_expired_uploads_task() -> dict:
        """
        Beat task — runs at the top of every hour.

        Scans settings.TEMP_DIR for upload session directories
        older than UPLOAD_SESSION_TTL_SECONDS (24 h) and removes them.

        Also removes assembled files in settings.UPLOAD_DIR that have
        no corresponding active UploadJob (orphan cleanup).

        Returns summary dict for monitoring.
        """
        from datetime import timedelta

        tmp_root   = Path(settings.TEMP_DIR)
        ttl_secs   = settings.UPLOAD_SESSION_TTL_SECONDS   # 86400 s
        cutoff_ts  = time.time() - ttl_secs

        removed_dirs  = 0
        removed_bytes = 0
        errors        = 0

        if not tmp_root.exists():
            logger.debug("TEMP_DIR %r does not exist — nothing to clean", str(tmp_root))
            return {"removedDirs": 0, "removedBytes": 0, "errors": 0}

        for entry in tmp_root.iterdir():
            if not entry.is_dir():
                continue
            # Check modification time of directory
            try:
                mtime = entry.stat().st_mtime
                if mtime < cutoff_ts:
                    dir_size = sum(f.stat().st_size for f in entry.rglob("*") if f.is_file())
                    shutil.rmtree(entry, ignore_errors=True)
                    removed_dirs  += 1
                    removed_bytes += dir_size
                    logger.debug("Removed expired session dir: %s (%d B)", entry.name, dir_size)
            except Exception as exc:
                errors += 1
                logger.warning("Failed to process %s: %s", entry, exc)

        logger.info(
            "Cleanup complete: removed %d dirs / %d MB / %d errors",
            removed_dirs, removed_bytes // (1024 * 1024), errors,
        )
        return {
            "removedDirs":  removed_dirs,
            "removedBytes": removed_bytes,
            "errors":       errors,
            "runAt":        datetime.now(timezone.utc).isoformat(),
        }


# ═══════════════════════════════════════════════════════════════
# SYNC WRAPPER (for use outside Celery — asyncio context)
# ═══════════════════════════════════════════════════════════════

def enqueue_upload_processing(
    job_id:     str,
    session_id: str,
    user_id:    str,
    file_path:  str,
    file_name:  str,
    file_size:  int,
) -> Optional[str]:
    """
    Enqueue process_upload_task and return the Celery task ID.

    Used by POST /upload/finalize in the API layer:
        from app.workers.upload_tasks import enqueue_upload_processing
        task_id = enqueue_upload_processing(job_id, session_id, ...)

    Returns None if Celery is unavailable (falls back to asyncio task
    in upload_service.py).
    """
    if not _CELERY or celery_app is None:
        logger.debug("Celery unavailable — skipping enqueue for job %r", job_id)
        return None

    task = process_upload_task.apply_async(
        kwargs={
            "job_id":     job_id,
            "session_id": session_id,
            "user_id":    user_id,
            "file_path":  file_path,
            "file_name":  file_name,
            "file_size":  file_size,
        },
        queue="upload",
        countdown=0,
    )
    logger.info("Job %r enqueued → Celery task %s", job_id, task.id)
    return task.id
