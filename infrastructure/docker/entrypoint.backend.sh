#!/bin/bash
# ══════════════════════════════════════════════════════════════════════════════
# entrypoint.backend.sh
# LumindAd · Ad Performance Intelligence Platform v1.0
# Author: Elizabeth Díaz Familia · AI Data Scientist · Sustainable Intelligence & BI
#
# Modes:
#   api      → FastAPI via uvicorn (default)
#   worker   → Celery worker
#   beat     → Celery beat scheduler
#   migrate  → Alembic migrations only
# ══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

MODE="${1:-api}"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 LumindAd Backend — mode: ${MODE}"
echo "   APP_ENV  : ${APP_ENV:-production}"
echo "   LOG_LEVEL: ${LOG_LEVEL:-info}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ─── Wait for dependencies ─────────────────────────────────────────────────
wait_for_db() {
    echo "⏳ Waiting for database..."
    for i in $(seq 1 30); do
        python -c "
import asyncio, asyncpg, os, sys
async def check():
    try:
        url = os.environ.get('DATABASE_URL','').replace('postgresql+asyncpg','postgresql')
        conn = await asyncpg.connect(url)
        await conn.close()
        print('✅ Database ready')
    except Exception as e:
        print(f'   Attempt $i/30: {e}')
        sys.exit(1)
asyncio.run(check())
" && return 0
        sleep 2
    done
    echo "❌ Database not reachable after 30 attempts"
    exit 1
}

# ─── Run Alembic migrations ────────────────────────────────────────────────
run_migrations() {
    echo "📦 Running Alembic migrations..."
    alembic upgrade head
    echo "✅ Migrations complete"
}

# ══════════════════════════════════════════════════════════════════════════════
# MODE: api — FastAPI via uvicorn
# ══════════════════════════════════════════════════════════════════════════════
if [ "$MODE" = "api" ]; then
    wait_for_db
    run_migrations

    PORT="${API_PORT:-8000}"
    WORKERS="${WORKERS:-2}"

    echo "🌐 Starting FastAPI on port ${PORT} with ${WORKERS} workers..."
    exec uvicorn app.main:app \
        --host 0.0.0.0 \
        --port "${PORT}" \
        --workers "${WORKERS}" \
        --log-level "${LOG_LEVEL:-info}" \
        --no-access-log \
        --proxy-headers \
        --forwarded-allow-ips "*"

# ══════════════════════════════════════════════════════════════════════════════
# MODE: worker — Celery worker
# ══════════════════════════════════════════════════════════════════════════════
elif [ "$MODE" = "worker" ]; then
    wait_for_db

    CONCURRENCY="${CELERY_CONCURRENCY:-2}"
    echo "⚙️  Starting Celery worker (concurrency=${CONCURRENCY})..."
    exec celery -A app.core.celery_app worker \
        --loglevel="${LOG_LEVEL:-info}" \
        --concurrency="${CONCURRENCY}" \
        --queues=default,ml,export \
        --hostname="worker@%h"

# ══════════════════════════════════════════════════════════════════════════════
# MODE: beat — Celery beat scheduler
# ══════════════════════════════════════════════════════════════════════════════
elif [ "$MODE" = "beat" ]; then
    echo "⏰ Starting Celery beat scheduler..."
    exec celery -A app.core.celery_app beat \
        --loglevel="${LOG_LEVEL:-info}" \
        --scheduler django_celery_beat.schedulers:DatabaseScheduler

# ══════════════════════════════════════════════════════════════════════════════
# MODE: migrate — run migrations only then exit
# ══════════════════════════════════════════════════════════════════════════════
elif [ "$MODE" = "migrate" ]; then
    wait_for_db
    run_migrations
    echo "✅ Migration-only mode complete — exiting"
    exit 0

else
    echo "❌ Unknown mode: ${MODE}"
    echo "   Valid modes: api | worker | beat | migrate"
    exit 1
fi
