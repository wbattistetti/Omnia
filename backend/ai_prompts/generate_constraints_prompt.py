"""
Constraints Generation Prompt Generator

Generates AI prompts for generating enhanced constraints for semantic contracts:
- minLength, maxLength (for strings)
- min, max (for numbers)
- pattern (regex patterns)
- format (email, date, number, etc.)
- required (boolean)
- examples (coherent with canonical values)

This prompt is used by the /api/nlp/generate-constraints endpoint.
"""

import json


def get_constraints_prompt(contract: dict, node_label: str = None) -> str:
    """
    Generate prompt for constraints generation.

    Args:
        contract: SemanticContract object (dict) to generate constraints for
        node_label: Optional node label for context

    Returns:
        Formatted prompt string for AI
    """
    contract_json = json.dumps(contract, indent=2, ensure_ascii=False, default=str)
    label_context = f" for '{node_label}'" if node_label else ""

    # Extract relevant information
    entity_type = contract.get("entity", {}).get("type", "generic")
    entity_description = contract.get("entity", {}).get("description", "")
    output_format = contract.get("outputCanonical", {}).get("format", "value")
    output_keys = contract.get("outputCanonical", {}).get("keys", [])
    subentities = contract.get("subentities") or contract.get("subgroups", [])
    existing_constraints = contract.get("constraints", {})
    canonical_examples = contract.get("canonicalExamples", {})

    # Extract canonical values for analysis
    canonical_values_context = ""
    if canonical_examples:
        complete_examples = canonical_examples.get("complete", [])
        if complete_examples:
            examples_list = []
            for ex in complete_examples[:5]:  # Show first 5 examples
                examples_list.append(f"  - Input: '{ex.get('input', '')}' → Expected: {json.dumps(ex.get('expected', ''), ensure_ascii=False)}")
            canonical_values_context = f"""
CANONICAL EXAMPLES (for constraint inference):
{chr(10).join(examples_list)}
"""

    subentities_context = ""
    if subentities:
        subentities_list = []
        for s in subentities:
            sub_key = s.get("subTaskKey", "")
            sub_meaning = s.get("meaning", "")
            sub_constraints = s.get("constraints", {})
            subentities_list.append(f"  - {sub_key}: {sub_meaning}")
            if sub_constraints:
                subentities_list.append(f"    Existing constraints: {json.dumps(sub_constraints, ensure_ascii=False)}")
        subentities_context = f"""
SUBENTITIES TO CONSTRAIN:
{chr(10).join(subentities_list)}
"""

    existing_constraints_context = ""
    if existing_constraints:
        existing_constraints_context = f"""
EXISTING CONSTRAINTS (preserve these):
{json.dumps(existing_constraints, indent=2, ensure_ascii=False, default=str)}
"""

    return f"""You are a Constraints Generator. Your task is to generate comprehensive, coherent constraints for a semantic contract.

CURRENT CONTRACT{label_context}:
{contract_json}

ENTITY TYPE: {entity_type}
ENTITY DESCRIPTION: {entity_description}
OUTPUT FORMAT: {output_format}
{chr(10).join([f"OUTPUT KEYS: {output_keys}" if output_keys else ""])}

{canonical_values_context}

{existing_constraints_context}

{subentities_context}

🎯 OBJECTIVE:
Generate constraints that:
1. Are coherent with canonical values (infer from examples)
2. Are useful for engine generation and test examples
3. Preserve existing constraints (additive only)
4. Are semantically correct for the entity type
5. Support validation and normalization

📋 CONSTRAINT TYPES:

1. **String Constraints** (for text/string entities):
   - minLength: Minimum character length
   - maxLength: Maximum character length
   - pattern: Regex pattern for validation
   - format: Semantic format (email, date, phone, etc.)

2. **Number Constraints** (for numeric entities):
   - min: Minimum numeric value
   - max: Maximum numeric value
   - format: Number format (integer, decimal, percentage, etc.)

3. **Common Constraints**:
   - required: Whether field is required (boolean)
   - examples: Example values (coherent with canonical values)

4. **Format Inference** (from canonical examples):
   - If examples contain emails → format: "email"
   - If examples contain dates → format: "date"
   - If examples contain phones → format: "phone"
   - If examples contain numbers → format: "number"
   - If examples show patterns → infer regex pattern

⚠️ CRITICAL RULES:
- DO NOT modify the contract structure
- DO NOT change any existing constraints
- ONLY add missing constraints
- Preserve all existing constraint values
- Constraints must be coherent with canonical values
- Constraints must be semantically correct
- If canonical examples show a pattern, infer it

📏 RESPONSE FORMAT (strict JSON, no markdown, no comments):
{{
  "constraints": {{
    "minLength": <number> | null,
    "maxLength": <number> | null,
    "min": <number> | null,
    "max": <number> | null,
    "pattern": "<regex pattern>" | null,
    "format": "<format type>" | null,
    "required": <boolean> | null,
    "examples": {{
      "valid": ["example1", "example2"],
      "invalid": ["example1", "example2"],
      "edgeCases": ["example1", "example2"]
    }} | null
  }},
  "subentityConstraints": [
    {{
      "subTaskKey": "<key>",
      "constraints": {{
        "minLength": <number> | null,
        "maxLength": <number> | null,
        "min": <number> | null,
        "max": <number> | null,
        "pattern": "<regex pattern>" | null,
        "format": "<format type>" | null,
        "required": <boolean> | null
      }}
    }}
  ]
}}

📌 CONSTRAINT GENERATION GUIDELINES:

For String Entities:
- Analyze canonical examples to infer minLength/maxLength
- If examples show email pattern → format: "email", pattern: email regex
- If examples show date pattern → format: "date", pattern: date regex
- If examples show phone pattern → format: "phone", pattern: phone regex
- Infer pattern from examples if consistent

For Number Entities:
- Analyze canonical examples to infer min/max
- Determine format (integer, decimal, percentage)
- Set reasonable bounds based on examples

For Composite Entities:
- Generate constraints for main entity
- Generate constraints for each subentity
- Ensure subentity constraints are coherent with main entity

For Format Inference:
- Email: format="email", pattern should match email regex
- Date: format="date", pattern should match date formats
- Phone: format="phone", pattern should match phone formats
- Number: format="number", min/max from examples
- Text: format="text", minLength/maxLength from examples

For Examples:
- valid: Examples that should pass validation
- invalid: Examples that should fail validation
- edgeCases: Boundary and edge case examples
- Must be coherent with canonical values

OUTPUT FORMAT:
Return ONLY valid JSON. No markdown. No code fences. No text outside JSON. No comments."""
