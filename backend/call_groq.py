import os
import requests

GROQ_KEY = os.environ.get("Groq_key")
GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
# Use a smaller model by default for tester speed; can be overridden via env
MODEL = os.environ.get("GROQ_MODEL", "llama3-8b-8192")

# Reuse HTTP connection to reduce TLS handshake latency
_session = requests.Session()

def call_groq(messages):
    headers = {
        "Authorization": f"Bearer {GROQ_KEY}",
        "Content-Type": "application/json"
    }
    data = {
        "model": MODEL,
        "messages": messages
    }
    response = _session.post(GROQ_URL, headers=headers, json=data, timeout=30)
    response.raise_for_status()
    return response.json()["choices"][0]["message"]["content"] 