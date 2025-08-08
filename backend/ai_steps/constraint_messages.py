from fastapi import APIRouter, Body
import json
from ai_prompts.constraint_messages_prompt import get_constraint_messages_prompt
from call_groq import call_groq

router = APIRouter()

@router.post("/api/constraintMessages")
def constraint_messages(datum: dict = Body(...)):
    prompt = get_constraint_messages_prompt(json.dumps(datum, ensure_ascii=False))
    print("[AI PROMPT][constraintMessages]", prompt)
    ai = call_groq([
        {"role": "system", "content": "Always reply in English."},
        {"role": "user", "content": prompt}
    ])
    print("[AI ANSWER][constraintMessages]", ai)
    try:
        obj = json.loads(ai)
        return {"ai": obj}
    except Exception as e:
        return {"error": f"Failed to parse AI JSON: {str(e)}"}


