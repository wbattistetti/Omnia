def get_no_input_prompt(meaning, desc, normal_examples=None):
    examples = ""
    if normal_examples:
        examples = "Here are examples of good 'start' messages:\n" + "\n".join(f"- {ex}" for ex in normal_examples) + "\n"
    return f"""
You are a conversational AI message generator.

{examples}Generate 3 escalation messages to use when the user provides no input for the expected data type: '{meaning}'.

Return ONLY a JSON array of 3 English strings, no explanations, no comments, no IDs.
""" 