"""
Escalation Generation Prompt Generator

Generates AI prompts for generating engine escalation strategies for semantic contracts.
Escalation defines the order in which engines are tried until one succeeds or all fail.

This prompt is used by the /api/nlp/generate-escalation endpoint.
"""

import json


def get_escalation_prompt(contract: dict, engines: list, node_label: str = None) -> str:
    """
    Generate prompt for escalation generation.

    Args:
        contract: SemanticContract object (dict) to generate escalation for
        engines: List of EngineConfig objects (from STEP 4)
        node_label: Optional node label for context

    Returns:
        Formatted prompt string for AI
    """
    contract_json = json.dumps(contract, indent=2, ensure_ascii=False, default=str)
    engines_json = json.dumps(engines, indent=2, ensure_ascii=False, default=str)
    label_context = f" for '{node_label}'" if node_label else ""

    # Extract relevant information
    entity_type = contract.get("entity", {}).get("type", "generic")
    entity_description = contract.get("entity", {}).get("description", "")
    output_format = contract.get("outputCanonical", {}).get("format", "value")
    subentities = contract.get("subentities") or contract.get("subgroups", [])

    # Extract available engine types
    available_engines = [e.get("type") for e in engines if e.get("type")]
    engines_context = ""
    if available_engines:
        engines_list = [f"  - {et}: {_get_engine_description(et)}" for et in available_engines]
        engines_context = f"""
AVAILABLE ENGINES:
{chr(10).join(engines_list)}
"""
    else:
        engines_context = """
AVAILABLE ENGINES: None (no engines generated yet)
"""

    subentities_context = ""
    if subentities:
        subentities_list = [f"  - {s.get('subTaskKey', 'unknown')}: {s.get('meaning', '')}" for s in subentities]
        subentities_context = f"""
SUBENTITIES TO EXTRACT:
{chr(10).join(subentities_list)}
"""
    else:
        subentities_context = """
ENTITY TYPE: Simple (no subentities)
"""

    return f"""You are an Escalation Generator. Your task is to generate an optimal engine escalation strategy for a semantic contract.

CURRENT CONTRACT{label_context}:
{contract_json}

ENTITY TYPE: {entity_type}
ENTITY DESCRIPTION: {entity_description}
OUTPUT FORMAT: {output_format}

{engines_context}

{subentities_context}

AVAILABLE ENGINE CONFIGURATIONS:
{engines_json}

🎯 OBJECTIVE:
Generate an optimal escalation strategy that:
1. Defines the order in which engines are tried
2. Maximizes success rate while minimizing latency
3. Uses fast engines first (regex, rule_based) before slow ones (llm, embedding)
4. Provides a sensible default engine if all fail
5. Is coherent with the contract structure and available engines

📋 ESCALATION STRATEGY GUIDELINES:

1. **Priority Order (Lower = Tried First)**:
   - Priority 1: Fastest, most deterministic engines (regex, rule_based)
   - Priority 2: Medium-speed engines (ner)
   - Priority 3: Slower, more flexible engines (llm)
   - Priority 4: Slowest, similarity-based engines (embedding)

2. **Engine Selection Logic**:
   - Always start with regex if available (fastest, deterministic)
   - Use rule_based if regex is not suitable or as fallback
   - Use ner for structured entities (dates, addresses, etc.)
   - Use llm for complex, ambiguous inputs
   - Use embedding as last resort for similarity matching

3. **Default Engine**:
   - Should be the most reliable engine (usually regex or rule_based)
   - Used when all engines in escalation fail
   - Must be one of the available engines

4. **Enabled/Disabled Logic**:
   - All engines should be enabled by default
   - Only disable if engine is clearly unsuitable for this entity type
   - Example: disable regex for free-text entities without patterns

⚠️ CRITICAL RULES:
- DO NOT modify the contract structure
- DO NOT change any existing fields
- ONLY generate the escalation configuration
- Escalation must use only available engines (from engines list)
- Priority must be sequential (1, 2, 3, ...)
- At least one engine must be enabled
- Default engine must be one of the available engines

📏 RESPONSE FORMAT (strict JSON, no markdown, no comments):
{{
  "engines": [
    {{
      "type": "<engine_type>",
      "priority": <number>,
      "enabled": <boolean>
    }}
  ],
  "defaultEngine": "<engine_type>",
  "explanation": "brief explanation of escalation strategy"
}}

📌 ESCALATION GENERATION GUIDELINES:

For Simple Entities (no subentities):
- Start with regex (priority 1) if pattern-based
- Use rule_based (priority 2) if rules are available
- Use ner (priority 3) if entity type is recognized
- Use llm (priority 4) for complex cases
- Use embedding (priority 5) as last resort
- Default: regex or rule_based (most reliable)

For Composite Entities (with subentities):
- Start with regex (priority 1) if pattern can extract all subentities
- Use rule_based (priority 2) for structured extraction
- Use ner (priority 3) for named entity recognition
- Use llm (priority 4) for complex parsing
- Use embedding (priority 5) as last resort
- Default: regex or rule_based (most reliable)

For Pattern-Based Entities (email, phone, date):
- Priority 1: regex (perfect for patterns)
- Priority 2: rule_based (validation rules)
- Priority 3: ner (if applicable)
- Priority 4: llm (fallback)
- Default: regex

For Free-Text Entities (name, description):
- Priority 1: rule_based (if rules exist)
- Priority 2: ner (if applicable)
- Priority 3: llm (best for free text)
- Priority 4: embedding (similarity)
- Default: llm or rule_based

For Numeric Entities (age, quantity):
- Priority 1: regex (pattern matching)
- Priority 2: rule_based (validation)
- Priority 3: ner (if applicable)
- Priority 4: llm (fallback)
- Default: regex

📌 COHERENCE REQUIREMENTS:

1. Escalation must use only engines from the available engines list
2. Priority must be sequential (1, 2, 3, ...)
3. At least one engine must be enabled
4. Default engine must be one of the available engines
5. Escalation should maximize success rate while minimizing latency
6. Fast engines (regex, rule_based) should come before slow ones (llm, embedding)

OUTPUT FORMAT:
Return ONLY valid JSON. No markdown. No code fences. No text outside JSON. No comments.
Escalation must include all available engines (unless explicitly disabled)."""


def _get_engine_description(engine_type: str) -> str:
    """Get human-readable description of engine type"""
    descriptions = {
        "regex": "Fast pattern matching with regex",
        "rule_based": "Fast rule-based extraction",
        "ner": "Named Entity Recognition",
        "llm": "Large Language Model inference (slower but flexible)",
        "embedding": "Similarity-based matching (slowest but most flexible)"
    }
    return descriptions.get(engine_type, "Unknown engine type")
