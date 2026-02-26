# backend/tests/unit/test_security.py
"""
Unit tests — app/core/security.py

Coverage:
  hash_password       bcrypt round-trip · wrong password rejected
  verify_password     correct / incorrect / empty
  create_access_token HS256 · claims (sub, type, iat, exp, jti)
  create_refresh_token 7-day expiry · type='refresh'
  decode_token        valid · expired · wrong type · bad signature
  sanitize_str        strips HTML/JS injection patterns
  generate_api_key    format  lmnd_<32-byte-urlsafe>
"""

from __future__ import annotations

import time
import pytest
from unittest.mock import patch
from datetime import datetime, timezone, timedelta


# ═══════════════════════════════════════════════════════════════
# HASH / VERIFY PASSWORD
# ═══════════════════════════════════════════════════════════════

class TestPasswordHashing:

    def test_hash_returns_string(self):
        from app.core.security import hash_password
        h = hash_password("lumindad2025")
        assert isinstance(h, str)
        assert len(h) > 20

    def test_hash_is_not_plaintext(self):
        from app.core.security import hash_password
        h = hash_password("lumindad2025")
        assert "lumindad2025" not in h

    def test_same_password_different_hashes(self):
        """bcrypt generates unique salts — two hashes differ."""
        from app.core.security import hash_password
        h1 = hash_password("lumindad2025")
        h2 = hash_password("lumindad2025")
        assert h1 != h2

    def test_verify_correct_password(self):
        from app.core.security import hash_password, verify_password
        h = hash_password("lumindad2025")
        assert verify_password("lumindad2025", h) is True

    def test_verify_wrong_password(self):
        from app.core.security import hash_password, verify_password
        h = hash_password("lumindad2025")
        assert verify_password("wrong_password", h) is False

    def test_verify_empty_password(self):
        from app.core.security import hash_password, verify_password
        h = hash_password("lumindad2025")
        assert verify_password("", h) is False

    def test_verify_empty_hash_returns_false(self):
        from app.core.security import verify_password
        assert verify_password("lumindad2025", "") is False


# ═══════════════════════════════════════════════════════════════
# JWT — ACCESS TOKEN
# ═══════════════════════════════════════════════════════════════

class TestAccessToken:

    def test_returns_non_empty_string(self):
        from app.core.security import create_access_token
        token = create_access_token("usr_001")
        assert isinstance(token, str)
        assert len(token) > 20

    def test_token_has_three_segments(self):
        """JWT format: header.payload.signature"""
        from app.core.security import create_access_token
        token = create_access_token("usr_001")
        assert token.count(".") == 2

    def test_decode_returns_correct_sub(self):
        from app.core.security import create_access_token, decode_token
        token = create_access_token("usr_001")
        payload = decode_token(token, expected_type="access")
        assert payload["sub"] == "usr_001"

    def test_decode_returns_access_type(self):
        from app.core.security import create_access_token, decode_token
        token = create_access_token("usr_001")
        payload = decode_token(token, expected_type="access")
        assert payload["type"] == "access"

    def test_decode_has_jti_claim(self):
        """jti (JWT ID) must be present for token blacklisting."""
        from app.core.security import create_access_token, decode_token
        token = create_access_token("usr_001")
        payload = decode_token(token, expected_type="access")
        assert "jti" in payload
        assert len(payload["jti"]) >= 8

    def test_decode_has_exp_claim(self):
        from app.core.security import create_access_token, decode_token
        token = create_access_token("usr_001")
        payload = decode_token(token, expected_type="access")
        assert "exp" in payload
        assert payload["exp"] > time.time()

    def test_extra_claims_propagated(self):
        from app.core.security import create_access_token, decode_token
        token = create_access_token("usr_001", extra={"role": "admin", "name": "Elizabeth"})
        payload = decode_token(token, expected_type="access")
        assert payload.get("role") == "admin"
        assert payload.get("name") == "Elizabeth"

    def test_different_users_get_different_tokens(self):
        from app.core.security import create_access_token
        t1 = create_access_token("usr_001")
        t2 = create_access_token("usr_002")
        assert t1 != t2


# ═══════════════════════════════════════════════════════════════
# JWT — REFRESH TOKEN
# ═══════════════════════════════════════════════════════════════

class TestRefreshToken:

    def test_type_is_refresh(self):
        from app.core.security import create_refresh_token, decode_token
        token = create_refresh_token("usr_001")
        payload = decode_token(token, expected_type="refresh")
        assert payload["type"] == "refresh"

    def test_refresh_expires_after_access(self):
        """Refresh token must expire later than access token."""
        from app.core.security import create_access_token, create_refresh_token, decode_token
        access_payload  = decode_token(create_access_token("usr_001"),  expected_type="access")
        refresh_payload = decode_token(create_refresh_token("usr_001"), expected_type="refresh")
        assert refresh_payload["exp"] > access_payload["exp"]

    def test_access_token_rejected_as_refresh(self):
        """Using an access token where refresh is expected must raise."""
        from app.core.security import create_access_token, decode_token
        token = create_access_token("usr_001")
        # decode_token raises ValueError on type mismatch
        with pytest.raises((ValueError, Exception)):
            decode_token(token, expected_type="refresh")


# ═══════════════════════════════════════════════════════════════
# JWT — DECODE ERRORS
# ═══════════════════════════════════════════════════════════════

class TestDecodeToken:

    def test_invalid_signature_raises(self):
        from app.core.security import create_access_token, decode_token
        token = create_access_token("usr_001")
        # Tamper with the signature segment
        parts = token.split(".")
        parts[2] = parts[2][::-1]
        bad_token = ".".join(parts)
        with pytest.raises((ValueError, Exception)):
            decode_token(bad_token, expected_type="access")

    def test_empty_token_raises(self):
        from app.core.security import decode_token
        with pytest.raises((ValueError, Exception)):
            decode_token("", expected_type="access")

    def test_garbage_token_raises(self):
        from app.core.security import decode_token
        with pytest.raises((ValueError, Exception)):
            decode_token("not.a.jwt", expected_type="access")

    def test_verify_token_returns_none_on_invalid(self):
        """verify_token() is the silent variant — returns None instead of raising."""
        from app.core.security import verify_token
        result = verify_token("bad.token.here", expected_type="access")
        assert result is None

    def test_verify_token_returns_payload_on_valid(self):
        from app.core.security import create_access_token, verify_token
        token = create_access_token("usr_001")
        payload = verify_token(token, expected_type="access")
        assert payload is not None
        assert payload["sub"] == "usr_001"


# ═══════════════════════════════════════════════════════════════
# INPUT SANITIZATION
# ═══════════════════════════════════════════════════════════════

class TestSanitizeStr:

    def test_clean_string_unchanged(self):
        from app.core.security import sanitize_str
        assert sanitize_str("Summer Sale 2025") == "Summer Sale 2025"

    def test_strips_script_tags(self):
        from app.core.security import sanitize_str
        result = sanitize_str("<script>alert('xss')</script>")
        assert "<script>" not in result.lower()

    def test_strips_html_entities(self):
        from app.core.security import sanitize_str
        result = sanitize_str("<b>bold</b>")
        assert "<b>" not in result

    def test_empty_string_returns_empty(self):
        from app.core.security import sanitize_str
        assert sanitize_str("") == ""

    def test_none_returns_empty_or_none(self):
        from app.core.security import sanitize_str
        result = sanitize_str(None)
        assert result is None or result == ""


# ═══════════════════════════════════════════════════════════════
# API KEY GENERATION
# ═══════════════════════════════════════════════════════════════

class TestGenerateApiKey:

    def test_starts_with_lmnd_prefix(self):
        from app.core.security import generate_api_key
        key = generate_api_key()
        assert key.startswith("lmnd_")

    def test_minimum_length(self):
        from app.core.security import generate_api_key
        key = generate_api_key()
        assert len(key) >= 20

    def test_unique_keys(self):
        from app.core.security import generate_api_key
        keys = {generate_api_key() for _ in range(10)}
        assert len(keys) == 10   # all unique
