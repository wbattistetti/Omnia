"""
AI Generalization Service

Handles AI calls for message generalization and generalizability checks.
"""

import sys
import os
from typing import Dict, Any, Optional

# Add backend/ai_prompts to path
backend_path = os.path.join(os.path.dirname(__file__), '..', '..', '..', 'backend')
if backend_path not in sys.path:
    sys.path.insert(0, backend_path)

from newBackend.services.svc_ai_client import chat_json
from ai_prompts.generalize_messages_prompt import get_generalize_messages_prompt
from ai_prompts.check_generalizability_prompt import get_generalizability_check_prompt


def generalize_messages_ai(
    contextual_messages: Dict[str, list],
    contract: Dict[str, Any],
    node_label: str,
    provider: str = "openai",
    model: Optional[str] = None
) -> Dict[str, Any]:
    """
    Generalize messages using AI.

    Args:
        contextual_messages: Contextual messages from instance
        contract: SemanticContract
        node_label: Node label
        provider: AI provider (openai/groq)
        model: Optional model override

    Returns:
        AI response (should be JSON string or dict)
    """
    prompt = get_generalize_messages_prompt(contextual_messages, contract, node_label)

    system_message = (
        "You are a Message Generalizer. "
        "Your task is to generalize contextual messages into reusable template messages. "
        "Return ONLY valid JSON, no markdown, no code fences, no comments."
    )

    messages = [
        {"role": "system", "content": system_message},
        {"role": "user", "content": prompt}
    ]

    response = chat_json(messages, provider=provider)
    return response


def check_generalizability_ai(
    contract: Dict[str, Any],
    node_label: str,
    contextual_messages: Dict[str, list],
    provider: str = "openai",
    model: Optional[str] = None
) -> Dict[str, Any]:
    """
    Check generalizability using AI.

    Args:
        contract: SemanticContract
        node_label: Node label
        contextual_messages: Contextual messages
        provider: AI provider (openai/groq)
        model: Optional model override

    Returns:
        AI response (should be JSON string or dict)
    """
    prompt = get_generalizability_check_prompt(contract, node_label, contextual_messages)

    system_message = (
        "You are a Template Generalizability Checker. "
        "Your task is to determine if a template can be generalized for reuse. "
        "Return ONLY valid JSON, no markdown, no code fences, no comments."
    )

    messages = [
        {"role": "system", "content": system_message},
        {"role": "user", "content": prompt}
    ]

    response = chat_json(messages, provider=provider)
    return response


def check_template_equivalence_ai(
    current_template: Dict[str, Any],
    existing_templates: list,
    provider: str = "openai",
    model: Optional[str] = None
) -> Dict[str, Any]:
    """
    Check template equivalence using AI.

    Args:
        current_template: Current template to check
        existing_templates: List of existing templates
        provider: AI provider (openai/groq)
        model: Optional model override

    Returns:
        AI response (should be JSON string or dict)
    """
    from ai_prompts.check_template_equivalence_prompt import get_template_equivalence_check_prompt

    prompt = get_template_equivalence_check_prompt(current_template, existing_templates)

    system_message = (
        "You are a Template Equivalence Checker. "
        "Your task is to determine if a template already exists that is equivalent. "
        "Return ONLY valid JSON, no markdown, no code fences, no comments."
    )

    messages = [
        {"role": "system", "content": system_message},
        {"role": "user", "content": prompt}
    ]

    response = chat_json(messages, provider=provider)
    return response
