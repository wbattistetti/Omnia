from typing import Any
from fastapi import Body, HTTPException
from newBackend.services.svc_ai_client import chat_json, chat_text
from newBackend.core.core_json_utils import _safe_json_loads
from newBackend.aiprompts.prm_registry import render
import sys
import os
import json
import re
import difflib
import logging

# Setup logging
log = logging.getLogger(__name__)

# System message for refine extractor
REFINE_SYSTEM_MSG = (
    "You are a senior TypeScript engineer. Refine the user's extractor code. "
    "Keep the public API identical unless requested. Preserve types, avoid new deps. "
    "Return ONLY a single JSON object with the schema provided, no prose."
)

def _build_refine_prompt(code: str, language: str = "typescript", goals: list = None, 
                         constraints: list = None, style: str = None, user_notes: str = None) -> str:
    """Build prompt for code refinement"""
    goals = goals or []
    constraints = constraints or []
    goals_s = "\n".join(f"- {g}" for g in goals) or "- Keep behavior and types stable."
    constraints_s = "\n".join(f"- {c}" for c in constraints) or "- No external dependencies."
    style_s = f"- Style preference: {style}" if style else "- Keep existing style unless harmful."
    notes_s = f"\nAdditional notes:\n{user_notes}" if user_notes else ""
    
    return (
        f"Language: {language}\n\n"
        "Original code (between <<<CODE and CODE>>>):\n"
        "<<<CODE\n"
        f"{code}\n"
        "CODE>>>\n\n"
        "Goals:\n"
        f"{goals_s}\n"
        "Constraints:\n"
        f"{constraints_s}\n"
        f"{style_s}\n"
        f"{notes_s}\n\n"
        "Return strict JSON with keys: refined_code (string), changes_summary (string[]), "
        "diffs (string, unified diff against original), suggested_tests (string[]), "
        "warnings (string[]), confidence (number 0..1), metadata (object)."
    )

def _unified_diff(a: str, b: str) -> str:
    """Generate unified diff between two code versions"""
    a_lines = a.splitlines(keepends=True)
    b_lines = b.splitlines(keepends=True)
    return "".join(difflib.unified_diff(a_lines, b_lines, fromfile="original.ts", tofile="refined.ts"))

def refine_extractor(payload: dict) -> dict:
    """
    Refine TypeScript extractor code - compatible with existing architecture
    """
    code = payload.get("code") or ""
    language = payload.get("language") or "typescript"
    goals = payload.get("goals") or []
    constraints = payload.get("constraints") or []
    style = payload.get("style")
    user_notes = payload.get("user_notes")
    provider = payload.get("provider") or "openai"
    
    if not code.strip():
        return {
            "ok": False,
            "provider": provider,
            "result": {
                "refined_code": "",
                "changes_summary": [],
                "diffs": "",
                "suggested_tests": [],
                "warnings": ["Missing 'code' in request body"],
                "confidence": 0.0,
                "metadata": {"fallback": True}
            }
        }
    
    user_prompt = _build_refine_prompt(code, language, goals, constraints, style, user_notes)
    
    try:
        # Use existing chat_json function
        ai_response = chat_json([
            {"role": "system", "content": REFINE_SYSTEM_MSG},
            {"role": "user", "content": user_prompt}
        ], provider=provider)
        
        # Parse AI response - FIXED: chat_json returns string, not dict
        if isinstance(ai_response, str):
            data = _safe_json_loads(ai_response)  # Parse JSON string to dict
        else:
            data = ai_response  # Fallback if already dict
            
    except Exception as e:
        log.error(f"refine_extractor AI call failed: {e}")
        return {
            "ok": False,
            "provider": provider,
            "result": {
                "refined_code": code,
                "changes_summary": ["AI fallback: unable to refine, returning original code."],
                "diffs": _unified_diff(code, code),
                "suggested_tests": [],
                "warnings": [f"Refine failure: {str(e)}"],
                "confidence": 0.0,
                "metadata": {"fallback": True}
            }
        }
    
    # Extract and normalize response
    refined_code = data.get("refined_code") or code
    changes_summary = list(data.get("changes_summary") or [])
    suggested_tests = list(data.get("suggested_tests") or [])
    warnings = list(data.get("warnings") or [])
    
    # Generate diff if not provided
    diffs = data.get("diffs") or _unified_diff(code, refined_code)
    
    # Handle confidence score
    try:
        confidence = float(data.get("confidence") or 0.7)
    except (ValueError, TypeError):
        confidence = 0.7
        
    metadata = dict(data.get("metadata") or {})
    
    return {
        "ok": True,
        "provider": provider,
        "result": {
            "refined_code": refined_code,
            "changes_summary": changes_summary,
            "diffs": diffs,
            "suggested_tests": suggested_tests,
            "warnings": warnings,
            "confidence": confidence,
            "metadata": metadata
        }
    }

def step2(user_desc: Any) -> dict:
    """Step 2: Data type recognition with template system"""
    # Set proper encoding for stdout to handle Unicode characters
    if sys.stdout.encoding is None or sys.stdout.encoding.lower() != 'utf-8':
        try:
            sys.stdout.reconfigure(encoding='utf-8')
        except:
            pass
    
    print("\n=== STEP2 DEBUG LOG ===")
    print(f"Input user_desc type: {type(user_desc)}")
    print(f"Input user_desc: {repr(user_desc)}")  # Use repr to avoid encoding issues
    
    try:
        # Import template manager
        print("Attempting to import template manager...")
        try:
            from backend.type_template_manager import get_localized_template, get_available_types, load_templates
            print("Import from backend.type_template_manager successful")
        except ImportError as e:
            print(f"Import from backend failed: {e}")
            from type_template_manager import get_localized_template, get_available_types, load_templates
            print("Import from type_template_manager successful")
        
        # Extract parameters with proper encoding handling
        print("Extracting parameters...")
        text = ""
        current_schema = None
        target_lang = "it"
        
        if isinstance(user_desc, dict):
            print("user_desc is a dictionary")
            raw_text = user_desc.get('text') or user_desc.get('desc') or user_desc.get('user_desc') or ""
            # Handle Unicode characters properly
            if isinstance(raw_text, str):
                text = raw_text.strip()
            else:
                text = str(raw_text).strip()
            current_schema = user_desc.get('currentSchema') or user_desc.get('schema')
            target_lang = str(user_desc.get('lang') or user_desc.get('language') or "it").lower()
            print(f"Extracted text: '{repr(text)}'")  # Use repr to avoid encoding issues
            print(f"Extracted current_schema: {current_schema}")
            print(f"Extracted target_lang: {target_lang}")
        else:
            print("user_desc is NOT a dictionary")
            # Handle Unicode characters properly
            if isinstance(user_desc, str):
                text = user_desc.strip()
            else:
                text = str(user_desc or "").strip()
            print(f"Extracted text: '{repr(text)}'")  # Use repr to avoid encoding issues
        
        # Load templates and available types
        print("Loading templates...")
        load_templates()
        available_types = get_available_types()
        print(f"Available types: {len(available_types)} types loaded")
        
        # CORRECT PROMPT for step2: Simple type recognition
        prompt = f"""
Analyze this user description and determine what type of data they want to collect.

User description: "{text}"

Return a JSON object with this simple structure:
{{
  "type": "data_type",
  "icon": "icon_name",
  "label": "English Label"
}}

Common data types: "date", "phone", "email", "text", "number", "address"
Common icons: "Calendar", "Phone", "Mail", "Text", "Hash", "MapPin"

Examples:
- "data di nascita" → {{ "type": "date", "icon": "Calendar", "label": "Date of Birth" }}
- "numero di telefono" → {{ "type": "phone", "icon": "Phone", "label": "Phone Number" }}
- "età" → {{ "type": "number", "icon": "Hash", "label": "Age" }}
- "indirizzo email" → {{ "type": "email", "icon": "Mail", "label": "Email Address" }}

Return only valid JSON, no additional text.
"""
        
        print("AI PROMPT ================")
        print(prompt)
        
        # Use only OpenAI - no fallback to Groq
        openai_key = os.environ.get('OPENAI_KEY')
        
        if not openai_key:
            raise HTTPException(status_code=500, detail="OpenAI API key not configured. Please set OPENAI_KEY environment variable.")
        
        try:
            # Use OpenAI with the new provider parameter
            ai = chat_json([
                {"role": "system", "content": "Return only valid JSON for data type recognition."},
                {"role": "user", "content": prompt}
            ], provider="openai")
            
            print("AI ANSWER ================")
            print(ai)
            
            # Parse the AI response
            ai_obj = _safe_json_loads(ai)
            if ai_obj is None:
                return {"error": "Failed to parse AI JSON"}
            
            print("[AI RESPONSE /step2]", ai_obj)
            
            # Normalize the response format to match frontend expectations
            if isinstance(ai_obj, dict):
                # Ensure proper structure with schema.mainData for frontend compatibility
                schema = {
                    'label': ai_obj.get('label') or ai_obj.get('type') or 'Data',
                    'mainData': [
                        {
                            'label': ai_obj.get('label') or ai_obj.get('type') or 'Data',
                            'type': ai_obj.get('type') or 'text',
                            'icon': ai_obj.get('icon') or 'HelpCircle',
                            'subData': []
                        }
                    ]
                }
                
                # Create the final response structure expected by frontend
                final_response = {
                    'type': ai_obj.get('type') or 'text',
                    'icon': ai_obj.get('icon') or 'HelpCircle',
                    'schema': schema
                }
                
                return {"ai": final_response}
            else:
                return {"error": "unrecognized_data_type"}
            
        except Exception as e:
            print(f"[step2][AI error] {type(e).__name__}: {str(e)}")
            return {"error": "unrecognized_data_type"}
        
    except Exception as e:
        print(f"[step2][fatal] {type(e).__name__}: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"step2_error: {str(e)}")

def step3(schema: dict) -> dict:
    """Step 3: Suggest constraints/validations"""
    print("\nSTEP: /step3 – Suggest constraints/validations")
    # [Logica step3...]
    return {"constraints": []}

def step4(ddt_structure: dict) -> dict:
    """Step 4: Generate DDT messages"""
    print("\nSTEP: /step4 – Generate DDT messages (generateMessages)")
    
    # Build the prompt for message generation
    prompt = """
You are writing for a voice (phone) customer‑care agent.
Generate the agent's spoken messages to collect the data described by the DDT structure.

Style and constraints:
- One short sentence (about 4–12 words), natural, polite, human.
- Phone conversation tone: concise, fluid, not robotic.
- Prefer light contractions when natural (I'm, don't, can't).
- Neutral and professional; no chit‑chat, no opinions, no humor.
- NEVER ask about "favorite …" or "why".
- No emojis and no exclamation marks.
- Do NOT use UI words like "click", "type", "enter". Use "say/tell/give".
- NEVER output example values or names (e.g., "Emily", "01/01/2000", "Main Street").
- NEVER output greetings or generic help phrases (e.g., "How may I help you today").
- Use the field label; if the field is composite, ask ONLY the missing part (e.g., Day, Month, Year).
- Add compact format hints when useful: (DD/MM/YYYY), (YYYY), (email), (+country code).
- English only.

Output format (strict JSON only, no comments, no trailing commas):
"runtime.<DDT_ID>.<step>#<index>.<action>.text": "<message>"

Generation rules:
- start: 1 message per field/subfield. Example: "Please tell me your date of birth (DD/MM/YYYY)?"
- noInput: 3 concise re‑asks with natural variations. Example: "Could you share the date of birth (DD/MM/YYYY)?"
- noMatch: 3 concise clarifications with hint. Prefer voice phrasing like "I didn't catch that" over "I couldn't parse that". Example: "I didn't catch that. Date of birth (DD/MM/YYYY)?"
- confirmation: 2 short confirmations like "Is this correct: {{ '{input}' }}?"
- success: 1 short acknowledgement like "Thanks, got it."
- For subData (e.g., date): ask targeted parts — "Day?", "Month?", "Year?" (or "Which year (YYYY)?").
- For start, noInput, and noMatch: the text MUST directly ask for the value and MUST end with a question mark.
- Only confirmation messages may include the {{ '{input}' }} placeholder.

Avoid examples like:
- "What's your favorite year and why is it special?"

Where:
- <DDT_ID> is the unique ID of the DDT (use the value from the input).
- <step> is one of: start, noMatch, noInput, confirmation, success, or the name of a constraint (e.g., "required", "range").
- <index> is the escalation index (starting from 1).
- <action> is the action type (e.g., SayMessage, ConfirmInput), followed by a placeholder ID or suffix.
- Example: "runtime.DDT_Birthdate.noMatch#1.SayMessage_1.text"

IMPORTANT:
- DO NOT generate any IDs or GUIDs — use static suffixes like SayMessage_1.
- DO NOT include any explanation, markdown or comments, or text outside the JSON. If unsure, return an empty object.

Input DDT structure:
""" + str(ddt_structure)
    
    print("AI PROMPT ================")
    print(prompt)
    
    # Get API keys - prefer OpenAI
    openai_key = os.environ.get('OpenAI_key') or os.environ.get('OPENAI_KEY') or os.environ.get('openai_key')
    groq_key = os.environ.get('Groq_key') or os.environ.get('GROQ_API_KEY')
    
    try:
        if openai_key:
            # Use OpenAI first
            ai = chat_json([
                {"role": "system", "content": "Always reply in English."},
                {"role": "user", "content": prompt}
            ], provider="openai")
        elif groq_key:
            # Fallback to Groq
            ai = chat_json([
                {"role": "system", "content": "Always reply in English."},
                {"role": "user", "content": prompt}
            ], provider="groq")
        else:
            raise HTTPException(status_code=500, detail="No AI provider configured")
        
        print("AI ANSWER ================")
        print(ai)
        
        # Parse the AI response
        ai_obj = _safe_json_loads(ai)
        if ai_obj is None:
            return {"ai": {}, "error": "Failed to parse AI JSON"}
        
        print("[AI RESPONSE /step4]", ai_obj)
        return {"ai": ai_obj}
        
    except Exception as e:
        print(f"[step4][fatal] {type(e).__name__}: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"step4_error: {str(e)}")

def step5(constraint_json: dict) -> dict:
    """Step 5: Generate validation scripts"""
    print("\nSTEP: /step5 – Generate validation scripts (generateValidationScripts)")
    # [Logica step5...]
    return {"scripts": []}
