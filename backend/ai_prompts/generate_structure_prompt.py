"""
Structure Prompt Generator (Unified)

Generates AI prompts for generating or regenerating hierarchical data structures.
Used by the unified /api/nlp/generate-structure endpoint.
"""

import json
from typing import Optional


def get_structure_prompt(
    task_label: str,
    task_description: Optional[str] = None,
    locale: str = "it",
    feedback: Optional[str] = None,
    previous_structure: Optional[list] = None
) -> str:
    """
    Unified prompt generator: automatically decides between generation and regeneration.

    Args:
        task_label: Task label (e.g., "Date of Birth" or "Data di nascita")
        task_description: Optional task description
        locale: Language code (e.g., "it", "en", "pt") - used to maintain language consistency
        feedback: Optional user feedback (if provided, triggers regeneration mode)
        previous_structure: Optional previous structure (if provided, triggers regeneration mode)

    Returns:
        Formatted prompt string for AI
    """
    # If feedback and previous_structure are provided, use regeneration prompt
    if feedback and previous_structure:
        return _get_regeneration_prompt(task_label, feedback, previous_structure)
    else:
        return _get_generation_prompt(task_label, task_description, locale)


def _get_generation_prompt(task_label: str, task_description: Optional[str] = None, locale: str = "it") -> str:
    """
    Generate prompt for structure generation.

    Args:
        task_label: Task label (e.g., "Date of Birth" or "Data di nascita")
        task_description: Optional task description
        locale: Language code (e.g., "it", "en", "pt") - used to maintain language consistency

    Returns:
        Formatted prompt string for AI
    """
    desc_context = f"\nTASK DESCRIPTION: {task_description}" if task_description else ""

    return f"""You are a Data Structure Generator. Your task is to generate a hierarchical data structure for a task.

TASK LABEL: {task_label}{desc_context}

LANGUAGE CONSISTENCY:
- You MUST generate ALL node labels (root and children) in the SAME LANGUAGE as the task label.
- Do NOT translate labels to English or any other language.
- Do NOT mix languages.
- Labels must be plain text only (no emoji, no symbols). Use the "emoji" field for icons.

OBJECTIVE:
Generate a hierarchical data structure (tree of nodes) that represents the data required to fulfill the task.
The structure must be:
- semantically correct
- realistic
- practical
- minimal when the task is simple
- expanded only when the concept is universally composite

------------------------------------------------------------
BOOLEAN TASK RULE (CRITICAL)
------------------------------------------------------------
If the task label expresses a yes/no question (e.g., "chiedi se", "verifica se", "controlla se", "ha", "possiede", "esiste"):
- You MUST generate a single-node structure.
- type = "boolean"
- No subNodes.
- No additional fields.
- Do NOT model the entity itself (e.g., do NOT create a "ticket" object).
Example:
Task: "Chiedi se ha un ticket"
→ Structure:
{{
  "id": "root",
  "label": "Ha un ticket",
  "type": "boolean",
  "emoji": "❓",
  "subNodes": []
}}

------------------------------------------------------------
WORLD KNOWLEDGE RULE
------------------------------------------------------------
You MUST use general world knowledge to expand common universal concepts.
Examples:
- "Data di nascita" → Giorno, Mese, Anno
- "Indirizzo" → Via, Città, CAP, Paese
- "Dati personali" → Nome, Cognome, Data di nascita, Indirizzo
- "Tipo di documento" → Carta d'identità, Passaporto, Patente

These expansions are allowed because they are universal and not domain-specific.

------------------------------------------------------------
DOMAIN-SPECIFIC RULE
------------------------------------------------------------
You MUST NOT invent domain-specific canonical values.
Examples:
- "Tipo di ticket" → do NOT invent categories
- "Tipo di richiesta" → do NOT invent categories
- "Categoria del problema" → do NOT invent categories

Canonical values MUST be included ONLY if explicitly listed in the task label.

------------------------------------------------------------
STRUCTURE RULES
------------------------------------------------------------

1. Root Node:
   - Always create a root node representing the main data entity.
   - Root may have children only if the concept is universally composite.

2. Child Nodes:
   - Create child nodes only when the concept is universally composite.
   - Child nodes must have semantic labels.
   - Maximum depth: 3 levels (root → child → grandchild).

3. Node Properties:
   - Each node must have: id, label, type, emoji.
   - type can be: string, number, boolean, date, email, phone, object.
   - Use "object" only for composite entities.
   - Use "emoji" as a single Unicode emoji representing the node.

4. Canonical Values:
   - Include "canonicalValues" ONLY if they appear explicitly in the task label.
   - NEVER invent canonical values.

5. Ambiguous Fields:
   - If a field is free-form (e.g., "motivo", "descrizione"), use type = "string" and no subNodes.

------------------------------------------------------------
GENERALIZATION RULES
------------------------------------------------------------
Determine if the task can be generalized by removing domain-specific context.

Examples:
- "Chiedi la data di nascita del paziente" → generalizable
- "Chiedi il codice fiscale del cliente" → generalizable
- "Chiedi il referto medico del paziente" → NOT generalizable

Output:
- shouldBeGeneral: boolean
- generalizedLabel: string | null
- generalizationReason: string | null
- generalizedMessages: array of 3–5 example messages if generalizable, else null

------------------------------------------------------------
OUTPUT FORMAT (strict JSON, no markdown, no comments)
------------------------------------------------------------
{{
  "structure": [
    {{
      "id": "root",
      "label": "...",
      "type": "...",
      "emoji": "...",
      "subNodes": [
        {{
          "id": "...",
          "label": "...",
          "type": "...",
          "emoji": "...",
          "subNodes": []
        }}
      ]
    }}
  ],
  "shouldBeGeneral": boolean,
  "generalizedLabel": "string | null",
  "generalizationReason": "string | null",
  "generalizedMessages": ["string"] | null
}}

Return ONLY valid JSON."""


def _get_regeneration_prompt(task_label: str, feedback: str, previous_structure: list) -> str:
    """
    Generate prompt for structure regeneration.

    Args:
        task_label: Task label
        feedback: User feedback on previous structure
        previous_structure: Previous structure that was rejected

    Returns:
        Formatted prompt string for AI
    """
    previous_json = json.dumps(previous_structure, indent=2, ensure_ascii=False)

    return f"""You are a Data Structure Regenerator. Your task is to regenerate a data structure based on user feedback.

TASK LABEL: {task_label}

PREVIOUS STRUCTURE (that was rejected):
{previous_json}

USER FEEDBACK:
{feedback}

🎯 OBJECTIVE:
Regenerate the data structure taking into account the user's feedback.
The new structure must:
- Address all points mentioned in the feedback
- Be semantically correct for the task
- Be hierarchical (root node with children)
- Be complete (all necessary fields)
- Be realistic and practical

⚠️ CRITICAL RULES:
- DO NOT simply copy the previous structure
- DO address all feedback points explicitly
- DO generate a new, improved structure
- DO NOT generate more than 10 nodes total
- DO NOT create circular references
- Use semantic, meaningful labels
- Structure must be valid JSON
- Root node is always required

📋 FEEDBACK INTERPRETATION:

Common feedback patterns:
- "Add field X" → Add node X to appropriate level
- "Remove field Y" → Remove node Y from structure
- "Change field Z to W" → Rename or restructure node Z
- "Structure should be simpler" → Reduce depth or number of nodes
- "Structure should be more detailed" → Add more nodes or depth
- "Field X should be under Y" → Move node X under node Y

📏 RESPONSE FORMAT (strict JSON, no markdown, no comments):
{{
  "structure": [
    {{
      "id": "root",
      "label": "Main entity label",
      "type": "entity type",
      "icon": "optional icon",
      "subData": [
        {{
          "id": "child-1",
          "label": "Child node label",
          "type": "child type",
          "subData": []
        }}
      ]
    }}
  ],
  "changes": [
    "Brief description of changes made based on feedback"
  ]
}}

OUTPUT FORMAT:
Return ONLY valid JSON. No markdown. No code fences. No text outside JSON. No comments.
Structure must be an array with at least one node (root)."""


# Backward compatibility: keep old function names
def get_structure_generation_prompt(task_label: str, task_description: Optional[str] = None, locale: str = "it") -> str:
    """Backward compatibility wrapper for _get_generation_prompt."""
    return _get_generation_prompt(task_label, task_description, locale)
