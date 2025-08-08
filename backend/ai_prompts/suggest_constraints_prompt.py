def get_suggest_constraints_prompt(meaning, desc):
    return f"""You are a data validation assistant.

Given a data field meaning, suggest appropriate validation constraints for the field and, only when applicable, for its subfields.

Rules:
- Treat the provided meaning as the user-facing label of the main field.
- Include subData ONLY if the meaning naturally implies a composite structure:
  - If meaning is "address" (case-insensitive), use subData: ["street", "city", "postal_code", "country"].
  - If meaning is "date" or "date of birth" (case-insensitive), use subData: ["Day", "Month", "Year"].
  - Otherwise, do not invent subData unless it is clearly implied by the meaning.
- Each subData item MUST include a "label" (English).

For each field (main and subfields), suggest a list of constraints in this format:
[
  {{
    "type": "required",
    "label": "Required",
    "description": "This field must be filled in.",
    "payoff": "Ensures the user provides this value."
  }},
  ...
]

Respond ONLY with a JSON object in this exact format:
{{
  "mainData": {{
    "label": "{meaning}",
    "constraints": [ ... ],
    "subData": [
      {{ "label": "<subLabel>", "constraints": [ ... ] }}
    ]
  }}
}}

Do NOT generate any id or GUID. Do NOT include explanations or comments outside the JSON. All messages and labels must be in English.
""" 