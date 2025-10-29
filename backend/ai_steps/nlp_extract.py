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

    print(f"[LLM_EXTRACT] Request received - field: {field}, text: {repr(text)}, lang: {lang}")

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

    print(f"[LLM_EXTRACT] Prompt: {repr(prompt[:300])}...")

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
        print(f"[LLM_EXTRACT] Cache hit for key: {key}")
        return cache[key][1]

    try:
        # Use OpenAI instead of Groq
        import requests
        from newBackend.core.core_settings import OPENAI_KEY, OPENAI_URL, OPENAI_MODEL

        # Debug: Check if OpenAI key is configured
        if not OPENAI_KEY:
            print(f"[LLM_EXTRACT][ERROR] OPENAI_KEY not configured")
            return Response(
                content=json.dumps({"error": "OPENAI_KEY not configured"}),
                media_type="application/json",
                status_code=502,
            )

        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {OPENAI_KEY}"
        }

        payload = {
            "model": OPENAI_MODEL,
            "messages": [
                {"role": "system", "content": "Always reply with RFC8259-compliant JSON only."},
                {"role": "user", "content": prompt}
            ],
            "temperature": 0.1
        }

        print(f"[LLM_EXTRACT][DEBUG] Calling OpenAI: {OPENAI_URL}")
        print(f"[LLM_EXTRACT][DEBUG] Model: {OPENAI_MODEL}")
        print(f"[LLM_EXTRACT][DEBUG] Prompt: {repr(prompt[:200])}...")

        response = requests.post(OPENAI_URL, headers=headers, json=payload, timeout=30)
        response.raise_for_status()

        ai_response = response.json()
        ai = ai_response.get("choices", [{}])[0].get("message", {}).get("content", "")

        print(f"[LLM_EXTRACT][DEBUG] AI response: {repr(ai[:200])}...")

        # Clean markdown code blocks before parsing
        def _clean_json_like(s: str) -> str:
            import re
            t = (s or "").strip()
            if t.startswith("```"):
                t = re.sub(r"^```[a-zA-Z]*\n", "", t)
                t = re.sub(r"\n```\s*$", "", t)
            # extract first {...} block if present
            m = re.search(r"\{[\s\S]*\}", t)
            if m:
                t = m.group(0)
            # remove trailing commas
            t = re.sub(r",\s*(\]|\})", r"\1", t)
            return t

        try:
            cleaned = _clean_json_like(ai)
            obj = json.loads(cleaned)
            print(f"[LLM_EXTRACT] Parsed JSON successfully: {obj}")
        except Exception as e:
            print(f"[LLM_EXTRACT] JSON parse error: {e}")
            # Fallback: try to extract JSON object substring
            start = ai.find('{')
            end = ai.rfind('}')
            if start != -1 and end != -1 and end > start:
                try:
                    obj = json.loads(ai[start:end+1])
                    print(f"[LLM_EXTRACT] Extracted JSON from response: {obj}")
                except Exception:
                    obj = None
                    print("[LLM_EXTRACT] No valid JSON found in response")
            else:
                obj = None
                print("[LLM_EXTRACT] No valid JSON found in response")
        if isinstance(obj, dict) and isinstance(obj.get("candidates"), list):
            cache[key] = (now, obj)
            print(f"[LLM_EXTRACT] Success - candidates: {obj}")
            return obj
        print("[LLM_EXTRACT] No valid candidates found, returning empty")
        return {"candidates": []}
    except Exception as e:
        print(f"[LLM_EXTRACT] Exception: {type(e).__name__}: {str(e)}")
        import traceback
        traceback.print_exc()
        return Response(
            content=json.dumps({"error": str(e)}),
            media_type="application/json",
            status_code=502,
        )

