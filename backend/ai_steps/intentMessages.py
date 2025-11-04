from fastapi import APIRouter, Body, HTTPException
import json
import re
from ai_prompts.intent_messages_prompt import get_intent_messages_prompt
from call_openai import call_openai, OPENAI_KEY
from call_groq import call_groq

router = APIRouter()

@router.post("/api/intentMessages")
def intent_messages(body: dict = Body(...)):
    """
    Generate conversational messages for intent classification.

    Expected body:
    {
        "intentLabel": "chiedi il problema",
        "provider": "groq" | "openai"
    }

    Returns:
    {
        "messages": {
            "start": ["..."],
            "noInput": ["...", "...", "..."],
            "noMatch": ["...", "...", "..."],
            "confirmation": ["..."]
        }
    }
    """
    try:
        print(f"[intentMessages][DEBUG][START] Received request")
        print(f"[intentMessages][DEBUG][BODY] {body}")
    except Exception as log_err:
        print(f"[intentMessages][DEBUG][LOG_ERROR] {log_err}")

    try:
        intent_label = body.get('intentLabel', '').strip()
        provider = body.get('provider', 'groq')
        if isinstance(provider, str):
            provider = provider.lower()

        print(f"[intentMessages][DEBUG] intent_label='{intent_label}', provider='{provider}'")

        if not intent_label:
            print(f"[intentMessages][ERROR] intentLabel is empty")
            raise HTTPException(status_code=400, detail="intentLabel is required")

        print(f"[intentMessages][DEBUG] Calling get_intent_messages_prompt...")
        try:
            prompt = get_intent_messages_prompt(intent_label)
            print(f"[intentMessages][DEBUG] Prompt generated, length={len(prompt)}")
        except Exception as prompt_err:
            print(f"[intentMessages][ERROR] Failed to generate prompt: {prompt_err}")
            import traceback
            traceback.print_exc()
            raise HTTPException(status_code=500, detail=f"Failed to generate prompt: {str(prompt_err)}")

        # Log completo del prompt per debug
        print(f"[intentMessages][DEBUG][PROMPT_FULL] ========================================")
        print(f"[intentMessages][DEBUG][PROMPT_FULL] Prompt completo per intent_label='{intent_label}'")
        print(f"[intentMessages][DEBUG][PROMPT_FULL] Provider: {provider}")
        print(f"[intentMessages][DEBUG][PROMPT_FULL] ========================================")
        print(prompt)
        print(f"[intentMessages][DEBUG][PROMPT_FULL] ========================================")
        print(f"[intentMessages][DEBUG][PROMPT_FULL] Fine prompt (length={len(prompt)} chars)")
        print(f"[intentMessages][DEBUG][PROMPT_FULL] ========================================")

        def _clean_json_like(s: str) -> str:
            """Clean JSON-like string, removing markdown code blocks and trailing commas."""
            t = (s or "").strip()
            if t.startswith("```"):
                t = re.sub(r"^```[a-zA-Z]*\n", "", t)
                t = re.sub(r"\n```\s*$", "", t)
            # Remove trailing commas
            t = re.sub(r",\s*(\]|\})", r"\1", t)
            return t

        # Call AI provider
        print(f"[intentMessages][DEBUG] Calling AI provider: {provider}")
        system_message = "Return only valid JSON with no markdown, no comments, no explanations."

        try:
            if provider == 'openai':
                print(f"[intentMessages][DEBUG] Calling OpenAI...")
                ai = call_openai([
                    {"role": "system", "content": system_message},
                    {"role": "user", "content": prompt}
                ])
            else:  # default to groq
                print(f"[intentMessages][DEBUG] Calling Groq...")
                ai = call_groq([
                    {"role": "system", "content": system_message},
                    {"role": "user", "content": prompt}
                ])
            print(f"[intentMessages][DEBUG] AI call successful, response length={len(ai) if ai else 0}")
        except Exception as ai_err:
            print(f"[intentMessages][ERROR] AI call failed: {ai_err}")
            import traceback
            traceback.print_exc()
            raise

        try:
            print(f"[intentMessages][DEBUG][AI_ANSWER][provider={provider}] {ai[:500] if ai else 'None'}...")
        except Exception as log_err:
            print(f"[intentMessages][DEBUG][LOG_ERROR] {log_err}")

        # Parse JSON response
        print(f"[intentMessages][DEBUG] Parsing JSON response...")
        try:
            cleaned = _clean_json_like(ai)
            print(f"[intentMessages][DEBUG] Cleaned JSON length={len(cleaned)}")
            ai_obj = json.loads(cleaned)
            print(f"[intentMessages][DEBUG] JSON parsed successfully, type={type(ai_obj)}")
        except json.JSONDecodeError as parse_error:
            print(f"[intentMessages][ERROR] JSON decode error: {parse_error}")
            try:
                print(f"[AI ERROR][intentMessages][parse_error][provider={provider}]", str(parse_error))
                print(f"[AI ERROR][intentMessages][raw_response]", ai[:1000])
            except Exception:
                pass

            # Try to extract JSON object from markdown code block
            try:
                json_match = re.search(r'\{[\s\S]*\}', ai)
                if json_match:
                    cleaned = _clean_json_like(json_match.group(0))
                    ai_obj = json.loads(cleaned)
                else:
                    raise HTTPException(status_code=500, detail="invalid_ai_json_format")
            except Exception:
                raise HTTPException(status_code=500, detail="invalid_ai_json_format")

        # Validate and normalize response structure
        print(f"[intentMessages][DEBUG] Validating response structure...")
        messages = {}

        # Expected structure: { start: [...], noInput: [...], noMatch: [...], confirmation: [...] }
        if isinstance(ai_obj, dict):
            print(f"[intentMessages][DEBUG] ai_obj is dict, keys: {list(ai_obj.keys())}")
            # Direct structure
            if 'start' in ai_obj or 'noInput' in ai_obj:
                messages = ai_obj
                print(f"[intentMessages][DEBUG] Using direct structure")
            # Nested structure: { messages: { ... } }
            elif 'messages' in ai_obj and isinstance(ai_obj['messages'], dict):
                messages = ai_obj['messages']
                print(f"[intentMessages][DEBUG] Using nested 'messages' structure")
            else:
                # Try to salvage from other keys
                print(f"[intentMessages][DEBUG] Trying to salvage from other keys...")
                for key in ['result', 'data', 'output']:
                    if key in ai_obj and isinstance(ai_obj[key], dict):
                        messages = ai_obj[key]
                        print(f"[intentMessages][DEBUG] Found messages in key: {key}")
                        break
        else:
            print(f"[intentMessages][WARN] ai_obj is not a dict, type={type(ai_obj)}")

        # Ensure all required fields exist and are arrays
        required_fields = ['start', 'noInput', 'noMatch', 'confirmation']
        validated = {}

        for field in required_fields:
            value = messages.get(field, [])
            if isinstance(value, list):
                # Ensure strings and limit array length
                validated[field] = [str(x) for x in value if x][:3 if field in ['noInput', 'noMatch'] else 1]
            elif value:
                # Single value -> convert to array
                validated[field] = [str(value)]
            else:
                # Missing field -> use fallback
                validated[field] = _get_fallback_messages(field)

        # Ensure start and confirmation have exactly 1 item
        if len(validated['start']) > 1:
            validated['start'] = validated['start'][:1]
        if len(validated['confirmation']) > 1:
            validated['confirmation'] = validated['confirmation'][:1]

        # Ensure noInput and noMatch have exactly 3 items
        while len(validated['noInput']) < 3:
            validated['noInput'].append(_get_fallback_messages('noInput')[0])
        while len(validated['noMatch']) < 3:
            validated['noMatch'].append(_get_fallback_messages('noMatch')[0])
        validated['noInput'] = validated['noInput'][:3]
        validated['noMatch'] = validated['noMatch'][:3]

        print(f"[intentMessages][DEBUG][VALIDATED] start={len(validated['start'])}, noInput={len(validated['noInput'])}, noMatch={len(validated['noMatch'])}, confirmation={len(validated['confirmation'])}")
        print(f"[intentMessages][DEBUG][SUCCESS] Returning validated messages")
        return {"messages": validated}

    except HTTPException:
        print(f"[intentMessages][ERROR] HTTPException raised, re-raising")
        raise
    except Exception as e:
        print(f"[intentMessages][ERROR] Unexpected exception: {e}")
        import traceback
        traceback.print_exc()
        try:
            print(f"[intentMessages][ERROR][FULL] provider={provider}, error={str(e)}")
        except Exception:
            pass
        # Return fallback messages on error
        print(f"[intentMessages][WARN] Returning fallback messages due to error")
        return {
            "messages": {
                "start": ["Mi può dire il motivo della chiamata?"],
                "noInput": [
                    "Scusi, non ho sentito. Può ripetere il motivo?",
                    "Mi scusi, può dirmi qual è il problema?",
                    "Può ripetere, per favore?"
                ],
                "noMatch": [
                    "Non ho capito bene. Può spiegarmi meglio il motivo?",
                    "Scusi, può essere più specifico sul problema?",
                    "Non sono sicuro di aver capito. Può ripetere in altro modo?"
                ],
                "confirmation": ["Il motivo è {{ '{intent}' }}. È corretto?"]
            }
        }


def _get_fallback_messages(field: str) -> list[str]:
    """Return fallback messages for a given field."""
    fallbacks = {
        "start": ["Mi può dire il motivo della chiamata?"],
        "noInput": [
            "Scusi, non ho sentito. Può ripetere il motivo?",
            "Mi scusi, può dirmi qual è il problema?",
            "Può ripetere, per favore?"
        ],
        "noMatch": [
            "Non ho capito bene. Può spiegarmi meglio il motivo?",
            "Scusi, può essere più specifico sul problema?",
            "Non sono sicuro di aver capito. Può ripetere in altro modo?"
        ],
        "confirmation": ["Il motivo è {{ '{intent}' }}. È corretto?"]
    }
    return fallbacks.get(field, [""])

