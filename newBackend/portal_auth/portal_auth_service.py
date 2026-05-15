"""
Resolve valid Bearer tokens for a PortalConnection (refresh when expired).
"""

from __future__ import annotations

import logging
import time
from typing import Any

from . import oauth_google
from .portal_connection_store import PortalConnectionRecord, get_portal_connection_store

logger = logging.getLogger(__name__)


class PortalAuthError(Exception):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message


async def get_bearer_access_token(connection_id: str) -> str:
    """
    Return a valid access token for `connection_id`, refreshing via Google when needed.
    """
    store = get_portal_connection_store()
    rec = store.get(connection_id)
    if not rec:
        raise PortalAuthError("PORTAL_CONNECTION_NOT_FOUND", "Connessione portale non trovata.")
    if rec.status not in ("connected", "expired"):
        raise PortalAuthError(
            "PORTAL_AUTH_REQUIRED",
            "Portale non connesso. Esegui «Connetti al portale».",
        )

    blob = store.read_token_blob(connection_id)
    if not blob or not blob.get("access_token"):
        raise PortalAuthError(
            "PORTAL_AUTH_REQUIRED",
            "Token assente. Riconnetti il portale.",
        )

    access = str(blob["access_token"])
    expires_at = rec.token_expires_at
    now = time.time()
    if expires_at and now < expires_at:
        return access

    refresh = blob.get("refresh_token")
    if not refresh or rec.provider != "google_workspace":
        store.mark_expired(connection_id)
        raise PortalAuthError(
            "PORTAL_AUTH_EXPIRED",
            "Sessione scaduta. Riconnetti il portale.",
        )

    try:
        refreshed = await oauth_google.refresh_access_token(str(refresh))
    except Exception as e:
        logger.warning("[portal-auth] refresh failed connection=%s: %s", connection_id, e)
        store.mark_expired(connection_id)
        raise PortalAuthError(
            "PORTAL_AUTH_EXPIRED",
            "Impossibile rinnovare il token. Riconnetti il portale.",
        ) from e

    new_access = str(refreshed.get("access_token") or "")
    if not new_access:
        store.mark_expired(connection_id)
        raise PortalAuthError("PORTAL_AUTH_EXPIRED", "Risposta refresh senza access_token.")

    blob["access_token"] = new_access
    if refreshed.get("refresh_token"):
        blob["refresh_token"] = refreshed["refresh_token"]
    new_exp = oauth_google.token_expires_at_from_response(refreshed)
    store.write_token_blob(connection_id, blob, new_exp)
    return new_access


def public_connection_view(rec: PortalConnectionRecord) -> dict[str, Any]:
    return {
        "id": rec.id,
        "projectId": rec.project_id,
        "origin": rec.origin,
        "provider": rec.provider,
        "status": rec.status,
        "label": rec.label,
        "connectedAt": rec.updated_at if rec.status == "connected" else None,
    }
