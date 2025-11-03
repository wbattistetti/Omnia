from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from newBackend.api.api_codegen import router as cond_router
from newBackend.api.api_nlp import router as nlp_router
from newBackend.api.api_proxy_express import router as proxy_router
from newBackend.api.api_nlp_config import router as nlp_config_router
from newBackend.api.api_factory import router as factory_router
import os
import sys
import httpx
from typing import Dict, List, Optional
import asyncio

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
    from backend.ai_steps.parse_address import router as parse_address_router
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
    parse_address_router = APIRouter()

# Import intent generation router from old backend
try:
    from backend.ai_endpoints.intent_generation import router as intent_gen_router
    print("[INFO] Intent generation router loaded successfully")
except ImportError as e:
    print(f"Warning: Could not import intent generation router: {e}")
    from fastapi import APIRouter
    intent_gen_router = APIRouter()

# Import intent embeddings router from old backend
try:
    from backend.ai_endpoints.intent_embeddings import router as intent_embeddings_router
    print("[INFO] Intent embeddings router loaded successfully")
except ImportError as e:
    print(f"Warning: Could not import intent embeddings router: {e}")
    from fastapi import APIRouter
    intent_embeddings_router = APIRouter()

# Create empty routers for NER and LLM extract (will be implemented in api_nlp)
from fastapi import APIRouter
ner_router = APIRouter()
llm_extract_router = APIRouter()

# Cache in memoria per tutti gli agent acts disponibili
all_agent_acts_cache: Dict[str, dict] = {}
is_cache_loaded = False

async def load_all_agent_acts():
    """Carica tutti gli agent acts disponibili in memoria con retry e backoff esponenziale"""
    global all_agent_acts_cache, is_cache_loaded

    max_retries = 3
    base_delay = 2  # secondi per il primo retry

    for attempt in range(max_retries):
        try:
            # Calcola delay esponenziale: 2s, 4s, 8s
            retry_delay = base_delay * (2 ** attempt)

            # Chiamata al backend Express per ottenere tutti gli agent acts
            express_url = "http://localhost:3100/api/factory/agent-acts"
            print(f"[DEBUG] Attempt {attempt + 1}/{max_retries} - Loading from: {express_url}")

            async with httpx.AsyncClient(timeout=10.0) as client:
                try:
                    response = await client.get(express_url)
                    print(f"[DEBUG] Response status: {response.status_code}")

                    if response.status_code == 200:
                        all_agent_acts_cache.clear()

                        # DEBUG: stampa cosa restituisce realmente l'endpoint
                        response_text = response.text
                        print(f"[DEBUG] Response text (first 500 chars): {response_text[:500]}...")

                        # Prova a parsare come JSON
                        try:
                            response_data = response.json()
                            print(f"[DEBUG] Parsed JSON type: {type(response_data)}")

                            # Estrai gli agent acts dalla proprietà 'items'
                            if isinstance(response_data, dict) and 'items' in response_data:
                                agent_acts = response_data['items']
                                print(f"[DEBUG] Found {len(agent_acts)} items in response")

                                for i, act in enumerate(agent_acts[:3]):  # Log primi 3
                                    print(f"[DEBUG] Item {i}: {type(act)} - {str(act)[:100]}...")

                                for act in agent_acts:
                                    if isinstance(act, dict):
                                        # Usa 'label' come ID se non c'è 'id'
                                        act_id = act.get('id') or act.get('label', 'unknown')
                                        all_agent_acts_cache[act_id] = act
                                    else:
                                        print(f"[WARN] Skipping invalid act: {act}")

                                is_cache_loaded = True
                                print(f"[SUCCESS] Loaded {len(all_agent_acts_cache)} agent acts after {attempt + 1} attempts")
                                return  # Successo, esci dalla funzione
                            else:
                                print(f"[ERROR] Expected dict with 'items' property but got: {type(response_data)}")
                                print(f"[DEBUG] Response data: {response_data}")

                        except Exception as json_error:
                            print(f"[ERROR] Error parsing JSON: {json_error}")
                            print(f"[DEBUG] Raw response: {response_text}")
                    else:
                        print(f"[WARN] Status code not 200: {response.status_code}")

                except httpx.ConnectError:
                    print(f"[WARN] Backend Express not reachable (attempt {attempt + 1}/{max_retries})")
                    if attempt < max_retries - 1:
                        print(f"[INFO] Retrying in {retry_delay} seconds with exponential backoff...")
                        await asyncio.sleep(retry_delay)
                    continue
                except httpx.TimeoutException:
                    print(f"[WARN] Connection timeout to Express (attempt {attempt + 1}/{max_retries})")
                    if attempt < max_retries - 1:
                        print(f"[INFO] Retrying in {retry_delay} seconds with exponential backoff...")
                        await asyncio.sleep(retry_delay)
                    continue

        except Exception as e:
            print(f"[ERROR] Unexpected error during attempt {attempt + 1}: {e}")
            if attempt < max_retries - 1:
                print(f"[INFO] Retrying in {retry_delay} seconds...")
                await asyncio.sleep(retry_delay)

    print("[ERROR] Failed to load agent acts after all retries - proceeding without cache")
    print("[INFO] Cache will remain empty until manual reload via /api/debug/reload-cache")

# Funzioni per Intellisense in memoria
def find_intents_from_memory(instance_id: str) -> List[dict]:
    """Cerca intents dalla cache in memoria - SOSTITUISCE endpoint"""
    if not is_cache_loaded:
        return []

    # Cerca l'agent act per instanceId
    agent_act = all_agent_acts_cache.get(instance_id)
    if not agent_act:
        return []

    # Estrae gli intents direttamente dalla cache
    return agent_act.get('problem', {}).get('intents', [])

def find_agent_act_from_memory(act_id: str) -> Optional[dict]:
    """Cerca agent act dalla cache - SOSTITUISCE endpoint"""
    if not is_cache_loaded:
        return None
    return all_agent_acts_cache.get(act_id)

def get_agent_acts_by_type_from_memory(act_type: str) -> List[dict]:
    """Filtra agent acts per tipo - SOSTITUISCE endpoint"""
    if not is_cache_loaded:
        return []

    return [
        act for act in all_agent_acts_cache.values()
        if act.get('type') == act_type
    ]

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
app.include_router(parse_address_router)

# Include NER and LLM extract routers (empty for now - will be implemented in api_nlp)
app.include_router(ner_router)
app.include_router(llm_extract_router)

# Include intent generation router
app.include_router(intent_gen_router)

# Include intent embeddings router
app.include_router(intent_embeddings_router)

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

# Endpoint per verificare lo stato della cache
@app.get("/api/cache/status")
async def get_cache_status():
    """Restituisce lo stato della cache"""
    return {
        "is_loaded": is_cache_loaded,
        "agent_acts_count": len(all_agent_acts_cache),
        "loaded_at": "on_startup"
    }

# Endpoint per forzare il reload della cache
@app.post("/api/cache/reload")
async def reload_cache():
    """Forza il reload della cache"""
    await load_all_agent_acts()
    return {"success": True, "message": "Cache reloaded"}

@app.on_event("startup")
async def startup_event():
    """Carica tutti gli agent acts all'avvio dell'app"""
    await load_all_agent_acts()

@app.get("/api/agent-acts-from-cache")
async def get_all_agent_acts_from_cache():
    """Restituisce tutti gli agent acts dalla cache in memoria"""
    if not is_cache_loaded:
        return {"status": "cache_not_loaded", "message": "Cache non ancora caricata"}

    return {
        "status": "success",
        "count": len(all_agent_acts_cache),
        "agent_acts": list(all_agent_acts_cache.values())
    }

@app.get("/api/agent-acts-by-type/{act_type}")
async def get_agent_acts_by_type(act_type: str):
    """Restituisce agent acts filtrati per tipo"""
    if not is_cache_loaded:
        return {"status": "cache_not_loaded", "message": "Cache non ancora caricata"}

    filtered_acts = [
        act for act in all_agent_acts_cache.values()
        if act.get('type') == act_type
    ]

    return {
        "status": "success",
        "type": act_type,
        "count": len(filtered_acts),
        "agent_acts": filtered_acts
    }

@app.get("/api/find-agent-act/{act_id}")
async def find_agent_act(act_id: str):
    """Cerca un agent act specifico per ID"""
    if not is_cache_loaded:
        return {"status": "cache_not_loaded", "message": "Cache non ancora caricata"}

    agent_act = all_agent_acts_cache.get(act_id)

    if agent_act:
        return {"status": "success", "agent_act": agent_act}
    else:
        return {"status": "not_found", "message": f"Agent act con ID {act_id} non trovato"}

@app.get("/api/debug/reload-cache")
async def debug_reload_cache():
    """Endpoint di debug per forzare il reload della cache"""
    global all_agent_acts_cache, is_cache_loaded

    # Resetta lo stato
    all_agent_acts_cache.clear()
    is_cache_loaded = False

    # Forza il reload
    await load_all_agent_acts()

    return {
        "status": "reloaded",
        "cache_loaded": is_cache_loaded,
        "cache_size": len(all_agent_acts_cache)
    }

@app.get("/api/debug/cache-status")
async def debug_cache_status():
    """Endpoint di debug per vedere lo stato della cache"""
    return {
        "cache_loaded": is_cache_loaded,
        "cache_size": len(all_agent_acts_cache),
        "cache_keys": list(all_agent_acts_cache.keys())[:10]  # primi 10 keys
    }
