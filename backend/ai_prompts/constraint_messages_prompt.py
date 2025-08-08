def get_constraint_messages_prompt(datum_json: str):
    return f"""
You are designing escalation messages for validation rule violations.

Input:
- A JSON object describing one datum: {{ label, type, constraints: [{{ id, kind, title, payoff, ...params }}] }}

Task:
- For each constraint (exclude kind="required"), generate TWO short recovery messages (r1 and r2):
  - r1: short, polite, actionable; restate the rule briefly
  - r2: stronger guidance; include concrete boundaries/pattern examples

Output JSON ONLY, no prose:
{{
  "messages": [
    {{ "constraintId": "...", "r1": {{ "title": "...", "payoff": "...", "messageKey": "..." }}, "r2": {{ "title": "...", "payoff": "...", "messageKey": "..." }} }}
  ]
}}

Rules:
- Titles are 1–2 words; payoff is one sentence.
- English only. No IDs other than provided constraintId. Use succinct, clear language.
- Do not include any other fields.

Datum:
{datum_json}
"""


