from fastapi import APIRouter, Body
from newBackend.services.svc_ai_codegen import generate_condition, refine_code, lint_condition, normalize_pseudocode, suggest_test_cases

router = APIRouter(prefix="/api/conditions", tags=["conditions"])

@router.post("/generate")
def _generate(body: dict = Body(...)):
    """Generate a condition from natural language"""
    return generate_condition(
        body.get("nl", ""),
        body.get("variables") or [],
        out_lang=body.get("out_lang", "it"),
        provider=body.get("provider", "groq")
    )

@router.post("/normalize")
def _normalize(body: dict = Body(...)):
    """Turn informal/pseudo code + chat into clean JavaScript"""
    return normalize_pseudocode(
        pseudo=body.get("pseudo", ""),
        current_code=body.get("currentCode", ""),
        variables=body.get("variables") or [],
        mode=body.get("mode", "predicate"),
        label=body.get("label", "Condition"),
        provider=body.get("provider", "groq")
    )

@router.post("/suggest-cases")
def _suggest_cases(body: dict = Body(...)):
    """Suggest test cases for a condition"""
    return suggest_test_cases(
        nl=body.get("nl", ""),
        variables=body.get("variables") or [],
        provider=body.get("provider", "groq")
    )

@router.post("/repair")
def _repair(body: dict = Body(...)):
    """Repair and refine existing code"""
    return refine_code(
        body.get("kind", "condition_dsl"),
        body.get("script", ""),
        body.get("failures") or body.get("notes") or [],
        body.get("return", "module")
    )

@router.post("/lint")
def _lint(body: dict = Body(...)):
    """Lint condition code for policy violations"""
    return {"findings": lint_condition(
        body.get("code", ""),
        body.get("inputs") or []
    )}
