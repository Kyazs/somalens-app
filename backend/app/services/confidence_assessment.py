"""
Measurement Confidence Assessment Service (Conformal Prediction)
================================================================

Port of the root-level confidence_assessment.py for backend use.

Implements per-measurement conformal prediction intervals and subject-level
confidence scoring. Validated in Research V3 Phase 71 (AUROC=0.795, p=0.009).

This is diagnostic-only: it annotates confidence, never modifies values.
"""

import numpy as np
from app.services.somatotype import calculate_heath_carter, classify_somatotype


def _to_native(obj):
    """Recursively convert numpy types to native Python types for JSON serialization."""
    if isinstance(obj, dict):
        return {k: _to_native(v) for k, v in obj.items()}
    elif isinstance(obj, (list, tuple)):
        return [_to_native(v) for v in obj]
    elif isinstance(obj, (np.bool_,)):
        return bool(obj)
    elif isinstance(obj, (np.integer,)):
        return int(obj)
    elif isinstance(obj, (np.floating,)):
        return float(obj)
    elif isinstance(obj, np.ndarray):
        return obj.tolist()
    return obj


# ============================================================
# EMPIRICAL LOOCV ERROR STATISTICS (Phase 68/70b, N=30)
# ============================================================

LOOCV_MAE = {
    'Triceps_Skinfold':           4.1140,   # mm
    'Subscapular_Skinfold':       1.8279,   # mm
    'Supraspinale_Skinfold':      3.7760,   # mm
    'Calf_Skinfold':              3.9608,   # mm
    'Arm_Circumference_Flexed':   2.0006,   # cm
    'Calf_Circumference':         0.8503,   # cm
    'Humerus_Breadth':            0.2199,   # cm
    'Femur_Breadth':              0.3455,   # cm
}

# 90th percentile of LOOCV absolute residuals (conformal quantile)
CONFORMAL_Q90 = {
    'Triceps_Skinfold':           9.0710,  # mm
    'Subscapular_Skinfold':       4.5239,  # mm
    'Supraspinale_Skinfold':      6.8266,  # mm
    'Calf_Skinfold':              8.6030,  # mm
    'Arm_Circumference_Flexed':   3.9683,  # cm
    'Calf_Circumference':         1.6229,  # cm
    'Humerus_Breadth':            0.4427,  # cm
    'Femur_Breadth':              0.5650,  # cm
}

ALL_MEASUREMENTS = [
    'Triceps_Skinfold', 'Subscapular_Skinfold',
    'Supraspinale_Skinfold', 'Calf_Skinfold',
    'Arm_Circumference_Flexed', 'Calf_Circumference',
    'Humerus_Breadth', 'Femur_Breadth',
]

UNITS = {
    'Triceps_Skinfold': 'mm', 'Subscapular_Skinfold': 'mm',
    'Supraspinale_Skinfold': 'mm', 'Calf_Skinfold': 'mm',
    'Arm_Circumference_Flexed': 'cm', 'Calf_Circumference': 'cm',
    'Humerus_Breadth': 'cm', 'Femur_Breadth': 'cm',
}


def compute_jacobian(tri, sub, sup, calf_sf, arm, calf_c, hum, fem,
                     h_cm, w_kg):
    """Compute 3x8 Jacobian of Heath-Carter w.r.t. 8 measurements."""
    sum_sf = tri + sub + sup
    X = sum_sf * (170.18 / h_cm)
    dEndo_dX = 0.1451 - 2 * 0.00068 * X + 3 * 0.0000014 * (X ** 2)
    dX_dSf = 170.18 / h_cm

    dEndo_dTri = dEndo_dX * dX_dSf
    dEndo_dSub = dEndo_dX * dX_dSf
    dEndo_dSup = dEndo_dX * dX_dSf

    J = {
        'Triceps_Skinfold':         {'endo': dEndo_dTri, 'meso': -0.0188, 'ecto': 0.0},
        'Subscapular_Skinfold':     {'endo': dEndo_dSub, 'meso': 0.0,     'ecto': 0.0},
        'Supraspinale_Skinfold':    {'endo': dEndo_dSup, 'meso': 0.0,     'ecto': 0.0},
        'Calf_Skinfold':            {'endo': 0.0,        'meso': -0.0161, 'ecto': 0.0},
        'Arm_Circumference_Flexed': {'endo': 0.0,        'meso': 0.188,   'ecto': 0.0},
        'Calf_Circumference':       {'endo': 0.0,        'meso': 0.161,   'ecto': 0.0},
        'Humerus_Breadth':          {'endo': 0.0,        'meso': 0.858,   'ecto': 0.0},
        'Femur_Breadth':            {'endo': 0.0,        'meso': 0.601,   'ecto': 0.0},
    }
    return J


class ConfidenceAssessor:
    """
    Assesses confidence of ML-predicted somatotype measurements using
    conformal prediction intervals and Jacobian-propagated uncertainty.

    Diagnostic-only: flags unreliable measurements but never modifies values.
    """

    def __init__(self, tau=1.0, alpha=0.10):
        self.tau = tau
        self.alpha = alpha
        self.loocv_mae = LOOCV_MAE.copy()
        self.conformal_q = CONFORMAL_Q90.copy()

    def assess(self, measurements, height_cm, weight_kg,
               classification_threshold=1.75):
        """
        Run full confidence assessment.

        Returns dict with: confidence, n_flagged, flagged_measurements,
        conformal_intervals, per_measurement, uncertainty_band,
        boundary_sensitive, tau, explanation.
        """
        tri = measurements.get('Triceps_Skinfold', 0)
        sub = measurements.get('Subscapular_Skinfold', 0)
        sup = measurements.get('Supraspinale_Skinfold', 0)
        csf = measurements.get('Calf_Skinfold', 0)
        arm = measurements.get('Arm_Circumference_Flexed', 0)
        cal = measurements.get('Calf_Circumference', 0)
        hum = measurements.get('Humerus_Breadth', 0)
        fem = measurements.get('Femur_Breadth', 0)

        J = compute_jacobian(tri, sub, sup, csf, arm, cal, hum, fem,
                             height_cm, weight_kg)

        per_measurement = []
        flagged_measurements = []
        conformal_intervals = {}

        for m in ALL_MEASUREMENTS:
            val = measurements.get(m, 0)
            mae = self.loocv_mae[m]
            q = self.conformal_q[m]
            unit = UNITS[m]
            partials = J[m]

            ci_lower = max(val - q, 0.1)
            ci_upper = val + q
            conformal_intervals[m] = {
                'value': round(val, 2),
                'lower': round(ci_lower, 2),
                'upper': round(ci_upper, 2),
                'half_width': round(q, 2),
                'unit': unit,
            }

            impact_endo = abs(partials['endo']) * q
            impact_meso = abs(partials['meso']) * q
            impact_ecto = abs(partials['ecto']) * q
            max_impact = max(impact_endo, impact_meso, impact_ecto)
            flagged = max_impact > self.tau

            if flagged:
                flagged_measurements.append(m)

            per_measurement.append({
                'measurement': m,
                'value': round(val, 2),
                'mae': round(mae, 4),
                'conformal_q90': round(q, 2),
                'ci_lower': round(ci_lower, 2),
                'ci_upper': round(ci_upper, 2),
                'impact_endo': round(impact_endo, 4),
                'impact_meso': round(impact_meso, 4),
                'impact_ecto': round(impact_ecto, 4),
                'max_impact': round(max_impact, 4),
                'flagged': flagged,
            })

        n_flagged = len(flagged_measurements)
        if n_flagged == 0:
            confidence = 'HIGH'
        elif n_flagged <= 2:
            confidence = 'MEDIUM'
        else:
            confidence = 'LOW'

        unc_endo = sum(abs(d['impact_endo']) for d in per_measurement)
        unc_meso = sum(abs(d['impact_meso']) for d in per_measurement)
        unc_ecto = sum(abs(d['impact_ecto']) for d in per_measurement)
        uncertainty_band = {
            'endo': round(unc_endo, 3),
            'meso': round(unc_meso, 3),
            'ecto': round(unc_ecto, 3),
        }

        boundary_sensitive = self._check_boundary_sensitivity(
            measurements, height_cm, weight_kg,
            uncertainty_band, classification_threshold
        )

        explanation = self._build_explanation(
            confidence, n_flagged, flagged_measurements,
            uncertainty_band, boundary_sensitive, conformal_intervals
        )

        near_border_classes = self._find_near_border_classes(
            measurements, height_cm, weight_kg, classification_threshold,
            border_threshold=1.0
        )

        return _to_native({
            'confidence': confidence,
            'n_flagged': n_flagged,
            'flagged_measurements': flagged_measurements,
            'conformal_intervals': conformal_intervals,
            'per_measurement': per_measurement,
            'uncertainty_band': uncertainty_band,
            'boundary_sensitive': boundary_sensitive,
            'near_border_classes': near_border_classes,
            'tau': self.tau,
            'alpha': self.alpha,
            'explanation': explanation,
        })

    def _check_boundary_sensitivity(self, measurements, height_cm, weight_kg,
                                     uncertainty_band, threshold):
        """Check if the uncertainty band crosses a classification boundary."""
        soma = calculate_heath_carter(
            height_cm=height_cm, weight_kg=weight_kg,
            triceps_mm=measurements.get('Triceps_Skinfold', 0),
            subscapular_mm=measurements.get('Subscapular_Skinfold', 0),
            supraspinale_mm=measurements.get('Supraspinale_Skinfold', 0),
            calf_skinfold_mm=measurements.get('Calf_Skinfold', 0),
            humerus_breadth_cm=measurements.get('Humerus_Breadth', 0),
            femur_breadth_cm=measurements.get('Femur_Breadth', 0),
            arm_girth_cm=measurements.get('Arm_Circumference_Flexed', 0),
            calf_girth_cm=measurements.get('Calf_Circumference', 0),
        )

        pred_e = soma['endomorphy']
        pred_m = soma['mesomorphy']
        pred_x = soma['ectomorphy']
        base_cls = classify_somatotype(pred_e, pred_m, pred_x, threshold=threshold)

        unc_e = uncertainty_band['endo']
        unc_m = uncertainty_band['meso']

        for de in [-unc_e, unc_e]:
            for dm in [-unc_m, unc_m]:
                alt_e = max(pred_e + de, 0.1)
                alt_m = max(pred_m + dm, 0.1)
                alt_cls = classify_somatotype(alt_e, alt_m, pred_x, threshold=threshold)
                if alt_cls != base_cls:
                    return True
        return False

    def _find_near_border_classes(self, measurements, height_cm, weight_kg,
                                   classification_threshold, border_threshold=1.0):
        """
        Find alternative somatotype classifications reachable within
        border_threshold of the current Endo/Meso/Ecto values.

        Returns a list of unique alternative classification names.
        """
        soma = calculate_heath_carter(
            height_cm=height_cm, weight_kg=weight_kg,
            triceps_mm=measurements.get('Triceps_Skinfold', 0),
            subscapular_mm=measurements.get('Subscapular_Skinfold', 0),
            supraspinale_mm=measurements.get('Supraspinale_Skinfold', 0),
            calf_skinfold_mm=measurements.get('Calf_Skinfold', 0),
            humerus_breadth_cm=measurements.get('Humerus_Breadth', 0),
            femur_breadth_cm=measurements.get('Femur_Breadth', 0),
            arm_girth_cm=measurements.get('Arm_Circumference_Flexed', 0),
            calf_girth_cm=measurements.get('Calf_Circumference', 0),
        )

        pred_e = soma['endomorphy']
        pred_m = soma['mesomorphy']
        pred_x = soma['ectomorphy']
        base_cls = classify_somatotype(pred_e, pred_m, pred_x,
                                       threshold=classification_threshold)

        # Probe the classification space within ±border_threshold
        steps = [i * 0.25 for i in range(-4, 5)]  # -1.0 to +1.0 in 0.25 steps
        alt_classes = set()
        for de in steps:
            for dm in steps:
                for dx in steps:
                    alt_e = max(pred_e + de, 0.1)
                    alt_m = max(pred_m + dm, 0.1)
                    alt_x = max(pred_x + dx, 0.1)
                    alt_cls = classify_somatotype(alt_e, alt_m, alt_x,
                                                  threshold=classification_threshold)
                    if alt_cls != base_cls:
                        alt_classes.add(alt_cls)

        return sorted(alt_classes)

    def _build_explanation(self, confidence, n_flagged, flagged_measurements,
                           uncertainty_band, boundary_sensitive,
                           conformal_intervals):
        """Build a human-readable explanation string."""
        alpha_pct = int((1 - self.alpha) * 100)

        if confidence == 'HIGH':
            text = (f"HIGH confidence: All 8 measurements have conformal-"
                    f"propagated somatotype impact below τ={self.tau}. "
                    f"Each measurement is within the {alpha_pct}% prediction "
                    f"interval calibrated from 30-subject LOOCV.")
        elif confidence == 'MEDIUM':
            flagged_str = ', '.join(flagged_measurements)
            ci_details = []
            for m in flagged_measurements:
                ci = conformal_intervals[m]
                ci_details.append(
                    f"{m}: {ci['value']}{ci['unit']} "
                    f"[{alpha_pct}% CI: {ci['lower']}–{ci['upper']}{ci['unit']}]"
                )
            text = (f"MEDIUM confidence: {n_flagged} measurement(s) flagged "
                    f"({flagged_str}). "
                    f"Somatotype uncertainty band: "
                    f"Endo ±{uncertainty_band['endo']:.2f}, "
                    f"Meso ±{uncertainty_band['meso']:.2f}. "
                    f"Conformal intervals: {'; '.join(ci_details)}.")
        else:
            flagged_str = ', '.join(flagged_measurements)
            text = (f"LOW confidence: {n_flagged} measurements flagged "
                    f"({flagged_str}). "
                    f"Somatotype uncertainty band: "
                    f"Endo ±{uncertainty_band['endo']:.2f}, "
                    f"Meso ±{uncertainty_band['meso']:.2f}.")

        if boundary_sensitive:
            text += (" BOUNDARY-SENSITIVE: The uncertainty band crosses a "
                     "classification boundary — the somatotype category may "
                     "differ within the measurement error range.")
        return text
