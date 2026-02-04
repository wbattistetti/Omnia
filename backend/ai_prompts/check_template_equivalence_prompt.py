"""
Template Equivalence Check Prompt Generator

Generates AI prompts for checking if a template already exists that is equivalent.
Used by the /api/nlp/check-template-equivalence endpoint.
"""

import json


def get_template_equivalence_check_prompt(
    current_template: dict,
    existing_templates: list
) -> str:
    """
    Generate prompt for template equivalence check.

    Args:
        current_template: Current template to check
        existing_templates: List of existing templates to compare against

    Returns:
        Formatted prompt string for AI
    """
    current_json = json.dumps(current_template, indent=2, ensure_ascii=False)
    existing_json = json.dumps(existing_templates, indent=2, ensure_ascii=False)

    return f"""You are a Template Equivalence Checker. Your task is to determine if a template already exists that is equivalent to the current template.

CURRENT TEMPLATE:
{current_json}

EXISTING TEMPLATES:
{existing_json}

🎯 OBJECTIVE:
Determine if any existing template is equivalent to the current template, meaning:
1. Same entity type (e.g., "date", "email", "phone")
2. Same structure (same subentities, same hierarchy)
3. Same constraints (same min, max, pattern, format)
4. Same output format (object vs value)

⚠️ CRITICAL RULES:
- DO consider entity type as primary match criterion
- DO consider structure (subentities) as secondary match criterion
- DO consider constraints as tertiary match criterion
- DO NOT consider messages (messages can differ)
- DO NOT consider instance-specific data
- DO consider semantic equivalence (e.g., "date of birth" ≈ "date")

📋 EQUIVALENCE CRITERIA:

1. **Entity Type Match** (Required):
   - Exact match: "date" = "date" → Equivalent
   - Semantic match: "date of birth" ≈ "date" → Equivalent
   - Different types: "date" ≠ "email" → Not equivalent

2. **Structure Match** (Required):
   - Same subentities (same keys, same hierarchy) → Equivalent
   - Different subentities → Not equivalent
   - Simple vs composite → Not equivalent

3. **Constraints Match** (Optional but preferred):
   - Same constraints (min, max, pattern, format) → Equivalent
   - Different constraints → May still be equivalent if structure matches

4. **Output Format Match** (Required):
   - Same format (object vs value) → Equivalent
   - Different format → Not equivalent

📏 RESPONSE FORMAT (strict JSON, no markdown, no comments):
{{
  "equivalent": <boolean>,
  "matchingTemplateId": "<template_id>" | null,
  "confidence": <number 0-1>,
  "matchReasons": [
    "Reason 1 for equivalence",
    "Reason 2 for equivalence"
  ],
  "differences": [
    "Difference 1 (if not equivalent)",
    "Difference 2 (if not equivalent)"
  ]
}}

📌 EXAMPLES:

Example 1: Equivalent Template Found
{{
  "equivalent": true,
  "matchingTemplateId": "template-date-001",
  "confidence": 0.95,
  "matchReasons": [
    "Entity type 'date' matches exactly",
    "Structure (day/month/year) matches exactly",
    "Constraints (min/max for day/month/year) match",
    "Output format (object) matches"
  ],
  "differences": []
}}

Example 2: No Equivalent Template
{{
  "equivalent": false,
  "matchingTemplateId": null,
  "confidence": 0.1,
  "matchReasons": [],
  "differences": [
    "Entity type 'custom_id' not found in existing templates",
    "Structure differs (current has 3 subentities, existing has 2)",
    "Output format differs (current is object, existing is value)"
  ]
}}

OUTPUT FORMAT:
Return ONLY valid JSON. No markdown. No code fences. No text outside JSON. No comments."""
