"""
AI Structure Service

Handles AI calls for structure generation and regeneration.
"""

import sys
import os
from typing import Dict, Any, Optional

# Add backend/ai_prompts to path
backend_path = os.path.join(os.path.dirname(__file__), '..', '..', '..', 'backend')
if backend_path not in sys.path:
    sys.path.insert(0, backend_path)

from newBackend.services.svc_ai_client import chat_json
from ai_prompts.generate_structure_prompt import get_structure_generation_prompt
from ai_prompts.regenerate_structure_prompt import get_structure_regeneration_prompt


def generate_structure_ai(
    task_label: str,
    task_description: Optional[str] = None,
    provider: str = "openai",
    model: Optional[str] = None
) -> Dict[str, Any]:
    """
    Generate structure using AI.

    Args:
        task_label: Task label
        task_description: Optional task description
        provider: AI provider (openai/groq)
        model: Optional model override

    Returns:
        AI response (should be JSON string or dict)
    """
    prompt = get_structure_generation_prompt(task_label, task_description)

    system_message = (
        "You are a Data Structure Generator. "
        "Your task is to generate hierarchical data structures for tasks. "
        "Return ONLY valid JSON, no markdown, no code fences, no comments."
    )

    messages = [
        {"role": "system", "content": system_message},
        {"role": "user", "content": prompt}
    ]

    response = chat_json(messages, provider=provider)
    return response


def regenerate_structure_ai(
    task_label: str,
    feedback: str,
    previous_structure: list,
    provider: str = "openai",
    model: Optional[str] = None
) -> Dict[str, Any]:
    """
    Regenerate structure using AI based on feedback.

    Args:
        task_label: Task label
        feedback: User feedback
        previous_structure: Previous structure
        provider: AI provider (openai/groq)
        model: Optional model override

    Returns:
        AI response (should be JSON string or dict)
    """
    prompt = get_structure_regeneration_prompt(task_label, feedback, previous_structure)

    system_message = (
        "You are a Data Structure Regenerator. "
        "Your task is to regenerate data structures based on user feedback. "
        "Return ONLY valid JSON, no markdown, no code fences, no comments."
    )

    messages = [
        {"role": "system", "content": system_message},
        {"role": "user", "content": prompt}
    ]

    response = chat_json(messages, provider=provider)
    return response
