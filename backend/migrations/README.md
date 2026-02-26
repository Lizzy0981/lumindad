# LumindAd · Database Migrations (Alembic)

## Quick Reference

```bash
# Run from backend/ directory

# Apply all pending migrations
alembic upgrade head

# Roll back one migration
alembic downgrade -1

# Roll back to a specific revision
alembic downgrade 20251101_0001

# Show current revision applied to the DB
alembic current

# Show full migration history
alembic history --verbose

# Generate a new migration from ORM model changes
alembic revision --autogenerate -m "add_campaign_tags"

# Preview SQL without applying (offline mode)
alembic upgrade head --sql

# Check for model vs. DB drift
alembic check
```

---

## Development Workflow

1. **Edit an ORM model** in `backend/app/models/`
2. **Generate a migration**:
   ```bash
   alembic revision --autogenerate -m "short_description"
   ```
3. **Review** the generated file in `migrations/versions/`  
   Always verify — autogenerate misses some operations (e.g. ENUM renames).
4. **Apply locally**:
   ```bash
   alembic upgrade head
   ```
5. **Commit** both the model change and the migration file together.

---

## File Naming

Files follow the pattern set in `alembic.ini`:

```
YYYYMMDD_HHMM_<revid>_<slug>.py
e.g.  20251118_1430_a3f9c21b8e01_add_campaign_tags.py
```

---

## Tables Tracked (10 total)

| Table | Description |
|---|---|
| `users` | Authentication, roles, API keys |
| `campaigns` | Ad campaigns (soft-delete) |
| `campaign_metrics` | Daily performance metrics per campaign |
| `budget_records` | Monthly budget records per user |
| `daily_budget_records` | Mon→Sun daily spend entries |
| `platform_allocations` | Budget split by platform (5 platforms) |
| `ai_budget_recommendations` | XGBoost reallocation suggestions |
| `upload_sessions` | Chunked upload session tokens |
| `upload_jobs` | Async processing job tracking |
| `ml_pipeline_export_records` | Telecom X ML pipeline export log |

---

## Naming Conventions

Constraint names follow `MetaData(naming_convention=…)` in `env.py`:

| Type | Pattern | Example |
|---|---|---|
| Index | `ix_<column_label>` | `ix_campaigns_user_id` |
| Unique | `uq_<table>_<column>` | `uq_users_email` |
| Check | `ck_<table>_<name>` | `ck_campaigns_budget_positive` |
| FK | `fk_<table>_<col>_<ref_table>` | `fk_campaigns_user_id_users` |
| PK | `pk_<table>` | `pk_campaigns` |

---

## Conflict Resolution

If two developers create migrations from the same `down_revision`:

```bash
# Show the branch heads
alembic heads

# Merge branches into a single head
alembic merge -m "merge_branch_a_and_b" <rev_a> <rev_b>
```

---

## Rollback Safety Rules

- **Never** drop a column in the same migration that removes it from the ORM.  
  Use two migrations: one to make nullable → one to drop.
- **Always** provide a working `downgrade()` function.
- **Test** `downgrade()` locally before merging to main.
- For destructive operations, add a `# DATA LOSS WARNING` comment.

---

## PostgreSQL ENUM Types

Alembic does not auto-detect ENUM renames. For enum changes:

```python
# upgrade()
op.execute("ALTER TYPE campaign_status ADD VALUE 'scheduled'")

# downgrade() — PostgreSQL cannot remove enum values without recreating
# Leave a comment explaining why downgrade is a no-op
```

---

## Environment Variables

| Variable | Description |
|---|---|
| `DATABASE_URL_SYNC` | psycopg2 URL for Alembic (overrides `alembic.ini`) |
| `DATABASE_URL` | asyncpg URL (converted to sync automatically) |

---

## Migrations Versions

| Revision | Date | Description |
|---|---|---|
| `a1b2c3d4e5f6` | 2025-11-18 | Initial schema — all 10 tables |
