from fastapi import APIRouter, Body
import json
from ai_prompts.detect_type_prompt import get_detect_type_prompt
from call_groq import call_groq

router = APIRouter()

@router.post("/step2")
def step2(user_desc: str = Body(...)):
    prompt = get_detect_type_prompt(user_desc)
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
        if not isinstance(ai_obj, dict) or 'type' not in ai_obj or 'icon' not in ai_obj:
            return {"error": "unrecognized_data_type"}
        if ai_obj['type'] == 'unrecognized_data_type':
            return {"error": "unrecognized_data_type"}
        
        # Ensure subData field exists (backward compatibility)
        if 'subData' not in ai_obj:
            ai_obj['subData'] = []
        
        return {"ai": ai_obj}
    except Exception:
        return {"error": "unrecognized_data_type"} 