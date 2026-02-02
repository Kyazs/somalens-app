"""
Somatotype calculation service.

Implements Heath-Carter Method B for somatotype classification.
"""

from typing import Dict


def calculate_heath_carter(
    height_cm: float,
    weight_kg: float,
    triceps_mm: float,
    subscapular_mm: float,
    supraspinale_mm: float,
    calf_skinfold_mm: float,
    humerus_breadth_cm: float,
    femur_breadth_cm: float,
    arm_girth_cm: float,
    calf_girth_cm: float,
) -> Dict[str, float]:
    """
    Calculate Heath-Carter anthropometric somatotype using standard formulas.
    
    All measurements should be in their standard units:
    - Heights/girths/breadths: centimeters
    - Skinfolds: millimeters
    - Weight: kilograms
    
    Returns:
        Dictionary with endomorphy, mesomorphy, ectomorphy ratings
    """
    # 1. ENDOMORPHY CALCULATION
    # Sum of three skinfolds (triceps, subscapular, supraspinale)
    sum_3_skinfolds = triceps_mm + subscapular_mm + supraspinale_mm

    # Height-correction factor
    x = sum_3_skinfolds * (170.18 / height_cm)

    # Endomorphy formula
    endomorphy = -0.7182 + 0.1451 * x - 0.00068 * (x**2) + 0.0000014 * (x**3)
    if endomorphy <= 0:
        endomorphy = 0.1

    # 2. MESOMORPHY CALCULATION
    # Corrected girths (girth - skinfold in cm)
    corrected_arm_girth = arm_girth_cm - (triceps_mm / 10.0)
    corrected_calf_girth = calf_girth_cm - (calf_skinfold_mm / 10.0)

    # Mesomorphy formula
    mesomorphy = (
        0.858 * humerus_breadth_cm
        + 0.601 * femur_breadth_cm
        + 0.188 * corrected_arm_girth
        + 0.161 * corrected_calf_girth
        - height_cm * 0.131
        + 4.5
    )
    if mesomorphy <= 0:
        mesomorphy = 0.1

    # 3. ECTOMORPHY CALCULATION
    # Height-Weight Ratio (HWR)
    hwr = height_cm / (weight_kg ** (1 / 3))

    # Ectomorphy formula based on HWR
    if hwr >= 40.75:
        ectomorphy = 0.732 * hwr - 28.58
    elif hwr > 38.25:
        ectomorphy = 0.463 * hwr - 17.63
    else:
        ectomorphy = 0.1

    return {
        "endomorphy": round(endomorphy, 1),
        "mesomorphy": round(mesomorphy, 1),
        "ectomorphy": round(ectomorphy, 1),
        "hwr": round(hwr, 2),
        "corrected_arm_girth": round(corrected_arm_girth, 1),
        "corrected_calf_girth": round(corrected_calf_girth, 1),
    }


def classify_somatotype(
    endomorphy: float, mesomorphy: float, ectomorphy: float, threshold: float = 0.5
) -> str:
    """
    Classify somatotype into standard Heath-Carter categories.
    
    Categories:
    1. Central - All three components balanced
    2. Endomorph - Endomorphy dominant
    3. Mesomorph - Mesomorphy dominant
    4. Ectomorph - Ectomorphy dominant
    5. Endomorph-Mesomorph - Both Endo & Meso high, Ecto low
    6. Mesomorph-Ectomorph - Both Meso & Ecto high, Endo low
    7. Endomorph-Ectomorph - Both Endo & Ecto high, Meso low (rare)
    
    Args:
        endomorphy: Endomorphy component value
        mesomorphy: Mesomorphy component value
        ectomorphy: Ectomorphy component value
        threshold: Threshold for component dominance (default: 0.5)
        
    Returns:
        Somatotype category string
    """
    # 1. CENTRAL/BALANCED: All components within threshold of each other
    max_diff = max(
        abs(endomorphy - mesomorphy),
        abs(endomorphy - ectomorphy),
        abs(mesomorphy - ectomorphy),
    )
    if max_diff <= threshold:
        return "Central"

    # 2. SINGLE DOMINANT: One component clearly higher than both others
    if endomorphy > mesomorphy + threshold and endomorphy > ectomorphy + threshold:
        return "Endomorph"

    if mesomorphy > endomorphy + threshold and mesomorphy > ectomorphy + threshold:
        return "Mesomorph"

    if ectomorphy > endomorphy + threshold and ectomorphy > mesomorphy + threshold:
        return "Ectomorph"

    # 3. CO-DOMINANT: Two components high, one low
    if endomorphy > ectomorphy + threshold and mesomorphy > ectomorphy + threshold:
        return "Endomorph-Mesomorph"

    if mesomorphy > endomorphy + threshold and ectomorphy > endomorphy + threshold:
        return "Mesomorph-Ectomorph"

    if endomorphy > mesomorphy + threshold and ectomorphy > mesomorphy + threshold:
        return "Endomorph-Ectomorph"

    # 4. FALLBACK: Classify by highest component
    max_component = max(endomorphy, mesomorphy, ectomorphy)
    if max_component == endomorphy:
        return "Endomorph"
    elif max_component == mesomorphy:
        return "Mesomorph"
    else:
        return "Ectomorph"
