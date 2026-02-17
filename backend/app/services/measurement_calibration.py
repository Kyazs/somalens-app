"""
Measurement Calibration Module (G13 + G38)
==========================================

Implements BayesianRidge-based calibration for skinfold (G13) and girth/breadth
(G38) measurements, as validated in Research V3 Phases 37-42.

G13 Calibration: Per-skinfold BayesianRidge using SVR/RF predictions + CNN features
G38 Calibration: Per-girth/breadth BayesianRidge using RF predictions + CNN features

These calibrations correct the domain gap between CAESAR-trained models and the
Filipino test population.

Usage:
    # Production inference (load pre-trained models):
    calibrator = MeasurementCalibrator()
    calibrator.load_models()
    cal_skinfolds = calibrator.calibrate_skinfolds(raw_svr_preds, demographics, cnn_features)
    cal_girths = calibrator.calibrate_girths(raw_rf_preds, demographics, cnn_features)
"""

import os
import pickle
import json
import numpy as np
from sklearn.linear_model import BayesianRidge, LinearRegression

MODEL_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'ml_models')


class MeasurementCalibrator:
    """
    Calibrates raw SVR/RF predictions using BayesianRidge models trained
    on Filipino ground truth data (G13 for skinfolds, G38 for girths).
    
    Pre-trained models are loaded from data/models/ for production use.
    For training, use train_and_save_models() or the training script.
    """
    
    SKINFOLD_TARGETS = ['Triceps_Skinfold', 'Subscapular_Skinfold',
                        'Supraspinale_Skinfold', 'Calf_Skinfold']
    
    GIRTH_TARGETS = ['Arm_Circumference_Flexed', 'Calf_Circumference',
                     'Humerus_Breadth', 'Femur_Breadth']
    
    def __init__(self):
        self.g13_models = {}  # Skinfold calibration models
        self.g38_models = {}  # Girth calibration models
        self.humerus_offset = 0.0  # Simple offset for humerus
        self.is_loaded = False
    
    def load_models(self, model_dir=None):
        """Load pre-trained calibration models from disk."""
        if model_dir is None:
            model_dir = MODEL_DIR
        
        # Load G13 skinfold models
        for target in self.SKINFOLD_TARGETS:
            path = os.path.join(model_dir, f'g13_{target}.pkl')
            if os.path.exists(path):
                with open(path, 'rb') as f:
                    self.g13_models[target] = pickle.load(f)
            else:
                print(f"  WARNING: G13 model not found: {path}")
        
        # Load G38 girth models
        for target in ['arm_girth', 'calf_girth', 'femur_breadth']:
            path = os.path.join(model_dir, f'g38_{target}.pkl')
            if os.path.exists(path):
                with open(path, 'rb') as f:
                    self.g38_models[target] = pickle.load(f)
            else:
                print(f"  WARNING: G38 model not found: {path}")
        
        # Load humerus offset
        offset_path = os.path.join(model_dir, 'g38_humerus_offset.json')
        if os.path.exists(offset_path):
            with open(offset_path, 'r') as f:
                self.humerus_offset = json.load(f)['offset']
        else:
            print(f"  WARNING: Humerus offset not found: {offset_path}")
        
        self.is_loaded = True
        n_loaded = len(self.g13_models) + len(self.g38_models)
        print(f"  Loaded {n_loaded} calibration models + humerus offset")
    
    def calibrate_skinfolds(self, raw_svr_preds, rf_preds, height_cm, weight_kg,
                             cnn_features):
        """
        Apply G13 BayesianRidge calibration to skinfold predictions.
        
        Args:
            raw_svr_preds: dict with keys Triceps_Skinfold, Subscapular_Skinfold, etc.
                          Values are floats (single-subject prediction in mm)
            rf_preds: dict with RF predictions (need Supraspinale_Skinfold)
            height_cm: float
            weight_kg: float
            cnn_features: dict with CNN-extracted features (ankle_cm, shoulder_cm,
                         arm_cm, calf_cm, waist_cm, hip_cm)
        
        Returns:
            dict: Calibrated skinfold values (mm)
        """
        if not self.is_loaded:
            self.load_models()
        
        bmi = weight_kg / ((height_cm / 100.0) ** 2)
        calibrated = {}
        
        # Feature sets per skinfold (matching Phase 42 exactly)
        feature_configs = {
            'Triceps_Skinfold': np.array([[
                raw_svr_preds['Triceps_Skinfold'], height_cm, weight_kg,
                cnn_features.get('ankle_cm', 0), cnn_features.get('shoulder_cm', 0),
                cnn_features.get('arm_cm', 0), cnn_features.get('calf_cm', 0)
            ]]),
            'Subscapular_Skinfold': np.array([[
                raw_svr_preds['Subscapular_Skinfold'], height_cm, weight_kg,
                cnn_features.get('waist_cm', 0), cnn_features.get('hip_cm', 0)
            ]]),
            'Supraspinale_Skinfold': np.array([[
                rf_preds.get('Supraspinale_Skinfold', raw_svr_preds.get('Supraspinale_Skinfold', 0)),
                height_cm, weight_kg
            ]]),
            'Calf_Skinfold': np.array([[
                raw_svr_preds['Calf_Skinfold'], height_cm, weight_kg, bmi
            ]]),
        }
        
        for target in self.SKINFOLD_TARGETS:
            if target in self.g13_models:
                X = feature_configs[target]
                pred = self.g13_models[target].predict(X)[0]
                calibrated[target] = max(pred, 0.1)  # Floor at 0.1mm
            else:
                # Fallback: use raw prediction
                calibrated[target] = raw_svr_preds.get(target, 0)
        
        return calibrated
    
    def calibrate_girths(self, raw_rf_preds, height_cm, weight_kg, cnn_features):
        """
        Apply G38 BayesianRidge calibration to girth/breadth predictions.
        
        Args:
            raw_rf_preds: dict with keys Arm_Circumference_Flexed, Calf_Circumference,
                         Humerus_Breadth, Femur_Breadth (in cm)
            height_cm: float
            weight_kg: float
            cnn_features: dict with CNN-extracted features (calf_cm, ankle_cm,
                         thigh_cm, knee_h_cm)
        
        Returns:
            dict: Calibrated girth/breadth values (cm)
        """
        if not self.is_loaded:
            self.load_models()
        
        bmi = weight_kg / ((height_cm / 100.0) ** 2)
        calibrated = {}
        
        # Arm circumference
        if 'arm_girth' in self.g38_models:
            X = np.array([[raw_rf_preds['Arm_Circumference_Flexed'],
                           height_cm, weight_kg, bmi]])
            calibrated['Arm_Circumference_Flexed'] = self.g38_models['arm_girth'].predict(X)[0]
        else:
            calibrated['Arm_Circumference_Flexed'] = raw_rf_preds['Arm_Circumference_Flexed']
        
        # Calf circumference
        if 'calf_girth' in self.g38_models:
            X = np.array([[raw_rf_preds['Calf_Circumference'],
                           cnn_features.get('calf_cm', 0),
                           height_cm, weight_kg, bmi,
                           cnn_features.get('ankle_cm', 0),
                           cnn_features.get('thigh_cm', 0)]])
            calibrated['Calf_Circumference'] = self.g38_models['calf_girth'].predict(X)[0]
        else:
            calibrated['Calf_Circumference'] = raw_rf_preds['Calf_Circumference']
        
        # Humerus breadth (simple offset)
        calibrated['Humerus_Breadth'] = raw_rf_preds['Humerus_Breadth'] + self.humerus_offset
        
        # Femur breadth
        if 'femur_breadth' in self.g38_models:
            X = np.array([[raw_rf_preds['Femur_Breadth'],
                           height_cm, weight_kg,
                           cnn_features.get('ankle_cm', 0),
                           cnn_features.get('knee_h_cm', 0)]])
            calibrated['Femur_Breadth'] = self.g38_models['femur_breadth'].predict(X)[0]
        else:
            calibrated['Femur_Breadth'] = raw_rf_preds['Femur_Breadth']
        
        return calibrated
