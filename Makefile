# ══════════════════════════════════════════════════════════════════════════════
# Makefile — LumindAd Developer Shortcuts
# Ad Performance Intelligence Platform v1.0
# Author: Elizabeth Díaz Familia · AI Data Scientist · Sustainable Intelligence & BI
# ══════════════════════════════════════════════════════════════════════════════

.PHONY: help dev prod down clean test lint migrate build push logs

# ── Default target: show help ─────────────────────────────────────────────────
help:
	@echo ""
	@echo "  ✦ LumindAd v1.0 — Developer Commands"
	@echo "  ════════════════════════════════════════════════"
	@echo ""
	@echo "  🚀 DEVELOPMENT"
	@echo "  make dev              Start full local stack (HMR)"
	@echo "  make dev-frontend     Frontend only  (Vite :5173)"
	@echo "  make dev-backend      Backend only   (FastAPI :8000)"
	@echo "  make dev-ml           ML service     (:8001)"
	@echo ""
	@echo "  🐳 DOCKER"
	@echo "  make build            Build all Docker images"
	@echo "  make prod             Start production stack"
	@echo "  make down             Stop all containers"
	@echo "  make clean            Remove containers + volumes"
	@echo ""
	@echo "  🧪 TESTING"
	@echo "  make test             Run all tests (frontend + backend)"
	@echo "  make test-frontend    Vitest unit tests"
	@echo "  make test-backend     Pytest 252 tests"
	@echo "  make lint             Run all linters"
	@echo ""
	@echo "  🗄️  DATABASE"
	@echo "  make migrate          Run Alembic migrations"
	@echo "  make migrate-down     Rollback last migration"
	@echo "  make db-shell         psql shell into dev DB"
	@echo ""
	@echo "  📦 CI/CD"
	@echo "  make push             Build + push to AWS ECR"
	@echo "  make logs             Tail all container logs"
	@echo ""

# ─────────────────────────────────────────────────────────────────────────────
# DEVELOPMENT
# ─────────────────────────────────────────────────────────────────────────────
dev:
	@echo "🚀 Starting LumindAd local dev stack..."
	docker-compose up --build

dev-d:
	@echo "🚀 Starting LumindAd local dev stack (detached)..."
	docker-compose up --build -d

dev-frontend:
	@echo "⚡ Starting frontend — Vite HMR on :5173..."
	cd frontend && npm run dev

dev-backend:
	@echo "🔧 Starting backend — FastAPI on :8000..."
	cd backend && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

dev-ml:
	@echo "🤖 Starting ML inference service on :8001..."
	cd backend && uvicorn ml.inference.predictor:app --reload --host 0.0.0.0 --port 8001

dev-worker:
	@echo "⚙️  Starting Celery worker..."
	cd backend && celery -A app.workers.celery_app worker --loglevel=info --concurrency=2

# ─────────────────────────────────────────────────────────────────────────────
# DOCKER
# ─────────────────────────────────────────────────────────────────────────────
build:
	@echo "🐳 Building all Docker images..."
	docker-compose build --parallel

build-frontend:
	docker build -f infrastructure/docker/Dockerfile.frontend -t lumindad-frontend:dev .

build-backend:
	docker build -f infrastructure/docker/Dockerfile.backend -t lumindad-backend:dev .

build-ml:
	docker build -f infrastructure/docker/Dockerfile.ml -t lumindad-ml:dev .

prod:
	@echo "🏭 Starting production stack..."
	docker-compose -f docker-compose.prod.yml up -d

prod-pull:
	@echo "📥 Pulling latest prod images + restarting..."
	docker-compose -f docker-compose.prod.yml pull
	docker-compose -f docker-compose.prod.yml up -d

down:
	@echo "🛑 Stopping all containers..."
	docker-compose down

down-prod:
	docker-compose -f docker-compose.prod.yml down

clean:
	@echo "🧹 Removing containers, networks and volumes..."
	docker-compose down -v --remove-orphans
	docker system prune -f

# ─────────────────────────────────────────────────────────────────────────────
# TESTING
# ─────────────────────────────────────────────────────────────────────────────
test: test-frontend test-backend
	@echo "✅ All tests passed!"

test-frontend:
	@echo "🧪 Running frontend tests (Vitest)..."
	cd frontend && npm run test:run -- --reporter=verbose

test-frontend-watch:
	cd frontend && npm run test

test-backend:
	@echo "🧪 Running backend tests (Pytest)..."
	cd backend && pytest tests/ --asyncio-mode=auto --tb=short -q -v

test-backend-cov:
	@echo "🧪 Running backend tests with coverage..."
	cd backend && pytest tests/ --asyncio-mode=auto --cov=app --cov-report=html --cov-report=term -q

test-ml:
	@echo "🤖 Running ML pipeline tests..."
	cd backend && pytest tests/unit/test_ml_service.py tests/integration/test_ml_endpoints.py -v

# ─────────────────────────────────────────────────────────────────────────────
# LINTING
# ─────────────────────────────────────────────────────────────────────────────
lint: lint-frontend lint-backend
	@echo "✅ All linters passed!"

lint-frontend:
	@echo "🔍 Linting frontend (ESLint + TSC)..."
	cd frontend && npm run lint && npm run type-check

lint-backend:
	@echo "🔍 Linting backend (Ruff + Black + isort)..."
	cd backend && ruff check app/ && black --check app/ && isort --check-only app/

lint-fix:
	@echo "🔧 Auto-fixing lint issues..."
	cd frontend && npm run lint:fix
	cd backend && ruff check app/ --fix && black app/ && isort app/

# ─────────────────────────────────────────────────────────────────────────────
# DATABASE
# ─────────────────────────────────────────────────────────────────────────────
migrate:
	@echo "🗄️  Running Alembic migrations..."
	cd backend && alembic upgrade head

migrate-down:
	@echo "⏪ Rolling back last migration..."
	cd backend && alembic downgrade -1

migrate-history:
	cd backend && alembic history --verbose

migrate-create:
	@echo "Usage: make migrate-create MSG='your migration message'"
	cd backend && alembic revision --autogenerate -m "$(MSG)"

db-shell:
	@echo "🐘 Connecting to dev PostgreSQL..."
	docker-compose exec postgres psql -U lumindad -d lumindad

db-reset:
	@echo "⚠️  Resetting dev database..."
	docker-compose exec postgres psql -U lumindad -c "DROP DATABASE IF EXISTS lumindad;"
	docker-compose exec postgres psql -U lumindad -c "CREATE DATABASE lumindad;"
	cd backend && alembic upgrade head

# ─────────────────────────────────────────────────────────────────────────────
# DEPENDENCIES
# ─────────────────────────────────────────────────────────────────────────────
install:
	@echo "📦 Installing all dependencies..."
	cd frontend && npm ci
	cd backend && pip install -r requirements.txt

install-frontend:
	cd frontend && npm ci

install-backend:
	cd backend && pip install -r requirements.txt

update-deps:
	@echo "🔄 Updating dependencies..."
	cd frontend && npm update
	cd backend && pip install --upgrade -r requirements.txt

# ─────────────────────────────────────────────────────────────────────────────
# CI/CD — Build & Push to AWS ECR
# ─────────────────────────────────────────────────────────────────────────────
ecr-login:
	aws ecr get-login-password --region $(AWS_REGION) \
	  | docker login --username AWS --password-stdin $(AWS_ECR_REGISTRY)

push: ecr-login
	@echo "📤 Building and pushing images to AWS ECR..."
	$(MAKE) build
	docker tag lumindad-frontend:dev $(AWS_ECR_REGISTRY)/lumindad-frontend:$(IMAGE_TAG)
	docker tag lumindad-backend:dev  $(AWS_ECR_REGISTRY)/lumindad-backend:$(IMAGE_TAG)
	docker tag lumindad-ml:dev       $(AWS_ECR_REGISTRY)/lumindad-ml:$(IMAGE_TAG)
	docker push $(AWS_ECR_REGISTRY)/lumindad-frontend:$(IMAGE_TAG)
	docker push $(AWS_ECR_REGISTRY)/lumindad-backend:$(IMAGE_TAG)
	docker push $(AWS_ECR_REGISTRY)/lumindad-ml:$(IMAGE_TAG)
	@echo "✅ All images pushed: $(IMAGE_TAG)"

# ─────────────────────────────────────────────────────────────────────────────
# LOGS & MONITORING
# ─────────────────────────────────────────────────────────────────────────────
logs:
	docker-compose logs -f --tail=50

logs-backend:
	docker-compose logs -f backend --tail=100

logs-ml:
	docker-compose logs -f ml --tail=100

logs-worker:
	docker-compose logs -f worker --tail=100

flower:
	@echo "🌸 Celery Flower monitor: http://localhost:5555"
	docker-compose up flower -d

# ─────────────────────────────────────────────────────────────────────────────
# SETUP — First time
# ─────────────────────────────────────────────────────────────────────────────
setup:
	@echo "✦ LumindAd — First Time Setup"
	@echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
	cp -n .env.example .env && echo "✅ .env created — fill in your secrets" || echo "⚠️  .env already exists"
	$(MAKE) install
	$(MAKE) build
	$(MAKE) dev-d
	sleep 10
	$(MAKE) migrate
	@echo ""
	@echo "✅ LumindAd is ready!"
	@echo "   Frontend  : http://localhost:5173"
	@echo "   Backend   : http://localhost:8000"
	@echo "   API Docs  : http://localhost:8000/docs"
	@echo "   ML Service: http://localhost:8001"
	@echo "   Flower    : http://localhost:5555"
