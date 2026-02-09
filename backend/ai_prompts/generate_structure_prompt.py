"""
Structure Generation Prompt Generator

Generates AI prompts for generating hierarchical data structures.
Used by the /api/nlp/generate-structure endpoint.
"""

import json


def get_structure_generation_prompt(task_label: str, task_description: str = None) -> str:
    """
    Generate prompt for structure generation.

    Args:
        task_label: Task label (e.g., "Date of Birth")
        task_description: Optional task description

    Returns:
        Formatted prompt string for AI
    """
    desc_context = f"\nTASK DESCRIPTION: {task_description}" if task_description else ""

    return f"""You are a Data Structure Generator. Your task is to generate a hierarchical data structure for a task.

TASK LABEL: {task_label}{desc_context}

🎯 OBJECTIVE:
Generate a hierarchical data structure (tree of nodes) that represents what data needs to be collected for this task.
The structure must be:
- Semantically correct for the task
- Hierarchical (root node with children)
- Complete (all necessary fields)
- Realistic and practical

📋 STRUCTURE RULES:

1. **Root Node**:
   - Always create a root node with label representing the main data entity
   - Root node should have an appropriate icon (folder, document, etc.)
   - Root node may have children (sub-nodes) if the data is composite

2. **Child Nodes**:
   - Create child nodes for composite data (e.g., Date → Day, Month, Year)
   - Each child node should have a clear, semantic label
   - Child nodes can have their own children (nested structure)
   - Maximum depth: 3 levels (root → child → grandchild)

3. **Node Properties**:
   - Each node must have: id, label
   - Optional: type (string, number, date, email, phone, etc.), icon
   - Nodes can have subNodes array (for children)

4. **Semantic Correctness**:
   - Structure must match the task label semantically
   - If task is "Date of Birth" → structure should have Day, Month, Year
   - If task is "Email" → structure should be simple (no children)
   - If task is "Address" → structure should have Street, City, PostalCode, etc.

⚠️ CRITICAL RULES:
- DO NOT generate more than 10 nodes total
- DO NOT create circular references
- DO NOT use placeholder names like "field1", "field2"
- Use semantic, meaningful labels
- Structure must be valid JSON
- Root node is always required

📏 RESPONSE FORMAT (strict JSON, no markdown, no comments):
{{
  "structure": [
    {{
      "id": "root",
      "label": "Main entity label (e.g., 'Date of Birth', 'Address', 'Email')",
      "type": "entity type (e.g., 'date', 'address', 'email')",
      "icon": "optional icon (e.g., 'calendar', 'home', 'mail')",
      "subNodes": [
        {{
          "id": "child-1",
          "label": "Child node label (e.g., 'Day', 'Month', 'Year')",
          "type": "child type (e.g., 'number', 'string')",
          "subNodes": []
        }}
      ]
    }}
  ]
}}

📌 EXAMPLES:

Example 1: Date of Birth
{{
  "structure": [
    {{
      "id": "root",
      "label": "Date of Birth",
      "type": "date",
      "icon": "calendar",
      "subNodes": [
        {{"id": "day", "label": "Day", "type": "number"}},
        {{"id": "month", "label": "Month", "type": "number"}},
        {{"id": "year", "label": "Year", "type": "number"}}
      ]
    }}
  ]
}}

Example 2: Email (simple)
{{
  "structure": [
    {{
      "id": "root",
      "label": "Email",
      "type": "email",
      "icon": "mail",
      "subNodes": []
    }}
  ]
}}

Example 3: Address (composite)
{{
  "structure": [
    {{
      "id": "root",
      "label": "Address",
      "type": "address",
      "icon": "home",
      "subNodes": [
        {{"id": "street", "label": "Street", "type": "string"}},
        {{"id": "city", "label": "City", "type": "string"}},
        {{"id": "postalCode", "label": "Postal Code", "type": "string"}},
        {{"id": "country", "label": "Country", "type": "string"}}
      ]
    }}
  ]
}}

OUTPUT FORMAT:
Return ONLY valid JSON. No markdown. No code fences. No text outside JSON. No comments.
Structure must be an array with at least one node (root)."""
