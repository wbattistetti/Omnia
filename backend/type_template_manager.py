"""
Type Template Manager
Gestisce templates predefiniti per tipi di dati con cache e localizzazione automatica.
"""

import os
import json
from typing import Dict, Any, Optional

# Cache in-memory per templates localizzati
_CACHE: Dict[str, Any] = {}

# Templates base (inglese)
_TEMPLATES: Dict[str, Any] = {}

def load_templates() -> Dict[str, Any]:
    """Carica templates dal file JSON."""
    global _TEMPLATES
    if _TEMPLATES:
        return _TEMPLATES
    
    template_path = os.path.join(os.path.dirname(__file__), '..', 'config', 'type_templates.json')
    
    try:
        with open(template_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            _TEMPLATES = data.get('templates', {})
            print(f"[TemplateManager] Loaded {len(_TEMPLATES)} templates from {template_path}")
            return _TEMPLATES
    except Exception as e:
        print(f"[TemplateManager] ERROR loading templates: {e}")
        return {}

def get_available_types() -> list:
    """Ritorna lista dei tipi disponibili."""
    templates = load_templates()
    return list(templates.keys())

def get_template(type_name: str) -> Optional[Dict[str, Any]]:
    """
    Ottiene il template per un tipo specifico (in inglese).
    
    Args:
        type_name: Nome del tipo (es: 'date', 'taxCode', 'phone')
    
    Returns:
        Template dictionary o None se non trovato
    """
    templates = load_templates()
    return templates.get(type_name)

def translate_template_with_ai(template: Dict[str, Any], target_lang: str, ai_caller) -> Dict[str, Any]:
    """
    Traduce un template usando l'AI.
    
    Args:
        template: Template in inglese
        target_lang: Lingua target ('it', 'en', 'pt', etc.)
        ai_caller: Funzione per chiamare l'AI (es: call_openai)
    
    Returns:
        Template tradotto
    """
    if target_lang == 'en':
        return template  # Già in inglese
    
    # Prepara il prompt per traduzione
    prompt = f"""
Translate this data template to {target_lang}. Keep the structure intact, translate only labels and examples where appropriate.

Original (English):
{json.dumps(template, indent=2)}

Rules:
- Translate "label" fields to {target_lang}
- For examples:
  - Translate text examples (names, cities, streets) to {target_lang}
  - Keep numbers and codes unchanged (IBANs, tax codes, postal codes, phone numbers)
  - For months: translate to {target_lang} month names (e.g., "December" → "dicembre" for IT)
- Keep all "type", "icon", "constraints" fields unchanged
- Return ONLY the translated JSON, no explanations

Target language: {target_lang}
"""
    
    try:
        # Chiama AI per traduzione
        messages = [
            {"role": "system", "content": f"You are a translation expert. Translate data templates to {target_lang}."},
            {"role": "user", "content": prompt}
        ]
        
        response = ai_caller(messages)
        
        # Parse risposta AI
        if isinstance(response, str):
            # Rimuovi markdown se presente
            response = response.strip()
            if response.startswith('```'):
                lines = response.split('\n')
                response = '\n'.join(lines[1:-1]) if len(lines) > 2 else response
            
            translated = json.loads(response)
        else:
            translated = response
        
        print(f"[TemplateManager] Translated template for '{template.get('type')}' to {target_lang}")
        return translated
        
    except Exception as e:
        print(f"[TemplateManager] ERROR translating template: {e}")
        # Fallback: ritorna template originale
        return template

def get_localized_template(type_name: str, lang: str, ai_caller=None) -> Optional[Dict[str, Any]]:
    """
    Ottiene un template localizzato con cache.
    
    Args:
        type_name: Nome del tipo (es: 'date', 'taxCode')
        lang: Codice lingua ('it', 'en', 'pt')
        ai_caller: Funzione per chiamare AI (opzionale, necessario per traduzioni)
    
    Returns:
        Template localizzato o None
    """
    cache_key = f"{type_name}_{lang}"
    
    # Check cache
    if cache_key in _CACHE:
        print(f"[TemplateManager] Cache HIT for {cache_key}")
        return _CACHE[cache_key]
    
    # Carica template base
    template = get_template(type_name)
    if not template:
        print(f"[TemplateManager] Template '{type_name}' not found")
        return None
    
    # Se è inglese, niente da tradurre
    if lang == 'en' or lang == 'eng' or lang == 'english':
        _CACHE[cache_key] = template
        return template
    
    # Traduci con AI (se disponibile)
    if ai_caller:
        translated = translate_template_with_ai(template, lang, ai_caller)
        _CACHE[cache_key] = translated
        return translated
    else:
        # Nessun AI caller disponibile, ritorna inglese
        print(f"[TemplateManager] WARNING: No AI caller provided, returning English template")
        _CACHE[cache_key] = template
        return template

def pre_generate_cache(languages: list, ai_caller):
    """
    Pre-genera cache per tutte le lingue all'avvio del server.
    
    Args:
        languages: Lista di lingue da pre-generare (es: ['it', 'en', 'pt'])
        ai_caller: Funzione per chiamare AI
    """
    templates = load_templates()
    type_names = list(templates.keys())
    
    print(f"[TemplateManager] Pre-generating cache for {len(type_names)} types x {len(languages)} languages...")
    
    for type_name in type_names:
        for lang in languages:
            get_localized_template(type_name, lang, ai_caller)
    
    print(f"[TemplateManager] Cache pre-generation complete. Cached {len(_CACHE)} entries.")

def get_cache_stats() -> Dict[str, Any]:
    """Ritorna statistiche sulla cache."""
    return {
        "cached_entries": len(_CACHE),
        "available_types": len(_TEMPLATES),
        "cache_keys": list(_CACHE.keys())
    }

def clear_cache():
    """Pulisce la cache (utile per development)."""
    global _CACHE
    _CACHE = {}
    print("[TemplateManager] Cache cleared")

