from fastapi import APIRouter, Body
import json
from ai_prompts.generate_validator_prompt import get_generate_validator_prompt
from call_groq import call_groq

router = APIRouter()

@router.post("/api/validator")
def generate_validator(datum: dict = Body(...)):
    prompt = get_generate_validator_prompt(json.dumps(datum, ensure_ascii=False))
    print("[AI PROMPT][validator]", prompt)
    ai = call_groq([
        {"role": "system", "content": "Always reply in English."},
        {"role": "user", "content": prompt}
    ])
    print("[AI ANSWER][validator]", ai)
    try:
        obj = json.loads(ai)
        return {"ai": obj}
    except Exception as e:
        return {"error": f"Failed to parse AI JSON: {str(e)}"}


