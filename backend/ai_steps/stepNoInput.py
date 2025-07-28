from fastapi import APIRouter, Body
import json
from ai_prompts.no_input_prompt import get_no_input_prompt
from call_groq import call_groq

router = APIRouter()

@router.post("/api/stepNoInput")
def step_no_input(body: dict = Body(...)):
    meaning = body.get('meaning', '')
    desc = body.get('desc', '')
    start_examples = body.get('start_examples', None)
    prompt = get_no_input_prompt(meaning, desc, start_examples)
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