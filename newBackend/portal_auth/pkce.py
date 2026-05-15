"""PKCE helpers (RFC 7636) for OAuth2 authorization code flow."""

from __future__ import annotations

import base64
import hashlib
import secrets


def generate_code_verifier() -> str:
    """43–128 character URL-safe verifier."""
    return secrets.token_urlsafe(64)[:96]


def code_challenge_s256(verifier: str) -> str:
    digest = hashlib.sha256(verifier.encode("ascii")).digest()
    return base64.urlsafe_b64encode(digest).rstrip(b"=").decode("ascii")
