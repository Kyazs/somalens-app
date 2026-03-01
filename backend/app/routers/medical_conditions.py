"""
API endpoint to return the list of available medical conditions.
"""

from fastapi import APIRouter

from app.services.medical_conditions import MEDICAL_CONDITIONS

router = APIRouter(prefix="/medical-conditions", tags=["medical-conditions"])


@router.get("")
async def list_medical_conditions():
    """Return all available medical conditions for the frontend checklist."""
    return {"conditions": MEDICAL_CONDITIONS}
