"""
Encrypt portal OAuth tokens at rest (Fernet).

Requires `cryptography` and env `OMNIA_PORTAL_TOKEN_ENCRYPTION_KEY` (url-safe base64 32-byte key).
In dev without the env var, a deterministic dev key is used (not for production).
"""

from __future__ import annotations

import base64
import hashlib
import json
import logging
import os
from typing import Any

logger = logging.getLogger(__name__)

_fernet = None


def _fernet_instance():
    global _fernet
    if _fernet is not None:
        return _fernet
    try:
        from cryptography.fernet import Fernet
    except ImportError as e:
        raise RuntimeError(
            "Install cryptography for portal token storage: pip install cryptography"
        ) from e

    raw = (os.environ.get("OMNIA_PORTAL_TOKEN_ENCRYPTION_KEY") or "").strip()
    if raw:
        key = raw.encode("utf-8")
    else:
        logger.warning(
            "[portal-auth] OMNIA_PORTAL_TOKEN_ENCRYPTION_KEY unset — using dev-only derived key"
        )
        key = base64.urlsafe_b64encode(hashlib.sha256(b"omnia-dev-portal-key").digest())
    _fernet = Fernet(key)
    return _fernet


def encrypt_token_blob(blob: dict[str, Any]) -> str:
    payload = json.dumps(blob, separators=(",", ":")).encode("utf-8")
    return _fernet_instance().encrypt(payload).decode("ascii")


def decrypt_token_blob(token: str) -> dict[str, Any]:
    raw = _fernet_instance().decrypt(token.encode("ascii"))
    data = json.loads(raw.decode("utf-8"))
    if not isinstance(data, dict):
        raise ValueError("decrypted token blob is not an object")
    return data
