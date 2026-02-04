"""
Messages Parser

Parses and validates AI messages responses.
"""

import json
import re
from typing import Dict, Any, List, Tuple


def parse_messages_response(response: str) -> Dict[str, List[str]]:
    """
    Parse messages response from AI.
    Extracts JSON from response (removes markdown if present).

    Args:
        response: AI response (string or dict)

    Returns:
        Parsed messages dict

    Raises:
        ValueError: If parsing fails
    """
    # If already dict, return as is
    if isinstance(response, dict):
        return response

    # If string, try to extract JSON
    if isinstance(response, str):
        # Try to find JSON object
        json_match = re.search(r'\{[\s\S]*\}', response)
        if json_match:
            return json.loads(json_match.group(0))

        # Try direct JSON parse
        try:
            return json.loads(response)
        except json.JSONDecodeError:
            raise ValueError(f"Invalid JSON in response: {response[:200]}")

    raise ValueError(f"Unexpected response type: {type(response)}")


def validate_generalized_messages(messages: Dict[str, List[str]]) -> Tuple[bool, List[str]]:
    """
    Validate generalized messages structure.

    Args:
        messages: Messages dict to validate

    Returns:
        Tuple of (is_valid, errors)
    """
    errors = []
    required_keys = ["start", "noInput", "noMatch", "confirmation", "success"]

    # Check all required keys present
    for key in required_keys:
        if key not in messages:
            errors.append(f"Missing required key: {key}")
            continue

        if not isinstance(messages[key], list):
            errors.append(f"{key} must be an array")
            continue

    # Check message counts
    if "start" in messages and len(messages["start"]) != 1:
        errors.append("start must have exactly 1 message")

    if "noInput" in messages and len(messages["noInput"]) != 3:
        errors.append("noInput must have exactly 3 messages")

    if "noMatch" in messages and len(messages["noMatch"]) != 3:
        errors.append("noMatch must have exactly 3 messages")

    if "confirmation" in messages and len(messages["confirmation"]) != 2:
        errors.append("confirmation must have exactly 2 messages")

    if "success" in messages and len(messages["success"]) != 1:
        errors.append("success must have exactly 1 message")

    # Check message format
    if "start" in messages:
        for i, msg in enumerate(messages["start"]):
            if not isinstance(msg, str):
                errors.append(f"start[{i}] must be a string")
            elif not msg.endswith("?"):
                errors.append(f"start[{i}] must end with '?'")

    if "noInput" in messages:
        for i, msg in enumerate(messages["noInput"]):
            if not isinstance(msg, str):
                errors.append(f"noInput[{i}] must be a string")
            elif not msg.endswith("?"):
                errors.append(f"noInput[{i}] must end with '?'")

    if "noMatch" in messages:
        for i, msg in enumerate(messages["noMatch"]):
            if not isinstance(msg, str):
                errors.append(f"noMatch[{i}] must be a string")
            elif not msg.endswith("?"):
                errors.append(f"noMatch[{i}] must end with '?'")

    if "confirmation" in messages:
        for i, msg in enumerate(messages["confirmation"]):
            if not isinstance(msg, str):
                errors.append(f"confirmation[{i}] must be a string")
            elif "{{input}}" not in msg:
                errors.append(f"confirmation[{i}] must include '{{input}}' placeholder")

    return len(errors) == 0, errors


def parse_and_validate_messages(response: str) -> Tuple[Dict[str, List[str]], List[str]]:
    """
    Parse and validate messages in one step.

    Args:
        response: AI response

    Returns:
        Tuple of (messages, errors)
    """
    try:
        messages = parse_messages_response(response)
        is_valid, errors = validate_generalized_messages(messages)
        if not is_valid:
            return {}, errors
        return messages, []
    except Exception as e:
        return {}, [str(e)]
