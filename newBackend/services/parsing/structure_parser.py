"""
Structure Parser

Parses and validates structure generation responses from AI.
"""

import json
import re
from typing import Dict, Any, List, Tuple


def parse_structure_response(response: str) -> Dict[str, Any]:
    """
    Parse structure response from AI.
    Extracts JSON from response (removes markdown if present).

    Args:
        response: AI response (string or dict)

    Returns:
        Dict with keys: structure, shouldBeGeneral, generalizedLabel, generalizationReason

    Raises:
        ValueError: If parsing fails
    """
    parsed_dict = {}

    # If already dict, use it directly
    if isinstance(response, dict):
        parsed_dict = response
    # If string, try to extract JSON
    elif isinstance(response, str):
        # Try to find JSON object
        json_match = re.search(r'\{[\s\S]*\}', response)
        if json_match:
            parsed_dict = json.loads(json_match.group(0))
        else:
            # Try direct JSON parse
            try:
                parsed_dict = json.loads(response)
            except json.JSONDecodeError:
                raise ValueError(f"Invalid JSON in response: {response[:200]}")
    else:
        raise ValueError(f"Unexpected response type: {type(response)}")

    # Extract structure (required)
    if "structure" in parsed_dict:
        structure = parsed_dict["structure"]
    elif isinstance(parsed_dict, list):
        structure = parsed_dict
    else:
        structure = [parsed_dict]

    # Extract generalization fields (optional)
    should_be_general = parsed_dict.get("shouldBeGeneral", False)
    generalized_label = parsed_dict.get("generalizedLabel")
    generalization_reason = parsed_dict.get("generalizationReason")
    generalized_messages = parsed_dict.get("generalizedMessages")

    return {
        "structure": structure,
        "shouldBeGeneral": should_be_general,
        "generalizedLabel": generalized_label,
        "generalizationReason": generalization_reason,
        "generalizedMessages": generalized_messages
    }


def validate_structure(structure: List[Dict[str, Any]]) -> Tuple[bool, List[str]]:
    """
    Validate structure.

    Args:
        structure: Structure array to validate

    Returns:
        Tuple of (is_valid, errors)
    """
    errors = []

    # Must be array
    if not isinstance(structure, list):
        errors.append("Structure must be an array")
        return False, errors

    # Must have at least one node
    if len(structure) == 0:
        errors.append("Structure must have at least one node (root)")
        return False, errors

    # Validate each node recursively
    def validate_node(node: Dict[str, Any], path: List[str], depth: int) -> None:
        if depth > 3:
            errors.append(f"Node at path {'/'.join(path)} exceeds maximum depth of 3")
            return

        # Check required fields
        if not node.get("label") or not str(node.get("label", "")).strip():
            errors.append(f"Node at path {'/'.join(path) if path else 'root'} has empty label")

        # Check id (optional but recommended)
        if not node.get("id"):
            # Will be auto-generated, but log warning
            pass

        # Validate subNodes recursively (preferred) or subData (backward compatibility)
        sub_nodes = node.get("subNodes", node.get("subData", []))
        if sub_nodes:
            if not isinstance(sub_nodes, list):
                errors.append(f"Node at path {'/'.join(path)} has invalid subNodes/subData (must be array)")
            else:
                for i, sub_node in enumerate(sub_nodes):
                    validate_node(sub_node, path + [node.get("label", f"node-{i}")], depth + 1)

    for i, node in enumerate(structure):
        validate_node(node, [f"root-{i}"], 0)

    return len(errors) == 0, errors


def normalize_subdata_to_subnodes(node: Dict[str, Any]) -> Dict[str, Any]:
    """
    Normalize node structure: convert subData to subNodes (backward compatibility).

    Args:
        node: Node dictionary (may have subData or subNodes)

    Returns:
        Normalized node with subNodes (subData converted if present)
    """
    normalized = node.copy()

    # If subData exists but subNodes doesn't, convert subData to subNodes
    if "subData" in normalized and "subNodes" not in normalized:
        sub_data = normalized.pop("subData", [])
        if sub_data:
            normalized["subNodes"] = [normalize_subdata_to_subnodes(child) for child in sub_data]
    # If subNodes exists, normalize recursively
    elif "subNodes" in normalized:
        normalized["subNodes"] = [normalize_subdata_to_subnodes(child) for child in normalized["subNodes"]]

    return normalized


def parse_and_validate_structure(response: str) -> Tuple[List[Dict[str, Any]], List[str], Dict[str, Any]]:
    """
    Parse and validate structure in one step.
    Normalizes subData to subNodes for backward compatibility.

    Args:
        response: AI response

    Returns:
        Tuple of (structure, errors, generalization_info)
        generalization_info contains: shouldBeGeneral, generalizedLabel, generalizationReason
    """
    try:
        parsed = parse_structure_response(response)
        structure = parsed["structure"]
        generalization_info = {
            "shouldBeGeneral": parsed.get("shouldBeGeneral", False),
            "generalizedLabel": parsed.get("generalizedLabel"),
            "generalizationReason": parsed.get("generalizationReason"),
            "generalizedMessages": parsed.get("generalizedMessages")
        }

        is_valid, errors = validate_structure(structure)
        if not is_valid:
            return [], errors, generalization_info

        # Normalize: convert subData to subNodes (backward compatibility)
        normalized_structure = [normalize_subdata_to_subnodes(node) for node in structure]

        return normalized_structure, [], generalization_info
    except Exception as e:
        return [], [str(e)], {"shouldBeGeneral": False, "generalizedLabel": None, "generalizationReason": None, "generalizedMessages": None}
