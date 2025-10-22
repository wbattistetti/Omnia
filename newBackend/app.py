from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from newBackend.api.api_codegen import router as cond_router
from newBackend.api.api_nlp import router as nlp_router
from newBackend.api.api_proxy_express import router as proxy_router
import os
import sys

# Add path to old backend for imports
old_backend_path = os.path.join(os.path.dirname(__file__), '..', 'backend')
if old_backend_path not in sys.path:
    sys.path.insert(0, old_backend_path)

# Import routers from old backend
try:
    from ai_steps.startPrompt import router as startPrompt_router
    from ai_steps.stepNoMatch import router as stepNoMatch_router
    from ai_steps.stepNoInput import router as stepNoInput_router
    from ai_steps.stepConfirmation import router as stepConfirmation_router
    from ai_steps.stepSuccess import router as stepSuccess_router
    from ai_steps.stepNotConfirmed import router as stepNotConfirmed_router
    from ner_spacy import router as ner_router
    from ai_steps.nlp_extract import router as llm_extract_router
    print("Successfully imported old backend routers")
except ImportError as e:
    print(f"Failed to import old backend routers: {e}")
    # Create empty routers as fallback
    from fastapi import APIRouter
    startPrompt_router = APIRouter()
    stepNoMatch_router = APIRouter()
    stepNoInput_router = APIRouter()
    stepConfirmation_router = APIRouter()
    stepSuccess_router = APIRouter()
    stepNotConfirmed_router = APIRouter()
    ner_router = APIRouter()
    llm_extract_router = APIRouter()

app = FastAPI()

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

# Include routers
app.include_router(cond_router)
app.include_router(nlp_router)
app.include_router(proxy_router)

# Include DDT wizard step routers
app.include_router(startPrompt_router)
app.include_router(stepNoMatch_router)
app.include_router(stepNoInput_router)
app.include_router(stepConfirmation_router)
app.include_router(stepSuccess_router)
app.include_router(stepNotConfirmed_router)

# Include NER and LLM extract routers
app.include_router(ner_router)
app.include_router(llm_extract_router)
