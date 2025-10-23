from fastapi import APIRouter
from newBackend.services.svc_nlp import FactoryType
from newBackend.services.database_service import databaseService

router = APIRouter()

@router.post("/api/nlp/factory/types")
async def save_factory_type(factory_type: FactoryType):
    """Save a factory type to the database"""
    success = await databaseService.saveFactoryType(factory_type)
    return {"success": success, "message": "Factory type saved successfully"}

@router.get("/api/nlp/factory/types")
async def get_factory_types():
    """Get all factory types from database"""
    try:
        print("[DEBUG][FACTORY] get_factory_types called")
        types = await databaseService.getFactoryTypes()
        print(f"[DEBUG][FACTORY] Types from DB: {types}")

        # Converti gli oggetti Pydantic in dict
        result = {"types": [t.dict() for t in types]}
        print("[DEBUG][FACTORY] Conversion successful")

        return result

    except Exception as e:
        print(f"[DEBUG][FACTORY] ERROR: {e}")
        import traceback
        traceback.print_exc()
        return {"types": []}
