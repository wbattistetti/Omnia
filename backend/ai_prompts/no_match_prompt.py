def get_no_match_prompt(meaning, desc, normal_examples=None):
    examples = ""
    if normal_examples:
        examples = "Here are examples of good 'start' messages for context (do not repeat them verbatim):\n" + "\n".join(f"- {ex}" for ex in normal_examples) + "\n"
    return f"""
You are an enterprise customer‑care dialogue copywriter.

Goal:
- Generate 3 short messages to use when the user's input does not match the expected data type: '{meaning}'.

Style:
- 3 variants; each 4–12 words; polite and professional.
- Must clarify and re‑ask; end with a question mark.
- No greetings, chit‑chat, jokes, exclamations, or sample values/names.
- If the field is composite and a specific part is unclear, allow targeted prompts like "Day?", "Month?", "Year?", "Street?", "City?".
- English only.

Examples (clarify + re‑ask):
- "I couldn't parse that. Could you repeat?"
- "That doesn't look valid. Please repeat?"
- "I didn't catch it. Say it again?"

{examples}Output:
- Return ONLY a JSON array of 3 English strings, no explanations, no comments, no IDs.
"""