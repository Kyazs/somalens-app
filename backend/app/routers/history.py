from typing import Annotated, List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select
from app.database import get_session
from app.models.measurement import Measurement
from app.models.user import User
from app.core.dependencies import get_current_user

router = APIRouter(prefix="/history", tags=["history"])

@router.get("/", response_model=List[Measurement])
async def get_history(
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[Session, Depends(get_session)],
):
    """
    Return list of user's past measurement sessions.
    """
    statement = select(Measurement).where(Measurement.user_id == current_user.id).order_by(Measurement.created_at.desc())
    results = session.exec(statement).all()
    return results

@router.get("/{measurement_id}", response_model=Measurement)
async def get_measurement_detail(
    measurement_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[Session, Depends(get_session)],
):
    """
    Return full details of a specific measurement session.
    """
    statement = select(Measurement).where(Measurement.id == measurement_id, Measurement.user_id == current_user.id)
    measurement = session.exec(statement).first()
    
    if not measurement:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Measurement session not found",
        )
        
    return measurement
