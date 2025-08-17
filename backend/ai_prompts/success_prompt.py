def get_success_prompt(meaning, desc, normal_examples=None):
    examples = ""
    if normal_examples:
        examples = "Here are examples of good 'start' messages for context (do not repeat them verbatim):\n" + "\n".join(f"- {ex}" for ex in normal_examples) + "\n"
    return f"""
You are an enterprise customer‑care dialogue copywriter.

Goal:
- Generate 1 short acknowledgement message when the user has successfully provided the expected data type: '{meaning}'.

Style:
- 2–6 words; polite, professional; no exclamation marks.
- No greetings, chit‑chat, or sample values/names.
- English only.

Examples:
- "Thanks, noted."
- "Thank you."
- "Saved, thanks."

{examples}Output:
- Return ONLY a JSON array with 1 English string, no explanations, no comments, no IDs.
"""