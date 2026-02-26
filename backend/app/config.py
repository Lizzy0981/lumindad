# backend/app/config.py
"""
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  LumindAd Enterprise · backend/app/config.py
  Centralised configuration via Pydantic Settings v2

  Environment variable loading order
  ────────────────────────────────────
  1. .env.production  (ignored by git, deployed as secret)
  2. .env.local       (local override, ignored by git)
  3. .env             (committed defaults, no secrets)
  4. OS environment   (Docker / K8s / Heroku / Railway)

  All secrets (SECRET_KEY, DB passwords, external API keys)
  MUST come from OS environment or .env.production.
  The default values here are safe for local development only.

  Usage
  ─────
  from app.config import settings

  # Access values
  settings.DATABASE_URL
  settings.JWT_SECRET_KEY
  settings.REDIS_URL

  # Check environment
  settings.is_development   → bool
  settings.is_production    → bool

  Author : Elizabeth Díaz Familia
           AI Data Scientist · Sustainable Intelligence & BI
  Version: 1.0.0
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"""

from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path
from typing import List, Optional

from pydantic import AnyHttpUrl, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# ─── Resolve project root ─────────────────────────────────────────────────────

_HERE = Path(__file__).resolve().parent          # app/
_ROOT = _HERE.parent                             # backend/


# ═══════════════════════════════════════════════════════════════
# SETTINGS
# ═══════════════════════════════════════════════════════════════

class Settings(BaseSettings):
    """
    LumindAd application settings.

    All fields map 1-to-1 to an environment variable with the same
    name (upper-cased). For example:
        DEBUG=true            → settings.DEBUG  == True
        DATABASE_URL=postgres → settings.DATABASE_URL == 'postgres...'

    Validation is run at startup — the app will refuse to start if
    critical settings are missing or invalid in production.
    """

    model_config = SettingsConfigDict(
        env_file        = (".env", ".env.local", ".env.production"),
        env_file_encoding = "utf-8",
        case_sensitive  = False,   # DATABASE_URL == database_url
        extra           = "ignore",
    )

    # ══════════════════════════════════════════════════════════
    # APPLICATION IDENTITY
    # ══════════════════════════════════════════════════════════

    APP_NAME: str        = "LumindAd Enterprise API"
    APP_VERSION: str     = "1.0.0"
    APP_DESCRIPTION: str = (
        "AI-powered advertising intelligence platform. "
        "10M-row data processing · ML churn prediction · "
        "SHAP explainability · Green AI compliance."
    )
    APP_AUTHOR: str      = "Elizabeth Díaz Familia"
    APP_CONTACT_EMAIL: str = "lizzyfamilia@gmail.com"
    APP_CONTACT_URL: str   = "https://github.com/Lizzy0981"

    # Build info — injected at CI/CD build time
    APP_BUILD_COMMIT: Optional[str] = None
    APP_BUILD_TIMESTAMP: Optional[str] = None

    # ══════════════════════════════════════════════════════════
    # ENVIRONMENT
    # ══════════════════════════════════════════════════════════

    ENVIRONMENT: str = "development"   # development | staging | production
    DEBUG: bool      = True
    LOG_LEVEL: str   = "INFO"

    # ══════════════════════════════════════════════════════════
    # API ROUTING
    # ══════════════════════════════════════════════════════════

    API_V1_PREFIX: str = "/api/v1"

    # ══════════════════════════════════════════════════════════
    # CORS
    # ══════════════════════════════════════════════════════════

    #  Comma-separated in .env:  CORS_ORIGINS=http://localhost:3000,https://lumindad.app
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",     # Vite dev (vite.config.ts server.port = 3000)
        "http://localhost:5173",     # Vite fallback
        "http://localhost:4173",     # Vite preview
        "https://lumindad.app",      # Production frontend
        "https://www.lumindad.app",
    ]
    CORS_ALLOW_CREDENTIALS: bool      = True
    CORS_ALLOW_METHODS: List[str]     = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
    CORS_ALLOW_HEADERS: List[str]     = ["*"]
    CORS_EXPOSE_HEADERS: List[str]    = ["X-Request-ID", "X-Total-Count", "X-Process-Time"]
    CORS_MAX_AGE: int                 = 600   # seconds — preflight cache

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors_origins(cls, v: str | List[str]) -> List[str]:
        """Accept comma-separated string or list from env."""
        if isinstance(v, str):
            return [o.strip() for o in v.split(",") if o.strip()]
        return v

    # ══════════════════════════════════════════════════════════
    # DATABASE — PostgreSQL 16 (async via asyncpg)
    # ══════════════════════════════════════════════════════════

    DATABASE_URL: Optional[str] = (
        "postgresql+asyncpg://lumindad:lumindad@localhost:5432/lumindad"
    )
    DATABASE_URL_SYNC: Optional[str] = (
        "postgresql://lumindad:lumindad@localhost:5432/lumindad"
    )

    # SQLite for offline / local dev without Docker
    DATABASE_SQLITE_URL: str = "sqlite+aiosqlite:///./lumindad_dev.db"

    DB_ECHO: bool     = False    # SQL query logging — verbose in DEBUG only
    DB_POOL_SIZE: int = 5
    DB_MAX_OVERFLOW: int = 10
    DB_POOL_TIMEOUT: int = 30    # seconds
    DB_POOL_RECYCLE: int = 3600  # recycle connections every hour

    # ══════════════════════════════════════════════════════════
    # REDIS 7.2 — cache + Celery broker + WebSocket pub/sub
    # ══════════════════════════════════════════════════════════

    REDIS_URL: str       = "redis://localhost:6379/0"
    REDIS_CACHE_DB: int  = 0    # DB 0 — API response cache
    REDIS_CELERY_DB: int = 1    # DB 1 — Celery task queue
    REDIS_WS_DB: int     = 2    # DB 2 — WebSocket pub/sub

    # TTL presets (seconds) — mirror frontend offlineCache.ts
    CACHE_TTL_CAMPAIGNS: int  = 300      #  5 min
    CACHE_TTL_ANALYTICS: int  = 600      # 10 min
    CACHE_TTL_BUDGET: int     = 300      #  5 min
    CACHE_TTL_ML_MODELS: int  = 1800     # 30 min
    CACHE_TTL_UPLOAD: int     = 86400    # 24 h
    CACHE_TTL_SIX_HOURS: int  = 21600    #  6 h

    # ══════════════════════════════════════════════════════════
    # SECURITY — JWT
    # ══════════════════════════════════════════════════════════

    # MUST be overridden in production (min 32 chars, high entropy)
    JWT_SECRET_KEY: str = "CHANGE-ME-IN-PRODUCTION-use-secrets-token-hex-32"
    JWT_ALGORITHM: str  = "HS256"

    # Token lifetimes — mirror frontend services/api.ts
    ACCESS_TOKEN_EXPIRE_MINUTES: int  = 60        # 1 hour
    REFRESH_TOKEN_EXPIRE_DAYS: int    = 7         # 7 days

    # BCrypt cost factor — 12 is OWASP recommended minimum
    BCRYPT_ROUNDS: int = 12

    # ══════════════════════════════════════════════════════════
    # RATE LIMITING — slowapi
    # ══════════════════════════════════════════════════════════

    RATE_LIMIT_ENABLED: bool  = True
    RATE_LIMIT_DEFAULT: str   = "200/minute"
    RATE_LIMIT_UPLOAD: str    = "10/minute"    # stricter for upload endpoints
    RATE_LIMIT_AUTH: str      = "20/minute"
    RATE_LIMIT_ML: str        = "60/minute"

    # ══════════════════════════════════════════════════════════
    # FILE UPLOAD — mirrors frontend fileValidation.ts exactly
    # ══════════════════════════════════════════════════════════

    UPLOAD_DIR: str   = str(_ROOT / "uploads")   # default: backend/uploads/
    TEMP_DIR: str     = str(_ROOT / "tmp")        # default: backend/tmp/
    MAX_UPLOAD_FILES: int = 10                    # MAX_FILES = 10

    # 2 GB per file — matches frontend MAX_FILE_SIZE_BYTES
    MAX_FILE_SIZE_BYTES: int = 2 * 1024 * 1024 * 1024   # 2 GB

    # Chunked upload — 5 MB chunks (matches uploadService.ts chunkSize)
    UPLOAD_CHUNK_SIZE: int = 5 * 1024 * 1024   # 5 MB

    # Session TTL for in-flight chunked uploads
    UPLOAD_SESSION_TTL_SECONDS: int = 86400     # 24 hours

    # 10 accepted formats — mirrors frontend fileValidation.ts whitelist
    ACCEPTED_EXTENSIONS: List[str] = [
        ".csv", ".xlsx", ".xls", ".json", ".pdf",
        ".xml", ".tsv", ".txt", ".parquet", ".avro", ".jsonl",
    ]
    ACCEPTED_MIME_TYPES: List[str] = [
        "text/csv", "text/plain", "text/tab-separated-values",
        "application/json", "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/pdf", "text/xml", "application/xml",
        "application/octet-stream",
    ]

    # ══════════════════════════════════════════════════════════
    # DATA PROCESSING — mirrors workers/chunkProcessor.worker.ts
    # ══════════════════════════════════════════════════════════

    CHUNK_SIZE_ROWS: int    = 50_000     # CHUNK_ROWS in frontend workers
    MAX_ROWS: int           = 10_000_000 # 10M row limit

    # ══════════════════════════════════════════════════════════
    # CELERY — async task queue
    # ══════════════════════════════════════════════════════════

    CELERY_BROKER_URL: str  = "redis://localhost:6379/1"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/1"
    CELERY_TASK_SERIALIZER: str = "json"
    CELERY_RESULT_SERIALIZER: str = "json"
    CELERY_ACCEPT_CONTENT: List[str] = ["json"]
    CELERY_TASK_SOFT_TIME_LIMIT: int = 3600    # 1 hour
    CELERY_TASK_TIME_LIMIT: int      = 7200    # 2 hours hard limit

    # ══════════════════════════════════════════════════════════
    # MACHINE LEARNING
    # ══════════════════════════════════════════════════════════

    ML_MODELS_DIR: str = str(_ROOT / "models")
    ML_CONFIDENCE_THRESHOLD: float = 0.70

    # Model versions (LumindAd.jsx lines 630–635)
    ML_CHURN_VERSION: str        = "xgboost-v2.3.1"     # 87.3% accuracy
    ML_ANOMALY_VERSION: str      = "iforest-v1.4.0"     # 94.1% accuracy
    ML_CLICK_VERSION: str        = "mlp-v3.1.0"         # 82.7% accuracy
    ML_ROAS_VERSION: str         = "automl-v1.8.2"      # 91.2% accuracy

    # SHAP configuration
    SHAP_TOP_N_FEATURES: int = 15     # return top 15 SHAP values
    SHAP_MAX_SAMPLES: int    = 1000   # subsample for SHAP computation

    # ══════════════════════════════════════════════════════════
    # GREEN AI — GHG Scope 2 carbon tracking
    # Mirrors frontend greenAITracker.ts constants exactly
    # Source: TelecomX_Parte2_Enterprise_v2.ipynb Cell 32
    # ══════════════════════════════════════════════════════════

    GREEN_AI_ENABLED: bool = True

    # Hardware
    CPU_POWER_W: float = 95.0             # Intel Xeon baseline
    GPU_POWER_W: float = 250.0            # NVIDIA T4

    # Data centre
    PUE: float = 1.57                     # Uptime Institute global avg

    # Emissions
    CARBON_INTENSITY_KG_KWH: float = 0.475  # IEA 2023 global average

    # ══════════════════════════════════════════════════════════
    # WEBSOCKET — real-time KPI stream
    # ══════════════════════════════════════════════════════════

    WS_PING_INTERVAL: int   = 20    # seconds between pings
    WS_PING_TIMEOUT: int    = 10
    WS_MAX_CONNECTIONS: int = 200   # per Uvicorn worker

    # ══════════════════════════════════════════════════════════
    # SERVER-SENT EVENTS (SSE) — upload progress
    # ══════════════════════════════════════════════════════════

    SSE_KEEPALIVE_INTERVAL: int = 15    # seconds

    # ══════════════════════════════════════════════════════════
    # EXTERNAL SERVICES — Power BI / Tableau / S3
    # ══════════════════════════════════════════════════════════

    # Microsoft Power BI
    POWERBI_CLIENT_ID: Optional[str]     = None
    POWERBI_CLIENT_SECRET: Optional[str] = None
    POWERBI_TENANT_ID: Optional[str]     = None
    POWERBI_WORKSPACE_ID: Optional[str]  = None

    # Tableau
    TABLEAU_SERVER_URL: Optional[str]    = None
    TABLEAU_SITE_ID: Optional[str]       = None
    TABLEAU_PAT_NAME: Optional[str]      = None   # Personal Access Token name
    TABLEAU_PAT_VALUE: Optional[str]     = None

    # AWS S3 — file storage for uploads in production
    AWS_ACCESS_KEY_ID: Optional[str]     = None
    AWS_SECRET_ACCESS_KEY: Optional[str] = None
    AWS_REGION: str                      = "us-east-1"
    AWS_S3_BUCKET: Optional[str]         = None
    AWS_S3_PRESIGNED_URL_TTL: int        = 3600   # 1 hour

    # ══════════════════════════════════════════════════════════
    # MONITORING
    # ══════════════════════════════════════════════════════════

    SENTRY_DSN: Optional[str] = None
    SENTRY_ENVIRONMENT: Optional[str] = None
    SENTRY_TRACES_SAMPLE_RATE: float  = 0.1

    # ══════════════════════════════════════════════════════════
    # COMPUTED PROPERTIES
    # ══════════════════════════════════════════════════════════

    @property
    def is_development(self) -> bool:
        return self.ENVIRONMENT.lower() in ("development", "dev", "local")

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT.lower() in ("production", "prod")

    @property
    def is_staging(self) -> bool:
        return self.ENVIRONMENT.lower() in ("staging", "stage")

    @property
    def effective_database_url(self) -> str:
        """Return the async database URL in use."""
        if self.DATABASE_URL:
            return self.DATABASE_URL
        # Fallback to SQLite for zero-config local dev
        return self.DATABASE_SQLITE_URL

    @property
    def db_echo_effective(self) -> bool:
        """Only echo SQL in development."""
        return self.DB_ECHO and self.is_development

    @property
    def powerbi_configured(self) -> bool:
        return bool(self.POWERBI_CLIENT_ID and self.POWERBI_CLIENT_SECRET)

    @property
    def tableau_configured(self) -> bool:
        return bool(self.TABLEAU_SERVER_URL and self.TABLEAU_PAT_NAME)

    @property
    def s3_configured(self) -> bool:
        return bool(self.AWS_S3_BUCKET and self.AWS_ACCESS_KEY_ID)

    # ══════════════════════════════════════════════════════════
    # STARTUP VALIDATION
    # ══════════════════════════════════════════════════════════

    @model_validator(mode="after")
    def validate_production_secrets(self) -> "Settings":
        """
        Fail fast in production if default secrets are still set.
        This prevents accidental deploys with insecure defaults.
        """
        if self.is_production:
            if "CHANGE-ME" in self.JWT_SECRET_KEY:
                raise ValueError(
                    "JWT_SECRET_KEY must be set to a strong random secret "
                    "in production. Use: python -c \"import secrets; "
                    "print(secrets.token_hex(32))\""
                )
        return self

    def ensure_directories(self) -> None:
        """Create upload and temp directories if they don't exist."""
        for d in (self.UPLOAD_DIR, self.TEMP_DIR, self.ML_MODELS_DIR):
            Path(d).mkdir(parents=True, exist_ok=True)

    def display(self) -> None:
        """Print non-sensitive configuration for startup log."""
        print("═" * 64)
        print(f"  🚀  {self.APP_NAME} v{self.APP_VERSION}")
        print(f"  👤  {self.APP_AUTHOR}")
        print("═" * 64)
        print(f"  ENV   : {self.ENVIRONMENT}")
        print(f"  DEBUG : {self.DEBUG}")
        print(f"  DB    : {'PostgreSQL' if 'postgresql' in (self.DATABASE_URL or '') else 'SQLite (dev)'}")
        print(f"  REDIS : {self.REDIS_URL.split('@')[-1]}")  # hide password
        print(f"  CORS  : {len(self.CORS_ORIGINS)} origins")
        print(f"  UPLOAD: {self.MAX_UPLOAD_FILES} files · "
              f"{self.MAX_FILE_SIZE_BYTES // (1024**3)} GB max")
        print(f"  ML    : {self.ML_MODELS_DIR}")
        print(f"  GreenAI: {'enabled' if self.GREEN_AI_ENABLED else 'disabled'}")
        print(f"  PowerBI: {'configured' if self.powerbi_configured else 'not configured'}")
        print(f"  Tableau: {'configured' if self.tableau_configured else 'not configured'}")
        print("═" * 64)


# ═══════════════════════════════════════════════════════════════
# SINGLETON — cached instance
# ═══════════════════════════════════════════════════════════════

@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """
    Return the cached Settings singleton.

    Using @lru_cache ensures the .env file is read exactly once.
    Call this from anywhere via:
        from app.config import settings

    Or use as a FastAPI dependency:
        from app.config import get_settings
        @router.get('/config')
        async def show(s: Settings = Depends(get_settings)):
            ...
    """
    return Settings()


# Module-level access — preferred import style
settings: Settings = get_settings()
