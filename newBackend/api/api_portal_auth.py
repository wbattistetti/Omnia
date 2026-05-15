"""
OAuth2/OIDC portal connections — start, callback, list, token resolution.
"""

from __future__ import annotations

import json
import logging
import secrets
import time
from typing import Any
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import HTMLResponse, JSONResponse
from pydantic import BaseModel, Field

from newBackend.portal_auth import oauth_google
from newBackend.portal_auth.oauth_pending import PendingOAuth, pop_pending, put_pending
from newBackend.portal_auth.origin import normalize_origin
from newBackend.portal_auth.pkce import code_challenge_s256, generate_code_verifier
from newBackend.portal_auth.portal_auth_service import (
    PortalAuthError,
    get_bearer_access_token,
    public_connection_view,
)
from newBackend.portal_auth.portal_connection_store import get_portal_connection_store
from newBackend.portal_auth.startup_policy import portal_oauth_relogin_on_start

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/api/auth/portal/config")
async def portal_auth_config() -> JSONResponse:
    return JSONResponse(
        {
            "reloginOnStart": portal_oauth_relogin_on_start(),
            "googleOAuthConfigured": oauth_google.google_oauth_configured(),
        }
    )


class PortalStartBody(BaseModel):
    project_id: str = Field(..., min_length=1)
    origin: str = Field(..., min_length=1, description="Portal base URL or any URL on the host")
    provider: str = Field(default="google_workspace")
    return_url: str = Field(default="/", description="Frontend path after OAuth (same origin as Vite)")


@router.post("/api/auth/portal/start")
async def portal_auth_start(body: PortalStartBody) -> JSONResponse:
    if body.provider != "google_workspace":
        raise HTTPException(status_code=400, detail="Solo google_workspace è supportato al momento.")
    if not oauth_google.google_oauth_configured():
        raise HTTPException(
            status_code=503,
            detail=(
                "OAuth Google non configurato. Imposta OMNIA_GOOGLE_OAUTH_CLIENT_ID e "
                "OMNIA_GOOGLE_OAUTH_CLIENT_SECRET sul backend Python."
            ),
        )
    try:
        origin_norm = normalize_origin(body.origin)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    store = get_portal_connection_store()
    rec = store.create_pending(
        project_id=body.project_id.strip(),
        origin=origin_norm,
        provider="google_workspace",
    )
    verifier = generate_code_verifier()
    state = secrets.token_urlsafe(32)
    put_pending(
        PendingOAuth(
            state=state,
            code_verifier=verifier,
            connection_id=rec.id,
            project_id=rec.project_id,
            origin=origin_norm,
            provider="google_workspace",
            return_url=(body.return_url or "/").strip() or "/",
            created_at=time.time(),
        )
    )
    auth_url = oauth_google.build_authorization_url(
        state=state,
        code_challenge=code_challenge_s256(verifier),
    )
    return JSONResponse(
        {
            "authUrl": auth_url,
            "connectionId": rec.id,
            "state": state,
            "origin": origin_norm,
        }
    )


@router.get("/api/auth/portal/callback")
async def portal_auth_callback(
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
) -> HTMLResponse:
    if error:
        return _callback_html(success=False, message=error, connection_id=None, return_url="/")
    if not code or not state:
        return _callback_html(
            success=False,
            message="Parametri OAuth mancanti (code/state).",
            connection_id=None,
            return_url="/",
        )
    pending = pop_pending(state)
    if not pending:
        return _callback_html(
            success=False,
            message="Sessione OAuth scaduta o non valida. Riprova.",
            connection_id=None,
            return_url="/",
        )
    store = get_portal_connection_store()
    try:
        tokens = await oauth_google.exchange_code_for_tokens(
            code=code,
            code_verifier=pending.code_verifier,
        )
    except Exception as e:
        logger.exception("[portal-auth] token exchange failed")
        return _callback_html(
            success=False,
            message=str(e),
            connection_id=pending.connection_id,
            return_url=pending.return_url,
        )

    access = str(tokens.get("access_token") or "")
    if not access:
        return _callback_html(
            success=False,
            message="Google non ha restituito access_token.",
            connection_id=pending.connection_id,
            return_url=pending.return_url,
        )

    try:
        store.save_tokens(
            pending.connection_id,
            access_token=access,
            refresh_token=tokens.get("refresh_token"),
            expires_in=int(tokens["expires_in"]) if tokens.get("expires_in") else None,
            id_token=tokens.get("id_token"),
        )
    except Exception as e:
        logger.exception("[portal-auth] save_tokens failed")
        return _callback_html(
            success=False,
            message=(
                f"Impossibile salvare i token: {e}. "
                "Verifica `pip install cryptography` e OMNIA_PORTAL_TOKEN_ENCRYPTION_KEY."
            ),
            connection_id=pending.connection_id,
            return_url=pending.return_url,
        )
    return _callback_html(
        success=True,
        message="Connesso",
        connection_id=pending.connection_id,
        return_url=pending.return_url,
        origin=pending.origin,
        project_id=pending.project_id,
    )


def _callback_html(
    *,
    success: bool,
    message: str,
    connection_id: str | None,
    return_url: str,
    origin: str | None = None,
    project_id: str | None = None,
) -> HTMLResponse:
    payload = {
        "type": "omnia-portal-oauth",
        "success": success,
        "message": message,
        "connectionId": connection_id,
        "returnUrl": return_url,
        "origin": origin,
        "projectId": project_id,
    }
    js_payload = json.dumps(payload)
    title = "Omnia — Portale connesso" if success else "Omnia — Connessione portale"
    html = f"""<!DOCTYPE html>
<html lang="it"><head><meta charset="utf-8"/><title>{title}</title></head>
<body style="font-family:system-ui;background:#0f172a;color:#e2e8f0;padding:2rem">
<p id="msg">{"Connessione riuscita. Puoi chiudere questa finestra." if success else "Errore: " + message}</p>
<script>
(function() {{
  var detail = {js_payload};
  try {{
    if (window.opener) window.opener.postMessage(detail, "*");
  }} catch (e) {{}}
  try {{
    var ru = detail.returnUrl || "/";
    if (window.location.origin && ru.indexOf("http") !== 0) {{
      window.location.href = window.location.origin.replace(/:8000$/, ":5173") + ru;
    }}
  }} catch (e2) {{}}
  setTimeout(function() {{ window.close(); }}, 800);
}})();
</script>
</body></html>"""
    return HTMLResponse(content=html)


@router.get("/api/auth/portal/connections")
async def list_portal_connections(
    project_id: str = Query(..., min_length=1),
) -> JSONResponse:
    store = get_portal_connection_store()
    rows = store.list_for_project(project_id.strip())
    return JSONResponse(
        {"connections": [public_connection_view(r) for r in rows if r.status != "pending"]}
    )


@router.delete("/api/auth/portal/connections/{connection_id}")
async def delete_portal_connection(connection_id: str) -> JSONResponse:
    store = get_portal_connection_store()
    ok = store.delete(connection_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Connessione non trovata.")
    return JSONResponse({"ok": True})


@router.get("/api/auth/portal/access-token")
async def portal_access_token(
    connection_id: str = Query(..., min_length=1),
) -> JSONResponse:
    """Bearer token for openapi-proxy / designer proxies (never log this response)."""
    try:
        token = await get_bearer_access_token(connection_id)
    except PortalAuthError as e:
        raise HTTPException(
            status_code=401,
            detail={"code": e.code, "message": e.message},
        ) from e
    return JSONResponse({"accessToken": token, "tokenType": "Bearer"})


@router.get("/api/auth/portal/resolve")
async def resolve_connection_for_origin(
    project_id: str = Query(..., min_length=1),
    origin: str = Query(..., min_length=1),
) -> JSONResponse:
    try:
        origin_norm = normalize_origin(origin)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    store = get_portal_connection_store()
    rec = store.find_by_origin(project_id.strip(), origin_norm)
    if not rec:
        return JSONResponse({"connection": None, "origin": origin_norm})
    return JSONResponse({"connection": public_connection_view(rec), "origin": origin_norm})
