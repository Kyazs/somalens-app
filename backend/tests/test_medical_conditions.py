"""
Tests for the Filipino-adapted medical conditions module.

Verifies that nutrient thresholds match the methodology document's
threshold matrix, all conditions are properly configured, and the
filtering functions work correctly.
"""
import pytest
import sys
import os

current_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.dirname(current_dir)
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.services.medical_conditions import (
    MEDICAL_CONDITIONS,
    VALID_CONDITION_IDS,
    CONDITION_RULES,
    EXERCISE_WARNINGS,
    CLINICAL_DISCLAIMER,
    SYSTEM_METHODOLOGY_NOTE,
    validate_conditions,
    filter_foods_by_conditions,
    get_exercise_warnings,
    get_medical_notes,
)


# ──────────────────────────────────────────────────────────────────────
# Expected thresholds from the methodology document (Threshold Matrix)
# ──────────────────────────────────────────────────────────────────────

EXPECTED_THRESHOLDS = {
    "diabetes":        {"Sugars_g": 8.0},
    "hypertension":    {"Sodium_mg": 300.0},
    "high_cholesterol": {"Saturated_Fat_g": 5.0, "Cholesterol_mg": 100.0},
    "pcos":            {"Sugars_g": 8.0},
    "kidney_disease":  {"Sodium_mg": 250.0, "Protein_g": 25.0},
    "gout":            {"Protein_g": 30.0},
    "heart_disease":   {"Sodium_mg": 300.0, "Saturated_Fat_g": 5.0, "Cholesterol_mg": 100.0},
    "obesity_related": {"Calories_kcal": 250.0, "Fat_g": 15.0},
}


class TestConditionRegistry:
    """Verify all 8 conditions are registered and consistent."""

    def test_eight_conditions_exist(self):
        assert len(MEDICAL_CONDITIONS) == 8

    def test_all_ids_in_valid_set(self):
        for cond in MEDICAL_CONDITIONS:
            assert cond["id"] in VALID_CONDITION_IDS

    def test_all_ids_have_rules(self):
        for cond_id in VALID_CONDITION_IDS:
            assert cond_id in CONDITION_RULES, f"Missing rules for {cond_id}"

    def test_all_ids_have_exercise_warnings(self):
        for cond_id in VALID_CONDITION_IDS:
            assert cond_id in EXERCISE_WARNINGS, f"Missing exercise warning for {cond_id}"


class TestNutrientThresholds:
    """Verify thresholds match the methodology document exactly."""

    @pytest.mark.parametrize("cond_id,expected", EXPECTED_THRESHOLDS.items())
    def test_threshold_values(self, cond_id, expected):
        rules = CONDITION_RULES[cond_id]
        actual_limits = rules["nutrient_limits"]

        # Check all expected nutrients are present with correct max values
        for nutrient_key, expected_max in expected.items():
            assert nutrient_key in actual_limits, (
                f"{cond_id}: missing nutrient {nutrient_key}"
            )
            assert actual_limits[nutrient_key]["max"] == expected_max, (
                f"{cond_id}/{nutrient_key}: expected max={expected_max}, "
                f"got {actual_limits[nutrient_key]['max']}"
            )

        # Ensure no unexpected extra nutrient limits
        assert set(actual_limits.keys()) == set(expected.keys()), (
            f"{cond_id}: unexpected extra nutrients "
            f"{set(actual_limits.keys()) - set(expected.keys())}"
        )


class TestGoutCategoryFlags:
    """Verify gout has all three required category flags."""

    def test_gout_flags_include_organ_meat(self):
        assert "organ_meat" in CONDITION_RULES["gout"]["flagged_categories"]

    def test_gout_flags_include_shellfish(self):
        assert "shellfish" in CONDITION_RULES["gout"]["flagged_categories"]

    def test_gout_flags_include_small_fish(self):
        assert "small_fish" in CONDITION_RULES["gout"]["flagged_categories"]


class TestClinicalDisclaimer:
    """Verify disclaimer and methodology note exist."""

    def test_disclaimer_is_nonempty(self):
        assert len(CLINICAL_DISCLAIMER) > 0

    def test_methodology_note_is_nonempty(self):
        assert len(SYSTEM_METHODOLOGY_NOTE) > 0

    def test_disclaimer_mentions_physician(self):
        assert "physician" in CLINICAL_DISCLAIMER.lower()

    def test_methodology_note_mentions_pdri(self):
        assert "PDRI" in SYSTEM_METHODOLOGY_NOTE


class TestFilterFunction:
    """Verify filter_foods_by_conditions flag-don't-remove behavior."""

    def test_high_sodium_flagged_for_hypertension(self):
        foods = [
            {"name": "Tuyo", "Sodium_mg": 850, "category": "fish"},
            {"name": "Kangkong", "Sodium_mg": 50, "category": "vegetable"},
        ]
        result = filter_foods_by_conditions(foods, ["hypertension"])

        # Both foods should still be present (flag-don't-remove)
        assert len(result) == 2

        # Tuyo should be flagged
        tuyo = result[0]
        assert tuyo["flagged"] is True
        assert len(tuyo["warnings"]) > 0

        # Kangkong should NOT be flagged
        kangkong = result[1]
        assert kangkong["flagged"] is False
        assert len(kangkong["warnings"]) == 0

    def test_organ_meat_flagged_for_gout(self):
        foods = [
            {"name": "Dinuguan", "Protein_g": 20, "category": "organ_meat"},
        ]
        result = filter_foods_by_conditions(foods, ["gout"])

        assert result[0]["flagged"] is True
        assert any("organ_meat" in w for w in result[0]["warnings"])

    def test_no_conditions_returns_unflagged(self):
        foods = [{"name": "Rice", "Sodium_mg": 5}]
        result = filter_foods_by_conditions(foods, [])

        assert result[0]["flagged"] is False
        assert result[0]["warnings"] == []

    def test_multimorbidity_composite_flags(self):
        """A food violating both hypertension AND cholesterol rules."""
        foods = [
            {
                "name": "Lechon Kawali",
                "Sodium_mg": 500,
                "Saturated_Fat_g": 12,
                "Cholesterol_mg": 150,
                "category": "pork",
            },
        ]
        result = filter_foods_by_conditions(
            foods, ["hypertension", "high_cholesterol"]
        )

        assert result[0]["flagged"] is True
        # Should have warnings from both conditions
        assert len(result[0]["warnings"]) >= 3  # sodium + sat fat + cholesterol


class TestExerciseAndMedicalNotes:
    """Verify helper functions return notes for all conditions."""

    def test_exercise_warnings_for_all(self):
        all_ids = list(VALID_CONDITION_IDS)
        warnings = get_exercise_warnings(all_ids)
        assert len(warnings) == 8

    def test_medical_notes_for_all(self):
        all_ids = list(VALID_CONDITION_IDS)
        notes = get_medical_notes(all_ids)
        assert len(notes) == 8

    def test_invalid_condition_ignored(self):
        warnings = get_exercise_warnings(["nonexistent_condition"])
        assert len(warnings) == 0

    def test_validate_conditions_filters_invalid(self):
        result = validate_conditions(["diabetes", "fake", "gout"])
        assert result == ["diabetes", "gout"]
