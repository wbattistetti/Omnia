"""
Structure Generation Prompt Generator

Generates AI prompts for generating hierarchical data structures.
Used by the /api/nlp/generate-structure endpoint.
"""

import json


def get_structure_generation_prompt(task_label: str, task_description: str = None, locale: str = "it") -> str:
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

    # Map locale to language name for prompt
    lang_names = {
        "it": "Italian",
        "en": "English",
        "pt": "Portuguese",
        "es": "Spanish",
        "fr": "French",
        "de": "German"
    }
    lang_name = lang_names.get(locale.lower(), locale.upper())

    return f"""You are a Data Structure Generator. Your task is to generate a hierarchical data structure for a task.

TASK LABEL: {task_label}{desc_context}

LANGUAGE REQUIREMENT:
CRITICAL: The task label above is in {lang_name}. You MUST generate ALL node labels (root and children) in the SAME LANGUAGE as the task label.
- If task_label is in Italian → ALL labels must be in Italian (e.g., "Data di nascita", "Giorno", "Mese", "Anno")
- If task_label is in English → ALL labels must be in English (e.g., "Date of Birth", "Day", "Month", "Year")
- If task_label is in Portuguese → ALL labels must be in Portuguese (e.g., "Data de nascimento", "Dia", "Mês", "Ano")
- DO NOT translate labels to English or any other language
- DO NOT mix languages
- Maintain the exact same language as the task_label throughout the entire structure

OBJECTIVE:
Generate a hierarchical data structure (tree of nodes) that represents what data needs to be collected for this task.
The structure must be:
- Semantically correct for the task
- Hierarchical (root node with children)
- Complete (all necessary fields)
- Realistic and practical

STRUCTURE RULES:

1. **Root Node**:
   - Always create a root node with label representing the main data entity
   - Root node may have children (sub-nodes) if the data is composite

2. **Child Nodes**:
   - Create child nodes for composite data (e.g., Date → Day, Month, Year)
   - Each child node should have a clear, semantic label
   - Child nodes can have their own children (nested structure)
   - Maximum depth: 3 levels (root → child → grandchild)

3. **Node Properties**:
   - Each node must have: id, label
   - Optional: type (string, number, date, email, phone, etc.), emoji
   - Nodes can have subNodes array (for children)
   - CRITICAL: Labels must be PLAIN TEXT ONLY - NO emoji, NO symbols, NO special characters in the label field
   - Use the "emoji" field to suggest a visual icon for this node (as a Unicode emoji string)
   - The emoji field should contain a single Unicode emoji character that represents the semantic meaning of the node
   - Example: For "Date of Birth" → emoji should be a calendar emoji
   - Example: For "Email" → emoji should be a mail emoji
   - Example: For "Address" → emoji should be a location/home emoji

4. **Semantic Correctness**:
   - Structure must match the task label semantically
   - If task is "Date of Birth" → structure should have Day, Month, Year
   - If task is "Email" → structure should be simple (no children)
   - If task is "Address" → structure should have Street, City, PostalCode, etc.

CRITICAL RULES:
- DO NOT generate more than 10 nodes total
- DO NOT create circular references
- DO NOT use placeholder names like "field1", "field2"
- Use semantic, meaningful labels
- Structure must be valid JSON
- Root node is always required
- LANGUAGE CONSISTENCY: ALL labels (root and children) MUST be in the SAME LANGUAGE as the task_label ({lang_name})
- NO EMOJI IN LABELS: Labels must be PLAIN TEXT ONLY. Use the separate "emoji" field for visual representation.

RESPONSE FORMAT (strict JSON, no markdown, no comments):
{{
  "structure": [
    {{
      "id": "root",
      "label": "Main entity label (e.g., 'Date of Birth', 'Address', 'Email')",
      "type": "entity type (e.g., 'date', 'address', 'email')",
      "emoji": "optional Unicode emoji string (single emoji character representing the node's semantic meaning)",
      "subNodes": [
        {{
          "id": "child-1",
          "label": "Child node label (e.g., 'Day', 'Month', 'Year')",
          "type": "child type (e.g., 'number', 'string')",
          "emoji": "optional Unicode emoji string",
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

GENERALIZATION RULES:
Analyze the task label to determine if it can be generalized (removed from specific context).

Examples:
- "Chiedi la data di nascita del paziente" → shouldBeGeneral: true, generalizedLabel: "Chiedi la data di nascita", reason: "La data di nascita è un concetto generale non legato al dominio 'paziente'."
- "Chiedi il codice fiscale del cliente" → shouldBeGeneral: true, generalizedLabel: "Chiedi il codice fiscale", reason: "Il codice fiscale è un dato standard che non dipende dal contesto 'cliente'."
- "Chiedi l'indirizzo email dell'utente" → shouldBeGeneral: true, generalizedLabel: "Chiedi l'indirizzo email", reason: "L'email è un dato universale non specifico del dominio."
- "Chiedi il numero di telefono del paziente" → shouldBeGeneral: true, generalizedLabel: "Chiedi il numero di telefono", reason: "Il numero di telefono è un dato standard riutilizzabile."

If the task is domain-specific and cannot be generalized:
- "Chiedi il referto medico del paziente" → shouldBeGeneral: false, generalizedLabel: null, generalizationReason: null

Rules:
- shouldBeGeneral: true if the task can be used in multiple contexts without domain-specific references
- generalizedLabel: Remove context-specific words (e.g., "del paziente", "del cliente", "dell'utente")
- generalizationReason: Explain why it's generalizable in one sentence
- generalizedMessages: If shouldBeGeneral is true, provide 3-5 example messages that are generalized (without context-specific references). These are example messages that would be used in the generalized template. If shouldBeGeneral is false, set to null.

EXAMPLES (Note: Examples below are in English, but you MUST use the same language as task_label):

Example 1: Date of Birth (English) / Data di nascita (Italian)
{{
  "structure": [
    {{
      "id": "root",
      "label": "Date of Birth",  // If task_label is Italian: "Data di nascita"
      "type": "date",
      "emoji": "calendar emoji as Unicode string",
      "subNodes": [
        {{"id": "day", "label": "Day", "type": "number", "emoji": "number emoji as Unicode string"}},  // If task_label is Italian: "Giorno"
        {{"id": "month", "label": "Month", "type": "number", "emoji": "number emoji as Unicode string"}},  // If task_label is Italian: "Mese"
        {{"id": "year", "label": "Year", "type": "number", "emoji": "number emoji as Unicode string"}}  // If task_label is Italian: "Anno"
      ]
    }}
  ]
}}

Example 2: Email (simple) / Email (Italian: same)
{{
  "structure": [
    {{
      "id": "root",
      "label": "Email",  // Same in both languages
      "type": "email",
      "emoji": "mail emoji as Unicode string",
      "subNodes": []
    }}
  ]
}}

Example 3: Address (composite) / Indirizzo (Italian)
{{
  "structure": [
    {{
      "id": "root",
      "label": "Address",  // If task_label is Italian: "Indirizzo"
      "type": "address",
      "emoji": "location emoji as Unicode string",
      "subNodes": [
        {{"id": "street", "label": "Street", "type": "string", "emoji": "optional Unicode emoji string"}},  // If task_label is Italian: "Via"
        {{"id": "city", "label": "City", "type": "string", "emoji": "optional Unicode emoji string"}},  // If task_label is Italian: "Città"
        {{"id": "postalCode", "label": "Postal Code", "type": "string", "emoji": "optional Unicode emoji string"}},  // If task_label is Italian: "Codice postale"
        {{"id": "country", "label": "Country", "type": "string", "emoji": "optional Unicode emoji string"}}  // If task_label is Italian: "Paese"
      ]
    }}
  ]
}}

OUTPUT FORMAT:
Return ONLY valid JSON. No markdown. No code fences. No text outside JSON. No comments.
Structure must be an array with at least one node (root)."""
