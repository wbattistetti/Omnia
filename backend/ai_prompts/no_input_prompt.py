def get_no_input_prompt(meaning, desc, normal_examples=None):
    examples = ""
    if normal_examples:
        examples = "Here are examples of good 'start' messages for context (do not repeat them verbatim):\n" + "\n".join(f"- {ex}" for ex in normal_examples) + "\n"
    return f"""
You are an enterprise customer‑care dialogue copywriter.

Goal:
- Generate 3 short re‑ask messages when the user provided no input for: '{meaning}'.

Style:
- 3 variants; each 3–10 words; polite and professional.
- Must be direct requests; end with a question mark.
- No greetings, chit‑chat, jokes, exclamations, or sample values/names.
- If the field is composite and a specific part is missing, allow targeted prompts like "Day?", "Month?", "Year?", "Street?", "City?".
- English only.

Examples (re‑ask variants):
- "Sorry, could you repeat?"
- "Please say it again?"
- "I didn't catch that, repeat please?"

{examples}Output:
- Return ONLY a JSON array of 3 English strings, no explanations, no comments, no IDs.
"""