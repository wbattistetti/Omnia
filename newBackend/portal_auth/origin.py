"""Normalize API URLs to portal origin keys."""

from __future__ import annotations

from urllib.parse import urlparse


def normalize_origin(url: str) -> str:
    """`https://host[:port]` from any http(s) URL."""
    raw = (url or "").strip()
    parsed = urlparse(raw)
    if parsed.scheme not in ("http", "https") or not parsed.netloc:
        raise ValueError("URL non valido: servono http o https con host.")
    return f"{parsed.scheme}://{parsed.netloc}"
