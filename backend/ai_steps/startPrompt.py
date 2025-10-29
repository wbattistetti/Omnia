from fastapi import APIRouter, Body, HTTPException
import os
import json
import re
from ai_prompts.start_prompt import get_start_prompt
from call_openai import call_openai_json as call_openai_json, OPENAI_KEY as OPENAI_KEY
from call_groq import call_groq

router = APIRouter()

@router.post("/api/startPrompt")
def start_prompt(body: dict = Body(...)):
    meaning = body.get('meaning', '')
    desc = body.get('desc', '')
    # Use provider from request body, default to 'groq'
    provider = body.get('provider', 'groq')
    if isinstance(provider, str):
        provider = provider.lower()

    prompt = get_start_prompt(meaning, desc)
    try:
        print(f"[AI PROMPT][startPrompt][provider={provider}]", str(prompt).encode('ascii', 'ignore').decode('ascii'))
    except Exception:
        pass

    try:
        # small helper to salvage JSON arrays
        def _clean_json_like(s: str) -> str:
            t = (s or "").strip()
            if t.startswith("```"):
                t = re.sub(r"^```[a-zA-Z]*\n", "", t)
                t = re.sub(r"\n```\s*$", "", t)
            # extract first [...] block if present
            m = re.search(r"\[[\s\S]*\]", t)
            if m:
                t = m.group(0)
            # remove trailing commas
            t = re.sub(r",\s*(\]|\})", r"\1", t)
            return t

        # Use provider from request instead of checking env vars
        ai = None
        try:
            if provider == 'openai':
                ai = call_openai_json([
                    {"role": "system", "content": "Return only a JSON array with 1 English string (no IDs, no comments)."},
                    {"role": "user", "content": prompt}
                ])
            else:  # default to groq
                ai = call_groq([
                    {"role": "system", "content": "Return only a JSON array with 1 English string (no IDs, no comments)."},
                    {"role": "user", "content": prompt}
                ])
        except Exception as e:
            try:
                print(f"[startPrompt][call_error][provider={provider}]", str(e))
            except Exception:
                pass
            ai = None

        # Fallback to deterministic if call failed
        if not ai:
            # No key available → deterministic fallback
            base = f"What is your {meaning.lower() or 'data'}?".strip()
            if 'phone' in (meaning or '').lower():
                base = "What is your phone number (+country code)?"
            try:
                print("[startPrompt][no_key][fallback]", base)
            except Exception:
                pass
            return {"ai": [base]}

        try:
            cleaned = _clean_json_like(ai)
            ai_obj = json.loads(cleaned)
            try:
                print("[startPrompt][ai_raw]", (str(ai)[:220]).encode('ascii','ignore').decode('ascii'))
                print("[startPrompt][ai_cleaned]", (str(cleaned)[:220]).encode('ascii','ignore').decode('ascii'))
            except Exception:
                pass
        except Exception as pe:
            try:
                print("[startPrompt][warn][parse_failed]", str(pe))
                print("[startPrompt][ai_raw]", (str(ai)[:220]).encode('ascii','ignore').decode('ascii'))
            except Exception:
                pass
            # try to salvage a single quoted sentence from raw text
            try:
                import re as _re
                m = _re.search(r"\"([^\"]{6,200})\"", ai)
                if m:
                    try:
                        print("[startPrompt][salvage][quoted]", m.group(1))
                    except Exception:
                        pass
                    return {"ai": [m.group(1)]}
            except Exception:
                pass
            # final deterministic fallback (still not a mock UI message)
            base = f"What is your {meaning.lower() or 'data'}?".strip()
            if 'phone' in (meaning or '').lower():
                base = "What is your phone number (+country code)?"
            try:
                print("[startPrompt][fallback][deterministic]", base)
            except Exception:
                pass
            return {"ai": [base]}

        # enforce array of strings, salvage from object if needed
        if isinstance(ai_obj, list):
            arr = [str(x) for x in ai_obj if isinstance(x, (str, int, float))]
            if len(arr) == 0:
                raise HTTPException(status_code=500, detail="empty_ai_array")
            try: print("[startPrompt][parsed_array]", arr[:1])
            except Exception: pass
            return {"ai": arr[:1]}
        if isinstance(ai_obj, dict):
            # try typical shapes: { messages: ["..."] } or { result: ["..."] }
            for k in ("messages", "result", "data", "items"):
                v = ai_obj.get(k)
                if isinstance(v, list):
                    arr = [str(x) for x in v if isinstance(x, (str, int, float))]
                    if arr:
                        try: print("[startPrompt][parsed_object_array]", arr[:1])
                        except Exception: pass
                        return {"ai": arr[:1]}
        # salvage: convert any plain string-shaped content into array
        try:
            s = str(ai).strip()
            if s and len(s) < 240:
                try: print("[startPrompt][salvage][raw_string]", s)
                except Exception: pass
                return {"ai": [s]}
        except Exception:
            pass
        # deterministic last-resort
        base = f"What is your {meaning.lower() or 'data'}?".strip()
        if 'phone' in (meaning or '').lower():
            base = "What is your phone number (+country code)?"
        try: print("[startPrompt][fallback][deterministic-end]", base)
        except Exception: pass
        return {"ai": [base]}
    except Exception as e:
        # non interrompere la pipeline: ritorna un fallback deterministico
        try:
            base = f"What is your {meaning.lower() or 'data'}?".strip()
            if 'phone' in (meaning or '').lower():
                base = "What is your phone number (+country code)?"
            try: print("[startPrompt][catch_all][error]", str(e))
            except Exception: pass
            return {"ai": [base]}
        except Exception:
            return {"ai": ["What is the value?"]}