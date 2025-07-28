def get_start_prompt(meaning, desc):
    return f"""
You are a conversational AI message generator.

Generate 1 message to start the conversation for the data type: '{meaning}'.

Return ONLY a JSON array with 1 English string, no explanations, no comments, no IDs.
""" 