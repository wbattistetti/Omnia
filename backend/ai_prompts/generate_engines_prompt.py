"""
Engines Generation Prompt Generator

Generates AI prompts for generating all extraction engines for semantic contracts:
- regex: Regex patterns with named groups
- rule_based: Explicit if-then rules
- ner: Named Entity Recognition configuration
- llm: LLM extraction prompts
- embedding: Embedding-based extraction configuration

This prompt is used by the /api/nlp/generate-engines endpoint.
"""

import json


def get_engines_prompt(contract: dict, node_label: str = None) -> str:
    """
    Generate prompt for engines generation.

    Args:
        contract: SemanticContract object (dict) to generate engines for
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

    # Extract canonical values for engine training
    canonical_values_context = ""
    if canonical_examples:
        complete_examples = canonical_examples.get("complete", [])
        if complete_examples:
            examples_list = []
            for ex in complete_examples[:10]:  # Show first 10 examples
                examples_list.append(f"  - Input: '{ex.get('input', '')}' → Expected: {json.dumps(ex.get('expected', ''), ensure_ascii=False)}")
            canonical_values_context = f"""
CANONICAL EXAMPLES (for engine training):
{chr(10).join(examples_list)}
"""
        partial_examples = canonical_examples.get("partial", [])
        if partial_examples:
            partial_list = []
            for ex in partial_examples[:5]:  # Show first 5 partial examples
                partial_list.append(f"  - Input: '{ex.get('input', '')}' → Expected: {json.dumps(ex.get('expected', ''), ensure_ascii=False)}")
            canonical_values_context += f"""
PARTIAL EXAMPLES (for partial extraction):
{chr(10).join(partial_list)}
"""

    # Extract constraints for engine configuration
    constraints_context = ""
    if constraints:
        constraints_context = f"""
CONSTRAINTS (engines must respect these):
{json.dumps(constraints, indent=2, ensure_ascii=False, default=str)}
"""

    subentities_context = ""
    if subentities:
        subentities_list = []
        for s in subentities:
            sub_key = s.get("subTaskKey", "")
            sub_meaning = s.get("meaning", "")
            sub_type = s.get("type", "")
            sub_constraints = s.get("constraints", {})
            subentities_list.append(f"  - {sub_key} ({sub_type}): {sub_meaning}")
            if sub_constraints:
                subentities_list.append(f"    Constraints: {json.dumps(sub_constraints, ensure_ascii=False)}")
        subentities_context = f"""
SUBENTITIES TO EXTRACT:
{chr(10).join(subentities_list)}
"""

    format_context = ""
    if output_format == "object":
        format_context = f"""
OUTPUT FORMAT: Object with keys {output_keys}
Each engine must extract and return an object with these exact keys.
Example: {{"day": "15", "month": "04", "year": "2020"}}
"""
    else:
        format_context = """
OUTPUT FORMAT: Single value (string, number, or date)
Each engine must extract and return a single value, not an object.
Example: "15/04/2020" or "user@example.com"
"""

    return f"""You are an Engines Generator. Your task is to generate ALL extraction engines for a semantic contract.

CURRENT CONTRACT{label_context}:
{contract_json}

ENTITY TYPE: {entity_type}
ENTITY DESCRIPTION: {entity_description}

{format_context}

{canonical_values_context}

{constraints_context}

{subentities_context}

🎯 OBJECTIVE:
Generate ALL five types of extraction engines that:
1. Are coherent with the contract structure
2. Respect canonical values and constraints
3. Are deterministic and validatable
4. Support the output format (object vs value)
5. Handle subentities correctly (if composite entity)

📋 ENGINE TYPES TO GENERATE:

1. **regex** (Regex Pattern Engine):
   - Generate regex patterns with named groups
   - Must match canonical examples
   - Must respect constraints (minLength, maxLength, pattern)
   - For composite entities: extract all subentities
   - Use named groups matching output keys
   - Example for date: `(?P<day>\\d{{1,2}})[-/](?P<month>\\d{{1,2}})[-/](?P<year>\\d{{4}})`

2. **rule_based** (Rule-Based Engine):
   - Generate explicit if-then rules
   - Rules must be deterministic
   - Must handle canonical examples
   - Must respect constraints (min, max, format)
   - For composite entities: rules for each subentity
   - Example: [{{"condition": "if input matches date pattern", "action": "extract day, month, year"}}]

3. **ner** (Named Entity Recognition Engine):
   - Map subentities to NER entity types
   - Generate context patterns for disambiguation
   - Must handle composite entities
   - Example: {{"day": "DATE_COMPONENT", "month": "DATE_COMPONENT", "year": "DATE_COMPONENT"}}

4. **llm** (LLM Extraction Engine):
   - Generate system prompt for LLM extraction
   - Generate user prompt template
   - Must include contract structure and constraints
   - Must specify output format (object vs value)
   - Must include examples from canonical values
   - Example: System prompt explaining entity, user prompt with input text

5. **embedding** (Embedding-Based Engine):
   - Generate positive examples (from canonical examples)
   - Generate negative examples (from invalid examples)
   - Set similarity threshold (0.7 default)
   - Must be coherent with canonical values
   - Example: {{"positive": ["example1", "example2"], "negative": ["bad1", "bad2"], "threshold": 0.7}}

⚠️ CRITICAL RULES:
- DO NOT modify the contract structure
- DO NOT change any existing fields
- ONLY generate the five engine configurations
- Engines must be deterministic (same input → same output)
- Engines must respect constraints (min, max, pattern, format)
- Engines must handle canonical examples correctly
- For composite entities: engines must extract all subentities
- Regex patterns must be valid and compilable
- LLM prompts must be clear and structured
- Embedding examples must be diverse and representative

📏 RESPONSE FORMAT (strict JSON, no markdown, no comments):
{{
  "regex": {{
    "regex": "<regex pattern with named groups>",
    "explanation": "brief explanation of the pattern"
  }},
  "rule_based": {{
    "rules": [
      {{
        "condition": "<condition description>",
        "action": "<action description>",
        "examples": ["example1", "example2"]
      }}
    ]
  }},
  "ner": {{
    "nerEntityTypes": {{
      "<subTaskKey>": "<NER entity type>"
    }},
    "nerContextPatterns": {{
      "<subTaskKey>": "<context pattern for disambiguation>"
    }}
  }},
  "llm": {{
    "systemPrompt": "<system prompt for LLM extraction>",
    "userPromptTemplate": "<user prompt template with {{input}} placeholder>",
    "responseSchema": {{
      "type": "object",
      "properties": {{
        "<key>": {{"type": "string"}}
      }}
    }}
  }},
  "embedding": {{
    "embeddingExamples": {{
      "positive": ["example1", "example2", "example3"],
      "negative": ["bad1", "bad2", "bad3"]
    }},
    "embeddingThreshold": 0.7
  }}
}}

📌 ENGINE GENERATION GUIDELINES:

For regex engine:
- Use named groups matching output keys (for object format) or single group (for value format)
- Respect constraints: minLength, maxLength, pattern
- For composite entities: extract all subentities in one pattern
- Test pattern against canonical examples
- Example for email: `(?P<email>[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{{2,}})`

For rule_based engine:
- Create explicit if-then rules
- Rules must be deterministic and testable
- Handle constraints: min, max, format
- For composite entities: rules for each subentity
- Example: [{{"condition": "if input contains @", "action": "extract as email"}}]

For ner engine:
- Map each subentity to appropriate NER entity type
- Generate context patterns for disambiguation
- For simple entities: use main entity type
- Example: {{"email": "EMAIL", "phone": "PHONE_NUMBER"}}

For llm engine:
- System prompt: Explain entity, constraints, output format
- User prompt: Template with {{input}} placeholder
- Include examples from canonical values
- Specify response schema matching output format
- Example: System: "Extract email from user input", User: "Extract email from: {{input}}"

For embedding engine:
- Positive examples: From canonicalExamples.complete
- Negative examples: From canonicalExamples.stress (invalid examples)
- Threshold: 0.7 default (adjust based on entity type)
- Examples must be diverse and representative
- Example: {{"positive": ["user@example.com", "test@domain.org"], "negative": ["not an email", "invalid"], "threshold": 0.7}}

📌 COHERENCE REQUIREMENTS:

1. All engines must produce the same output format
2. All engines must respect constraints
3. All engines must handle canonical examples
4. Regex patterns must match canonical examples
5. Rule-based rules must cover canonical examples
6. NER entity types must match subentities
7. LLM prompts must include contract structure
8. Embedding examples must come from canonical values

📌 COMPOSITE ENTITY HANDLING:

If entity has subentities:
- Regex: Extract all subentities in one pattern with named groups
- Rule_based: Rules for each subentity
- NER: Map each subentity to NER type
- LLM: Include all subentities in prompt and schema
- Embedding: Examples must show composite structure

If entity is simple (no subentities):
- Regex: Single pattern for the value
- Rule_based: Simple rules for the value
- NER: Use main entity type
- LLM: Simple prompt for single value
- Embedding: Examples for single value

OUTPUT FORMAT:
Return ONLY valid JSON. No markdown. No code fences. No text outside JSON. No comments.
All engines must be present in the response (regex, rule_based, ner, llm, embedding)."""
