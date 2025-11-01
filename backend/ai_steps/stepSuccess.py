from fastapi import APIRouter, Body, HTTPException
import os
import json
import re
from ai_prompts.success_prompt import get_success_prompt
from call_openai import call_openai, OPENAI_KEY
from call_groq import call_groq

router = APIRouter()

@router.post("/api/stepSuccess")
def step_success(body: dict = Body(...)):
    meaning = body.get('meaning', '')
    desc = body.get('desc', '')
    start_examples = body.get('start_examples', None)
    # Use provider from request body, default to 'groq'
    provider = body.get('provider', 'groq')
    if isinstance(provider, str):
        provider = provider.lower()

    prompt = get_success_prompt(meaning, desc, start_examples)
    try:
        print(f"[AI PROMPT][success][provider={provider}]", prompt)
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
            print(f"[AI ANSWER][success][provider={provider}]", ai)
        except Exception:
            pass

        # Clean markdown code blocks before parsing
        try:
            cleaned = _clean_json_like(ai)
            # Fix common JSON malformations: single quotes at end of array strings
            # Example: ["We've taken note of the year.'] -> ["We've taken note of the year."]
            # Match: [ "text' ] or ["text'] -> fix the trailing single quote
            cleaned = re.sub(r"(\[\s*\"[^\"]+?)'(\s*\])", r'\1"\2', cleaned)
            ai_obj = json.loads(cleaned)
            return {"ai": ai_obj}
        except Exception as parse_error:
            try:
                print(f"[AI ERROR][success][parse_error][provider={provider}]", str(parse_error))
                print(f"[AI ERROR][success][raw_response]", ai[:500])
            except Exception:
                pass
            # Try to salvage quoted strings (both double and single quotes)
            try:
                # First try double quotes
                m = re.findall(r"\"([^\"]{4,120})\"", ai)
                if m:
                    return {"ai": m[:3]}
                # Then try single quotes
                m = re.findall(r"'([^']{4,120})'", ai)
                if m:
                    return {"ai": m[:3]}
                # Last resort: try to extract any string-like content from array notation
                m = re.findall(r"\[[\s\S]*?['\"]([^'\"]{4,120})['\"][\s\S]*?\]", ai)
                if m:
                    return {"ai": m[:3]}
            except Exception:
                pass
            raise HTTPException(status_code=500, detail="invalid_ai_json")
    except HTTPException:
        raise
    except Exception as e:
        try:
            print(f"[AI ERROR][success][provider={provider}]", str(e))
        except Exception:
            pass
        raise HTTPException(status_code=500, detail="ai_call_failed")