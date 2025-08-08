from fastapi import APIRouter, Body
import json
from ai_prompts.no_match_prompt import get_no_match_prompt
from call_groq import call_groq

router = APIRouter()

@router.post("/api/stepNoMatch")
def step_no_match(body: dict = Body(...)):
    meaning = body.get('meaning', '')
    desc = body.get('desc', '')
    start_examples = body.get('start_examples', None)
    prompt = get_no_match_prompt(meaning, desc, start_examples)
    print("[AI PROMPT][noMatch]", prompt)
    ai = call_groq([
        {"role": "system", "content": "Always reply in English."},
        {"role": "user", "content": prompt}
    ])
    print("[AI ANSWER][noMatch]", ai)
    try:
        ai_obj = json.loads(ai)
        return {"ai": ai_obj}
    except Exception as e:
        return {"error": f"Failed to parse AI JSON: {str(e)}"} 