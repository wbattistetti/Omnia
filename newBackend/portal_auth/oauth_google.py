"""
Google OAuth2 (OpenID Connect) — authorization + token endpoints.
"""

from __future__ import annotations

import os
import time
from typing import Any
from urllib.parse import urlencode

import httpx

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
DEFAULT_SCOPES = "openid email profile"


def google_oauth_configured() -> bool:
    return bool(_client_id() and _client_secret())


def _client_id() -> str:
    return (
        os.environ.get("OMNIA_GOOGLE_OAUTH_CLIENT_ID")
        or os.environ.get("GOOGLE_OAUTH_CLIENT_ID")
        or ""
    ).strip()


def _client_secret() -> str:
    return (
        os.environ.get("OMNIA_GOOGLE_OAUTH_CLIENT_SECRET")
        or os.environ.get("GOOGLE_OAUTH_CLIENT_SECRET")
        or ""
    ).strip()


def redirect_uri() -> str:
    return (
        os.environ.get("OMNIA_OAUTH_REDIRECT_URI")
        or "http://127.0.0.1:8000/api/auth/portal/callback"
    ).strip()


def build_authorization_url(
    *,
    state: str,
    code_challenge: str,
    scopes: str | None = None,
) -> str:
    params = {
        "client_id": _client_id(),
        "redirect_uri": redirect_uri(),
        "response_type": "code",
        "scope": scopes or DEFAULT_SCOPES,
        "state": state,
        "code_challenge": code_challenge,
        "code_challenge_method": "S256",
        "access_type": "offline",
        "prompt": "consent",
    }
    return f"{GOOGLE_AUTH_URL}?{urlencode(params)}"


async def exchange_code_for_tokens(
    *,
    code: str,
    code_verifier: str,
) -> dict[str, Any]:
    data = {
        "client_id": _client_id(),
        "client_secret": _client_secret(),
        "code": code,
        "code_verifier": code_verifier,
        "grant_type": "authorization_code",
        "redirect_uri": redirect_uri(),
    }
    async with httpx.AsyncClient(timeout=httpx.Timeout(30.0)) as client:
        r = await client.post(GOOGLE_TOKEN_URL, data=data)
        if r.status_code >= 400:
            detail = r.text[:500]
            raise RuntimeError(f"Google token exchange failed HTTP {r.status_code}: {detail}")
        body = r.json()
        if not isinstance(body, dict):
            raise RuntimeError("Google token response is not JSON object")
        return body


async def refresh_access_token(refresh_token: str) -> dict[str, Any]:
    data = {
        "client_id": _client_id(),
        "client_secret": _client_secret(),
        "refresh_token": refresh_token,
        "grant_type": "refresh_token",
    }
    async with httpx.AsyncClient(timeout=httpx.Timeout(30.0)) as client:
        r = await client.post(GOOGLE_TOKEN_URL, data=data)
        if r.status_code >= 400:
            detail = r.text[:500]
            raise RuntimeError(f"Google refresh failed HTTP {r.status_code}: {detail}")
        body = r.json()
        if not isinstance(body, dict):
            raise RuntimeError("Google refresh response is not JSON object")
        return body


def token_expires_at_from_response(body: dict[str, Any]) -> float | None:
    exp = body.get("expires_in")
    if isinstance(exp, (int, float)) and exp > 0:
        return time.time() + float(exp) - 30
    return None
