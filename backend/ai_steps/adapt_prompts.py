from fastapi import APIRouter, Body, HTTPException
import os
import json
import re

# ✅ Import with fallback (same pattern as other files)
try:
    from ai_prompts.adapt_prompts_prompt import get_adapt_prompts_prompt
except Exception:
    from backend.ai_prompts.adapt_prompts_prompt import get_adapt_prompts_prompt

try:
    from call_openai import call_openai_json as call_openai_json, OPENAI_KEY as OPENAI_KEY
except Exception:
    from backend.call_openai import call_openai_json as call_openai_json, OPENAI_KEY as OPENAI_KEY

try:
    from call_groq import call_groq
except Exception:
    from backend.call_groq import call_groq

router = APIRouter()

@router.post("/api/ddt/adapt-prompts")
def adapt_prompts(body: dict = Body(...)):
    """
    Adapt template prompts to a new context using AI.

    Body:
        prompts: list[dict] - Array of {guid: str, text: str} pairs (instance GUIDs and template texts)
        contextLabel: str - New context label (e.g., "Chiedi la data di nascita del paziente")
        templateLabel: str - Original template label (e.g., "Date")
        locale: str - Language code (e.g., "it", "en", "pt")
        provider: str - AI provider ("groq" or "openai"), default "groq"

    Returns:
        adaptedTranslations: dict - Object {guid: adapted_text} mapping instance GUIDs to adapted texts
    """
    prompts = body.get('prompts', [])
    context_label = body.get('contextLabel', '')
    template_label = body.get('templateLabel', '')
    locale = body.get('locale', 'it')
    provider = body.get('provider', 'groq')

    if isinstance(provider, str):
        provider = provider.lower()

    # ✅ Validate prompts format: must be array of {guid, text} objects
    if not prompts or not isinstance(prompts, list):
        raise HTTPException(status_code=400, detail="prompts must be a non-empty list of {guid, text} objects")

    # Extract texts and GUIDs for validation
    original_texts = []
    prompt_guids = []
    for p in prompts:
        if not isinstance(p, dict) or 'guid' not in p or 'text' not in p:
            raise HTTPException(status_code=400, detail="Each prompt must be {guid: str, text: str}")
        original_texts.append(p['text'])
        prompt_guids.append(p['guid'])

    if not context_label:
        raise HTTPException(status_code=400, detail="contextLabel is required")

    prompt = get_adapt_prompts_prompt(original_texts, context_label, template_label, locale)

    try:
        print(f"[AI PROMPT][adaptPrompts][provider={provider}]", str(prompt).encode('ascii', 'ignore').decode('ascii')[:500])
    except Exception:
        pass

    try:
        def _clean_json_like(s: str) -> str:
            """Clean JSON-like string, removing markdown code blocks and trailing commas."""
            t = (s or "").strip()
            if t.startswith("```"):
                t = re.sub(r"^```[a-zA-Z]*\n", "", t)
                t = re.sub(r"\n```\s*$", "", t)
            # Extract first [...] block if present (for cases where AI returns text with JSON array)
            m = re.search(r"\[[\s\S]*\]", t)
            if m:
                t = m.group(0)
            # Remove trailing commas
            t = re.sub(r",\s*(\]|\})", r"\1", t)
            return t

        # Call AI provider
        system_message = "Return only a valid JSON array of strings, no markdown, no comments, no explanations."

        ai = None
        try:
            if provider == 'openai':
                ai = call_openai_json([
                    {"role": "system", "content": system_message},
                    {"role": "user", "content": prompt}
                ])
            else:  # default to groq
                groq_response = call_groq([
                    {"role": "system", "content": system_message},
                    {"role": "user", "content": prompt}
                ])
                # Groq returns string, try to parse as JSON
                ai = groq_response
        except Exception as e:
            print(f"[adaptPrompts][call_error][provider={provider}]", str(e))
            ai = None

        # Fallback: return original texts mapped to GUIDs if AI call failed
        if not ai:
            print("[adaptPrompts][no_ai][fallback] Returning original texts mapped to GUIDs")
            return {"adaptedTranslations": {guid: text for guid, text in zip(prompt_guids, original_texts)}}

        try:
            cleaned = _clean_json_like(ai)
            ai_obj = json.loads(cleaned)

            print(f"[adaptPrompts][ai_cleaned]", (str(cleaned)[:500]).encode('ascii', 'ignore').decode('ascii'))
        except Exception as pe:
            print(f"[adaptPrompts][warn][parse_failed]", str(pe))
            print(f"[adaptPrompts][ai_raw]", (str(ai)[:500]).encode('ascii', 'ignore').decode('ascii'))
            # Fallback: return original texts mapped to GUIDs
            return {"adaptedTranslations": {guid: text for guid, text in zip(prompt_guids, original_texts)}}

        # ✅ NEW: AI should return object {guid: text} or array of strings (we'll map to GUIDs)
        adapted_translations = {}

        # Case 1: AI returned object {guid: text}
        if isinstance(ai_obj, dict):
            # Check if it's already in the correct format {guid: text}
            if all(isinstance(k, str) and isinstance(v, str) for k, v in ai_obj.items()):
                # Verify all requested GUIDs are present
                for guid in prompt_guids:
                    if guid in ai_obj:
                        adapted_translations[guid] = str(ai_obj[guid]).strip()
                    else:
                        # Use original text if GUID not found
                        idx = prompt_guids.index(guid)
                        adapted_translations[guid] = original_texts[idx]
                print(f"[adaptPrompts][parsed_object] Adapted {len(adapted_translations)} prompts")
                return {"adaptedTranslations": adapted_translations}

            # Case 2: Try to extract array from object
            for k in ("adaptedTexts", "texts", "messages", "result", "data", "items"):
                v = ai_obj.get(k)
                if isinstance(v, list):
                    arr = [str(x).strip() for x in v if isinstance(x, (str, int, float)) and str(x).strip()]
                    if arr:
                        # Map array to GUIDs by index
                        while len(arr) < len(original_texts):
                            arr.append(original_texts[len(arr)])
                        for idx, guid in enumerate(prompt_guids):
                            adapted_translations[guid] = arr[idx] if idx < len(arr) else original_texts[idx]
                        print(f"[adaptPrompts][parsed_array_from_object] Adapted {len(adapted_translations)} prompts")
                        return {"adaptedTranslations": adapted_translations}

        # Case 3: AI returned array of strings - map to GUIDs by index
        if isinstance(ai_obj, list):
            arr = [str(x).strip() for x in ai_obj if isinstance(x, (str, int, float)) and str(x).strip()]
            if len(arr) == len(original_texts):
                for idx, guid in enumerate(prompt_guids):
                    adapted_translations[guid] = arr[idx]
                print(f"[adaptPrompts][parsed_array] Adapted {len(adapted_translations)} prompts")
                return {"adaptedTranslations": adapted_translations}
            elif len(arr) > 0:
                # If AI returned fewer/more items, pad or truncate
                print(f"[adaptPrompts][warn] AI returned {len(arr)} items, expected {len(original_texts)}")
                while len(arr) < len(original_texts):
                    arr.append(original_texts[len(arr)])
                for idx, guid in enumerate(prompt_guids):
                    adapted_translations[guid] = arr[idx] if idx < len(arr) else original_texts[idx]
                return {"adaptedTranslations": adapted_translations}

        # Final fallback: return original texts mapped to GUIDs
        print("[adaptPrompts][fallback] Returning original texts mapped to GUIDs")
        return {"adaptedTranslations": {guid: text for guid, text in zip(prompt_guids, original_texts)}}

    except Exception as e:
        print(f"[adaptPrompts][catch_all][error]", str(e))
        # Non interrompere: ritorna i testi originali mappati ai GUID
        return {"adaptedTranslations": {guid: text for guid, text in zip(prompt_guids, original_texts)}}
