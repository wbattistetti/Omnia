def get_detect_type_prompt(user_desc):
    return f"""
You are a data schema designer.

Goal:
- Interpret the user's intent as either a SINGLE DATA FIELD or an AGGREGATE of multiple data fields (one or more groups).
- Return a TREE that captures the data structure, including composite fields (fields with sub-fields).

Output requirements:
- Respond with JSON ONLY, no comments, no IDs, no extra text.
- Use this exact structure:
{{
  "label": "<root label>",          // e.g., "Personal data" or the single field label
  "mains": [                        // array of top-level fields (one or many)
    {{
      "label": "<field label>",     // English human label, Title Case
      "type": "text|number|date|email|phone|boolean|object",
      "icon": "<Lucide icon name>", // e.g., User, MapPin, Calendar, Type, Mail, Phone, Hash, Globe, Home, Building, FileText
      "subData": [                  // optional; present only if the field is composite
        {{
          "label": "<sub field label>",
          "type": "text|number|date|email|phone|boolean|object",
          "icon": "<Lucide icon name>", // as above
          "subData": [ ... ]        // optional deeper nesting
        }}
      ]
    }}
  ]
}}

Rules:
- If the intent is an AGGREGATE (e.g., "Personal data"), return MULTIPLE top-level mains. Each main can be composite.
- Use common, meaningful composites where implied. For example:
  - "Full name" → subData: ["First name", "Last name"]
  - "Date of birth" → subData: ["Day", "Month", "Year"]
  - "Address" → subData: ["Street", "House number", "City", "Postal code", "Region/State", "Country"]
  - "Phone number" → subData: ["Country code", "Number"]
- If the intent is a SINGLE FIELD, return exactly one main. Add subData ONLY if the field naturally decomposes (e.g., a date).
- Labels must be in English, Title Case, concise and unambiguous.
- Prefer a compact, practical set of fields; avoid duplicates; 3–8 mains for broad aggregates is typical.
 - Do not generate any IDs, metadata, or descriptions.
 - Icons: choose a semantically appropriate Lucide icon name for each field and sub-field. Prefer among: User, MapPin, Calendar, Type, Mail, Phone, Hash, Globe, Home, Building, FileText, HelpCircle. If unsure, use FileText.

User intent: '{user_desc}'
""" 