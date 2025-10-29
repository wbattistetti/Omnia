from fastapi import APIRouter, Body, HTTPException
import os
import json
import re
from ai_prompts.no_match_prompt import get_no_match_prompt
from call_openai import call_openai_json as call_openai_json, OPENAI_KEY
from call_groq import call_groq

router = APIRouter()

@router.post("/api/stepNoMatch")
def step_no_match(body: dict = Body(...)):
    meaning = body.get('meaning', '')
    desc = body.get('desc', '')
    start_examples = body.get('start_examples', None)
    # Use provider from request body, default to 'groq'
    provider = body.get('provider', 'groq')
    if isinstance(provider, str):
        provider = provider.lower()

    prompt = get_no_match_prompt(meaning, desc, start_examples)
    try:
        print(f"[AI PROMPT][noMatch][provider={provider}]", prompt)
    except Exception:
        pass

    try:
        def _clean_json_like(s: str) -> str:
            t = (s or "").strip()
            if t.startswith("```"):
                t = re.sub(r"^```[a-zA-Z]*\n", "", t)
                t = re.sub(r"\n```\s*$", "", t)
            m = re.search(r"\[[\s\S]*\]", t)
            if m:
                t = m.group(0)
            t = re.sub(r",\s*(\]|\})", r"\1", t)
            return t

        # Use provider from request instead of checking env vars
        if provider == 'openai':
            ai = call_openai_json([
                {"role": "system", "content": "Return only a JSON array of short English re-ask messages (no comments)."},
                {"role": "user", "content": prompt}
            ])
        else:  # default to groq
            ai = call_groq([
                {"role": "system", "content": "Return only a JSON array of short English re-ask messages (no comments)."},
                {"role": "user", "content": prompt}
            ])
        # Parse/salvage
        try:
            cleaned = _clean_json_like(ai)
            parsed = json.loads(cleaned)
        except Exception:
            parsed = None
        arr: list[str] = []
        if isinstance(parsed, list):
            arr = [str(x) for x in parsed if isinstance(x, (str, int, float))]
        elif isinstance(parsed, dict):
            arr = [str(v) for v in parsed.values() if isinstance(v, (str, int, float))]
        if arr:
            return {"ai": arr[:3]}
        # fallback: quoted strings
        try:
            m = re.findall(r"\"([^\"]{4,120})\"", ai)
            if m:
                return {"ai": [m[0]][:3]}
        except Exception:
            pass
        # deterministic fallback (3 brevi re-ask)
        return {"ai": [
            "I didn't catch that. Could you rephrase?",
            "Sorry, could you say it again?",
            "Could you provide it in a simpler way?"
        ]}
    except Exception:
        # deterministic fallback anche in caso di eccezione generica
        return {"ai": [
            "I didn't catch that. Could you rephrase?",
            "Sorry, could you say it again?",
            "Could you provide it in a simpler way?"
        ]}