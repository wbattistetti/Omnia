def get_generate_validator_prompt(datum_json: str):
    return f"""
You will produce a TypeScript validator for a single datum and its constraints.

Input:
- A JSON object describing one datum: {{ label, type, constraints: [{{ id, kind, title, payoff, ...params }}] }}

Task:
- Implement a pure function validate(value: any, ctx: any): {{ ok: boolean, errors: Array<{{ constraintId: string, messageKey: string }}> }}
- For each constraint (exclude kind="required"), add appropriate checks.
- Use message keys of the pattern: "c.<normalizedLabel>.<constraintId>"

Output JSON ONLY:
{{
  "validatorTs": "<escaped TypeScript source>",
  "messages": {{ "<messageKey>": "Short user facing message", "example": "..." }},
  "notes": [ {{ "constraintId": "...", "rule": "succinct rule summary" }} ]
}}

Rules:
- English only. No imports. No external libs.
- No console output. Deterministic logic.

Datum:
{datum_json}
"""


