def get_confirmation_prompt(meaning, desc, normal_examples=None):
    examples = ""
    if normal_examples:
        examples = "Here are examples of good 'start' messages for context (do not repeat them verbatim):\n" + "\n".join(f"- {ex}" for ex in normal_examples) + "\n"
    return f"""
You are an enterprise customer‑care dialogue copywriter.

Goal:
- Generate 2 short confirmation questions for the collected value of: '{meaning}'.

Style:
- 2 variants; each 5–12 words; polite, professional.
- MUST include the placeholder {{input}} where the user's value will appear.
- MUST end with a question mark.
- No greetings, chit‑chat, exclamations, or sample values/names.
- English only.

Examples (use {{input}}):
- "Is this correct: {{input}}?"
- "Please confirm: {{input}}?"

{examples}Output:
- Return ONLY a JSON array of 2 English strings, no explanations, no comments, no IDs.
"""