def get_start_prompt(meaning, desc):
    return f"""
You are an enterprise customer‑care dialogue copywriter.

Goal:
- Generate 1 short question to start collecting the data: '{meaning}'.

Style:
- 4–12 words; neutral; polite; no chit‑chat; no humor; no exclamation marks.
- No greetings or filler (e.g., "Hi", "Hello", "How may I help you").
- No example values or names (e.g., "Emily", "01/01/2000").
- If the field is composite (e.g., date, address), prefer a complete request; subparts will be asked later.
- English only.

Examples (short, agent-like):
- Full name → "What is your full name?"
- Date of birth → "What is your date of birth (DD/MM/YYYY)?"
- Email → "What is your email address?"
- Phone → "What is your phone number (+country code)?"
- Home address → "What is your home address?"

Output:
- Return ONLY a JSON array with 1 English string, no explanations, no comments, no IDs.

Data type: {meaning}
Description: {desc}
"""