from fastapi import APIRouter, Body
from newBackend.services import svc_nlp
from typing import Any

router = APIRouter(tags=["nlp"])

@router.post("/step2")
def step2(body: Any = Body(...)):
    # Handle both string and dictionary input
    if isinstance(body, str):
        # Convert string to expected dictionary format
        return svc_nlp.step2({"text": body})
    elif isinstance(body, dict):
        return svc_nlp.step2(body)
    else:
        # Handle other types by converting to string
        return svc_nlp.step2({"text": str(body)})

@router.post("/step3")
def step极(body: dict = Body(...)):
    return svc_nlp.step3(body)

@router.post("/step4")
def step4(body: dict = Body(...)):
    return svc_nlp.step4(body)

@router.post("/step5")
def step5(body: dict = Body(...)):
    return svc_nlp.step5(body)

@router.post("/api/nlp/refine-extractor")
def refine_extractor(body: dict = Body(...)):
    """
    Refine TypeScript extractor code based on user feedback and improvements
    """
    return svc_nlp.refine_extractor(body)
