def get_success_prompt(meaning, desc, normal_examples=None):
    examples = ""
    if normal_examples:
        examples = "Here are examples of good 'start' messages:\n" + "\n".join(f"- {ex}" for ex in normal_examples) + "\n"
    return f"""
You are a conversational AI message generator.

{examples}Generate 1 message to use when the user has successfully provided the expected data type: '{meaning}'.

Return ONLY a JSON array with 1 English string, no explanations, no comments, no IDs.
""" 