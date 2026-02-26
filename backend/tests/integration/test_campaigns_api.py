# backend/tests/integration/test_campaigns_api.py
"""
Integration tests — /api/v1/campaigns/*

Endpoints covered:
  GET    /api/v1/campaigns              list · pagination · filter
  GET    /api/v1/campaigns/summary      KPI dashboard values
  GET    /api/v1/campaigns/{id}         single campaign · 404
  POST   /api/v1/campaigns              create · 422 validation
  PATCH  /api/v1/campaigns/{id}         update · 422
  DELETE /api/v1/campaigns/{id}         soft delete · 404
  PATCH  /api/v1/campaigns/{id}/status  status transition
  GET    /api/v1/campaigns/{id}/performance  time-series

Seed assertions use exact LumindAd.jsx values (C-001 through C-006).
"""

from __future__ import annotations

import pytest

BASE = "/api/v1/campaigns"


# ═══════════════════════════════════════════════════════════════
# LIST CAMPAIGNS
# ═══════════════════════════════════════════════════════════════

class TestListCampaigns:

    @pytest.mark.asyncio
    async def test_returns_200(self, client, auth_headers):
        resp = await client.get(BASE, headers=auth_headers)
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_returns_list_of_campaigns(self, client, auth_headers):
        resp = await client.get(BASE, headers=auth_headers)
        body = resp.json()
        # Response is either a list or {"items": [...], "total": N}
        items = body if isinstance(body, list) else body.get("items", body.get("campaigns", []))
        assert isinstance(items, list)
        assert len(items) > 0

    @pytest.mark.asyncio
    async def test_returns_six_seed_campaigns(self, client, auth_headers):
        resp = await client.get(BASE, headers=auth_headers)
        body = resp.json()
        items = body if isinstance(body, list) else body.get("items", body.get("campaigns", []))
        total = len(items) if isinstance(body, list) else body.get("total", len(items))
        assert total == 6

    @pytest.mark.asyncio
    async def test_campaigns_have_required_fields(self, client, auth_headers):
        resp = await client.get(BASE, headers=auth_headers)
        body = resp.json()
        items = body if isinstance(body, list) else body.get("items", body.get("campaigns", []))
        for c in items:
            for field in ("id", "name", "platform", "status", "budget"):
                assert field in c, f"Missing field '{field}' in campaign {c.get('id')}"

    @pytest.mark.asyncio
    async def test_filter_by_active_status(self, client, auth_headers):
        resp = await client.get(f"{BASE}?status=active", headers=auth_headers)
        assert resp.status_code == 200
        body = resp.json()
        items = body if isinstance(body, list) else body.get("items", body.get("campaigns", []))
        assert all(c["status"] == "active" for c in items)

    @pytest.mark.asyncio
    async def test_filter_by_platform(self, client, auth_headers):
        resp = await client.get(f"{BASE}?platform=Google+Ads", headers=auth_headers)
        assert resp.status_code == 200
        body = resp.json()
        items = body if isinstance(body, list) else body.get("items", body.get("campaigns", []))
        assert all(c["platform"] == "Google Ads" for c in items)

    @pytest.mark.asyncio
    async def test_pagination_page_size(self, client, auth_headers):
        resp = await client.get(f"{BASE}?page=1&page_size=2", headers=auth_headers)
        assert resp.status_code == 200
        body = resp.json()
        items = body if isinstance(body, list) else body.get("items", body.get("campaigns", []))
        assert len(items) <= 2

    @pytest.mark.asyncio
    async def test_no_token_returns_401(self, client, app):
        from app.dependencies import get_current_user
        override = app.dependency_overrides.pop(get_current_user, None)
        try:
            resp = await client.get(BASE)
            assert resp.status_code == 401
        finally:
            if override:
                app.dependency_overrides[get_current_user] = override


# ═══════════════════════════════════════════════════════════════
# CAMPAIGN SUMMARY / KPIs
# ═══════════════════════════════════════════════════════════════

class TestCampaignSummary:

    @pytest.mark.asyncio
    async def test_returns_200(self, client, auth_headers):
        resp = await client.get(f"{BASE}/summary", headers=auth_headers)
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_total_spend_seed_value(self, client, auth_headers):
        """totalSpend = sum of all campaign 'spent' in _SEED = 16,248."""
        resp = await client.get(f"{BASE}/summary", headers=auth_headers)
        body = resp.json()
        spend = body.get("totalSpend") or body.get("total_spend", 0)
        assert abs(spend - 16_248.0) < 10.0, f"Expected ~16248, got {spend}"

    @pytest.mark.asyncio
    async def test_total_impressions_seed_value(self, client, auth_headers):
        """totalImpressions = sum of all impressions in _SEED = 730,800."""
        resp = await client.get(f"{BASE}/summary", headers=auth_headers)
        body = resp.json()
        imps = body.get("totalImpressions") or body.get("total_impressions", 0)
        assert imps == 730_800

    @pytest.mark.asyncio
    async def test_active_campaigns_count(self, client, auth_headers):
        """activeCampaigns = 3 (C-001, C-002, C-004 are active in _SEED)."""
        resp = await client.get(f"{BASE}/summary", headers=auth_headers)
        body = resp.json()
        active = body.get("activeCampaigns") or body.get("active_campaigns", 0)
        assert active == 3

    @pytest.mark.asyncio
    async def test_avg_roas_seed_value(self, client, auth_headers):
        """avgROAS from /campaigns/summary = 3.9 (simple average of active campaign ROAS)."""
        resp = await client.get(f"{BASE}/summary", headers=auth_headers)
        body = resp.json()
        roas = body.get("avgROAS") or body.get("avg_roas", 0)
        assert abs(roas - 3.9) < 0.2, f"Expected ~3.9, got {roas}"

    @pytest.mark.asyncio
    async def test_summary_has_required_fields(self, client, auth_headers):
        resp = await client.get(f"{BASE}/summary", headers=auth_headers)
        body = resp.json()
        expected = {"totalSpend", "totalImpressions", "activeCampaigns", "avgROAS"}
        # accept camelCase or snake_case
        keys_lower = {k.lower().replace("_", "") for k in body.keys()}
        for field in expected:
            assert field.lower() in keys_lower, f"Missing field: {field}"


# ═══════════════════════════════════════════════════════════════
# GET SINGLE CAMPAIGN
# ═══════════════════════════════════════════════════════════════

class TestGetCampaign:

    @pytest.mark.asyncio
    async def test_get_c001_returns_200(self, client, auth_headers):
        resp = await client.get(f"{BASE}/C-001", headers=auth_headers)
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_get_c001_name(self, client, auth_headers):
        resp = await client.get(f"{BASE}/C-001", headers=auth_headers)
        body = resp.json()
        assert body["name"] == "Summer Sale 2025"

    @pytest.mark.asyncio
    async def test_get_c001_platform(self, client, auth_headers):
        resp = await client.get(f"{BASE}/C-001", headers=auth_headers)
        body = resp.json()
        assert body["platform"] == "Google Ads"

    @pytest.mark.asyncio
    async def test_get_c001_roas(self, client, auth_headers):
        resp = await client.get(f"{BASE}/C-001", headers=auth_headers)
        body = resp.json()
        assert abs(body["roas"] - 3.8) < 0.1

    @pytest.mark.asyncio
    async def test_get_nonexistent_returns_404(self, client, auth_headers):
        resp = await client.get(f"{BASE}/C-999", headers=auth_headers)
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_get_draft_campaign_c005(self, client, auth_headers):
        resp = await client.get(f"{BASE}/C-005", headers=auth_headers)
        body = resp.json()
        assert body["status"] == "draft"
        assert body["platform"] == "LinkedIn"


# ═══════════════════════════════════════════════════════════════
# PERFORMANCE TIME-SERIES
# ═══════════════════════════════════════════════════════════════

class TestCampaignPerformance:

    @pytest.mark.asyncio
    async def test_returns_200(self, client, auth_headers):
        resp = await client.get(f"{BASE}/C-001/performance", headers=auth_headers)
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_has_dates_array(self, client, auth_headers):
        resp = await client.get(f"{BASE}/C-001/performance", headers=auth_headers)
        body = resp.json()
        assert "dates" in body or "labels" in body

    @pytest.mark.asyncio
    async def test_has_spend_series(self, client, auth_headers):
        resp = await client.get(f"{BASE}/C-001/performance", headers=auth_headers)
        body = resp.json()
        assert "spend" in body or "spendSeries" in body

    @pytest.mark.asyncio
    async def test_period_7d_by_default(self, client, auth_headers):
        resp = await client.get(f"{BASE}/C-001/performance?period=7d", headers=auth_headers)
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_nonexistent_campaign_returns_404(self, client, auth_headers):
        resp = await client.get(f"{BASE}/C-999/performance", headers=auth_headers)
        assert resp.status_code == 404


# ═══════════════════════════════════════════════════════════════
# CREATE CAMPAIGN
# ═══════════════════════════════════════════════════════════════

class TestCreateCampaign:

    @pytest.mark.asyncio
    async def test_create_returns_200_or_201(self, client, auth_headers):
        payload = {
            "name":     "Test Campaign Integration",
            "platform": "Google Ads",
            "budget":   1000.0,
        }
        resp = await client.post(BASE, json=payload, headers=auth_headers)
        assert resp.status_code in (200, 201)

    @pytest.mark.asyncio
    async def test_create_returns_campaign_with_id(self, client, auth_headers):
        payload = {
            "name":     "Test Campaign ID Check",
            "platform": "Meta Ads",
            "budget":   500.0,
        }
        resp = await client.post(BASE, json=payload, headers=auth_headers)
        body = resp.json()
        assert "id" in body

    @pytest.mark.asyncio
    async def test_create_missing_name_returns_422(self, client, auth_headers):
        resp = await client.post(
            BASE,
            json={"platform": "TikTok", "budget": 200.0},
            headers=auth_headers,
        )
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_create_missing_platform_returns_422(self, client, auth_headers):
        resp = await client.post(
            BASE,
            json={"name": "No Platform", "budget": 200.0},
            headers=auth_headers,
        )
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_create_negative_budget_returns_422(self, client, auth_headers):
        resp = await client.post(
            BASE,
            json={"name": "Negative Budget", "platform": "Google Ads", "budget": -100.0},
            headers=auth_headers,
        )
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_create_invalid_platform_returns_422(self, client, auth_headers):
        resp = await client.post(
            BASE,
            json={"name": "Bad Platform", "platform": "FakePlatform", "budget": 500.0},
            headers=auth_headers,
        )
        assert resp.status_code == 422


# ═══════════════════════════════════════════════════════════════
# UPDATE CAMPAIGN
# ═══════════════════════════════════════════════════════════════

class TestUpdateCampaign:

    @pytest.mark.asyncio
    async def test_patch_returns_200(self, client, auth_headers):
        resp = await client.patch(
            f"{BASE}/C-001",
            json={"budget": 6000.0},
            headers=auth_headers,
        )
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_patch_nonexistent_returns_404(self, client, auth_headers):
        resp = await client.patch(
            f"{BASE}/C-999",
            json={"budget": 1000.0},
            headers=auth_headers,
        )
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_patch_invalid_budget_returns_422(self, client, auth_headers):
        resp = await client.patch(
            f"{BASE}/C-001",
            json={"budget": -500.0},
            headers=auth_headers,
        )
        assert resp.status_code == 422


# ═══════════════════════════════════════════════════════════════
# STATUS UPDATE
# ═══════════════════════════════════════════════════════════════

class TestStatusUpdate:

    @pytest.mark.asyncio
    async def test_pause_active_campaign(self, client, auth_headers):
        resp = await client.patch(
            f"{BASE}/C-001/status",
            json={"status": "paused"},
            headers=auth_headers,
        )
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_invalid_status_returns_422(self, client, auth_headers):
        resp = await client.patch(
            f"{BASE}/C-001/status",
            json={"status": "flying"},
            headers=auth_headers,
        )
        assert resp.status_code == 422


# ═══════════════════════════════════════════════════════════════
# DELETE CAMPAIGN
# ═══════════════════════════════════════════════════════════════

class TestDeleteCampaign:

    @pytest.mark.asyncio
    async def test_delete_returns_200_or_204(self, client, auth_headers):
        resp = await client.delete(f"{BASE}/C-006", headers=auth_headers)
        assert resp.status_code in (200, 204)

    @pytest.mark.asyncio
    async def test_delete_nonexistent_returns_404(self, client, auth_headers):
        resp = await client.delete(f"{BASE}/C-999", headers=auth_headers)
        assert resp.status_code == 404
