"""
Generalizability Parser

Parses and validates generalizability check responses from AI.
"""

import json
import re
from typing import Dict, Any, Tuple


def parse_generalizability_response(response: str) -> Dict[str, Any]:
    """
    Parse generalizability response from AI.

    Args:
        response: AI response (string or dict)

    Returns:
        Parsed generalizability dict

    Raises:
        ValueError: If parsing fails
    """
    # If already dict, return as is
    if isinstance(response, dict):
        return response

    # If string, try to extract JSON
    if isinstance(response, str):
        json_match = re.search(r'\{[\s\S]*\}', response)
        if json_match:
            return json.loads(json_match.group(0))

        try:
            return json.loads(response)
        except json.JSONDecodeError:
            raise ValueError(f"Invalid JSON in response: {response[:200]}")

    raise ValueError(f"Unexpected response type: {type(response)}")


def validate_generalizability_response(data: Dict[str, Any]) -> Tuple[bool, List[str]]:
    """
    Validate generalizability response.

    Args:
        data: Parsed response dict

    Returns:
        Tuple of (is_valid, errors)
    """
    errors = []

    # Check required fields
    if "generalizable" not in data:
        errors.append("Missing required field: generalizable")
    elif not isinstance(data["generalizable"], bool):
        errors.append("generalizable must be boolean")

    if "confidence" not in data:
        errors.append("Missing required field: confidence")
    elif not isinstance(data["confidence"], (int, float)) or not (0 <= data["confidence"] <= 1):
        errors.append("confidence must be number between 0 and 1")

    if "reasons" not in data:
        errors.append("Missing required field: reasons")
    elif not isinstance(data["reasons"], list):
        errors.append("reasons must be array")

    if "barriers" not in data:
        errors.append("Missing required field: barriers")
    elif not isinstance(data["barriers"], list):
        errors.append("barriers must be array")

    if "suggestions" not in data:
        errors.append("Missing required field: suggestions")
    elif not isinstance(data["suggestions"], list):
        errors.append("suggestions must be array")

    return len(errors) == 0, errors


def parse_and_validate_generalizability(response: str) -> Tuple[Dict[str, Any], List[str]]:
    """
    Parse and validate generalizability in one step.

    Args:
        response: AI response

    Returns:
        Tuple of (generalizability_data, errors)
    """
    try:
        data = parse_generalizability_response(response)
        is_valid, errors = validate_generalizability_response(data)
        if not is_valid:
            return {}, errors
        return data, []
    except Exception as e:
        return {}, [str(e)]


def parse_equivalence_response(response: str) -> Dict[str, Any]:
    """
    Parse equivalence response from AI.

    Args:
        response: AI response (string or dict)

    Returns:
        Parsed equivalence dict

    Raises:
        ValueError: If parsing fails
    """
    # If already dict, return as is
    if isinstance(response, dict):
        return response

    # If string, try to extract JSON
    if isinstance(response, str):
        json_match = re.search(r'\{[\s\S]*\}', response)
        if json_match:
            return json.loads(json_match.group(0))

        try:
            return json.loads(response)
        except json.JSONDecodeError:
            raise ValueError(f"Invalid JSON in response: {response[:200]}")

    raise ValueError(f"Unexpected response type: {type(response)}")


def validate_equivalence_response(data: Dict[str, Any]) -> Tuple[bool, List[str]]:
    """
    Validate equivalence response.

    Args:
        data: Parsed response dict

    Returns:
        Tuple of (is_valid, errors)
    """
    errors = []

    # Check required fields
    if "equivalent" not in data:
        errors.append("Missing required field: equivalent")
    elif not isinstance(data["equivalent"], bool):
        errors.append("equivalent must be boolean")

    if data.get("equivalent") and not data.get("matchingTemplateId"):
        errors.append("matchingTemplateId must be provided when equivalent is true")

    if "confidence" not in data:
        errors.append("Missing required field: confidence")
    elif not isinstance(data["confidence"], (int, float)) or not (0 <= data["confidence"] <= 1):
        errors.append("confidence must be number between 0 and 1")

    if "matchReasons" not in data:
        errors.append("Missing required field: matchReasons")
    elif not isinstance(data["matchReasons"], list):
        errors.append("matchReasons must be array")

    if "differences" not in data:
        errors.append("Missing required field: differences")
    elif not isinstance(data["differences"], list):
        errors.append("differences must be array")

    return len(errors) == 0, errors


def parse_and_validate_equivalence(response: str) -> Tuple[Dict[str, Any], List[str]]:
    """
    Parse and validate equivalence in one step.

    Args:
        response: AI response

    Returns:
        Tuple of (equivalence_data, errors)
    """
    try:
        data = parse_equivalence_response(response)
        is_valid, errors = validate_equivalence_response(data)
        if not is_valid:
            return {}, errors
        return data, []
    except Exception as e:
        return {}, [str(e)]
