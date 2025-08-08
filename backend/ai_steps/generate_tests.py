from fastapi import APIRouter, Body
import json
from ai_prompts.generate_tests_prompt import get_generate_tests_prompt
from call_groq import call_groq

router = APIRouter()

@router.post("/api/testset")
def generate_tests(datum: dict = Body(...), notes: list = Body(default=[])):
    prompt = get_generate_tests_prompt(json.dumps(datum, ensure_ascii=False), json.dumps(notes, ensure_ascii=False))
    print("[AI PROMPT][testset]", prompt)
    ai = call_groq([
        {"role": "system", "content": "Always reply in English."},
        {"role": "user", "content": prompt}
    ])
    print("[AI ANSWER][testset]", ai)
    try:
        obj = json.loads(ai)
        return {"ai": obj}
    except Exception as e:
        return {"error": f"Failed to parse AI JSON: {str(e)}"}


