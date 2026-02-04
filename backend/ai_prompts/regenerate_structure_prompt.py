"""
Structure Regeneration Prompt Generator

Generates AI prompts for regenerating data structures based on user feedback.
Used by the /api/nlp/regenerate-structure endpoint.
"""

import json


def get_structure_regeneration_prompt(
    task_label: str,
    feedback: str,
    previous_structure: list
) -> str:
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
