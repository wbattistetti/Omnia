def get_confirmation_prompt(meaning, desc, normal_examples=None):
    examples = ""
    if normal_examples:
        examples = "Here are examples of good 'start' messages:\n" + "\n".join(f"- {ex}" for ex in normal_examples) + "\n"
    return f"""
You are a conversational AI message generator.

{examples}Generate 2 escalation messages to confirm with the user the value for the data type: '{meaning}'.

Return ONLY a JSON array of 2 English strings, no explanations, no comments, no IDs.
""" 