def get_detect_type_prompt(user_desc, available_templates=None):
    templates_context = ""
    if available_templates:
        templates_context = f"""
Available Templates:
{json.dumps(available_templates, indent=2)}

Template Intelligence Rules:
1. EXACT MATCH: If user request matches an existing template exactly, use it
2. COMPOSITION: If user request can be built from existing templates, compose them
3. NEW TEMPLATE: Only create new template if no existing template fits

Examples:
- "data di nascita" → use existing "date" template
- "dati personali" → compose "name" + "date" + "address" + "phone" + "email"
- "dati del veicolo" → create new "vehicle" template with subData: ["brand", "model", "year", "plate"]
"""
    
    return f"""
You are an intelligent data structure analyzer and template creator.

User Request: "{user_desc}"

{templates_context}

Analysis Process:
1. Check if existing templates match exactly
2. Check if you can compose from existing templates
3. If neither works, CREATE NEW TEMPLATES with complete structure

Response Format:
{{
  "action": "use_existing|compose|create_new",
  "template_source": "<template_name_if_using_existing>",
  "composed_from": ["<template1>", "<template2>"] // if creating aggregate
  "proposed_templates": [ // if creating new templates
    {{
      "name": "template_name",
      "label": "Human Readable Label",
      "type": "template_type",
      "icon": "LucideIconName",
      "description": "What this template is for",
      "subData": [
        {{
          "label": "Sub Data Label",
          "type": "data_type",
          "icon": "IconName",
          "constraints": [
            {{"type": "required"}},
            {{"type": "minLength", "value": 2}},
            {{"type": "maxLength", "value": 50}}
          ]
        }}
      ]
    }}
  ],
  "requires_approval": true, // if creating new templates
  "reason": "Explanation of decision and what templates are needed",
  "label": "<Main label>",
  "type": "<type_name>",
  "icon": "<icon_name>",
  "mains": [ // for backward compatibility
    {{
      "label": "<field label>",
      "type": "text|number|date|email|phone|address|boolean|object",
      "icon": "<Lucide icon name>",
      "subData": [...]
    }}
  ]
}}

Rules:
1. ALWAYS try to reuse existing templates first
2. Create aggregates from existing templates when possible
3. When creating new templates, provide COMPLETE structure with:
   - Proper labels and descriptions
   - Appropriate icons
   - Realistic constraints
   - Logical sub-data structure
4. Be creative but practical
5. Explain why each template is needed
6. Maintain backward compatibility with existing format
""" 