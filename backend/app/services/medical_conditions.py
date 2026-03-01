"""
Medical Conditions Service — Constraint-based dietary and exercise filtering
tailored for the Philippine population.

Implements a rule-based post-filter layer on diet/fitness recommendations
based on user-selected medical conditions. Each condition maps to per-serving
nutrient thresholds derived from Philippine Clinical Practice Guidelines and
international standards adapted for the Filipino context.

The system follows a "flag-don't-remove" paradigm: foods that exceed medical
thresholds are visually flagged with contextual warnings rather than silently
removed, preserving user autonomy and preventing dangerous over-restriction
in multimorbid patients.

Foundational Framework:
  - 2015 Philippine Dietary Reference Intakes (PDRI) by DOST-FNRI
  - Pinggang Pinoy (Healthy Food Plate) model
  - DOST-FNRI Philippine Food Composition Tables & Food Exchange Lists (FEL)

Condition-Specific Clinical References:
  - Philippine College of Endocrinology, Diabetes and Metabolism (PCEDM)
    UNITE for Diabetes Clinical Practice Guidelines
  - Philippine Society of Hypertension (PSH) / Philippine Heart Association
    (PHA) 2024 Clinical Practice Guidelines
  - PHA / Philippine Lipid and Atherosclerosis Society (PLAS) 2020 CPG
  - Philippine Society of Nephrology (PSN) CKD Nutrition Manual
  - Philippine Rheumatology Association (PRA) Gout Guidelines
  - PHA Council on Preventive Cardiology Guidelines
  - Philippine Association for the Study of Overweight and Obesity (PASOO)
"""

from typing import Optional


# ──────────────────────────────────────────────────────────────────────
# Clinical disclaimer — available for API endpoints / UI footers
# ──────────────────────────────────────────────────────────────────────

CLINICAL_DISCLAIMER = (
    "This tool provides dietary guidance based on Philippine Clinical Practice "
    "Guidelines and is intended as a supplementary educational resource only. "
    "It is NOT a diagnostic or prescriptive medical device. Always consult a "
    "licensed physician or Registered Nutritionist-Dietitian (RND) before "
    "making dietary changes, especially when managing complex comorbidities."
)

SYSTEM_METHODOLOGY_NOTE = (
    "Nutrient thresholds are calibrated for the Filipino population using the "
    "2015 PDRI, Pinggang Pinoy model, and DOST-FNRI Food Exchange Lists. "
    "Per-serving limits are distributed across the typical Filipino eating "
    "pattern of three main meals and two merienda occasions. Foods exceeding "
    "thresholds are flagged — not removed — to preserve user autonomy, enable "
    "contextual dietary education, and ensure safety in multimorbid patients."
)


# ──────────────────────────────────────────────────────────────────────
# Available medical conditions
# ──────────────────────────────────────────────────────────────────────

MEDICAL_CONDITIONS = [
    {"id": "diabetes", "name": "Diabetes (Type 2)", "icon": "🩸"},
    {"id": "hypertension", "name": "Hypertension", "icon": "💓"},
    {"id": "high_cholesterol", "name": "High Cholesterol", "icon": "🫀"},
    {"id": "pcos", "name": "PCOS", "icon": "🩺"},
    {"id": "kidney_disease", "name": "Kidney Disease (CKD)", "icon": "🫘"},
    {"id": "gout", "name": "Gout", "icon": "🦴"},
    {"id": "heart_disease", "name": "Heart Disease", "icon": "❤️‍🩹"},
    {"id": "obesity_related", "name": "Obesity-Related Conditions", "icon": "⚖️"},
]

VALID_CONDITION_IDS = {c["id"] for c in MEDICAL_CONDITIONS}


# ──────────────────────────────────────────────────────────────────────
# Nutrient-based food filtering rules per condition
#
# Each rule defines a *per-serving* threshold for a nutrient column that
# already exists in diet_recommendation_database.csv.  Foods that EXCEED
# the "max" threshold will be flagged with a contextual warning.
#
# Thresholds are intentionally conservative and calibrated to ensure
# cumulative daily intakes remain within safe clinical limits when
# distributed across the typical Filipino dietary pattern (3 meals +
# 2 merienda).
# ──────────────────────────────────────────────────────────────────────

CONDITION_RULES: dict[str, dict] = {
    "diabetes": {
        "label": "Diabetes-Friendly",
        "nutrient_limits": {
            "Sugars_g": {
                "max": 8.0,
                "reason": (
                    "High sugar content — may spike blood glucose. "
                    "The DOST-FNRI/WHO recommends free sugars below 5% of "
                    "daily energy (~25 g/day); 8 g/serving keeps cumulative "
                    "intake within safe limits across 3 meals + 2 merienda."
                ),
            },
        },
        "diet_note": (
            "Based on PCEDM UNITE for Diabetes guidelines: limit refined "
            "sugars and high-glycemic foods, especially polished white rice, "
            "kakanin (sweet rice cakes), and sweetened beverages. Favor "
            "high-fiber, low-GI options like whole grains, vegetables, and "
            "legumes (munggo) to maintain stable blood sugar. The system "
            "differentiates added sugars from naturally occurring fructose "
            "in whole fruits."
        ),
        "diet_source": "https://www.scribd.com/document/732963969/DM-CPG",
    },
    "hypertension": {
        "label": "Hypertension-Friendly",
        "nutrient_limits": {
            "Sodium_mg": {
                "max": 300.0,
                "reason": (
                    "High sodium — may raise blood pressure. The average "
                    "Filipino consumes ~4,113 mg sodium/day (over 2× the WHO "
                    "limit). A 300 mg/serving cap keeps daily intake within "
                    "the PSH/PHA target of ≤1,500 mg for hypertensive patients."
                ),
            },
        },
        "diet_note": (
            "Based on PSH/PHA 2024 CPG: restrict daily sodium to ≤1,500 mg. "
            "Follow DASH diet principles — increase potassium-rich fruits and "
            "vegetables. Be cautious with common Filipino sodium sources: "
            "patis (fish sauce), bagoong (shrimp paste), soy sauce, tuyo "
            "(dried salted fish), instant noodles, canned goods, and "
            "processed meats like hotdogs and tocino."
        ),
        "diet_source": "https://www.philippinesocietyofhypertension.org.ph/ClinicalPracticeGuidelines.pdf",
    },
    "high_cholesterol": {
        "label": "Cholesterol-Friendly",
        "nutrient_limits": {
            "Saturated_Fat_g": {
                "max": 5.0,
                "reason": (
                    "High saturated fat — may raise LDL cholesterol. The "
                    "PHA/PLAS 2020 CPG recommends limiting saturated fat to "
                    "5–6% of daily calories (~11–13 g/day on a 2,000 kcal "
                    "diet); 5 g/serving is a protective ceiling per meal."
                ),
            },
            "Cholesterol_mg": {
                "max": 100.0,
                "reason": (
                    "High cholesterol content — exceeds the 100 mg/serving "
                    "limit to keep daily intake below 200 mg for individuals "
                    "with established hyperlipidemia (per PHA/PLAS 2020 CPG)."
                ),
            },
        },
        "diet_note": (
            "Based on PHA/PLAS 2020 CPG: limit saturated fats and dietary "
            "cholesterol; increase soluble fiber (oats, beans) and omega-3 "
            "fatty acids. Be mindful of Filipino culinary practices that "
            "elevate saturated fat: heavy use of gata (coconut milk/cream), "
            "fatty pork cuts like liempo and pata, and deep-frying. "
            "Regular aerobic exercise is promoted to elevate protective "
            "HDL cholesterol."
        ),
        "diet_source": "https://www.asean-endocrinejournal.org/index.php/JAFES/article/view/927",
    },
    "pcos": {
        "label": "PCOS-Friendly",
        "nutrient_limits": {
            "Sugars_g": {
                "max": 8.0,
                "reason": (
                    "High sugar — may worsen insulin resistance. PCOS shares "
                    "the metabolic pathophysiology of early Type 2 Diabetes; "
                    "strict glycemic control reduces hyperinsulinemic drive "
                    "on ovarian androgen production."
                ),
            },
        },
        "diet_note": (
            "Based on PCEDM and Philippine Society of Reproductive Medicine "
            "guidance: limit refined carbohydrates and sugars to manage "
            "insulin resistance — the primary pathogenic driver in PCOS. "
            "Reducing overall glycemic load minimizes postprandial insulin "
            "spikes, dampening hyperinsulinemia and excess androgen "
            "production. Favor high-fiber, high-protein whole foods."
        ),
        "diet_source": "https://endo-society.org.ph/sept-2023-amazing-endocrinology/",
    },
    "kidney_disease": {
        "label": "Kidney-Friendly",
        "nutrient_limits": {
            "Sodium_mg": {
                "max": 250.0,
                "reason": (
                    "High sodium — may stress compromised kidneys. The PSN "
                    "mandates <2,000 mg sodium/day for CKD; 250 mg/serving "
                    "is stricter than the hypertension threshold to tightly "
                    "control osmotic load and fluid balance."
                ),
            },
            "Protein_g": {
                "max": 25.0,
                "reason": (
                    "High protein — may overload kidneys. The PSN recommends "
                    "0.60–0.75 g/kg/day for pre-dialysis CKD (~36–52 g/day "
                    "for a 60–70 kg Filipino adult); 25 g/serving allows "
                    "adequate high-biologic-value protein per meal without "
                    "exceeding renoprotective limits."
                ),
            },
        },
        "diet_note": (
            "Based on PSN CKD Nutrition Manual (aligned with KDIGO): "
            "restrict protein to 0.60–0.75 g/kg/day (pre-dialysis) and "
            "sodium to <2,000 mg/day. Watch potassium and phosphorus "
            "levels. Note: once dialysis begins, protein needs increase "
            "significantly — consult your nephrologist for individualized "
            "adjustments. This system defaults to the stricter pre-dialysis "
            "parameters to protect the widest range of users."
        ),
        "diet_source": "https://psn.org.ph/wp-content/uploads/2020/05/FK-CKD-Nutrition-Manual-eBook-.pdf",
    },
    "gout": {
        "label": "Gout-Friendly",
        "nutrient_limits": {
            "Protein_g": {
                "max": 30.0,
                "reason": (
                    "Very high protein — may increase uric acid levels. "
                    "Purine content correlates with total dietary protein; "
                    "30 g/serving acts as a secondary ceiling. Note: "
                    "plant-based proteins (e.g., munggo) are largely "
                    "exculpated by modern rheumatological evidence."
                ),
            },
        },
        "diet_note": (
            "Based on PRA Guidelines: follow a low-purine diet. Filipinos "
            "have a genetic predisposition to hyperuricemia (~1 mg/dL "
            "higher baseline serum urate than Caucasian cohorts). Avoid "
            "high-purine Filipino staples: laman-loob (organ meats like "
            "liver, kidneys, intestines used in dinuguan and isaw), "
            "shellfish, small dried fish (dilis, tuyo, sardines), and "
            "limit alcohol (especially beer) and high-fructose beverages "
            "which inhibit renal uric acid excretion. Stay well-hydrated."
        ),
        "diet_source": "https://www.rheumatologyph.org/cpg",
        # Category-based flags for high-purine food types
        "flagged_categories": ["organ_meat", "shellfish", "small_fish"],
    },
    "heart_disease": {
        "label": "Heart-Healthy",
        "nutrient_limits": {
            "Sodium_mg": {
                "max": 300.0,
                "reason": (
                    "High sodium — risky for heart health. The PHA Council "
                    "on Preventive Cardiology recommends severe sodium "
                    "curtailment to reduce hydrostatic pressure on weakened "
                    "vascular walls."
                ),
            },
            "Saturated_Fat_g": {
                "max": 5.0,
                "reason": (
                    "High saturated fat — may worsen heart condition by "
                    "accelerating atherosclerotic plaque progression "
                    "(per PHA Preventive Cardiology guidelines)."
                ),
            },
            "Cholesterol_mg": {
                "max": 100.0,
                "reason": (
                    "High cholesterol — risky for heart health. CVD dietary "
                    "restrictions serve as a composite of hypertension and "
                    "dyslipidemia filters (per PHA guidelines)."
                ),
            },
        },
        "diet_note": (
            "Based on PHA Council on Preventive Cardiology: CVD dietary "
            "restrictions are a rigorous composite of hypertension and "
            "dyslipidemia filters. Eliminate trans fats, drastically reduce "
            "saturated fats to halt plaque progression, and severely curtail "
            "sodium. Increase fruits, vegetables, whole grains, and lean "
            "proteins. Ischemic heart disease is the leading cause of death "
            "in the Philippines (~20% of all deaths)."
        ),
        "diet_source": "https://www.philheart.org/pha2025/preventive-cardiology",
    },
    "obesity_related": {
        "label": "Weight-Management",
        "nutrient_limits": {
            "Calories_kcal": {
                "max": 250.0,
                "reason": (
                    "High calorie density — may hinder weight management. "
                    "A 250 kcal/serving cap for snack/modular items helps "
                    "maintain a sustained caloric deficit without extreme "
                    "hunger (per PASOO guidelines)."
                ),
            },
            "Fat_g": {
                "max": 15.0,
                "reason": (
                    "High fat content — calorie-dense at 9 kcal/g. Limiting "
                    "fat per serving passively reduces overall energy density, "
                    "allowing higher physical volume of satiating, fiber-rich "
                    "foods (per PASOO guidelines)."
                ),
            },
        },
        "diet_note": (
            "Based on PASOO guidelines: create a sustained, scientifically "
            "sound caloric deficit combined with progressive physical "
            "activity. 39.8% of Filipino adults are now overweight/obese "
            "(2023 National Nutrition Survey). Prioritize nutrient-dense, "
            "low-calorie foods — high-fiber vegetables, whole grains, and "
            "lean proteins — to maintain satiety while reducing overall "
            "energy intake."
        ),
        "diet_source": "https://www.scribd.com/document/372579833/PASOO-Weight-Management",
    },
}


# ──────────────────────────────────────────────────────────────────────
# Exercise warnings per condition
#
# Clinically detailed, Filipino-contextualized guidance derived from
# the same Philippine CPGs referenced in CONDITION_RULES.
# ──────────────────────────────────────────────────────────────────────

EXERCISE_WARNINGS: dict[str, dict] = {
    "diabetes": {
        "warning": (
            "Per PCEDM guidelines: monitor capillary blood glucose before and "
            "after physical activity, especially if taking insulin secretagogues "
            "(e.g., sulfonylureas) or exogenous insulin. Always carry a "
            "fast-acting carbohydrate source during workouts to prevent "
            "exercise-induced hypoglycemia."
        ),
        "source": "https://endo-society.org.ph/type-2-diabetes-mellitus/",
    },
    "hypertension": {
        "warning": (
            "Per PSH/PHA 2024 CPG: favor moderate-intensity, steady-state "
            "aerobic activity (brisk walking, cycling) for at least 150 minutes "
            "per week. Avoid heavy isometric exercises and maximal-effort "
            "overhead lifts — these provoke the Valsalva maneuver, causing "
            "dangerous acute spikes in blood pressure that may precipitate "
            "hypertensive crises."
        ),
        "source": "https://pmc.ncbi.nlm.nih.gov/articles/PMC12856959/",
    },
    "high_cholesterol": {
        "warning": (
            "Per PHA/PLAS 2020 CPG: regular cardiovascular exercise (at least "
            "150 min/week) is strongly encouraged as a primary non-pharmacological "
            "mechanism for elevating protective HDL cholesterol. Progressive "
            "resistance training is also beneficial. No specific exercise "
            "restrictions apply for dyslipidemia alone."
        ),
        "source": "https://pmc.ncbi.nlm.nih.gov/articles/PMC8214350/",
    },
    "pcos": {
        "warning": (
            "Per PCEDM guidance: favor low-to-moderate impact aerobic "
            "conditioning, yoga, and moderate resistance training. Avoid highly "
            "exhaustive, sustained HIIT — it can acutely elevate cortisol, which "
            "may further disrupt the hypothalamic-pituitary-ovarian axis and "
            "worsen insulin resistance in the context of PCOS."
        ),
        "source": "https://endo-society.org.ph/sept-2023-amazing-endocrinology/",
    },
    "kidney_disease": {
        "warning": (
            "Per PSN guidelines: maintain light-to-moderate physical activity to "
            "preserve muscle mass and prevent sarcopenia. Avoid highly exhaustive "
            "workouts that could cause severe dehydration or rhabdomyolysis — "
            "muscle breakdown releases nephrotoxic myoglobin that can precipitate "
            "acute kidney injury on top of existing CKD. Consult your nephrologist."
        ),
        "source": "https://psn.org.ph/wp-content/uploads/2020/05/FK-CKD-Nutrition-Manual-eBook-.pdf",
    },
    "gout": {
        "warning": (
            "Per PRA guidelines: favor low-impact exercises (swimming, cycling, "
            "walking). Restrict high-impact, joint-stressing activities such as "
            "plyometrics or heavy running during suspected flare-ups to prevent "
            "exacerbating synovial inflammation. Maintain optimal hydration — "
            "intense exercise without adequate fluid intake concentrates serum "
            "uric acid and promotes crystal deposition."
        ),
        "source": "https://www.rheumatologyph.org/cpg",
    },
    "heart_disease": {
        "warning": (
            "Per PHA Preventive Cardiology: keep exercise at low-to-moderate "
            "steady-state aerobic intensity. Sudden high-intensity exertion can "
            "induce severe shear stress on vascular walls, potentially rupturing "
            "vulnerable atherosclerotic plaques or inducing fatal arrhythmias. "
            "Obtain formal cardiological clearance before initiating any heavy "
            "resistance training or interval work."
        ),
        "source": "https://www.philheart.org/images/guidelines/cad2014.pdf",
    },
    "obesity_related": {
        "warning": (
            "Per PASOO guidelines: prioritize low-impact, joint-friendly "
            "modalities — aquatic exercises, cycling, elliptical use, and brisk "
            "walking. Excess adipose tissue places chronic mechanical strain on "
            "load-bearing joints (knees, hips, lower back). High-impact "
            "plyometric exercises are discouraged until BMI safely decreases "
            "to a level that can tolerate ground-reaction forces."
        ),
        "source": "https://www.scribd.com/document/372579833/PASOO-Weight-Management",
    },
}


# ──────────────────────────────────────────────────────────────────────
# Exercise filtering heuristics per condition
# ──────────────────────────────────────────────────────────────────────

EXERCISE_FILTER_RULES: dict[str, dict] = {
    "hypertension": {
        "heuristics": {
            "equipment": ["barbell"],
            "name": ["deadlift", "squat", "press"],
        },
        "warning": "⚠️ Heavy compound lifts may induce the Valsalva maneuver, causing dangerous acute spikes in blood pressure (PSH/PHA).",
    },
    "obesity_related": {
        "heuristics": {
            "name": ["jump", "plyo", "burpee", "sprint", "box"],
        },
        "warning": "⚠️ High-impact plyometrics place mechanical strain on load-bearing joints and are discouraged until BMI safely decreases (PASOO).",
    },
    "kidney_disease": {
         "heuristics": {
             "name": ["hiit", "sprint", "tabata"],
         },
         "warning": "⚠️ Highly exhaustive workouts can cause severe dehydration or rhabdomyolysis, releasing nephrotoxic myoglobin (PSN).",
    },
    "pcos": {
         "heuristics": {
             "name": ["hiit", "sprint", "tabata"],
         },
         "warning": "⚠️ Highly exhaustive, sustained HIIT can acutely elevate cortisol, worsening insulin resistance (PCEDM).",
    },
    "gout": {
        "heuristics": {
             "name": ["jump", "plyo", "burpee", "sprint", "box"],
        },
        "warning": "⚠️ Restrict high-impact, joint-stressing activities during suspected flares to prevent exacerbating synovial inflammation (PRA).",
    }
}


# ──────────────────────────────────────────────────────────────────────
# Core filtering functions
# ──────────────────────────────────────────────────────────────────────

def validate_conditions(conditions: list[str]) -> list[str]:
    """Return only valid condition IDs from the input list."""
    return [c for c in conditions if c in VALID_CONDITION_IDS]


def filter_foods_by_conditions(
    foods: list[dict],
    conditions: list[str],
) -> list[dict]:
    """
    Apply condition-based nutrient filtering to a list of food items.

    Each food item is checked against the nutrient thresholds for ALL
    selected conditions.  Foods that violate any threshold get a
    ``warnings`` list and a ``flagged`` boolean added; compliant foods
    get ``flagged: False`` and an empty ``warnings`` list.

    The foods are NOT removed — they are flagged so the UI can display
    them with a visual warning indicator (flag-don't-remove paradigm).
    """
    if not conditions:
        # No conditions → return foods unmodified (with flagged=False)
        for food in foods:
            food["flagged"] = False
            food["warnings"] = []
        return foods

    valid = validate_conditions(conditions)
    if not valid:
        for food in foods:
            food["flagged"] = False
            food["warnings"] = []
        return foods

    for food in foods:
        warnings: list[str] = []

        for cond_id in valid:
            rules = CONDITION_RULES.get(cond_id)
            if not rules:
                continue

            # Check nutrient thresholds
            for nutrient_key, limit in rules.get("nutrient_limits", {}).items():
                food_value = food.get(nutrient_key.lower(), food.get(nutrient_key, 0))
                # Try exact key first, then case-insensitive lookup
                if food_value == 0:
                    for k, v in food.items():
                        if k.lower() == nutrient_key.lower():
                            food_value = v
                            break

                try:
                    food_value = float(food_value)
                except (TypeError, ValueError):
                    food_value = 0.0

                max_val = limit.get("max")
                if max_val is not None and food_value > max_val:
                    warnings.append(
                        f"⚠️ {limit['reason']} "
                        f"({nutrient_key.replace('_', ' ')}: {food_value:.1f})"
                    )

            # Check flagged categories (e.g., gout → organ_meat / shellfish / small_fish)
            flagged_cats = rules.get("flagged_categories", [])
            if flagged_cats:
                food_cat = str(food.get("category", "")).lower()
                for cat in flagged_cats:
                    if cat in food_cat:
                        warnings.append(
                            f"⚠️ {food_cat} foods may worsen {cond_id.replace('_', ' ')}"
                        )

        food["flagged"] = len(warnings) > 0
        food["warnings"] = warnings

    return foods


def filter_exercises_by_conditions(
    exercises: list[dict],
    conditions: list[str],
) -> list[dict]:
    """
    Apply condition-based heuristic filtering to a list of exercises.
    
    Exercises matching problematic heuristics (e.g., barbells for Hypertension)
    will get `flagged: True` and contextual warnings. Valid exercises get
    `flagged: False` and empty warnings.
    """
    if not conditions:
        for ex in exercises:
            ex["flagged"] = False
            ex["warnings"] = []
        return exercises

    valid = validate_conditions(conditions)
    if not valid:
        for ex in exercises:
            ex["flagged"] = False
            ex["warnings"] = []
        return exercises

    for ex in exercises:
        warnings: list[str] = []
        ex_name = str(ex.get("name", "")).lower()
        ex_equipments = [str(eq).lower() for eq in ex.get("equipments", [])]
        
        for cond_id in valid:
            rules = EXERCISE_FILTER_RULES.get(cond_id)
            if not rules:
                continue
                
            heuristics = rules.get("heuristics", {})
            flag_triggered = False
            
            # Check equipment heuristics
            for eq in heuristics.get("equipment", []):
                if any(eq in e for e in ex_equipments):
                    flag_triggered = True
                    break
                    
            # Check name heuristics
            if not flag_triggered:
                for keyword in heuristics.get("name", []):
                    if keyword in ex_name:
                        flag_triggered = True
                        break
                        
            if flag_triggered:
                warnings.append(rules["warning"])
                
        ex["flagged"] = len(warnings) > 0
        ex["warnings"] = warnings

    return exercises


def get_exercise_warnings(conditions: list[str]) -> list[str]:
    """Return exercise caution notes for the given conditions."""
    valid = validate_conditions(conditions)
    warnings = []
    for cond_id in valid:
        entry = EXERCISE_WARNINGS.get(cond_id)
        if entry:
            cond_name = next(
                (c["name"] for c in MEDICAL_CONDITIONS if c["id"] == cond_id),
                cond_id,
            )
            warning_text = entry["warning"] if isinstance(entry, dict) else entry
            source = entry.get("source", "") if isinstance(entry, dict) else ""
            line = f"**{cond_name}:** {warning_text}"
            if source:
                line += f"\nSource: {source}"
            warnings.append(line)
    return warnings


def get_medical_notes(conditions: list[str]) -> list[str]:
    """Return dietary adjustment notes for the given conditions."""
    valid = validate_conditions(conditions)
    notes = []
    for cond_id in valid:
        rules = CONDITION_RULES.get(cond_id)
        if rules and rules.get("diet_note"):
            cond_name = next(
                (c["name"] for c in MEDICAL_CONDITIONS if c["id"] == cond_id),
                cond_id,
            )
            line = f"**{cond_name}:** {rules['diet_note']}"
            source = rules.get("diet_source", "")
            if source:
                line += f"\nSource: {source}"
            notes.append(line)
    return notes
