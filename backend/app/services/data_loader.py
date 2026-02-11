import json
from pathlib import Path
from typing import Optional

import pandas as pd

DATA_DIR = Path(__file__).parent.parent.parent / "data"

_templates_cache: dict = {}
_exercises_cache: dict = {}
_diet_foods_cache: dict = {}


def load_recommendation_templates() -> dict:
    global _templates_cache
    if _templates_cache:
        return _templates_cache

    csv_path = DATA_DIR / "recommendation_templates.csv"
    df = pd.read_csv(csv_path)

    for _, row in df.iterrows():
        key = (
            row["somatotype"].lower(),
            row["gender"].lower(),
            row["goal"].lower(),
            row["activity_level"].lower(),
            row["exercise_complexity"].lower(),
            row["exercise_type"].lower(),
        )
        _templates_cache[key] = row.to_dict()

    return _templates_cache


def load_exercises() -> dict:
    global _exercises_cache
    if _exercises_cache:
        return _exercises_cache

    json_path = DATA_DIR / "exercises.json"
    with open(json_path) as f:
        exercises = json.load(f)

    for ex in exercises:
        _exercises_cache[ex["exerciseId"]] = ex

    return _exercises_cache


def _normalize_somatotype_key(somatotype: str) -> str:
    mapping = {
        "endomorph-mesomorph": "endo_meso",
        "mesomorph-ectomorph": "meso_ecto",
        "endomorph-ectomorph": "endo_ecto",
    }
    return mapping.get(somatotype.lower(), somatotype.lower())


def get_template(
    somatotype: str,
    gender: str,
    goal: str,
    activity_level: str,
    exercise_complexity: str,
    exercise_type: str,
) -> Optional[dict]:
    templates = load_recommendation_templates()
    key = (
        _normalize_somatotype_key(somatotype),
        gender.lower(),
        goal.lower(),
        activity_level.lower(),
        exercise_complexity.lower(),
        exercise_type.lower(),
    )
    return templates.get(key)


def get_exercises_by_ids(ids: list[str]) -> list[dict]:
    exercises = load_exercises()
    result = []
    for exercise_id in ids:
        exercise_id = exercise_id.strip()
        if exercise_id and exercise_id in exercises:
            result.append(exercises[exercise_id])
    return result


def parse_exercise_ids(template: dict, exercise_type: str) -> list[str]:
    ids = []
    if exercise_type == "gym":
        for col in ["push_exercises", "pull_exercises", "legs_exercises"]:
            if template.get(col) and pd.notna(template[col]):
                ids.extend(template[col].split(","))
    else:
        if template.get("bodyweight_exercises") and pd.notna(template["bodyweight_exercises"]):
            ids.extend(template["bodyweight_exercises"].split(","))
    return [id.strip() for id in ids if id.strip()]


def parse_foods(food_string: str) -> list[str]:
    if not food_string or pd.isna(food_string):
        return []
    return [f.strip() for f in food_string.split("|") if f.strip()]


def load_diet_foods() -> dict:
    """Load diet recommendation database with nutrient info."""
    global _diet_foods_cache
    if _diet_foods_cache:
        return _diet_foods_cache

    csv_path = DATA_DIR / "diet_recommendation_database.csv"
    df = pd.read_csv(csv_path)

    for _, row in df.iterrows():
        food_name = str(row["Food_Item"]).strip().lower()
        _diet_foods_cache[food_name] = {
            "name": row["Food_Item"],
            "category": row.get("Enhanced_Category", ""),
            "calories_kcal": float(row.get("Calories_kcal", 0)),
            "protein_g": float(row.get("Protein_g", 0)),
            "carbohydrates_g": float(row.get("Carbohydrates_g", 0)),
            "fat_g": float(row.get("Fat_g", 0)),
            "fiber_g": float(row.get("Fiber_g", 0)),
            "sugars_g": float(row.get("Sugars_g", 0)),
            "sodium_mg": float(row.get("Sodium_mg", 0)),
            "portion_recommendation": row.get("Portion_Recommendation", ""),
            "meal_timing": row.get("Meal_Timing", ""),
        }

    return _diet_foods_cache


def get_food_with_nutrients(food_name: str) -> Optional[dict]:
    """Look up a food item and return it with nutrient info."""
    foods = load_diet_foods()
    food_key = food_name.strip().lower()
    
    # Try exact match first
    if food_key in foods:
        return foods[food_key]
    
    # Try partial match (food name contains or is contained by)
    for key, food_data in foods.items():
        if food_key in key or key in food_key:
            return food_data
    
    # No match found - return basic info with zeroed nutrients
    return {
        "name": food_name,
        "category": "",
        "calories_kcal": 0,
        "protein_g": 0,
        "carbohydrates_g": 0,
        "fat_g": 0,
        "fiber_g": 0,
        "sugars_g": 0,
        "sodium_mg": 0,
        "portion_recommendation": "",
        "meal_timing": "",
    }


def parse_foods_with_nutrients(food_string: str) -> list[dict]:
    """Parse food string and return list of foods with nutrient info."""
    if not food_string or pd.isna(food_string):
        return []
    
    food_names = [f.strip() for f in food_string.split("|") if f.strip()]
    return [get_food_with_nutrients(name) for name in food_names]
