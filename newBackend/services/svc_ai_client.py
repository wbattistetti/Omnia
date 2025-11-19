import requests
import json
from newBackend.core.core_settings import GROQ_KEY, GROQ_URL, GROQ_MODEL, GROQ_FALLBACKS, OPENAI_KEY, OPENAI_URL, OPENAI_MODEL

def chat_text(messages: list[dict]) -> str:
    """Call Groq API for text responses with model fallback logic"""
    headers = {
        "Authorization": f"Bearer {GROQ_KEY}",
        "Content-Type": "application/json"
    }

    # Build candidate model list
    builtins = ["llama-3.1-70b-instruct", "llama-3.1-8b-instant", "llama-3.1-405b-instruct"]
    models_to_try = []
    for m in [GROQ_MODEL, *GROQ_FALLBACKS, *builtins]:
        if m and m not in models_to_try:
            models_to_try.append(m)

    last_error = None
    for model in models_to_try:
        data = {"model": model, "messages": messages}
        resp = requests.post(GROQ_URL, headers=headers, json=data)

        try:
            print(f"[GROQ][REQ] model={model} url={GROQ_URL} messages={len(messages)}")
            print(f"[GROQ][RES] status={resp.status_code} body_snippet={(resp.text or '')[:280]!r}")
        except Exception:
            pass

        if resp.status_code >= 400:
            txt = resp.text or ""
            if "model" in txt.lower() and ("decommissioned" in txt.lower() or "invalid" in txt.lower()):
                last_error = f"Groq API error {resp.status_code}: {txt}"
                try:
                    print("[GROQ][FALLBACK] switching model due to error -> trying next")
                except Exception:
                    pass
                continue
            raise requests.HTTPError(f"Groq API error {resp.status_code}: {txt}")

        try:
            j = resp.json()
        except Exception:
            raise requests.HTTPError(f"Groq API: invalid JSON response: {(resp.text or '')[:200]}")

        return j.get("choices", [{}])[0].get("message", {}).get("content", "")

    raise requests.HTTPError(last_error or "Groq API: all model candidates failed")

def chat_json(messages: list[dict], provider: str = "groq") -> dict:
    """Call AI API for JSON responses with configurable provider"""

    if provider == "openai":
        # OpenAI implementation
        if not OPENAI_KEY:
            raise ValueError("OpenAI API key not configured. Set OPENAI_KEY environment variable.")

        headers = {
            "Authorization": f"Bearer {OPENAI_KEY}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": OPENAI_MODEL,
            "messages": messages,
            "response_format": {"type": "json_object"}
        }

        try:
            print(f"[OPENAI][REQ] model={OPENAI_MODEL} url={OPENAI_URL} messages={len(messages)}")
            resp = requests.post(OPENAI_URL, headers=headers, json=payload, timeout=45)
            print(f"[OPENAI][RES] status={resp.status_code} body_snippet={(resp.text or '')[:280]!r}")
        except Exception as e:
            raise requests.HTTPError(f"OpenAI API connection error: {str(e)}")

        if resp.status_code >= 400:
            try:
                detail = resp.json()
            except Exception:
                detail = resp.text
            raise requests.HTTPError(f"OpenAI API error {resp.status_code}: {detail}")

        data = resp.json()
        return data.get("choices", [{}])[0].get("message", {}).get("content", "")

    elif provider == "groq":
        # Groq implementation (existing logic)
        headers = {
            "Authorization": f"Bearer {GROQ_KEY}",
            "Content-Type": "application/json"
        }

        # Build candidate model list
        builtins = ["llama-3.1-70b-instruct", "llama-3.1-8b-instant"]
        models_to_try = []
        for m in [GROQ_MODEL, *GROQ_FALLBACKS, *builtins]:
            if m and m not in models_to_try:
                models_to_try.append(m)

        last_error = None
        for model in models_to_try:
            data = {"model": model, "messages": messages, "response_format": {"type": "json_object"}}
            resp = requests.post(GROQ_URL, headers=headers, json=data)

            try:
                print(f"[GROQ][REQ][json] model={model} messages={len(messages)}")
                print(f"[GROQ][RES] status={resp.status_code} body_snippet={(resp.text or '')[:280]!r}")
            except Exception:
                pass

            if resp.status_code >= 400:
                txt = resp.text or ""
                if "model" in txt.lower() and ("decommissioned" in txt.lower() or "invalid" in txt.lower() or "not found" in txt.lower()):
                    last_error = f"Groq API error {resp.status_code}: {txt}"
                    try:
                        print("[GROQ][FALLBACK] switching model due to error -> trying next")
                    except Exception:
                        pass
                    continue
                # No fallback - raise error immediately
                raise requests.HTTPError(f"Groq API error {resp.status_code}: {txt}")

            try:
                j = resp.json()
            except Exception:
                raise requests.HTTPError(f"Groq API: invalid JSON response: {(resp.text or '')[:200]}")

            return j.get("choices", [{}])[0].get("message", {}).get("content", "")

        raise requests.HTTPError(last_error or "Groq API: all model candidates failed")

    else:
        raise ValueError(f"Unsupported provider: {provider}")
