"""
Policy OAuth portale all'avvio FastAPI (es. demo: login ad ogni restart).
"""

from __future__ import annotations

import logging
import os
from pathlib import Path

logger = logging.getLogger(__name__)


def portal_oauth_relogin_on_start() -> bool:
    raw = (os.environ.get("OMNIA_PORTAL_OAUTH_RELOGIN_ON_START") or "").strip().lower()
    return raw in ("1", "true", "yes", "on")


def _portal_connections_dir() -> Path:
    env = (os.environ.get("OMNIA_PORTAL_CONNECTIONS_DIR") or "").strip()
    if env:
        return Path(env)
    here = Path(__file__).resolve()
    root = here.parents[2]
    return root / "backend" / "data" / "portal_connections"


def apply_portal_oauth_startup_policy() -> None:
    """Se REL_LOGIN_ON_START: elimina token salvati così serve di nuovo Google OAuth."""
    if not portal_oauth_relogin_on_start():
        return
    data_dir = _portal_connections_dir()
    if not data_dir.is_dir():
        return
    removed = 0
    for path in data_dir.glob("*.json"):
        try:
            path.unlink()
            removed += 1
        except OSError as e:
            logger.warning("[portal-auth] impossibile rimuovere %s: %s", path, e)
    # Reset singleton store (se già inizializzato in questo processo)
    try:
        from newBackend.portal_auth import portal_connection_store as pcs

        pcs._store = None  # noqa: SLF001 — startup reset intenzionale
    except Exception:
        pass
    print(
        f"[INFO] Portal OAuth demo: REL_LOGIN_ON_START attivo — "
        f"rimosse {removed} connessioni da {data_dir}"
    )
