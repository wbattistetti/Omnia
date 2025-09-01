from fastapi import APIRouter, Body, HTTPException
import json
from ai_prompts.detect_type_prompt import get_detect_type_prompt
from call_groq import call_groq

router = APIRouter()

@router.post("/step2")
def step2(user_desc: str = Body(...)):
    prompt = get_detect_type_prompt(user_desc)
    print("[AI PROMPT][detectSchema]", prompt)
    try:
        ai = call_groq([
            {"role": "system", "content": "Always reply in English."},
            {"role": "user", "content": prompt}
        ])
    except Exception as e:
        print("[AI ERROR][detectSchema]", str(e))
        raise HTTPException(status_code=502, detail=f"AI provider error: {str(e)}")
    print("[AI ANSWER][detectSchema]", ai)
    try:
        ai_obj = json.loads(ai)
        # New schema-aware shape: { label, mains: [...] }
        if isinstance(ai_obj, dict) and 'mains' in ai_obj and 'label' in ai_obj:
            # Preserve icons if present on mains and subData
            mains = ai_obj.get('mains') or []
            def norm_node(n):
                return {
                    'label': n.get('label'),
                    'type': n.get('type'),
                    'icon': n.get('icon'),
                    'subData': [
                        {
                            'label': s.get('label'),
                            'type': s.get('type'),
                            'icon': s.get('icon'),
                            'subData': s.get('subData') or []
                        } for s in (n.get('subData') or [])
                    ]
                }
            schema = {
                'label': ai_obj.get('label') or 'Data',
                'mainData': [norm_node(m) for m in mains]
            }
            normalized = {
                'type': schema['label'],            # backward compatibility
                'icon': ai_obj.get('icon') or 'HelpCircle',
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