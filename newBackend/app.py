from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from newBackend.api.api_codegen import router as cond_router
from newBackend.api.api_nlp import router as nlp_router
from newBackend.api.api_proxy_express import router as proxy_router
from newBackend.api.api_nlp_config import router as nlp_config_router
from newBackend.api.api_factory import router as factory_router
import os
import sys

# Add path to old backend for imports - keep for potential future use
old_backend_path = os.path.join(os.path.dirname(__file__), '..', 'backend')
if old_backend_path not in sys.path:
    sys.path.insert(0, old_backend_path)

# Import real DDT wizard routers from old backend
try:
    from backend.ai_steps.startPrompt import router as startPrompt_router
    from backend.ai_steps.stepNoMatch import router as stepNoMatch_router
    from backend.ai_steps.stepNoInput import router as stepNoInput_router
    from backend.ai_steps.stepConfirmation import router as stepConfirmation_router
    from backend.ai_steps.stepSuccess import router as stepSuccess_router
    from backend.ai_steps.stepNotConfirmed import router as stepNotConfirmed_router
except ImportError as e:
    print(f"Warning: Could not import DDT wizard routers: {e}")
    # Fallback to empty routers
    from fastapi import APIRouter
    startPrompt_router = APIRouter()
    stepNoMatch_router = APIRouter()
    stepNoInput_router = APIRouter()
    stepConfirmation_router = APIRouter()
    stepSuccess_router = APIRouter()
    stepNotConfirmed_router = APIRouter()

# Create empty routers for NER and LLM extract (will be implemented in api_nlp)
from fastapi import APIRouter
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
app.include_router(factory_router)
app.include_router(nlp_config_router)

# Include DDT wizard step routers (empty for now)
app.include_router(startPrompt_router)
app.include_router(stepNoMatch_router)
app.include_router(stepNoInput_router)
app.include_router(stepConfirmation_router)
app.include_router(stepSuccess_router)
app.include_router(stepNotConfirmed_router)

# Include NER and LLM extract routers (empty for now - will be implemented in api_nlp)
app.include_router(ner_router)
app.include_router(llm_extract_router)

# Include factory router with error handling
try:
    from newBackend.api.api_factory import router as api_factory_router
    app.include_router(api_factory_router)
    print("[INFO] Factory router loaded successfully")
except Exception as e:
    print(f"[WARNING] Factory router failed to load: {e}")
    # Create empty router as fallback
    from fastapi import APIRouter
    api_factory_router = APIRouter()
