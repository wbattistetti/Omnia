"""Unit tests for portal OAuth startup policy."""

import os

from newBackend.portal_auth.startup_policy import portal_oauth_relogin_on_start


def test_relogin_on_start_env(monkeypatch):
    monkeypatch.delenv("OMNIA_PORTAL_OAUTH_RELOGIN_ON_START", raising=False)
    assert portal_oauth_relogin_on_start() is False
    monkeypatch.setenv("OMNIA_PORTAL_OAUTH_RELOGIN_ON_START", "1")
    assert portal_oauth_relogin_on_start() is True
    monkeypatch.setenv("OMNIA_PORTAL_OAUTH_RELOGIN_ON_START", "yes")
    assert portal_oauth_relogin_on_start() is True
