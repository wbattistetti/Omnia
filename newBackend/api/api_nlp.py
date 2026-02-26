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
    # Sanitize unicode for Windows console
    safe_desc = description[:200].encode('ascii', 'ignore').decode('ascii')
    print(f"[apiNew] {safe_desc}...")
    print("-"*60)
    print(f"[apiNew] REQUEST BODY COMPLETO:")
    print(f"[apiNew] {json.dumps(body, indent=2, ensure_ascii=True)}")  # FIX: ensure_ascii=True per Windows
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
    # Sanitize unicode for Windows console
    safe_prompt = prompt.encode('ascii', 'ignore').decode('ascii')
    print(f"[apiNew] {safe_prompt}")
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
        import traceback
        error_trace = traceback.format_exc()
        # Sanitize error message for Windows console
        safe_error = str(e).encode('ascii', 'ignore').decode('ascii')
        safe_trace = error_trace.encode('ascii', 'ignore').decode('ascii')
        print(f"[apiNew] ERROR generating regex: {safe_error}")
        print(f"[apiNew] TRACEBACK: {safe_trace}")
        return {"error": f"Error generating regex: {safe_error}"}

def get_system_message_for_engine(engine: str) -> str:
    """Get system message based on engine type"""
    if engine == 'regex':
        return '''You are a regex expert. Always return valid JSON.
Generate JavaScript-compatible regex patterns with named groups.
CRITICAL: Use deterministic group names s1, s2, s3... in order (based on subentity index).
DO NOT use semantic names like "day", "month", "year", "giorno", "mese", "anno".'''
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

@router.post("/api/nlp/refine-contract")
def refine_contract(body: dict = Body(...)):
    """
    Refine semantic contract by enhancing descriptions, adding missing constraints,
    and correcting ambiguities. This is an additive operation that preserves the
    original contract structure.
    """
    from newBackend.services.svc_ai_client import chat_json
    from newBackend.core.core_settings import OPENAI_KEY
    import sys
    import os

    # Add backend/ai_prompts to path
    backend_path = os.path.join(os.path.dirname(__file__), '..', '..', 'backend')
    if backend_path not in sys.path:
        sys.path.insert(0, backend_path)

    from ai_prompts.generate_contract_refinement_prompt import get_contract_refinement_prompt

    contract = (body or {}).get("contract")
    node_label = (body or {}).get("nodeLabel")
    provider = (body or {}).get("provider", "openai")
    model = (body or {}).get("model")

    if not contract:
        return {"error": "Contract is required"}

    if not OPENAI_KEY:
        return {"error": "OPENAI_KEY not configured"}

    try:
        # Generate prompt
        prompt = get_contract_refinement_prompt(contract, node_label)

        # System message for contract refinement
        system_message = (
            "You are a Semantic Contract Refinement System. "
            "Your task is to enhance semantic contracts by adding missing information, "
            "correcting ambiguities, and improving semantic clarity. "
            "You must preserve the original contract structure and only add or enhance fields. "
            "Return ONLY valid JSON, no markdown, no code fences, no comments."
        )

        # Call AI
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

        return {
            "success": True,
            "refinement": result
        }

    except Exception as e:
        print(f"[refine-contract] Error: {str(e)}", flush=True)
        return {
            "success": False,
            "error": str(e)
        }

@router.post("/api/nlp/generate-canonical-values")
def generate_canonical_values(body: dict = Body(...)):
    """
    Generate canonical value sets for a semantic contract.
    Returns three types of examples: canonicalExamples, partialExamples, invalidExamples.
    This is an additive operation that preserves the original contract structure.
    """
    from newBackend.services.svc_ai_client import chat_json
    from newBackend.core.core_settings import OPENAI_KEY
    import sys
    import os

    # Add backend/ai_prompts to path
    backend_path = os.path.join(os.path.dirname(__file__), '..', '..', 'backend')
    if backend_path not in sys.path:
        sys.path.insert(0, backend_path)

    from ai_prompts.generate_canonical_values_prompt import get_canonical_values_prompt

    contract = (body or {}).get("contract")
    node_label = (body or {}).get("nodeLabel")
    provider = (body or {}).get("provider", "openai")
    model = (body or {}).get("model")

    if not contract:
        return {"error": "Contract is required"}

    if not OPENAI_KEY:
        return {"error": "OPENAI_KEY not configured"}

    try:
        # Generate prompt
        prompt = get_canonical_values_prompt(contract, node_label)

        # System message for canonical values generation
        system_message = (
            "You are a Canonical Values Generator. "
            "Your task is to generate comprehensive canonical value sets for semantic contracts. "
            "You must generate three types of examples: canonicalExamples (complete and valid), "
            "partialExamples (partial but useful), and invalidExamples (invalid for robustness testing). "
            "Return ONLY valid JSON, no markdown, no code fences, no comments."
        )

        # Call AI
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

        # Validate response structure
        if not isinstance(result, dict):
            raise ValueError("AI response is not a dictionary")

        # Ensure all required arrays exist
        if "canonicalExamples" not in result:
            result["canonicalExamples"] = []
        if "partialExamples" not in result:
            result["partialExamples"] = []
        if "invalidExamples" not in result:
            result["invalidExamples"] = []

        # Validate arrays are lists
        if not isinstance(result["canonicalExamples"], list):
            result["canonicalExamples"] = []
        if not isinstance(result["partialExamples"], list):
            result["partialExamples"] = []
        if not isinstance(result["invalidExamples"], list):
            result["invalidExamples"] = []

        # Ensure at least one canonical example
        if len(result["canonicalExamples"]) == 0:
            print("[generate-canonical-values] Warning: No canonical examples generated", flush=True)

        return {
            "success": True,
            "canonicalValues": result
        }

    except Exception as e:
        print(f"[generate-canonical-values] Error: {str(e)}", flush=True)
        return {
            "success": False,
            "error": str(e)
        }

@router.post("/api/nlp/generate-constraints")
def generate_constraints(body: dict = Body(...)):
    """
    Generate enhanced constraints for a semantic contract.
    Returns constraints coherent with canonical values and contract structure.
    This is an additive operation that preserves existing constraints.
    """
    from newBackend.services.svc_ai_client import chat_json
    from newBackend.core.core_settings import OPENAI_KEY
    import sys
    import os

    # Add backend/ai_prompts to path
    backend_path = os.path.join(os.path.dirname(__file__), '..', '..', 'backend')
    if backend_path not in sys.path:
        sys.path.insert(0, backend_path)

    from ai_prompts.generate_constraints_prompt import get_constraints_prompt

    contract = (body or {}).get("contract")
    node_label = (body or {}).get("nodeLabel")
    provider = (body or {}).get("provider", "openai")
    model = (body or {}).get("model")

    if not contract:
        return {"error": "Contract is required"}

    if not OPENAI_KEY:
        return {"error": "OPENAI_KEY not configured"}

    try:
        # Generate prompt
        prompt = get_constraints_prompt(contract, node_label)

        # System message for constraints generation
        system_message = (
            "You are a Constraints Generator. "
            "Your task is to generate comprehensive, coherent constraints for semantic contracts. "
            "Constraints must be coherent with canonical values and preserve existing constraints. "
            "Return ONLY valid JSON, no markdown, no code fences, no comments."
        )

        # Call AI
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

        # Validate response structure
        if not isinstance(result, dict):
            raise ValueError("AI response is not a dictionary")

        # Ensure constraints field exists
        if "constraints" not in result:
            result["constraints"] = {}

        # Validate constraints is an object
        if not isinstance(result["constraints"], dict):
            result["constraints"] = {}

        # Ensure subentityConstraints is an array
        if "subentityConstraints" not in result:
            result["subentityConstraints"] = []
        if not isinstance(result["subentityConstraints"], list):
            result["subentityConstraints"] = []

        return {
            "success": True,
            "constraints": result
        }

    except Exception as e:
        print(f"[generate-constraints] Error: {str(e)}", flush=True)
        return {
            "success": False,
            "error": str(e)
        }

# ❌ REMOVED: /api/nlp/generate-engines endpoint - legacy endpoint completely removed
# The new wizard flow uses /api/nlp/plan-engines + /api/nlp/generate-regex instead
# Any call to this endpoint will result in 404 Not Found

@router.post("/api/nlp/generate-escalation")
def generate_escalation(body: dict = Body(...)):
    """
    Generate engine escalation strategy for a semantic contract.
    Returns escalation configuration with engine priority order and default engine.
    This is an additive operation that preserves existing escalation if present.
    """
    from newBackend.services.svc_ai_client import chat_json
    from newBackend.core.core_settings import OPENAI_KEY
    import sys
    import os

    # Add backend/ai_prompts to path
    backend_path = os.path.join(os.path.dirname(__file__), '..', '..', 'backend')
    if backend_path not in sys.path:
        sys.path.insert(0, backend_path)

    from ai_prompts.generate_escalation_prompt import get_escalation_prompt

    contract = (body or {}).get("contract")
    engines = (body or {}).get("engines", [])
    node_label = (body or {}).get("nodeLabel")
    provider = (body or {}).get("provider", "openai")
    model = (body or {}).get("model")

    if not contract:
        return {"error": "Contract is required"}

    if not engines or len(engines) == 0:
        return {"error": "Engines are required (from STEP 4)"}

    if not OPENAI_KEY:
        return {"error": "OPENAI_KEY not configured"}

    try:
        # Generate prompt
        prompt = get_escalation_prompt(contract, engines, node_label)

        # System message for escalation generation
        system_message = (
            "You are an Escalation Generator. "
            "Your task is to generate optimal engine escalation strategies for semantic contracts. "
            "Escalation defines the order in which engines are tried until one succeeds or all fail. "
            "Return ONLY valid JSON, no markdown, no code fences, no comments."
        )

        # Call AI
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

        # Validate response structure
        if not isinstance(result, dict):
            raise ValueError("AI response is not a dictionary")

        # Ensure engines array exists
        if "engines" not in result:
            result["engines"] = []
        if not isinstance(result["engines"], list):
            result["engines"] = []

        # Validate engines array
        validated_engines = []
        available_engine_types = [e.get("type") for e in engines if e.get("type")]

        for engine_entry in result["engines"]:
            if not isinstance(engine_entry, dict):
                continue

            engine_type = engine_entry.get("type")
            priority = engine_entry.get("priority")
            enabled = engine_entry.get("enabled")

            # Validate engine type is in available engines
            if engine_type not in available_engine_types:
                continue

            # Validate priority is a number
            if not isinstance(priority, (int, float)):
                continue

            # Validate enabled is boolean
            if not isinstance(enabled, bool):
                continue

            validated_engines.append({
                "type": engine_type,
                "priority": int(priority),
                "enabled": enabled
            })

        # Sort by priority
        validated_engines.sort(key=lambda e: e["priority"])

        # Ensure at least one engine is enabled
        if not any(e["enabled"] for e in validated_engines):
            if validated_engines:
                validated_engines[0]["enabled"] = True

        # Validate default engine
        default_engine = result.get("defaultEngine")
        if default_engine and default_engine not in available_engine_types:
            # Set default to first enabled engine
            default_engine = next((e["type"] for e in validated_engines if e["enabled"]), None)

        # If no engines validated, create default escalation
        if not validated_engines:
            # Create default escalation from available engines
            for idx, engine in enumerate(engines):
                engine_type = engine.get("type")
                if engine_type:
                    validated_engines.append({
                        "type": engine_type,
                        "priority": idx + 1,
                        "enabled": True
                    })
            default_engine = validated_engines[0]["type"] if validated_engines else None

        return {
            "success": True,
            "escalation": {
                "engines": validated_engines,
                "defaultEngine": default_engine,
                "explanation": result.get("explanation", "")
            }
        }

    except Exception as e:
        print(f"[generate-escalation] Error: {str(e)}", flush=True)
        import traceback
        traceback.print_exc()
        return {
            "success": False,
            "error": str(e)
        }

@router.post("/api/nlp/plan-engines")
def plan_engines(body: dict = Body(...)):
    """
    Plan engines for all nodes in a task tree.
    Returns a plan specifying which engines to generate for each node.

    Input:
    {
        "contract": {
            "nodes": [
                {
                    "nodeId": "A",
                    "nodeLabel": "Data di nascita",
                    "contract": { "entity": {...}, "subEntities": [...] }
                },
                ...
            ]
        },
        "locale": "it",
        "provider": "openai",
        "model": "gpt-4-turbo-preview"
    }

    Output:
    {
        "success": true,
        "parsersPlan": [
            { "nodeId": "A", "engines": ["regex", "llm"] },
            { "nodeId": "B", "engines": ["regex"] },
            ...
        ]
    }
    """
    from newBackend.services.svc_ai_client import chat_json
    from newBackend.core.core_settings import OPENAI_KEY
    import sys
    import os
    import json

    # Add backend/ai_prompts to path
    backend_path = os.path.join(os.path.dirname(__file__), '..', '..', 'backend')
    if backend_path not in sys.path:
        sys.path.insert(0, backend_path)

    contract_tree = (body or {}).get("contract", {})
    locale = (body or {}).get("locale", "it")
    provider = (body or {}).get("provider", "openai")
    model = (body or {}).get("model")

    if not contract_tree or "nodes" not in contract_tree:
        return {
            "success": False,
            "error": "Contract tree with nodes is required"
        }

    if not OPENAI_KEY:
        return {
            "success": False,
            "error": "OPENAI_KEY not configured"
        }

    try:
        nodes = contract_tree.get("nodes", [])

        if not nodes or len(nodes) == 0:
            return {
                "success": False,
                "error": "At least one node is required in contract tree"
            }

        # Build prompt for AI to plan engines for all nodes
        nodes_summary = []
        for n in nodes:
            node_id = n.get("nodeId", "unknown")
            node_label = n.get("nodeLabel", "unknown")
            contract = n.get("contract", {})
            entity_label = contract.get("entity", {}).get("label", "unknown")
            sub_entities = contract.get("subEntities", [])
            nodes_summary.append({
                "nodeId": node_id,
                "nodeLabel": node_label,
                "entityLabel": entity_label,
                "subEntitiesCount": len(sub_entities),
                "subEntities": [se.get("label", "unknown") for se in sub_entities[:5]]  # Limit to first 5
            })

        prompt = f"""You are an Engine Planner. Your task is to determine which extraction engines should be generated for each node in a task tree.

TASK TREE ({len(nodes)} nodes):
{json.dumps(nodes_summary, indent=2)}

AVAILABLE ENGINES:
- regex: Pattern-based extraction (fast, deterministic, good for structured data)
- rule_based: Rule-based extraction (flexible, deterministic, good for complex logic)
- ner: Named Entity Recognition (context-aware, good for ambiguous data)
- llm: LLM-based extraction (most flexible, slower, good for complex cases)
- embedding: Embedding-based similarity (good for matching against examples)

RULES:
1. Each node may need 1-4 engines depending on complexity
2. Simple nodes (single value, no sub-entities) → regex + llm
3. Complex nodes (composite, multiple sub-entities) → regex + rule_based + llm
4. Nodes with examples or canonical values → include embedding
5. Nodes requiring context disambiguation → include ner
6. Always include at least regex and llm for fallback
7. Prioritize faster engines (regex, rule_based) over slower ones (llm, embedding)

RESPONSE FORMAT (strict JSON, no markdown, no code fences, no comments):
{{
  "parsersPlan": [
    {{"nodeId": "A", "engines": ["regex", "llm"]}},
    {{"nodeId": "B", "engines": ["regex", "rule_based", "llm"]}},
    ...
  ]
}}

Return ONLY the JSON object, nothing else."""

        system_message = (
            "You are an Engine Planner. "
            "Your task is to determine which extraction engines should be generated for each node in a task tree. "
            "Return ONLY valid JSON with parsersPlan array, no markdown, no code fences, no comments."
        )

        # Call AI
        ai_response = chat_json([
            {"role": "system", "content": system_message},
            {"role": "user", "content": prompt}
        ], provider=provider if provider else "openai")

        # Parse response
        if isinstance(ai_response, str):
            result = json.loads(ai_response)
        else:
            result = ai_response

        # Validate response structure
        if not isinstance(result, dict) or "parsersPlan" not in result:
            raise ValueError("AI response must contain parsersPlan array")

        parsers_plan = result.get("parsersPlan", [])
        if not isinstance(parsers_plan, list):
            raise ValueError("parsersPlan must be an array")

        # Validate each plan entry
        validated_plan = []
        valid_engine_types = ["regex", "rule_based", "ner", "llm", "embedding"]
        for entry in parsers_plan:
            if not isinstance(entry, dict):
                continue
            node_id = entry.get("nodeId")
            engines = entry.get("engines", [])
            if node_id and isinstance(engines, list):
                # Filter valid engine types
                valid_engines = [e for e in engines if e in valid_engine_types]
                if valid_engines:
                    validated_plan.append({
                        "nodeId": node_id,
                        "engines": valid_engines
                    })

        if len(validated_plan) == 0:
            raise ValueError("No valid engine plans found in AI response")

        print(f"[plan-engines] Engine plan generated", flush=True)
        print(f"  - total nodes: {len(nodes)}", flush=True)
        print(f"  - planned nodes: {len(validated_plan)}", flush=True)
        for plan in validated_plan:
            print(f"    - {plan['nodeId']}: {', '.join(plan['engines'])}", flush=True)

        return {
            "success": True,
            "parsersPlan": validated_plan
        }

    except Exception as e:
        print(f"[plan-engines] Error: {str(e)}", flush=True)
        import traceback
        traceback.print_exc()
        return {
            "success": False,
            "error": str(e)
        }

@router.post("/api/nlp/generate-test-examples")
def generate_test_examples(body: dict = Body(...)):
    """
    Generate test examples for a semantic contract.
    Returns three types of test examples: validExamples, edgeCaseExamples, invalidExamples.
    This is an additive operation that preserves existing test examples if present.
    """
    from newBackend.services.svc_ai_client import chat_json
    from newBackend.core.core_settings import OPENAI_KEY
    import sys
    import os

    # Add backend/ai_prompts to path
    backend_path = os.path.join(os.path.dirname(__file__), '..', '..', 'backend')
    if backend_path not in sys.path:
        sys.path.insert(0, backend_path)

    from ai_prompts.generate_test_examples_prompt import get_test_examples_prompt

    contract = (body or {}).get("contract")
    node_label = (body or {}).get("nodeLabel")
    provider = (body or {}).get("provider", "openai")
    model = (body or {}).get("model")

    if not contract:
        return {"error": "Contract is required"}

    if not OPENAI_KEY:
        return {"error": "OPENAI_KEY not configured"}

    try:
        # Generate prompt
        prompt = get_test_examples_prompt(contract, node_label)

        # System message for test examples generation
        system_message = (
            "You are a Test Examples Generator. "
            "Your task is to generate comprehensive test examples for semantic contracts. "
            "You must generate three types of examples: validExamples (should succeed), "
            "edgeCaseExamples (boundary conditions), and invalidExamples (should fail). "
            "Return ONLY valid JSON, no markdown, no code fences, no comments."
        )

        # Call AI
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

        # Validate response structure
        if not isinstance(result, dict):
            raise ValueError("AI response is not a dictionary")

        # Ensure all required arrays exist
        if "validExamples" not in result:
            result["validExamples"] = []
        if "edgeCaseExamples" not in result:
            result["edgeCaseExamples"] = []
        if "invalidExamples" not in result:
            result["invalidExamples"] = []

        # Validate arrays are lists
        if not isinstance(result["validExamples"], list):
            result["validExamples"] = []
        if not isinstance(result["edgeCaseExamples"], list):
            result["edgeCaseExamples"] = []
        if not isinstance(result["invalidExamples"], list):
            result["invalidExamples"] = []

        # Filter to ensure all items are strings
        result["validExamples"] = [ex for ex in result["validExamples"] if isinstance(ex, str)]
        result["edgeCaseExamples"] = [ex for ex in result["edgeCaseExamples"] if isinstance(ex, str)]
        result["invalidExamples"] = [ex for ex in result["invalidExamples"] if isinstance(ex, str)]

        # Ensure at least one valid example
        if len(result["validExamples"]) == 0:
            print("[generate-test-examples] Warning: No valid examples generated", flush=True)

        return {
            "success": True,
            "testExamples": result
        }

    except Exception as e:
        print(f"[generate-test-examples] Error: {str(e)}", flush=True)
        import traceback
        traceback.print_exc()
        return {
            "success": False,
            "error": str(e)
        }

@router.post("/api/nlp/generate-ai-messages")
def generate_ai_messages(body: dict = Body(...)):
    """
    Generate AI dialogue messages for a semantic contract.

    If stepType is provided, generates messages only for that specific step.
    If stepType is not provided, generates messages for all steps (legacy behavior).

    Args:
        body: Request body containing:
            - contract: SemanticContract object (required)
            - nodeLabel: Optional node label for context
            - stepType: Optional step type (start, noInput, noMatch, confirmation, notConfirmed, violation, disambiguation, success)
            - locale: Optional locale code (default: "it")
            - provider: Optional AI provider (default: "openai")
            - model: Optional AI model

    Returns:
        If stepType provided:
            {
                "success": True,
                "messages": ["message1", "message2", ...],
                "options": []  // Only for disambiguation step
            }
        If stepType not provided (legacy):
            {
                "success": True,
                "messages": {
                    "start": [...],
                    "noInput": [...],
                    ...
                }
            }
    """
    from newBackend.services.svc_ai_client import chat_json
    from newBackend.core.core_settings import OPENAI_KEY
    import sys
    import os

    # Add backend/ai_prompts to path
    backend_path = os.path.join(os.path.dirname(__file__), '..', '..', 'backend')
    if backend_path not in sys.path:
        sys.path.insert(0, backend_path)

    from ai_prompts.generate_ai_messages_prompt import get_ai_messages_prompt, get_ai_messages_prompt_for_step

    contract = (body or {}).get("contract")
    node_label = (body or {}).get("nodeLabel")
    step_type = (body or {}).get("stepType")  # ✅ NEW: stepType parameter
    locale = (body or {}).get("locale", "it")  # ✅ NEW: locale parameter
    provider = (body or {}).get("provider", "openai")
    model = (body or {}).get("model")

    if not contract:
        return {"error": "Contract is required"}

    if not OPENAI_KEY:
        return {"error": "OPENAI_KEY not configured"}

    try:
        # ✅ NEW: If stepType is provided, generate only for that step
        if step_type:
            # Validate stepType
            valid_step_types = ["start", "noInput", "noMatch", "confirmation", "notConfirmed", "violation", "disambiguation", "success"]
            if step_type not in valid_step_types:
                return {
                    "success": False,
                    "error": f"Invalid stepType: {step_type}. Must be one of: {valid_step_types}"
                }

            # Generate prompt for specific step
            prompt = get_ai_messages_prompt_for_step(contract, step_type, node_label, locale)

            # System message for specific step
            system_message = (
                f"You are a Dialogue Messages Generator. "
                f"Your task is to generate natural, spoken messages for the **{step_type}** step "
                f"in a voice-based customer care system. "
                f"Return ONLY valid JSON, no markdown, no code fences, no comments."
            )

            # Call AI
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

            # Validate response structure
            if not isinstance(result, dict):
                raise ValueError("AI response is not a dictionary")

            # Extract messages array
            messages = result.get("messages", [])
            if not isinstance(messages, list):
                # If messages is a string, convert to array
                if isinstance(messages, str):
                    messages = [messages]
                else:
                    messages = []

            # Filter to ensure all items are strings
            validated_messages = [str(msg) for msg in messages if isinstance(msg, str) and msg.strip()]

            # Extract options (only for disambiguation)
            options = result.get("options", [])
            if not isinstance(options, list):
                options = []

            # Fallback if no messages generated
            if len(validated_messages) == 0:
                print(f"[generate-ai-messages] Warning: No messages generated for stepType: {step_type}", flush=True)
                entity_label = contract.get("entity", {}).get("label", "value")

                # Step-specific fallbacks
                fallbacks = {
                    "start": [f"What's your {entity_label.lower()}?"],
                    "noInput": [f"Could you share the {entity_label.lower()}?"],
                    "noMatch": ["I didn't catch that. Could you repeat?"],
                    "confirmation": ["Is this correct: {{ '{{input}}' }}?"],
                    "notConfirmed": [f"Could you provide the correct {entity_label.lower()}?"],
                    "violation": [f"Could you provide a valid {entity_label.lower()}?"],
                    "disambiguation": ["Which one did you mean?"],
                    "success": ["Thanks, got it."]
                }
                validated_messages = fallbacks.get(step_type, ["Please provide the information."])

            return {
                "success": True,
                "messages": validated_messages,
                "options": options if step_type == "disambiguation" else []
            }

        # ✅ LEGACY: If stepType not provided, generate all steps (backward compatibility)
        else:
            # Generate prompt for all steps
            prompt = get_ai_messages_prompt(contract, node_label)

            # System message for AI messages generation
            system_message = (
                "You are a Dialogue Messages Generator. "
                "Your task is to generate natural, spoken messages for voice-based customer care systems. "
                "You must generate messages for: start, noInput, noMatch, confirmation, and success. "
                "Return ONLY valid JSON, no markdown, no code fences, no comments."
            )

            # Call AI
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

            # Validate response structure
            if not isinstance(result, dict):
                raise ValueError("AI response is not a dictionary")

            # Ensure all required message types exist
            required_types = ["start", "noInput", "noMatch", "confirmation", "success"]
            validated = {}

            for msg_type in required_types:
                if msg_type in result:
                    value = result[msg_type]
                    if isinstance(value, list):
                        # Filter to ensure all items are strings
                        validated[msg_type] = [str(msg) for msg in value if isinstance(msg, str) and msg.strip()]
                    elif isinstance(value, str):
                        # Single value -> convert to array
                        validated[msg_type] = [value.strip()] if value.strip() else []
                    else:
                        validated[msg_type] = []
                else:
                    validated[msg_type] = []

            # Validate minimum requirements
            if len(validated["start"]) == 0:
                print("[generate-ai-messages] Warning: No start messages generated", flush=True)
                # Create fallback
                entity_label = contract.get("entity", {}).get("label", "value")
                validated["start"] = [f"What's your {entity_label.lower()}?"]

            # Ensure noInput has 3 variations (or at least 1)
            if len(validated["noInput"]) == 0:
                entity_label = contract.get("entity", {}).get("label", "value")
                validated["noInput"] = [f"Could you share the {entity_label.lower()}?"]

            # Ensure noMatch has 3 variations (or at least 1)
            if len(validated["noMatch"]) == 0:
                entity_label = contract.get("entity", {}).get("label", "value")
                validated["noMatch"] = ["I didn't catch that. Could you repeat?"]

            # Ensure confirmation has at least 1 message
            if len(validated["confirmation"]) == 0:
                validated["confirmation"] = ["Is this correct: {{ '{{input}}' }}?"]

            # Ensure success has at least 1 message
            if len(validated["success"]) == 0:
                validated["success"] = ["Thanks, got it."]

            return {
                "success": True,
                "messages": validated
            }

    except Exception as e:
        print(f"[generate-ai-messages] Error: {str(e)}", flush=True)
        import traceback
        traceback.print_exc()
        return {
            "success": False,
            "error": str(e)
        }

@router.post("/api/nlp/generate-node-messages")
def generate_node_messages(body: dict = Body(...)):
    """
    Generate ALL messages for a single node in one AI call.

    Args:
        body: Request body containing:
            - nodeId: Node ID (required)
            - nodeLabel: Node label (required)
            - contract: SemanticContract object (required)
            - messageMatrix: Array of { guid, stepType, escalationIndex } (required)
            - locale: Locale code (default: "it")
            - provider: AI provider (default: "openai")
            - model: AI model (optional)

    Returns:
        {
            "success": True,
            "messages": {
                "GUID1": "testo1",
                "GUID2": "testo2",
                ...
            }
        }
    """
    from newBackend.services.svc_ai_client import chat_json
    from newBackend.core.core_settings import OPENAI_KEY
    import sys
    import os
    import json

    # Add backend/ai_prompts to path
    backend_path = os.path.join(os.path.dirname(__file__), '..', '..', 'backend')
    if backend_path not in sys.path:
        sys.path.insert(0, backend_path)

    from ai_prompts.generate_ai_messages_prompt import get_ai_messages_prompt_for_step

    node_id = (body or {}).get("nodeId")
    node_label = (body or {}).get("nodeLabel")
    contract = (body or {}).get("contract")
    message_matrix = (body or {}).get("messageMatrix", [])
    locale = (body or {}).get("locale", "it")
    provider = (body or {}).get("provider", "openai")
    model = (body or {}).get("model")

    if not contract:
        return {"success": False, "error": "Contract is required"}

    if not message_matrix:
        return {"success": False, "error": "messageMatrix is required"}

    if not OPENAI_KEY:
        return {"success": False, "error": "OPENAI_KEY not configured"}

    try:
        # Raggruppa messageMatrix per stepType
        messages_by_step_type = {}
        for item in message_matrix:
            step_type = item.get("stepType")
            guid = item.get("guid")
            escalation_index = item.get("escalationIndex", 0)

            if step_type not in messages_by_step_type:
                messages_by_step_type[step_type] = []
            messages_by_step_type[step_type].append({
                "guid": guid,
                "escalationIndex": escalation_index
            })

        # Costruisci prompt che include TUTTI gli stepType per questo nodo
        prompt_parts = [
            f"Generate ALL dialogue messages for the field '{node_label}'.",
            f"",
            f"Context:",
            f"- Field: {node_label}",
            f"- Type: {contract.get('entity', {}).get('kind', 'string')}",
            f"- Locale: {locale}",
            f"",
            f"Generate the following messages:",
            f""
        ]

        # Aggiungi istruzioni per ogni stepType
        step_descriptions = {
            "start": "Initial message to ask for the data",
            "noMatch": "Escalation messages when user input doesn't match (progressively more polite)",
            "noInput": "Escalation messages when user doesn't respond (progressively more polite)",
            "confirmation": "Message to confirm the input with {{input}} placeholder",
            "notConfirmed": "Message when user doesn't confirm",
            "violation": "Messages when input violates constraints",
            "disambiguation": "Message to disambiguate between options",
            "success": "Success message when data is collected"
        }

        guid_list = []
        for step_type, items in messages_by_step_type.items():
            description = step_descriptions.get(step_type, f"Messages for {step_type}")
            count = len(items)

            if count == 1:
                guid = items[0]["guid"]
                prompt_parts.append(f"1. {step_type.upper()} ({description}):")
                prompt_parts.append(f"   - GUID: {guid}")
                guid_list.append(guid)
            else:
                prompt_parts.append(f"{count}. {step_type.upper()} ({description}):")
                for idx, item in enumerate(items, 1):
                    guid = item["guid"]
                    prompt_parts.append(f"   - GUID: {guid} (escalation {idx})")
                    guid_list.append(guid)
            prompt_parts.append("")

        prompt_parts.extend([
            f"Return a JSON object mapping each GUID to its message text:",
            f"{{",
            f'  "{guid_list[0]}": "message text 1",',
            f'  "{guid_list[1]}": "message text 2",',
            f"  ...",
            f"}}",
            f"",
            f"Requirements:",
            f"- Messages must be natural, spoken Italian (locale: {locale})",
            f"- Messages must be appropriate for voice-based customer care",
            f"- Escalation messages must be progressively more polite",
            f"- Use {{input}} placeholder in confirmation messages",
            f"- Keep messages concise and clear"
        ])

        prompt = "\n".join(prompt_parts)

        # System message
        system_message = (
            "You are a Dialogue Messages Generator. "
            "Your task is to generate natural, spoken messages for a voice-based customer care system. "
            "Return ONLY valid JSON, no markdown, no code fences, no comments."
        )

        # Call AI
        ai_response = chat_json([
            {"role": "system", "content": system_message},
            {"role": "user", "content": prompt}
        ], provider=provider if provider else "openai")

        # Parse response
        if isinstance(ai_response, str):
            result = json.loads(ai_response)
        else:
            result = ai_response

        # Validate response structure
        if not isinstance(result, dict):
            raise ValueError("AI response is not a dictionary")

        # Extract messages map
        messages_map = result.get("messages", {})
        if not isinstance(messages_map, dict):
            # Fallback: try to extract from root level
            messages_map = {k: v for k, v in result.items() if k != "success" and k != "error"}

        # Validate all GUIDs are present
        missing_guids = [guid for guid in guid_list if guid not in messages_map]
        if missing_guids:
            print(f"[generate-node-messages] Warning: Missing GUIDs in response: {missing_guids}", flush=True)
            # Add fallback messages for missing GUIDs
            entity_label = contract.get("entity", {}).get("label", "value")
            fallbacks = {
                "start": f"Mi dica la sua {entity_label.lower()}",
                "noMatch": "Può ripetere?",
                "noInput": "Non ho sentito, può ripetere?",
                "confirmation": f"Confermi: {{input}}?",
                "notConfirmed": f"Qual è la {entity_label.lower()} corretta?",
                "violation": f"Il valore non è valido",
                "disambiguation": "Quale intendi?",
                "success": "Perfetto, grazie."
            }

            for guid in missing_guids:
                # Find stepType for this GUID
                step_type = None
                for item in message_matrix:
                    if item.get("guid") == guid:
                        step_type = item.get("stepType")
                        break

                if step_type and step_type in fallbacks:
                    messages_map[guid] = fallbacks[step_type]
                else:
                    messages_map[guid] = f"Messaggio per {entity_label}"

        # Filter to ensure all values are strings
        validated_messages = {
            guid: str(text).strip()
            for guid, text in messages_map.items()
            if guid in guid_list and isinstance(text, (str, int, float)) and str(text).strip()
        }

        # Ensure all GUIDs have messages
        for guid in guid_list:
            if guid not in validated_messages:
                entity_label = contract.get("entity", {}).get("label", "value")
                validated_messages[guid] = f"Messaggio per {entity_label}"

        return {
            "success": True,
            "messages": validated_messages
        }

    except Exception as e:
        print(f"[generate-node-messages] Error: {str(e)}", flush=True)
        import traceback
        traceback.print_exc()
        return {
            "success": False,
            "error": str(e)
        }

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

# ============================================================================
# WIZARD ENDPOINTS - Structure Generation
# ============================================================================

@router.post("/api/nlp/generate-structure")
async def generate_structure(body: dict = Body(...)):
    """
    Generate hierarchical data structure for a task.
    Used by Phase A of the wizard.
    """
    from newBackend.services.ai.ai_structure_service import generate_structure_ai
    from newBackend.services.parsing.structure_parser import parse_and_validate_structure
    from newBackend.core.core_settings import OPENAI_KEY

    task_label = (body or {}).get("taskLabel")
    task_description = (body or {}).get("taskDescription")
    locale = (body or {}).get("locale", "it")  # ✅ NEW: locale parameter for language consistency
    provider = (body or {}).get("provider", "openai")
    model = (body or {}).get("model")

    if not task_label:
        return {"success": False, "error": "taskLabel is required"}

    if not OPENAI_KEY:
        return {"success": False, "error": "OPENAI_KEY not configured"}

    try:
        # Retry with backoff
        from newBackend.services.retry.retry_strategy import retry_sync_with_backoff
        ai_response, error = retry_sync_with_backoff(
            generate_structure_ai,
            max_retries=3,
            base_delay=1.0,
            task_label=task_label,
            task_description=task_description,
            provider=provider,
            model=model,
            locale=locale  # ✅ NEW: Pass locale to maintain language consistency
        )

        if error:
            return {"success": False, "error": error}

        # Parse and validate
        structure, errors, generalization_info = parse_and_validate_structure(ai_response)

        if errors:
            return {"success": False, "error": "; ".join(errors), "structure": []}

        return {
            "success": True,
            "structure": structure,
            "shouldBeGeneral": generalization_info.get("shouldBeGeneral", False),
            "generalizedLabel": generalization_info.get("generalizedLabel"),
            "generalizationReason": generalization_info.get("generalizationReason"),
            "generalizedMessages": generalization_info.get("generalizedMessages")
        }

    except Exception as e:
        print(f"[generate-structure] Error: {str(e)}", flush=True)
        import traceback
        traceback.print_exc()
        return {
            "success": False,
            "error": str(e),
            "structure": []
        }

@router.post("/api/nlp/regenerate-structure")
async def regenerate_structure(body: dict = Body(...)):
    """
    Regenerate hierarchical data structure based on user feedback.
    Used by Phase B of the wizard.
    """
    from newBackend.services.ai.ai_structure_service import regenerate_structure_ai
    from newBackend.services.parsing.structure_parser import parse_and_validate_structure
    from newBackend.core.core_settings import OPENAI_KEY

    task_label = (body or {}).get("taskLabel")
    feedback = (body or {}).get("feedback")
    previous_structure = (body or {}).get("previousStructure", [])
    provider = (body or {}).get("provider", "openai")
    model = (body or {}).get("model")

    if not task_label:
        return {"success": False, "error": "taskLabel is required"}

    if not feedback:
        return {"success": False, "error": "feedback is required"}

    if not previous_structure:
        return {"success": False, "error": "previousStructure is required"}

    if not OPENAI_KEY:
        return {"success": False, "error": "OPENAI_KEY not configured"}

    try:
        # Retry with backoff
        from newBackend.services.retry.retry_strategy import retry_sync_with_backoff
        ai_response, error = retry_sync_with_backoff(
            regenerate_structure_ai,
            max_retries=3,
            base_delay=1.0,
            task_label=task_label,
            feedback=feedback,
            previous_structure=previous_structure,
            provider=provider,
            model=model
        )

        if error:
            return {"success": False, "error": error}

        # Parse and validate
        structure, errors = parse_and_validate_structure(ai_response)

        if errors:
            return {"success": False, "error": "; ".join(errors), "structure": []}

        # Extract changes if present
        changes = []
        if isinstance(ai_response, dict) and "changes" in ai_response:
            changes = ai_response["changes"]

        return {
            "success": True,
            "structure": structure,
            "changes": changes
        }

    except Exception as e:
        print(f"[regenerate-structure] Error: {str(e)}", flush=True)
        import traceback
        traceback.print_exc()
        return {
            "success": False,
            "error": str(e),
            "structure": []
        }

@router.post("/api/nlp/generate-contracts")
def generate_contracts(body: dict = Body(...)):
    """
    Generate contracts (alias for refine-contract for consistency).
    Used by STEP 1 of the pipeline.
    """
    # Delegate to refine-contract endpoint
    return refine_contract(body)

# ============================================================================
# WIZARD ENDPOINTS - Message Generalization
# ============================================================================

@router.post("/api/nlp/generalize-messages")
async def generalize_messages(body: dict = Body(...)):
    """
    Generalize contextual messages into reusable template messages.
    Used by ResponseEditor for template generalization.
    """
    from newBackend.services.ai.ai_generalization_service import generalize_messages_ai
    from newBackend.services.parsing.messages_parser import parse_and_validate_messages
    from newBackend.core.core_settings import OPENAI_KEY

    contextual_messages = (body or {}).get("contextualMessages")
    contract = (body or {}).get("contract")
    node_label = (body or {}).get("nodeLabel")
    provider = (body or {}).get("provider", "openai")
    model = (body or {}).get("model")

    if not contextual_messages:
        return {"success": False, "error": "contextualMessages is required"}

    if not contract:
        return {"success": False, "error": "contract is required"}

    if not node_label:
        return {"success": False, "error": "nodeLabel is required"}

    if not OPENAI_KEY:
        return {"success": False, "error": "OPENAI_KEY not configured"}

    try:
        # Retry with backoff
        from newBackend.services.retry.retry_strategy import retry_sync_with_backoff
        ai_response, error = retry_sync_with_backoff(
            generalize_messages_ai,
            max_retries=3,
            base_delay=1.0,
            contextual_messages=contextual_messages,
            contract=contract,
            node_label=node_label,
            provider=provider,
            model=model
        )

        if error:
            return {"success": False, "error": error}

        # Parse and validate
        messages, errors = parse_and_validate_messages(ai_response)

        if errors:
            # Fallback to contextual messages if validation fails
            print(f"[generalize-messages] Validation errors: {errors}", flush=True)
            return {
                "success": True,
                "messages": contextual_messages,
                "warnings": errors
            }

        return {
            "success": True,
            "messages": messages
        }

    except Exception as e:
        print(f"[generalize-messages] Error: {str(e)}", flush=True)
        import traceback
        traceback.print_exc()
        # Fallback to contextual messages
        return {
            "success": True,
            "messages": contextual_messages,
            "error": str(e)
        }

@router.post("/api/nlp/check-generalizability")
async def check_generalizability(body: dict = Body(...)):
    """
    Check if a template can be generalized for reuse.
    Used by ResponseEditor before showing generalization option.
    """
    from newBackend.services.ai.ai_generalization_service import check_generalizability_ai
    from newBackend.services.parsing.generalizability_parser import parse_and_validate_generalizability
    from newBackend.core.core_settings import OPENAI_KEY

    contract = (body or {}).get("contract")
    node_label = (body or {}).get("nodeLabel")
    contextual_messages = (body or {}).get("contextualMessages")
    provider = (body or {}).get("provider", "openai")
    model = (body or {}).get("model")

    if not contract:
        return {"success": False, "error": "contract is required"}

    if not node_label:
        return {"success": False, "error": "nodeLabel is required"}

    if not contextual_messages:
        return {"success": False, "error": "contextualMessages is required"}

    if not OPENAI_KEY:
        return {"success": False, "error": "OPENAI_KEY not configured"}

    try:
        # Retry with backoff
        from newBackend.services.retry.retry_strategy import retry_sync_with_backoff
        ai_response, error = retry_sync_with_backoff(
            check_generalizability_ai,
            max_retries=3,
            base_delay=1.0,
            contract=contract,
            node_label=node_label,
            contextual_messages=contextual_messages,
            provider=provider,
            model=model
        )

        if error:
            # Fallback to not generalizable
            return {
                "success": True,
                "generalizable": False,
                "confidence": 0.0,
                "reasons": [],
                "barriers": [error],
                "suggestions": []
            }

        # Parse and validate
        data, errors = parse_and_validate_generalizability(ai_response)

        if errors:
            # Fallback to not generalizable
            return {
                "success": True,
                "generalizable": False,
                "confidence": 0.0,
                "reasons": [],
                "barriers": errors,
                "suggestions": []
            }

        return {
            "success": True,
            **data
        }

    except Exception as e:
        print(f"[check-generalizability] Error: {str(e)}", flush=True)
        import traceback
        traceback.print_exc()
        # Fallback to not generalizable
        return {
            "success": True,
            "generalizable": False,
            "confidence": 0.0,
            "reasons": [],
            "barriers": [str(e)],
            "suggestions": []
        }

@router.post("/api/nlp/check-template-equivalence")
async def check_template_equivalence(body: dict = Body(...)):
    """
    Check if an equivalent template already exists.
    Used by ResponseEditor before saving generalized template.
    """
    from newBackend.services.ai.ai_generalization_service import check_template_equivalence_ai
    from newBackend.services.parsing.generalizability_parser import parse_and_validate_equivalence
    from newBackend.core.core_settings import OPENAI_KEY

    current_template = (body or {}).get("currentTemplate")
    existing_templates = (body or {}).get("existingTemplates", [])
    provider = (body or {}).get("provider", "openai")
    model = (body or {}).get("model")

    if not current_template:
        return {"success": False, "error": "currentTemplate is required"}

    if not existing_templates:
        return {
            "success": True,
            "equivalent": False,
            "matchingTemplateId": None,
            "confidence": 0.0,
            "matchReasons": [],
            "differences": ["No existing templates to compare against"]
        }

    if not OPENAI_KEY:
        return {"success": False, "error": "OPENAI_KEY not configured"}

    try:
        # Retry with backoff
        from newBackend.services.retry.retry_strategy import retry_sync_with_backoff
        ai_response, error = retry_sync_with_backoff(
            check_template_equivalence_ai,
            max_retries=3,
            base_delay=1.0,
            current_template=current_template,
            existing_templates=existing_templates,
            provider=provider,
            model=model
        )

        if error:
            # Fallback to not equivalent
            return {
                "success": True,
                "equivalent": False,
                "matchingTemplateId": None,
                "confidence": 0.0,
                "matchReasons": [],
                "differences": [error]
            }

        # Parse and validate
        data, errors = parse_and_validate_equivalence(ai_response)

        if errors:
            # Fallback to not equivalent
            return {
                "success": True,
                "equivalent": False,
                "matchingTemplateId": None,
                "confidence": 0.0,
                "matchReasons": [],
                "differences": errors
            }

        return {
            "success": True,
            **data
        }

    except Exception as e:
        print(f"[check-template-equivalence] Error: {str(e)}", flush=True)
        import traceback
        traceback.print_exc()
        # Fallback to not equivalent
        return {
            "success": True,
            "equivalent": False,
            "matchingTemplateId": None,
            "confidence": 0.0,
            "matchReasons": [],
            "differences": [str(e)]
        }

# ============================================================================
# WIZARD ENDPOINTS - Template Management
# ============================================================================

@router.post("/api/templates/save-general")
async def save_general_template(body: dict = Body(...)):
    """
    Save a generalized template to the global template library.
    Used by ResponseEditor after generalization.
    """
    from newBackend.services.database_service import databaseService

    template = (body or {}).get("template")
    template_id = (body or {}).get("templateId")

    if not template:
        return {"success": False, "error": "template is required"}

    try:
        # Save to database
        collection = databaseService.db["TaskTemplates"]

        # Prepare template document
        template_doc = {
            **template,
            "id": template_id or f"template-{template.get('entity', {}).get('label', 'unknown')}-{int(__import__('time').time())}",
            "isGeneral": True,
            "createdAt": __import__('datetime').datetime.utcnow(),
            "updatedAt": __import__('datetime').datetime.utcnow()
        }

        # Insert or update
        if template_id:
            result = collection.update_one(
                {"id": template_id},
                {"$set": template_doc}
            )
            if result.matched_count == 0:
                collection.insert_one(template_doc)
        else:
            collection.insert_one(template_doc)

        return {
            "success": True,
            "templateId": template_doc["id"]
        }

    except Exception as e:
        print(f"[save-general-template] Error: {str(e)}", flush=True)
        import traceback
        traceback.print_exc()
        return {
            "success": False,
            "error": str(e)
        }
