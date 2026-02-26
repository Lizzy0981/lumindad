# backend/tests/integration/test_auth_api.py
"""
Integration tests — /api/v1/auth/*

Endpoints covered:
  POST /api/v1/auth/login           200 · 401 bad creds · 422 validation
  POST /api/v1/auth/refresh         200 · 401 bad token
  POST /api/v1/auth/logout          200
  GET  /api/v1/auth/me              200 · 401 no token
  GET  /                            200 health root
  GET  /health                      200 minimal health probe

All tests use the shared `client` fixture from conftest.py.
get_current_user is overridden → auth headers bypass JWT validation.
"""

from __future__ import annotations

import pytest


BASE = "/api/v1/auth"


# ═══════════════════════════════════════════════════════════════
# HEALTH / ROOT
# ═══════════════════════════════════════════════════════════════

class TestHealthEndpoints:

    @pytest.mark.asyncio
    async def test_root_returns_200(self, client):
        resp = await client.get("/")
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_root_has_version(self, client):
        resp = await client.get("/")
        body = resp.json()
        assert "version" in body or "name" in body

    @pytest.mark.asyncio
    async def test_health_returns_200(self, client):
        resp = await client.get("/health")
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_health_body_has_status(self, client):
        resp = await client.get("/health")
        body = resp.json()
        assert "status" in body
        assert body["status"] in ("ok", "healthy", "up")


# ═══════════════════════════════════════════════════════════════
# LOGIN
# ═══════════════════════════════════════════════════════════════

class TestLogin:

    @pytest.mark.asyncio
    async def test_login_valid_credentials(self, client):
        resp = await client.post(
            f"{BASE}/login",
            json={"email": "admin@lumindad.ai", "password": "lumindad2025"},
        )
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_login_returns_access_token(self, client):
        resp = await client.post(
            f"{BASE}/login",
            json={"email": "admin@lumindad.ai", "password": "lumindad2025"},
        )
        body = resp.json()
        assert "accessToken" in body or "access_token" in body

    @pytest.mark.asyncio
    async def test_login_returns_refresh_token(self, client):
        resp = await client.post(
            f"{BASE}/login",
            json={"email": "admin@lumindad.ai", "password": "lumindad2025"},
        )
        body = resp.json()
        assert "refreshToken" in body or "refresh_token" in body

    @pytest.mark.asyncio
    async def test_login_token_is_string(self, client):
        resp = await client.post(
            f"{BASE}/login",
            json={"email": "admin@lumindad.ai", "password": "lumindad2025"},
        )
        body = resp.json()
        token = body.get("accessToken") or body.get("access_token", "")
        assert isinstance(token, str)
        assert len(token) > 20

    @pytest.mark.asyncio
    async def test_login_wrong_password_returns_401(self, client):
        resp = await client.post(
            f"{BASE}/login",
            json={"email": "admin@lumindad.ai", "password": "wrongpass"},
        )
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_login_unknown_email_returns_401(self, client):
        resp = await client.post(
            f"{BASE}/login",
            json={"email": "nobody@nowhere.com", "password": "anything"},
        )
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_login_missing_email_returns_422(self, client):
        resp = await client.post(
            f"{BASE}/login",
            json={"password": "lumindad2025"},
        )
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_login_missing_password_returns_422(self, client):
        resp = await client.post(
            f"{BASE}/login",
            json={"email": "admin@lumindad.ai"},
        )
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_login_response_has_user(self, client):
        resp = await client.post(
            f"{BASE}/login",
            json={"email": "admin@lumindad.ai", "password": "lumindad2025"},
        )
        body = resp.json()
        assert "user" in body
        assert body["user"]["email"] == "admin@lumindad.ai"

    @pytest.mark.asyncio
    async def test_login_demo_user(self, client):
        resp = await client.post(
            f"{BASE}/login",
            json={"email": "demo@lumindad.ai", "password": "lumindad2025"},
        )
        assert resp.status_code == 200


# ═══════════════════════════════════════════════════════════════
# GET /ME  (protected)
# ═══════════════════════════════════════════════════════════════

class TestGetMe:

    @pytest.mark.asyncio
    async def test_me_with_token_returns_200(self, client, auth_headers):
        resp = await client.get(f"{BASE}/me", headers=auth_headers)
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_me_returns_user_fields(self, client, auth_headers):
        resp = await client.get(f"{BASE}/me", headers=auth_headers)
        body = resp.json()
        for field in ("id", "email", "name", "role"):
            assert field in body

    @pytest.mark.asyncio
    async def test_me_no_token_returns_401(self, client, app):
        """Without the dependency override, real JWT validation fires → 401."""
        from app.dependencies import get_current_user
        # Temporarily remove override to test real auth
        override = app.dependency_overrides.pop(get_current_user, None)
        try:
            resp = await client.get(f"{BASE}/me")
            assert resp.status_code == 401
        finally:
            if override:
                app.dependency_overrides[get_current_user] = override

    @pytest.mark.asyncio
    async def test_me_bad_token_returns_401(self, client, app):
        from app.dependencies import get_current_user
        override = app.dependency_overrides.pop(get_current_user, None)
        try:
            resp = await client.get(
                f"{BASE}/me",
                headers={"Authorization": "Bearer not.a.real.token"},
            )
            assert resp.status_code == 401
        finally:
            if override:
                app.dependency_overrides[get_current_user] = override


# ═══════════════════════════════════════════════════════════════
# REFRESH
# ═══════════════════════════════════════════════════════════════

class TestRefreshToken:

    @pytest.mark.asyncio
    async def test_refresh_with_valid_token(self, client):
        # Get a real refresh token first
        login = await client.post(
            f"{BASE}/login",
            json={"email": "admin@lumindad.ai", "password": "lumindad2025"},
        )
        refresh_token = login.json().get("refreshToken") or login.json().get("refresh_token")
        if not refresh_token:
            pytest.skip("No refresh token in login response")

        resp = await client.post(
            f"{BASE}/refresh",
            json={"refreshToken": refresh_token},
        )
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_refresh_bad_token_returns_401(self, client):
        resp = await client.post(
            f"{BASE}/refresh",
            json={"refreshToken": "invalid.refresh.token"},
        )
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_refresh_access_token_as_refresh_returns_401(self, client, admin_token):
        """An access token must not be accepted as a refresh token."""
        resp = await client.post(
            f"{BASE}/refresh",
            json={"refreshToken": admin_token},
        )
        assert resp.status_code == 401


# ═══════════════════════════════════════════════════════════════
# LOGOUT
# ═══════════════════════════════════════════════════════════════

class TestLogout:

    @pytest.mark.asyncio
    async def test_logout_returns_204(self, client, auth_headers):
        resp = await client.post(f"{BASE}/logout", headers=auth_headers)
        assert resp.status_code == 204

    @pytest.mark.asyncio
    async def test_logout_no_body(self, client, auth_headers):
        """204 No Content → empty body."""
        resp = await client.post(f"{BASE}/logout", headers=auth_headers)
        assert resp.status_code == 204
        assert resp.content == b""
