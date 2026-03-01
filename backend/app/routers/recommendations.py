from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session

from app.database import get_session
from app.models.measurement import Measurement
from app.models.user import User
from app.core.dependencies import get_current_user
from app.services.recommendation_service import get_recommendation

router = APIRouter(prefix="/recommendations", tags=["recommendations"])


@router.get("/{measurement_id}")
async def get_measurement_recommendation(
    measurement_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[Session, Depends(get_session)],
    goal: str = Query(...),
    activity_level: str = Query(...),
    exercise_complexity: str = Query(...),
    exercise_type: str = Query(...),
    medical_conditions: str = Query(""),
):
    measurement = session.get(Measurement, measurement_id)
    if not measurement:
        raise HTTPException(status_code=404, detail="Measurement not found")

    if measurement.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    if not measurement.somatotype_class:
        raise HTTPException(
            status_code=400, detail="Measurement analysis not complete"
        )

    # Parse comma-separated medical conditions string into a list
    conditions_list = [
        c.strip() for c in medical_conditions.split(",") if c.strip()
    ] if medical_conditions else []

    recommendation = get_recommendation(
        somatotype=measurement.somatotype_class,
        gender=measurement.gender or "male",
        goal=goal,
        activity_level=activity_level,
        exercise_complexity=exercise_complexity,
        exercise_type=exercise_type,
        height_cm=measurement.height or 170,
        weight_kg=measurement.weight or 70,
        medical_conditions=conditions_list,
    )

    if not recommendation:
        return {
            "message": "No exact match found for your profile",
            "suggestion": "Try adjusting your activity level or exercise preferences",
        }

    return recommendation
