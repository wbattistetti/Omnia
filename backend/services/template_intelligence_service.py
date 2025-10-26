"""
Template Intelligence Service
Servizio per analisi intelligente delle richieste utente e proposta di template
"""

import json
from typing import Dict, List, Optional, Any
from pymongo import MongoClient
from dataclasses import dataclass
from enum import Enum

# MongoDB connection
MONGO_URI = 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db'

class TemplateAction(Enum):
    USE_EXISTING = "use_existing"
    COMPOSE = "compose"
    CREATE_NEW = "create_new"

@dataclass
class TemplateMatch:
    template_name: str
    confidence: float
    reason: str
    template_data: Dict[str, Any]

@dataclass
class TemplateComposition:
    name: str
    label: str
    components: List[str]
    reason: str
    composed_template: Dict[str, Any]

@dataclass
class TemplateProposal:
    name: str
    label: str
    type: str
    icon: str
    description: str
    subData: List[Dict[str, Any]]
    reason: str

@dataclass
class TemplateAnalysis:
    intent: str
    complexity: str  # simple, moderate, complex
    category: str    # personal, contact, business, other
    action: TemplateAction
    matches: List[TemplateMatch]
    compositions: List[TemplateComposition]
    proposals: List[TemplateProposal]
    reasoning: str

class TemplateIntelligenceService:
    def __init__(self):
        self._template_cache = None
        self._cache_loaded = False
    
    def _load_templates_from_db(self) -> Dict[str, Any]:
        """Carica tutti i template dal database Factory"""
        if self._cache_loaded:
            return self._template_cache
        
        try:
            print("[TemplateIntelligence] Caricando template dal database Factory...")
            client = MongoClient(MONGO_URI)
            db = client['factory']
            collection = db['type_templates']
            
            templates = list(collection.find({}))
            client.close()
            
            # Converti in dizionario per accesso rapido
            self._template_cache = {}
            for template in templates:
                if '_id' in template:
                    del template['_id']
                self._template_cache[template['name']] = template
            
            self._cache_loaded = True
            print(f"[TemplateIntelligence] Caricati {len(self._template_cache)} template dal database")
            return self._template_cache
            
        except Exception as e:
            print(f"[TemplateIntelligence] Errore nel caricamento: {e}")
            return {}
    
    def analyze_user_request(self, user_desc: str) -> TemplateAnalysis:
        """
        Analizza la richiesta dell'utente e determina la strategia migliore
        """
        print(f"[TemplateIntelligence] Analizzando richiesta: '{user_desc}'")
        
        # Carica template disponibili
        templates = self._load_templates_from_db()
        
        # Analisi base della richiesta
        intent = self._extract_intent(user_desc)
        complexity = self._assess_complexity(user_desc)
        category = self._categorize_request(user_desc)
        
        # Trova match esistenti
        matches = self._find_exact_matches(user_desc, templates)
        
        # Trova composizioni possibili
        compositions = self._find_compositions(user_desc, templates)
        
        # Determina azione raccomandata
        action, reasoning = self._determine_action(matches, compositions, user_desc)
        
        # Crea proposte se necessario
        proposals = []
        if action == TemplateAction.CREATE_NEW:
            proposals = self._create_template_proposals(user_desc, templates)
        
        return TemplateAnalysis(
            intent=intent,
            complexity=complexity,
            category=category,
            action=action,
            matches=matches,
            compositions=compositions,
            proposals=proposals,
            reasoning=reasoning
        )
    
    def _extract_intent(self, user_desc: str) -> str:
        """Estrae l'intento principale dalla richiesta"""
        user_lower = user_desc.lower()
        
        # Mappatura intenti comuni
        intent_mapping = {
            'dati personali': 'personal_data',
            'informazioni personali': 'personal_data',
            'profilo utente': 'user_profile',
            'contatto': 'contact_info',
            'indirizzo': 'address_info',
            'data di nascita': 'birth_date',
            'età': 'age_info',
            'veicolo': 'vehicle_info',
            'documento': 'document_info'
        }
        
        for key, intent in intent_mapping.items():
            if key in user_lower:
                return intent
        
        return 'custom_data'
    
    def _assess_complexity(self, user_desc: str) -> str:
        """Valuta la complessità della richiesta"""
        user_lower = user_desc.lower()
        
        # Indicatori di complessità
        simple_indicators = ['data', 'età', 'nome', 'email', 'telefono']
        complex_indicators = ['dati personali', 'profilo completo', 'informazioni complete', 'tutto']
        
        if any(indicator in user_lower for indicator in complex_indicators):
            return 'complex'
        elif any(indicator in user_lower for indicator in simple_indicators):
            return 'simple'
        else:
            return 'moderate'
    
    def _categorize_request(self, user_desc: str) -> str:
        """Categorizza la richiesta"""
        user_lower = user_desc.lower()
        
        if any(word in user_lower for word in ['personale', 'utente', 'profilo', 'nome', 'età']):
            return 'personal'
        elif any(word in user_lower for word in ['contatto', 'telefono', 'email', 'indirizzo']):
            return 'contact'
        elif any(word in user_lower for word in ['azienda', 'business', 'lavoro', 'professionale']):
            return 'business'
        else:
            return 'other'
    
    def _find_exact_matches(self, user_desc: str, templates: Dict[str, Any]) -> List[TemplateMatch]:
        """Trova template che corrispondono esattamente alla richiesta"""
        matches = []
        user_lower = user_desc.lower()
        
        # Mappatura richieste -> template
        request_mapping = {
            'data di nascita': 'date',
            'data nascita': 'date',
            'età': 'date',
            'nome': 'name',
            'nome completo': 'name',
            'nominativo': 'name',
            'email': 'email',
            'telefono': 'phone',
            'telefono': 'phone',
            'indirizzo': 'address',
            'codice fiscale': 'taxCode',
            'iban': 'iban',
            'partita iva': 'vatNumber'
        }
        
        for request_key, template_name in request_mapping.items():
            if request_key in user_lower and template_name in templates:
                template = templates[template_name]
                matches.append(TemplateMatch(
                    template_name=template_name,
                    confidence=0.95,
                    reason=f"Match esatto per '{request_key}'",
                    template_data=template
                ))
        
        return matches
    
    def _find_compositions(self, user_desc: str, templates: Dict[str, Any]) -> List[TemplateComposition]:
        """Trova composizioni possibili di template esistenti"""
        compositions = []
        user_lower = user_desc.lower()
        
        # Composizioni predefinite
        composition_patterns = {
            'dati personali': ['name', 'date', 'address', 'phone', 'email'],
            'informazioni personali': ['name', 'date', 'address', 'phone', 'email'],
            'profilo utente': ['name', 'date', 'address', 'phone', 'email'],
            'contatto completo': ['name', 'phone', 'email', 'address'],
            'informazioni contatto': ['name', 'phone', 'email', 'address']
        }
        
        for pattern, components in composition_patterns.items():
            if pattern in user_lower:
                # Verifica che tutti i componenti esistano
                available_components = [comp for comp in components if comp in templates]
                if len(available_components) >= 2:  # Almeno 2 componenti per una composizione
                    composed_template = self._compose_templates(available_components, templates)
                    compositions.append(TemplateComposition(
                        name=f"composed_{pattern.replace(' ', '_')}",
                        label=pattern.title(),
                        components=available_components,
                        reason=f"Composizione di template esistenti per '{pattern}'",
                        composed_template=composed_template
                    ))
        
        return compositions
    
    def _compose_templates(self, component_names: List[str], templates: Dict[str, Any]) -> Dict[str, Any]:
        """Compone template esistenti in un nuovo template aggregato"""
        subData = []
        
        for comp_name in component_names:
            if comp_name in templates:
                template = templates[comp_name]
                subData.append({
                    'label': template.get('label', comp_name.title()),
                    'type': template.get('type', comp_name),
                    'icon': template.get('icon', 'FileText'),
                    'subData': template.get('subData', [])
                })
        
        return {
            'label': 'Composed Data',
            'type': 'composed',
            'icon': 'Folder',
            'subData': subData
        }
    
    def _determine_action(self, matches: List[TemplateMatch], compositions: List[TemplateComposition], user_desc: str) -> tuple:
        """Determina l'azione raccomandata"""
        if matches:
            return TemplateAction.USE_EXISTING, f"Trovato {len(matches)} template esistente/i che corrispondono esattamente"
        elif compositions:
            return TemplateAction.COMPOSE, f"Possibile comporre {len(compositions)} template da template esistenti"
        else:
            return TemplateAction.CREATE_NEW, "Nessun template esistente adatto, necessario creare nuovo template"
    
    def _create_template_proposals(self, user_desc: str, templates: Dict[str, Any]) -> List[TemplateProposal]:
        """Crea proposte per nuovi template"""
        proposals = []
        
        # Analizza la richiesta per capire cosa creare
        user_lower = user_desc.lower()
        
        # Proposte basate su pattern comuni
        if 'veicolo' in user_lower or 'auto' in user_lower or 'macchina' in user_lower:
            proposals.append(TemplateProposal(
                name='vehicle',
                label='Vehicle Information',
                type='vehicle',
                icon='Car',
                description='Template per dati del veicolo',
                subData=[
                    {
                        'label': 'Brand',
                        'type': 'generic',
                        'icon': 'Tag',
                        'constraints': [
                            {'type': 'required'},
                            {'type': 'minLength', 'value': 2},
                            {'type': 'maxLength', 'value': 50}
                        ]
                    },
                    {
                        'label': 'Model',
                        'type': 'generic',
                        'icon': 'FileText',
                        'constraints': [
                            {'type': 'required'},
                            {'type': 'minLength', 'value': 1},
                            {'type': 'maxLength', 'value': 100}
                        ]
                    },
                    {
                        'label': 'Year',
                        'type': 'number',
                        'icon': 'Calendar',
                        'constraints': [
                            {'type': 'required'},
                            {'type': 'min', 'value': 1990},
                            {'type': 'max', 'value': 2024}
                        ]
                    },
                    {
                        'label': 'License Plate',
                        'type': 'generic',
                        'icon': 'Hash',
                        'constraints': [
                            {'type': 'required'},
                            {'type': 'regex', 'pattern': '^[A-Z]{2}[0-9]{3}[A-Z]{2}$'}
                        ]
                    }
                ],
                reason='Template per dati del veicolo non esistente'
            ))
        
        return proposals

# Istanza globale del servizio
template_intelligence_service = TemplateIntelligenceService()
