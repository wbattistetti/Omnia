from fastapi import APIRouter, Body
import os
import json
from ai_prompts.start_prompt import get_start_prompt
from call_groq import call_groq

router = APIRouter()

@router.post("/api/startPrompt")
def start_prompt(body: dict = Body(...)):
    meaning = body.get('meaning', '')
    desc = body.get('desc', '')
    prompt = get_start_prompt(meaning, desc)
    try:
        print("[AI PROMPT][startPrompt]", str(prompt).encode('ascii', 'ignore').decode('ascii'))
    except Exception:
        pass

    try:
        if os.environ.get('Groq_key'):
            ai = call_groq([
                {"role": "system", "content": "Always reply in English."},
                {"role": "user", "content": prompt}
            ])
            try:
                print("[AI ANSWER][startPrompt]", str(ai).encode('ascii', 'ignore').decode('ascii'))
            except Exception:
                pass
            try:
                ai_obj = json.loads(ai)
                return {"ai": ai_obj}
            except Exception:
                # fall through to stub
                pass
        # Stub fallback (no key or parse failure)
        m = (meaning or '').lower()
        if 'phone' in m or 'telefono' in m:
            msgs = ["Please tell me your phone number (+country code)."]
        elif 'email' in m:
            msgs = ["Please tell me your email address."]
        elif 'date' in m or 'birth' in m or 'data' in m:
            msgs = ["Please tell me your date of birth (DD/MM/YYYY)."]
        else:
            msgs = ["Please tell me the value."]
        return {"ai": msgs}
    except Exception as e:
        return {"ai": ["Please tell me the value."]}