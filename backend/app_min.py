from fastapi import FastAPI
import os, sys

# Make local imports work when running from backend/
_CURR_DIR = os.path.dirname(__file__)
if _CURR_DIR and _CURR_DIR not in sys.path:
    sys.path.insert(0, _CURR_DIR)

try:
    from backend.ner_spacy import router as ner_router
except Exception:
    from ner_spacy import router as ner_router
from backend.ai_steps.nlp_extract import router as nlp_extract_router

app = FastAPI()
app.include_router(ner_router)
app.include_router(nlp_extract_router)


@app.get("/api/ping")
def ping():
    return {"ok": True}


