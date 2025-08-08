def get_generate_tests_prompt(datum_json: str, notes_json: str):
    return f"""
You will propose a comprehensive test set for a validator.

Inputs:
- datum: {{ label, type, constraints: [{{ id, kind, ...params }}] }}
- notes: array from the validator prompt: [ {{ constraintId, rule }} ]

Task:
- Produce boundary and near-boundary cases per constraint.
- Include combined-constraints interactions if multiple constraints exist.

Output JSON ONLY:
{{
  "cases": [ {{ "name": "...", "input": <value>, "expect": {{ "ok": boolean, "errors"?: [ {{ "constraintId": "..." }} ] }} }} ]
}}

Rules:
- English only. Keep cases concise but covering min, max, inside, outside, pattern match and mismatch as relevant.

Datum:
{datum_json}

Notes:
{notes_json}
"""


