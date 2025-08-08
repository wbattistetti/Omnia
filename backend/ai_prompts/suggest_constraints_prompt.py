def get_suggest_constraints_prompt(schema_json: str):
    return f"""
You are a data validation designer.

Task:
- Receive a JSON schema tree describing dialogue data (object with "label" and an array "mains"). Each main has: label, type, optional icon, and optional subData (array of the same shape).
- Return the SAME structure enriched with a constraints array on any node (main or subData) where appropriate.

Requirements:
- Keep all provided fields (label, type, icon, subData) unchanged.
- Add a "constraints" array where useful. Each constraint must be concise and self-explanatory.
- Use these constraint kinds where applicable:
  - required: boolean=true
  - range: min, max (numbers or dates in ISO if needed)
  - length: minLength, maxLength (strings)
  - regex: pattern (strings)
  - enum: values (array)
  - format: one of email, phone, url, postal_code, country_code, etc.
  - pastDate: boolean=true
  - futureDate: boolean=true
- For each constraint include:
  - kind: the constraint kind
  - title: a 1–2 word title (e.g., "Required", "1–31", "Email")
  - payoff: a short explanatory sentence, user-friendly
  - parameters as needed by kind (min, max, minLength, maxLength, pattern, values, format)

Important:
- Do NOT include any "required" constraint. Assume required-ness is enforced externally.

Guidance examples (do not hardcode; adapt to labels/types):
- If a label implies a day of month → range 1–31
- If a label implies a month number → range 1–12
- If a label implies a year of birth → pastDate or a sensible year range (e.g., min 1900)
- If a label implies postal code → format postal_code (country-independent)
- If a label implies email → format email
- If a label implies phone → format phone; country code can be separate as enum or format country_code

Output:
- Respond with JSON ONLY. Use the same root shape as input, with constraints arrays added.

Input schema:
{schema_json}
""" 