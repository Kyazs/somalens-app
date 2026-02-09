from datetime import datetime
from enum import Enum

from sqlmodel import Field, SQLModel


class Goal(str, Enum):
    WEIGHT_LOSS = "weight_loss"
    WEIGHT_GAIN = "weight_gain"
    MAINTENANCE = "maintenance"


class ActivityLevel(str, Enum):
    SEDENTARY = "sedentary"
    LIGHT = "light"
    MODERATE = "moderate"
    HEAVY = "heavy"


class ExerciseType(str, Enum):
    BODYWEIGHT = "bodyweight"
    GYM = "gym"


class ExerciseComplexity(str, Enum):
    BEGINNER = "beginner"
    INTERMEDIATE = "intermediate"
    HARD = "hard"


class Recommendation(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    template_id: str = Field(nullable=False)
    ter: int = Field(nullable=False)
    goal: Goal
    activity_level: ActivityLevel
    exercise_type: ExerciseType
    exercise_complexity: ExerciseComplexity
    created_at: datetime = Field(default_factory=datetime.utcnow)



