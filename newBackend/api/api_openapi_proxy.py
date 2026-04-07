"""
Server-side fetch for OpenAPI/Swagger JSON so the browser avoids CORS when using Read API.
Mirrors the candidate-path logic in src/services/openApiBackendCallSpec.ts.
"""

from __future__ import annotations

import json
import logging
from typing import Any
from urllib.parse import parse_qs, unquote, urlparse

import httpx
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import JSONResponse

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
)

MAX_BODY_BYTES = 6 * 1024 * 1024

_FETCH_HEADERS = {
    "Accept": "application/json, */*",
    "User-Agent": "Omnia-OpenAPI-Proxy/1.0 (+https://github.com/)",
}


def _is_openapi_doc(data: Any) -> bool:
    return isinstance(data, dict) and ("openapi" in data or "swagger" in data)


def _pathname_prefixes(pathname: str) -> list[str]:
    """Percorsi dal path completo fino ai segmenti padre (es. /api/v1/users → /api/v1/users, /api/v1, /api)."""
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
    """origin + path_prefix + /swagger.json senza doppie slash."""
    p = path_prefix.rstrip("/") if path_prefix else ""
    return f"{origin}{p}{spec_suffix}"


def _nested_spec_urls_from_query(parsed) -> list[str]:
    """
    Redoc/Swagger UI spesso passano lo spec in query, es.:
    .../redoc/?url=https://petstore.swagger.io/v2/swagger.json
    """
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


def _candidate_urls_for_origin_path(origin: str, pathname: str) -> list[str]:
    urls: list[str] = []
    for sp in SPEC_CANDIDATE_PATHS:
        urls.append(origin + sp)
    for prefix in _pathname_prefixes(pathname or "/"):
        for sp in SPEC_CANDIDATE_PATHS:
            urls.append(_join_origin_spec(origin, prefix, sp))
    return urls


async def _probe_openapi_url(client: httpx.AsyncClient, url: str) -> tuple[dict[str, Any] | None, str]:
    """
    Scarica url e verifica se è un documento OpenAPI/Swagger.
    Ritorna (doc, motivo) con motivo leggibile per i log (es. HTTP 404, non JSON, …).
    """
    try:
        r = await client.get(url, headers=_FETCH_HEADERS)
        if r.status_code >= 400:
            return None, f"HTTP {r.status_code}"
        if len(r.content) > MAX_BODY_BYTES:
            return None, f"corpo > {MAX_BODY_BYTES // (1024 * 1024)} MiB"
        data = r.json()
        if not isinstance(data, dict):
            return None, "JSON non oggetto"
        if _is_openapi_doc(data):
            return data, "OK"
        return None, "JSON senza openapi/swagger (es. HTML mascherato o altro JSON)"
    except json.JSONDecodeError:
        return None, "non è JSON valido (spesso HTML o testo)"
    except httpx.TimeoutException:
        return None, "timeout"
    except httpx.HTTPError as e:
        return None, f"errore rete: {e!s}"
    except ValueError as e:
        return None, f"risposta non valida: {e!s}"


@router.get("/api/openapi-proxy")
async def proxy_openapi(
    url: str = Query(..., min_length=1, description="URL dell'endpoint o del documento OpenAPI/Swagger"),
) -> JSONResponse:
    raw = url.strip()
    parsed = urlparse(raw)
    if parsed.scheme not in ("http", "https"):
        raise HTTPException(
            status_code=400,
            detail="URL non valido: servono solo schemi http o https.",
        )

    timeout = httpx.Timeout(45.0, connect=15.0)
    async with httpx.AsyncClient(
        follow_redirects=True,
        timeout=timeout,
        limits=httpx.Limits(max_connections=5),
    ) as client:
        tried: set[str] = set()
        attempts: list[tuple[str, str]] = []

        async def try_one(u: str) -> dict[str, Any] | None:
            if u in tried:
                return None
            tried.add(u)
            doc, reason = await _probe_openapi_url(client, u)
            attempts.append((u, reason))
            return doc

        doc = await try_one(raw)
        if doc is not None:
            logger.info("[openapi-proxy] OK seed=%r -> documento da %r", raw, raw)
            return JSONResponse(content=doc)

        for nested in _nested_spec_urls_from_query(parsed):
            doc = await try_one(nested)
            if doc is not None:
                logger.info("[openapi-proxy] OK seed=%r -> documento da query ?url= %r", raw, nested)
                return JSONResponse(content=doc)
            nested_p = urlparse(nested)
            if nested_p.scheme in ("http", "https"):
                nested_origin = f"{nested_p.scheme}://{nested_p.netloc}"
                for candidate in _candidate_urls_for_origin_path(nested_origin, nested_p.path or "/"):
                    doc = await try_one(candidate)
                    if doc is not None:
                        logger.info(
                            "[openapi-proxy] OK seed=%r -> documento da %r (derivato da ?url=)",
                            raw,
                            candidate,
                        )
                        return JSONResponse(content=doc)

        origin = f"{parsed.scheme}://{parsed.netloc}"
        for candidate in _candidate_urls_for_origin_path(origin, parsed.path or "/"):
            doc = await try_one(candidate)
            if doc is not None:
                logger.info("[openapi-proxy] OK seed=%r -> documento da %r", raw, candidate)
                return JSONResponse(content=doc)

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

    raise HTTPException(
        status_code=422,
        detail=(
            "Impossibile caricare OpenAPI. Incolla l’URL del JSON (es. …/v3/api-docs o …/swagger.json), "
            "oppure l’URL base dell’API (non solo la pagina HTML di Redoc/Swagger UI). "
            "Verifica che il server sia raggiungibile da questa macchina. "
            "Dettaglio: controlla il terminale del backend Python (log [openapi-proxy])."
        ),
    )
