# newBackend/api/api_proxy_express.py
from fastapi import APIRouter, Request, Response
from starlette.responses import StreamingResponse
import os
import httpx

router = APIRouter()
EXPRESS_BASE = os.environ.get("EXPRESS_BASE", "http://localhost:3100")

# RFC7230 hop-by-hop headers: da rimuovere
HOP_BY_HOP = {
    "connection", "keep-alive", "proxy-authenticate", "proxy-authorization",
    "te", "trailers", "transfer-encoding", "upgrade"
}

def _filter_headers(headers: dict) -> dict:
    return {k: v for k, v in headers.items() if k.lower() not in HOP_BY_HOP and k.lower() != "host"}

async def _proxy_to_express(request: Request) -> Response:
    method = request.method.upper()
    query = ("?" + request.url.query) if request.url.query else ""
    target_url = f"{EXPRESS_BASE}{request.url.path}{query}"

    in_headers = _filter_headers(dict(request.headers))
    ctype = (in_headers.get("content-type") or "").lower()

    timeout = httpx.Timeout(15.0, connect=10.0)
    try:
        async with httpx.AsyncClient(follow_redirects=False, timeout=timeout) as client:
            if ctype.startswith("application/json"):
                try:
                    payload = await request.json()
                except Exception:
                    payload = None  # JSON vuoto/non valido → inoltra senza body
                async with client.stream(method, target_url, headers=in_headers, json=payload) as resp:
                    out_headers = _filter_headers(dict(resp.headers))
                    media = resp.headers.get("content-type")
                    return StreamingResponse(resp.aiter_raw(), status_code=resp.status_code,
                                             headers=out_headers, media_type=media)
            else:
                # inoltra qualsiasi altro body (form/multipart/raw/binary)
                body = await request.body()
                async with client.stream(method, target_url, headers=in_headers, content=body) as resp:
                    out_headers = _filter_headers(dict(resp.headers))
                    media = resp.headers.get("content-type")
                    return StreamingResponse(resp.aiter_raw(), status_code=resp.status_code,
                                             headers=out_headers, media_type=media)
    except httpx.RequestError as e:
        return Response(content=str(e), status_code=502)

@router.api_route("/api/factory/{full_path:path}", methods=["GET","POST","PUT","PATCH","DELETE"])
async def proxy_factory(full_path: str, request: Request):
    return await _proxy_to_express(request)

@router.api_route("/api/projects{suffix:path}", methods=["GET","POST","PUT","PATCH","DELETE"])
async def proxy_projects(suffix: str, request: Request):
    return await _proxy_to_express(request)

@router.api_route("/projects{suffix:path}", methods=["GET","POST","PUT","PATCH","DELETE"])
async def proxy_projects_alias(suffix: str, request: Request):
    return awa
