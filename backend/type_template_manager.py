"""
Type Template Manager
Gestisce templates predefiniti per tipi di dati con cache e localizzazione automatica.
Ora legge i template dal database Factory invece che dal file JSON.
"""

import os
import json
from typing import Dict, Any, Optional
from pymongo import MongoClient

# Cache in-memory per templates localizzati
_CACHE: Dict[str, Any] = {}

# Templates base (inglese) - ora dal database
_TEMPLATES: Dict[str, Any] = {}
_TEMPLATES_LOADED = False

# MongoDB connection (stessa del server.js)
MONGO_URI = 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db'

def load_templates(project_id: Optional[str] = None) -> Dict[str, Any]:
    """
    Carica templates dal database Factory e opzionalmente da Project.

    Args:
        project_id: Optional project ID to load project-specific templates

    Returns:
        Dictionary of templates {name: template}, with project templates overriding factory ones
    """
    global _TEMPLATES, _TEMPLATES_LOADED

    # Always load factory templates
    if not _TEMPLATES_LOADED:
        try:
            print("[TemplateManager] Caricando template dal database Factory...")
            client = MongoClient(MONGO_URI)
            db = client['factory']
            collection = db['type_templates']

            templates = list(collection.find({}))
            client.close()

            # Converti in dizionario per compatibilità
            _TEMPLATES = {}
            for template in templates:
                if '_id' in template:
                    del template['_id']
                _TEMPLATES[template['name']] = template

            _TEMPLATES_LOADED = True
            print(f"[TemplateManager] Caricati {len(_TEMPLATES)} template dal database Factory")
        except Exception as e:
            print(f"[TemplateManager] ERROR loading templates from database: {e}")
            _TEMPLATES = {}

    # Load project-specific templates if project_id provided
    if project_id:
        try:
            print(f"[TemplateManager] Caricando template dal progetto {project_id}...")
            client = MongoClient(MONGO_URI)
            db = client[f'project_{project_id}']
            collection = db['type_templates']

            project_templates = list(collection.find({}))
            client.close()

            # Merge project templates (override factory ones)
            project_count = 0
            for template in project_templates:
                if '_id' in template:
                    del template['_id']
                template_name = template.get('name')
                if template_name:
                    _TEMPLATES[template_name] = template
                    project_count += 1

            if project_count > 0:
                print(f"[TemplateManager] Caricati {project_count} template dal progetto {project_id}")
        except Exception as e:
            print(f"[TemplateManager] WARNING: Could not load project templates: {e}")

    return _TEMPLATES

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

