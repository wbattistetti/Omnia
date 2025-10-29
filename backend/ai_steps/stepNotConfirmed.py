from fastapi import APIRouter, Body
import json
import re
from call_groq import call_groq

router = APIRouter()

def _clean_json_like(s: str) -> str:
    t = (s or "").strip()
    if t.startswith("```"):
        t = re.sub(r"^```[a-zA-Z]*\n", "", t)
        t = re.sub(r"\n```\s*$", "", t)
    # extract first [...] block if present
    m = re.search(r"\[[\s\S]*\]", t)
    if m:
        t = m.group(0)
    # remove trailing commas
    t = re.sub(r",\s*(\]|\})", r"\1", t)
    return t

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
        cleaned = _clean_json_like(ai)
        ai_obj = json.loads(cleaned)
        return {"ai": ai_obj}
    except Exception as e:
        return {"error": f"Failed to parse AI JSON: {str(e)}"}


