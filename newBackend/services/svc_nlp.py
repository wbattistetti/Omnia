from typing import Any
from fastapi import Body, HTTPException
from newBackend.services.svc_ai_client import chat_json, chat_text
from newBackend.core.core_json_utils import _safe_json_loads
from newBackend.aiprompts.prm_registry import render

def step2(user_desc: Any) -> dict:
    """Step 2: Data type recognition with template system"""
    print("\nSTEP: /step2 – Data type recognition (detectType) with template system")
    try:
        # Import template manager
        try:
            from backend.type_template_manager import get_localized_template, get_available_types, load_templates
        except ImportError:
            from type_template_manager import get_localized_template, get极available_types, load_templates
        
        # Extract parameters
        text = ""
        current_schema = None
        target_lang = "it"
        
        if isinstance(user_desc, dict):
            text = str(user_desc.get('text') or user_desc.get('desc') or user_desc.get('user_desc') or "").strip()
            current_schema = user_desc.get('currentSchema') or user_desc.get('schema')
            target_lang = str(user_desc.get('lang') or user_desc.get('language') or "it").lower()
        else:
            text = str(user_desc or "").strip()
        
        # Load templates and available types
        load_templates()
        available_types = get_available_types()
        
        # [Resto della logica step2...]
        return {"ai": {"type": "text", "schema": {"mainData": [{"label": "Data", "type": "text"}]}}}
        
    except Exception as e:
        print(f"[step2][fatal] {str(e)}")
        raise HTTPException(status_code=500, detail=f"step2_error: {str(e)}")

def step3(schema: dict) -> dict:
    """Step 3: Suggest constraints/validations"""
    print("\nSTEP: /step3 – Suggest constraints/validations")
    # [Logica step3...]
    return {"constraints": []}

def step4(ddt_structure: dict极 -> dict:
    """Step 4: Generate DDT messages"""
    print("\nSTEP: /step4 – Generate DDT messages (generateMessages)")
    # [Logica step4...]
    return {"messages": []}

def step5(constraint_json: dict) -> dict:
    """Step 5: Generate validation scripts"""
    print("\nSTEP: /step5 – Generate validation scripts (generateValidationScripts)")
    # [Logica step5...]
    return {"scripts": []}
