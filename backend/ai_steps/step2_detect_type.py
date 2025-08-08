from fastapi import APIRouter, Body
import json
from ai_prompts.detect_type_prompt import get_detect_type_prompt
from call_groq import call_groq

router = APIRouter()

@router.post("/step2")
def step2(user_desc: str = Body(...)):
    prompt = get_detect_type_prompt(user_desc)
    print("[AI PROMPT][detectSchema]", prompt)
    ai = call_groq([
        {"role": "system", "content": "Always reply in English."},
        {"role": "user", "content": prompt}
    ])
    print("[AI ANSWER][detectSchema]", ai)
    try:
        ai_obj = json.loads(ai)
        # New schema-aware shape: { label, mains: [...] }
        if isinstance(ai_obj, dict) and 'mains' in ai_obj and 'label' in ai_obj:
            schema = {
                'label': ai_obj.get('label') or 'Data',
                'mainData': ai_obj.get('mains') or []
            }
            normalized = {
                'type': schema['label'],            # backward compatibility
                'icon': 'HelpCircle',               # default icon if not provided
                'schema': schema                    # normalized schema for frontend
            }
            return {"ai": normalized}

        # Fallback: legacy shape with type/icon
        if not isinstance(ai_obj, dict) or 'type' not in ai_obj or 'icon' not in ai_obj:
            return {"error": "unrecognized_data_type"}
        if ai_obj['type'] == 'unrecognized_data_type':
            return {"error": "unrecognized_data_type"}
        if 'subData' not in ai_obj:
            ai_obj['subData'] = []
        if 'label' not in ai_obj and 'type' in ai_obj:
            ai_obj['label'] = ai_obj['type']
        return {"ai": ai_obj}
    except Exception:
        return {"error": "unrecognized_data_type"} 