from fastapi import APIRouter, Body, HTTPException
from newBackend.services.database_service import databaseService
from typing import Any

router = APIRouter(prefix="/factory", tags=["factory"])

@router.post("/dialogue-templates")
async def save_dialogue_template(template: dict = Body(...)):
    """
    Save dialogue template to database
    """
    try:
        # Qui implementerai il salvataggio vero nel database
        # Per ora placeholder per testing
        print(f"[FACTORY] Saving dialogue template: {template.get('name', 'unnamed')}")

        return {
            "success": True,
            "message": "Template saved successfully",
            "id": f"temp_{hash(str(template))}",  # Placeholder ID
            "template": template
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error saving template: {str(e)}")

@router.get("/dialogue-templates")
async def get_dialogue_templates():
    """
    Get all dialogue templates from database
    """
    try:
        # Placeholder - da implementare
        return {"templates": [], "count": 0}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting templates: {str(e)}")
