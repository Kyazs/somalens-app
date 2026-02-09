from datetime import datetime
from typing import Optional, Dict, Any

from sqlalchemy import JSON, Column
from sqlmodel import Field, SQLModel


class MeasurementBase(SQLModel):
    user_id: int = Field(foreign_key="user.id", index=True)
    name: Optional[str] = Field(default="Untitled Measurement")
    front_image_url: Optional[str] = None

    side_image_url: Optional[str] = None
    height: Optional[float] = None
    weight: Optional[float] = None
    gender: Optional[str] = None
    age: Optional[int] = None
    somatotype_endo: Optional[float] = None
    somatotype_meso: Optional[float] = None
    somatotype_ecto: Optional[float] = None
    somatotype_class: Optional[str] = None
    body_fat_percentage: Optional[float] = None
    circumferences: Optional[Dict[str, Any]] = Field(default=None, sa_column=Column(JSON))


class Measurement(MeasurementBase, table=True):
    id: int | None = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class MeasurementCreate(MeasurementBase):
    pass


class MeasurementRead(MeasurementBase):
    id: int
    created_at: datetime
