"""
AI Structure Service (Unified)

Handles AI calls for structure generation and regeneration using a unified interface.
"""

import sys
import os
from typing import Dict, Any, Optional, List

# Add backend/ai_prompts to path
backend_path = os.path.join(os.path.dirname(__file__), '..', '..', '..', 'backend')
if backend_path not in sys.path:
    sys.path.insert(0, backend_path)

from newBackend.services.svc_ai_client import chat_json
from ai_prompts.generate_structure_prompt import get_structure_prompt


def get_structure_ai(
    task_label: str,
    task_description: Optional[str] = None,
    locale: str = "it",
    feedback: Optional[str] = None,
    previous_structure: Optional[List] = None,
    provider: str = "openai",
    model: Optional[str] = None
) -> Dict[str, Any]:
    """
    Unified AI structure service: automatically decides between generation and regeneration.

    Args:
        task_label: Task label
        task_description: Optional task description
        locale: Language code (e.g., "it", "en", "pt") - used to maintain language consistency
        feedback: Optional user feedback (if provided with previous_structure, triggers regeneration)
        previous_structure: Optional previous structure (if provided with feedback, triggers regeneration)
        provider: AI provider (openai/groq)
        model: Optional model override

    Returns:
        AI response (should be JSON string or dict)
    """
    # Determine mode based on feedback and previous_structure
    is_regeneration = feedback is not None and previous_structure is not None

    # Get unified prompt
    prompt = get_structure_prompt(
        task_label=task_label,
        task_description=task_description,
        locale=locale,
        feedback=feedback,
        previous_structure=previous_structure
    )

    # System message adapts to mode
    if is_regeneration:
        system_message = (
            "You are a Data Structure Regenerator. "
            "Your task is to regenerate data structures based on user feedback. "
            "Return ONLY valid JSON, no markdown, no code fences, no comments."
        )
    else:
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


# Backward compatibility: keep old function names
def generate_structure_ai(
    task_label: str,
    task_description: Optional[str] = None,
    provider: str = "openai",
    model: Optional[str] = None,
    locale: str = "it"
) -> Dict[str, Any]:
    """Backward compatibility wrapper for get_structure_ai."""
    return get_structure_ai(
        task_label=task_label,
        task_description=task_description,
        locale=locale,
        provider=provider,
        model=model
    )


def regenerate_structure_ai(
    task_label: str,
    feedback: str,
    previous_structure: list,
    provider: str = "openai",
    model: Optional[str] = None
) -> Dict[str, Any]:
    """Backward compatibility wrapper for get_structure_ai."""
    return get_structure_ai(
        task_label=task_label,
        feedback=feedback,
        previous_structure=previous_structure,
        provider=provider,
        model=model
    )
