"""
Body fat percentage estimation service.

Implements two validated methods:

1. Durnin-Womersley (1974) — skinfold-based body density estimation
   using age/sex-specific coefficients, converted to body fat % via
   the Siri (1961) equation.
   
   Reference:
     Durnin, J.V.G.A. & Womersley, J. (1974). "Body fat assessed from
     total body density and its estimation from skinfold thickness:
     measurements on 481 men and women aged from 16 to 72 years."
     British Journal of Nutrition, 32(1), 77-97.

2. CUN-BAE (Clínica Universidad de Navarra — Body Adiposity Estimator)
   — a BMI-based equation validated against DXA.
   
   Reference:
     Gómez-Ambrosi, J. et al. (2012). "Clinical usefulness of a new
     equation for estimating body adiposity." Diabetes Care, 35(2),
     383-388.

Adaptation notes:
  - The D-W formula requires biceps, triceps, subscapular, and suprailiac
    skinfolds. This system provides triceps, subscapular, supraspinale,
    and calf skinfolds (Heath-Carter sites).
  - Supraspinale is used as a proxy for suprailiac — these sites are
    anatomically adjacent on the iliac crest area and are commonly
    treated as equivalent in the literature (ISAK guidelines).
  - Biceps skinfold is estimated from triceps using the population ratio
    (biceps ≈ 0.43 × triceps for males, 0.47 × triceps for females),
    derived from Durnin & Rahaman (1967). The biceps site contributes
    the smallest proportion (~10-15%) of the 4-site sum, so estimation
    error has minimal impact on the final body density value.
"""

import math
from typing import Dict, Optional, Tuple


# Durnin-Womersley (1974) age/sex-specific coefficients
# Body Density = C - M × log10(sum of 4 skinfolds in mm)
# Format: (age_min, age_max): (C, M)

_DW_MALE_COEFFICIENTS: Dict[Tuple[int, int], Tuple[float, float]] = {
    (17, 19): (1.1620, 0.0630),
    (20, 29): (1.1631, 0.0632),
    (30, 39): (1.1422, 0.0544),
    (40, 49): (1.1620, 0.0700),
    (50, 72): (1.1715, 0.0779),
}

_DW_FEMALE_COEFFICIENTS: Dict[Tuple[int, int], Tuple[float, float]] = {
    (17, 19): (1.1549, 0.0678),
    (20, 29): (1.1599, 0.0717),
    (30, 39): (1.1423, 0.0632),
    (40, 49): (1.1333, 0.0612),
    (50, 72): (1.1339, 0.0645),
}

# Biceps-to-triceps ratio by sex (Durnin & Rahaman, 1967)
_BICEPS_RATIO_MALE = 0.43
_BICEPS_RATIO_FEMALE = 0.47

# Physiological bounds for body fat percentage
_MIN_BODY_FAT = 2.0   # Essential fat floor (males ~2-5%, females ~10-13%)
_MAX_BODY_FAT = 60.0   # Upper physiological limit


def _get_dw_coefficients(age: int, gender: str) -> Tuple[float, float]:
    """
    Look up Durnin-Womersley coefficients for the given age and gender.

    Ages outside the 17-72 range are clamped to the nearest bracket.
    """
    coefficients = (
        _DW_MALE_COEFFICIENTS if gender.lower() == 'male'
        else _DW_FEMALE_COEFFICIENTS
    )

    # Clamp age to valid range
    age = max(17, min(72, age))

    for (age_min, age_max), (c, m) in coefficients.items():
        if age_min <= age <= age_max:
            return c, m

    # Fallback to the last bracket (should not reach here due to clamping)
    return list(coefficients.values())[-1]


def calculate_body_fat_durnin_womersley(
    triceps_mm: float,
    subscapular_mm: float,
    supraspinale_mm: float,
    age: int,
    gender: str,
) -> float:
    """
    Estimate body fat % using the Durnin-Womersley (1974) 4-site skinfold
    method with the Siri (1961) density-to-fat conversion.

    The biceps skinfold is estimated from triceps using a population-derived
    ratio. Supraspinale is used as a proxy for suprailiac.

    Args:
        triceps_mm: Triceps skinfold thickness in mm
        subscapular_mm: Subscapular skinfold thickness in mm
        supraspinale_mm: Supraspinale skinfold thickness in mm (proxy for suprailiac)
        age: Age in years (clamped to 17-72 for coefficient lookup)
        gender: 'male' or 'female'

    Returns:
        Estimated body fat percentage (clamped to physiological range)
    """
    # Estimate biceps from triceps
    is_male = gender.lower() == 'male'
    biceps_ratio = _BICEPS_RATIO_MALE if is_male else _BICEPS_RATIO_FEMALE
    biceps_mm = triceps_mm * biceps_ratio

    # Sum of 4 skinfolds (biceps + triceps + subscapular + suprailiac/supraspinale)
    sum_4_skinfolds = biceps_mm + triceps_mm + subscapular_mm + supraspinale_mm

    # Guard against invalid values
    if sum_4_skinfolds <= 0:
        return _MIN_BODY_FAT

    # Look up age/sex-specific coefficients
    c, m = _get_dw_coefficients(age, gender)

    # Body density: D = C - M × log10(sum_of_4_skinfolds)
    body_density = c - m * math.log10(sum_4_skinfolds)

    # Siri equation: BF% = (4.95 / D - 4.50) × 100
    if body_density <= 0:
        return _MAX_BODY_FAT

    body_fat_pct = (4.95 / body_density - 4.50) * 100.0

    # Clamp to physiological range
    return round(max(_MIN_BODY_FAT, min(_MAX_BODY_FAT, body_fat_pct)), 1)


def calculate_body_fat_cun_bae(
    bmi: float,
    age: int,
    gender: str,
) -> float:
    """
    Estimate body fat % using the CUN-BAE equation (Gómez-Ambrosi et al., 2012).

    This BMI-based estimator was validated against DXA in a large Spanish
    cohort and provides a useful cross-check against skinfold-based methods.

    Args:
        bmi: Body mass index (kg/m²)
        age: Age in years
        gender: 'male' or 'female'

    Returns:
        Estimated body fat percentage (clamped to physiological range)
    """
    # Sex coding: male = 1, female = 0
    sex = 1 if gender.lower() == 'male' else 0

    body_fat_pct = (
        -44.988
        + (0.503 * age)
        + (10.689 * sex)
        + (3.172 * bmi)
        - (0.026 * bmi ** 2)
        + (0.181 * bmi * sex)
        - (0.02 * bmi * age)
        - (0.005 * bmi ** 2 * sex)
        + (0.00021 * bmi ** 2 * age)
    )

    return round(max(_MIN_BODY_FAT, min(_MAX_BODY_FAT, body_fat_pct)), 1)


def estimate_body_fat(
    triceps_mm: float,
    subscapular_mm: float,
    supraspinale_mm: float,
    height_cm: float,
    weight_kg: float,
    age: int,
    gender: str,
) -> Dict[str, Optional[float]]:
    """
    Compute body fat percentage using all available data.

    Primary method: Durnin-Womersley 4-site skinfold estimation (direct
    subcutaneous fat measurement — most accurate with available data).

    Secondary method: CUN-BAE BMI-based estimation (provides independent
    cross-validation from a different measurement domain).

    The primary (D-W) result is used as the reported body fat percentage.
    Both values are returned for transparency and clinical comparison.

    Args:
        triceps_mm: Triceps skinfold in mm
        subscapular_mm: Subscapular skinfold in mm
        supraspinale_mm: Supraspinale skinfold in mm
        height_cm: Height in centimeters
        weight_kg: Weight in kilograms
        age: Age in years
        gender: 'male' or 'female'

    Returns:
        Dictionary with:
          - body_fat_percentage: Primary estimate (D-W) used for reporting
          - body_fat_dw: Durnin-Womersley skinfold-based estimate
          - body_fat_cun_bae: CUN-BAE BMI-based estimate
    """
    # Primary: Durnin-Womersley (skinfold-based)
    dw_estimate = calculate_body_fat_durnin_womersley(
        triceps_mm=triceps_mm,
        subscapular_mm=subscapular_mm,
        supraspinale_mm=supraspinale_mm,
        age=age,
        gender=gender,
    )

    # Secondary: CUN-BAE (BMI-based)
    bmi = weight_kg / (height_cm / 100.0) ** 2
    cun_bae_estimate = calculate_body_fat_cun_bae(
        bmi=bmi,
        age=age,
        gender=gender,
    )

    return {
        'body_fat_percentage': dw_estimate,
        'body_fat_dw': dw_estimate,
        'body_fat_cun_bae': cun_bae_estimate,
    }
