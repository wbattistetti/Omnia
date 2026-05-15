"""
Carica variabili da file .env per il processo FastAPI (uvicorn newBackend.app).

Non sovrascrive variabili già presenti in os.environ (priorità: shell > .env).
"""

from __future__ import annotations

import os
from pathlib import Path


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[2]


def _parse_env_line(line: str) -> tuple[str, str] | None:
    s = line.strip()
    if not s or s.startswith("#"):
        return None
    if s.startswith("export "):
        s = s[7:].strip()
    if "=" not in s:
        return None
    key, _, val = s.partition("=")
    key = key.strip()
    if not key:
        return None
    val = val.strip()
    if (val.startswith('"') and val.endswith('"')) or (val.startswith("'") and val.endswith("'")):
        val = val[1:-1]
    return key, val


def load_omnia_env_files() -> list[str]:
    """Legge .env noti; ritorna i path effettivamente caricati."""
    root = _repo_root()
    candidates = [
        root / ".env",
        root / ".env.local",
        root / "backend" / ".env",
        root / ".env.development",
    ]
    loaded: list[str] = []
    for path in candidates:
        if not path.is_file():
            continue
        try:
            text = path.read_text(encoding="utf-8")
        except OSError:
            continue
        for line in text.splitlines():
            parsed = _parse_env_line(line)
            if not parsed:
                continue
            key, val = parsed
            _apply_env_var(key, val)
        loaded.append(str(path))
    return loaded


def _apply_env_var(key: str, val: str) -> None:
    """Shell ha priorità; i file successivi possono riempire chiavi ancora vuote."""
    if key in os.environ and os.environ[key].strip():
        return
    if not val.strip():
        return
    os.environ[key] = val
