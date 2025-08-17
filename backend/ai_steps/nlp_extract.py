from fastapi import APIRouter, Body, Response
import os
import json
import time
import requests
from call_groq import call_groq

router = APIRouter()


@router.post("/api/nlp/extract")
def nlp_extract(body: dict = Body(...)):
    """
    Proxy endpoint that forwards NLP extraction requests to the configured PROMIS NLP service.

    Configure environment variables:
    - PROMIS_URL: Base URL of the external NLP service (e.g., http://localhost:3001 or https://promis.yourdomain)
    - PROMIS_KEY: Optional API key for the external service
    """
    base = os.environ.get("PROMIS_URL")
    api_key = os.environ.get("PROMIS_KEY")

    if not base:
        return Response(
            content=json.dumps({
                "error": "PROMIS_URL not configured on server",
                "hint": "Set environment variable PROMIS_URL to your NLP service base URL"
            }),
            media_type="application/json",
            status_code=501,
        )

    candidate_urls = [
        f"{base.rstrip('/')}/nlp/extract",
        f"{base.rstrip('/')}/api/nlp/extract",
    ]
    headers = {"Content-Type": "application/json"}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"
        headers["X-API-Key"] = api_key

    last_status = None
    last_text = None
    for url in candidate_urls:
        try:
            r = requests.post(url, headers=headers, data=json.dumps(body), timeout=15)
            last_status = r.status_code
            last_text = r.text
            if r.ok:
                return Response(content=r.text, media_type="application/json", status_code=r.status_code)
        except Exception as e:
            last_text = json.dumps({"error": str(e)})
            last_status = 502

    # No candidate succeeded
    return Response(
        content=json.dumps({
            "error": "Unable to reach external NLP service",
            "status": last_status,
            "details": last_text,
        }),
        media_type="application/json",
        status_code=last_status or 502,
    )

@router.post("/api/nlp/llm-extract")
def llm_extract(body: dict = Body(...)):
    """
    LLM-based lightweight extractor using GROQ. Supports basic fields.
    Input body: { field: 'dateOfBirth'|'email'|'phone'|'generic', text: str, lang?: 'it'|'en'|... }
    Output: { candidates: [ { value: any, confidence: number } ] }
    """
    field = (body or {}).get("field") or "generic"
    text = (body or {}).get("text") or ""
    lang = (body or {}).get("lang") or "it"

    instructions = {
        "dateOfBirth": (
            "Extract the user's date of birth from the input. Return JSON only. The 'value' must be an object with keys 'day','month','year' as integers when known, otherwise null."
        ),
        "email": (
            "Extract the user's email from the input. Return JSON only. The 'value' must be a string email if found, otherwise empty string."
        ),
        "phone": (
            "Extract the user's phone number from the input. Return JSON only. The 'value' must be a phone string if found, otherwise empty string."
        ),
        "generic": (
            "Extract the most relevant value described in the input. Return JSON only. The 'value' must be a string (may be empty)."
        ),
    }
    hint = instructions.get(field, instructions["generic"])
    prompt = (
        f"You are an information extraction assistant. Language: {lang}.\n"
        f"Field: {field}.\n"
        f"{hint}\n"
        "Respond ONLY with valid JSON in this exact schema (no extra keys, no explanations):\n"
        "{\n  \"candidates\": [ { \"value\": <value>, \"confidence\": <number between 0 and 1> } ]\n}"
        f"\nInput: '{text}'\n"
    )

    # Small in-memory cache to avoid repeating identical extractions shortly
    cache_ttl_s = 60
    key = json.dumps({"f": field, "t": text, "l": lang}, ensure_ascii=False)
    now = time.time()
    if not hasattr(llm_extract, "_cache"):
        setattr(llm_extract, "_cache", {})  # type: ignore
    cache = getattr(llm_extract, "_cache")  # type: ignore
    try:
        # purge expired
        for k in list(cache.keys()):
            if (now - cache[k][0]) > cache_ttl_s:
                cache.pop(k, None)
    except Exception:
        cache = {}
        setattr(llm_extract, "_cache", cache)  # type: ignore

    if key in cache:
        return cache[key][1]

    try:
        ai = call_groq([
            {"role": "system", "content": "Always reply with RFC8259-compliant JSON only."},
            {"role": "user", "content": prompt},
        ])
        try:
            obj = json.loads(ai)
        except Exception:
            start = ai.find('{')
            end = ai.rfind('}')
            if start != -1 and end != -1 and end > start:
                obj = json.loads(ai[start:end+1])
            else:
                obj = None
        if isinstance(obj, dict) and isinstance(obj.get("candidates"), list):
            cache[key] = (now, obj)
            return obj
        return {"candidates": []}
    except Exception as e:
        return Response(
            content=json.dumps({"error": str(e)}),
            media_type="application/json",
            status_code=502,
        )

