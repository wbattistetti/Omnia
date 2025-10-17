def get_detect_type_prompt(user_desc):
    return f"""
You are a data schema designer.

Goal:
- Interpret the user's intent and create a semantic data structure.
- Return a TREE with a MEANINGFUL, DESCRIPTIVE root label that captures the essence of the data being collected.

Output requirements:
- Respond with JSON ONLY, no comments, no IDs, no extra text.
- Use this exact structure:
{{
  "label": "<SEMANTIC ROOT LABEL>",  // CRITICAL: Use a descriptive, meaningful label based on context
                                      // ✅ GOOD: "Personal data", "Contact information", "Shipping details", "User profile"
                                      // ❌ AVOID: "Data", "Fields", "Information" (too generic)
  "mains": [                         // array of top-level fields (one or many)
    {{
      "label": "<field label>",      // English human label, Title Case
      "type": "text|number|date|email|phone|address|boolean|object",
      "icon": "<Lucide icon name>",  // e.g., User, MapPin, Calendar, Type, Mail, Phone, Hash, Globe, Home, Building, FileText
      "subData": [                   // optional; present only if the field is composite
        {{
          "label": "<sub field label>",
          "type": "text|number|date|email|phone|address|boolean|object",
          "icon": "<Lucide icon name>",
          "subData": [ ... ]         // optional deeper nesting
        }}
      ]
    }}
  ]
}}

Rules:
- **ROOT LABEL MUST BE SEMANTIC**: Analyze user intent and create a meaningful label.
  Examples:
    - "chiedi dati personali" → "Personal data"
    - "chiedi informazioni di contatto" → "Contact information"
    - "chiedi indirizzo di spedizione" → "Shipping address"
    - "chiedi età" → "Age information" (even for single fields, create a semantic container)
    
- If the intent is an AGGREGATE, return MULTIPLE top-level mains. Each main can be composite.
- Use common, meaningful composites where implied:
  - "Full name" → subData: ["First name", "Last name"]
  - "Date of birth" → subData: ["Day", "Month", "Year"]
  - "Address" → subData: ["Street", "Civic number", "Internal", "Postal code", "City", "Region", "Country"]
  - "Phone number" → subData: ["Country code", "Area code", "Number"]
  
- If the intent is a SINGLE FIELD, return exactly one main. Add subData ONLY if the field naturally decomposes.
- Labels must be in English, Title Case, concise and unambiguous.
- Prefer a compact, practical set of fields; avoid duplicates; 3–8 mains for broad aggregates is typical.
- Do not generate any IDs, metadata, or descriptions.
- Icons: choose a semantically appropriate Lucide icon name for each field and sub-field. 
  Prefer among: User, MapPin, Calendar, Type, Mail, Phone, Hash, Globe, Home, Building, FileText, Folder, HelpCircle. 
  If unsure, use FileText.

User intent: '{user_desc}'
""" 