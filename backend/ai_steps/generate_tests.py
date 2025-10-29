from fastapi import APIRouter, Body
import json
import re
from ai_prompts.generate_tests_prompt import get_generate_tests_prompt
from call_groq import call_groq

router = APIRouter()

def _clean_json_like(s: str) -> str:
    t = (s or "").strip()
    if t.startswith("```"):
        t = re.sub(r"^```[a-zA-Z]*\n", "", t)
        t = re.sub(r"\n```\s*$", "", t)
    # extract first [...] or {...} block if present
    m = re.search(r"(\[[\s\S]*\]|\{[\s\S]*\})", t)
    if m:
        t = m.group(0)
    # remove trailing commas
    t = re.sub(r",\s*(\]|\})", r"\1", t)
    return t

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
        cleaned = _clean_json_like(ai)
        obj = json.loads(cleaned)
        return {"ai": obj}
    except Exception as e:
        return {"error": f"Failed to parse AI JSON: {str(e)}"}


