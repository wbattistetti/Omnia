"""Short-lived OAuth state (PKCE verifier + metadata) between start and callback."""

from __future__ import annotations

import threading
import time
from dataclasses import dataclass
from typing import Literal

PortalProvider = Literal["google_workspace", "generic_oidc"]

_TTL_SEC = 600


@dataclass
class PendingOAuth:
    state: str
    code_verifier: str
    connection_id: str
    project_id: str
    origin: str
    provider: PortalProvider
    return_url: str
    created_at: float


_lock = threading.RLock()
_pending: dict[str, PendingOAuth] = {}


def put_pending(p: PendingOAuth) -> None:
    with _lock:
        _purge_expired()
        _pending[p.state] = p


def pop_pending(state: str) -> PendingOAuth | None:
    with _lock:
        _purge_expired()
        return _pending.pop(state, None)


def _purge_expired() -> None:
    now = time.time()
    expired = [k for k, v in _pending.items() if now - v.created_at > _TTL_SEC]
    for k in expired:
        _pending.pop(k, None)
