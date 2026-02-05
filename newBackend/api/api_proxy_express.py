# newBackend/api/api_proxy_express.py
from fastapi import APIRouter, Request, Response
from starlette.responses import StreamingResponse
import os
import httpx
import json
import logging
import time
from typing import Optional

router = APIRouter()
EXPRESS_BASE = os.environ.get("EXPRESS_BASE", "http://localhost:3100")

# Setup logging
logger = logging.getLogger(__name__)

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
    proxy_start_time = time.time()

    # ✅ CRITICAL: Read body ONCE and store it
    body_bytes = await request.body()
    body_size = len(body_bytes) if body_bytes else 0

    # Filter and prepare headers
    in_headers = _filter_headers(dict(request.headers))
    ctype = (in_headers.get("content-type") or "").lower()

    # ✅ CRITICAL: Handle Content-Length and chunked encoding
    if "transfer-encoding" in in_headers and "chunked" in in_headers.get("transfer-encoding", "").lower():
        # If chunked, remove Content-Length if present (incompatible)
        in_headers.pop("content-length", None)
    elif body_size > 0:
        # If not chunked and body exists, set Content-Length
        in_headers["content-length"] = str(body_size)
    elif body_size == 0:
        # Empty body
        in_headers["content-length"] = "0"

    # Log request details
    logger.info(f"[Proxy] {method} {request.url.path}{query} | Body size: {body_size} bytes | Headers: {list(in_headers.keys())}")

    # ✅ Increased timeout for MongoDB queries (30s total, 15s connect)
    timeout = httpx.Timeout(30.0, connect=15.0)

    try:
        async with httpx.AsyncClient(follow_redirects=False, timeout=timeout) as client:
            express_start_time = time.time()

            # ✅ Forward body based on Content-Type
            if ctype.startswith("application/json") and body_size > 0:
                try:
                    payload = json.loads(body_bytes)
                    request_kwargs = {"json": payload, "headers": in_headers}
                except (json.JSONDecodeError, UnicodeDecodeError) as e:
                    logger.warning(f"[Proxy] JSON parsing failed, forwarding as raw content: {e}")
                    request_kwargs = {"content": body_bytes, "headers": in_headers}
            elif ctype.startswith("application/x-www-form-urlencoded") and body_size > 0:
                # Parse form data
                from urllib.parse import parse_qs
                form_data = parse_qs(body_bytes.decode('utf-8'))
                request_kwargs = {"data": form_data, "headers": in_headers}
            else:
                # Raw content (form/multipart/binary/empty)
                request_kwargs = {"content": body_bytes, "headers": in_headers}

            async with client.stream(method, target_url, **request_kwargs) as resp:
                express_duration = (time.time() - express_start_time) * 1000  # ms

                # Check response size from Content-Length header if available
                content_length_header = resp.headers.get("content-length")
                response_size = int(content_length_header) if content_length_header else None

                # ✅ Handle streaming: buffer if >10MB or use streaming
                should_buffer = False
                if content_length_header and int(content_length_header) > 10 * 1024 * 1024:  # 10MB
                    should_buffer = True
                    logger.info(f"[Proxy] Response >10MB ({content_length_header} bytes), buffering completely")

                out_headers = _filter_headers(dict(resp.headers))
                media = resp.headers.get("content-type")

                # Log response details
                proxy_duration = (time.time() - proxy_start_time) * 1000  # ms
                logger.info(f"[Proxy] {method} {request.url.path} → {resp.status_code} | Express: {express_duration:.0f}ms | Total: {proxy_duration:.0f}ms | Size: {response_size or 'unknown'} bytes")

                if should_buffer:
                    # Buffer completely for large responses
                    try:
                        response_body = b""
                        async for chunk in resp.aiter_raw():
                            response_body += chunk
                        return Response(
                            content=response_body,
                            status_code=resp.status_code,
                            headers=out_headers,
                            media_type=media
                        )
                    except httpx.StreamError as e:
                        logger.error(f"[Proxy] Streaming error during buffering: {e}")
                        return Response(
                            content=f"Error streaming response: {str(e)}",
                            status_code=502
                        )
                else:
                    # Use streaming for smaller responses
                    try:
                        return StreamingResponse(
                            resp.aiter_raw(),
                            status_code=resp.status_code,
                            headers=out_headers,
                            media_type=media
                        )
                    except httpx.StreamError as e:
                        logger.error(f"[Proxy] Streaming error: {e}")
                        # Fallback to buffering
                        try:
                            response_body = b""
                            async for chunk in resp.aiter_raw():
                                response_body += chunk
                            return Response(
                                content=response_body,
                                status_code=resp.status_code,
                                headers=out_headers,
                                media_type=media
                            )
                        except Exception as fallback_error:
                            logger.error(f"[Proxy] Fallback buffering also failed: {fallback_error}")
                            return Response(
                                content=f"Error processing response: {str(fallback_error)}",
                                status_code=502
                            )

    except httpx.ConnectError as e:
        # Express backend not reachable
        proxy_duration = (httpx._utils.current_time() - proxy_start_time) * 1000  # ms
        error_msg = f"Express backend not reachable at {EXPRESS_BASE}"
        logger.error(f"[Proxy] {method} {request.url.path} → 503 | {error_msg} | Duration: {proxy_duration:.0f}ms")
        return Response(
            content=error_msg,
            status_code=503
        )
    except httpx.TimeoutException as e:
        # Request timeout
        proxy_duration = (httpx._utils.current_time() - proxy_start_time) * 1000  # ms
        error_msg = f"Request timeout after 30s. The Express backend may be slow or unresponsive."
        logger.error(f"[Proxy] {method} {request.url.path} → 504 | {error_msg} | Duration: {proxy_duration:.0f}ms")
        return Response(
            content=error_msg,
            status_code=504
        )
    except httpx.HTTPStatusError as e:
        # HTTP error from Express
        proxy_duration = (httpx._utils.current_time() - proxy_start_time) * 1000  # ms
        error_body = str(e.response.text)[:500] if hasattr(e.response, 'text') else str(e)[:500]
        logger.error(f"[Proxy] {method} {request.url.path} → {e.response.status_code} | Error body: {error_body} | Duration: {proxy_duration:.0f}ms")
        return Response(
            content=error_body,
            status_code=e.response.status_code,
            headers=_filter_headers(dict(e.response.headers))
        )
    except json.JSONDecodeError as e:
        # JSON decode error
        proxy_duration = (httpx._utils.current_time() - proxy_start_time) * 1000  # ms
        error_msg = f"Invalid JSON in request body: {str(e)[:500]}"
        logger.error(f"[Proxy] {method} {request.url.path} → 400 | {error_msg} | Duration: {proxy_duration:.0f}ms")
        return Response(
            content=error_msg,
            status_code=400
        )
    except httpx.StreamError as e:
        # Streaming error
        proxy_duration = (httpx._utils.current_time() - proxy_start_time) * 1000  # ms
        error_msg = f"Error during streaming: {str(e)[:500]}"
        logger.error(f"[Proxy] {method} {request.url.path} → 502 | {error_msg} | Duration: {proxy_duration:.0f}ms")
        return Response(
            content=error_msg,
            status_code=502
        )
    except httpx.RequestError as e:
        # Other httpx errors
        proxy_duration = (httpx._utils.current_time() - proxy_start_time) * 1000  # ms
        error_msg = str(e)[:500]
        logger.error(f"[Proxy] {method} {request.url.path} → 502 | {error_msg} | Duration: {proxy_duration:.0f}ms")
        return Response(
            content=error_msg,
            status_code=502
        )

@router.api_route("/api/factory/{full_path:path}", methods=["GET","POST","PUT","PATCH","DELETE"])
async def proxy_factory(full_path: str, request: Request):
    return await _proxy_to_express(request)

@router.api_route("/api/projects{suffix:path}", methods=["GET","POST","PUT","PATCH","DELETE"])
async def proxy_projects(suffix: str, request: Request):
    return await _proxy_to_express(request)

@router.api_route("/projects{suffix:path}", methods=["GET","POST","PUT","PATCH","DELETE"])
async def proxy_projects_alias(suffix: str, request: Request):
    return await _proxy_to_express(request)
