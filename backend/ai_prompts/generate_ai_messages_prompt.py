"""
AI Messages Generation Prompt Generator

Generates AI prompts for generating dialogue messages for semantic contracts.
Messages are used in the dialogue flow: start, noInput, noMatch, confirmation, success.

This prompt is used by the /api/nlp/generate-ai-messages endpoint.
"""

import json

# Valid step types
# Note: 'invalid' is generated automatically from constraints, not from AI messages
VALID_STEP_TYPES = ["start", "noInput", "noMatch", "confirmation", "notConfirmed", "success"]


def get_ai_messages_prompt_for_step(contract: dict, step_type: str, node_label: str = None, locale: str = "it") -> str:
    """
    Generate prompt for AI messages generation for a specific step type.

    Args:
        contract: SemanticContract object (dict) to generate messages for
        step_type: Step type (start, noInput, noMatch, confirmation, notConfirmed, success)
        Note: 'invalid' is generated automatically from constraints, not from AI messages
        node_label: Optional node label for context
        locale: Locale code (default: "it")

    Returns:
        Formatted prompt string for AI
    """
    if step_type not in VALID_STEP_TYPES:
        raise ValueError(f"Invalid step_type: {step_type}. Must be one of: {VALID_STEP_TYPES}")

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

    # Step-specific prompt sections
    step_prompts = {
        "start": {
            "description": "Initial question to ask for the data",
            "count": 1,
            "rules": [
                "Must directly ask for the value",
                "Must end with a question mark",
                "Include format hint if applicable",
                "For composite entities: ask for missing parts only (e.g., 'Day?', 'Month?', 'Year?')"
            ],
            "examples": [
                f"Please tell me your {entity_label.lower()}{format_hint}?",
                f"What's your {entity_label.lower()}{format_hint}?",
                f"Could you provide your {entity_label.lower()}{format_hint}?"
            ]
        },
        "noInput": {
            "description": "Used when the customer doesn't respond or remains silent",
            "count": 3,
            "rules": [
                "Each variation should be slightly different but equally polite",
                "Progressive but not urgent/pushy",
                "Must end with a question mark",
                "Should encourage the customer to respond"
            ],
            "examples": [
                f"Could you share the {entity_label.lower()}{format_hint}?",
                f"I'm waiting for your {entity_label.lower()}{format_hint}?",
                f"Please provide your {entity_label.lower()}{format_hint}?"
            ]
        },
        "noMatch": {
            "description": "Used when the system doesn't understand what the customer said",
            "count": 3,
            "rules": [
                "Should encourage the customer to rephrase or be more specific",
                "Prefer voice phrasing like 'I didn't catch that' over 'I couldn't parse that'",
                "Must end with a question mark",
                "Should be polite and helpful"
            ],
            "examples": [
                f"I didn't catch that. {entity_label}{format_hint}?",
                f"I'm sorry, I didn't understand. Could you repeat your {entity_label.lower()}{format_hint}?",
                f"Could you rephrase that? {entity_label}{format_hint}?"
            ]
        },
        "confirmation": {
            "description": "Used to confirm the extracted value before proceeding",
            "count": 2,
            "rules": [
                "Should include {{ '{{input}}' }} placeholder for the extracted value",
                "Should be polite and clear",
                "Must end with a question mark"
            ],
            "examples": [
                "Is this correct: {{ '{{input}}' }}?",
                "Confirm: {{ '{{input}}' }}?"
            ]
        },
        "notConfirmed": {
            "description": "Used when the customer rejects the confirmation",
            "count": 2,
            "rules": [
                "Should acknowledge the rejection",
                "Should ask the customer to provide the correct value again",
                "Must end with a question mark"
            ],
            "examples": [
                f"I understand. Could you provide the correct {entity_label.lower()}{format_hint}?",
                f"No problem. What's your {entity_label.lower()}{format_hint}?"
            ]
        },
        "violation": {
            "description": "Used when the extracted value violates a constraint",
            "count": 2,
            "rules": [
                "Should explain what's wrong",
                "Should ask for the value again with a hint about the constraint",
                "Must end with a question mark"
            ],
            "examples": [
                f"The value doesn't meet the requirements. Could you provide a valid {entity_label.lower()}{format_hint}?",
                f"That's not valid. Please provide your {entity_label.lower()}{format_hint}?"
            ]
        },
        "disambiguation": {
            "description": "Used when the system needs to disambiguate between multiple possible values",
            "count": 1,
            "rules": [
                "Should present the options clearly",
                "Should ask the customer to choose",
                "Must end with a question mark"
            ],
            "examples": [
                "I found multiple possibilities. Which one did you mean?",
                "Could you clarify which one you're referring to?"
            ]
        },
        "success": {
            "description": "Short acknowledgement after successful extraction",
            "count": 1,
            "rules": [
                "Should be brief and polite",
                "Should acknowledge the successful extraction",
                "No question mark needed"
            ],
            "examples": [
                "Thanks, got it.",
                "Perfect, thank you.",
                "Great, I've got that."
            ]
        }
    }

    step_info = step_prompts.get(step_type, step_prompts["start"])

    return f"""You are writing for a voice (phone) customer-care agent.
Generate the agent's spoken messages for the **{step_type}** step to collect the data described by the semantic contract.

CURRENT CONTRACT{label_context}:
{contract_json}

ENTITY LABEL: {entity_label}
ENTITY TYPE: {entity_type}
ENTITY DESCRIPTION: {entity_description}
OUTPUT FORMAT: {output_format}
{chr(10).join([f"OUTPUT KEYS: {output_keys}" if output_keys else ""])}

{subentities_context}

🎯 OBJECTIVE:
Generate {step_info['count']} natural, spoken message(s) in {locale.upper()} for the **{step_type}** step.
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
- Language: {locale.upper()}

📋 STEP TYPE: **{step_type.upper()}**

Description: {step_info['description']}

Rules:
{chr(10).join([f"- {rule}" for rule in step_info['rules']])}

Examples:
{chr(10).join([f"- {ex}" for ex in step_info['examples']])}

⚠️ CRITICAL RULES:
- DO NOT modify the contract structure
- DO NOT change any existing fields
- ONLY generate the messages array for this step type
- Messages must be coherent with the entity description and constraints
- Format hints should match the entity type and constraints
- For composite entities: ask for missing parts only (e.g., "Day?", "Month?", "Year?")
- Generate exactly {step_info['count']} message(s)

📏 RESPONSE FORMAT (strict JSON, no markdown, no comments):
{{
  "messages": [
    "First message for {step_type}",
    "Second message for {step_type}" if {step_info['count']} > 1 else "",
    "Third message for {step_type}" if {step_info['count']} > 2 else ""
  ],
  "options": []  // Only for disambiguation step, otherwise empty array
}}

OUTPUT FORMAT:
Return ONLY valid JSON. No markdown. No code fences. No text outside JSON. No comments.
Generate exactly {step_info['count']} message(s) in the "messages" array."""


def get_ai_messages_prompt(contract: dict, node_label: str = None, locale: str = "it") -> str:
    """
    Generate prompt for AI messages generation.

    Args:
        contract: SemanticContract object (dict) to generate messages for
        node_label: Optional node label for context
        locale: Locale code (default: "it")

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

    return f"""You generate spoken messages for a phone-based customer-care agent.
The agent must sound natural, calm, concise, and professional.

GOAL:
Generate short spoken messages (4–12 words) in the language specified by {locale.upper()}.
Messages must follow the rules for each step type and must be coherent with the semantic contract.

CONTEXT:
ENTITY LABEL: {entity_label}
ENTITY TYPE: {entity_type}
ENTITY DESCRIPTION: {entity_description}
CONTRACT:
{contract_json}

SUBENTITIES:
{subentities_context}

LANGUAGE REQUIREMENT (CRITICAL):
- All generated messages MUST be written in {locale.upper()}.
- The prompt is in English, but the output language is {locale.upper()}.

AGENT PERSONA (CRITICAL):
- Calm, patient, professional
- Speaks in short, direct sentences
- Avoids complex phrasing and subordinate clauses
- Never sounds scripted or robotic
- Never uses filler, greetings, or chit-chat

STYLE (STRICT):
- One short sentence per message (4–12 words)
- Natural spoken tone: calm, clear, human
- No emojis, no exclamation marks
- No example values or names
- No UI verbs ("click", "type", "enter"); use "say", "tell", "give"
- Use the entity label; for composite entities ask ONLY the missing part
- Add format hints when relevant: (email), (+country code), (DD/MM/YYYY)

MESSAGE PATTERNS (CRITICAL):

1. start (1 message)
   Pattern: Direct question + label + optional hint + "?"
   Example: "Could you tell me your {entity_label.lower()}{format_hint}?"

2. noInput (3 messages - ESCALATION)
   Escalation = increasing clarity, NOT increasing formality.
   - First: very brief, very light
   - Second: more direct
   - Third: more explicit, but always calm

   Examples (respect 4–12 words, natural tone):
   - "I still need your {entity_label.lower()}{format_hint}?"
   - "Can you give me your {entity_label.lower()}{format_hint}?"
   - "I need your {entity_label.lower()}{format_hint}, can you tell me?"

3. noMatch (3 messages - ESCALATION)
   Escalation = increasing clarification.
   - First: light clarification
   - Second: more explicit clarification
   - Third: request for rephrasing

   Examples:
   - "I didn't catch that. Your {entity_label.lower()}{format_hint}?"
   - "Sorry, I didn't get that. Your {entity_label.lower()}{format_hint}?"
   - "Can you repeat your {entity_label.lower()}{format_hint} more clearly?"

4. confirmation (2 messages)
   Pattern: Confirmation + {{input}} + "?"
   Examples:
   - "Is this correct: {{input}}?"
   - "Confirm {{input}}?"

5. notConfirmed (1 message)
   Pattern: Acknowledge rejection + ask again + "?"
   Example: "I understand. What's the correct {entity_label.lower()}{format_hint}?"

6. success (1 message)
   Pattern: Short acknowledgement
   Examples:
   - "Perfect, thanks."
   - "Got it, thanks."

RULES (STRICT):
- start, noInput, noMatch MUST end with "?"
- Only confirmation messages may include {{input}}
- success MUST NOT end with "?"
- Messages MUST respect entity type and constraints
- For composite entities: ask only the missing part
- No modification of contract structure
- No additional fields
- No explanations, no comments, no markdown

OUTPUT FORMAT (STRICT JSON):
{{
  "start": ["..."],
  "noInput": ["...", "...", "..."],
  "noMatch": ["...", "...", "..."],
  "confirmation": ["...", "..."],
  "notConfirmed": ["..."],
  "success": ["..."]
}}

Return ONLY valid JSON. No markdown. No code fences. No text outside JSON. No comments.
All six message types must be present (start, noInput, noMatch, confirmation, notConfirmed, success)."""
