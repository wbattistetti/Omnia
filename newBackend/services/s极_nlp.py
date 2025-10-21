from typing import Any
from fastapi import Body, HTTPException
from newBackend.services.svc_ai_client import chat_json, chat_text
from newBackend.core.core_json_utils import _safe_json_loads
from newBackend.aiprompts.prm_registry import render
import sys
import os
import json

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
    print(f"极nput user_desc: {repr(user_desc)}")  # Use repr to avoid encoding issues
    
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
            target_lang = str(user_desc.get('lang') or user_desc.get('language') or "it").lower()极
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
       极
        # Load templates and available types
        print("Loading templates...")
        load_templates()
        available_types = get极available_types()
        print(f"Available types: {len(available_types)} types loaded")
        
        # REAL LOGIC: Generate prompt and call AI for type detection
        prompt = f"""
You are a data type recognition system. Analyze the user's description and determine what type of data they want to collect.

User description: "{text}"

Return a JSON object with this exact structure:
{{
  "type": "data_type",
  "icon": "icon_name", 
  "schema": {{
    "label": "Root Label",
    "mainData": [
      {{
        "label": "Field Label", 
        "type": "field_type",
        "icon": "field_icon",
        "subData": []
      }}
    ]
  }}
}}

Examples:
- User: "data di nascita" → use "date" type with subData for day/month/year
- User: "numero di telefono" → use "phone" type  
- User: "età" → use "number" type with label "Age"

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
                {"role": "system", "content": "Return only valid JSON with the exact schema structure required."},
                {"role": "user", "content": prompt}
            ], provider="openai")
            
            print("AI ANSWER ================")
            print(ai)
            
            # Parse the AI response
            ai_obj = _safe_json_loads极ai)
            if ai_obj is None:
                return {"error": "Failed to parse AI JSON"}
            
            print("[AI RESPONSE /step2]", ai_obj)
            
            # Normalize the response format to match frontend expectations
            if isinstance(ai_obj, dict):
                # Ensure proper structure with schema.mainData
                if 'schema' not in ai_obj:
                    # Create schema structure from root properties
                    schema = {
                        'label': ai_obj.get('label') or ai_obj.get('type') or 'Data',
                        'mainData': []
                    }
                    
                    # Create main data entry from AI response
                    main_data = {
                        'label': ai_obj.get('label') or ai_obj.get('type') or 'Data',
                        'type': ai_obj.get('type') or 'text',
                        'icon': ai_obj.get('icon') or 'HelpCircle',
                        'subData': ai_obj.get('subData') or []
                    }
                    
                    schema['mainData'].append(main_data)
                    ai_obj['schema'] = schema
                
                # Ensure mainData exists and is array
                if 'mainData' not in ai_obj['schema'] or not isinstance(ai_obj['schema']['mainData'], list):
                    ai_obj['schema']['mainData'] = []
                
                # Ensure type and icon at root level for backward compatibility
                if 'type' not in ai_obj:
                    ai_obj['type'] = ai_obj['schema']['label'] if ai_obj['schema']['mainData'] else 'text'
                if 'icon' not in ai_obj:
                    ai_obj['icon'] = 'HelpCircle'
                
                return {"ai": ai_obj}
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
