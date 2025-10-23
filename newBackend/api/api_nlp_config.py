from fastapi import APIRouter, HTTPException
from newBackend.services.database_service import databaseService
from newBackend.services.svc_nlp import NLPConfigDB

router = APIRouter()

@router.get("/api/nlp/config")
async def get_nlp_config():
    """
    Get the current NLP configuration from database
    """
    try:
        config = await databaseService.getNLPConfig()
        if not config:
            return None  # Configuration not found - return null instead of error
        return config
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving NLP configuration: {str(e)}")

@router.post("/api/nlp/config")  
async def save_nlp_config(config: NLPConfigDB):
    """
    Save NLP configuration to database
    """
    try:
        success = await databaseService.saveNLPConfig(config)
        if not success:
            raise HTTPException(status_code=500, detail="Failed to save configuration to database")
        return {"success": True, "message": "NLP configuration saved successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error saving NLP configuration: {str(e)}")

@router.put("/api/nlp/config")
async def update_nlp_config(config: NLPConfigDB):
    """
    Update NLP configuration in database
    """
    try:
        success = await databaseService.saveNLPConfig(config)
        if not success:
            raise HTTPException(status_code=500, detail="Failed to update configuration in database")
        return {"success": True, "message": "NLP configuration updated successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error updating NLP configuration: {str(e)}")
