"""Unit tests for portal OAuth PKCE helpers."""

from newBackend.portal_auth.pkce import code_challenge_s256, generate_code_verifier


def test_code_verifier_length():
    v = generate_code_verifier()
    assert 43 <= len(v) <= 128


def test_code_challenge_s256_deterministic():
    v = "test-verifier-fixed-value-123456789012345678901234567890"
    c1 = code_challenge_s256(v)
    c2 = code_challenge_s256(v)
    assert c1 == c2
    assert "=" not in c1
