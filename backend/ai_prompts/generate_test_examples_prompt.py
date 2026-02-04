"""
Test Examples Generation Prompt Generator

Generates AI prompts for generating test examples for semantic contracts.
Test examples are used to validate engines and ensure correct extraction behavior.

This prompt is used by the /api/nlp/generate-test-examples endpoint.
"""

import json


def get_test_examples_prompt(contract: dict, node_label: str = None) -> str:
    """
    Generate prompt for test examples generation.

    Args:
        contract: SemanticContract object (dict) to generate test examples for
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
    constraints = contract.get("constraints", {})
    canonical_examples = contract.get("canonicalExamples", {})

    # Extract canonical values for reference
    canonical_values_context = ""
    if canonical_examples:
        complete_examples = canonical_examples.get("complete", [])
        if complete_examples:
            examples_list = []
            for ex in complete_examples[:10]:  # Show first 10 examples
                examples_list.append(f"  - Input: '{ex.get('input', '')}' → Expected: {json.dumps(ex.get('expected', ''), ensure_ascii=False)}")
            canonical_values_context = f"""
CANONICAL EXAMPLES (for reference):
{chr(10).join(examples_list)}
"""
        partial_examples = canonical_examples.get("partial", [])
        if partial_examples:
            partial_list = []
            for ex in partial_examples[:5]:  # Show first 5 partial examples
                partial_list.append(f"  - Input: '{ex.get('input', '')}' → Expected: {json.dumps(ex.get('expected', ''), ensure_ascii=False)}")
            canonical_values_context += f"""
PARTIAL EXAMPLES (for reference):
{chr(10).join(partial_list)}
"""

    # Extract constraints for test generation
    constraints_context = ""
    if constraints:
        constraints_context = f"""
CONSTRAINTS (test examples must respect these):
{json.dumps(constraints, indent=2, ensure_ascii=False, default=str)}
"""

    subentities_context = ""
    if subentities:
        subentities_list = []
        for s in subentities:
            sub_key = s.get("subTaskKey", "")
            sub_meaning = s.get("meaning", "")
            sub_type = s.get("type", "")
            subentities_list.append(f"  - {sub_key} ({sub_type}): {sub_meaning}")
        subentities_context = f"""
SUBENTITIES TO EXTRACT:
{chr(10).join(subentities_list)}
"""
    else:
        subentities_context = """
ENTITY TYPE: Simple (no subentities)
"""

    format_context = ""
    if output_format == "object":
        format_context = f"""
OUTPUT FORMAT: Object with keys {output_keys}
Each test example should produce an object with these exact keys.
Example: {{"day": "15", "month": "04", "year": "2020"}}
"""
    else:
        format_context = """
OUTPUT FORMAT: Single value (string, number, or date)
Each test example should produce a single value, not an object.
Example: "15/04/2020" or "user@example.com"
"""

    return f"""You are a Test Examples Generator. Your task is to generate comprehensive test examples for a semantic contract.

CURRENT CONTRACT{label_context}:
{contract_json}

ENTITY TYPE: {entity_type}
ENTITY DESCRIPTION: {entity_description}

{format_context}

{canonical_values_context}

{constraints_context}

{subentities_context}

🎯 OBJECTIVE:
Generate test examples that:
1. Cover valid inputs (should be successfully extracted)
2. Cover edge cases (boundary values, unusual formats)
3. Cover invalid inputs (should be rejected or return null)
4. Are diverse and realistic
5. Respect constraints (min, max, pattern, format)
6. Are coherent with canonical examples
7. Can be used to validate all engines (regex, rule_based, ner, llm, embedding)

📋 TEST EXAMPLE TYPES:

1. **Valid Examples** (should succeed):
   - Standard, typical inputs
   - Should match all constraints
   - Should be successfully extracted by engines
   - Minimum 5 examples, maximum 15 examples
   - Must be diverse (different phrasings, formats)

2. **Edge Case Examples** (boundary conditions):
   - Minimum/maximum values (if constraints specify)
   - Unusual but valid formats
   - Ambiguous but resolvable inputs
   - Minimum 3 examples, maximum 10 examples
   - Should test robustness of engines

3. **Invalid Examples** (should fail):
   - Clearly invalid inputs that violate constraints
   - Wrong format or type
   - Completely unrelated inputs
   - Minimum 3 examples, maximum 10 examples
   - Engines should reject these correctly

⚠️ CRITICAL RULES:
- DO NOT modify the contract structure
- DO NOT change any existing fields
- ONLY generate the test examples array
- Examples must be natural language strings (user utterances)
- Examples must respect constraints (min, max, pattern, format)
- Examples must be coherent with canonical examples
- For object format: examples should produce objects with all required keys
- For value format: examples should produce single values
- Invalid examples should clearly violate constraints

📏 RESPONSE FORMAT (strict JSON, no markdown, no comments):
{{
  "validExamples": [
    "natural language input that should succeed",
    "another valid input",
    "..."
  ],
  "edgeCaseExamples": [
    "boundary condition input",
    "unusual but valid format",
    "..."
  ],
  "invalidExamples": [
    "clearly invalid input",
    "input that violates constraints",
    "..."
  ]
}}

📌 TEST GENERATION GUIDELINES:

For Valid Examples:
- Use diverse, realistic inputs
- Cover different phrasings and wordings
- Include examples from canonical values (if available)
- Ensure all examples respect constraints
- For composite entities: include examples with all subentities
- For simple entities: include examples with single values

For Edge Case Examples:
- Include minimum/maximum values (if constraints specify)
- Include unusual but valid formats
- Include ambiguous but resolvable inputs
- Test boundary conditions
- For composite entities: include partial examples (missing some subentities)

For Invalid Examples:
- Include inputs that violate constraints (min, max, pattern, format)
- Include wrong format or type
- Include completely unrelated inputs
- Include inputs that are too short/long (if constraints specify)
- For composite entities: include examples with invalid subentity values

📌 COHERENCE REQUIREMENTS:

1. Test examples must respect constraints
2. Test examples must be coherent with canonical examples
3. Valid examples should match canonical examples (if available)
4. Invalid examples should clearly violate constraints
5. Edge case examples should test boundary conditions
6. All examples must be natural language strings (user utterances)

📌 ENTITY-SPECIFIC GUIDELINES:

For Email Entities:
- Valid: standard email formats
- Edge: emails with special characters, long domains
- Invalid: missing @, invalid domains, spaces

For Phone Entities:
- Valid: standard phone formats (with/without country code)
- Edge: phones with extensions, international formats
- Invalid: too short/long, invalid characters

For Date Entities:
- Valid: standard date formats (DD/MM/YYYY, DD-MM-YYYY, etc.)
- Edge: leap years, month boundaries, single-digit days/months
- Invalid: invalid dates (32/13/2020), wrong format

For Number Entities:
- Valid: numbers within min/max range
- Edge: minimum/maximum values, decimals (if allowed)
- Invalid: out of range, non-numeric, negative (if not allowed)

For Text Entities:
- Valid: text within minLength/maxLength
- Edge: minimum/maximum length, special characters
- Invalid: too short/long, invalid characters (if pattern specified)

For Composite Entities:
- Valid: inputs with all subentities
- Edge: partial inputs (missing some subentities)
- Invalid: inputs with invalid subentity values

OUTPUT FORMAT:
Return ONLY valid JSON. No markdown. No code fences. No text outside JSON. No comments.
All three arrays must be present (validExamples, edgeCaseExamples, invalidExamples)."""
