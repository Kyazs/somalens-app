from typing import Optional

import pandas as pd

from app.services.data_loader import (
    get_template,
    get_exercises_by_ids,
    parse_foods_with_nutrients,
)


def calculate_dbw(height_cm: float) -> float:
    return (height_cm - 100) - (0.10 * (height_cm - 100))


def get_pa_factor(activity_level: str) -> int:
    factors = {"sedentary": 30, "light": 35, "moderate": 40, "heavy": 45}
    return factors.get(activity_level.lower(), 30)


def calculate_ter(
    weight_kg: float, height_cm: float, activity_level: str, goal: str
) -> int:
    dbw = calculate_dbw(height_cm)
    pa = get_pa_factor(activity_level)

    if goal == "weight_loss":
        return int((weight_kg * pa) - 500)
    elif goal == "weight_gain":
        return int((weight_kg * pa) + 500)
    else:
        return int(dbw * pa)


def calculate_macros(
    ter: int, protein_pct: int, carbs_pct: int, fats_pct: int
) -> dict:
    return {
        "protein_g": round((ter * protein_pct / 100) / 4),
        "carbs_g": round((ter * carbs_pct / 100) / 4),
        "fats_g": round((ter * fats_pct / 100) / 9),
        "protein_pct": protein_pct,
        "carbs_pct": carbs_pct,
        "fats_pct": fats_pct,
    }


def parse_ids(value: str) -> list[str]:
    if not value or pd.isna(value):
        return []
    return [id.strip() for id in value.split(",") if id.strip()]


def get_recommendation(
    somatotype: str,
    gender: str,
    goal: str,
    activity_level: str,
    exercise_complexity: str,
    exercise_type: str,
    height_cm: float,
    weight_kg: float,
) -> Optional[dict]:
    template = get_template(
        somatotype, gender, goal, activity_level, exercise_complexity, exercise_type
    )

    if not template:
        return None

    ter = calculate_ter(weight_kg, height_cm, activity_level, goal)
    macros = calculate_macros(
        ter,
        int(template.get("protein_pct", 20)),
        int(template.get("carbs_pct", 50)),
        int(template.get("fats_pct", 30)),
    )

    meals = {
        "breakfast": parse_foods_with_nutrients(template.get("breakfast_foods", "")),
        "lunch": parse_foods_with_nutrients(template.get("lunch_foods", "")),
        "dinner": parse_foods_with_nutrients(template.get("dinner_foods", "")),
        "snacks": parse_foods_with_nutrients(template.get("snack_foods", "")),
    }

    if exercise_type == "gym":
        exercises_ppl = {
            "push": get_exercises_by_ids(parse_ids(template.get("push_exercises", ""))),
            "pull": get_exercises_by_ids(parse_ids(template.get("pull_exercises", ""))),
            "legs": get_exercises_by_ids(parse_ids(template.get("legs_exercises", ""))),
        }
        exercises = None
    else:
        exercises = get_exercises_by_ids(parse_ids(template.get("bodyweight_exercises", "")))
        exercises_ppl = None

    return {
        "template_id": template.get("template_id"),
        "ter": ter,
        "macros": macros,
        "meals": meals,
        "fitness_strategy": template.get("fitness_strategy", ""),
        "diet_principles": template.get("diet_principles", ""),
        "exercises": exercises,
        "exercises_ppl": exercises_ppl,
        "exercise_type": exercise_type,
        "somatotype_description": template.get("description", ""),
    }
