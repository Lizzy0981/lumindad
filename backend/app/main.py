# backend/app/main.py
"""
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  LumindAd Enterprise · backend/app/main.py
  FastAPI application entry point

  Startup sequence (lifespan)
  ────────────────────────────
  1. settings.ensure_directories() — create uploads/tmp/models dirs
  2. settings.display()           — print configuration
  3. SQLAlchemy async engine      — warm up DB connection pool
  4. Redis pool                   — ping to verify connectivity
  5. Mount API v1 router          — /api/v1/...
  6. Register WebSocket /ws/kpi   — real-time KPI broadcast

  Middleware stack (outer → inner)
  ──────────────────────────────────
  1. CORSMiddleware               — allow_origins from settings
  2. RequestIDMiddleware          — inject X-Request-ID into every req
  3. ProcessTimeMiddleware        — inject X-Process-Time (ms)
  4. GZipMiddleware               — compress responses > 1 KB

  Key endpoints
  ──────────────
  GET  /                 → health check + service info
  GET  /health           → load balancer health probe
  GET  /version          → version + build info
  WS   /ws/kpi           → real-time KPI stream
  GET  /docs             → Swagger UI (disabled in production)
  GET  /redoc            → ReDoc UI (disabled in production)
  GET  /openapi.json     → OpenAPI spec

  Error handlers
  ───────────────
  404 Not Found          → standard JSON with suggestion
  422 Unprocessable      → normalised validation error body
  500 Internal Server    → generic message + request_id

  Author : Elizabeth Díaz Familia
           AI Data Scientist · Sustainable Intelligence & BI
  Version: 1.0.0
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"""

from __future__ import annotations

import logging
import time
import uuid
from contextlib import asynccontextmanager
from typing import Any, Dict

from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response

from app.config import settings
from app.api.v1 import api_router_v1   # assembled in api/v1/__init__.py

logger = logging.getLogger(__name__)

# ─── Optional heavy deps — graceful fallback ─────────────────────────────────

try:
    from app.dependencies import _get_engine, _get_redis_pool  # lazy inits
    _DEPS_AVAILABLE = True
except ImportError:
    _DEPS_AVAILABLE = False


# ═══════════════════════════════════════════════════════════════
# LIFESPAN — async startup / shutdown
# ═══════════════════════════════════════════════════════════════

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Async context manager — replaces deprecated @app.on_event handlers.

    Everything before `yield` runs at startup.
    Everything after `yield` runs at shutdown.
    """
    # ── Startup ──────────────────────────────────────────────────────────────
    logger.info("═" * 64)
    logger.info("  🚀  LumindAd Enterprise API — Starting up...")
    logger.info("═" * 64)

    # Ensure upload / tmp / models directories exist
    settings.ensure_directories()
    logger.info("  ✅  Directories verified")

    # Print configuration (non-sensitive)
    if settings.DEBUG:
        settings.display()

    # Warm up SQLAlchemy async connection pool
    if _DEPS_AVAILABLE:
        try:
            engine = _get_engine()
            if engine:
                async with engine.connect() as conn:
                    # Simple ping query
                    from sqlalchemy import text
                    await conn.execute(text("SELECT 1"))
                logger.info("  ✅  PostgreSQL connection pool warmed up")
        except Exception as exc:  # noqa: BLE001
            logger.warning("  ⚠️   Database not available: %s", exc)
            logger.warning("      Running without database (seed data mode)")

        # Ping Redis
        try:
            pool = _get_redis_pool()
            if pool:
                await pool.ping()
                logger.info("  ✅  Redis connection verified")
        except Exception as exc:  # noqa: BLE001
            logger.warning("  ⚠️   Redis not available: %s", exc)
            logger.warning("      Running without cache (no-cache mode)")

    logger.info("  ✅  API v1 router mounted at %s", settings.API_V1_PREFIX)
    logger.info("  ✅  WebSocket /ws/kpi ready")
    logger.info("  ✅  Green AI tracker: CPU %sW · GPU %sW · PUE %.2f",
                settings.CPU_POWER_W, settings.GPU_POWER_W, settings.PUE)
    logger.info("═" * 64)
    logger.info("  👤  Author : Elizabeth Díaz Familia")
    logger.info("  📦  Version: %s", settings.APP_VERSION)
    logger.info("  🌐  Docs   : http://localhost:8000/docs")
    logger.info("═" * 64)

    yield   # ─── Application running ──────────────────────────────────────────

    # ── Shutdown ─────────────────────────────────────────────────────────────
    logger.info("  🛑  LumindAd Enterprise API — Shutting down...")

    if _DEPS_AVAILABLE:
        try:
            engine = _get_engine()
            if engine:
                await engine.dispose()
                logger.info("  ✅  Database connections closed")
        except Exception:  # noqa: BLE001
            pass

        try:
            pool = _get_redis_pool()
            if pool:
                await pool.aclose()
                logger.info("  ✅  Redis connections closed")
        except Exception:  # noqa: BLE001
            pass

    logger.info("  ✅  Shutdown complete")


# ═══════════════════════════════════════════════════════════════
# FASTAPI APPLICATION
# ═══════════════════════════════════════════════════════════════

app = FastAPI(
    title          = settings.APP_NAME,
    description    = settings.APP_DESCRIPTION,
    version        = settings.APP_VERSION,
    contact        = {
        "name":  settings.APP_AUTHOR,
        "email": settings.APP_CONTACT_EMAIL,
        "url":   settings.APP_CONTACT_URL,
    },
    license_info   = {
        "name": "MIT",
        "url":  "https://opensource.org/licenses/MIT",
    },
    # Swagger + ReDoc — disable in production to avoid leaking API shape
    docs_url       = "/docs"        if not settings.is_production else None,
    redoc_url      = "/redoc"       if not settings.is_production else None,
    openapi_url    = "/openapi.json" if not settings.is_production else None,
    lifespan       = lifespan,
    # OpenAPI tags ordering
    openapi_tags   = [
        {"name": "auth",       "description": "JWT authentication · login · refresh"},
        {"name": "campaigns",  "description": "Campaign CRUD · status · performance"},
        {"name": "budget",     "description": "Monthly budget · allocations · AI recommendation"},
        {"name": "analytics",  "description": "Performance metrics · time series · KPIs"},
        {"name": "upload",     "description": "Chunked file upload · SSE progress · 10M rows"},
        {"name": "ml",         "description": "Churn prediction · SHAP · anomaly detection"},
        {"name": "bi-export",  "description": "Power BI · Tableau · Excel · PDF export"},
        {"name": "health",     "description": "Health probes · version"},
    ],
)

# ═══════════════════════════════════════════════════════════════
# MIDDLEWARE STACK
# ═══════════════════════════════════════════════════════════════

# ── 1. CORS ───────────────────────────────────────────────────
# Must be added FIRST (outermost wrapper) so preflight OPTIONS
# requests are handled before auth or other middleware fires.
app.add_middleware(
    CORSMiddleware,
    allow_origins     = settings.CORS_ORIGINS,
    allow_credentials = settings.CORS_ALLOW_CREDENTIALS,
    allow_methods     = settings.CORS_ALLOW_METHODS,
    allow_headers     = settings.CORS_ALLOW_HEADERS,
    expose_headers    = settings.CORS_EXPOSE_HEADERS,
    max_age           = settings.CORS_MAX_AGE,
)

# ── 2. Request ID — inject X-Request-ID for distributed tracing ──
class RequestIDMiddleware(BaseHTTPMiddleware):
    """
    Injects a unique X-Request-ID header into every request and response.

    If the client already sends an X-Request-ID, it is preserved.
    This enables end-to-end request tracing across frontend logs,
    API logs, Celery workers, and Sentry.

    Frontend services/api.ts already sends: X-Request-ID: <uuid>
    """
    async def dispatch(self, request: Request, call_next) -> Response:
        request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
        # Make available to endpoint handlers
        request.state.request_id = request_id
        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        return response

app.add_middleware(RequestIDMiddleware)

# ── 3. Process Time — X-Process-Time in milliseconds ─────────
class ProcessTimeMiddleware(BaseHTTPMiddleware):
    """
    Appends X-Process-Time (ms) to every response for performance monitoring.

    Visible in browser DevTools Network tab and Sentry performance traces.
    """
    async def dispatch(self, request: Request, call_next) -> Response:
        start = time.perf_counter()
        response = await call_next(request)
        elapsed_ms = (time.perf_counter() - start) * 1000
        response.headers["X-Process-Time"] = f"{elapsed_ms:.2f}ms"
        return response

app.add_middleware(ProcessTimeMiddleware)

# ── 4. GZip — compress responses larger than 1 KB ────────────
app.add_middleware(GZipMiddleware, minimum_size=1024)


# ═══════════════════════════════════════════════════════════════
# ERROR HANDLERS
# ═══════════════════════════════════════════════════════════════

@app.exception_handler(404)
async def not_found_handler(request: Request, exc) -> JSONResponse:
    """
    404 Not Found — standard JSON with suggestion.

    Response shape matches frontend normaliseError() in services/api.ts:
        { status, code, message, details?, requestId? }
    """
    return JSONResponse(
        status_code=404,
        content={
            "status":    404,
            "code":      "NOT_FOUND",
            "message":   f"Resource not found: {request.url.path}",
            "details":   {"path": str(request.url.path)},
            "requestId": getattr(request.state, "request_id", None),
            "suggestion":"Check the API documentation at /docs",
        },
    )


@app.exception_handler(RequestValidationError)
async def validation_error_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    """
    422 Unprocessable Entity — Pydantic validation errors.

    Normalised to the same shape as other error responses so the
    frontend ApiError type can handle them uniformly.
    """
    errors = [
        {
            "field":   ".".join(str(loc) for loc in e["loc"]),
            "message": e["msg"],
            "type":    e["type"],
        }
        for e in exc.errors()
    ]
    return JSONResponse(
        status_code=422,
        content={
            "status":    422,
            "code":      "VALIDATION_ERROR",
            "message":   "Request validation failed",
            "details":   errors,
            "requestId": getattr(request.state, "request_id", None),
        },
    )


@app.exception_handler(500)
async def internal_error_handler(request: Request, exc: Exception) -> JSONResponse:
    """
    500 Internal Server Error — generic message, never leak internals.
    """
    request_id = getattr(request.state, "request_id", "unknown")
    logger.error("Unhandled exception [%s]: %s", request_id, exc, exc_info=True)

    # Send to Sentry in production
    if settings.SENTRY_DSN:
        try:
            import sentry_sdk
            sentry_sdk.set_tag("request_id", request_id)
            sentry_sdk.capture_exception(exc)
        except Exception:  # noqa: BLE001
            pass

    return JSONResponse(
        status_code=500,
        content={
            "status":    500,
            "code":      "INTERNAL_SERVER_ERROR",
            "message":   "An unexpected error occurred. Please try again later.",
            "requestId": request_id,
        },
    )


# ═══════════════════════════════════════════════════════════════
# API ROUTER — /api/v1
# ═══════════════════════════════════════════════════════════════

app.include_router(
    api_router_v1,
    prefix=settings.API_V1_PREFIX,
)


# ═══════════════════════════════════════════════════════════════
# ROOT ENDPOINTS
# ═══════════════════════════════════════════════════════════════

@app.get("/", tags=["health"], summary="API root — service info + health check")
async def root() -> Dict[str, Any]:
    """
    Root endpoint. Used as a health check by Docker health probes
    and as a quick sanity check during deployment.

    Returns API version, status, and documentation links.
    """
    return {
        "status":      "online",
        "service":     settings.APP_NAME,
        "version":     settings.APP_VERSION,
        "environment": settings.ENVIRONMENT,
        "author":      settings.APP_AUTHOR,
        "description": settings.APP_DESCRIPTION,
        "documentation": {
            "swagger": "/docs",
            "redoc":   "/redoc",
            "openapi": "/openapi.json",
        },
        "endpoints": {
            "api_v1":    settings.API_V1_PREFIX,
            "websocket": "/ws/kpi",
            "health":    "/health",
            "version":   "/version",
        },
        "capabilities": [
            "JWT Authentication",
            "Campaign CRUD",
            "Budget Management",
            "Performance Analytics",
            "Chunked File Upload (10 formats · 2 GB · 10M rows)",
            "ML Predictions (Churn · Clicks · ROAS)",
            "SHAP Explainability",
            "Anomaly Detection",
            "Power BI & Tableau Export",
            "WebSocket Real-time KPI Stream",
            "Green AI Carbon Footprint Tracking",
        ],
        "green_ai": {
            "scope":            "GHG Scope 2",
            "carbon_intensity": f"{settings.CARBON_INTENSITY_KG_KWH} kgCO₂/kWh",
            "pue":              settings.PUE,
        },
        "telecomx_compatible": True,
    }


@app.get("/health", tags=["health"], summary="Load balancer health probe")
async def health_check() -> Dict[str, str]:
    """
    Minimal health endpoint for load balancers and Docker.

    Returns 200 as long as the process is alive.
    For deep health checks (DB + Redis connectivity),
    use GET /api/v1/health/deep instead.
    """
    return {
        "status":  "healthy",
        "service": "lumindad-api",
        "version": settings.APP_VERSION,
    }


@app.get("/version", tags=["health"], summary="Version and build info")
async def version_info() -> Dict[str, Any]:
    """
    Returns version, build commit, and build timestamp.
    Useful for CI/CD verification and debugging deployments.
    """
    return {
        "version":          settings.APP_VERSION,
        "api_version":      "v1",
        "build_commit":     settings.APP_BUILD_COMMIT,
        "build_timestamp":  settings.APP_BUILD_TIMESTAMP,
        "environment":      settings.ENVIRONMENT,
        "python_version":   _get_python_version(),
    }


def _get_python_version() -> str:
    import sys
    return f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}"


# ═══════════════════════════════════════════════════════════════
# WEBSOCKET — /ws/kpi  (real-time KPI stream)
# ═══════════════════════════════════════════════════════════════

# Simple in-memory broadcast registry
# In production: use Redis pub/sub (settings.REDIS_WS_DB)
_ws_clients: set[WebSocket] = set()


@app.websocket("/ws/kpi")
async def ws_kpi_stream(websocket: WebSocket):
    """
    WebSocket endpoint for real-time KPI broadcasting.

    Auth: pass JWT as query param — ?token=<access_token>
          (WebSocket protocol doesn't support Authorization headers)

    Usage (frontend hooks/useRealTimeAPI.ts):
        const ws = new WebSocket('ws://localhost:8000/ws/kpi?token=<jwt>');
        ws.onmessage = (e) => {
            const kpi = JSON.parse(e.data);
            // { type: 'KPI_UPDATE', impressions, clicks, spend, roas, ... }
        };

    Message types sent from server:
        { type: 'KPI_UPDATE', data: { ... } }   — new KPI snapshot
        { type: 'ANOMALY_ALERT', data: { ... } } — detected anomaly
        { type: 'UPLOAD_PROGRESS', data: { ... }}— processing progress
        { type: 'PING' }                          — keepalive
    """
    # Validate token from query param
    token = websocket.query_params.get("token")
    if not token:
        await websocket.close(code=4001, reason="Authentication required")
        return

    try:
        from app.dependencies import decode_token
        decode_token(token, expected_type="access")
    except Exception:
        await websocket.close(code=4001, reason="Invalid token")
        return

    await websocket.accept()
    _ws_clients.add(websocket)
    logger.info("WebSocket client connected. Total: %d", len(_ws_clients))

    try:
        # Keepalive loop — client messages are ignored (server-push only)
        while True:
            try:
                # Wait for ping from client (or detect disconnect)
                data = await websocket.receive_text()
                if data == "ping":
                    await websocket.send_json({"type": "PONG"})
            except WebSocketDisconnect:
                break
    finally:
        _ws_clients.discard(websocket)
        logger.info("WebSocket client disconnected. Total: %d", len(_ws_clients))


async def broadcast_kpi_update(payload: dict) -> None:
    """
    Broadcast a KPI update to all connected WebSocket clients.

    Called by Celery tasks and background workers after processing.

    Args:
        payload: Dict with type + data fields,
                 e.g. {'type': 'KPI_UPDATE', 'data': {...}}

    Example:
        await broadcast_kpi_update({
            'type': 'UPLOAD_PROGRESS',
            'data': {'jobId': 'job_abc', 'progress': 45, 'rows': 450_000}
        })
    """
    dead: set[WebSocket] = set()
    for ws in list(_ws_clients):
        try:
            await ws.send_json(payload)
        except Exception:  # noqa: BLE001
            dead.add(ws)
    for ws in dead:
        _ws_clients.discard(ws)


# ═══════════════════════════════════════════════════════════════
# UVICORN ENTRY POINT
# ═══════════════════════════════════════════════════════════════

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host       = "0.0.0.0",
        port       = 8000,
        reload     = settings.is_development,
        workers    = 1 if settings.is_development else 4,
        log_level  = settings.LOG_LEVEL.lower(),
        access_log = settings.DEBUG,
    )
