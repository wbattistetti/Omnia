def get_detect_type_prompt(user_desc):
    EN_MEANINGS = [
        'date of birth', 'email', 'phone number', 'address', 'number', 'text', 'boolean'
    ]
    ICON_LIST = [
        'Sparkles', 'CheckSquare', 'Hash', 'Type', 'IdCard', 'Gift', 'Phone', 'Calendar', 'Mail', 'HelpCircle', 'MapPin', 'FileQuestion'
    ]
    return f"""
You are a data type classifier and structure analyzer.

Given the following user intent (in English), extract the most specific data type from this list:
{EN_MEANINGS}

If the type is not included in the list, suggest a new one (in English).

Also, assign the most appropriate Lucide icon name from this list:
{ICON_LIST}

If no suitable icon is found, use 'HelpCircle'.

IMPORTANT: Analyze if the data type should be broken down into sub-components (subData). For example:
- "date of birth" → should have subData: ["day", "month", "year"]
- "address" → should have subData: ["street", "city", "postal_code", "country"]
- "phone number" → might have subData: ["country_code", "area_code", "number"]
- "email" → typically no subData needed
- "number" → typically no subData needed

Respond ONLY with a JSON object in this format:
{{ 
  "type": "<English label>", 
  "icon": "<Lucide icon name>",
  "subData": ["<subData1>", "<subData2>", ...] 
}}

If no subData is needed, use an empty array: "subData": []

User intent: '{user_desc}'
""" 