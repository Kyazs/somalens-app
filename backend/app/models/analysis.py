from datetime import datetime
from typing import Optional, Dict, Any
from sqlmodel import SQLModel, Field
from sqlalchemy import JSON, Column

class AnalysisBase(SQLModel):
    measurement_id: int = Field(foreign_key="measurement.id", index=True)
    recommendation_id: int | None = Field(default=None, foreign_key="recommendation.id")
    status: str = Field(default="pending")
    result: Optional[Dict[str, Any]] = Field(default=None, sa_column=Column(JSON))
    error_message: Optional[str] = None
    model_version: Optional[str] = None

class Analysis(AnalysisBase, table=True):
    id: int | None = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
