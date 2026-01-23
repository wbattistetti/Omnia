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
        originalTexts: list[str] - Original prompt texts from template
        contextLabel: str - New context label (e.g., "Chiedi la data di nascita del paziente")
        templateLabel: str - Original template label (e.g., "Date")
        locale: str - Language code (e.g., "it", "en", "pt")
        provider: str - AI provider ("groq" or "openai"), default "groq"
    """
    original_texts = body.get('originalTexts', [])
    context_label = body.get('contextLabel', '')
    template_label = body.get('templateLabel', '')
    locale = body.get('locale', 'it')
    provider = body.get('provider', 'groq')

    if isinstance(provider, str):
        provider = provider.lower()

    if not original_texts or not isinstance(original_texts, list):
        raise HTTPException(status_code=400, detail="originalTexts must be a non-empty list")

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

        # Fallback: return original texts if AI call failed
        if not ai:
            print("[adaptPrompts][no_ai][fallback] Returning original texts")
            return {"adaptedTexts": original_texts}

        try:
            cleaned = _clean_json_like(ai)
            ai_obj = json.loads(cleaned)

            print(f"[adaptPrompts][ai_cleaned]", (str(cleaned)[:500]).encode('ascii', 'ignore').decode('ascii'))
        except Exception as pe:
            print(f"[adaptPrompts][warn][parse_failed]", str(pe))
            print(f"[adaptPrompts][ai_raw]", (str(ai)[:500]).encode('ascii', 'ignore').decode('ascii'))
            # Fallback: return original texts
            return {"adaptedTexts": original_texts}

        # Enforce array of strings
        if isinstance(ai_obj, list):
            arr = [str(x).strip() for x in ai_obj if isinstance(x, (str, int, float)) and str(x).strip()]
            if len(arr) == len(original_texts):
                print(f"[adaptPrompts][parsed_array] Adapted {len(arr)} prompts")
                return {"adaptedTexts": arr}
            elif len(arr) > 0:
                # If AI returned fewer/more items, pad or truncate
                print(f"[adaptPrompts][warn] AI returned {len(arr)} items, expected {len(original_texts)}")
                while len(arr) < len(original_texts):
                    arr.append(original_texts[len(arr)])  # Fill with original
                return {"adaptedTexts": arr[:len(original_texts)]}

        # Try to extract array from object
        if isinstance(ai_obj, dict):
            for k in ("adaptedTexts", "texts", "messages", "result", "data", "items"):
                v = ai_obj.get(k)
                if isinstance(v, list):
                    arr = [str(x).strip() for x in v if isinstance(x, (str, int, float)) and str(x).strip()]
                    if arr:
                        while len(arr) < len(original_texts):
                            arr.append(original_texts[len(arr)])
                        return {"adaptedTexts": arr[:len(original_texts)]}

        # Final fallback: return original texts
        print("[adaptPrompts][fallback] Returning original texts")
        return {"adaptedTexts": original_texts}

    except Exception as e:
        print(f"[adaptPrompts][catch_all][error]", str(e))
        # Non interrompere: ritorna i testi originali
        return {"adaptedTexts": original_texts}
