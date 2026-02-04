"""
Message Generalization Prompt Generator

Generates AI prompts for generalizing contextual messages into reusable template messages.
Used by the /api/nlp/generalize-messages endpoint.
"""

import json


def get_generalize_messages_prompt(
    contextual_messages: dict,
    contract: dict,
    node_label: str
) -> str:
    """
    Generate prompt for message generalization.

    Args:
        contextual_messages: Contextual messages from specific instance
        contract: SemanticContract object
        node_label: Node label for context

    Returns:
        Formatted prompt string for AI
    """
    contextual_json = json.dumps(contextual_messages, indent=2, ensure_ascii=False)
    contract_json = json.dumps(contract, indent=2, ensure_ascii=False)

    return f"""You are a Message Generalizer. Your task is to generalize contextual messages into reusable template messages.

CONTEXTUAL MESSAGES (from specific instance):
{contextual_json}

CONTRACT:
{contract_json}

NODE LABEL: {node_label}

🎯 OBJECTIVE:
Generalize the contextual messages by:
1. Removing specific context references (e.g., "your date of birth" → "the date")
2. Maintaining the same style and tone
3. Keeping the same structure (start, noInput, noMatch, confirmation, success)
4. Making messages reusable across different instances of the same entity type
5. Preserving format hints and placeholders

⚠️ CRITICAL RULES:
- DO NOT change the message structure (same number of messages per type)
- DO NOT change the style or tone
- DO NOT remove format hints (e.g., "(DD/MM/YYYY)", "(email)")
- DO NOT remove placeholders (e.g., "{{input}}")
- DO remove specific context (e.g., "your", "the patient's", instance-specific references)
- DO keep the same length and phrasing style
- DO maintain natural, conversational tone

📋 GENERALIZATION GUIDELINES:

1. **Remove Context-Specific References**:
   - "your date of birth" → "the date of birth" or "the date"
   - "the patient's email" → "the email address"
   - "your phone number" → "the phone number"
   - Keep generic references (e.g., "the", "a")

2. **Preserve Style**:
   - Keep same sentence length
   - Keep same politeness level
   - Keep same contractions (I'm, don't, can't)
   - Keep same question format

3. **Preserve Format Hints**:
   - Keep "(DD/MM/YYYY)" if present
   - Keep "(email)" if present
   - Keep "(+country code)" if present
   - Keep "(number)" if present

4. **Preserve Placeholders**:
   - Keep "{{input}}" in confirmation messages
   - Do not change placeholder format

5. **Maintain Message Count**:
   - start: 1 message
   - noInput: 3 messages
   - noMatch: 3 messages
   - confirmation: 2 messages
   - success: 1 message

📏 RESPONSE FORMAT (strict JSON, no markdown, no comments):
{{
  "start": [
    "Generalized start message"
  ],
  "noInput": [
    "Generalized noInput message 1",
    "Generalized noInput message 2",
    "Generalized noInput message 3"
  ],
  "noMatch": [
    "Generalized noMatch message 1",
    "Generalized noMatch message 2",
    "Generalized noMatch message 3"
  ],
  "confirmation": [
    "Is this correct: {{input}}?",
    "Confirm: {{input}}?"
  ],
  "success": [
    "Thanks, got it."
  ]
}}

📌 EXAMPLES:

Example 1: Date of Birth
Contextual: "What's your date of birth (DD/MM/YYYY)?"
Generalized: "What's the date of birth (DD/MM/YYYY)?"

Example 2: Email
Contextual: "Please tell me your email address?"
Generalized: "Please tell me the email address?"

Example 3: Confirmation
Contextual: "Is this correct: {{input}}?"
Generalized: "Is this correct: {{input}}?" (unchanged, already generic)

OUTPUT FORMAT:
Return ONLY valid JSON. No markdown. No code fences. No text outside JSON. No comments.
All five message types must be present with the same number of messages as input."""
