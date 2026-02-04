"""
AI Messages Generation Prompt Generator

Generates AI prompts for generating dialogue messages for semantic contracts.
Messages are used in the dialogue flow: start, noInput, noMatch, confirmation, success.

This prompt is used by the /api/nlp/generate-ai-messages endpoint.
"""

import json


def get_ai_messages_prompt(contract: dict, node_label: str = None) -> str:
    """
    Generate prompt for AI messages generation.

    Args:
        contract: SemanticContract object (dict) to generate messages for
        node_label: Optional node label for context

    Returns:
        Formatted prompt string for AI
    """
    contract_json = json.dumps(contract, indent=2, ensure_ascii=False, default=str)
    label_context = f" for '{node_label}'" if node_label else ""

    # Extract relevant information
    entity_type = contract.get("entity", {}).get("type", "generic")
    entity_description = contract.get("entity", {}).get("description", "")
    entity_label = contract.get("entity", {}).get("label", "")
    output_format = contract.get("outputCanonical", {}).get("format", "value")
    output_keys = contract.get("outputCanonical", {}).get("keys", [])
    subentities = contract.get("subentities") or contract.get("subgroups", [])
    constraints = contract.get("constraints", {})

    # Extract format hints from constraints
    format_hint = ""
    if constraints:
        if constraints.get("format"):
            formats = constraints.get("format", [])
            if isinstance(formats, list) and len(formats) > 0:
                format_type = formats[0]
                if format_type == "email":
                    format_hint = " (email)"
                elif format_type == "phone":
                    format_hint = " (+country code)"
                elif format_type == "date":
                    format_hint = " (DD/MM/YYYY)"
                elif format_type == "number":
                    format_hint = " (number)"
        elif entity_type == "email":
            format_hint = " (email)"
        elif entity_type == "phone":
            format_hint = " (+country code)"
        elif entity_type == "date":
            format_hint = " (DD/MM/YYYY)"

    subentities_context = ""
    if subentities:
        subentities_list = []
        for s in subentities:
            sub_key = s.get("subTaskKey", "")
            sub_label = s.get("label", "")
            subentities_list.append(f"  - {sub_label} ({sub_key})")
        subentities_context = f"""
SUBENTITIES TO ASK:
{chr(10).join(subentities_list)}
For composite entities, ask for missing parts only (e.g., "Day?", "Month?", "Year?").
"""
    else:
        subentities_context = """
ENTITY TYPE: Simple (no subentities)
Ask for the complete value directly.
"""

    return f"""You are writing for a voice (phone) customer-care agent.
Generate the agent's spoken messages to collect the data described by the semantic contract.

CURRENT CONTRACT{label_context}:
{contract_json}

ENTITY LABEL: {entity_label}
ENTITY TYPE: {entity_type}
ENTITY DESCRIPTION: {entity_description}
OUTPUT FORMAT: {output_format}
{chr(10).join([f"OUTPUT KEYS: {output_keys}" if output_keys else ""])}

{subentities_context}

🎯 OBJECTIVE:
Generate natural, spoken messages in English for a voice-based customer care system.
Messages must be:
- Short (4-12 words)
- Natural, polite, human
- Phone conversation tone: concise, fluid, not robotic
- Coherent with the contract structure and entity description

📋 STYLE REQUIREMENTS:
- One short sentence (about 4-12 words), natural, polite, human
- Phone conversation tone: concise, fluid, not robotic
- Prefer light contractions when natural (I'm, don't, can't)
- Neutral and professional; no chit-chat, no opinions, no humor
- NEVER ask about "favorite …" or "why"
- No emojis and no exclamation marks
- Do NOT use UI words like "click", "type", "enter". Use "say/tell/give"
- NEVER output example values or names (e.g., "Emily", "01/01/2000", "Main Street")
- NEVER output greetings or generic help phrases (e.g., "How may I help you today")
- Use the field label; if the field is composite, ask ONLY the missing part (e.g., Day, Month, Year)
- Add compact format hints when useful: (DD/MM/YYYY), (YYYY), (email), (+country code)
- English only

📋 MESSAGE TYPES TO GENERATE:

1. **start** (1 message):
   - Initial question to ask for the data
   - Must directly ask for the value
   - Must end with a question mark
   - Include format hint if applicable
   - Example: "Please tell me your {entity_label.lower()}{format_hint}?"

2. **noInput** (3 variations):
   - Used when the customer doesn't respond or remains silent
   - Each variation should be slightly different but equally polite
   - Progressive but not urgent/pushy
   - Must end with a question mark
   - Example: "Could you share the {entity_label.lower()}{format_hint}?"

3. **noMatch** (3 variations):
   - Used when the system doesn't understand what the customer said
   - Should encourage the customer to rephrase or be more specific
   - Prefer voice phrasing like "I didn't catch that" over "I couldn't parse that"
   - Must end with a question mark
   - Example: "I didn't catch that. {entity_label}{format_hint}?"

4. **confirmation** (2 messages):
   - Used to confirm the extracted value before proceeding
   - Should include {{ '{{input}}' }} placeholder for the extracted value
   - Example: "Is this correct: {{ '{{input}}' }}?"

5. **success** (1 message):
   - Short acknowledgement after successful extraction
   - Example: "Thanks, got it."

⚠️ CRITICAL RULES:
- DO NOT modify the contract structure
- DO NOT change any existing fields
- ONLY generate the messages object
- For start, noInput, and noMatch: the text MUST directly ask for the value and MUST end with a question mark
- Only confirmation messages may include the {{ '{{input}}' }} placeholder
- For composite entities: ask for missing parts only (e.g., "Day?", "Month?", "Year?")
- Messages must be coherent with the entity description and constraints
- Format hints should match the entity type and constraints

📏 RESPONSE FORMAT (strict JSON, no markdown, no comments):
{{
  "start": [
    "Initial question asking for the value"
  ],
  "noInput": [
    "First variation when customer doesn't respond",
    "Second variation when customer doesn't respond",
    "Third variation when customer doesn't respond"
  ],
  "noMatch": [
    "First variation when system doesn't understand",
    "Second variation when system doesn't understand",
    "Third variation when system doesn't understand"
  ],
  "confirmation": [
    "Is this correct: {{ '{{input}}' }}?",
    "Confirm: {{ '{{input}}' }}?"
  ],
  "success": [
    "Thanks, got it."
  ]
}}

📌 MESSAGE GENERATION GUIDELINES:

For Simple Entities (no subentities):
- start: Ask for the complete value directly
- noInput: 3 variations asking for the value again
- noMatch: 3 variations asking for clarification
- confirmation: 2 variations with {{ '{{input}}' }} placeholder
- success: 1 acknowledgement message

For Composite Entities (with subentities):
- start: Ask for missing parts only (e.g., "Day?", "Month?", "Year?")
- noInput: 3 variations asking for the missing part
- noMatch: 3 variations asking for clarification on the missing part
- confirmation: 2 variations with {{ '{{input}}' }} placeholder
- success: 1 acknowledgement message

For Email Entities:
- Include format hint: (email)
- Example start: "What's your email address?"

For Phone Entities:
- Include format hint: (+country code)
- Example start: "What's your phone number (+country code)?"

For Date Entities:
- Include format hint: (DD/MM/YYYY)
- Example start: "What's your date of birth (DD/MM/YYYY)?"
- For subentities: "Day?", "Month?", "Year?"

For Number Entities:
- Include format hint if applicable: (number)
- Example start: "What's your age?"

For Text Entities:
- No format hint needed
- Example start: "What's your name?"

📌 COHERENCE REQUIREMENTS:

1. Messages must be coherent with entity description
2. Messages must respect entity type (email, phone, date, etc.)
3. Format hints must match constraints and entity type
4. For composite entities: ask for missing parts only
5. All start, noInput, noMatch messages must end with "?"
6. Only confirmation messages may include {{ '{{input}}' }} placeholder
7. Messages must be natural and conversational, not robotic

OUTPUT FORMAT:
Return ONLY valid JSON. No markdown. No code fences. No text outside JSON. No comments.
All five message types must be present (start, noInput, noMatch, confirmation, success)."""
