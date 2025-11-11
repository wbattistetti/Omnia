"""
Template Heuristics Module
Deterministic pattern matching for DDT template selection.
Uses synonyms and field matching to select templates without AI.
"""

import re
from typing import Dict, List, Optional, Tuple, Any


def extract_mentioned_fields(text: str, templates: Dict[str, Any]) -> List[str]:
    """
    Extracts template names mentioned in the description using synonyms.

    Args:
        text: User description (e.g., "chiedi nome e telefono")
        templates: Dictionary of available templates {name: template}

    Returns:
        List of template names that were mentioned (e.g., ["name", "phone"])
    """
    if not text or not templates:
        return []

    text_lower = text.lower().strip()
    mentioned = []

    # Build synonym map: synonym -> template_name
    synonym_map: Dict[str, str] = {}
    for template_name, template in templates.items():
        synonyms = template.get('synonyms', [])
        if not synonyms:
            # Fallback: use template name and label as synonyms
            label = template.get('label', '').lower()
            synonyms = [template_name.lower(), label]

        for synonym in synonyms:
            synonym_lower = synonym.lower().strip()
            if synonym_lower:
                # Use word boundaries for exact matching
                pattern = r'\b' + re.escape(synonym_lower) + r'\b'
                if re.search(pattern, text_lower):
                    if template_name not in mentioned:
                        mentioned.append(template_name)

    return mentioned


def score_atomic_template(template: Dict[str, Any], mentioned_fields: List[str]) -> int:
    """
    Scores an atomic template based on mentioned fields.

    Args:
        template: Template dictionary
        mentioned_fields: List of template names mentioned in description

    Returns:
        Score: 1 if template is mentioned, 0 otherwise
    """
    template_name = template.get('name', '')
    return 1 if template_name in mentioned_fields else 0


def score_composite_template(template: Dict[str, Any], mentioned_fields: List[str]) -> int:
    """
    Scores a composite template based on how many mainData fields are mentioned.

    Args:
        template: Composite template dictionary
        mentioned_fields: List of template names mentioned in description

    Returns:
        Score: Number of mainData fields that match mentioned_fields
    """
    main_data = template.get('mainData', [])
    if not main_data:
        return 0

    score = 0
    for main_item in main_data:
        # Check if mainData item references a template
        template_ref = main_item.get('templateRef') or main_item.get('type')
        if template_ref and template_ref in mentioned_fields:
            score += 1

    return score


def score_template(template: Dict[str, Any], mentioned_fields: List[str]) -> int:
    """
    Calculates score for a template (atomic or composite).
    Score = number of subData/mainData fields matched.

    Args:
        template: Template dictionary
        mentioned_fields: List of template names mentioned in description

    Returns:
        Score: Number of matched fields
    """
    template_type = template.get('type', 'atomic')

    if template_type == 'composite':
        return score_composite_template(template, mentioned_fields)
    else:
        return score_atomic_template(template, mentioned_fields)


def find_best_template_match(
    text: str,
    templates: Dict[str, Any],
    mentioned_fields: Optional[List[str]] = None
) -> Optional[Tuple[Dict[str, Any], int, str]]:
    """
    Finds the best template match using heuristic scoring.

    Priority:
    1. Composite templates that contain all mentioned fields
    2. Template with highest score

    Args:
        text: User description
        templates: Dictionary of available templates
        mentioned_fields: Pre-extracted mentioned fields (optional)

    Returns:
        Tuple of (best_template, score, reason) or None if no match
    """
    if not text or not templates:
        return None

    # Extract mentioned fields if not provided
    if mentioned_fields is None:
        mentioned_fields = extract_mentioned_fields(text, templates)

    if not mentioned_fields:
        return None

    best_template = None
    best_score = 0
    best_reason = ""

    # First pass: look for composite templates that contain ALL mentioned fields
    for template_name, template in templates.items():
        template_type = template.get('type', 'atomic')

        if template_type == 'composite':
            main_data = template.get('mainData', [])
            if not main_data:
                continue

            # Extract template references from mainData
            main_data_refs = []
            for main_item in main_data:
                ref = main_item.get('templateRef') or main_item.get('type')
                if ref:
                    main_data_refs.append(ref)

            # Check if composite contains all mentioned fields
            if all(field in main_data_refs for field in mentioned_fields):
                score = len(mentioned_fields)
                if score > best_score:
                    best_template = template
                    best_score = score
                    best_reason = f"Composite template contains all {len(mentioned_fields)} mentioned fields"

    # Second pass: find template with highest score (if no perfect composite match)
    if best_template is None:
        for template_name, template in templates.items():
            score = score_template(template, mentioned_fields)
            if score > best_score:
                best_template = template
                best_score = score
                template_type = template.get('type', 'atomic')
                if template_type == 'composite':
                    best_reason = f"Composite template matches {score} fields"
                else:
                    best_reason = f"Atomic template matches {score} field(s)"

    if best_template and best_score > 0:
        return (best_template, best_score, best_reason)

    return None


def build_heuristic_response(
    template: Dict[str, Any],
    mentioned_fields: List[str],
    templates_dict: Dict[str, Any],
    target_lang: str = "it"
) -> Dict[str, Any]:
    """
    Builds response structure from matched template.
    For composite templates, resolves templateRef and marks non-mentioned fields as optional.

    Args:
        template: Matched template
        mentioned_fields: Fields mentioned in user description
        templates_dict: Dictionary of all available templates (for resolving references)
        target_lang: Target language for localization

    Returns:
        Response structure compatible with step2 format
    """
    template_type = template.get('type', 'atomic')

    if template_type == 'composite':
        # For composite, resolve mainData references
        main_data_list = []
        main_data = template.get('mainData', [])

        for main_item in main_data:
            template_ref = main_item.get('templateRef') or main_item.get('type')
            is_mentioned = template_ref in mentioned_fields if template_ref else False

            # Resolve referenced template if exists
            if template_ref and template_ref in templates_dict:
                ref_template = templates_dict[template_ref]
                main_entry = {
                    'label': ref_template.get('label', template_ref),
                    'type': ref_template.get('type', template_ref),
                    'icon': ref_template.get('icon', 'FileText'),
                    'subData': ref_template.get('subData', []),
                    'required': is_mentioned
                }
            else:
                # Direct mainData entry
                main_entry = {
                    'label': main_item.get('label', template_ref or 'Data'),
                    'type': template_ref or main_item.get('type', 'generic'),
                    'icon': main_item.get('icon', 'FileText'),
                    'subData': main_item.get('subData', []),
                    'required': is_mentioned
                }
            main_data_list.append(main_entry)

        return {
            'type': 'object',
            'icon': template.get('icon', 'Folder'),
            'schema': {
                'label': template.get('label', 'Data'),
                'mainData': main_data_list
            }
        }
    else:
        # For atomic, return single mainData entry
        return {
            'type': 'object',
            'icon': template.get('icon', 'FileText'),
            'schema': {
                'label': template.get('label', 'Data'),
                'mainData': [{
                    'label': template.get('label', 'Data'),
                    'type': template.get('type', template.get('name', 'generic')),
                    'icon': template.get('icon', 'FileText'),
                    'subData': template.get('subData', [])
                }]
            }
        }

