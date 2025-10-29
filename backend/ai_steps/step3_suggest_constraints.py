from fastapi import APIRouter, Body
import json
from ai_prompts.suggest_constraints_prompt import get_suggest_constraints_prompt
from call_groq import call_groq

router = APIRouter()

@router.post("/step3")
def step3(schema: dict = Body(...)):
    # Accept the full schema and ask AI to enrich it with constraints
    schema_json = json.dumps(schema, ensure_ascii=False)
    prompt = get_suggest_constraints_prompt(schema_json)
    print("[AI PROMPT][constraints]", prompt)
    ai = call_groq([
        {"role": "system", "content": "Always reply in English."},
        {"role": "user", "content": prompt}
    ])
    print("[AI ANSWER][constraints]", ai)

    # Clean markdown code blocks before parsing
    def _clean_json_like(s: str) -> str:
        import re
        t = (s or "").strip()
        if t.startswith("```"):
            t = re.sub(r"^```[a-zA-Z]*\n", "", t)
            t = re.sub(r"\n```\s*$", "", t)
        # extract first {...} block if present
        m = re.search(r"\{[\s\S]*\}", t)
        if m:
            t = m.group(0)
        # remove trailing commas
        t = re.sub(r",\s*(\]|\})", r"\1", t)
        return t

    try:
        # Try strict JSON parse first with cleaned response
        cleaned = _clean_json_like(ai)
        ai_obj = json.loads(cleaned)
        # Normalize to schema with mainData
        if isinstance(ai_obj, dict):
            if 'mains' in ai_obj and 'label' in ai_obj:
                schema_norm = { 'label': ai_obj.get('label'), 'mainData': ai_obj.get('mains') }
            elif 'mainData' in ai_obj and 'label' in ai_obj:
                schema_norm = ai_obj
            else:
                # If AI returned only mains, wrap
                mains = ai_obj.get('mains') or []
                lbl = ai_obj.get('label') or 'Data'
                schema_norm = { 'label': lbl, 'mainData': mains }
            return {"ai": {"schema": schema_norm}}
        return {"error": "Invalid AI constraints response"}
    except Exception as e:
        # Fallback: attempt to extract JSON object substring
        try:
            print("[AI PARSE][constraints] strict parse failed, attempting substring extraction")
            if not ai or not isinstance(ai, str):
                raise ValueError("Empty AI response")
            start = ai.find('{')
            end = ai.rfind('}')
            if start == -1 or end == -1 or end <= start:
                raise ValueError("No JSON object found")
            snippet = ai[start:end+1]
            ai_obj = json.loads(snippet)
            if isinstance(ai_obj, dict):
                if 'mains' in ai_obj and 'label' in ai_obj:
                    schema_norm = { 'label': ai_obj.get('label'), 'mainData': ai_obj.get('mains') }
                elif 'mainData' in ai_obj and 'label' in ai_obj:
                    schema_norm = ai_obj
                else:
                    mains = ai_obj.get('mains') or []
                    lbl = ai_obj.get('label') or 'Data'
                    schema_norm = { 'label': lbl, 'mainData': mains }
                return {"ai": {"schema": schema_norm}}
            return {"error": "Invalid AI constraints response"}
        except Exception as e2:
            # Ultimate fallback: return the input schema (no constraints) so UI stays consistent
            try:
                orig = json.loads(schema_json)
                fallback = { 'label': orig.get('label') or 'Data', 'mainData': orig.get('mains') or [] }
                print("[AI PARSE][constraints] returning fallback schema without constraints")
                return {"ai": {"schema": fallback}, "warning": f"Failed to parse AI JSON: {str(e2)}"}
            except Exception:
                return {"error": f"Failed to parse AI JSON: {str(e)}"}