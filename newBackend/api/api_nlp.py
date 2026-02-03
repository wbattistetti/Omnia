from fastapi import APIRouter, Body, HTTPException
from newBackend.services import svc_nlp
from typing import Any
import re

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
def step3(body: dict = Body(...)):
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

@router.post("/api/nlp/generate-regex")
def generate_regex(body: dict = Body(...)):
    """
    Generate a regex pattern using fixed template and semantic contract
    """
    from newBackend.services.svc_ai_client import chat_json
    from newBackend.core.core_settings import OPENAI_KEY
    import json

    description = (body or {}).get("description", "").strip()  # ✅ Full prompt from fixed template
    tree_structure = (body or {}).get("treeStructure")  # ✅ Semantic contract
    tester_feedback = (body or {}).get("testerFeedback", [])  # ✅ Tester feedback in correct format
    engine = (body or {}).get("engine", "regex")  # ✅ Engine type
    provider = (body or {}).get("provider", "openai")
    model = (body or {}).get("model")

    # ✅ LOG DETTAGLIATO DEL MESSAGGIO COMPLETO ALL'AI
    print("\n" + "="*60)
    print("[apiNew] MESSAGGIO COMPLETO ALL'AI (Refine Regex)")
    print("="*60)
    print(f"[apiNew] PROMPT (from fixed template):")
    print(f"[apiNew] {description[:200]}...")  # First 200 chars
    print("-"*60)
    print(f"[apiNew] REQUEST BODY COMPLETO:")
    print(f"[apiNew] {json.dumps(body, indent=2, ensure_ascii=False)}")
    print("-"*60)
    print(f"[apiNew] CONFIGURAZIONE:")
    print(f"[apiNew]   - Provider: {provider}")
    print(f"[apiNew]   - Model: {model or '(default)'}")
    print(f"[apiNew]   - Engine: {engine}")
    print(f"[apiNew]   - Has Contract: {tree_structure is not None}")
    print(f"[apiNew]   - Tester Feedback: {len(tester_feedback) if isinstance(tester_feedback, list) else 0} items")
    print("="*60)

    if not description:
        return {"error": "Description is required"}

    if not OPENAI_KEY:
        return {"error": "OPENAI_KEY not configured"}

    # ✅ Prompt is already built with fixed template in frontend
    # description contains the complete prompt from buildAIPrompt()
    prompt = description

    # ✅ Get system message based on engine
    system_message = get_system_message_for_engine(engine)

    # ✅ LOG DEL PROMPT COMPLETO PRIMA DELL'INVIO
    print(f"[apiNew] PROMPT COMPLETO PRIMA DELL'INVIO ALL'AI:")
    print(f"[apiNew] {prompt}")
    print("="*60 + "\n")

    try:
        ai_response = chat_json([
            {"role": "system", "content": system_message},
            {"role": "user", "content": prompt}
        ], provider=provider if provider else "openai")

        # Parse response
        if isinstance(ai_response, str):
            import json
            result = json.loads(ai_response)
        else:
            result = ai_response

        # Validate regex can be compiled
        try:
            re.compile(result.get('regex', ''))
        except Exception as regex_error:
            result['warning'] = f"Generated regex may be invalid: {str(regex_error)}"

        return {
            "success": True,
            "regex": result.get('regex', ''),
            "explanation": result.get('explanation', ''),
            "examples": result.get('examples', []),
            "flags": result.get('flags', 'g')
        }

    except Exception as e:
        return {"error": f"Error generating regex: {str(e)}"}

def get_system_message_for_engine(engine: str) -> str:
    """Get system message based on engine type"""
    if engine == 'regex':
        return 'You are a regex expert. Always return valid JSON.'
    elif engine == 'llm':
        return 'You are an information extraction expert. Always return valid JSON.'
    elif engine == 'rule_based':
        return 'You are a rule-based extraction expert. Always return valid JSON.'
    else:
        return 'You are a data extraction expert. Always return valid JSON.'

@router.post("/api/task/{task_id}/test-extraction")
async def test_extraction(task_id: str, body: dict = Body(...)):
    """
    Test extraction using full runtime (engine + contract)
    Backend executes engine and applies contract for normalization/validation
    """
    try:
        text = body.get("text", "")
        if not text:
            return {
                "values": {},
                "hasMatch": False,
                "source": None,
                "errors": ["Text is required"],
                "confidence": 0
            }

        # Load contract and engine from template
        from newBackend.services.database_service import databaseService

        # Load task from database
        collection = databaseService.db["Tasks"]
        task = collection.find_one({
            "$or": [
                {"id": task_id},
                {"_id": task_id}
            ]
        })

        if not task:
            return {
                "values": {},
                "hasMatch": False,
                "source": None,
                "errors": [f"Task not found: {task_id}"],
                "confidence": 0
            }

        # Extract semantic contract and engine
        contract = task.get("semanticContract")
        engine = task.get("engine")

        if not contract:
            return {
                "values": {},
                "hasMatch": False,
                "source": None,
                "errors": [f"Semantic contract not found for task: {task_id}"],
                "confidence": 0
            }

        if not engine:
            return {
                "values": {},
                "hasMatch": False,
                "source": None,
                "errors": [f"Engine not found for task: {task_id}"],
                "confidence": 0
            }

        # Create ContractExtractor and extract
        from newBackend.services.contract_extractor import ContractExtractor

        extractor = ContractExtractor(contract, engine)
        result = extractor.extract(text)

        return result

    except Exception as e:
        import traceback
        print(f"[TEST_EXTRACTION] Error: {str(e)}")
        traceback.print_exc()
        return {
            "values": {},
            "hasMatch": False,
            "source": None,
            "errors": [str(e)],
            "confidence": 0
        }

@router.post("/api/ner/extract")
def ner_extract(body: dict = Body(...)):
    """
    NER extraction endpoint - extract entities from text using rule-based methods
    """
    try:
        from newBackend.services.svc_nlp import ner_extract as ner_service
        result = ner_service(body)
        # Ensure result has the expected format
        if not isinstance(result, dict):
            return {"candidates": []}
        if "candidates" not in result:
            return {"candidates": result.get("results", []) if "results" in result else []}
        return result
    except Exception as e:
        import traceback
        print(f"[NER_EXTRACT] Error: {str(e)}")
        traceback.print_exc()
        return {"candidates": [], "error": str(e)}

@router.post("/api/nlp/llm-extract")
def llm_extract(body: dict = Body(...)):
    """
    LLM extraction endpoint - extract information using AI
    """
    from newBackend.services.svc_nlp import llm_extract as llm_service
    return llm_service(body)

# Add extract endpoint
@router.post("/extract")
async def extract_value(body: dict = Body(...)):
    """
    Extract value using factory-based extractors from database
    """
    try:
        text = body.get("text", "")
        extractorName = body.get("extractorName", "")
        result = await svc_nlp.extract_with_factory(extractorName, text)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
