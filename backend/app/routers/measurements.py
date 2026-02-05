from typing import Annotated, Optional
import shutil
import os
import uuid
from fastapi import APIRouter, Depends, File, Form, UploadFile, HTTPException, Request
from sqlmodel import Session
from app.database import get_session
from app.models.measurement import Measurement
from app.models.user import User
from app.core.dependencies import get_current_user
from app.tasks.ml import process_measurement

router = APIRouter(prefix="/measurements", tags=["measurements"])

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.post("/analyze", response_model=Measurement)
async def analyze_measurements(
    request: Request,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[Session, Depends(get_session)],
    front_image: UploadFile = File(...),
    side_image: UploadFile = File(...),
    age: int = Form(...),
    gender: str = Form(...),
    height: float = Form(...),
    weight: float = Form(...),
):
    """
    Analyze body measurements from front and side images.
    """
    # Validation
    if gender.lower() not in ["male", "female"]:
        raise HTTPException(status_code=422, detail="Gender must be 'male' or 'female'")
    if age < 10 or age > 100:
        raise HTTPException(status_code=422, detail="Age must be between 10 and 100")
    if height < 100 or height > 250:
        raise HTTPException(status_code=422, detail="Height must be between 100 and 250 cm")
    if weight < 30 or weight > 200:
        raise HTTPException(status_code=422, detail="Weight must be between 30 and 200 kg")

    # Save images
    # We use UUID to prevent filename collisions
    front_filename = f"{uuid.uuid4()}_{front_image.filename}"
    side_filename = f"{uuid.uuid4()}_{side_image.filename}"
    front_path = os.path.join(UPLOAD_DIR, front_filename)
    side_path = os.path.join(UPLOAD_DIR, side_filename)

    try:
        with open(front_path, "wb") as buffer:
            shutil.copyfileobj(front_image.file, buffer)
        with open(side_path, "wb") as buffer:
            shutil.copyfileobj(side_image.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save images: {str(e)}")

    # Construct URLs
    # Assuming /static is mounted to serve UPLOAD_DIR
    base_url = str(request.base_url).rstrip("/")
    front_url = f"{base_url}/static/{front_filename}"
    side_url = f"{base_url}/static/{side_filename}"

    # Create Measurement record
    measurement = Measurement(
        user_id=current_user.id,
        front_image_url=front_url,
        side_image_url=side_url,
        age=age,
        gender=gender,
        height=height,
        weight=weight,
        # status="pending" # Implicit status based on missing results
    )
    session.add(measurement)
    session.commit()
    session.refresh(measurement)

    # Dispatch task
    process_measurement.delay(measurement.id)

    return measurement
