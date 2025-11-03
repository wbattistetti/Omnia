from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import os

try:
    from backend.call_groq import call_groq
except Exception:
    from call_groq import call_groq

router = APIRouter()

class GenBody(BaseModel):
    intentName: str
    kind: str  # 'matching' | 'not-matching' | 'keywords'
    num: int = 10
    lang: str = 'it'
    exclude: List[str] = []
    seed: Optional[int] = None
    instructions: Optional[str] = None
    includeDebug: Optional[bool] = False

def _normalize(s: str) -> str:
    return (s or '').lower().strip()

def _build_prompt(name: str, kind: str, lang: str, num: int, exclude: List[str]) -> str:
    task = {
        'matching': 'realistic user utterances that express the intent',
        'not-matching': 'near-miss negative phrases that do not express the intent',
        'keywords': 'short keyword terms (1-3 words)'
    }.get(kind, 'realistic user utterances that express the intent')

    header = (
        f"Language: {lang}. Intent: {name}.\n"
        f"Generate {num} {task} in a customer service context.\n\n"
        "Guidelines:\n"
        "- One utterance per line\n"
        "- Use natural, conversational tone as spoken by real users in chat or over the phone\n"
        "- Length: 5-12 words\n"
        "- Avoid generic or repetitive phrasing\n"
        "- No personal names or sensitive data (PII)\n"
        "- Do not use the word 'intent' or 'training phrase'\n"
        f"- Output: just the {num} lines, no numbering, no quotes, no metadata\n"
    )

    # Embed existing phrases explicitly as not-to-repeat examples
    existing = [x for x in (exclude or []) if isinstance(x, str) and x.strip()]
    if existing:
        preview = existing[:100]  # cap for safety
        lines = "\n".join(f"  - {x}" for x in preview)
        header += (
            "\nDo not repeat these existing utterances:\n" +
            lines + "\n"
        )
    return header

@router.post('/ai/intents/generate')
async def generate_intent_items(body: GenBody):
    # ✅ Log immediato per diagnosticare 404
    print('[IntentGen][DEBUG] Route /ai/intents/generate chiamato!', flush=True)
    print('[IntentGen][DEBUG] Body ricevuto:', {
        'intentName': body.intentName,
        'kind': body.kind,
        'num': body.num,
        'lang': body.lang,
        'exclude_count': len(body.exclude or []),
    }, flush=True)

    prompt = _build_prompt(body.intentName, body.kind, body.lang, body.num, body.exclude or [])
    # Debug: log prompt and payload (safe)
    try:
        print('[IntentGen][req]', {
            'intentName': body.intentName,
            'kind': body.kind,
            'num': body.num,
            'lang': body.lang,
            'exclude_count': len(body.exclude or []),
        })
        preview = (prompt or '')[:1200]
        print('[IntentGen][prompt]\n' + preview)
    except Exception:
        pass

    # ✅ Usa call_groq direttamente (stesso meccanismo degli altri endpoint)
    # call_groq gestisce automaticamente GROQ_KEY e lancia ValueError se manca
    try:
        content = _call_llm(prompt)
    except ValueError as e:
        # GROQ_KEY mancante - errore chiaro come negli altri endpoint
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        # Altri errori API - propaga con messaggio chiaro
        raise HTTPException(status_code=500, detail=f"Groq API error: {str(e)}")
    # (raw omitted from logs to reduce noise)
    lines = [x.strip('- ').strip() for x in (content or '').split('\n') if x.strip()]
    seen = set(_normalize(x) for x in (body.exclude or []))
    items = []
    for t in lines:
        n = _normalize(t)
        if not n or n in seen:
            continue
        seen.add(n)
        items.append({ 'text': t, 'lang': body.lang })
        if len(items) >= body.num:
            break
    try:
        print('[IntentGen][items]', { 'count': len(items) })
    except Exception:
        pass

    # ✅ Se non ci sono risultati, restituisci errore chiaro invece di fallback silenzioso
    if len(items) == 0:
        raise HTTPException(
            status_code=500,
            detail=f"No valid phrases generated. Check prompt and API response. Prompt length: {len(prompt)} chars"
        )

    resp = { 'items': items }
    try:
        if body.includeDebug or os.environ.get('INTENT_DEBUG') in ('1','true','True','yes'):
            resp['debug'] = { 'prompt': prompt, 'exclude': body.exclude, 'items': [it.get('text','') for it in items] }
    except Exception:
        pass
    return resp

def _call_llm(prompt: str) -> str:
    # call_groq è sincrona, quindi non serve async wrapper
    return call_groq([
        { 'role': 'system', 'content': 'Always reply in the requested language.' },
        { 'role': 'user', 'content': prompt }
    ])


