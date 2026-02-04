"""
Generalizability Check Prompt Generator

Generates AI prompts for checking if a template can be generalized for reuse.
Used by the /api/nlp/check-generalizability endpoint.
"""

import json


def get_generalizability_check_prompt(
    contract: dict,
    node_label: str,
    contextual_messages: dict
) -> str:
    """
    Generate prompt for generalizability check.

    Args:
        contract: SemanticContract object
        node_label: Node label
        contextual_messages: Contextual messages

    Returns:
        Formatted prompt string for AI
    """
    contract_json = json.dumps(contract, indent=2, ensure_ascii=False)
    messages_json = json.dumps(contextual_messages, indent=2, ensure_ascii=False)

    return f"""You are a Template Generalizability Checker. Your task is to determine if a template can be generalized for reuse across different instances.

CONTRACT:
{contract_json}

NODE LABEL: {node_label}

CONTEXTUAL MESSAGES:
{messages_json}

🎯 OBJECTIVE:
Determine if this template is generalizable, meaning:
1. The entity type is common and reusable (e.g., "date", "email", "phone")
2. The structure is standard (not instance-specific)
3. The messages can be generalized (no hardcoded context)
4. The template would be useful for other similar tasks

⚠️ CRITICAL RULES:
- DO NOT consider instance-specific data (e.g., "patient's date of birth" vs generic "date of birth")
- DO consider entity type (common types like date, email, phone are generalizable)
- DO consider structure (standard structures are generalizable)
- DO consider message style (generic messages are generalizable)

📋 GENERALIZABILITY CRITERIA:

1. **Entity Type** (High priority):
   - Common types (date, email, phone, address, name) → Generalizable
   - Specific types (e.g., "patient ID", "order number") → May not be generalizable
   - Generic types (string, number) → May be generalizable if structure is standard

2. **Structure** (High priority):
   - Standard structures (e.g., date with day/month/year) → Generalizable
   - Custom structures (e.g., "patient-specific fields") → May not be generalizable
   - Simple structures (single value) → Generalizable if type is common

3. **Messages** (Medium priority):
   - Generic messages (no instance-specific context) → Generalizable
   - Context-specific messages (e.g., "your patient's...") → May need generalization
   - Format hints present → Generalizable (format hints are reusable)

4. **Constraints** (Low priority):
   - Standard constraints (min, max, pattern) → Generalizable
   - Custom constraints (instance-specific) → May not be generalizable

📏 RESPONSE FORMAT (strict JSON, no markdown, no comments):
{{
  "generalizable": <boolean>,
  "confidence": <number 0-1>,
  "reasons": [
    "Reason 1 for generalizability",
    "Reason 2 for generalizability"
  ],
  "barriers": [
    "Barrier 1 (if not generalizable)",
    "Barrier 2 (if not generalizable)"
  ],
  "suggestions": [
    "Suggestion 1 for generalization",
    "Suggestion 2 for generalization"
  ]
}}

📌 EXAMPLES:

Example 1: Date of Birth (Generalizable)
{{
  "generalizable": true,
  "confidence": 0.95,
  "reasons": [
    "Entity type 'date' is common and reusable",
    "Structure (day/month/year) is standard",
    "Messages are generic and can be generalized"
  ],
  "barriers": [],
  "suggestions": [
    "Generalize messages by removing 'your' context",
    "Keep format hint (DD/MM/YYYY) as it's reusable"
  ]
}}

Example 2: Patient ID (Not Generalizable)
{{
  "generalizable": false,
  "confidence": 0.3,
  "reasons": [],
  "barriers": [
    "Entity type 'patient ID' is instance-specific",
    "Structure may vary between healthcare systems",
    "Messages contain healthcare-specific context"
  ],
  "suggestions": [
    "Consider creating a generic 'ID' template instead",
    "Remove healthcare-specific context from messages"
  ]
}}

OUTPUT FORMAT:
Return ONLY valid JSON. No markdown. No code fences. No text outside JSON. No comments."""
