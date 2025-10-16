from fastapi import APIRouter, Body, HTTPException
import os
import json
from ai_prompts.no_input_prompt import get_no_input_prompt
from call_openai import call_openai, OPENAI_KEY
from call_groq import call_groq

router = APIRouter()

@router.post("/api/stepNoInput")
def step_no_input(body: dict = Body(...)):
    meaning = body.get('meaning', '')
    desc = body.get('desc', '')
    start_examples = body.get('start_examples', None)
    prompt = get_no_input_prompt(meaning, desc, start_examples)
    try:
        print("[AI PROMPT][noInput]", prompt)
    except Exception:
        pass

    openai_key = OPENAI_KEY or os.environ.get('OpenAI_key') or os.environ.get('OPENAI_KEY') or os.environ.get('openai_key')
    groq_key = os.environ.get('Groq_key') or os.environ.get('GROQ_API_KEY')

    try:
        ai = call_openai([
            {"role": "system", "content": "Always reply in English."},
            {"role": "user", "content": prompt}
        ])
        try:
            print("[AI ANSWER][noInput]", ai)
        except Exception:
            pass
        try:
            ai_obj = json.loads(ai)
            return {"ai": ai_obj}
        except Exception:
            pass
        if groq_key:
            ai = call_groq([
                {"role": "system", "content": "Always reply in English."},
                {"role": "user", "content": prompt}
            ])
            try:
                ai_obj = json.loads(ai)
                return {"ai": ai_obj}
            except Exception:
                pass
        raise HTTPException(status_code=500, detail="invalid_ai_json")
    except Exception:
        if groq_key:
            try:
                ai = call_groq([
                    {"role": "system", "content": "Always reply in English."},
                    {"role": "user", "content": prompt}
                ])
                try:
                    ai_obj = json.loads(ai)
                    return {"ai": ai_obj}
                except Exception:
                    pass
            except Exception:
                pass
        raise HTTPException(status_code=500, detail="ai_call_failed")