import os
import requests
from typing import Optional
try:
    import winreg  # type: ignore
except Exception:
    winreg = None  # non-Windows or missing

def _get_openai_key() -> str | None:
    candidates = [
        "OpenAI_key", "OPENAI_KEY", "openai_key",
        "OpenAI_API_KEY", "OPENAI_api_key", "openai_api_key",
        "OPENAI_APIKEY", "OpenAIApiKey"
    ]
    for name in candidates:
        val = os.environ.get(name)
        if val:
            try:
                print(f"[OPENAI][env] using key name={name}")
            except Exception:
                pass
            return val
    # Windows registry fallback (read without requiring process restart)
    try:
        if winreg is not None:
            for root, scope in ((winreg.HKEY_CURRENT_USER, 'User'), (winreg.HKEY_LOCAL_MACHINE, 'Machine')):
                try:
                    with winreg.OpenKey(root, r"Environment") as k:
                        for name in candidates:
                            try:
                                val, _ = winreg.QueryValueEx(k, name)
                                if val:
                                    print(f"[OPENAI][env][registry] using key name={name} scope={scope}")
                                    return val
                            except FileNotFoundError:
                                continue
                except FileNotFoundError:
                    continue
    except Exception:
        pass
    try:
        print("[OPENAI][env][missing] tried names: OpenAI_key, OPENAI_KEY, openai_key, OPENAI_API_KEY, OpenAI_api_key, openai_api_key, OPENAI_APIKEY, OpenAIApiKey")
    except Exception:
        pass
    return None

OPENAI_KEY = _get_openai_key()
OPENAI_URL = "https://api.openai.com/v1/chat/completions"
OPENAI_MODEL = os.environ.get("OPENAI_MODEL", "gpt-4.1")

_session = requests.Session()

def call_openai(messages, model: Optional[str] = None):
    if not OPENAI_KEY:
        raise ValueError("Missing OpenAI API key. Set 'OpenAI_key'.")
    mdl = model or OPENAI_MODEL
    headers = {
        "Authorization": f"Bearer {OPENAI_KEY}",
        "Content-Type": "application/json",
    }
    payload = {"model": mdl, "messages": messages}
    try:
        first = (messages or [{}])[0]
        snippet = (first.get("content") or "")[:160] if isinstance(first, dict) else ""
        print(f"[OPENAI][REQ] model={mdl} url={OPENAI_URL} messages={len(messages)} first_snippet={snippet!r}")
    except Exception:
        pass
    resp = _session.post(OPENAI_URL, headers=headers, json=payload, timeout=45)
    try:
        print(f"[OPENAI][RES] status={resp.status_code} body_snippet={(resp.text or '')[:280]!r}")
    except Exception:
        pass
    if resp.status_code >= 400:
        try:
            detail = resp.json()
        except Exception:
            detail = resp.text
        raise requests.HTTPError(f"OpenAI API error {resp.status_code}: {detail}")
    data = resp.json()
    return data.get("choices", [{}])[0].get("message", {}).get("content", "")

def call_openai_json(messages, model: Optional[str] = None):
    if not OPENAI_KEY:
        raise ValueError("Missing OpenAI API key. Set 'OpenAI_key'.")
    mdl = model or OPENAI_MODEL
    headers = {
        "Authorization": f"Bearer {OPENAI_KEY}",
        "Content-Type": "application/json",
    }
    payload = {"model": mdl, "messages": messages, "response_format": {"type": "json_object"}}
    try:
        print(f"[OPENAI][REQ][json] model={mdl} messages={len(messages)}")
    except Exception:
        pass
    resp = _session.post(OPENAI_URL, headers=headers, json=payload, timeout=45)
    try:
        print(f"[OPENAI][RES] status={resp.status_code} body_snippet={(resp.text or '')[:280]!r}")
    except Exception:
        pass
    if resp.status_code >= 400:
        try:
            detail = resp.json()
        except Exception:
            detail = resp.text
        raise requests.HTTPError(f"OpenAI API error {resp.status_code}: {detail}")
    data = resp.json()
    return data.get("choices", [{}])[0].get("message", {}).get("content", "")


