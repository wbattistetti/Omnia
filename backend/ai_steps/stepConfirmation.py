from fastapi import APIRouter, Body, HTTPException
import os
import json
import re
from ai_prompts.confirmation_prompt import get_confirmation_prompt
from call_openai import call_openai, OPENAI_KEY
from call_groq import call_groq

router = APIRouter()

@router.post("/api/stepConfirmation")
def step_confirmation(body: dict = Body(...)):
    meaning = body.get('meaning', '')
    desc = body.get('desc', '')
    start_examples = body.get('start_examples', None)
    # Use provider from request body, default to 'groq'
    provider = body.get('provider', 'groq')
    if isinstance(provider, str):
        provider = provider.lower()

    prompt = get_confirmation_prompt(meaning, desc, start_examples)
    try:
        print(f"[AI PROMPT][confirmation][provider={provider}]", prompt)
    except Exception:
        pass

    try:
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
        if provider == 'openai':
            ai = call_openai([
                {"role": "system", "content": "Always reply in English."},
                {"role": "user", "content": prompt}
            ])
        else:  # default to groq
            ai = call_groq([
                {"role": "system", "content": "Always reply in English."},
                {"role": "user", "content": prompt}
            ])
        try:
            print(f"[AI ANSWER][confirmation][provider={provider}]", ai)
        except Exception:
            pass

        # Clean markdown code blocks before parsing
        try:
            cleaned = _clean_json_like(ai)
            ai_obj = json.loads(cleaned)
            return {"ai": ai_obj}
        except Exception as parse_error:
            try:
                print(f"[AI ERROR][confirmation][parse_error][provider={provider}]", str(parse_error))
                print(f"[AI ERROR][confirmation][raw_response]", ai[:500])
            except Exception:
                pass
            # Try to salvage quoted strings
            try:
                m = re.findall(r"\"([^\"]{4,120})\"", ai)
                if m:
                    return {"ai": m[:3]}
            except Exception:
                pass
            raise HTTPException(status_code=500, detail="invalid_ai_json")
    except HTTPException:
        raise
    except Exception as e:
        try:
            print(f"[AI ERROR][confirmation][provider={provider}]", str(e))
        except Exception:
            pass
        raise HTTPException(status_code=500, detail="ai_call_failed")