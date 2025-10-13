from fastapi import APIRouter
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

def _fallback_generate(name: str, kind: str, lang: str, num: int, exclude: list[str]) -> list[dict]:
    n = name.strip()
    ex = set(_normalize(x) for x in (exclude or []))
    out: list[str] = []
    def add_many(candidates: list[str]):
        for t in candidates:
            tt = t.replace('{name}', n).strip()
            if not tt:
                continue
            nn = _normalize(tt)
            if nn in ex:
                continue
            if _normalize(tt) in ( _normalize(x) for x in out ):
                continue
            out.append(tt)
            if len(out) >= num:
                break

    if kind == 'keywords':
        if lang == 'pt':
            add_many([
                '{name}', 'segunda via', '2ª via', 'segunda via boleto', 'segunda via fatura',
            ])
        elif lang == 'en':
            add_many(['{name}', 'second copy', 'duplicate bill', 'bill reprint'])
        else:
            add_many(['{name}', 'seconda via', 'duplicato bolletta', 'ristampa fattura'])
    else:
        if lang == 'pt':
            add_many([
                'preciso da segunda via da fatura',
                'pode gerar a segunda via do boleto?',
                'quero a 2ª via da conta',
                'como faço para pedir a segunda via?',
                'envie a segunda via por favor',
                'tem como reemitir a fatura? preciso da segunda via',
                'consigo baixar a segunda via agora?',
                'quero consultar e imprimir a segunda via',
                'poderia disponibilizar a segunda via da minha conta?',
                'onde pego a 2ª via do boleto?',
            ])
        elif lang == 'en':
            add_many([
                'I need the second copy of my bill',
                'can you reissue the invoice?',
                'I want a duplicate bill',
                'how can I request a reprint?',
                'please send the second copy',
                'is it possible to regenerate the invoice?',
                'where can I download the duplicate bill?',
                'I want to view and print the second copy',
            ])
        else:  # it
            add_many([
                'mi serve la seconda via della bolletta',
                'puoi generare una copia della fattura?',
                'vorrei il duplicato della bolletta',
                'come posso richiedere la ristampa?',
                'invia la seconda via per favore',
                'è possibile riemettere la fattura?',
                'dove scarico il duplicato della bolletta?',
                'voglio vedere e stampare la seconda via',
            ])
    return [ { 'text': t, 'lang': lang } for t in out[:num] ]

def _build_prompt(name: str, kind: str, lang: str, num: int, exclude: List[str]) -> str:
    task = {
        'matching': 'positive training phrases that express the intent',
        'not-matching': 'near-miss negative phrases that do not express the intent',
        'keywords': 'short keyword terms (1-3 words)'
    }.get(kind, 'positive training phrases that express the intent')
    header = (
        f"Language: {lang}. Intent: {name}.\n"
        f"Generate {num} {task}.\n"
        "Rules: one per line; concise; realistic; diverse; colloquial tone; 4-10 words; no numbering; no quotes; no PII; avoid duplicates.\n"
        "Output: just the {num} lines.\n"
    )
    # Embed existing phrases explicitly as not-to-repeat examples
    existing = [x for x in (exclude or []) if isinstance(x, str) and x.strip()]
    if existing:
        preview = existing[:100]  # cap for safety
        lines = "\n".join(f"- {x}" for x in preview)
        header += (
            "Existing (do not repeat; generate different phrasings that express the same intent):\n" +
            lines + "\n"
        )
    return header

@router.post('/ai/intents/generate')
async def generate_intent_items(body: GenBody):
    prompt = _build_prompt(body.intentName, body.kind, body.lang, body.num, body.exclude or [])
    # Inject optional instructions only; existing examples are handled as exclude client-side
    if body.instructions:
        prompt += f"\nInstructions: {body.instructions}\n"
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
    if not os.environ.get('Groq_key') and not os.environ.get('GROQ_API_KEY'):
        # Fallback with natural templates (no example N)
        items = _fallback_generate(body.intentName, body.kind, body.lang, body.num, body.exclude or [])
        try:
            print('[IntentGen][items]', { 'count': len(items) })
        except Exception:
            pass
        resp = { 'items': items }
        try:
            if body.includeDebug or os.environ.get('INTENT_DEBUG') in ('1','true','True','yes'):
                resp['debug'] = { 'prompt': prompt, 'exclude': body.exclude, 'items': [it.get('text','') for it in items] }
        except Exception:
            pass
        return resp

    content = await _call_llm(prompt)
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
    # If the model returned nothing, provide a natural fallback
    if len(items) == 0:
        items = _fallback_generate(body.intentName, body.kind, body.lang, body.num, body.exclude or [])
        try:
            print('[IntentGen][items][fallback]', { 'count': len(items), 'sample': [it.get('text','') for it in items[:10]] })
        except Exception:
            pass
    resp = { 'items': items }
    try:
        if body.includeDebug or os.environ.get('INTENT_DEBUG') in ('1','true','True','yes'):
            resp['debug'] = { 'prompt': prompt, 'exclude': body.exclude, 'items': [it.get('text','') for it in items] }
    except Exception:
        pass
    return resp

async def _call_llm(prompt: str) -> str:
    # Synchronous helper behind async endpoint
    return call_groq([
        { 'role': 'system', 'content': 'Always reply in the requested language.' },
        { 'role': 'user', 'content': prompt }
    ])


