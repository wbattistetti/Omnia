from fastapi import APIRouter, Body
import json
from call_groq import call_groq

router = APIRouter()

@router.post("/api/stepNotConfirmed")
def step_not_confirmed(body: dict = Body(...)):
    meaning = body.get('meaning', '')
    desc = body.get('desc', '')
    prompt = f"""
You are a conversational AI message generator.

Generate 2 helpful recovery prompts to use when the user answered NO to the confirmation for the data type: '{meaning}'.
Prompts should guide the user to correct what is wrong concisely.

Return ONLY a JSON array of 2 English strings, no explanations, no comments, no IDs.
"""
    ai = call_groq([
        {"role": "system", "content": "Always reply in English."},
        {"role": "user", "content": prompt}
    ])
    try:
        ai_obj = json.loads(ai)
        return {"ai": ai_obj}
    except Exception as e:
        return {"error": f"Failed to parse AI JSON: {str(e)}"}


