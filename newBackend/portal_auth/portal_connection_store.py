"""
Server-side store for PortalConnection secrets (encrypted tokens).

Public metadata (id, origin, provider, status) lives in project JSON on the client;
this module holds only secrets keyed by connection_id.
"""

from __future__ import annotations

import json
import logging
import os
import threading
import time
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Literal

from .token_crypto import decrypt_token_blob, encrypt_token_blob

logger = logging.getLogger(__name__)

PortalProvider = Literal["google_workspace", "generic_oidc"]
PortalStatus = Literal["connected", "expired", "revoked", "pending"]


@dataclass
class PortalConnectionRecord:
    id: str
    project_id: str
    origin: str
    provider: PortalProvider
    status: PortalStatus
    encrypted_tokens: str | None = None
    token_expires_at: float | None = None
    created_at: float = field(default_factory=time.time)
    updated_at: float = field(default_factory=time.time)
    label: str | None = None


def _default_data_dir() -> Path:
    env = (os.environ.get("OMNIA_PORTAL_CONNECTIONS_DIR") or "").strip()
    if env:
        return Path(env)
    # repo/backend/data/portal_connections
    here = Path(__file__).resolve()
    root = here.parents[2]
    return root / "backend" / "data" / "portal_connections"


class PortalConnectionStore:
    def __init__(self, data_dir: Path | None = None) -> None:
        self._dir = data_dir or _default_data_dir()
        self._dir.mkdir(parents=True, exist_ok=True)
        self._lock = threading.RLock()
        self._by_id: dict[str, PortalConnectionRecord] = {}
        self._load_all()

    def _file_for(self, connection_id: str) -> Path:
        safe = connection_id.replace("/", "_")
        return self._dir / f"{safe}.json"

    def _load_all(self) -> None:
        for path in self._dir.glob("*.json"):
            try:
                raw = json.loads(path.read_text(encoding="utf-8"))
                rec = PortalConnectionRecord(
                    id=str(raw["id"]),
                    project_id=str(raw["project_id"]),
                    origin=str(raw["origin"]),
                    provider=raw.get("provider") or "google_workspace",
                    status=raw.get("status") or "connected",
                    encrypted_tokens=raw.get("encrypted_tokens"),
                    token_expires_at=raw.get("token_expires_at"),
                    created_at=float(raw.get("created_at") or time.time()),
                    updated_at=float(raw.get("updated_at") or time.time()),
                    label=raw.get("label"),
                )
                self._by_id[rec.id] = rec
            except Exception as e:
                logger.warning("[portal-auth] skip corrupt store file %s: %s", path, e)

    def _persist(self, rec: PortalConnectionRecord) -> None:
        payload = {
            "id": rec.id,
            "project_id": rec.project_id,
            "origin": rec.origin,
            "provider": rec.provider,
            "status": rec.status,
            "encrypted_tokens": rec.encrypted_tokens,
            "token_expires_at": rec.token_expires_at,
            "created_at": rec.created_at,
            "updated_at": rec.updated_at,
            "label": rec.label,
        }
        self._file_for(rec.id).write_text(
            json.dumps(payload, indent=2), encoding="utf-8"
        )

    def create_pending(
        self,
        *,
        project_id: str,
        origin: str,
        provider: PortalProvider = "google_workspace",
    ) -> PortalConnectionRecord:
        with self._lock:
            cid = str(uuid.uuid4())
            now = time.time()
            rec = PortalConnectionRecord(
                id=cid,
                project_id=project_id,
                origin=origin,
                provider=provider,
                status="pending",
                created_at=now,
                updated_at=now,
            )
            self._by_id[cid] = rec
            self._persist(rec)
            return rec

    def get(self, connection_id: str) -> PortalConnectionRecord | None:
        with self._lock:
            return self._by_id.get(connection_id)

    def list_for_project(self, project_id: str) -> list[PortalConnectionRecord]:
        with self._lock:
            return [r for r in self._by_id.values() if r.project_id == project_id]

    def find_by_origin(self, project_id: str, origin: str) -> PortalConnectionRecord | None:
        with self._lock:
            for r in self._by_id.values():
                if r.project_id == project_id and r.origin == origin and r.status == "connected":
                    return r
            return None

    def save_tokens(
        self,
        connection_id: str,
        *,
        access_token: str,
        refresh_token: str | None,
        expires_in: int | None,
        id_token: str | None = None,
        token_type: str = "Bearer",
        extra: dict[str, Any] | None = None,
    ) -> PortalConnectionRecord:
        with self._lock:
            rec = self._by_id.get(connection_id)
            if not rec:
                raise KeyError(connection_id)
            blob: dict[str, Any] = {
                "access_token": access_token,
                "refresh_token": refresh_token,
                "token_type": token_type,
                "id_token": id_token,
            }
            if extra:
                blob.update(extra)
            rec.encrypted_tokens = encrypt_token_blob(blob)
            if expires_in and expires_in > 0:
                rec.token_expires_at = time.time() + float(expires_in) - 30
            else:
                rec.token_expires_at = time.time() + 3500
            rec.status = "connected"
            rec.updated_at = time.time()
            self._persist(rec)
            return rec

    def mark_expired(self, connection_id: str) -> None:
        with self._lock:
            rec = self._by_id.get(connection_id)
            if not rec:
                return
            rec.status = "expired"
            rec.updated_at = time.time()
            self._persist(rec)

    def delete(self, connection_id: str) -> bool:
        with self._lock:
            rec = self._by_id.pop(connection_id, None)
            if not rec:
                return False
            path = self._file_for(connection_id)
            if path.exists():
                path.unlink()
            return True

    def read_token_blob(self, connection_id: str) -> dict[str, Any] | None:
        with self._lock:
            rec = self._by_id.get(connection_id)
            if not rec or not rec.encrypted_tokens:
                return None
            return decrypt_token_blob(rec.encrypted_tokens)

    def write_token_blob(self, connection_id: str, blob: dict[str, Any], expires_at: float | None) -> None:
        with self._lock:
            rec = self._by_id.get(connection_id)
            if not rec:
                raise KeyError(connection_id)
            rec.encrypted_tokens = encrypt_token_blob(blob)
            rec.token_expires_at = expires_at
            rec.status = "connected"
            rec.updated_at = time.time()
            self._persist(rec)


_store: PortalConnectionStore | None = None


def get_portal_connection_store() -> PortalConnectionStore:
    global _store
    if _store is None:
        _store = PortalConnectionStore()
    return _store
