from fastapi import APIRouter, Body, HTTPException
import json
from ai_prompts.detect_type_prompt import get_detect_type_prompt
from call_groq import call_groq
from pymongo import MongoClient
import os
import sys

# Aggiungi il path per importare i servizi
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
from services.template_intelligence_service import template_intelligence_service

router = APIRouter()

# MongoDB connection (stessa del server.js)
MONGO_URI = 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db'

# Cache globale per i template
_template_cache = None
_cache_loaded = False

def load_templates_from_db():
    """Carica tutti i template dal database Factory"""
    global _template_cache, _cache_loaded

    if _cache_loaded:
        return _template_cache

    try:
        print("[TEMPLATE_CACHE] Caricando template dal database Factory...")
        client = MongoClient(MONGO_URI)
        db = client['factory']
        collection = db['type_templates']

        templates = list(collection.find({}))
        client.close()

        # Converti in dizionario per accesso rapido
        _template_cache = {}
        for template in templates:
            if '_id' in template:
                del template['_id']
            _template_cache[template['name']] = template

        _cache_loaded = True
        print(f"[TEMPLATE_CACHE] Caricati {len(_template_cache)} template dal database")
        return _template_cache

    except Exception as e:
        print(f"[TEMPLATE_CACHE] Errore nel caricamento: {e}")
        return {}

def get_template_by_name(template_name: str):
    """Recupera un template specifico dalla cache"""
    if not _cache_loaded:
        load_templates_from_db()

    return _template_cache.get(template_name)

def get_all_templates():
    """Recupera tutti i template dalla cache"""
    if not _cache_loaded:
        load_templates_from_db()

    return _template_cache

@router.post("/step2")
def step2(user_desc: str = Body(...)):
    print(f"\nSTEP: /step2 – Detect type (using Template Intelligence)")

    try:
        # Usa il servizio di intelligence per analizzare la richiesta
        analysis = template_intelligence_service.analyze_user_request(user_desc)
        print(f"[step2] Analysis: {analysis.action.value} - {analysis.reasoning}")

        # Carica template disponibili per il prompt
        templates = get_all_templates()
        print(f"[step2] Using {len(templates)} templates from Factory DB cache")

        # Crea prompt intelligente con template disponibili
        prompt = get_detect_type_prompt(user_desc, templates)

        # Guard logging to avoid Windows console Unicode errors (cp1252)
        try:
            print("[AI PROMPT][detectSchema]", str(prompt).encode('ascii', 'ignore').decode('ascii'))
        except Exception:
            pass

        try:
            ai = call_groq([
                {"role": "system", "content": "Always reply in English."},
                {"role": "user", "content": prompt}
            ])
        except Exception as e:
            print("[AI ERROR][detectSchema]", str(e))
            raise HTTPException(status_code=502, detail=f"AI provider error: {str(e)}")

        try:
            print("[AI ANSWER][detectSchema]", str(ai).encode('ascii', 'ignore').decode('ascii'))
        except Exception:
            pass

        # Clean markdown code blocks before parsing
        def _clean_json_like(s: str) -> str:
            import re
            t = (s or "").strip()
            if t.startswith("```"):
                t = re.sub(r"^```[a-zA-Z]*\n", "", t)
                t = re.sub(r"\n```\s*$", "", t)
            # extract first {...} block if present (for objects)
            m = re.search(r"\{[\s\S]*\}", t)
            if m:
                t = m.group(0)
            # remove trailing commas
            t = re.sub(r",\s*(\]|\})", r"\1", t)
            return t

        try:
            cleaned = _clean_json_like(ai)
            ai_obj = json.loads(cleaned)
        except Exception as parse_error:
            print(f"[step2][parse_error] {str(parse_error)}")
            # Fallback: try direct parse
            try:
                ai_obj = json.loads(ai)
            except Exception:
                raise HTTPException(status_code=500, detail=f"Failed to parse AI response: {str(parse_error)}")

        # Gestisci risposta intelligente
        if isinstance(ai_obj, dict):
            # Se l'AI ha proposto nuovi template, aggiungi informazioni di intelligence
            if ai_obj.get('action') == 'create_new' and 'proposed_templates' in ai_obj:
                ai_obj['intelligence_analysis'] = {
                    'action': analysis.action.value,
                    'intent': analysis.intent,
                    'complexity': analysis.complexity,
                    'category': analysis.category,
                    'reasoning': analysis.reasoning,
                    'requires_approval': True
                }
                print(f"[step2] AI proposed {len(ai_obj['proposed_templates'])} new templates")

            # Gestisci formato legacy per compatibilità
            if 'mains' in ai_obj and 'label' in ai_obj:
                mains = ai_obj.get('mains') or []

                # Applica template Factory per ogni main
                enriched_mains = []
                for main in mains:
                    main_type = main.get('type')
                    factory_template = templates.get(main_type)

                    if factory_template:
                        # Usa template dal database con sub-data completi
                        enriched_main = {
                            'label': factory_template.get('label', main.get('label')),
                            'type': factory_template.get('type', main_type),
                            'icon': factory_template.get('icon', 'FileText'),
                            'subData': factory_template.get('subData', [])
                        }
                        print(f"[step2] Applied Factory template for {main_type}: {enriched_main['label']} with {len(enriched_main['subData'])} sub-data")
                    else:
                        # Fallback al formato originale
                        enriched_main = {
                            'label': main.get('label'),
                            'type': main_type,
                            'icon': main.get('icon', 'FileText'),
                            'subData': main.get('subData', [])
                        }
                        print(f"[step2] No Factory template found for {main_type}, using fallback")

                    enriched_mains.append(enriched_main)

                schema = {
                    'label': ai_obj.get('label', 'Data'),
                    'mainData': enriched_mains
                }
                normalized = {
                    'type': schema['label'],            # backward compatibility
                    'icon': ai_obj.get('icon') or 'HelpCircle',
                    'schema': schema,                   # normalized schema for frontend
                    'intelligence_analysis': ai_obj.get('intelligence_analysis', {})
                }
                return {"ai": normalized}

            # Gestisci anche il caso di singolo campo (formato legacy)
            elif 'type' in ai_obj and 'icon' in ai_obj:
                main_type = ai_obj.get('type')
                factory_template = templates.get(main_type)

                if factory_template:
                    # Applica template completo dal database
                    enriched_ai = {
                        'type': factory_template.get('type', main_type),
                        'icon': factory_template.get('icon', ai_obj.get('icon', 'FileText')),
                        'label': factory_template.get('label', ai_obj.get('label', main_type)),
                        'subData': factory_template.get('subData', [])
                    }
                    print(f"[step2] Applied Factory template for single field {main_type}: {enriched_ai['label']} with {len(enriched_ai['subData'])} sub-data")
                    return {"ai": enriched_ai}
                else:
                    # Fallback al formato originale
                    if ai_obj['type'] == 'unrecognized_data_type':
                        return {"error": "unrecognized_data_type"}
                    if 'subData' not in ai_obj:
                        ai_obj['subData'] = []
                    if 'label' not in ai_obj:
                        ai_obj['label'] = ai_obj['type']
                    return {"ai": ai_obj}

            # Fallback: legacy shape with type/icon
            if 'type' in ai_obj and 'icon' in ai_obj:
                if ai_obj['type'] == 'unrecognized_data_type':
                    return {"error": "unrecognized_data_type"}
                if 'subData' not in ai_obj:
                    ai_obj['subData'] = []
                if 'label' not in ai_obj:
                    ai_obj['label'] = ai_obj['type']
                return {"ai": ai_obj}

        return {"error": "unrecognized_data_type"}

    except Exception as e:
        print(f"[step2][fatal] {str(e)}")
        return {"error": "unrecognized_data_type"}

# Endpoint per ricaricare la cache (utile per sviluppo)
@router.post("/reload-templates")
def reload_templates():
    """Ricarica i template dal database"""
    global _cache_loaded
    _cache_loaded = False
    load_templates_from_db()
    return {"message": "Templates reloaded from database"}