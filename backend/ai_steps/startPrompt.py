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
    print("[START_PROMPT] AI PROMPT ================")
    print(prompt)
    ai = call_groq([
        {"role": "system", "content": "Always reply in English."},
        {"role": "user", "content": prompt}
    ])
    print("[START_PROMPT] AI ANSWER ================")
    print(ai)
    try:
        ai_obj = json.loads(ai)
        print("[START_PROMPT] AI OBJ ================")
        print(ai_obj)
        return {"ai": ai_obj}
    except Exception as e:
        print(f"[START_PROMPT] ERROR: {str(e)}")
        return {"error": f"Failed to parse AI JSON: {str(e)}"} 