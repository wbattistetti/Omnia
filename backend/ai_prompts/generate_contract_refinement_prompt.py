"""
Contract Refinement Prompt Generator

Generates AI prompts for refining semantic contracts by:
- Enhancing descriptions with missing information
- Adding missing constraints
- Correcting ambiguities
- Preparing contract for canonical values, engines, and test examples

This prompt is used by the /api/nlp/refine-contract endpoint.
"""

import json


def get_contract_refinement_prompt(contract: dict, node_label: str = None) -> str:
    """
    Generate prompt for contract refinement.

    Args:
        contract: SemanticContract object (dict) to refine
        node_label: Optional node label for context

    Returns:
        Formatted prompt string for AI
    """
    contract_json = json.dumps(contract, indent=2, ensure_ascii=False, default=str)
    label_context = f" for '{node_label}'" if node_label else ""

    return f"""You are a Semantic Contract Refinement System. Your task is to enhance and refine semantic contracts by adding missing information, correcting ambiguities, and improving semantic clarity.

CURRENT CONTRACT{label_context}:
{contract_json}

🎯 OBJECTIVE:
Analyze the current contract and provide enhancements that:
1. Improve semantic clarity of descriptions
2. Add missing constraint information
3. Correct any ambiguities
4. Enhance entity and subgroup descriptions
5. Add missing normalization rules where appropriate
6. Improve constraint descriptions with natural language

⚠️ CRITICAL RULES:
- DO NOT modify the contract structure (entity, subentities, outputCanonical format)
- DO NOT change existing field names or keys
- DO NOT remove any existing information
- ONLY ADD or ENHANCE existing fields
- Preserve all existing data
- Enhancements must be additive, not destructive

📋 ENHANCEMENT AREAS:

1. Entity Description:
   - If description is missing or too generic, provide a clear, specific description
   - Include semantic context about what the entity represents
   - Example: "a date" → "a date composed of day, month, and year components"

2. Subgroup Descriptions:
   - Enhance meaning field for each subgroup
   - Add semantic context about the subgroup's role
   - Example: "day" → "numeric day of the month (1-31)"

3. Constraints:
   - Add missing constraint descriptions in natural language
   - Enhance existing constraint descriptions
   - Add examples (valid, invalid, edge cases) if missing
   - Example: Add "The day must be between 1 and 31, month between 1 and 12"

4. Normalization:
   - Add normalization rules if missing and applicable
   - Enhance existing normalization rules with more detail
   - Example: "year always 4 digits (61 -> 1961, 05 -> 2005)"

5. Missing Information:
   - Identify and add any missing semantic information
   - Fill gaps in descriptions
   - Add context where helpful

📏 RESPONSE FORMAT (strict JSON, no markdown, no comments):
{{
  "enhancedDescription": "Enhanced entity description (if improvement needed, otherwise null)",
  "enhancedSubentities": [
    {{
      "subTaskKey": "day",
      "enhancedMeaning": "Enhanced meaning description (if improvement needed, otherwise null)",
      "enhancedConstraints": {{
        "description": "Enhanced constraint description in natural language (if improvement needed, otherwise null)",
        "examples": {{
          "valid": ["1", "15", "31"],
          "invalid": ["0", "32", "abc"],
          "edgeCases": ["1", "31"]
        }}
      }},
      "enhancedNormalization": "Enhanced normalization rule (if improvement needed, otherwise null)"
    }}
  ],
  "enhancedConstraints": {{
    "description": "Enhanced main entity constraint description (if improvement needed, otherwise null)",
    "examples": {{
      "valid": ["example1", "example2"],
      "invalid": ["example1", "example2"],
      "edgeCases": ["example1", "example2"]
    }}
  }},
  "enhancedNormalization": "Enhanced main entity normalization rule (if improvement needed, otherwise null)",
  "additionalConstraints": [
    {{
      "field": "entity|subentity_key",
      "type": "min|max|minLength|maxLength|format|pattern|required",
      "value": "constraint value",
      "description": "Natural language description of this constraint"
    }}
  ],
  "ambiguities": [
    {{
      "field": "entity|subentity_key",
      "issue": "Description of the ambiguity",
      "suggestion": "Suggested clarification"
    }}
  ],
  "improvements": [
    "List of improvements made to the contract"
  ]
}}

📌 IMPORTANT:
- Return null for fields that don't need enhancement
- Only include subentities that need enhancement
- All enhancements must preserve the original contract structure
- Do not change any existing keys or field names
- All descriptions must be in natural language (not code)
- Examples must be realistic and relevant

OUTPUT FORMAT:
Return ONLY valid JSON. No markdown. No code fences. No text outside JSON. No comments."""
