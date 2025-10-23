import sys
import os
import pymongo
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
        """Save a factory type to database"""
        try:
            print(f"[DEBUG][DB] Saving factory type: {factory_type.name}")
            collection = self.db["factory_types"]
            data = factory_type.dict()
            print(f"[DEBUG][DB] Data to save: {data}")
            result = collection.update_one(
                {"name": factory_type.name},
                {"$set": data},
                upsert=True
            )
            print(f"[DEBUG][DB] MongoDB result: {result.acknowledged}")
            return result.acknowledged
        except Exception as e:
            print(f"[DB ERROR] saveFactoryType: {e}")
            import traceback
            traceback.print_exc()
            return False

    async def getFactoryTypes(self) -> list[FactoryType]:
        """Get all factory types from database"""
        try:
            print("[DEBUG][DB] getFactoryTypes called")
            collection = self.db["factory_types"]
            types = list(collection.find())
            print(f"[DEBUG][DB] Found {len(types)} raw documents")

            result = []
            for t in types:
                # Remove MongoDB _id field that causes Pydantic validation errors
                if '_id' in t:
                    del t['_id']
                print(f"[DEBUG][DB] Processing: {t.get('name', 'unknown')}")
                try:
                    result.append(FactoryType(**t))
                except Exception as e:
                    print(f"[DEBUG][DB] Failed to convert document: {e}")
                    print(f"[DEBUG][DB] Document keys: {list(t.keys())}")
                    continue

            print(f"[DEBUG][DB] Successfully converted {len(result)} types")
            return result
        except Exception as e:
            print(f"[DB ERROR] getFactoryTypes: {e}")
            import traceback
            traceback.print_exc()
            return []

databaseService = DatabaseService()
