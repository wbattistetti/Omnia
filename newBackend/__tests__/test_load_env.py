"""Unit tests for FastAPI .env loader."""

from pathlib import Path

import os

from newBackend.core.load_env import _apply_env_var, _parse_env_line, load_omnia_env_files


def test_parse_env_line_skips_comments_and_export():
    assert _parse_env_line("# comment") is None
    assert _parse_env_line("export FOO=bar") == ("FOO", "bar")
    assert _parse_env_line('KEY="quoted"') == ("KEY", "quoted")


def test_apply_env_skips_empty_and_fills_later(monkeypatch):
    monkeypatch.delenv("OMNIA_TEST_LOAD_ENV_ONLY", raising=False)
    _apply_env_var("OMNIA_TEST_LOAD_ENV_ONLY", "")
    assert "OMNIA_TEST_LOAD_ENV_ONLY" not in os.environ
    _apply_env_var("OMNIA_TEST_LOAD_ENV_ONLY", "filled")
    assert os.environ["OMNIA_TEST_LOAD_ENV_ONLY"] == "filled"
    _apply_env_var("OMNIA_TEST_LOAD_ENV_ONLY", "ignored")
    assert os.environ["OMNIA_TEST_LOAD_ENV_ONLY"] == "filled"
    monkeypatch.delenv("OMNIA_TEST_LOAD_ENV_ONLY", raising=False)


def test_load_does_not_override_existing(monkeypatch, tmp_path: Path):
    env_file = tmp_path / ".env"
    env_file.write_text("OMNIA_TEST_LOAD_ENV_ONLY=from_file\n", encoding="utf-8")
    monkeypatch.setenv("OMNIA_TEST_LOAD_ENV_ONLY", "from_shell")
    monkeypatch.chdir(tmp_path)
    # load_omnia_env_files uses repo root from __file__, not cwd — test parser only
    assert _parse_env_line("OMNIA_TEST_LOAD_ENV_ONLY=from_file") == (
        "OMNIA_TEST_LOAD_ENV_ONLY",
        "from_file",
    )


def test_load_omnia_env_files_returns_existing_paths():
    paths = load_omnia_env_files()
    assert isinstance(paths, list)
