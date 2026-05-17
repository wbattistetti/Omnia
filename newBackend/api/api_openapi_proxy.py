"""
Server-side fetch for OpenAPI/Swagger JSON so the browser avoids CORS when using Read API.
Optional `connection_id` adds Bearer token from a PortalConnection (OAuth).
"""

from __future__ import annotations

import logging
from typing import Any
from urllib.parse import parse_qs, unquote, urlparse

import httpx
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import JSONResponse

from newBackend.portal_auth.openapi_fetch import (
    attempt_indicates_auth_required,
    build_auth_headers,
    probe_openapi_url,
)
from newBackend.portal_auth.origin import normalize_origin
from newBackend.portal_auth.portal_auth_service import PortalAuthError

logger = logging.getLogger(__name__)

router = APIRouter()

SPEC_CANDIDATE_PATHS = (
    "/swagger.json",
    "/openapi.json",
    "/v3/api-docs",
    "/api/v3/api-docs",
    "/api-docs",
    "/api/swagger.json",
    "/swagger/v1/swagger.json",
    "/swagger-ui/swagger.json",
    "/doc/swagger.json",
    # n8n / workflow portals (comuni in installazioni self-hosted)
    "/api/v1/openapi.json",
    "/api/v1/docs",
    "/rest/openapi.json",
)


def _is_openapi_doc(data: Any) -> bool:
    return isinstance(data, dict) and ("openapi" in data or "swagger" in data)


def _pathname_prefixes(pathname: str) -> list[str]:
    if not pathname or pathname == "/":
        return []
    parts = [p for p in pathname.split("/") if p]
    if not parts:
        return []
    out: list[str] = []
    for i in range(len(parts), 0, -1):
        out.append("/" + "/".join(parts[:i]))
    return out


def _join_origin_spec(origin: str, path_prefix: str, spec_suffix: str) -> str:
    p = path_prefix.rstrip("/") if path_prefix else ""
    return f"{origin}{p}{spec_suffix}"


def _nested_spec_urls_from_query(parsed) -> list[str]:
    if not parsed.query:
        return []
    qs = parse_qs(parsed.query, keep_blank_values=False)
    key_ok = frozenset({"url", "spec", "openapi", "swaggerurl", "swagger_url"})
    out: list[str] = []
    for k, vals in qs.items():
        if k.lower() not in key_ok:
            continue
        for v in vals:
            s = unquote(v).strip().strip('\'"')
            if s.startswith("http://") or s.startswith("https://"):
                out.append(s)
    seen: set[str] = set()
    deduped: list[str] = []
    for u in out:
        if u not in seen:
            seen.add(u)
            deduped.append(u)
    return deduped


def _operational_path_spec_candidates(origin: str, pathname: str) -> list[str]:
    """Spec accanto all'endpoint operativo (es. POST …/bookfromagenda → …/bookfromagenda/openapi.json)."""
    p = (pathname or "/").rstrip("/")
    if not p or p == "/":
        return []
    return [f"{origin}{p}/openapi.json", f"{origin}{p}/swagger.json"]


def _candidate_urls_for_origin_path(origin: str, pathname: str) -> list[str]:
    urls: list[str] = []
    urls.extend(_operational_path_spec_candidates(origin, pathname))
    for prefix in _pathname_prefixes(pathname or "/"):
        for sp in SPEC_CANDIDATE_PATHS:
            urls.append(_join_origin_spec(origin, prefix, sp))
    for sp in SPEC_CANDIDATE_PATHS:
        urls.append(origin + sp)
    return urls


@router.get("/api/openapi-proxy")
async def proxy_openapi(
    url: str = Query(..., min_length=1, description="URL dell'endpoint o del documento OpenAPI/Swagger"),
    connection_id: str | None = Query(
        None,
        description="PortalConnection id — aggiunge Authorization Bearer",
    ),
) -> JSONResponse:
    raw = url.strip()
    parsed = urlparse(raw)
    if parsed.scheme not in ("http", "https"):
        raise HTTPException(
            status_code=400,
            detail="URL non valido: servono solo schemi http o https.",
        )

    try:
        auth_headers = await build_auth_headers(connection_id)
    except PortalAuthError as e:
        raise HTTPException(
            status_code=401,
            detail={"code": e.code, "message": e.message, "origin": normalize_origin(raw)},
        ) from e

    timeout = httpx.Timeout(20.0, connect=8.0)
    auth_required = False
    async with httpx.AsyncClient(
        follow_redirects=True,
        timeout=timeout,
        limits=httpx.Limits(max_connections=5),
    ) as client:
        tried: set[str] = set()
        attempts: list[tuple[str, str]] = []

        async def try_one(u: str) -> dict[str, Any] | None:
            nonlocal auth_required
            if u in tried:
                return None
            tried.add(u)
            doc, reason, http_status = await probe_openapi_url(client, u, auth_headers)
            attempts.append((u, reason))
            if attempt_indicates_auth_required(reason, http_status):
                auth_required = True
            return doc

        doc = await try_one(raw)
        if doc is not None:
            logger.info("[openapi-proxy] OK seed=%r connection=%r", raw, connection_id)
            return JSONResponse(content=doc)

        origin = f"{parsed.scheme}://{parsed.netloc}"
        for candidate in _operational_path_spec_candidates(origin, parsed.path or "/"):
            doc = await try_one(candidate)
            if doc is not None:
                logger.info(
                    "[openapi-proxy] OK operational-spec %r seed=%r", candidate, raw
                )
                return JSONResponse(content=doc)

        for nested in _nested_spec_urls_from_query(parsed):
            doc = await try_one(nested)
            if doc is not None:
                return JSONResponse(content=doc)
            nested_p = urlparse(nested)
            if nested_p.scheme in ("http", "https"):
                nested_origin = f"{nested_p.scheme}://{nested_p.netloc}"
                for candidate in _candidate_urls_for_origin_path(nested_origin, nested_p.path or "/"):
                    doc = await try_one(candidate)
                    if doc is not None:
                        return JSONResponse(content=doc)

        for candidate in _candidate_urls_for_origin_path(origin, parsed.path or "/"):
            doc = await try_one(candidate)
            if doc is not None:
                return JSONResponse(content=doc)

    if auth_required and not connection_id:
        try:
            origin_norm = normalize_origin(raw)
        except ValueError:
            origin_norm = f"{parsed.scheme}://{parsed.netloc}"
        raise HTTPException(
            status_code=401,
            detail={
                "code": "PORTAL_AUTH_REQUIRED",
                "message": (
                    "Il portale richiede l’accesso. Connetti il tuo account Google "
                    "per recuperare le specifiche OpenAPI."
                ),
                "origin": origin_norm,
            },
        )

    max_lines = 50
    body = "\n".join(f"  - {u} -> {r}" for u, r in attempts[:max_lines])
    if len(attempts) > max_lines:
        body += f"\n  … altri {len(attempts) - max_lines} tentativi non mostrati"
    logger.warning(
        "[openapi-proxy] NESSUN OpenAPI per seed=%r — %d tentativi:\n%s",
        raw,
        len(attempts),
        body,
    )

    authenticated = bool((connection_id or "").strip())
    sample = ", ".join({r for _, r in attempts[:8]}) or "nessun dettaglio"
    if authenticated:
        msg = (
            "Accesso al portale riuscito, ma non è stato trovato alcun documento OpenAPI/Swagger su questo URL. "
            "Incolla l’URL diretto del file JSON (es. …/swagger.json o …/v3/api-docs), non solo /webhook. "
            f"Ultimi tentativi: {sample}. "
            "Se vedi HTTP 503, il servizio può essere spento o l’URL non è quello dello swagger."
        )
    else:
        msg = (
            "Impossibile caricare OpenAPI. Incolla l’URL del JSON (es. …/v3/api-docs o …/swagger.json), "
            "oppure l’URL base dell’API (non solo la pagina HTML di Redoc/Swagger UI). "
            f"Ultimi tentativi: {sample}. "
            "Dettaglio: log backend Python [openapi-proxy]."
        )
    raise HTTPException(
        status_code=422,
        detail={
            "code": "OPENAPI_NOT_FOUND",
            "message": msg,
            "authenticated": authenticated,
            "origin": f"{parsed.scheme}://{parsed.netloc}",
        },
    )
