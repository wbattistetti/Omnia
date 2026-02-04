"""
Structure Parser

Parses and validates structure generation responses from AI.
"""

import json
import re
from typing import Dict, Any, List, Tuple


def parse_structure_response(response: str) -> List[Dict[str, Any]]:
    """
    Parse structure response from AI.
    Extracts JSON from response (removes markdown if present).

    Args:
        response: AI response (string or dict)

    Returns:
        Parsed structure array

    Raises:
        ValueError: If parsing fails
    """
    # If already dict, extract structure
    if isinstance(response, dict):
        if "structure" in response:
            return response["structure"]
        return response

    # If string, try to extract JSON
    if isinstance(response, str):
        # Try to find JSON object
        json_match = re.search(r'\{[\s\S]*\}', response)
        if json_match:
            parsed = json.loads(json_match.group(0))
            if "structure" in parsed:
                return parsed["structure"]
            return parsed if isinstance(parsed, list) else [parsed]

        # Try direct JSON parse
        try:
            parsed = json.loads(response)
            if "structure" in parsed:
                return parsed["structure"]
            return parsed if isinstance(parsed, list) else [parsed]
        except json.JSONDecodeError:
            raise ValueError(f"Invalid JSON in response: {response[:200]}")

    raise ValueError(f"Unexpected response type: {type(response)}")


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

        # Validate subData recursively
        sub_data = node.get("subData", [])
        if sub_data:
            if not isinstance(sub_data, list):
                errors.append(f"Node at path {'/'.join(path)} has invalid subData (must be array)")
            else:
                for i, sub_node in enumerate(sub_data):
                    validate_node(sub_node, path + [node.get("label", f"node-{i}")], depth + 1)

    for i, node in enumerate(structure):
        validate_node(node, [f"root-{i}"], 0)

    return len(errors) == 0, errors


def parse_and_validate_structure(response: str) -> Tuple[List[Dict[str, Any]], List[str]]:
    """
    Parse and validate structure in one step.

    Args:
        response: AI response

    Returns:
        Tuple of (structure, errors)
    """
    try:
        structure = parse_structure_response(response)
        is_valid, errors = validate_structure(structure)
        if not is_valid:
            return [], errors
        return structure, []
    except Exception as e:
        return [], [str(e)]
