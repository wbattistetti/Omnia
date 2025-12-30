import sys
import os
import pymongo
from datetime import datetime
from newBackend.services.svc_nlp import NLPConfigDB, FactoryType

# Import the existing MongoDB connection from old backend
try:
    # Add old backend to path
    old_backend_path = os.path.join(os.path.dirname(__file__), '..', '..')
    if old_backend_path not in sys.path:
        sys.path.insert(0, old_backend_path)

    from backend.extractionRegistry import DEFAULT_URI
    print(f"[DEBUG][DB] Using URI from extractionRegistry: {DEFAULT_URI[:20]}...")
except ImportError:
    # Fallback to Atlas connection
    DEFAULT_URI = "mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db"
    print(f"[DEBUG][DB] Using fallback Atlas URI")

class DatabaseService:
    def __init__(self):
        # Use the SAME MongoDB connection as the old backend
        print("[DEBUG][DB] DatabaseService init started")
        self.client = pymongo.MongoClient(DEFAULT_URI)
        print(f"[DEBUG][DB] MongoDB connected to: {DEFAULT_URI[:50]}...")
        self.db = self.client["factory"]
        print("[DEBUG][DB] Database selected: factory")

    async def getNLPConfig(self) -> NLPConfigDB | None:
        """Get NLP configuration from database"""
        try:
            collection = self.db["nlp_config"]
            config = collection.find_one()
            if config and '_id' in config:
                del config['_id']
            return NLPConfigDB(**config) if config else None
        except Exception as e:
            print(f"[DB ERROR] getNLPConfig: {e}")
            return None

    async def saveNLPConfig(self, config: NLPConfigDB) -> bool:
        """Save NLP configuration to database"""
        try:
            collection = self.db["nlp_config"]
            # Replace existing config or insert new
            result = collection.replace_one({}, config.dict(), upsert=True)
            return result.acknowledged
        except Exception as e:
            print(f"[DB ERROR] saveNLPConfig: {e}")
            return False

    async def saveFactoryType(self, factory_type: FactoryType) -> bool:
        """
        Save a factory type to Tasks collection (migrated from factory_types)

        LOGICA:
        - Cerca task esistente in Tasks con type: 3 e name/id corrispondente
        - Se trovato: aggiorna nlpContract con dati FactoryType
        - Se non trovato: crea nuovo task elementare con nlpContract
        """
        try:
            print(f"[DEBUG][DB] Saving factory type: {factory_type.name} (migrated to Tasks)")
            collection = self.db["Tasks"]

            # Cerca task esistente
            existing_task = collection.find_one({
                "type": 3,  # DataRequest
                "$or": [
                    {"id": factory_type.id},
                    {"name": factory_type.name},
                    {"label": factory_type.name}
                ]
            })

            # Converti FactoryType in nlpContract
            nlp_contract = self._convertFactoryTypeToNlpContract(factory_type)

            if existing_task:
                # Aggiorna task esistente
                result = collection.update_one(
                    {"_id": existing_task["_id"]},
                    {"$set": {
                        "nlpContract": nlp_contract,
                        "updatedAt": datetime.utcnow()
                    }}
                )
                print(f"[DEBUG][DB] Updated existing task {existing_task.get('id', 'unknown')}")
            else:
                # Crea nuovo task elementare
                import uuid
                new_task = {
                    "id": factory_type.id,
                    "type": 3,  # DataRequest
                    "templateId": None,
                    "name": factory_type.name,
                    "label": factory_type.name,
                    "nlpContract": nlp_contract,
                    "mainData": [{
                        "id": str(uuid.uuid4()),
                        "label": factory_type.name,
                        "type": factory_type.name,
                        "nlpContract": nlp_contract,
                        "subData": []
                    }],
                    "metadata": factory_type.metadata,
                    "permissions": factory_type.permissions,
                    "auditLog": factory_type.auditLog,
                    "createdAt": datetime.utcnow(),
                    "updatedAt": datetime.utcnow()
                }
                result = collection.insert_one(new_task)
                print(f"[DEBUG][DB] Created new task {factory_type.name}")

            print(f"[DEBUG][DB] MongoDB result: {result.acknowledged if hasattr(result, 'acknowledged') else 'inserted'}")
            return result.acknowledged if hasattr(result, 'acknowledged') else result.inserted_id is not None
        except Exception as e:
            print(f"[DB ERROR] saveFactoryType: {e}")
            import traceback
            traceback.print_exc()
            return False

    def _convertFactoryTypeToNlpContract(self, factory_type: FactoryType) -> dict:
        """
        Converti FactoryType in nlpContract structure

        LOGICA:
        - Mappa FactoryType fields a nlpContract structure
        """
        import json

        # Converti nerRules da stringa a dict se presente
        ner = None
        if factory_type.nerRules:
            try:
                ner = json.loads(factory_type.nerRules)
            except:
                ner = {"entityTypes": [factory_type.name], "confidence": 0.8, "enabled": True}

        return {
            "templateName": factory_type.name,
            "templateId": factory_type.id,
            "subDataMapping": {},
            "regex": {
                "patterns": factory_type.regexPatterns,
                "examples": factory_type.examples,
                "testCases": []
            },
            "rules": {
                "extractorCode": factory_type.extractorCode,
                "validators": factory_type.validators,
                "testCases": []
            },
            "llm": {
                "systemPrompt": factory_type.llmPrompt,
                "userPromptTemplate": "",
                "responseSchema": {},
                "enabled": bool(factory_type.llmPrompt)
            },
            "ner": ner
        }

    async def getFactoryTypes(self) -> list[FactoryType]:
        """
        Get all factory types from Tasks collection (migrated from factory_types)

        LOGICA:
        - Query Tasks con type: 3 (DataRequest)
        - Filtra solo task elementari con nlpContract (estrattori NLP)
        - Converte nlpContract in FactoryType per compatibilità
        """
        try:
            print("[DEBUG][DB] getFactoryTypes called (migrated to Tasks)")
            collection = self.db["Tasks"]

            # Query Tasks con type: 3 (DataRequest) che hanno nlpContract
            # Task elementari hanno nlpContract a root o in mainData[0]
            tasks = list(collection.find({
                "type": 3,  # DataRequest
                "$or": [
                    {"nlpContract": {"$exists": True, "$ne": None}},
                    {"mainData.0.nlpContract": {"$exists": True, "$ne": None}}
                ]
            }))

            print(f"[DEBUG][DB] Found {len(tasks)} tasks with nlpContract")

            result = []
            for task in tasks:
                # Remove MongoDB _id field
                if '_id' in task:
                    del task['_id']

                # Estrai nlpContract (root o mainData[0])
                nlp_contract = task.get('nlpContract')
                if not nlp_contract and task.get('mainData') and len(task['mainData']) > 0:
                    nlp_contract = task['mainData'][0].get('nlpContract')

                if not nlp_contract:
                    print(f"[DEBUG][DB] Task {task.get('id', 'unknown')} has no nlpContract - skipping")
                    continue

                # Converti nlpContract in FactoryType
                try:
                    factory_type = self._convertTaskToFactoryType(task, nlp_contract)
                    result.append(factory_type)
                    print(f"[DEBUG][DB] Converted task {task.get('name') or task.get('label', 'unknown')} to FactoryType")
                except Exception as e:
                    print(f"[DEBUG][DB] Failed to convert task {task.get('id', 'unknown')}: {e}")
                    print(f"[DEBUG][DB] Task keys: {list(task.keys())}")
                    continue

            print(f"[DEBUG][DB] Successfully converted {len(result)} types")
            return result
        except Exception as e:
            print(f"[DB ERROR] getFactoryTypes: {e}")
            import traceback
            traceback.print_exc()
            return []

    def _convertTaskToFactoryType(self, task: dict, nlp_contract: dict) -> FactoryType:
        """
        Converti un task con nlpContract in FactoryType

        LOGICA:
        - Mappa nlpContract structure a FactoryType fields
        - Usa valori di default per campi mancanti (metadata, permissions, auditLog)
        """
        # Estrai dati da nlpContract
        regex = nlp_contract.get('regex', {})
        rules = nlp_contract.get('rules', {})
        llm = nlp_contract.get('llm', {})
        ner = nlp_contract.get('ner')

        # Converti ner in stringa se presente
        ner_rules = ""
        if ner:
            import json
            ner_rules = json.dumps(ner)

        # Usa task.id come FactoryType.id (per compatibilità con extract_with_factory)
        # Se extract_with_factory cerca per id, usa task.id o task.name
        factory_id = task.get('id') or task.get('name') or task.get('label', 'unknown')
        factory_name = task.get('name') or task.get('label') or factory_id

        return FactoryType(
            id=factory_id,
            name=factory_name,
            extractorCode=rules.get('extractorCode', ''),
            regexPatterns=regex.get('patterns', []),
            llmPrompt=llm.get('systemPrompt', ''),
            nerRules=ner_rules,
            validators=rules.get('validators', []),
            examples=regex.get('examples', []),
            metadata=task.get('metadata', {}),
            permissions=task.get('permissions', {}),
            auditLog=task.get('auditLog', False)
        )

databaseService = DatabaseService()
