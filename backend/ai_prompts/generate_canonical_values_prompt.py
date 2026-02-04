"""
Canonical Values Prompt Generator

Generates AI prompts for generating canonical value sets for semantic contracts:
- canonicalExamples: Complete and valid examples
- partialExamples: Partial but useful examples
- invalidExamples: Invalid examples for robustness testing

This prompt is used by the /api/nlp/generate-canonical-values endpoint.
"""

import json


def get_canonical_values_prompt(contract: dict, node_label: str = None) -> str:
    """
    Generate prompt for canonical values generation.

    Args:
        contract: SemanticContract object (dict) to generate values for
        node_label: Optional node label for context

    Returns:
        Formatted prompt string for AI
    """
    contract_json = json.dumps(contract, indent=2, ensure_ascii=False, default=str)
    label_context = f" for '{node_label}'" if node_label else ""

    # Extract output format info
    output_format = contract.get("outputCanonical", {}).get("format", "value")
    output_keys = contract.get("outputCanonical", {}).get("keys", [])
    entity_type = contract.get("entity", {}).get("type", "generic")
    entity_description = contract.get("entity", {}).get("description", "")
    subentities = contract.get("subentities") or contract.get("subgroups", [])

    format_context = ""
    if output_format == "object":
        format_context = f"""
OUTPUT FORMAT: Object with keys {output_keys}
Each example must return an object with these exact keys.
Example: {{"day": "15", "month": "04", "year": "2020"}}
"""
    else:
        format_context = """
OUTPUT FORMAT: Single value (string, number, or date)
Each example must return a single value, not an object.
Example: "15/04/2020" or "user@example.com"
"""

    subentities_context = ""
    if subentities:
        subentities_list = [f"- {s.get('subTaskKey', 'unknown')}: {s.get('meaning', '')}" for s in subentities]
        subentities_context = f"""
SUBENTITIES TO EXTRACT:
{chr(10).join(subentities_list)}
"""

    return f"""You are a Canonical Values Generator. Your task is to generate comprehensive canonical value sets for a semantic contract.

CURRENT CONTRACT{label_context}:
{contract_json}

ENTITY TYPE: {entity_type}
ENTITY DESCRIPTION: {entity_description}

{format_context}

{subentities_context}

🎯 OBJECTIVE:
Generate three types of examples that will be used to:
1. Train and validate extraction engines
2. Test robustness and edge cases
3. Ensure consistent behavior across all engines

📋 EXAMPLE TYPES:

1. **canonicalExamples** (Complete and Valid):
   - Full, valid inputs with all required fields
   - Should be successfully extracted by all engines
   - Represent typical, real-world usage
   - Must match the contract's constraints and format
   - Minimum 5 examples, maximum 15 examples
   - Each example must be realistic and diverse

2. **partialExamples** (Partial but Useful):
   - Inputs missing some optional fields
   - Still useful for extraction (partial matches)
   - Engines should extract what's available
   - Missing fields should be null/undefined in output
   - Minimum 3 examples, maximum 10 examples
   - Should cover different partial scenarios

3. **invalidExamples** (Invalid for Robustness):
   - Clearly invalid inputs that should be rejected
   - Used to test engine robustness
   - Should NOT match the contract's constraints
   - Engines should return null or error
   - Minimum 3 examples, maximum 10 examples
   - Should cover different types of invalidity

⚠️ CRITICAL RULES:
- DO NOT modify the contract structure
- DO NOT change any existing fields
- ONLY generate the three example arrays
- Examples must be realistic and diverse
- Examples must respect the contract's constraints
- Examples must match the output format (object vs value)
- For object format, all keys must be present in canonicalExamples
- For object format, partialExamples may have missing keys
- InvalidExamples should clearly violate constraints

📏 RESPONSE FORMAT (strict JSON, no markdown, no comments):
{{
  "canonicalExamples": [
    {{
      "input": "natural language input from user",
      "expected": {output_format_example},
      "description": "brief explanation (optional)"
    }}
  ],
  "partialExamples": [
    {{
      "input": "natural language input with missing fields",
      "expected": {partial_output_format_example},
      "description": "brief explanation (optional)"
    }}
  ],
  "invalidExamples": [
    {{
      "input": "clearly invalid input",
      "expected": null,
      "description": "why this is invalid (optional)"
    }}
  ]
}}

📌 OUTPUT FORMAT DETAILS:
- For "object" format: expected must be an object with all required keys
- For "value" format: expected must be a single value (string/number)
- For partialExamples: expected may have null values for missing fields
- For invalidExamples: expected must always be null
- All inputs must be natural language strings (user utterances)
- All expected outputs must match the contract's outputCanonical format

📌 EXAMPLE GENERATION GUIDELINES:

For canonicalExamples:
- Use diverse, realistic inputs
- Cover different phrasings and wordings
- Include edge cases within valid range
- Ensure all examples are extractable
- Match the entity type and description

For partialExamples:
- Show inputs with missing optional fields
- Show inputs with incomplete information
- Show inputs that can be partially extracted
- Ensure partial extraction is still useful

For invalidExamples:
- Show inputs that violate constraints
- Show inputs with wrong format
- Show inputs that are completely unrelated
- Show inputs that are ambiguous beyond resolution
- Ensure engines can reject these correctly

OUTPUT FORMAT:
Return ONLY valid JSON. No markdown. No code fences. No text outside JSON. No comments."""
