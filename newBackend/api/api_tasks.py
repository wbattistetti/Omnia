# Please write clean, production-grade Python code.
# Avoid non-ASCII characters, Chinese symbols, or multilingual output.

from fastapi import APIRouter, Body, HTTPException
from typing import Any, Dict, Optional
from newBackend.core.core_settings import OPENAI_KEY

router = APIRouter(tags=["tasks"])

@router.post("/api/tasks/check-generalizability")
async def check_generalizability(body: dict = Body(...)):
    """
    Check if a TaskTree is generalizable (can be saved as a Factory Template).

    Input:
    - taskTree: TaskTree structure (with nodes, steps, etc.)
    - taskLabel: Label of the task
    - projectId: Optional project ID for context

    Output:
    - isGeneralizable: boolean
    - generalizationReason: string explaining why it's generalizable or not
    """
    try:
        task_tree = body.get("taskTree")
        task_label = body.get("taskLabel", "")
        project_id = body.get("projectId")

        if not task_tree:
            return {
                "isGeneralizable": False,
                "generalizationReason": "TaskTree is required"
            }

        # Extract structure information
        nodes = task_tree.get("nodes", [])
        steps = task_tree.get("steps", {})

        if not nodes or len(nodes) == 0:
            return {
                "isGeneralizable": False,
                "generalizationReason": "TaskTree has no nodes"
            }

        # Heuristic 1: Check if structure is generic (not project-specific)
        # A generalizable task should have:
        # - Common data types (date, email, phone, address, etc.)
        # - Not too many project-specific fields
        # - Reusable patterns

        common_types = {"date", "email", "phone", "address", "name", "text", "number", "boolean"}
        project_specific_indicators = ["id", "code", "reference", "custom", "internal"]

        generic_field_count = 0
        project_specific_count = 0

        def analyze_node(node: Dict[str, Any]) -> tuple[int, int]:
            """Recursively analyze node and subNodes"""
            generic = 0
            specific = 0

            node_type = (node.get("type") or "").lower()
            node_label = (node.get("label") or "").lower()

            # Check if type is common
            if any(common_type in node_type for common_type in common_types):
                generic += 1
            elif any(indicator in node_label for indicator in project_specific_indicators):
                specific += 1
            else:
                # Neutral - could be either
                generic += 0.5
                specific += 0.5

            # Analyze subNodes
            sub_nodes = node.get("subNodes", [])
            for sub_node in sub_nodes:
                sub_generic, sub_specific = analyze_node(sub_node)
                generic += sub_generic
                specific += sub_specific

            return generic, specific

        total_generic = 0
        total_specific = 0

        for node in nodes:
            generic, specific = analyze_node(node)
            total_generic += generic
            total_specific += specific

        # Heuristic 2: Check complexity
        # Simple structures (1-3 main fields) are more generalizable
        total_fields = len(nodes) + sum(len(node.get("subNodes", [])) for node in nodes)

        # Heuristic 3: Check if steps are generic or project-specific
        # Generic steps (start, noMatch, noInput) are more generalizable
        # Custom steps might indicate project-specific logic

        is_generic_structure = total_generic > total_specific * 1.5
        is_simple_structure = total_fields <= 5
        has_generic_steps = len(steps) > 0 and all(
            step_type in ["start", "noMatch", "noInput", "confirmation", "success"]
            for step_dict in steps.values()
            for step_type in step_dict.keys()
        )

        # Decision logic
        is_generalizable = False
        reason_parts = []

        if is_generic_structure:
            reason_parts.append("The structure uses common data types")
            is_generalizable = True
        else:
            reason_parts.append("The structure contains project-specific fields")

        if is_simple_structure:
            reason_parts.append("The structure is simple and reusable")
            is_generalizable = is_generalizable or True
        else:
            reason_parts.append("The structure is complex and may be project-specific")
            is_generalizable = is_generalizable and False

        if has_generic_steps:
            reason_parts.append("The steps use standard patterns")
            is_generalizable = is_generalizable or True
        else:
            reason_parts.append("The steps contain custom logic")
            is_generalizable = is_generalizable and False

        # Final decision: need at least 2 positive indicators
        positive_indicators = sum([
            is_generic_structure,
            is_simple_structure,
            has_generic_steps
        ])

        is_generalizable = positive_indicators >= 2

        generalization_reason = ". ".join(reason_parts)

        if is_generalizable:
            generalization_reason = f"This task seems generalizable. {generalization_reason}. It could be saved as a Factory Template for reuse across projects."
        else:
            generalization_reason = f"This task is project-specific. {generalization_reason}. It's recommended to keep it as a project-specific task."

        return {
            "isGeneralizable": is_generalizable,
            "generalizationReason": generalization_reason
        }

    except Exception as e:
        import traceback
        traceback.print_exc()
        return {
            "isGeneralizable": False,
            "generalizationReason": f"Error analyzing generalizability: {str(e)}"
        }
