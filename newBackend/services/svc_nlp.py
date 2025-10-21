from typing import Any
from fastapi import Body, HTTPException
from newBackend.services.svc_ai_client import chat_json, chat_text
from newBackend.core.core_json_utils import _safe_json_loads
from newBackend.aiprompts.prm_registry import render
import sys

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
            print("✓ Import from backend.type_template_manager successful")
        except ImportError as e:
            print(f"✗ Import from backend failed: {e}")
            from type_template_manager import get_localized_template, get_available_types, load_templates
            print("✓ Import from type_template_manager successful")
        
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
        
        # [Resto della logica step2...]
        print("Returning mock response for testing...")
        return {"ai": {"type": "text", "schema": {"mainData": [{"label": "Data", "type": "text"}]}}}
        
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
    # [Logica step4...]
    return {"messages": []}

def step5(constraint_json: dict) -> dict:
    """Step 5: Generate validation scripts"""
    print("\nSTEP: /step5 – Generate validation scripts (generateValidationScripts)")
    # [Logica step5...]
    return {"scripts": []}
