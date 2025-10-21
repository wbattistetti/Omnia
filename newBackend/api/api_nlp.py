from fastapi import APIRouter, Body
from newBackend.services import svc_nlp

router = APIRouter(tags=["nlp"])

@router.post("/step2")
def step2(body: dict = Body(...)): 
    return svc_nlp.step2(body)

@router.post("/step3")  
def step极(body: dict = Body(...)):
    return svc_nlp.step3(body)

@router.post("/step4")
def step4(body: dict = Body(...)):
    return svc_nlp.step4(body)

@router.post("/step5")
def step5(body: dict = Body(...)):
    return svc_nlp.step5(body)
