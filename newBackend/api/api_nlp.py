from fastapi import APIRouter, Body
from newBackend.services import svc_nlp
from typing import Any
import re

router = APIRouter(tags=["nlp"])

@router.post("/step2")
def step2(body: Any = Body(...)):
    # Handle both string and dictionary input
    if isinstance(body, str):
        # Convert string to expected dictionary format
        return svc_nlp.step2({"text": body})
    elif isinstance(body, dict):
        return svc_nlp.step2(body)
    else:
        # Handle other types by converting to string
        return svc_nlp.step2({"text": str(body)})

@router.post("/step3")
def step3(body: dict = Body(...)):
    return svc_nlp.step3(body)

@router.post("/step4")
def step4(body: dict = Body(...)):
    return svc_nlp.step4(body)

@router.post("/step5")
def step5(body: dict = Body(...)):
    return svc_nlp.step5(body)

@router.post("/api/nlp/refine-extractor")
def refine_extractor(body: dict = Body(...)):
    """
    Refine TypeScript extractor code based on user feedback and improvements
    """
    return svc_nlp.refine_extractor(body)

@router.post("/api/nlp/generate-regex")
def generate_regex(body: dict = Body(...)):
    """
    Generate a regex pattern from a natural language description
    """
    from newBackend.services.svc_ai_client import chat_json
    from newBackend.core.core_settings import OPENAI_KEY
    
    description = (body or {}).get("description", "").strip()
    if not description:
        return {"error": "Description is required"}
    
    if not OPENAI_KEY:
        return {"error": "OPENAI_KEY not configured"}
    
    prompt = f"""
You are a regex expert. Generate a JavaScript-compatible regular expression pattern based on the user's description.

User description: "{description}"

Requirements:
1. Generate a regex pattern that matches the described pattern
2. Escape special characters properly for JavaScript (use \\\\ for backslashes)
3. Provide a clear explanation of what the regex matches
4. Include 2-3 realistic examples that match the pattern
5. Consider edge cases and common variations
6. For Italian contexts, consider Italian formats (phone numbers, postal codes, etc.)

Return ONLY a strict JSON object with this format (no markdown, no extra text):
{{
  "regex": "your-regex-pattern-here",
  "explanation": "Clear explanation of what this regex matches",
  "examples": ["example1", "example2", "example3"],
  "flags": "gi"
}}

Common patterns for reference:
- Email: [a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{{2,}}
- Italian phone: \\\\+39\\\\s?\\\\d{{3}}\\\\s?\\\\d{{3}}\\\\s?\\\\d{{4}}
- Italian postal code (CAP): \\\\d{{5}}
- Italian tax code (CF): [A-Z]{{6}}\\\\d{{2}}[A-Z]\\\\d{{2}}[A-Z]\\\\d{{3}}[A-Z]
- Date (dd/mm/yyyy): \\\\d{{2}}/\\\\d{{2}}/\\\\d{{4}}
- Number: -?\\\\d+(?:[.,]\\\\d+)?
- URL: https?://[^\\\\s/$.?#].[^\\\\s]*
- Italian VAT (P.IVA): \\\\d{{11}}

Be precise and practical. Test mentally that your regex works correctly.
"""
    
    try:
        ai_response = chat_json([
            {"role": "system", "content": "You are a regex expert. Always return valid JSON."},
            {"role": "user", "content": prompt}
        ], provider="openai")
        
        # Parse response
        if isinstance(ai_response, str):
            import json
            result = json.loads(ai_response)
        else:
            result = ai_response
        
        # Validate regex can be compiled
        try:
            re.compile(result.get('regex', ''))
        except Exception as regex_error:
            result['warning'] = f"Generated regex may be invalid: {str(regex_error)}"
        
        return {
            "success": True,
            "regex": result.get('regex', ''),
            "explanation": result.get('explanation', ''),
            "examples": result.get('examples', []),
            "flags": result.get('flags', 'g')
        }
        
    except Exception as e:
        return {"error": f"Error generating regex: {str(e)}"}
