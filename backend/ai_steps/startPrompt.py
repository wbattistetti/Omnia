from fastapi import APIRouter, Body
import json
from ai_prompts.start_prompt import get_start_prompt
from call_groq import call_groq

router = APIRouter()

@router.post("/api/startPrompt")
def start_prompt(body: dict = Body(...)):
    meaning = body.get('meaning', '')
    desc = body.get('desc', '')
    prompt = get_start_prompt(meaning, desc)
    print("[AI PROMPT][startPrompt]", prompt)
    ai = call_groq([
        {"role": "system", "content": "Always reply in English."},
        {"role": "user", "content": prompt}
    ])
    print("[AI ANSWER][startPrompt]", ai)
    try:
        ai_obj = json.loads(ai)
        return {"ai": ai_obj}
    except Exception as e:
        return {"error": f"Failed to parse AI JSON: {str(e)}"} 