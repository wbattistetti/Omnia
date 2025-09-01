import os
import requests

GROQ_KEY = os.environ.get("Groq_key") or os.environ.get("GROQ_API_KEY")
GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
# Use a smaller model by default for tester speed; can be overridden via env
# Use a recent default; allow override via env
MODEL = os.environ.get("GROQ_MODEL", "llama-3.1-8b-instant")

# Reuse HTTP connection to reduce TLS handshake latency
_session = requests.Session()

def call_groq(messages):
    if not GROQ_KEY:
        raise ValueError("Missing Groq API key. Set environment variable 'Groq_key' or 'GROQ_API_KEY'.")
    headers = {
        "Authorization": f"Bearer {GROQ_KEY}",
        "Content-Type": "application/json"
    }
    data = {
        "model": MODEL,
        "messages": messages
    }
    # Debug (safe): do not print API key
    try:
        first = (messages or [{}])[0]
        snippet = (first.get("content") or "")[:160] if isinstance(first, dict) else ""
        print(f"[GROQ][REQ] model={MODEL} url={GROQ_URL} messages={len(messages)} first_snippet={snippet!r}")
    except Exception:
        pass
    response = _session.post(GROQ_URL, headers=headers, json=data, timeout=30)
    try:
        print(f"[GROQ][RES] status={response.status_code} body_snippet={(response.text or '')[:240]!r}")
    except Exception:
        pass
    if response.status_code >= 400:
        # Raise with detailed response body for debugging upstream
        detail = None
        try:
            detail = response.json()
        except Exception:
            detail = response.text
        raise requests.HTTPError(f"Groq API error {response.status_code}: {detail}")
    return response.json()["choices"][0]["message"]["content"]