from fastapi import APIRouter, Body
import json
from ai_prompts.suggest_constraints_prompt import get_suggest_constraints_prompt
from call_groq import call_groq

router = APIRouter()

@router.post("/step3")
def step3(meaning: str = Body(...), desc: str = Body(...)):
    prompt = get_suggest_constraints_prompt(meaning, desc)
    print("AI PROMPT ================")
    print(prompt)
    ai = call_groq([
        {"role": "system", "content": "Always reply in English."},
        {"role": "user", "content": prompt}
    ])
    print("AI ANSWER ================")
    print(ai)
    try:
        ai_obj = json.loads(ai)
        return {"ai": ai_obj}
    except Exception as e:
        return {"error": f"Failed to parse AI JSON: {str(e)}"} 