"""
Shared OpenAPI fetch with optional portal Bearer auth.
"""

from __future__ import annotations

import json
import logging
from typing import Any

import httpx

from .portal_auth_service import PortalAuthError, get_bearer_access_token

logger = logging.getLogger(__name__)

MAX_BODY_BYTES = 6 * 1024 * 1024

_BASE_HEADERS = {
    "Accept": "application/json, */*",
    "User-Agent": "Omnia-OpenAPI-Proxy/1.0",
}


def _is_openapi_doc(data: Any) -> bool:
    return isinstance(data, dict) and ("openapi" in data or "swagger" in data)


def attempt_indicates_auth_required(reason: str, http_status: int | None) -> bool:
    """True se il tentativo suggerisce login SSO / credenziali mancanti."""
    if http_status in (401, 403):
        return True
    r = (reason or "").lower()
    return any(
        k in r
        for k in (
            "autenticazione",
            "authentication",
            "unauthorized",
            "forbidden",
            "login",
            "html",
            "sign in",
            "oauth",
        )
    )


async def probe_openapi_url(
    client: httpx.AsyncClient,
    url: str,
    extra_headers: dict[str, str] | None = None,
) -> tuple[dict[str, Any] | None, str, int | None]:
    headers = {**_BASE_HEADERS, **(extra_headers or {})}
    try:
        r = await client.get(url, headers=headers)
        status = r.status_code
        if status == 401 or status == 403:
            return None, f"HTTP {status} (autenticazione richiesta)", status
        if status >= 400:
            return None, f"HTTP {status}", status
        if len(r.content) > MAX_BODY_BYTES:
            return None, f"corpo > {MAX_BODY_BYTES // (1024 * 1024)} MiB", status
        ctype = (r.headers.get("content-type") or "").lower()
        if "text/html" in ctype and not r.content.strip().startswith(b"{"):
            return None, "risposta HTML (probabile login)", status
        data = r.json()
        if not isinstance(data, dict):
            return None, "JSON non oggetto", status
        if _is_openapi_doc(data):
            return data, "OK", status
        return None, "JSON senza openapi/swagger", status
    except json.JSONDecodeError:
        return None, "non è JSON valido (spesso HTML login)", None
    except httpx.TimeoutException:
        return None, "timeout", None
    except httpx.HTTPError as e:
        return None, f"errore rete: {e!s}", None
    except ValueError as e:
        return None, f"risposta non valida: {e!s}", None


async def build_auth_headers(connection_id: str | None) -> dict[str, str]:
    if not connection_id:
        return {}
    try:
        token = await get_bearer_access_token(connection_id.strip())
    except PortalAuthError:
        raise
    return {"Authorization": f"Bearer {token}"}
